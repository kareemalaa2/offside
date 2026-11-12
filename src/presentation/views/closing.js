// Presentation: cash drawer, shift and period closing.
import { esc, fmt, fmtTime, num } from '../../core/utils.js';
import { periodStats, lastActual } from '../../domain/cash.js';
import { ctx, ui } from '../context.js';
import { $, toast, openModal, hideModal } from '../ui.js';
import { stat, table, options } from '../components.js';

export function render() {
  const S = ctx.S;
  const q = periodStats(S);
  const cur = S.cur;
  const moves = S.cashm.filter((x) => x.ts > q.p).reverse();

  const closeRows = [...S.closes].reverse().map((x) => [
    x.id, `${fmtTime(x.from)} → ${fmtTime(x.at)}`, fmt(x.open || 0), fmt(x.cash), fmt(x.exp || 0), fmt(x.pu || 0),
    x.expected == null ? '—' : fmt(x.expected), x.actual == null ? '—' : fmt(x.actual),
    `<span class="${x.diff < 0 ? 'red' : 'ok'}">${x.actual == null ? '—' : fmt(x.diff)}</span>`,
    fmt(x.rev), `<b>${fmt(x.rev - (x.cogs || 0) - (x.exp || 0))}</b>`, esc(x.note),
  ]);

  return `<div class="box"><b>الشيفت:</b> ${cur
      ? `شغال منذ ${fmtTime(cur.at)} • افتتاح ${fmt(cur.open)} ج${cur.who ? ' • ' + esc(cur.who) : ''}`
      : '<span class="mut">لم يبدأ</span> <button class="btn r sm" data-act="openShift">▶ بدء شيفت</button>'}
      <br><span class="mut xs">الفترة الحالية منذ ${fmtTime(q.p)}</span></div>

    <h2>الخزنة (الدرج)</h2><div class="grid">
      ${stat('رصيد افتتاحي', fmt(q.open) + ' ج')}
      ${stat('＋ نقدي مقبوض', fmt(q.cash) + ' ج', 'جلسات + مشروبات + ديون اتحصّلت')}
      ${stat('＋ إيداع', fmt(q.mi) + ' ج')}
      ${stat('－ مصروفات', fmt(q.ex) + ' ج')}
      ${stat('－ مشتريات (من الخزنة)', fmt(q.pu) + ' ج')}
      ${stat('－ سحب', fmt(q.mo) + ' ج')}
      ${stat('الرصيد المتوقع', fmt(q.expected) + ' ج', 'المفروض في الدرج', 'hl')}
      ${stat('InstaPay', fmt(q.insta) + ' ج', 'مش في الدرج')}
    </div>

    <div class="box mt"><b>حركة خزنة يدوية</b>
      <div class="row end"><select id="mt">${options([['in', 'إيداع في الخزنة'], ['out', 'سحب من الخزنة']])}</select>
        <input id="ma" type="number" inputmode="decimal" min="0" step="0.5" placeholder="المبلغ" class="w90">
        <input id="mn" placeholder="السبب" class="grow"><button class="btn r" data-act="addCashMove">تسجيل</button></div>
      ${moves.map((x) => `<div class="line sm"><span>${x.type === 'in' ? '＋ إيداع' : '－ سحب'} ${esc(x.note)} • ${fmtTime(x.ts)}</span><span>${fmt(x.amt)} ج <button class="btn sm g" data-act="removeCashMove" data-id="${x.id}">حذف</button></span></div>`).join('')}</div>

    <h2>أداء الفترة</h2><div class="grid">
      ${stat('الإيرادات', fmt(q.rev) + ' ج')}${stat('تكلفة المشروبات', fmt(q.cogs) + ' ج')}${stat('المصروفات', fmt(q.ex) + ' ج')}
      ${stat('صافي الربح', fmt(q.rev - q.cogs - q.ex) + ' ج', 'مشتريات المخزون مش مصروف')}${stat('غير محصّل', fmt(q.unpaid) + ' ج')}${stat('الخصومات', fmt(q.disc) + ' ج')}
    </div>

    <div class="box mt"><b>إنهاء الشيفت والتقفيل</b>
      <label>النقدية الفعلية في الدرج</label>
      <input id="ca" type="number" inputmode="decimal" min="0" step="0.5" data-input="cashDiff" data-expected="${q.expected}"> <b id="df" class="ms"></b>
      <label>ملاحظة</label><input id="cn" class="w100">
      <div class="row"><button class="btn r" data-act="askClose">🔒 إنهاء وتقفيل وتصفير العدادات</button>
        ${S.closes.length ? '<button class="btn g" data-act="askUndoClose">↩ تراجع عن آخر تقفيل</button>' : ''}</div>
      ${q.run ? `<p class="warn sm">فيه ${q.run} جلسة شغالة؛ هتتحسب في الفترة الجاية.</p>` : ''}
    </div>

    <h2>سجل التقفيلات</h2>
    <div class="box">${table(['#', 'الفترة', 'افتتاحي', 'نقدي', 'مصروفات', 'مشتريات', 'المتوقع', 'الفعلي', 'الفرق', 'إيرادات', 'صافي', 'ملاحظة'], closeRows, 'لا توجد تقفيلات')}</div>`;
}

