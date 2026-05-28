import { MessageFlags } from 'discord.js';
import { brandEmbed } from './embeds.js';
import { THEME } from './theme.js';

async function safeSend(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.followUp(payload);
  }
  return interaction.reply(payload);
}

export function ok(interaction, content, { ephemeral = true } = {}) {
  const embed = brandEmbed({
    guild: interaction.guild,
    color: THEME.colors.success,
    description: content,
  });
  return safeSend(interaction, {
    embeds: [embed],
    flags: ephemeral ? MessageFlags.Ephemeral : undefined,
  });
}

export function fail(interaction, content, { ephemeral = true } = {}) {
  const embed = brandEmbed({
    guild: interaction.guild,
    color: THEME.colors.danger,
    description: content,
  });
  return safeSend(interaction, {
    embeds: [embed],
    flags: ephemeral ? MessageFlags.Ephemeral : undefined,
  });
}
