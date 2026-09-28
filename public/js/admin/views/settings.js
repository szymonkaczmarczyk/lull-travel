import { send, state, loadSettings, loadCollection } from '../state.js';
import {
  esc, head, toast, failToast, field, options, switchInput, clearErrors, showErrors, slugify, ICON,
} from '../ui.js';
import { mailNotice } from './outbox.js';

const TABS = [
  ['routing', 'Routing'],
  ['mailboxes', 'Mailboxes'],
  ['statuses', 'Statuses'],
  ['templates', 'Email templates'],
  ['mail', 'Sender'],
];

const SAMPLE = {
  ref: 'LUL-0042',
  name: 'Ines Aro',
  email: 'ines@example.com',
  party: '2',
  month: 'February 2027',
  destination: 'Lofoten, Norway',
  stay: 'Rorbu Nine',
  message: 'We would rather be cold than crowded.',
  status: 'In progress',
  assignee: 'Oslo desk',
  receivedAt: new Date().toUTCString(),
  adminUrl: `${location.origin}/admin/enquiries/LUL-0042`,
  by: 'erik',
  note: 'She asked about the sauna.',
};

const fill = (t) => String(t ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => SAMPLE[k] ?? '');

const remove = `<button class="adm-icon-btn" type="button" data-remove aria-label="Remove">${ICON.trash}</button>`;

const savebar = (label) => `
  <div class="adm-savebar">
    <span class="adm-savebar__state" data-state>Saved</span>
    <button class="btn btn--sm btn--teal" type="submit">${esc(label)}</button>
  </div>`;

function placeholderHelp() {
  return `
    <div class="adm-panel adm-fade">
      <h2 class="adm-panel__title">Placeholders</h2>
      <p class="adm-sub" style="font-size:14px;margin-bottom:14px">Any of these in a subject or body is replaced when the email is written. Click one to copy it.</p>
      <div class="adm-placeholders">${state.placeholders.map((p) => `<code class="adm-code" data-copy="{{${esc(p)}}}">{{${esc(p)}}}</code>`).join('')}</div>
    </div>`;
}

function templateBlock(key, t, { title, hint, toggle }) {
  return `
    <fieldset class="adm-panel adm-group adm-fade" data-field="${key}">
      <legend class="adm-panel__title">${esc(title)}</legend>
      <div class="adm-stack">
        <p class="field__hint" style="margin-top:-6px">${esc(hint)}</p>
        ${toggle ? switchInput({ name: `${key}.enabled`, checked: t.enabled, label: 'Send it' }) : ''}
        ${field({ key: `${key}.subject`, label: 'Subject', control: `<input class="field__input" id="f-${key}.subject" name="${key}.subject" value="${esc(t.subject)}">` })}
        ${field({ key: `${key}.body`, label: 'Body', control: `<textarea class="is-long" id="f-${key}.body" name="${key}.body">${esc(t.body)}</textarea>` })}
        <details>
          <summary class="mono" style="cursor:pointer">Preview with sample data</summary>
          <div class="adm-mail__body" style="margin:14px 0 0" data-preview="${key}"></div>
        </details>
        <span class="field__error" data-error></span>
      </div>
    </fieldset>`;
}

