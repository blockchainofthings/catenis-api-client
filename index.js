// Save local reference to required third-party libraries
var moment = require('moment'),
	crypto = require('crypto'),
	heir = require('heir'),
    EventEmitter = require('events'),
    http = require('request'),
    zlib = require('zlib'),
    WebSocket = require('ws');
var CatenisApiError = require('./lib/CatenisApiError.js');

var apiPath = '/api/',
    signVersionId = 'CTN1',
    signMethodId = 'CTN1-HMAC-SHA256',
    scopeRequest = 'ctn1_request',
    timestampHdr = 'X-BCoT-Timestamp',
    signValidDays = 7,
    notifyRootPath = 'notify',
    wsNtfyRootPath =  'ws',
    notifyWsSubprotocol = 'notify.catenis.io',
    notifyChannelOpenMsg = 'NOTIFICATION_CHANNEL_OPEN';

// Api Client function class constructor
//
//  Parameters:
//    deviceId: [String]            - (optional) Catenis device ID
//    apiAccessSecret: [String]     - (optional) Catenis device's API access secret
//    options [Object] (optional) {
//      host: [String],              - (optional, default: 'catenis.io') Host name (with optional port) of target Catenis API server
//      environment: [String],       - (optional, default: 'prod') Environment of target Catenis API server. Valid values: 'prod', 'sandbox' (or 'beta')
//      secure: [Boolean],           - (optional, default: true) Indicates whether a secure connection (HTTPS) should be used
//      version: [String],           - (optional, default: '0.13') Version of Catenis API to target
//      useCompression: [Boolean],   - (optional, default: true) Indicates whether request/response body should be compressed
//      compressThreshold: [Number], - (optional, default: 1024) Minimum size, in bytes, of request body for it to be compressed
//    }
function ApiClient(deviceId, apiAccessSecret, options) {
    if (typeof deviceId === 'object' && deviceId !== null) {
        // No device ID, only options
        options = deviceId;
        deviceId = undefined;
        apiAccessSecret = undefined;
    }

    var _host = 'catenis.io';
    var _subdomain = '';
    var _secure = true;
    var _version = '0.13';

    this.useCompression = true;
    this.compressThreshold = 1024;

    if (typeof options === 'object' && options !== null) {
        _host = typeof options.host === 'string' && options.host.length > 0 ? options.host : _host;
        _subdomain = options.environment === 'sandbox' || options.environment === 'beta' ? 'sandbox.' : _subdomain;
        _secure = typeof options.secure === 'boolean' ? options.secure : _secure;
        _version = typeof options.version === 'string' && options.version.length > 0 ? options.version : _version;

        if (typeof options.useCompression === 'boolean' && !options.useCompression) {
            this.useCompression = false;
        }

        if (typeof options.compressThreshold == 'number' && options.compressThreshold >= 0) {
            this.compressThreshold = Math.floor(options.compressThreshold);
        }
    }

    this.host = _subdomain + _host;
    var uriPrefix = (_secure ? 'https://' : 'http://') + this.host;
    var apiBaseUriPath = apiPath + _version + '/';
    this.rootApiEndPoint = uriPrefix + apiBaseUriPath;
    this.deviceId = deviceId;
    this.apiAccessSecret = apiAccessSecret;
    this.lastSignDate = undefined;
    this.lastSignKey = undefined;
    var wsUriScheme = _secure ? 'wss://' : 'ws://';
    var wsUriPrefix = wsUriScheme + this.host;
    var wsNtfyBaseUriPath = apiBaseUriPath + notifyRootPath + (wsNtfyRootPath.length > 0 ? '/' : '') + wsNtfyRootPath;
    this.rootWsNtfyEndPoint = wsUriPrefix + wsNtfyBaseUriPath;
}

// Log a message
//
//  Parameters:
//    message: [String|Object] {  - The message to store. If a string is passed, it is assumed to be the whole message's contents. Otherwise,
//                                   it is expected that the message be passed in chunks using the following object to control it
//      data: [String],              - (optional) The current message data chunk. The actual message's contents should be comprised of one or
//                                      more data chunks. NOTE that, when sending a final message data chunk (isFinal = true and continuationToken
//                                      specified), this parameter may either be omitted or have an empty string value
//      isFinal: [Boolean],          - (optional, default: "true") Indicates whether this is the final (or the single) message data chunk
//      continuationToken: [String]  - (optional) - Indicates that this is a continuation message data chunk. This should be filled with the value
//                                      returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    options: [Object] (optional) {
//      encoding: [String],   - (optional, default: "utf8") One of the following values identifying the encoding of the message: "utf8"|"base64"|"hex"
//      encrypt:  [Boolean],  - (optional, default: true) Indicates whether message should be encrypted before storing. NOTE that, when message
//                               is passed in chunks, this option is only taken into consideration (and thus only needs to be passed) for the
//                               final message data chunk, and it shall be applied to the message's contents as a whole
//      offChain: [Boolean],  - (optional, default: true) Indicates whether message should be processed as a Catenis off-chain message. Catenis off-chain messages
//                               are stored on the external storage repository and only later its reference is settled to the blockchain along with references of
//                               other off-chain messages. NOTE that, when message is passed in chunks, this option is only taken into consideration (and thus
//                               only needs to be passed) for the final message data chunk, and it shall be applied to the message's contents as a whole
//      storage: [String]     - (optional, default: "auto") One of the following values identifying where the message should be stored: "auto"|
//                               "embedded"|"external". NOTE that, when message is passed in chunks, this option is only taken into consideration
//                               (and thus only needs be passed) for the final message data chunk, and it shall be applied to the message's
//                               contents as a whole. ALSO note that, when the offChain option is set to true, this option's value is disregarded
//                               and the processing is done as if the value "external" was passed
//      async: [Boolean]      - (optional, default: false) - Indicates whether processing (storage of message to the blockchain) should be
//                               done asynchronously. If set to true, a provisional message ID is returned, which should be used to retrieve
//                               the processing outcome by calling the MessageProgress API method. NOTE that, when message is passed in chunks,
//                               this option is only taken into consideration (and thus only needs to be passed) for the final message data chunk,
//                               and it shall be applied to the message's contents as a whole
//    }
//    callback: [Function]    - Callback function
ApiClient.prototype.logMessage = function (message, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    var data = {
        message: message
    };

    if (options) {
        data.options = options;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'messages/log', undefined, data, {
        success: procFunc,
        error: procFunc
    })
};

// Send a message
//
//  Parameters:
//    message: [String|Object] {  - The message to send. If a string is passed, it is assumed to be the whole message's contents. Otherwise, it is
//                                   expected that the message be passed in chunks using the following object to control it
//      data: [String],              - (optional) The current message data chunk. The actual message's contents should be comprised of one or more
//                                      data chunks. NOTE that, when sending a final message data chunk (isFinal = true and continuationToken
//                                      specified), this parameter may either be omitted or have an empty string value
//      isFinal: [Boolean],          - (optional, default: "true") Indicates whether this is the final (or the single) message data chunk
//      continuationToken: [String]  - (optional) - Indicates that this is a continuation message data chunk. This should be filled with the value
//                                      returned in the 'continuationToken' field of the response from the previously sent message data chunk
//    targetDevice: [Object] (optional) { - The target device. Note that, when message is passed in chunks, this parameter is only taken into
//                                          consideration (and thus only needs to be passed) for the final message data chunk; for all previous
//                                          message data chunks, it can be omitted. Otherwise, this is a required parameter
//      id: [String],               - ID of target device. Should be Catenis device ID unless isProdUniqueId is true
//      isProdUniqueId: [Boolean]   - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, it should be a
//                                     Catenis device Id)
//    },
//    options: [Object] (optional) {
//      encoding: [String],          - (optional, default: "utf8") One of the following values identifying the encoding of the message: "utf8"|"base64"|"hex"
//      encrypt:  [Boolean],         - (optional, default: true) Indicates whether message should be encrypted before storing. NOTE that, when message
//                                      is passed in chunks, this option is only taken into consideration (and thus only needs to be passed) for the
//                                      final message data chunk, and it shall be applied to the message's contents as a whole
//      offChain: [Boolean],         - (optional, default: true) Indicates whether message should be processed as a Catenis off-chain message. Catenis off-chain messages
//                                      are stored on the external storage repository and only later its reference is settled to the blockchain along with references of
//                                      other off-chain messages. NOTE that, when message is passed in chunks, this option is only taken into consideration (and thus
//                                      only needs to be passed) for the final message data chunk, and it shall be applied to the message's contents as a whole
//      storage: [String],           - (optional, default: "auto") One of the following values identifying where the message should be stored: "auto"|
//                                      "embedded"|"external". NOTE that, when message is passed in chunks, this option is only taken into consideration
//                                      (and thus only needs be passed) for the final message data chunk, and it shall be applied to the message's
//                                      contents as a whole. ALSO note that, when the offChain option is set to true, this option's value is disregarded
//                                      and the processing is done as if the value "external" was passed
//      readConfirmation: [Boolean], - (optional, default: false) Indicates whether message should be sent with read confirmation enabled.
//                                      NOTE that, when message is passed in chunks, this option is only taken into consideration (and thus only needs
//                                      be passed) for the final message data chunk, and it shall be applied to the message's contents as a whole
//      async: [Boolean]             - (optional, default: false) - Indicates whether processing (storage of message to the blockchain) should be done
//                                      asynchronously. If set to true, a provisional message ID is returned, which should be used to retrieve the
//                                      processing outcome by calling the MessageProgress API method. NOTE that, when message is passed in chunks,
//                                      this option is only taken into consideration (and thus only needs to be passed) for the final message data
//                                      chunk, and it shall be applied to the message's contents as a whole
//    }
//    callback: [Function]          - Callback function
ApiClient.prototype.sendMessage = function (message, targetDevice, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    var data = {
        message: message,
        targetDevice: targetDevice
    };

    if (options) {
        data.options = options;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'messages/send', undefined, data, {
        success: procFunc,
        error: procFunc
    });
};

