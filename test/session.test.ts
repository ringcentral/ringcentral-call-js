import { Session } from '../src/Session';
import { WebPhoneSession } from './__mocks__/ringcentral-web-phone/lib/Session';

describe('RingCentral Call :: Session ::', () => {
  test('it should be initialzed', () => {
    const webphoneSession = new WebPhoneSession({ id: '123', fromNumber: '101', toNumber: '102' });
    const session = new Session({
      webphoneSession,
    });
    expect(session.webphoneSession).toEqual(webphoneSession);
  });
});
