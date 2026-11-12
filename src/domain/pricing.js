// Domain: session time & money rules. Pure functions, no DOM, no storage.
import { round2, sum } from '../core/utils.js';

/** Played time in ms (excludes paused time). */
export function elapsed(s, now = Date.now()) {
  let paused = s.paused || 0;
  if (s.status === 'paused' && !s.end) paused += now - s.pauseAt;
  return Math.max(0, (s.end || now) - s.start - paused);
}

const roundMinutes = (m, mode) =>
  mode === 'min' ? Math.ceil(m - 1e-9)
  : mode === '5' ? Math.ceil(m / 5 - 1e-9) * 5
  : mode === '15' ? Math.ceil(m / 15 - 1e-9) * 15
  : m;

export const rateFor = (settings, type, mode) => +settings.prices?.[type]?.[mode] || 0;

/**
 * Billing segments: one per Single/Multi switch plus the current one.
 * The first segment honours the minimum-billing and planned duration.
 */
export function segments(s, settings, now = Date.now()) {
  const rd = (m) => roundMinutes(m, settings.round);
  const list = (s.segs || []).map((g) => ({ mode: g.mode, rate: g.rate, ms: g.ms, c: (rd(g.ms / 6e4) * g.rate) / 60 }));
  const cur = Math.max(0, elapsed(s, now) - (s.segBase || 0));
  let minutes = rd(cur / 6e4);
  if (!list.length) minutes = Math.max(minutes, +settings.minMin || 0, s.plan || 0);
  list.push({ mode: s.mode, rate: s.rate, ms: cur, c: (minutes * s.rate) / 60 });
  for (const g of list) g.c = round2(g.c);
  return list;
}

/** Play cost incl. manual adjustment, before drinks and ceiling. */
export const playCost = (s, settings, now) => round2(sum(segments(s, settings, now), (g) => g.c) + (+s.adj || 0));

export const drinksTotal = (s) => sum(s.items || [], (i) => i.p * i.q);

/** Final amount the customer pays. */
export function sessionTotal(s, settings, now) {
  const raw = round2(playCost(s, settings, now) + drinksTotal(s));
  return settings.ceil === false ? raw : Math.ceil(raw - 1e-9);
}

/** Amount added by "round up to the nearest pound". */
export function ceilingDiff(s, settings, now) {
  const total = s.end ? s.amount : sessionTotal(s, settings, now);
  return round2(total - playCost(s, settings, now) - drinksTotal(s));
}

/** Remaining ms for a planned session (negative = overtime), or null if open-ended. */
export const remaining = (s, now = Date.now()) => (s.plan ? s.plan * 6e4 - elapsed(s, now) : null);
