import { Session } from '../src/Session';
import { WebPhoneSession } from './__mocks__/ringcentral-web-phone/lib/Session';
import { Session as TelephonySession } from './__mocks__/ringcentral-call-control/lib/Session';

describe('RingCentral Call :: Session ::', () => {
  test('it should be initialzed with web phone session', () => {
    const webphoneSession = new WebPhoneSession({ id: '123', fromNumber: '101', toNumber: '102' });
    const session = new Session({
      webphoneSession,
    });
    expect(session.webphoneSession).toEqual(webphoneSession);
  });

  test('it should be initialzed with telephony session', () => {
    const telephonySession = new TelephonySession({ id: '123', fromNumber: '101', toNumber: '102' });
    const session = new Session({
      telephonySession,
    });
    expect(session.telephonySession).toEqual(telephonySession);
  });
});
