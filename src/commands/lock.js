import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import { isAdmin, isStaff } from '../utils.js';
import { logModAction, buildModEmbed } from '../modutils.js';

export default {
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need to be admin+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;

    for (const [id, overwrite] of channel.permissionOverwrites.cache) {
      const role = interaction.guild.roles.cache.get(id);
      if (!role || role.name === '@everyone') continue;
      if (overwrite.allow.has(PermissionFlagsBits.SendMessages)) {
        const isStaffRole = id === process.env.STAFF_ROLE_ID ||
                            id === process.env.MOD_ROLE_ID ||
                            id === process.env.ADMIN_ROLE_ID ||
                            id === process.env.MANAGER_ROLE_ID;
        if (isStaffRole) continue;
        await overwrite.edit({ SendMessages: false }).catch(() => {});
      }
    }

    await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
      SendMessages: false,
    });

    logModAction(interaction.guild, 'Lock', interaction.member.id, channel.id, `#${channel.name}`);

    const embed = buildModEmbed('Channel Locked', 0x95A5A6,
      `${channel} has been locked. Only staff can send messages.`
    );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
