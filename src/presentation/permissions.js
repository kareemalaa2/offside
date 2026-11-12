// Presentation: role-based UI permissions.
// A "viewer" can open every screen but cannot change anything.
// (The real protection is in the Firestore rules; this only keeps the UI honest.)
import { ui } from './context.js';

export const isViewer = () => ui.role === 'viewer';

/** Actions that only look at data (navigation, filters, show/hide, invoices). */
const VIEW_ONLY = new Set([
  'closeModal', 'go', 'adminMenu', 'lock', 'checkPassword', 'logout', 'installApp',
  'toggleHidden', 'toggleCost', 'logFilter', 'clearLogFilter', 'reportRange',
  'bookingFilter', 'custSearch', 'showSummary', 'liveInvoice', 'shareInvoice', 'printInvoice',
  'dismissAlert', 'dismissAllAlerts', 'enableNotifications',
]);

export const isAllowed = (action) => !isViewer() || VIEW_ONLY.has(action);

/** Hide edit buttons and lock edit fields inside `root` when the user is a viewer. */
export function applyReadOnly(root = document) {
  if (!isViewer()) return;
  for (const el of root.querySelectorAll('[data-act],[data-change],[data-input],[data-enter]')) {
    const act = el.dataset.act || el.dataset.change || el.dataset.input || el.dataset.enter;
    if (VIEW_ONLY.has(act)) continue;
    if (/INPUT|SELECT|TEXTAREA/.test(el.tagName) && el.type !== 'file') el.disabled = true;
    else (el.closest('label.btn') || el).classList.add('ro-hide');
  }
  // inputs without actions (forms like "new expense") are useless for viewers
  for (const el of root.querySelectorAll('#main input:not([data-change]):not([data-input]), #main select:not([data-change]), #main textarea'))
    el.disabled = true;
}
