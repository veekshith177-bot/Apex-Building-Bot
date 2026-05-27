import panel from '../commands/panel.js';
import ticket from '../commands/ticket.js';
import claimCmd from '../commands/claim.js';
import unclaimCmd from '../commands/unclaim.js';
import closeCmd from '../commands/close.js';
import inactivityCmd from '../commands/inactivity.js';
import antiping from '../commands/antiping.js';
import giveaway from '../commands/giveaway.js';
import blacklist from '../commands/blacklist.js';
import ticketsCmd from '../commands/tickets.js';
import spawnerprice from '../commands/spawnerprice.js';
import warnCmd from '../commands/warn.js';
import muteCmd from '../commands/mute.js';
import unmuteCmd from '../commands/unmute.js';
import slowmodeCmd from '../commands/slowmode.js';
import purgeCmd from '../commands/purge.js';
import lockCmd from '../commands/lock.js';
import unlockCmd from '../commands/unlock.js';
import banCmd from '../commands/ban.js';
import kickCmd from '../commands/kick.js';
import softbanCmd from '../commands/softban.js';
import tempbanCmd from '../commands/tempban.js';
import strikesCmd from '../commands/strikes.js';
import autoroleCmd from '../commands/autorole.js';
import reactionroleCmd from '../commands/reactionrole.js';
import helpCmd from '../commands/help.js';
import userinfoCmd from '../commands/userinfo.js';
import serverinfoCmd from '../commands/serverinfo.js';
import applypanelCmd from '../commands/applypanel.js';
import embedCmd from '../commands/embed.js';
import calcCmd from '../commands/calc.js';
import afkCmd from '../commands/afk.js';
import loaCmd from '../commands/loa.js';
import ratingsCmd from '../commands/ratings.js';
import dailyCmd from '../commands/daily.js';
import suggestionCmd from '../commands/suggestion.js';
import bugreportCmd from '../commands/bugreport.js';
import dailyScheduler from '../events/dailyScheduler.js';
import interactionCreate from '../events/interactionCreate.js';
import messageCreate from '../events/messageCreate.js';
import ready from '../events/ready.js';
import { info, error as logError } from '../logger.js';
import db from '../database.js';

const stmtAutoRoles = db.prepare('SELECT * FROM auto_roles WHERE delay_minutes = ?');
const stmtDelayedRoles = db.prepare('SELECT * FROM auto_roles WHERE delay_minutes > 0');
const stmtReactionRole = db.prepare('SELECT * FROM reaction_roles WHERE message_id = ? AND channel_id = ?');

export default function (client) {
  client.commands.set('panel', panel);
  client.commands.set('add', ticket);
  client.commands.set('remove', ticket);
  client.commands.set('rename', ticket);
  client.commands.set('claim', claimCmd);
  client.commands.set('unclaim', unclaimCmd);
  client.commands.set('note', ticket);
  client.commands.set('close', closeCmd);
  client.commands.set('inactivity', inactivityCmd);
  client.commands.set('tickets', ticketsCmd);
  client.commands.set('antiping', antiping);
  client.commands.set('giveaway', giveaway);
  client.commands.set('blacklist', blacklist);
  client.commands.set('spawnerprice', spawnerprice);
  client.commands.set('warn', warnCmd);
  client.commands.set('mute', muteCmd);
  client.commands.set('unmute', unmuteCmd);
  client.commands.set('slowmode', slowmodeCmd);
  client.commands.set('purge', purgeCmd);
  client.commands.set('lock', lockCmd);
  client.commands.set('unlock', unlockCmd);
  client.commands.set('ban', banCmd);
  client.commands.set('kick', kickCmd);
  client.commands.set('softban', softbanCmd);
  client.commands.set('tempban', tempbanCmd);
  client.commands.set('strikes', strikesCmd);
  client.commands.set('autorole', autoroleCmd);
  client.commands.set('reactionrole', reactionroleCmd);
  client.commands.set('help', helpCmd);
  client.commands.set('userinfo', userinfoCmd);
  client.commands.set('serverinfo', serverinfoCmd);
  client.commands.set('applypanel', applypanelCmd);
  client.commands.set('embed', embedCmd);
  client.commands.set('calc', calcCmd);
  client.commands.set('afk', afkCmd);
  client.commands.set('loa', loaCmd);
  client.commands.set('ratings', ratingsCmd);
  client.commands.set('daily', dailyCmd);
  client.commands.set('suggestion', suggestionCmd);
  client.commands.set('bugreport', bugreportCmd);

  info(`${client.commands.size} commands registered`);

  client.once('ready', () => ready(client));
  dailyScheduler(client);
  client.on('interactionCreate', (i) => interactionCreate(client, i));
  client.on('guildMemberAdd', (member) => handleAutoRole(client, member));
  client.on('messageReactionAdd', (reaction, user) => handleReactionRoleAdd(client, reaction, user));
  client.on('messageReactionRemove', (reaction, user) => handleReactionRoleRemove(client, reaction, user));
  messageCreate(client);
}

async function handleAutoRole(client, member) {
  const instant = stmtAutoRoles.all(0);
  for (const r of instant) {
    const role = member.guild.roles.cache.get(r.role_id);
    if (role) await member.roles.add(role).catch(() => {});
  }

  const delayed = stmtDelayedRoles.all();
  for (const r of delayed) {
    setTimeout(async () => {
      try {
        const m = await member.guild.members.fetch(member.id).catch(() => null);
        if (m) await m.roles.add(r.role_id).catch(() => {});
      } catch (e) {
        logError(`Auto-role (${r.role_id}) for ${member.id}:`, e.message);
      }
    }, r.delay_minutes * 60_000);
  }
}

async function handleReactionRoleAdd(client, reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});

  const rrs = stmtReactionRole.all(reaction.message.id, reaction.message.channelId);
  if (!rrs || rrs.length === 0) return;

  const rr = rrs.find(r => reaction.emoji.toString() === r.emoji || reaction.emoji.name === r.emoji);
  if (!rr) return;

  const member = reaction.message.guild.members.cache.get(user.id);
  if (!member) return;

  const role = reaction.message.guild.roles.cache.get(rr.role_id);
  if (role) await member.roles.add(role).catch(() => {});
}

async function handleReactionRoleRemove(client, reaction, user) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch().catch(() => {});

  const rrs = stmtReactionRole.all(reaction.message.id, reaction.message.channelId);
  if (!rrs || rrs.length === 0) return;

  const rr = rrs.find(r => reaction.emoji.toString() === r.emoji || reaction.emoji.name === r.emoji);
  if (!rr) return;

  const member = reaction.message.guild.members.cache.get(user.id);
  if (!member) return;

  const role = reaction.message.guild.roles.cache.get(rr.role_id);
  if (role) await member.roles.remove(role).catch(() => {});
}
