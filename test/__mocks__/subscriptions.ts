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

export default class Subscriptions {
  createSubscription() {
    return new Subscription();
  }
}
