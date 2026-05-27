import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isHelper } from '../utils.js';
import { logModAction, buildModEmbed } from '../modutils.js';

const stmtDeleteMute = db.prepare('DELETE FROM mutes WHERE user_id = ?');

export default {
  async execute(interaction) {
    if (!isHelper(interaction.member)) {
      return interaction.reply({ content: 'You need to be helper+ to use this.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('user');
    const member = interaction.guild.members.cache.get(user.id);

    if (!member) {
      return interaction.editReply({ content: 'User not in server.' });
    }

    try {
      await member.timeout(null);
    } catch {
      return interaction.editReply({ content: 'Failed to unmute. Make sure the bot role is above the user.' });
    }

    stmtDeleteMute.run(user.id);

    const dmEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL({ size: 64 }) })
      .setTitle('Unmuted')
      .setDescription(`You have been unmuted in **${interaction.guild.name}**.`)
      .setTimestamp();
    try { await user.send({ embeds: [dmEmbed] }); } catch {}

    logModAction(interaction.guild, 'Unmute', interaction.member.id, user.id, '');

    const embed = buildModEmbed('User Unmuted', 0x2ECC71, `<@${user.id}> has been unmuted.`);
    await interaction.editReply({ embeds: [embed] });
  },
};
