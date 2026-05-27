import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { isMod } from '../utils.js';

const MESSAGE_LINK_RE = /^https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/;

export default {
  async execute(interaction) {
    if (!isMod(interaction.member)) {
      return interaction.reply({ content: 'You need to be mod+ to use this.', flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();
    const link = interaction.options.getString('message_link');

    const match = link?.match(MESSAGE_LINK_RE);
    if (!match) {
      return interaction.reply({ content: 'Invalid Discord message link. Right-click a message → Copy Message Link, then paste it here.', flags: MessageFlags.Ephemeral });
    }

    const channelId = match[2];
    const messageId = match[3];
    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel) {
      return interaction.reply({ content: 'Channel not found in this server.', flags: MessageFlags.Ephemeral });
    }

    if (sub === 'add') {
      const emoji = interaction.options.getString('emoji');
      const role = interaction.options.getRole('role');

      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (!msg) {
        return interaction.reply({ content: 'Message not found in that channel.', flags: MessageFlags.Ephemeral });
      }

      db.prepare('INSERT OR REPLACE INTO reaction_roles (message_id, channel_id, emoji, role_id) VALUES (?, ?, ?, ?)')
        .run(messageId, channel.id, emoji, role.id);

      try {
        await msg.react(emoji);
      } catch {
        return interaction.reply({ content: 'Failed to add reaction. Make sure the emoji is valid and I can see the message.', flags: MessageFlags.Ephemeral });
      }

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`Reaction role set: ${emoji} on ${channel} → ${role}`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'remove') {
      const emoji = interaction.options.getString('emoji');

      db.prepare('DELETE FROM reaction_roles WHERE message_id = ? AND emoji = ?').run(messageId, emoji);

      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (msg) {
        const reactions = msg.reactions.cache.find(r => r.emoji.toString() === emoji || r.emoji.name === emoji);
        if (reactions) await reactions.remove().catch(() => {});
      }

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setDescription(`Removed reaction role for ${emoji}.`);
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  },
};
