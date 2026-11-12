// Core: pure, framework-free helpers shared by every layer.

export const round2 = (n) => Math.round(n * 100) / 100;
export const sum = (arr, pick) => arr.reduce((acc, x) => acc + (+pick(x) || 0), 0);
export const fmt = (n) => round2(n).toLocaleString('en-US');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const pad = (x) => String(x).padStart(2, '0');

/** ms -> "HH:MM:SS" */
export const dur = (ms) => {
  const s = Math.floor(ms / 1000);
  return [(s / 3600) | 0, ((s % 3600) / 60) | 0, s % 60].map(pad).join(':');
};

/** timestamp -> "YYYY-MM-DD" (local) */
export const dayKey = (t) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const fmtTime = (t) =>
  t ? new Date(t).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** timestamp -> value for <input type="datetime-local"> */
export const toLocalInput = (ts) =>
  new Date(ts - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);

export const startOfToday = () => new Date().setHours(0, 0, 0, 0);

/** Same djb2-xor hash as the desktop version, so existing passwords keep working. */
export const hash = (t) => {
  let h = 5381;
  for (const c of String(t)) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return '' + h;
};

export const norm = (t) => String(t || '').trim().toLowerCase();

/** Arabic-Indic digits -> Latin, strip spaces. */
export const digits = (t) =>
  String(t || '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/\s+/g, '');

export const PHONE_RE = /^\+?\d{7,15}$/;

/** Monotonic numeric id (Date.now based, never repeats within a session). */
let lastId = 0;
export const uid = () => {
  const n = Date.now();
  lastId = n > lastId ? n : lastId + 1;
  return lastId;
};

export const num = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/** Result helpers used by application services. */
export const ok = (value) => ({ ok: true, value });
export const fail = (error) => ({ ok: false, error });
