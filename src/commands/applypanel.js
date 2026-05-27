import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isMod } from '../utils.js';

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }
    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('Application Menu Apex')
      .setDescription([
        'Apply here to become a **Builder**, **Partner** or **Staff member**.',
        '',
        '• Must be 14+',
        '• **4 day cooldown** between applications',
      ].join('\n'))
      .setThumbnail('https://mc-heads.net/avatar/MHF_Steve/64')
      .setFooter({ text: 'Apex Building Service. | 250M GW NOW!' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('apply_builder').setLabel('Builder Apply').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('apply_staff').setLabel('Staff Apply').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('apply_partner').setLabel('Partner Apply').setStyle(ButtonStyle.Danger),
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    const replyEmbed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setDescription('Application panel sent.');
    await interaction.reply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });
  },
};
