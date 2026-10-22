import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CREDITS_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'credits.json');
const credits = JSON.parse(readFileSync(CREDITS_FILE, 'utf8'));

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function placeFor(image, stays, destinations) {
  const stay = stays.find((item) => item.image === image);
  if (stay) return { name: stay.name, href: `/stays/${stay.slug}` };
  const destination = destinations.find((item) => item.image === image);
  if (destination) return { name: destination.name, href: `/destinations/${destination.slug}` };
  return null;
}

export function renderCredits(stays, destinations) {
  return credits
    .map((credit) => {
      const place = placeFor(credit.image, stays, destinations);
      const placeLink = place ? `<a href="${place.href}">${escapeHtml(place.name)}</a>` : '';
      const license = credit.licenseUrl
        ? `<a href="${escapeHtml(credit.licenseUrl)}" rel="license noopener" target="_blank">${escapeHtml(credit.license)}</a>`
        : escapeHtml(credit.license);
      return `      <li class="credit" data-reveal>
        <img class="credit__thumb" src="/img/card-sm/${escapeHtml(credit.image)}.jpg" alt="" loading="lazy" decoding="async">
        <div class="credit__body">
          <p class="credit__place mono">${placeLink}</p>
          <p class="credit__title"><a href="${escapeHtml(credit.source)}" rel="noopener" target="_blank">${escapeHtml(credit.title)}</a></p>
          <p class="credit__meta">${escapeHtml(credit.author)} · ${license} · Wikimedia Commons</p>
        </div>
      </li>`;
    })
    .join('\n');
}
