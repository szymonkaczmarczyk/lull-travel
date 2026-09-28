import { adm } from '../state.js';
import { esc, head, ago, fmtDateTime, empty } from '../ui.js';

const TONE = { logged: 'muted', sent: 'ok', failed: 'danger' };

const KIND = {
  team: 'Team notification',
  ack: 'Receipt to customer',
  forward: 'Forward',
  test: 'Test',
  'status-team': 'Status note to team',
};

const kindLabel = (k) => KIND[k] ?? (String(k).startsWith('status:') ? 'Status email to customer' : k);

export function mailNotice(info) {
  if (!info) return '';
  if (!info.ready) {
    return `<div class="adm-notice adm-notice--warm adm-fade">
      <span><strong>Mail is not ready.</strong> <code>MAIL_TRANSPORT=${esc(info.transport)}</code> is set, but its key is missing or the name is unknown. Every attempt is recorded here as failed.</span>
    </div>`;
  }
  if (!info.delivers) {
    return `<div class="adm-notice adm-fade">
      <span><strong>Nothing leaves this server yet.</strong> Mail runs on <code>MAIL_TRANSPORT=log</code>: every notification is built, routed and kept in the outbox, but not delivered. Set a real transport in <code>.env</code> when you are ready.</span>
    </div>`;
  }
  return '';
}

export function mailRow(m) {
  return `
    <details class="adm-mail">
      <summary>
        <span class="adm-status" data-tone="${TONE[m.status] || 'muted'}">${esc(m.status)}</span>
        <span style="min-width:0">
          <span class="adm-mail__subject">${esc(m.subject)}</span>
          <span class="adm-mail__to">${esc(kindLabel(m.kind))} · ${esc((m.to || []).join(', '))}</span>
        </span>
        <span class="adm-when" title="${esc(fmtDateTime(m.createdAt))}">${esc(ago(m.createdAt))}</span>
      </summary>
      ${m.error ? `<p class="adm-mail__error">${esc(m.error)}</p>` : ''}
      <div class="adm-mail__body">${[
        m.replyTo ? `Reply-To: ${esc(m.replyTo)}` : '',
        m.enquiryId ? `Enquiry: <a class="link" href="/admin/enquiries/${esc(m.enquiryId)}">${esc(m.enquiryId)}</a>` : '',
        `Transport: ${esc(m.transport)}`,
      ]
        .filter(Boolean)
        .join('\n')}\n\n${esc(m.body)}</div>
    </details>`;
}

export async function render(el) {
  el.innerHTML = head({ crumbs: [['/admin', 'Admin'], [null, 'Outbox']], title: 'Outbox' });
  const data = await adm('/outbox?limit=200');

  el.innerHTML = `
    ${head({
      crumbs: [['/admin', 'Admin'], [null, 'Outbox']],
      title: 'Outbox',
      sub: 'Every email the system has written, newest first, whether or not it was delivered.',
    })}
    ${mailNotice(data.mail)}
    <div class="adm-panel adm-panel--flush adm-fade" style="margin-top:24px">
      ${data.results.length ? data.results.map(mailRow).join('') : empty('The outbox is empty.', 'Send an enquiry from the plan page to see what goes out.')}
    </div>`;
}
