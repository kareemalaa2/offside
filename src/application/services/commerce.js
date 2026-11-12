// Application: direct drink sales, expenses, inventory purchases & stock counts.
import { ok, fail, sum, uid, dayKey, num } from '../../core/utils.js';
import { findProduct, canTake, applyMove, averageCost } from '../../domain/inventory.js';

export const salesService = (store) => ({
  /** @param {Record<string,number>} cart productId -> qty */
  sell(cart, pay) {
    return store.commit((S) => {
      const items = [];
      for (const [id, q] of Object.entries(cart)) {
        const d = findProduct(S, id);
        if (!d || !(q > 0)) continue;
        if (!canTake(d, q)) return fail('الكمية مش كفاية: ' + d.name);
        items.push({ id, n: d.name, p: d.price, c: d.cost || 0, q });
      }
      if (!items.length) return fail('السلة فاضية');
      for (const i of items) applyMove(S, findProduct(S, i.id), -i.q, 'sale', 'بيع مباشر');
      S.sales.push({ id: uid(), ts: Date.now(), items, amt: sum(items, (i) => i.p * i.q), pay });
      return ok();
    });
  },

  remove(id) {
    store.commit((S) => {
      const x = S.sales.find((y) => y.id === id);
      if (!x) return;
      for (const i of x.items) {
        const d = findProduct(S, i.id);
        if (d) applyMove(S, d, i.q, 'ret', 'إلغاء بيع');
      }
      S.sales = S.sales.filter((y) => y.id !== id);
    });
  },
});

export const expenseService = (store) => ({
  add({ cat, amount, note, date }) {
    const a = num(amount, NaN);
    if (!(a > 0)) return fail('أدخل مبلغاً صحيحاً');
    store.commit((S) => {
      S.expenses.push({ id: uid(), ts: Date.now(), date: date || dayKey(Date.now()), cat, amt: a, note: (note || '').trim() });
    });
    return ok();
  },
  remove(id) {
    store.commit((S) => {
      S.expenses = S.expenses.filter((x) => x.id !== id);
    });
  },
});

export const inventoryService = (store) => ({
  purchase({ productId, qty, total, pay, note }) {
    const q = num(qty, NaN);
    const t = num(total, NaN);
    return store.commit((S) => {
      const d = findProduct(S, productId);
      if (!d || !(q > 0) || !(t >= 0)) return fail('راجع الكمية والتكلفة');
      d.cost = averageCost(d, q, t);
      d.track = true;
      applyMove(S, d, q, 'buy', 'شراء');
      S.buys.push({ id: uid(), ts: Date.now(), pid: d.id, n: d.name, q, total: t, pay, note: (note || '').trim() });
      return ok();
    });
  },

  cancelPurchase(id) {
    store.commit((S) => {
      const b = S.buys.find((x) => x.id === id);
      if (!b) return;
      const d = findProduct(S, b.pid);
      if (d) applyMove(S, d, -b.q, 'adj', 'إلغاء شراء');
      S.buys = S.buys.filter((x) => x.id !== id);
    });
  },

  stockCount(productId, counted) {
    const v = num(counted, NaN);
    if (isNaN(v) || v < 0) return fail('أدخل رقماً صحيحاً');
    store.commit((S) => {
      const d = findProduct(S, productId);
      if (!d) return;
      d.track = true;
      applyMove(S, d, v - (d.qty || 0), 'adj', 'جرد');
    });
    return ok();
  },

  updateProduct(id, field, value) {
    store.commit((S) => {
      const d = findProduct(S, id);
      if (d) d[field] = value;
    });
  },

  addProduct() {
    store.commit((S) => {
      S.drinks.push({ id: 'k' + uid(), name: 'مشروب جديد', price: 10, cost: 0, qty: 0, min: 3, track: false });
    });
  },

  removeProduct(id) {
    store.commit((S) => {
      S.drinks = S.drinks.filter((d) => d.id !== id);
    });
  },
});
