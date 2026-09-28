

let inFlight = 0;

function bar() {
  return document.querySelector('.loadbar');
}

function barStart() {
  const el = bar();
  if (!el) return;
  inFlight += 1;
  el.classList.add('is-on');
  el.style.width = '62%';
}

function barDone() {
  const el = bar();
  if (!el) return;
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight) return;
  el.style.width = '100%';
  setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => { el.style.width = '0'; }, 300);
  }, 180);
}

export async function api(path, options) {
  barStart();
  try {
    const res = await fetch(`/api${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { status: res.status, data });
    return data;
  } finally {
    barDone();
  }
}



export const money = (n, currency = 'EUR') =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);

export const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });


export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );


export const tone = (pair = []) => `--t1:${pair[0] || '#2f4f5e'};--t2:${pair[1] || '#c98a5a'}`;


export function img(item, { size = 'card', eager = false, sizes = '(max-width: 720px) 92vw, (max-width: 1080px) 46vw, 30vw' } = {}) {
  if (!item?.image) return '';
  const name = esc(item.image);
  
  const srcset =
    size === 'card'
      ? ` srcset="/img/card-sm/${name}.jpg 500w, /img/card/${name}.jpg 900w" sizes="${esc(sizes)}"`
      : '';
  return `<img src="/img/${size}/${name}.jpg"${srcset} alt="${esc(item.alt || '')}"
    loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}>`;
}
