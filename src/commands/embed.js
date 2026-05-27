import {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} from 'discord.js';
import { isMod } from '../utils.js';

function hexToInt(val) {
  if (val == null) return null;
  const str = String(val).replace(/^#/, '').replace(/^0x/, '');
  const n = parseInt(str, 16);
  if (isNaN(n) || n < 0 || n > 0xffffff) return null;
  return n;
}

function buildEmbed(data) {
  const embed = new EmbedBuilder();

  if (data.title) embed.setTitle(String(data.title).slice(0, 256));
  if (data.description) embed.setDescription(String(data.description).slice(0, 4096));
  if (data.url) embed.setURL(String(data.url));

  const color = typeof data.color === 'string' ? hexToInt(data.color) : data.color;
  if (typeof color === 'number' && color >= 0 && color <= 0xffffff) embed.setColor(color);

  if (data.timestamp) {
    const ts = new Date(data.timestamp);
    if (!isNaN(ts.getTime())) embed.setTimestamp(ts);
  }

  if (data.author && data.author.name) {
    embed.setAuthor({
      name: String(data.author.name).slice(0, 256),
      url: data.author.url ? String(data.author.url) : undefined,
      iconURL: (data.author.icon_url || data.author.iconURL) ? String(data.author.icon_url || data.author.iconURL) : undefined,
    });
  }

  if (data.footer && data.footer.text) {
    embed.setFooter({
      text: String(data.footer.text).slice(0, 2048),
      iconURL: (data.footer.icon_url || data.footer.iconURL) ? String(data.footer.icon_url || data.footer.iconURL) : undefined,
    });
  }

  if (data.image) {
    const url = data.image.url || data.image;
    if (typeof url === 'string') embed.setImage(url);
  }

  if (data.thumbnail && data.thumbnail.url) {
    embed.setThumbnail(data.thumbnail.url);
  }

  if (Array.isArray(data.fields)) {
    for (const f of data.fields.slice(0, 25)) {
      if (f.name && f.value) {
        embed.addFields({
          name: String(f.name).slice(0, 256),
          value: String(f.value).slice(0, 1024),
          inline: !!f.inline,
        });
      }
    }
  }

  return embed;
}

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'json') {
      const raw = interaction.options.getString('data');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        return interaction.reply({
          content: `**Invalid JSON** — ${e.message}\n\nBuild your embed JSON at https://discohook.org then paste it here.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return interaction.reply({ content: 'Embed data must be a JSON object `{}`.', flags: MessageFlags.Ephemeral });
      }

      try {
        const embed = buildEmbed(parsed);
        await interaction.reply({ embeds: [embed] });
      } catch (e) {
        return interaction.reply({
          content: `**Failed to build embed** — ${e.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId('embed_builder')
      .setTitle('Create Embed');

    const title = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('Title')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(256);

    const description = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description (supports Markdown)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000);

    const color = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Color (hex, e.g. F1C40F or #5865F2)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7);

    const footer = new TextInputBuilder()
      .setCustomId('footer')
      .setLabel('Footer text')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048);

    const imageUrl = new TextInputBuilder()
      .setCustomId('image')
      .setLabel('Image URL')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(2048);

    modal.addComponents(
      new ActionRowBuilder().addComponents(title),
      new ActionRowBuilder().addComponents(description),
      new ActionRowBuilder().addComponents(color),
      new ActionRowBuilder().addComponents(footer),
      new ActionRowBuilder().addComponents(imageUrl),
    );

    await interaction.showModal(modal);
  },
};
