import * as RealSession from 'ringcentral-call-control/lib/Session';

export const PartyStatusCode = RealSession.PartyStatusCode;
export const ReplyWithPattern = RealSession.ReplyWithPattern;

export class Session {
  private _events: any;
  private _id: string;
  private _fromNumber: string;
  private _toNumber: string;
  private _direction: string;
  private _status: string;
  private _party: any;
  private _otherParties: any[];
  private _recordings: any[];

  constructor({ id, status = 'Setup', fromNumber, toNumber, direction}) {
    this._id = id;
    this._events = {};
    this._fromNumber = fromNumber;
    this._toNumber = toNumber;
    this._direction = direction;
    this._status = status;
    this._party = {
      status: {
        code: this._status
      },
      from: {
        phoneNumber: this._fromNumber,
      },
      to: {
        phoneNumber: this._toNumber,
      },
      direction: this._direction,
    };
    this._recordings = [];
  }

  on(event, cb) {
    this._events[event] = cb;
  }

  trigger(event, ...args) {
    this._events[event](...args);
  }

  get id() {
    return this._id;
  }

  get party() {
    return this._party;
  }

  get otherParties() {
    return this._otherParties;
  }

  get recordings() {
    return this._recordings;
  }

  get data() {
    return {};
  }

  setParty(party) {
    this._party = party;
  }

  setOtherParties(parties) {
    this._otherParties = parties;
  }
}
