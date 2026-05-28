import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isStaff } from '../utils.js';
import { endGiveaway } from '../events/giveawayEnd.js';
import { THEME } from '../ui/theme.js';

const stmtGetDailyConfig = db.prepare('SELECT * FROM daily_config WHERE id = 1');
const stmtInsertDailyGiveaway = db.prepare('INSERT INTO giveaways (message_id, channel_id, prize, winners, ends_at, hosted_by, mode) VALUES (?, ?, ?, ?, ?, ?, ?)');
const stmtUpdateDailyConfig = db.prepare('UPDATE daily_config SET channel_id = ?, prize = ?, active = 1 WHERE id = 1');
const stmtInsertDailyConfig = db.prepare('INSERT INTO daily_config (channel_id, prize, active) VALUES (?, ?, 1)');
const stmtStopDailyConfig = db.prepare('UPDATE daily_config SET active = 0 WHERE id = 1');
const stmtLatestActiveDaily = db.prepare("SELECT * FROM giveaways WHERE mode = 'daily' AND ended = 0 ORDER BY id DESC LIMIT 1");

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

  const existing = stmtGetDailyConfig.get();
  if (existing?.active) {
    return interaction.editReply({ content: 'A daily giveaway is already running.' });
  }

  const prize = interaction.options.getString('prize');
  const endsAt = new Date(Date.now() + 86_400_000);

  const embed = new EmbedBuilder()
    .setColor(THEME.colors.warn)
    .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
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

  stmtInsertDailyGiveaway.run(msg.id, interaction.channel.id, prize, 2, endsAt.toISOString(), interaction.member.id, 'daily');

  if (existing) {
    stmtUpdateDailyConfig.run(interaction.channel.id, prize);
  } else {
    stmtInsertDailyConfig.run(interaction.channel.id, prize);
  }

  await interaction.editReply({ content: `Daily giveaway started! Prize: ${prize}. First draw in 24h.` });
}

async function handleStop(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const config = stmtGetDailyConfig.get();
  if (!config?.active) {
    return interaction.editReply({ content: 'No active daily giveaway.' });
  }

  stmtStopDailyConfig.run();

  const active = stmtLatestActiveDaily.get();
  if (active) {
    const channel = await interaction.client.channels.fetch(active.channel_id).catch(() => null);
    if (channel) {
      await endGiveaway(interaction.client, active, channel);
    }
  }

  await interaction.editReply({ content: 'Daily giveaway stopped.' });
}
