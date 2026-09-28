import { db } from '../db/index.js';

export const TONES = ['teal', 'warm', 'ok', 'muted', 'danger'];

export const PLACEHOLDERS = [
  'ref', 'name', 'email', 'party', 'month', 'destination', 'stay', 'message',
  'status', 'assignee', 'receivedAt', 'adminUrl', 'by', 'note',
];

export const DEFAULTS = {
  mail: {
    fromName: 'Lull',
    fromEmail: 'hello@lull.travel',
    replyTo: '',
  },

  mailboxes: [
    { id: 'hello', name: 'General inbox', email: 'hello@lull.travel' },
    { id: 'lisbon', name: 'Lisbon desk', email: 'lisbon@lull.travel' },
    { id: 'oslo', name: 'Oslo desk', email: 'oslo@lull.travel' },
  ],

  routing: {
    notifyOnCreate: true,
    fallback: 'hello',
    cc: [],
    rules: [
      { destination: 'lofoten', mailbox: 'oslo' },
      { destination: 'west-fjords', mailbox: 'oslo' },
      { destination: 'alentejo', mailbox: 'lisbon' },
    ],
  },

  statuses: [
    { key: 'new', label: 'New', tone: 'teal', final: false, notifyTeam: false, notifyCustomer: false, subject: '', body: '' },
    { key: 'in-progress', label: 'In progress', tone: 'warm', final: false, notifyTeam: false, notifyCustomer: false, subject: '', body: '' },
    {
      key: 'shortlist-sent',
      label: 'Shortlist sent',
      tone: 'ok',
      final: false,
      notifyTeam: false,
      notifyCustomer: false,
      subject: 'Your three places ({{ref}})',
      body: [
        'Hello {{name}},',
        '',
        'Your shortlist has gone out separately from {{assignee}}. If none of the three land, say so and we go again. There is no charge for any of this.',
        '',
        'Lull',
      ].join('\n'),
    },
    {
      key: 'booked',
      label: 'Booked',
      tone: 'ok',
      final: true,
      notifyTeam: true,
      notifyCustomer: false,
      subject: 'Confirmed ({{ref}})',
      body: [
        'Hello {{name}},',
        '',
        'This is confirmed. The practical details follow in a separate email closer to the date, from the same person you have been writing to.',
        '',
        'Lull',
      ].join('\n'),
    },
    { key: 'closed', label: 'Closed', tone: 'muted', final: true, notifyTeam: false, notifyCustomer: false, subject: '', body: '' },
  ],

  templates: {
    team: {
      subject: 'New enquiry {{ref}} · {{name}} · {{destination}}',
      body: [
        '{{name}} sent an enquiry through the site.',
        '',
        'Ref       {{ref}}',
        'Email     {{email}}',
        'Party     {{party}}',
        'When      {{month}}',
        'Region    {{destination}}',
        'Stay      {{stay}}',
        '',
        '{{message}}',
        '',
        'Routed to {{assignee}}. Replying to this email answers {{name}} directly.',
        'Open in admin: {{adminUrl}}',
      ].join('\n'),
    },
    ack: {
      enabled: true,
      subject: 'We have your enquiry ({{ref}})',
      body: [
        'Hello {{name}},',
        '',
        'Thank you for writing. Someone here will read this today or on the next working day, and the reply will come from a person.',
        '',
        'Region    {{destination}}',
        'When      {{month}}',
        'Party     {{party}}',
        '',
        'If you think of something else, reply to this email and it lands with the same person.',
        '',
        'Lull',
      ].join('\n'),
    },
    forward: {
      subject: 'Enquiry {{ref}} · {{name}} passed to you',
      body: [
        '{{by}} passed this enquiry to you.',
        '',
        '{{note}}',
        '',
        'Ref       {{ref}}',
        'Name      {{name}} <{{email}}>',
        'Party     {{party}}',
        'When      {{month}}',
        'Region    {{destination}}',
        'Stay      {{stay}}',
        '',
        '{{message}}',
        '',
        'Open in admin: {{adminUrl}}',
      ].join('\n'),
    },
  },
};

const current = structuredClone(DEFAULTS);

export async function initSettings() {
  const stored = await db.getSettings();
  for (const key of Object.keys(DEFAULTS)) {
    if (stored[key] !== undefined) current[key] = stored[key];
  }
}

export const settings = () => current;

export const mailboxById = (id) => current.mailboxes.find((m) => m.id === id) ?? null;
export const statusByKey = (key) => current.statuses.find((s) => s.key === key) ?? null;
export const firstStatus = () => current.statuses[0]?.key ?? 'new';

