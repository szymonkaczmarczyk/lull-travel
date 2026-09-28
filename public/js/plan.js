import './app.js';
import { observeReveals } from './app.js';
import { api, esc } from './api.js';
import { ARROW } from './cards.js';

const form = document.querySelector('[data-form]');
const formHost = document.querySelector('[data-form-host]');
const submit = document.querySelector('[data-submit]');

let party = 2;



async function populate() {
  let dests;
  let stays;
  try {
    const [d, s] = await Promise.all([api('/destinations'), api('/stays')]);
    dests = d.results;
    stays = s.results;
  } catch {
    
    return;
  }

  document.querySelector('[data-destinations]').insertAdjacentHTML(
    'beforeend',
    dests.map((d) => `<option value="${esc(d.slug)}">${esc(d.name)}, ${esc(d.country)}</option>`).join('')
  );

  document.querySelector('[data-stays]').insertAdjacentHTML(
    'beforeend',
    stays
      .map((s) => `<option value="${esc(s.slug)}">${esc(s.name)} — ${esc(s.destination?.name ?? '')}</option>`)
      .join('')
  );

  
  const wanted = new URLSearchParams(location.search).get('stay');
  if (wanted) {
    const select = document.querySelector('[data-stays]');
    select.value = wanted;
    const match = stays.find((s) => s.slug === wanted);
    if (match?.destination) document.querySelector('[data-destinations]').value = match.destination.slug;
  }
}

function buildMonths() {
  const host = document.querySelector('[data-months]');
  const now = new Date();
  const opts = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return `<option value="${label}">${label}</option>`;
  });
  host.insertAdjacentHTML('beforeend', opts.join(''));
}

function buildParty() {
  const host = document.querySelector('[data-party]');
  host.innerHTML = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1;
    const label = n === 8 ? '8+' : String(n);
    return `<button type="button" data-n="${n}" aria-pressed="${n === party}">${label}</button>`;
  }).join('');

  host.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    party = Number(btn.dataset.n);
    host.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
  });
}



function clearErrors() {
  form.querySelectorAll('[data-field]').forEach((f) => {
    f.classList.remove('has-error');
    f.querySelector('[data-error]').textContent = '';
  });
}

function showErrors(fields) {
  Object.entries(fields).forEach(([key, msg]) => {
    const f = form.querySelector(`[data-field="${key}"]`);
    if (!f) return;
    f.classList.add('has-error');
    f.querySelector('[data-error]').textContent = msg;
  });
  form.querySelector('.has-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}



form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const data = Object.fromEntries(new FormData(form));
  submit.disabled = true;
  submit.textContent = 'Sending…';

  try {
    const res = await api('/enquiries', {
      method: 'POST',
      body: JSON.stringify({ ...data, party }),
    });

    formHost.innerHTML = `
      <div class="sent" data-reveal>
        <p class="kicker kicker--bare">Enquiry received</p>
        <h2 class="h-md" style="max-width:18ch">${esc(res.message)}</h2>
        <p class="body-text">
          Nothing else is needed from you now. If you think of something afterwards, reply to the
          confirmation and it lands with the same person.
        </p>
        <span class="sent__ref">Ref ${esc(res.id)}</span>
        <div style="display:flex;gap:16px;flex-wrap:wrap;padding-top:6px">
          <a class="btn" href="/stays">Keep looking ${ARROW}</a>
          <a class="btn btn--ghost" href="/journal">Read the journal</a>
        </div>
      </div>`;
    observeReveals(formHost);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    if (err.data?.fields) {
      showErrors(err.data.fields);
    } else {
      
      showErrors({ email: err.data?.error || 'Something went wrong our end. Try again in a moment.' });
    }
    submit.disabled = false;
    submit.innerHTML = `Send enquiry ${ARROW}`;
  }
});

buildMonths();
buildParty();
populate();
