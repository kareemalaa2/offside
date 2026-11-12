// Data: device copy (instant start, works offline) + cloud copy (shared by all devices).
// The Store only sees load()/save(); it doesn't know the cloud exists.

export class SyncedRepository {
  /** @param {import('./storage.js').LocalStorageRepository} local
   *  @param {import('./cloudRepository.js').CloudRepository} cloud */
  constructor(local, cloud) {
    this.local = local;
    this.cloud = cloud;
  }
  load() {
    return this.local.load();
  }
  save(state) {
    const ok = this.local.save(state);
    this.cloud.save(state); // async, queued offline by Firestore
    return ok;
  }
}
