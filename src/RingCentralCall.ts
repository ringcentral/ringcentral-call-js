import { EventEmitter } from 'events';
import { SDK as RingCentralSDK } from '@ringcentral/sdk';
import { Subscriptions as RingCentralSubscriptions } from "@ringcentral/subscriptions";
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
  CALL_CONTROL_READY = 'call-control-ready',
  CALL_CONTROL_NOTIFICATION_REDY = 'call-control-notification-ready',
  CALL_CONTROL_NOTIFICATION_ERROR = 'call-control-notification-error',
};

export class RingCentralCall extends EventEmitter {
  private _sdk: RingCentralSDK;
  private _subscriptions: RingCentralSubscriptions;
  private _webphone: RingCentralWebPhone;
  private _callControl: RingCentralCallControl;
  private _subscription: any;
  private _subscriptionCacheKey: string = 'rc-call-subscription-key';
  private _subscriotionEventFilters: string[] = [];
  private _sessions: Session[];
  private _webphoneRegistered: boolean;
  private _callControlNotificationReady: boolean;
  private _enableSubscriptionHander: boolean;

  constructor({
    webphone,
    sdk,
    subscriptions,
    enableSubscriptionHander = true,
  } : {
    webphone: RingCentralWebPhone;
    sdk: RingCentralSDK;
    enableSubscriptionHander?: boolean;
    subscriptions?: RingCentralSubscriptions;
  }) {
    super();
    this._sessions = [];
    this._webphoneRegistered = false;
    this._callControlNotificationReady = false;
    this._enableSubscriptionHander = enableSubscriptionHander;
    this._sdk = sdk;
    this._subscriptions = subscriptions;

    this.initCallControl(sdk);
    if (webphone) {
      this.setWebphone(webphone);
    }
  }

