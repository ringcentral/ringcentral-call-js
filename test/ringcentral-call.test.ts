import { RingCentralCall, events } from '../src/RingCentralCall';
import { directions, events as sessionEvents } from '../src/Session';
import RingCentralWebPhone from './__mocks__/ringcentral-web-phone';
import { WebPhoneSession } from './__mocks__/ringcentral-web-phone/lib/Session';
import { Session as TelephonySession } from './__mocks__/ringcentral-call-control/lib/Session';
import RingCentral from './__mocks__/ringcentral';
import Subscriptions from './__mocks__/subscriptions';

let rcCall;
let webphone;

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

    test('should make call successfull with web phone mode', async () => {
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
      })
      expect(rcCall.sessions.length).toEqual(0);
      webphone.userAgent.trigger('invite', webphoneSession);
      expect(rcCall.sessions.length).toEqual(1);
      expect(rcCall.sessions[0].direction).toEqual(directions.INBOUND);
    });

    test('should add new session when call control get new event and not existed session', () => {
      const telphonySession = new TelephonySession({
        id: '123',
        toNumber: '101',
        fromNumber: '102',
        direction: directions.INBOUND,
      })
      expect(rcCall.sessions.length).toEqual(0);
      rcCall.callControl.trigger('new', telphonySession);
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
