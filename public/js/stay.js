import './app.js';
import { observeReveals, stagger, setPageTone, setPageBackdrop } from './app.js';
import { api, money, esc, tone, img } from './api.js';
import { stayCard, ARROW } from './cards.js';

const host = document.querySelector('[data-stay]');
const slug = location.pathname.split('/').filter(Boolean).pop();

function render({ stay: s, related }) {
  document.title = `${s.name} — LULL`;
  setPageTone(s.tone); 
  setPageBackdrop(s.image);
  const where = s.destination ? `${s.destination.name}, ${s.destination.country}` : '';

  host.innerHTML = `
    <section class="stay-hero">
      <div class="art" style="${tone(s.tone)}" data-parallax="0.14">${img(s, { size: 'hero', eager: true })}</div>
      <div class="stay-hero__scrim"></div>
      <div class="stay-hero__body">
        <div class="wrap">
          <nav class="crumbs rise" style="--d:100ms">
            <a href="/">Lull</a><span>/</span>
            <a href="/stays">Stays</a><span>/</span>
            <a href="/destinations/${esc(s.destination?.slug ?? '')}">${esc(s.destination?.name ?? '')}</a>
          </nav>
          <p class="kicker rise" style="--d:200ms; margin-top:20px">${esc(where)}</p>
          <h1 class="h-lg rise" style="--d:300ms; margin:18px 0 14px; max-width:14ch; text-shadow:0 2px 40px rgba(0,0,0,.4)">${esc(s.name)}</h1>
          <p class="lede rise" style="--d:400ms; max-width:48ch">${esc(s.blurb)}</p>
        </div>
      </div>
    </section>

    <div class="wrap">
      <div class="stay-layout">
        <div class="u-stack" style="gap:clamp(40px,4.6vw,64px)">

          <div class="prose" data-reveal>
            ${s.description.map((p) => `<p>${esc(p)}</p>`).join('')}
          </div>

          <div class="catch" data-reveal>
            <svg class="catch__icon" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M10 2.5 18.5 17.5H1.5L10 2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              <path d="M10 8v3.4M10 14.2v.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
            <div>
              <h4>The catch</h4>
              <p>${esc(s.theCatch)}</p>
            </div>
          </div>

          <div data-reveal>
            <p class="kicker" style="margin-bottom:24px">What is here</p>
            <ul class="feature-grid" style="list-style:none;margin:0;padding:0">
              ${s.features.map((f) => `<li>${esc(f)}</li>`).join('')}
            </ul>
          </div>

          <div data-reveal>
            <p class="kicker" style="margin-bottom:20px">Getting there</p>
            <p class="body-text">${esc(s.gettingThere)}</p>
          </div>

        </div>

        <aside class="book" data-reveal>
          <div>
            <div class="book__price">
              <strong>${money(s.pricePerNight, s.currency)}</strong>
              <span class="mono">/ night</span>
            </div>
            <p class="u-dim" style="font-size:13.5px;margin-top:6px">
              ${s.minNights}-night minimum · ${money(s.pricePerNight * s.minNights, s.currency)} for a short stay
            </p>
          </div>

          <dl class="book__rows">
            <div class="book__row"><dt>Type</dt><dd>${esc(s.type)}</dd></div>
            <div class="book__row"><dt>Sleeps</dt><dd>${s.sleeps} in ${s.bedrooms} ${s.bedrooms === 1 ? 'bedroom' : 'bedrooms'}</dd></div>
            <div class="book__row"><dt>Rating</dt><dd><span class="u-teal">★</span> ${s.rating.toFixed(1)} · ${s.reviews} stays</dd></div>
            <div class="book__row"><dt>Region</dt><dd>${esc(s.destination?.region ?? '—')}</dd></div>
          </dl>

          <a class="btn btn--wide" href="/plan?stay=${esc(s.slug)}">
            Enquire about this stay ${ARROW}
          </a>
          <p class="mono" style="text-align:center;font-size:10px">One reply, one person, one working day</p>
        </aside>
      </div>
    </div>

    ${
      related.length
        ? `<section class="wrap" style="padding-bottom:clamp(72px,9vw,140px)">
             <div class="sec-head">
               <h2 class="h-sm" data-reveal>You might also look at</h2>
               <a class="link" href="/stays" data-reveal style="--d:80ms">All stays ${ARROW}</a>
             </div>
             <div class="grid grid--3" data-related>${related.map(stayCard).join('')}</div>
           </section>`
        : ''
    }`;

  const rel = host.querySelector('[data-related]');
  if (rel) stagger(rel.children, 90);
  observeReveals(host);
}


function load() {
  api(`/stays/${slug}`)
    .then(render)
    .catch(() => {
      host.innerHTML = `<div class="wrap" style="padding:200px 0 140px">
          <p class="kicker" style="margin-bottom:22px">Connection</p>
          <h1 class="h-lg" style="max-width:16ch">We could not load this stay.</h1>
          <p class="lede" style="margin:22px 0 32px">The connection dropped, or our end is having a moment.</p>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <button class="btn" type="button" data-retry>Try again ${ARROW}</button>
            <a class="btn btn--ghost" href="/stays">All stays</a>
          </div>
        </div>`;
      host.querySelector('[data-retry]').addEventListener('click', load, { once: true });
    });
}

load();
