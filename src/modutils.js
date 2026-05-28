import { EmbedBuilder } from 'discord.js';
import db from './database.js';
import { THEME } from './ui/theme.js';

const stmtNextCase = db.prepare('SELECT COALESCE(MAX(case_id), 0) + 1 AS next FROM mod_logs');
const stmtInsertLog = db.prepare('INSERT INTO mod_logs (case_id, action, moderator_id, target_id, reason) VALUES (?, ?, ?, ?, ?)');
const stmtStrikeCount = db.prepare('SELECT COUNT(*) as c FROM warnings WHERE user_id = ?');

const LOG_COLORS = {
  Warn: 0xF39C12,
  Mute: 0xE67E22,
  Ban: THEME.colors.danger,
  Kick: THEME.colors.danger,
  Softban: THEME.colors.warn,
  Tempban: THEME.colors.danger,
  Purge: THEME.colors.info,
  Slowmode: 0x1ABC9C,
  Lock: THEME.colors.neutral,
  Unlock: THEME.colors.success,
};

const CHANNEL_ACTIONS = ['Purge', 'Slowmode', 'Lock', 'Unlock'];

export function logModAction(guild, action, moderatorId, targetId, reason) {
  const logChannel = guild.channels.cache.get(process.env.ACTION_LOGS_CHANNEL_ID);
  if (!logChannel) return;

  const caseId = stmtNextCase.get().next;

  stmtInsertLog.run(caseId, action, moderatorId, targetId, reason || null);

  const color = LOG_COLORS[action] || 0x95A5A6;
  const isChannelAction = CHANNEL_ACTIONS.includes(action);
  const moderator = guild.members.cache.get(moderatorId);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${action} | Case #${String(caseId).padStart(3, '0')}`)
    .setThumbnail(moderator?.user.displayAvatarURL({ size: 64 }) || null)
    .addFields(
      { name: 'Moderator', value: `<@${moderatorId}>`, inline: true },
      { name: isChannelAction ? 'Channel' : 'Target', value: isChannelAction ? `<#${targetId}>` : `<@${targetId}>`, inline: true },
    );

  if (reason) {
    embed.addFields({ name: 'Reason', value: reason, inline: false });
  }

  embed.addFields({ name: `${isChannelAction ? 'Channel' : 'Target'} ID`, value: `\`${targetId}\``, inline: false });

  const now = new Date();
  embed.setFooter({
    text: `Case #${String(caseId).padStart(3, '0')} / ${moderator?.user?.username || 'Unknown'} / ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
  });
  embed.setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
}

export function checkStrikes(userId) {
  return stmtStrikeCount.get(userId).c;
}

export function autoPunish(guild, userId) {
  const strikes = checkStrikes(userId);
  if (strikes >= 5) {
    const member = guild.members.cache.get(userId);
    if (member) {
      member.ban({ reason: `Auto-ban: 5 strike limit reached` }).catch(() => {});
    }
  } else if (strikes >= 3) {
    const member = guild.members.cache.get(userId);
    if (member) {
      member.timeout(3_600_000, `Auto-mute: 3 strikes reached`).catch(() => {});
    }
  }
}

export function buildModEmbed(action, color, description) {
  return new EmbedBuilder()
    .setColor(color || THEME.colors.warn)
    .setTitle(String(action).slice(0, 256))
    .setDescription(String(description || '').slice(0, 4096))
    .setFooter({ text: `${THEME.brandName} • Moderation` })
    .setTimestamp();
}
