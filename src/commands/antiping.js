import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isMod } from '../utils.js';
import { antipingEnabled, setAntipingEnabled } from '../cache.js';

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
        .setColor(0x2ECC71)
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
        .setColor(0xE74C3C)
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

      db.prepare('INSERT OR REPLACE INTO protected_pings (target_id, target_type, added_by) VALUES (?, ?, ?)').run(target.id, type, interaction.member.id);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
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

      db.prepare('DELETE FROM protected_pings WHERE target_id = ?').run(target.id);
      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`Removed ${target} from the protected list.`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const rows = db.prepare('SELECT * FROM protected_pings ORDER BY added_at DESC').all();
      const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('Protected Ping Targets');
      if (!rows.length) {
        embed.setDescription('No protected targets configured.');
      } else {
        embed.setDescription(rows.map(r => `${r.target_type === 'user' ? '👤' : '🛡️'} <@${r.target_type === 'role' ? '&' : ''}${r.target_id}>`).join('\n'));
      }
      return interaction.reply({ embeds: [embed] });
    }
  },
};
