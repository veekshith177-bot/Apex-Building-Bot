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

    const dmEmbed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 64 }) })
      .setTitle('Softbanned')
      .setDescription([
        `You have been softbanned in **${interaction.guild.name}**.`,
        '',
        `**Reason:** ${reason}`,
        'Your messages from the last 24h have been cleared.',
      ].join('\n'))
      .setFooter({ text: 'Moderation' })
      .setTimestamp();
    try { await user.send({ embeds: [dmEmbed] }); } catch {}

    try {
      await interaction.guild.bans.create(user, { reason, deleteMessageSeconds: 86400 });
    } catch {
      return interaction.editReply({ content: 'Failed to softban user.' });
    }

    await interaction.guild.bans.remove(user, 'Softban completed').catch(() => {});

    logModAction(interaction.guild, 'Softban', interaction.member.id, user.id, reason);

    const embed = buildModEmbed('User Softbanned', 0xF1C40F,
      `<@${user.id}> has been softbanned.\n**Reason:** ${reason}\nMessages from the last 24h have been cleared.`
    );
    await interaction.editReply({ embeds: [embed] });
  },
};
