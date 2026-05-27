import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import db from '../database.js';
import { isManager } from '../utils.js';

const QUESTIONS = {
  builder: {
    title: 'Builder Application',
    role: 'Builder',
    roleEnvs: ['JR_BUILDER_ROLE_ID', 'BUILD_TEAM_ROLE_ID'],
    color: 0x3498DB,
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
    questions: [
      'What is your in-game name and age?',
      'Do you have previous staff experience? If yes, where?',
      'Why do you want to become staff?',
      'How active can you be per week?',
    ],
  },
};

const interviewState = new Map();

function progressBar(current, total) {
  return '▰'.repeat(current) + '▱'.repeat(total - current);
}

function buildAnswersEmbed(config, answers, userId) {
  const lines = config.questions.map((q, i) => {
    const a = answers[i] || '*Skipped*';
    return `┌ ${q}\n└ ${a}`;
  });

  return new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({ name: `New ${config.role} Application`, iconURL: 'https://mc-heads.net/avatar/MHF_Steve/64' })
    .setDescription(lines.join('\n\n'))
    .addFields(
      { name: 'Applicant', value: `<@${userId}>`, inline: true },
      { name: 'User ID', value: `\`${userId}\``, inline: true },
    )
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();
}

async function sendToChannel(client, userId, type, config, answers, appId) {
  const embed = buildAnswersEmbed(config, answers, userId);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`apply_accept_${appId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`apply_reject_${appId}`).setLabel('Reject').setStyle(ButtonStyle.Danger),
  );

  const channelId = process.env.APPLICATIONS_CHANNEL_ID;
  if (channelId) {
    const channel = client.channels.cache.get(channelId);
    if (channel) await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
  }
}

async function finishInterview(client, user, type, config, answers) {
  const info = db.prepare('INSERT INTO applications (user_id, type, answers) VALUES (?, ?, ?)').run(user.id, type, JSON.stringify(answers));
  sendToChannel(client, user.id, type, config, answers, info.lastInsertRowid);

  const doneEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: 'Application Submitted', iconURL: user.displayAvatarURL({ size: 64 }) })
    .setDescription([
      'Your application has been submitted!',
      '',
      'We will review it and get back to you.',
      'You will receive a DM when a decision is made.',
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();
  return doneEmbed;
}

export async function handleApplyButton(interaction, type) {
  const config = QUESTIONS[type];
  if (!config) return;

  const recent = db.prepare("SELECT created_at FROM applications WHERE user_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1").get(interaction.user.id, type);
  if (recent) {
    const elapsed = Date.now() - new Date(recent.created_at).getTime();
    if (elapsed < 345600000) {
      const remaining = Math.ceil((345600000 - elapsed) / 86400000);
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('❌ 4 Day Cooldown')
        .setDescription(`You already applied for **${config.role}** recently.\nPlease wait **${remaining} day${remaining > 1 ? 's' : ''}** before applying again.`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  const dmEmbed = new EmbedBuilder()
    .setColor(config.color)
    .setTitle(config.title)
    .setDescription('Check your DMs to start the application!');

  await interaction.reply({ embeds: [dmEmbed], flags: MessageFlags.Ephemeral });

  try {
    const dmChannel = await interaction.user.createDM();
    startInterview(dmChannel, interaction.user, type, config, interaction.client);
  } catch {
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setDescription('Could not send you a DM. Make sure your DMs are open.');
    await interaction.followUp({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
  }
}

async function startInterview(dmChannel, user, type, config, client) {
  const key = `${user.id}_${type}`;
  if (interviewState.has(key)) return;

  const collector = dmChannel.createMessageCollector({ filter: m => m.author.id === user.id, time: 600000 });
  const state = { answers: [], qIndex: 0, collector, active: true };
  interviewState.set(key, state);

  const welcomeEmbed = new EmbedBuilder()
    .setColor(config.color)
    .setAuthor({ name: config.title, iconURL: user.displayAvatarURL({ size: 64 }) })
    .setDescription([
      `You are applying for **${config.role}**.`,
      '',
      `**${config.questions.length} questions** ahead.`,
      'Answer each one and I will submit them for review.',
      '',
      'Type \`cancel\` to stop anytime.',
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();

  await dmChannel.send({ embeds: [welcomeEmbed] });

  collector.on('collect', async msg => {
    if (!state.active) return;

    const content = msg.content.trim();

    if (content.toLowerCase() === 'cancel') {
      collector.stop();
      state.active = false;
      interviewState.delete(key);
      const cancelEmbed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setDescription('Application cancelled.');
      await dmChannel.send({ embeds: [cancelEmbed] });
      return;
    }

    state.answers.push(content);
    state.qIndex++;

    if (state.qIndex >= config.questions.length) {
      collector.stop();
      state.active = false;
      interviewState.delete(key);
      const doneEmbed = await finishInterview(client, user, type, config, state.answers);
      await dmChannel.send({ embeds: [doneEmbed] });
      return;
    }

    const bar = progressBar(state.qIndex, config.questions.length);
    const isLast = state.qIndex === config.questions.length - 1;
    const qEmbed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setDescription([
        `**Question ${state.qIndex + 1}/${config.questions.length}**`,
        `\`${bar}\``,
        '',
        config.questions[state.qIndex],
      ].join('\n'));

    if (isLast) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`apply_skip_${type}_${user.id}`).setLabel('Skip this question').setStyle(ButtonStyle.Secondary),
      );
      await dmChannel.send({ embeds: [qEmbed], components: [row] });
    } else {
      await dmChannel.send({ embeds: [qEmbed] });
    }
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time' && state.active) {
      state.active = false;
      interviewState.delete(key);
      const timeoutEmbed = new EmbedBuilder()
        .setColor(0x95A5A6)
        .setDescription('Application timed out. Start again when ready.');
      await dmChannel.send({ embeds: [timeoutEmbed] }).catch(() => {});
    }
  });

  const bar = progressBar(0, config.questions.length);
  const firstQEmbed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setDescription([
      `**Question 1/${config.questions.length}**`,
      `\`${bar}\``,
      '',
      config.questions[0],
    ].join('\n'));
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

  state.active = false;
  state.collector.stop();
  interviewState.delete(key);

  const answers = [...state.answers, 'Skipped'];

  await interaction.update({ embeds: [], components: [] });

  const info = db.prepare('INSERT INTO applications (user_id, type, answers) VALUES (?, ?, ?)').run(userId, type, JSON.stringify(answers));
  sendToChannel(interaction.client, userId, type, config, answers, info.lastInsertRowid);

  const doneEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: 'Application Submitted', iconURL: interaction.user.displayAvatarURL({ size: 64 }) })
    .setDescription([
      'Your application has been submitted!',
      '',
      'We will review it and get back to you.',
      'You will receive a DM when a decision is made.',
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();
  try {
    const dmChannel = await interaction.user.createDM();
    await dmChannel.send({ embeds: [doneEmbed] });
  } catch {}
}

export async function handleAccept(client, interaction, appId) {
  if (!isManager(interaction.member)) {
    return interaction.reply({ content: 'Only managers can accept applications.', flags: MessageFlags.Ephemeral });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({ content: 'Application already reviewed.', flags: MessageFlags.Ephemeral });
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
  if (!isManager(interaction.member)) {
    return interaction.reply({ content: 'Only managers can accept applications.', flags: MessageFlags.Ephemeral });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({ content: 'Application already reviewed.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const reason = interaction.fields.getTextInputValue('reason');
  db.prepare("UPDATE applications SET status = 'accepted', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?").run(interaction.user.id, appId);

  const config = QUESTIONS[app.type];
  const roleIds = config.roleEnvs.map(e => process.env[e]).filter(Boolean);

  const member = interaction.guild.members.cache.get(app.user_id);
  if (member && roleIds.length) {
    await member.roles.add(roleIds).catch(() => {});
  }

  const rolesGiven = roleIds.map(id => `<@&${id}>`).join(', ');
  const acceptEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setAuthor({ name: 'Application Accepted', iconURL: interaction.guild.iconURL({ size: 64 }) })
    .setDescription([
      `Congratulations! Your **${config.role}** application has been **accepted**!`,
      '',
      member && rolesGiven ? `You have been given: ${rolesGiven}` : '',
      '',
      `**Reason:** ${reason}`,
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(app.user_id);
    await user.send({ embeds: [acceptEmbed] });
  } catch {}

  const msgEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0x2ECC71)
    .setAuthor({ name: `Accepted — ${config.role} Application`, iconURL: 'https://mc-heads.net/avatar/MHF_Steve/64' })
    .setDescription(`<@${app.user_id}> got accepted for **${config.role}**.`);
  const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
  disabledRow.components.forEach(b => b.setDisabled(true));
  await interaction.message.edit({ embeds: [msgEmbed], components: [disabledRow] });

  const doneEmbed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setDescription(`<@${app.user_id}> got accepted for **${config.role}**.`);
  await interaction.editReply({ embeds: [doneEmbed] });
}

export async function handleReject(client, interaction, appId) {
  if (!isManager(interaction.member)) {
    return interaction.reply({ content: 'Only managers can reject applications.', flags: MessageFlags.Ephemeral });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({ content: 'Application already reviewed.', flags: MessageFlags.Ephemeral });
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
  if (!isManager(interaction.member)) {
    return interaction.reply({ content: 'Only managers can reject applications.', flags: MessageFlags.Ephemeral });
  }

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(appId);
  if (!app || app.status !== 'pending') {
    return interaction.reply({ content: 'Application already reviewed.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const reason = interaction.fields.getTextInputValue('reason');
  db.prepare("UPDATE applications SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?").run(interaction.user.id, appId);

  const config = QUESTIONS[app.type];

  const rejectEmbed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setAuthor({ name: 'Application Rejected', iconURL: interaction.guild.iconURL({ size: 64 }) })
    .setDescription([
      `Your **${config.role}** application has been reviewed.`,
      '',
      'Unfortunately, we have decided to **decline** your application at this time.',
      '',
      `**Reason:** ${reason}`,
    ].join('\n'))
    .setFooter({ text: 'Apex Building Service' })
    .setTimestamp();

  try {
    const user = await client.users.fetch(app.user_id);
    await user.send({ embeds: [rejectEmbed] });
  } catch {}

  const msgEmbed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(0xE74C3C)
    .setAuthor({ name: `Rejected — ${config.role} Application`, iconURL: 'https://mc-heads.net/avatar/MHF_Steve/64' })
    .setDescription(`<@${app.user_id}> was declined for **${config.role}**.`);
  const disabledRow = ActionRowBuilder.from(interaction.message.components[0]);
  disabledRow.components.forEach(b => b.setDisabled(true));
  await interaction.message.edit({ embeds: [msgEmbed], components: [disabledRow] });

  const doneEmbed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setDescription(`<@${app.user_id}> was declined for **${config.role}**.`);
  await interaction.editReply({ embeds: [doneEmbed] });
}
