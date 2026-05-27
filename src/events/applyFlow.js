import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import { isManager, isStaff } from '../utils.js';
import { info } from '../logger.js';

const QUESTIONS = {
  builder: {
    title: 'Builder Application',
    role: 'Builder',
    roleEnvs: ['JR_BUILDER_ROLE_ID', 'BUILD_TEAM_ROLE_ID'],
    color: 0x3498DB,
    emoji: '\u26CF',
    questions: [
      'What is your in-game name and age?',
      'How much experience do you have with building (especially stashes)?',
      'Can you provide screenshots or examples of your previous builds?',
      'How would you dissolve an argument with a client?',
      'Why should we choose you as a builder?',
    ],
  },
  partner: {
    title: 'Partner Manager Application',
    role: 'Partner Manager',
    roleEnvs: ['PARTNER_TEAM_ROLE_ID'],
    color: 0xE67E22,
    emoji: '\uD83E\uDD1D',
    questions: [
      'How old are you?',
      'Do you have experience with partnerships? If yes, explain briefly.',
      'Why do you want to join the partner team?',
      'How much partner can you get per week?',
    ],
  },
  staff: {
    title: 'Staff Application',
    role: 'Staff',
    roleEnvs: ['JR_HELPER_ROLE_ID', 'STAFF_TEAM_ROLE_ID'],
    color: 0xE74C3C,
    emoji: '\uD83D\uDC6E',
    questions: [
      'What is your in-game name and age?',
      'Do you have previous staff experience? If yes, where?',
      'Why do you want to become staff?',
      'How active can you be per week?',
    ],
  },
};

const interviewState = new Map();

function cleanupState(key) {
  const state = interviewState.get(key);
  if (state) {
    state.active = false;
    try { state.collector.stop(); } catch {}
    interviewState.delete(key);
  }
}

