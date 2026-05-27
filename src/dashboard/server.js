import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { info, warn } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function setCommonSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Minimal CSP for the current single-file dashboard (Chart.js + Google fonts via CDN).
  // If you later inline more scripts/styles or add new CDNs, update this.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self' https://fonts.gstatic.com data:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    ].join('; ')
  );
}

function maybeSetCors(res) {
  const origin = String(process.env.DASHBOARD_CORS_ORIGIN || '').trim();
  if (!origin) return;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
}

function sendJson(res, data, status = 200) {
  res.statusCode = status;
  setCommonSecurityHeaders(res);
  maybeSetCors(res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function sendError(res, msg, status = 500) {
  sendJson(res, { error: msg }, status);
}

function parseUrl(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  return { pathname: url.pathname, searchParams: url.searchParams };
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a ?? ''), 'utf8');
  const bBuf = Buffer.from(String(b ?? ''), 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function parseBasicAuth(req) {
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'basic' || !encoded) return null;
  let decoded = '';
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return null;
  return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
}

function requireDashboardAuth(req, res, authCfg) {
  if (!authCfg?.enabled) return true;

  const creds = parseBasicAuth(req);
  const okUser = safeEqual(creds?.username ?? '', authCfg.username);
  const okPass = safeEqual(creds?.password ?? '', authCfg.password);
  if (okUser && okPass) return true;

  res.statusCode = 401;
  setCommonSecurityHeaders(res);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('WWW-Authenticate', 'Basic realm="Apex Dashboard", charset="UTF-8"');
  res.end('Unauthorized');
  return false;
}

function apiRoutes(db) {
  function route(pathname, params, req, res) {
    try {
      // ── Stats ──────────────────────────────────────────
      if (pathname === '/api/stats') {
        const total = db.prepare('SELECT COUNT(*) as count FROM tickets').get();
        const open = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'open'").get();
        const closed = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'closed'").get();
        const claimed = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE claimed_by IS NOT NULL AND status = 'open'").get();
        const totalRatings = db.prepare('SELECT COUNT(*) as count FROM ratings').get();
        const avgRating = db.prepare('SELECT ROUND(AVG(stars), 1) as avg FROM ratings').get();
        const totalWarnings = db.prepare('SELECT COUNT(*) as count FROM warnings').get();
        const activeMutes = db.prepare('SELECT COUNT(*) as count FROM mutes').get();
        const activeBans = db.prepare("SELECT COUNT(*) as count FROM tempbans WHERE expires_at > datetime('now')").get();
        const activeGiveaways = db.prepare("SELECT COUNT(*) as count FROM giveaways WHERE ended = 0 AND ends_at > datetime('now')").get();
        const totalGiveaways = db.prepare('SELECT COUNT(*) as count FROM giveaways').get();
        const totalModActions = db.prepare('SELECT COUNT(*) as count FROM mod_logs').get();
        const pendingApps = db.prepare("SELECT COUNT(*) as count FROM applications WHERE status = 'pending'").get();
        const blacklisted = db.prepare('SELECT COUNT(*) as count FROM blacklist').get();
        const today = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE date(created_at) = date('now')").get();
        const todayClosed = db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'closed' AND date(closed_at) = date('now')").get();
        sendJson(res, {
          total: total.count, open: open.count, closed: closed.count,
          claimed: claimed.count, today: today.count, todayClosed: todayClosed.count,
          totalRatings: totalRatings.count, avgRating: avgRating.avg || 0,
          totalWarnings: totalWarnings.count, activeMutes: activeMutes.count,
          activeBans: activeBans.count, activeGiveaways: activeGiveaways.count,
          totalGiveaways: totalGiveaways.count, totalModActions: totalModActions.count,
          pendingApps: pendingApps.count, blacklisted: blacklisted.count,
        });
        return true;
      }

      // ── Detailed Stats ────────────────────────────────
      if (pathname === '/api/stats/detailed') {
        const ticketsByType = db.prepare('SELECT type, COUNT(*) as count FROM tickets GROUP BY type ORDER BY count DESC').all();
        const ratingsDist = db.prepare('SELECT stars, COUNT(*) as count FROM ratings GROUP BY stars ORDER BY stars').all();
        const topTicketUsers = db.prepare('SELECT user_id, COUNT(*) as count FROM tickets GROUP BY user_id ORDER BY count DESC LIMIT 10').all();
        const modActionsByType = db.prepare('SELECT action, COUNT(*) as count FROM mod_logs GROUP BY action ORDER BY count DESC').all();
        const weeklyStats = db.prepare(`
          SELECT date(created_at) as day, 
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as opened,
            SUM(CASE WHEN closed_at IS NOT NULL AND date(closed_at) = date(created_at) THEN 1 ELSE 0 END) as closed_same_day
          FROM tickets 
          WHERE created_at >= datetime('now', '-7 days')
          GROUP BY date(created_at) 
          ORDER BY day ASC
        `).all();
        sendJson(res, { ticketsByType, ratingsDist, topTicketUsers, modActionsByType, weeklyStats });
        return true;
      }

      // ── Ticket Search ──────────────────────────────────
      if (pathname === '/api/tickets/search') {
        const page = Math.max(1, parseInt(params.get('page')) || 1);
        const limit = Math.min(parseInt(params.get('limit')) || 20, 100);
        const offset = (page - 1) * limit;
        const status = params.get('status');
        const type = params.get('type');
        const q = params.get('q');

        let sql = 'SELECT id, channel_id, user_id, type, status, created_at, closed_at, claimed_by, channel_name FROM tickets WHERE 1=1';
        let countSql = 'SELECT COUNT(*) as total FROM tickets WHERE 1=1';
        const binds = [];

        if (status && status !== 'all') {
          sql += ' AND status = ?';
          countSql += ' AND status = ?';
          binds.push(status);
        }
        if (type && type !== 'all') {
          sql += ' AND type = ?';
          countSql += ' AND type = ?';
          binds.push(type);
        }
        if (q) {
          sql += ' AND (user_id LIKE ? OR channel_id LIKE ? OR channel_name LIKE ?)';
          countSql += ' AND (user_id LIKE ? OR channel_id LIKE ? OR channel_name LIKE ?)';
          const like = `%${q}%`;
          binds.push(like, like, like);
        }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        const total = db.prepare(countSql).get(...binds);
        const tickets = db.prepare(sql).all(...binds, limit, offset);
        sendJson(res, { tickets, total: total.total, page, limit, pages: Math.ceil(total.total / limit) });
        return true;
      }

      // ── Single Ticket ─────────────────────────────────
      const ticketMatch = pathname.match(/^\/api\/tickets\/(\d+)$/);
      if (ticketMatch) {
        const id = parseInt(ticketMatch[1]);
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id);
        if (!ticket) { sendError(res, 'Ticket not found', 404); return true; }
        const notes = db.prepare('SELECT * FROM notes WHERE ticket_id = ? ORDER BY created_at ASC').all(id);
        const actions = db.prepare("SELECT * FROM ticket_actions WHERE ticket_channel_id = ? ORDER BY created_at ASC").all(ticket.channel_id);
        const ratings = db.prepare('SELECT * FROM ratings WHERE ticket_id = ?').all(id);
        sendJson(res, { ...ticket, notes, actions, ratings });
        return true;
      }

      // ── Recent Tickets ─────────────────────────────────
      if (pathname === '/api/tickets/recent') {
        const limit = Math.min(parseInt(params.get('limit')) || 20, 100);
        const tickets = db.prepare('SELECT id, channel_id, user_id, type, status, created_at, closed_at, claimed_by, channel_name FROM tickets ORDER BY created_at DESC LIMIT ?').all(limit);
        sendJson(res, tickets);
        return true;
      }

      // ── Daily Stats ────────────────────────────────────
      if (pathname === '/api/tickets/daily') {
        const days = parseInt(params.get('days')) || 14;
        const rows = db.prepare(`SELECT date(created_at) as day, COUNT(*) as count FROM tickets WHERE created_at >= datetime('now', '-${days} days') GROUP BY date(created_at) ORDER BY day ASC`).all();
        sendJson(res, rows);
        return true;
      }

      // ── Type Stats ─────────────────────────────────────
      if (pathname === '/api/tickets/type-stats') {
        const rows = db.prepare('SELECT type, COUNT(*) as count FROM tickets GROUP BY type ORDER BY count DESC').all();
        sendJson(res, rows);
        return true;
      }

      // ── Staff Activity ─────────────────────────────────
      if (pathname === '/api/staff/activity') {
        const claims = db.prepare('SELECT claimed_by, COUNT(*) as tickets, COUNT(DISTINCT user_id) as unique_users FROM tickets WHERE claimed_by IS NOT NULL GROUP BY claimed_by ORDER BY tickets DESC LIMIT 20').all();
        const recentStaffActions = db.prepare('SELECT moderator_id, action, COUNT(*) as count FROM mod_logs GROUP BY moderator_id, action ORDER BY count DESC LIMIT 30').all();
        sendJson(res, { claims, recentStaffActions });
        return true;
      }

      // ── Blacklist ──────────────────────────────────────
      if (pathname === '/api/blacklist') {
        const rows = db.prepare('SELECT * FROM blacklist ORDER BY added_at DESC').all();
        sendJson(res, rows);
        return true;
      }

      // ── Pending Applications ───────────────────────────
      if (pathname === '/api/applications/pending') {
        const rows = db.prepare("SELECT id, user_id, type, created_at FROM applications WHERE status = 'pending' ORDER BY created_at ASC").all();
        sendJson(res, rows);
        return true;
      }

      // ── Moderation Recent ──────────────────────────────
      if (pathname === '/api/moderation/recent') {
        const limit = Math.min(parseInt(params.get('limit')) || 10, 50);
        const rows = db.prepare('SELECT id, case_id, action, moderator_id, target_id, reason, created_at FROM mod_logs ORDER BY created_at DESC LIMIT ?').all(limit);
        sendJson(res, rows);
        return true;
      }

      // ── Warnings Top ───────────────────────────────────
      if (pathname === '/api/moderation/warnings/top') {
        const limit = Math.min(parseInt(params.get('limit')) || 10, 50);
        const rows = db.prepare('SELECT user_id, COUNT(*) as count FROM warnings GROUP BY user_id ORDER BY count DESC LIMIT ?').all(limit);
        sendJson(res, rows);
        return true;
      }

      // ── Active Mutes ───────────────────────────────────
      if (pathname === '/api/moderation/mutes') {
        const rows = db.prepare('SELECT * FROM mutes WHERE expires_at > datetime("now") ORDER BY expires_at ASC').all();
        sendJson(res, rows);
        return true;
      }

      // ── Active Tempbans ────────────────────────────────
      if (pathname === '/api/moderation/bans') {
        const rows = db.prepare('SELECT * FROM tempbans WHERE expires_at > datetime("now") ORDER BY expires_at ASC').all();
        sendJson(res, rows);
        return true;
      }

      // ── Active Giveaways ───────────────────────────────
      if (pathname === '/api/giveaways/active') {
        const rows = db.prepare(`SELECT id, prize, winners, ends_at, hosted_by, mode, (SELECT COUNT(*) FROM giveaway_entrants WHERE giveaway_id = giveaways.id) as entrants FROM giveaways WHERE ended = 0 AND ends_at > datetime('now') ORDER BY ends_at ASC`).all();
        sendJson(res, rows);
        return true;
      }

      // ── Giveaway History ───────────────────────────────
      if (pathname === '/api/giveaways/history') {
        const limit = Math.min(parseInt(params.get('limit')) || 20, 100);
        const rows = db.prepare(`SELECT id, prize, winners, ends_at, hosted_by, mode, ended, (SELECT COUNT(*) FROM giveaway_entrants WHERE giveaway_id = giveaways.id) as entrants FROM giveaways WHERE ended = 1 ORDER BY ends_at DESC LIMIT ?`).all(limit);
        sendJson(res, rows);
        return true;
      }

      // ── LOA Active ─────────────────────────────────────
      if (pathname === '/api/loa/active') {
        const rows = db.prepare('SELECT * FROM active_loas ORDER BY end_at ASC').all();
        sendJson(res, rows);
        return true;
      }

      return false;
    } catch (err) {
      sendError(res, err.message);
      return true;
    }
  }
  return route;
}

