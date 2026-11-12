// Presentation: home screen (devices, live timers, quick sales, expenses).
import { esc, fmt, dur, fmtTime, sum } from '../../core/utils.js';
import { MODE, PAY, EXPENSE_CATS } from '../../core/labels.js';
import { elapsed, segments, sessionTotal, rateFor, remaining } from '../../domain/pricing.js';
import { periodStart, expenseTs, runningSessions, findSession } from '../../domain/period.js';
import { cogsOf, isLow, findProduct } from '../../domain/inventory.js';
import { upcomingBookings } from '../../domain/customers.js';
import { ctx, ui } from '../context.js';
import { $, $$, toast } from '../ui.js';
import { stat, secretStat, options } from '../components.js';

/* ---------- banners ---------- */
export const lowStockBanner = (S) => {
  const l = S.drinks.filter(isLow);
  return l.length ? `<div class="box warn">⚠ مخزون منخفض: ${l.map((d) => `${esc(d.name)} (${d.qty})`).join('، ')}</div>` : '';
};

const bookingBanner = (S) => {
  const L = upcomingBookings(S);
  return L.length
    ? `<div class="box alert">📅 حجوزات قريبة: ${L.map(
        (b) => `${esc(b.room)} – ${esc(b.name)} (${fmtTime(b.at)})${b.phone ? ` <a href="tel:${esc(b.phone)}" class="red">📞</a>` : ''}`,
      ).join(' • ')}</div>`
    : '';
};

/* ---------- stats (re-rendered every second) ---------- */
function periodData(S, now) {
  const p = periodStart(S);
  const done = S.sessions.filter((s) => s.end && s.end > p);
  const sales = S.sales.filter((x) => x.ts > p);
  const exps = S.expenses.filter((e) => expenseTs(e) > p);
  return { p, done, sales, exps, now };
}

function statsHtml(S, now) {
  const { p, done, sales, exps } = periodData(S, now);
  const run = runningSessions(S);
  const rev = sum(done, (s) => s.amount) + sum(sales, (x) => x.amt);
  const exp = sum(exps, (e) => e.amt);
  const cg = cogsOf(done, sales);
  const active = S.devices.filter((d) => d.active);
  const busy = active.filter((d) => run.some((s) => s.dev === d.id)).length;
  const started = S.sessions.filter((s) => s.start >= p);
  const hrs = sum(started, (s) => elapsed(s, now)) / 36e5;
  return (
    secretStat('rev', ui.hidden.rev, 'إيرادات اليوم', fmt(rev) + ' ج') +
    stat('أجهزة مشغولة', busy) +
    stat('أجهزة متاحة', active.length - busy) +
    stat('جلسات اليوم', started.length) +
    stat('ساعات اللعب', fmt(hrs) + ' س') +
    secretStat('net', ui.hidden.net, 'صافي ربح اليوم', fmt(rev - exp - cg) + ' ج', `مصروفات: ${fmt(exp)} • تكلفة مشروبات: ${fmt(cg)}`)
  );
}

/* ---------- device cards ---------- */
const leftHtml = (s, now) => {
  const left = remaining(s, now);
  if (left === null) return '';
  return left < 0 ? `<span class="red">تجاوز المدة بـ ${dur(-left)}</span>` : `المتبقي ${dur(left)}`;
};
const costHtml = (S, s, now) => (ui.showCost[s.id] ? fmt(sessionTotal(s, S.settings, now)) + ' ج' : '•••• 👁');

