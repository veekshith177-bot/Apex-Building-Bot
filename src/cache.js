export const afkCache = new Map();

export const protectedPings = { users: new Set(), roles: new Set() };

export let antipingEnabled = true;

export function refreshProtectedPings(db) {
  const rows = db.prepare('SELECT target_id, target_type FROM protected_pings').all();
  protectedPings.users = new Set(rows.filter(r => r.target_type === 'user').map(r => r.target_id));
  protectedPings.roles = new Set(rows.filter(r => r.target_type === 'role').map(r => r.target_id));
}

export function loadAntipingSetting(db) {
  const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'antiping_enabled'").get();
  antipingEnabled = row ? row.value === 'true' : true;
}

export function setAntipingEnabled(db, enabled) {
  antipingEnabled = enabled;
  db.prepare("INSERT OR REPLACE INTO bot_settings (key, value) VALUES ('antiping_enabled', ?)").run(String(enabled));
}

export const mutedCache = new Map();

export function loadMutes(db) {
  const rows = db.prepare('SELECT user_id, expires_at FROM mutes').all();
  const now = Date.now();
  for (const row of rows) {
    const expires = new Date(row.expires_at).getTime();
    if (expires > now) {
      mutedCache.set(row.user_id, expires);
    }
  }
}

export function isMuted(userId) {
  const until = mutedCache.get(userId);
  if (!until) return false;
  if (Date.now() > until) {
    mutedCache.delete(userId);
    return false;
  }
  return true;
}

export function markMuted(userId, durationMs) {
  mutedCache.set(userId, Date.now() + durationMs);
}
