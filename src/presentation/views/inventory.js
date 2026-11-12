// Presentation: products / stock / purchases.
import { esc, fmt, fmtTime, sum, num } from '../../core/utils.js';
import { MOVE_TYPE } from '../../core/labels.js';
import { isLow, stockValue, findProduct } from '../../domain/inventory.js';
import { periodStart } from '../../domain/period.js';
import { ctx } from '../context.js';
import { $, toast, openModal, hideModal } from '../ui.js';
import { stat, table, options } from '../components.js';

export function render() {
  const S = ctx.S;
  const L = S.drinks;
  const lowCount = L.filter(isLow).length;
  const p = periodStart(S);

  const productRows = L.map((d) => [
    `<input value="${esc(d.name)}" class="w110" data-change="setProduct" data-id="${d.id}" data-k="name">`,
    `<input type="number" inputmode="decimal" min="0" step="0.5" class="w70" value="${d.price}" data-change="setProductNum" data-id="${d.id}" data-k="price">`,
    `<input type="number" inputmode="decimal" min="0" step="0.01" class="w70" value="${d.cost}" data-change="setProductNum" data-id="${d.id}" data-k="cost">`,
    fmt(d.price - d.cost),
    `<b class="${isLow(d) ? 'red' : ''}">${d.track ? d.qty : '—'}</b>${isLow(d) ? ' ⚠' : ''}`,
    `<input type="number" inputmode="numeric" min="0" class="w60" value="${d.min}" data-change="setProductNum" data-id="${d.id}" data-k="min">`,
    `<input type="checkbox" ${d.track ? 'checked' : ''} data-change="setProductTrack" data-id="${d.id}">`,
    `<button class="btn sm" data-act="openPurchase" data-id="${d.id}">شراء</button> <button class="btn sm g" data-act="openCount" data-id="${d.id}">جرد</button> <button class="btn sm g" data-act="askRemoveProduct" data-id="${d.id}">🗑</button>`,
  ]);

  const buyRows = [...S.buys].reverse().slice(0, 30).map((b) => [
    fmtTime(b.ts), esc(b.n), b.q, fmt(b.total), fmt(b.total / b.q),
    b.pay === 'cash' ? 'الخزنة' : 'خارج الخزنة',
    `<button class="btn sm g" data-act="cancelPurchase" data-id="${b.id}">إلغاء</button>`,
  ]);

  const moveRows = [...S.stm].reverse().slice(0, 40).map((m) => [
    fmtTime(m.ts), esc(m.n), MOVE_TYPE[m.type] || m.type,
    `<span class="${m.q < 0 ? 'red' : 'ok'}">${m.q > 0 ? '+' : ''}${m.q}</span>`, esc(m.note),
  ]);

  return `<div class="grid">
      ${stat('قيمة المخزون (بالتكلفة)', fmt(stockValue(S)) + ' ج')}
      ${stat('أصناف منخفضة', `<span class="${lowCount ? 'warn' : 'ok'}">${lowCount}</span>`)}
      ${stat('مشتريات الفترة', fmt(sum(S.buys.filter((b) => b.ts > p), (b) => b.total)) + ' ج')}
    </div>
    <div class="row"><button class="btn r" data-act="openPurchase">+ تسجيل مشتريات</button><button class="btn" data-act="addProduct">+ صنف جديد</button></div>
    <p class="mut xs">فعّل "تتبع" لأي صنف عشان الكمية تتخصم تلقائياً مع كل بيع وجلسة. سعر التكلفة بيتحدّث بالمتوسط عند كل شراء. الأسعار الجديدة تسري على الإضافات الجديدة فقط.</p>
    <div class="box">${table(['المنتج', 'سعر البيع', 'التكلفة', 'ربح/قطعة', 'الكمية', 'حد أدنى', 'تتبع', ''], productRows, 'لا توجد أصناف')}</div>
    ${S.buys.length ? `<h2>سجل المشتريات</h2><div class="box">${table(['التاريخ', 'المنتج', 'الكمية', 'الإجمالي', 'سعر القطعة', 'الدفع', ''], buyRows)}</div>` : ''}
    <h2>حركة المخزون</h2><div class="box">${table(['التاريخ', 'المنتج', 'النوع', 'الكمية', 'ملاحظة'], moveRows, 'لا حركة')}</div>`;
}

const close = () => {
  hideModal();
  ctx.render();
};

export const actions = {
  setProduct: (d, el) => ctx.svc.inventory.updateProduct(d.id, d.k, el.value),
  setProductNum(d, el) {
    ctx.svc.inventory.updateProduct(d.id, d.k, num(el.value));
    ctx.render();
  },
  setProductTrack(d, el) {
    ctx.svc.inventory.updateProduct(d.id, 'track', el.checked);
    ctx.render();
  },
  addProduct() {
    ctx.svc.inventory.addProduct();
    ctx.render();
  },
  askRemoveProduct(d) {
    const p = findProduct(ctx.S, d.id);
    openModal(`<h3>حذف ${esc(p.name)}؟</h3><p class="sm mut">السجلات القديمة تفضل محفوظة.</p>
      <div class="row"><button class="btn r grow" data-act="removeProduct" data-id="${d.id}">حذف</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  removeProduct(d) {
    ctx.svc.inventory.removeProduct(d.id);
    close();
  },
  openPurchase(d) {
    openModal(`<h3>تسجيل مشتريات</h3>
      <label>المنتج</label><select id="bp" class="w100">${options(ctx.S.drinks.map((x) => [x.id, x.name]), d.id)}</select>
      <div class="two"><div><label>الكمية</label><input id="bq" type="number" inputmode="numeric" min="0" step="1" class="w100"></div>
      <div><label>إجمالي ما دفعته (ج)</label><input id="bt" type="number" inputmode="decimal" min="0" step="0.5" class="w100"></div></div>
      <label>الدفع من</label><select id="by" class="w100">${options([['cash', 'الخزنة (نقدي)'], ['ext', 'من خارج الخزنة']])}</select>
      <label>ملاحظة</label><input id="bn" class="w100">
      <div class="row"><button class="btn r grow" data-act="savePurchase">حفظ</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  savePurchase() {
    const r = ctx.svc.inventory.purchase({
      productId: $('#bp').value, qty: $('#bq').value, total: $('#bt').value, pay: $('#by').value, note: $('#bn').value,
    });
    if (!r.ok) return toast(r.error);
    close();
  },
  cancelPurchase(d) {
    ctx.svc.inventory.cancelPurchase(+d.id);
    ctx.render();
  },
  openCount(d) {
    const p = findProduct(ctx.S, d.id);
    openModal(`<h3>جرد – ${esc(p.name)}</h3><p>الكمية في النظام: <b>${p.qty || 0}</b></p>
      <label>العدد الفعلي</label><input id="aq" type="number" inputmode="numeric" min="0" class="w100">
      <div class="row"><button class="btn r grow" data-act="saveCount" data-id="${d.id}">تعديل</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`, { focus: 'aq' });
  },
  saveCount(d) {
    const r = ctx.svc.inventory.stockCount(d.id, $('#aq').value);
    if (!r.ok) return toast(r.error);
    close();
  },
};