function progressBar(current, total) {
  return '\u25B0'.repeat(current) + '\u25B1'.repeat(total - current);
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function daysAgo(date) {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function buildAnswersEmbed(config, answers, userId, appId, duration, client) {
  const qaLines = config.questions.map((q, i) =>
    `${i + 1}. ${q}\n> ${answers[i] || '*Skipped*'}`
  );

  let joinedField = null;
  try {
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (guild) {
      const member = guild.members.cache.get(userId);
      if (member && member.joinedAt) {
        joinedField = { name: 'Joined Guild', value: daysAgo(member.joinedAt), inline: true };
      }
    }
  } catch {}

  return new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({
      name: `${config.emoji} ${config.role} Application Submitted`,
      iconURL: 'https://mc-heads.net/avatar/MHF_Steve/64',
    })
    .setThumbnail(client.users.cache.get(userId)?.displayAvatarURL({ size: 128 }) || null)
    .setDescription(qaLines.join('\n\n'))
    .addFields(
      { name: '\u200B', value: '\u200B', inline: false },
      { name: 'UserID', value: `\`${userId}\``, inline: true },
      { name: 'Username', value: `<@${userId}>`, inline: true },
      { name: 'Duration', value: formatDuration(duration || 0), inline: true },
    )
    .addFields(joinedField ? { name: 'Joined Guild', value: joinedField.value, inline: true } : { name: '\u200B', value: '\u200B', inline: true })
    .setFooter({ text: `Application #${appId} \u2022 Apex Building Service` })
    .setTimestamp();
}

function buildCooldownEmbed(config, remaining) {
  return new EmbedBuilder()
    .setColor(0xF1C40F)
    .setAuthor({ name: 'Cooldown Active', iconURL: 'https://mc-heads.net/avatar/MHF_Steve/64' })
    .setDescription([
      `${config.emoji} You already applied for **${config.role}** recently.`,
      '',
      `Please wait **${remaining} day${remaining > 1 ? 's' : ''}** before applying again.`,
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service \u2022 4 day cooldown' })
    .setTimestamp();
}

function buildWelcomeEmbed(config, user) {
  return new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({ name: config.title, iconURL: user.displayAvatarURL({ size: 128 }) })
    .setDescription([
      `${config.emoji} You are applying for **${config.role}**.`,
      '',
      `There are **${config.questions.length} questions** to answer.`,
      'I will ask you one at a time right here in DMs.',
      '',
      '> Type \u200B`cancel`\u200B at any time to stop.',
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();
}

function buildQuestionEmbed(config, index, total, answerCount) {
  const bar = progressBar(answerCount, total);
  const isLast = index === total - 1;
  return new EmbedBuilder()
    .setColor(isLast ? 0xE67E22 : 0xF1C40F)
    .setDescription([
      `**Question ${index + 1} / ${total}**`,
      `\`${bar}\``,
      '',
      config.questions[index],
    ].join('\n'))
    .setFooter({ text: isLast ? 'Last question! \u2022 You can skip it' : 'Type your answer below' });
}

function buildSubmittedEmbed(config, user) {
  return new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: 'Application Submitted', iconURL: user.displayAvatarURL({ size: 128 }) })
    .setDescription([
      `${config.emoji} Your **${config.role}** application has been submitted!`,
      '',
      'Our team will review it and get back to you.',
      'You will receive a DM when a decision is made.',
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();
}

function buildCancelledEmbed() {
  return new EmbedBuilder()
    .setColor(0x95A5A6)
    .setDescription('\u274C Application cancelled. You can re-apply anytime.')
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();
}

function buildTimeoutEmbed() {
  return new EmbedBuilder()
    .setColor(0x95A5A6)
    .setDescription('\u23F3 Application timed out. Start again when ready.')
    .setFooter({ text: 'Apex Building Service \u2022 10 minute limit' })
    .setTimestamp();
}

async function sendToChannel(client, userId, type, config, answers, appId, duration) {
  const embed = buildAnswersEmbed(config, answers, userId, appId, duration, client);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`apply_ia_${appId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`apply_id_${appId}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`apply_accept_${appId}`).setLabel('Accept with reason').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`apply_reject_${appId}`).setLabel('Deny with reason').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`apply_ticket_${appId}`).setLabel('\uD83C\uDFAB Open ticket with user').setStyle(ButtonStyle.Secondary),
  );

  const channelMap = {
    builder: process.env.BUILDER_APPLICATION_CHANNEL_ID,
    partner: process.env.PARTNER_APPLICATION_CHANNEL_ID,
    staff: process.env.STAFF_APPLICATION_CHANNEL_ID,
  };
  const channelId = channelMap[type] || process.env.APPLICATIONS_CHANNEL_ID;
  if (channelId) {
    const channel = client.channels.cache.get(channelId);
    if (channel) {
      const msg = await channel.send({ embeds: [embed], components: [row1] }).catch(() => {});
      if (msg) {
        db.prepare("UPDATE applications SET message_id = ? WHERE id = ?").run(msg.id, appId);
      }
    }
  }
}

async function finishInterview(client, user, type, config, answers, startTime) {
  const duration = Math.round((Date.now() - startTime) / 1000);
  const info = db.prepare(
    "INSERT INTO applications (user_id, type, answers, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(user.id, type, JSON.stringify(answers));

  await sendToChannel(client, user.id, type, config, answers, info.lastInsertRowid, duration);
  return buildSubmittedEmbed(config, user);
}

export async function handleApplyButton(interaction, type) {
  const config = QUESTIONS[type];
  if (!config) return;

  if (!isStaff(interaction.member)) {
    const recent = db.prepare(
      "SELECT created_at FROM applications WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1"
    ).get(interaction.user.id, type);

    if (recent) {
      const elapsed = Date.now() - new Date(recent.created_at).getTime();
      if (elapsed < 345600000) {
        const remaining = Math.ceil((345600000 - elapsed) / 86400000);
        return interaction.reply({
          embeds: [buildCooldownEmbed(config, remaining)],
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }

  const dmEmbed = new EmbedBuilder()
    .setColor(config.color)
    .setDescription(`${config.emoji} Check your **DMs** \u2014 I sent you the application questions!`);

  await interaction.reply({ embeds: [dmEmbed], flags: MessageFlags.Ephemeral });

  try {
    const dmChannel = await interaction.user.createDM();
    await startInterview(dmChannel, interaction.user, type, config, interaction.client);
  } catch {
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setDescription('\u26A0 Could not send you a DM. Make sure your DMs are open.');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function startInterview(dmChannel, user, type, config, client) {
  const key = `${user.id}_${type}`;
  if (interviewState.has(key)) return;

  const collector = dmChannel.createMessageCollector({
    filter: m => m.author.id === user.id,
    time: 600000,
  });

  const state = { answers: [], qIndex: 0, collector, active: true, startTime: Date.now() };
  interviewState.set(key, state);

  await dmChannel.send({ embeds: [buildWelcomeEmbed(config, user)] });

  collector.on('collect', async msg => {
    if (!state.active) return;

    const content = msg.content.trim();

    if (content.toLowerCase() === 'cancel') {
      cleanupState(key);
      await dmChannel.send({ embeds: [buildCancelledEmbed()] });
      return;
    }

    state.answers.push(content);
    state.qIndex++;

    if (state.qIndex >= config.questions.length) {
      cleanupState(key);
      try {
        const doneEmbed = await finishInterview(client, user, type, config, state.answers, state.startTime);
        await dmChannel.send({ embeds: [doneEmbed] });
      } catch (err) {
        await dmChannel.send({
          embeds: [new EmbedBuilder().setColor(0xE74C3C).setDescription('\u274C Something went wrong submitting your application. Please contact staff.')],
        }).catch(() => {});
      }
      return;
    }

    const isLast = state.qIndex === config.questions.length - 1;
    const qEmbed = buildQuestionEmbed(config, state.qIndex, config.questions.length, state.qIndex);

    if (isLast) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`apply_skip_${type}_${user.id}`)
          .setLabel('Skip this question')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('\u23ED'),
      );
      await dmChannel.send({ embeds: [qEmbed], components: [row] });
    } else {
      await dmChannel.send({ embeds: [qEmbed] });
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time' && state.active) {
      cleanupState(key);
      await dmChannel.send({ embeds: [buildTimeoutEmbed()] }).catch(() => {});
    }
  });

  const firstQEmbed = buildQuestionEmbed(config, 0, config.questions.length, 0);
  await dmChannel.send({ embeds: [firstQEmbed] });
}

export async function handleApplySkip(interaction, type) {
  const userId = interaction.customId.split('_').at(-1);
  if (interaction.user.id !== userId) return;

  const config = QUESTIONS[type];
  if (!config) return;

  const key = `${userId}_${type}`;
  const state = interviewState.get(key);
  if (!state) return;

  const startTime = state.startTime;
  cleanupState(key);

  const answers = [...state.answers, 'Skipped'];

  await interaction.update({ embeds: [], components: [] });

  const info = db.prepare(
    "INSERT INTO applications (user_id, type, answers, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(userId, type, JSON.stringify(answers));

  const duration = Math.round((Date.now() - startTime) / 1000);
  await sendToChannel(interaction.client, userId, type, config, answers, info.lastInsertRowid, duration);

  try {
    const dmChannel = await interaction.user.createDM();
    await dmChannel.send({ embeds: [buildSubmittedEmbed(config, interaction.user)] });
  } catch {}
}

async function applyAcceptCommon(client, interaction, appId, reason) {
  if (!isManager(interaction.member)) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'Only managers can accept applications.' }).catch(() => {});
    } else {
      await interaction.reply({ content: 'Only managers can accept applications.', flags: MessageFlags.Ephemeral });
    }
    return null;
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app || app.status !== 'pending') {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'This application has already been reviewed.' }).catch(() => {});
    } else {
      await interaction.reply({ content: 'This application has already been reviewed.', flags: MessageFlags.Ephemeral });
    }
    return null;
  }

  db.prepare(
    "UPDATE applications SET status = 'accepted', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).run(interaction.user.id, appId);

  const config = QUESTIONS[app.type];
  const roleIds = config.roleEnvs.map(e => process.env[e]).filter(Boolean);

  const member = interaction.guild.members.cache.get(app.user_id);
  if (member && roleIds.length) {
    await member.roles.add(roleIds).catch(() => {});
  }

  const rolesGiven = roleIds.map(id => `<@&${id}>`).join(', ');

  const acceptEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: 'Application Accepted', iconURL: interaction.guild.iconURL({ size: 128 }) })
    .setDescription([
      `${config.emoji} Congratulations! Your **${config.role}** application has been **accepted**!`,
      '',
      member && rolesGiven ? `You have been given: ${rolesGiven}` : '',
      '',
      ...(reason ? [`**Reason:** ${reason}`] : []),
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(app.user_id);
    await user.send({ embeds: [acceptEmbed] });
  } catch {}

  const msgEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0x2ECC71)
    .setAuthor({
      name: `Accepted \u2014 ${config.role} Application`,
      iconURL: 'https://mc-heads.net/avatar/MHF_Steve/64',
    })
    .setDescription(`> ${config.emoji} <@${app.user_id}> was accepted for **${config.role}**.`)
    .setFooter({ text: `Reviewed by ${interaction.user.tag}` });

  const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
  disabledRow.components.forEach(b => b.setDisabled(true));
  await interaction.message.edit({ embeds: [msgEmbed], components: [disabledRow] });

  return { config, app };
}

