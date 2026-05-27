import { EmbedBuilder, MessageFlags } from 'discord.js';

export async function handleSpawnerPingToggle(interaction) {
  const roleId = process.env.SPAWNER_PING_ROLE_ID;
  if (!roleId) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Ping role not configured.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const member = interaction.member;
  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Ping role not found.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const hasRole = member.roles.cache.has(roleId);
  try {
    if (hasRole) {
      await member.roles.remove(roleId);
      const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('You will no longer be pinged for spawner restocks.');
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    } else {
      await member.roles.add(roleId);
      const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('You will now be pinged for spawner restocks!');
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  } catch {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('Failed to toggle role. Make sure the bot has "Manage Roles" permission and the role is below my highest role.');
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
