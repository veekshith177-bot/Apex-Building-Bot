import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isAdmin, parseDuration } from '../utils.js';
import { logModAction, buildModEmbed } from '../modutils.js';

export default {
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need to be admin+ to use this.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason specified';

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.editReply({ content: 'Invalid duration. Use format like `1h`, `7d`.' });
    }

    if (durationMs < 60000) {
      return interaction.editReply({ content: 'Tempban must be at least 1 minute.' });
    }

    const expiresAt = new Date(Date.now() + durationMs).toISOString();
    const member = interaction.guild.members.cache.get(user.id);

    if (member && member.roles.highest.position >= interaction.member.roles.highest.position) {
      return interaction.editReply({ content: 'Cannot ban this user — they have a higher or equal role.' });
    }

    const dmEmbed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 64 }) })
      .setTitle('Temporarily Banned')
      .setDescription([
        `You have been temporarily banned from **${interaction.guild.name}**.`,
        '',
        `**Duration:** ${durationStr}`,
        `**Reason:** ${reason}`,
      ].join('\n'))
      .setFooter({ text: 'Moderation' })
      .setTimestamp();
    try { await user.send({ embeds: [dmEmbed] }); } catch {}

    try {
      await interaction.guild.bans.create(user, { reason: `${reason} (temp: ${durationStr})` });
    } catch {
      return interaction.editReply({ content: 'Failed to tempban user.' });
    }

    db.prepare('INSERT INTO tempbans (user_id, reason, moderator_id, expires_at) VALUES (?, ?, ?, ?)')
      .run(user.id, reason, interaction.member.id, expiresAt);

    logModAction(interaction.guild, 'Tempban', interaction.member.id, user.id, `${reason} (${durationStr})`);

    const embed = buildModEmbed('User Tempbanned', 0xE74C3C,
      `<@${user.id}> has been temporarily banned.\n**Duration:** ${durationStr}\n**Reason:** ${reason}\n**Expires:** <t:${Math.floor(Date.now() / 1000 + durationMs / 1000)}:R>`
    );
    await interaction.editReply({ embeds: [embed] });
  },
};
