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
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.editReply({ content: 'User is not in the server.' });
    }

    if (member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.editReply({ content: 'Cannot kick this user — they have a higher or equal role.' });
    }

    const dmEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 64 }) })
      .setTitle('Kicked')
      .setDescription([
        `You have been kicked from **${interaction.guild.name}**.`,
        '',
        `**Reason:** ${reason}`,
      ].join('\n'))
      .setFooter({ text: 'Moderation' })
      .setTimestamp();
    try { await user.send({ embeds: [dmEmbed] }); } catch {}

    try {
      await member.kick(reason);
    } catch {
      return interaction.editReply({ content: 'Failed to kick user.' });
    }

    logModAction(interaction.guild, 'Kick', interaction.member.id, user.id, reason);

    const embed = buildModEmbed('User Kicked', 0xE74C3C,
      `<@${user.id}> has been kicked.\n**Reason:** ${reason}`
    );
    await interaction.editReply({ embeds: [embed] });
  },
};
