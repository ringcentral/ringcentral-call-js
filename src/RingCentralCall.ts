import { EventEmitter } from 'events';
import {
  Extension,
  RingCentralCallControl,
} from 'ringcentral-call-control';
import RingCentralWebPhone from 'ringcentral-web-phone';
import { WebPhoneSession } from 'ringcentral-web-phone/lib/session';
import {
  ActiveCallInfo as ActiveCallInfoBase,
  InviteOptions,
} from 'ringcentral-web-phone/lib/userAgent';

import { SDK as RingCentralSDK } from '@ringcentral/sdk';
import {
  Subscriptions as RingCentralSubscriptions,
} from '@ringcentral/subscriptions';

import {
  directions,
  events as sessionEvents,
  Session,
} from './Session';
import { USER_AGENT } from './userAgent';
import { extractHeadersData } from './utils';

export interface MakeCallParams {
  toNumber: string;
  fromNumber?: string;
  deviceId?: string;
  type: 'webphone' | 'callControl';
  homeCountryId?: string;
}

export enum events {
  WEBPHONE_REGISTERED = 'webphone-registered',
  NEW = 'new',
  WEBPHONE_UNREGISTERED = 'webphone-unregistered',
  WEBPHONE_REGISTRATION_FAILED = 'webphone-registration-failed',
  CALL_CONTROL_READY = 'call-control-ready',
  CALL_CONTROL_NOTIFICATION_REDY = 'call-control-notification-ready',
  CALL_CONTROL_NOTIFICATION_ERROR = 'call-control-notification-error',
  WEBPHONE_INVITE = 'webphone-invite',
  WEBPHONE_INVITE_SENT = 'webphone-invite-sent',
}

export interface ActiveCallInfo extends ActiveCallInfoBase {
  telephonySessionId: string;
}


type ConstraintsMedia = boolean | { deviceId: string; };
export interface IPickUpCallParams {
  sessionId: string;
  toNumber: string;
  fromNumber: string;
  serverId: string;
  telephonySessionId: string;
  sessionDescriptionHandlerOptions:  { 
    constraints?: { audio: ConstraintsMedia, video: ConstraintsMedia }
  }
}

export const SUBSCRIPTION_CACHE_KEY = 'rc-call-subscription-key';

export class RingCentralCall extends EventEmitter {
  private _sdk: RingCentralSDK;
  private _subscriptions: RingCentralSubscriptions;
  private _webphone: RingCentralWebPhone;
  private _callControl: RingCentralCallControl;
  private _subscription: any;
  private _subscriptionCacheKey: string = SUBSCRIPTION_CACHE_KEY;
  private _subscriptionEventFilters: string[] = [];
  private _sessions: Session[];
  private _webphoneRegistered: boolean;
  private _callControlNotificationReady: boolean;
  private _enableSubscriptionHander: boolean;
  private _userAgent: string;
  private _callControlOptions: { accountLevel?: boolean; preloadSessions?: boolean; preloadDevices?: boolean; extensionInfo?: any; };
  private _webphoneInviteFromSDK: boolean;

  constructor({
    webphone,
    sdk,
    subscriptions,
    enableSubscriptionHander = true,
    userAgent,
    callControlOptions,
  }: {
    webphone?: RingCentralWebPhone;
    sdk: RingCentralSDK;
    enableSubscriptionHander?: boolean;
    subscriptions?: RingCentralSubscriptions;
    userAgent?: String;
    callControlOptions?: {
      accountLevel?: boolean;
      preloadSessions?: boolean;
      preloadDevices?: boolean;
      extensionInfo?: Extension;
    }
  }) {
    super();
    this._sessions = [];
    this._webphoneRegistered = false;
    this._callControlNotificationReady = false;
    this._enableSubscriptionHander = enableSubscriptionHander;
    this._sdk = sdk;
    this._subscriptions = subscriptions;
    this._userAgent = userAgent ? `${userAgent} ${USER_AGENT}` : USER_AGENT;
    this._callControlOptions = callControlOptions;
    this.initCallControl(sdk);
    if (webphone) {
      this.setWebphone(webphone);
    }
  }

  async makeCall(params: MakeCallParams) {
    if (params.type === 'webphone') {
      if (!this.webphone) {
        throw new Error('Web phone instance is required');
      }
      if (!this.webphoneRegistered) {
        throw new Error('webphone is not registered');
      }
      this._webphoneInviteFromSDK = true; // avoid trigger _onWebPhoneSessionInvite twice
      const webphoneSession =
        this._webphone &&
        this._webphone.userAgent.invite(params.toNumber, {
          fromNumber: params.fromNumber,
          homeCountryId: params.homeCountryId,
        } as any);
      this._webphoneInviteFromSDK = false;
      // @ts-ignore
      return this._onWebPhoneSessionInvite(webphoneSession);
    }
    const callParams: any = {};
    if (params.toNumber.length > 5) {
      callParams.phoneNumber = params.toNumber;
    } else {
      callParams.extensionNumber = params.toNumber;
    }
    const telephonySession = await this._callControl.createCall(
      params.deviceId,
      callParams
    );
    return this._onNewTelephonySession(telephonySession);
  }

