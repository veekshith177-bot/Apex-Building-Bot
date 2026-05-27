import { EmbedBuilder, MessageFlags } from 'discord.js';
import { checkCooldown } from '../utils.js';
import { info, error as logError } from '../logger.js';
import { handleApplyButton, handleApplySkip, handleAccept, handleAcceptSubmit, handleReject, handleRejectSubmit, handleInstantAccept, handleInstantDeny, handleApplyTicket } from './applyFlow.js';
import { handlePanelSelect, handleTicketButton, handleModalSubmit } from './handlers/ticketCreate.js';
import { handleCloseRequest, handleCloseConfirm, handleCloseCancel, handleRatingButton, handleRatingModal, handleBuilderRatingButton, handleBuilderRatingModal } from './handlers/ticketClose.js';
import { handleGiveawayEnter, handleSosChoice } from './handlers/giveawayEnter.js';
import { handleGiveawayListNav } from '../commands/giveaway.js';
import { handleEmbedBuilder } from './handlers/embedBuilder.js';
import { handleSpawnerPingToggle } from './handlers/spawnerPing.js';
import { handleLoaApply, handleLoaAccept, handleLoaAcceptSubmit, handleLoaReject, handleLoaRejectSubmit } from './loaFlow.js';

export default async function (client, interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      const cooldown = checkCooldown(interaction.user.id, interaction.commandName);
      if (cooldown > 0) {
        const filled = Math.round((1 - cooldown / 3) * 8);
        const bar = '\u2588'.repeat(Math.max(0, filled)) + '\u2591'.repeat(Math.max(0, 8 - filled));
        return interaction.reply({ content: `\u23F3 \`${bar}\` ${cooldown}s`, flags: MessageFlags.Ephemeral });
      }
      const cmd = client.commands.get(interaction.commandName);
      if (cmd) {
        info(`/${interaction.commandName} by ${interaction.user.tag} (${interaction.user.id})`);
        return cmd.execute(interaction);
      }
    }

    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'panel_main' || id === 'panel_building') {
        return handlePanelSelect(interaction, interaction.values);
      }
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id.startsWith('ticket_')) {
        const handled = await handleTicketButton(interaction);
        if (handled) return;
      }
      if (id === 'close_ticket') return handleCloseRequest(interaction);
      if (id === 'close_confirm') return handleCloseConfirm(client, interaction);
      if (id === 'close_cancel') return handleCloseCancel(interaction);
      if (id.startsWith('rate_builder_')) return handleBuilderRatingButton(interaction);
      if (id.startsWith('rate_')) return handleRatingButton(interaction);
      if (id === 'giveaway_enter') return handleGiveawayEnter(interaction);
      if (id.startsWith('sos_')) return handleSosChoice(client, interaction);
      if (id === 'spawner_ping_toggle') return handleSpawnerPingToggle(interaction);
      if (id === 'apply_builder') return handleApplyButton(interaction, 'builder');
      if (id === 'apply_staff') return handleApplyButton(interaction, 'staff');
      if (id === 'apply_partner') return handleApplyButton(interaction, 'partner');
      if (id === 'glist_prev' || id === 'glist_next') return handleGiveawayListNav(interaction);
      if (id.startsWith('apply_skip_')) return handleApplySkip(interaction, id.split('_')[2]);
      if (id.startsWith('apply_ia_')) return handleInstantAccept(client, interaction, id.split('_')[2]);
      if (id.startsWith('apply_id_')) return handleInstantDeny(client, interaction, id.split('_')[2]);
      if (id.startsWith('apply_ticket_')) return handleApplyTicket(client, interaction, id.split('_')[2]);
      if (id.startsWith('apply_accept_')) return handleAccept(client, interaction, id.split('_')[2]);
      if (id.startsWith('apply_reject_')) return handleReject(client, interaction, id.split('_')[2]);
      if (id.startsWith('loa_accept_')) return handleLoaAccept(interaction);
      if (id.startsWith('loa_reject_')) return handleLoaReject(interaction);
    }

    if (interaction.isModalSubmit()) {
      const cid = interaction.customId;
      if (cid.startsWith('ticket_modal_')) return handleModalSubmit(client, interaction);
      if (cid.startsWith('builder_feedback_')) return handleBuilderRatingModal(client, interaction);
      if (cid.startsWith('rating_feedback_')) return handleRatingModal(client, interaction);
      if (cid === 'embed_builder') return handleEmbedBuilder(client, interaction);
      if (cid.startsWith('apply_accept_reason_')) return handleAcceptSubmit(client, interaction, cid.split('_')[3]);
      if (cid.startsWith('apply_reject_reason_')) return handleRejectSubmit(client, interaction, cid.split('_')[3]);
      if (cid === 'loa_apply') return handleLoaApply(client, interaction);
      if (cid.startsWith('loa_accept_reason_')) return handleLoaAcceptSubmit(client, interaction);
      if (cid.startsWith('loa_reject_reason_')) return handleLoaRejectSubmit(client, interaction);
      if (cid === 'suggestion_modal') return handleSuggestionSubmit(client, interaction);
      if (cid === 'bugreport_modal') return handleBugReportSubmit(client, interaction);
    }
  } catch (e) {
    logError(`Interaction (${interaction.customId || interaction.commandName || '?'}):`, e.message);
    try {
      const payload = { content: 'Something went wrong. Try again.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    } catch {}
  }
}

async function handleSuggestionSubmit(client, interaction) {
  const content = interaction.fields.getTextInputValue('suggestion_content');
  const channelId = process.env.SUGGESTIONS_CHANNEL_ID;
  if (!channelId) {
    return interaction.reply({ content: 'Suggestions channel is not configured.', flags: MessageFlags.Ephemeral });
  }
  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    return interaction.reply({ content: 'Suggestions channel not found.', flags: MessageFlags.Ephemeral });
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setTitle('New Suggestion')
    .setDescription(content)
    .setTimestamp();

  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: `Your suggestion has been submitted in <#${channelId}>.`, flags: MessageFlags.Ephemeral });
  info(`Suggestion submitted by ${interaction.user.tag}`);
}

async function handleBugReportSubmit(client, interaction) {
  const description = interaction.fields.getTextInputValue('bug_description');
  const steps = interaction.fields.getTextInputValue('bug_steps') || null;
  const channelId = process.env.BUG_REPORTS_CHANNEL_ID;
  if (!channelId) {
    return interaction.reply({ content: 'Bug reports channel is not configured.', flags: MessageFlags.Ephemeral });
  }
  const channel = client.channels.cache.get(channelId);
  if (!channel) {
    return interaction.reply({ content: 'Bug reports channel not found.', flags: MessageFlags.Ephemeral });
  }

  const embed = new EmbedBuilder()
    .setColor(0xE74C3C)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setTitle('Bug Report')
    .setDescription(description)
    .setTimestamp();

  if (steps) embed.addFields({ name: 'Steps to Reproduce', value: steps });

  await channel.send({ embeds: [embed] });
  await interaction.reply({ content: `Your bug report has been submitted in <#${channelId}>.`, flags: MessageFlags.Ephemeral });
  info(`Bug report submitted by ${interaction.user.tag}`);
}
