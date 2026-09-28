import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto';

const COOKIE = 'lull_admin';
const TTL_MS = 12 * 60 * 60 * 1000;
const SECRET = process.env.SESSION_SECRET || randomBytes(32).toString('hex');

if (!process.env.SESSION_SECRET) {
  console.warn('[auth] SESSION_SECRET is not set. Admin sessions will end whenever the server restarts.');
}

export const adminEnabled = () => Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);

const digest = (s) => createHash('sha256').update(String(s)).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));
const sign = (data) => createHmac('sha256', SECRET).update(data).digest('base64url');

export function checkCredentials(email, password) {
  if (!adminEnabled()) return false;
  const okEmail = same(String(email ?? '').trim().toLowerCase(), process.env.ADMIN_EMAIL.trim().toLowerCase());
  const okPassword = same(password ?? '', process.env.ADMIN_PASSWORD);
  return okEmail && okPassword;
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const isHttps = (req) => req.secure || req.get('x-forwarded-proto') === 'https';

export function startSession(req, res, email) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + TTL_MS })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  res.append(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_MS / 1000}${isHttps(req) ? '; Secure' : ''}`
  );
}

export function endSession(req, res) {
  res.append('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isHttps(req) ? '; Secure' : ''}`);
}

export function readSession(req) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !same(signature, sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.exp > Date.now() ? { email: data.email } : null;
  } catch {
    return null;
  }
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function sameOrigin(req, res, next) {
  if (SAFE.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  let host = null;
  try {
    host = new URL(origin).host;
  } catch {}
  if (host !== req.get('host')) {
    return res.status(403).json({ error: 'Cross-origin request refused.' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!adminEnabled()) {
    return res.status(503).json({ error: 'Admin is switched off. Set ADMIN_EMAIL and ADMIN_PASSWORD in .env.' });
  }
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Sign in first.' });
  req.admin = session;
  next();
}
