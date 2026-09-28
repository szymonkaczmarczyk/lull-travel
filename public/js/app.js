

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;


document.documentElement.classList.add('js');



const NAV_LINKS = [
  ['/stays', 'Stays'],
  ['/destinations', 'Destinations'],
  ['/journal', 'Journal'],
  ['/about', 'About'],
];


const PAGE_BACKDROPS = {
  '/': ['dest-aeolian-islands', '#3a3340', '#d98d6a'],
  '/stays': ['dest-lofoten', '#2f4f5e', '#c98a5a'],
  '/destinations': ['dest-atacama', '#5c3b34', '#e8b98e'],
  '/journal': ['dest-kii-peninsula', '#2c4438', '#8fae86'],
  '/plan': ['dest-kalahari', '#3a4a52', '#e5a870'],
  '/about': ['stay-casa-corvo', '#6a4c2f', '#e8bd82'],
};


export function setPageTone([a, b] = []) {
  const bg = document.querySelector('.pagebg');
  if (!bg) return;
  if (a) bg.style.setProperty('--bg-a', a);
  if (b) bg.style.setProperty('--bg-b', b);
}


export function setPageBackdrop(image) {
  const el = document.querySelector('.pagebg__photo img');
  if (!el || !image) return;
  const src = `/img/card/${image}.jpg`;
  if (el.getAttribute('src') === src) return;
  el.classList.remove('is-loaded');
  el.src = src;
  if (el.complete && el.naturalWidth) el.classList.add('is-loaded');
  else el.addEventListener('load', () => el.classList.add('is-loaded'), { once: true });
}

function mountChrome() {
  const here = location.pathname;
  const isActive = (href) => here === href || here.startsWith(href + '/');

  document.body.insertAdjacentHTML(
    'afterbegin',
    `<div class="pagebg" aria-hidden="true">
       <div class="pagebg__photo"><img alt="" decoding="async"></div>
       <span class="pagebg__glow"></span>
       <span class="pagebg__glow pagebg__glow--warm"></span>
       <span class="pagebg__scrim"></span>
       <span class="pagebg__grain"></span>
     </div>
     <div class="loadbar"></div>
     <div class="veil"></div>
     <header class="nav" data-nav>
       <a class="wordmark rise" href="/" style="--d:0ms">Lull<i class="wordmark__dot"></i></a>
       <nav class="nav__links" aria-label="Primary">
         ${NAV_LINKS.map(
           ([href, label], i) =>
             `<a class="nav__link rise" href="${href}" style="--d:${90 + i * 50}ms"${
               isActive(href) ? ' aria-current="page"' : ''
             }>${label}</a>`
         ).join('')}
       </nav>
       <span class="nav__progress"></span>
       <div class="nav__right">
         <a class="btn btn--ghost rise" href="/plan" style="--d:300ms">Plan a trip</a>
         <button class="nav__burger" type="button" aria-label="Menu" aria-expanded="false" data-burger>
           <span></span><span></span>
         </button>
       </div>
     </header>
     <nav class="menu" aria-label="Mobile">
       ${NAV_LINKS.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}
       <a href="/plan">Plan a trip</a>
     </nav>`
  );

  const footer = document.querySelector('[data-footer]');
  if (footer) {
    footer.innerHTML = `
      <div class="wrap">
        <div class="footer__top">
          <div class="footer__brand">
            <a class="wordmark" href="/">Lull<i class="wordmark__dot"></i></a>
            <p class="body-text" style="font-size:14.5px">Hand-picked stays in quiet, out-of-the-way places. Every one of them slept in by someone who works here.</p>
            <p class="mono">Est. 2017 · Lisbon &amp; Oslo</p>
          </div>
          <div class="footer__col">
            <h4>Explore</h4>
            <a href="/stays">All stays</a>
            <a href="/destinations">Destinations</a>
            <a href="/journal">Journal</a>
            <a href="/about">About us</a>
          </div>
          <div class="footer__col">
            <h4>Regions</h4>
            <a href="/destinations/lofoten">Lofoten</a>
            <a href="/destinations/alentejo">Alentejo</a>
            <a href="/destinations/kii-peninsula">Kii Peninsula</a>
            <a href="/destinations/atacama">Atacama</a>
          </div>
          <div class="footer__col">
            <h4>Contact</h4>
            <a href="/plan">Plan a trip</a>
            <a href="mailto:hello@lull.travel">hello@lull.travel</a>
            <a href="tel:+3512300000">+351 230 000 00</a>
          </div>
        </div>
        <div class="footer__bottom">
          <span>© <span data-year></span> Lull Travel</span>
          <span>14 stays · 8 regions · one road in</span>
        </div>
      </div>`;
  }

  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });

  const key = Object.keys(PAGE_BACKDROPS)
    .filter((k) => (k === '/' ? here === '/' : here.startsWith(k)))
    .sort((a, b) => b.length - a.length)[0];
  const [image, a, b] = PAGE_BACKDROPS[key] || PAGE_BACKDROPS['/'];
  setPageTone([a, b]);
  setPageBackdrop(image);
}



