import { Session } from './lib/Session';

export class RingCentralCallControl {
  private _events: any;
  private _sessions: Session[];
  private _ready: boolean;

  constructor() {
    this._events = {};
    this._sessions = [];
    this._ready = false;
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  trigger(event, ...args) {
    this._events[event](...args);
  }

  createCall({ phoneNumber, deviceId }) {
    const session = new Session({
      id: '123',
      status: 'Setup',
      toNumber: phoneNumber,
      fromNumber: '',
      direction: 'Outbound'
    });
    this._sessions.push(session);
    return session;
  }

  get sessions() {
    return this._sessions;
  }

  setSessions(sessions) {
    this._sessions = sessions;
  }

  removeListener(event) {
    delete this._events[event];
  }

  get devices() {
    return [];
  }

  onNotificationEvent() {
    
  }

  get ready() {
    return this._ready;
  }

  loadSessions() {

  }

  restoreSessions() {
    
  }
}
