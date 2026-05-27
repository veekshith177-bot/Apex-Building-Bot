import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, 'data');
fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(path.join(dbDir, 'tickets.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Core Tables ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at TEXT,
    claimed_by TEXT,
    claim_time TEXT,
    channel_name TEXT,
    inactivity_warned_at TEXT
  );

  CREATE TABLE IF NOT EXISTS blacklist (
    user_id TEXT PRIMARY KEY,
    reason TEXT,
    added_by TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    author_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER,
    user_id TEXT NOT NULL,
    target_id TEXT,
    stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
    feedback TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  );

  CREATE TABLE IF NOT EXISTS ticket_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_channel_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    target_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS protected_pings (
    target_id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL CHECK(target_type IN ('user', 'role')),
    added_by TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Giveaways ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    winners INTEGER NOT NULL DEFAULT 1,
    ends_at TEXT NOT NULL,
    ended INTEGER NOT NULL DEFAULT 0,
    hosted_by TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'standard',
    ended_by TEXT,
    sos_player1 TEXT,
    sos_player2 TEXT,
    sos_p1_dm_cid TEXT,
    sos_p1_dm_mid TEXT,
    sos_p2_dm_cid TEXT,
    sos_p2_dm_mid TEXT,
    sos_time INTEGER DEFAULT 60
  );

  CREATE TABLE IF NOT EXISTS giveaway_entrants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    giveaway_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    sos_choice TEXT,
    FOREIGN KEY (giveaway_id) REFERENCES giveaways(id)
  );
`);

// ── Spawner ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS spawner_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL
  );
`);

// ── Moderation ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mutes (
    user_id TEXT PRIMARY KEY,
    reason TEXT,
    moderator_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tempbans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    reason TEXT,
    moderator_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS mod_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    target_id TEXT,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Roles ──────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS auto_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id TEXT NOT NULL,
    delay_minutes INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS reaction_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    role_id TEXT NOT NULL
  );
`);

// ── Filters ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS filtered_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL UNIQUE
  );
`);

// ── LOA ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS loa_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    rank TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    reviewed_by TEXT,
    reviewed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS active_loas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    request_id INTEGER NOT NULL,
    end_at INTEGER NOT NULL,
    original_nickname TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (request_id) REFERENCES loa_requests(id)
  );
`);

// ── Reputation ─────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS reputation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    rater_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    stars INTEGER NOT NULL CHECK(stars >= 1 AND stars <= 5),
    feedback TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
  );
`);

// ── AFK ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS afk (
    user_id TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    since INTEGER NOT NULL
  );
`);

// ── Applications ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    answers TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Daily Giveaway Config ──────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_config (
    id INTEGER PRIMARY KEY,
    channel_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 0
  );
`);

// ── Bot Settings ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// ── Migrations (safe to run multiple times) ────────────────────
// Add columns that may be missing on older databases
try { db.exec("ALTER TABLE tickets ADD COLUMN channel_name TEXT"); } catch {}
try { db.exec("ALTER TABLE tickets ADD COLUMN inactivity_warned_at TEXT"); } catch {}
try { db.exec("ALTER TABLE ratings ADD COLUMN target_id TEXT"); } catch {}
try { db.exec("ALTER TABLE giveaways ADD COLUMN ended_by TEXT"); } catch {}
try { db.exec("ALTER TABLE giveaways ADD COLUMN sos_player1 TEXT"); } catch {}
try { db.exec("ALTER TABLE giveaways ADD COLUMN sos_player2 TEXT"); } catch {}
try { db.exec("ALTER TABLE giveaways ADD COLUMN sos_p1_dm_cid TEXT"); } catch {}
try { db.exec("ALTER TABLE giveaways ADD COLUMN sos_p1_dm_mid TEXT"); } catch {}
try { db.exec("ALTER TABLE giveaways ADD COLUMN sos_p2_dm_cid TEXT"); } catch {}
try { db.exec("ALTER TABLE giveaways ADD COLUMN sos_p2_dm_mid TEXT"); } catch {}
try { db.exec("ALTER TABLE giveaways ADD COLUMN sos_time INTEGER DEFAULT 60"); } catch {}
try { db.exec("ALTER TABLE giveaway_entrants ADD COLUMN sos_choice TEXT"); } catch {}

// ── Indexes ────────────────────────────────────────────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);
  CREATE INDEX IF NOT EXISTS idx_giveaways_message ON giveaways(message_id);
  CREATE INDEX IF NOT EXISTS idx_giveaway_entrants_giveaway ON giveaway_entrants(giveaway_id);
  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings(user_id);
  CREATE INDEX IF NOT EXISTS idx_tempbans_user ON tempbans(user_id);
  CREATE INDEX IF NOT EXISTS idx_reaction_roles_msg ON reaction_roles(message_id);
  CREATE INDEX IF NOT EXISTS idx_ratings_target ON ratings(target_id);
  CREATE INDEX IF NOT EXISTS idx_reputation_target ON reputation(target_id);
  CREATE INDEX IF NOT EXISTS idx_reputation_ticket ON reputation(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_mod_logs_case ON mod_logs(case_id);
`);

try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_reaction_roles_unique ON reaction_roles(message_id, emoji)"); } catch {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_unique ON ratings(ticket_id, user_id)"); } catch {}
try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_reputation_unique ON reputation(ticket_id, rater_id)"); } catch {}

// ── Defaults ───────────────────────────────────────────────────
try { db.prepare("INSERT OR IGNORE INTO bot_settings (key, value) VALUES ('antiping_enabled', 'true')").run(); } catch {}

// Cleanup stale spawner messages (keep only the latest)
try { db.exec("DELETE FROM spawner_messages WHERE id NOT IN (SELECT MAX(id) FROM spawner_messages)"); } catch {}

export default db;
