import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export default {
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('suggestion_modal')
      .setTitle('Submit a Suggestion');

    const content = new TextInputBuilder()
      .setCustomId('suggestion_content')
      .setLabel('Your suggestion')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000)
      .setPlaceholder('Describe your suggestion in detail...');

    modal.addComponents(new ActionRowBuilder().addComponents(content));
    await interaction.showModal(modal);
  },
};
