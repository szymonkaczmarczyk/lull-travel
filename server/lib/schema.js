import { collections } from './store.js';

const LOOK = [
  { key: 'image', label: 'Photograph', type: 'image', group: 'Look', hint: 'Files live in public/img. Leave empty for the generated gradient.' },
  { key: 'alt', label: 'Photo description', type: 'text', group: 'Look', max: 200, wide: true },
  { key: 'tone', label: 'Tone', type: 'tone', group: 'Look', required: true, default: ['#2f4f5e', '#c98a5a'], hint: 'Dark and light colour behind the photo and in the gradient.' },
];

export const SCHEMA = {
  stays: {
    label: 'Stays',
    singular: 'Stay',
    title: 'name',
    path: '/stays/',
    list: ['destination', 'type', 'pricePerNight'],
    fields: [
      { key: 'name', label: 'Name', type: 'text', group: 'Basics', required: true, max: 80 },
      { key: 'slug', label: 'Address', type: 'slug', group: 'Basics', required: true, from: 'name' },
      { key: 'destination', label: 'Region', type: 'ref', ref: 'destinations', group: 'Basics', required: true },
      { key: 'type', label: 'Type', type: 'text', group: 'Basics', required: true, max: 40, hint: 'Cabin, Farmhouse, Tent…' },
      { key: 'featured', label: 'Featured', type: 'bool', group: 'Basics', default: false },
      { key: 'pricePerNight', label: 'Price per night', type: 'number', group: 'Numbers', required: true, int: true, min: 0, max: 50000, default: 300 },
      { key: 'currency', label: 'Currency', type: 'select', group: 'Numbers', required: true, options: ['EUR', 'GBP', 'USD'], default: 'EUR' },
      { key: 'sleeps', label: 'Sleeps', type: 'number', group: 'Numbers', required: true, int: true, min: 1, max: 30, default: 2 },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number', group: 'Numbers', required: true, int: true, min: 0, max: 20, default: 1 },
      { key: 'minNights', label: 'Minimum nights', type: 'number', group: 'Numbers', required: true, int: true, min: 1, max: 60, default: 3 },
      { key: 'rating', label: 'Rating', type: 'number', group: 'Numbers', required: true, min: 0, max: 5, step: 0.1, default: 5 },
      { key: 'reviews', label: 'Reviews', type: 'number', group: 'Numbers', required: true, int: true, min: 0, max: 100000, default: 0 },
      { key: 'views', label: 'Views', type: 'number', group: 'Numbers', required: true, int: true, min: 0, max: 10000000, default: 0 },
      { key: 'blurb', label: 'One line', type: 'textarea', group: 'Copy', required: true, max: 200, wide: true },
      { key: 'description', label: 'Description', type: 'paragraphs', group: 'Copy', required: true, wide: true, hint: 'Blank line between paragraphs.' },
      { key: 'features', label: 'Features', type: 'lines', group: 'Copy', wide: true, hint: 'One per line.' },
      { key: 'theCatch', label: 'The catch', type: 'textarea', group: 'Copy', required: true, max: 600, wide: true, hint: 'The honest downside. Write this first.' },
      { key: 'gettingThere', label: 'Getting there', type: 'textarea', group: 'Copy', max: 400, wide: true },
      ...LOOK,
    ],
  },

  destinations: {
    label: 'Destinations',
    singular: 'Destination',
    title: 'name',
    path: '/destinations/',
    list: ['country', 'region', 'bestMonths'],
    fields: [
      { key: 'name', label: 'Name', type: 'text', group: 'Basics', required: true, max: 60 },
      { key: 'slug', label: 'Address', type: 'slug', group: 'Basics', required: true, from: 'name' },
      { key: 'country', label: 'Country', type: 'text', group: 'Basics', required: true, max: 60 },
      { key: 'region', label: 'Wider region', type: 'text', group: 'Basics', required: true, max: 60 },
      { key: 'tagline', label: 'Tagline', type: 'text', group: 'Basics', required: true, max: 120, wide: true },
      { key: 'summary', label: 'Summary', type: 'textarea', group: 'Basics', required: true, max: 600, wide: true },
      { key: 'bestMonths', label: 'Best months', type: 'text', group: 'Details', max: 40, hint: 'Feb–Apr, Jun–Aug' },
      { key: 'flightTime', label: 'Flight time', type: 'text', group: 'Details', max: 60, hint: '3h 40m from Oslo' },
      { key: 'lat', label: 'Latitude', type: 'number', group: 'Details', required: true, min: -90, max: 90, step: 0.01, default: 0 },
      { key: 'lon', label: 'Longitude', type: 'number', group: 'Details', required: true, min: -180, max: 180, step: 0.01, default: 0 },
      ...LOOK,
      { key: 'accent', label: 'Accent', type: 'color', group: 'Look', default: '#4fb3c4' },
    ],
  },

  journal: {
    label: 'Journal',
    singular: 'Article',
    title: 'title',
    path: '/journal/',
    list: ['category', 'author', 'date'],
    fields: [
      { key: 'title', label: 'Title', type: 'text', group: 'Basics', required: true, max: 120, wide: true },
      { key: 'slug', label: 'Address', type: 'slug', group: 'Basics', required: true, from: 'title' },
      { key: 'category', label: 'Category', type: 'text', group: 'Basics', required: true, max: 40, hint: 'Method, Timing, Packing…' },
      { key: 'author', label: 'Author', type: 'text', group: 'Basics', required: true, max: 60 },
      { key: 'date', label: 'Date', type: 'date', group: 'Basics', required: true },
      { key: 'readMinutes', label: 'Minutes to read', type: 'number', group: 'Basics', required: true, int: true, min: 1, max: 90, default: 5 },
      { key: 'dek', label: 'Standfirst', type: 'textarea', group: 'Copy', required: true, max: 300, wide: true },
      { key: 'body', label: 'Body', type: 'paragraphs', group: 'Copy', required: true, wide: true, hint: 'Blank line between paragraphs.' },
      ...LOOK,
    ],
  },
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-f]{6}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function coerce(f, raw, name, existing) {
  switch (f.type) {
    case 'slug': {
      if (existing) return { v: existing.slug };
      const v = String(raw ?? '').trim().toLowerCase();
      if (!v) return { v };
      if (!SLUG.test(v)) return { v, error: 'Lowercase letters, numbers and dashes, like casa-corvo.' };
      if (collections[name].some((d) => d.slug === v)) return { v, error: 'Something already lives at this address.' };
      return { v };
    }
    case 'number': {
      if (raw === '' || raw == null) return { v: null };
      const v = Number(raw);
      if (!Number.isFinite(v)) return { v, error: 'Needs a number.' };
      if (f.int && !Number.isInteger(v)) return { v, error: 'Whole numbers only.' };
      if (f.min !== undefined && v < f.min) return { v, error: `No lower than ${f.min}.` };
      if (f.max !== undefined && v > f.max) return { v, error: `No higher than ${f.max}.` };
      return { v };
    }
    case 'bool':
      return { v: raw === true || raw === 'true' };
    case 'ref': {
      const v = String(raw ?? '').trim();
      if (v && !collections[f.ref].some((d) => d.slug === v)) return { v, error: 'Pick one from the list.' };
      return { v };
    }
    case 'select': {
      const v = String(raw ?? '').trim();
      if (v && !f.options.includes(v)) return { v, error: 'Pick one from the list.' };
      return { v };
    }
    case 'paragraphs':
    case 'lines': {
      const split = f.type === 'lines' ? /\n/ : /\n\s*\n/;
      const v = (Array.isArray(raw) ? raw : String(raw ?? '').split(split)).map((s) => String(s).trim()).filter(Boolean);
      if (v.some((p) => p.length > 4000)) return { v, error: 'One of these is over 4000 characters.' };
      return { v };
    }
    case 'tone': {
      const v = Array.isArray(raw) ? raw.map((c) => String(c).trim()) : [];
      if (v.length !== 2 || !v.every((c) => HEX.test(c))) return { v, error: 'Two colours, like #2f4f5e.' };
      return { v };
    }
    case 'color': {
      const v = String(raw ?? '').trim();
      if (v && !HEX.test(v)) return { v, error: 'A colour like #4fb3c4.' };
      return { v };
    }
    case 'date': {
      const v = String(raw ?? '').trim();
      if (v && (!DATE.test(v) || Number.isNaN(Date.parse(v)))) return { v, error: 'A date like 2026-06-18.' };
      return { v };
    }
    case 'image': {
      const v = String(raw ?? '').trim();
      if (v && !SLUG.test(v)) return { v, error: 'Pick one from the list.' };
      return { v };
    }
    default: {
      const v = String(raw ?? '').trim();
      const max = f.max ?? (f.type === 'textarea' ? 2000 : 200);
      if (v.length > max) return { v, error: `Keep it under ${max} characters.` };
      return { v };
    }
  }
}

const isEmpty = (v) => v === '' || v == null || (Array.isArray(v) && !v.length);

export function validateEntry(name, input, existing = null) {
  const schema = SCHEMA[name];
  const errors = {};
  const value = { ...(existing ?? {}) };

  for (const f of schema.fields) {
    const { v, error } = coerce(f, input?.[f.key], name, existing);
    if (error) errors[f.key] = error;
    else if (f.required && isEmpty(v)) errors[f.key] = 'Required.';
    value[f.key] = v ?? '';
  }

  return { errors, value };
}

export function referencesTo(name, slug) {
  if (name !== 'destinations') return [];
  return collections.stays.filter((s) => s.destination === slug).map((s) => s.name);
}
