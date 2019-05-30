describe('Test changes to Catenis API client ver. 3.1.0.', function  () {
    var readline = require('readline');
    var CatenisApiClient = require('catenis-api-client');

    var rl;
    var device1 = {
        id: 'drc3XdxNtzoucpw9xiRp'
    };
    var accessKey1;
    var apiClient;
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

                // Instantiate Catenis API clients
                apiClient = new CatenisApiClient(
                    device1.id,
                    accessKey1, {
                        host: 'localhost:3000',
                        secure: false
                    }
                );

                // Create WebSocket notification channel to indicate when message is received
                wsNotifyChannel = apiClient.createWsNotifyChannel('new-msg-received');

                done();
            });
        });
    }, 120000);

    afterAll(function () {
        if (rl) {
            rl.close();
        }
    });

    it('WebSocket notification channel should emit open event', function (done) {
        // Wire notification event
        wsNotifyChannel.addListener('error', function (error) {
            done.fail('\'Error\' event received instead of \'open\' event. Returned error: ' + error);
        });

        wsNotifyChannel.addListener('close', function (code, reason) {
            done.fail('\'Close\' event received instead of \'open\' event. Returned close info: [' + code + '] - ' + reason);
        });

        wsNotifyChannel.addListener('notify', function(data) {
            done.fail('\'Notify\' event received instead of \'open\' event. Returned data: ' + JSON.stringify(data));
        });

        wsNotifyChannel.addListener('open', function() {
            done();
        });

        // Open notification channel
        wsNotifyChannel.open(function (error) {
            if (error) {
                done.fail('Error opening WebSocket notification channel. Returned error: ' + error);
            }
            else {
                // WebSocket client successfully connected. Wait for open event
            }
        });
    });
});