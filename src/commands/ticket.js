import { PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isStaff, logAction } from '../utils.js';

const stmtTicket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');
const stmtInsertNote = db.prepare('INSERT INTO notes (ticket_id, author_id, content) VALUES (?, ?, ?)');

export default {
  async execute(interaction) {
    const name = interaction.commandName;
    const member = interaction.member;
    const channel = interaction.channel;

    const ticket = stmtTicket.get(channel.id);
    if (!ticket) {
      return interaction.reply({ content: 'This is not a ticket channel.', flags: MessageFlags.Ephemeral });
    }
    if (!isStaff(member)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
    }

    if (name === 'add') {
      const user = interaction.options.getUser('user');
      await channel.permissionOverwrites.edit(user.id, { ViewChannel: true });
      logAction(channel.id, 'add', member.id, user.id);
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`➕ ${user} has been added to this ticket by ${member}.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === 'remove') {
      const user = interaction.options.getUser('user');
      await channel.permissionOverwrites.delete(user.id).catch(() => {});
      logAction(channel.id, 'remove', member.id, user.id);
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`➖ ${user} has been removed from this ticket by ${member}.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === 'rename') {
      const newName = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      await channel.setName(newName);
      logAction(channel.id, 'rename', member.id, null, newName);
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`✏️ Channel renamed to \`${newName}\` by ${member}.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === 'note') {
      const noteContent = interaction.options.getString('content');
      stmtInsertNote.run(ticket.id, member.id, noteContent);
      logAction(channel.id, 'note', member.id, null, noteContent);
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription('Note added. It will be included in the transcript.');
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
