(function (root) {
  "use strict";

  const STORAGE_KEY = "keywords.active-session.v1";

  class SessionStorage {
    constructor(storage = root.localStorage) {
      this.storage = storage;
    }

    load() {
      try {
        const raw = this.storage?.getItem(STORAGE_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        return root.NarrativeState.validate(session) ? session : null;
      } catch {
        return null;
      }
    }

    save(session) {
      try {
        this.storage?.setItem(STORAGE_KEY, JSON.stringify(session));
        return true;
      } catch {
        return false;
      }
    }

    clear() {
      try {
        this.storage?.removeItem(STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    }
  }

  const api = { SessionStorage, STORAGE_KEY };
  root.KeywordsStorage = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);