// Read a message
//
//  Parameters:
//    messageId: [String]   - ID of message to read
//    options: [String|Object] (optional) { - If a string is passed, it is assumed to be the value for the (single) 'encoding' option
//      encoding: [String]          - (optional, default: "utf8") One of the following values identifying the encoding that should be used for the
//                                     returned message: utf8|base64|hex
//      continuationToken [String]  - (optional) Indicates that this is a continuation call and that the following message data chunk should be returned
//      dataChunkSize [Number]      - (optional) Size, in bytes, of the largest message data chunk that should be returned. This is effectively used
//                                     to signal that the message should be retrieved/read in chunks. NOTE that this option is only taken into
//                                     consideration (and thus only needs to be passed) for the initial call to this API method with a given message
//                                     ID (no continuation token), and it shall be applied to the message's contents as a whole
//      async [Boolean]             - (default: false) Indicates whether processing (retrieval of message from the blockchain) should be done
//                                     asynchronously. If set to true, a cached message ID is returned, which should be used to retrieve the processing
//                                     outcome by calling the Retrieve Message Progress API method. NOTE that this option is only taken into
//                                     consideration (and thus only needs to be passed) for the initial call to this API method with a given message
//                                     ID (no continuation token), and it shall be applied to the message's contents as a whole
//    }
//    callback: [Function]  - Callback function
ApiClient.prototype.readMessage = function (messageId, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    var params = {
        url: [
            messageId
        ]
    };

    if (options) {
        if (typeof options === 'string') {
            params.query = {
                encoding: options
            };
        }
        else if (typeof options === 'object') {
            params.query = filterDefinedProperties(options);
        }
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'messages/:messageId', params, {
        success: procFunc,
        error: procFunc
    });
};

