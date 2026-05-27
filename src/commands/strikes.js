import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { checkStrikes } from '../modutils.js';

export default {
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user;
    const strikes = checkStrikes(user.id);

    const recent = db.prepare('SELECT reason, created_at FROM warnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(user.id);

    const embed = new EmbedBuilder()
      .setColor(strikes >= 5 ? 0xE74C3C : strikes >= 3 ? 0xE67E22 : 0x3498DB)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL({ size: 64 }) })
      .setTitle('Strike Overview')
      .setDescription([
        `**Total Strikes:** \`${strikes}\``,
        '',
        strikes >= 5 ? 'Auto-ban threshold reached (5 strikes)' :
        strikes >= 3 ? 'Auto-mute threshold reached (3 strikes)' :
        'Within safe limits.',
      ].join('\n'));

    if (recent.length) {
      embed.addFields({
        name: `Recent Warnings (last ${recent.length} of ${strikes})`,
        value: recent.map((w, i) =>
          `\`#${i + 1}\` **${w.reason}** - <t:${Math.floor(new Date(w.created_at).getTime() / 1000)}:R>`
        ).join('\n'),
      });
    } else {
      embed.addFields({ name: 'Recent Warnings', value: 'No warnings recorded.' });
    }

    embed.setFooter({ text: 'Moderation' }).setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
