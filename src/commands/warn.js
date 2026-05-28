import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isAdmin } from '../utils.js';
import { logModAction, checkStrikes, autoPunish, buildModEmbed } from '../modutils.js';
import { THEME } from '../ui/theme.js';

const stmtInsertWarning = db.prepare('INSERT INTO warnings (user_id, moderator_id, reason) VALUES (?, ?, ?)');

export default {
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ content: 'You need to be admin+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason specified';

    stmtInsertWarning.run(user.id, interaction.member.id, reason);

    const strikes = checkStrikes(user.id);

    const dmEmbed = new EmbedBuilder()
      .setColor(0xF39C12)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 64 }) })
      .setTitle('Warning Notice')
      .setDescription([
        `You received a warning in **${interaction.guild.name}**.`,
        '',
        `**Reason:** ${reason}`,
        `**Strikes:** ${strikes}`,
      ].join('\n'))
      .setFooter({ text: `${THEME.brandName} • Moderation` })
      .setTimestamp();
    try {
      await user.send({ embeds: [dmEmbed] }).catch(() => {});
    } catch {}

    logModAction(interaction.guild, 'Warn', interaction.member.id, user.id, reason);
    autoPunish(interaction.guild, user.id);

    const replyEmbed = buildModEmbed('Warning Issued', 0xF39C12,
      `<@${user.id}> has been warned.\n**Reason:** ${reason}\n**Strikes:** ${strikes}`
    );
    await interaction.reply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });
  },
};
