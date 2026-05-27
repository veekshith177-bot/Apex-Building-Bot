import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isHelper, parseDuration } from '../utils.js';
import { logModAction, buildModEmbed } from '../modutils.js';

const stmtInsertMute = db.prepare('INSERT OR REPLACE INTO mutes (user_id, reason, moderator_id, expires_at) VALUES (?, ?, ?, ?)');

export default {
  async execute(interaction) {
    if (!isHelper(interaction.member)) {
      return interaction.reply({ content: 'You need to be helper+ to use this.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const durationStr = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason specified';
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.editReply({ content: 'User not in server.' });
    }

    const durationMs = parseDuration(durationStr);
    if (!durationMs) {
      return interaction.editReply({ content: 'Invalid duration. Use format like `1h`, `30m`, `7d`.' });
    }

    const expiresAt = new Date(Date.now() + durationMs).toISOString();

    const dmEmbed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 64 }) })
      .setTitle('Muted')
      .setDescription([
        `You have been muted in **${interaction.guild.name}**.`,
        '',
        `**Duration:** ${durationStr}`,
        `**Reason:** ${reason}`,
      ].join('\n'))
      .setFooter({ text: 'Moderation' })
      .setTimestamp();
    try { await user.send({ embeds: [dmEmbed] }); } catch {}

    try {
      await member.timeout(durationMs, reason);
    } catch {
      return interaction.editReply({ content: 'Failed to mute. Make sure the bot role is above the user.' });
    }

    stmtInsertMute.run(user.id, reason, interaction.member.id, expiresAt);

    logModAction(interaction.guild, 'Mute', interaction.member.id, user.id, `${reason} (${durationStr})`);

    const embed = buildModEmbed('User Muted', 0xE67E22,
      `<@${user.id}> has been muted.\n**Duration:** ${durationStr}\n**Reason:** ${reason}`
    );
    await interaction.editReply({ embeds: [embed] });
  },
};