// Retrieve message container
//
//  Parameters:
//    messageId: [String]   - ID of message to retrieve container info
//    callback: [Function]  - Callback function
ApiClient.prototype.retrieveMessageContainer = function (messageId, callback) {
    var params = {
        url: [
            messageId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'messages/:messageId/container', params, {
        success: procFunc,
        error: procFunc
    });
};

// Retrieve message origin
//
//  Parameters:
//    messageId: [String]   - ID of message to retrieve origin info
//    msgToSign: [string]   - (optional) A message (any text) to be signed using the Catenis message's origin device's private key.
//                             The resulting signature can then later be independently verified to prove the Catenis message origin
//    callback: [Function]  - Callback function
ApiClient.prototype.retrieveMessageOrigin = function (messageId, msgToSign, callback) {
    if (typeof msgToSign === 'function') {
        callback = msgToSign;
        msgToSign = undefined;
    }

    var params = {
        url: [
            messageId
        ]
    };

    if (msgToSign) {
        params.query = {
            msgToSign: msgToSign
        };
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'messages/:messageId/origin', params, {
        success: procFunc,
        error: procFunc
    }, true);
};

// Retrieve asynchronous message processing progress
//
//  Parameters:
//    messageId: [String]   - ID of ephemeral message (either a provisional or a cached message) for which to return processing progress
//    callback: [Function]  - Callback function
ApiClient.prototype.retrieveMessageProgress = function (messageId, callback) {
    var params = {
        url: [
            messageId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'messages/:messageId/progress', params, {
        success: procFunc,
        error: procFunc
    });
};

// List messages
//
//  Parameters:
//    selector: [Object] (optional) {
//      action: [String],                 - (optional, default: "any") - One of the following values specifying the action originally performed on
//                                           the messages intended to be retrieved: "log"|"send"|"any"
//      direction: [String],              - (optional, default: "any") - One of the following values specifying the direction of the sent messages
//                                           intended to be retrieve: "inbound"|"outbound"|"any". Note that this option only applies to
//                                           sent messages (action = "send"). "inbound" indicates messages sent to the device that issued
//                                           the request, while "outbound" indicates messages sent from the device that issued the request
//      fromDevices: [Array(Object)] [{   - (optional) - List of devices from which the messages intended to be retrieved had been sent. Note that this
//                                           option only applies to messages sent to the device that issued the request (action = "send" and direction = "inbound")
//          id: [String],                    - ID of the device. Can optionally be replaced with value "self" to refer to the ID of the device itself
//          isProdUniqueId [Boolean]         - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, if should be a Catenis device Id)
//      }],
//      toDevices: [Array(Object)] [{     - (optional) - List of devices to which the messages intended to be retrieved had been sent. Note that this
//                                           option only applies to messages sent to the device that issued the request (action = "send" and direction = "inbound")
//          id: [String],                    - ID of the device. Can optionally be replaced with value "self" to refer to the ID of the device itself
//          isProdUniqueId [Boolean]         - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, if should be a Catenis device Id)
//      }],
//      readState: [String],              - (optional, default: "any") - One of the following values indicating the current read state of the
//                                           the messages intended to be retrieved: "unread"|"read"|"any".
//      startDate: [String|Object(Date)], - (optional) - Date and time specifying the lower boundary of the time frame within
//                                           which the messages intended to be retrieved has been: logged, in case of messages logged
//                                           by the device that issued the request (action = "log"); sent, in case of messages sent from the current
//                                           device (action = "send" direction = "outbound"); or received, in case of messages sent to
//                                           the device that issued the request (action = "send" and direction = "inbound")
//                                           Note: if a string is passed, it should be an ISO 8601 formatted date/time
//      endDate: [String|Object(Date)]    - (optional) - Date and time specifying the upper boundary of the time frame within
//                                           which the messages intended to be retrieved has been: logged, in case of messages logged
//                                           by the device that issued the request (action = "log"); sent, in case of messages sent from the current
//                                           device (action = "send" direction = "outbound"); or received, in case of messages sent to
//                                           the device that issued the request (action = "send" and direction = "inbound")
//                                           Note: if a string is passed, it should be an ISO 8601 formatted date/time
//    }
//    limit: [Number]  - (default: 500) Maximum number of messages that should be returned
//    skip: [Number]   - (default: 0) Number of messages that should be skipped (from beginning of list of matching messages) and not returned
//    callback: [Function]  - Callback function
ApiClient.prototype.listMessages = function (selector, limit, skip, callback) {
    if (typeof selector === 'function') {
        callback = selector;
        selector = undefined;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof limit === 'function') {
        callback = limit;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }

    var params = undefined;

    if (selector) {
        params = {
            query: {}
        };

        if (selector.action) {
            params.query.action = selector.action;
        }

        if (selector.direction) {
            params.query.direction = selector.direction;
        }

        if (Array.isArray(selector.fromDevices)) {
            var fromDeviceIds = [];
            var fromDeviceProdUniqueIds = [];

            selector.fromDevices.forEach(function (device) {
                if (typeof device === 'object' && device !== null && typeof device.id === 'string' && device.id.length > 0) {
                    if (device.isProdUniqueId && !!device.isProdUniqueId) {
                        // This is actually a product unique ID. So add it to the proper list
                        fromDeviceProdUniqueIds.push(device.id);
                    }
                    else {
                        fromDeviceIds.push(device.id);
                    }
                }
            });

            if (fromDeviceIds.length > 0) {
                // Add list of from device IDs
                params.query.fromDeviceIds = fromDeviceIds.join(',');
            }

            if (fromDeviceProdUniqueIds.length > 0) {
                params.query.fromDeviceProdUniqueIds = fromDeviceProdUniqueIds.join(',');
            }
        }

        if (Array.isArray(selector.toDevices)) {
            var toDeviceIds = [];
            var toDeviceProdUniqueIds = [];

            selector.toDevices.forEach(function (device) {
                if (typeof device === 'object' && device !== null && typeof device.id === 'string' && device.id.length > 0) {
                    if (device.isProdUniqueId && !!device.isProdUniqueId) {
                        // This is actually a product unique ID. So add it to the proper list
                        toDeviceProdUniqueIds.push(device.id);
                    }
                    else {
                        toDeviceIds.push(device.id);
                    }
                }
            });

            if (toDeviceIds.length > 0) {
                // Add list of to device IDs
                params.query.toDeviceIds = toDeviceIds.join(',');
            }

            if (toDeviceProdUniqueIds.length > 0) {
                params.query.toDeviceProdUniqueIds = toDeviceProdUniqueIds.join(',');
            }
        }

        if (selector.readState) {
            params.query.readState = selector.readState;
        }

        if (selector.startDate) {
            if (typeof selector.startDate === 'string' && selector.startDate.length > 0) {
                params.query.startDate = selector.startDate;
            }
            else if (selector.startDate instanceof Date) {
                params.query.startDate = selector.startDate.toISOString();
            }
        }

        if (selector.endDate) {
            if (typeof selector.endDate === 'string' && selector.endDate.length > 0) {
                params.query.endDate = selector.endDate;
            }
            else if (selector.endDate instanceof Date) {
                params.query.endDate = selector.endDate.toISOString();
            }
        }
    }

    if (limit) {
        if (!params) {
            params = {
                query: {}
            };
        }

        params.query.limit = limit;
    }

    if (skip) {
        if (!params) {
            params = {
                query: {}
            };
        }

        params.query.skip = skip;
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'messages', params, {
        success: procFunc,
        error: procFunc
    });
};

// List permission events
//
//  Parameters:
//    callback: [Function]  - Callback function
ApiClient.prototype.listPermissionEvents = function (callback) {
    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'permission/events', undefined, {
        success: procFunc,
        error: procFunc
    });
};

// Retrieve permission rights
//
//  Parameters:
//    eventName: [String]   - Name of permission event
//    callback: [Function]  - Callback function
ApiClient.prototype.retrievePermissionRights = function (eventName, callback) {
    var params = {
        url: [
            eventName
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'permission/events/:eventName/rights', params, {
        success: procFunc,
        error: procFunc
    });
};

// Set permission rights
//
//  Parameters:
//    eventName: [String] - Name of permission event
//    rights: [Object] {
//      system: [String] - (optional) Permission right to be attributed at system level for the specified event. Must be one of the following values: "allow", "deny"
//      catenisNode: {   - (optional) Permission rights to be attributed at the Catenis node level for the specified event
//        allow: [Array(String)|String],  - (optional) List of indices (or a single index) of Catenis nodes to give allow right
//                                        -  Can optionally include the value "self" to refer to the index of the Catenis node to which the device belongs
//        deny: [Array(String)|String],   - (optional) List of indices (or a single index) of Catenis nodes to give deny right
//                                        -  Can optionally include the value "self" to refer to the index of the Catenis node to which the device belongs
//        none: [Array(String)|String]    - (optional) List of indices (or a single index) of Catenis nodes the rights of which should be removed.
//                                        -  Can optionally include the value "self" to refer to the index of the Catenis node to which the device belongs.
//                                        -  The wildcard character ("*") can also be used to indicate that the rights for all Catenis nodes should be remove
//      },
//      client: {   - (optional) Permission rights to be attributed at the client level for the specified event
//        allow: [Array(String)|String],  - (optional) List of IDs (or a single ID) of clients to give allow right
//                                        -  Can optionally include the value "self" to refer to the ID of the client to which the device belongs
//        deny: [Array(String)|String],   - (optional) List of IDs (or a single ID) of clients to give deny right
//                                        -  Can optionally include the value "self" to refer to the ID of the client to which the device belongs
//        none: [Array(String)|String]    - (optional) List of IDs (or a single ID) of clients the rights of which should be removed.
//                                        -  Can optionally include the value "self" to refer to the ID of the client to which the device belongs
//                                        -  The wildcard character ("*") can also be used to indicate that the rights for all clients should be remove
//      },
//      device: {   - (optional) Permission rights to be attributed at the device level for the specified event
//        allow: [{          - (optional) List of IDs (or a single ID) of devices to give allow right
//          id: [String],             - ID of the device. Can optionally be replaced with value "self" to refer to the ID of the device itself
//          isProdUniqueId [Boolean]  - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, if should be a Catenis device Id)
//        }],
//        deny: [{           - (optional) List of IDs (or a single ID) of devices to give deny right
//          id: [String],             - ID of the device. Can optionally be replaced with value "self" to refer to the ID of the device itself
//          isProdUniqueId [Boolean]  - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, if should be a Catenis device Id)
//        }],
//        none: [{           - (optional) List of IDs (or a single ID) of devices the rights of which should be removed.
//          id: [String],             - ID of the device. Can optionally be replaced with value "self" to refer to the ID of the device itself
//                                    -  The wildcard character ("*") can also be used to indicate that the rights for all devices should be remove
//          isProdUniqueId [Boolean]  - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise, if should be a Catenis device Id)
//        }]
//      }
//    }
//    callback: [Function]    - Callback function
ApiClient.prototype.setPermissionRights = function (eventName, rights, callback) {
    var params = {
        url: [
            eventName
        ]
    };

    var data = rights;

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'permission/events/:eventName/rights', params, data, {
        success: procFunc,
        error: procFunc
    });
};

// Check effective permission right
//
//  Parameters:
//    eventName [String]        - Name of the permission event
//    deviceId [String]         - ID of the device to check the permission right applied to it. Can optionally be replaced with value "self" to refer to the ID of the device that issued the request
//    isProdUniqueId: [Boolean] - (optional, default: false) Indicates whether the deviceId parameter should be interpreted as a product unique ID (otherwise, it is interpreted as a Catenis device Id)
//    callback: [Function]      - Callback function
ApiClient.prototype.checkEffectivePermissionRight = function (eventName, deviceId, isProdUniqueId, callback) {
    if (typeof isProdUniqueId === 'function') {
        callback = isProdUniqueId;
        isProdUniqueId = undefined;
    }

    var params = {
        url: [
            eventName,
            deviceId
        ]
    };

    if (isProdUniqueId) {
        params.query = {
            isProdUniqueId: isProdUniqueId
        };
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'permission/events/:eventName/rights/:deviceId', params, {
        success: procFunc,
        error: procFunc
    });
};

// List notification events
//
//  Parameters:
//    callback: [Function]  - Callback function
ApiClient.prototype.listNotificationEvents = function (callback) {
    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'notification/events', undefined, {
        success: procFunc,
        error: procFunc
    });
};

// Retrieve device identification information
//
//  Parameters:
//    deviceId [String]         - ID of the device the identification information of which is to be retrieved. Can optionally be replaced with value "self" to refer to the ID of the device that issued the request
//    isProdUniqueId: [Boolean] - (optional, default: false) Indicates whether the deviceId parameter should be interpreted as a product unique ID (otherwise, it is interpreted as a Catenis device Id)
//    callback: [Function]      - Callback function
ApiClient.prototype.retrieveDeviceIdentificationInfo = function (deviceId, isProdUniqueId, callback) {
    if (typeof isProdUniqueId === 'function') {
        callback = isProdUniqueId;
        isProdUniqueId = undefined;
    }

    var params = {
        url: [
            deviceId
        ]
    };

    if (isProdUniqueId) {
        params.query = {
            isProdUniqueId: isProdUniqueId
        };
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'devices/:deviceId', params, {
        success: procFunc,
        error: procFunc
    });
};

