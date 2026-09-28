import './app.js';
import { observeReveals, stagger } from './app.js';
import { api, esc } from './api.js';
import { stayCard, skeletons, guard } from './cards.js';

const results = document.querySelector('[data-results]');
const countLabel = document.querySelector('[data-count-label]');
const sortEl = document.querySelector('[data-sort]');

const state = { destination: '', type: '', sort: 'featured' };


function readUrl() {
  const q = new URLSearchParams(location.search);
  state.destination = q.get('destination') || '';
  state.type = q.get('type') || '';
  state.sort = q.get('sort') || 'featured';
  if (sortEl) sortEl.value = state.sort;
}

function writeUrl() {
  const q = new URLSearchParams();
  if (state.destination) q.set('destination', state.destination);
  if (state.type) q.set('type', state.type);
  if (state.sort !== 'featured') q.set('sort', state.sort);
  const qs = q.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function chipGroup(host, values, key) {
  host.insertAdjacentHTML(
    'beforeend',
    values.map((v) => `<button class="chip" type="button" data-value="${esc(v.value)}">${esc(v.label)}</button>`).join('')
  );

  host.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state[key] = btn.dataset.value;
    host.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === btn)));
    writeUrl();
    load();
  });

  
  host.querySelectorAll('.chip').forEach((c) =>
    c.setAttribute('aria-pressed', String(c.dataset.value === state[key]))
  );
}

async function buildFilters() {
  let dests;
  let allStays;
  try {
    const [d, s] = await Promise.all([api('/destinations'), api('/stays')]);
    dests = d.results;
    allStays = s.results;
  } catch {
    
    return;
  }

  chipGroup(
    document.querySelector('[data-filter-dest]'),
    dests.map((d) => ({ value: d.slug, label: d.name })),
    'destination'
  );

  const types = [...new Set(allStays.map((s) => s.type))].sort();
  chipGroup(
    document.querySelector('[data-filter-type]'),
    types.map((t) => ({ value: t, label: t })),
    'type'
  );
}

function load() {
  return guard(results, async () => {
    results.innerHTML = skeletons(6);
    countLabel.textContent = ''; 
    const q = new URLSearchParams();
    if (state.destination) q.set('destination', state.destination);
    if (state.type) q.set('type', state.type);
    q.set('sort', state.sort);

    const data = await api(`/stays?${q}`);
    countLabel.textContent = `${data.count} of ${data.total} stays`;

    if (!data.count) {
      results.innerHTML = `<div class="empty" style="grid-column:1/-1">
          <p class="h-sm" style="margin-bottom:10px">Nothing matches that combination.</p>
          <p class="u-dim">Try widening the region or the type.</p>
        </div>`;
      return;
    }

    results.innerHTML = data.results.map(stayCard).join('');
    stagger(results.children, 60);
    observeReveals(results);
  }, 'We could not load the stays.');
}

sortEl?.addEventListener('change', () => {
  state.sort = sortEl.value;
  writeUrl();
  load();
});

readUrl();
buildFilters();
load();
