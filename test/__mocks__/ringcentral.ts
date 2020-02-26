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

class Subscription {
  private _events: any;

  constructor() {
    this._events = {};
    this.events = {
      subscribeSuccess: 'subscribeSuccess',
      renewSuccess: 'renewSuccess',
      notification: 'notification',
      renewError: 'renewError',
      automaticRenewError: 'automaticRenewError',
    };
  }

  setSubscription() {
    return this;
  }

  setEventFilters() {
    return this;
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  register() {
    return this;
  }

  reset() {
    return this;
  }

  resubscribe() {
    return this;
  }

  removeListener(event, cb) {
    delete this._events[event];
  }

  trigger(event, ...args) {
    this._events[event](...args);
  }

  subscription() {
    return {};
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

  createSubscription() {
    return new Subscription();
  }
}