// Issue an amount of a new asset
//
//  Parameters:
//    assetInfo: {         - Information for creating new asset
//      name: [String],           - The name of the asset
//      description: [String],    - (optional) The description of the asset
//      canReissue: [Boolean],    - Indicates whether more units of this asset can be issued at another time (an unlocked asset)
//      decimalPlaces: [Number]   - The number of decimal places that can be used to specify a fractional amount of this asset
//    }
//    amount: [Number]     - Amount of asset to be issued (expressed as a fractional amount)
//    holdingDevice: {     - (optional, default: device that issues the request) Device for which the asset is issued and that shall hold the total issued amount
//      id: [String],             - ID of holding device. Should be a Catenis device ID unless isProdUniqueId is true
//      isProdUniqueId: [Boolean] - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise,
//                                   it should be a Catenis device Id)
//    }
//    callback: [Function] - Callback function
ApiClient.prototype.issueAsset = function (assetInfo, amount, holdingDevice, callback) {
    if (typeof holdingDevice === 'function') {
        callback = holdingDevice;
        holdingDevice = undefined;
    }

    var data = {
        assetInfo: assetInfo,
        amount: amount
    };

    if (holdingDevice) {
        data.holdingDevice = holdingDevice;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/issue', undefined, data, {
        success: procFunc,
        error: procFunc
    })
};

// Issue an additional amount of an existing asset
//
//  Parameters:
//    assetId [String]     - ID of asset to issue more units of it
//    amount: [Number]     - Amount of asset to be issued (expressed as a fractional amount)
//    holdingDevice: {     - (optional, default: device that issues the request) Device for which the asset is issued and that shall hold the total issued amount
//      id: [String],              - ID of holding device. Should be a Catenis device ID unless isProdUniqueId is true
//      isProdUniqueId: [Boolean]  - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise,
//                                    it should be a Catenis device Id)
//    }
//    callback: [Function] - Callback function
ApiClient.prototype.reissueAsset = function (assetId, amount, holdingDevice, callback) {
    if (typeof holdingDevice === 'function') {
        callback = holdingDevice;
        holdingDevice = undefined;
    }

    var params = {
        url: [
            assetId
        ]
    };

    var data = {
        amount: amount
    };

    if (holdingDevice) {
        data.holdingDevice = holdingDevice;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/:assetId/issue', params, data, {
        success: procFunc,
        error: procFunc
    })
};

// Transfer an amount of an asset to a device
//
//  Parameters:
//    assetId [String]     - ID of asset to transfer
//    amount: [Number]     - Amount of asset to be transferred (expressed as a fractional amount)
//    receivingDevice: {   - Device to which the asset is to be transferred
//      id: [String],              - ID of receiving device. Should be a Catenis device ID unless isProdUniqueId is true
//      isProdUniqueId: [Boolean]  - (optional, default: false) Indicate whether supplied ID is a product unique ID (otherwise,
//                                     it should be a Catenis device Id)
//    },
//    callback: [Function] - Callback function
ApiClient.prototype.transferAsset = function (assetId, amount, receivingDevice, callback) {
    var params = {
        url: [
            assetId
        ]
    };

    var data = {
        amount: amount,
        receivingDevice: receivingDevice
    };

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/:assetId/transfer', params, data, {
        success: procFunc,
        error: procFunc
    })
};

// Retrieve information about a given asset
//
//  Parameters:
//    assetId [String]     - ID of asset to retrieve information
//    callback: [Function] - Callback function
ApiClient.prototype.retrieveAssetInfo = function (assetId, callback) {
    var params = {
        url: [
            assetId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/:assetId', params, {
        success: procFunc,
        error: procFunc
    });
};

// Get the current balance of a given asset held by the device
//
//  Parameters:
//    assetId [String]     - ID of asset to get balance
//    callback: [Function] - Callback function
ApiClient.prototype.getAssetBalance = function (assetId, callback) {
    var params = {
        url: [
            assetId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/:assetId/balance', params, {
        success: procFunc,
        error: procFunc
    });
};

// List assets owned by the device
//
//  Parameters:
//    limit: [Number]      - (optional, default: 500) Maximum number of list items that should be returned
//    skip: [Number]       - (optional, default: 0) Number of list items that should be skipped (from beginning of list) and not returned
//    callback: [Function] - Callback function
ApiClient.prototype.listOwnedAssets = function (limit, skip, callback) {
    if (typeof limit === 'function') {
        callback = limit;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }

    var params = undefined;

    if (limit) {
        params = {
            query: {
                limit: limit
            }
        };
    }

    if (skip) {
        if (!params) {
            params = {
                query: {}
            };
        }

        params.query.skip = skip;
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/owned', params, {
        success: procFunc,
        error: procFunc
    });
};

// List assets issued by the device
//
//  Parameters:
//    limit: [Number]      - (optional, default: 500) Maximum number of list items that should be returned
//    skip: [Number]       - (optional, default: 0) Number of list items that should be skipped (from beginning of list) and not returned
//    callback: [Function] - Callback function
ApiClient.prototype.listIssuedAssets = function (limit, skip, callback) {
    if (typeof limit === 'function') {
        callback = limit;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }

    var params = undefined;

    if (limit) {
        params = {
            query: {
                limit: limit
            }
        };
    }

    if (skip) {
        if (!params) {
            params = {
                query: {}
            };
        }

        params.query.skip = skip;
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/issued', params, {
        success: procFunc,
        error: procFunc
    });
};

// Retrieve issuance history for a given asset
//
//  Parameters:
//    assetId [String] - ID of asset to retrieve issuance history
//    startDate [String|Object(Date)] - (optional) Date and time specifying the lower boundary of the time frame within
//                                       which the issuance events intended to be retrieved have occurred. The returned
//                                       issuance events must have occurred not before that date/time
//                                       Note: if a string is passed, it should be an ISO 8601 formatted date/time
//    endDate [String|Object(Date)]   - (optional) Date and time specifying the upper boundary of the time frame within
//                                       which the issuance events intended to be retrieved have occurred. The returned
//                                       issuance events must have occurred not after that date/time
//                                       Note: if a string is passed, it should be an ISO 8601 formatted date/time
//    limit: [Number] - (default: 500) Maximum number of asset issuance events that should be returned
//    skip: [Number]  - (default: 0) Number of asset issuance events that should be skipped (from beginning of list of matching events) and not returned
//    callback: [Function]      - Callback function
ApiClient.prototype.retrieveAssetIssuanceHistory = function (assetId, startDate, endDate, limit, skip, callback) {
    if (typeof startDate === 'function') {
        callback = startDate;
        startDate = undefined;
        endDate = undefined;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof endDate === 'function') {
        callback = endDate;
        endDate = undefined;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof limit === 'function') {
        callback = limit;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }

    var params = {
        url: [
            assetId
        ]
    };

    if (startDate) {
        if (typeof startDate === 'string' && startDate.length > 0) {
            params.query = {
                startDate: startDate
            };
        }
        else if (startDate instanceof Date) {
            params.query = {
                startDate: startDate.toISOString()
            }
        }
    }

    if (endDate) {
        if (typeof endDate === 'string' && endDate.length > 0) {
            if (!params.query) {
                params.query = {};
            }

            params.query.endDate = endDate;
        }
        else if (endDate instanceof Date) {
            if (!params.query) {
                params.query = {};
            }

            params.query.endDate = endDate.toISOString();
        }
    }

    if (limit) {
        if (!params.query) {
            params.query = {};
        }

        params.query.limit = limit;
    }

    if (skip) {
        if (!params.query) {
            params.query = {};
        }

        params.query.skip = skip;
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/:assetId/issuance', params, {
        success: procFunc,
        error: procFunc
    });
};

// List devices that currently hold any amount of a given asset
//
//  Parameters:
//    assetId [String]     - ID of asset to get holders
//    limit: [Number]      - (optional, default: 500) Maximum number of list items that should be returned
//    skip: [Number]       - (optional, default: 0) Number of list items that should be skipped (from beginning of list) and not returned
//    callback: [Function] - Callback function
ApiClient.prototype.listAssetHolders = function (assetId, limit, skip, callback) {
    if (typeof limit === 'function') {
        callback = limit;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }

    var params = {
        url: [
            assetId
        ]
    };

    if (limit) {
        params.query = {
            limit: limit
        };
    }

    if (skip) {
        if (!params.query) {
            params.query = {};
        }

        params.query.skip = skip;
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/:assetId/holders', params, {
        success: procFunc,
        error: procFunc
    });
};

