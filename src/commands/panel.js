import { EmbedBuilder, MessageFlags } from 'discord.js';
import { buildPanel } from '../panels.js';
import { isMod } from '../utils.js';

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();
    const panel = buildPanel(sub, interaction.client);
    if (!panel) return interaction.reply({ content: 'Invalid panel.', flags: MessageFlags.Ephemeral });

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    await channel.send({ embeds: [panel.embed], components: panel.components });
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setDescription(`Panel sent to ${channel}.`);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