  async pickupInboundCall({
    sessionId,
    toNumber,
    fromNumber,
    serverId,
    telephonySessionId,
    sessionDescriptionHandlerOptions
  }: IPickUpCallParams) {
    if (!this.webphone) {
      throw new Error('Web phone instance is required');
    }
    if (!this.webphoneRegistered) {
      throw new Error('webphone is not registered');
    }
    const session = this.sessions.find(s => s.id === telephonySessionId);
    if (!session) {
      throw new Error('call session was not found');
    }
    const extraHeaders = [
      `RC-call-type: inbound-pickup; session-id: ${sessionId}; server-id: ${serverId}`,
    ];
    const inviteOptions = {
      sessionDescriptionHandlerOptions,
      fromNumber,
      extraHeaders,
    };
    this._webphoneInviteFromSDK = true;
    const webphoneSession =
      this._webphone &&
      this._webphone.userAgent.invite(toNumber, inviteOptions);
    session.setWebphoneSession(webphoneSession);
    this._webphoneInviteFromSDK = false;
    this.emit(events.WEBPHONE_INVITE_SENT, webphoneSession);
    return session;
  }

  _onNewWebPhoneSession(webphoneSession) {
    const newSession = new Session({
      webphoneSession,
    });
    const onSessionDisconnected = () => {
      this._onSessionDisconnected(newSession);
      newSession.removeListener(
        sessionEvents.DISCONNECTED,
        onSessionDisconnected
      );
    };
    newSession.on(sessionEvents.DISCONNECTED, onSessionDisconnected);
    this._sessions.push(newSession);
    return newSession;
  }

  _onWebPhoneSessionRing = (webphoneSession: WebPhoneSession) => {
    this.emit(events.WEBPHONE_INVITE, webphoneSession);
    let session = this._getSessionFromWebphoneSession(webphoneSession);
    // @ts-ignore
    webphoneSession.__rc_direction = directions.INBOUND;
    if (session) {
      session.setWebphoneSession(webphoneSession);
      return;
    }
    session = this._onNewWebPhoneSession(webphoneSession);
    this.emit(events.NEW, session);
  };

  _onWebPhoneSessionInviteSent = (webphoneSession: WebPhoneSession) => {
    if (this._webphoneInviteFromSDK) {
      return;
    }
    this._onWebPhoneSessionInvite(webphoneSession);
  }

  _onWebPhoneSessionInvite(webphoneSession: WebPhoneSession): Session {
    this.emit(events.WEBPHONE_INVITE_SENT, webphoneSession);
    let session = this._getSessionFromWebphoneSession(webphoneSession);
    if (session && session.webphoneSession) {
      return session;
    }
    // @ts-ignore
    if (!webphoneSession.__rc_direction) {
      // @ts-ignore
      webphoneSession.__rc_direction = directions.OUTBOUND;
    }
    if (session) {
      session.setWebphoneSession(webphoneSession);
      return session;
    }
    session = this._onNewWebPhoneSession(webphoneSession);
    this.emit(events.NEW, session);
    return session;
  }

  _getSessionFromWebphoneSession(webphoneSession: WebPhoneSession) {
    const [partyData] = extractHeadersData(webphoneSession.request.headers);
    const telephonySessionId = partyData && partyData.sessionId;

    if (telephonySessionId) {
      return this.sessions.find(
        (s) => s.telephonySessionId === telephonySessionId
      );
    }

    return this.sessions.find(
      (s) => s.webphoneSession === webphoneSession
    );
  }

  _onNewTelephonySession = (telephonySession, fromPreload = false) => {
    let session = this.sessions.find(
      (s) => s.telephonySessionId === telephonySession.id
    );
    if (!session) {
      // find if there are session from initializing web phone session.
      const party = telephonySession.party;
      if (party && party.direction === directions.OUTBOUND) {
        session = this.sessions.find(
          (s) => (
            !s.telephonySessionId &&
            s.to.phoneNumber === party.to.phoneNumber &&
            s.direction === directions.OUTBOUND
          )
        );
      }
    }
    if (session) {
      session.setTelephonySession(telephonySession);
      return session;
    }
    session = new Session({
      telephonySession,
    });
    const onSessionDisconnected = () => {
      this._onSessionDisconnected(session);
      session.removeListener(sessionEvents.DISCONNECTED, onSessionDisconnected);
    };
    session.on(sessionEvents.DISCONNECTED, onSessionDisconnected);
    this._sessions.push(session);
    if (!fromPreload) {
      this.emit(events.NEW, session);
    }
    return session;
  };

