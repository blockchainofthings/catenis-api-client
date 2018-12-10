var readline = require('readline');
var CatenisApiClient = require('catenis-api-client');

describe('Test changes to Catenis API client ver. 2.1.0.', function  () {
    var rl;
    var device1 = {
        id: 'd8YpQ7jgPBJEkBrnvp58'
    };
    var device2 = {
        id: 'drc3XdxNtzoucpw9xiRp'
    };
    var accessKey1;
    var accessKey2;
    var apiClient;
    var apiClient2;
    var wsNotifyChannel;

    beforeAll(function (done) {
        rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question('Device #1 ID: [' + device1.id + '] ', function (deviceId) {
            if (deviceId) {
                device1.id = deviceId;
            }

            rl.question('Device #1 API access key: ', function (accessKey) {
                accessKey1 = accessKey;

                rl.question('Device #2 ID: [' + device2.id + '] ', function (deviceId) {
                    if (deviceId) {
                        device2.id = deviceId;
                    }

                    rl.question('Device #2 API access key: ', function (accessKey) {
                        accessKey2 = accessKey;

                        // Instantiate Catenis API clients
                        apiClient = new CatenisApiClient(
                            device1.id,
                            accessKey1, {
                                host: 'localhost:3000',
                                secure: false
                            }
                        );
                        apiClient2 = new CatenisApiClient(
                            device2.id,
                            accessKey2, {
                                host: 'localhost:3000',
                                secure: false
                            }
                        );

                        // Create WebSocket notification channel to indicate when message is received
                        wsNotifyChannel = apiClient.createWsNotifyChannel('new-msg-received');
                        done();
                    })
                });
            });
        });
    }, 120000);

    afterAll(function () {
        if (rl) {
            rl.close();
        }
    });

    it('Handle notify event of WebSocket notification channel', function (done) {
        // Wire notification event
        wsNotifyChannel.addListener('error', function (error) {
            done.fail('Error with WebSocket notification channel. Returned error: ' + error);
        });

        wsNotifyChannel.addListener('close', function (code, reason) {
            done.fail('WebSocket notification channel closed unexpectedly. [' + code + '] - ' + reason);
        });

        wsNotifyChannel.addListener('notify', function(data) {
            expect(data).toEqual(jasmine.any(Object));
            done();
        });

        // Open notification channel
        wsNotifyChannel.open(function (error) {
            if (error) {
                done.fail('Error opening WebSocket notification channel. Returned error: ' + error);
            }
            else {
                // WebSocket notification channel is open.
                //  Send message
                apiClient2.sendMessage(device1, 'Only a test', null, function (error) {
                    if (error) {
                        done.fail('Failed to send message. Returned error: ' + error);
                    }
                })
            }
        });
    });
});