export const THEME = {
  brandName: process.env.BOT_BRAND_NAME || 'Apex Bot',
  brandColor: parseInt(process.env.BOT_BRAND_COLOR || '0x5865F2'),
  colors: {
    info: 0x3498DB,
    success: 0x2ECC71,
    warn: 0xF1C40F,
    danger: 0xE74C3C,
    neutral: 0x95A5A6,
  },
};

export function clampColor(val, fallback) {
  if (typeof val === 'number' && val >= 0 && val <= 0xffffff) return val;
  return fallback;
}