  _onSessionDisconnected(session) {
    this._sessions = this._sessions.filter((s) => s !== session);
    session.dispose();
  }

  _onCallControlInitialized = () => {
    this.callControl.sessions.forEach((telephonySession) => {
      this._onNewTelephonySession(telephonySession, true);
    });
    this.emit(events.CALL_CONTROL_READY);
  };

  _onWebphoneRegistered = () => {
    if (!this._webphoneRegistered) {
      this._webphoneRegistered = true;
      this.emit(events.WEBPHONE_REGISTERED);
    }
  };

  _onWebphoneUnregistered = () => {
    this._webphoneRegistered = false;
    this.emit(events.WEBPHONE_UNREGISTERED);
  };

  _onWebphoneRegistrationFailed = (response, cause) => {
    this._webphoneRegistered = false;
    this.emit(events.WEBPHONE_REGISTRATION_FAILED, response, cause);
  };

  setWebphone(webphone) {
    this._clearWebphone();
    this._webphone = webphone;
    this._webphoneRegistered = webphone.userAgent.registerContext.registered;
    this._webphone.userAgent.on('invite', this._onWebPhoneSessionRing);
    this._webphone.userAgent.on('inviteSent', this._onWebPhoneSessionInviteSent);
    this._webphone.userAgent.on('registered', this._onWebphoneRegistered);
    this._webphone.userAgent.on('unregistered', this._onWebphoneUnregistered);
    this._webphone.userAgent.on(
      'registrationFailed',
      this._onWebphoneRegistrationFailed
    );
  }

  removeWebphone() {
    this._clearWebphone();
  }

  _clearWebphone() {
    if (!this._webphone) {
      return;
    }
    this._webphone.userAgent.removeListener(
      'invite',
      this._onWebPhoneSessionRing
    );
    this._webphone.userAgent.removeListener(
      'inviteSent',
      this._onWebPhoneSessionInviteSent
    );
    this._webphone.userAgent.removeListener(
      'registered',
      this._onWebphoneRegistered
    );
    this._webphone.userAgent.removeListener(
      'unregistered',
      this._onWebphoneUnregistered
    );
    this._webphone.userAgent.removeListener(
      'registrationFailed',
      this._onWebphoneRegistrationFailed
    );
    this._webphone = null;
    this._webphoneRegistered = false;
  }

  initCallControl(sdk: RingCentralSDK) {
    this._clearCallControl();
    this._callControl = new RingCentralCallControl({
      sdk,
      userAgent: this._userAgent,
      ...this._callControlOptions
    });
    if (this._enableSubscriptionHander) {
      this._handleSubscription();
    } else {
      this._callControlNotificationReady = true;
    }
    this._callControl.on('new', this._onNewTelephonySession);
    this._callControl.on('initialized', this._onCallControlInitialized);
  }

  async _handleSubscription() {
    if (this._subscriptions) {
      this._subscription = this._subscriptions.createSubscription();
      // @ts-ignore
    } else if (typeof this._sdk.createSubscription === 'function') {
      // @ts-ignore
      this._subscription = this._sdk.createSubscription(); // For support RC JS SDK V3
    } else {
      throw new Error('Init Error: subscriptions instance is required');
    }
    const cachedSubscriptionData = await this._sdk
      .cache()
      .getItem(this._subscriptionCacheKey);
    this._subscriptionEventFilters = [
      '/restapi/v1.0/account/~/extension/~/telephony/sessions',
    ];
    if (cachedSubscriptionData) {
      try {
        this._subscription.setSubscription(cachedSubscriptionData); // use the cache
      } catch (e) {
        console.error('Cannot set subscription from cache data', e);
        this._subscription.setEventFilters(this._subscriptionEventFilters);
      }
    } else {
      this._subscription.setEventFilters(this._subscriptionEventFilters);
    }
    this._subscription.on(
      this._subscription.events.subscribeSuccess,
      this._onSubscriptionCreateSuccess
    );
    this._subscription.on(
      this._subscription.events.renewSuccess,
      this._onSubscriptionCreateSuccess
    );
    this._subscription.on(
      this._subscription.events.notification,
      this.onNotificationEvent
    );
    this._subscription.on(
      this._subscription.events.renewError,
      this._onSubscriptionRenewFail
    );
    this._subscription.on(
      this._subscription.events.automaticRenewError,
      this._onSubscriptionAutomaticRenewError
    );
    this._subscription.on(
      this._subscription.events.subscribeError,
      this._onSubscriptionCreateError
    );
    return this._subscription.register();
  }

  _onSubscriptionCreateSuccess = () => {
    this._callControlNotificationReady = true;
    this.emit(events.CALL_CONTROL_NOTIFICATION_REDY);
    this._sdk
      .cache()
      .setItem(this._subscriptionCacheKey, this._subscription.subscription());
  };

