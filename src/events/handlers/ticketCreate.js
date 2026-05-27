import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import db from '../../database.js';
import { getCategory, logAction } from '../../utils.js';
import { info, error as logError } from '../../logger.js';

const stmtBlacklist = db.prepare('SELECT * FROM blacklist WHERE user_id = ?');
const stmtOpenTicketByType = db.prepare("SELECT * FROM tickets WHERE user_id = ? AND status = 'open' AND type = ?");
const stmtInsertTicket = db.prepare('INSERT INTO tickets (channel_id, user_id, type, channel_name) VALUES (?, ?, ?, ?)');

const modals = {
  general: { title: 'General Inquiry', emoji: '\u{1F4E9}', fields: [{ id: 'q1', label: 'Where can we help you with?', style: TextInputStyle.Paragraph, maxLength: 2000 }] },
  partner: { title: 'Partner Request', emoji: '\u{1F91D}', fields: [
    { id: 'q1', label: 'How many members does your community have?', maxLength: 200 },
    { id: 'q2', label: 'Read partner requirements? (Yes/No)', maxLength: 200 },
  ]},
  giveaway: { title: 'Giveaway Claim', emoji: '\u{1F389}', fields: [
    { id: 'q1', label: 'How much did you win?', maxLength: 200 },
    { id: 'q2', label: 'What is your Minecraft username?', maxLength: 100 },
    { id: 'q3', label: 'Can you provide proof? (Yes/No)', maxLength: 200 },
  ]},
  spawner: { title: 'Spawner Ticket', emoji: '\u{1F95A}', fields: [
    { id: 'q1', label: 'Do you want to BUY or SELL?', maxLength: 100 },
    { id: 'q2', label: 'How many spawners do you want to BUY or SELL?', maxLength: 200 },
    { id: 'q3', label: 'What type of spawner do you want?', maxLength: 500 },
  ]},
  rank: { title: 'Rank Request', emoji: '\u{2B50}', fields: [
    { id: 'q1', label: 'Which rank would you like to request?', maxLength: 200 },
  ]},
  build: { title: 'Base / Stash Build', emoji: '\u{1F3D7}\uFE0F', fields: [
    { id: 'q1', label: 'Do you already have an idea in mind?', maxLength: 1000 },
    { id: 'q2', label: 'Which region do you want this build in?', maxLength: 500 },
    { id: 'q3', label: 'What is your budget?', maxLength: 500 },
  ]},
  digout: { title: 'Dig Out', emoji: '\u{26CF}\uFE0F', fields: [
    { id: 'q1', label: 'What size? (Length x Width x Height)', maxLength: 200 },
    { id: 'q2', label: 'Do you know the Dig-Out Formula?', maxLength: 200 },
  ]},
  refund: { title: 'Refund Request', emoji: '\u{1F4B8}', fields: [
    { id: 'q1', label: 'Which refund would you like to request?', maxLength: 500 },
    { id: 'q2', label: 'How much are you requesting?', maxLength: 200 },
    { id: 'q3', label: 'What is your Minecraft username?', maxLength: 100 },
  ]},
  bedrock: { title: 'Bedrock Hole', emoji: '\u{1F573}\uFE0F', fields: [
    { id: 'q1', label: 'Which region do you want the bedrock hole in?', maxLength: 500 },
    { id: 'q2', label: 'What is your Minecraft username?', maxLength: 100 },
    { id: 'q3', label: 'What size should the bedrock hole be?', maxLength: 200 },
  ]},
  buysell: { title: 'Buy / Sell', emoji: '\u{1F4B0}', fields: [
    { id: 'q1', label: 'What is your IGN?', maxLength: 100 },
    { id: 'q2', label: 'Are you buying or selling?', maxLength: 100 },
    { id: 'q3', label: 'How many are you buying/selling?', maxLength: 100 },
  ]},
  regear: { title: 'Buy Regear', emoji: '\u{1F6E1}\uFE0F', fields: [
    { id: 'q1', label: "What is your in-game name?", maxLength: 100 },
    { id: 'q2', label: 'Are you buying Hotbar, Inventory or Both?', maxLength: 100 },
    { id: 'q3', label: 'How much do you want to buy? (Minimum 10)', maxLength: 100 },
  ]},
};

const buttonTypeMap = {
  ticket_general: 'general', ticket_partner: 'partner', ticket_giveaway: 'giveaway',
  ticket_spawner: 'spawner', ticket_rank: 'rank', ticket_build: 'build',
  ticket_digout: 'digout', ticket_refund: 'refund', ticket_bedrock: 'bedrock',
  ticket_buysell: 'buysell', ticket_regear: 'regear',
};

export async function handlePanelSelect(interaction, values) {
  return handlePanelButton(interaction, values[0]);
}

export async function handleTicketButton(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('ticket_')) return false;
  const type = buttonTypeMap[id];
  if (!type) return false;
  await handlePanelButton(interaction, type);
  return true;
}

