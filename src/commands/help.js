import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, ComponentType } from 'discord.js';

const CATEGORIES = [
  {
    id: 'tickets',
    label: 'Tickets',
    emoji: '\u{1F3AB}',
    color: 0x5865F2,
    desc: 'Create, manage, and close support tickets',
    commands: [
      { cmd: '/panel main', desc: 'Send the main ticket panel' },
      { cmd: '/panel building', desc: 'Send the building services panel' },
      { cmd: '/add <user>', desc: 'Add a user to the current ticket' },
      { cmd: '/remove <user>', desc: 'Remove a user from the current ticket' },
      { cmd: '/rename <name>', desc: 'Rename the ticket channel' },
      { cmd: '/claim', desc: 'Claim a ticket to handle it' },
      { cmd: '/note <text>', desc: 'Add an internal note to a ticket' },
      { cmd: '/close', desc: 'Request to close the current ticket' },
      { cmd: '/tickets', desc: 'View your ticket info / dashboard' },
      { cmd: '/blacklist', desc: 'Manage the ticket blacklist' },
    ],
  },
  {
    id: 'moderation',
    label: 'Moderation',
    emoji: '\u{1F6E1}\uFE0F',
    color: 0xE74C3C,
    desc: 'Server moderation and punishment commands',
    commands: [
      { cmd: '/warn <user> <reason>', desc: 'Issue a warning to a user' },
      { cmd: '/mute <user> <duration> <reason>', desc: 'Timeout/mute a user' },
      { cmd: '/ban <user> <reason>', desc: 'Permanently ban a user' },
      { cmd: '/kick <user> <reason>', desc: 'Kick a user from the server' },
      { cmd: '/softban <user> <reason>', desc: 'Ban + instant unban to clear messages' },
      { cmd: '/tempban <user> <duration> <reason>', desc: 'Temporarily ban a user' },
      { cmd: '/purge <amount>', desc: 'Bulk delete messages (max 100)' },
      { cmd: '/slowmode <seconds>', desc: 'Set channel slowmode' },
      { cmd: '/lock', desc: 'Lock a channel' },
      { cmd: '/unlock', desc: 'Unlock a channel' },
      { cmd: '/strikes', desc: 'Check a user\'s warning strikes' },
    ],
  },
  {
    id: 'roles',
    label: 'Roles',
    emoji: '\u{1F3AD}',
    color: 0x9B59B6,
    desc: 'Automatic and reaction role management',
    commands: [
      { cmd: '/autorole add <role>', desc: 'Auto-give a role on member join' },
      { cmd: '/autorole remove <role>', desc: 'Remove an auto-role' },
      { cmd: '/autorole list', desc: 'List all configured auto-roles' },
      { cmd: '/reactionrole add', desc: 'Add a reaction role to a message' },
      { cmd: '/reactionrole remove', desc: 'Remove a reaction role' },
    ],
  },
  {
    id: 'utility',
    label: 'Utility',
    emoji: '\u{1F4E6}',
    color: 0x1ABC9C,
    desc: 'General utility and fun commands',
    commands: [
      { cmd: '/giveaway create', desc: 'Create a new giveaway' },
      { cmd: '/giveaway end', desc: 'End a giveaway early' },
      { cmd: '/giveaway reroll', desc: 'Reroll a giveaway winner' },
      { cmd: '/giveaway list', desc: 'List all active giveaways' },
      { cmd: '/daily giveaway', desc: 'Start a daily giveaway' },
      { cmd: '/daily stop', desc: 'Stop the daily giveaway' },
      { cmd: '/spawnerprice update', desc: 'Post a spawner restock announcement' },
      { cmd: '/applypanel', desc: 'Send the application menu' },
      { cmd: '/embed builder', desc: 'Open the embed builder modal' },
      { cmd: '/embed json', desc: 'Create an embed from raw JSON' },
      { cmd: '/userinfo', desc: 'View information about a user' },
      { cmd: '/serverinfo', desc: 'View information about this server' },
      { cmd: '/calc <expression>', desc: 'Evaluate a math expression' },
      { cmd: '/afk <reason>', desc: 'Set yourself as away from keyboard' },
      { cmd: '/suggestion', desc: 'Submit a suggestion to the server' },
      { cmd: '/bugreport', desc: 'Report a bug to the server team' },
      { cmd: '/ratings builder', desc: 'Check a builder\'s rating and points' },
      { cmd: '/ratings staff', desc: 'Check a staff member\'s support rating' },
      { cmd: '/ratings leaderboard', desc: 'View the builder or staff leaderboard' },
    ],
  },
  {
    id: 'protection',
    label: 'Protection',
    emoji: '\u{1F6E1}',
    color: 0xE67E22,
    desc: 'Anti-abuse and server protection tools',
    commands: [
      { cmd: '/antiping add', desc: 'Protect a user or role from @pings' },
      { cmd: '/antiping remove', desc: 'Remove ping protection' },
      { cmd: '/antiping list', desc: 'List all protected targets' },
    ],
  },
];

const FOOTERS = [
  'Select a category below to browse commands',
  'Use / to use any command listed here',
  'Some commands require specific permissions',
];

export default {
  async execute(interaction) {
    const first = CATEGORIES[0];
    const embed = new EmbedBuilder()
      .setColor(first.color)
      .setAuthor({ name: 'Command Menu', iconURL: interaction.guild.iconURL({ size: 64 }) || undefined })
      .setTitle(`${first.emoji} ${first.label}`)
      .setDescription(first.commands.map(c => `\`${c.cmd}\` ${c.desc}`).join('\n'))
      .setFooter({ text: `${first.label} \u2014 ${FOOTERS[0]}` })
      .setTimestamp();

    const select = new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('Select a category...')
      .addOptions(CATEGORIES.map(c => ({
        label: c.label,
        value: c.id,
        emoji: c.emoji,
        description: c.desc,
      })));

    const row = new ActionRowBuilder().addComponents(select);
    const reply = await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });

    const filter = i => i.customId === 'help_menu' && i.user.id === interaction.user.id;
    const collector = reply.createMessageComponentCollector({ filter, componentType: ComponentType.StringSelect, time: 60000 });

    collector.on('collect', async i => {
      const cat = CATEGORIES.find(c => c.id === i.values[0]);
      if (!cat) return;
      embed.setColor(cat.color);
      embed.setTitle(`${cat.emoji} ${cat.label}`);
      embed.setDescription(cat.commands.map(c => `\`${c.cmd}\` ${c.desc}`).join('\n'));
      embed.setFooter({ text: `${cat.label} \u2014 ${FOOTERS[Math.floor(Math.random() * FOOTERS.length)]}` });
      await i.update({ embeds: [embed] });
    });
  },
};
