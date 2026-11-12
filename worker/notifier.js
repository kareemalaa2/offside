// OFFSIDE notifier (Cloudflare Worker, free plan, cron "* * * * *").
// Every minute: read running sessions from Firestore, and push
// "device almost done" / "time's up" to every registered phone via Firebase Cloud Messaging.
// Secret needed: SERVICE_ACCOUNT = the Firebase service-account JSON (Worker > Settings > Variables > Secret).
const PROJECT = 'offside-shop';
const SHOP = 'main';
const DB = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
export default {
async scheduled(event, env, ctx) {
ctx.waitUntil(run(env, event.scheduledTime));
},
async fetch(req, env) {
const url = new URL(req.url);
if (url.pathname === '/test') return Response.json(await run(env, Date.now(), true));
return new Response('OFFSIDE notifier is running');
},
};
async function run(env, t, test = false) {
const token = await accessToken(env);
const H = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
const meta = await (await fetch(DB + '/shops/' + SHOP, { headers: H })).json();
const settings = val({ mapValue: meta.fields?.settings?.mapValue || { fields: {} } }) || {};
const alertMs = (+settings.alert || 0) * 60000;
const q = { structuredQuery: { from: [{ collectionId: 'sessions' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'running' } } } } };
const rows = await (await fetch(DB + '/shops/' + SHOP + ':runQuery', { method: 'POST', headers: H, body: JSON.stringify(q) })).json();
const sessions = rows.filter((r) => r.document).map((r) => val({ mapValue: r.document }));
const msgs = [];
for (const s of sessions) {
if (!s.plan || s.end) continue;
const left = s.plan * 60000 - (t - s.start - (s.paused || 0));
const no = s.no ?? s.id;
// only the minute in which a threshold was crossed -> one push per threshold
if (alertMs > 0 && left <= alertMs && left > alertMs - 60000) msgs.push({ kind: 'soon', id: s.id, title: '⚠ ' + s.dn + ' قرب يخلص', body: 'فاضل ' + Math.max(1, Math.ceil(left / 60000)) + ' دقيقة • جلسة #' + no });
if (left <= 0 && left > -60000) msgs.push({ kind: 'over', id: s.id, title: '⏰ انتهى وقت ' + s.dn, body: 'الوقت المحدد خلص • جلسة #' + no });
}
if (test) msgs.push({ kind: 'test', id: 'test', title: '🔔 OFFSIDE تجربة', body: 'الإشعارات شغالة على الجهاز ده ✔' });
if (!msgs.length) return { sessions: sessions.length, sent: 0 };
const list = await (await fetch(DB + '/pushTokens?pageSize=300', { headers: H })).json();
let tokens = (list.documents || []).map((d) => ({ name: d.name, token: d.name.split('/').pop(), ts: +(d.fields?.ts?.integerValue || d.fields?.ts?.doubleValue || 0) }));
// the test only goes to devices registered in the last 15 minutes
if (test) tokens = tokens.filter((x) => Date.now() - x.ts < 15 * 60000);
let sent = 0;
for (const m of msgs) {
for (const tk of tokens) {
if (m.kind !== 'test' && test) continue;
const r = await fetch('https://fcm.googleapis.com/v1/projects/' + PROJECT + '/messages:send', {
method: 'POST', headers: H,
body: JSON.stringify({ message: { token: tk.token, data: { title: m.title, body: m.body, kind: m.kind, tag: 'offside-' + m.id }, webpush: { headers: { Urgency: 'high', TTL: '600' } }, android: { priority: 'HIGH' } } }),
});
if (r.ok) sent++;
else if (r.status === 404 || r.status === 400) await fetch('https://firestore.googleapis.com/v1/' + tk.name, { method: 'DELETE', headers: H }); // phone uninstalled / token expired
}
}
return { sessions: sessions.length, messages: msgs.length, devices: tokens.length, sent };
}
// ---------- Google auth with the service account (RS256 JWT) ----------
let cached = { token: '', exp: 0 };
async function accessToken(env) {
if (cached.token && Date.now() < cached.exp) return cached.token;
const sa = JSON.parse(env.SERVICE_ACCOUNT);
const now = Math.floor(Date.now() / 1000);
const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(head + '.' + claim));
const jwt = head + '.' + claim + '.' + b64url(sig);
const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt });
const j = await r.json();
if (!j.access_token) throw new Error('Google auth failed: ' + JSON.stringify(j));
cached = { token: j.access_token, exp: Date.now() + 50 * 60000 };
return cached.token;
}
function b64url(x) {
const bytes = typeof x === 'string' ? new TextEncoder().encode(x) : new Uint8Array(x);
let s = '';
for (const b of bytes) s += String.fromCharCode(b);
return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
// Firestore REST value -> plain JS
function val(v) {
if (!v) return undefined;
if ('integerValue' in v) return +v.integerValue;
if ('doubleValue' in v) return v.doubleValue;
if ('stringValue' in v) return v.stringValue;
if ('booleanValue' in v) return v.booleanValue;
if ('nullValue' in v) return null;
if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)]));
return undefined;
}
