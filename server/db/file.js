import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const DB = join(DATA, 'db');
const ENQUIRIES = join(DATA, 'enquiries.json');
const SETTINGS = join(DB, 'settings.json');
const MAIL = join(DB, 'email_log.json');
const MAIL_CAP = 500;

export const name = 'file';

const load = (file, fallback) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback);

function save(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(value, null, 2));
}

const entriesFile = (collection) => join(DB, `${collection}.json`);
const currentEntries = (collection) =>
  load(entriesFile(collection), null) ?? load(join(DATA, `${collection}.json`), []);

export async function listEntries(collection) {
  return currentEntries(collection);
}

export async function putEntries(collection, docs) {
  save(entriesFile(collection), docs);
}

export async function putEntry(collection, doc, position) {
  const all = currentEntries(collection);
  const i = all.findIndex((d) => d.slug === doc.slug);
  if (i === -1) all.splice(position ?? all.length, 0, doc);
  else all[i] = doc;
  save(entriesFile(collection), all);
}

export async function deleteEntry(collection, slug) {
  save(entriesFile(collection), currentEntries(collection).filter((d) => d.slug !== slug));
}

const allEnquiries = () =>
  load(ENQUIRIES, []).map((e) => ({ assignee: null, history: [], updatedAt: e.receivedAt, ...e }));
const byNewest = (a, b) => String(b.receivedAt).localeCompare(String(a.receivedAt));

export async function listEnquiries({ status, assignee, q, limit = 50, offset = 0 } = {}) {
  let rows = allEnquiries().sort(byNewest);
  if (status) rows = rows.filter((e) => e.status === status);
  if (assignee === 'none') rows = rows.filter((e) => !e.assignee);
  else if (assignee) rows = rows.filter((e) => e.assignee === assignee);
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((e) => [e.id, e.name, e.email, e.message].join(' ').toLowerCase().includes(needle));
  }
  return { total: rows.length, results: rows.slice(offset, offset + limit) };
}

export async function getEnquiry(id) {
  return allEnquiries().find((e) => e.id === id) ?? null;
}

export async function createEnquiry(data) {
  const all = allEnquiries();
  const next = all.reduce((n, e) => Math.max(n, Number(String(e.id).split('-')[1]) || 0), 0) + 1;
  const now = new Date().toISOString();
  const record = {
    id: `LUL-${String(next).padStart(4, '0')}`,
    receivedAt: now,
    updatedAt: now,
    status: 'new',
    assignee: null,
    history: [],
    ...data,
  };
  all.push(record);
  save(ENQUIRIES, all);
  return record;
}

export async function updateEnquiry(id, patch) {
  const all = allEnquiries();
  const i = all.findIndex((e) => e.id === id);
  if (i === -1) return null;
  all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
  save(ENQUIRIES, all);
  return all[i];
}

export async function deleteEnquiry(id) {
  const all = allEnquiries();
  const rest = all.filter((e) => e.id !== id);
  if (rest.length === all.length) return false;
  save(ENQUIRIES, rest);
  return true;
}

export async function countEnquiries() {
  return allEnquiries().length;
}

export async function statusCounts() {
  return allEnquiries().reduce((acc, e) => ({ ...acc, [e.status]: (acc[e.status] || 0) + 1 }), {});
}

export async function getSettings() {
  return load(SETTINGS, {});
}

export async function setSetting(key, value) {
  save(SETTINGS, { ...load(SETTINGS, {}), [key]: value });
}

export async function addMail(entry) {
  const all = load(MAIL, []);
  const next = (all[0]?.id || 0) + 1;
  const record = { id: next, createdAt: new Date().toISOString(), ...entry };
  save(MAIL, [record, ...all].slice(0, MAIL_CAP));
  return record;
}

export async function listMail({ limit = 100, enquiryId } = {}) {
  let rows = load(MAIL, []);
  if (enquiryId) rows = rows.filter((m) => m.enquiryId === enquiryId);
  return rows.slice(0, limit);
}
