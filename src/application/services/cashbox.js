// Application: shifts, manual cash moves, period closing.
import { ok, fail, uid, num } from '../../core/utils.js';
import { periodStats } from '../../domain/cash.js';

export const cashService = (store) => ({
  startShift({ who, open }) {
    store.commit((S) => {
      S.cur = { at: Date.now(), open: num(open), who: (who || '').trim() };
    });
  },

  addMove({ type, amount, note }) {
    const a = num(amount, NaN);
    if (!(a > 0)) return fail('أدخل مبلغاً صحيحاً');
    store.commit((S) => {
      S.cashm.push({ id: uid(), ts: Date.now(), type, amt: a, note: (note || '').trim() });
    });
    return ok();
  },

  removeMove(id) {
    store.commit((S) => {
      S.cashm = S.cashm.filter((x) => x.id !== id);
    });
  },

  /** Close the period: snapshot the numbers and reset the counters. */
  close({ actual, note }) {
    store.commit((S) => {
      const q = periodStats(S);
      const cl = S.closes;
      cl.push({
        id: cl.length ? cl[cl.length - 1].id + 1 : 1,
        at: Date.now(), from: q.p,
        startAt: S.cur ? S.cur.at : null, who: S.cur ? S.cur.who : '',
        open: q.open, n: q.n, rev: q.rev, play: q.play, drinks: q.drinks, disc: q.disc,
        cash: q.cash, insta: q.insta, unpaid: q.unpaid, exp: q.ex, pu: q.pu, mi: q.mi, mo: q.mo,
        cogs: q.cogs, expected: q.expected, actual,
        diff: actual === null ? 0 : actual - q.expected,
        note,
      });
      S.cur = null;
    });
  },

  undoLastClose() {
    store.commit((S) => {
      S.closes.pop();
    });
  },
});
