// "Where your tax goes": a ranked horizontal bar chart. Each row is a disclosure button
// that opens its sub-categories inline. The chart is built once per data set; update()
// refreshes the £ figures as the inputs change. A table alternative carries the same data.

import { allocate } from './spending-data.js';
import { gbp, penceInPound, billions } from './format.js';

const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style') n.style.cssText = v;
    else n.setAttribute(k, v);
  }
  n.append(...children.filter(Boolean));
  return n;
};

export function buildSpendingChart({ list, tableBody, data }) {
  const cats = allocate(0, data);
  const max = Math.max(...cats.map((c) => c.amount));
  const figures = new Map(); // id -> element showing "£X · Yp in every £1"
  const tableCells = new Map(); // id -> cell showing £X
  list.replaceChildren();
  tableBody.replaceChildren();

  for (const c of cats) {
    const detailId = `spend-${c.id}`;
    const fig = el('span', { class: 'bar-figures' });
    figures.set(c.id, fig);
    const button = el('button', { type: 'button', class: 'bar-toggle', 'aria-expanded': 'false', 'aria-controls': detailId },
      el('span', { class: 'bar-head' }, el('span', { class: 'bar-name', text: c.name }), fig),
      el('span', { class: 'bar-track', 'aria-hidden': 'true' }, el('span', { class: 'bar-fill', style: `width:${Math.max(0, (c.amount / max) * 100).toFixed(2)}%` })),
      el('span', { class: 'bar-more', 'aria-hidden': 'true' }),
    );
    const subs = el('ul', { class: 'sub-bars' });
    const subMax = Math.max(...c.children.map((ch) => ch.amount));
    for (const ch of c.children) {
      const f = el('span', { class: 'bar-figures' });
      figures.set(`${c.id}/${ch.id}`, f);
      subs.append(el('li', { class: 'sub-bar' },
        el('span', { class: 'bar-head' }, el('span', { class: 'bar-name', text: ch.name }), f),
        el('span', { class: 'bar-track', 'aria-hidden': 'true' }, el('span', { class: 'bar-fill sub', style: `width:${Math.max(0, (ch.amount / subMax) * 100).toFixed(2)}%` })),
        ch.description ? el('span', { class: 'sub-desc', text: ch.description }) : null,
      ));
    }
    const detail = el('div', { class: 'bar-detail', id: detailId, hidden: '' },
      el('p', { class: 'bar-desc', text: c.description }),
      subs,
    );
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      detail.hidden = !open;
    });
    list.append(el('li', { class: 'bar' }, button, detail));

    // Table alternative
    const cell = el('td', { class: 'num' });
    tableCells.set(c.id, cell);
    tableBody.append(el('tr', { class: 'cat-row' },
      el('th', { scope: 'row', text: c.name }), cell,
      el('td', { class: 'num', text: penceInPound(c.share) }),
      el('td', { class: 'num', text: billions(c.amount) })));
    for (const ch of c.children) {
      const sc = el('td', { class: 'num' });
      tableCells.set(`${c.id}/${ch.id}`, sc);
      tableBody.append(el('tr', { class: 'sub-row' },
        el('th', { scope: 'row', text: ch.name }), sc,
        el('td', { class: 'num', text: penceInPound(ch.share) }),
        el('td', { class: 'num', text: billions(ch.amount) })));
    }
  }

  return {
    update(totalTax) {
      for (const c of allocate(totalTax, data)) {
        figures.get(c.id).textContent = `${gbp(c.yours)} · ${penceInPound(c.share)} in every £1`;
        tableCells.get(c.id).textContent = gbp(c.yours);
        for (const ch of c.children) {
          figures.get(`${c.id}/${ch.id}`).textContent = `${gbp(ch.yours)} · ${penceInPound(ch.share)}`;
          tableCells.get(`${c.id}/${ch.id}`).textContent = gbp(ch.yours);
        }
      }
    },
  };
}
