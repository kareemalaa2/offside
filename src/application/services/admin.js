// Application: settings, devices, password, backup.
import { ok, fail, hash, uid, num } from '../../core/utils.js';
import { isValidBackup } from '../../data/migrations.js';

export const settingsService = (store) => ({
  set(key, value) {
    store.commit((S) => {
      S.settings[key] = value;
    });
  },
  setPrice(type, mode, value) {
    store.commit((S) => {
      S.settings.prices[type][mode] = Math.max(0, num(value));
    });
  },
  setDevice(id, key, value) {
    store.commit((S) => {
      const d = S.devices.find((x) => x.id === id);
      if (d) d[key] = value;
    });
  },
  addDevice() {
    store.commit((S) => {
      S.devices.push({ id: 'd' + uid(), name: 'جهاز ' + (S.devices.length + 1), type: 'ps4', active: true });
    });
  },
});

export const authService = (store) => ({
  verify: (pw) => hash(pw) === store.state.pw,
  change(current, next, confirm) {
    if (hash(current) !== store.state.pw) return fail('الباسورد الحالي غلط');
    if ((next || '').length < 4) return fail('الباسورد لازم 4 خانات على الأقل');
    if (next !== confirm) return fail('التأكيد مش مطابق');
    store.commit((S) => {
      S.pw = hash(next);
    });
    return ok();
  },
});

export const backupService = (store) => ({
  exportJson: () => JSON.stringify(store.state),
  fileName: () => `offside-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`,
  importJson(text) {
    try {
      const d = JSON.parse(text);
      if (!isValidBackup(d)) return fail('بيانات غير صالحة');
      store.replace(d);
      return ok();
    } catch {
      return fail('بيانات غير صالحة');
    }
  },
});
