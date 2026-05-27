import { EmbedBuilder } from 'discord.js';
import db from '../database.js';
import { endGiveaway } from './giveawayEnd.js';
import { finalizeClose } from './handlers/ticketClose.js';
import { info, error as logError, timestamp } from '../logger.js';
import { mutedCache } from '../cache.js';

const stmtExpiredGiveaways = db.prepare("SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?");
const stmtActiveMutes = db.prepare("SELECT * FROM mutes WHERE expires_at > ?");
const stmtExpiredMutes = db.prepare("SELECT * FROM mutes WHERE expires_at <= ?");
const stmtDeleteMute = db.prepare('DELETE FROM mutes WHERE user_id = ?');
const stmtExpiredBans = db.prepare("SELECT * FROM tempbans WHERE expires_at <= ?");
const stmtDeleteBan = db.prepare('DELETE FROM tempbans WHERE id = ?');
const stmtExpiredLoas = db.prepare('SELECT * FROM active_loas WHERE end_at <= ?');
const stmtDeleteLoa = db.prepare('DELETE FROM active_loas WHERE id = ?');
const stmtUpdateLoaRequest = db.prepare("UPDATE loa_requests SET status = 'ended' WHERE id = ?");
const stmtInactive = db.prepare("SELECT * FROM tickets WHERE status = 'open' AND inactivity_warned_at IS NOT NULL AND inactivity_warned_at <= datetime('now', '-24 hours')");

export default function (client) {
  const tag = client.user.tag;
  const guildCount = client.guilds.cache.size;
  info(`✓ ${tag} — online in ${guildCount} guild(s)`);
  client.user.setActivity('Donut SMP builds', { type: 3 });

  const activeMutes = stmtActiveMutes.all(new Date().toISOString());
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  for (const mute of activeMutes) {
    const expires = new Date(mute.expires_at).getTime();
    const remaining = expires - Date.now();
    if (remaining > 0 && guild) {
      guild.members.fetch(mute.user_id).then(member => {
        member.timeout(remaining, `Mute re-applied after restart: ${mute.reason || 'No reason'}`).catch(() => {});
      }).catch(() => {});
    }
  }
  if (activeMutes.length) info(`Re-applied ${activeMutes.length} active mute(s)`);

  setInterval(async () => {
    const now = new Date().toISOString();

    const expiredGws = stmtExpiredGiveaways.all(now);
    for (const giveaway of expiredGws) {
      try {
        const channel = client.channels.cache.get(giveaway.channel_id);
        if (channel) {
          info(`Ending giveaway "${giveaway.prize}" (ID: ${giveaway.id})`);
          await endGiveaway(client, giveaway, channel);
        }
      } catch (e) {
        logError(`Giveaway end (ID: ${giveaway.id}):`, e.message);
      }
    }

    const expiredMutes = stmtExpiredMutes.all(now);
    for (const mute of expiredMutes) {
      try {
        stmtDeleteMute.run(mute.user_id);
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
          const member = await guild.members.fetch(mute.user_id).catch(() => null);
          if (member) {
            await member.timeout(null).catch(() => {});
            const embed = new EmbedBuilder()
              .setColor(0x2ECC71)
              .setDescription(`Your mute in **${guild.name}** has expired. You can talk again.`)
              .setTimestamp();
            await member.send({ embeds: [embed] }).catch(() => {});
            info(`Mute expired for ${mute.user_id}`);
          }
        }
      } catch (e) {
        logError(`Mute expiry (${mute.user_id}):`, e.message);
      }
    }

    const expiredBans = stmtExpiredBans.all(now);
    for (const ban of expiredBans) {
      try {
        stmtDeleteBan.run(ban.id);
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
          await guild.bans.remove(ban.user_id, 'Tempban expired').catch(() => {});
          try {
            const user = await client.users.fetch(ban.user_id);
            const embed = new EmbedBuilder()
              .setColor(0x2ECC71)
              .setDescription(`Your temporary ban in **${guild.name}** has expired. You can join again.`)
              .setTimestamp();
            await user.send({ embeds: [embed] }).catch(() => {});
          } catch {}
          info(`Tempban expired for ${ban.user_id}`);
        }
      } catch (e) {
        logError(`Tempban expiry (${ban.user_id}):`, e.message);
      }
    }

    const expiredLoas = stmtExpiredLoas.all(Date.now());
    for (const loa of expiredLoas) {
      try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
          const member = await guild.members.fetch(loa.user_id).catch(() => null);
          if (member) {
            await member.roles.remove(process.env.LOA_ROLE_ID).catch(() => {});
            await member.setNickname(loa.original_nickname, 'LOA ended').catch(() => {});
          }
        }
        stmtDeleteLoa.run(loa.id);
        stmtUpdateLoaRequest.run(loa.request_id);
        info(`LOA ended for ${loa.user_id}`);

        const user = await client.users.fetch(loa.user_id).catch(() => null);
        if (user) {
          const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('✅ LOA Ended')
            .setDescription('Your Leave of Absence has ended. Welcome back!')
            .setTimestamp();
          await user.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (e) {
        logError(`LOA end (${loa.user_id}):`, e.message);
      }
    }

    const inactiveTickets = stmtInactive.all();
    for (const ticket of inactiveTickets) {
      try {
        const channel = client.channels.cache.get(ticket.channel_id);
        if (channel) {
          const embed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('Ticket Closed — Inactivity')
            .setDescription('This ticket has been automatically closed due to 24 hours of inactivity.');
          await channel.send({ embeds: [embed] });
          await finalizeClose(client, channel, ticket, client.user.id);
          setTimeout(() => channel.delete().catch(() => {}), 5000);
        } else {
          db.prepare("UPDATE tickets SET status = 'closed', closed_at = datetime('now') WHERE id = ?").run(ticket.id);
        }
        info(`Ticket #${ticket.id} auto-closed due to inactivity`);

        const logChan = client.channels.cache.get(process.env.ACTION_LOGS_CHANNEL_ID);
        if (logChan) {
          const logEmbed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('Ticket Auto-Closed — Inactivity')
            .setDescription([
              `**Channel:** ${channel ? channel.name : ticket.channel_id}`,
              `**User:** <@${ticket.user_id}>`,
              `**Type:** ${ticket.type}`,
              `**Reason:** No response within 24h of inactivity warning`,
            ].join('\n'))
            .setTimestamp();
          await logChan.send({ embeds: [logEmbed] });
        }
      } catch (e) {
        logError(`Inactivity close (ticket #${ticket.id}):`, e.message);
      }
    }
  }, 30_000);
}
