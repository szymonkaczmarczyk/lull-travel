

import { money, esc, tone, longDate, img } from './api.js';

const ARROW = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function stayCard(s) {
  const where = s.destination ? `${s.destination.name}, ${s.destination.country}` : '';
  return `
    <a class="card" href="/stays/${esc(s.slug)}" data-reveal>
      <div class="card__art art" style="${tone(s.tone)}">
        ${img(s)}
        ${s.featured ? '<span class="tag tag--teal card__badge">Featured</span>' : ''}
        <span class="card__go">${ARROW}</span>
        <span class="card__price">${money(s.pricePerNight, s.currency)} <small>/ night</small></span>
      </div>
      <div class="card__body">
        <span class="card__where">${esc(where)}</span>
        <h3 class="card__name">${esc(s.name)}</h3>
        <p class="card__blurb">${esc(s.blurb)}</p>
        <div class="card__foot">
          <span class="star">★ ${s.rating.toFixed(1)}</span>
          <span>${esc(s.type)}</span>
          <span>Sleeps ${s.sleeps}</span>
          <span>${s.minNights} night min</span>
        </div>
      </div>
    </a>`;
}

export function destCard(d) {
  return `
    <a class="dest-card" href="/destinations/${esc(d.slug)}" data-reveal>
      <div class="art" style="${tone(d.tone)}">${img(d)}</div>
      <div class="dest-card__scrim"></div>
      <div class="dest-card__body">
        <div class="dest-card__meta">
          <span>${esc(d.country)}</span>
          <span aria-hidden="true">·</span>
          <span>${d.stayCount} ${d.stayCount === 1 ? 'stay' : 'stays'}</span>
          ${d.fromPrice ? `<span aria-hidden="true">·</span><span>from ${money(d.fromPrice)}</span>` : ''}
        </div>
        <h3 class="dest-card__name">${esc(d.name)}</h3>
        <p class="dest-card__line">${esc(d.tagline)}</p>
      </div>
    </a>`;
}

export function postRow(a) {
  return `
    <a class="post" href="/journal/${esc(a.slug)}" data-reveal>
      <div class="post__row">
        <div class="post__art art" style="${tone(a.tone)}">${img(a)}</div>
        <div class="post__main">
          <div class="post__meta">
            <span class="u-teal">${esc(a.category)}</span>
            <span>${longDate(a.date)}</span>
            <span>${a.readMinutes} min read</span>
          </div>
          <h3 class="post__title">${esc(a.title)}</h3>
          <p class="post__dek">${esc(a.dek)}</p>
        </div>
      </div>
    </a>`;
}

export function skeletons(n, height = 420) {
  return Array.from({ length: n }, () => `<div class="skeleton" style="height:${height}px"></div>`).join('');
}


export function renderFailure(host, retry, message = 'We could not load this just now.') {
  host.innerHTML = `
    <div class="empty" style="grid-column:1/-1">
      <p class="h-sm" style="margin-bottom:10px">${esc(message)}</p>
      <p class="u-dim" style="margin-bottom:26px">The connection dropped, or our end is having a moment.</p>
      <button class="btn btn--ghost" type="button" data-retry>Try again</button>
    </div>`;
  host.querySelector('[data-retry]').addEventListener('click', retry, { once: true });
}


export async function guard(host, loader, message) {
  try {
    await loader();
  } catch (err) {
    console.error(err);
    renderFailure(host, () => guard(host, loader, message), message);
  }
}

export { ARROW };
