import db from '../database.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { shuffle } from '../utils.js';

const resolvedSos = new Map();

setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [key, ts] of resolvedSos) {
    if (ts < cutoff) resolvedSos.delete(key);
  }
}, 300_000);

export async function endGiveaway(client, giveaway, channel) {
  db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(giveaway.id);

  const entrants = db.prepare('SELECT DISTINCT user_id FROM giveaway_entrants WHERE giveaway_id = ?').all(giveaway.id);
  const winnerIds = shuffle(entrants).slice(0, giveaway.winners).map(e => e.user_id);

  const msg = channel.messages.cache.get(giveaway.message_id) ||
    await channel.messages.fetch(giveaway.message_id).catch(() => null);
  if (msg) {
    try {
      const disabledRow = ActionRowBuilder.from(msg.components[0]);
      disabledRow.components.forEach(b => b.setDisabled(true));
      await msg.edit({ components: [disabledRow] });
    } catch {}
  }

  if (giveaway.mode === 'split-or-steal' && winnerIds.length === 2) {
    return handleSplitOrSteal(client, giveaway, channel, winnerIds);
  }

  // Mark winners in DB for standard giveaways so they can be excluded during rerolls
  for (const winnerId of winnerIds) {
    db.prepare("UPDATE giveaway_entrants SET sos_choice = 'winner' WHERE giveaway_id = ? AND user_id = ?")
      .run(giveaway.id, winnerId);
  }

  if (winnerIds.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xE74C3C)
      .setTitle('Giveaway Ended')
      .setDescription(`**Prize:** ${giveaway.prize}\nNot enough entrants to draw a winner.`)
      .setTimestamp();
    return channel.send({ embeds: [embed] });
  }

  const embed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🎉 Giveaway Ended!')
    .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${winnerIds.map(id => `<@${id}>`).join(', ')}`)
    .setTimestamp();

  await channel.send({ embeds: [embed], content: winnerIds.map(id => `<@${id}>`).join(' '), allowedMentions: { parse: ['users'] } });
}

async function handleSplitOrSteal(client, giveaway, channel, winnerIds) {
  db.prepare("UPDATE giveaways SET sos_player1 = ?, sos_player2 = ? WHERE id = ?")
    .run(winnerIds[0], winnerIds[1], giveaway.id);

  const sosMinutes = giveaway.sos_time || 60;
  const channelEmbed = new EmbedBuilder()
    .setColor(0xF1C40F)
    .setTitle('🎲 Split or Steal!')
    .setDescription([
      `**Prize:** ${giveaway.prize}`,
      '',
      `**Player 1:** <@${winnerIds[0]}>`,
      `**Player 2:** <@${winnerIds[1]}>`,
      '',
      'Both players have been DM\'d with their choice.',
      `They have ${sosMinutes} minute${sosMinutes === 1 ? '' : 's'} to respond.`,
    ].join('\n'))
    .setTimestamp();

  await channel.send({ embeds: [channelEmbed] });

  for (const userId of winnerIds) {
    const dmEmbed = new EmbedBuilder()
      .setColor(0xF1C40F)
      .setTitle('🎲 Split or Steal')
      .setDescription([
        `You won **${giveaway.prize}** in ${channel.guild?.name || 'the server'}!`,
        '',
        'Choose your move:',
        '',
        '**🤝 Split** — Share the prize 50/50',
        '**💀 Steal** — Take the whole prize',
        '',
        'If both Split → 50/50',
        'If one Steals → Stealer gets everything',
        'If both Steal → both get nothing',
      ].join('\n'))
      .setFooter({ text: `Choose within ${sosMinutes} minute${sosMinutes === 1 ? '' : 's'}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`sos_split_${giveaway.id}_${userId}`).setLabel('🤝 Split').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`sos_steal_${giveaway.id}_${userId}`).setLabel('💀 Steal').setStyle(ButtonStyle.Danger),
    );

    const user = await client.users.fetch(userId).catch(() => null);
    if (user) {
      const dmMsg = await user.send({ embeds: [dmEmbed], components: [row] }).catch(() => null);
      if (dmMsg) {
        const col = userId === winnerIds[0] ? 'p1' : 'p2';
        db.prepare(`UPDATE giveaways SET sos_${col}_dm_cid = ?, sos_${col}_dm_mid = ? WHERE id = ?`)
          .run(dmMsg.channelId, dmMsg.id, giveaway.id);
      }
    }
  }

  const endTime = Date.now() + sosMinutes * 60 * 1000;
  const checkInterval = setInterval(async () => {
    const g = db.prepare('SELECT * FROM giveaways WHERE id = ?').get(giveaway.id);
    const choices = db.prepare(
      "SELECT user_id, sos_choice FROM giveaway_entrants WHERE giveaway_id = ? AND user_id IN (?, ?) AND sos_choice IS NOT NULL"
    ).all(giveaway.id, winnerIds[0], winnerIds[1]);

    if (choices.length === 2) {
      clearInterval(checkInterval);
      return resolveSos(client, g || giveaway, channel, winnerIds);
    }

    if (Date.now() >= endTime) {
      clearInterval(checkInterval);
      const responded = choices.map(c => c.user_id);
      const forfeitEmbed = new EmbedBuilder()
        .setColor(0xE74C3C)
        .setTitle("⏰ Time's Up!")
        .setDescription(
          responded.length === 0
            ? `Neither player responded in time. The prize **${giveaway.prize}** has been forfeited.`
            : `Not all players responded in time. The prize **${giveaway.prize}** has been forfeited.`
        )
        .setTimestamp();

      for (const uid of winnerIds) {
        const col = uid === winnerIds[0] ? 'p1' : 'p2';
        const cid = g ? g[`sos_${col}_dm_cid`] : null;
        const mid = g ? g[`sos_${col}_dm_mid`] : null;
        if (cid && mid) {
          const dmChan = await client.channels.fetch(cid).catch(() => null);
          if (dmChan) {
            const dmMsg = await dmChan.messages.fetch(mid).catch(() => null);
            if (dmMsg) await dmMsg.edit({ embeds: [forfeitEmbed], components: [] }).catch(() => {});
          }
        }
      }

      return channel.send({ embeds: [forfeitEmbed] }).catch(() => {});
    }
  }, 10_000);
}

