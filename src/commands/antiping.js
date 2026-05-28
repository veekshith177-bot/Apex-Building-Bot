import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isMod } from '../utils.js';
import { antipingEnabled, setAntipingEnabled, refreshProtectedPings } from '../cache.js';
import { THEME } from '../ui/theme.js';

const stmtUpsertProtected = db.prepare('INSERT OR REPLACE INTO protected_pings (target_id, target_type, added_by) VALUES (?, ?, ?)');
const stmtDeleteProtected = db.prepare('DELETE FROM protected_pings WHERE target_id = ?');
const stmtListProtected = db.prepare('SELECT * FROM protected_pings ORDER BY added_at DESC');

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'on') {
      if (antipingEnabled) {
        return interaction.reply({ content: 'Anti-ping is already **enabled**.', flags: MessageFlags.Ephemeral });
      }
      setAntipingEnabled(db, true);
      const embed = new EmbedBuilder()
        .setColor(THEME.colors.success)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Anti-Ping Enabled')
        .setDescription('The anti-ping system is now **active**. Pinging protected users, roles, @everyone, and staff will be blocked.')
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'off') {
      if (!antipingEnabled) {
        return interaction.reply({ content: 'Anti-ping is already **disabled**.', flags: MessageFlags.Ephemeral });
      }
      setAntipingEnabled(db, false);
      const embed = new EmbedBuilder()
        .setColor(THEME.colors.danger)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Anti-Ping Disabled')
        .setDescription('The anti-ping system is now **disabled**. Pings will no longer be blocked.')
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      const target = user || role;
      const type = user ? 'user' : 'role';
      if (!target) return interaction.reply({ content: 'Specify a user or role.', flags: MessageFlags.Ephemeral });

      stmtUpsertProtected.run(target.id, type, interaction.member.id);
      refreshProtectedPings(db);

      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Anti-Ping Protected')
        .setDescription(`${type === 'user' ? `<@${target.id}>` : `<@&${target.id}>`} is now protected. Pinging them will be blocked.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');
      const target = user || role;
      if (!target) return interaction.reply({ content: 'Specify a user or role.', flags: MessageFlags.Ephemeral });

      stmtDeleteProtected.run(target.id);
      refreshProtectedPings(db);
      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Anti-Ping Updated')
        .setDescription(`Removed ${target} from the protected list.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const rows = stmtListProtected.all();
      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Protected Ping Targets')
        .setTimestamp();
      if (!rows.length) {
        embed.setDescription('No protected targets configured.');
      } else {
        embed.setDescription(rows.map(r => `${r.target_type === 'user' ? '👤' : '🛡️'} <@${r.target_type === 'role' ? '&' : ''}${r.target_id}>`).join('\n'));
      }
      return interaction.reply({ embeds: [embed] });
    }
  },
};