async function handlePanelButton(interaction, type) {
  if (stmtBlacklist.get(interaction.user.id)) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('You are blacklisted from creating tickets.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const existing = stmtOpenTicketByType.get(interaction.user.id, type);
  if (existing) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription(`You already have an open ${type} ticket: <#${existing.channel_id}>`);
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const config = modals[type];
  if (!config) return;

  const modal = new ModalBuilder().setCustomId(`ticket_modal_${type}`).setTitle(`${config.emoji} ${config.title}`);
  for (const field of config.fields) {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setStyle(field.style || TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(field.maxLength || 1000);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }
  await interaction.showModal(modal);
}

export async function handleModalSubmit(client, interaction) {
  const type = interaction.customId.replace('ticket_modal_', '');
  const config = modals[type];
  const answers = {};
  for (const field of config.fields) {
    answers[field.id] = interaction.fields.getTextInputValue(field.id);
  }

  const guild = interaction.guild;
  let categoryId;

  if (type === 'spawner' || type === 'buysell') {
    const buySell = (type === 'buysell' ? answers['q2'] : answers['q1']).toUpperCase().trim();
    categoryId = buySell.includes('SELL') ? process.env.CATEGORY_SPAWNER_SELL : process.env.CATEGORY_SPAWNER_BUY;
  } else if (type === 'regear') {
    categoryId = process.env.CATEGORY_REGEAR;
  } else {
    categoryId = getCategory(type);
  }

  if (!categoryId) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Category not configured. Contact an admin.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  let channelName = 'ticket';
  if (type === 'spawner') {
    const amount = answers['q2'] || '0';
    channelName = `${amount}-spawners`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  } else if (type === 'buysell') {
    const buySell = answers['q2'].toLowerCase().trim();
    const amount = answers['q3'] || '0';
    const prefix = buySell.includes('sell') ? 'selling' : 'buying';
    channelName = `${prefix}-${amount}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  } else {
    channelName = `${type}-${interaction.user.username}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];

  const isBuilder = ['build', 'digout', 'refund', 'regear', 'bedrock'].includes(type);
  const staffRoleId = process.env.STAFF_ROLE_ID;
  const staffView = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  const staffFull = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];

  if (type === 'rank' || type === 'refund') {
    if (process.env.ADMIN_ROLE_ID) {
      overwrites.push({ id: process.env.ADMIN_ROLE_ID, allow: staffFull });
    }
    if (process.env.MANAGER_ROLE_ID && process.env.MANAGER_ROLE_ID !== process.env.ADMIN_ROLE_ID) {
      overwrites.push({ id: process.env.MANAGER_ROLE_ID, allow: staffFull });
    }
  } else {
    overwrites.push({ id: staffRoleId, allow: isBuilder ? staffView : staffFull });

    if (isBuilder && process.env.BUILD_TEAM_ROLE_ID && process.env.BUILD_TEAM_ROLE_ID !== staffRoleId) {
      const builderCanType = ['build', 'digout', 'refund'].includes(type);
      overwrites.push({ id: process.env.BUILD_TEAM_ROLE_ID, allow: builderCanType ? staffFull : staffView });
    }

    const extraRoles = [process.env.MOD_ROLE_ID, process.env.ADMIN_ROLE_ID, process.env.MANAGER_ROLE_ID].filter(Boolean);
    const seen = new Set([staffRoleId, process.env.BUILD_TEAM_ROLE_ID].filter(Boolean));

    if (type === 'buysell' && process.env.TRUSTED_SELLER_ROLE_ID && !seen.has(process.env.TRUSTED_SELLER_ROLE_ID)) {
      seen.add(process.env.TRUSTED_SELLER_ROLE_ID);
      overwrites.push({ id: process.env.TRUSTED_SELLER_ROLE_ID, allow: staffFull });
    }
    if (type === 'regear' && process.env.REGEAR_ROLE_ID && !seen.has(process.env.REGEAR_ROLE_ID)) {
      seen.add(process.env.REGEAR_ROLE_ID);
      overwrites.push({ id: process.env.REGEAR_ROLE_ID, allow: staffFull });
    }
    for (const rid of extraRoles) {
      if (!seen.has(rid)) {
        seen.add(rid);
        overwrites.push({ id: rid, allow: staffFull });
      }
    }
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    permissionOverwrites: overwrites,
  });

  stmtInsertTicket.run(channel.id, interaction.user.id, type, channel.name);
  info(`Ticket created: #${channel.name} (${type}) by ${interaction.user.tag}`);

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(`${config.emoji} ${config.title}`)
    .setDescription(`<@${interaction.user.id}> opened a ticket.`)
    .addFields(config.fields.map(f => ({ name: f.label, value: answers[f.id], inline: false })))
    .setTimestamp();

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('close_ticket').setLabel('\u{1F512} Close Ticket').setStyle(ButtonStyle.Danger),
  );

  const pingRole = (type === 'rank' || type === 'refund') ? process.env.ADMIN_ROLE_ID : staffRoleId;
  await channel.send({ content: `<@${interaction.user.id}> <@&${pingRole}>`, embeds: [embed], components: [closeRow] });
  logAction(channel.id, 'create', interaction.user.id);

  const ticketEmbed = new EmbedBuilder().setColor(0xF1C40F).setDescription(`Ticket created: ${channel}`);
  await interaction.reply({ embeds: [ticketEmbed], flags: MessageFlags.Ephemeral });
}
