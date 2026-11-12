// Presentation: reusable HTML building blocks.
import { esc, fmt, dur, fmtTime } from '../core/utils.js';
import { MODE, PAY } from '../core/labels.js';
import { segments, elapsed, sessionTotal, ceilingDiff } from '../domain/pricing.js';
import { sessionNo } from '../domain/period.js';

export const stat = (label, value, sub = '', extraCls = '') =>
  `<div class="st ${extraCls}"><span>${label}</span><b>${value}</b><span>${sub}</span></div>`;

/** Stat that can be hidden (for revenue / profit shown to customers' eyes). */
export const secretStat = (key, hidden, label, value, sub = '') =>
  `<button class="st st-btn" data-act="toggleHidden" data-k="${key}">
    <span>${label} ${hidden ? '🔒' : '👁'}</span><b>${hidden ? '••••' : value}</b>
    <span>${hidden ? 'اضغط للإظهار' : sub || 'اضغط للإخفاء'}</span></button>`;

export function bars(obj, unit = 'ج') {
  const max = Math.max(1, ...Object.values(obj));
  return Object.entries(obj)
    .map(([k, v]) => `<div class="bar"><em>${esc(k)}</em><i style="width:${(v / max) * 55}%"></i><span>${fmt(v)} ${unit}</span></div>`)
    .join('');
}

/**
 * Table that turns into labelled cards on phones (each td gets data-l = its header).
 * @param {string[]} head  @param {string[][]} rows
 */
export function table(head, rows, empty = 'لا توجد بيانات', { responsive = true } = {}) {
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((c, i) => `<td data-l="${esc(head[i] || '')}">${c}</td>`).join('')}</tr>`).join('')
    : `<tr class="empty"><td colspan="${head.length}">${empty}</td></tr>`;
  return `<div class="sc"><table class="${responsive ? 'rt' : ''}"><thead><tr>${head
    .map((h) => `<th>${h}</th>`)
    .join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export const btn = (label, act, data = {}, cls = '') =>
  `<button class="btn ${cls}" data-act="${act}"${Object.entries(data)
    .map(([k, v]) => ` data-${k}="${esc(v)}"`)
    .join('')}>${label}</button>`;

export const options = (pairs, selected) =>
  pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(l)}</option>`).join('');

/* ---------- invoice ---------- */
export function invoiceHtml(S, s, now = Date.now()) {
  const st = S.settings;
  const total = s.end ? s.amount : sessionTotal(s, st, now);
  const diff = ceilingDiff(s, st, now);
  const row = (a, b) => `<div><span>${a}</span><span>${b}</span></div>`;
  const brow = (a, b) => `<div><span>${a}</span><b>${b}</b></div>`;
  return `<div class="inv">
    ${row(`${esc(st.shop)} ${esc(st.phone)}`, esc(st.addr))}
    ${row('الجهاز', `${esc(s.dn)} (${s.dt.toUpperCase()})`)}
    ${segments(s, st, now).map((g) => brow(`${MODE[g.mode]} – ${dur(g.ms)} (${g.rate} ج/س)`, fmt(g.c) + ' ج')).join('')}
    ${(s.items || []).map((i) => brow(`🥤 ${esc(i.n)} × ${i.q}`, fmt(i.p * i.q) + ' ج')).join('')}
    ${s.customer ? row('العميل', esc(s.customer)) : ''}
    ${row('البداية', fmtTime(s.start))}${row('النهاية', fmtTime(s.end))}${row('المدة', dur(elapsed(s, now)))}
    ${s.adj ? row('تعديل', fmt(s.adj) + ' ج') : ''}
    ${diff > 0.004 ? row('تقريب لأعلى جنيه', fmt(diff) + ' ج') : ''}
    <div class="inv-total"><b>الإجمالي</b><b>${fmt(total)} ج</b></div>
    ${s.end ? row('الدفع', PAY[s.pay]) : ''}
  </div>`;
}

/** Plain-text invoice for WhatsApp / share sheet. */
export function invoiceText(S, s, now = Date.now()) {
  const st = S.settings;
  const lines = [
    `${st.shop} 🎮`,
    st.phone && `📞 ${st.phone}`,
    st.addr && `📍 ${st.addr}`,
    '----------------',
    `فاتورة #${sessionNo(s)} – ${s.dn}`,
    ...segments(s, st, now).map((g) => `${MODE[g.mode]} ${dur(g.ms)} = ${fmt(g.c)} ج`),
    ...(s.items || []).map((i) => `${i.n} × ${i.q} = ${fmt(i.p * i.q)} ج`),
    s.adj ? `تعديل: ${fmt(s.adj)} ج` : '',
    '----------------',
    `الإجمالي: ${fmt(s.end ? s.amount : sessionTotal(s, st, now))} ج`,
    s.end ? `الدفع: ${PAY[s.pay]}` : '',
    fmtTime(s.start) + ' → ' + fmtTime(s.end),
  ];
  return lines.filter(Boolean).join('\n');
}