export async function handleInstantAccept(client, interaction, appId) {
  const result = await applyAcceptCommon(client, interaction, appId, null);
  if (!result) return;

  const doneEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setDescription(`${result.config.emoji} <@${result.app.user_id}> was accepted for **${result.config.role}**.`);
  await interaction.reply({ embeds: [doneEmbed], flags: MessageFlags.Ephemeral });
}

export async function handleAccept(client, interaction, appId) {
  if (!isManager(interaction.member)) {
    return interaction.reply({ content: 'Only managers can accept applications.', flags: MessageFlags.Ephemeral });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({ content: 'This application has already been reviewed.', flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`apply_accept_reason_${appId}`)
    .setTitle('Accept Application');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason for accepting')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

export async function handleAcceptSubmit(client, interaction, appId) {
  const reason = interaction.fields.getTextInputValue('reason');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await applyAcceptCommon(client, interaction, appId, reason);
  if (!result) return;

  const doneEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setDescription(`${result.config.emoji} <@${result.app.user_id}> was accepted for **${result.config.role}**.`);
  await interaction.editReply({ embeds: [doneEmbed] });
}

async function applyRejectCommon(client, interaction, appId, reason) {
  if (!isManager(interaction.member)) {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'Only managers can reject applications.' }).catch(() => {});
    } else {
      await interaction.reply({ content: 'Only managers can reject applications.', flags: MessageFlags.Ephemeral });
    }
    return null;
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app || app.status !== 'pending') {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'This application has already been reviewed.' }).catch(() => {});
    } else {
      await interaction.reply({ content: 'This application has already been reviewed.', flags: MessageFlags.Ephemeral });
    }
    return null;
  }

  db.prepare(
    "UPDATE applications SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?"
  ).run(interaction.user.id, appId);

  const config = QUESTIONS[app.type];

  const rejectEmbed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setAuthor({ name: 'Application Rejected', iconURL: interaction.guild.iconURL({ size: 128 }) })
    .setDescription([
      `${config.emoji} Your **${config.role}** application has been reviewed.`,
      '',
      'Unfortunately, we have decided to **decline** your application at this time.',
      '',
      ...(reason ? [`**Reason:** ${reason}`] : []),
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(app.user_id);
    await user.send({ embeds: [rejectEmbed] });
  } catch {}

  const msgEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0xE74C3C)
    .setAuthor({
      name: `Rejected \u2014 ${config.role} Application`,
      iconURL: 'https://mc-heads.net/avatar/MHF_Steve/64',
    })
    .setDescription(`> ${config.emoji} <@${app.user_id}> was declined for **${config.role}**.`)
    .setFooter({ text: `Reviewed by ${interaction.user.tag}` });

  const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
  disabledRow.components.forEach(b => b.setDisabled(true));
  await interaction.message.edit({ embeds: [msgEmbed], components: [disabledRow] });

  return { config, app };
}

