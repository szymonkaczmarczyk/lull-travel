import { Router } from 'express';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db } from '../db/index.js';
import { collections, saveEntry, removeEntry, destinations } from '../lib/store.js';
import { SCHEMA, validateEntry, referencesTo } from '../lib/schema.js';
import { settings, saveSetting, validateSetting, TONES, PLACEHOLDERS } from '../lib/settings.js';
import { mailInfo, sendMail } from '../lib/mail.js';
import * as enquiries from '../lib/enquiries.js';
import {
  adminEnabled, checkCredentials, startSession, endSession, requireAdmin, sameOrigin,
} from '../lib/auth.js';
import { rateLimit } from '../lib/rateLimit.js';

const IMAGES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'img', 'card');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SWITCHED_OFF = 'Admin is switched off. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env and restart.';

const router = Router();

router.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
  next();
});
router.use(sameOrigin);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const int = (v, min, max, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const fail = (res, status, error, fields) => res.status(status).json(fields ? { error, fields } : { error });

const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many attempts. Try again in a quarter of an hour.',
});

router.post('/login', loginLimit, (req, res) => {
  if (!adminEnabled()) return fail(res, 503, SWITCHED_OFF);
  const { email, password } = req.body ?? {};
  if (!checkCredentials(email, password)) return fail(res, 401, 'That email and password do not match.');
  const who = String(email).trim().toLowerCase();
  startSession(req, res, who);
  res.json({ email: who });
});

router.post('/logout', (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

router.use(requireAdmin);

router.get('/me', (req, res) => {
  res.json({ email: req.admin.email, db: db.name, mail: mailInfo() });
});

router.get(
  '/overview',
  wrap(async (_req, res) => {
    const [counts, total, recent, mail] = await Promise.all([
      db.statusCounts(),
      db.countEnquiries(),
      db.listEnquiries({ limit: 6 }),
      db.listMail({ limit: 5 }),
    ]);
    const open = settings()
      .statuses.filter((s) => !s.final)
      .reduce((n, s) => n + (counts[s.key] || 0), 0);
    res.json({
      total,
      open,
      counts,
      recent: recent.results,
      mail,
      content: Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length])),
      db: db.name,
      mailInfo: mailInfo(),
    });
  })
);

const listQuery = (q) => ({
  status: str(q.status),
  assignee: str(q.assignee),
  q: str(q.q).slice(0, 80),
});

router.get(
  '/enquiries',
  wrap(async (req, res) => {
    const limit = int(req.query.limit, 1, 200, 50);
    const offset = int(req.query.offset, 0, 1_000_000, 0);
    const [{ total, results }, counts] = await Promise.all([
      db.listEnquiries({ ...listQuery(req.query), limit, offset }),
      db.statusCounts(),
    ]);
    res.json({ total, count: results.length, limit, offset, counts, results });
  })
);