const PANES = {
  routing(s) {
    const r = s.routing;
    const dests = state.destinations || [];
    const boxes = s.mailboxes.map((m) => [m.id, m.name]);
    const row = (rule = {}) => `
      <div class="adm-row" data-row style="--cols:1fr 1fr 36px">
        ${field({ key: 'destination', label: 'Region', control: `<select name="destination">${options(dests.map((d) => [d.slug, `${d.name}, ${d.country}`]), rule.destination, { empty: 'Pick a region' })}</select>` })}
        ${field({ key: 'mailbox', label: 'Goes to', control: `<select name="mailbox">${options(boxes, rule.mailbox, { empty: 'Pick a mailbox' })}</select>` })}
        ${remove}
      </div>`;

    return {
      intro: 'Where a new enquiry lands. The region comes from the form, or from the stay they picked. The mailbox it lands in becomes the handler, and gets the notification.',
      body: `
        <fieldset class="adm-panel adm-group adm-fade">
          <legend class="adm-panel__title">When an enquiry comes in</legend>
          <div class="adm-stack">
            ${switchInput({ name: 'notifyOnCreate', checked: r.notifyOnCreate, label: 'Email the handler straight away' })}
            <div class="adm-fields">
              ${field({ key: 'fallback', label: 'Everything else goes to', control: `<select id="f-fallback" name="fallback">${options(boxes, r.fallback)}</select>`, hint: 'Used when no rule below matches, or they left the region empty.' })}
              <div class="field" data-field="cc">
                <span class="field__label">Always copy</span>
                <div class="adm-checks" style="padding-top:10px">
                  ${s.mailboxes.map((m) => `<label class="adm-check"><input type="checkbox" name="cc" value="${esc(m.id)}"${r.cc.includes(m.id) ? ' checked' : ''}> ${esc(m.name)}</label>`).join('')}
                </div>
                <span class="field__error" data-error></span>
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset class="adm-panel adm-group adm-fade" data-field="rules">
          <legend class="adm-panel__title">Rules by region</legend>
          <div class="adm-rows__head" style="--cols:1fr 1fr 36px"><span>Region</span><span>Goes to</span><span></span></div>
          <div class="adm-rows" data-rows>${r.rules.map(row).join('')}</div>
          <button class="btn btn--ghost btn--sm" type="button" data-add style="margin-top:14px">${ICON.plus} Add a rule</button>
          <span class="field__error" data-error></span>
        </fieldset>`,
      template: row,
      collect(form) {
        return {
          notifyOnCreate: form.elements.notifyOnCreate.checked,
          fallback: form.elements.fallback.value,
          cc: [...form.querySelectorAll('input[name="cc"]:checked')].map((i) => i.value),
          rules: [...form.querySelectorAll('[data-row]')].map((r) => ({
            destination: r.querySelector('[name="destination"]').value,
            mailbox: r.querySelector('[name="mailbox"]').value,
          })),
        };
      },
      rowKey: 'rules',
    };
  },

  mailboxes(s) {
    const row = (m = {}) => `
      <div class="adm-row" data-row style="--cols:1fr 1.3fr 150px 36px">
        ${field({ key: 'name', label: 'Name', control: `<input class="field__input" name="name" value="${esc(m.name ?? '')}" placeholder="Oslo desk">` })}
        ${field({ key: 'email', label: 'Address', control: `<input class="field__input" name="email" type="email" value="${esc(m.email ?? '')}" placeholder="oslo@lull.travel">` })}
        ${field({ key: 'id', label: 'Key', control: `<input class="field__input" name="id" value="${esc(m.id ?? '')}" placeholder="oslo"${m.id ? ' readonly' : ''} spellcheck="false">` })}
        ${remove}
      </div>`;
    return {
      intro: 'The inboxes the system can send to. Routing, reassigning and status notes all pick from this list. Nothing is sent until a real mail transport is set in .env.',
      body: `
        <fieldset class="adm-panel adm-group adm-fade" data-field="list">
          <legend class="adm-panel__title">Mailboxes</legend>
          <div class="adm-rows__head" style="--cols:1fr 1.3fr 150px 36px"><span>Name</span><span>Address</span><span>Key</span><span></span></div>
          <div class="adm-rows" data-rows>${s.mailboxes.map(row).join('')}</div>
          <button class="btn btn--ghost btn--sm" type="button" data-add style="margin-top:14px">${ICON.plus} Add a mailbox</button>
          <span class="field__error" data-error></span>
        </fieldset>`,
      template: row,
      collect(form) {
        return [...form.querySelectorAll('[data-row]')].map((r) => {
          const name = r.querySelector('[name="name"]').value;
          const id = r.querySelector('[name="id"]');
          if (!id.value && name) id.value = slugify(name);
          return { id: id.value, name, email: r.querySelector('[name="email"]').value };
        });
      },
      rowKey: '',
    };
  },

  statuses(s) {
    const tones = state.tones.map((t) => [t, t]);
    const card = (st = { tone: 'muted' }) => `
      <div class="adm-status-card" data-row>
        <div class="adm-status-card__top">
          ${field({ key: 'label', label: 'Label', control: `<input class="field__input" name="label" value="${esc(st.label ?? '')}" placeholder="Waiting on them">` })}
          ${field({ key: 'key', label: 'Key', control: `<input class="field__input" name="key" value="${esc(st.key ?? '')}" placeholder="waiting"${st.key ? ' readonly' : ''} spellcheck="false">` })}
          ${field({ key: 'tone', label: 'Colour', control: `<select name="tone">${options(tones, st.tone)}</select>` })}
          ${remove}
        </div>
        <div class="adm-status-card__flags">
          <label class="adm-check"><input type="checkbox" name="final"${st.final ? ' checked' : ''}> Closes the enquiry</label>
          <label class="adm-check"><input type="checkbox" name="notifyTeam"${st.notifyTeam ? ' checked' : ''}> Note to the handler</label>
          <label class="adm-check"><input type="checkbox" name="notifyCustomer"${st.notifyCustomer ? ' checked' : ''}> Email the customer</label>
        </div>
        <details${st.notifyCustomer ? ' open' : ''}>
          <summary>Customer email for this status</summary>
          <div class="adm-stack">
            ${field({ key: 'subject', label: 'Subject', control: `<input class="field__input" name="subject" value="${esc(st.subject ?? '')}">` })}
            ${field({ key: 'body', label: 'Body', control: `<textarea name="body">${esc(st.body ?? '')}</textarea>` })}
          </div>
        </details>
      </div>`;
    return {
      intro: 'The steps an enquiry moves through, in order. The first one is what every new enquiry starts as. Each can send the customer an email, or drop the handler a note.',
      body: `
        <fieldset class="adm-panel adm-group adm-fade" data-field="list">
          <legend class="adm-panel__title">Statuses, in order</legend>
          <div class="adm-rows" data-rows>${s.statuses.map(card).join('')}</div>
          <button class="btn btn--ghost btn--sm" type="button" data-add style="margin-top:14px">${ICON.plus} Add a status</button>
          <span class="field__error" data-error></span>
        </fieldset>
        ${placeholderHelp()}`,
      template: card,
      collect(form) {
        return [...form.querySelectorAll('[data-row]')].map((r) => {
          const q = (n) => r.querySelector(`[name="${n}"]`);
          if (!q('key').value && q('label').value) q('key').value = slugify(q('label').value);
          return {
            key: q('key').value,
            label: q('label').value,
            tone: q('tone').value,
            final: q('final').checked,
            notifyTeam: q('notifyTeam').checked,
            notifyCustomer: q('notifyCustomer').checked,
            subject: q('subject').value,
            body: q('body').value,
          };
        });
      },
      rowKey: '',
    };
  },

  templates(s) {
    const t = s.templates;
    return {
      intro: 'The words that go out. Plain text, so they read the same in every inbox.',
      body: `
        ${templateBlock('team', t.team, { title: 'New enquiry, to the handler', hint: 'Sent to the routed mailbox and anyone copied. Reply-To is the customer, so answering it answers them.' })}
        ${templateBlock('ack', t.ack, { title: 'Receipt, to the customer', hint: 'Sent to the customer as soon as the enquiry is saved. Reply-To is the handler.', toggle: true })}
        ${templateBlock('forward', t.forward, { title: 'Passed on or forwarded', hint: 'Sent when someone reassigns an enquiry or forwards a copy. {{by}} and {{note}} are filled in.' })}
        ${placeholderHelp()}`,
      collect(form) {
        const v = (k) => form.elements[k].value;
        return {
          team: { subject: v('team.subject'), body: v('team.body') },
          ack: { enabled: form.elements['ack.enabled'].checked, subject: v('ack.subject'), body: v('ack.body') },
          forward: { subject: v('forward.subject'), body: v('forward.body') },
        };
      },
    };
  },

  mail(s) {
    const m = s.mail;
    return {
      intro: 'Who the email appears to come from. The transport itself, and any keys, live in .env and never in the database.',
      body: `
        ${mailNotice(state.mail)}
        <fieldset class="adm-panel adm-group adm-fade" style="margin-top:20px">
          <legend class="adm-panel__title">Sender</legend>
          <div class="adm-fields">
            ${field({ key: 'fromName', label: 'From name', control: `<input class="field__input" id="f-fromName" name="fromName" value="${esc(m.fromName)}">` })}
            ${field({ key: 'fromEmail', label: 'From address', control: `<input class="field__input" id="f-fromEmail" name="fromEmail" type="email" value="${esc(m.fromEmail)}">`, hint: 'Must be a domain your mail provider lets you send from.' })}
            ${field({ key: 'replyTo', label: 'Default Reply-To (optional)', control: `<input class="field__input" id="f-replyTo" name="replyTo" type="email" value="${esc(m.replyTo)}">`, hint: 'Only used when an email has no better Reply-To of its own.', wide: true })}
          </div>
        </fieldset>
        <div class="adm-panel adm-fade" data-test>
          <h2 class="adm-panel__title">Send a test</h2>
          <div class="adm-filters" style="margin:0">
            ${field({ key: 'to', label: 'To', control: `<input class="field__input" id="f-to" name="testTo" type="email" value="${esc(state.me?.email ?? '')}">` }).replace('class="field"', 'class="field field--grow"')}
            <button class="btn btn--ghost btn--sm" type="button" data-send-test>${ICON.send} Send test</button>
          </div>
          <p class="field__hint" style="margin-top:12px">With the log transport it only lands in the outbox and the server console. That is the point: you can check everything before anything is real.</p>
        </div>`,
      collect(form) {
        const v = (k) => form.elements[k].value;
        return { fromName: v('fromName'), fromEmail: v('fromEmail'), replyTo: v('replyTo') };
      },
    };
  },
};

