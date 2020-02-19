import { EventEmitter } from 'events';
import RingCentralWebPhone from 'ringcentral-web-phone';
import { WebPhoneSession } from 'ringcentral-web-phone/lib/session';
import { RingCentralCallControl } from 'ringcentral-call-control';
import {
  Session as TelephonySession,
  PartyStatusCode,
  ReplyWithTextParams,
  ForwardParams,
} from 'ringcentral-call-control/lib/Session';

import { extractHeadersData, getWebphoneReplyMessageOption } from './utils'

export enum events {
  DISCONNECTED ='disconnected',
  STATUS = 'status',
};

export enum directions {
  OUTBOUND = 'Outbound',
  INBOUND = 'Inbound',
};

export class Session extends EventEmitter {
  private _webphoneSession: WebPhoneSession;
  private _telephonySession: TelephonySession;
  private _telephonySessionId: string;
  private _activeCallId: string;
  private _webphoneSessionConnected: boolean = false;
  private _status: PartyStatusCode;

  constructor({
    webphoneSession,
    telephonySession,
  } : {
    webphoneSession?: WebPhoneSession;
    telephonySession?: TelephonySession;
  }) {
    super();

    this._webphoneSession = webphoneSession;
    this._telephonySession = telephonySession;
    this._status = PartyStatusCode.setup;

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
      this._status = PartyStatusCode.answered;
    });
    this.webphoneSession.on('progress', (incomingResponse) => {
      console.log('progress...');
      this._setIdsFromWebPhoneSessionHeaders(incomingResponse.headers);
      this._status = PartyStatusCode.proceeding;
    });
    this.webphoneSession.on('terminated', () => {
      this._status = PartyStatusCode.disconnected;
      if (!this.telephonySession) {
        // @ts-ignore
        this.emit(events.DISCONNECTED);
        this._webphoneSession = null;
        return;
      }
      // TODO: clean listeners
      this._webphoneSession = null;
    })
    this._webphoneSessionConnected = true;
    // @ts-ignore
    this.emit('webphoneSessionConnected');
  }

  _onNewTelephonySession() {
    this._telephonySessionId = this.telephonySession.id;
    if (this.telephonySession.party) {
      this._status = this.telephonySession.party.status.code;
    }
     // @ts-ignore
    this.telephonySession.on('status', ({ party }) => {
      const myParty = this.telephonySession.party;
      if (myParty) {
        this._status = this.telephonySession.party.status.code;
      }
      // @ts-ignore
      this.emit(events.STATUS, { party, status: myParty.status.code });
      if (
        myParty &&
        myParty.status.code === PartyStatusCode.disconnected
      ) {
        if (!this._webphoneSession) {
          // @ts-ignore
          this.emit(events.DISCONNECTED);
          this._telephonySession = null;
          return;
        }
        this._telephonySession = null;
      }
    })
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
    this._onNewTelephonySession();
  }

  setWebphoneSession(webphoneSession) {
    this._webphoneSession = webphoneSession;
    this._onNewWebPhoneSession();
  }

  dispose() {
    // TODO
    // @ts-ignore
    this.removeAllListeners();
  }

  get webphoneSession() {
    return this._webphoneSession;
  }

  get webphoneSessionConnected() {
    return this._webphoneSessionConnected;
  }

  get telephonySession() {
    return this._telephonySession;
  }

  get telephonySessionId() {
    return this._telephonySessionId;
  }

  get id() {
    return this._telephonySessionId;
  }

  get status() {
    return this._status;
  }

  get direction() {
    if (this.party) {
      return this.party.direction;
    }
    if (this.webphoneSession) {
      // @ts-ignore
      return webphoneSession.__rc_direction;
    }
  }

  get party() {
    if (!this._telephonySession) {
      return null;
    }
    return this._telephonySession.party;
  }

  get otherParties() {
    if (!this._telephonySession) {
      return [];
    }
    return this._telephonySession.otherParties;
  }

  get recordings() {
    if (!this._telephonySession) {
      return [];
    }
    return this._telephonySession.recordings;
  }

  get from() {
    if (this.party) {
      return this.party.from;
    }
    if (this.webphoneSession) {
      return {
        phoneNumber: this.webphoneSession.request.from.uri.user,
        name: this.webphoneSession.request.from.displayName,
      };
    }
    return {};
  }

  get to() {
    if (this.party) {
      return this.party.to;
    }
    if (this.webphoneSession) {
      return {
        phoneNumber: this.webphoneSession.request.to.uri.user,
        name: this.webphoneSession.request.to.displayName,
      };
    }
    return {};
  }

  hangup() {
    if (this._webphoneSession) {
      return this._webphoneSession.terminate();
    }
    return this._telephonySession.drop();
  }

  hold() {
    if (this._telephonySession) {
      return this._telephonySession.hold();
    }
    return this._webphoneSession.hold();
  }

  unhold() {
    if (this._telephonySession) {
      return this._telephonySession.unhold();
    }
    return this._webphoneSession.unhold();
  }

  toVoicemail() {
    if (this._telephonySession) {
      return this._telephonySession.toVoicemail();
    }
    return this._webphoneSession.toVoicemail();
  }

  reject({ deviceId } : { deviceId?: string } = {}) {
    if (this._telephonySession) {
      return this._telephonySession.ignore({ deviceId });
    }
    return this._webphoneSession.reject();
  }

  answer({ deviceId } : { deviceId?: string } = {}) {
    if (this._webphoneSession) {
      return this._webphoneSession.accept();
    }
    return this._telephonySession.answer({ deviceId });
  }

  replyWithMessage(params: ReplyWithTextParams) {
    if (this._telephonySession) {
      return this._telephonySession.reply(params);
    }
    const webphoneReplyOption = getWebphoneReplyMessageOption(params);
    return this._webphoneSession.replyWithMessage(webphoneReplyOption as any);
  }

  forward(forwardNumber: string, acceptOptions?: any, transferOptions?: any) {
    if (this._telephonySession) {
      const params : any = {};
      if (forwardNumber.length > 5) {
        params.phoneNumber = forwardNumber;
      } else {
        params.extensionNumber = forwardNumber;
      }
      return this._telephonySession.forward(params);
    }
    // @ts-ignore
    return this._webphoneSession.forward(forwardNumber, acceptOptions, transferOptions);
  }

  transfer(transferNumber: string, transferOptions?: any) {
    if (this._telephonySession) {
      const params : any = {};
      if (transferNumber.length > 5) {
        params.phoneNumber = transferNumber;
      } else {
        params.extensionNumber = transferNumber;
      }
      return this._telephonySession.transfer(params);
    }
    // @ts-ignore
    return this._webphoneSession.transfer(transferNumber, transferOptions);
  }

  park() {
    if (this._webphoneSession) {
      return this._webphoneSession.park();
    }
    return this._telephonySession.park();
  }

  flip({ callFlipId } : { callFlipId: string }) {
    if (this._telephonySession) {
      return this._telephonySession.flip({ callFlipId });
    }
    return this._webphoneSession.flip(callFlipId);
  }

  async mute() {
    if (this._webphoneSession) {
      this._webphoneSession.mute();
    }
    if (this._telephonySession) {
      return this._telephonySession.mute();
    }
  }

  async unmute() {
    if (this._webphoneSession) {
      this._webphoneSession.unmute();
    }
    if (this._telephonySession) {
      return this._telephonySession.unmute();
    }
  }

  startRecord({ recordingId } : { recordingId?: string } = {}) {
    if (this._telephonySession) {
      if (!recordingId) {
        return this._telephonySession.createRecord();
      }
      return this._telephonySession.resumeRecord(recordingId);
    }
    return this._webphoneSession.startRecord();
  }

  stopRecord({ recordingId } : { recordingId?: string } = {}) {
    if (this._telephonySession && recordingId) {
      return this._telephonySession.pauseRecord(recordingId);
    }
    return this._webphoneSession.stopRecord();
  }
}
