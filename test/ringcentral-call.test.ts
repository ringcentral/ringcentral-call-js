import { RingCentralCall } from '../src/index';
import {
  events,
  SUBSCRIPTION_CACHE_KEY,
} from '../src/RingCentralCall';
import {
  directions,
  events as sessionEvents,
} from '../src/Session';
import RingCentral from './__mocks__/ringcentral';
import {
  Session as TelephonySession,
} from './__mocks__/ringcentral-call-control/lib/Session';
import RingCentralWebPhone from './__mocks__/ringcentral-web-phone';
import { WebPhoneSession } from './__mocks__/ringcentral-web-phone/lib/Session';
import Subscriptions from './__mocks__/subscriptions';

let rcCall;
let webphone;

function timeout(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

const pickupCallParams = {
  "fromNumber": "+18006245555",
  "partyId": "p-a4a0d82341f0ez18381c9e55dz38b20000-2",
  "serverId": "10.74.13.130.TAM",
  "sessionId": "35063587004",
  "telephonySessionId": "s-a4a0d82341f0ez18381c9e55dz38b20000",
  "toNumber": "+18632152222",
  "sessionDescriptionHandlerOptions": {
      "constraints": {
          "audio": {
              "deviceId": "default"
          },
          "video": false
      }
  }
}

describe('RingCentral Call ::', () => {
  describe('Enable subscription', () => {
    beforeEach(() => {
      webphone = new RingCentralWebPhone(); // mocked
      const sdk = new RingCentral({}); // mocked
      const subscriptions = new Subscriptions();
      rcCall = new RingCentralCall({
        webphone,
        sdk,
        subscriptions,
      });
    });

    test('it should be initialized', async () => {
      expect(rcCall.webphone).toEqual(webphone);
      expect(!!rcCall.callControl).toEqual(true);
      expect(rcCall.webphoneRegistered).toEqual(false);
      expect(rcCall.callControlReady).toEqual(false);
    });

    test('webphoneRegistered should be true after registered event', async () => {
      webphone.userAgent.trigger('registered');
      expect(rcCall.webphoneRegistered).toEqual(true);
    });

    test('webphoneRegistered should be false after unregistered event', async () => {
      webphone.userAgent.trigger('registered');
      expect(rcCall.webphoneRegistered).toEqual(true);
      webphone.userAgent.trigger('unregistered');
      expect(rcCall.webphoneRegistered).toEqual(false);
    });

    test('webphoneRegistered should be false after registrationFailed event', async () => {
      webphone.userAgent.trigger('registered');
      expect(rcCall.webphoneRegistered).toEqual(true);
      webphone.userAgent.trigger('registrationFailed');
      expect(rcCall.webphoneRegistered).toEqual(false);
    });

    test('should be reload sessions after call control initialized', async () => {
      rcCall.callControl.setSessions([
        new TelephonySession({
          id: '123',
          toNumber: '101',
          fromNumber: '102',
          direction: directions.INBOUND,
        })
      ]);
      rcCall.callControl.trigger('initialized');
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.devices).toEqual(rcCall.callControl.devices);
    });

    test('should make call fail with web phone unregistered', async () => {
      let hasError = false
      try {
        const session = await rcCall.makeCall(
          { toNumber: '101', fromNumber: '102', type: 'webphone' }
        );
      } catch (e) {
        hasError = true
      }
      expect(hasError).toEqual(true);
    });

    test('should pickup call fail with web phone unregistered', async () => {
      let hasError = false
      try {
        const session = await rcCall.pickupInboundCall(pickupCallParams);
      } catch (e) {
        hasError = true
      }
      expect(hasError).toEqual(true);
    });

    test('should pickup call fail when can not found rc call sessions', async () => {
      webphone.userAgent.trigger('registered')
      let hasError = false
      try {
        const session = await rcCall.pickupInboundCall(pickupCallParams);
      } catch (e) {
        hasError = true
      }
      expect(hasError).toEqual(true);
    });


    test('should pickup call succeed', async () => {
      webphone.userAgent.trigger('registered');
      const telephonySession = new TelephonySession({
        id: pickupCallParams.telephonySessionId,
        toNumber: pickupCallParams.toNumber,
        fromNumber: pickupCallParams.fromNumber,
        direction: directions.INBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].webphoneSession).not.toBeDefined();
      const session = await rcCall.pickupInboundCall(pickupCallParams);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].webphoneSession).toBeDefined();
    });
    test('should make call successfully with web phone mode', async () => {
      webphone.userAgent.trigger('registered')
      const session = await rcCall.makeCall(
        { toNumber: '101', fromNumber: '102', type: 'webphone' }
      );
      expect(rcCall.sessions.length).toEqual(1);
      expect(session.direction).toEqual(directions.OUTBOUND);
      expect(!!session.webphoneSession).toEqual(true);
    });

    test('should remove session when session disconnected with web phone mode', async () => {
      webphone.userAgent.trigger('registered')
      const session = await rcCall.makeCall(
        { toNumber: '101', fromNumber: '102', type: 'webphone' }
      );
      expect(rcCall.sessions.length).toEqual(1);
      session.emit(sessionEvents.DISCONNECTED);
      expect(rcCall.sessions.length).toEqual(0);
    });

    test('should make call successfully with callControl mode and extensionNumber', async () => {
      const session = await rcCall.makeCall(
        { toNumber: '101', deviceId: '1111', type: 'callControl' }
      );
      expect(rcCall.sessions.length).toEqual(1);
      expect(session.direction).toEqual(directions.OUTBOUND);
      expect(!!session.telephonySession).toEqual(true);
    });

    test('should make call successfully with callControl mode and phoneNumber', async () => {
      const session = await rcCall.makeCall(
        { toNumber: '1234567890', deviceId: '1111', type: 'callControl' }
      );
      expect(rcCall.sessions.length).toEqual(1);
      expect(session.direction).toEqual(directions.OUTBOUND);
      expect(!!session.telephonySession).toEqual(true);
    });

    test('should remove session when session disconnected in callControl mode', async () => {
      webphone.userAgent.trigger('registered')
      const session = await rcCall.makeCall(
        { toNumber: '1234567890', deviceId: '1111', type: 'callControl' }
      );
      expect(rcCall.sessions.length).toEqual(1);
      session.emit(sessionEvents.DISCONNECTED);
      expect(rcCall.sessions.length).toEqual(0);
    });

    test('should add new session when web phone get invite event and not existed session', () => {
      const webphoneSession = new WebPhoneSession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      });
      expect(rcCall.sessions.length).toEqual(0);
      webphone.userAgent.trigger('invite', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].direction).toEqual(directions.INBOUND);
    });

    test('should add new session when call control get new event and not existed session', () => {
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      });
      expect(rcCall.sessions.length).toEqual(0);
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
    });

    test('should add new session when call control get new event and existed session with same number', () => {
      const webphoneSession = new WebPhoneSession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.OUTBOUND,
      });
      webphoneSession.request.headers = null; // clear telephony session id in headers
      webphone.userAgent.trigger('inviteSent', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.OUTBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
    });

    test('should add new session when call control get new event and existed session with different number', () => {
      const webphoneSession = new WebPhoneSession({
        id: '1234',
        toNumber: '103',
        fromNumber: '102',
        direction: directions.OUTBOUND,
      });
      webphoneSession.request.headers = null; // clear telephony session id in headers
      webphone.userAgent.trigger('inviteSent', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.OUTBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(2);
    });

    test('should add new session when call control get new event and existed inbound session', () => {
      const webphoneSession = new WebPhoneSession({
        id: '1234',
        toNumber: '103',
        fromNumber: '101',
        direction: directions.INBOUND,
      });
      webphoneSession.request.headers = null; // clear telephony session id in headers
      webphone.userAgent.trigger('inviteSent', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.OUTBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(2);
    });

    test('should add new session when call control get new event and existed session with telephony session id', () => {
      const webphoneSession = new WebPhoneSession({
        id: '1234',
        toNumber: '103',
        fromNumber: '101',
        direction: directions.OUTBOUND,
      });
      webphone.userAgent.trigger('inviteSent', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.OUTBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(2);
    });

    test('should add new session when call control get new event and existed conference session', () => {
      const webphoneSession = new WebPhoneSession({
        id: '123',
        toNumber: 'conf_121sss',
        fromNumber: '102',
        direction: directions.OUTBOUND,
      });
      webphoneSession.request.headers = null; // clear telephony session id in headers
      webphone.userAgent.trigger('inviteSent', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: 'conference',
        fromNumber: '102',
        direction: directions.OUTBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
    });

    test('should connect webphone session when web phone get invite event and existed session', () => {
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].telephonySession).toEqual(telephonySession);
      const webphoneSession = new WebPhoneSession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      })
      webphone.userAgent.trigger('invite', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].webphoneSession).toEqual(webphoneSession);
    });

    test('should call switchCallFromActiveCall successfully', () => {
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].telephonySession).toEqual(telephonySession);
      webphone.userAgent.trigger('registered');
      const session = rcCall.switchCallFromActiveCall({
        telephonySessionId: telephonySession.id,
      });
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0]).toEqual(session);
    });

    test('should call switchCallFromActiveCall fail when web phone not ready', () => {
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].telephonySession).toEqual(telephonySession);
      let error;
      try {
        const session = rcCall.switchCallFromActiveCall({
          telephonySessionId: telephonySession.id,
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toEqual('Webphone instance is not unregistered now.');
    });

    test('should call switchCallFromActiveCall fail when not telephony session', () => {
      expect(rcCall.sessions.length).toEqual(0);
      webphone.userAgent.trigger('registered');
      let error;
      try {
        const session = rcCall.switchCallFromActiveCall({
          telephonySessionId: '1213',
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toEqual('Telephony Session isn\'t existed.');
    });

    test('should call switchCallFromActiveCall fail when has web phone session', () => {
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].telephonySession).toEqual(telephonySession);
      webphone.userAgent.trigger('registered');
      const webphoneSession = new WebPhoneSession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      })
      webphone.userAgent.trigger('invite', webphoneSession);
      let error;
      try {
        const session = rcCall.switchCallFromActiveCall({
          telephonySessionId: telephonySession.id,
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toEqual('The call is in current instance');
    });

    test('should connect telephony session when call control get new event and existed session', () => {
      const webphoneSession = new WebPhoneSession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      })
      webphone.userAgent.trigger('invite', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].webphoneSession).toEqual(webphoneSession);
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      });
      rcCall.callControl.trigger('new', telephonySession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].telephonySession).toEqual(telephonySession);
    });

    test('should clean webphone and call control when disposed', () => {
      rcCall.dispose();
      expect(rcCall.sessions.length).toEqual(0);
      expect(rcCall.webphone).toEqual(null);
      expect(rcCall.callControl).toEqual(null);
    });

    test('callControlNotification should ready when subsciption success', () => {
      expect(rcCall.callControlNotificationReady).toEqual(false);
      rcCall._subscription.trigger(rcCall._subscription.events.subscribeSuccess);
      expect(rcCall.callControlNotificationReady).toEqual(true);
    });

    test('callControlNotification should false when subsciption error', () => {
      expect(rcCall.callControlNotificationReady).toEqual(false);
      rcCall._subscription.trigger(rcCall._subscription.events.subscribeError);
      expect(rcCall.callControlNotificationReady).toEqual(false);
    });

    test('callControlNotification should false when subsciption renew error', () => {
      expect(rcCall.callControlNotificationReady).toEqual(false);
      rcCall._subscription.trigger(rcCall._subscription.events.renewError);
      expect(rcCall.callControlNotificationReady).toEqual(false);
    });

    test('should call resubscribe when subsciption auto renew error', () => {
      rcCall._subscription.resubscribe = jest.fn();
      rcCall._subscription.trigger(rcCall._subscription.events.automaticRenewError);
      expect(rcCall._subscription.resubscribe.mock.calls.length).toEqual(1);
    });

    test('should call refreshDevice in call control when refreshDevice', () => {
      rcCall.callControl.refreshDevices = jest.fn();
      rcCall.refreshDevices();
      expect(rcCall.callControl.refreshDevices.mock.calls.length).toEqual(1);
    });
  });

  describe('Disable subscription', () => {
    beforeEach(() => {
      webphone = new RingCentralWebPhone(); // mocked
      const sdk = new RingCentral({}); // mocked
      rcCall = new RingCentralCall({
        webphone,
        sdk,
        enableSubscriptionHander: false,
      });
    });

    test('should not have subscription', () => {
      expect(!!rcCall.subsciption).toEqual(false);
    });

    test('should call onNotificationEvent', () => {
      rcCall.callControl.onNotificationEvent = jest.fn();
      rcCall.onNotificationEvent({});
      expect(rcCall.callControl.onNotificationEvent.mock.calls.length).toEqual(1);
    });

    test('should dispose successfully', () => {
      rcCall.dispose();
      expect(rcCall.sessions.length).toEqual(0);
      expect(rcCall.webphone).toEqual(null);
      expect(rcCall.callControl).toEqual(null);
    });

    test('should hangup all sessions when dispose', () => {
      rcCall.callControl.setSessions([
        new TelephonySession({
          id: '123',
          toNumber: '101',
          fromNumber: '102',
          direction: directions.INBOUND,
        })
      ]);
      rcCall.callControl.trigger('initialized');
      const hangup = jest.fn();
      rcCall.sessions[0].hangup = hangup;
      rcCall.dispose();
      expect(hangup.mock.calls.length).toEqual(1);
    });
  });

  describe('Use cache subscription', () => {
    let sdk;
    let subscriptions;
    beforeEach(async () => {
      webphone = new RingCentralWebPhone(); // mocked
      sdk = new RingCentral({}); // mocked
      await sdk.cache().setItem(SUBSCRIPTION_CACHE_KEY, {});
      subscriptions = new Subscriptions();
    });

    test('it should be initialized', async () => {
      rcCall = new RingCentralCall({
        webphone,
        sdk,
        subscriptions,
      });
      await timeout(100); // wait Subscription handled;
      expect(rcCall.webphone).toEqual(webphone);
      expect(!!rcCall.callControl).toEqual(true);
      expect(rcCall.webphoneRegistered).toEqual(false);
      expect(rcCall.callControlReady).toEqual(false);
    });
  });

  describe('No web phone instance', () => {
    beforeEach(() => {
      const sdk = new RingCentral({}); // mocked
      const subscriptions = new Subscriptions();
      rcCall = new RingCentralCall({ sdk, subscriptions });
    });

    test('it should be initialized', async () => {
      expect(!!rcCall.callControl).toEqual(true);
      expect(rcCall.webphoneRegistered).toEqual(false);
      expect(rcCall.callControlReady).toEqual(false);
    });

    test('should make call successfully with callControl mode and extensionNumber', async () => {
      const session = await rcCall.makeCall(
        { toNumber: '101', deviceId: '1111', type: 'callControl' }
      );
      expect(rcCall.sessions.length).toEqual(1);
      expect(session.direction).toEqual(directions.OUTBOUND);
      expect(!!session.telephonySession).toEqual(true);
    });

    test('should alert message when make call with webphone mode', async () => {
      let error = null;
      try {
        const session = await rcCall.makeCall(
          { toNumber: '101', type: 'webphone' }
        );
      } catch (e) {
        error = e.message;
      }
      expect(error).toEqual('Web phone instance is required');
    });

    test('should alert message when pickup call without webphone mode', async () => {
      let error = null;
      try {
        const session = await rcCall.pickupInboundCall(pickupCallParams);
      } catch (e) {
        error = e.message;
      }
      expect(error).toEqual('Web phone instance is required');
    });

    test('should call switchCallFromActiveCall fail when no web phone', () => {
      let error;
      try {
        const session = rcCall.switchCallFromActiveCall({
          telephonySessionId: '1213',
        });
      } catch (e) {
        error = e.message;
      }
      expect(error).toEqual('Webphone instance is required.');
    });

    test('should call loadSessions successfully', () => {
      const noError = true;
      rcCall.loadSessions();
      expect(noError).toEqual(true);
    });

    test('should call restoreSessions successfully', () => {
      const noError = true;
      rcCall.restoreSessions();
      expect(noError).toEqual(true);
    });
  });

  describe('UserAgent', () => {
    beforeEach(() => {
      const sdk = new RingCentral({}); // mocked
      const subscriptions = new Subscriptions();
      webphone = new RingCentralWebPhone(); // mocked
      rcCall = new RingCentralCall({
        webphone,
        sdk,
        subscriptions,
        userAgent: 'TestUserAgent'
      });
    });

    test('it should be initialized', async () => {
      expect(!!rcCall.callControl).toEqual(true);
      expect(rcCall.webphoneRegistered).toEqual(false);
      expect(rcCall.callControlReady).toEqual(false);
      expect(rcCall._userAgent).toContain('TestUserAgent');
    });
  });

  describe("Webphone invite & invite sent emit event", () => {
    beforeEach(() => {
      const sdk = new RingCentral({}); // mocked
      const subscriptions = new Subscriptions();
      webphone = new RingCentralWebPhone(); // mocked
      rcCall = new RingCentralCall({
        webphone,
        sdk,
        subscriptions,
        userAgent: "TestUserAgent",
      });
    });

    test("trigger invite should emit webphone-invite event", async () => {
      const webphoneSession = new WebPhoneSession({
        id: "123",
        toNumber: "101",
        fromNumber: "102",
        direction: directions.INBOUND,
      });
      let invite = false;
      rcCall.on(events.WEBPHONE_INVITE, () => {
        invite = true;
      });
      webphone.userAgent.trigger("invite", webphoneSession);
      expect(invite).toBe(true);
    });

    test("trigger invite sent should emit webphone-invite-sent event", async () => {
      const webphoneSession = new WebPhoneSession({
        id: "123",
        toNumber: "101",
        fromNumber: "102",
        direction: directions.OUTBOUND,
      });
      let inviteSent = false;
      rcCall.on(events.WEBPHONE_INVITE_SENT, () => {
        inviteSent = true;
      });
      webphone.userAgent.trigger("inviteSent", webphoneSession);
      expect(inviteSent).toBe(true);
    });
  });
});
