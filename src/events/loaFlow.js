import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import { info, error as logError } from '../logger.js';
import { isAdmin, isManager } from '../utils.js';

export async function handleLoaApply(client, interaction) {
  const rank = interaction.fields.getTextInputValue('rank');
  const start = interaction.fields.getTextInputValue('start');
  const end = interaction.fields.getTextInputValue('end');
  const reason = interaction.fields.getTextInputValue('reason');

  const result = db.prepare(
    'INSERT INTO loa_requests (user_id, rank, start_date, end_date, reason) VALUES (?, ?, ?, ?, ?)'
  ).run(interaction.user.id, rank, start, end, reason);

  const reqId = result.lastInsertRowid;
  info(`LOA request #${reqId} from ${interaction.user.tag}`);

  await interaction.reply({ content: 'Your LOA request has been sent for approval.', flags: MessageFlags.Ephemeral });

  const channelId = process.env.LOA_CHANNEL_ID;
  if (!channelId) return;

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('📌 LOA Request')
    .setDescription([
      `**User:** <@${interaction.user.id}> (\`${interaction.user.id}\`)`,
      `**Rank:** ${rank}`,
      `**Start:** ${start}`,
      `**End:** ${end}`,
      `**Reason:** ${reason}`,
      '',
      '*Abuse or fake LOAs may result in a permanent ban.*',
    ].join('\n'))
    .setFooter({ text: `Request #${reqId}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`loa_accept_${reqId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`loa_reject_${reqId}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
  );

  const channel = client.channels.cache.get(channelId);
  if (channel) {
    await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
  }
}

export async function handleLoaAccept(interaction) {
  const isAuthorized = interaction.user.id === process.env.LOA_APPROVER_ID || 
    (interaction.member && (isManager(interaction.member) || isAdmin(interaction.member)));
  if (!isAuthorized) {
    return interaction.reply({ content: 'You are not authorized to approve LOAs.', flags: MessageFlags.Ephemeral });
  }

  const reqId = interaction.customId.split('_')[2];

  const modal = new ModalBuilder()
    .setCustomId(`loa_accept_reason_${reqId}`)
    .setTitle('Approve LOA');

  const notesInput = new TextInputBuilder()
    .setCustomId('notes')
    .setLabel('Notes (optional)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(notesInput));

  await interaction.showModal(modal);
}

export async function handleLoaAcceptSubmit(client, interaction) {
  const isAuthorized = interaction.user.id === process.env.LOA_APPROVER_ID || 
    (interaction.member && (isManager(interaction.member) || isAdmin(interaction.member)));
  if (!isAuthorized) {
    return interaction.reply({ content: 'You are not authorized.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const reqId = interaction.customId.split('_')[3];
  const notes = interaction.fields.getTextInputValue('notes');
  const request = db.prepare('SELECT * FROM loa_requests WHERE id = ?').get(reqId);

  if (!request || request.status !== 'pending') {
    return interaction.editReply({ content: 'This request is no longer pending.' });
  }

  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) {
    return interaction.editReply({ content: 'Could not find the guild.' });
  }

  const member = await guild.members.fetch(request.user_id).catch(() => null);
  if (!member) {
    return interaction.editReply({ content: 'Could not find that member in the server.' });
  }

  const loaRoleId = process.env.LOA_ROLE_ID;
  if (loaRoleId) {
    await member.roles.add(loaRoleId).catch(() => {});
  }

  const originalNickname = member.displayName;
  const newNickname = originalNickname.startsWith('[LOA]') ? originalNickname : `[LOA] ${originalNickname}`;
  if (member.displayName !== newNickname) {
    await member.setNickname(newNickname, 'LOA approved').catch(() => {});
  }

  const endMs = new Date(request.end_date).getTime();
  const endAt = isNaN(endMs) ? Date.now() + 7 * 86400000 : endMs;

  db.prepare('DELETE FROM active_loas WHERE user_id = ?').run(request.user_id);
  db.prepare('INSERT INTO active_loas (user_id, request_id, end_at, original_nickname) VALUES (?, ?, ?, ?)')
    .run(request.user_id, reqId, endAt, originalNickname);
  db.prepare('UPDATE loa_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime(\'now\') WHERE id = ?')
    .run('approved', interaction.user.id, reqId);

  info(`LOA #${reqId} approved for ${request.user_id} until <t:${Math.floor(endAt / 1000)}:f>`);

  await interaction.editReply({ content: `LOA approved for <@${request.user_id}>. Ends <t:${Math.floor(endAt / 1000)}:R>.` });

  const user = await client.users.fetch(request.user_id).catch(() => null);
  if (user) {
    const desc = [
      `Your LOA has been **approved**.`,
      '',
      `**Rank:** ${request.rank}`,
      `**Start:** ${request.start_date}`,
      `**End:** ${request.end_date}`,
      '',
      `Ends <t:${Math.floor(endAt / 1000)}:R>`,
    ];
    if (notes) desc.push('', `**Notes:** ${notes}`);

    const userEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ LOA Approved')
      .setDescription(desc.join('\n'))
      .setTimestamp();
    await user.send({ embeds: [userEmbed] }).catch(() => {});
  }

  if (interaction.message) {
    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(b => b.setDisabled(true));
    await interaction.message.edit({ components: [disabledRow] }).catch(() => {});
  }
}

export async function handleLoaReject(interaction) {
  const isAuthorized = interaction.user.id === process.env.LOA_APPROVER_ID || 
    (interaction.member && (isManager(interaction.member) || isAdmin(interaction.member)));
  if (!isAuthorized) {
    return interaction.reply({ content: 'You are not authorized to reject LOAs.', flags: MessageFlags.Ephemeral });
  }

  const reqId = interaction.customId.split('_')[2];

  const modal = new ModalBuilder()
    .setCustomId(`loa_reject_reason_${reqId}`)
    .setTitle('Reject LOA');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason for rejection')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

  await interaction.showModal(modal);
}

export async function handleLoaRejectSubmit(client, interaction) {
  const isAuthorized = interaction.user.id === process.env.LOA_APPROVER_ID || 
    (interaction.member && (isManager(interaction.member) || isAdmin(interaction.member)));
  if (!isAuthorized) {
    return interaction.reply({ content: 'You are not authorized.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const reqId = interaction.customId.split('_')[3];
  const reason = interaction.fields.getTextInputValue('reason');
  const request = db.prepare('SELECT * FROM loa_requests WHERE id = ?').get(reqId);

  if (!request || request.status !== 'pending') {
    return interaction.editReply({ content: 'This request is no longer pending.' });
  }

  db.prepare('UPDATE loa_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime(\'now\') WHERE id = ?')
    .run('rejected', interaction.user.id, reqId);

  info(`LOA #${reqId} rejected by ${interaction.user.tag}`);

  await interaction.editReply({ content: `LOA rejected for <@${request.user_id}>.` });

  const user = await client.users.fetch(request.user_id).catch(() => null);
  if (user) {
    const userEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('❌ LOA Rejected')
      .setDescription([
        `Your LOA has been **rejected**.`,
        '',
        `**Reason:** ${reason}`,
      ].join('\n'))
      .setTimestamp();
    await user.send({ embeds: [userEmbed] }).catch(() => {});
  }

  if (interaction.message) {
    const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
    disabledRow.components.forEach(b => b.setDisabled(true));
    await interaction.message.edit({ components: [disabledRow] }).catch(() => {});
  }
}
