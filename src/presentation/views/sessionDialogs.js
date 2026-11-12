// Presentation: all dialogs that act on a single session.
import { esc, fmt, dur, num } from '../../core/utils.js';
import { MODE, PAY } from '../../core/labels.js';
import { rateFor, playCost, sessionTotal, elapsed, drinksTotal } from '../../domain/pricing.js';
import { findSession, findDevice } from '../../domain/period.js';
import { ctx, ui } from '../context.js';
import { openModal, setModalBody, hideModal, toast, $, $$, shareText } from '../ui.js';
import { invoiceHtml, invoiceText, options } from '../components.js';

const S = () => ctx.S;
const sess = (d) => findSession(S(), +d.id);
const close = () => {
  hideModal();
  ctx.render();
};

/* ---------- start ---------- */
export function openStart(deviceId, customer = '') {
  const d = findDevice(S(), deviceId);
  if (!d) return;
  openModal(`<h3>بدء جلسة – ${esc(d.name)}</h3>
    <label>نوع اللعب</label>
    <div class="seg">${['single', 'multi']
      .map((m, i) => `<label><input type="radio" name="md" value="${m}" ${i ? '' : 'checked'} data-change="startMode" data-type="${d.type}"><span>${MODE[m]}</span></label>`)
      .join('')}</div>
    <label>المدة بالدقائق (فارغ = عداد مفتوح)</label>
    <input id="pl" type="number" inputmode="numeric" min="1" placeholder="مفتوح" class="w100" data-input="planInput">
    <div class="ch">${[30, 60, 90, 120].map((x) => `<button class="btn sm chip" data-act="planChip" data-v="${x}">${x} د</button>`).join('')}
      <button class="btn sm chip r" data-act="planChip" data-v="">مفتوح</button></div>
    <label>اسم العميل (اختياري)</label>
    <input id="cu" list="cl" class="w100" value="${esc(customer)}" autocomplete="off">
    <datalist id="cl">${S().custs.map((c) => `<option value="${esc(c.name)}">${esc(c.phone)}</option>`).join('')}</datalist>
    <p>السعر: <b id="pp" class="red"></b> ج/ساعة</p>
    <div class="row"><button class="btn r grow" data-act="startSession" data-id="${d.id}">▶ ابدأ الجلسة</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  updatePrice(d.type);
}

const chosenMode = () => $('[name=md]:checked')?.value || 'single';
function updatePrice(type) {
  $('#pp').textContent = rateFor(S().settings, type, chosenMode());
}
function highlightChips() {
  const v = $('#pl').value;
  $$('.chip').forEach((b) => b.classList.toggle('r', b.dataset.v === v));
}

/* ---------- drinks on a session ---------- */
function drinksBody(id) {
  const s = findSession(S(), id);
  const items = s.items || [];
  return `<h3>🥤 مشروبات – ${esc(s.dn)}</h3>
    ${S().drinks
      .map((d) => {
        const q = items.find((i) => i.id === d.id)?.q || 0;
        return `<div class="line"><span>${esc(d.name)} <small class="mut">${fmt(d.price)} ج${d.track ? ` • متاح ${d.qty}` : ''}</small></span>
          <span class="stepper"><button class="btn sm" data-act="changeDrink" data-id="${id}" data-did="${d.id}" data-delta="-1">−</button><b>${q}</b><button class="btn sm r" data-act="changeDrink" data-id="${id}" data-did="${d.id}" data-delta="1">+</button></span></div>`;
      })
      .join('') || '<p class="mut">أضف مشروبات من المخزون</p>'}
    <p>إجمالي المشروبات: <b class="red">${fmt(drinksTotal(s))} ج</b></p>
    <div class="row"><button class="btn r grow" data-act="closeModal">تم</button></div>`;
}

/* ---------- invoice / summary ---------- */
export const liveInvoiceBody = (id) => {
  const s = findSession(S(), id);
  return `<h3>🧾 الحساب الحالي – جلسة #${id}</h3>${invoiceHtml(S(), s)}
    <p class="mut sm">الجلسة لسه شغالة والعداد مكمل.</p>
    <div class="row"><button class="btn" data-act="shareInvoice" data-id="${id}">📤 مشاركة</button><button class="btn r grow" data-act="closeModal">إغلاق</button></div>`;
};

function summaryBody(id) {
  const s = findSession(S(), id);
  return `<h3>ملخص الحساب #${s.id}</h3>${invoiceHtml(S(), s)}
    <label>تسجيل الدفع</label>
    <div class="row">${Object.keys(PAY).map((p) => `<button class="btn ${s.pay === p ? 'r' : ''}" data-act="setPay" data-id="${id}" data-p="${p}">${PAY[p]}</button>`).join('')}</div>
    <div class="row np"><button class="btn" data-act="shareInvoice" data-id="${id}">📤 مشاركة / واتساب</button><button class="btn" data-act="printInvoice">🖨 طباعة</button><button class="btn g" data-act="closeModal">إغلاق</button></div>`;
}
export const openSummary = (id) => openModal(summaryBody(id));

/* ---------- edit ---------- */
export function openEdit(id) {
  const s = findSession(S(), id);
  openModal(`<h3>تعديل الجلسة #${s.id}</h3>
    <label>اسم العميل</label><input id="ec" value="${esc(s.customer)}" class="w100">
    <label>نوع اللعب</label><select id="em" class="w100">${options([['single', 'Single'], ['multi', 'Multi']], s.mode)}</select>
    <label>خصم (سالب) أو إضافة (موجب) بالجنيه</label><input id="ea" type="number" inputmode="decimal" step="0.5" value="${s.adj || 0}" class="w100">
    ${s.end ? `<label>حالة الدفع</label><select id="ep" class="w100">${options(Object.entries(PAY), s.pay)}</select>` : ''}
    <p class="mut sm">تغيير النوع يعيد حساب السعر بأسعار الإعدادات الحالية.</p>
    <div class="row"><button class="btn r grow" data-act="saveSession" data-id="${id}">حفظ</button>
      ${s.end ? `<button class="btn g" data-act="askDeleteSession" data-id="${id}">🗑 حذف</button>` : ''}
      <button class="btn g" data-act="closeModal">إلغاء</button></div>`);
}

export const sessionActions = {
  closeModal: close,

  startMode: (d) => updatePrice(d.type),
  planInput: highlightChips,
  planChip(d) {
    $('#pl').value = d.v;
    highlightChips();
  },
  startSession(d) {
    const r = ctx.svc.sessions.start({
      deviceId: d.id,
      mode: chosenMode(),
      plan: num($('#pl').value),
      customer: $('#cu').value,
    });
    if (!r.ok) toast(r.error);
    close();
  },

  pause(d) {
    ctx.svc.sessions.pause(+d.id);
    ctx.render();
  },
  resume(d) {
    ctx.svc.sessions.resume(+d.id);
    ctx.render();
  },

  openDrinks: (d) => openModal(drinksBody(+d.id)),
  changeDrink(d) {
    const r = ctx.svc.sessions.changeDrink(+d.id, d.did, +d.delta);
    if (!r.ok) toast(r.error);
    setModalBody(drinksBody(+d.id));
  },

  askSwitch(d) {
    const s = sess(d);
    const next = s.mode === 'single' ? 'multi' : 'single';
    openModal(`<h3>تحويل إلى ${MODE[next]}؟</h3>
      <p>هيتحسب ${MODE[s.mode]} لحد دلوقتي (الحساب الحالي <b class="red">${fmt(playCost(s, S().settings))} ج</b>)، وبعدها يبدأ ${MODE[next]} بسعر ${rateFor(S().settings, s.dt, next)} ج/ساعة.</p>
      <div class="row"><button class="btn r grow" data-act="doSwitch" data-id="${s.id}">تأكيد التحويل</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  doSwitch(d) {
    ctx.svc.sessions.switchMode(+d.id);
    close();
  },

  askEnd(d) {
    const s = sess(d);
    openModal(`<h3>إنهاء الجلسة؟</h3>
      <p>${esc(s.dn)} • المدة ${dur(elapsed(s))} • التكلفة <b class="red">${fmt(sessionTotal(s, S().settings))} ج</b></p>
      <div class="row"><button class="btn r grow" data-act="doEnd" data-id="${s.id}">تأكيد الإنهاء</button><button class="btn g" data-act="closeModal">رجوع</button></div>`);
  },
  doEnd(d) {
    ctx.svc.sessions.end(+d.id);
    ctx.render();
    openSummary(+d.id);
  },

  showSummary: (d) => openSummary(+d.id),
  setPay(d) {
    ctx.svc.sessions.setPayment(+d.id, d.p);
    setModalBody(summaryBody(+d.id));
    ctx.render();
  },
  shareInvoice: (d) => shareText('فاتورة', invoiceText(S(), sess(d))),
  printInvoice: () => window.print(),

  liveInvoice(d) {
    openModal(liveInvoiceBody(+d.id));
    ui.liveInvoiceId = +d.id;
  },

  editSession: (d) => openEdit(+d.id),
  saveSession(d) {
    ctx.svc.sessions.edit(+d.id, {
      customer: $('#ec').value,
      mode: $('#em').value,
      adj: num($('#ea').value),
      pay: $('#ep')?.value,
    });
    close();
  },
  askDeleteSession(d) {
    openModal(`<h3>حذف الجلسة #${d.id}؟</h3><p>لا يمكن التراجع. المشروبات هترجع للمخزون.</p>
      <div class="row"><button class="btn r grow" data-act="doDeleteSession" data-id="${d.id}">حذف</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  doDeleteSession(d) {
    ctx.svc.sessions.remove(+d.id);
    close();
  },
};
