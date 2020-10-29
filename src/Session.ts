import { EventEmitter } from 'events';
import { WebPhoneSession } from 'ringcentral-web-phone/lib/session';
import {
  Session as TelephonySession,
  PartyStatusCode,
  ReplyWithTextParams,
} from 'ringcentral-call-control/lib/Session';

import { extractHeadersData, getWebphoneReplyMessageOption } from './utils'

export enum events {
  DISCONNECTED ='disconnected',
  STATUS = 'status',
  RECORDINGS = 'recordings',
  MUTED = 'muted',
  WEBPHONE_SESSION_CONNECTED = 'webphoneSessionConnected',
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
  private _sessionId: string;
  private _startTime: number;

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
      this._setIdsFromWebPhoneSessionHeaders(this._webphoneSession.request.headers);
    }
    // webphone session's start time should alway replace telephony session's start time, because it counts
    // start from call was answered, so will be more accurate
    if (this._webphoneSession.startTime) {
      this._startTime = (new Date(this._webphoneSession.startTime)).getTime();
    }
    this._webphoneSession.on('accepted', this._onWebphoneSessionAccepted);
    this._webphoneSession.on('progress', this._onWebphoneSessionProgress);
    this._webphoneSession.on('terminated', this._onWebphoneSessionTerminated)
    this._webphoneSessionConnected = true;
    this.emit(events.WEBPHONE_SESSION_CONNECTED);
  }

  _onWebphoneSessionAccepted = (incomingResponse) => {
    this._setIdsFromWebPhoneSessionHeaders(incomingResponse.headers);
    this._status = PartyStatusCode.answered;
  }

  _onWebphoneSessionProgress = (incomingResponse) => {
    this._setIdsFromWebPhoneSessionHeaders(incomingResponse.headers);
    this._status = PartyStatusCode.proceeding;
  }

  _onWebphoneSessionTerminated = () => {
    this._status = PartyStatusCode.disconnected;
    this._cleanWebPhoneSession();
    if (!this._telephonySession) {
      this.emit(events.DISCONNECTED);
    }
  }

  _cleanWebPhoneSession() {
    if (this._webphoneSession) {
      this._webphoneSession.removeListener('accepted', this._onWebphoneSessionAccepted);
      this._webphoneSession.removeListener('progress', this._onWebphoneSessionProgress);
      this._webphoneSession.removeListener('terminated', this._onWebphoneSessionTerminated)
    }
    this._webphoneSession = null;
  }

  _onNewTelephonySession() {
    this._telephonySessionId = this._telephonySession.id;
    this._sessionId = this._telephonySession.data.sessionId;
    if (this._telephonySession.party) {
      this._status = this._telephonySession.party.status.code;
    }
    if(this._telephonySession.data.creationTime && !this._startTime) {
      this._startTime = (new Date(this._telephonySession.data.creationTime)).getTime();
    }
    this._telephonySession.on(events.STATUS, this._onTelephonyStatusChange);
    this._telephonySession.on(events.RECORDINGS, this._onTelephonyRecordingsEvent);
    this._telephonySession.on(events.MUTED, this._onTelephonyMutedEvent);
  }

  _cleanTelephonySession() {
    if (this._telephonySession) {
      this._telephonySession.removeListener(events.STATUS, this._onTelephonyStatusChange);
      this._telephonySession.removeListener(events.RECORDINGS, this._onTelephonyRecordingsEvent);
      this._telephonySession.removeListener(events.MUTED, this._onTelephonyMutedEvent);
    }
    this._telephonySession = null;
  }

  _onTelephonyStatusChange = ({ party }) => {
    if (!this._telephonySession) {
      return;
    }
    const myParty = this._telephonySession.party;
    if (myParty) {
      this._status = myParty.status.code;
    }
    this.emit(events.STATUS, { party, status: this._status });
    if (
      myParty &&
      myParty.status.code === PartyStatusCode.disconnected &&
      myParty.status.reason !== 'Pickup' && // don't end when call switched
      myParty.status.reason !== 'CallSwitch' // don't end when call switched
    ) {
      this._cleanTelephonySession();
      if (!this._webphoneSession) {
        this.emit(events.DISCONNECTED);
        return;
      }
    }
  }
  
  _onTelephonyRecordingsEvent = ({ party }) => {
    this.emit(events.RECORDINGS, { party });
  }

  _onTelephonyMutedEvent = ({ party }) => {
    this.emit(events.MUTED, { party });
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
    this._cleanTelephonySession();
    this._cleanWebPhoneSession();
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

  get sessionId() {
    return this._sessionId || null;
  }

  get id() {
    return this._telephonySessionId;
  }

  get activeCallId() {
    return this._activeCallId;
  }

  get status() {
    return this._status;
  }

  get direction() {
    if (this.party) {
      return this.party.direction;
    }
    if (this._webphoneSession) {
      // @ts-ignore
      return this._webphoneSession.__rc_direction;
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
    if (this._webphoneSession) {
      return {
        phoneNumber: this._webphoneSession.request.from.uri.user,
        name: this._webphoneSession.request.from.displayName,
      };
    }
    return {};
  }

  get to() {
    if (this.party) {
      return this.party.to;
    }
    if (this._webphoneSession) {
      return {
        phoneNumber: this._webphoneSession.request.to.uri.user,
        name: this._webphoneSession.request.to.displayName,
      };
    }
    return {};
  }

  get data() {
    if (this._telephonySession) {
      return this._telephonySession.data;
    }
    return null;
  }

  get startTime() {
    return this._startTime || null;
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
    if (this._webphoneSession && this._webphoneSession.localHold) {
      return this._webphoneSession.unhold();
    }
    if (this._telephonySession) {
      return this._telephonySession.unhold();
    }
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
    if (this._webphoneSession) {
      // @ts-ignore
      return this._webphoneSession.forward(forwardNumber, acceptOptions, transferOptions);
    }
    const params : any = {};
    if (forwardNumber.length > 5) {
      params.phoneNumber = forwardNumber;
    } else {
      params.extensionNumber = forwardNumber;
    }
    return this._telephonySession.forward(params);
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
    if (this._webphoneSession) {
      return this._webphoneSession.stopRecord();
    }
  }
}
