// Data: Firestore cloud sync (shared live database for every phone / PC).
//
// Layout:  shops/{SHOP_ID}                 -> small "meta" fields (settings, devices, drinks, seq, pw, cur)
//          shops/{SHOP_ID}/{list}/{id}     -> one document per record (sessions, sales, expenses, ...)
// One document per record keeps writes tiny and lets two devices edit different records safely.
// Firestore's offline cache queues writes with no internet and syncs when back online.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, onSnapshot, writeBatch, getDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const LISTS = ['sessions', 'expenses', 'sales', 'buys', 'stm', 'cashm', 'closes', 'custs', 'books'];
const META_KEYS = ['seq', 'settings', 'devices', 'drinks', 'pw', 'cur'];
const BATCH_LIMIT = 450;

/** JSON with sorted keys, so the same data always gives the same string. */
const stable = (v) =>
  v && typeof v === 'object'
    ? Array.isArray(v)
      ? `[${v.map(stable).join(',')}]`
      : `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',')}}`
    : JSON.stringify(v ?? null);

const clean = (v) => JSON.parse(JSON.stringify(v ?? null));
const pickMeta = (S) => Object.fromEntries(META_KEYS.map((k) => [k, S[k] ?? null]));

export class CloudRepository {
  constructor(config, shopId) {
    this.app = initializeApp(config);
    this.auth = getAuth(this.app);
    this.db = initializeFirestore(this.app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    this.shopRef = doc(this.db, 'shops', shopId);
    this.known = null; // what the cloud currently holds (stable JSON per record)
    this.unsubs = [];
    this.onError = () => {};
    this.readOnly = false; // viewers never write
  }

  /** Role of the signed-in user from the staff list: 'owner' | 'staff' | 'viewer' | null (not allowed). */
  async getRole() {
    const email = this.email.toLowerCase();
    if (!email) return null;
    try {
      const snap = await getDoc(doc(this.db, 'staff', email));
      return snap.exists() ? snap.data().role || 'staff' : null;
    } catch {
      return undefined /* offline: unknown, keep last known role */;
    }
  }

  /* ---------- auth ---------- */
  onAuth(cb) {
    return onAuthStateChanged(this.auth, cb);
  }
  signIn(email, password) {
    return signInWithEmailAndPassword(this.auth, email.trim(), password);
  }
  resetPassword(email) {
    return sendPasswordResetEmail(this.auth, email.trim());
  }
  async signOut() {
    this.disconnect();
    await signOut(this.auth);
  }
  get email() {
    return this.auth.currentUser?.email || '';
  }

  /* ---------- live read ---------- */
  /**
   * @param {(state: object|null) => void} onData  full state, or null when the cloud is still empty
   * @param {(s: {offline:boolean, pending:boolean}) => void} onStatus
   */
  connect(onData, onStatus) {
    this.disconnect();
    let meta; // undefined = not loaded yet, null = no shop doc yet
    const lists = {};
    const known = { meta: null, lists: Object.fromEntries(LISTS.map((k) => [k, new Map()])) };
    const flags = {};
    let timer;

    const status = (key, md) => {
      flags[key] = md;
      const all = Object.values(flags);
      onStatus({ offline: all.some((m) => m.fromCache), pending: all.some((m) => m.hasPendingWrites) });
    };

    // Several listeners fire for one change; wait a moment and emit one consistent state.
    const emit = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (meta === undefined || LISTS.some((k) => !lists[k])) return;
        this.known = known;
        if (meta === null) return onData(null);
        const state = { ...meta };
        for (const k of LISTS) state[k] = [...lists[k].values()].sort((a, b) => (+a.id || 0) - (+b.id || 0));
        onData(state);
      }, 60);
    };

    const fail = (err) => {
      console.error(err);
      this.onError(err);
    };

    this.unsubs.push(
      onSnapshot(this.shopRef, { includeMetadataChanges: true }, (snap) => {
        meta = snap.exists() ? snap.data() : null;
        known.meta = meta ? stable(pickMeta(meta)) : null;
        status('meta', snap.metadata);
        emit();
      }, fail),
    );
    for (const k of LISTS) {
      this.unsubs.push(
        onSnapshot(collection(this.shopRef, k), { includeMetadataChanges: true }, (snap) => {
          const m = new Map();
          const km = new Map();
          snap.forEach((d) => {
            const v = d.data();
            m.set(d.id, v);
            km.set(d.id, stable(v));
          });
          lists[k] = m;
          known.lists[k] = km;
          status(k, snap.metadata);
          emit();
        }, fail),
      );
    }
  }

  disconnect() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    this.known = null;
  }

  /* ---------- write only what changed ---------- */
  save(state) {
    const known = this.known;
    if (!known || this.readOnly) return; // not connected yet, or a view-only account
    const ops = [];

    const meta = clean(pickMeta(state));
    const mj = stable(meta);
    if (mj !== known.meta) {
      ops.push((b) => b.set(this.shopRef, meta));
      known.meta = mj;
    }

    for (const k of LISTS) {
      const prev = known.lists[k];
      const col = collection(this.shopRef, k);
      const seen = new Set();
      for (const item of state[k] || []) {
        const id = String(item.id);
        const data = clean(item);
        const j = stable(data);
        seen.add(id);
        if (prev.get(id) !== j) {
          ops.push((b) => b.set(doc(col, id), data));
          prev.set(id, j);
        }
      }
      for (const id of [...prev.keys()]) {
        if (!seen.has(id)) {
          ops.push((b) => b.delete(doc(col, id)));
          prev.delete(id);
        }
      }
    }

    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      ops.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
      batch.commit().catch((e) => this.onError(e));
    }
  }
}
