# RingCentral Call JS SDK

RingCentral Call aims to help developers to make and control call easily with RingCentral Web Phone and Call Control APIs. In this SDK, we use Web Phone for voice transmission, use Call Control API for call control.

## Prerequisites

* You will need an active RingCentral account to create RingCentral app. Don't have an account? [Get your Free RingCentral Developer Account Now!](https://developers.ringcentral.com/)
* A RingCentral app
    * App type: Browser-Based or Server/Web
    * Permissions: 'Active Call Control', 'Read Accounts', 'Read Presence', 'Webhook Subscriptions', 'VoIP'

## Install

Use npm or yarn

```bash
$ yarn add ringcentral ringcentral-call ringcentral-call-control ringcentral-web-phone
```

Use CDN scripts

```html
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/es6-promise/3.2.2/es6-promise.js"></script>
<script type="text/javascript" src="https://cdn.pubnub.com/sdk/javascript/pubnub.4.20.1.js"></script>
<script type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/fetch/0.11.1/fetch.js"></script>
<script type="text/javascript" src="https://cdn.rawgit.com/ringcentral/ringcentral-js/3.2.2/build/ringcentral.js"></script>
<script type="text/javascript" src="https://unpkg.com/sip.js@0.13.5/dist/sip.js"></script>
<script type="text/javascript" src="https://unpkg.com/ringcentral-web-phone@0.7.7/dist/ringcentral-web-phone.js"></script>
<script type="text/javascript" src="https://unpkg.com/ringcentral-call@0.0.3/build/index.js"></script>
```

## Usage

For this example you will also need to have [RingCentral JS SDK](https://github.com/ringcentral/ringcentral-js#installation), [RingCentral Web Phone](https://github.com/ringcentral/ringcentral-web-phone) and [RingCentral Call Control](https://github.com/ringcentral/ringcentral-call-control) installed.

Create RingCentral Call instances:

```js
var appClientId = '...'; 
var appClientSecret = '...';
var appName = '...';
var appVersion = '...';
var rcCall;

var sdk = new RingCentral.SDK({
  appKey: appClientId,
  appSecret: appClientSecret,
  appName: appName,
  appVersion: appVersion,
  server: RingCentral.SDK.server.production // or .sandbox
});

var platform = sdk.platform();

platform
  .login({
    username: '...',
    password: '...'
  })
  .then(function() {
    return platform
            .post('/client-info/sip-provision', {
              sipInfo: [{transport: 'WSS'}]
            })
  })
  .then(function(res) {
    // create RingCentral web phone instance
    var rcWebPhone = new RingCentral.WebPhone(res.json(), {
      appKey: appClientId,
      appName: 'RingCentral Call Demo',
      appVersion: '0.0.1',
      uuid: res.json().device.extension.id,
    });

    // create RingCentral call instance
    rcCall = new RingCentralCall({ webphone: rcWebPhone, sdk: sdk });
    return rcCall;
  })
```

## API

### Initialize

Firstly, we need to create [RingCentral JS SDK](https://github.com/ringcentral/ringcentral-js#installation) instance and [RingCentral Web Phone](https://github.com/ringcentral/ringcentral-web-phone#application) instance. Then pass them when initialize RingCentral Call instance:

```js
var rcCall = new RingCentralCall({ webphone: rcWebPhone, sdk: sdk });
```

### Events

### New call session event

```js
var session = null;

rcCall.on('new', (newSession) => {
  session = newSession;
});
```

### Webphone registered event

```js
rcCall.on('webphone-registered', function () {
  //  web phone feature is ready
});
```

### Call control ready event

```js
rcCall.on('call-control-ready', function () {
  //  call control feature is ready
});
```

### Sessions List

```js
var sessions = rcCall.sessions;
```

### Session API

#### Start a call

```js
rcCall.makeCall({
  type: 'webphone',
  toNumber: 'phone number',
  fromNumber: 'from number',
}).then((session) => {
  // ...
})
```

#### Hangup a call

```js
session.hangup().then(...)
```

#### Hold a call

```js
session.hold().then(...)
```

#### Unhold a call

```js
session.unhold().then(...)
```

#### To voicemail

```js
session.toVoicemail().then(...)
```

#### Reject a call

```js
session.reject().then(...)
```

#### Answer a call

```js
session.answer().then(...)
```

#### Forward a call

```js
session.forward('forward number').then(...)
```

#### Transfer a call

```js
session.forward('transfer number').then(...)
```

#### Mute a call

```js
session.mute().then(...)
```

#### Unmute a call

```js
session.unmute().then(...)
```

### Session Event

Status changed event

```js
session.on('status', ({ party }) => {
  // console.log(part)
});
```

## TODO

- [ ] Add more tests and CI
- [ ] CDN version
- [ ] Github Page demo
- [ ] Call Switch
- [ ] Conference Call Support
