import './app.js';
import { observeReveals, stagger, setPageTone, setPageBackdrop } from './app.js';
import { api, esc, tone, money, img } from './api.js';
import { stayCard, ARROW } from './cards.js';

const host = document.querySelector('[data-dest]');
const slug = location.pathname.split('/').filter(Boolean).pop();

function render({ destination: d, stays }) {
  document.title = `${d.name}, ${d.country} — LULL`;
  setPageTone(d.tone);
  setPageBackdrop(d.image);

  host.innerHTML = `
    <section class="stay-hero" style="height:56vh">
      <div class="art" style="${tone(d.tone)}" data-parallax="0.14">${img(d, { size: 'hero', eager: true })}</div>
      <div class="stay-hero__scrim"></div>
      <div class="stay-hero__body">
        <div class="wrap">
          <nav class="crumbs rise" style="--d:100ms">
            <a href="/">Lull</a><span>/</span>
            <a href="/destinations">Destinations</a><span>/</span>
            <span>${esc(d.name)}</span>
          </nav>
          <p class="kicker rise" style="--d:200ms; margin-top:20px">${esc(d.region)}</p>
          <h1 class="h-lg rise" style="--d:300ms; margin:18px 0 14px; text-shadow:0 2px 40px rgba(0,0,0,.4)">${esc(d.name)}</h1>
          <p class="lede rise" style="--d:400ms; max-width:46ch">${esc(d.tagline)}</p>
        </div>
      </div>
    </section>

    <div class="wrap" style="padding-block:clamp(48px,6vw,84px)">
      <div class="split" style="align-items:start">
        <p class="body-text" data-reveal style="font-size:18px;line-height:1.72">${esc(d.summary)}</p>
        <dl class="book__rows" data-reveal style="--d:100ms">
          <div class="book__row"><dt>Country</dt><dd>${esc(d.country)}</dd></div>
          <div class="book__row"><dt>Best months</dt><dd>${esc(d.bestMonths)}</dd></div>
          <div class="book__row"><dt>Last leg</dt><dd>${esc(d.flightTime)}</dd></div>
          <div class="book__row"><dt>Stays here</dt><dd>${d.stayCount}${d.fromPrice ? ` · from ${money(d.fromPrice)}` : ''}</dd></div>
          <div class="book__row"><dt>Coordinates</dt><dd>${d.lat.toFixed(2)}, ${d.lon.toFixed(2)}</dd></div>
        </dl>
      </div>
    </div>

    <section class="wrap" style="padding-bottom:clamp(72px,9vw,140px)">
      <div class="sec-head">
        <div>
          <p class="kicker" data-reveal>Where to stay</p>
          <h2 class="h-md" data-reveal style="--d:80ms;margin-top:22px">${d.stayCount} ${d.stayCount === 1 ? 'place' : 'places'} in ${esc(d.name)}.</h2>
        </div>
        <a class="link" href="/stays" data-reveal style="--d:140ms">All stays ${ARROW}</a>
      </div>
      <div class="grid grid--3" data-list>${stays.map(stayCard).join('')}</div>
    </section>`;

  const list = host.querySelector('[data-list]');
  if (list) stagger(list.children, 80);
  observeReveals(host);
}


function load() {
  api(`/destinations/${slug}`)
    .then(render)
    .catch(() => {
      host.innerHTML = `<div class="wrap" style="padding:200px 0 140px">
          <p class="kicker" style="margin-bottom:22px">Connection</p>
          <h1 class="h-lg" style="max-width:16ch">We could not load this region.</h1>
          <p class="lede" style="margin:22px 0 32px">The connection dropped, or our end is having a moment.</p>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <button class="btn" type="button" data-retry>Try again ${ARROW}</button>
            <a class="btn btn--ghost" href="/destinations">All destinations</a>
          </div>
        </div>`;
      host.querySelector('[data-retry]').addEventListener('click', load, { once: true });
    });
}

load();
