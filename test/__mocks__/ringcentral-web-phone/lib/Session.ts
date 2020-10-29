import * as RealSession from 'ringcentral-web-phone/lib/Session';

// @ts-ignore
export class SessionDescriptionHandler {
  private _events: any;

  constructor() {
    this._events = {};
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  trigger(event, ...args) {
    this._events[event](...args);
  }
}

export class WebPhoneSession implements RealSession.WebPhoneSession {
  private _events: any;
  private _localHold: boolean;
  private __rc_direction: string;

  constructor({ id, toNumber, fromNumber, direction }) {
    // native sip fields
    this.id = id;
    this.startTime = new Date();
    this.sessionDescriptionHandler = new SessionDescriptionHandler();
    this.request = {
      to: {
        uri: {
          user: toNumber,
        },
        displayName: null,
      },
      from: {
        uri: {
          user: fromNumber,
        },
      },
      headers: {
        'P-Rc-Api-Ids': [
          {
            raw: `party-id=${id}-2;session-id=${id}`
          }
        ],
        'Call-ID': [
          {
            raw: id,
          }
        ]
      }
    };

    // mock events
    this._events = {};
    this.__rc_direction = direction;
    this._localHold = false;
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  removeListener(event, cb) {
    delete this._events[event];
  }

  get localHold() {
    return this._localHold;
  }

  setLocalHold(onHold) {
    this._localHold = onHold;
  }

  trigger(event, ...args) {
    if (typeof this._events[event] === 'function') {
      this._events[event](...args);
    }
  }
}
