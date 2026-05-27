import { EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { isStaff } from '../utils.js';
import { afkCache, protectedPings, refreshProtectedPings, antipingEnabled, loadAntipingSetting, mutedCache, isMuted, markMuted, loadMutes } from '../cache.js';

const spamCache = new Map();
const SPAM_WINDOW = 5000;
const SPAM_LIMIT = 15;
const MUTE_DURATION = 60_000;
const INVITE_REGEX = /(?:discord\.(?:gg|com\/invite|app\/invite|me)\/|discord\.com\/channels\/)[a-zA-Z0-9_-]+/gi;
const SLUR_REGEX = /\b(n[i1]g{2,}[a4e3]|f[a4]gg[o0]t|k[i1]k[e3]|r[e3]t[a4]rd|tr[a4]nn[y]|c[u]n[t]|wh[o0]r[e3]|b[i1]tch|f[u]ck)\b/i;

const CACHE_REFRESH_MS = 30_000;
let cachedRegexes = [];
let lastPatternRefresh = 0;

const stmtStrikeCount = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE user_id = ?');
const stmtInsertWarning = db.prepare('INSERT INTO warnings (user_id, moderator_id, reason) VALUES (?, ?, ?)');
const stmtAfkGet = db.prepare('SELECT * FROM afk WHERE user_id = ?');
const stmtAfkDelete = db.prepare('DELETE FROM afk WHERE user_id = ?');
const stmtPatterns = db.prepare('SELECT pattern FROM filtered_words');

let ticketChannelCache = null;
let ticketCacheTime = 0;
const TICKET_CACHE_TTL = 10000;

const allAfk = db.prepare('SELECT * FROM afk').all();
for (const row of allAfk) {
  afkCache.set(row.user_id, { reason: row.reason, since: row.since });
}

refreshProtectedPings(db);
loadAntipingSetting(db);
loadMutes(db);

function getPatterns() {
  const now = Date.now();
  if (now - lastPatternRefresh > CACHE_REFRESH_MS) {
    const rows = stmtPatterns.all();
    cachedRegexes = [];
    for (const row of rows) {
      try { cachedRegexes.push(new RegExp(row.pattern, 'i')); } catch {}
    }
    lastPatternRefresh = now;
  }
  return cachedRegexes;
}

function refreshTicketCache() {
  const rows = db.prepare("SELECT channel_id FROM tickets WHERE status = 'open'").all();
  ticketChannelCache = new Set(rows.map(r => r.channel_id));
  ticketCacheTime = Date.now();
}
refreshTicketCache();

setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, history] of spamCache) {
    const recent = history.filter(h => h.time > cutoff);
    if (recent.length === 0) spamCache.delete(key);
    else spamCache.set(key, recent);
  }
}, 60_000);

export default function (client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    await handleAfk(message);

    await clearInactivityWarning(message);

    if (isStaff(message.member)) return;

    if (isMuted(message.author.id)) {
      message.delete().catch(() => {});
      return;
    }

    let violation = null;

    violation = checkSlur(message);
    if (!violation && antipingEnabled) violation = checkPing(message);
    if (!violation && !isTicketChannel(message.channel.id) && !isAllowedLinkChannel(message.channel.id)) violation = checkAdvertising(message);
    if (!violation) violation = checkSpam(message);

    if (violation) {
      message.delete().catch(() => {});

      if (violation.action === 'mute') {
        markMuted(message.author.id, (violation.timeoutMs || MUTE_DURATION) + 5000);
        await message.member.timeout(violation.timeoutMs || MUTE_DURATION, `${violation.type}: ${violation.reason}`).catch(() => {});
        if (violation.type === 'Spam') purgeSpam(message);
        sendWarning(message, violation);
        logViolation(client, message, violation);
      } else {
        sendWarning(message, violation);
        logViolation(client, message, violation);
      }
    }
  });
}



function isTicketChannel(channelId) {
  if (Date.now() - ticketCacheTime > TICKET_CACHE_TTL) refreshTicketCache();
  return ticketChannelCache.has(channelId);
}

function isAllowedLinkChannel(channelId) {
  const raw = process.env.ALLOWED_LINK_CHANNELS;
  if (!raw) return false;
  return raw.split(',').map(id => id.trim()).includes(channelId);
}

function checkSlur(message) {
  if (SLUR_REGEX.test(message.content)) {
    const strikes = stmtStrikeCount.get(message.author.id).c;
    const timeoutDuration = strikes >= 3 ? 86_400_000 : strikes >= 1 ? 21_600_000 : 3_600_000;

    stmtInsertWarning.run(message.author.id, message.guild.ownerId, 'Auto-detected slur');

    return { type: 'Slur', reason: 'Inappropriate language detected', action: 'mute', timeoutMs: timeoutDuration };
  }

  const regexes = getPatterns();
  for (const re of regexes) {
    if (re.test(message.content)) return { type: 'Slur', reason: 'Inappropriate language detected', action: 'mute', timeoutMs: 3_600_000 };
  }
  return null;
}

