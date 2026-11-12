// Presentation: password gate for admin screens.
import { ctx, ui, isUnlocked } from './context.js';
import { openModal, hideModal, toast, $ } from './ui.js';

export function requireAuth(cb) {
  if (isUnlocked()) {
    ui.unlockedAt = Date.now();
    return cb();
  }
  ui.pendingAuth = cb;
  openModal(
    `<h3>🔒 أدخل الباسورد</h3>
     <input id="pw" type="password" inputmode="numeric" autocomplete="off" class="w100" data-enter="checkPassword">
     <div class="row"><button class="btn r" data-act="checkPassword">دخول</button><button class="btn g" data-act="closeModal">إلغاء</button></div>`,
    { focus: 'pw' },
  );
}

export const authActions = {
  checkPassword() {
    if (ctx.svc.auth.verify($('#pw').value)) {
      ui.unlockedAt = Date.now();
      const cb = ui.pendingAuth;
      ui.pendingAuth = null;
      hideModal();
      ctx.render();
      cb?.();
    } else {
      toast('الباسورد غلط');
      $('#pw').value = '';
    }
  },
  lock() {
    ui.unlockedAt = 0;
    hideModal();
    ui.view = 'home';
    ctx.render();
  },
};