function deviceCard(S, d, run, now) {
  if (!d.active) return `<div class="dev off"><h3>${esc(d.name)}<span class="tag">معطّل</span></h3></div>`;
  const s = run.find((x) => x.dev === d.id);
  if (!s)
    return `<div class="dev free"><h3>${esc(d.name)}<span class="tag ok">متاح</span></h3>
      <div class="price">${d.type.toUpperCase()} • ${rateFor(S.settings, d.type, 'single')} / ${rateFor(S.settings, d.type, 'multi')} ج/س</div>
      <button class="btn r big w100" data-act="openStart" data-id="${d.id}">▶ بدء جلسة</button></div>`;

  const paused = s.status === 'paused';
  const segs = s.segs?.length
    ? `<div class="segs">${segments(s, S.settings, now)
        .slice(0, -1)
        .map((g) => `${MODE[g.mode]} ${dur(g.ms)}${ui.showCost[s.id] ? ' = ' + fmt(g.c) + ' ج' : ''}`)
        .join(' • ')}</div>`
    : '';
  const drinksCount = sum(s.items || [], (i) => i.q);
  return `<div class="dev ${paused ? 'paused' : 'busy'}" data-sid="${s.id}">
    <h3>${esc(d.name)}<span class="tag ${paused ? 'warn' : 'red'}">${paused ? 'متوقف مؤقتاً' : 'مشغول'}</span></h3>
    <div class="meta">${MODE[s.mode]} • ${s.rate} ج/س ${s.customer ? '• ' + esc(s.customer) : ''}<br>بدأت ${fmtTime(s.start)}</div>${segs}
    <div class="t" data-live="dur">${dur(elapsed(s, now))}</div>
    <div class="left" data-live="left">${leftHtml(s, now)}</div>
    <button class="cst" data-act="toggleCost" data-id="${s.id}" data-live="cost">${costHtml(S, s, now)}</button>
    <div class="acts">
      ${paused ? `<button class="btn" data-act="resume" data-id="${s.id}">▶ استكمال</button>` : `<button class="btn" data-act="pause" data-id="${s.id}">⏸ إيقاف</button>`}
      <button class="btn" data-act="askSwitch" data-id="${s.id}">⇄ ${s.mode === 'single' ? 'Multi' : 'Single'}</button>
      <button class="btn" data-act="openDrinks" data-id="${s.id}">🥤 مشروبات${drinksCount ? ` (${drinksCount})` : ''}</button>
      <button class="btn" data-act="liveInvoice" data-id="${s.id}">🧾 الحساب</button>
      <button class="btn g" data-act="editSession" data-id="${s.id}">✎ تعديل</button>
      <button class="btn r" data-act="askEnd" data-id="${s.id}">■ إنهاء</button>
    </div></div>`;
}

/* ---------- quick drinks sale + expenses ---------- */
function extrasHtml(S, sales, exps) {
  const cart = Object.entries(ui.cart)
    .map(([id, q]) => ({ d: findProduct(S, id), q }))
    .filter((x) => x.d && x.q > 0);
  const cartTotal = sum(cart, (x) => x.d.price * x.q);
  const X = ui.expDraft;

  const cartHtml = cart.length
    ? `<div class="cart">${cart
        .map((x) => `<div class="line"><span>${esc(x.d.name)} × ${x.q}</span><span>${fmt(x.d.price * x.q)} ج <button class="btn sm" data-act="cartAdd" data-id="${x.d.id}" data-delta="-1">−</button></span></div>`)
        .join('')}
        <div class="row center"><b class="red">الإجمالي ${fmt(cartTotal)} ج</b>
          ${['cash', 'insta'].map((p) => `<button class="btn sm ${ui.cartPay === p ? 'r' : ''}" data-act="cartPay" data-p="${p}">${PAY[p]}</button>`).join('')}</div>
        <div class="row"><button class="btn r grow" data-act="sellCart">✔ تسجيل البيع</button><button class="btn g" data-act="clearCart">مسح</button></div></div>`
    : '';

  const salesHtml = sales.length
    ? `<div class="sm mt"><span class="mut">مبيعات الفترة: ${fmt(sum(sales, (x) => x.amt))} ج</span>${[...sales]
        .reverse()
        .slice(0, 6)
        .map((x) => `<div class="line"><span>${x.items.map((i) => esc(i.n) + '×' + i.q).join('، ')} • ${PAY[x.pay]}</span><span>${fmt(x.amt)} ج <button class="btn sm g" data-act="deleteSale" data-id="${x.id}">حذف</button></span></div>`)
        .join('')}</div>`
    : '';

  return `<div class="grid two-col mt">
    <div class="box"><b>🥤 بيع مشروبات (بدون لعب)</b>
      <div class="ch">${S.drinks
        .map((d) => `<button class="btn" data-act="cartAdd" data-id="${d.id}" data-delta="1">${esc(d.name)} <small class="mut">${fmt(d.price)}</small>${d.track ? `<small class="${isLow(d) ? 'red' : 'mut'}"> (${d.qty})</small>` : ''}</button>`)
        .join('') || '<span class="mut">أضف مشروبات من المخزون</span>'}</div>
      ${cartHtml}${salesHtml}</div>
    <div class="box"><b>💸 المصروفات</b> <span class="mut sm">إجمالي الفترة: ${fmt(sum(exps, (e) => e.amt))} ج</span>
      <div class="row end">
        <select data-change="expCat">${options(EXPENSE_CATS.map((c) => [c, c]), X.c)}</select>
        <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="المبلغ" class="w90" value="${esc(X.a)}" data-input="expAmt">
        <input placeholder="ملاحظة" class="grow" value="${esc(X.n)}" data-input="expNote">
        <button class="btn r" data-act="addExpenseHome">إضافة</button></div>
      ${exps.length
        ? `<div class="sm mt">${[...exps]
            .reverse()
            .map((e) => `<div class="line"><span>${esc(e.cat)}${e.note ? ' – ' + esc(e.note) : ''}</span><span>${fmt(e.amt)} ج <button class="btn sm g" data-act="deleteExpense" data-id="${e.id}">حذف</button></span></div>`)
            .join('')}</div>`
        : '<p class="mut sm">لا توجد مصروفات في الفترة الحالية</p>'}
    </div></div>`;
}

