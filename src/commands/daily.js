import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isStaff } from '../utils.js';
import { endGiveaway } from '../events/giveawayEnd.js';

export default {
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'giveaway') return handleStart(interaction);
    if (sub === 'stop') return handleStop(interaction);
  },
};

async function handleStart(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const existing = db.prepare('SELECT * FROM daily_config WHERE id = 1').get();
  if (existing?.active) {
    return interaction.editReply({ content: 'A daily giveaway is already running.' });
  }

  const prize = interaction.options.getString('prize');
  const endsAt = new Date(Date.now() + 86_400_000);

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🎉 Daily Giveaway')
    .setDescription([
      `**Prize:** ${prize}`,
      `**Winners:** 2`,
      `**Hosted by:** <@${interaction.member.id}>`,
      `**Entries:** 0`,
      '',
      `Ends: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
      '',
      'Hit the button to enter!',
    ].join('\n'))
    .setImage(process.env.PANEL_BANNER_URL)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter').setStyle(ButtonStyle.Success).setEmoji('🎉'),
  );

  const pingRole = process.env.GIVEAWAY_PING_ROLE_ID;
  const content = pingRole ? `<@&${pingRole}>` : '';
  const msg = await interaction.channel.send({ content, embeds: [embed], components: [row], allowedMentions: { parse: ['roles'] } });

  db.prepare('INSERT INTO giveaways (message_id, channel_id, prize, winners, ends_at, hosted_by, mode) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(msg.id, interaction.channel.id, prize, 2, endsAt.toISOString(), interaction.member.id, 'daily');

  if (existing) {
    db.prepare('UPDATE daily_config SET channel_id = ?, prize = ?, active = 1 WHERE id = 1').run(interaction.channel.id, prize);
  } else {
    db.prepare('INSERT INTO daily_config (channel_id, prize, active) VALUES (?, ?, 1)').run(interaction.channel.id, prize);
  }

  await interaction.editReply({ content: `Daily giveaway started! Prize: ${prize}. First draw in 24h.` });
}

async function handleStop(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const config = db.prepare('SELECT * FROM daily_config WHERE id = 1').get();
  if (!config?.active) {
    return interaction.editReply({ content: 'No active daily giveaway.' });
  }

  db.prepare('UPDATE daily_config SET active = 0 WHERE id = 1').run();

  const active = db.prepare("SELECT * FROM giveaways WHERE mode = 'daily' AND ended = 0 ORDER BY id DESC LIMIT 1").get();
  if (active) {
    const channel = await interaction.client.channels.fetch(active.channel_id).catch(() => null);
    if (channel) {
      await endGiveaway(interaction.client, active, channel);
    }
  }

  await interaction.editReply({ content: 'Daily giveaway stopped.' });
}
