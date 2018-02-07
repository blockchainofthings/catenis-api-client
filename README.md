# Catenis API Client for Node.js

This module is used to make it easier to access the Catenis Enterprise API services from Node.js applications.

This current release (1.0.0) targets version 0.5 of the Catenis Enterprise API.

## Installation

```shell
npm install catenis-api-client
```

## Usage

Load catenis-api-client module.

```JavaScript
var CtnApiClient = require('catenis-api-client');
```

### Instantiate the client
 
```JavaScript
var ctnApiClient = new CtnApiClient(deviceId, apiAccessSecret, {
    environment: 'beta'
});
```

### Logging (storing) a message to the blockchain

```JavaScript
ctnApiClient.logMessage('My message', {
        encoding: 'utf8',
        encrypt: true,
        storage: 'auto'
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### Sending a message to another device

```JavaScript
ctnApiClient.sendMessage({
        id: targetDeviceId,
        isProdUniqueId: false
    },
    'My message to send', {
        readConfirmation: true,
        encoding: 'utf8',
        encrypt: true,
        storage: 'auto'
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### Reading a message

```JavaScript
ctnApiClient.readMessage(messageId, 'utf8',
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### Retrieving information about a message's container

```JavaScript
ctnApiClient.retrieveMessageContainer(messageId,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### List messages

```JavaScript
ctnApiClient.listMessages({
        action: 'send',
        direction: 'inbound',
        readState: 'unread',
        startDate: '20170101T000000Z'
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### List permission events

```JavaScript
ctnApiClient.listPermissionEvents(function (err, data) {
    if (err) {
        // Process error
    }
    else {
        // Process returned data
    }
});
```

### Retrieve permission rights

```JavaScript
ctnApiClient.retrievePermissionRights('receive_msg',
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### Set permission rights

```JavaScript
ctnApiClient.setPermissionRights('receive_msg', {
        system: 'deny',
        catenisNode: {
            allow: 'self'
        },
        client: {
            allow: [
                'self',
                clientId
            ]
        },
        device: {
            deny: [{
                id: deviceId1
            }, {
                id: 'ABCD001',
                isProdUniqueId: true
            }]
        }
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### Check effective permission right

```JavaScript
ctnApiClient.checkEffectivePermissionRight('receive_msg', deviceId, false,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### List notification events

```JavaScript
ctnApiClient.listNotificationEvents(function (err, data) {
    if (err) {
        // Process error
    }
    else {
        // Process returned data
    }
});
```

### Retrieve device identification information

```JavaScript
ctnApiClient.retrieveDeviceIdentificationInfo(deviceId, false,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
        }
});
```

### Receiving notifications

Instantiate WebSocket notification channel object.

```JavaScript
var wsNtfyChannel = ctnApiClient.createWsNotifyChannel(eventName);
```

Add listeners.

```JavaScript
wsNtfyChannel.addListener('error', function (error) {
    // Process error
});

wsNtfyChannel.addListener('close', function (code, reason) {
    // Process indication that WebSocket connection has been closed
});

wsNtfyChannel.addListener('message', function (data) {
    // Process received notification message
});
```

Open notification channel.

```JavaScript
wsNtfyChannel.open(function (err) {
    if (err) {
        // Process WebSocket connection error
    }
    else {
        // Process indication that WebSocket connection is open
    }
});
```

## Error handling

Two types of error can take place when calling API methods: client or API error.

They can be differentiated by the type of object turned, as follows:

Client error object:

```
{
    clientError: [Object]
}
```

API error object:

```
{
    apiError: {
        httpStatusCode: [Number],
        message: [String]
    }
}
```

## License

This Node.js module is released under the [MIT License](LICENSE). Feel free to fork, and modify!

Copyright © 2018, Blockchain of Things Inc.