export async function saveSetting(key, value) {
  await db.setSetting(key, value);
  current[key] = value;
  return value;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const bool = (v) => v === true || v === 'true';

const template = (t = {}) => ({ subject: str(t.subject, 200), body: str(t.body, 5000) });

const validators = {
  mail(input) {
    const errors = {};
    const value = { fromName: str(input.fromName, 80), fromEmail: str(input.fromEmail), replyTo: str(input.replyTo) };
    if (!value.fromName) errors.fromName = 'Give the sender a name.';
    if (!EMAIL.test(value.fromEmail)) errors.fromEmail = 'That address does not look right.';
    if (value.replyTo && !EMAIL.test(value.replyTo)) errors.replyTo = 'That address does not look right.';
    return { errors, value };
  },

  mailboxes(input) {
    const errors = {};
    const list = Array.isArray(input) ? input : [];
    const value = list.map((m) => ({ id: str(m.id, 40), name: str(m.name, 80), email: str(m.email) }));
    if (!value.length) errors.list = 'Keep at least one mailbox.';
    const seen = new Set();
    value.forEach((m, i) => {
      if (!KEY.test(m.id)) errors[`${i}.id`] = 'Lowercase letters, numbers and dashes.';
      else if (seen.has(m.id)) errors[`${i}.id`] = 'Already used.';
      seen.add(m.id);
      if (!m.name) errors[`${i}.name`] = 'Needs a name.';
      if (!EMAIL.test(m.email)) errors[`${i}.email`] = 'That address does not look right.';
    });
    const routing = current.routing;
    const used = [routing.fallback, ...routing.cc, ...routing.rules.map((r) => r.mailbox)];
    const missing = used.find((id) => id && !seen.has(id));
    if (missing) errors.list = `Routing still sends to "${missing}". Change the routing first.`;
    return { errors, value };
  },

  routing(input, { destinations }) {
    const errors = {};
    const ids = new Set(current.mailboxes.map((m) => m.id));
    const value = {
      notifyOnCreate: bool(input.notifyOnCreate),
      fallback: str(input.fallback, 40),
      cc: (Array.isArray(input.cc) ? input.cc : []).map((c) => str(c, 40)).filter(Boolean),
      rules: (Array.isArray(input.rules) ? input.rules : []).map((r) => ({
        destination: str(r.destination, 60),
        mailbox: str(r.mailbox, 40),
      })),
    };
    if (!ids.has(value.fallback)) errors.fallback = 'Pick a mailbox.';
    if (value.cc.some((c) => !ids.has(c))) errors.cc = 'One of these mailboxes no longer exists.';
    const seen = new Set();
    value.rules.forEach((r, i) => {
      if (!destinations.some((d) => d.slug === r.destination)) errors[`${i}.destination`] = 'Pick a region.';
      else if (seen.has(r.destination)) errors[`${i}.destination`] = 'This region already has a rule.';
      seen.add(r.destination);
      if (!ids.has(r.mailbox)) errors[`${i}.mailbox`] = 'Pick a mailbox.';
    });
    return { errors, value };
  },

  statuses(input, { inUse = {} }) {
    const errors = {};
    const list = Array.isArray(input) ? input : [];
    const value = list.map((s) => ({
      key: str(s.key, 40),
      label: str(s.label, 40),
      tone: TONES.includes(s.tone) ? s.tone : 'muted',
      final: bool(s.final),
      notifyTeam: bool(s.notifyTeam),
      notifyCustomer: bool(s.notifyCustomer),
      ...template(s),
    }));
    if (!value.length) errors.list = 'Keep at least one status.';
    const seen = new Set();
    value.forEach((s, i) => {
      if (!KEY.test(s.key)) errors[`${i}.key`] = 'Lowercase letters, numbers and dashes.';
      else if (seen.has(s.key)) errors[`${i}.key`] = 'Already used.';
      seen.add(s.key);
      if (!s.label) errors[`${i}.label`] = 'Needs a label.';
      if (s.notifyCustomer && (!s.subject || !s.body)) errors[`${i}.body`] = 'A customer email needs a subject and a body.';
    });
    const orphan = Object.keys(inUse).find((k) => inUse[k] > 0 && !seen.has(k));
    if (orphan) errors.list = `${inUse[orphan]} enquiries are still "${orphan}". Move them before removing it.`;
    return { errors, value };
  },

  templates(input) {
    const errors = {};
    const value = {
      team: template(input.team),
      ack: { enabled: bool(input.ack?.enabled), ...template(input.ack) },
      forward: template(input.forward),
    };
    for (const k of ['team', 'forward']) {
      if (!value[k].subject || !value[k].body) errors[k] = 'Needs a subject and a body.';
    }
    if (value.ack.enabled && (!value.ack.subject || !value.ack.body)) errors.ack = 'Needs a subject and a body.';
    return { errors, value };
  },
};

export function validateSetting(key, input, context = {}) {
  const fn = validators[key];
  if (!fn) return null;
  return fn(input ?? {}, context);
}
