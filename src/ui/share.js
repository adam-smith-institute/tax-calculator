// Share image in the ASI Design System's Stat Card format, 1080 × 1350 (4:5).
//
// Geometry follows the design system, as fractions of canvas width (2048 reference):
// flat ASI blue ground; mark top-right at 12.5% of width, 2% margin; 150px margins; the
// numeral in lavender (the payload), white Josefin beneath; footer rule 480 × 6 and
// adamsmith.org, anchored 202px from the bottom. The top three categories come from the data.

import { gbp } from './format.js?v=e3c7463546';

const W = 1080;
const H = 1350;
const u = W / 2048;
const BLUE = '#134079';
const WHITE = '#FFFFFF';
const LAVENDER = '#8B8DBE';
const FONT = '"Josefin Sans"';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

// Pure: what goes on the card
export function shareContent(totalTax, taxYear, allocated, spendingMeta) {
  const top = [...allocated].sort((a, b) => b.yours - a.yours).slice(0, 3);
  return {
    stat: gbp(totalTax),
    headline: `is what I pay in tax in ${taxYear}.`,
    listTitle: 'The three biggest shares:',
    lines: top.map((c) => ({ amount: gbp(c.yours), name: c.name })),
    source: `Spending shares from HM Treasury, ${spendingMeta.title} (${spendingMeta.fiscalYear} outturn).`,
  };
}

export async function drawShareCard(canvas, content, logoSrc) {
  await document.fonts.ready;
  await Promise.all([300, 600].map((w) => document.fonts.load(`${w} 100px ${FONT}`)));
  const logo = await loadImage(logoSrc);

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Mark, top right. The SVG carries ~3% padding, so the box is diameter / 0.94.
  const visible = 0.125 * W;
  const box = visible / 0.94;
  const inset = 0.02 * W - (box - visible) / 2;
  ctx.drawImage(logo, W - inset - box, inset, box, box);

  // Content box: 150 left/right, from 365 down to 241 above the bottom (@2048)
  const left = 150 * u;
  const width = W - 2 * left;
  const boxTop = 365 * u;
  const boxBottom = H - 241 * u;

  // Numeral: lavender, Josefin 600, as large as fits the width (up to 4.08 × the headline)
  const root = 80; // headline size: 152 @2048, rounded
  ctx.font = `600 100px ${FONT}`;
  const statSize = Math.min(4.08 * root, (width / ctx.measureText(content.stat).width) * 100);
  const headlineLines = wrap(ctx, content.headline, `600 ${root}px ${FONT}`, width);
  const lineSize = Math.round(0.526 * root);

  // Measure the block, then centre it vertically in the content box (4:5 rule)
  const statH = statSize;
  const gap1 = 0.5 * root;
  const headH = headlineLines.length * root * 1.28;
  const gap2 = 0.6 * root;
  const listH = (content.lines.length + 1) * lineSize * 1.5;
  const gap3 = 0.5 * root;
  const srcSize = Math.round(0.36 * root);
  const srcLines = wrap(ctx, content.source, `300 ${srcSize}px ${FONT}`, width * 0.85);
  const srcH = srcLines.length * srcSize * 1.38;
  const total = statH + gap1 + headH + gap2 + listH + gap3 + srcH;
  let y = boxTop + Math.max(0, (boxBottom - boxTop - total) / 2);

  ctx.fillStyle = LAVENDER;
  ctx.font = `600 ${statSize}px ${FONT}`;
  y += statSize * 0.8;
  ctx.fillText(content.stat, left, y);
  y += statSize * 0.2 + gap1;

  ctx.fillStyle = WHITE;
  ctx.font = `600 ${root}px ${FONT}`;
  for (const line of headlineLines) {
    y += root;
    ctx.fillText(line, left, y);
    y += root * 0.28;
  }
  y += gap2;

  ctx.font = `300 ${lineSize}px ${FONT}`;
  y += lineSize;
  ctx.fillText(content.listTitle, left, y);
  y += lineSize * 0.5;
  ctx.font = `600 ${lineSize}px ${FONT}`;
  const amountWidth = Math.max(...content.lines.map((l) => ctx.measureText(l.amount).width));
  for (const l of content.lines) {
    y += lineSize;
    ctx.font = `600 ${lineSize}px ${FONT}`;
    ctx.fillText(l.amount, left, y);
    ctx.font = `300 ${lineSize}px ${FONT}`;
    ctx.fillText(l.name, left + amountWidth + lineSize * 0.6, y);
    y += lineSize * 0.5;
  }
  y += gap3;

  ctx.font = `300 ${srcSize}px ${FONT}`;
  for (const line of srcLines) {
    y += srcSize;
    ctx.fillText(line, left, y);
    y += srcSize * 0.38;
  }

  // Footer: 480 × 6 white rule, 202 above the bottom; adamsmith.org beneath (58 @2048)
  const ruleTop = H - 202 * u;
  ctx.fillRect(left, ruleTop, 480 * u, 6 * u);
  const footSize = 58 * u;
  ctx.font = `400 ${footSize}px ${FONT}`;
  ctx.fillText('adamsmith.org', left, ruleTop + 6 * u + 22 * u + footSize * 0.95);
  return canvas;
}

function wrap(ctx, text, font, maxWidth) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

export async function downloadShareCard(content, logoSrc, filename) {
  const canvas = await drawShareCard(document.createElement('canvas'), content, logoSrc);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
