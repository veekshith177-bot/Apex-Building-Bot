import { EmbedBuilder, MessageFlags } from 'discord.js';
import db from '../../database.js';
import { info, error as logError } from '../../logger.js';
import { resolveSos } from '../giveawayEnd.js';

const stmtBlacklist = db.prepare('SELECT * FROM blacklist WHERE user_id = ?');
const stmtGiveawayById = db.prepare("SELECT * FROM giveaways WHERE message_id = ? AND ended = 0");
const stmtGiveawayEntrant = db.prepare('SELECT id FROM giveaway_entrants WHERE giveaway_id = ? AND user_id = ?');
const stmtInsertEntrant = db.prepare('INSERT INTO giveaway_entrants (giveaway_id, user_id) VALUES (?, ?)');
const stmtEntrantCount = db.prepare('SELECT COUNT(*) as c FROM giveaway_entrants WHERE giveaway_id = ?');
const stmtSosChoice = db.prepare("SELECT sos_choice FROM giveaway_entrants WHERE giveaway_id = ? AND user_id = ?");
const stmtUpdateSos = db.prepare("UPDATE giveaway_entrants SET sos_choice = ? WHERE giveaway_id = ? AND user_id = ?");
const stmtGiveaway = db.prepare('SELECT * FROM giveaways WHERE id = ?');
const stmtAllChosen = db.prepare("SELECT COUNT(*) as c FROM giveaway_entrants WHERE giveaway_id = ? AND user_id IN (?, ?) AND sos_choice IS NOT NULL");

export async function handleGiveawayEnter(interaction) {
  if (stmtBlacklist.get(interaction.user.id)) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('You are blacklisted and cannot join giveaways.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const giveaway = stmtGiveawayById.get(interaction.message.id);
  if (!giveaway) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('This giveaway has ended.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (stmtGiveawayEntrant.get(giveaway.id, interaction.user.id)) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('You already entered this giveaway!');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  stmtInsertEntrant.run(giveaway.id, interaction.user.id);

  const msgEmbed = EmbedBuilder.from(interaction.message.embeds[0]);
  const count = stmtEntrantCount.get(giveaway.id).c;
  if (msgEmbed.data.description) {
    msgEmbed.data.description = msgEmbed.data.description.replace(/^\*\*Entries:\*\* \d+$/m, `**Entries:** ${count}`);
  }
  await interaction.message.edit({ embeds: [msgEmbed] }).catch(() => {});

  const replyEmbed = new EmbedBuilder().setColor(0xF1C40F).setDescription('You are in! Good luck.');
  await interaction.reply({ embeds: [replyEmbed], flags: MessageFlags.Ephemeral });
}

export async function handleSosChoice(client, interaction) {
  const parts = interaction.customId.split('_');
  const choice = parts[1];
  const giveawayId = parseInt(parts[2]);
  const userId = parts[3];

  if (interaction.user.id !== userId) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('This is not your choice to make.');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  const existing = stmtSosChoice.get(giveawayId, userId);
  if (existing?.sos_choice) {
    const embed = new EmbedBuilder().setColor(0xF1C40F).setDescription('You already made your choice!');
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  stmtUpdateSos.run(choice, giveawayId, userId);
  await interaction.update({ content: `You chose **${choice === 'split' ? '\u{1F91D} Split' : '\u{1F480} Steal'}**! Waiting for the other player...`, embeds: [], components: [] });

  const giveaway = stmtGiveaway.get(giveawayId);
  if (!giveaway || !giveaway.sos_player1 || !giveaway.sos_player2) return;

  const col = userId === giveaway.sos_player1 ? 'p1' : 'p2';
  const cid = giveaway[`sos_${col}_dm_cid`];
  const mid = giveaway[`sos_${col}_dm_mid`];
  if (cid && mid) {
    try {
      const dmChan = await client.channels.fetch(cid);
      const dmMsg = await dmChan.messages.fetch(mid);
      const waitingEmbed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTitle('\u{1F3B2} Split or Steal')
        .setDescription([`**Prize:** ${giveaway.prize}`, '', `You chose **${choice === 'split' ? '\u{1F91D} Split' : '\u{1F480} Steal'}**.`, '', 'Waiting for the other player to choose...'].join('\n'))
        .setFooter({ text: 'Split or Steal' })
        .setTimestamp();
      await dmMsg.edit({ embeds: [waitingEmbed], components: [] });
    } catch {}
  }

  const winnerIds = [giveaway.sos_player1, giveaway.sos_player2];
  const allChosen = stmtAllChosen.get(giveawayId, winnerIds[0], winnerIds[1]).c;
  if (allChosen === 2) {
    const channel = client.channels.cache.get(giveaway.channel_id);
    if (channel) await resolveSos(client, giveaway, channel, winnerIds);
  }
}
