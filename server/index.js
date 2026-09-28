import './lib/env.js';
import express from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { metaTags, clamp, NAME, SITE } from './lib/meta.js';
import { securityHeaders } from './lib/security.js';
import { compress } from './lib/compress.js';
import { staticText } from './lib/staticText.js';

import staysRoutes from './routes/stays.js';
import destinationsRoutes from './routes/destinations.js';
import journalRoutes from './routes/journal.js';
import enquiriesRoutes from './routes/enquiries.js';
import adminRoutes from './routes/admin.js';
import { stays, destinations, journal, initStore } from './lib/store.js';
import { initSettings } from './lib/settings.js';
import { db } from './db/index.js';
import { mailInfo } from './lib/mail.js';
import { adminEnabled } from './lib/auth.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = join(ROOT, 'public');
const VIEWS = join(ROOT, 'server', 'views');
const PORT = process.env.PORT || 3000;

await initStore();
await initSettings();

const app = express();
app.disable('x-powered-by');



if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

app.use(securityHeaders);
app.use(compress);
app.use(express.json({ limit: '256kb' }));


app.use((req, res, next) => {
  const { pathname } = new URL(req.originalUrl, 'http://x');
  if (pathname === '/index.html') return res.redirect(301, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return res.redirect(301, pathname.slice(0, -1) + (req.originalUrl.slice(pathname.length) || ''));
  }
  next();
});


app.use(staticText(PUBLIC));
app.use(
  express.static(PUBLIC, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
      if (/[\\/]img[\\/]/.test(filePath)) {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (/\.(css|js)$/.test(filePath)) {
        res.set('Cache-Control', 'public, max-age=300, must-revalidate');
      }
    },
  })
);



app.get('/api/stats', (_req, res) => {
  const countries = new Set(destinations.map((d) => d.country));
  res.json({
    stays: stays.length,
    destinations: destinations.length,
    countries: countries.size,
    articles: journal.length,
    fromPrice: Math.min(...stays.map((s) => s.pricePerNight)),
    avgRating: Number((stays.reduce((n, s) => n + s.rating, 0) / stays.length).toFixed(2)),
    reviews: stays.reduce((n, s) => n + s.reviews, 0),
  });
});

app.use('/api/stays', staysRoutes);
app.use('/api/destinations', destinationsRoutes);
app.use('/api/journal', journalRoutes);
app.use('/api/enquiries', enquiriesRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint.' }));

app.use('/api', (err, _req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'That request body is not valid JSON.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That request is too large.' });
  console.error('[api]', err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again in a moment.' });
});



app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /admin', '', `Sitemap: ${SITE}/sitemap.xml`, ''].join('\n')
  );
});


app.get('/sitemap.xml', (_req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/stays', priority: '0.9', changefreq: 'weekly' },
    { loc: '/destinations', priority: '0.9', changefreq: 'monthly' },
    { loc: '/journal', priority: '0.7', changefreq: 'weekly' },
    { loc: '/about', priority: '0.5', changefreq: 'yearly' },
    { loc: '/plan', priority: '0.8', changefreq: 'yearly' },
    ...stays.map((s) => ({ loc: `/stays/${s.slug}`, priority: '0.8', changefreq: 'monthly' })),
    ...destinations.map((d) => ({ loc: `/destinations/${d.slug}`, priority: '0.7', changefreq: 'monthly' })),
    ...journal.map((a) => ({ loc: `/journal/${a.slug}`, priority: '0.6', changefreq: 'yearly', lastmod: a.date })),
  ];

  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map(
          (u) =>
            `  <url><loc>${SITE}${u.loc}</loc><lastmod>${u.lastmod || today}</lastmod>` +
            `<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
        )
        .join('\n') +
      `\n</urlset>\n`
  );
});

app.get('/favicon.ico', (_req, res) => res.redirect(301, '/favicon.svg'));





function render(res, file, meta, status = 200) {
  const html = readFileSync(join(VIEWS, file), 'utf8').replace('<!--meta-->', metaTags(meta));
  res.status(status).type('html').send(html);
}

const page = (file, meta) => (_req, res) => render(res, file, meta);

const notFound = (res) =>
  render(res, '404.html', {
    title: 'Nothing here',
    description: 'There is nothing at this address. There are, however, fourteen places we can vouch for.',
    path: '/404',
    noindex: true,
  }, 404);

app.get('/', page('home.html', {
  title: NAME,
  description: 'LULL is a boutique travel company. Hand-picked stays in quiet, out-of-the-way places — every one of them slept in by someone who works here.',
  path: '/',
}));

app.get('/stays', page('stays.html', {
  title: 'Stays',
  description: 'Fourteen hand-picked stays across eight regions. Cabins above the Arctic Circle, a monte in the Alentejo, one room in the Atacama with a roof that opens.',
  path: '/stays',
}));

app.get('/destinations', page('destinations.html', {
  title: 'Destinations',
  description: 'Eight regions, eight countries. Arctic Norway, the Alentejo, the Kii Peninsula, the Aeolian Islands, the Atacama, the Westfjords, Kerry and the Kalahari.',
  path: '/destinations',
}));

app.get('/journal', page('journal.html', {
  title: 'Journal',
  description: 'Notes on how a place gets on the list, why low season is the real season, and what to pack when there is nothing to do.',
  path: '/journal',
}));

app.get('/plan', page('plan.html', {
  title: 'Plan a trip',
  description: 'Tell us a month and roughly how many of you there are. One reply, from one person, within a working day.',
  path: '/plan',
}));

app.get('/about', page('about.html', {
  title: 'About',
  description: 'Three people, eight regions, and one rule: nothing goes on the list until someone here has slept in it.',
  path: '/about',
}));

app.get(['/admin', '/admin/*'], (_req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  render(res, 'admin.html', {
    title: 'Admin',
    description: 'Staff only.',
    path: '/admin',
    noindex: true,
  });
});


app.get('/stays/:slug', (req, res) => {
  const s = stays.find((x) => x.slug === req.params.slug);
  if (!s) return notFound(res);
  const dest = destinations.find((d) => d.slug === s.destination);
  render(res, 'stay.html', {
    title: dest ? `${s.name}, ${dest.name}` : s.name,
    description: clamp(`${s.blurb} ${s.description[0]}`),
    path: `/stays/${s.slug}`,
    type: 'product',
  });
});

app.get('/destinations/:slug', (req, res) => {
  const d = destinations.find((x) => x.slug === req.params.slug);
  if (!d) return notFound(res);
  render(res, 'destination.html', {
    title: `${d.name}, ${d.country}`,
    description: clamp(`${d.tagline} ${d.summary}`),
    path: `/destinations/${d.slug}`,
  });
});

app.get('/journal/:slug', (req, res) => {
  const a = journal.find((x) => x.slug === req.params.slug);
  if (!a) return notFound(res);
  render(res, 'article.html', {
    title: a.title,
    description: clamp(a.dek),
    path: `/journal/${a.slug}`,
    type: 'article',
  });
});

app.use((_req, res) => notFound(res));

app.listen(PORT, () => {
  const mail = mailInfo();
  console.log(`LULL running → http://localhost:${PORT}`);
  console.log(`  database  ${db.name}`);
  console.log(`  mail      ${mail.transport}${mail.delivers ? '' : ' (nothing leaves this server)'}`);
  console.log(`  admin     ${adminEnabled() ? `http://localhost:${PORT}/admin` : 'off — set ADMIN_EMAIL and ADMIN_PASSWORD in .env'}`);
});
