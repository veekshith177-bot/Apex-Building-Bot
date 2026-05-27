import { EmbedBuilder, MessageFlags } from 'discord.js';
import { isMod } from '../utils.js';
import { logModAction, buildModEmbed } from '../modutils.js';

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const amount = interaction.options.getInteger('amount');
    const targetUser = interaction.options.getUser('user');
    const channel = interaction.channel;

    if (amount < 1 || amount > 100) {
      return interaction.editReply({ content: 'Amount must be between 1 and 100.' });
    }

    let messages = await channel.messages.fetch({ limit: Math.min(amount * 2, 200) });
    if (targetUser) {
      messages = messages.filter(m => m.author.id === targetUser.id).first(amount);
    } else {
      messages = messages.first(amount);
    }

    if (messages.length < 1) {
      return interaction.editReply({ content: 'No messages to delete.' });
    }

    const transcript = messages.map(m =>
      `${m.author.tag} (${m.author.id}): ${m.content || '[embed/sticker]'}`
    ).reverse().join('\n');

    const deleted = await channel.bulkDelete(messages, true).catch(() => null);
    if (!deleted) {
      return interaction.editReply({ content: 'Failed to delete messages. Messages older than 14 days cannot be bulk deleted.' });
    }

    logModAction(interaction.guild, 'Purge', interaction.member.id, channel.id, `${deleted.size} messages`);

    const embed = buildModEmbed('Messages Purged', 0x3498DB,
      `Deleted **${deleted.size}** message${deleted.size !== 1 ? 's' : ''} in ${channel}${targetUser ? ` from ${targetUser}` : ''}.`
    );
    await interaction.editReply({ embeds: [embed] });

    const logChan = interaction.guild.channels.cache.get(process.env.ACTION_LOGS_CHANNEL_ID);
    if (logChan && transcript.length <= 1024) {
      const logEmbed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle(`Purge Transcript — ${deleted.size} messages`)
        .setDescription(`**Channel:** ${channel}\n**Moderator:** ${interaction.member}${targetUser ? `\n**Target:** ${targetUser}` : ''}`)
        .addFields({ name: 'Deleted Messages', value: `\`\`\`\n${transcript}\n\`\`\`` })
        .setTimestamp();
      await logChan.send({ embeds: [logEmbed] }).catch(() => {});
    } else if (logChan) {
      const buf = Buffer.from(transcript, 'utf-8');
      await logChan.send({
        content: `**Purge Transcript — ${deleted.size} messages in ${channel.name}**`,
        files: [{ attachment: buf, name: `purge-${channel.name}-${Date.now()}.txt` }],
      }).catch(() => {});
    }
  },
};
