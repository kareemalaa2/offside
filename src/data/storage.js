// Data: persistence on the device itself (no server).
// - Main copy in localStorage under the same key as the desktop app.
// - A rolling safety snapshot every 30 min, used if the main copy is ever corrupted.
import { STORAGE_KEY } from './defaults.js';

const SNAPSHOT_EVERY = 30 * 60 * 1000;

export class LocalStorageRepository {
  constructor(key = STORAGE_KEY) {
    this.key = key;
    this.snapKey = key + '_snapshot';
    this.lastSnap = 0;
  }

  _read(k) {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch {
      return null;
    }
  }

  load() {
    return this._read(this.key) || this._read(this.snapKey);
  }

  /** @returns {boolean} true when written successfully */
  save(state) {
    try {
      const json = JSON.stringify(state);
      localStorage.setItem(this.key, json);
      const now = Date.now();
      if (now - this.lastSnap > SNAPSHOT_EVERY) {
        localStorage.setItem(this.snapKey, json);
        this.lastSnap = now;
      }
      return true;
    } catch {
      return false;
    }
  }
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}
