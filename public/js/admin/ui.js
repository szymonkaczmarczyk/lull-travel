import { esc } from '../api.js';
import { statusOf } from './state.js';

export { esc };

const svg = (d, size = 15) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="${d}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const ICON = {
  arrow: svg('M3 8h10M9 4l4 4-4 4'),
  back: svg('M13 8H3M7 4 3 8l4 4'),
  plus: svg('M8 3v10M3 8h10'),
  trash: svg('M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5', 14),
  out: svg('M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5', 14),
  down: svg('M8 3v8M4.5 7.5 8 11l3.5-3.5M3 13h10', 14),
  send: svg('M2.5 8 13.5 3 10 13.5 7.5 9 2.5 8Z', 14),
};

export const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

export function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return 'yesterday';
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return fmtDate(iso);
}

export function statusTag(key) {
  const s = statusOf(key);
  return `<span class="adm-status" data-tone="${esc(s?.tone || 'muted')}">${esc(s?.label || key)}</span>`;
}

export function head({ crumbs = [], title, sub = '', actions = '' }) {
  document.title = `${String(title).replace(/\.$/, '')} — LULL admin`;
  const trail = crumbs
    .map(([href, label]) => (href ? `<a href="${esc(href)}">${esc(label)}</a>` : `<span>${esc(label)}</span>`))
    .join('<span>/</span>');
  return `
    <header class="adm-head adm-fade">
      <div class="adm-head__text">
        ${trail ? `<nav class="adm-crumbs" aria-label="Breadcrumb">${trail}</nav>` : ''}
        <h1 class="adm-title">${esc(title)}</h1>
        ${sub ? `<p class="adm-sub">${sub}</p>` : ''}
      </div>
      ${actions ? `<div class="adm-actions">${actions}</div>` : ''}
    </header>`;
}

export function toast(message, tone = 'teal') {
  const host = document.querySelector('[data-toasts]');
  if (!host) return;
  const el = document.createElement('div');
  el.className = 'adm-toast';
  el.dataset.tone = tone;
  el.textContent = message;
  host.append(el);
  setTimeout(() => {
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 320);
  }, tone === 'danger' ? 6000 : 3200);
}

export function failToast(err) {
  toast(err?.data?.error || err?.message || 'Something went wrong.', 'danger');
}

export function confirmDialog({ title, body, confirm = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = 'adm-dialog';
    dialog.innerHTML = `
      <h2 class="adm-h2">${esc(title)}</h2>
      <p>${esc(body)}</p>
      <form method="dialog" class="adm-dialog__actions">
        <button class="btn btn--ghost btn--sm" value="no">Cancel</button>
        <button class="btn btn--sm ${danger ? 'btn--danger' : ''}" value="yes">${esc(confirm)}</button>
      </form>`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'yes');
      dialog.remove();
    });
    dialog.showModal();
  });
}

export function clearErrors(root) {
  root.querySelectorAll('.has-error').forEach((f) => f.classList.remove('has-error'));
  root.querySelectorAll('[data-error]').forEach((e) => { e.textContent = ''; });
}

export function showErrors(root, fields = {}, fallback) {
  let first = null;
  const unplaced = [];
  for (const [key, msg] of Object.entries(fields)) {
    const f = root.querySelector(`[data-field="${CSS.escape(key)}"]`);
    if (!f) {
      unplaced.push(msg);
      continue;
    }
    f.classList.add('has-error');
    const slot = f.querySelector('[data-error]');
    if (slot) slot.textContent = msg;
    first ??= f;
  }
  first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (unplaced.length) toast(unplaced.join(' '), 'danger');
  else if (!first && fallback) toast(fallback, 'danger');
}

export const skeletonRows = (n = 5) =>
  Array.from({ length: n }, () => '<div class="skeleton adm-skeleton"></div>').join('');

export const empty = (title, text = '') => `<div class="adm-empty"><strong>${esc(title)}</strong>${esc(text)}</div>`;

export function slugify(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function field({ key, label, control, hint = '', wide = false }) {
  return `
    <div class="field${wide ? ' is-wide' : ''}" data-field="${esc(key)}">
      ${label ? `<label class="field__label" for="f-${esc(key)}">${esc(label)}</label>` : ''}
      ${control}
      ${hint ? `<span class="field__hint">${esc(hint)}</span>` : ''}
      <span class="field__error" data-error></span>
    </div>`;
}

export function options(list, selected, { empty: emptyLabel } = {}) {
  return (
    (emptyLabel !== undefined ? `<option value="">${esc(emptyLabel)}</option>` : '') +
    list
      .map(([value, label]) => `<option value="${esc(value)}"${String(value) === String(selected ?? '') ? ' selected' : ''}>${esc(label)}</option>`)
      .join('')
  );
}

export function switchInput({ name, checked, label }) {
  return `
    <label class="adm-switch">
      <input type="checkbox" name="${esc(name)}"${checked ? ' checked' : ''}>
      <span class="adm-switch__track"></span>
      <span>${esc(label)}</span>
    </label>`;
}
