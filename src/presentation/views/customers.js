// Presentation: customers.
import { esc, fmt, fmtTime, norm } from '../../core/utils.js';
import { customerStats } from '../../domain/customers.js';
import { ctx, ui } from '../context.js';
import { $, toast, openModal, hideModal } from '../ui.js';
import { table } from '../components.js';

function customersTable() {
  const S = ctx.S;
  const q = norm(ui.custQuery);
  const L = S.custs.filter((c) => !q || norm(c.name).includes(q) || String(c.phone).includes(q));
  return table(
    ['الاسم', 'الرقم', 'جلسات', 'إجمالي الصرف', 'مستحق عليه', 'آخر زيارة', 'ملاحظة', ''],
    L.map((c) => {
      const t = customerStats(S, c);
      return [
        `<b>${esc(c.name)}</b>`,
        c.phone ? `<a href="tel:${esc(c.phone)}" class="red">${esc(c.phone)}</a>` : '—',
        t.n, fmt(t.tot) + ' ج',
        `<span class="${t.un ? 'red' : ''}">${fmt(t.un)} ج</span>`,
        t.last ? fmtTime(t.last) : '—', esc(c.note),
        `<button class="btn sm" data-act="editCustomer" data-id="${c.id}">تعديل</button> <button class="btn sm g" data-act="askDeleteCustomer" data-id="${c.id}">حذف</button>`,
      ];
    }),
    'لا يوجد عملاء',
  );
}

export function render() {
  return `<div class="box"><b>👥 تسجيل عميل جديد</b>
      <div class="row end"><div><label>الاسم</label><input id="cnm"></div>
        <div><label>رقم الموبايل</label><input id="cph" type="tel" inputmode="tel"></div>
        <div class="grow"><label>ملاحظة</label><input id="cnt" class="w100"></div>
        <button class="btn r" data-act="addCustomer">إضافة</button></div></div>
    <div class="box"><div class="row center"><b>العملاء (${ctx.S.custs.length})</b>
      <input type="search" class="grow" placeholder="بحث بالاسم أو الرقم" value="${esc(ui.custQuery)}" data-input="custSearch"></div>
      <div id="ct">${customersTable()}</div></div>`;
}

const close = () => {
  hideModal();
  ctx.render();
};

export const actions = {
  custSearch(d, el) {
    ui.custQuery = el.value;
    $('#ct').innerHTML = customersTable();
  },
  addCustomer() {
    const r = ctx.svc.customers.add({ name: $('#cnm').value, phone: $('#cph').value, note: $('#cnt').value });
    if (!r.ok) return toast(r.error);
    toast('تم حفظ العميل');
    ctx.render();
  },
  editCustomer(d) {
    const c = ctx.S.custs.find((x) => x.id === +d.id);
    openModal(`<h3>تعديل عميل</h3>
      <label>الاسم</label><input id="ecn" class="w100" value="${esc(c.name)}">
      <label>الموبايل</label><input id="ecp" type="tel" inputmode="tel" class="w100" value="${esc(c.phone)}">
      <label>ملاحظة</label><input id="ect" class="w100" value="${esc(c.note)}">
      <div class="row"><button class="btn r grow" data-act="saveCustomer" data-id="${c.id}">حفظ</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  saveCustomer(d) {
    const r = ctx.svc.customers.update(+d.id, { name: $('#ecn').value, phone: $('#ecp').value, note: $('#ect').value });
    if (!r.ok) return toast(r.error);
    close();
  },
  askDeleteCustomer(d) {
    const c = ctx.S.custs.find((x) => x.id === +d.id);
    openModal(`<h3>حذف العميل؟</h3><p>${esc(c.name)} – هيتمسح من القايمة بس، وجلساته السابقة تفضل في السجل.</p>
      <div class="row"><button class="btn r grow" data-act="deleteCustomer" data-id="${c.id}">حذف</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  deleteCustomer(d) {
    ctx.svc.customers.remove(+d.id);
    close();
  },
};
