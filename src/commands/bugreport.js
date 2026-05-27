import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

export default {
  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('bugreport_modal')
      .setTitle('Report a Bug');

    const description = new TextInputBuilder()
      .setCustomId('bug_description')
      .setLabel('What happened?')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000)
      .setPlaceholder('Describe the bug you encountered...');

    const steps = new TextInputBuilder()
      .setCustomId('bug_steps')
      .setLabel('Steps to reproduce')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(2000)
      .setPlaceholder('1. Go to...\n2. Type...\n3. See error');

    modal.addComponents(
      new ActionRowBuilder().addComponents(description),
      new ActionRowBuilder().addComponents(steps),
    );

    await interaction.showModal(modal);
  },
};
