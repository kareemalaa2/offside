// Application: single source of truth. Every mutation goes through commit()
// so persistence happens in exactly one place.
import { migrate } from '../data/migrations.js';

export class Store {
  /** @param {{load():any, save(state:any):boolean}} repo */
  constructor(repo) {
    this.repo = repo;
    this.state = migrate(repo.load());
    this.onSaveError = null;
    this.repo.save(this.state);
  }

  /** Run a mutation against the state and persist it. Returns the mutator's result. */
  commit(mutator) {
    const result = mutator(this.state);
    this.persist();
    return result;
  }

  replace(next) {
    this.state = migrate(next);
    this.persist();
  }

  persist() {
    if (!this.repo.save(this.state)) this.onSaveError?.();
  }
}
