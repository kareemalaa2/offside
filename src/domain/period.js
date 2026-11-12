// Domain: accounting period (since last closing, or since midnight).
import { dayKey, startOfToday } from '../core/utils.js';

export const periodStart = (S) => {
  const c = S.closes || [];
  return c.length ? c[c.length - 1].at : startOfToday();
};

/** Expense timestamp (older records only had a date). */
export const expenseTs = (e) => e.ts || new Date(e.date + 'T12:00:00').getTime();

export const runningSessions = (S) => S.sessions.filter((s) => !s.end);
export const finishedSessions = (S) => S.sessions.filter((s) => s.end);
export const findSession = (S, id) => S.sessions.find((s) => s.id === id);
export const findDevice = (S, id) => S.devices.find((d) => d.id === id);

/** Predicate for the reports range selector. */
export function inRange(S, range, ts, now = Date.now()) {
  const k = dayKey(ts);
  switch (range) {
    case 'p': return ts > periodStart(S);
    case 'all': return true;
    case 'today': return k === dayKey(now);
    case '7': return k >= dayKey(now - 6 * 864e5);
    default: return k.slice(0, 7) === dayKey(now).slice(0, 7);
  }
}
