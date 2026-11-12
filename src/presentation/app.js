// Presentation: router, navigation, event delegation and the 1-second ticker.
import { ctx, ui, isUnlocked } from './context.js';
import { $, toast, beep, openModal, hideModal, setModalBody, unlockAudio } from './ui.js';
import { requireAuth, authActions } from './auth.js';
import { sessionActions, openStart, liveInvoiceBody } from './views/sessionDialogs.js';
import * as home from './views/home.js';
import * as log from './views/log.js';
import * as accounts from './views/accounts.js';
import * as settings from './views/settings.js';
import * as inventory from './views/inventory.js';
import * as reports from './views/reports.js';
import * as closing from './views/closing.js';
import * as bookings from './views/bookings.js';
import * as customers from './views/customers.js';

const VIEWS = { home, log, acc: accounts, set: settings, inv: inventory, rep: reports, clos: closing, book: bookings, cust: customers };

const MAIN_TABS = [
  ['home', '🎮', 'الرئيسية'],
  ['log', '📋', 'السجل'],
  ['book', '📅', 'الحجوزات'],
  ['cust', '👥', 'العملاء'],
];
const ADMIN_TABS = [
  ['acc', '💰', 'الحسابات'],
  ['rep', '📊', 'التقارير'],
  ['clos', '💼', 'الخزنة والتقفيل'],
  ['inv', '📦', 'المخزون'],
  ['set', '⚙️', 'الإعدادات'],
];
const PROTECTED = new Set(ADMIN_TABS.map((t) => t[0]));

/* ---------- rendering ---------- */
function navHtml() {
  const tab = ([k, icon, label]) =>
    `<button class="${ui.view === k ? 'on' : ''}" data-act="go" data-v="${k}"><i>${icon}</i><span>${label}</span></button>`;
  const inAdmin = PROTECTED.has(ui.view);
  return MAIN_TABS.map(tab).join('') +
    `<button class="${inAdmin ? 'on' : ''}" data-act="adminMenu"><i>🛠</i><span>الإدارة${isUnlocked() ? '' : ' 🔒'}</span></button>`;
}

export function render() {
  $('#sh').textContent = ctx.S.settings.shop + ' • PlayStation';
  $('#nav').innerHTML = navHtml();
  $('#main').innerHTML = VIEWS[ui.view].render();
  const title = [...MAIN_TABS, ...ADMIN_TABS].find((t) => t[0] === ui.view);
  $('#vt').textContent = title ? title[2] : '';
}

function go(view) {
  const show = () => {
    ui.view = view;
    render();
    window.scrollTo(0, 0);
  };
  if (PROTECTED.has(view)) return requireAuth(show);
  show();
}

/* ---------- actions registry ---------- */
const ACTIONS = {
  ...sessionActions,
  ...authActions,
  ...home.actions,
  ...log.actions,
  ...accounts.actions,
  ...settings.actions,
  ...inventory.actions,
  ...reports.actions,
  ...closing.actions,
  ...bookings.actions,
  ...customers.actions,
  openStart: (d) => openStart(d.id),
  go(d) {
    hideModal();
    go(d.v);
  },
  adminMenu() {
    openModal(`<h3>🛠 الإدارة</h3><div class="menu">
      ${ADMIN_TABS.map(([k, icon, label]) => `<button class="btn ${ui.view === k ? 'r' : ''}" data-act="go" data-v="${k}">${icon} ${label}${isUnlocked() ? '' : ' 🔒'}</button>`).join('')}
      ${isUnlocked() ? '<button class="btn g" data-act="lock">🔒 قفل الإدارة</button>' : ''}
      </div><div class="row"><button class="btn g grow" data-act="closeModal">إغلاق</button></div>`);
  },
};

function dispatch(name, el, e) {
  const fn = ACTIONS[name];
  if (!fn) return console.warn('Unknown action', name);
  try {
    fn({ ...el.dataset }, el, e);
  } catch (err) {
    console.error(err);
    toast('حصل خطأ غير متوقع');
  }
}

function bindEvents() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (el) dispatch(el.dataset.act, el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el) dispatch(el.dataset.change, el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-input]');
    if (el) dispatch(el.dataset.input, el, e);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const el = e.target.closest('[data-enter]');
      if (el) dispatch(el.dataset.enter, el, e);
    }
    if (e.key === 'Escape' && ui.modalOpen) ACTIONS.closeModal();
  });
  // tap on the dark backdrop closes the sheet
  $('#m').addEventListener('click', (e) => {
    if (e.target.id === 'm') ACTIONS.closeModal();
  });
  // iOS needs a user gesture before sound can play
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  // coming back to the app: refresh everything (timers kept running via timestamps)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !ui.modalOpen) render();
  });
}

/* ---------- 1s ticker: cheap partial updates only ---------- */
function tick() {
  const now = Date.now();
  $('#clk').textContent = new Date(now).toLocaleTimeString('en-GB');

  for (const { s, kind } of ctx.svc.sessions.collectAlerts(now)) {
    beep();
    toast((kind === 'over' ? 'انتهى وقت ' : 'اقترب انتهاء ') + s.dn);
  }

  if (ui.liveInvoiceId && ui.modalOpen) {
    const s = ctx.S.sessions.find((x) => x.id === ui.liveInvoiceId);
    if (s && !s.end) setModalBody(liveInvoiceBody(ui.liveInvoiceId));
    else ui.liveInvoiceId = null;
  }

  if (ui.remoteDirty && safeToRender()) {
    ui.remoteDirty = false;
    render();
  } else if (ui.view === 'home' && !ui.modalOpen) home.live();
}

/* ---------- changes coming from other devices ---------- */
const safeToRender = () =>
  !ui.modalOpen && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '');

export function applyRemote(remote) {
  ctx.store.replace(remote);
  if (safeToRender()) render();
  else ui.remoteDirty = true; // don't wipe what the user is typing; refresh right after
}

export function startApp() {
  ctx.render = render;
  bindEvents();
  render();
  tick();
  setInterval(tick, 1000);
}
