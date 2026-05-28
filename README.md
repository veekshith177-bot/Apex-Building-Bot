# 🍩 Donut SMP Apex Ticket & Moderation Bot

A powerful, high-performance, modular Discord utility and ticket management bot tailored for the **Donut SMP** community and **Apex Building Service**. Built with `discord.js` v14 and backed by `better-sqlite3` in WAL mode for maximum speed and data integrity.

---

## ✨ Features

- **🎫 Advanced Support Ticket System**
  - Modular support panel types (General, Partner, Giveaway, Spawner, Build, Digout, Bedrock hole, Refund, Regear, and more).
  - DM-based builder rating and feedback system that updates builder reputation stats.
  - Safe HTML-compatible transcript generation with message limit safeguards.
  - Automated ticket close request flow with confirmations for ticket creators and direct close for staff.
- **🛡️ Robust Moderation Engine**
  - Anti-ping protection for staff, custom roles, and specific users with dynamic toggle settings.
  - Automatic slur and inappropriate pattern detection using optimized regex rules.
  - Smart spam detection with automatic message purging.
  - Standard moderation commands: `/warn`, `/mute`, `/unmute`, `/tempban`, `/ban`, `/kick`, `/slowmode`, `/lock`, and `/unlock`.
- **🎲 Split or Steal Giveaway System**
  - Fully interactive split or steal mechanic with DM-based button prompts and claim timeouts.
  - Support for standard giveaways, daily automatic giveaways, and prize rerolls (excluding previous winners).
- **📋 Leave of Absence (LOA) Tracker**
  - Complete LOA request flow with automated nickname updates (`[LOA] User`) and automatic role removal upon expiration.
- **💼 Builder Application Menu**
  - Interactive application forms for Builders, Partners, and Staff with a configured cooldown window (e.g., 4 days) between submissions.
- **🧮 Safe Expression Calculator**
  - Pure JS recursive-descent math parser (`/calc`) avoiding insecure `eval()` or `Function()` calls.

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- **Node.js** v18 or higher
- **npm** or **pnpm**
- SQLite development tools (optional, for DB inspection)

### 2. Install Dependencies
Clone this repository and run:
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and configure it as follows:

```env
# Bot Core Settings
DISCORD_TOKEN=your_bot_token_here
GUILD_ID=your_guild_id_here
CLIENT_ID=your_client_id_here

# Channel Configuration
TRANSCRIPT_LOGS_CHANNEL_ID=channel_id_here
RATING_LOGS_CHANNEL_ID=channel_id_here
ACTION_LOGS_CHANNEL_ID=channel_id_here
APPLICATION_LOGS_CHANNEL_ID=channel_id_here
LOA_LOGS_CHANNEL_ID=channel_id_here
LOA_POST_CHANNEL_ID=channel_id_here
SUGGESTIONS_CHANNEL_ID=channel_id_here
BUG_REPORTS_CHANNEL_ID=channel_id_here

# Role IDs
STAFF_ROLE_ID=role_id_here
MOD_ROLE_ID=role_id_here
ADMIN_ROLE_ID=role_id_here
MANAGER_ROLE_ID=role_id_here
HELPER_ROLE_ID=role_id_here
GIVEAWAY_PING_ROLE_ID=role_id_here
GIVEAWAY_ACCESS_ROLE_ID=role_id_here
LOA_ROLE_ID=role_id_here
SPAWNER_PING_ROLE_ID=role_id_here
TRUSTED_SELLER_ROLE_ID=role_id_here
REGEAR_ROLE_ID=role_id_here
BUILD_TEAM_ROLE_ID=role_id_here

# Ticket Category Mappings
CATEGORY_GENERAL=category_id_here
CATEGORY_PARTNER=category_id_here
CATEGORY_GIVEAWAY=category_id_here
CATEGORY_SPAWNER_BUY=category_id_here
CATEGORY_SPAWNER_SELL=category_id_here
CATEGORY_RANK_REQUEST=category_id_here
CATEGORY_BUILD=category_id_here
CATEGORY_DIGOUT=category_id_here
CATEGORY_REFUND=category_id_here
CATEGORY_BEDROCK_HOLE=category_id_here
CATEGORY_REGEAR=category_id_here

# Optional: LOA Authorized Approver User ID
LOA_APPROVER_ID=user_id_here

# Optional: SFTP Deployment Settings (for upload.js)
SFTP_HOST=sftp_host_here
SFTP_PORT=22
SFTP_USERNAME=sftp_username_here
SFTP_PASSWORD=sftp_password_here

# Dashboard (recommended)
# Protects the dashboard + API with a login screen (cookie session).
DASHBOARD_PORT=2024
DASHBOARD_PASSWORD=your_strong_password_here
DASHBOARD_SESSION_TTL=86400
# If you terminate TLS before Node (recommended), keep this false. Set true only if Node itself is behind HTTPS.
DASHBOARD_COOKIE_SECURE=false

# Optional: allow cross-origin dashboard API access (not needed for the built-in UI)
# Example: https://yourdomain.com  (avoid "*" unless you understand the risk)
DASHBOARD_CORS_ORIGIN=

# Bot embed theming (optional)
BOT_BRAND_NAME=Apex Bot
BOT_BRAND_COLOR=0x5865F2
```

### 4. Deploy Slash Commands
Register application commands with Discord API:
```bash
npm run deploy
```
If you add new commands (like `/health`), re-run deploy to register them.

### 5. Run the Bot
To start the bot in production mode:
```bash
npm run start
```

---

## 📂 Project Structure

```
├── src/
│   ├── commands/       # Slash command execution modules
│   ├── events/         # Discord client event listeners & schedulers
│   ├── handlers/       # Command registration, auto-roles, reaction-roles
│   ├── cache.js        # In-memory settings, mutes, AFK state caching
│   ├── database.js     # SQLite schema definition and migrations
│   ├── logger.js       # Streamlined console logger with timestamps
│   ├── modutils.js     # Embed layout helpers for moderation actions
│   ├── panels.js       # Ticket panels definitions
│   ├── transcript.js   # HTML ticket transcript generator
│   └── utils.js        # Common utility functions
├── LICENSE             # MIT License
├── README.md           # Documentation
├── package.json        # Dependencies & start scripts
└── deploy.js           # Discord slash commands deployment script
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
