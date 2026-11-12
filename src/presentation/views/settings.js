// Presentation: settings (shop, prices, rules, devices, password, backup, install).
import { esc, num } from '../../core/utils.js';
import { MODE, ROUND_OPTIONS, DEVICE_TYPES } from '../../core/labels.js';
import { ctx, ui } from '../context.js';
import { $, toast, saveFile, copyText } from '../ui.js';
import { options } from '../components.js';
import { notificationsSupported, notificationsOn, enableNotifications } from '../alerts.js';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

function installBox() {
  if (isStandalone()) return '';
  const how = isIOS()
    ? 'افتح الصفحة من Safari ← زر المشاركة <b>⬆</b> ← <b>إضافة إلى الشاشة الرئيسية</b>.'
    : 'من قائمة Chrome <b>⋮</b> ← <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.';
  return `<div class="box"><b>📲 تثبيت التطبيق على الموبايل</b><p class="sm">${how} بعد التثبيت بيشتغل من غير إنترنت.</p>
    ${ui.installPrompt ? '<button class="btn r" data-act="installApp">تثبيت الآن</button>' : ''}</div>`;
}

function notifyBox() {
  const st = ctx.S.settings;
  const status = !notificationsSupported()
    ? '<span class="mut">الجهاز ده مش بيدعم الإشعارات (على الآيفون لازم التطبيق يكون مضاف للشاشة الرئيسية)</span>'
    : notificationsOn()
      ? '<b class="ok">✔ الإشعارات مفعّلة على الجهاز ده</b>'
      : Notification.permission === 'denied'
        ? '<span class="red">الإشعارات مقفولة من إعدادات المتصفح/الموبايل – افتحها من هناك</span>'
        : '<button class="btn r" data-act="enableNotifications">🔔 تفعيل الإشعارات</button>';
  return `<div class="box"><b>🔔 تنبيه انتهاء الأجهزة</b>
    <p class="sm">قبل انتهاء أي جلسة بوقت محدد بـ <b>${+st.alert || 0} دقيقة</b> (من "قواعد الحساب" تحت) بيظهر تنبيه كبير على الشاشة مع صوت، وتاني لما الوقت يخلص. بيظهر على كل جهاز فاتح التطبيق، وكمان أول ما حد يفتح السيستم.</p>
    <p class="sm mut">وكمان بيوصل إشعار على الموبايل حتى لو التطبيق مقفول خالص (لازم تفعّله مرة على كل جهاز).</p>
    ${status}</div>`;
}

