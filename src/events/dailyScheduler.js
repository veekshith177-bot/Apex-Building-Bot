import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';
import { error as logError } from '../logger.js';
import { THEME } from '../ui/theme.js';

const stmtActiveConfig = db.prepare('SELECT * FROM daily_config WHERE id = 1 AND active = 1');
const stmtAnyActiveDaily = db.prepare("SELECT id FROM giveaways WHERE mode = 'daily' AND ended = 0");
const stmtInsertDaily = db.prepare('INSERT INTO giveaways (message_id, channel_id, prize, winners, ends_at, hosted_by, mode) VALUES (?, ?, ?, ?, ?, ?, ?)');

export default function (client) {
  setInterval(async () => {
    try {
      const config = stmtActiveConfig.get();
      if (!config) return;

      const active = stmtAnyActiveDaily.get();
      if (active) return;

      const channel = await client.channels.fetch(config.channel_id).catch(() => null);
      if (!channel) return;

      const prize = config.prize;
      const endsAt = new Date(Date.now() + 86_400_000);

      const embed = new EmbedBuilder()
        .setColor(THEME.colors.warn)
        .setTitle('🎉 Daily Giveaway')
        .setDescription([
          `**Prize:** ${prize}`,
          `**Winners:** 2`,
          `**Hosted by:** Auto`,
          `**Entries:** 0`,
          '',
          `Ends: <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
          '',
          'Hit the button to enter!',
        ].join('\n'))
        .setImage(process.env.PANEL_BANNER_URL)
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('giveaway_enter').setLabel('Enter').setStyle(ButtonStyle.Success).setEmoji('🎉'),
      );

      const pingRole = process.env.GIVEAWAY_PING_ROLE_ID;
      const content = pingRole ? `<@&${pingRole}>` : '';
      const msg = await channel.send({ content, embeds: [embed], components: [row], allowedMentions: { parse: ['roles'] } });

      stmtInsertDaily.run(msg.id, channel.id, prize, 2, endsAt.toISOString(), client.user.id, 'daily');
    } catch (e) {
      logError('Daily scheduler error:', e.message);
    }
  }, 60_000);
}
