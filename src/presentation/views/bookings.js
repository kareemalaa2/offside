// Presentation: bookings.
import { esc, fmtTime, toLocalInput } from '../../core/utils.js';
import { BOOK_STATUS } from '../../core/labels.js';
import { findCustomerByName } from '../../domain/customers.js';
import { ctx, ui } from '../context.js';
import { $, toast, openModal, hideModal } from '../ui.js';
import { table } from '../components.js';
import { openStart } from './sessionDialogs.js';

const FILTERS = [['wait', 'المنتظرة'], ['came', 'اللي حضرت'], ['cancel', 'الملغية'], ['all', 'الكل']];

function bookingsTable() {
  const now = Date.now();
  const L = ctx.S.books.filter((b) => ui.bookFilter === 'all' || b.st === ui.bookFilter).sort((a, b) => a.at - b.at);
  return table(
    ['الموعد', 'الغرفة', 'العميل', 'الرقم', 'الحالة', 'ملاحظة', ''],
    L.map((b) => [
      `${fmtTime(b.at)}${b.st === 'wait' && b.at < now ? ' <b class="red">متأخر</b>' : ''}`,
      esc(b.room), `<b>${esc(b.name)}</b>`,
      b.phone ? `<a class="btn sm r" href="tel:${esc(b.phone)}">📞 ${esc(b.phone)}</a>` : '—',
      BOOK_STATUS[b.st], esc(b.note),
      (b.st === 'wait'
        ? `<button class="btn sm" data-act="bookingArrived" data-id="${b.id}">✔ حضر</button> <button class="btn sm g" data-act="bookingStatus" data-id="${b.id}" data-st="cancel">إلغاء</button> `
        : `<button class="btn sm g" data-act="bookingStatus" data-id="${b.id}" data-st="wait">إرجاع</button> `) +
        `<button class="btn sm g" data-act="editBooking" data-id="${b.id}">تعديل</button> <button class="btn sm g" data-act="askDeleteBooking" data-id="${b.id}">حذف</button>`,
    ]),
    'لا توجد حجوزات',
  );
}

const readForm = (p) => ({
  room: $('#' + p + 'r').value,
  name: $('#' + p + 'n').value,
  phone: $('#' + p + 'p').value,
  at: new Date($('#' + p + 'd').value).getTime(),
  note: $('#' + p + 't').value,
});

export function render() {
  const S = ctx.S;
  return `<div class="box"><b>📅 حجز جديد</b>
      <div class="row end">
        <div><label>الغرفة / الجهاز</label><input id="bkr" list="rl"><datalist id="rl">${S.devices.map((d) => `<option value="${esc(d.name)}">`).join('')}</datalist></div>
        <div><label>اسم العميل</label><input id="bkn" list="cl2" data-change="bookingNameFill"><datalist id="cl2">${S.custs.map((c) => `<option value="${esc(c.name)}">${esc(c.phone)}</option>`).join('')}</datalist></div>
        <div><label>رقم العميل</label><input id="bkp" type="tel" inputmode="tel"></div>
        <div><label>الموعد</label><input id="bkd" type="datetime-local" value="${toLocalInput(Date.now() + 36e5)}"></div>
        <div class="grow"><label>ملاحظة</label><input id="bkt" class="w100"></div>
        <button class="btn r" data-act="addBooking">حفظ الحجز</button>
      </div></div>
    <div class="box"><div class="row center"><b>الحجوزات</b>${FILTERS.map(([k, l]) => `<button class="btn sm ${ui.bookFilter === k ? 'r' : ''}" data-act="bookingFilter" data-k="${k}">${l}</button>`).join('')}</div>
      ${bookingsTable()}</div>`;
}

const close = () => {
  hideModal();
  ctx.render();
};

export const actions = {
  bookingFilter(d) {
    ui.bookFilter = d.k;
    ctx.render();
  },
  bookingNameFill(d, el) {
    const c = findCustomerByName(ctx.S, el.value);
    if (c?.phone && !$('#bkp').value) $('#bkp').value = c.phone;
  },
  addBooking() {
    const r = ctx.svc.bookings.add(readForm('bk'));
    if (!r.ok) return toast(r.error);
    toast('تم حفظ الحجز');
    ctx.render();
  },
  editBooking(d) {
    const b = ctx.S.books.find((x) => x.id === +d.id);
    openModal(`<h3>تعديل حجز</h3>
      <label>الغرفة</label><input id="ekr" class="w100" value="${esc(b.room)}">
      <label>اسم العميل</label><input id="ekn" class="w100" value="${esc(b.name)}">
      <label>الرقم</label><input id="ekp" type="tel" inputmode="tel" class="w100" value="${esc(b.phone)}">
      <label>الموعد</label><input id="ekd" type="datetime-local" class="w100" value="${toLocalInput(b.at)}">
      <label>ملاحظة</label><input id="ekt" class="w100" value="${esc(b.note)}">
      <div class="row"><button class="btn r grow" data-act="saveBooking" data-id="${b.id}">حفظ</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  saveBooking(d) {
    const r = ctx.svc.bookings.update(+d.id, readForm('ek'));
    if (!r.ok) return toast(r.error);
    close();
  },
  bookingStatus(d) {
    ctx.svc.bookings.setStatus(+d.id, d.st);
    ctx.render();
  },
  bookingArrived(d) {
    const match = ctx.svc.bookings.arrived(+d.id);
    ctx.render();
    if (match) openStart(match.deviceId, match.customer);
  },
  askDeleteBooking(d) {
    openModal(`<h3>حذف الحجز؟</h3><div class="row"><button class="btn r grow" data-act="deleteBooking" data-id="${d.id}">حذف</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  deleteBooking(d) {
    ctx.svc.bookings.remove(+d.id);
    close();
  },
};
