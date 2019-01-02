xdescribe('Test changes to Catenis API client ver. 2.0.0.', function  () {
    var readline = require('readline');
    var CatenisApiClient = require('catenis-api-client');
    var CatenisApiError = require('catenis-api-client/lib/CatenisApiError');

    var rl;
    var device1 = {
        id: 'd8YpQ7jgPBJEkBrnvp58'
    };
    var accessKey1;
    var apiClient;

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

                // Instantiate Catenis API client
                apiClient = new CatenisApiClient(
                    device1.id,
                    accessKey1, {
                        host: 'localhost:3000',
                        secure: false
                    }
                );

                done();
            });
        });
    }, 60000);

    afterAll(function () {
        if (rl) {
            rl.close();
        }
    });

    it('Call API method with empty URL parameter', function (done) {
        apiClient.retrieveMessageContainer('', function (error, result) {
            if (error) {
                expect(error.message).toBe('Error returned from Catenis API endpoint: [400] Invalid message ID');
                done();
            }
            else {
                done.fail('API method call should have failed');
            }
        })
    });

    it('Call List Messages API method with from devices filter with device ID', function (done) {
        apiClient.listMessages({
            action: 'send',
            direction: 'inbound',
            fromDevices: [{
                id: 'drc3XdxNtzoucpw9xiRP'
            }]
        }, function (error, result) {
            if (error) {
                done.fail('API method call should not have failed. Returned error: ' + error);
            }
            else {
                done();
            }
        });
    });

    it('Call List Messages API method with from devices filter with product unique ID', function (done) {
        apiClient.listMessages({
            action: 'send',
            direction: 'outbound',
            fromDevices: [{
                id: 'drc3XdxNtzoucpw9xiRP',
                isProdUniqueId: true
            }]
        }, function (error, result) {
            if (error) {
                done.fail('API method call should not have failed. Returned error: ' + error);
            }
            else {
                done();
            }
        });
    });

    it('Call List Messages API method with to devices filter with device ID', function (done) {
        apiClient.listMessages({
            action: 'send',
            direction: 'outbound',
            toDevices: [{
                id: 'drc3XdxNtzoucpw9xiRP'
            }]
        }, function (error, result) {
            if (error) {
                done.fail('API method call should not have failed. Returned error: ' + error);
            }
            else {
                done();
            }
        });
    });

    it('Call List Messages API method with to devices filter with product unique ID', function (done) {
        apiClient.listMessages({
            action: 'send',
            direction: 'inbound',
            toDevices: [{
                id: 'drc3XdxNtzoucpw9xiRP',
                isProdUniqueId: true
            }]
        }, function (error, result) {
            if (error) {
                done.fail('API method call should not have failed. Returned error: ' + error);
            }
            else {
                done();
            }
        });
    });

    it('Call List Messages API method with invalid start date', function (done) {
        apiClient.listMessages({startDate: 'jjjfjlkjla'}, function (error, result) {
            if (error) {
                expect(error.message).toBe('Error returned from Catenis API endpoint: [400] Invalid parameters');
                done();
            }
            else {
                done.fail('API method call should have failed');
            }
        });
    });

    it('Call List Messages API method with invalid start date', function (done) {
        apiClient.listMessages({endDate: 'fjdajfjlaj'}, function (error, result) {
            if (error) {
                expect(error.message).toBe('Error returned from Catenis API endpoint: [400] Invalid parameters');
                done();
            }
            else {
                done.fail('API method call should have failed');
            }
        });
    });

    it('Call List Messages API method with ISO8601 formatted dates', function (done) {
        apiClient.listMessages({startDate: '2018-11-29', endDate: '2018-11-29'}, function (error, result) {
            if (error) {
                done.fail('API method call should not have failed. Returned error: ' + error);
            }
            else {
                done();
            }
        });
    });

    it('Call List Messages API method with Date objects', function (done) {
        apiClient.listMessages({startDate: new Date(), endDate: new Date()}, function (error, result) {
            if (error) {
                done.fail('API method call should not have failed. Returned error: ' + error);
            }
            else {
                done();
            }
        });
    });
    
    it('Call Retrieve Asset Issuance History API method with invalid start date', function (done) {
        apiClient.retrieveAssetIssuanceHistory('aCzArpN97RBPktgx4qmD', 'jjjfjlkjla', null, function (error, result) {
            if (error) {
                expect(error.message).toBe('Error returned from Catenis API endpoint: [400] Invalid parameters');
                done();
            }
            else {
                done.fail('API method call should have failed');
            }
        });
    });

    it('Call Retrieve Asset Issuance History API method with invalid end date', function (done) {
        apiClient.retrieveAssetIssuanceHistory('aCzArpN97RBPktgx4qmD', null, 'fjdajfjlaj', function (error, result) {
            if (error) {
                expect(error.message).toBe('Error returned from Catenis API endpoint: [400] Invalid parameters');
                done();
            }
            else {
                done.fail('API method call should have failed');
            }
        });
    });

    it('Call Retrieve Asset Issuance History API method with ISO8601 formatted dates', function (done) {
        apiClient.retrieveAssetIssuanceHistory('aCzArpN97RBPktgx4qmD', '2018-11-29', '2018-11-29', function (error, result) {
            if (error) {
                done.fail('API method call should not have failed. Returned error: ' + error);
            }
            else {
                done();
            }
        });
    });

    it('Call Retrieve Asset Issuance History API method with Date objects', function (done) {
        apiClient.retrieveAssetIssuanceHistory('aCzArpN97RBPktgx4qmD', new Date(), new Date(), function (error, result) {
            if (error) {
                done.fail('API method call should not have failed. Returned error: ' + error);
            }
            else {
                done();
            }
        });
    });
});