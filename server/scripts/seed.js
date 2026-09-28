import '../lib/env.js';
import { db } from '../db/index.js';
import { readSeed } from '../lib/store.js';
import { DEFAULTS } from '../lib/settings.js';

const args = new Set(process.argv.slice(2));
const withSettings = args.has('--settings');

if (!args.has('--yes')) {
  console.log(`This resets stays, destinations and journal in "${db.name}" to server/data/*.json.`);
  if (withSettings) console.log('It also resets mailboxes, routing, statuses and email templates to their defaults.');
  console.log('Enquiries and the outbox are never touched.\n');
  console.log(`Run again with --yes to go ahead:  npm run db:seed -- --yes${withSettings ? ' --settings' : ''}`);
  process.exit(0);
}

for (const name of ['destinations', 'stays', 'journal']) {
  const seed = readSeed(name);
  const keep = new Set(seed.map((d) => d.slug));
  const current = await db.listEntries(name);
  const extra = current.filter((d) => !keep.has(d.slug));
  for (const d of extra) await db.deleteEntry(name, d.slug);
  await db.putEntries(name, seed);
  console.log(`${name.padEnd(13)} ${seed.length} written${extra.length ? `, ${extra.length} removed` : ''}`);
}

if (withSettings) {
  for (const [key, value] of Object.entries(DEFAULTS)) await db.setSetting(key, value);
  console.log(`settings      ${Object.keys(DEFAULTS).length} keys reset`);
}

console.log(`\nDone. Database: ${db.name}.`);