function initNav() {
  const nav = document.querySelector('[data-nav]');
  const burger = document.querySelector('[data-burger]');
  if (!nav) return;

  let last = window.scrollY;

  const progress = nav.querySelector('.nav__progress');
  let ticking = false;

  const paint = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-stuck', y > 40);
    
    const hide = y > 420 && y > last && !document.body.classList.contains('menu-open');
    nav.classList.toggle('is-hidden', hide);

    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.setProperty('--p', max > 0 ? Math.min(1, y / max).toFixed(4) : '0');
    }
    last = y;
    ticking = false;
  };

  
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(paint);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  paint();

  burger?.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
    document.documentElement.style.overflow = open ? 'hidden' : '';
  });
}



const revealObserver = REDUCED
  ? null
  : new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          obs.unobserve(e.target);
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );


function initImages(root = document) {
  root.querySelectorAll('.art img:not(.is-loaded)').forEach((el) => {
    if (el.complete && el.naturalWidth) el.classList.add('is-loaded');
    else el.addEventListener('load', () => el.classList.add('is-loaded'), { once: true });
  });
}


const IN_VIEW = '[data-reveal], [data-wipe], [data-draw], .rule-draw, .words';


export function observeReveals(root = document) {
  initImages(root);
  initMagnetic(root);
  splitWords(root);
  const nodes = root.querySelectorAll(`:is(${IN_VIEW}):not(.is-in)`);
  if (!revealObserver) {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }
  nodes.forEach((n) => revealObserver.observe(n));
}


function splitWords(root = document) {
  root.querySelectorAll('[data-words]:not(.words)').forEach((el) => {
    const text = el.textContent.trim();
    el.classList.add('words');
    el.textContent = '';
    text.split(/\s+/).forEach((word, i, all) => {
      const span = document.createElement('span');
      span.className = 'w';
      const inner = document.createElement('i');
      inner.textContent = word;
      inner.style.setProperty('--wd', `${i * 55}ms`);
      span.append(inner);
      el.append(span);
      if (i < all.length - 1) el.append(document.createTextNode(' '));
    });
    if (REDUCED) el.classList.add('is-in');
  });
}


function initMagnetic(root = document) {
  if (REDUCED) return;
  root.querySelectorAll('.magnetic:not([data-magnetic-on])').forEach((el) => {
    el.dataset.magneticOn = '1';

    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.22;
      const y = (e.clientY - r.top - r.height / 2) * 0.3;
      el.classList.add('is-pulled');
      el.style.transform = `translate(${x}px, ${y}px)`;
    });

    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-pulled');
      el.style.transform = '';
    });
  });
}


export function stagger(nodes, step = 70, base = 0) {
  [...nodes].forEach((n, i) => n.style.setProperty('--d', `${base + i * step}ms`));
}



function initTransitions() {
  const veil = document.querySelector('.veil');
  if (!veil) return;

  
  window.addEventListener('pageshow', () => veil.classList.remove('is-on'));

  document.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.hash) return; 
    if (url.href === location.href) return;

    e.preventDefault();
    document.body.classList.remove('menu-open');

    if (REDUCED) {
      location.href = url.href;
      return;
    }

    veil.classList.add('is-on');
    setTimeout(() => { location.href = url.href; }, 300);
  });
}



export function countUp(el, target, { duration = 1400, decimals = 0 } = {}) {
  const fmt = (n) => n.toFixed(decimals);
  if (REDUCED) {
    el.textContent = fmt(target);
    return;
  }
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(target * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}


export function countUpOnView(el, target, opts) {
  if (!('IntersectionObserver' in window) || REDUCED) {
    countUp(el, target, opts);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries[0].isIntersecting) return;
      countUp(el, target, opts);
      io.disconnect();
    },
    { threshold: 0.4 }
  );
  io.observe(el);
}



function initParallax() {
  if (REDUCED) return;
  const targets = document.querySelectorAll('[data-parallax]');
  if (!targets.length) return;

  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    targets.forEach((el) => {
      const rate = Number(el.dataset.parallax) || 0.18;
      el.style.transform = `translate3d(0, ${y * rate}px, 0)`;
    });
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
}



mountChrome();
initNav();
initTransitions();
initParallax();
observeReveals();

export { REDUCED };
