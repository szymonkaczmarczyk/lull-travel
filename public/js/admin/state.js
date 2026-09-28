import { api } from '../api.js';

export const state = {
  me: null,
  settings: null,
  tones: [],
  placeholders: [],
  schema: null,
  images: [],
  destinations: null,
  stays: null,
  dirty: false,
};

export async function adm(path, options) {
  try {
    return await api(`/admin${path}`, options);
  } catch (err) {
    if (err.status === 401 && path !== '/login') {
      state.me = null;
      window.dispatchEvent(new CustomEvent('adm:signed-out'));
    }
    throw err;
  }
}

export const send = (path, method, body) =>
  adm(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export async function loadSettings(force = false) {
  if (state.settings && !force) return state.settings;
  const data = await adm('/settings');
  state.settings = data.settings;
  state.tones = data.tones;
  state.placeholders = data.placeholders;
  state.mail = data.mail;
  return state.settings;
}

export async function loadSchema() {
  if (state.schema) return state.schema;
  const data = await adm('/schema');
  state.schema = data.schema;
  state.images = data.images;
  return state.schema;
}

export async function loadCollection(name, force = false) {
  if (state[name] && !force) return state[name];
  const data = await adm(`/content/${name}`);
  state[name] = data.results;
  return state[name];
}

export const go = (path, replace = false) =>
  window.dispatchEvent(new CustomEvent('adm:navigate', { detail: { path, replace } }));

export const refreshBadge = () => window.dispatchEvent(new Event('adm:badge'));

export const statusOf =(key) => state.settings?.statuses.find((s) => s.key === key) ?? null;
export const mailboxOf = (id) => state.settings?.mailboxes.find((m) => m.id === id) ?? null;
