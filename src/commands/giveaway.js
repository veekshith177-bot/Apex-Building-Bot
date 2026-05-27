import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isStaff, parseDuration } from '../utils.js';
import { endGiveaway } from '../events/giveawayEnd.js';

const stmtInsertGiveaway = db.prepare('INSERT INTO giveaways (message_id, channel_id, prize, winners, ends_at, hosted_by, mode, sos_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
const stmtActiveGiveaway = db.prepare("SELECT * FROM giveaways WHERE message_id = ? AND ended = 0");
const stmtEndedGiveaway = db.prepare("SELECT * FROM giveaways WHERE message_id = ? AND ended = 1");
const stmtEndGiveaway = db.prepare('UPDATE giveaways SET ended_by = ? WHERE id = ?');
const stmtEntrants = db.prepare('SELECT DISTINCT user_id FROM giveaway_entrants WHERE giveaway_id = ?');
const stmtAllGiveaways = db.prepare("SELECT * FROM giveaways WHERE ended = 0 ORDER BY ends_at ASC");
const stmtGiveawayWinners = db.prepare("SELECT user_id FROM giveaway_entrants WHERE giveaway_id = ? AND sos_choice IS NOT NULL");
const giveawayPages = new Map();

export default {
  async execute(interaction) {
    const hasAccess = interaction.member.roles.cache.has(process.env.GIVEAWAY_ACCESS_ROLE_ID)
      || isStaff(interaction.member);

    if (!hasAccess) {
      return interaction.reply({ content: 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'create') return handleCreate(interaction);
    if (sub === 'end') return handleEnd(interaction);
    if (sub === 'reroll') return handleReroll(interaction);
    if (sub === 'list') return handleList(interaction);
  },
};

async function handleCreate(interaction) {
  const prize = interaction.options.getString('prize');
  const durationStr = interaction.options.getString('duration');
  const winners = interaction.options.getInteger('winners');
  const mode = interaction.options.getString('mode') || 'standard';
  const sosTime = mode === 'split-or-steal'
    ? (interaction.options.getInteger('sos_time') || 60)
    : null;

  if (mode === 'split-or-steal' && winners !== 2) {
    return interaction.reply({ content: 'Split or Steal needs exactly 2 winners.', flags: MessageFlags.Ephemeral });
  }

  const durationMs = parseDuration(durationStr);
  if (!durationMs) {
    return interaction.reply({ content: 'Invalid duration. Use format like `1h`, `30m`, `1d` etc.', flags: MessageFlags.Ephemeral });
  }

  const endsAt = new Date(Date.now() + durationMs);

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle(mode === 'split-or-steal' ? '🎲 Split or Steal Giveaway' : '🎉 Giveaway')
    .setDescription([
      `**Prize:** ${prize}`,
      `**Winners:** ${winners}`,
      `**Mode:** ${mode === 'split-or-steal' ? `Split or Steal (${sosTime}m claim time)` : 'Standard'}`,
      `**Hosted by:** <@${interaction.member.id}>`,
      `**Entries:** 0`,
      '',
      `Ends: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
      '',
      'Hit the button to enter!',
    ].join('\n'))
    .setImage(process.env.PANEL_BANNER_URL)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter').setStyle(ButtonStyle.Success).setEmoji('🎉'),
  );

  const pingRole = process.env.GIVEAWAY_PING_ROLE_ID;
  const content = pingRole ? `<@&${pingRole}>` : '';
  const msg = await interaction.channel.send({ content, embeds: [embed], components: [row], allowedMentions: { parse: ['users', 'roles'] } });

  stmtInsertGiveaway.run(msg.id, interaction.channel.id, prize, winners, endsAt.toISOString(), interaction.member.id, mode, sosTime);

  const createdEmbed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setDescription(`Giveaway created! ${msg.url}`);
  await interaction.reply({ embeds: [createdEmbed], flags: MessageFlags.Ephemeral });
}

async function handleEnd(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'You need to be staff to use this.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const msgId = interaction.options.getString('message_id');
  const giveaway = stmtActiveGiveaway.get(msgId);
  if (!giveaway) {
    return interaction.editReply({ content: 'No active giveaway found with that message ID.' });
  }

  stmtEndGiveaway.run(interaction.member.id, giveaway.id);

  const giveawayChannel = await interaction.guild.channels.fetch(giveaway.channel_id).catch(() => interaction.channel);
  await endGiveaway(interaction.client, giveaway, giveawayChannel);
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setDescription('Giveaway ended.');
  await interaction.editReply({ embeds: [embed] });
}

async function handleReroll(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'You need to be staff to use this.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const msgId = interaction.options.getString('message_id');
  const giveaway = stmtEndedGiveaway.get(msgId);
  if (!giveaway) {
    return interaction.editReply({ content: 'No ended giveaway found with that message ID.' });
  }

  let entrants = stmtEntrants.all(giveaway.id);
  const previousWinners = stmtGiveawayWinners.all(giveaway.id).map(r => r.user_id);
  if (previousWinners.length) {
    entrants = entrants.filter(e => !previousWinners.includes(e.user_id));
  }
  if (entrants.length < 1) {
    return interaction.editReply({ content: 'Not enough entrants to reroll. All entrants have already won.' });
  }

  const winner = entrants[Math.floor(Math.random() * entrants.length)];
  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🎉 Reroll!')
    .setDescription(`**Prize:** ${giveaway.prize}\n**New winner:** <@${winner.user_id}>`)
    .setTimestamp();

  await interaction.channel.send({ embeds: [embed], content: `<@${winner.user_id}>` });
  const rerollEmbed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setDescription(`Rerolled! Winner: <@${winner.user_id}>`);
  await interaction.editReply({ embeds: [rerollEmbed] });
}

async function handleList(interaction) {
  const giveaways = stmtAllGiveaways.all();
  if (!giveaways.length) {
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('Active Giveaways')
      .setDescription('No active giveaways right now.\nUse `/giveaway create` to start one.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const list = giveaways.map(g => {
    const ends = new Date(g.ends_at);
    return `• [${g.prize}](https://discord.com/channels/${interaction.guild.id}/${g.channel_id}/${g.message_id}) — ends <t:${Math.floor(ends.getTime() / 1000)}:R> (${g.mode === 'split-or-steal' ? '🎲 Split or Steal' : '🎉 Standard'})`;
  });

  const chunks = [];
  for (let i = 0; i < list.length; i += 10) {
    chunks.push(list.slice(i, i + 10));
  }

  const pageId = `glist_${interaction.user.id}`;
  giveawayPages.set(pageId, { chunks, page: 1 });

  const row = chunks.length > 1 ? new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('glist_prev').setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId('glist_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary),
  ) : null;

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('Active Giveaways')
    .setDescription(chunks[0].join('\n'))
    .setFooter({ text: `Page 1/${chunks.length}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], components: row ? [row] : [], flags: MessageFlags.Ephemeral });
}

export async function handleGiveawayListNav(interaction) {
  const pageId = `glist_${interaction.user.id}`;
  const state = giveawayPages.get(pageId);
  if (!state) {
    return interaction.reply({ content: 'Session expired. Use `/giveaway list` again.', flags: MessageFlags.Ephemeral, ephemeral: true });
  }

  const isNext = interaction.customId === 'glist_next';
  state.page += isNext ? 1 : -1;
  giveawayPages.set(pageId, state);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('glist_prev').setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(state.page <= 1),
    new ButtonBuilder().setCustomId('glist_next').setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(state.page >= state.chunks.length),
  );

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('Active Giveaways')
    .setDescription(state.chunks[state.page - 1].join('\n'))
    .setFooter({ text: `Page ${state.page}/${state.chunks.length}` })
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [row] });
}
