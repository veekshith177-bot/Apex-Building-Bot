import db from './database.js';

export function isHelper(member) {
  return member.roles.cache.has(process.env.HELPER_ROLE_ID)
    || member.roles.cache.has(process.env.STAFF_ROLE_ID)
    || member.roles.cache.has(process.env.MOD_ROLE_ID)
    || member.roles.cache.has(process.env.ADMIN_ROLE_ID)
    || member.roles.cache.has(process.env.MANAGER_ROLE_ID);
}

export function isStaff(member) {
  return member.roles.cache.has(process.env.STAFF_ROLE_ID)
    || member.roles.cache.has(process.env.MOD_ROLE_ID)
    || member.roles.cache.has(process.env.ADMIN_ROLE_ID)
    || member.roles.cache.has(process.env.MANAGER_ROLE_ID);
}

export function isMod(member) {
  return member.roles.cache.has(process.env.MOD_ROLE_ID)
    || member.roles.cache.has(process.env.ADMIN_ROLE_ID)
    || member.roles.cache.has(process.env.MANAGER_ROLE_ID);
}

export function isAdmin(member) {
  return member.roles.cache.has(process.env.ADMIN_ROLE_ID)
    || member.roles.cache.has(process.env.MANAGER_ROLE_ID);
}

export function isManager(member) {
  return member.roles.cache.has(process.env.MANAGER_ROLE_ID);
}

export function getCategory(type) {
  const map = {
    general: process.env.CATEGORY_GENERAL,
    partner: process.env.CATEGORY_PARTNER,
    giveaway: process.env.CATEGORY_GIVEAWAY,
    spawner: process.env.CATEGORY_SPAWNER_BUY,
    spawner_sell: process.env.CATEGORY_SPAWNER_SELL,
    rank: process.env.CATEGORY_RANK_REQUEST,
    build: process.env.CATEGORY_BUILD,
    digout: process.env.CATEGORY_DIGOUT,
    refund: process.env.CATEGORY_REFUND,
    bedrock: process.env.CATEGORY_BEDROCK_HOLE,
  };
  return map[type];
}

const stmtLogAction = db.prepare('INSERT INTO ticket_actions (ticket_channel_id, action, actor_id, target_id, details) VALUES (?, ?, ?, ?, ?)');

export function logAction(channelId, action, actorId, targetId, details) {
  stmtLogAction.run(channelId, action, actorId, targetId || null, details || null);
}

const cooldowns = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, expires] of cooldowns) {
    if (now >= expires) cooldowns.delete(key);
  }
}, 60_000);

export function checkCooldown(userId, command, duration = 3000) {
  const key = `${userId}:${command}`;
  const now = Date.now();
  if (cooldowns.has(key)) {
    const expires = cooldowns.get(key);
    if (now < expires) return Math.ceil((expires - now) / 1000);
    cooldowns.delete(key);
  }
  cooldowns.set(key, now + duration);
  return 0;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function parseDuration(str) {
  const match = str.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * (multipliers[unit] || 0);
}
