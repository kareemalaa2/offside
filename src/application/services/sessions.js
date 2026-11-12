// Application: session use-cases (start, pause, switch, end, pay, edit, drinks).
import { ok, fail, uid } from '../../core/utils.js';
import { elapsed, rateFor, sessionTotal, remaining } from '../../domain/pricing.js';
import { findSession, findDevice, sessionNo } from '../../domain/period.js';
import { findProduct, canTake, applyMove } from '../../domain/inventory.js';

export const sessionService = (store) => ({
  start({ deviceId, mode, plan, customer }) {
    return store.commit((S) => {
      const d = findDevice(S, deviceId);
      if (!d) return fail('الجهاز غير موجود');
      if (S.sessions.some((s) => !s.end && s.dev === deviceId)) return fail('الجهاز مشغول بالفعل');
      const s = {
        id: uid(), no: S.seq++, dev: d.id, dn: d.name, dt: d.type, mode,
        rate: rateFor(S.settings, d.type, mode), plan: plan > 0 ? plan : 0,
        customer: (customer || '').trim(), start: Date.now(), paused: 0,
        status: 'running', pay: 'unpaid', amount: 0, adj: 0,
      };
      S.sessions.push(s);
      return ok(s);
    });
  },

  pause(id) {
    store.commit((S) => {
      const s = findSession(S, id);
      if (!s || s.status !== 'running') return;
      s.status = 'paused';
      s.pauseAt = Date.now();
    });
  },

  resume(id) {
    store.commit((S) => {
      const s = findSession(S, id);
      if (!s || s.status !== 'paused') return;
      s.paused += Date.now() - s.pauseAt;
      s.status = 'running';
      s.pauseAt = 0;
    });
  },

  /** Close the current billing segment and continue in the other mode. */
  switchMode(id) {
    store.commit((S) => {
      const s = findSession(S, id);
      if (!s || s.end) return;
      const t = elapsed(s);
      const next = s.mode === 'single' ? 'multi' : 'single';
      (s.segs = s.segs || []).push({ mode: s.mode, rate: s.rate, ms: t - (s.segBase || 0) });
      s.segBase = t;
      s.mode = next;
      s.rate = rateFor(S.settings, s.dt, next);
    });
  },

  end(id) {
    store.commit((S) => {
      const s = findSession(S, id);
      if (!s || s.end) return;
      if (s.status === 'paused') s.paused += Date.now() - s.pauseAt;
      s.end = Date.now();
      s.status = 'done';
      s.pay = 'cash';
      s.paidAt = s.end;
      s.amount = sessionTotal(s, S.settings);
    });
  },

  setPayment(id, pay) {
    store.commit((S) => {
      const s = findSession(S, id);
      if (!s) return;
      s.pay = pay;
      s.paidAt = pay === 'unpaid' ? null : Date.now();
    });
  },

  edit(id, { customer, mode, adj, pay }) {
    store.commit((S) => {
      const s = findSession(S, id);
      if (!s) return;
      s.customer = customer.trim();
      if (mode !== s.mode) {
        s.mode = mode;
        s.rate = rateFor(S.settings, s.dt, mode);
      }
      s.adj = adj;
      if (s.end) {
        if (pay && pay !== s.pay) {
          s.pay = pay;
          s.paidAt = pay === 'unpaid' ? null : Date.now();
        }
        s.amount = sessionTotal(s, S.settings);
      }
    });
  },

  /** Delete a finished session and return its drinks to stock. */
  remove(id) {
    store.commit((S) => {
      const s = findSession(S, id);
      if (!s) return;
      for (const i of s.items || []) {
        const d = findProduct(S, i.id);
        if (d) applyMove(S, d, i.q, 'ret', 'حذف جلسة #' + sessionNo(s));
      }
      S.sessions = S.sessions.filter((x) => x.id !== id);
    });
  },

  changeDrink(id, drinkId, delta) {
    return store.commit((S) => {
      const s = findSession(S, id);
      const k = findProduct(S, drinkId);
      if (!s || !k || s.end) return ok();
      const items = (s.items = s.items || []);
      let line = items.find((x) => x.id === drinkId);
      if (delta > 0 && !canTake(k, delta)) return fail('نفد المخزون: ' + k.name);
      if (!line) {
        if (delta < 0) return ok();
        line = { id: drinkId, n: k.name, p: k.price, c: k.cost || 0, q: 0 };
        items.push(line);
      }
      line.q += delta;
      applyMove(S, k, -delta, 'sess', 'جلسة #' + sessionNo(s));
      if (line.q <= 0) s.items = items.filter((x) => x !== line);
      return ok();
    });
  },

  /** Mark & return sessions that just hit "almost over" / "time's up". */
  collectAlerts(now = Date.now()) {
    const S = store.state;
    const alerts = [];
    for (const s of S.sessions) {
      if (s.end || !s.plan || s.status !== 'running') continue;
      const left = remaining(s, now);
      if (left <= 0 && !s.w2) {
        s.w2 = s.w1 = 1;
        alerts.push({ s, kind: 'over' });
      } else if (left > 0 && left <= S.settings.alert * 6e4 && !s.w1) {
        s.w1 = 1;
        alerts.push({ s, kind: 'soon' });
      }
    }
    if (alerts.length) store.persist();
    return alerts;
  },
});
