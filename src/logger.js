const DEBUG = process.env.DEBUG === 'true';

const C = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  gray: '\x1b[90m',
};

export function timestamp() {
  return `${C.gray}[${new Date().toLocaleTimeString()}]${C.reset}`;
}

export function info(...args) {
  console.log(`${timestamp()} ${C.cyan}INFO${C.reset}:`, ...args);
}

export function warn(...args) {
  console.warn(`${timestamp()} ${C.yellow}WARN${C.reset}:`, ...args);
}

export function error(...args) {
  console.error(`${timestamp()} ${C.red}ERROR${C.reset}:`, ...args);
}

export function debug(...args) {
  if (DEBUG) console.log(`${timestamp()} ${C.dim}DEBUG${C.reset}:`, ...args);
}

export function divider(char = '═') {
  console.log(`${C.dim}${char.repeat(50)}${C.reset}`);
}
