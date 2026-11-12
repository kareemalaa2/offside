// Presentation: profit reports.
import { esc, fmt, sum } from '../../core/utils.js';
import { REPORT_RANGES } from '../../core/labels.js';
import { drinksTotal } from '../../domain/pricing.js';
import { inRange, expenseTs } from '../../domain/period.js';
import { cogsOf } from '../../domain/inventory.js';
import { ctx, ui } from '../context.js';
import { stat, table, bars } from '../components.js';

export function render() {
  const S = ctx.S;
  const RP = ui.reportRange;
  const inR = (ts) => inRange(S, RP, ts);
  const D = S.sessions.filter((s) => s.end && inR(s.end));
  const SA = S.sales.filter((x) => inR(x.ts));
  const EX = S.expenses.filter((e) => inR(RP === 'p' ? expenseTs(e) : new Date(e.date + 'T12:00:00').getTime()));
  const BU = S.buys.filter((b) => inR(b.ts));
  const WD = S.cashm.filter((x) => x.type === 'out' && inR(x.ts));

  const sd = sum(D, drinksTotal);
  const sl = sum(SA, (x) => x.amt);
  const pl = sum(D, (s) => s.amount) - sd;
  const rev = pl + sd + sl;
  const cg = cogsOf(D, SA);
  const gp = rev - cg;
  const ex = sum(EX, (e) => e.amt);
  const net = gp - ex;

  const products = {};
  for (const i of [...D.flatMap((s) => s.items || []), ...SA.flatMap((x) => x.items || [])]) {
    const o = products[i.n] || (products[i.n] = { q: 0, r: 0, c: 0 });
    o.q += i.q;
    o.r += i.p * i.q;
    o.c += (i.c || 0) * i.q;
  }
  const cats = EX.reduce((o, e) => ((o[e.cat] = (o[e.cat] || 0) + e.amt), o), {});

  return `<div class="box row center"><b>الفترة:</b>${REPORT_RANGES.map(([k, l]) => `<button class="btn sm ${RP === k ? 'r' : ''}" data-act="reportRange" data-k="${k}">${l}</button>`).join('')}</div>
    <div class="grid">
      ${stat('إجمالي الإيرادات', fmt(rev) + ' ج', `لعب ${fmt(pl)} • مشروبات ${fmt(sd + sl)}`)}
      ${stat('تكلفة المشروبات المباعة', fmt(cg) + ' ج')}
      ${stat('مجمل الربح', fmt(gp) + ' ج')}
      ${stat('المصروفات التشغيلية', fmt(ex) + ' ج')}
      ${stat('صافي الربح الحقيقي', fmt(net) + ' ج', 'إيرادات − تكلفة − مصروفات', 'hl')}
    </div>
    <div class="box mt sm mut">مش داخلة في الربح (عشان متتحسبش مرتين): مشتريات المخزون <b>${fmt(sum(BU, (b) => b.total))} ج</b> (بتتحسب كتكلفة وقت البيع بس) • سحب من الخزنة <b>${fmt(sum(WD, (x) => x.amt))} ج</b> • إيراد لسه مش محصّل <b>${fmt(sum(D.filter((s) => s.pay === 'unpaid'), (s) => s.amount))} ج</b> (داخل في الإيراد وخارج الدرج).</div>
    <h2>أرباح المنتجات</h2>
    <div class="box">${table(['المنتج', 'الكمية', 'مبيعات', 'تكلفة', 'ربح'], Object.entries(products).map(([n, o]) => [esc(n), o.q, fmt(o.r), fmt(o.c), `<b>${fmt(o.r - o.c)}</b>`]), 'لا مبيعات')}</div>
    <h2>المصروفات حسب البند</h2><div class="box">${bars(cats) || '<span class="mut">لا مصروفات</span>'}</div>`;
}

export const actions = {
  reportRange(d) {
    ui.reportRange = d.k;
    ctx.render();
  },
};
