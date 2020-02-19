import { EventEmitter } from 'events';
import RingCentralWebPhone from 'ringcentral-web-phone';
import { RingCentralCallControl } from 'ringcentral-call-control';
import { Session, events as sessionEvents, directions } from './Session';

import { extractHeadersData } from './utils'

export interface MakeCallParams {
  toNumber: string;
  fromNumber?: string;
  deviceId?: string;
  type: 'webphone' | 'callControl';
  homeContryId?: string;
}

export enum events {
  WEBPHONE_REGISTERED ='webphone-registered',
  NEW = 'new',
  WEBPHONE_UNREGISTERED = 'webphone-unregistered',
  WEBPHONE_REGISTRATION_FAILED = 'webphone-registration-failed',
};

export class RingCentralCall extends EventEmitter {
  private _webphone: RingCentralWebPhone;
  private _activeCallControl: RingCentralCallControl;
  private _sessions: Session[];
  private _webphoneRegistered: boolean;

  constructor({
    webphone,
    activeCallControl,
  }) {
    super();
    this._sessions = [];
    this._webphoneRegistered = false;

    this.setWebphone(webphone);
    this.setActiveCallControl(activeCallControl);
  }

  async makeCall(params : MakeCallParams) {
    if (params.type === 'webphone') {
      if (!this.webphoneRegistered) {
        throw(new Error('webphone is not registered'));
      }
      const webphoneSession = this._webphone.userAgent.invite(params.toNumber, {
        fromNumber: params.fromNumber,
        homeCountryId: params.homeContryId,
      } as any);
      // @ts-ignore
      webphoneSession.__rc_direction = directions.OUTBOUND;
      return this._onNewWebPhoneSession(webphoneSession);
    }
    const callParams : any = {}
    if (params.toNumber.length > 5) {
      callParams.phoneNumber = params.toNumber;
    } else {
      callParams.extensionNumber = params.toNumber;
    }
    const telephonySession = await this._activeCallControl.createCall(params.deviceId, callParams);
    return this._onNewTelephonySession(telephonySession);
  }

  _onNewWebPhoneSession(webphoneSession) {
    const newSession = new Session({
      webphoneSession,
    });
    const onSessionDisconnected = () => {
      this._onSessionDisconnected(newSession);
      // @ts-ignore
      newSession.removeListener(sessionEvents.DISCONNECTED, onSessionDisconnected);
    };
    // @ts-ignore
    newSession.on(sessionEvents.DISCONNECTED, onSessionDisconnected);
    this._sessions.push(newSession);
    return newSession;
  }

  _onWebPhoneSessionRing = (webphoneSession) => {
    const [partyData] = extractHeadersData(webphoneSession.request.headers);
    let session;
    if (partyData && partyData.sessionId) {
      session = this.sessions.find(s => s.telephonySessionId === partyData.sessionId);
    }
    // @ts-ignore
    webphoneSession.__rc_direction = directions.INBOUND;
    if (session) {
      session.setWebphoneSession(webphoneSession);
      return;
    }
    session = this._onNewWebPhoneSession(webphoneSession);
    // @ts-ignore
    this.emit(events.NEW, session);
  }

  _onNewTelephonySession = (telephonySession) => {
    let session =
      this.sessions.find(s => s.telephonySessionId === telephonySession.id);
    if (session) {
      session.setTelephonySession(telephonySession);
      return session;
    }
    session = new Session({
      telephonySession,
    });
    const onSessionDisconnected = () => {
      this._onSessionDisconnected(session);
      // @ts-ignore
      session.removeListener(sessionEvents.DISCONNECTED, onSessionDisconnected);
    };
    // @ts-ignore
    session.on(sessionEvents.DISCONNECTED, onSessionDisconnected);
    this._sessions.push(session);
    // @ts-ignore
    this.emit(events.NEW, session);
    return session;
  }

  _onSessionDisconnected(session) {
    this._sessions = this._sessions.filter(s => s !== session);
    session.dispose();
  }

  _onWebphoneRegistered = () => {
    if (!this._webphoneRegistered) {
      this._webphoneRegistered = true;
      // @ts-ignore
      this.emit(events.WEBPHONE_REGISTERED);
    }
  }

  _onWebphoneUnregistered = () => {
    this._webphoneRegistered = false;
    // @ts-ignore
    this.emit(events.WEBPHONE_UNREGISTERED);
  }

  _onWebphoneRegistrationFailed = (response, cause) => {
    this._webphoneRegistered = false;
    // @ts-ignore
    this.emit(events.WEBPHONE_REGISTRATION_FAILED, response, cause);
  }

  setWebphone(webphone) {
    this.clearWebphone();
    this._webphone = webphone;
    this._webphoneRegistered = webphone.userAgent.registerContext.registered;
    this._webphone.userAgent.on('invite', this._onWebPhoneSessionRing);
    this._webphone.userAgent.on('registered', this._onWebphoneRegistered);
    this._webphone.userAgent.on('unregistered', this._onWebphoneUnregistered);
    this._webphone.userAgent.on('registrationFailed', this._onWebphoneRegistrationFailed);
  }

  clearWebphone() {
    if (!this._webphone) {
      return;
    }
    // @ts-ignore
    this._webphone.userAgent.removeListener('invite', this._onWebPhoneSessionRing);
    // @ts-ignore
    this._webphone.userAgent.removeListener('registered', this._onWebphoneRegisted);
    // @ts-ignore
    this._webphone.userAgent.removeListener('unregistered', this._onWebphoneUnregistered);
    // @ts-ignore
    this._webphone.userAgent.removeListener('registrationFailed', this._onWebphoneRegistrationFailed);
    this._webphone = null;
  }

  setActiveCallControl(activeCallControl) {
    this.clearActiveCallControl();
    this._activeCallControl = activeCallControl;
    // @ts-ignore
    this._activeCallControl.on('new', this._onNewTelephonySession);
  }

  clearActiveCallControl() {
    if (!this._activeCallControl) {
      return;
    }
    // @ts-ignore
    this._activeCallControl.removeListener('new', this._onNewTelephonySession);
    this._activeCallControl = null;
  }

  async dispose() {
    this.clearWebphone();
    this.clearActiveCallControl();
    // @ts-ignore
    this.removeAllListeners();
    this.sessions.forEach((session) => {
      session.hangup()
    });
    this._sessions = [];
  }

  get webphone() {
    return this._webphone;
  }

  get activeCallControl() {
    return this._activeCallControl;
  }

  get sessions() {
    return this._sessions;
  }

  get webphoneRegistered() {
    return this._webphoneRegistered;
  }
}
