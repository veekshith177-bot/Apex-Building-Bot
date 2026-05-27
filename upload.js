import 'dotenv/config';
import Client from 'ssh2-sftp-client';
import fs from 'fs';
import path from 'path';

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

if (!process.env.SFTP_HOST || !process.env.SFTP_USERNAME || !process.env.SFTP_PASSWORD) {
  console.error(`${C.red}${C.bold}[UPLOAD]${C.reset} ${C.red}Missing SFTP env vars (SFTP_HOST, SFTP_USERNAME, SFTP_PASSWORD)${C.reset}`);
  process.exit(1);
}

const config = {
  host: process.env.SFTP_HOST,
  port: parseInt(process.env.SFTP_PORT) || 22,
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD,
};

function findFiles(dir, base = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'data') {
      results.push(...findFiles(full, rel));
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.css'))) {
      results.push(rel);
    }
  }
  return results;
}

const files = findFiles('.').filter(f => !f.startsWith('.env'));

const ts = () => `${C.gray}[${new Date().toLocaleTimeString()}]${C.reset}`;

async function upload() {
  console.log(`\n${ts()} ${C.cyan}${C.bold}SFTP Upload${C.reset}`);
  console.log(`${ts()} ${C.dim}Connecting to ${config.host}:${config.port}...${C.reset}`);

  const sftp = new Client();
  try {
    await sftp.connect(config);
    console.log(`${ts()} ${C.green}Connected${C.reset}\n`);

    let ok = 0, fail = 0;

    for (const file of files) {
      const local = file;
      const remote = file.replace(/\\/g, '/');

      if (!fs.existsSync(local)) {
        console.log(`${ts()} ${C.red}✗${C.reset} ${file} ${C.dim}(not found locally)${C.reset}`);
        fail++;
        continue;
      }

      const dir = path.dirname(remote).replace(/\\/g, '/');
      try { await sftp.mkdir(dir, true); } catch {}

      try {
        await sftp.put(local, remote);
        console.log(`${ts()} ${C.green}✓${C.reset} ${file}`);
        ok++;
      } catch (e) {
        console.log(`${ts()} ${C.red}✗${C.reset} ${file} ${C.dim}(${e.message})${C.reset}`);
        fail++;
      }
    }

    console.log(`\n${ts()} ${C.cyan}${C.bold}════════════════════════════════════${C.reset}`);
    console.log(`${ts()} ${C.green}${ok} uploaded${C.reset}${fail ? `, ${C.red}${fail} failed${C.reset}` : ''}`);
    console.log(`${ts()} ${C.cyan}${C.bold}════════════════════════════════════${C.reset}\n`);

    await sftp.end();
  } catch (e) {
    console.log(`\n${ts()} ${C.red}${C.bold}Connection failed:${C.reset} ${C.red}${e.message}${C.reset}\n`);
    process.exit(1);
  }
}

upload();