const close = () => {
  hideModal();
  ctx.render();
};

export const actions = {
  openShift() {
    openModal(`<h3>▶ بدء شيفت</h3>
      <label>اسم المسؤول (اختياري)</label><input id="sw" class="w100">
      <label>رصيد الخزنة الافتتاحي (ج)</label><input id="so" type="number" inputmode="decimal" min="0" step="0.5" class="w100" value="${lastActual(ctx.S)}">
      <div class="row"><button class="btn r grow" data-act="startShift">بدء</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  startShift() {
    ctx.svc.cash.startShift({ who: $('#sw').value, open: $('#so').value });
    close();
  },
  addCashMove() {
    const r = ctx.svc.cash.addMove({ type: $('#mt').value, amount: $('#ma').value, note: $('#mn').value });
    if (!r.ok) return toast(r.error);
    ctx.render();
  },
  removeCashMove(d) {
    ctx.svc.cash.removeMove(+d.id);
    ctx.render();
  },
  cashDiff(d, el) {
    const v = parseFloat(el.value);
    $('#df').textContent = isNaN(v) ? '' : 'الفرق: ' + fmt(v - +d.expected) + ' ج';
  },
  askClose() {
    const raw = $('#ca').value;
    const a = raw === '' ? null : num(raw, null);
    ui.closeDraft = { a, n: $('#cn').value.trim() };
    const q = periodStats(ctx.S);
    openModal(`<h3>تأكيد التقفيل</h3>
      <p>المتوقع في الدرج <b>${fmt(q.expected)} ج</b>${a === null ? '' : ` • الفعلي <b>${fmt(a)} ج</b> • الفرق <b class="red">${fmt(a - q.expected)} ج</b>`}</p>
      <p>إيرادات ${fmt(q.rev)} ج • صافي ربح <b class="red">${fmt(q.rev - q.cogs - q.ex)} ج</b></p>
      <p class="mut sm">بعد التأكيد العدادات بتبدأ من صفر والشيفت بينتهي. السجلات بتفضل محفوظة.</p>
      <div class="row"><button class="btn r grow" data-act="doClose">تأكيد التقفيل</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  doClose() {
    ctx.svc.cash.close({ actual: ui.closeDraft.a, note: ui.closeDraft.n });
    toast('تم التقفيل – العدادات اتصفّرت');
    close();
  },
  askUndoClose() {
    openModal(`<h3>تراجع عن آخر تقفيل؟</h3><p>العدادات هترجع تحسب من آخر تقفيل قبله.</p>
      <div class="row"><button class="btn r grow" data-act="undoClose">تراجع</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`);
  },
  undoClose() {
    ctx.svc.cash.undoLastClose();
    close();
  },
};
