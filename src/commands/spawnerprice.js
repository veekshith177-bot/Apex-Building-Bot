import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isMod } from '../utils.js';

export default {
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'update') return handleUpdate(interaction);
  },
};

async function handleUpdate(interaction) {
  if (!isMod(interaction.member)) {
    return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
  }

  const price = interaction.options.getString('price');
  const channelId = process.env.SPAWNER_PRICE_CHANNEL_ID;
  const roleId = process.env.SPAWNER_PING_ROLE_ID;
  const emoji = process.env.SPAWNER_EMOJI || '🥚';

  if (!channelId) {
    return interaction.reply({ content: 'SPAWNER_PRICE_CHANNEL_ID not configured in .env.', flags: MessageFlags.Ephemeral });
  }

  const channel = interaction.guild.channels.cache.get(channelId);
  if (!channel) {
    return interaction.reply({ content: 'Spawner price channel not found.', flags: MessageFlags.Ephemeral });
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`${emoji} Spawner Restock`)
    .setDescription([
      `${emoji} We have just restocked **skeleton spawners**!`,
      '',
      `**Price per Spawner:** ${price}`,
      '',
      'Head over to Tickets And Create An Buy/Sell Ticket To Buy',
      '',
      'Click the button below to get pinged on future restocks.',
    ].join('\n'))
    .setFooter({ text: 'Spawner Prices' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('spawner_ping_toggle')
      .setLabel('Get Ping When We Restock')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔔'),
  );

  const content = roleId ? `<@&${roleId}>` : '';
  const msg = await channel.send({ content, embeds: [embed], components: [row] });

  const existing = db.prepare('SELECT message_id FROM spawner_messages LIMIT 1').get();
  if (existing) {
    try {
      const oldMsg = await channel.messages.fetch(existing.message_id).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});
    } catch {}
    db.prepare('UPDATE spawner_messages SET message_id = ? WHERE id = ?').run(msg.id, existing.id);
  } else {
    db.prepare('INSERT INTO spawner_messages (message_id) VALUES (?)').run(msg.id);
  }

  const replyEmbed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setDescription(`Restock announcement sent to ${channel}.`);
  await interaction.reply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });
}
