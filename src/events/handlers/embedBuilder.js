import { EmbedBuilder, MessageFlags } from 'discord.js';
import { info } from '../../logger.js';

export async function handleEmbedBuilder(client, interaction) {
  const title = interaction.fields.getTextInputValue('title') || null;
  const description = interaction.fields.getTextInputValue('description');
  const colorInput = interaction.fields.getTextInputValue('color').replace('#', '');
  const footer = interaction.fields.getTextInputValue('footer') || null;
  const image = interaction.fields.getTextInputValue('image') || null;

  let color = 0xF1C40F;
  if (colorInput) {
    const parsed = parseInt(colorInput, 16);
    if (!isNaN(parsed)) color = parsed;
  }

  const embed = new EmbedBuilder()
    .setColor(color)
    .setDescription(description);

  if (title) embed.setTitle(title);
  if (footer) embed.setFooter({ text: footer });
  if (image) {
    try { embed.setImage(image); } catch {}
  }

  await interaction.reply({ embeds: [embed] });
  info(`Embed created by ${interaction.user.tag}`);
}
