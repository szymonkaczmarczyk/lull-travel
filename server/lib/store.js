import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db/index.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');

export const readSeed = (name) => JSON.parse(readFileSync(join(DATA_DIR, `${name}.json`), 'utf8'));

export const stays = [];
export const destinations = [];
export const journal = [];

export const collections = { stays, destinations, journal };

export async function initStore() {
  for (const [name, list] of Object.entries(collections)) {
    let rows = await db.listEntries(name);
    if (!rows.length) {
      rows = readSeed(name);
      await db.putEntries(name, rows);
    }
    list.splice(0, list.length, ...rows);
  }
}

export async function saveEntry(name, doc) {
  const list = collections[name];
  const i = list.findIndex((d) => d.slug === doc.slug);
  await db.putEntry(name, doc, i === -1 ? list.length : i);
  if (i === -1) list.push(doc);
  else list[i] = doc;
  return doc;
}

export async function removeEntry(name, slug) {
  const list = collections[name];
  const i = list.findIndex((d) => d.slug === slug);
  if (i === -1) return false;
  await db.deleteEntry(name, slug);
  list.splice(i, 1);
  return true;
}

export function expandStay(stay) {
  const dest = destinations.find((d) => d.slug === stay.destination);
  return {
    ...stay,
    destination: dest
      ? { slug: dest.slug, name: dest.name, country: dest.country, region: dest.region, accent: dest.accent }
      : null,
  };
}
