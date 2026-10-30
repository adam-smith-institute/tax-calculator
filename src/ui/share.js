// Share image, 1080 × 1350 (4:5), on a white ground.
//
// Based on the ASI Design System's Stat Card, as fractions of canvas width (2048 reference):
// 150px margins, the total as the numeral, and the footer rule (480 × 6) with adamsmith.org
// anchored 202px from the bottom. At ASI's request the card is white rather than blue (so the
// numeral and footer are ASI blue and the mark is the navy roundel, the system's version for
// light grounds), the mark sits in the footer at the bottom right (10% of width, above the
// system's 8% minimum) to give the content more room, and the three largest shares are a bar
// chart in the pie chart's colours with each one's share of all spending. The categories,
// colours and shares come from the data; none is hardcoded.

import { gbp } from './format.js?v=569d6163c9';

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
    bars: top.map((c) => ({ name: c.name, amount: gbp(c.yours), percent: `${(c.share * 100).toFixed(1)}% of spending`, value: c.yours, colour: c.colour || BLUE })),
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

  // Content box: 150 left/right, from the top margin down to 40px above the footer zone
  // (241 above the bottom @2048), which keeps clear of the rule and the mark beside it.
  const left = 150 * u;
  const width = W - 2 * left;
  const boxTop = 150 * u;
  const boxBottom = H - 241 * u - 40;

  // Sizes, all in step with the headline. Start large and step down until everything fits.
  let k = 1;
  let z;
  for (;; k -= 0.03) {
    const root = 66 * k;
    ctx.font = `600 100px ${FONT}`;
    const statSize = Math.min(3.8 * root, (width / ctx.measureText(content.stat).width) * 100);
    z = {
      root, statSize,
      headLines: wrap(ctx, content.headline, `600 ${root}px ${FONT}`, width),
      titleSize: 36 * k, nameSize: 38 * k, percentSize: 32 * k, amountSize: 46 * k, barH: 58 * k, srcSize: 25 * Math.max(k, 0.85),
    };
    z.srcLines = wrap(ctx, content.source, `300 ${z.srcSize}px ${FONT}`, width * 0.9);
    z.rowH = z.nameSize * 1.3 + 10 * k + z.barH;
    z.rowGap = 32 * k;
    z.heights = {
      stat: statSize * 0.95,
      gap1: 26 * k,
      head: z.headLines.length * root * 1.22,
      gap2: 60 * k,
      title: z.titleSize * 1.3,
      gap3: 26 * k,
      bars: content.bars.length * z.rowH + (content.bars.length - 1) * z.rowGap,
      gap4: 44 * k,
      src: z.srcLines.length * z.srcSize * 1.4,
    };
    z.total = Object.values(z.heights).reduce((a, b) => a + b, 0);
    if (z.total <= boxBottom - boxTop || k < 0.6) break;
  }
  const { root, statSize, headLines, titleSize, nameSize, percentSize, amountSize, barH, srcSize, srcLines, rowH, rowGap, heights, total } = z;
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
    ctx.fillStyle = GREY;
    ctx.font = `400 ${percentSize}px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(b.percent, left + width, y + nameSize);
    ctx.textAlign = 'left';
    const barY = y + nameSize * 1.3 + 10;
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

  // Mark, bottom right, centred on the footer. The SVG carries ~3% padding, so the box is
  // drawn at diameter / 0.94 and the visible mark lines up with the right margin.
  const visible = 0.1 * W;
  const box = visible / 0.94;
  const footerMid = ruleTop + (6 * u + 22 * u + footSize * 1.3) / 2;
  const logoX = W - left - visible - (box - visible) / 2;
  const logoY = footerMid - box / 2;
  ctx.drawImage(logo, logoX, logoY, box, box);
  const mark = { x: logoX + (box - visible) / 2, y: logoY + (box - visible) / 2, size: visible };
  return { canvas, bars: placed, contentBottom: y, footerTop: ruleTop, mark };
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
