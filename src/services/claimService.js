import db from '../database.js';
import { logAction } from '../utils.js';

const BUILDER_TICKET_TYPES = ['build', 'digout', 'refund', 'regear'];
const BUYSELL_TYPE = 'buysell';

const CLAIM_RULES = {
  build:     { roleEnv: 'BUILD_TEAM_ROLE_ID',    label: 'build team',         limit: 1, denyRole: 'BUILD_TEAM_ROLE_ID' },
  digout:    { roleEnv: 'BUILD_TEAM_ROLE_ID',    label: 'build team',         limit: 1, denyRole: 'BUILD_TEAM_ROLE_ID' },
  refund:    { roleEnv: 'BUILD_TEAM_ROLE_ID',    label: 'build team',         limit: 1, denyRole: 'BUILD_TEAM_ROLE_ID' },
  regear:    { roleEnv: 'REGEAR_ROLE_ID',        label: 'regear team',        limit: 1, denyRole: 'REGEAR_ROLE_ID' },
  buysell:   { roleEnv: 'TRUSTED_SELLER_ROLE_ID', label: 'trusted sellers', limit: null, denyRole: 'TRUSTED_SELLER_ROLE_ID' },
};

export function isBuilderTicket(type) {
  return BUILDER_TICKET_TYPES.includes(type);
}

export function isBuysellTicket(type) {
  return type === BUYSELL_TYPE;
}

export function isBuilderRole(member) {
  return member.roles.cache.has(process.env.BUILD_TEAM_ROLE_ID);
}

export function isStaffRole(member) {
  return member.roles.cache.has(process.env.STAFF_ROLE_ID);
}

const stmtExistingClaim = db.prepare("SELECT channel_id FROM tickets WHERE claimed_by = ? AND status = 'open' LIMIT 1");

function isOwner(member) {
  return process.env.OWNER_ROLE_ID && member.roles.cache.has(process.env.OWNER_ROLE_ID);
}

export function canClaimTicket(member, ticketType) {
  if (isOwner(member)) return { allowed: true };

  const rule = CLAIM_RULES[ticketType];

  if (rule) {
    const roleId = process.env[rule.roleEnv];
    if (!roleId || !member.roles.cache.has(roleId)) {
      return { allowed: false, reason: `Only ${rule.label} can claim this ticket.` };
    }
    if (rule.limit) {
      const existing = stmtExistingClaim.get(member.id);
      if (existing) {
        return { allowed: false, reason: `You already claimed <#${existing.channel_id}>. You can only claim 1 ${ticketType} ticket at a time.` };
      }
    }
    return { allowed: true };
  }

  if (!isStaffRole(member)) {
    return { allowed: false, reason: 'You do not have permission to claim tickets.' };
  }

  return { allowed: true };
}

async function denyRoles(channel, type) {
  const rule = CLAIM_RULES[type];
  const denies = [];

  if (rule) {
    const roleId = process.env[rule.denyRole];
    if (roleId) denies.push(roleId);
  }

  if (process.env.STAFF_ROLE_ID) denies.push(process.env.STAFF_ROLE_ID);
  if (process.env.MOD_ROLE_ID && process.env.MOD_ROLE_ID !== process.env.STAFF_ROLE_ID) {
    denies.push(process.env.MOD_ROLE_ID);
  }

  for (const rid of [...new Set(denies)]) {
    await channel.permissionOverwrites.edit(rid, { SendMessages: false });
  }
}

async function restoreRoles(channel, type) {
  const rule = CLAIM_RULES[type];
  const restores = [];

  if (rule) {
    const roleId = process.env[rule.denyRole];
    if (roleId) restores.push(roleId);
  }

  if (process.env.STAFF_ROLE_ID) restores.push(process.env.STAFF_ROLE_ID);
  if (process.env.MOD_ROLE_ID && process.env.MOD_ROLE_ID !== process.env.STAFF_ROLE_ID) {
    restores.push(process.env.MOD_ROLE_ID);
  }

  for (const rid of [...new Set(restores)]) {
    await channel.permissionOverwrites.edit(rid, { SendMessages: null });
  }
}

export async function claimTicket(channel, ticket, member) {
  db.prepare("UPDATE tickets SET claimed_by = ?, claim_time = datetime('now') WHERE id = ?").run(member.id, ticket.id);

  const newName = `claimed-${member.user.username}-${ticket.type}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  await channel.setName(newName);

  await denyRoles(channel, ticket.type);
  await channel.permissionOverwrites.edit(member.id, { SendMessages: true, ViewChannel: true });

  logAction(channel.id, 'claim', member.id);
}

export async function unclaimTicket(channel, ticket, member) {
  db.prepare("UPDATE tickets SET claimed_by = NULL, claim_time = NULL WHERE id = ?").run(ticket.id);

  const origName = ticket.channel_name || `${ticket.type}-${member.user.username}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  await channel.setName(origName);

  await restoreRoles(channel, ticket.type);
  try { await channel.permissionOverwrites.delete(member.id); } catch {}

  logAction(channel.id, 'unclaim', member.id);
}
