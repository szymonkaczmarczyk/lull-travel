import { adm, state, mailboxOf } from '../state.js';
import { esc, head, statusTag, ago, empty, ICON } from '../ui.js';
import { mailNotice, mailRow } from './outbox.js';

export async function render(el) {
  el.innerHTML = head({ title: 'Overview', sub: 'Loading…' });
  const data = await adm('/overview');
  const { statuses } = state.settings;
  const max = Math.max(1, ...statuses.map((s) => data.counts[s.key] || 0));
  const first = statuses[0];

  el.innerHTML = `
    ${head({
      title: 'Overview',
      sub: `${data.open} open ${data.open === 1 ? 'enquiry' : 'enquiries'}. Database: <span class="adm-code">${esc(data.db)}</span>`,
      actions: `<a class="btn btn--sm" href="/admin/enquiries${first ? `?status=${encodeURIComponent(first.key)}` : ''}">Open the inbox ${ICON.arrow}</a>`,
    })}

    ${mailNotice(data.mailInfo)}

    <div class="stats adm-stats adm-fade" style="margin-top:28px">
      <div class="stat"><div class="stat__num">${data.total}</div><div class="stat__label">Enquiries, all time</div></div>
      <div class="stat"><div class="stat__num">${data.open}</div><div class="stat__label">Still open</div></div>
      <div class="stat"><div class="stat__num">${data.content.stays}</div><div class="stat__label">Stays live</div></div>
      <div class="stat"><div class="stat__num">${data.content.journal}</div><div class="stat__label">Journal pieces</div></div>
    </div>

    <div class="adm-two adm-section">
      <section class="adm-panel adm-panel--flush adm-fade">
        <div class="adm-section__head" style="padding:22px 22px 0">
          <h2 class="adm-h2">Latest enquiries</h2>
          <a class="link" href="/admin/enquiries">All of them</a>
        </div>
        ${
          data.recent.length
            ? `<div class="adm-table-wrap"><table class="adm-table" style="margin-top:10px">
                <tbody>
                  ${data.recent
                    .map(
                      (e) => `
                    <tr data-href="/admin/enquiries/${esc(e.id)}">
                      <td><strong>${esc(e.name)}</strong><span class="adm-cell-sub">${esc(mailboxOf(e.assignee)?.name ?? 'Unassigned')}</span></td>
                      <td>${statusTag(e.status)}</td>
                      <td class="is-num"><span class="adm-when">${esc(ago(e.receivedAt))}</span></td>
                    </tr>`
                    )
                    .join('')}
                </tbody>
              </table></div>`
            : empty('Nothing yet.', 'Enquiries from the plan page will appear here.')
        }
      </section>

      <section class="adm-panel adm-fade">
        <h2 class="adm-panel__title">By status</h2>
        <div class="adm-bars">
          ${statuses
            .map((s) => {
              const n = data.counts[s.key] || 0;
              return `
              <a class="adm-bar" href="/admin/enquiries?status=${encodeURIComponent(s.key)}">
                <span class="adm-cell-sub" style="margin:0;color:var(--ink-muted)">${esc(s.label)}</span>
                <span class="adm-bar__track"><span class="adm-bar__fill" data-tone="${esc(s.tone)}" style="width:${(n / max) * 100}%"></span></span>
                <span class="adm-bar__n">${n}</span>
              </a>`;
            })
            .join('')}
        </div>
      </section>
    </div>

    <section class="adm-section adm-fade">
      <div class="adm-section__head">
        <h2 class="adm-h2">Latest mail</h2>
        <a class="link" href="/admin/outbox">Outbox</a>
      </div>
      <div class="adm-panel adm-panel--flush">
        ${data.mail.length ? data.mail.map(mailRow).join('') : empty('No mail yet.', 'Every notification the system writes is kept here.')}
      </div>
    </section>`;
}
