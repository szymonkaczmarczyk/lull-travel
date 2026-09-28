import { state, adm, send, loadSettings } from './state.js';
import { esc, head, field, clearErrors, showErrors, confirmDialog, failToast, ICON } from './ui.js';
import * as overview from './views/overview.js';
import * as enquiries from './views/enquiries.js';
import * as content from './views/content.js';
import * as settings from './views/settings.js';
import * as outbox from './views/outbox.js';

document.documentElement.classList.add('js');

const root = document.getElementById('admin');

const ROUTES = [
  [/^\/admin$/, (el) => overview.render(el)],
  [/^\/admin\/enquiries$/, (el) => enquiries.list(el)],
  [/^\/admin\/enquiries\/([^/]+)$/, (el, id) => enquiries.detail(el, id)],
  [/^\/admin\/content\/(stays|destinations|journal)$/, (el, c) => content.list(el, c)],
  [/^\/admin\/content\/(stays|destinations|journal)\/new$/, (el, c) => content.edit(el, c, null)],
  [/^\/admin\/content\/(stays|destinations|journal)\/([^/]+)$/, (el, c, slug) => content.edit(el, c, slug)],
  [/^\/admin\/settings(?:\/(mail|mailboxes|routing|statuses|templates))?$/, (el, tab) => settings.render(el, tab || 'routing')],
  [/^\/admin\/outbox$/, (el) => outbox.render(el)],
];

const NAV = [
  ['Inbox', [['/admin', 'Overview', true], ['/admin/enquiries', 'Enquiries'], ['/admin/outbox', 'Outbox']]],
  ['Content', [['/admin/content/stays', 'Stays'], ['/admin/content/destinations', 'Destinations'], ['/admin/content/journal', 'Journal']]],
  ['System', [['/admin/settings', 'Settings']]],
];

function renderLogin({ notice = '', off = false } = {}) {
  document.title = 'Sign in — LULL';
  root.innerHTML = `
    <div class="adm-login">
      <div class="adm-login__card rise">
        <a class="wordmark" href="/">Lull<i class="wordmark__dot"></i></a>
        <div>
          <p class="kicker">Staff only</p>
          <h1 class="adm-title" style="margin-top:16px">Sign in.</h1>
        </div>
        ${notice ? `<div class="adm-notice adm-notice--warm">${esc(notice)}</div>` : ''}
        <form class="adm-stack" data-login novalidate>
          ${field({ key: 'email', label: 'Email', control: '<input class="field__input" id="f-email" name="email" type="email" autocomplete="username" required>' })}
          ${field({ key: 'password', label: 'Password', control: '<input class="field__input" id="f-password" name="password" type="password" autocomplete="current-password" required>' })}
          <button class="btn btn--wide" type="submit" style="margin-top:6px"${off ? ' disabled' : ''}>Sign in ${ICON.arrow}</button>
        </form>
        <p class="adm-login__foot">Not staff? <a href="/">Back to the site</a>.</p>
      </div>
    </div>`;

  const form = root.querySelector('[data-login]');
  form.querySelector('input')?.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const btn = form.querySelector('button');
    btn.disabled = true;
    try {
      await send('/login', 'POST', Object.fromEntries(new FormData(form)));
      state.me = await adm('/me');
      await start();
    } catch (err) {
      showErrors(form, { password: err.data?.error || 'Could not sign in.' });
      btn.disabled = false;
    }
  });
}

