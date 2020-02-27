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
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  get localHold() {
    return false;
  }

  trigger(event, ...args) {
    if (typeof this._events[event] === 'function') {
      this._events[event](...args);
    }
  }
}