// Export an asset to a foreign blockchain, by creating a new (ERC-20 compliant) token on that blockchain
//
//  Parameters:
//    assetId [String]     - The ID of asset to export
//    foreignBlockchain: [String]  - The key identifying the foreign blockchain. Valid options: 'ethereum',
//                                    'binance', 'polygon'
//    token: {
//      name: [String],            - The name of the token to be created on the foreign blockchain
//      symbol: [String]           - The symbol of the token to be created on the foreign blockchain
//    }
//    options: {           - (optional)
//      consumptionProfile: [String],  - (optional) Name of the foreign blockchain's native coin consumption profile
//                                        to use. Valid options: 'fastest', 'fast', 'average', 'slow'
//      estimateOnly: [Boolean]        - (optional, default: false) When set, indicates that no asset export should be
//                                        executed but only the estimated price (in the foreign blockchain's native
//                                        coin) to fulfill the operation should be returned
//    }
//    callback: [Function] - Callback function
ApiClient.prototype.exportAsset = function (assetId, foreignBlockchain, token, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    var params = {
        url: [
            assetId,
            foreignBlockchain
        ]
    };

    var data = {
        token: token
    };

    if (options) {
        data.options = options;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/:assetId/export/:foreignBlockchain', params, data, {
        success: procFunc,
        error: procFunc
    })
};

// Migrate an amount of a previously exported asset to/from the foreign blockchain token
//
//  Parameters:
//    assetId [String]     - The ID of the asset to migrate an amount of it
//    foreignBlockchain: [String]  - The key identifying the foreign blockchain. Valid options: 'ethereum',
//                                    'binance', 'polygon'
//    migration: [Object|String] { - Object describing a new asset migration, or the ID of the asset migration to be
//                                    reprocessed
//      direction: [String],           - The direction of the migration. Valid options: 'outward', 'inward'
//      amount: [Number],              - The amount (as a decimal value) of the asset to be migrated
//      destAddress: [String]          - (optional) The address of the account on the foreign blockchain that should
//                                        be credited with the specified amount of the foreign token
//    }
//    options: {           - (optional)
//      consumptionProfile: [String],  - (optional) Name of the foreign blockchain's native coin consumption profile
//                                        to use. Valid options: 'fastest', 'fast', 'average', 'slow'
//      estimateOnly: [Boolean]        - (optional, default: false) When set, indicates that no asset migration should
//                                        be executed but only the estimated price (in the foreign blockchain's native
//                                        coin) to fulfill the operation should be returned
//    }
//    callback: [Function] - Callback function
ApiClient.prototype.migrateAsset = function (assetId, foreignBlockchain, migration, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    var params = {
        url: [
            assetId,
            foreignBlockchain
        ]
    };

    var data = {
        migration: migration
    };

    if (options) {
        data.options = options;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/:assetId/migrate/:foreignBlockchain', params, data, {
        success: procFunc,
        error: procFunc
    })
};

// Retrieve the current information about the outcome of an asset export
//
//  Parameters:
//    assetId [String]     - The ID of the asset that was exported
//    foreignBlockchain: [String]  - The key identifying the foreign blockchain. Valid options: 'ethereum',
//                                    'binance', 'polygon'
//    callback: [Function] - Callback function
ApiClient.prototype.assetExportOutcome = function (assetId, foreignBlockchain, callback) {
    var params = {
        url: [
            assetId,
            foreignBlockchain
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/:assetId/export/:foreignBlockchain', params, {
        success: procFunc,
        error: procFunc
    });
};

// Retrieve the current information about the outcome of an asset migration
//
//  Parameters:
//    migrationId [String]     - The ID of the asset migration
//    callback: [Function] - Callback function
ApiClient.prototype.assetMigrationOutcome = function (migrationId, callback) {
    var params = {
        url: [
            migrationId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/migrations/:migrationId', params, {
        success: procFunc,
        error: procFunc
    });
};

// Retrieves a list of issued asset exports that satisfy a given search criteria
//
//  Parameters:
//    selector [Object] {  - (optional)
//      assetId: [String],            - (optional) The ID of the exported asset
//      foreignBlockchain: [String],  - (optional) The key identifying the foreign blockchain to where the asset
//                                       has been exported. Valid options: 'ethereum', 'binance', 'polygon'
//      tokenSymbol: [String],        - (optional) The symbol of the resulting foreign token
//      status: [String],             - (optional) A single status or a comma-separated list of statuses to include.
//                                       Valid options: 'pending', 'success, 'error'
//      negateStatus: [Boolean],      - (optional, default: false) Boolean value indicating whether the specified
//                                       statuses should be excluded instead
//      startDate: [Date|String],     - (optional) Date and time specifying the inclusive lower bound of the time
//                                       frame within which the asset has been exported. If a string is passed, it
//                                       should be an ISO 8601 formatted date/time
//      endDate: [Date|String]        - (optional) Date and time specifying the inclusive upper bound of the time
//                                       frame within which the asset has been exported. If a string is passed, it
//                                       should be an ISO 8601 formatted date/time
//    }
//    limit [Number] - (optional, default: 500) Maximum number of asset exports that should be returned. Must be a
//                      positive integer value not greater than 500
//    skip [Number]  - (optional, default: 0) Number of asset exports that should be skipped (from beginning of list
//                      of matching asset exports) and not returned. Must be a non-negative (includes zero) integer
//                      value
//    callback: [Function] - Callback function
ApiClient.prototype.listExportedAssets = function (selector, limit, skip, callback) {
    if (typeof selector === 'function') {
        callback = selector;
        selector = undefined;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof limit === 'function') {
        callback = limit;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }

    var params = undefined;

    if (selector) {
        params = {
            query: {}
        };

        if (selector.assetId) {
            params.query.assetId = selector.assetId;
        }

        if (selector.foreignBlockchain) {
            params.query.foreignBlockchain = selector.foreignBlockchain;
        }

        if (selector.tokenSymbol) {
            params.query.tokenSymbol = selector.tokenSymbol;
        }

        if (selector.status) {
            params.query.status = selector.status;
        }

        if (selector.negateStatus) {
            params.query.negateStatus = selector.negateStatus;
        }

        if (selector.startDate) {
            if (typeof selector.startDate === 'string' && selector.startDate.length > 0) {
                params.query.startDate = selector.startDate;
            }
            else if (selector.startDate instanceof Date) {
                params.query.startDate = selector.startDate.toISOString();
            }
        }

        if (selector.endDate) {
            if (typeof selector.endDate === 'string' && selector.endDate.length > 0) {
                params.query.endDate = selector.endDate;
            }
            else if (selector.endDate instanceof Date) {
                params.query.endDate = selector.endDate.toISOString();
            }
        }
    }

    if (limit) {
        if (!params) {
            params = {
                query: {}
            };
        }

        params.query.limit = limit;
    }

    if (skip) {
        if (!params) {
            params = {
                query: {}
            };
        }

        params.query.skip = skip;
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/exported', params, {
        success: procFunc,
        error: procFunc
    });
};

// Retrieves a list of issued asset migrations that satisfy a given search criteria
//
//  Parameters:
//    selector [Object] {  - (optional)
//      assetId: [String],            - (optional) The ID of the asset the amount of which has been migrated
//      foreignBlockchain: [String],  - (optional) The key identifying the foreign blockchain to/from where the
//                                       asset amount has been migrated. Valid options: 'ethereum', 'binance',
//                                       'polygon'
//      direction: [String],          - (optional) The direction of the migration. Valid options: 'outward',
//                                       'inward'
//      status: [String],             - (optional) A single status or a comma-separated list of statuses to include.
//                                       Valid options: 'pending', 'interrupted', 'success', 'error'
//      negateStatus: [Boolean],      - (optional, default: false) Boolean value indicating whether the specified
//                                       statuses should be excluded instead
//      startDate: [Date|String],     - (optional) Date and time specifying the inclusive lower bound of the time
//                                       frame within which the asset amount has been migrated. If a string is
//                                       passed, it should be an ISO 8601 formatted date/time
//      endDate: [Date|String]        - (optional) Date and time specifying the inclusive upper bound of the time
//                                       frame within which the asset amount has been migrated. If a string is
//                                       passed, it should be an ISO 8601 formatted date/time
//    }
//    limit [Number] - (optional, default: 500) Maximum number of asset migrations that should be returned. Must be
//                      a positive integer value not greater than 500
//    skip [Number]  - (optional, default: 0) Number of asset migrations that should be skipped (from beginning of
//                      list of matching asset migrations) and not returned. Must be a non-negative (includes zero)
//                      integer value
//    callback: [Function] - Callback function
ApiClient.prototype.listAssetMigrations = function (selector, limit, skip, callback) {
    if (typeof selector === 'function') {
        callback = selector;
        selector = undefined;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof limit === 'function') {
        callback = limit;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }

    var params = undefined;

    if (selector) {
        params = {
            query: {}
        };

        if (selector.assetId) {
            params.query.assetId = selector.assetId;
        }

        if (selector.foreignBlockchain) {
            params.query.foreignBlockchain = selector.foreignBlockchain;
        }

        if (selector.direction) {
            params.query.direction = selector.direction;
        }

        if (selector.status) {
            params.query.status = selector.status;
        }

        if (selector.negateStatus) {
            params.query.negateStatus = selector.negateStatus;
        }

        if (selector.startDate) {
            if (typeof selector.startDate === 'string' && selector.startDate.length > 0) {
                params.query.startDate = selector.startDate;
            }
            else if (selector.startDate instanceof Date) {
                params.query.startDate = selector.startDate.toISOString();
            }
        }

        if (selector.endDate) {
            if (typeof selector.endDate === 'string' && selector.endDate.length > 0) {
                params.query.endDate = selector.endDate;
            }
            else if (selector.endDate instanceof Date) {
                params.query.endDate = selector.endDate.toISOString();
            }
        }
    }

    if (limit) {
        if (!params) {
            params = {
                query: {}
            };
        }

        params.query.limit = limit;
    }

    if (skip) {
        if (!params) {
            params = {
                query: {}
            };
        }

        params.query.skip = skip;
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/migrations', params, {
        success: procFunc,
        error: procFunc
    });
};

