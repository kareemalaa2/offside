// Presentation: big "device almost done / time's up" reminder.
//
// - Checked every second on every device that has the app open.
// - Shown again each time the app is opened (nothing is stored in the database),
//   so whoever opens the system sees which devices are about to finish.
// - "soon" (inside the alert window from Settings) and "over" (time's up) are separate:
//   dismissing "soon" still lets "over" pop up later.
// - When the app is in the background, a phone notification is sent (if allowed).
import { esc, dur } from '../core/utils.js';
import { MODE } from '../core/labels.js';
import { sessionNo } from '../domain/period.js';
import { ctx } from './context.js';
import { $, beep } from './ui.js';
import { isViewer } from './permissions.js';

/** sessionId -> highest level the user has dismissed on this device ('soon' | 'over') */
const dismissed = new Map();
/** sessionId -> level already announced (sound / phone notification) */
const announced = new Map();
const RANK = { soon: 1, over: 2 };

let current = [];

export function checkAlerts(now = Date.now()) {
  const due = ctx.svc.sessions.dueAlerts(now);
  const ids = new Set(due.map((a) => a.s.id));

  // forget sessions that ended / were paused / extended
  for (const id of [...dismissed.keys()]) if (!ids.has(id)) dismissed.delete(id);
  for (const id of [...announced.keys()]) if (!ids.has(id)) announced.delete(id);

  current = due.filter((a) => (RANK[dismissed.get(a.s.id)] || 0) < RANK[a.kind]);

  const fresh = current.filter((a) => (RANK[announced.get(a.s.id)] || 0) < RANK[a.kind]);
  for (const a of fresh) announced.set(a.s.id, a.kind);
  if (fresh.length) {
    beep();
    setTimeout(beep, 700);
    if (fresh.some((a) => a.kind === 'over')) setTimeout(beep, 1400);
    if (document.hidden) notifyPhone(fresh);
  }
  render();
}

function title(a) {
  return a.kind === 'over' ? `⏰ انتهى وقت ${a.s.dn}` : `⚠ ${a.s.dn} قرب يخلص`;
}

function cardHtml(a) {
  const s = a.s;
  const over = a.kind === 'over';
  return `<div class="alert-card ${over ? 'over' : 'soon'}">
    <div class="alert-title">${esc(title(a))}</div>
    <div class="alert-time">${over ? '+' + dur(-a.left) : dur(a.left)}</div>
    <div class="alert-sub">${over ? 'متجاوز الوقت المحدد' : 'المتبقي على انتهاء الجلسة'} • جلسة #${sessionNo(s)} • ${MODE[s.mode]}${s.customer ? ' • ' + esc(s.customer) : ''}</div>
    <div class="row">
      <button class="btn big grow" data-act="dismissAlert" data-id="${s.id}" data-k="${a.kind}">✔ تمام، شفته</button>
      ${isViewer() ? '' : `<button class="btn r big" data-act="alertEnd" data-id="${s.id}">■ إنهاء الجلسة</button>`}
    </div></div>`;
}

function render() {
  const box = $('#alert');
  if (!box) return;
  if (!current.length) {
    if (box.classList.contains('on')) {
      box.classList.remove('on');
      box.innerHTML = '';
    }
    return;
  }
  box.innerHTML = `<div class="alert-wrap">
      <div class="alert-head">🔔 تنبيه الأجهزة (${current.length})</div>
      ${current.map(cardHtml).join('')}
      ${current.length > 1 ? '<button class="btn w100" data-act="dismissAllAlerts">إخفاء الكل</button>' : ''}
    </div>`;
  box.classList.add('on');
}

/* ---------- phone notifications (app open in background) ---------- */
export const notificationsSupported = () => 'Notification' in window && 'serviceWorker' in navigator;
export const notificationsOn = () => notificationsSupported() && Notification.permission === 'granted';

export async function enableNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.requestPermission();
}

async function notifyPhone(list) {
  if (!notificationsOn()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    for (const a of list)
      reg.showNotification(title(a), {
        body: a.kind === 'over' ? 'الوقت المحدد خلص – افتح التطبيق' : `المتبقي ${dur(a.left)}`,
        tag: 'offside-' + a.s.id,
        renotify: true,
        requireInteraction: a.kind === 'over',
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        vibrate: [300, 150, 300, 150, 300],
        dir: 'rtl',
        lang: 'ar',
      });
  } catch {
    /* notifications not available */
  }
}

export const alertActions = {
  dismissAlert(d) {
    dismissed.set(+d.id, d.k);
    checkAlerts();
  },
  dismissAllAlerts() {
    for (const a of current) dismissed.set(a.s.id, a.kind);
    checkAlerts();
  },
};
