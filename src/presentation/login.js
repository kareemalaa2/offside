// Presentation: staff login screen (Firebase email + password).
import { $ } from './ui.js';

const ERRORS = {
  'auth/invalid-credential': 'الإيميل أو الباسورد غلط',
  'auth/wrong-password': 'الإيميل أو الباسورد غلط',
  'auth/user-not-found': 'الإيميل أو الباسورد غلط',
  'auth/invalid-email': 'الإيميل مكتوب غلط',
  'auth/too-many-requests': 'محاولات كتير – استنى شوية وجرب تاني',
  'auth/network-request-failed': 'مفيش إنترنت – أول دخول محتاج إنترنت',
};

export function showLogin(cloud) {
  const el = $('#login');
  el.innerHTML = `<form class="login-box" autocomplete="on">
      <div class="logo big">OFFSIDE<small>PlayStation • تسجيل الدخول</small></div>
      <label>الإيميل</label><input id="le" type="email" inputmode="email" autocomplete="username" required class="w100">
      <label>الباسورد</label><input id="lp" type="password" autocomplete="current-password" required class="w100">
      <p id="lerr" class="red sm"></p>
      <button class="btn r big w100" type="submit">دخول</button>
      <button class="btn g w100 mt" type="button" id="lforgot">نسيت الباسورد؟</button>
      <p class="mut xs">الحسابات بيعملها صاحب المحل من لوحة Firebase. البيانات بتتزامن بين كل الأجهزة.</p>
    </form>`;
  el.classList.add('on');
  const err = (t) => ($('#lerr').textContent = t);

  el.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    err('');
    const btn = el.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = '...';
    try {
      await cloud.signIn($('#le').value, $('#lp').value);
    } catch (x) {
      err(ERRORS[x.code] || 'تعذر الدخول: ' + (x.code || x.message));
      btn.disabled = false;
      btn.textContent = 'دخول';
    }
  });
  $('#lforgot').addEventListener('click', async () => {
    const email = $('#le').value.trim();
    if (!email) return err('اكتب الإيميل الأول');
    try {
      await cloud.resetPassword(email);
      err('');
      $('#lerr').textContent = 'اتبعت رسالة لتغيير الباسورد على الإيميل';
    } catch (x) {
      err(ERRORS[x.code] || x.code);
    }
  });
  setTimeout(() => $('#le')?.focus(), 50);
}

export function hideLogin() {
  const el = $('#login');
  el.classList.remove('on');
  el.innerHTML = '';
}