// Creates a new non-fungible asset, and issues its initial non-fungible tokens
//
//  Parameters:
//    issuanceInfoOrContinuationToken: [Object|String] {  - An object with the required info for issuing a new asset,
//                                              or a string with an asset issuance continuation token, which signals
//                                              a continuation call and should match the value returned by the
//                                              previous call
//      assetInfo: [Object] {  - (optional) The properties of the new non-fungible asset to create
//        name: [String]        - The name of the non-fungible asset
//        description: [String] - (optional) A description of the non-fungible asset
//        canReissue: [Boolean] - Indicates whether more non-fungible tokens of that non-fungible asset can be issued
//                                 at a later time
//      },
//      encryptNFTContents: [Boolean] - (optional, default: true) Indicates whether the contents of the non-fungible
//                                       tokens being issued should be encrypted before being stored
//      holdingDevices: [Object|Array(Object)] [{ - (optional) A single virtual device or a list of virtual devices
//                                                  that will hold the issued non-fungible tokens
//        id: [String]              - The ID of the holding device. Should be a device ID unless isProdUniqueId is set
//        isProdUniqueId: [Boolean] - (optional, default: false) Indicates whether the supplied ID is a product unique
//                                   ID
//      }],
//      async: [Boolean] - (optional, default: false) Indicates whether processing should be done asynchronously
//    }
//    nonFungibleTokens: Array(Object) [{  - (optional) List with the properties of the non-fungible tokens to be
//                                          issued
//      metadata: [Object] {  - (optional) The properties of the non-fungible token to issue
//        name: [String], - The name of the non-fungible token
//        description: [String], - (optional) A description of the non-fungible token
//        custom: [Object] {  - (optional) User defined, custom properties of the non-fungible token
//          sensitiveProps: [Object] {  - (optional) User defined, sensitive properties of the non-fungible token.
//                                          Sensitive properties are encrypted before being stored
//            <prop_name>:  - A custom, sensitive property identified by prop_name
//          },
//          <prop_name>:  - A custom property identified by prop_name
//        }
//      },
//      contents: [Object] {  - (optional) The contents of the non-fungible token to issue
//        data: [String]     - An additional chunk of data of the non-fungible token's contents
//        encoding: [String] - (optional, default: 'base64') The encoding of the contents data chunk. Valid options:
//                              'utf8', 'base64', 'hex'
//      }
//    }],
//    isFinal: [Boolean] - (optional, default: true) Indicates whether this is the final call of the asset issuance.
//                                                    There should be no more continuation calls after this is set
//    callback: [Function] - Callback function
ApiClient.prototype.issueNonFungibleAsset = function (issuanceInfoOrContinuationToken, nonFungibleTokens, isFinal, callback) {
    if (typeof nonFungibleTokens === 'function') {
        callback = nonFungibleTokens;
        nonFungibleTokens = undefined;
        isFinal = undefined;
    }
    else if (typeof isFinal === 'function') {
        callback = isFinal;
        isFinal = undefined;
    }

    var data = {};

    if (typeof issuanceInfoOrContinuationToken === 'object') {
        Object.assign(data, issuanceInfoOrContinuationToken);
    }
    else if (typeof issuanceInfoOrContinuationToken === 'string') {
        data.continuationToken = issuanceInfoOrContinuationToken;
    }

    if (nonFungibleTokens !== undefined) {
        data.nonFungibleTokens = nonFungibleTokens;
    }

    if (isFinal !== undefined) {
        data.isFinal = isFinal;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/non-fungible/issue', undefined, data, {
        success: procFunc,
        error: procFunc
    })
}

// Issues more non-fungible tokens for a previously created non-fungible asset
//
//  Parameters:
//    assetId: [String] - The ID of the non-fungible asset for which more non-fungible tokens should be issued
//    issuanceInfoOrContinuationToken: [Object|String] {  - (optional) An object with the required info for issuing
//                                              more non-fungible tokens of an existing non-fungible asset, or a
//                                              string with an asset issuance continuation token, which signals a
//                                              continuation call and should match the value returned by the
//                                              previous call
//      encryptNFTContents: [Boolean] - (optional, default: true) Indicates whether the contents of the non-fungible
//                                       tokens being issued should be encrypted before being stored
//      holdingDevices [Object|Array(Object)] [{ - (optional) A single virtual device or a list of virtual devices
//                                                  that will hold the issued non-fungible tokens
//        id: [String]              - The ID of the holding device. Should be a device ID unless isProdUniqueId is set
//        isProdUniqueId: [Boolean] - (optional, default: false) Indicates whether the supplied ID is a product unique
//                                   ID
//      }],
//      async: [Boolean] - (optional, default: false) Indicates whether processing should be done asynchronously
//    }
//    nonFungibleTokens: Array(Object) [{  - (optional) List with the properties of the non-fungible tokens to be
//                                            issued
//      metadata: [Object] {  - (optional) The properties of the non-fungible token to issue
//        name: [String], - The name of the non-fungible token
//        description: [String], - (optional) A description of the non-fungible token
//        custom: [Object] {  - (optional) User defined, custom properties of the non-fungible token
//          sensitiveProps: [Object] {  - (optional) User defined, sensitive properties of the non-fungible token.
//                                          Sensitive properties are encrypted before being stored
//            <prop_name>:  - A custom, sensitive property identified by prop_name
//          },
//          <prop_name>:  - A custom property identified by prop_name
//        }
//      },
//      contents: [Object] {  - (optional) The contents of the non-fungible token to issue
//        data: [String]     - An additional chunk of data of the non-fungible token's contents
//        encoding: [String] - (optional, default: 'base64') The encoding of the contents data chunk. Valid options:
//                              'utf8', 'base64', 'hex'
//      }
//    }],
//    isFinal: [Boolean] - (optional, default: true) Indicates whether this is the final call of the asset issuance.
//                          There should be no more continuation calls after this is set
//    callback: [Function] - Callback function
ApiClient.prototype.reissueNonFungibleAsset = function (assetId, issuanceInfoOrContinuationToken, nonFungibleTokens, isFinal, callback) {
    if (Array.isArray(issuanceInfoOrContinuationToken)) {
        callback = isFinal;
        isFinal = nonFungibleTokens;
        nonFungibleTokens = issuanceInfoOrContinuationToken;
        issuanceInfoOrContinuationToken = undefined;
    }

    if (typeof nonFungibleTokens === 'function') {
        callback = nonFungibleTokens;
        nonFungibleTokens = undefined;
        isFinal = undefined;
    }
    else if (typeof isFinal === 'function') {
        callback = isFinal;
        isFinal = undefined;
    }

    var params = {
        url: [
            assetId
        ]
    };

    var data = {};

    if (typeof issuanceInfoOrContinuationToken === 'object') {
        Object.assign(data, issuanceInfoOrContinuationToken);
    }
    else if (typeof issuanceInfoOrContinuationToken === 'string') {
        data.continuationToken = issuanceInfoOrContinuationToken;
    }

    if (nonFungibleTokens !== undefined) {
        data.nonFungibleTokens = nonFungibleTokens;
    }

    if (isFinal !== undefined) {
        data.isFinal = isFinal;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/non-fungible/:assetId/issue', params, data, {
        success: procFunc,
        error: procFunc
    })
}

// Retrieves the current progress of an asynchronous non-fungible asset issuance
//
//  Parameters:
//    issuanceId: [String] - The ID of the non-fungible asset issuance the processing progress of which should be
//                            retrieved
//    callback: [Function] - Callback function
ApiClient.prototype.retrieveNonFungibleAssetIssuanceProgress = function (issuanceId, callback) {
    var params = {
        url: [
            issuanceId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/non-fungible/issuance/:issuanceId', params, {
        success: procFunc,
        error: procFunc
    });
}