function checkPing(message) {
  const hasEveryone = message.mentions.everyone;
  const mentionedRoles = [...message.mentions.roles.keys()];
  const mentionedUsers = [...message.mentions.users.keys()];

  const hasStaffPing = mentionedRoles.includes(process.env.STAFF_ROLE_ID);
  const hasProtectedRole = mentionedRoles.some(id => protectedPings.roles.has(id));
  const hasProtectedUser = mentionedUsers.some(id => protectedPings.users.has(id));

  if (!hasEveryone && !hasStaffPing && !hasProtectedRole && !hasProtectedUser) return null;

  const targets = [];
  if (hasEveryone) targets.push('@everyone/@here');
  if (hasStaffPing) targets.push('staff');
  if (hasProtectedRole) targets.push('protected roles');
  if (hasProtectedUser) targets.push('protected users');

  return { type: 'Anti-Ping', reason: `Pinging ${targets.join(' and ')}` };
}

function checkAdvertising(message) {
  const invites = message.content.match(INVITE_REGEX);
  if (!invites) return null;

  return { type: 'Advertising', reason: `Discord invite link: \`${invites[0]}\`` };
}

function checkSpam(message) {
  const userId = message.author.id;
  const now = Date.now();

  let history = spamCache.get(userId);
  if (!history) {
    history = [];
    spamCache.set(userId, history);
  }

  history.push({ time: now, id: message.id });

  const recent = history.filter(h => now - h.time < SPAM_WINDOW);
  if (recent.length !== history.length) {
    spamCache.set(userId, recent);
    history = recent;
  }

  if (recent.length >= SPAM_LIMIT) {
    return { type: 'Spam', reason: 'Sending messages too fast', action: 'mute' };
  }

  return null;
}

async function purgeSpam(message) {
  const userId = message.author.id;
  const history = spamCache.get(userId);
  if (!history || !history.length) return;

  const ids = [...new Set(history.map(h => h.id).filter(Boolean))];
  spamCache.delete(userId);

  if (ids.length < 2) return;
  try {
    await message.channel.bulkDelete(ids, true);
  } catch {
    for (const id of ids) {
      message.channel.messages.fetch(id).then(m => m.delete().catch(() => {})).catch(() => {});
    }
  }
}

function formatDuration(ms) {
  if (ms >= 86_400_000) return `${ms / 86_400_000} day(s)`;
  if (ms >= 3_600_000) return `${ms / 3_600_000} hour(s)`;
  if (ms >= 60_000) return `${ms / 60_000} minute(s)`;
  return `${ms / 1000} second(s)`;
}

function sendWarning(message, violation) {
  const duration = violation.timeoutMs || MUTE_DURATION;
  const desc = violation.action === 'mute'
    ? `${message.author}, ${violation.reason}. You have been muted for ${formatDuration(duration)}.`
    : `${message.author}, ${violation.reason}.`;

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setDescription(desc)
    .setTimestamp();
  message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 4000));
}

function logViolation(client, message, violation) {
  const logChannel = client.channels.cache.get(process.env.ACTION_LOGS_CHANNEL_ID);
  if (!logChannel) return;

  const violationColors = {
    Slur: 0xE74C3C,
    'Anti-Ping': 0xF39C12,
    Advertising: 0x3498DB,
    Spam: 0xE67E22,
  };

  const embed = new EmbedBuilder()
    .setColor(violationColors[violation.type] || 0x95A5A6)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ size: 64 }) })
    .setTitle(`${violation.type} Detected`)
    .addFields(
      { name: 'User', value: `<@${message.author.id}>`, inline: true },
      { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Reason', value: violation.reason, inline: false },
      { name: 'Content', value: message.content ? `\`\`\`\n${message.content.slice(0, 900)}\n\`\`\`` : '*[empty]*', inline: false },
    );

  if (violation.action === 'mute') {
    const duration = violation.timeoutMs
      ? `${Math.round(violation.timeoutMs / 60000)} min`
      : '1 min';
    embed.addFields({ name: 'Action Taken', value: `Muted for ${duration} + messages purged`, inline: false });
  }

  embed.setFooter({ text: `User ID: ${message.author.id}` }).setTimestamp();

  logChannel.send({ embeds: [embed] });
}

async function clearInactivityWarning(message) {
  if (message.author.bot) return;
  const ticket = db.prepare("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open' AND inactivity_warned_at IS NOT NULL").get(message.channel.id);
  if (!ticket) return;
  if (message.author.id !== ticket.user_id) return;

  db.prepare("UPDATE tickets SET inactivity_warned_at = NULL WHERE id = ?").run(ticket.id);

  const embed = new EmbedBuilder()
    .setColor(0x2ECC71)
    .setTitle('Inactivity Cancelled')
    .setDescription(`<@${message.author.id}> has responded. The ticket is now active again.`);
  message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
}

async function handleAfk(message) {
  const cached = afkCache.get(message.author.id);
  if (cached) {
    stmtAfkDelete.run(message.author.id);
    afkCache.delete(message.author.id);
    try {
      const nick = message.member.displayName;
      if (nick.startsWith('[AFK] ')) {
        await message.member.setNickname(nick.slice(6)).catch(() => {});
      }
    } catch {}
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setDescription(`Welcome back! You were AFK for **${formatDuration(Date.now() - cached.since)}**.`);
    await message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    return;
  }

  for (const user of message.mentions.users.values()) {
    if (user.bot) continue;
    const afk = afkCache.get(user.id);
    if (afk) {
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`**${user.tag}** is AFK: ${afk.reason} (${formatDuration(Date.now() - afk.since)} ago)`);
      await message.channel.send({ embeds: [embed] }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }
}

function formatDuration(ms) {
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}
