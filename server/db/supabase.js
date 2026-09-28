const BASE = `${String(process.env.SUPABASE_URL).replace(/\/+$/, '')}/rest/v1`;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const AUTH = { apikey: KEY, ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}) };

export const name = 'supabase';

const enc = encodeURIComponent;
const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${enc(v)}`)
    .join('&');

async function rest(path, { method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: { ...AUTH, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} on ${method} /${path.split('?')[0]}: ${data?.message || text}`);
  }
  return { data, res };
}

const totalFrom = (res) => Number(res.headers.get('content-range')?.split('/')[1]) || 0;

export async function listEntries(collection) {
  const { data } = await rest(`entries?${qs({ collection: `eq.${collection}`, select: 'data', order: 'position.asc,slug.asc' })}`);
  return data.map((r) => r.data);
}

const entryRow = (collection, doc, position) => ({
  collection,
  slug: doc.slug,
  position,
  data: doc,
  updated_at: new Date().toISOString(),
});

const UPSERT = { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal' };

export async function putEntries(collection, docs) {
  if (!docs.length) return;
  await rest('entries?on_conflict=collection,slug', { ...UPSERT, body: docs.map((d, i) => entryRow(collection, d, i)) });
}

export async function putEntry(collection, doc, position = 0) {
  await rest('entries?on_conflict=collection,slug', { ...UPSERT, body: entryRow(collection, doc, position) });
}

export async function deleteEntry(collection, slug) {
  await rest(`entries?${qs({ collection: `eq.${collection}`, slug: `eq.${slug}` })}`, { method: 'DELETE' });
}

const COLUMNS = { receivedAt: 'received_at', updatedAt: 'updated_at' };

const toRow = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [COLUMNS[k] || k, v]));

const fromRow = (r) => ({
  id: r.id,
  receivedAt: r.received_at,
  updatedAt: r.updated_at,
  status: r.status,
  name: r.name,
  email: r.email,
  party: r.party,
  month: r.month,
  destination: r.destination,
  stay: r.stay,
  message: r.message,
  assignee: r.assignee,
  history: r.history ?? [],
});

const searchable = (q) => String(q).replace(/[^\p{L}\p{N}@.\-_ ]/gu, '').trim();

export async function listEnquiries({ status, assignee, q, limit = 50, offset = 0 } = {}) {
  const needle = q ? searchable(q) : '';
  const params = {
    select: '*',
    order: 'received_at.desc',
    limit,
    offset,
    status: status ? `eq.${status}` : undefined,
    assignee: assignee === 'none' ? 'is.null' : assignee ? `eq.${assignee}` : undefined,
    or: needle
      ? `(${['id', 'name', 'email', 'message'].map((c) => `${c}.ilike."*${needle}*"`).join(',')})`
      : undefined,
  };
  const { data, res } = await rest(`enquiries?${qs(params)}`, { prefer: 'count=exact' });
  return { total: totalFrom(res), results: data.map(fromRow) };
}

export async function getEnquiry(id) {
  const { data } = await rest(`enquiries?${qs({ id: `eq.${id}`, select: '*' })}`);
  return data[0] ? fromRow(data[0]) : null;
}

export async function createEnquiry(input) {
  const { data } = await rest('enquiries', {
    method: 'POST',
    body: toRow({ status: 'new', history: [], ...input }),
    prefer: 'return=representation',
  });
  return fromRow(data[0]);
}

export async function updateEnquiry(id, patch) {
  const { data } = await rest(`enquiries?${qs({ id: `eq.${id}` })}`, {
    method: 'PATCH',
    body: toRow({ ...patch, updatedAt: new Date().toISOString() }),
    prefer: 'return=representation',
  });
  return data[0] ? fromRow(data[0]) : null;
}

export async function deleteEnquiry(id) {
  const { data } = await rest(`enquiries?${qs({ id: `eq.${id}` })}`, {
    method: 'DELETE',
    prefer: 'return=representation',
  });
  return data.length > 0;
}

export async function countEnquiries() {
  const { res } = await rest('enquiries?select=id&limit=1', { prefer: 'count=exact' });
  return totalFrom(res);
}

export async function statusCounts() {
  const { data } = await rest('enquiry_status_counts?select=status,count');
  return Object.fromEntries(data.map((r) => [r.status, r.count]));
}

export async function getSettings() {
  const { data } = await rest('settings?select=key,value');
  return Object.fromEntries(data.map((r) => [r.key, r.value]));
}

export async function setSetting(key, value) {
  await rest('settings?on_conflict=key', {
    ...UPSERT,
    body: { key, value, updated_at: new Date().toISOString() },
  });
}

const mailFromRow = (r) => ({
  id: r.id,
  createdAt: r.created_at,
  enquiryId: r.enquiry_id,
  kind: r.kind,
  to: r.recipients,
  replyTo: r.reply_to,
  subject: r.subject,
  body: r.body,
  transport: r.transport,
  status: r.status,
  error: r.error,
});

export async function addMail(entry) {
  const { data } = await rest('email_log', {
    method: 'POST',
    body: {
      enquiry_id: entry.enquiryId ?? null,
      kind: entry.kind,
      recipients: entry.to,
      reply_to: entry.replyTo ?? null,
      subject: entry.subject,
      body: entry.body,
      transport: entry.transport,
      status: entry.status,
      error: entry.error ?? null,
    },
    prefer: 'return=representation',
  });
  return mailFromRow(data[0]);
}

export async function listMail({ limit = 100, enquiryId } = {}) {
  const params = {
    select: '*',
    order: 'created_at.desc',
    limit,
    enquiry_id: enquiryId ? `eq.${enquiryId}` : undefined,
  };
  const { data } = await rest(`email_log?${qs(params)}`);
  return data.map(mailFromRow);
}
