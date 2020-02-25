import { Session } from './lib/Session';

export class RingCentralCallControl {
  private _events: any;
  private _sessions: Session[];

  constructor() {
    this._events = {};
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  createCall() {
    const session = new Session();
    this._sessions.push(session);
    return session;
  }

  get sessions() {
    return this._sessions;
  }
}
