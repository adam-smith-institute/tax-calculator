// Auto-resize when embedded: tell the parent page our content height whenever it changes.
// The parent listens for { type: 'asi-tax-calculator:height' } (snippet in EMBED.md).

export function startAutoResize() {
  if (window.parent === window) return;
  let last = 0;
  const send = () => {
    const height = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (height === last) return;
    last = height;
    window.parent.postMessage({ type: 'asi-tax-calculator:height', height }, '*');
  };
  new ResizeObserver(send).observe(document.documentElement);
  window.addEventListener('load', send);
  send();
}
