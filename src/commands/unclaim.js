import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { unclaimTicket, isBuilderTicket, isBuilderRole, isBuysellTicket } from '../services/claimService.js';
import { isStaff } from '../utils.js';
import { info } from '../logger.js';

const stmtTicket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?');

export default {
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.channel;
    const ticket = stmtTicket.get(channel.id);
    if (!ticket) {
      return interaction.editReply({ content: 'This is not a ticket channel.' });
    }

    if (!ticket.claimed_by) {
      return interaction.editReply({ content: 'This ticket is not claimed.' });
    }

    const ownerBypass = process.env.OWNER_ROLE_ID && interaction.member.roles.cache.has(process.env.OWNER_ROLE_ID);
    const isClaimer = ticket.claimed_by === interaction.member.id;
    const isBuilderUnclaim = isBuilderTicket(ticket.type) && isBuilderRole(interaction.member);
    const isSellerUnclaim = isBuysellTicket(ticket.type) && interaction.member.roles.cache.has(process.env.TRUSTED_SELLER_ROLE_ID);
    const isRegearUnclaim = ticket.type === 'regear' && interaction.member.roles.cache.has(process.env.REGEAR_ROLE_ID);
    if (!ownerBypass && !isClaimer && !isStaff(interaction.member) && !isBuilderUnclaim && !isSellerUnclaim && !isRegearUnclaim) {
      return interaction.editReply({ content: 'Only the claimer or staff can unclaim this ticket.' });
    }

    await unclaimTicket(channel, ticket, interaction.member);

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setDescription(`Ticket unclaimed by ${interaction.member}. Staff can now type again.`);
    await channel.send({ embeds: [embed] });

    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setDescription('Ticket unclaimed.')] });

    info(`Ticket #${channel.name} unclaimed by ${interaction.user.tag}`);
  },
};
