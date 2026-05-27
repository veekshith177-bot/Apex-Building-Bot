import { MessageFlags } from 'discord.js';
import { isMod } from '../utils.js';
import { logModAction, buildModEmbed } from '../modutils.js';

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const seconds = interaction.options.getInteger('seconds');
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    if (seconds < 0 || seconds > 21600) {
      return interaction.reply({ content: 'Slowmode must be between 0 and 21600 seconds (6 hours).', flags: MessageFlags.Ephemeral });
    }

    await channel.setRateLimitPerUser(seconds);
    logModAction(interaction.guild, 'Slowmode', interaction.member.id, channel.id, `${seconds}s in #${channel.name}`);

    const label = seconds === 0 ? 'disabled' : `${seconds}s`;
    const embed = buildModEmbed('Slowmode Updated', 0x1ABC9C,
      `Slowmode set to **${label}** in ${channel}.`
    );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
