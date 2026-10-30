// Number formatting in ASI house style (en-GB, £, thousands separators).

const whole = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const pence = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "£12,345" (negative as "−£12,345", with a true minus sign)
export function gbp(x) {
  const v = Math.round(x);
  return `${v < 0 ? '−' : ''}£${whole.format(Math.abs(v))}`;
}

// "£12,345.67"
export function gbpPence(x) {
  const v = Math.round(x * 100) / 100;
  return `${v < 0 ? '−' : ''}£${pence.format(Math.abs(v))}`;
}

// "21.4%"
export const percent = (x, dp = 1) => `${(x * 100).toFixed(dp)}%`;

// Rate as written in tax tables: 0.2 -> "20%", 0.1075 -> "10.75%"
export const rate = (r) => `${+(r * 100).toFixed(2)}%`;

// Share of £1 in pence: "21p" from 10p up, "4.6p" below
export function penceInPound(share) {
  const p = share * 100;
  return p >= 9.95 ? `${Math.round(p)}p` : `${p.toFixed(1)}p`;
}

// "£257.5 billion" in prose (house style); amounts in £ million
export const billions = (m) => `£${(m / 1000).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} billion`;

// Read a money field: accepts "45000", "45,000", "£45,000" and "45k"; blank is 0
export function parseMoney(text) {
  const s = String(text ?? '').trim().toLowerCase().replace(/[£,\s]/g, '');
  if (!s) return 0;
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m)?$/);
  if (!m) return NaN;
  return Number(m[1]) * (m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : 1);
}
