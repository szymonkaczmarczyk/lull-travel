import { Router } from 'express';
import { stays, destinations } from '../lib/store.js';
import { createEnquiry } from '../lib/enquiries.js';
import { db } from '../db/index.js';
import { rateLimit } from '../lib/rateLimit.js';

const router = Router();


const limit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'That is a lot of enquiries. Give us an hour to catch up, or email hello@lull.travel.',
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PARTY_MAX = 12;

function validate(body) {
  const errors = {};
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const party = Number(body.party ?? 2);
  const message = String(body.message ?? '').trim();
  const destination = String(body.destination ?? '').trim();
  const stay = String(body.stay ?? '').trim();

  if (name.length < 2) errors.name = 'Tell us what to call you.';
  if (name.length > 120) errors.name = 'Keep it under 120 characters.';
  if (!EMAIL.test(email) || email.length > 200) errors.email = 'That email address does not look right.';
  if (!Number.isInteger(party) || party < 1 || party > PARTY_MAX) {
    errors.party = `Party size must be between 1 and ${PARTY_MAX}.`;
  }
  if (message.length > 2000) errors.message = 'Keep it under 2000 characters.';
  if (destination && !destinations.some((d) => d.slug === destination)) {
    errors.destination = 'We do not have that destination.';
  }
  if (stay && !stays.some((s) => s.slug === stay)) {
    errors.stay = 'We do not have that stay.';
  }

  return {
    errors,
    value: { name, email, party, message, destination, stay, month: String(body.month ?? '').trim().slice(0, 40) },
  };
}

router.post('/', limit, async (req, res, next) => {
  const { errors, value } = validate(req.body ?? {});
  if (Object.keys(errors).length) return res.status(422).json({ error: 'Validation failed.', fields: errors });

  try {
    const record = await createEnquiry(value);
    res.status(201).json({
      id: record.id,
      receivedAt: record.receivedAt,
      message: `Thank you, ${record.name}. We reply to every enquiry within one working day.`,
    });
  } catch (err) {
    next(err);
  }
});


router.get('/count', async (_req, res, next) => {
  try {
    res.json({ count: await db.countEnquiries() });
  } catch (err) {
    next(err);
  }
});

export default router;
