import { Router } from 'express';
import { stays, expandStay } from '../lib/store.js';

const router = Router();

const SORTS = {
  featured: (a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating,
  'price-asc': (a, b) => a.pricePerNight - b.pricePerNight,
  'price-desc': (a, b) => b.pricePerNight - a.pricePerNight,
  rating: (a, b) => b.rating - a.rating,
  sleeps: (a, b) => b.sleeps - a.sleeps,
};


router.get('/', (req, res) => {
  const { destination, type, maxPrice, sleeps, sort = 'featured', q } = req.query;
  let results = stays.slice();

  if (destination) results = results.filter((s) => s.destination === destination);
  if (type) results = results.filter((s) => s.type.toLowerCase() === String(type).toLowerCase());
  if (maxPrice) results = results.filter((s) => s.pricePerNight <= Number(maxPrice));
  if (sleeps) results = results.filter((s) => s.sleeps >= Number(sleeps));
  if (q) {
    const needle = String(q).toLowerCase();
    results = results.filter((s) =>
      [s.name, s.blurb, s.type, s.destination].join(' ').toLowerCase().includes(needle)
    );
  }

  results.sort(SORTS[sort] ?? SORTS.featured);
  res.json({ count: results.length, total: stays.length, results: results.map(expandStay) });
});


router.get('/:slug', (req, res) => {
  const stay = stays.find((s) => s.slug === req.params.slug);
  if (!stay) return res.status(404).json({ error: 'No stay with that slug.' });

  const closeness = (s) => (s.destination === stay.destination ? 2 : 0) + (s.type === stay.type ? 1 : 0);
  const related = stays
    .filter((s) => s.slug !== stay.slug)
    .map((s, order) => ({ s, order, score: closeness(s) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 3)
    .map(({ s }) => expandStay(s));

  res.json({ stay: expandStay(stay), related });
});

export default router;
