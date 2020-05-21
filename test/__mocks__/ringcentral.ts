class LocalStorage {
  private store: any;
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value;
  }

  removeItem(key) {
    delete this.store[key];
  }

  key(index) {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  get length() {
    return Object.keys(this.store).length;
  }

  toString() {
    return '[object Storage]';
  }
}

export default class RingCentral {
  constructor() {
    this._storage = new LocalStorage();
    this._platform = {
      get() {

      },
      post() {

      },
      delete() {

      },
      put() {

      },
      loggedIn() {
        return Promise.resolve(true);
      }
    };
  }

  platform() {
    return this._platform;
  }

  cache() {
    return this._storage;
  }
}