export async function render(el, tab) {
  await Promise.all([loadSettings(true), loadCollection('destinations')]);
  const key = TABS.some(([k]) => k === tab) ? tab : 'routing';
  const pane = PANES[key](state.settings);

  el.innerHTML = `
    ${head({
      crumbs: [['/admin', 'Admin'], [null, 'Settings']],
      title: 'Settings',
      sub: esc(pane.intro),
    })}
    <nav class="adm-tabs adm-fade" aria-label="Settings">
      ${TABS.map(([k, label]) => `<a href="/admin/settings/${k}"${k === key ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('')}
    </nav>
    <form class="adm-form" data-settings novalidate>
      ${pane.body}
      ${savebar('Save')}
    </form>`;

  const form = el.querySelector('[data-settings]');
  const label = el.querySelector('[data-state]');
  const rows = form.querySelector('[data-rows]');

  const dirty = () => {
    state.dirty = true;
    label.textContent = 'Unsaved changes';
    label.classList.add('is-dirty');
  };

  const previews = () => {
    form.querySelectorAll('[data-preview]').forEach((box) => {
      const k = box.dataset.preview;
      box.textContent = `Subject: ${fill(form.elements[`${k}.subject`].value)}\n\n${fill(form.elements[`${k}.body`].value)}`;
    });
  };
  previews();

  form.addEventListener('input', (e) => {
    if (e.target.name === 'testTo') return;
    dirty();
    previews();
  });
  form.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') dirty();
    if (e.target.name === 'notifyCustomer' && e.target.checked) e.target.closest('[data-row]')?.querySelector('details')?.setAttribute('open', '');
  });

  form.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add && rows && pane.template) {
      rows.insertAdjacentHTML('beforeend', pane.template());
      rows.lastElementChild.querySelector('input, select')?.focus();
      dirty();
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      rm.closest('[data-row]').remove();
      dirty();
      return;
    }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.copy).then(() => toast(`Copied ${copy.dataset.copy}`), () => {});
    }
  });

  form.querySelector('[data-send-test]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const box = form.querySelector('[data-test]');
    clearErrors(box);
    btn.disabled = true;
    try {
      const { mail } = await send('/settings/test-mail', 'POST', { to: form.elements.testTo.value });
      toast(mail?.status === 'failed' ? `Test failed: ${mail.error}` : `Test ${mail?.status ?? 'written'}. It is in the outbox.`, mail?.status === 'failed' ? 'danger' : 'teal');
    } catch (err) {
      if (err.data?.fields) showErrors(box, err.data.fields);
      else failToast(err);
    } finally {
      btn.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    try {
      await send(`/settings/${key}`, 'PUT', pane.collect(form));
      await loadSettings(true);
      state.dirty = false;
      label.textContent = 'Saved';
      label.classList.remove('is-dirty');
      toast('Saved.');
      render(el, key);
    } catch (err) {
      btn.disabled = false;
      if (err.data?.fields) placeErrors(form, err.data.fields, pane.rowKey);
      else failToast(err);
    }
  });
}

function placeErrors(form, fields, rowKey) {
  const rowsEls = [...form.querySelectorAll('[data-row]')];
  const flat = {};
  for (const [k, msg] of Object.entries(fields)) {
    const m = k.match(/^(\d+)\.(\w+)$/);
    if (m && rowsEls[Number(m[1])]) {
      const f = rowsEls[Number(m[1])].querySelector(`[data-field="${m[2]}"]`);
      if (f) {
        f.classList.add('has-error');
        const slot = f.querySelector('[data-error]');
        if (slot) slot.textContent = msg;
        f.querySelector('.field__label')?.style.setProperty('display', 'block');
        continue;
      }
    }
    flat[m ? rowKey || 'list' : k] = msg;
  }
  showErrors(form, flat);
  form.querySelector('.has-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
