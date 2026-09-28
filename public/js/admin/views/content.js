import { money, tone } from '../../api.js';
import { adm, send, state, loadSchema, loadCollection, go } from '../state.js';
import {
  esc, head, fmtDate, empty, toast, failToast, confirmDialog, field, options, switchInput,
  clearErrors, showErrors, slugify, ICON,
} from '../ui.js';

function artThumb(d, cls = 'adm-swatch') {
  const img = d.image ? `<img class="is-loaded" src="/img/card-sm/${esc(d.image)}.jpg" alt="" loading="lazy">` : '';
  return `<span class="art ${cls}" style="${esc(tone(d.tone))}">${img}</span>`;
}

function cell(f, d) {
  const v = d[f.key];
  if (f.type === 'ref') return esc(state[f.ref]?.find((x) => x.slug === v)?.name ?? v ?? '');
  if (f.key === 'pricePerNight') return esc(money(v, d.currency || 'EUR'));
  if (f.type === 'date') return esc(fmtDate(v));
  return esc(v ?? '');
}

export async function list(el, name) {
  const schema = (await loadSchema())[name];
  const [items] = await Promise.all([loadCollection(name, true), loadCollection('destinations')]);
  const cols = schema.list.map((k) => schema.fields.find((f) => f.key === k)).filter(Boolean);

  el.innerHTML = `
    ${head({
      crumbs: [['/admin', 'Admin'], [null, 'Content'], [null, schema.label]],
      title: schema.label,
      sub: `${items.length} live on the site. Changes show up the moment you save.`,
      actions: `<a class="btn btn--sm" href="/admin/content/${name}/new">${ICON.plus} New ${esc(schema.singular.toLowerCase())}</a>`,
    })}
    <div class="adm-panel adm-panel--flush adm-fade">
      ${
        items.length
          ? `<div class="adm-table-wrap"><table class="adm-table">
              <thead><tr><th style="width:74px"></th><th>${esc(schema.fields.find((f) => f.key === schema.title).label)}</th>${cols
                .map((f) => `<th${f.type === 'number' ? ' class="is-num"' : ''}>${esc(f.label)}</th>`)
                .join('')}<th></th></tr></thead>
              <tbody>
                ${items
                  .map(
                    (d) => `
                  <tr data-href="/admin/content/${name}/${esc(d.slug)}">
                    <td>${artThumb(d)}</td>
                    <td><strong>${esc(d[schema.title])}</strong><span class="adm-cell-sub">${esc(schema.path)}${esc(d.slug)}</span></td>
                    ${cols.map((f) => `<td${f.type === 'number' ? ' class="is-num"' : ''}>${cell(f, d)}</td>`).join('')}
                    <td class="is-num"><a class="adm-icon-btn" style="display:inline-grid" href="${esc(schema.path + d.slug)}" target="_blank" rel="noopener" title="View on the site" aria-label="View ${esc(d[schema.title])} on the site">${ICON.out}</a></td>
                  </tr>`
                  )
                  .join('')}
              </tbody>
            </table></div>`
          : empty(`No ${schema.label.toLowerCase()} yet.`)
      }
    </div>`;
}

