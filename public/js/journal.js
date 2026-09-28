import './app.js';
import { observeReveals, stagger } from './app.js';
import { api, esc } from './api.js';
import { postRow, guard } from './cards.js';

const posts = document.querySelector('[data-posts]');
const catHost = document.querySelector('[data-filter-cat]');
const countLabel = document.querySelector('[data-count-label]');

let category = '';

function load() {
  return guard(posts, async () => {
    countLabel.textContent = '';
    const { results, categories, count } = await api(
      category ? `/journal?category=${encodeURIComponent(category)}` : '/journal'
    );

    
    if (catHost.children.length === 1) {
      catHost.insertAdjacentHTML(
        'beforeend',
        categories.map((c) => `<button class="chip" type="button" data-value="${esc(c)}">${esc(c)}</button>`).join('')
      );
    }
    catHost.querySelectorAll('.chip').forEach((c) =>
      c.setAttribute('aria-pressed', String(c.dataset.value === category))
    );

    countLabel.textContent = `${count} ${count === 1 ? 'piece' : 'pieces'}`;
    posts.innerHTML = results.map(postRow).join('');
    stagger(posts.children, 70);
    observeReveals(posts);
  }, 'We could not load the journal.');
}

catHost.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  category = btn.dataset.value;
  load();
});

load();
