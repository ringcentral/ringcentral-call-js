import { EventEmitter } from 'events';
import RingCentralWebPhone from 'ringcentral-web-phone';
import { WebPhoneSession } from 'ringcentral-web-phone/lib/session';
import { RingCentralCallControl } from 'ringcentral-call-control';
import { Session as TelephonySession } from 'ringcentral-call-control/lib/Session';

import { extractHeadersData } from './utils'

export class Session extends EventEmitter {
  private _webphone: RingCentralWebPhone;
  private _activeCallControl: RingCentralCallControl;
  private _webphoneSession: WebPhoneSession;
  private _telephonySession: TelephonySession;
  private _telephonySessionId: string;
  private _activeCallId: string;

  constructor({
    webphoneSession,
    telephonySession,
    webphone,
    activeCallControl,
  } : {
    webphoneSession?: WebPhoneSession;
    telephonySession?: TelephonySession;
    webphone: RingCentralWebPhone,
    activeCallControl: RingCentralCallControl,
  }) {
    super();

    this._webphone = webphone;
    this._activeCallControl = activeCallControl;
    this._webphoneSession = webphoneSession;
    this._telephonySession = telephonySession;

    if (this._webphoneSession) {
      this._onNewWebPhoneSession();
    }
    if (this._telephonySession) {
      this._onNewTelephonySession();
    }
  }

  _onNewWebPhoneSession() {
    if (this._webphoneSession.request) {
      this._setIdsFromWebPhoneSessionHeaders(this.webphoneSession.request.headers);
    }
    this.webphoneSession.on('accepted', (incomingResponse) => {
      console.log('accepted');
      this._setIdsFromWebPhoneSessionHeaders(incomingResponse.headers);
    });
    this.webphoneSession.on('progress', (incomingResponse) => {
      console.log('progress...');
      this._setIdsFromWebPhoneSessionHeaders(incomingResponse.headers);
    });
  }

  _onNewTelephonySession() {
    this._telephonySessionId = this._telephonySession.id;
  }

  _setIdsFromWebPhoneSessionHeaders(headers) {
    if (!headers) {
      return;
    }
    const [partyData, callId] = extractHeadersData(headers);
    if (partyData && partyData.sessionId) {
      this._telephonySessionId = partyData.sessionId;
    }
    if (callId) {
      this._activeCallId = callId;
    }
  }

  setTelephonySession(telephonySession) {
    this._telephonySession = telephonySession;
  }

  setWebphoneSession(webphoneSession) {
    this._webphoneSession = webphoneSession;
  }

  dispose() {
    // @ts-ignore
    this.removeAllListeners()
  }

  get webphoneSession() {
    return this._webphoneSession;
  }

  get telephonySession() {
    return this._telephonySession;
  }

  get telephonySessionId() {
    return this._telephonySessionId;
  }
}
