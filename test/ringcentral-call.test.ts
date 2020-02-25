import { RingCentralCall } from '../src/RingCentralCall';
import RingCentralWebPhone from 'ringcentral-web-phone';
import RingCentral from 'ringcentral';

let rcCall;

describe('RingCentral Call ::', () => {
  test('it should be initialzed', async () => {
    const webphone = new RingCentralWebPhone(); // mocked
    const sdk = new RingCentral({}); // mocked

    rcCall = new RingCentralCall({
      webphone,
      sdk,
    });
    expect(rcCall.webphone).toEqual(webphone);
  })
});
