import { EmbedBuilder, MessageFlags } from 'discord.js';
import { isAdmin } from '../utils.js';
import { logModAction, buildModEmbed } from '../modutils.js';

export default {
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need to be admin+ to use this.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const deleteDays = interaction.options.getInteger('delete_days') || 0;
    const member = interaction.guild.members.cache.get(user.id);

    if (member && member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.editReply({ content: 'Cannot ban this user — they have a higher or equal role.' });
    }

    const dmEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 64 }) })
      .setTitle('Banned')
      .setDescription([
        `You have been banned from **${interaction.guild.name}**.`,
        '',
        `**Reason:** ${reason}`,
      ].join('\n'))
      .setFooter({ text: 'Moderation' })
      .setTimestamp();
    try { await user.send({ embeds: [dmEmbed] }); } catch {}

    try {
      await interaction.guild.members.ban(user, { reason, deleteMessageSeconds: deleteDays * 86400 });
    } catch {
      return interaction.editReply({ content: 'Failed to ban user.' });
    }

    logModAction(interaction.guild, 'Ban', interaction.member.id, user.id, `${reason} (deleted ${deleteDays}d of messages)`);

    const embed = buildModEmbed('User Banned', 0xE74C3C,
      `<@${user.id}> has been banned.\n**Reason:** ${reason}\n**Messages deleted:** ${deleteDays}d`
    );
    await interaction.editReply({ embeds: [embed] });
  },
};
