import { db } from '../db/index.js';
import { stays, destinations } from './store.js';
import { settings, mailboxById, statusByKey, firstStatus } from './settings.js';
import { sendMail, render } from './mail.js';
import { SITE } from './meta.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const invalid = (message, fields = {}) => Object.assign(new Error(message), { status: 422, fields });

const event = (type, by, data = {}) => ({ at: new Date().toISOString(), type, by, ...data });

export function route(enquiry) {
  const { routing, mailboxes } = settings();
  const region = enquiry.destination || stays.find((s) => s.slug === enquiry.stay)?.destination || '';
  const rule = routing.rules.find((r) => r.destination === region);
  const mailbox = mailboxById(rule?.mailbox) || mailboxById(routing.fallback) || mailboxes[0] || null;
  const cc = routing.cc.map(mailboxById).filter((m) => m && m.id !== mailbox?.id);
  return { mailbox, cc, rule: rule ?? null };
}

export function vars(e, extra = {}) {
  const dest = destinations.find((d) => d.slug === e.destination);
  const stay = stays.find((s) => s.slug === e.stay);
  return {
    ref: e.id,
    name: e.name,
    email: e.email,
    party: String(e.party),
    month: e.month || 'Not sure yet',
    destination: dest ? `${dest.name}, ${dest.country}` : 'No preference',
    stay: stay ? stay.name : 'Shortlist requested',
    message: e.message || '(no message)',
    status: statusByKey(e.status)?.label ?? e.status,
    assignee: mailboxById(e.assignee)?.name ?? 'nobody yet',
    receivedAt: new Date(e.receivedAt).toUTCString(),
    adminUrl: `${SITE}/admin/enquiries/${e.id}`,
    by: '',
    note: '',
    ...extra,
  };
}

export async function createEnquiry(value) {
  const draft = { ...value, status: firstStatus() };
  const { mailbox } = route(draft);
  const record = await db.createEnquiry({
    ...draft,
    assignee: mailbox?.id ?? null,
    history: [event('created', 'site', { to: mailbox?.id ?? null })],
  });
  notifyCreated(record).catch((err) => console.error(`[enquiries] notify ${record.id}: ${err.message}`));
  return record;
}

async function notifyCreated(e) {
  const { routing, templates } = settings();
  const mailbox = mailboxById(e.assignee);
  const { cc } = route(e);
  const v = vars(e);

  if (routing.notifyOnCreate && mailbox) {
    await sendMail({
      kind: 'team',
      enquiryId: e.id,
      to: [mailbox.email, ...cc.map((m) => m.email)],
      replyTo: e.email,
      subject: render(templates.team.subject, v),
      text: render(templates.team.body, v),
    });
  }

  if (templates.ack.enabled) {
    await sendMail({
      kind: 'ack',
      enquiryId: e.id,
      to: e.email,
      replyTo: mailbox?.email,
      subject: render(templates.ack.subject, v),
      text: render(templates.ack.body, v),
    });
  }
}

async function load(id) {
  const e = await db.getEnquiry(id);
  if (!e) throw Object.assign(new Error('No enquiry with that reference.'), { status: 404 });
  return e;
}

export async function changeStatus(id, key, by) {
  const e = await load(id);
  const status = statusByKey(key);
  if (!status) throw invalid('Unknown status.', { status: 'Pick one of the configured statuses.' });
  if (e.status === key) return e;

  const updated = await db.updateEnquiry(id, {
    status: key,
    history: [...e.history, event('status', by, { from: e.status, to: key })],
  });

  const v = vars(updated, { by });
  const handler = mailboxById(updated.assignee);

  if (status.notifyCustomer) {
    await sendMail({
      kind: `status:${key}`,
      enquiryId: id,
      to: updated.email,
      replyTo: handler?.email,
      subject: render(status.subject, v),
      text: render(status.body, v),
    });
  }

  if (status.notifyTeam && handler) {
    await sendMail({
      kind: 'status-team',
      enquiryId: id,
      to: handler.email,
      subject: `${updated.id} · ${updated.name} is now ${status.label}`,
      text: `${by} moved this enquiry from "${statusByKey(e.status)?.label ?? e.status}" to "${status.label}".\n\n${v.adminUrl}`,
    });
  }

  return updated;
}

export async function assign(id, mailboxId, by, note = '') {
  const e = await load(id);
  const mailbox = mailboxById(mailboxId);
  if (!mailbox) throw invalid('Unknown mailbox.', { assignee: 'Pick one of the configured mailboxes.' });
  if (e.assignee === mailbox.id) return e;

  const updated = await db.updateEnquiry(id, {
    assignee: mailbox.id,
    history: [...e.history, event('assigned', by, { from: e.assignee, to: mailbox.id, text: note || undefined })],
  });

  const { templates } = settings();
  const v = vars(updated, { by, note });
  await sendMail({
    kind: 'forward',
    enquiryId: id,
    to: mailbox.email,
    replyTo: updated.email,
    subject: render(templates.forward.subject, v),
    text: render(templates.forward.body, v),
  });

  return updated;
}

export async function forward(id, email, by, note = '') {
  const e = await load(id);
  const to = String(email ?? '').trim();
  if (!EMAIL.test(to)) throw invalid('That address does not look right.', { to: 'That address does not look right.' });

  const updated = await db.updateEnquiry(id, {
    history: [...e.history, event('forwarded', by, { to, text: note || undefined })],
  });

  const { templates } = settings();
  const v = vars(updated, { by, note });
  const mail = await sendMail({
    kind: 'forward',
    enquiryId: id,
    to,
    replyTo: updated.email,
    subject: render(templates.forward.subject, v),
    text: render(templates.forward.body, v),
  });

  return { enquiry: updated, mail };
}

export async function addNote(id, text, by) {
  const e = await load(id);
  const body = String(text ?? '').trim().slice(0, 2000);
  if (!body) throw invalid('Write something first.', { note: 'Write something first.' });
  return db.updateEnquiry(id, { history: [...e.history, event('note', by, { text: body })] });
}
