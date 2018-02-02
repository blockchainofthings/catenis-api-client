/*
* @Author: mahesh
* @Date:   2017-12-20 21:53:39
*/

const CtnApiClient = require('./index.js');

var device = {};
var lastMsgId;
var ctnApiClient;

function initApiClient() {
    var env = {
	    defaultDevice: {
	        deviceId: 'dLiZ68ZngyhdnacvxGvw',
	        apiAccessSecret: '7e2fce24838209fc3bc3ed4b7659ee6e8fdada79c5fa91b625e8d816ac40c0cd3d473307f64f42e70cfc0115ea335425ee1a91dc72b9f5110b6aa557bfc4146f'
	    },
	    opts: {
	        environment: 'beta'
	    }
	}

    if (!device.deviceId) {
        device = env.defaultDevice;
    }

    ctnApiClient = new CtnApiClient(device.deviceId, device.apiAccessSecret, env.opts);
}

function logMessage(message, encoding, encrypt, storage) {
    ctnApiClient.logMessage(message, {
        encoding: encoding,
        encrypt: encrypt,
        storage: storage
    }, processMessageResult);
}

function processMessageResult(err, data) {
    if (!err && typeof data.data === 'object' && data.data !== null && typeof data.data.messageId === 'string') {
        lastMsgId = data.data.messageId;
    }

    console.log(lastMsgId);
}

initApiClient();
logMessage("hello", "utf8", true, "auto");
