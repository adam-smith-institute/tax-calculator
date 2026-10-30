// "Where it goes": a donut chart of the user's tax shared across spending, with a legend that
// doubles as the accessible interface. Selecting a category (legend button or slice) shows its
// parts in the same chart; "All spending" goes back. Colours come from the taxonomy.
//
// Motion: the chart sweeps in when shown. Opening a category grows its slice to fill the ring,
// then splits it into its parts (the first part shares the category's colour, so the split is
// seamless); going back runs the same in reverse. Users who ask for reduced motion get the end
// state at once.

import { allocate } from './spending-data.js?v=0556e22a68';
import { gbp, penceInPound, billions } from './format.js?v=0556e22a68';

const SVG = 'http://www.w3.org/2000/svg';
const SIZE = 320;
const C = SIZE / 2;
const R_OUT = 156;
const R_IN = 98;
const TAU = 2 * Math.PI;
const SWEEP_MS = 750;
const GROW_MS = 380;
const SPLIT_MS = 520;

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
  if (a1 - a0 < 1e-4) return '';
  const p = (r, a) => `${(C + r * Math.sin(a)).toFixed(3)} ${(C - r * Math.cos(a)).toFixed(3)}`;
  if (a1 - a0 >= TAU - 1e-6) {
    const m = a0 + Math.PI;
    return `M${p(R_OUT, a0)}A${R_OUT} ${R_OUT} 0 1 1 ${p(R_OUT, m)}A${R_OUT} ${R_OUT} 0 1 1 ${p(R_OUT, a0)}`
      + `M${p(R_IN, a0)}A${R_IN} ${R_IN} 0 1 0 ${p(R_IN, m)}A${R_IN} ${R_IN} 0 1 0 ${p(R_IN, a0)}Z`;
  }
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${p(R_OUT, a0)}A${R_OUT} ${R_OUT} 0 ${large} 1 ${p(R_OUT, a1)}L${p(R_IN, a1)}A${R_IN} ${R_IN} 0 ${large} 0 ${p(R_IN, a0)}Z`;
}

// Start and end angles for items in order, proportional to their positive amounts
function layout(items) {
  const sum = items.reduce((s, x) => s + Math.max(0, x.amount), 0) || 1;
  let a = 0;
  return new Map(items.map((x) => {
    const a1 = a + (Math.max(0, x.amount) / sum) * TAU;
    const span = [a, a1];
    a = a1;
    return [x.key, span];
  }));
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // ease-in-out cubic
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function buildPie({ root, tableBody, data }) {
  const palette = data.categories.map((c) => c.colour || '#134079');
  let total = 0;
  let level = null; // null: all spending; otherwise a category id
  let busy = false;
  let animation = 0;
  let figures = []; // elements showing £ figures in the current legend, refreshed as inputs change

  const chart = svg('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, class: 'pie-svg', role: 'img', focusable: 'false' });
  const slices = svg('g');
  const centre = svg('g', { class: 'pie-centre' });
  const centreValue = svg('text', { x: C, y: C - 2, 'text-anchor': 'middle', class: 'pie-centre-value' });
  const centreLabel = svg('text', { x: C, y: C + 26, 'text-anchor': 'middle', class: 'pie-centre-label' });
  centre.append(centreValue, centreLabel);
  chart.append(slices, centre);

  const head = el('div', { class: 'pie-head' });
  const legend = el('div', { class: 'legend' });
  root.replaceChildren(el('div', { class: 'pie-layout' }, el('div', { class: 'pie-figure' }, chart), el('div', { class: 'pie-side' }, head, legend)));

  // Slices are SVG paths keyed by category or part id
  let paths = new Map();
  function setSlices(items, onClick) {
    slices.replaceChildren();
    paths = new Map(items.map((x) => {
      const path = svg('path', { fill: x.colour, 'data-i': x.i, class: 'slice' });
      path.addEventListener('mouseenter', () => highlight(x.i));
      path.addEventListener('mouseleave', () => highlight(null));
      if (onClick) path.addEventListener('click', () => onClick(x));
      slices.append(path);
      return [x.key, path];
    }));
  }
  function paint(angles) {
    for (const [key, path] of paths) {
      const [a0, a1] = angles.get(key) || [0, 0];
      path.setAttribute('d', slicePath(a0, a1));
    }
  }
  // Animate every slice from one set of angles to another
  function tween(from, to, ms) {
    const id = ++animation;
    if (reducedMotion() || ms <= 0) { paint(to); return Promise.resolve(); }
    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        if (id !== animation) return resolve();
        const t = Math.min(1, (now - start) / ms);
        const k = ease(t);
        const at = new Map();
        for (const key of paths.keys()) {
          const [f0, f1] = from.get(key) || [0, 0];
          const [t0, t1] = to.get(key) || [0, 0];
          at.set(key, [f0 + (t0 - f0) * k, f1 + (t1 - f1) * k]);
        }
        paint(at);
        if (t < 1) requestAnimationFrame(frame); else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  const highlight = (i) => {
    root.querySelectorAll('[data-i]').forEach((n) => n.classList.toggle('is-hot', i !== null && n.dataset.i === String(i)));
    root.classList.toggle('has-hot', i !== null);
  };

  const sizeCentre = () => centreValue.setAttribute('font-size', centreValue.textContent.length > 8 ? 34 : 40);
  function setCentre(value, label, fade = true) {
    const apply = () => { centreValue.textContent = value; centreLabel.textContent = label; sizeCentre(); };
    if (!fade || reducedMotion()) { apply(); return; }
    centre.classList.add('is-fading');
    setTimeout(() => { apply(); centre.classList.remove('is-fading'); }, 160);
  }

  // Items for each level, with the user's share of each
  const topItems = () => allocate(total, data).map((c, i) => ({ ...c, key: c.id, i, colour: palette[i] }));
  function partItems(id) {
    const cats = allocate(total, data);
    const ci = cats.findIndex((c) => c.id === id);
    return { cat: cats[ci], items: cats[ci].children.map((k, j) => ({ ...k, key: `${id}/${k.id}`, i: j, colour: palette[(ci + j) % palette.length] })) };
  }

  // One slice filling the ring and the others squeezed to points either side of it
  function collapsedOnto(items, key) {
    const idx = items.findIndex((x) => x.key === key);
    return new Map(items.map((x, j) => [x.key, j < idx ? [0, 0] : j === idx ? [0, TAU] : [TAU, TAU]]));
  }

  // Legend rows enter with a short staggered fade
  const enter = (rows) => rows.forEach((r, j) => { r.style.animationDelay = `${Math.min(j, 14) * 22}ms`; r.classList.add('enter'); });

  function legendTop(focusId) {
    const items = topItems();
    chart.setAttribute('aria-label', `Pie chart: your ${gbp(total)} shared across ${items.length} areas of spending. The list beside it gives each figure.`);
    head.replaceChildren(el('div', { class: 'legend-columns', 'aria-hidden': 'true' },
      el('span', { text: 'Select an area to see what it covers' }), el('span', { text: 'Your tax' }), el('span', { text: 'In £1' })));
    figures = [];
    const rows = items.map((c) => {
      const amount = el('span', { class: 'legend-amount' });
      figures.push({ amount, key: c.key });
      const b = el('button', { type: 'button', class: 'legend-item', 'data-i': c.i, 'data-id': c.id },
        el('span', { class: 'swatch', style: `background:${c.colour}`, 'aria-hidden': 'true' }),
        el('span', { class: 'legend-name', text: c.name }), amount,
        el('span', { class: 'legend-pence', text: penceInPound(c.share) }),
        el('span', { class: 'visually-hidden', text: ` in every £1. Show what ${c.name} covers.` }));
      b.addEventListener('click', () => openCategory(c.id));
      b.addEventListener('mouseenter', () => highlight(c.i));
      b.addEventListener('mouseleave', () => highlight(null));
      b.addEventListener('focus', () => highlight(c.i));
      b.addEventListener('blur', () => highlight(null));
      return el('li', {}, b);
    });
    legend.replaceChildren(el('ul', { class: 'legend-list' }, ...rows));
    enter(rows);
    refreshFigures();
    if (focusId) legend.querySelector(`[data-id="${focusId}"]`)?.focus();
  }

  function legendCategory(id) {
    const { cat, items } = partItems(id);
    chart.setAttribute('aria-label', `Pie chart: ${cat.name}, ${gbp(cat.yours)} of your tax, split into ${items.length} parts. The list beside it gives each figure.`);
    const back = el('button', { type: 'button', class: 'back-button', text: '← All spending' });
    back.addEventListener('click', () => closeCategory());
    const title = el('h3', { class: 'pie-title', tabindex: '-1', text: cat.name });
    const sub = el('p', { class: 'pie-sub' });
    head.replaceChildren(back, title, sub,
      el('div', { class: 'legend-columns', 'aria-hidden': 'true' }, el('span', { text: 'Part' }), el('span', { text: 'Your tax' }), el('span', { text: 'In £1' })));
    figures = [{ sub, key: id }];
    const rows = items.map((k) => {
      const amount = el('span', { class: 'legend-amount' });
      figures.push({ amount, key: k.key });
      const row = el('div', { class: 'legend-item legend-static', 'data-i': k.i },
        el('span', { class: 'swatch', style: `background:${k.amount > 0 ? k.colour : 'transparent'}`, 'aria-hidden': 'true' }),
        el('span', { class: 'legend-name', text: k.name }), amount,
        el('span', { class: 'legend-pence', text: penceInPound(k.share) }),
        k.description || k.amount < 0
          ? el('span', { class: 'legend-desc', text: [k.description, k.amount < 0 ? 'A net receipt, so not shown in the chart.' : ''].filter(Boolean).join(' ') })
          : null);
      row.addEventListener('mouseenter', () => highlight(k.i));
      row.addEventListener('mouseleave', () => highlight(null));
      return el('li', {}, row);
    });
    legend.replaceChildren(el('ul', { class: 'legend-list legend-list-detail' }, ...rows));
    enter(rows);
    refreshFigures();
    return title;
  }

  // Update the £ figures in place as the inputs change (no re-render, no animation)
  function refreshFigures() {
    const yours = new Map();
    for (const c of allocate(total, data)) {
      yours.set(c.id, c);
      for (const k of c.children) yours.set(`${c.id}/${k.id}`, k);
    }
    for (const f of figures) {
      const x = yours.get(f.key);
      if (f.amount) f.amount.textContent = gbp(x.yours);
      if (f.sub) f.sub.textContent = `${gbp(x.yours)} of your tax, ${penceInPound(x.share)} in every £1. ${x.description}`;
    }
    if (!centre.classList.contains('is-fading')) {
      centreValue.textContent = gbp(level ? yours.get(level).yours : total);
      sizeCentre();
    }
  }

  async function openCategory(id) {
    if (busy) return;
    busy = true;
    level = id;
    const top = topItems();
    const { cat, items } = partItems(id);
    setCentre(gbp(cat.yours), cat.name.length > 22 ? 'of your tax' : cat.name.toLowerCase());
    legendCategory(id).focus();
    // Grow the chosen slice to fill the ring, then split it into its parts
    await tween(layout(top), collapsedOnto(top, id), GROW_MS);
    setSlices(items, null);
    await tween(collapsedOnto(items, items[0]?.key), layout(items), SPLIT_MS);
    busy = false;
  }

  async function closeCategory() {
    if (busy || !level) return;
    busy = true;
    const id = level;
    level = null;
    const { items } = partItems(id);
    const top = topItems();
    setCentre(gbp(total), 'your tax');
    legendTop(id);
    // Gather the parts back into one ring, then shrink it to its place among the rest
    await tween(layout(items), collapsedOnto(items, items[0]?.key), SPLIT_MS * 0.8);
    setSlices(top, (x) => openCategory(x.id));
    await tween(collapsedOnto(top, id), layout(top), GROW_MS * 1.2);
    busy = false;
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

  // First draw: the top level, complete, so it is right even if never animated
  let built = false;
  function build() {
    const top = topItems();
    setSlices(top, (x) => openCategory(x.id));
    paint(layout(top));
    setCentre(gbp(total), 'your tax', false);
    legendTop();
    built = true;
  }

  return {
    update(totalTax) {
      total = totalTax;
      if (!built) build(); else refreshFigures();
      fillTable();
    },
    // Sweep the chart in (called when its tab is shown)
    reveal() {
      if (busy) return;
      const items = level ? partItems(level).items : topItems();
      const to = layout(items);
      tween(new Map([...to.keys()].map((k) => [k, [0, 0]])), to, SWEEP_MS);
    },
  };
}
