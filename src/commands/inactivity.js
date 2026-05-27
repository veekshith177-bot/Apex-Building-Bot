import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isStaff, logAction } from '../utils.js';

const stmtTicket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'");
const stmtSetWarning = db.prepare("UPDATE tickets SET inactivity_warned_at = datetime('now') WHERE id = ?");

export default {
  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'You need to be staff to use this.', flags: MessageFlags.Ephemeral });
    }

    const ticket = stmtTicket.get(interaction.channel.id);
    if (!ticket) {
      return interaction.reply({ content: 'This is not an open ticket channel.', flags: MessageFlags.Ephemeral });
    }

    if (ticket.inactivity_warned_at) {
      return interaction.reply({ content: 'Inactivity warning already sent for this ticket.', flags: MessageFlags.Ephemeral });
    }

    stmtSetWarning.run(ticket.id);
    logAction(interaction.channel.id, 'note', interaction.member.id, null, 'Inactivity warning sent');

    const content = `<@${ticket.user_id}>`;

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('⚠️ Inactivity Warning')
      .setDescription([
        `This ticket has been flagged for inactivity by <@${interaction.member.id}>.`,
        '',
        `If there is no response within **24 hours**, this ticket will be **automatically closed**.`,
        '',
        'Please respond to keep your ticket open.',
      ].join('\n'))
      .setTimestamp();

    await interaction.channel.send({ content, embeds: [embed] });
    await interaction.reply({ content: 'Inactivity warning sent. Ticket will auto-close in 24h if there is no response.', flags: MessageFlags.Ephemeral });
  },
};
