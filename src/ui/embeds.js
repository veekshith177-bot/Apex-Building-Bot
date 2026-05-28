import { EmbedBuilder } from 'discord.js';
import { THEME, clampColor } from './theme.js';

export function brandEmbed({ guild, color, title, description } = {}) {
  const embed = new EmbedBuilder()
    .setColor(clampColor(color, THEME.brandColor))
    .setTimestamp();

  const guildName = guild?.name;
  const guildIcon = guild?.iconURL?.({ size: 64 }) || undefined;
  if (guildName) embed.setAuthor({ name: THEME.brandName, iconURL: guildIcon });
  else embed.setAuthor({ name: THEME.brandName });

  if (title) embed.setTitle(String(title).slice(0, 256));
  if (description) embed.setDescription(String(description).slice(0, 4096));

  return embed;
}