  _onSubscriptionCreateError = () => {
    this._callControlNotificationReady = false;
    this.emit(events.CALL_CONTROL_NOTIFICATION_ERROR);
    this._sdk
      .platform()
      .loggedIn()
      .then((loggedIn) => {
        if (loggedIn) {
          this._subscription
            .reset()
            .setEventFilters(this._subscriptionEventFilters)
            .register();
        }
      });
  };

  _onSubscriptionRenewFail = () => {
    this._callControlNotificationReady = false;
    this.emit(events.CALL_CONTROL_NOTIFICATION_ERROR);
    this._sdk
      .platform()
      .loggedIn()
      .then((loggedIn) => {
        if (loggedIn) {
          this._subscription
            .reset()
            .setEventFilters(this._subscriptionEventFilters)
            .register();
        }
      });
  };

  _onSubscriptionAutomaticRenewError = () => {
    this._subscription.resubscribe();
  };

  _clearSubscriptionHander() {
    if (!this._subscription) {
      return;
    }
    this._subscription.removeListener(
      this._subscription.events.subscribeSuccess,
      this._onSubscriptionCreateSuccess
    );
    this._subscription.removeListener(
      this._subscription.events.renewSuccess,
      this._onSubscriptionCreateSuccess
    );
    this._subscription.removeListener(
      this._subscription.events.notification,
      this.onNotificationEvent
    );
    this._subscription.removeListener(
      this._subscription.events.renewError,
      this._onSubscriptionRenewFail
    );
    this._subscription.removeListener(
      this._subscription.events.automaticRenewError,
      this._onSubscriptionAutomaticRenewError
    );
    this._subscription.removeListener(
      this._subscription.events.subscribeError,
      this._onSubscriptionCreateError
    );
    this._subscription = null;
  }

  onNotificationEvent = (msg) => {
    // console.log(JSON.stringify(msg, null, 2));
    this._callControl.onNotificationEvent(msg);
  };

  loadSessions = async (sessions) => {
    await this._callControl.loadSessions(sessions);
    this._callControl.sessions.forEach((session) => {
      this._onNewTelephonySession(session, true)
    });
  }

  restoreSessions = async (sessions) => {
    await this._callControl.restoreSessions(sessions);
    this._callControl.sessions.forEach((session) => {
      this._onNewTelephonySession(session, true)
    });
  }

  _clearCallControl() {
    if (!this._callControl) {
      return;
    }
    this._callControl.removeListener('new', this._onNewTelephonySession);
    this._callControl = null;
  }

  async dispose() {
    this._clearWebphone();
    this._clearCallControl();
    this._clearSubscriptionHander();
    this.removeAllListeners();
    this.sessions.forEach((session) => {
      session.hangup();
    });
    this._sessions = [];
  }

  refreshDevices() {
    return this._callControl.refreshDevices();
  }

  /**
   *  Switch call voice transmission from other tabs or devices to current tab
   */
  async switchCall(telephonySessionId: string, options?: InviteOptions): Promise<Session> {
    const presenceRes = await this._sdk.platform().get('/restapi/v1.0/account/~/extension/~/presence?sipData=true&detailedTelephonyPresence=true');
    const presence = await presenceRes.json();
    const activeCalls = presence.activeCalls;
    const activeCall = activeCalls.find(call => call.telephonySessionId === telephonySessionId);
    return this.switchCallFromActiveCall(activeCall, options);
  }

  switchCallFromActiveCall(activeCall: ActiveCallInfo, options?: InviteOptions): Session {
    if (!this.webphone) {
      throw new Error('Webphone instance is required.');
    }
    if (!this.webphoneRegistered) {
      throw new Error('Webphone instance is not unregistered now.');
    }
    const session = this.sessions.find(s => s.id === activeCall.telephonySessionId);
    if (!session) {
      throw new Error('Telephony Session isn\'t existed.');
    }
    if (session.webphoneSession) {
      throw new Error('The call is in current instance');
    }
    this._webphoneInviteFromSDK = true;
    const webphoneSession = this.webphone.userAgent.switchFrom(activeCall, options);
    session.setWebphoneSession(webphoneSession);
    this._webphoneInviteFromSDK = false;
    return this._onWebPhoneSessionInvite(webphoneSession);
  }

  get webphone() {
    return this._webphone;
  }

  get callControl() {
    return this._callControl;
  }

  get sessions() {
    return this._sessions;
  }

  get webphoneRegistered() {
    return this._webphoneRegistered;
  }

  get callControlReady() {
    return this._callControl.ready;
  }

  get callControlNotificationReady() {
    return this._callControlNotificationReady;
  }

  get devices() {
    return this._callControl.devices || [];
  }
}