// Retrieves the data associated with a non-fungible token
//
//  Parameters:
//    tokenId: [String] - The ID of the non-fungible token the data of which should be retrieved
//    options: [Object] {  - (optional)
//      retrieveContents: [Boolean] - (optional, default: true) Indicates whether the contents of the non-fungible
//                                     token should be retrieved or not
//      contentsOnly: [Boolean] - (optional, default: false) Indicates whether only the contents of the non-fungible
//                                 token should be retrieved
//      contentsEncoding: [String] - (optional, default: 'base64') The encoding with which the retrieved chunk of
//                                    non-fungible token contents data will be encoded. Valid values: 'utf8',
//                                    'base64', 'hex'
//      dataChunkSize: [Number] - (optional) Numeric value representing the size, in bytes, of the largest chunk of
//                                 non-fungible token contents data that should be returned
//      async: [Boolean] - (optional, default: false) Indicates whether the processing should be done asynchronously
//      continuationToken: [String] - (optional) A non-fungible token retrieval continuation token, which signals a
//                                     continuation call, and should match the value returned by the previous call
//    }
//    callback: [Function] - Callback function
ApiClient.prototype.retrieveNonFungibleToken = function (tokenId, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = undefined;
    }

    var params = {
        url: [
            tokenId
        ]
    };

    if (options) {
        params.query = filterDefinedProperties(options);
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/non-fungible/tokens/:tokenId', params, {
        success: procFunc,
        error: procFunc
    });
}

// Retrieves the current progress of an asynchronous non-fungible token retrieval
//
//  Parameters:
//    tokenId: [String] - The ID of the non-fungible token whose data is being retrieved
//    retrievalId: [String] - The ID of the non-fungible token retrieval the processing progress of which should be
//                             retrieved
//    callback: [Function] - Callback function
ApiClient.prototype.retrieveNonFungibleTokenRetrievalProgress = function (tokenId, retrievalId, callback) {
    var params = {
        url: [
            tokenId,
            retrievalId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/non-fungible/tokens/:tokenId/retrieval/:retrievalId', params, {
        success: procFunc,
        error: procFunc
    });
}

// Transfers a non-fungible token to a virtual device
//
//  Parameters:
//    tokenId: [String] - The ID of the non-fungible token to transfer
//    receivingDevice: [Object] {  - Virtual device to which the non-fungible token is to be transferred
//      id: [String]              - The ID of the receiving device. Should be a device ID unless isProdUniqueId is set
//      isProdUniqueId: [Boolean] - (optional, default: false) Indicates whether the supplied ID is a product unique
//                                   ID
//    }
//    asyncProc: [Boolean] - (optional, default: false) Indicates whether processing should be done asynchronously
//    callback: [Function] - Callback function
ApiClient.prototype.transferNonFungibleToken = function (tokenId, receivingDevice, asyncProc, callback) {
    if (typeof asyncProc === 'function') {
        callback = asyncProc;
        asyncProc = undefined;
    }

    var params = {
        url: [
            tokenId
        ]
    };

    var data = {
        receivingDevice: receivingDevice
    };

    if (asyncProc !== undefined) {
        data.async = asyncProc;
    }

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/non-fungible/tokens/:tokenId/transfer', params, data, {
        success: procFunc,
        error: procFunc
    })
}

// Retrieves the current progress of an asynchronous non-fungible token retrieval
//
//  Parameters:
//    tokenId: [String] - The ID of the non-fungible token that is being transferred
//    transferId: [String] - The ID of the non-fungible token transfer the processing progress of which should be
//                            retrieved
//    callback: [Function] - Callback function
ApiClient.prototype.retrieveNonFungibleTokenTransferProgress = function (tokenId, transferId, callback) {
    var params = {
        url: [
            tokenId,
            transferId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/non-fungible/tokens/:tokenId/transfer/:transferId', params, {
        success: procFunc,
        error: procFunc
    });
}

// Retrieves a list of the non-fungible tokens of a given non-fungible asset that are currently
//  owned by the virtual device issuing the request
//
//  Parameters:
//    assetId: [String] - The ID of the non-fungible asset the non-fungible tokens of which that are currently owned
//                         by the virtual device issuing the request should be retrieved
//    limit [Number] - (optional, default: 500) Maximum number of list items that should be returned. Must be a
//                      positive integer value not greater than 500
//    skip [Number]  - (optional, default: 0) Number of list items that should be skipped (from beginning of list)
//                      and not returned. Must be a non-negative (includes zero) integer value
//    callback: [Function] - Callback function
ApiClient.prototype.listOwnedNonFungibleTokens = function (assetId, limit, skip, callback) {
    if (typeof limit === 'function') {
        callback = limit;
        limit = undefined;
        skip = undefined;
    }
    else if (typeof skip === 'function') {
        callback = skip;
        skip = undefined;
    }

    var params = {
        url: [
            assetId
        ]
    };

    if (limit) {
        params.query = {
            limit: limit
        };
    }

    if (skip) {
        if (!params.query) {
            params.query = {};
        }

        params.query.skip = skip;
    }

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/non-fungible/:assetId/tokens/owned', params, {
        success: procFunc,
        error: procFunc
    });
}

// Identifies the virtual device that currently owns a given non-fungible token
//
//  Parameters:
//    tokenId: [String] - The ID of the non-fungible token the owner of which should be identified
//    callback: [Function] - Callback function
ApiClient.prototype.getNonFungibleTokenOwner = function (tokenId, callback) {
    var params = {
        url: [
            tokenId
        ]
    };

    var procFunc = processReturn.bind(undefined, callback);

    getRequest.call(this, 'assets/non-fungible/tokens/:tokenId/owner', params, {
        success: procFunc,
        error: procFunc
    });
}

// Verifies if a virtual device is the current owner of a single or multiple non-fungible tokens
//
//  Parameters:
//    device: [Object] { -  The virtual device to check if it has ownership
//      id: [String]              - The ID of the device. Should be a device ID unless isProdUniqueId is set
//      isProdUniqueId: [Boolean] - (optional, default: false) Indicates whether the supplied ID is a product unique
//                                   ID
//    }
//    nonFungibleTokens: [Object] { -  The non-fungible tokens to be verified
//      id: [String]              - Either the ID of the single non-fungible token to be verified, or the ID of the
//                                   non-fungible asset the non-fungible tokens of which should be verified
//      isAssetId: [Boolean] - (optional, default: false) Indicates whether the specified ID is a non-fungible asset
//                              ID. Otherwise, it should be interpreted as a non-fungible token ID
//    }
//    callback: [Function] - Callback function
ApiClient.prototype.checkNonFungibleTokenOwnership = function (device, nonFungibleTokens, callback) {
    var data = {
        device,
        nonFungibleTokens
    };

    var procFunc = processReturn.bind(undefined, callback);

    postRequest.call(this, 'assets/non-fungible/tokens/ownership', undefined, data, {
        success: procFunc,
        error: procFunc
    });
}

// Create WebSocket Notification Channel
//
//  Parameters:
//    eventName: [String] - Name of Catenis notification event
ApiClient.prototype.createWsNotifyChannel = function (eventName) {
    return new WsNotifyChannel(this, eventName);
};

function processReturn(callback, data, returnType) {
    if (returnType === 'error') {
        callback(data);
    }
    else if (returnType === 'success') {
        callback(undefined, typeof data === 'object' && data.data ? data.data : data);
    }
}

function assembleMethodEndPointUrl(methodPath, params) {
    // Make sure that duplicate slashes that might occur in the URL (due to empty URL parameters)
    //  are reduced to a single slash so the URL used for signing is not different from the
    //  actual URL of the sent request
    return this.rootApiEndPoint + formatMethodPath(methodPath, params).replace(/\/{2,}/g,'/');
}

