import { ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder } from 'discord.js';

const panels = {
  main: {
    color: 0xF1C40F,
    footer: 'Apex Building Service Team',
    selectId: 'panel_main',
    description: [
      '# Apex Support Panel',
      '',
      '**Welcome to the Apex Base Support System.**',
      'Select the correct category below to open a ticket.',
      '',
      '**🛠️ Support:** General help, questions, or server issues.',
      '',
      '**🤝 Partner:** Partnership requests or collaborations.',
      '',
      '**🎁 Giveaway Claim:** Claim rewards or ask giveaway-related questions.',
      '',
      '**👑 Rank Request:** Request trusted roles or other rank applications.',
      '',
      '',
      '**⚠️ Important Information:**',
      '- Choose the correct category',
      '- Do not spam tickets',
      '- Provide full information immediately',
      '',
      '**🎟️ Click the menu below to create a ticket.**',
      '-# Apex Support Team is ready to assist you.',
    ].join('\n'),
    options: [
      { label: 'Support', value: 'general', emoji: '🛠️', description: 'General help, questions, or server issues.' },
      { label: 'Partner', value: 'partner', emoji: '🤝', description: 'Partnership requests or collaborations.' },
      { label: 'Giveaway Claim', value: 'giveaway', emoji: '🎁', description: 'Claim rewards or giveaway questions.' },
      { label: 'Rank Request', value: 'rank', emoji: '👑', description: 'Request roles or rank applications.' },
      { label: 'Buy / Sell', value: 'buysell', emoji: '💰', description: 'Buy or sell spawners.' },
    ],
  },
  building: {
    color: 0xF1C40F,
    footer: 'Apex Building Service Team',
    selectId: 'panel_building',
    description: [
      '# Building Service Apex',
      '',
      '``1.`` **Base Services**',
      'We provide professional building services for bases, stashes and digouts.',
      'Our trained builders deliver high quality work and reliable results.',
      '',
      '**Available Categories:**',
      '- Stash / Base Building',
      '- Dig out',
      '- <:Bedrock_JE2_BE2:1505940763551334541> Bedrock Hole',
      '- <:SHULKER:1508817376504975521> Buy Regear',
      '- Refund Request',
      '',
      '',
      'We charge for what we see. If no clear schematic or image is provided, the builder will estimate the cost.',
      '',
      '**Digout Formula:**',
      'Length x Width x Height x 925 = Total Cost',
      '',
      '*Extra 20% fee applies for priority / faster service.*',
      '',
      '',
      '``2.`` **Payments**',
      'All payments must go through an Admin or higher to prevent scams.',
      'You are required to provide an uncropped screenshot as proof of payment.',
      '',
      'Without valid proof, your ticket will be closed immediately.',
      '',
      '',
      '``3.`` **Approvals & Authority**',
      'All important requests (refunds, disputes, issues) must be reviewed and approved by an Admin or higher.',
      '',
      '',
      '**4. Builder Communication**',
      'Do not ping builders in tickets.',
      'Builders are often busy working on projects.',
      'We will respond as soon as we are available.',
      '',
      'Do not argue with staff. If you believe a mistake was made, you may respectfully correct it.',
      '',
      'Troll tickets are strictly forbidden and will result in a blacklist from base building services.',
      '',
      '',
      '**5. Refund Policy**',
      'If the builder has not started yet, you may receive up to **85% refund.**',
      '',
      'If the builder has already started and you cancel, you may receive up to **75% refund.**',
      '',
      'Customers may request proof of home deletion from the builder.',
      '',
      'After completion, we are **NOT** responsible for raids **UNLESS** there is clear proof the builder was involved.',
      '',
      '',
      '``6.`` **Evidence Rules**',
      'All evidence must be clear and unedited.',
      '- No cropped or edited screenshots',
      '- No fake or manipulated proof',
      '- Time-stamps must be visible',
      '- Invalid proof = automatic rejection',
      '',
      '',
      '``7.`` **Abuse Policy**',
      'Any abuse of the system (fake claims, scams, false reports, or exploiting refunds) will result in a blacklist and possible ban.',
    ].join('\n'),
    options: [
      { label: 'Base Build', value: 'build', emoji: '🏗️', description: 'Request help with base building or stashes.' },
      { label: 'Dig Out', value: 'digout', emoji: '⛏️', description: 'Request a digout service.' },
      { label: 'Refund Request', value: 'refund', emoji: '💸', description: 'Request a refund review.' },
      { label: 'Buy Regear', value: 'regear', emoji: { id: '1508817376504975521', name: 'SHULKER' }, description: 'Request a regear purchase.' },
      { label: 'Bedrock Hole', value: 'bedrock', emoji: { id: '1505940763551334541', name: 'Bedrock_JE2_BE2' }, description: 'Request a bedrock hole.' },
    ],
  },
};

const PANEL_THUMBNAIL = 'https://cdn.discordapp.com/attachments/1475250183951482880/1496921961555689684/skinmc-avatar.png';

export function buildPanel(type, client) {
  const panel = panels[type];
  if (!panel) return null;

  const embed = new EmbedBuilder()
    .setColor(panel.color)
    .setDescription(panel.description)
    .setThumbnail(PANEL_THUMBNAIL)
    .setFooter({ text: panel.footer });

  if (process.env.PANEL_BANNER_URL) {
    embed.setImage(process.env.PANEL_BANNER_URL);
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(panel.selectId)
    .setPlaceholder('Select a category...')
    .addOptions(
      panel.options.map(o => ({
        label: o.label,
        value: o.value,
        emoji: o.emoji ? (typeof o.emoji === 'string' ? { name: o.emoji } : o.emoji) : undefined,
        description: o.description,
      }))
    );

  const row = new ActionRowBuilder().addComponents(select);

  return { embed, components: [row] };
}