const csvCell = (v) => {
  const s = String(v ?? '');
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

router.get(
  '/enquiries.csv',
  wrap(async (req, res) => {
    const { results } = await db.listEnquiries({ ...listQuery(req.query), limit: 10_000, offset: 0 });
    const cols = ['id', 'receivedAt', 'status', 'assignee', 'name', 'email', 'party', 'month', 'destination', 'stay', 'message'];
    const csv = [cols.join(','), ...results.map((e) => cols.map((c) => csvCell(e[c])).join(','))].join('\n');
    res.set('Content-Disposition', `attachment; filename="lull-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.type('text/csv').send(csv);
  })
);

router.get(
  '/enquiries/:id',
  wrap(async (req, res) => {
    const enquiry = await db.getEnquiry(req.params.id);
    if (!enquiry) return fail(res, 404, 'No enquiry with that reference.');
    const mail = await db.listMail({ enquiryId: enquiry.id, limit: 50 });
    const { mailbox, rule } = enquiries.route(enquiry);
    res.json({ enquiry, mail, routing: { suggested: mailbox?.id ?? null, rule } });
  })
);

router.patch(
  '/enquiries/:id',
  wrap(async (req, res) => {
    const { status, assignee, note } = req.body ?? {};
    const by = req.admin.email;
    let enquiry = null;
    if (status !== undefined) enquiry = await enquiries.changeStatus(req.params.id, String(status), by);
    if (assignee !== undefined) enquiry = await enquiries.assign(req.params.id, String(assignee), by, str(note));
    if (!enquiry) return fail(res, 422, 'Send a status or an assignee.');
    res.json({ enquiry });
  })
);

router.post(
  '/enquiries/:id/notes',
  wrap(async (req, res) => {
    const enquiry = await enquiries.addNote(req.params.id, req.body?.text, req.admin.email);
    res.status(201).json({ enquiry });
  })
);

router.post(
  '/enquiries/:id/forward',
  wrap(async (req, res) => {
    const result = await enquiries.forward(req.params.id, req.body?.to, req.admin.email, str(req.body?.note));
    res.status(201).json(result);
  })
);

router.delete(
  '/enquiries/:id',
  wrap(async (req, res) => {
    const gone = await db.deleteEnquiry(req.params.id);
    if (!gone) return fail(res, 404, 'No enquiry with that reference.');
    res.status(204).end();
  })
);

function listImages() {
  try {
    return readdirSync(IMAGES)
      .filter((f) => f.endsWith('.jpg'))
      .map((f) => f.slice(0, -4))
      .sort();
  } catch {
    return [];
  }
}

router.get('/schema', (_req, res) => {
  res.json({ schema: SCHEMA, images: listImages() });
});

function schemaFor(req, res) {
  const schema = SCHEMA[req.params.collection];
  if (!schema) fail(res, 404, 'No such collection.');
  return schema;
}

router.get('/content/:collection', (req, res) => {
  if (!schemaFor(req, res)) return;
  const list = collections[req.params.collection];
  res.json({ count: list.length, results: list });
});

router.get('/content/:collection/:slug', (req, res) => {
  if (!schemaFor(req, res)) return;
  const entry = collections[req.params.collection].find((d) => d.slug === req.params.slug);
  if (!entry) return fail(res, 404, 'Nothing at that address.');
  res.json({ entry });
});

router.post(
  '/content/:collection',
  wrap(async (req, res) => {
    if (!schemaFor(req, res)) return;
    const { errors, value } = validateEntry(req.params.collection, req.body, null);
    if (Object.keys(errors).length) return fail(res, 422, 'Validation failed.', errors);
    const entry = await saveEntry(req.params.collection, value);
    res.status(201).json({ entry });
  })
);

router.put(
  '/content/:collection/:slug',
  wrap(async (req, res) => {
    if (!schemaFor(req, res)) return;
    const existing = collections[req.params.collection].find((d) => d.slug === req.params.slug);
    if (!existing) return fail(res, 404, 'Nothing at that address.');
    const { errors, value } = validateEntry(req.params.collection, req.body, existing);
    if (Object.keys(errors).length) return fail(res, 422, 'Validation failed.', errors);
    const entry = await saveEntry(req.params.collection, value);
    res.json({ entry });
  })
);

router.delete(
  '/content/:collection/:slug',
  wrap(async (req, res) => {
    if (!schemaFor(req, res)) return;
    const refs = referencesTo(req.params.collection, req.params.slug);
    if (refs.length) {
      return fail(res, 409, `Still used by ${refs.length} ${refs.length === 1 ? 'stay' : 'stays'}: ${refs.join(', ')}.`);
    }
    const gone = await removeEntry(req.params.collection, req.params.slug);
    if (!gone) return fail(res, 404, 'Nothing at that address.');
    res.status(204).end();
  })
);

router.get('/settings', (_req, res) => {
  res.json({ settings: settings(), tones: TONES, placeholders: PLACEHOLDERS, mail: mailInfo() });
});

router.post(
  '/settings/test-mail',
  wrap(async (req, res) => {
    const to = str(req.body?.to);
    if (!EMAIL.test(to)) return fail(res, 422, 'That address does not look right.', { to: 'That address does not look right.' });
    const mail = await sendMail({
      kind: 'test',
      to,
      subject: 'Test from the Lull admin',
      text: `${req.admin.email} sent this from the admin to check that mail is set up.\n\nTransport: ${mailInfo().transport}`,
    });
    res.status(201).json({ mail });
  })
);

router.put(
  '/settings/:key',
  wrap(async (req, res) => {
    const context = {
      destinations,
      inUse: req.params.key === 'statuses' ? await db.statusCounts() : {},
    };
    const result = validateSetting(req.params.key, req.body, context);
    if (!result) return fail(res, 404, 'No such setting.');
    if (Object.keys(result.errors).length) return fail(res, 422, 'Validation failed.', result.errors);
    const value = await saveSetting(req.params.key, result.value);
    res.json({ key: req.params.key, value });
  })
);

router.get(
  '/outbox',
  wrap(async (req, res) => {
    const results = await db.listMail({ limit: int(req.query.limit, 1, 500, 100) });
    res.json({ count: results.length, results, mail: mailInfo() });
  })
);

router.use((err, _req, res, _next) => {
  if (err.status) return fail(res, err.status, err.message, err.fields && Object.keys(err.fields).length ? err.fields : undefined);
  console.error('[admin]', err);
  fail(res, 500, 'Something went wrong on our side. The details are in the server log.');
});

export default router;