  async makeCall(params : MakeCallParams) {
    if (params.type === 'webphone') {
      if (!this.webphoneRegistered) {
        throw(new Error('webphone is not registered'));
      }
      const webphoneSession = this._webphone && this._webphone.userAgent.invite(params.toNumber, {
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
    const telephonySession = await this._callControl.createCall(params.deviceId, callParams);
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

  _onNewTelephonySession = (telephonySession, fromPreload = false) => {
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
    if (!fromPreload) {
      // @ts-ignore
      this.emit(events.NEW, session);
    }
    return session;
  }

  _onSessionDisconnected(session) {
    this._sessions = this._sessions.filter(s => s !== session);
    session.dispose();
  }

  _onCallControlInitialized = () => {
    this.callControl.sessions.forEach((telephonySession) => {
      this._onNewTelephonySession(telephonySession, true);
    });
    // @ts-ignore
    this.emit(events.CALL_CONTROL_READY);
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
    this._clearWebphone();
    this._webphone = webphone;
    this._webphoneRegistered = webphone.userAgent.registerContext.registered;
    this._webphone.userAgent.on('invite', this._onWebPhoneSessionRing);
    this._webphone.userAgent.on('registered', this._onWebphoneRegistered);
    this._webphone.userAgent.on('unregistered', this._onWebphoneUnregistered);
    this._webphone.userAgent.on('registrationFailed', this._onWebphoneRegistrationFailed);
  }

  _clearWebphone() {
    if (!this._webphone) {
      return;
    }
    // @ts-ignore
    this._webphone.userAgent.removeListener('invite', this._onWebPhoneSessionRing);
    // @ts-ignore
    this._webphone.userAgent.removeListener('registered', this._onWebphoneRegistered);
    // @ts-ignore
    this._webphone.userAgent.removeListener('unregistered', this._onWebphoneUnregistered);
    // @ts-ignore
    this._webphone.userAgent.removeListener('registrationFailed', this._onWebphoneRegistrationFailed);
    this._webphone = null;
    this._webphoneRegistered = false;
  }

  initCallControl(sdk: RingCentralSDK) {
    this._clearCallControl();
    this._callControl = new RingCentralCallControl({ sdk });
    if (this._enableSubscriptionHander) {
      this._handleSubscription();
    } else {
      this._callControlNotificationReady = true;
    }
    // @ts-ignore
    this._callControl.on('new', this._onNewTelephonySession);
    // @ts-ignore
    this._callControl.on('initialized', this._onCallControlInitialized);
  }

  _handleSubscription() {
    if (this._subscriptions) {
      this._subscription = this._subscriptions.createSubscription();
      // @ts-ignore
    } else if (typeof this._sdk.createSubscription === 'function') {
      // @ts-ignore
      this._subscription = this._sdk.createSubscription(); // For support RC JS SDK V3
    } else {
      throw new Error('Init Error: subscriptions instance is required');
    }
    const cachedSubscriptionData = this._sdk.cache().getItem(this._subscriptionCacheKey);
    this._subscriotionEventFilters = ['/restapi/v1.0/account/~/extension/~/telephony/sessions'];
    if (cachedSubscriptionData) {
      try {
        this._subscription.setSubscription(cachedSubscriptionData); // use the cache
      } catch (e) {
        console.error('Cannot set subscription from cache data', e);
        this._subscription.setEventFilters(this._subscriotionEventFilters);
      }
    } else {
      this._subscription.setEventFilters(this._subscriotionEventFilters);
    }
    this._subscription.on(this._subscription.events.subscribeSuccess, this._onSubscriptionCreateSuccess);
    this._subscription.on(this._subscription.events.renewSuccess, this._onSubscriptionCreateSuccess);
    this._subscription.on(this._subscription.events.notification, this.onNotificationEvent);
    this._subscription.on(this._subscription.events.renewError, this._onSubscriptionRenewFail);
    this._subscription.on(this._subscription.events.automaticRenewError, this._onSubscriptionAutomaticRenewError);
    this._subscription.on(this._subscription.events.subscribeError, this._onSubscriptionCreateError);
    return this._subscription.register();
  }

  _onSubscriptionCreateSuccess = () => {
    this._callControlNotificationReady = true;
    // @ts-ignore
    this.emit(events.CALL_CONTROL_NOTIFICATION_REDY);
    this._sdk.cache().setItem(this._subscriptionCacheKey, this._subscription.subscription());
  }

  _onSubscriptionCreateError = () => {
    this._callControlNotificationReady = false;
    // @ts-ignore
    this.emit(events.CALL_CONTROL_NOTIFICATION_ERROR);
    this._sdk.platform().loggedIn().then((loggedIn) => {
      if (loggedIn) {
        this._subscription.reset().setEventFilters(this._subscriotionEventFilters).register();
      }
    });
  }

  _onSubscriptionRenewFail = () => {
    this._callControlNotificationReady = false;
    // @ts-ignore
    this.emit(events.CALL_CONTROL_NOTIFICATION_ERROR);
    this._sdk.platform().loggedIn().then((loggedIn) => {
      if (loggedIn) {
        this._subscription.reset().setEventFilters(this._subscriotionEventFilters).register();
      }
    });
  }

  _onSubscriptionAutomaticRenewError = () => {
    this._subscription.resubscribe();
  }

  _clearSubscriptionHander() {
    if (!this._subscription) {
      return;
    }
    this._subscription.removeListener(this._subscription.events.subscribeSuccess, this._onSubscriptionCreateSuccess);
    this._subscription.removeListener(this._subscription.events.renewSuccess, this._onSubscriptionCreateSuccess);
    this._subscription.removeListener(this._subscription.events.notification, this.onNotificationEvent);
    this._subscription.removeListener(this._subscription.events.renewError, this._onSubscriptionRenewFail);
    this._subscription.removeListener(this._subscription.events.automaticRenewError, this._onSubscriptionAutomaticRenewError);
    this._subscription.removeListener(this._subscription.events.subscribeError, this._onSubscriptionCreateError);
    this._subscription = null;
  }

  onNotificationEvent = (msg) => {
    this._callControl.onNotificationEvent(msg)
  }

  _clearCallControl() {
    if (!this._callControl) {
      return;
    }
    // @ts-ignore
    this._callControl.removeListener('new', this._onNewTelephonySession);
    this._callControl = null;
  }

  async dispose() {
    this._clearWebphone();
    this._clearCallControl();
    this._clearSubscriptionHander();
    // @ts-ignore
    this.removeAllListeners();
    this.sessions.forEach((session) => {
      session.hangup()
    });
    this._sessions = [];
  }

  refreshDevices() {
    return this._callControl.refreshDevices();
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
    return !!(this._callControl && this._callControl.ready);
  }

  get callControlNotificationReady() {
    return this._callControlNotificationReady;
  }

  get devices() {
    return this._callControl && this._callControl.devices || [];
  }
}
