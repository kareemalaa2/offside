// Data: bring any stored / imported state up to the current schema.
import { hash } from '../core/utils.js';
import { createDefaultState, defaultDrinks, defaultSettings } from './defaults.js';

const LISTS = ['sessions', 'expenses', 'sales', 'buys', 'stm', 'cashm', 'closes', 'custs', 'books'];

export const isValidBackup = (d) =>
  !!d && typeof d === 'object' && Array.isArray(d.devices) && Array.isArray(d.sessions);

export function migrate(input) {
  const S = isValidBackup(input) ? input : createDefaultState();

  const base = defaultSettings();
  S.settings = { ...base, ...(S.settings || {}) };
  S.settings.prices = { ...base.prices, ...(S.settings.prices || {}) };
  for (const t of Object.keys(base.prices))
    S.settings.prices[t] = { ...base.prices[t], ...(S.settings.prices[t] || {}) };

  if (!Array.isArray(S.drinks)) S.drinks = defaultDrinks();
  for (const d of S.drinks) {
    if (d.cost === undefined) Object.assign(d, { cost: 0, qty: 0, min: 3, track: false });
    if (d.qty == null) d.qty = 0;
    if (d.min == null) d.min = 0;
  }
  for (const k of LISTS) if (!Array.isArray(S[k])) S[k] = [];
  if (!S.pw) S.pw = hash('0000');
  if (S.cur === undefined) S.cur = null;
  if (!(S.seq > 0)) S.seq = S.sessions.reduce((m, s) => Math.max(m, s.id || 0), 0) + 1;
  return S;
}
