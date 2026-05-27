import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import db from '../database.js';
import { info } from '../logger.js';

export default {
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'apply') return handleApply(interaction);
    if (sub === 'remove') return handleRemove(interaction);
  },
};

async function handleApply(interaction) {
  const active = db.prepare('SELECT * FROM active_loas WHERE user_id = ?').get(interaction.user.id);
  if (active) {
    return interaction.reply({ content: 'You already have an active LOA.', flags: MessageFlags.Ephemeral });
  }

  const pending = db.prepare("SELECT * FROM loa_requests WHERE user_id = ? AND status = 'pending'").get(interaction.user.id);
  if (pending) {
    return interaction.reply({ content: 'You already have a pending LOA request.', flags: MessageFlags.Ephemeral });
  }

  const modal = new ModalBuilder()
    .setCustomId('loa_apply')
    .setTitle('LOA Request');

  const rankInput = new TextInputBuilder()
    .setCustomId('rank')
    .setLabel('Your Rank')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const startInput = new TextInputBuilder()
    .setCustomId('start')
    .setLabel('Start Date')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('e.g. 2026-06-01');

  const endInput = new TextInputBuilder()
    .setCustomId('end')
    .setLabel('End Date')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setPlaceholder('e.g. 2026-06-10');

  const reasonInput = new TextInputBuilder()
    .setCustomId('reason')
    .setLabel('Reason for LOA')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  modal.addComponents(
    new ActionRowBuilder().addComponents(rankInput),
    new ActionRowBuilder().addComponents(startInput),
    new ActionRowBuilder().addComponents(endInput),
    new ActionRowBuilder().addComponents(reasonInput),
  );

  await interaction.showModal(modal);
}

async function handleRemove(interaction) {
  if (interaction.user.id !== process.env.LOA_APPROVER_ID) {
    return interaction.reply({ content: 'Only the LOA approver can use this.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = interaction.options.getUser('user');
  const loa = db.prepare('SELECT * FROM active_loas WHERE user_id = ?').get(target.id);
  if (!loa) {
    return interaction.editReply({ content: `${target.tag} does not have an active LOA.` });
  }

  const guild = interaction.guild;
  const member = await guild.members.fetch(target.id).catch(() => null);
  if (member) {
    await member.roles.remove(process.env.LOA_ROLE_ID).catch(() => {});
    await member.setNickname(loa.original_nickname, 'LOA removed by approver').catch(() => {});
  }

  db.prepare('DELETE FROM active_loas WHERE id = ?').run(loa.id);
  db.prepare("UPDATE loa_requests SET status = 'ended' WHERE id = ?").run(loa.request_id);
  info(`LOA force-ended for ${target.id} by ${interaction.user.tag}`);

  await interaction.editReply({ content: `LOA removed for ${target.tag}. Role and nickname restored.` });

  const user = await interaction.client.users.fetch(target.id).catch(() => null);
  if (user) {
    const embed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle('✅ LOA Ended')
      .setDescription('Your Leave of Absence has been ended by staff.')
      .setTimestamp();
    await user.send({ embeds: [embed] }).catch(() => {});
  }
}
