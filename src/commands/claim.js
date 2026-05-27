import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { canClaimTicket, claimTicket, isBuilderTicket } from '../services/claimService.js';
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

    if (ticket.claimed_by) {
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`This ticket is already claimed by <@${ticket.claimed_by}>.`);
      return interaction.editReply({ embeds: [embed] });
    }

    const check = canClaimTicket(interaction.member, ticket.type);
    if (!check.allowed) {
      const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription(check.reason);
      return interaction.editReply({ embeds: [embed] });
    }

    await claimTicket(channel, ticket, interaction.member);

    const type = ticket.type;
    const claimMsg = type === 'buysell'
      ? `${interaction.member} will be handling this spawner request.`
      : type === 'regear'
        ? `${interaction.member} will sell your regear or stuff.`
        : isBuilderTicket(type)
          ? `This build will be handled by ${interaction.member}.`
          : `This ticket has been claimed by ${interaction.member}. Only they can type.`;
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('Ticket Claimed')
      .setDescription(claimMsg)
      .setFooter({ text: 'Tickets' })
      .setTimestamp();

    await channel.send({ embeds: [embed], content: `<@${ticket.user_id}>` });

    await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xF1C40F).setDescription('Ticket claimed.')] });

    info(`Ticket #${channel.name} claimed by ${interaction.user.tag}`);
  },
};
