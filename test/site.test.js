import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const PORT = 4690 + Math.floor(Math.random() * 200);
const BASE = `http://localhost:${PORT}`;
const ROOT = fileURLToPath(new URL('..', import.meta.url));

let server;

before(async () => {
  server = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), SITE_URL: 'https://lull.example', SUPABASE_URL: '', MAIL_TRANSPORT: 'log' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let output = '';
  server.stdout.on('data', (chunk) => (output += chunk));
  while (!output.includes('LULL running')) await once(server.stdout, 'data');
});

after(() => server?.kill());

const postEnquiry = (body) =>
  fetch(`${BASE}/api/enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const validEnquiry = { name: 'Ines Aro', email: 'ines@example.com', party: 2 };

test('enquiry without consent is rejected with a field error', async () => {
  const res = await postEnquiry(validEnquiry);
  assert.equal(res.status, 422);
  const data = await res.json();
  assert.match(data.fields.consent, /Tick the box/);
});

test('consent sent as a string does not count', async () => {
  const res = await postEnquiry({ ...validEnquiry, consent: 'on' });
  assert.equal(res.status, 422);
});

test('filled honeypot looks accepted but is not stored', async () => {
  const countBefore = await (await fetch(`${BASE}/api/enquiries/count`)).json();
  const res = await postEnquiry({ ...validEnquiry, consent: true, website: 'https://spam.example' });
  assert.equal(res.status, 201);
  const countAfter = await (await fetch(`${BASE}/api/enquiries/count`)).json();
  assert.equal(countAfter.count, countBefore.count);
});

for (const [path, title] of [
  ['/privacy', 'Privacy policy – LULL'],
  ['/terms', 'Terms of use – LULL'],
]) {
  test(`${path} renders with its own title and footer`, async () => {
    const res = await fetch(BASE + path);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes(`<title>${title}</title>`));
    assert.ok(html.includes('data-footer'));
  });
}

test('plan form links to both legal documents and has a consent box', async () => {
  const html = await (await fetch(`${BASE}/plan`)).text();
  assert.ok(html.includes('id="consent"'));
  assert.ok(html.includes('href="/privacy"'));
  assert.ok(html.includes('href="/terms"'));
  assert.ok(html.includes('name="website"'));
});

test('pages share an Open Graph image and canonical on SITE_URL', async () => {
  const html = await (await fetch(`${BASE}/stays`)).text();
  assert.ok(html.includes('<meta property="og:image" content="https://lull.example/og-image.jpg">'));
  assert.ok(html.includes('<link rel="canonical" href="https://lull.example/stays">'));
  const image = await fetch(`${BASE}/og-image.jpg`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/jpeg');
});

test('sitemap lists the legal pages and robots points to it', async () => {
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.ok(sitemap.includes('<loc>https://lull.example/privacy</loc>'));
  assert.ok(sitemap.includes('<loc>https://lull.example/terms</loc>'));
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  assert.ok(robots.includes('Sitemap: https://lull.example/sitemap.xml'));
});

test('favicon.ico is a real icon file', async () => {
  const res = await fetch(`${BASE}/favicon.ico`, { redirect: 'manual' });
  assert.equal(res.status, 200);
  const bytes = new Uint8Array(await res.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 4)], [0, 0, 1, 0]);
});

test('unknown address returns the 404 page with status 404', async () => {
  const res = await fetch(`${BASE}/no-such-place`);
  assert.equal(res.status, 404);
  assert.ok((await res.text()).includes('Nothing here'));
});
