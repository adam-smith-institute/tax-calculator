// Loads data/spending.json (same origin, refreshed by the weekly pipeline). If that fails,
// falls back to the snapshot bundled with the code at the last build.

import fallback from '../spending/fallback.js?v=c0cbe7020e';

export async function loadSpending(url = 'data/spending.json') {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.categories) || !data.categories.length) throw new Error('no categories');
    return { data, live: true };
  } catch (e) {
    console.warn(`Spending data: using the bundled snapshot (${e.message})`);
    return { data: fallback, live: false };
  }
}

// The user's tax shared across categories in proportion to spending (over TES)
export function allocate(totalTax, data) {
  const tes = data.meta.tes;
  return data.categories.map((c) => ({
    ...c,
    share: c.amount / tes,
    yours: totalTax * (c.amount / tes),
    children: c.children
      .filter((ch) => ch.amount !== 0)
      .map((ch) => ({ ...ch, share: ch.amount / tes, yours: totalTax * (ch.amount / tes) })),
  }));
}
