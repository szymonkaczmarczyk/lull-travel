

const SITE = process.env.SITE_URL || 'http://localhost:3000';
const NAME = 'LULL';

const escAttr = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));


export function clamp(text, max = 165) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return s.slice(0, s.lastIndexOf(' ', max - 1)).replace(/[,.;:]$/, '') + '…';
}

export function metaTags({ title, description, path = '/', type = 'website', noindex = false }) {
  const url = SITE + path;
  const full = title === NAME ? title : `${title} — ${NAME}`;

  return [
    `<title>${escAttr(full)}</title>`,
    `<meta name="description" content="${escAttr(description)}">`,
    `<link rel="canonical" href="${escAttr(url)}">`,
    noindex ? '<meta name="robots" content="noindex">' : '',
    `<meta property="og:type" content="${escAttr(type)}">`,
    `<meta property="og:site_name" content="${NAME}">`,
    `<meta property="og:title" content="${escAttr(full)}">`,
    `<meta property="og:description" content="${escAttr(description)}">`,
    `<meta property="og:url" content="${escAttr(url)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escAttr(full)}">`,
    `<meta name="twitter:description" content="${escAttr(description)}">`,
  ]
    .filter(Boolean)
    .join('\n');
}

export { SITE, NAME };
