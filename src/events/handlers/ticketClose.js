import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import db from '../../database.js';
import { isStaff, logAction } from '../../utils.js';
import { generateTranscript } from '../../transcript.js';
import { info, error as logError } from '../../logger.js';

const BUILDER_RATED_TYPES = ['build', 'digout', 'refund', 'bedrock'];

const stmtTicketByChannel = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'");
const stmtCloseTicket = db.prepare("UPDATE tickets SET status = 'closed', closed_at = datetime('now') WHERE id = ?");

const stmtInsertRating = db.prepare('INSERT INTO ratings (ticket_id, user_id, stars, feedback, target_id) VALUES (?, ?, ?, ?, ?)');
const stmtInsertReputation = db.prepare('INSERT INTO reputation (ticket_id, rater_id, target_id, stars, feedback) VALUES (?, ?, ?, ?, ?)');

export async function handleCloseRequest(interaction) {
  const channel = interaction.channel;
  const ticket = stmtTicketByChannel.get(channel.id);
  if (!ticket) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Ticket already closed or not found.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('Close this ticket?')
    .setDescription(`<@${interaction.member.id}> wants to close this ticket.`)
    .setFooter({ text: isStaff(interaction.member) ? 'Staff can close directly' : 'Ticket creator can confirm' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_confirm').setLabel('Yes, close it').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('close_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  await channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Close request sent.', flags: MessageFlags.Ephemeral });
}

export async function finalizeClose(client, channel, ticket, actorId) {
  stmtCloseTicket.run(ticket.id);
  logAction(channel.id, 'close', actorId);
  info(`Ticket closed: #${channel.name} by ${actorId}`);

  try {
    const transcript = await generateTranscript(channel);
    const transcriptChannel = client.channels.cache.get(process.env.TRANSCRIPT_LOGS_CHANNEL_ID);
    if (transcriptChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('Ticket Closed')
        .setDescription(`**Channel:** ${channel.name}\n**User:** <@${ticket.user_id}>\n**Type:** ${ticket.type}`)
        .setTimestamp();
      await transcriptChannel.send({ embeds: [embed], files: [transcript] });
    }

    const user = await client.users.fetch(ticket.user_id).catch(() => null);
    if (user) {
      const closeEmbed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('Ticket Closed')
        .setDescription(`Your ticket in **${channel.guild?.name || 'Server'}** has been closed.\n\nThank you for reaching out!`)
        .setTimestamp();
      await user.send({ embeds: [closeEmbed], files: [transcript] }).catch(() => {});

      if (BUILDER_RATED_TYPES.includes(ticket.type) && ticket.claimed_by) {
        const builder = await client.users.fetch(ticket.claimed_by).catch(() => null);
        const builderName = builder ? builder.tag : 'the builder';

        const rateRow = new ActionRowBuilder().addComponents(
          [1, 2, 3, 4, 5].map(s =>
            new ButtonBuilder()
              .setCustomId(`rate_builder_${s}_${ticket.id}_${ticket.claimed_by}`)
              .setLabel(`${'\u2605'.repeat(s)}${'\u2606'.repeat(5 - s)}`)
              .setStyle(ButtonStyle.Secondary),
          ),
        );

        const promptEmbed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('\u{1F3D7}\uFE0F Rate Your Builder')
          .setDescription(`How was your experience with **${builderName}**?\n\nRate their work below.`)
          .setTimestamp();

        await user.send({ embeds: [promptEmbed], components: [rateRow] }).catch(() => {});
      } else {
        const claimedBy = ticket.claimed_by || 'none';
        const rateRow = new ActionRowBuilder().addComponents(
          [1, 2, 3, 4, 5].map(s =>
            new ButtonBuilder().setCustomId(`rate_${s}_${ticket.id}_${claimedBy}`).setLabel(`${'\u2605'.repeat(s)}${'\u2606'.repeat(5 - s)}`).setStyle(ButtonStyle.Secondary),
          ),
        );
        const staffName = claimedBy !== 'none' ? `<@${claimedBy}>` : 'our staff team';
        const promptEmbed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('Staff Rating')
          .setDescription(`How was your experience? Rate the support you got from ${staffName}.`)
          .setTimestamp();
        await user.send({ embeds: [promptEmbed], components: [rateRow] }).catch(() => {});
      }
    }
  } catch (e) {
    logError('Transcript/rating error:', e);
  }
}

export async function handleCloseConfirm(client, interaction) {
  const channel = interaction.channel;
  const ticket = stmtTicketByChannel.get(channel.id);
  if (!ticket) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Ticket already closed.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (!isStaff(interaction.member) && interaction.user.id !== ticket.user_id) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Only staff or the ticket creator can close this.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await finalizeClose(client, channel, ticket, interaction.member.id);

  const doneEmbed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Ticket closed. Deleting channel in 5 seconds...');
  await interaction.editReply({ embeds: [doneEmbed] });
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

export async function handleCloseCancel(interaction) {
  const msg = interaction.message;
  if (msg.deletable) await msg.delete().catch(() => {});
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setDescription('Close cancelled. Ticket stays open.');
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

export async function handleRatingButton(interaction) {
  const parts = interaction.customId.split('_');
  const stars = parseInt(parts[1]);
  const ticketId = parts[2];
  const targetId = parts[3] || 'none';
  const modal = new ModalBuilder().setCustomId(`rating_feedback_${ticketId}_${stars}_${targetId}`).setTitle(`Rate your support \u2014 ${stars}/5`);
  const feedback = new TextInputBuilder()
    .setCustomId('feedback')
    .setLabel('Additional feedback (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(2000);
  modal.addComponents(new ActionRowBuilder().addComponents(feedback));
  await interaction.showModal(modal);
}

const stmtRatingExists = db.prepare('SELECT id FROM ratings WHERE ticket_id = ? AND user_id = ?');
const stmtReputationExists = db.prepare('SELECT id FROM reputation WHERE ticket_id = ? AND rater_id = ?');

export async function handleRatingModal(client, interaction) {
  const parts = interaction.customId.split('_');
  const ticketId = parseInt(parts[2]);
  const stars = parseInt(parts[3]);
  const targetId = parts[4] || null;
  const feedback = interaction.fields.getTextInputValue('feedback');

  const existing = stmtRatingExists.get(ticketId, interaction.user.id);
  if (existing) {
    return interaction.reply({ content: 'You have already rated this ticket.', flags: MessageFlags.Ephemeral });
  }

  const stmtTicketInfo = db.prepare("SELECT type, channel_name FROM tickets WHERE id = ?");
  const ticketInfo = stmtTicketInfo.get(ticketId);
  const ticketType = ticketInfo ? ticketInfo.type : 'Unknown';
  const channelName = ticketInfo?.channel_name || 'Deleted';

  const verdicts = { 5: 'Excellent', 4: 'Great', 3: 'Good', 2: 'Fair', 1: 'Poor' };
  const verdict = verdicts[stars] || 'Unknown';

  const color = stars <= 2 ? 0xE74C3C : 5763719;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle('\u2B50 New Review')
    .setDescription(`<@${interaction.user.id}> rated their **${ticketType.charAt(0).toUpperCase() + ticketType.slice(1)}** experience`)
    .addFields(
      { name: 'Rating', value: `${stars}/5 ${'\u2605'.repeat(stars)}${'\u2606'.repeat(5 - stars)}`, inline: false },
      { name: 'Verdict', value: verdict, inline: true },
      { name: 'Ticket', value: `\`${channelName}\``, inline: true },
    );

  if (targetId && targetId !== 'none') embed.addFields({ name: 'Staff Member', value: `<@${targetId}>`, inline: true });
  if (feedback) embed.addFields({ name: '\u{1F4AC} Feedback', value: feedback, inline: false });

  const ratingChannel = client.channels.cache.get(process.env.RATING_LOGS_CHANNEL_ID);
  if (ratingChannel) await ratingChannel.send({ embeds: [embed] });

  stmtInsertRating.run(ticketId, interaction.user.id, stars, feedback, targetId !== 'none' ? targetId : null);

  const thankEmbed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Thanks for your feedback!');
  await interaction.reply({ embeds: [thankEmbed], flags: MessageFlags.Ephemeral });
}

export async function handleBuilderRatingButton(interaction) {
  const parts = interaction.customId.split('_');
  const stars = parseInt(parts[2]);
  const ticketId = parseInt(parts[3]);
  const targetId = parts[4];

  const modal = new ModalBuilder()
    .setCustomId(`builder_feedback_${ticketId}_${targetId}_${stars}`)
    .setTitle(`Rate Builder \u2014 ${stars}/5`);

  const feedback = new TextInputBuilder()
    .setCustomId('feedback')
    .setLabel('Any feedback for this builder? (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(2000);

  modal.addComponents(new ActionRowBuilder().addComponents(feedback));
  await interaction.showModal(modal);
}

export async function handleBuilderRatingModal(client, interaction) {
  const parts = interaction.customId.split('_');
  const ticketId = parseInt(parts[2]);
  const targetId = parts[3];
  const stars = parseInt(parts[4]);
  const feedback = interaction.fields.getTextInputValue('feedback');

  const existing = stmtReputationExists.get(ticketId, interaction.user.id);
  if (existing) {
    return interaction.reply({ content: 'You have already rated this builder for this ticket.', flags: MessageFlags.Ephemeral });
  }

  try {
    stmtInsertReputation.run(ticketId, interaction.user.id, targetId, stars, feedback || null);
  } catch (e) {
    logError('Reputation save error:', e.message);
  }

  const color = stars <= 2 ? 0xE74C3C : 0x2ECC71;
  const verdicts = { 5: 'Excellent', 4: 'Great', 3: 'Good', 2: 'Fair', 1: 'Poor' };
  const verdict = verdicts[stars] || 'Unknown';

  const logEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle('\u{1F3D7}\uFE0F Builder Review')
    .setDescription(`<@${interaction.user.id}> rated builder <@${targetId}>`)
    .addFields(
      { name: 'Rating', value: `${stars}/5 ${'\u2605'.repeat(stars)}${'\u2606'.repeat(5 - stars)}`, inline: true },
      { name: 'Verdict', value: verdict, inline: true },
    );

  if (feedback) logEmbed.addFields({ name: '\u{1F4AC} Feedback', value: feedback, inline: false });

  const ratingChannel = client.channels.cache.get(process.env.RATING_LOGS_CHANNEL_ID);
  if (ratingChannel) await ratingChannel.send({ embeds: [logEmbed] }).catch(() => {});

  const thankEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setDescription('Thanks for rating your builder! Your feedback helps us improve.');
  await interaction.reply({ embeds: [thankEmbed], flags: MessageFlags.Ephemeral });
}
