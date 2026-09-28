import { db } from '../db/index.js';
import { settings } from './settings.js';

const TRANSPORT = (process.env.MAIL_TRANSPORT || 'log').toLowerCase();

const transports = {
  async log(msg) {
    console.log(
      `\n[mail:log] ${msg.kind} → ${msg.to.join(', ')}\n` +
        `  from: ${msg.from}${msg.replyTo ? `\n  reply-to: ${msg.replyTo}` : ''}\n` +
        `  subject: ${msg.subject}\n`
    );
    return { status: 'logged' };
  },

  async resend(msg) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('MAIL_TRANSPORT is "resend" but RESEND_API_KEY is empty.');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return { status: 'sent' };
  },
};

export function mailInfo() {
  const known = TRANSPORT in transports;
  const ready = known && (TRANSPORT !== 'resend' || Boolean(process.env.RESEND_API_KEY));
  return { transport: TRANSPORT, ready, delivers: ready && TRANSPORT !== 'log' };
}

export function render(template, vars) {
  return String(template ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ''));
}

export async function sendMail({ to, subject, text, replyTo, kind, enquiryId = null }) {
  const recipients = [...new Set([].concat(to).filter(Boolean))];
  if (!recipients.length) return null;

  const { fromName, fromEmail, replyTo: defaultReplyTo } = settings().mail;
  const msg = {
    kind,
    from: `${fromName} <${fromEmail}>`,
    to: recipients,
    replyTo: replyTo || defaultReplyTo || '',
    subject,
    text,
  };

  let result;
  try {
    const send = transports[TRANSPORT];
    if (!send) throw new Error(`Unknown MAIL_TRANSPORT "${TRANSPORT}".`);
    result = await send(msg);
  } catch (err) {
    console.error(`[mail] ${kind} to ${recipients.join(', ')} failed: ${err.message}`);
    result = { status: 'failed', error: err.message };
  }

  try {
    return await db.addMail({
      enquiryId,
      kind,
      to: recipients,
      replyTo: msg.replyTo || null,
      subject,
      body: text,
      transport: TRANSPORT,
      status: result.status,
      error: result.error ?? null,
    });
  } catch (err) {
    console.error(`[mail] could not write the outbox: ${err.message}`);
    return null;
  }
}
