import './app.js';
import { observeReveals, setPageTone, setPageBackdrop } from './app.js';
import { api, esc, tone, longDate, img } from './api.js';
import { ARROW } from './cards.js';

const host = document.querySelector('[data-article]');
const bar = document.querySelector('[data-progress]');
const slug = location.pathname.split('/').filter(Boolean).pop();

function render({ article: a, prev, next }) {
  document.title = `${a.title} — LULL`;
  setPageTone(a.tone);
  setPageBackdrop(a.image);

  host.innerHTML = `
    <header class="article-head wrap">
      <nav class="crumbs rise" style="--d:100ms">
        <a href="/">Lull</a><span>/</span>
        <a href="/journal">Journal</a><span>/</span>
        <span>${esc(a.category)}</span>
      </nav>
      <h1 class="h-lg rise" style="--d:200ms;margin:26px 0 22px;max-width:18ch">${esc(a.title)}</h1>
      <p class="lede rise" style="--d:300ms;max-width:56ch">${esc(a.dek)}</p>
      <div class="post__meta rise" style="--d:400ms;margin-top:30px">
        <span>${esc(a.author)}</span>
        <span>${longDate(a.date)}</span>
        <span>${a.readMinutes} min read</span>
      </div>
    </header>

    <div class="wrap" style="padding-top:clamp(36px,4vw,56px)">
      <div class="art" data-wipe style="--d:300ms;${tone(a.tone)};aspect-ratio:21/8;border-radius:4px;border:1px solid var(--hair-ghost)">${img(a, { size: 'hero', eager: true })}</div>
    </div>

    <article class="article-body wrap">
      ${a.body.map((p, i) => `<p data-reveal style="--d:${i * 40}ms">${esc(p)}</p>`).join('')}
    </article>

    <nav class="article-nav">
      ${
        prev
          ? `<a href="/journal/${esc(prev.slug)}">
               <span class="mono">← Previous · ${esc(prev.category)}</span>
               <span class="h-sm">${esc(prev.title)}</span>
             </a>`
          : `<div><span class="mono u-dim">Start of the journal</span></div>`
      }
      ${
        next
          ? `<a class="is-next" href="/journal/${esc(next.slug)}">
               <span class="mono">Next · ${esc(next.category)} →</span>
               <span class="h-sm">${esc(next.title)}</span>
             </a>`
          : `<div class="is-next"><span class="mono u-dim">End of the journal</span></div>`
      }
    </nav>

    <section class="wrap" style="padding-block:clamp(72px,9vw,140px)">
      <div class="cta-band art art--gen" data-reveal style="${tone(a.tone)}">
        <div class="cta-band__body">
          <p class="kicker">Somewhere quiet</p>
          <h2 class="h-md">Fourteen stays, eight regions, one road in.</h2>
          <a class="btn" href="/stays">Explore stays ${ARROW}</a>
        </div>
      </div>
    </section>`;

  observeReveals(host);
}

function initProgress() {
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = `${max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0}%`;
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

function load() {
  api(`/journal/${slug}`)
    .then((data) => {
      render(data);
      initProgress();
    })
    .catch(() => {
      host.innerHTML = `<div class="wrap" style="padding:200px 0 140px">
          <p class="kicker" style="margin-bottom:22px">Connection</p>
          <h1 class="h-lg" style="max-width:16ch">We could not load this piece.</h1>
          <p class="lede" style="margin:22px 0 32px">The connection dropped, or our end is having a moment.</p>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <button class="btn" type="button" data-retry>Try again ${ARROW}</button>
            <a class="btn btn--ghost" href="/journal">The journal</a>
          </div>
        </div>`;
      host.querySelector('[data-retry]').addEventListener('click', load, { once: true });
    });
}

load();
