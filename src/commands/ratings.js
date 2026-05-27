import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';

const stmtBuilderStats = db.prepare(`
  SELECT
    COUNT(*) AS total_ratings,
    SUM(stars) AS total_points,
    ROUND(AVG(stars), 1) AS avg_rating
  FROM reputation
  WHERE target_id = ?
`);
const stmtRecentReviews = db.prepare(`
  SELECT r.stars, r.feedback, r.created_at, r.rater_id, t.type AS ticket_type
  FROM reputation r
  LEFT JOIN tickets t ON t.id = r.ticket_id
  WHERE r.target_id = ?
  ORDER BY r.created_at DESC
  LIMIT 5
`);
const stmtBuilderLeaderboard = db.prepare(`
  SELECT
    target_id,
    COUNT(*) AS total_ratings,
    SUM(stars) AS total_points,
    ROUND(AVG(stars), 1) AS avg_rating
  FROM reputation
  GROUP BY target_id
  ORDER BY total_points DESC, avg_rating DESC
  LIMIT 10
`);

const stmtStaffStats = db.prepare(`
  SELECT
    COUNT(*) AS total_ratings,
    SUM(stars) AS total_points,
    ROUND(AVG(stars), 1) AS avg_rating
  FROM ratings
  WHERE target_id = ? AND target_id IS NOT NULL
`);
const stmtStaffRecent = db.prepare(`
  SELECT r.stars, r.feedback, r.created_at, r.user_id AS rater_id, t.type AS ticket_type
  FROM ratings r
  LEFT JOIN tickets t ON t.id = r.ticket_id
  WHERE r.target_id = ?
  ORDER BY r.created_at DESC
  LIMIT 5
`);
const stmtStaffLeaderboard = db.prepare(`
  SELECT
    target_id,
    COUNT(*) AS total_ratings,
    SUM(stars) AS total_points,
    ROUND(AVG(stars), 1) AS avg_rating
  FROM ratings
  WHERE target_id IS NOT NULL
  GROUP BY target_id
  ORDER BY total_points DESC, avg_rating DESC
  LIMIT 10
`);

function starBar(stars, total = 5) {
  return '\u2605'.repeat(stars) + '\u2606'.repeat(total - stars);
}

export default {
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'builder') {
      const target = interaction.options.getUser('user') || interaction.user;
      const stats = stmtBuilderStats.get(target.id);

      if (!stats || stats.total_ratings === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('\u{1F3D7}\uFE0F Builder Ratings')
          .setDescription(`${target.id === interaction.user.id ? 'You have' : `**${target.tag}** has`} no ratings yet.`)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      const avg = stats.avg_rating || 0;
      const color = avg >= 4 ? 0x2ECC71 : avg >= 3 ? 0xF1C40F : 0xE74C3C;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL({ size: 64 }) })
        .setTitle('\u{1F3D7}\uFE0F Builder Rating')
        .addFields(
          { name: 'Total Points', value: `**${stats.total_points}**`, inline: true },
          { name: 'Avg Rating', value: `${avg}/5 ${starBar(Math.round(avg))}`, inline: true },
          { name: 'Ratings Received', value: `**${stats.total_ratings}**`, inline: true },
        )
        .setTimestamp();

      const reviews = stmtRecentReviews.all(target.id);
      if (reviews.length > 0) {
        const recent = reviews.map(r =>
          `${starBar(r.stars)} — <@${r.rater_id}>${r.feedback ? `\n> ${r.feedback}` : ''}${r.ticket_type ? `\n\u{2139}\uFE0F ${r.ticket_type} ticket` : ''}`
        ).join('\n\n');
        embed.addFields({ name: '\u{1F4DD} Recent Reviews', value: recent.slice(0, 1024), inline: false });
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'staff') {
      const target = interaction.options.getUser('user') || interaction.user;
      const stats = stmtStaffStats.get(target.id);

      if (!stats || stats.total_ratings === 0) {
        const embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('\u2B50 Staff Ratings')
          .setDescription(`${target.id === interaction.user.id ? 'You have' : `**${target.tag}** has`} no staff ratings yet.`)
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      const avg = stats.avg_rating || 0;
      const color = avg >= 4 ? 0x2ECC71 : avg >= 3 ? 0xF1C40F : 0xE74C3C;

      const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL({ size: 64 }) })
        .setTitle('\u2B50 Staff Rating')
        .addFields(
          { name: 'Total Points', value: `**${stats.total_points}**`, inline: true },
          { name: 'Avg Rating', value: `${avg}/5 ${starBar(Math.round(avg))}`, inline: true },
          { name: 'Ratings Received', value: `**${stats.total_ratings}**`, inline: true },
        )
        .setTimestamp();

      const reviews = stmtStaffRecent.all(target.id);
      if (reviews.length > 0) {
        const recent = reviews.map(r =>
          `${starBar(r.stars)} — <@${r.rater_id}>${r.feedback ? `\n> ${r.feedback}` : ''}${r.ticket_type ? `\n\u{2139}\uFE0F ${r.ticket_type} ticket` : ''}`
        ).join('\n\n');
        embed.addFields({ name: '\u{1F4DD} Recent Reviews', value: recent.slice(0, 1024), inline: false });
      }

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'leaderboard') {
      const type = interaction.options.getString('type') || 'builder';

      if (type === 'staff') {
        const rows = stmtStaffLeaderboard.all();
        if (!rows.length) {
          const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('\u{1F3C6} Staff Leaderboard')
            .setDescription('No staff ratings recorded yet.')
            .setTimestamp();
          return interaction.reply({ embeds: [embed] });
        }

        const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
        const lines = rows.map((r, i) => {
          const prefix = medals[i] || `**#${i + 1}**`;
          return `${prefix} <@${r.target_id}> \u2014 **${r.total_points} pts** (${r.avg_rating}/5 \u2022 ${r.total_ratings} ratings)`;
        });

        const embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('\u{1F3C6} Staff Leaderboard')
          .setDescription(lines.join('\n'))
          .setFooter({ text: 'Sorted by total points' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      const rows = stmtBuilderLeaderboard.all();
      if (!rows.length) {
        const embed = new EmbedBuilder()
          .setColor(0xF1C40F)
          .setTitle('\u{1F3C6} Builder Leaderboard')
          .setDescription('No ratings recorded yet.')
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });
      }

      const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
      const lines = rows.map((r, i) => {
        const prefix = medals[i] || `**#${i + 1}**`;
        return `${prefix} <@${r.target_id}> \u2014 **${r.total_points} pts** (${r.avg_rating}/5 \u2022 ${r.total_ratings} ratings)`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('\u{1F3C6} Builder Leaderboard')
        .setDescription(lines.join('\n'))
        .setFooter({ text: 'Sorted by total points' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  },
};
