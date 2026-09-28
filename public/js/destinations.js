import './app.js';
import { observeReveals, stagger } from './app.js';
import { api } from './api.js';
import { destCard, skeletons, guard } from './cards.js';

const host = document.querySelector('[data-dests]');

guard(host, async () => {
  host.innerHTML = skeletons(4, 340);
  const { results } = await api('/destinations');
  host.innerHTML = results.map(destCard).join('');
  stagger(host.children, 80);
  observeReveals(host);
}, 'We could not load the destinations.');