export function render() {
  const S = ctx.S;
  const now = Date.now();
  const { p, sales, exps } = periodData(S, now);
  const run = runningSessions(S);
  return `${lowStockBanner(S)}${bookingBanner(S)}
    <div class="mut xs">الحساب منذ: ${fmtTime(p)}${S.closes.length ? ' (آخر تقفيل)' : ' (بداية اليوم)'}</div>
    <div class="grid" id="home-stats">${statsHtml(S, now)}</div>
    <h2>الأجهزة</h2>
    <div class="grid cards">${S.devices.map((d) => deviceCard(S, d, run, now)).join('')}</div>
    ${extrasHtml(S, sales, exps)}`;
}

/** Called every second: patch only the changing text instead of rebuilding the page. */
export function live() {
  const S = ctx.S;
  const now = Date.now();
  const st = $('#home-stats');
  if (st) st.innerHTML = statsHtml(S, now);
  for (const card of $$('[data-sid]')) {
    const s = findSession(S, +card.dataset.sid);
    if (!s || s.end) continue;
    card.querySelector('[data-live=dur]').textContent = dur(elapsed(s, now));
    card.querySelector('[data-live=left]').innerHTML = leftHtml(s, now);
    card.querySelector('[data-live=cost]').innerHTML = costHtml(S, s, now);
  }
}

export const actions = {
  toggleHidden(d) {
    ui.hidden[d.k] = !ui.hidden[d.k];
    live();
  },
  toggleCost(d) {
    ui.showCost[d.id] = !ui.showCost[d.id];
    ctx.render();
  },
  cartAdd(d) {
    const k = findProduct(ctx.S, d.id);
    const delta = +d.delta;
    const next = (ui.cart[d.id] || 0) + delta;
    if (delta > 0 && k?.track && next > k.qty) return toast('الكمية المتاحة ' + k.qty);
    ui.cart[d.id] = Math.max(0, next);
    ctx.render();
  },
  cartPay(d) {
    ui.cartPay = d.p;
    ctx.render();
  },
  clearCart() {
    ui.cart = {};
    ctx.render();
  },
  sellCart() {
    const r = ctx.svc.sales.sell(ui.cart, ui.cartPay);
    if (!r.ok) return toast(r.error);
    ui.cart = {};
    toast('تم تسجيل البيع');
    ctx.render();
  },
  deleteSale(d) {
    ctx.svc.sales.remove(+d.id);
    ctx.render();
  },
  expCat: (d, el) => (ui.expDraft.c = el.value),
  expAmt: (d, el) => (ui.expDraft.a = el.value),
  expNote: (d, el) => (ui.expDraft.n = el.value),
  addExpenseHome() {
    const X = ui.expDraft;
    const r = ctx.svc.expenses.add({ cat: X.c, amount: X.a, note: X.n });
    if (!r.ok) return toast(r.error);
    X.a = X.n = '';
    ctx.render();
  },
  deleteExpense(d) {
    ctx.svc.expenses.remove(+d.id);
    ctx.render();
  },
};
