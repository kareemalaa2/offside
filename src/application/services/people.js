// Application: customers & bookings.
import { ok, fail, uid, norm } from '../../core/utils.js';
import { cleanPhone, bookingClash, findCustomerByName } from '../../domain/customers.js';

export const customerService = (store) => ({
  add({ name, phone, note }) {
    const n = (name || '').trim();
    if (!n) return fail('اكتب اسم العميل');
    const p = cleanPhone(phone);
    if (p.error) return fail(p.error);
    const S = store.state;
    if (S.custs.some((c) => norm(c.name) === norm(n) && (c.phone || '') === p.phone)) return fail('العميل ده مسجّل قبل كده');
    store.commit((S) => S.custs.push({ id: uid(), name: n, phone: p.phone, note: (note || '').trim(), ts: Date.now() }));
    return ok();
  },

  update(id, { name, phone, note }) {
    const n = (name || '').trim();
    if (!n) return fail('اكتب اسم العميل');
    const p = cleanPhone(phone);
    if (p.error) return fail(p.error);
    store.commit((S) => {
      const c = S.custs.find((x) => x.id === id);
      if (!c) return;
      // keep history linked when renaming
      if (norm(n) !== norm(c.name)) for (const s of S.sessions) if (norm(s.customer) === norm(c.name)) s.customer = n;
      Object.assign(c, { name: n, phone: p.phone, note: (note || '').trim() });
    });
    return ok();
  },

  remove(id) {
    store.commit((S) => {
      S.custs = S.custs.filter((x) => x.id !== id);
    });
  },
});

export const bookingService = (store) => {
  function validate({ room, name, phone, at, note }, exceptId) {
    room = (room || '').trim();
    name = (name || '').trim();
    if (!room) return fail('اكتب اسم الغرفة');
    if (!name) return fail('اكتب اسم العميل');
    const p = cleanPhone(phone);
    if (p.error) return fail(p.error);
    if (isNaN(at)) return fail('حدد الموعد');
    if (bookingClash(store.state, room, at, exceptId)) return fail('الغرفة محجوزة قريب من الوقت ده');
    return ok({ room, name, phone: p.phone, at, note: (note || '').trim() });
  }

  return {
    add(input) {
      const v = validate(input);
      if (!v.ok) return v;
      store.commit((S) => {
        S.books.push({ id: uid(), st: 'wait', ts: Date.now(), ...v.value });
        if (!findCustomerByName(S, v.value.name))
          S.custs.push({ id: uid(), name: v.value.name, phone: v.value.phone, note: '', ts: Date.now() });
      });
      return ok();
    },

    update(id, input) {
      const v = validate(input, id);
      if (!v.ok) return v;
      store.commit((S) => Object.assign(S.books.find((x) => x.id === id), v.value));
      return ok();
    },

    setStatus(id, st) {
      store.commit((S) => {
        const b = S.books.find((x) => x.id === id);
        if (b) b.st = st;
      });
    },

    /** Mark arrived; returns a free device matching the room (if any). */
    arrived(id) {
      return store.commit((S) => {
        const b = S.books.find((x) => x.id === id);
        if (!b) return null;
        b.st = 'came';
        const d = S.devices.find(
          (x) => x.active && norm(x.name) === norm(b.room) && !S.sessions.some((s) => !s.end && s.dev === x.id),
        );
        return d ? { deviceId: d.id, customer: b.name } : null;
      });
    },

    remove(id) {
      store.commit((S) => {
        S.books = S.books.filter((x) => x.id !== id);
      });
    },
  };
};
