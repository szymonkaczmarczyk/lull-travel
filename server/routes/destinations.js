import { Router } from 'express';
import { destinations, stays, expandStay } from '../lib/store.js';

const router = Router();

const withCounts = (d) => {
  const own = stays.filter((s) => s.destination === d.slug);
  return {
    ...d,
    stayCount: own.length,
    fromPrice: own.length ? Math.min(...own.map((s) => s.pricePerNight)) : null,
  };
};

router.get('/', (_req, res) => {
  res.json({ count: destinations.length, results: destinations.map(withCounts) });
});

router.get('/:slug', (req, res) => {
  const dest = destinations.find((d) => d.slug === req.params.slug);
  if (!dest) return res.status(404).json({ error: 'No destination with that slug.' });
  res.json({
    destination: withCounts(dest),
    stays: stays.filter((s) => s.destination === dest.slug).map(expandStay),
  });
});

export default router;
