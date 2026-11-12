// Presentation: finished sessions log with filters.
import { esc, fmt, dur, fmtTime, sum, dayKey } from '../../core/utils.js';
import { MODE, PAY } from '../../core/labels.js';
import { elapsed } from '../../domain/pricing.js';
import { sessionNo } from '../../domain/period.js';
import { ctx, ui } from '../context.js';
import { table, stat, options } from '../components.js';
import { requireAuth } from '../auth.js';
import { openEdit } from './sessionDialogs.js';

function filtered(S) {
  const F = ui.logFilter;
  let a = S.sessions.filter((s) => s.end).sort((x, y) => y.end - x.end);
  if (F.d) a = a.filter((s) => dayKey(s.start) === F.d);
  if (F.dev) a = a.filter((s) => s.dev === F.dev);
  if (F.pay) a = a.filter((s) => s.pay === F.pay);
  if (F.q) {
    const q = F.q.toLowerCase();
    a = a.filter((s) => `${s.customer}${s.dn}${sessionNo(s)}`.toLowerCase().includes(q));
  }
  return a;
}

export function render() {
  const S = ctx.S;
  const F = ui.logFilter;
  const a = filtered(S);
  const R = sum(a, (s) => s.amount);
  const EX = sum(S.expenses.filter((e) => !F.d || e.date === F.d), (e) => e.amt);
  const DS = sum(a, (s) => (s.adj < 0 ? -s.adj : 0));

  const rows = a.map((s) => [
    '#' + sessionNo(s),
    `${esc(s.dn)}${s.customer ? ` <small class="mut">(${esc(s.customer)})</small>` : ''}`,
    s.dt.toUpperCase(),
    MODE[s.mode],
    fmtTime(s.start),
    fmtTime(s.end),
    dur(elapsed(s)),
    `<b>${fmt(s.amount)}</b>`,
    `<span class="${s.pay === 'unpaid' ? 'red' : 'ok'}">${PAY[s.pay]}</span>`,
    `<button class="btn sm" data-act="showSummary" data-id="${s.id}">فاتورة</button> <button class="btn sm g" data-act="editLogged" data-id="${s.id}">تعديل 🔒</button>`,
  ]);

  return `<div class="box filters">
      <div><label>التاريخ</label><input type="date" value="${F.d}" data-change="logFilter" data-k="d"></div>
      <div><label>الجهاز</label><select data-change="logFilter" data-k="dev"><option value="">الكل</option>${options(S.devices.map((d) => [d.id, d.name]), F.dev)}</select></div>
      <div><label>الدفع</label><select data-change="logFilter" data-k="pay"><option value="">الكل</option>${options(Object.entries(PAY), F.pay)}</select></div>
      <div><label>بحث</label><input type="search" value="${esc(F.q)}" placeholder="عميل / جهاز / رقم" data-change="logFilter" data-k="q"></div>
      <button class="btn g" data-act="clearLogFilter">مسح</button>
    </div>
    <div class="box">${table(['#', 'الجهاز', 'النوع', 'اللعب', 'البداية', 'النهاية', 'المدة', 'المبلغ', 'الدفع', ''], rows, 'لا توجد جلسات')}<p>${a.length} جلسة</p></div>
    <div class="grid">
      ${stat('إيرادات (اشتغلت بكام)', fmt(R) + ' ج')}
      ${stat('مصروفات ' + (F.d ? 'اليوم المحدد' : 'كل الفترات'), fmt(EX) + ' ج')}
      ${stat('الصافي', fmt(R - EX) + ' ج')}
      ${stat('إجمالي الخصومات', fmt(DS) + ' ج')}
    </div>`;
}

export const actions = {
  logFilter(d, el) {
    ui.logFilter[d.k] = el.value;
    ctx.render();
  },
  clearLogFilter() {
    ui.logFilter = { d: '', dev: '', q: '', pay: '' };
    ctx.render();
  },
  editLogged: (d) => requireAuth(() => openEdit(+d.id)),
};
