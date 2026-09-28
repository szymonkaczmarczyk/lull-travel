import { Router } from 'express';
import { journal } from '../lib/store.js';

const router = Router();

const byDateDesc = (a, b) => new Date(b.date) - new Date(a.date);


router.get('/', (req, res) => {
  const { category, limit } = req.query;
  let results = journal.slice().sort(byDateDesc);
  if (category) results = results.filter((a) => a.category.toLowerCase() === String(category).toLowerCase());
  if (limit) results = results.slice(0, Number(limit));

  res.json({
    count: results.length,
    categories: [...new Set(journal.map((a) => a.category))],
    results: results.map(({ body, ...rest }) => rest),
  });
});

router.get('/:slug', (req, res) => {
  const article = journal.find((a) => a.slug === req.params.slug);
  if (!article) return res.status(404).json({ error: 'No article with that slug.' });

  const sorted = journal.slice().sort(byDateDesc);
  const i = sorted.findIndex((a) => a.slug === article.slug);
  const brief = (a) => (a ? { slug: a.slug, title: a.title, category: a.category } : null);

  res.json({ article, prev: brief(sorted[i - 1]), next: brief(sorted[i + 1]) });
});

export default router;
