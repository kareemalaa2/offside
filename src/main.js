// Composition root: wire data -> application -> presentation.
import { LocalStorageRepository, requestPersistentStorage } from './data/storage.js';
import { CloudRepository } from './data/cloudRepository.js';
import { SyncedRepository } from './data/syncedRepository.js';
import { firebaseConfig, SHOP_ID } from './data/firebaseConfig.js';
import { Store } from './application/store.js';
import { createServices } from './application/services/index.js';
import { ctx, ui } from './presentation/context.js';
import { toast, $ } from './presentation/ui.js';
import { startApp, render, applyRemote } from './presentation/app.js';
import { showLogin, hideLogin } from './presentation/login.js';
import { registerForPush } from './presentation/alerts.js';

const local = new LocalStorageRepository();
const cloud = new CloudRepository(firebaseConfig, SHOP_ID);
const store = new Store(new SyncedRepository(local, cloud));
store.onSaveError = () => toast('تعذر الحفظ على الجهاز – اعمل نسخة احتياطية');
cloud.onError = (e) => {
  if (e?.code === 'permission-denied') toast('الحساب ده مش مسموح له يدخل بيانات المحل');
  else toast('مشكلة في المزامنة: ' + (e?.code || e?.message || ''));
};

ctx.store = store;
ctx.svc = createServices(store);
ctx.cloud = cloud;

requestPersistentStorage();

let started = false;
const setSync = ({ offline, pending }) => {
  ui.sync = offline ? 'offline' : pending ? 'pending' : 'ok';
  const el = $('#sync');
  if (!el) return;
  el.textContent = offline ? '⚠ بدون إنترنت' : pending ? '⏳ بيتزامن' : '☁ متزامن';
  el.className = 'sync ' + ui.sync;
};

/** Apply the account's role: viewers get a read-only app (and read-only data layer). */
const ROLE_KEY = 'offside_role';
function setRole(role) {
  ui.role = role;
  const ro = role === 'viewer';
  store.readOnly = ro;
  cloud.readOnly = ro;
  const badge = $('#role');
  if (badge) badge.textContent = ro ? '👁 مشاهدة فقط' : '';
}

cloud.onAuth(async (user) => {
  if (!user) {
    cloud.disconnect();
    showLogin(cloud);
    return;
  }
  // Role comes from the staff list. Offline with no saved role -> safest is view-only.
  let role = await cloud.getRole();
  if (role === undefined) role = localStorage.getItem(ROLE_KEY + ':' + cloud.email) || 'viewer';
  if (role === null) {
    toast('الحساب ده مش متسجل في قائمة الموظفين');
    await cloud.signOut();
    return;
  }
  try {
    localStorage.setItem(ROLE_KEY + ':' + cloud.email, role);
  } catch {
    /* ignore */
  }
  setRole(role);
  hideLogin();
  registerForPush(); // refresh this device's push token (if notifications are allowed)
  if (!started) {
    startApp();
    started = true;
  } else render();

  let first = true;
  cloud.connect((remote) => {
    if (remote === null) {
      if (cloud.readOnly) return; // a viewer never creates the shop data
      // Brand-new cloud: upload what this device already has (e.g. data from the old version).
      cloud.save(store.state);
      toast('تم رفع بيانات الجهاز ده على السحابة');
    } else {
      applyRemote(remote);
      if (first) toast('تم تحميل بيانات المحل ☁');
    }
    first = false;
  }, setSync);
});

// Android/desktop Chrome: keep the install prompt for the "تثبيت الآن" button
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  ui.installPrompt = e;
  if (started && ui.view === 'set') render();
});

// Offline support
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
