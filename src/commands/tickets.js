import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isStaff, isAdmin } from '../utils.js';

const stmtOpenTickets = db.prepare("SELECT * FROM tickets WHERE status = 'open' ORDER BY created_at DESC");
const stmtClosedTickets = db.prepare("SELECT * FROM tickets WHERE status = 'closed' ORDER BY created_at DESC LIMIT 10");
const stmtTotalCount = db.prepare('SELECT COUNT(*) as c FROM tickets');
const stmtUserTickets = db.prepare('SELECT * FROM tickets WHERE user_id = ? ORDER BY created_at DESC');

export default {
  async execute(interaction) {
    const member = interaction.member;
    const isStaffMember = isStaff(member);
    const isAdminMember = isAdmin(member);

    if (isStaffMember) {
      const adminTypes = ['rank', 'refund'];
      const open = stmtOpenTickets.all();
      const closed = stmtClosedTickets.all();
      const visibleOpen = isAdminMember ? open : open.filter(t => !adminTypes.includes(t.type));
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('Ticket Dashboard')
        .addFields(
          { name: 'Open Tickets', value: String(visibleOpen.length), inline: true },
          { name: 'Total Tickets', value: String(stmtTotalCount.get().c), inline: true },
        );
      if (visibleOpen.length) {
        embed.addFields({ name: 'Recent Open', value: visibleOpen.slice(0, 5).map(t => `<#${t.channel_id}> — <@${t.user_id}>`).join('\n') });
      }
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const userTickets = stmtUserTickets.all(member.id);
    const openTickets = userTickets.filter(t => t.status === 'open');
    const closedTickets = userTickets.filter(t => t.status === 'closed');

    let desc = '';
    if (openTickets.length) {
      desc += '**Open Tickets:**\n' + openTickets.map(t => `<#${t.channel_id}>`).join('\n') + '\n\n';
    }
    if (closedTickets.length) {
      desc += '**Recent Closed:**\n' + closedTickets.slice(0, 5).map(t => `<#${t.channel_id}>`).join('\n');
    }
    if (!desc) desc = 'You have no tickets.';

    const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('Your Tickets').setDescription(desc);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