export async function resolveSos(client, giveaway, channel, winnerIds) {
  const key = `${giveaway.id}_${[...winnerIds].sort().join('_')}`;
  if (resolvedSos.has(key)) return;
  resolvedSos.set(key, Date.now());

  const row1 = db.prepare("SELECT sos_choice FROM giveaway_entrants WHERE giveaway_id = ? AND user_id = ?").get(giveaway.id, winnerIds[0]);
  const row2 = db.prepare("SELECT sos_choice FROM giveaway_entrants WHERE giveaway_id = ? AND user_id = ?").get(giveaway.id, winnerIds[1]);

  const c1 = row1?.sos_choice;
  const c2 = row2?.sos_choice;
  if (!c1 || !c2) return;

  let resultText;
  let outcome;
  if (c1 === 'split' && c2 === 'split') {
    resultText = `🎉 **Both Split!**\nBoth players win **${giveaway.prize}** — split 50/50!`;
    outcome = 'both_split';
  } else if (c1 === 'steal' && c2 === 'steal') {
    resultText = `💀 **Both Steal!**\nBoth players get **nothing**!`;
    outcome = 'both_steal';
  } else if (c1 === 'steal') {
    resultText = `💀 **<@${winnerIds[0]}> Steals!**\nThey take the whole **${giveaway.prize}**!`;
    outcome = 'player1_steal';
  } else {
    resultText = `💀 **<@${winnerIds[1]}> Steals!**\nThey take the whole **${giveaway.prize}**!`;
    outcome = 'player2_steal';
  }

  const resultEmbed = new EmbedBuilder()
    .setColor(outcome === 'both_split' ? 0xF1C40F : 0xE74C3C)
    .setTitle('🎲 Split or Steal — Result!')
    .setDescription([
      `**Prize:** ${giveaway.prize}`,
      '',
      `<@${winnerIds[0]}> chose **${c1 === 'split' ? '🤝 Split' : '💀 Steal'}**`,
      `<@${winnerIds[1]}> chose **${c2 === 'split' ? '🤝 Split' : '💀 Steal'}**`,
      '',
      '━━━━',
      resultText,
    ].join('\n'))
    .setTimestamp();

  await channel.send({ content: `||<@${winnerIds[0]}>|| ||<@${winnerIds[1]}>||`, embeds: [resultEmbed], allowedMentions: { parse: ['users'] } });

  for (const uid of winnerIds) {
    const col = uid === winnerIds[0] ? 'p1' : 'p2';
    const cid = giveaway[`sos_${col}_dm_cid`];
    const mid = giveaway[`sos_${col}_dm_mid`];
    if (cid && mid) {
      try {
        const dmChan = await client.channels.fetch(cid);
        const dmMsg = await dmChan.messages.fetch(mid);
        await dmMsg.edit({ embeds: [resultEmbed], components: [] });
      } catch {}
    }
  }
}