function mountShell() {
  root.innerHTML = `
    <div class="adm-shell">
      <aside class="adm-side">
        <div class="adm-brand">
          <a class="wordmark" href="/admin">Lull<i class="wordmark__dot"></i></a>
          <span class="tag">Admin</span>
        </div>
        <nav class="adm-nav" aria-label="Admin">
          ${NAV.map(
            ([label, links]) => `
            <div class="adm-nav__group">
              <span class="adm-nav__label">${label}</span>
              ${links
                .map(
                  ([href, text, exact]) =>
                    `<a href="${href}" data-nav="${href}"${exact ? ' data-exact' : ''}>${text}${
                      href === '/admin/enquiries' ? '<span class="adm-count" data-badge hidden></span>' : ''
                    }</a>`
                )
                .join('')}
            </div>`
          ).join('')}
        </nav>
        <div class="adm-side__foot">
          <span class="adm-side__who" title="${esc(state.me.email)}">${esc(state.me.email)}</span>
          <div class="adm-side__links">
            <a href="/" target="_blank" rel="noopener">View site</a>
            <button type="button" data-signout>Sign out</button>
          </div>
        </div>
      </aside>
      <main class="adm-main" data-view></main>
    </div>`;

  root.querySelector('[data-signout]').addEventListener('click', async () => {
    try {
      await send('/logout', 'POST');
    } catch {}
    state.me = null;
    state.dirty = false;
    renderLogin();
  });
}

function markNav(path) {
  root.querySelectorAll('[data-nav]').forEach((a) => {
    const href = a.dataset.nav;
    const on = a.hasAttribute('data-exact') ? path === href : path === href || path.startsWith(`${href}/`);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

async function refreshBadge() {
  const badge = root.querySelector('[data-badge]');
  const first = state.settings?.statuses[0]?.key;
  if (!badge || !first) return;
  try {
    const { total } = await adm(`/enquiries?status=${encodeURIComponent(first)}&limit=1`);
    badge.textContent = total;
    badge.hidden = !total;
  } catch {}
}

async function route() {
  const view = root.querySelector('[data-view]');
  if (!view) return;
  const path = location.pathname.replace(/\/+$/, '') || '/admin';
  markNav(path);
  state.dirty = false;
  window.scrollTo(0, 0);

  for (const [re, fn] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    view.innerHTML = '';
    try {
      await fn(view, ...m.slice(1).map((p) => (p === undefined ? undefined : decodeURIComponent(p))));
    } catch (err) {
      if (err.status === 401) return;
      view.innerHTML =
        head({ crumbs: [['/admin', 'Admin']], title: err.status === 404 ? 'Nothing here.' : 'That did not load.' }) +
        `<div class="adm-notice adm-notice--warm">${esc(err.data?.error || err.message)}</div>`;
    }
    return;
  }

  view.innerHTML =
    head({ crumbs: [['/admin', 'Admin']], title: 'Nothing here.' }) +
    '<p class="adm-sub">There is no admin page at this address.</p>';
}

async function navigate(path, replace = false) {
  if (state.dirty) {
    const leave = await confirmDialog({
      title: 'Leave without saving?',
      body: 'The changes on this page have not been saved.',
      confirm: 'Leave',
    });
    if (!leave) return;
  }
  history[replace ? 'replaceState' : 'pushState'](null, '', path);
  route();
}

async function start() {
  await loadSettings(true);
  mountShell();
  await route();
  refreshBadge();
}

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

  const a = e.target.closest('a[href]');
  if (a) {
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/admin') || a.target || a.hasAttribute('download')) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
    return;
  }

  const row = e.target.closest('tr[data-href]');
  if (row && !e.target.closest('button, input, select, textarea')) navigate(row.dataset.href);
});

window.addEventListener('popstate', () => {
  state.dirty = false;
  route();
});

window.addEventListener('beforeunload', (e) => {
  if (state.dirty) e.preventDefault();
});

window.addEventListener('adm:navigate', (e) => navigate(e.detail.path, e.detail.replace));
window.addEventListener('adm:badge', refreshBadge);
window.addEventListener('adm:signed-out', () => {
  state.dirty = false;
  renderLogin({ notice: 'Your session ended. Sign in again.' });
});

async function boot() {
  try {
    state.me = await adm('/me');
  } catch (err) {
    renderLogin(err.status === 503 ? { notice: err.data?.error, off: true } : {});
    return;
  }
  try {
    await start();
  } catch (err) {
    failToast(err);
  }
}

boot();
