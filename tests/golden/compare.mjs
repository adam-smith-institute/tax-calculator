// Field-by-field comparison of two engine results: numbers must agree to within half a
// penny, everything else exactly. Returns a list of human-readable differences.
// The `detail` block (band-by-band slices for the breakdown table) is presentation, checked
// by the worked examples, so it is not part of the golden master.

export function differences(expected, actual, path = '', out = []) {
  if (path === 'detail') return out;
  if (typeof expected === 'number') {
    if (typeof actual !== 'number' || !(Math.abs(expected - actual) < 0.005)) out.push(`${path}: expected ${expected}, got ${actual}`);
  } else if (expected && typeof expected === 'object') {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual || {})]);
    for (const k of keys) differences(expected[k], actual?.[k], path ? `${path}.${k}` : k, out);
  } else if (expected !== actual) {
    out.push(`${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  return out;
}