function control(f, value) {
  const id = `f-${f.key}`;
  const attrs = `id="${id}" name="${esc(f.key)}"${f.required ? ' required' : ''}`;
  switch (f.type) {
    case 'textarea':
      return `<textarea ${attrs}${f.max ? ` maxlength="${f.max}"` : ''}>${esc(value)}</textarea>`;
    case 'paragraphs':
      return `<textarea class="is-long" ${attrs}>${esc((value || []).join('\n\n'))}</textarea>`;
    case 'lines':
      return `<textarea ${attrs}>${esc((value || []).join('\n'))}</textarea>`;
    case 'number':
      return `<input class="field__input" type="number" ${attrs} value="${esc(value ?? '')}"${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''} step="${f.step ?? (f.int ? 1 : 'any')}">`;
    case 'bool':
      return switchInput({ name: f.key, checked: Boolean(value), label: 'Yes' });
    case 'ref':
      return `<select ${attrs}>${options((state[f.ref] || []).map((d) => [d.slug, d.name]), value, { empty: 'Pick one' })}</select>`;
    case 'select':
      return `<select ${attrs}>${options(f.options.map((o) => [o, o]), value)}</select>`;
    case 'tone': {
      const [a, b] = Array.isArray(value) && value.length === 2 ? value : f.default;
      return `
        <div class="adm-tone">
          <div class="adm-tone__inputs">
            <input class="adm-color" type="color" id="${id}" name="${esc(f.key)}.0" value="${esc(a)}" aria-label="Dark tone">
            <input class="adm-color" type="color" name="${esc(f.key)}.1" value="${esc(b)}" aria-label="Light tone">
          </div>
          <span class="art art--gen" data-tone-preview style="${esc(tone([a, b]))}"></span>
        </div>`;
    }
    case 'color':
      return `<input class="adm-color" type="color" ${attrs} value="${esc(value || f.default || '#4fb3c4')}">`;
    case 'date':
      return `<input class="field__input" type="date" ${attrs} value="${esc(value ?? '')}">`;
    case 'image':
      return `<select ${attrs}>${options(state.images.map((i) => [i, i]), value, { empty: 'None, use the generated gradient' })}</select>`;
    case 'slug':
      return `<input class="field__input" type="text" ${attrs} value="${esc(value ?? '')}" autocomplete="off" spellcheck="false"${value ? ' readonly' : ''}>`;
    default:
      return `<input class="field__input" type="text" ${attrs} value="${esc(value ?? '')}"${f.max ? ` maxlength="${f.max}"` : ''}>`;
  }
}

function collect(form, schema) {
  const out = {};
  for (const f of schema.fields) {
    if (f.type === 'tone') out[f.key] = [form.elements[`${f.key}.0`].value, form.elements[`${f.key}.1`].value];
    else if (f.type === 'bool') out[f.key] = form.elements[f.key].checked;
    else out[f.key] = form.elements[f.key]?.value ?? '';
  }
  return out;
}

