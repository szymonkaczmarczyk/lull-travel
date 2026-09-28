import './app.js';
import { observeReveals, stagger, countUpOnView } from './app.js';
import { api, esc } from './api.js';
import { stayCard, postRow, skeletons, guard } from './cards.js';



const MARQUEE_PX_PER_SEC = 42; 

async function buildMarquee() {
  const track = document.querySelector('[data-marquee-track]');
  if (!track) return;

  let results;
  try {
    ({ results } = await api('/destinations'));
  } catch {
    
    track.closest('[data-marquee]')?.remove();
    return;
  }

  const one = results
    .map((d) => `<span class="marquee__item">${esc(d.name)}, ${esc(d.country)}</span>`)
    .join('');

  
  
  track.innerHTML = one;
  const setWidth = track.scrollWidth;
  
  
  const widest = Math.max(window.innerWidth, window.screen?.width || 0) * 1.2;
  const needed = Math.max(1, Math.ceil(widest / Math.max(setWidth, 1)));

  const half = one.repeat(needed);
  
  track.innerHTML = half + half;

  track.style.setProperty('--loop', `${(setWidth * needed) / MARQUEE_PX_PER_SEC}s`);
  track.classList.add('is-running');
}



function buildFeatured() {
  const host = document.querySelector('[data-featured]');
  if (!host) return;
  return guard(host, async () => {
    host.innerHTML = skeletons(3);
    const { results } = await api('/stays?sort=featured');
    host.innerHTML = results.slice(0, 6).map(stayCard).join('');
    stagger(host.children, 90);
    observeReveals(host);
  }, 'We could not load the selected stays.');
}



function buildJournal() {
  const host = document.querySelector('[data-journal]');
  if (!host) return;
  return guard(host, async () => {
    const { results } = await api('/journal?limit=3');
    host.innerHTML = results.map(postRow).join('');
    stagger(host.children, 90);
    observeReveals(host);
  }, 'We could not load the journal.');
}



async function buildStats() {
  const host = document.querySelector('[data-stats]');
  if (!host) return;
  try {
    const s = await api('/stats');
    const nums = host.querySelectorAll('[data-count]');
    [s.stays, s.destinations, s.reviews, s.avgRating].forEach((v, i) => {
      if (nums[i]) nums[i].dataset.count = String(v);
    });
  } catch {
    
  }
  host.querySelectorAll('[data-count]').forEach((el) =>
    countUpOnView(el, Number(el.dataset.count), { decimals: Number(el.dataset.decimals || 0) })
  );
}

buildMarquee();
buildFeatured();
buildJournal();
buildStats();
