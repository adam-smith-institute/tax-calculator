// Loads data/spending.json (same origin, refreshed by the weekly pipeline). If that fails,
// falls back to the snapshot bundled with the code at the last build.

import fallback from '../spending/fallback.js?v=569d6163c9';

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

// The user's tax shared across categories in proportion to spending. The base is the
// Treasury's total expenditure on services less the spending the taxonomy excludes as not
// paid for by the taxes the calculator models (older data files have no base: use TES).
export function allocate(totalTax, data) {
  const base = data.meta.base ?? data.meta.tes;
  const share = (amount) => ({ share: amount / base, yours: totalTax * (amount / base) });
  return data.categories.map((c) => ({
    ...c,
    ...share(c.amount),
    children: c.children
      .filter((ch) => ch.amount !== 0)
      .map((ch) => ({ ...ch, ...share(ch.amount), notable: (ch.notable || []).map((n) => ({ ...n, ...share(n.amount) })) })),
  }));
}