function serveStatic(pathname, res) {
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, 'index.html');
    if (!fs.existsSync(filePath)) {
      res.statusCode = 404;
      setCommonSecurityHeaders(res);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('Not Found');
      return;
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.statusCode = 200;
  setCommonSecurityHeaders(res);
  res.setHeader('Content-Type', contentType);
  res.end(content);
}

export function startDashboard(db, port) {
  const apiRouter = apiRoutes(db);
  const dashboardPassword = String(process.env.DASHBOARD_PASSWORD || '');
  const authCfg = {
    enabled: dashboardPassword.length > 0,
    username: String(process.env.DASHBOARD_USERNAME || 'admin'),
    password: dashboardPassword,
  };

  if (!authCfg.enabled) {
    warn('Dashboard is running WITHOUT auth. Set DASHBOARD_PASSWORD to enable Basic Auth.');
  }

  const server = http.createServer((req, res) => {
    const { pathname, searchParams } = parseUrl(req);

    if (!requireDashboardAuth(req, res, authCfg)) return;

    if (pathname.startsWith('/api/')) {
      if (apiRouter(pathname, searchParams, req, res)) return;
      sendJson(res, { error: 'Not found' }, 404);
      return;
    }

    serveStatic(pathname, res);
  });

  server.listen(port, '0.0.0.0', () => {
    info(`──────────────────────────────────────`);
    info(`  Dashboard live at http://eu2.vnav.cloud:${port}`);
    info(`──────────────────────────────────────`);
  });

  return server;
}
