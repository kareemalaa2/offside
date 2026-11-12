// Presentation: shared context (store, services, transient UI state).
// Filled once in main.js; views read from it at call time.

export const ui = {
  view: 'home',
  hidden: { rev: true, net: true },
  showCost: {},
  unlockedAt: 0,
  pendingAuth: null,
  liveInvoiceId: null,
  modalOpen: false,
  logFilter: { d: '', dev: '', q: '', pay: '' },
  reportRange: 'p',
  bookFilter: 'wait',
  custQuery: '',
  cart: {},
  cartPay: 'cash',
  expDraft: { c: 'كهرباء', a: '', n: '' },
  closeDraft: { a: null, n: '' },
  installPrompt: null,
  /** 'owner' | 'staff' | 'viewer' (from the staff list in Firestore) */
  role: 'owner',
};

export const ctx = {
  /** @type {import('../application/store.js').Store} */
  store: null,
  /** @type {ReturnType<import('../application/services/index.js').createServices>} */
  svc: null,
  ui,
  render: () => {},
  get S() {
    return this.store.state;
  },
};

export const UNLOCK_MS = 5 * 60 * 1000;
export const isUnlocked = () => Date.now() - ui.unlockedAt < UNLOCK_MS;
