// Share image, 1080 × 1350 (4:5), on a white ground.
//
// Layout follows the ASI Design System's Stat Card, as fractions of canvas width (2048
// reference): mark top-right at 12.5% of width with a 2% margin, 150px margins, the total as
// the numeral, and the footer rule (480 × 6) with adamsmith.org anchored 202px from the
// bottom. At ASI's request the card is white rather than blue, so the numeral and footer are
// ASI blue, the mark is the navy roundel (the system's version for light grounds), and the
// three largest shares are a bar chart in the same colours as the pie chart. The categories
// and colours come from the data; none is hardcoded.

import { gbp } from './format.js?v=b0d6b5eba7';

const W = 1080;
const H = 1350;
const u = W / 2048;
const BLUE = '#134079';
const INK = '#161616';
const GREY = '#52585e';
const WHITE = '#FFFFFF';
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
    chartTitle: 'The three biggest shares',
    bars: top.map((c) => ({ name: c.name, amount: gbp(c.yours), value: c.yours, colour: c.colour || BLUE })),
    source: `Spending shares from HM Treasury, ${spendingMeta.title} (${spendingMeta.fiscalYear} outturn).`,
  };
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

/**
 * Draw the card. Returns the canvas and the position of each bar (used by the tests).
 */
export async function drawShareCard(canvas, content, logoSrc) {
  await document.fonts.ready;
  await Promise.all([300, 400, 600].map((w) => document.fonts.load(`${w} 100px ${FONT}`)));
  const logo = await loadImage(logoSrc);

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = WHITE;
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

  // Sizes
  const root = 58; // headline
  ctx.font = `600 100px ${FONT}`;
  const statSize = Math.min(3.6 * root, (width / ctx.measureText(content.stat).width) * 100);
  const headLines = wrap(ctx, content.headline, `600 ${root}px ${FONT}`, width);
  const titleSize = 32;
  const nameSize = 32;
  const amountSize = 38;
  const barH = 42;
  const srcSize = 24;
  const srcLines = wrap(ctx, content.source, `300 ${srcSize}px ${FONT}`, width * 0.9);

  // Each bar row: name, then the bar with its amount at the end
  const rowH = nameSize * 1.3 + 8 + barH;
  const rowGap = 24;
  const heights = {
    stat: statSize * 0.95,
    gap1: 22,
    head: headLines.length * root * 1.22,
    gap2: 52,
    title: titleSize * 1.3,
    gap3: 22,
    bars: content.bars.length * rowH + (content.bars.length - 1) * rowGap,
    gap4: 44,
    src: srcLines.length * srcSize * 1.4,
  };
  const total = Object.values(heights).reduce((a, b) => a + b, 0);
  let y = boxTop + Math.max(0, (boxBottom - boxTop - total) / 2);

  // Numeral
  ctx.fillStyle = BLUE;
  ctx.font = `600 ${statSize}px ${FONT}`;
  ctx.fillText(content.stat, left - statSize * 0.03, y + statSize * 0.8);
  y += heights.stat + heights.gap1;

  // Headline
  ctx.fillStyle = INK;
  ctx.font = `600 ${root}px ${FONT}`;
  for (const line of headLines) { ctx.fillText(line, left, y + root * 0.95); y += root * 1.22; }
  y += heights.gap2;

  // Chart title and a hairline under it
  ctx.fillStyle = GREY;
  ctx.font = `400 ${titleSize}px ${FONT}`;
  ctx.fillText(content.chartTitle, left, y + titleSize);
  y += heights.title;
  ctx.fillStyle = '#c9cdd2';
  ctx.fillRect(left, y + 6, width, 2);
  y += heights.gap3;

  // Bars, scaled to the largest, with the amount just past the end of each
  ctx.font = `600 ${amountSize}px ${FONT}`;
  const amountRoom = Math.max(...content.bars.map((b) => ctx.measureText(b.amount).width)) + 20;
  const maxBar = width - amountRoom;
  const maxValue = Math.max(...content.bars.map((b) => b.value), 1);
  const placed = [];
  for (const b of content.bars) {
    ctx.fillStyle = INK;
    ctx.font = `400 ${nameSize}px ${FONT}`;
    ctx.fillText(b.name, left, y + nameSize);
    const barY = y + nameSize * 1.3 + 8;
    const barW = Math.max(6, (b.value / maxValue) * maxBar);
    ctx.fillStyle = b.colour;
    ctx.fillRect(left, barY, barW, barH);
    ctx.fillStyle = INK;
    ctx.font = `600 ${amountSize}px ${FONT}`;
    ctx.fillText(b.amount, left + barW + 16, barY + barH / 2 + amountSize * 0.36);
    placed.push({ x: left, y: barY, w: barW, h: barH, colour: b.colour });
    y += rowH + rowGap;
  }
  y += heights.gap4 - rowGap;

  // Source
  ctx.fillStyle = GREY;
  ctx.font = `300 ${srcSize}px ${FONT}`;
  for (const line of srcLines) { ctx.fillText(line, left, y + srcSize); y += srcSize * 1.4; }

  // Footer: 480 × 6 rule, 202 above the bottom; adamsmith.org beneath (58 @2048)
  const ruleTop = H - 202 * u;
  ctx.fillStyle = BLUE;
  ctx.fillRect(left, ruleTop, 480 * u, 6 * u);
  const footSize = 58 * u;
  ctx.font = `400 ${footSize}px ${FONT}`;
  ctx.fillText('adamsmith.org', left, ruleTop + 6 * u + 22 * u + footSize * 0.95);
  return { canvas, bars: placed, contentBottom: y, footerTop: ruleTop };
}

export async function downloadShareCard(content, logoSrc, filename) {
  const { canvas } = await drawShareCard(document.createElement('canvas'), content, logoSrc);
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
