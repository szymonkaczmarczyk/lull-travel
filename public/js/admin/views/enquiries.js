import { adm, send, state, loadCollection, statusOf, mailboxOf, go, refreshBadge } from '../state.js';
import {
  esc, head, statusTag, ago, fmtDateTime, empty, skeletonRows, toast, failToast,
  confirmDialog, field, options, clearErrors, showErrors, ICON,
} from '../ui.js';
import { mailRow } from './outbox.js';

const PAGE = 50;

const who = (by) => (by === 'site' ? 'The site' : String(by || 'Someone').split('@')[0]);

function names() {
  const dest = new Map((state.destinations || []).map((d) => [d.slug, d]));
  const stay = new Map((state.stays || []).map((s) => [s.slug, s]));
  return {
    region: (slug) => (slug ? dest.get(slug)?.name ?? slug : ''),
    stay: (slug) => (slug ? stay.get(slug)?.name ?? slug : ''),
  };
}

export async function list(el) {
  await Promise.all([loadCollection('destinations'), loadCollection('stays')]);
  const params = new URLSearchParams(location.search);
  const filters = {
    status: params.get('status') || '',
    assignee: params.get('assignee') || '',
    q: params.get('q') || '',
    page: Math.max(1, Number(params.get('page')) || 1),
  };
  const { statuses, mailboxes } = state.settings;

  el.innerHTML = `
    ${head({
      crumbs: [['/admin', 'Admin'], [null, 'Enquiries']],
      title: 'Enquiries',
      sub: 'Everything sent through the plan page. Click a row to read it, move it along, or pass it on.',
      actions: `<a class="btn btn--ghost btn--sm" data-csv download>${ICON.down} Export CSV</a>`,
    })}
    <div class="adm-chips adm-fade" data-chips></div>
    <div class="adm-filters adm-fade">
      ${field({ key: 'q', label: 'Search', control: `<input class="field__input" id="f-q" type="search" placeholder="Name, email, reference or words from the message" value="${esc(filters.q)}" data-q>` }).replace('class="field"', 'class="field field--grow"')}
      ${field({
        key: 'assignee',
        label: 'Handler',
        control: `<select id="f-assignee" data-assignee>${options(
          [['', 'Everyone'], ['none', 'Unassigned'], ...mailboxes.map((m) => [m.id, m.name])],
          filters.assignee
        )}</select>`,
      })}
    </div>
    <div class="adm-panel adm-panel--flush adm-fade" data-results>${skeletonRows(6)}</div>`;

  const results = el.querySelector('[data-results]');
  const chips = el.querySelector('[data-chips]');
  const csv = el.querySelector('[data-csv]');
  const n = names();

  const query = () => {
    const p = new URLSearchParams();
    if (filters.status) p.set('status', filters.status);
    if (filters.assignee) p.set('assignee', filters.assignee);
    if (filters.q) p.set('q', filters.q);
    return p;
  };

  async function load() {
    const p = query();
    csv.href = `/api/admin/enquiries.csv${p.toString() ? `?${p}` : ''}`;
    if (filters.page > 1) p.set('page', filters.page);
    history.replaceState(null, '', `/admin/enquiries${p.toString() ? `?${p}` : ''}`);

    const api = query();
    api.set('limit', PAGE);
    api.set('offset', (filters.page - 1) * PAGE);

    let data;
    try {
      data = await adm(`/enquiries?${api}`);
    } catch (err) {
      failToast(err);
      return;
    }

    const all = Object.values(data.counts).reduce((a, b) => a + b, 0);
    chips.innerHTML = [
      `<button class="adm-chip" type="button" data-status="" aria-pressed="${!filters.status}">All <span>${all}</span></button>`,
      ...statuses.map(
        (s) =>
          `<button class="adm-chip" type="button" data-status="${esc(s.key)}" aria-pressed="${filters.status === s.key}">${esc(s.label)} <span>${data.counts[s.key] || 0}</span></button>`
      ),
    ].join('');

    if (!data.results.length) {
      results.innerHTML = empty(
        filters.q || filters.status || filters.assignee ? 'Nothing matches.' : 'No enquiries yet.',
        filters.q || filters.status || filters.assignee ? 'Try a different filter.' : 'They will appear here the moment someone uses the plan page.'
      );
      return;
    }

    const pages = Math.ceil(data.total / PAGE);
    results.innerHTML = `
      <div class="adm-table-wrap">
        <table class="adm-table">
          <thead><tr><th>Ref</th><th>Name</th><th>Trip</th><th class="is-num">Party</th><th>Handler</th><th>Status</th><th class="is-num">Received</th></tr></thead>
          <tbody>
            ${data.results
              .map(
                (e) => `
              <tr data-href="/admin/enquiries/${esc(e.id)}">
                <td><span class="adm-ref">${esc(e.id)}</span></td>
                <td><strong>${esc(e.name)}</strong><span class="adm-cell-sub">${esc(e.email)}</span></td>
                <td>${esc(n.region(e.destination) || 'Any region')}<span class="adm-cell-sub">${esc(n.stay(e.stay) || 'Shortlist')} · ${esc(e.month || 'Not sure yet')}</span></td>
                <td class="is-num">${esc(e.party)}</td>
                <td>${esc(mailboxOf(e.assignee)?.name ?? 'Unassigned')}</td>
                <td>${statusTag(e.status)}</td>
                <td class="is-num"><span class="adm-when" title="${esc(fmtDateTime(e.receivedAt))}">${esc(ago(e.receivedAt))}</span></td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ${
        pages > 1
          ? `<div class="adm-pager">
              <span class="mono">Page ${filters.page} of ${pages} · ${data.total} total</span>
              <div class="adm-actions">
                <button class="btn btn--ghost btn--sm" type="button" data-page="${filters.page - 1}"${filters.page <= 1 ? ' disabled' : ''}>${ICON.back} Newer</button>
                <button class="btn btn--ghost btn--sm" type="button" data-page="${filters.page + 1}"${filters.page >= pages ? ' disabled' : ''}>Older ${ICON.arrow}</button>
              </div>
            </div>`
          : ''
      }`;
  }

  chips.addEventListener('click', (e) => {
    const b = e.target.closest('[data-status]');
    if (!b) return;
    filters.status = b.dataset.status;
    filters.page = 1;
    load();
  });

  results.addEventListener('click', (e) => {
    const b = e.target.closest('[data-page]');
    if (!b) return;
    filters.page = Number(b.dataset.page);
    load();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  el.querySelector('[data-assignee]').addEventListener('change', (e) => {
    filters.assignee = e.target.value;
    filters.page = 1;
    load();
  });

  let timer;
  el.querySelector('[data-q]').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      filters.q = e.target.value.trim();
      filters.page = 1;
      load();
    }, 280);
  });

  await load();
}

function timelineItem(ev) {
  const note = ev.text ? `<div class="adm-timeline__note">${esc(ev.text)}</div>` : '';
  const box = (id) => `<strong>${esc(mailboxOf(id)?.name ?? id ?? 'nobody')}</strong>`;
  let tone = 'muted';
  let text = '';
  switch (ev.type) {
    case 'created':
      tone = 'teal';
      text = `Came in through the site. Routed to ${box(ev.to)}.`;
      break;
    case 'status':
      tone = statusOf(ev.to)?.tone || 'muted';
      text = `${esc(who(ev.by))} moved it from <strong>${esc(statusOf(ev.from)?.label ?? ev.from)}</strong> to <strong>${esc(statusOf(ev.to)?.label ?? ev.to)}</strong>.`;
      break;
    case 'assigned':
      tone = 'warm';
      text = `${esc(who(ev.by))} passed it to ${box(ev.to)}.`;
      break;
    case 'forwarded':
      tone = 'warm';
      text = `${esc(who(ev.by))} forwarded a copy to <strong>${esc(ev.to)}</strong>.`;
      break;
    case 'note':
      text = `${esc(who(ev.by))} added a note.`;
      break;
    default:
      text = esc(ev.type);
  }
  return `
    <li data-tone="${esc(tone)}">
      <div class="adm-timeline__meta">${esc(fmtDateTime(ev.at))}</div>
      <div class="adm-timeline__text">${text}</div>
      ${note}
    </li>`;
}

export async function detail(el, id) {
  await Promise.all([loadCollection('destinations'), loadCollection('stays')]);
  const { enquiry: e, mail, routing } = await adm(`/enquiries/${encodeURIComponent(id)}`);
  const { statuses, mailboxes } = state.settings;
  const n = names();
  const suggested = mailboxOf(routing.suggested);

  el.innerHTML = `
    ${head({
      crumbs: [['/admin', 'Admin'], ['/admin/enquiries', 'Enquiries'], [null, e.id]],
      title: e.name,
      sub: `Received ${esc(fmtDateTime(e.receivedAt))} · ${esc(ago(e.receivedAt))}`,
      actions: `${statusTag(e.status)}<button class="btn btn--danger btn--sm" type="button" data-delete>${ICON.trash} Delete</button>`,
    })}

    <div class="adm-detail">
      <div>
        <section class="adm-panel adm-fade">
          <h2 class="adm-panel__title">The enquiry</h2>
          <dl class="adm-dl">
            <dt>Email</dt><dd><a href="mailto:${esc(e.email)}?subject=${encodeURIComponent(`Your enquiry ${e.id}`)}">${esc(e.email)}</a></dd>
            <dt>Party</dt><dd>${esc(e.party)} ${Number(e.party) === 1 ? 'person' : 'people'}</dd>
            <dt>When</dt><dd>${esc(e.month || 'Not sure yet')}</dd>
            <dt>Region</dt><dd>${e.destination ? `<a href="/destinations/${esc(e.destination)}" target="_blank" rel="noopener">${esc(n.region(e.destination))}</a>` : 'No preference'}</dd>
            <dt>Stay</dt><dd>${e.stay ? `<a href="/stays/${esc(e.stay)}" target="_blank" rel="noopener">${esc(n.stay(e.stay))}</a>` : 'Wants a shortlist'}</dd>
            <dt>Handler</dt><dd>${esc(mailboxOf(e.assignee)?.name ?? 'Unassigned')}${mailboxOf(e.assignee) ? ` <span class="adm-cell-sub" style="display:inline">${esc(mailboxOf(e.assignee).email)}</span>` : ''}</dd>
          </dl>
          <div class="adm-message${e.message ? '' : ' adm-message--empty'}">${esc(e.message || 'No message. Name, email and the fields above were enough for them.')}</div>
        </section>

        <section class="adm-section adm-fade">
          <div class="adm-section__head"><h2 class="adm-h2">History</h2></div>
          <div class="adm-panel">
            ${e.history.length ? `<ol class="adm-timeline">${e.history.map(timelineItem).join('')}</ol>` : '<p class="adm-sub">No history recorded.</p>'}
          </div>
        </section>

        <section class="adm-section adm-fade">
          <div class="adm-section__head"><h2 class="adm-h2">Mail about this enquiry</h2></div>
          <div class="adm-panel adm-panel--flush">
            ${mail.length ? mail.map(mailRow).join('') : empty('No mail yet.')}
          </div>
        </section>
      </div>

      <aside class="adm-detail__side">
        <form class="adm-panel adm-stack adm-fade" data-status-form>
          <h2 class="adm-panel__title" style="margin:0">Status</h2>
          ${field({ key: 'status', control: `<select name="status" aria-label="Status">${options(statuses.map((s) => [s.key, s.label]), e.status)}</select>` })}
          <p class="field__hint" data-status-hint></p>
          <button class="btn btn--sm" type="submit">Update status</button>
        </form>

        <form class="adm-panel adm-stack adm-fade" data-assign-form>
          <h2 class="adm-panel__title" style="margin:0">Pass it on</h2>
          ${field({ key: 'assignee', control: `<select name="assignee" aria-label="Handler">${options(mailboxes.map((m) => [m.id, `${m.name} · ${m.email}`]), e.assignee, { empty: e.assignee ? undefined : 'Pick a mailbox' })}</select>` })}
          ${field({ key: 'note', control: '<textarea name="note" placeholder="A line for whoever picks it up. Optional." aria-label="Note for the handler"></textarea>' })}
          <p class="field__hint">${suggested ? `Routing points to <strong>${esc(suggested.name)}</strong>${routing.rule ? ` because of the rule for ${esc(n.region(routing.rule.destination))}` : ' as the fallback'}.` : ''} The new handler gets an email with the full enquiry.</p>
          <button class="btn btn--ghost btn--sm" type="submit">${ICON.send} Reassign</button>
        </form>

        <form class="adm-panel adm-stack adm-fade" data-forward-form novalidate>
          <h2 class="adm-panel__title" style="margin:0">Forward a copy</h2>
          ${field({ key: 'to', control: '<input class="field__input" name="to" type="email" placeholder="someone@example.com" aria-label="Forward to">' })}
          ${field({ key: 'note', control: '<textarea name="note" placeholder="Why you are sending it. Optional." aria-label="Note"></textarea>' })}
          <p class="field__hint">For a guide, a host or a colleague outside the mailboxes. The handler stays the same.</p>
          <button class="btn btn--ghost btn--sm" type="submit">${ICON.send} Forward</button>
        </form>

        <form class="adm-panel adm-stack adm-fade" data-note-form>
          <h2 class="adm-panel__title" style="margin:0">Internal note</h2>
          ${field({ key: 'note', control: '<textarea name="text" placeholder="Only visible here." aria-label="Internal note"></textarea>' })}
          <button class="btn btn--ghost btn--sm" type="submit">Add note</button>
        </form>
      </aside>
    </div>`;

  const reload = () => detail(el, id);

  const statusForm = el.querySelector('[data-status-form]');
  const hint = el.querySelector('[data-status-hint]');
  const describe = () => {
    const s = statusOf(statusForm.status.value);
    const bits = [];
    if (s?.notifyCustomer) bits.push(`${e.name} gets an email when you move it here.`);
    if (s?.notifyTeam) bits.push('The handler gets a short note.');
    if (s?.final) bits.push('This closes the enquiry.');
    hint.textContent = bits.join(' ') || 'No email goes out for this status.';
  };
  statusForm.status.addEventListener('change', describe);
  describe();

  async function act(form, fn, done) {
    clearErrors(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await fn();
      toast(done);
      refreshBadge();
      await reload();
    } catch (err) {
      btn.disabled = false;
      if (err.data?.fields) showErrors(form, err.data.fields, err.data.error);
      else failToast(err);
    }
  }

  statusForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const key = statusForm.status.value;
    if (key === e.status) return toast('It is already there.');
    act(statusForm, () => send(`/enquiries/${encodeURIComponent(id)}`, 'PATCH', { status: key }), `Moved to ${statusOf(key)?.label ?? key}.`);
  });

  const assignForm = el.querySelector('[data-assign-form]');
  assignForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const assignee = assignForm.assignee.value;
    if (!assignee) return showErrors(assignForm, { assignee: 'Pick a mailbox.' });
    if (assignee === e.assignee) return toast('It is already with them.');
    act(
      assignForm,
      () => send(`/enquiries/${encodeURIComponent(id)}`, 'PATCH', { assignee, note: assignForm.note.value }),
      `Passed to ${mailboxOf(assignee)?.name}.`
    );
  });

  const forwardForm = el.querySelector('[data-forward-form]');
  forwardForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    act(
      forwardForm,
      () => send(`/enquiries/${encodeURIComponent(id)}/forward`, 'POST', { to: forwardForm.to.value, note: forwardForm.note.value }),
      `Forwarded to ${forwardForm.to.value.trim()}.`
    );
  });

  const noteForm = el.querySelector('[data-note-form]');
  noteForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    act(noteForm, () => send(`/enquiries/${encodeURIComponent(id)}/notes`, 'POST', { text: noteForm.text.value }), 'Note added.');
  });

  el.querySelector('[data-delete]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: `Delete ${e.id}?`,
      body: `${e.name}'s enquiry and its history go for good. The mail already written stays in the outbox.`,
    });
    if (!ok) return;
    try {
      await send(`/enquiries/${encodeURIComponent(id)}`, 'DELETE');
      toast(`${e.id} deleted.`);
      refreshBadge();
      go('/admin/enquiries', true);
    } catch (err) {
      failToast(err);
    }
  });
}
