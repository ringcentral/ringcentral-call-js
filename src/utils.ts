import { ReplyWithTextParams } from 'ringcentral-call-control/lib/Session';

const STRING_CAMELIZE_REGEXP_1 = /(\-|\_|\.|\s)+(.)?/g;
const STRING_CAMELIZE_REGEXP_2 = /(^|\/)([A-Z])/g;

export function camelize(key) {
  return key
    .replace(STRING_CAMELIZE_REGEXP_1, (match, separator, chr) =>
      chr ? chr.toUpperCase() : '',
    )
    .replace(STRING_CAMELIZE_REGEXP_2, (match, separator, chr) =>
      match.toLowerCase(),
    );
}

export function extractHeadersData(headers) {
  let partyData;
  let callId;

  if (
    headers &&
    headers['P-Rc-Api-Ids'] &&
    headers['P-Rc-Api-Ids'][0] &&
    headers['P-Rc-Api-Ids'][0].raw
  ) {
    /**
     * interface PartyData {
     *  "partyId": String,
     *  "sessionId": String
     * }
     *
     * INFO: partyId is ID of the participant in current Session. Mostly it represents User on the call,
     * it could be active participant (talking right now) or already disconnected User,
     * e.g. who made a transfer to another person.
     * To identify the User who owns the party you need to find owner.extensionId within party.
     */
    partyData = headers['P-Rc-Api-Ids'][0].raw
      .split(';')
      .map((sub) => sub.split('='))
      .reduce((accum, [key, value]) => {
        accum[camelize(key)] = value;
        return accum;
      }, {}) || {};
    if (
      headers &&
      headers['Call-ID'] &&
      headers['Call-ID'][0] &&
      headers['Call-ID'][0].raw
    ) {
      callId = headers['Call-ID'][0].raw;
    }
  }

  return [partyData, callId];
}

export function getWebphoneReplyMessageOption(params: ReplyWithTextParams) {
  return {
    replyText: params.replyWithText,
    timeValue: params.replyWithPattern.time,
    timeUnits: params.replyWithPattern.timeUnit,
    // callbackDirection: params.replyWithPattern.pattern;
  };
}
