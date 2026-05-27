import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { afkCache } from '../cache.js';

export default {
  async execute(interaction) {
    const reason = interaction.options.getString('reason') || 'AFK';

    db.prepare('INSERT OR REPLACE INTO afk (user_id, reason, since) VALUES (?, ?, ?)')
      .run(interaction.user.id, reason, Date.now());
    afkCache.set(interaction.user.id, { reason, since: Date.now() });

    try {
      const nick = interaction.member.displayName;
      if (!nick.startsWith('[AFK] ')) {
        await interaction.member.setNickname(`[AFK] ${nick}`).catch(() => {});
      }
    } catch {}

    const embed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('AFK')
      .setDescription(`You are now AFK.\n**Reason:** ${reason}\n\nYou will be marked back when you send a message.`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
