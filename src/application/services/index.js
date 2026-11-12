// Application: composition root for all use-cases (dependency injection of the store).
import { sessionService } from './sessions.js';
import { salesService, expenseService, inventoryService } from './commerce.js';
import { cashService } from './cashbox.js';
import { customerService, bookingService } from './people.js';
import { settingsService, authService, backupService } from './admin.js';

export const createServices = (store) => ({
  sessions: sessionService(store),
  sales: salesService(store),
  expenses: expenseService(store),
  inventory: inventoryService(store),
  cash: cashService(store),
  customers: customerService(store),
  bookings: bookingService(store),
  settings: settingsService(store),
  auth: authService(store),
  backup: backupService(store),
});
