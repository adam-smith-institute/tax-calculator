// "Where it goes": a donut chart of the user's tax shared across spending, with a legend that
// doubles as the accessible interface. Selecting a category (legend button or slice) shows its
// sub-categories in the same chart; "All spending" goes back. Colours come from the taxonomy.

import { allocate } from './spending-data.js';
import { gbp, penceInPound, billions } from './format.js';

const SVG = 'http://www.w3.org/2000/svg';
const SIZE = 320;
const C = SIZE / 2;
const R_OUT = 156;
const R_IN = 98;

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  n.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return n;
}
function svg(tag, attrs = {}) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

// Donut slice from angle a0 to a1 (radians, clockwise from 12 o'clock)
function slicePath(a0, a1) {
  const p = (r, a) => `${(C + r * Math.sin(a)).toFixed(3)} ${(C - r * Math.cos(a)).toFixed(3)}`;
  if (a1 - a0 >= 2 * Math.PI - 1e-6) {
    const m = a0 + Math.PI;
    return `M${p(R_OUT, a0)}A${R_OUT} ${R_OUT} 0 1 1 ${p(R_OUT, m)}A${R_OUT} ${R_OUT} 0 1 1 ${p(R_OUT, a0)}`
      + `M${p(R_IN, a0)}A${R_IN} ${R_IN} 0 1 0 ${p(R_IN, m)}A${R_IN} ${R_IN} 0 1 0 ${p(R_IN, a0)}Z`;
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(R_OUT, a0)}A${R_OUT} ${R_OUT} 0 ${large} 1 ${p(R_OUT, a1)}L${p(R_IN, a1)}A${R_IN} ${R_IN} 0 ${large} 0 ${p(R_IN, a0)}Z`;
}

export function buildPie({ root, tableBody, data }) {
  const palette = data.categories.map((c) => c.colour || '#134079');
  let level = null; // null: all spending; otherwise a category id
  let total = 0;

  const chart = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'pie-svg', role: 'img', focusable: 'false' });
  const slices = svg('g');
  const centreValue = svg('text', { x: C, y: C - 2, 'text-anchor': 'middle', class: 'pie-centre-value' });
  const centreLabel = svg('text', { x: C, y: C + 26, 'text-anchor': 'middle', class: 'pie-centre-label' });
  chart.append(slices, centreValue, centreLabel);

  const head = el('div', { class: 'pie-head' });
  const legend = el('div', { class: 'legend' });
  root.replaceChildren(el('div', { class: 'pie-layout' }, el('div', { class: 'pie-figure' }, chart), el('div', { class: 'pie-side' }, head, legend)));

  const highlight = (i) => {
    root.querySelectorAll('[data-i]').forEach((n) => n.classList.toggle('is-hot', i !== null && n.dataset.i === String(i)));
    root.classList.toggle('has-hot', i !== null);
  };

  function draw(items, centreText, centreSub, onSlice) {
    slices.replaceChildren();
    const positive = items.filter((x) => x.amount > 0);
    const sum = positive.reduce((s, x) => s + x.amount, 0);
    let a = 0;
    positive.forEach((x) => {
      const a1 = a + (x.amount / sum) * 2 * Math.PI;
      const path = svg('path', { d: slicePath(a, a1), fill: x.colour, 'data-i': x.i, class: 'slice' });
      path.addEventListener('mouseenter', () => highlight(x.i));
      path.addEventListener('mouseleave', () => highlight(null));
      if (onSlice) path.addEventListener('click', () => onSlice(x));
      slices.append(path);
      a = a1;
    });
    centreValue.textContent = centreText;
    centreValue.setAttribute('font-size', centreText.length > 8 ? 34 : 40);
    centreLabel.textContent = centreSub;
  }

  function showAll(focusId) {
    level = null;
    const cats = allocate(total, data).map((c, i) => ({ ...c, i, colour: palette[i] }));
    chart.setAttribute('aria-label', `Pie chart: your ${gbp(total)} shared across ${cats.length} areas of spending. The list beside it gives each figure.`);
    draw(cats, gbp(total), 'your tax', (x) => showCategory(x.id));
    head.replaceChildren(el('div', { class: 'legend-columns', 'aria-hidden': 'true' },
      el('span', { text: 'Select an area to see what it covers' }), el('span', { text: 'Your tax' }), el('span', { text: 'In £1' })));
    legend.replaceChildren(el('ul', { class: 'legend-list' }, ...cats.map((c) => {
      const b = el('button', { type: 'button', class: 'legend-item', 'data-i': c.i, 'data-id': c.id },
        el('span', { class: 'swatch', style: `background:${c.colour}`, 'aria-hidden': 'true' }),
        el('span', { class: 'legend-name', text: c.name }),
        el('span', { class: 'legend-amount', text: gbp(c.yours) }),
        el('span', { class: 'legend-pence', text: penceInPound(c.share) }),
        el('span', { class: 'visually-hidden', text: ` in every £1. Show what ${c.name} covers.` }));
      b.addEventListener('click', () => showCategory(c.id));
      b.addEventListener('mouseenter', () => highlight(c.i));
      b.addEventListener('mouseleave', () => highlight(null));
      b.addEventListener('focus', () => highlight(c.i));
      b.addEventListener('blur', () => highlight(null));
      return el('li', {}, b);
    })));
    if (focusId) legend.querySelector(`[data-id="${focusId}"]`)?.focus();
  }

  function showCategory(id, focus = true) {
    level = id;
    const all = allocate(total, data);
    const ci = all.findIndex((c) => c.id === id);
    const cat = all[ci];
    const kids = cat.children.map((k, j) => ({ ...k, i: j, colour: palette[(ci + j) % palette.length] }));
    chart.setAttribute('aria-label', `Pie chart: ${cat.name}, ${gbp(cat.yours)} of your tax, split into ${kids.length} parts. The list beside it gives each figure.`);
    draw(kids, gbp(cat.yours), cat.name.length > 22 ? 'of your tax' : cat.name.toLowerCase(), null);
    const back = el('button', { type: 'button', class: 'back-button', text: '← All spending' });
    back.addEventListener('click', () => showAll(id));
    const title = el('h3', { class: 'pie-title', tabindex: '-1', text: cat.name });
    head.replaceChildren(back, title,
      el('p', { class: 'pie-sub', text: `${gbp(cat.yours)} of your tax, ${penceInPound(cat.share)} in every £1. ${cat.description}` }),
      el('div', { class: 'legend-columns', 'aria-hidden': 'true' }, el('span', { text: 'Part' }), el('span', { text: 'Your tax' }), el('span', { text: 'In £1' })));
    legend.replaceChildren(el('ul', { class: 'legend-list legend-list-detail' }, ...kids.map((k) => {
      const row = el('div', { class: 'legend-item legend-static', 'data-i': k.i },
        el('span', { class: 'swatch', style: `background:${k.amount > 0 ? k.colour : 'transparent'}`, 'aria-hidden': 'true' }),
        el('span', { class: 'legend-name', text: k.name }),
        el('span', { class: 'legend-amount', text: gbp(k.yours) }),
        el('span', { class: 'legend-pence', text: penceInPound(k.share) }),
        k.description || k.amount < 0
          ? el('span', { class: 'legend-desc', text: [k.description, k.amount < 0 ? 'A net receipt, so not shown in the chart.' : ''].filter(Boolean).join(' ') })
          : null);
      row.addEventListener('mouseenter', () => highlight(k.i));
      row.addEventListener('mouseleave', () => highlight(null));
      return el('li', {}, row);
    })));
    if (focus) title.focus();
  }

  function fillTable() {
    const rows = [];
    for (const c of allocate(total, data)) {
      rows.push(el('tr', { class: 'cat-row' }, el('th', { scope: 'row', text: c.name }), el('td', { class: 'num', text: gbp(c.yours) }),
        el('td', { class: 'num', text: penceInPound(c.share) }), el('td', { class: 'num', text: billions(c.amount) })));
      for (const k of c.children) {
        rows.push(el('tr', { class: 'sub-row' }, el('th', { scope: 'row', text: k.name }), el('td', { class: 'num', text: gbp(k.yours) }),
          el('td', { class: 'num', text: penceInPound(k.share) }), el('td', { class: 'num', text: billions(k.amount) })));
      }
    }
    tableBody.replaceChildren(...rows);
  }

  return {
    update(totalTax) {
      total = totalTax;
      if (level) showCategory(level, false); else showAll();
      fillTable();
    },
  };
}