export async function handleInstantDeny(client, interaction, appId) {
  const result = await applyRejectCommon(client, interaction, appId, null);
  if (!result) return;

  const doneEmbed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setDescription(`${result.config.emoji} <@${result.app.user_id}> was declined for **${result.config.role}**.`);
  await interaction.reply({ embeds: [doneEmbed], flags: MessageFlags.Ephemeral });
}

export async function handleReject(client, interaction, appId) {
  if (!isManager(interaction.member)) {
    return interaction.reply({ content: 'Only managers can reject applications.', flags: MessageFlags.Ephemeral });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({ content: 'This application has already been reviewed.', flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId(`apply_reject_reason_${appId}`)
    .setTitle('Reject Application');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason for rejection')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

export async function handleRejectSubmit(client, interaction, appId) {
  const reason = interaction.fields.getTextInputValue('reason');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const result = await applyRejectCommon(client, interaction, appId, reason);
  if (!result) return;

  const doneEmbed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setDescription(`${result.config.emoji} <@${result.app.user_id}> was declined for **${result.config.role}**.`);
  await interaction.editReply({ embeds: [doneEmbed] });
}

export async function handleApplyTicket(client, interaction, appId) {
  if (!isManager(interaction.member)) {
    return interaction.reply({ content: 'Only managers can create tickets from applications.', flags: MessageFlags.Ephemeral });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app) {
    return interaction.reply({ content: 'Application not found.', flags: MessageFlags.Ephemeral });
  }

  const config = QUESTIONS[app.type];
  const guild = interaction.guild;
  const categoryId = process.env.CATEGORY_GENERAL;
  if (!categoryId) {
    return interaction.reply({ content: 'General ticket category is not configured.', flags: MessageFlags.Ephemeral });
  }

  const existing = db.prepare("SELECT * FROM tickets WHERE user_id = ? AND status = 'open' AND type = 'application'").get(app.user_id);
  if (existing) {
    return interaction.reply({ content: `Applicant already has an open ticket: <#${existing.channel_id}>`, flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channelName = `application-${app.user_id.slice(-4)}`;
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: app.user_id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: process.env.STAFF_ROLE_ID || '', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: overwrites,
    topic: `Application #${appId} | ${config.role} | <@${app.user_id}>`,
  });

  db.prepare('INSERT INTO tickets (channel_id, user_id, type, channel_name) VALUES (?, ?, ?, ?)').run(
    channel.id, app.user_id, 'application', channel.name
  );

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({ name: `${config.emoji} Application Discussion`, iconURL: 'https://mc-heads.net/avatar/MHF_Steve/64' })
    .setDescription([
      `**Application #${appId} \u2014 ${config.role}**`,
      '',
      `<@${app.user_id}> \u2014 A manager has opened this ticket to discuss your application.`,
      '',
      `Reviewed by: ${interaction.user}`,
    ].join('\n'))
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('\uD83D\uDD12 Close Ticket').setStyle(ButtonStyle.Danger),
  );

  await channel.send({ content: `<@${app.user_id}>`, embeds: [embed], components: [closeRow] });
  info(`Application ticket created: #${channel.name} for app #${appId}`);

  const doneEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setDescription(`Ticket created for <@${app.user_id}>: ${channel}`);
  await interaction.editReply({ embeds: [doneEmbed] });
}
