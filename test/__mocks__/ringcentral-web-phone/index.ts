import { WebPhoneSession } from './lib/Session';

class Transport {
  private _events: any;

  constructor() {
    this._events = {};
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  trigger(event, ...args) {
    if (this._events[event]) {
      this._events[event](...args);
    }
  }

  removeAllListeners() {}

  disconnect() {}

  isConnected() {
    return true;
  }
}

class RegisterContext {
  get registered() {
    return false;
  }
}

class UserAgent {
  private _events: any;

  constructor() {
    this._events = {};
    this.transport = new Transport();
    this.registerContext = new RegisterContext();
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  once(event, cb) {
    this._events[event] = cb;
  }

  trigger(event, ...args) {
    if (this._events[event]) {
      this._events[event](...args);
    }
  }

  invite(toNumber) {
    const sessionId = `${toNumber}-${Math.round(
      Math.random() * 1000000000,
    ).toString()}`;
    return new WebPhoneSession({
      id: sessionId,
      direction: 'Outbound',
      to: toNumber,
      from: '101'
    });
  }

  switchFrom(activeCall, options) {
    this.trigger('inviteSent');
    return this.invite(activeCall.to);
  }

  stop() {
    setTimeout(() => {
      this.trigger('unregistered');
    }, 5);
  }

  unregister() {
    setTimeout(() => {
      this.trigger('unregistered');
    }, 5);
  }

  removeAllListeners() {
    this._events = {};
  }

  get audioHelper() {
    return {
      setVolume() {},
      playIncoming() {},
      loadAudio() {},
    };
  }

  isRegistered() {
    return true;
  }
  
  removeListener(event) {
    delete this._events[event];
  }
}

export default class RingCentralWebPhone {
  private _userAgent: UserAgent;

  constructor() {
    this._userAgent = new UserAgent();
  }

  get userAgent() {
    return this._userAgent;
  }
}
