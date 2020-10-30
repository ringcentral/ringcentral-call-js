class Cache {
  private store: any;
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  async getItem(key) {
    return this.store[key] || null;
  }

  async setItem(key, value) {
    this.store[key] = value;
  }

  async removeItem(key) {
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
  private _cache: Cache;
  private _platform: any;

  constructor() {
    this._cache = new Cache();
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
    return this._cache;
  }
}
