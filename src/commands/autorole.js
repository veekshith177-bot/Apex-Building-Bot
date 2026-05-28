import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isMod } from '../utils.js';
import { THEME } from '../ui/theme.js';

const stmtInsertAutoRole = db.prepare('INSERT INTO auto_roles (role_id, delay_minutes) VALUES (?, ?)');
const stmtDeleteAutoRole = db.prepare('DELETE FROM auto_roles WHERE role_id = ?');
const stmtListAutoRoles = db.prepare('SELECT * FROM auto_roles ORDER BY delay_minutes ASC');

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const role = interaction.options.getRole('role');
      const delay = interaction.options.getInteger('delay') || 0;

      stmtInsertAutoRole.run(role.id, delay);

      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Auto-Role Added')
        .setDescription(`${role} will be given after **${delay} minute${delay !== 1 ? 's' : ''}**.`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'remove') {
      const role = interaction.options.getRole('role');
      stmtDeleteAutoRole.run(role.id);

      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Auto-Role Removed')
        .setDescription(`${role} will no longer be given on join.`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'list') {
      const rows = stmtListAutoRoles.all();
      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setAuthor({ name: THEME.brandName, iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
        .setTitle('Auto-Roles')
        .setTimestamp();
      if (!rows.length) {
        embed.setDescription('No auto-roles set up yet.\nUse `/autorole add <role>` to add one.');
      } else {
        embed.setDescription(rows.map(r => `<@&${r.role_id}> — after ${r.delay_minutes} min`).join('\n'));
      }
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