export function render() {
  const S = ctx.S;
  const st = S.settings;
  return `${installBox()}${notifyBox()}
  <div class="box"><b>☁ الحساب والمزامنة</b>
    <p class="sm">داخل بـ <b dir="ltr">${esc(ctx.cloud?.email || '')}</b> • كل التعديلات بتتزامن لحظياً مع باقي الأجهزة، ولو النت قطع بتتحفظ وتترفع لما يرجع.</p>
    <button class="btn g" data-act="logout">🚪 تسجيل الخروج</button></div>
  <div class="box"><b>بيانات المحل</b><div class="two">
    <div><label>الاسم</label><input class="w100" value="${esc(st.shop)}" data-change="setSetting" data-k="shop"></div>
    <div><label>الهاتف</label><input class="w100" type="tel" value="${esc(st.phone)}" data-change="setSetting" data-k="phone"></div></div>
    <label>العنوان</label><input class="w100" value="${esc(st.addr)}" data-change="setSetting" data-k="addr"></div>

  <div class="box"><b>الأسعار (جنيه / ساعة) – تسري على الجلسات الجديدة</b><div class="grid">
    ${DEVICE_TYPES.flatMap((t) => ['single', 'multi'].map((m) => `<div><label>${t.toUpperCase()} – ${MODE[m]}</label><input type="number" inputmode="decimal" min="0" class="w100" value="${st.prices[t][m]}" data-change="setPrice" data-t="${t}" data-m="${m}"></div>`)).join('')}
  </div></div>

  <div class="box"><b>قواعد الحساب</b><div class="two">
    <div><label>تقريب الوقت</label><select class="w100" data-change="setSetting" data-k="round">${options(ROUND_OPTIONS, st.round)}</select></div>
    <div><label>تقريب المبلغ لأعلى جنيه</label><select class="w100" data-change="setCeil">${options([['1', 'مفعّل'], ['0', 'متوقف']], st.ceil === false ? '0' : '1')}</select></div>
    <div><label>حد أدنى للمحاسبة (دقائق)</label><input type="number" inputmode="numeric" min="0" class="w100" value="${st.minMin}" data-change="setSettingNum" data-k="minMin"></div>
    <div><label>تنبيه قبل انتهاء الجلسة (دقائق)</label><input type="number" inputmode="numeric" min="0" class="w100" value="${st.alert}" data-change="setSettingNum" data-k="alert"></div>
  </div></div>

  <div class="box"><b>الأجهزة</b>
    ${S.devices.map((d) => `<div class="row center">
      <input class="grow" value="${esc(d.name)}" data-change="setDevice" data-id="${d.id}" data-k="name">
      <select data-change="setDevice" data-id="${d.id}" data-k="type">${options(DEVICE_TYPES.map((t) => [t, t.toUpperCase()]), d.type)}</select>
      <label class="check"><input type="checkbox" ${d.active ? 'checked' : ''} data-change="setDevice" data-id="${d.id}" data-k="active"> مفعّل</label></div>`).join('')}
    <div class="row"><button class="btn r" data-act="addDevice">+ إضافة جهاز</button></div></div>

  <div class="box"><b>🔒 تغيير الباسورد</b><p class="sm mut">بيحمي: الحسابات، الإعدادات، المخزون، التقارير، التقفيل، وتعديل الجلسات في السجل.</p>
    <div class="two"><div><label>الباسورد الحالي</label><input id="pw0" type="password" inputmode="numeric" class="w100"></div>
    <div><label>الباسورد الجديد</label><input id="pw1" type="password" inputmode="numeric" class="w100"></div></div>
    <label>تأكيد الباسورد الجديد</label><input id="pw2" type="password" inputmode="numeric" class="w100">
    <div class="row"><button class="btn r" data-act="changePassword">تغيير</button></div></div>

  <div class="box"><b>💾 نسخ احتياطي</b>
    <p class="mut sm">البيانات محفوظة على السحابة ومتزامنة بين الأجهزة. النسخة الاحتياطية للأمان الزيادة، أو لنقل بيانات النسخة القديمة (الاستيراد بيرفعها على السحابة لكل الأجهزة).</p>
    <div class="row"><button class="btn r" data-act="exportFile">📤 حفظ / مشاركة ملف النسخة</button>
      <label class="btn">📥 استيراد من ملف<input type="file" accept=".json,application/json,text/plain" hidden data-change="importFile"></label></div>
    <details><summary class="mut sm">نسخ / لصق كنص</summary>
      <textarea id="bk" rows="4" class="w100"></textarea>
      <div class="row"><button class="btn" data-act="copyBackup">نسخ</button><button class="btn g" data-act="importText">استيراد النص</button></div></details>
  </div>`;
}

function importData(text) {
  const r = ctx.svc.backup.importJson(text);
  toast(r.ok ? 'تم الاستيراد' : r.error);
  if (r.ok) ctx.render();
}

export const actions = {
  async enableNotifications() {
    const r = await enableNotifications();
    toast(r === 'granted' ? 'تم تفعيل الإشعارات' : 'الإشعارات مش مفعّلة');
    ctx.render();
  },
  logout() {
    ctx.cloud?.signOut();
  },
  setSetting(d, el) {
    ctx.svc.settings.set(d.k, el.value);
    if (d.k === 'shop') ctx.render();
  },
  setSettingNum: (d, el) => ctx.svc.settings.set(d.k, num(el.value)),
  setCeil: (d, el) => ctx.svc.settings.set('ceil', el.value === '1'),
  setPrice: (d, el) => ctx.svc.settings.setPrice(d.t, d.m, el.value),
  setDevice: (d, el) => ctx.svc.settings.setDevice(d.id, d.k, el.type === 'checkbox' ? el.checked : el.value),
  addDevice() {
    ctx.svc.settings.addDevice();
    ctx.render();
  },
  changePassword() {
    const r = ctx.svc.auth.change($('#pw0').value, $('#pw1').value, $('#pw2').value);
    if (!r.ok) return toast(r.error);
    ['pw0', 'pw1', 'pw2'].forEach((i) => ($('#' + i).value = ''));
    toast('تم تغيير الباسورد');
  },
  exportFile: () => saveFile(ctx.svc.backup.fileName(), ctx.svc.backup.exportJson()),
  async importFile(d, el) {
    const f = el.files?.[0];
    if (f) importData(await f.text());
    el.value = '';
  },
  copyBackup() {
    const t = ctx.svc.backup.exportJson();
    $('#bk').value = t;
    copyText(t);
  },
  importText: () => importData($('#bk').value),
  async installApp() {
    const p = ui.installPrompt;
    if (!p) return;
    p.prompt();
    await p.userChoice;
    ui.installPrompt = null;
    ctx.render();
  },
};
