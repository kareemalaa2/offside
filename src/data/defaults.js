// Data: initial state. Schema is identical to the desktop offside.html so
// backups move freely between desktop and phone.

export const STORAGE_KEY = 'offside_v1';

export const defaultDrinks = () =>
  [['شاي', 10], ['قهوة', 15], ['نسكافيه', 15], ['بيبسي', 15], ['مياه', 5], ['عصير', 20]].map(
    ([name, price], i) => ({ id: 'k' + (i + 1), name, price, cost: 0, qty: 0, min: 3, track: false }),
  );

export const defaultSettings = () => ({
  shop: 'OFFSIDE',
  phone: '',
  addr: '',
  prices: { ps5: { single: 50, multi: 70 }, ps4: { single: 30, multi: 50 } },
  round: 'min',
  minMin: 0,
  alert: 5,
});

export const createDefaultState = () => ({
  seq: 1,
  settings: defaultSettings(),
  devices: [
    ['PS5 - جهاز 1', 'ps5'],
    ['PS5 - جهاز 2', 'ps5'],
    ...[1, 2, 3, 4, 5].map((i) => ['PS4 - جهاز ' + i, 'ps4']),
  ].map(([name, type], i) => ({ id: 'd' + (i + 1), name, type, active: true })),
  sessions: [],
  expenses: [],
});
