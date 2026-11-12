// OFFSIDE notifier (Cloudflare Worker, free plan, cron "* * * * *").
// Every minute: read sessions from Firestore and push via Firebase Cloud Messaging:
//  - owner / staff phones: "device almost done" + "time's up"
//  - viewer phones: only "session ended" with the amount, duration and payment
// Secret needed: SERVICE_ACCOUNT = the Firebase service-account JSON (Worker > Settings > Variables > Secret).
const PROJECT = 'offside-shop';
const SHOP = 'main';
const DB = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents';
const PAY = { cash: 'نقدي', insta: 'InstaPay', unpaid: 'لم يُدفع' };
export default {
async scheduled(event, env, ctx) {
ctx.waitUntil(run(env, Date.now()).then((r) => console.log('run', JSON.stringify(r))).catch((e) => console.error('run failed', e.message)));
},
async fetch(req, env) {
const url = new URL(req.url);
if (url.pathname === '/test') return Response.json(await run(env, Date.now(), true));
if (url.pathname === '/status') return Response.json(await run(env, Date.now(), false, true));
return new Response('OFFSIDE notifier is running');
},
};
async function run(env, t, test = false, dry = false) {
const token = await accessToken(env);
const H = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
const meta = await (await fetch(DB + '/shops/' + SHOP, { headers: H })).json();
const settings = val({ mapValue: meta.fields?.settings?.mapValue || { fields: {} } }) || {};
const alertMs = (+settings.alert || 0) * 60000;
const q = { structuredQuery: { from: [{ collectionId: 'sessions' }], where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'running' } } } } };
const rows = await (await fetch(DB + '/shops/' + SHOP + ':runQuery', { method: 'POST', headers: H, body: JSON.stringify(q) })).json();
const sessions = (Array.isArray(rows) ? rows : []).filter((r) => r.document).map((r) => val({ mapValue: r.document }));
// what was already sent per session ('soon' / 'over'), so every reminder goes out exactly once
const stateUrl = DB + '/notifier/state';
const stateDoc = await (await fetch(stateUrl, { headers: H })).json();
const sentBefore = (stateDoc.fields && val(stateDoc.fields.sent)) || {};
const sentNow = {};
const msgs = [];
const debug = [];
for (const s of sessions) {
const left = s.plan * 60000 - (t - s.start - (s.paused || 0));
debug.push({ device: s.dn, plan: s.plan, status: s.status, start: s.start, paused: s.paused, leftMin: Math.round(left / 6000) / 10, alertMin: alertMs / 60000 });
if (!s.plan || s.end) continue;
const no = s.no ?? s.id;
const key = String(s.id);
const prev = sentBefore[key] || '';
if (left <= 0) {
sentNow[key] = 'over';
// skip sessions that went over long ago (e.g. notifier was off)
if (prev !== 'over' && left > -15 * 60000) msgs.push({ kind: 'over', to: 'staff', id: s.id, title: '⏰ انتهى وقت ' + s.dn, body: 'الوقت المحدد خلص • جلسة #' + no });
} else if (alertMs > 0 && left <= alertMs) {
sentNow[key] = prev || 'soon';
if (!prev) msgs.push({ kind: 'soon', to: 'staff', id: s.id, title: '⚠ ' + s.dn + ' قرب يخلص', body: 'فاضل ' + Math.max(1, Math.ceil(left / 60000)) + ' دقيقة • جلسة #' + no });
} else if (prev) {
sentNow[key] = prev;
}
}
// sessions that really ended since the last run -> viewers (money summary)
const lastEnd = +(stateDoc.fields?.lastEnd?.integerValue || stateDoc.fields?.lastEnd?.doubleValue || 0);
let newLastEnd = lastEnd || t; // first run starts from now (no flood of old sessions)
if (lastEnd) {
const q2 = { structuredQuery: { from: [{ collectionId: 'sessions' }], where: { fieldFilter: { field: { fieldPath: 'end' }, op: 'GREATER_THAN', value: { integerValue: String(lastEnd) } } } } };
const rows2 = await (await fetch(DB + '/shops/' + SHOP + ':runQuery', { method: 'POST', headers: H, body: JSON.stringify(q2) })).json();
for (const r of Array.isArray(rows2) ? rows2 : []) {
if (!r.document) continue;
const s = val({ mapValue: r.document });
newLastEnd = Math.max(newLastEnd, s.end);
const ms = s.end - s.start - (s.paused || 0);
const hh = String(Math.floor(ms / 3600000)).padStart(2, '0');
const mm = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
const body = 'المبلغ ' + Math.round((+s.amount || 0) * 100) / 100 + ' ج • المدة ' + hh + ':' + mm + ' • ' + (PAY[s.pay] || '') + (s.customer ? ' • ' + s.customer : '') + ' • جلسة #' + (s.no ?? s.id);
msgs.push({ kind: 'ended', to: 'viewer', id: s.id, title: '✅ انتهت جلسة ' + s.dn, body });
}
}
if (test) msgs.push({ kind: 'test', id: 'test', title: '🔔 OFFSIDE تجربة', body: 'الإشعارات شغالة على الجهاز ده ✔' });
if (dry) return { now: t, alertMin: alertMs / 60000, debug, sentBefore, lastEnd, wouldSend: msgs.map((m) => m.to + ': ' + m.title + ' | ' + m.body) };
if (!test && (stable(sentNow) !== stable(sentBefore) || newLastEnd !== lastEnd)) {
const fields = Object.fromEntries(Object.entries(sentNow).map(([k, v]) => [k, { stringValue: v }]));
await fetch(stateUrl, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: { sent: { mapValue: { fields } }, lastEnd: { integerValue: String(newLastEnd) } } }) });
}
if (!msgs.length) return { sessions: sessions.length, sent: 0 };
const list = await (await fetch(DB + '/pushTokens?pageSize=300', { headers: H })).json();
let tokens = (list.documents || []).map((d) => ({ name: d.name, token: d.name.split('/').pop(), email: (d.fields?.email?.stringValue || '').toLowerCase(), ts: +(d.fields?.ts?.integerValue || d.fields?.ts?.doubleValue || 0) }));
// who owns each phone: staff list (id = email, role)
const staffList = await (await fetch(DB + '/staff?pageSize=300', { headers: H })).json();
const roles = Object.fromEntries((staffList.documents || []).map((d) => [decodeURIComponent(d.name.split('/').pop()).toLowerCase(), d.fields?.role?.stringValue || 'staff']));
tokens = tokens.map((x) => ({ ...x, role: roles[x.email] }));
// the test only goes to devices registered in the last 15 minutes
if (test) tokens = tokens.filter((x) => Date.now() - x.ts < 15 * 60000);
let sent = 0;
for (const m of msgs) {
for (const tk of tokens) {
if (m.kind !== 'test' && test) continue;
if (!tk.role) continue; // email no longer on the staff list
if (m.to === 'viewer' && tk.role !== 'viewer') continue;
if (m.to === 'staff' && tk.role === 'viewer') continue;
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
function stable(o) {
return JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
}
