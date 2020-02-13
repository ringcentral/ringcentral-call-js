# RingCentral Call JS SDK

RingCentral Call aims to help developers to make and control call easily with RingCentral Web Phone and Call Control APIs.

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

## Usage

For this example you will also need to have [RingCentral JS SDK](https://github.com/ringcentral/ringcentral-js#installation), [RingCentral Web Phone](https://github.com/ringcentral/ringcentral-web-phone) and [RingCentral Call Control](https://github.com/ringcentral/ringcentral-call-control) installed.

Create RingCentral Call Control and RingCentral Web Phone instances:

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

    // create RingCentral call control instance
    var rcCallControl = new RingCentralCallControl({ sdk: sdk });
    var subscription = sdk.createSubscription();
    subscription.setEventFilters(['/restapi/v1.0/account/~/extension/~/telephony/sessions']);
    subscription.on(subscription.events.notification, function(msg) {
       rcCallControl.onNotificationEvent(msg)
    });
    subscription.register();

    // create RingCentral call instance
    rcCall = new RingCentralCall({ webphone: rcWebPhone, activeCallControl: rcCallControl });
    return rcCall;
  })
```

## Events

```js
var session = null;

rcCall.on('new', (newSession) => {
  session = newSession;
});
```

```js
session.on('status', ({ party }) => {
  // console.log(part)
});
```

## API

### Sessions List

```js
var sessions = rcCall.sessions;
```

### Start a call

```js
rcCall.makeCall({
  type: 'webphone',
  toNumber: 'phone number',
  fromNumber: 'from number',
}).then((session) => {
  // ...
})
```

### Hangup a call

```js
session.hangup().then(...)
```

### Hold a call

```js
session.hold().then(...)
```

### Unhold a call

```js
session.unhold().then(...)
```

### To voicemail

```js
session.toVoicemail().then(...)
```

### Reject a call

```js
session.reject().then(...)
```

### Answer a call

```js
session.answer().then(...)
```

### Forward a call

```js
session.forward('forward number').then(...)
```

### Transfer a call

```js
session.forward('transfer number').then(...)
```

### Mute a call

```js
session.mute().then(...)
```

### Unmute a call

```js
session.unmute().then(...)
```
