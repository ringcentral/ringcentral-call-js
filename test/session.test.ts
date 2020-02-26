import { Session, directions, events } from '../src/Session';
import { WEBPHONE_REPLY_TYPE, WEBPHONE_REPLY_TIMEUNIT } from '../src/utils';
import { WebPhoneSession } from './__mocks__/ringcentral-web-phone/lib/Session';
import { Session as TelephonySession, PartyStatusCode, ReplyWithPattern } from './__mocks__/ringcentral-call-control/lib/Session';

describe('RingCentral Call :: Session', () => {
  describe('Initialize', () => {
    test('it should be initialzed with web phone session', () => {
      const webphoneSession = new WebPhoneSession({
        id: '123', fromNumber: '101', toNumber: '102', direction: directions.OUTBOUND,
      });
      const session = new Session({
        webphoneSession,
      });
      expect(session.webphoneSession).toEqual(webphoneSession);
      expect(session.id).toEqual('123');
      expect(session.status).toEqual(PartyStatusCode.setup);
      expect(session.to.phoneNumber).toEqual('102');
      expect(session.from.phoneNumber).toEqual('101');
      expect(session.direction).toEqual(directions.OUTBOUND);
      expect(session.webphoneSessionConnected).toEqual(true);
      expect(session.party).toEqual(null);
      expect(session.otherParties.length).toEqual(0);
      expect(session.recordings.length).toEqual(0);
    });
  
    test('it should be initialzed with telephony session', () => {
      const telephonySession = new TelephonySession({
        id: '123',
        toNumber: '1234',
        fromNumber: '12345',
        direction: directions.OUTBOUND,
        status: PartyStatusCode.proceeding,
      });
      const session = new Session({
        telephonySession,
      });
      expect(session.telephonySession).toEqual(telephonySession);
      expect(session.id).toEqual(telephonySession.id);
      expect(session.telephonySessionId).toEqual(telephonySession.id);
      expect(session.status).toEqual(PartyStatusCode.proceeding);
      expect(session.to.phoneNumber).toEqual(telephonySession.party.to.phoneNumber);
      expect(session.from.phoneNumber).toEqual(telephonySession.party.from.phoneNumber);
      expect(session.direction).toEqual(directions.OUTBOUND);
      expect(session.webphoneSessionConnected).toEqual(false);
      expect(session.party).toEqual(telephonySession.party);
      expect(session.otherParties).toEqual(telephonySession.otherParties);
      expect(session.recordings).toEqual(telephonySession.recordings);
    });
  
    test('it should set telephony session successfully', () => {
      const webphoneSession = new WebPhoneSession({
        id: '123',
        fromNumber: '101', 
        toNumber: '102',
        direction: directions.OUTBOUND
      });
      const session = new Session({
        webphoneSession,
      });
      const telephonySession = new TelephonySession({
        id: '123',
        fromNumber: '101',
        toNumber: '102',
        direction: directions.OUTBOUND,
      });
      session.setTelephonySession(telephonySession)
      expect(session.telephonySession).toEqual(telephonySession);
      expect(session.telephonySessionId).toEqual(telephonySession.id);
      expect(session.to.phoneNumber).toEqual(telephonySession.party.to.phoneNumber);
      expect(session.from.phoneNumber).toEqual(telephonySession.party.from.phoneNumber);
      expect(session.direction).toEqual(directions.OUTBOUND);
    });
  
    test('it should set webphone session successfully', () => {
      const telephonySession = new TelephonySession({
        id: '123',
        status: PartyStatusCode.proceeding,
        fromNumber: '101',
        toNumber: '102',
        direction: directions.OUTBOUND,
      });
      const session = new Session({
        telephonySession,
      });
      const webphoneSession = new WebPhoneSession({
        id: '123',
        fromNumber: '101', 
        toNumber: '102',
        direction: directions.OUTBOUND
      });
      session.setWebphoneSession(webphoneSession)
      expect(session.webphoneSession).toEqual(webphoneSession);
      expect(session.webphoneSessionConnected).toEqual(true);
    });
  });
  
  describe('Webphone status changed', () => {
    let session;
    let webphoneSession;
    beforeEach(() => {
      webphoneSession = new WebPhoneSession({
        id: '123', fromNumber: '101', toNumber: '102', direction: directions.OUTBOUND,
      });
      session = new Session({
        webphoneSession,
      });
    });

    test('status should change to answered when accepted event', () => {
      webphoneSession.trigger('accepted', {});
      expect(session.status).toEqual(PartyStatusCode.answered);
    });

    test('status should change to proceeding when progress event', () => {
      webphoneSession.trigger('progress', {});
      expect(session.status).toEqual(PartyStatusCode.proceeding);
    });

    test('status should emit disconnected when terminated event', () => {
      let emited = false;
      session.on(events.DISCONNECTED, () => {
        emited = true;
      });
      webphoneSession.trigger('terminated', {});
      expect(session.status).toEqual(PartyStatusCode.disconnected);
      expect(session.webphoneSession).toEqual(null);
      expect(emited).toEqual(true);
    });

    test('should only clean web phone session when telephony session exists', () => {
      let emited = false;
      session.on(events.DISCONNECTED, () => {
        emited = true;
      });
      const telephonySession = new TelephonySession({
        id: '123',
        fromNumber: '101',
        toNumber: '102',
        direction: directions.OUTBOUND,
      });
      session.setTelephonySession(telephonySession)
      webphoneSession.trigger('terminated', {});
      expect(session.webphoneSession).toEqual(null);
      expect(emited).toEqual(false);
    });
  });

  describe('Telephony status changed', () => {
    let session;
    let telephonySession;
    beforeEach(() => {
      telephonySession = new TelephonySession({
        id: '123',
        status: PartyStatusCode.proceeding,
        fromNumber: '101',
        toNumber: '102',
        direction: directions.OUTBOUND,
      });
      session = new Session({
        telephonySession,
      });
    });

    test('should update status successfully', () => {
      let emited = false;
      session.on(events.STATUS, () => {
        emited = true;
      });
      telephonySession.trigger('status', { party: {} });
      expect(emited).toEqual(true);
    });

    test('should emit disconnected and remove telephonySession successfully on disconnected without webphoneSession', () => {
      let emited = false;
      telephonySession.setParty({
        ...telephonySession.party,
        status: {
          code: PartyStatusCode.disconnected
        };
      });
      session.on(events.DISCONNECTED, () => {
        emited = true;
      });
      telephonySession.trigger('status', { party: {} });
      expect(session.telephonySession).toEqual(null);
      expect(emited).toEqual(true);
    });

    test('should not disconnected with webphoneSession on disconnected', () => {
      let emited = false;
      telephonySession.setParty({
        ...telephonySession.party,
        status: {
          code: PartyStatusCode.disconnected
        };
      });
      const webphoneSession = new WebPhoneSession({
        id: '123',
        fromNumber: '101', 
        toNumber: '102',
        direction: directions.OUTBOUND
      });
      session.setWebphoneSession(webphoneSession)
      session.on(events.DISCONNECTED, () => {
        emited = true;
      });
      telephonySession.trigger('status', { party: {} });
      expect(session.telephonySession).toEqual(null);
      expect(emited).toEqual(false);
    });
  });

  describe('TelephonySession without party', () => {
    let session;
    let telephonySession;
    beforeEach(() => {
      telephonySession = new TelephonySession({
        id: '123',
        status: PartyStatusCode.proceeding,
        fromNumber: '101',
        toNumber: '102',
        direction: directions.OUTBOUND,
      });
      telephonySession.setParty(null);
      session = new Session({
        telephonySession,
      });
    });

    test('should return empty from and to', () => {
      expect(Object.keys(session.from).length).toEqual(0);
      expect(Object.keys(session.to).length).toEqual(0);
    });
  });

  describe('API without web phone session', () => {
    let session;
    let telephonySession;
    beforeEach(() => {
      telephonySession = new TelephonySession({
        id: '123',
        status: PartyStatusCode.proceeding,
        fromNumber: '101',
        toNumber: '102',
        direction: directions.OUTBOUND,
      });
      session = new Session({
        telephonySession,
      });
    });

    test('should call drop in telephonySession', () => {
      telephonySession.drop = jest.fn();
      session.hangup();
      expect(telephonySession.drop.mock.calls.length).toEqual(1);
    });

    test('should call hold in telephonySession', () => {
      telephonySession.hold = jest.fn();
      session.hold();
      expect(telephonySession.hold.mock.calls.length).toEqual(1);
    });

    test('should call unhold in telephonySession', () => {
      telephonySession.unhold = jest.fn();
      session.unhold();
      expect(telephonySession.unhold.mock.calls.length).toEqual(1);
    });

    test('should call toVoicemail in telephonySession', () => {
      telephonySession.toVoicemail = jest.fn();
      session.toVoicemail();
      expect(telephonySession.toVoicemail.mock.calls.length).toEqual(1);
    });

    test('should call ignore in telephonySession when reject', () => {
      telephonySession.ignore = jest.fn();
      session.reject({ deviceId: '123' });
      expect(telephonySession.ignore.mock.calls.length).toEqual(1);
    });

    test('should call answer in telephonySession when answer', () => {
      telephonySession.answer = jest.fn();
      session.answer({ deviceId: '123' });
      expect(telephonySession.answer.mock.calls.length).toEqual(1);
    });

    test('should call reply in telephonySession when reply', () => {
      telephonySession.reply = jest.fn();
      session.replyWithMessage({});
      expect(telephonySession.reply.mock.calls.length).toEqual(1);
    });

    test('should call forward with extension number in telephonySession', () => {
      telephonySession.forward = jest.fn();
      session.forward('102');
      expect(telephonySession.forward.mock.calls.length).toEqual(1);
      expect(telephonySession.forward.mock.calls[0][0].extensionNumber).toEqual('102');
    });

    test('should call forward with phone number in telephonySession', () => {
      telephonySession.forward = jest.fn();
      session.forward('12345678901');
      expect(telephonySession.forward.mock.calls.length).toEqual(1);
      expect(telephonySession.forward.mock.calls[0][0].phoneNumber).toEqual('12345678901');
    });

    test('should call transfer with extension number in telephonySession', () => {
      telephonySession.transfer = jest.fn();
      session.transfer('102');
      expect(telephonySession.transfer.mock.calls.length).toEqual(1);
      expect(telephonySession.transfer.mock.calls[0][0].extensionNumber).toEqual('102');
    });

    test('should call transfer with phone number in telephonySession', () => {
      telephonySession.transfer = jest.fn();
      session.transfer('12345678901');
      expect(telephonySession.transfer.mock.calls.length).toEqual(1);
      expect(telephonySession.transfer.mock.calls[0][0].phoneNumber).toEqual('12345678901');
    });

    test('should call park in telephonySession', () => {
      telephonySession.park = jest.fn();
      session.park();
      expect(telephonySession.park.mock.calls.length).toEqual(1);
    });

    test('should call flip in telephonySession', () => {
      telephonySession.flip = jest.fn();
      session.flip({ callFlipId: '123' });
      expect(telephonySession.flip.mock.calls.length).toEqual(1);
      expect(telephonySession.flip.mock.calls[0][0].callFlipId).toEqual('123');
    });

    test('should call mute in telephonySession', () => {
      telephonySession.mute = jest.fn();
      session.mute();
      expect(telephonySession.mute.mock.calls.length).toEqual(1);
    });

    test('should call unmute in telephonySession', () => {
      telephonySession.unmute = jest.fn();
      session.unmute();
      expect(telephonySession.unmute.mock.calls.length).toEqual(1);
    });

    test('should call createRecord in telephonySession when no recordingId', () => {
      telephonySession.createRecord = jest.fn();
      session.startRecord();
      expect(telephonySession.createRecord.mock.calls.length).toEqual(1);
    });

    test('should call resumeRecord in telephonySession when recordingId existed', () => {
      telephonySession.resumeRecord = jest.fn();
      session.startRecord({ recordingId: '123' });
      expect(telephonySession.resumeRecord.mock.calls.length).toEqual(1);
    });

    test('should call pauseRecord in telephonySession when recordingId existed', () => {
      telephonySession.pauseRecord = jest.fn();
      session.stopRecord({ recordingId: '123' });
      expect(telephonySession.pauseRecord.mock.calls.length).toEqual(1);
    });

    test('should not call pauseRecord in telephonySession when no recordingId', () => {
      telephonySession.pauseRecord = jest.fn();
      session.stopRecord();
      expect(telephonySession.pauseRecord.mock.calls.length).toEqual(0);
    });
  });

  describe('API without telephony session', () => {
    let session;
    let webphoneSession;
    beforeEach(() => {
      webphoneSession = new WebPhoneSession({
        id: '123',
        fromNumber: '101', 
        toNumber: '102',
        direction: directions.OUTBOUND
      });
      session = new Session({
        webphoneSession,
      });
    });

    test('should call terminate in webphoneSession', () => {
      webphoneSession.terminate = jest.fn();
      session.hangup();
      expect(webphoneSession.terminate.mock.calls.length).toEqual(1);
    });

    test('should call hold in webphoneSession', () => {
      webphoneSession.hold = jest.fn();
      session.hold();
      expect(webphoneSession.hold.mock.calls.length).toEqual(1);
    });

    test('should call unhold in webphoneSession', () => {
      webphoneSession.unhold = jest.fn();
      session.unhold();
      expect(webphoneSession.unhold.mock.calls.length).toEqual(1);
    });

    test('should call toVoicemail in webphoneSession', () => {
      webphoneSession.toVoicemail = jest.fn();
      session.toVoicemail();
      expect(webphoneSession.toVoicemail.mock.calls.length).toEqual(1);
    });

    test('should call reject in webphoneSession', () => {
      webphoneSession.reject = jest.fn();
      session.reject();
      expect(webphoneSession.reject.mock.calls.length).toEqual(1);
    });

    test('should call accept in webphoneSession', () => {
      webphoneSession.accept = jest.fn();
      session.answer();
      expect(webphoneSession.accept.mock.calls.length).toEqual(1);
    });

    test('should call replyWithMessage in webphoneSession', () => {
      webphoneSession.replyWithMessage = jest.fn();
      session.replyWithMessage({ replyWithText: 'Hi' });
      expect(webphoneSession.replyWithMessage.mock.calls.length).toEqual(1);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].replyType).toEqual(WEBPHONE_REPLY_TYPE.customMessage);
    });

    test('should call replyWithMessage with pattern in webphoneSession', () => {
      webphoneSession.replyWithMessage = jest.fn();
      session.replyWithMessage({ replyWithPattern: { pattern: ReplyWithPattern.onMyWay } });
      expect(webphoneSession.replyWithMessage.mock.calls.length).toEqual(1);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].replyType).toEqual(WEBPHONE_REPLY_TYPE.onMyWay);
    });

    test('should call replyWithMessage with pattern in webphoneSession', () => {
      webphoneSession.replyWithMessage = jest.fn();
      session.replyWithMessage({ replyWithPattern: { pattern: ReplyWithPattern.inAMeeting } });
      expect(webphoneSession.replyWithMessage.mock.calls.length).toEqual(1);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].replyType).toEqual(WEBPHONE_REPLY_TYPE.inAMeeting);
    });

    test('should call replyWithMessage with callMe in webphoneSession', () => {
      webphoneSession.replyWithMessage = jest.fn();
      session.replyWithMessage({
        replyWithPattern: { pattern: ReplyWithPattern.callMeBack, timeUnit: 'Minute', time: 10 }
      });
      expect(webphoneSession.replyWithMessage.mock.calls.length).toEqual(1);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].replyType).toEqual(WEBPHONE_REPLY_TYPE.callBack);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].timeValue).toEqual(10);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].timeUnits).toEqual(WEBPHONE_REPLY_TIMEUNIT.Minute);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].callbackDirection).toEqual(0);
    });

    test('should call replyWithMessage with callYou in webphoneSession', () => {
      webphoneSession.replyWithMessage = jest.fn();
      session.replyWithMessage({
        replyWithPattern: { pattern: ReplyWithPattern.willCallYouBack, timeUnit: 'Minute', time: 10 }
      });
      expect(webphoneSession.replyWithMessage.mock.calls.length).toEqual(1);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].replyType).toEqual(WEBPHONE_REPLY_TYPE.callBack);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].timeValue).toEqual(10);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].timeUnits).toEqual(WEBPHONE_REPLY_TIMEUNIT.Minute);
      expect(webphoneSession.replyWithMessage.mock.calls[0][0].callbackDirection).toEqual(1);
    });

    test('should call forward in webphoneSession', () => {
      webphoneSession.forward = jest.fn();
      session.forward('123', {});
      expect(webphoneSession.forward.mock.calls.length).toEqual(1);
    });

    test('should call transfer in webphoneSession', () => {
      webphoneSession.transfer = jest.fn();
      session.transfer('123', {});
      expect(webphoneSession.transfer.mock.calls.length).toEqual(1);
    });

    test('should call park in webphoneSession', () => {
      webphoneSession.park = jest.fn();
      session.park();
      expect(webphoneSession.park.mock.calls.length).toEqual(1);
    });

    test('should call flip in webphoneSession', () => {
      webphoneSession.flip = jest.fn();
      session.flip({ callFlipId: '123' });
      expect(webphoneSession.flip.mock.calls.length).toEqual(1);
    });

    test('should call mute in webphoneSession', () => {
      webphoneSession.mute = jest.fn();
      session.mute();
      expect(webphoneSession.mute.mock.calls.length).toEqual(1);
    });

    test('should call unmute in webphoneSession', () => {
      webphoneSession.unmute = jest.fn();
      session.unmute();
      expect(webphoneSession.unmute.mock.calls.length).toEqual(1);
    });

    test('should call startRecord in webphoneSession', () => {
      webphoneSession.startRecord = jest.fn();
      session.startRecord();
      expect(webphoneSession.startRecord.mock.calls.length).toEqual(1);
    });

    test('should call stopRecord in webphoneSession', () => {
      webphoneSession.stopRecord = jest.fn();
      session.stopRecord();
      expect(webphoneSession.stopRecord.mock.calls.length).toEqual(1);
    });
  });
});
