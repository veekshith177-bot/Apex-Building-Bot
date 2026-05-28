import { PermissionsBitField, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isAdmin } from '../utils.js';
import { brandEmbed } from '../ui/embeds.js';
import { THEME } from '../ui/theme.js';

const stmtDbPing = db.prepare('SELECT 1 AS ok');

function yn(val) {
  return val ? '✅' : '❌';
}

function checkId(kind, id) {
  if (!id) return { ok: false, msg: 'missing' };
  if (!/^\d{15,25}$/.test(String(id))) return { ok: false, msg: 'invalid' };
  return { ok: true, msg: 'ok' };
}

export default {
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need to be admin+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const { guild } = interaction;
    const client = interaction.client;

    const requiredIds = [
      // Channels
      ['channel', 'ACTION_LOGS_CHANNEL_ID'],
      ['channel', 'TRANSCRIPT_LOGS_CHANNEL_ID'],
      ['channel', 'RATING_LOGS_CHANNEL_ID'],
      ['channel', 'APPLICATION_LOGS_CHANNEL_ID'],
      ['channel', 'LOA_LOGS_CHANNEL_ID'],
      ['channel', 'SUGGESTIONS_CHANNEL_ID'],
      ['channel', 'BUG_REPORTS_CHANNEL_ID'],
      // Roles
      ['role', 'STAFF_ROLE_ID'],
      ['role', 'MOD_ROLE_ID'],
      ['role', 'ADMIN_ROLE_ID'],
      ['role', 'MANAGER_ROLE_ID'],
    ];

    const missingEnv = [];
    const invalidEnv = [];
    for (const [, key] of requiredIds) {
      const id = process.env[key];
      if (!id) missingEnv.push(key);
      else if (!checkId('id', id).ok) invalidEnv.push(key);
    }

    const missingChannels = [];
    for (const [kind, key] of requiredIds.filter(([k]) => k === 'channel')) {
      const id = process.env[key];
      if (!id) continue;
      if (!guild.channels.cache.has(id)) missingChannels.push(`${key} (${id})`);
    }

    const missingRoles = [];
    for (const [kind, key] of requiredIds.filter(([k]) => k === 'role')) {
      const id = process.env[key];
      if (!id) continue;
      if (!guild.roles.cache.has(id)) missingRoles.push(`${key} (${id})`);
    }

    let me = guild.members.me;
    if (!me) {
      me = await guild.members.fetchMe().catch(() => null);
    }

    const requiredPerms = [
      PermissionsBitField.Flags.ViewChannel,
      PermissionsBitField.Flags.SendMessages,
      PermissionsBitField.Flags.EmbedLinks,
      PermissionsBitField.Flags.ReadMessageHistory,
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.ModerateMembers,
      PermissionsBitField.Flags.ManageRoles,
    ];

    const hasPerms = me ? me.permissions.has(requiredPerms) : false;

    let dbOk = false;
    try {
      dbOk = stmtDbPing.get()?.ok === 1;
    } catch {
      dbOk = false;
    }

    const wsPing = Math.round(client.ws.ping);
    const uptimeMins = Math.floor(process.uptime() / 60);
    const memMb = Math.round(process.memoryUsage().rss / (1024 * 1024));

    const overallOk =
      dbOk &&
      missingEnv.length === 0 &&
      invalidEnv.length === 0 &&
      missingChannels.length === 0 &&
      missingRoles.length === 0 &&
      hasPerms;

    const embed = brandEmbed({
      guild,
      color: overallOk ? THEME.colors.success : THEME.colors.warn,
      title: 'Health Check',
      description: [
        `${yn(overallOk)} **Status:** ${overallOk ? 'OK' : 'Needs attention'}`,
        `${yn(dbOk)} **Database:** ${dbOk ? 'OK' : 'ERROR'}`,
        `${yn(hasPerms)} **Bot permissions:** ${hasPerms ? 'OK' : 'Missing perms'}`,
        `**WS Ping:** ${isFinite(wsPing) ? `${wsPing}ms` : 'n/a'}`,
        `**Uptime:** ${uptimeMins} min`,
        `**Memory:** ${memMb} MB`,
      ].join('\n'),
    });

    if (missingEnv.length) embed.addFields({ name: 'Missing .env', value: missingEnv.map(k => `\`${k}\``).join('\n') });
    if (invalidEnv.length) embed.addFields({ name: 'Invalid IDs', value: invalidEnv.map(k => `\`${k}\``).join('\n') });
    if (missingChannels.length) embed.addFields({ name: 'Channels not found', value: missingChannels.map(s => `\`${s}\``).join('\n') });
    if (missingRoles.length) embed.addFields({ name: 'Roles not found', value: missingRoles.map(s => `\`${s}\``).join('\n') });

    if (!hasPerms) {
      const needed = new PermissionsBitField(requiredPerms).toArray().join(', ');
      embed.addFields({ name: 'Required perms', value: `\`${needed}\`` });
    }

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

