// Domain: stock rules.
import { sum } from '../core/utils.js';

const MAX_MOVES = 1500;

export const findProduct = (S, id) => S.drinks.find((d) => d.id === id);
export const isLow = (d) => !!d.track && d.qty <= d.min;
export const canTake = (d, q) => !d.track || d.qty >= q;

/** Apply a stock movement (+in / -out) and log it. No-op for untracked products. */
export function applyMove(S, d, q, type, note = '') {
  if (!d.track) return;
  d.qty = Math.round(((d.qty || 0) + q) * 1000) / 1000;
  S.stm.push({ id: Date.now() + Math.random(), ts: Date.now(), pid: d.id, n: d.name, type, q, note });
  if (S.stm.length > MAX_MOVES) S.stm.splice(0, S.stm.length - MAX_MOVES);
}

/** Weighted average unit cost after a purchase. */
export function averageCost(d, qty, total) {
  const oldQty = d.track ? Math.max(0, d.qty || 0) : 0;
  const c = oldQty > 0 ? (oldQty * (d.cost || 0) + total) / (oldQty + qty) : total / qty;
  return Math.round(c * 100) / 100;
}

/** Cost of goods sold for sessions + direct sales. */
export const cogsOf = (sessions, sales) =>
  sum([...sessions.flatMap((s) => s.items || []), ...sales.flatMap((x) => x.items || [])], (i) => (i.c || 0) * i.q);

export const stockValue = (S) => sum(S.drinks.filter((d) => d.track), (d) => d.qty * d.cost);
