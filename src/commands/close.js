import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isStaff } from '../utils.js';

const stmtTicket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'");

export default {
  async execute(interaction) {
    const channel = interaction.channel;
    const ticket = stmtTicket.get(channel.id);
    if (!ticket) {
      const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('This is not an open ticket channel.');
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
    if (!isStaff(interaction.member) && interaction.user.id !== ticket.user_id) {
      const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Only staff or the ticket creator can request to close a ticket.');
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('Close this ticket?')
      .setDescription(`<@${interaction.member.id}> wants to close this ticket.`)
      .setFooter({ text: 'Confirm to close' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('close_confirm').setLabel('Yes, close it').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );

    await channel.send({ embeds: [embed], components: [row] });
    const replyEmbed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Close request sent.');
    await interaction.reply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });
  },
};
