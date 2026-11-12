// Domain: cash drawer & period statistics.
import { round2, sum } from '../core/utils.js';
import { periodStart, expenseTs } from './period.js';
import { drinksTotal } from './pricing.js';
import { cogsOf } from './inventory.js';

/** Counted cash at the last closing (falls back to the expected amount). */
export const lastActual = (S) => {
  const x = S.closes[S.closes.length - 1];
  return x ? (x.actual != null ? x.actual : x.expected || 0) : 0;
};

export function cashStat(S) {
  const p = periodStart(S);
  const paidAt = (s) => (s.pay === 'unpaid' ? 0 : s.paidAt || s.end || 0);
  const paidSessions = S.sessions.filter((s) => s.end && paidAt(s) > p);
  const sales = S.sales.filter((x) => x.ts > p);
  const received = (m) =>
    sum(paidSessions.filter((s) => s.pay === m), (s) => s.amount) + sum(sales.filter((x) => x.pay === m), (x) => x.amt);
  const moves = S.cashm.filter((x) => x.ts > p);
  const mi = sum(moves.filter((x) => x.type === 'in'), (x) => x.amt);
  const mo = sum(moves.filter((x) => x.type === 'out'), (x) => x.amt);
  const ex = sum(S.expenses.filter((e) => expenseTs(e) > p), (e) => e.amt);
  const pu = sum(S.buys.filter((b) => b.ts > p && b.pay === 'cash'), (b) => b.total);
  const open = S.cur ? S.cur.open : lastActual(S);
  const cash = received('cash');
  return { p, open, cash, insta: received('insta'), mi, mo, ex, pu, expected: round2(open + cash + mi - mo - ex - pu) };
}

export function periodStats(S) {
  const c = cashStat(S);
  const D = S.sessions.filter((s) => s.end && s.end > c.p);
  const SA = S.sales.filter((x) => x.ts > c.p);
  const play = sum(D, (s) => s.amount);
  const sessDrinks = sum(D, drinksTotal);
  const direct = sum(SA, (x) => x.amt);
  return {
    ...c,
    n: D.length,
    rev: play + direct,
    drinks: sessDrinks + direct,
    play: play - sessDrinks,
    disc: sum(D, (s) => (s.adj < 0 ? -s.adj : 0)),
    unpaid: sum(D.filter((s) => s.pay === 'unpaid'), (s) => s.amount),
    cogs: cogsOf(D, SA),
    run: S.sessions.filter((s) => !s.end).length,
  };
}
