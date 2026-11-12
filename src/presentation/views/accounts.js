// Presentation: accounts overview (revenue by period/device, expenses, debts).
import { esc, fmt, sum, dayKey } from '../../core/utils.js';
import { MODE, EXPENSE_CATS } from '../../core/labels.js';
import { elapsed } from '../../domain/pricing.js';
import { cogsOf } from '../../domain/inventory.js';
import { sessionNo } from '../../domain/period.js';
import { ctx } from '../context.js';
import { $, toast } from '../ui.js';
import { bars, stat, table, options } from '../components.js';

export function render() {
  const S = ctx.S;
  const now = Date.now();
  const td = dayKey(now);
  const wk = dayKey(now - 6 * 864e5);
  const mo = td.slice(0, 7);
  const D = S.sessions.filter((s) => s.end);

  const R = (fn) => sum(D.filter((s) => fn(dayKey(s.end))), (s) => s.amount) + sum(S.sales.filter((x) => fn(dayKey(x.ts))), (x) => x.amt);
  const E = (fn) => sum(S.expenses.filter((e) => fn(e.date)), (e) => e.amt);
  const C = (fn) => cogsOf(D.filter((s) => fn(dayKey(s.end))), S.sales.filter((x) => fn(dayKey(x.ts))));
  const ranges = [
    ['اليوم', (k) => k === td],
    ['آخر 7 أيام', (k) => k >= wk],
    ['هذا الشهر', (k) => k.slice(0, 7) === mo],
  ];
  const by = (key) => D.reduce((o, s) => ((o[key(s)] = (o[key(s)] || 0) + s.amount), o), {});
  const hours = D.reduce((o, s) => ((o[s.dn] = (o[s.dn] || 0) + elapsed(s) / 36e5), o), {});
  const unpaid = D.filter((s) => s.pay === 'unpaid');

  const expRows = [...S.expenses]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .slice(0, 40)
    .map((e) => [e.date, esc(e.cat), fmt(e.amt), esc(e.note), `<button class="btn sm g" data-act="deleteExpense" data-id="${e.id}">حذف</button>`]);

  return `<div class="grid">
      ${ranges.map(([l, fn]) => stat(l, fmt(R(fn)) + ' ج', `مصروفات ${fmt(E(fn))} • <b class="ok inline">صافي ${fmt(R(fn) - E(fn) - C(fn))}</b>`)).join('')}
      ${stat('مستحقات غير محصّلة', fmt(sum(unpaid, (s) => s.amount)) + ' ج', unpaid.length + ' جلسة')}
      ${stat('إجمالي ساعات التشغيل', fmt(sum(D, (s) => elapsed(s)) / 36e5) + ' س')}
      ${stat('متوسط قيمة الجلسة', fmt(D.length ? sum(D, (s) => s.amount) / D.length : 0) + ' ج')}
    </div>
    <div class="grid two-col mt">
      <div class="box"><b>إيرادات كل جهاز</b>${bars(by((s) => s.dn))}</div>
      <div class="box"><b>PS5 مقابل PS4</b>${bars(by((s) => s.dt.toUpperCase()))}<b>Single مقابل Multi</b>${bars(by((s) => MODE[s.mode]))}</div>
      <div class="box"><b>الأكثر استخداماً (ساعات)</b>${bars(hours, 'س')}</div>
    </div>
    <h2>المصروفات</h2>
    <div class="box row end">
      <div><label>التاريخ</label><input id="xd" type="date" value="${td}"></div>
      <div><label>البند</label><select id="xc">${options(EXPENSE_CATS.map((c) => [c, c]))}</select></div>
      <div><label>المبلغ</label><input id="xa" type="number" inputmode="decimal" min="0" step="0.5" class="w90"></div>
      <div class="grow"><label>ملاحظة</label><input id="xn" class="w100"></div>
      <button class="btn r" data-act="addExpense">إضافة</button>
    </div>
    <div class="box">${table(['التاريخ', 'البند', 'المبلغ', 'ملاحظة', ''], expRows, 'لا مصروفات')}</div>
    ${unpaid.length
      ? `<h2>الديون</h2><div class="box">${table(
          ['#', 'العميل', 'الجهاز', 'المبلغ', ''],
          unpaid.map((s) => [
            '#' + sessionNo(s), esc(s.customer || '—'), esc(s.dn), fmt(s.amount) + ' ج',
            `<button class="btn sm" data-act="payDebt" data-id="${s.id}" data-p="cash">نقدي</button> <button class="btn sm" data-act="payDebt" data-id="${s.id}" data-p="insta">InstaPay</button>`,
          ]),
        )}</div>`
      : ''}`;
}

export const actions = {
  addExpense() {
    const r = ctx.svc.expenses.add({ date: $('#xd').value, cat: $('#xc').value, amount: $('#xa').value, note: $('#xn').value });
    if (!r.ok) return toast(r.error);
    ctx.render();
  },
  payDebt(d) {
    ctx.svc.sessions.setPayment(+d.id, d.p);
    ctx.render();
  },
};
