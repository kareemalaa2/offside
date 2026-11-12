// Composition root: wire data -> application -> presentation.
import { LocalStorageRepository, requestPersistentStorage } from './data/storage.js';
import { Store } from './application/store.js';
import { createServices } from './application/services/index.js';
import { ctx, ui } from './presentation/context.js';
import { toast } from './presentation/ui.js';
import { startApp, render } from './presentation/app.js';

const store = new Store(new LocalStorageRepository());
store.onSaveError = () => toast('تعذر الحفظ على الجهاز – اعمل نسخة احتياطية');

ctx.store = store;
ctx.svc = createServices(store);

requestPersistentStorage();
startApp();

// Android/desktop Chrome: keep the install prompt for the "تثبيت الآن" button
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ui.installPrompt = e;
  if (ui.view === 'set') render();
});

// Offline support
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
