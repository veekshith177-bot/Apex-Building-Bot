import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  gray: '\x1b[90m',
};

const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = process.env;
if (!CLIENT_ID || !GUILD_ID || !DISCORD_TOKEN) {
  console.error(`${C.red}${C.bold}[DEPLOY]${C.reset} ${C.red}Missing CLIENT_ID, GUILD_ID, or DISCORD_TOKEN in .env${C.reset}`);
  process.exit(1);
}

function cmd(name, desc) {
  return new SlashCommandBuilder().setName(name).setDescription(desc);
}

const commands = [
  // ── Tickets ──────────────────────────────────────
  cmd('panel', 'Send a ticket panel')
    .addSubcommand(s => s.setName('main').setDescription('Send the main ticket panel').addChannelOption(o => o.setName('channel').setDescription('Channel to send to').setRequired(false)))
    .addSubcommand(s => s.setName('building').setDescription('Send the building service panel').addChannelOption(o => o.setName('channel').setDescription('Channel to send to').setRequired(false))),
  cmd('add', 'Add a user to the ticket')
    .addUserOption(o => o.setName('user').setDescription('The user to add').setRequired(true)),
  cmd('remove', 'Remove a user from the ticket')
    .addUserOption(o => o.setName('user').setDescription('The user to remove').setRequired(true)),
  cmd('rename', 'Rename the ticket channel')
    .addStringOption(o => o.setName('name').setDescription('New channel name').setRequired(true)),
  cmd('claim', 'Claim this ticket'),
  cmd('unclaim', 'Unclaim this ticket and restore staff typing'),
  cmd('note', 'Add an internal note to this ticket')
    .addStringOption(o => o.setName('content').setDescription('Note content').setRequired(true)),
  cmd('tickets', 'View ticket info'),
  cmd('close', 'Request to close the ticket (requires creator confirmation)'),
  cmd('inactivity', 'Warn a ticket — auto-closes after 24h of no response'),

  // ── Giveaway ─────────────────────────────────────
  cmd('giveaway', 'Manage giveaways')
    .addSubcommand(s => s.setName('create').setDescription('Create a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('The prize to give away').setRequired(true))
      .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1h, 30m, 1d').setRequired(true))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setRequired(true).setMinValue(1).setMaxValue(10))
      .addStringOption(o => o.setName('mode').setDescription('Giveaway mode').addChoices({ name: 'Standard', value: 'standard' }, { name: 'Split or Steal', value: 'split-or-steal' }))
      .addIntegerOption(o => o.setName('sos_time').setDescription('Split or Steal claim time in minutes (default 60)').setMinValue(1).setMaxValue(1440).setRequired(false)))
    .addSubcommand(s => s.setName('end').setDescription('End a giveaway early').addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))
    .addSubcommand(s => s.setName('reroll').setDescription('Reroll a winner').addStringOption(o => o.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List active giveaways')),
  cmd('daily', 'Manage daily giveaways')
    .addSubcommand(s => s.setName('giveaway').setDescription('Start a daily giveaway').addStringOption(o => o.setName('prize').setDescription('Prize amount (e.g. 1m)').setRequired(true)))
    .addSubcommand(s => s.setName('stop').setDescription('Stop the daily giveaway')),

  // ── Moderation ───────────────────────────────────
  cmd('warn', 'Warn a user')
    .addUserOption(o => o.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for warning').setRequired(true)),
  cmd('mute', 'Timeout/mute a user')
    .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1h, 30m, 7d').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for mute').setRequired(true)),
  cmd('unmute', 'Unmute a user')
    .addUserOption(o => o.setName('user').setDescription('User to unmute').setRequired(true)),
  cmd('slowmode', 'Set channel slowmode')
    .addIntegerOption(o => o.setName('seconds').setDescription('Seconds between messages (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(false)),
  cmd('purge', 'Bulk delete messages')
    .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Only delete messages from this user').setRequired(false)),
  cmd('lock', 'Lock a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to lock').setRequired(false)),
  cmd('unlock', 'Unlock a channel')
    .addChannelOption(o => o.setName('channel').setDescription('Channel to unlock').setRequired(false)),
  cmd('ban', 'Ban a user')
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for ban').setRequired(true))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Days of messages to delete').setRequired(false).setMinValue(0).setMaxValue(7)),
  cmd('kick', 'Kick a user')
    .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for kick').setRequired(true)),
  cmd('softban', 'Ban + unban to clear messages')
    .addUserOption(o => o.setName('user').setDescription('User to softban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for softban').setRequired(true)),
  cmd('tempban', 'Temporarily ban a user')
    .addUserOption(o => o.setName('user').setDescription('User to tempban').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('Duration e.g. 1h, 7d, 30d').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for tempban').setRequired(true)),
  cmd('strikes', 'Check strike/warning count')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false)),

  // ── Anti-Abuse ──────────────────────────────────
  cmd('antiping', 'Manage anti-ping settings')
    .addSubcommand(s => s.setName('on').setDescription('Enable the anti-ping system'))
    .addSubcommand(s => s.setName('off').setDescription('Disable the anti-ping system'))
    .addSubcommand(s => s.setName('add').setDescription('Protect a user or role from pings').addUserOption(o => o.setName('user').setDescription('User to protect')).addRoleOption(o => o.setName('role').setDescription('Role to protect')))
    .addSubcommand(s => s.setName('remove').setDescription('Remove protection from a user or role').addUserOption(o => o.setName('user').setDescription('User to unprotect')).addRoleOption(o => o.setName('role').setDescription('Role to unprotect')))
    .addSubcommand(s => s.setName('list').setDescription('List all protected targets')),
  cmd('blacklist', 'Manage ticket blacklist')
    .addSubcommand(s => s.setName('add').setDescription('Blacklist a user').addUserOption(o => o.setName('user').setDescription('User to blacklist').setRequired(true)).addStringOption(o => o.setName('reason').setDescription('Reason for blacklist')))
    .addSubcommand(s => s.setName('remove').setDescription('Unblacklist a user').addUserOption(o => o.setName('user').setDescription('User to unblacklist').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all blacklisted users')),

  // ── Role Management ──────────────────────────────
  cmd('autorole', 'Manage auto-roles')
    .addSubcommand(s => s.setName('add').setDescription('Add an auto-role').addRoleOption(o => o.setName('role').setDescription('Role to give').setRequired(true)).addIntegerOption(o => o.setName('delay').setDescription('Delay in minutes').setRequired(false).setMinValue(0)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove an auto-role').addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List auto-roles')),
  cmd('reactionrole', 'Manage reaction roles')
    .addSubcommand(s => s.setName('add').setDescription('Add a reaction role').addStringOption(o => o.setName('message_link').setDescription('Message link (right-click message → Copy Message Link)').setRequired(true)).addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('Role to give').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a reaction role').addStringOption(o => o.setName('message_link').setDescription('Message link (right-click message → Copy Message Link)').setRequired(true)).addStringOption(o => o.setName('emoji').setDescription('Emoji to remove').setRequired(true))),

  // ── Utility ──────────────────────────────────────
  cmd('spawnerprice', 'Manage spawner price announcements')
    .addSubcommand(s => s.setName('update').setDescription('Send/update the spawner restock announcement').addStringOption(o => o.setName('price').setDescription('Price per piece (e.g. 5 diamonds)').setRequired(true))),
  cmd('help', 'Show all commands'),
  cmd('userinfo', 'View info about a user')
    .addUserOption(o => o.setName('user').setDescription('The user to look up').setRequired(false)),
  cmd('serverinfo', 'View info about this server'),
  cmd('applypanel', 'Send the application menu panel'),
  cmd('embed', 'Create a custom embed')
    .addSubcommand(s => s.setName('builder').setDescription('Open the embed builder modal'))
    .addSubcommand(s =>
      s
        .setName('json')
        .setDescription('Create an embed from raw JSON')
        .addStringOption(o =>
          o.setName('data').setDescription('Full Discord embed JSON').setRequired(true),
        ),
    ),
  cmd('calc', 'Calculate a math expression')
    .addStringOption(o => o.setName('expression').setDescription('Math expression (e.g. 29x28)').setRequired(true)),
  cmd('afk', 'Set yourself as AFK')
    .addStringOption(o => o.setName('reason').setDescription('Reason for being AFK').setRequired(false)),
  cmd('loa', 'Leave of Absence management')
    .addSubcommand(s => s.setName('apply').setDescription('Submit an LOA request'))
    .addSubcommand(s => s.setName('remove').setDescription('Force-end someone\'s LOA').addUserOption(o => o.setName('user').setDescription('User to remove from LOA').setRequired(true))),
  cmd('ratings', 'Check ratings and leaderboard')
    .addSubcommand(s => s.setName('builder').setDescription('Check a builder\'s rating').addUserOption(o => o.setName('user').setDescription('Builder to look up').setRequired(false)))
    .addSubcommand(s => s.setName('staff').setDescription('Check a staff member\'s support rating').addUserOption(o => o.setName('user').setDescription('Staff member to look up').setRequired(false)))
    .addSubcommand(s => s.setName('leaderboard').setDescription('View the leaderboard').addStringOption(o => o.setName('type').setDescription('Leaderboard type').addChoices({ name: 'Builders', value: 'builder' }, { name: 'Staff', value: 'staff' }).setRequired(true))),

  // ── Feedback ─────────────────────────────────────
  cmd('suggestion', 'Submit a suggestion to the server'),
  cmd('bugreport', 'Report a bug to the server team'),
];

// ── Deploy ─────────────────────────────────────────
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

const ts = () => `${C.gray}[${new Date().toLocaleTimeString()}]${C.reset}`;
const categories = ['Tickets', 'Giveaway', 'Moderation', 'Anti-Abuse', 'Role Management', 'Utility'];

const isClear = process.argv.includes('--clear');
if (isClear) {
  console.log(`\n${ts()} ${C.yellow}Clearing all guild commands...${C.reset}`);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
  console.log(`${ts()} ${C.green}All commands cleared for guild ${C.cyan}${GUILD_ID}${C.reset}\n`);
  process.exit(0);
}

console.log();
console.log(`${ts()} ${C.cyan}${C.bold}════════════════════════════════════════════════${C.reset}`);
console.log(`${ts()} ${C.cyan}${C.bold}   Deploying ${commands.length} Slash Commands${C.reset}`);
console.log(`${ts()} ${C.cyan}   Guild: ${C.bold}${GUILD_ID}${C.reset}`);
console.log(`${ts()} ${C.cyan}${C.bold}════════════════════════════════════════════════${C.reset}`);
console.log();

const countPerCategory = {
  Tickets: 10,
  Giveaway: 2,
  Moderation: 11,
  'Anti-Abuse': 2,
  'Role Management': 2,
  Utility: 11,
};

for (const cat of categories) {
  const bar = '▸'.repeat(countPerCategory[cat]);
  console.log(`${ts()}   ${C.bold}${cat}${C.reset} ${C.dim}${bar}${C.reset} ${C.yellow}${countPerCategory[cat]}${C.reset}`);
}
console.log();
console.log(`${ts()}   ${C.dim}Total:${C.reset} ${C.cyan}${C.bold}${commands.length} commands${C.reset}`);
console.log();

try {
  const result = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
    body: commands.map(c => c.toJSON()),
  });

  console.log(`${ts()} ${C.green}${C.bold}════════════════════════════════════════════════${C.reset}`);
  console.log(`${ts()} ${C.green}${C.bold}   ✓ ${result.length} commands registered${C.reset}`);
  console.log(`${ts()} ${C.green}   All commands updated successfully${C.reset}`);
  console.log(`${ts()} ${C.green}${C.bold}════════════════════════════════════════════════${C.reset}`);
  console.log();
} catch (e) {
  console.error(`\n${ts()} ${C.red}${C.bold}✗ Deploy failed:${C.reset}`);
  console.error(`${ts()} ${C.red}   ${e.message}${C.reset}`);
  if (e.rawError) {
    console.error(`${ts()} ${C.dim}   Raw: ${JSON.stringify(e.rawError, null, 2)}${C.reset}`);
  }
  console.error();
  process.exit(1);
}