function postRequest(methodPath, params, data, result, doNotSign) {
    var reqParams = {
        url: assembleMethodEndPointUrl.call(this, methodPath, params),
        body: data,
        json: true,
        strictSSL: false
    };

    var signParams = {
        url: reqParams.url,
        type: 'POST',
        data: JSON.stringify(data)
    };

    if (this.useCompression) {
        reqParams.gzip = true;

        signParams.headers = {
            'Accept-Encoding': 'deflate'
        };

        if (Buffer.byteLength(signParams.data) >= this.compressThreshold) {
            // Avoid automatic request body conversion to JSON (though it will also
            //  disable the automatic response body conversion from JSON)
            reqParams.json = false;

            signParams.headers['Content-Type'] = 'application/json';
            signParams.headers['Content-Encoding'] = 'deflate';

            signParams.data = reqParams.body = zlib.deflateSync(signParams.data);
        }
    }

    if (!doNotSign) {
        signRequest.call(this, signParams);
    }

    reqParams.headers = signParams.headers;

    http.post(reqParams, function (err, res, body) {
        if (!reqParams.json && body) {
            // Convert body from JSON manually if automatic conversion had been disabled
            var parsedBody;

            try {
                parsedBody = JSON.parse(body);
            }
            catch (err) {}

            if (typeof parsedBody === 'object') {
                body = parsedBody;
            }
        }

        if (err || res.statusCode !== 200) {
            var error;
            if (err) {
                error = err;
            }
            else {
                error = new CatenisApiError(res.statusMessage, res.statusCode, typeof body === 'object' && body.message ? body.message : undefined);
            }
            return result.error(error, 'error');
        }
        result.success(body, 'success');
    });
}

function getRequest(methodPath, params, result, doNotSign) {
    var reqParams = {
        url: assembleMethodEndPointUrl.call(this, methodPath, params),
        type: "GET",
        json: true,
        strictSSL: false
    };

    var signParams = {
        url: reqParams.url,
        type: 'GET'
    };

    if (this.useCompression) {
        reqParams.gzip = true;

        signParams.headers = {
            'Accept-Encoding': 'deflate'
        };
    }

    if (!doNotSign) {
        signRequest.call(this, signParams);
    }

    reqParams.headers = signParams.headers;

    http.get(reqParams, function (err, res, body) {
        if (err || res.statusCode !== 200) {
            var error;
            if (err) {
                error = err;
            }
            else {
                error = new CatenisApiError(res.statusMessage, res.statusCode, typeof body === 'object' && body.message ? body.message : undefined);
            }
            return result.error(error, 'error');
        }
        result.success(body, 'success');
    });
}

function signRequest(reqParams) {
    // Add timestamp header
    var now = moment();
    var timestamp = now.utc().format('YYYYMMDDTHHmmss[Z]');
    var useSameSignKey;

    if (this.lastSignDate && now.diff(this.lastSignDate, 'days') < signValidDays) {
        useSameSignKey = !!this.lastSignKey;
    }
    else {
        this.lastSignDate = now;
        useSameSignKey = false;
    }

    var signDate = this.lastSignDate.utc().format('YYYYMMDD');

    reqParams.headers = reqParams.headers || {};
    reqParams.headers[timestampHdr] = timestamp;

    // First step: compute conformed request
    var confReq = reqParams.type + '\n';
    confReq += reqParams.url.substr(reqParams.url.search(apiPath)) + '\n';

    var essentialHeaders = 'host:' + this.host + '\n';
    essentialHeaders += timestampHdr.toLowerCase() + ':' + reqParams.headers[timestampHdr] + '\n';

    confReq += essentialHeaders + '\n';
    confReq += hashData(reqParams.data || '') + '\n';

    // Second step: assemble string to sign
    var strToSign = signMethodId + '\n';
    strToSign += timestamp + '\n';

    var scope = signDate + '/' + scopeRequest;

    strToSign += scope + '\n';
    strToSign += hashData(confReq) + '\n';

    // Third step: generate the signature
    var signKey;

    if (useSameSignKey) {
        signKey = this.lastSignKey;
    }
    else {
        var dateKey = signData(signDate, signVersionId + this.apiAccessSecret);
        signKey = this.lastSignKey = signData(scopeRequest, dateKey);
    }

    var result = {
        credential: this.deviceId + '/' + scope,
        signature: signData(strToSign, signKey, true)
    };

    // Step four: add authorization header
    reqParams.headers.Authorization = signMethodId + ' Credential=' + result.credential  + ', Signature=' + result.signature;

    return result;
}

function hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
}

function signData(data, secret, hexEncode) {
    return crypto.createHmac('sha256', secret).update(data).digest(hexEncode ? 'hex' : undefined);
}

function formatMethodPath(methodPath, params) {
    var formattedMethodPath = methodPath;

    if (typeof params === 'object' && params !== null) {
        if (typeof params.url === 'object' && Array.isArray(params.url)) {
            params.url.forEach(function (urlParam) {
                formattedMethodPath = formattedMethodPath.replace(/:\w+/, encodeURI(urlParam));
            });
        }

        if (typeof params.query === 'object' && params.query !== null) {
            var queryStr = '';
            for (var queryParam in params.query) {
                if (queryStr.length > 0) {
                    queryStr += '&';
                }
                queryStr += encodeURI(queryParam) + '=' + encodeURI(params.query[queryParam]);
            }
            if (queryStr.length > 0) {
                formattedMethodPath += '?' + queryStr;
            }
        }
    }

    return formattedMethodPath;
}

function filterDefinedProperties(obj) {
    if (typeof obj === 'object' && obj !== null) {
        var filteredObj = {};

        Object.keys(obj).forEach(function (key) {
            if (obj[key] !== undefined) {
                filteredObj[key] = obj[key];
            }
        });

        obj = filteredObj;
    }

    return obj;
}

// WebSocket Notification Channel function class constructor
//
//  Parameters:
//    apiClient: [Object] - Instance of API Client function class
//    eventName: [String] - Name of Catenis notification event
//
//  Events:
//    'error'   - WebSocket error. Handler parameters: error
//    'close'   - WebSocket connection closed. Handler parameters: code [Number], reason [String]
//    'message' - Data received. Handler parameters: data [????]
function WsNotifyChannel(apiClient, eventName) {
    this.apiClient = apiClient;
    this.eventName = eventName;
}

// Make NotifyChannel to inherit from EventEmitter
heir.inherit(WsNotifyChannel, EventEmitter, true);

WsNotifyChannel.prototype.open = function (cb) {
    // Make sure that WebSocket has not been instantiated yet
    if (this.ws === undefined) {
        // NOTE: this request is only used to retrieve the data used for authentication,
        //        which is done by sending the message right after the connection is open.
        //        The actual request used to establish the WebSocket connection (which
        //        has no authentication info) is created and sent by the WebSocket object
        var wsReq = getSignedWsConnectRequest.call(this);

        this.ws = new WebSocket(wsReq.url, [notifyWsSubprotocol]);

        var self = this;

        this.ws.on('open', function (open) {
            // Send authentication message
            var authMsgData = {};

            authMsgData[timestampHdr.toLocaleLowerCase()] = wsReq.headers[timestampHdr];
            authMsgData.authorization = wsReq.headers.Authorization;

            this.send(JSON.stringify(authMsgData));

            if (typeof cb === 'function') {
                // Call callback to indicate that WebSocket connection is open
                cb.call(self);
            }
        });

        this.ws.on('error', function (error) {
            if (this.readyState === WebSocket.CONNECTING) {
                // Error while trying to open WebSocket connection
                if (typeof cb === 'function') {
                    // Call callback passing the error
                    cb.call(self, error);

                    // Close the connection
                    this.close(1011);
                }
            }
            else {
                // Emit error event
                self.emit('error', error);

                if (this.readyState !== WebSocket.CLOSING && this.readyState !== WebSocket.CLOSED) {
                    // Close the connection
                    this.close(1011);
                }
            }
        });

        this.ws.on('close', function (closeCode, closeMessage) {
            // Emit close event
            self.emit('close', closeCode, closeMessage);

            // Terminate instantiated WebSocket
            self.ws = undefined;
        });

        this.ws.on('message', function (message) {
            if (message === notifyChannelOpenMsg) {
                // Special notification channel open message. Emit open event indicating that
                //  notification channel is successfully open and ready to send notifications
                self.emit('open');
            }
            else {
                // Emit message event passing the received data (as a JSON string)
                // NOTE: this event is DEPRECATED (in favour of the new 'notify' event) and should be
                //        removed in future versions of the library
                self.emit('message', message);
                // Emit notify event passing the received data (as a deserialized JSON object)
                self.emit('notify', JSON.parse(message));
            }
        });
    }
};

WsNotifyChannel.prototype.close = function () {
    // Make sure that WebSocket is instantiated and open
    if (this.ws !== undefined && this.ws.readyState === WebSocket.OPEN) {
        // Close the WebSocket connection
        this.ws.close(1000);
    }
};

function getSignedWsConnectRequest() {
    var reqParams = {
        url: this.apiClient.rootWsNtfyEndPoint + '/' + this.eventName,
        type: "GET"
    };

    signRequest.call(this.apiClient, reqParams);

    return reqParams;
}

// Export function class
exports = module.exports = ApiClient;
