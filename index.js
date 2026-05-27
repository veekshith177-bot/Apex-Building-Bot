import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection, Options } from 'discord.js';
import db from './src/database.js';
import { startDashboard } from './src/dashboard/server.js';
import { info, warn, error } from './src/logger.js';

if (!process.env.DISCORD_TOKEN) {
  error('DISCORD_TOKEN is missing in .env');
  process.exit(1);
}

const PORT = parseInt(process.env.DASHBOARD_PORT) || 2024;
startDashboard(db, PORT);

info(`Starting bot (Node ${process.version})...`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
  makeCache: Options.cacheWithLimits({
    MessageManager: 50,
    GuildMemberManager: 200,
    ReactionManager: 0,
    PresenceManager: 0,
    ThreadManager: 0,
    StageInstanceManager: 0,
    VoiceStateManager: 0,
  }),
  sweepers: {
    messages: { interval: 300, lifetime: 600 },
    guildMembers: { interval: 600, filter: () => m => !m.user.bot },
  },
});

client.db = db;
client.commands = new Collection();

import('./src/handlers/index.js').then(h => {
  info('Handlers loaded — registering events and commands');
  h.default(client);
}).catch(e => {
  error('Failed to load handlers:', e.message);
  process.exit(1);
});

client.on('warn', (msg) => warn(msg));
client.on('error', (err) => error('Client error:', err.message));

client.login(process.env.DISCORD_TOKEN).catch(e => {
  error('Login failed:', e.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  error('Unhandled rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  error('Uncaught exception:', err.message);
});