export async function edit(el, name, slug) {
  const schema = (await loadSchema())[name];
  await Promise.all([loadCollection('destinations'), loadCollection(name)]);
  const existing = slug ? (await adm(`/content/${name}/${encodeURIComponent(slug)}`)).entry : null;
  const doc = existing ?? Object.fromEntries(schema.fields.filter((f) => f.default !== undefined).map((f) => [f.key, f.default]));
  const title = existing ? existing[schema.title] : `New ${schema.singular.toLowerCase()}`;

  const groups = [...new Set(schema.fields.map((f) => f.group))];
  const slugField = schema.fields.find((f) => f.type === 'slug');

  el.innerHTML = `
    ${head({
      crumbs: [['/admin', 'Admin'], [`/admin/content/${name}`, schema.label], [null, existing ? existing.slug : 'New']],
      title,
      actions: existing
        ? `<a class="btn btn--ghost btn--sm" href="${esc(schema.path + existing.slug)}" target="_blank" rel="noopener">${ICON.out} View on site</a>
           <button class="btn btn--danger btn--sm" type="button" data-delete>${ICON.trash} Delete</button>`
        : '',
    })}
    <div class="adm-detail">
      <form class="adm-form" data-entry novalidate>
        ${groups
          .map(
            (g) => `
          <fieldset class="adm-panel adm-group adm-fade">
            <legend class="adm-panel__title">${esc(g)}</legend>
            <div class="adm-fields">
              ${schema.fields
                .filter((f) => f.group === g)
                .map((f) =>
                  field({
                    key: f.key,
                    label: f.label + (f.required ? '' : ' (optional)'),
                    control: control(f, doc[f.key]),
                    hint:
                      f.type === 'slug'
                        ? existing
                          ? `Lives at ${schema.path}${existing.slug}. Fixed once published, so links keep working.`
                          : `Becomes ${schema.path}… Filled in from the ${f.from}, fixed once published.`
                        : f.hint,
                    wide: f.wide || ['paragraphs', 'lines', 'tone'].includes(f.type),
                  })
                )
                .join('')}
            </div>
          </fieldset>`
          )
          .join('')}
        <div class="adm-savebar">
          <span class="adm-savebar__state" data-state>${existing ? 'Saved' : 'Not saved yet'}</span>
          <div class="adm-actions">
            <a class="btn btn--ghost btn--sm" href="/admin/content/${name}">Cancel</a>
            <button class="btn btn--sm btn--teal" type="submit">${existing ? 'Save changes' : `Publish ${esc(schema.singular.toLowerCase())}`}</button>
          </div>
        </div>
      </form>

      <aside class="adm-detail__side">
        <div class="adm-panel adm-fade">
          <h2 class="adm-panel__title">Preview</h2>
          <div class="adm-preview">
            <span class="art art--gen" data-preview style="${esc(tone(doc.tone))}">${doc.image ? `<img class="is-loaded" src="/img/card/${esc(doc.image)}.jpg" alt="">` : ''}</span>
            <span class="adm-preview__label" data-preview-title>${esc(doc[schema.title] || '')}</span>
          </div>
          <p class="field__hint" style="margin-top:14px">How the card art reads on the site. Without a photograph the two tones make the gradient on their own.</p>
        </div>
      </aside>
    </div>`;

  const form = el.querySelector('[data-entry]');
  const stateLabel = el.querySelector('[data-state]');
  const preview = el.querySelector('[data-preview]');
  const previewTitle = el.querySelector('[data-preview-title]');
  const slugInput = slugField ? form.elements[slugField.key] : null;
  let slugTouched = Boolean(existing);

  const paint = () => {
    const toneField = schema.fields.find((f) => f.type === 'tone');
    if (toneField) {
      const pair = [form.elements[`${toneField.key}.0`].value, form.elements[`${toneField.key}.1`].value];
      preview.setAttribute('style', tone(pair));
      form.querySelector('[data-tone-preview]')?.setAttribute('style', tone(pair));
    }
    const image = form.elements.image?.value;
    preview.innerHTML = image ? `<img class="is-loaded" src="/img/card/${esc(image)}.jpg" alt="">` : '';
    previewTitle.textContent = form.elements[schema.title].value;
  };

  form.addEventListener('input', (e) => {
    state.dirty = true;
    stateLabel.textContent = 'Unsaved changes';
    stateLabel.classList.add('is-dirty');
    if (e.target === slugInput) slugTouched = true;
    if (slugInput && !slugTouched && e.target.name === slugField.from) slugInput.value = slugify(e.target.value);
    if (['image', schema.title].includes(e.target.name) || e.target.type === 'color') paint();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'image' || e.target.type === 'checkbox') {
      state.dirty = true;
      stateLabel.textContent = 'Unsaved changes';
      stateLabel.classList.add('is-dirty');
      paint();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    const body = collect(form, schema);
    try {
      const { entry } = existing
        ? await send(`/content/${name}/${encodeURIComponent(existing.slug)}`, 'PUT', body)
        : await send(`/content/${name}`, 'POST', body);
      state[name] = null;
      state.dirty = false;
      toast(existing ? 'Saved. The site has the new version.' : `${entry[schema.title]} is live.`);
      go(`/admin/content/${name}/${encodeURIComponent(entry.slug)}`, true);
    } catch (err) {
      btn.disabled = false;
      if (err.data?.fields) showErrors(form, err.data.fields, err.data.error);
      else failToast(err);
    }
  });

  el.querySelector('[data-delete]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: `Delete ${existing[schema.title]}?`,
      body: `It disappears from the site straight away, and ${schema.path}${existing.slug} starts returning a 404.`,
    });
    if (!ok) return;
    try {
      await send(`/content/${name}/${encodeURIComponent(existing.slug)}`, 'DELETE');
      state[name] = null;
      state.dirty = false;
      toast(`${existing[schema.title]} deleted.`);
      go(`/admin/content/${name}`, true);
    } catch (err) {
      failToast(err);
    }
  });
}
