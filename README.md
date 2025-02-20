# Catenis API Client for Node.js

This module is used to make it easier to access the Catenis API services from Node.js applications.

This current release (7.1.0) targets version 0.13 of the Catenis API.

## Notice of deprecation

This module has been **DEPRECATED** in favor of a new library, namely [Catenis API Client for (Modern) JavaScript](https://github.com/blockchainofthings/catenis-api-client-js-modern),
that makes use of modern JavaScript constructs and Web APIs.

## Installation

```shell
npm install catenis-api-client
```

## Usage

Load catenis-api-client module.

```JavaScript
var CatenisApiClient = require('catenis-api-client');
```

### Instantiate the client
 
```JavaScript
var ctnApiClient = new CatenisApiClient(deviceId, apiAccessSecret, {
    environment: 'sandbox'
});
```

Optionally, the client can be instantiated without passing both the `deviceId` and the `apiAccessSecret` parameters as
 shown below. In this case, the resulting client object should be used to call only **public** API methods.

```JavaScript
var ctnApiClient = new CatenisApiClient({
    environment: 'sandbox'
});
```

#### Constructor options

The following options can be used when instantiating the client:

- **host** \[String\] - (optional, default: <b>*'catenis.io'*</b>) Host name (with optional port) of target Catenis API server.
- **environment** \[String\] - (optional, default: <b>*'prod'*</b>) Environment of target Catenis API server. Valid values: *'prod'*, *'sandbox'*.
- **secure** \[Boolean\] - (optional, default: ***true***) Indicates whether a secure connection (HTTPS) should be used.
- **version** \[String\] - (optional, default: <b>*'0.13'*</b>) Version of Catenis API to target.
- **useCompression** \[Boolean\] - (optional, default: ***true***) Indicates whether request/response body should be compressed.
- **compressThreshold** \[Number\] - (optional, default: ***1024***) Minimum size, in bytes, of request body for it to be compressed.

### Returned data

On successful calls to the Catenis API, the data returned by the client library methods **only** include the `data` property of the JSON
originally returned in response to a Catenis API request.

For example, you should expect the following data structure to be returned from a successful call to the `logMessage` method:

```JavaScript
{
    messageId: "<message_id>"
}
```

### Logging (storing) a message to the blockchain

#### Passing the whole message's contents at once

```JavaScript
ctnApiClient.logMessage('My message', {
        encoding: 'utf8',
        encrypt: true,
        offChain: true,
        storage: 'auto'
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('ID of logged message:', data.messageId);
        }
});
```

#### Passing the message's contents in chunks

```JavaScript
function logMsgChunk(msgChunks, msgIdx, continuationToken) {
    msgIdx = msgIdx || 0;
    
    ctnApiClient.logMessage({
        data: msgChunks[msgIdx],
        isFinal: msgIdx === msgChunks.length - 1,
        continuationToken: continuationToken
    }, {
        encoding: 'utf8',
        encrypt: true,
        offChain: true,
        storage: 'auto'
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            if (data.continuationToken) {
                // Get continuation token and send next message chunk
                setImmediate(logMsgChunk, msgChunks, msgIdx + 1, data.continuationToken);
            }
            else {
                console.log('ID of logged message:', data.messageId);
            }
        }
    });
};

// Start sending message to be logged
logMsgChunk([
    'First part of message',
    'Second part of message',
    'Third and last part of message'
]);
```

#### Logging message asynchronously

```JavaScript
function getAsyncProgress(provisionalMessageId) {
    ctnApiClient.retrieveMessageProgress(provisionalMessageId,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Number of bytes processed so far:', data.progress.bytesProcessed);
                
            if (data.progress.done) {
                if (data.progress.success) {
                    // Get result
                    console.log('ID of logged message:', data.result.messageId);
                }
                else {
                    // Process error
                    console.error('Asynchronous processing error: [', data.progress.error.code, ' ] -', data.progress.error.message);
                }
            }
            else {
                // Asynchronous processing not done yet. Continue pooling
                setTimeout(getAsyncProgress, 3000, provisionalMessageId);
            }
        }
    });
};

ctnApiClient.logMessage('My message', {
        encoding: 'utf8',
        encrypt: true,
        offChain: true,
        storage: 'auto',
        async: true
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Start pooling for asynchronous processing progress
            setTimeout(getAsyncProgress, 100, data.provisionalMessageId);
        }
});
```

### Sending a message to another device

#### Passing the whole message's contents at once

```JavaScript
ctnApiClient.sendMessage('My message', {
       id: targetDeviceId,
       isProdUniqueId: false
    }, {
        encoding: 'utf8',
        encrypt: true,
        offChain: true,
        storage: 'auto',
        readConfirmation: true
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.send('ID of sent message:', data.messageId);
        }
});
```

#### Passing the message's contents in chunks

```JavaScript
function sendMsgChunk(msgChunks, msgIdx, continuationToken) {
    msgIdx = msgIdx || 0;
    
    ctnApiClient.sendMessage({
        data: msgChunks[msgIdx],
        isFinal: msgIdx === msgChunks.length - 1,
        continuationToken: continuationToken
    }, {
       id: targetDeviceId,
       isProdUniqueId: false
    }, {
        encoding: 'utf8',
        encrypt: true,
        offChain: true,
        storage: 'auto',
        readConfirmation: true
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            if (data.continuationToken) {
                // Get continuation token and send next message chunk
                setImmediate(sendMsgChunk, msgChunks, msgIdx + 1, data.continuationToken);
            }
            else {
                console.log('ID of sent message:', data.messageId);
            }
        }
    });
};

// Start sending message
sendMsgChunk([
    'First part of message',
    'Second part of message',
    'Third and last part of message'
]);
```

#### Sending message asynchronously

```JavaScript
function getAsyncProgress(provisionalMessageId) {
    ctnApiClient.retrieveMessageProgress(provisionalMessageId,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Number of bytes processed so far:', data.progress.bytesProcessed);
                
            if (data.progress.done) {
                if (data.progress.success) {
                    // Get result
                    console.log('ID of logged message:', data.result.messageId);
                }
                else {
                    // Process error
                    console.error('Asynchronous processing error: [', data.progress.error.code, ' ] -', data.progress.error.message);
                }
            }
            else {
                // Asynchronous processing not done yet. Continue pooling
                setTimeout(getAsyncProgress, 3000, provisionalMessageId);
            }
        }
    });
};

ctnApiClient.sendMessage('My message', {
       id: targetDeviceId,
       isProdUniqueId: false
    }, {
        encoding: 'utf8',
        encrypt: true,
        offChain: true,
        storage: 'auto',
        readConfirmation: true,
        async: true
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Start pooling for asynchronous processing progress
            setTimeout(getAsyncProgress, 100, data.provisionalMessageId);
        }
});
```

### Reading a message

#### Retrieving the whole read message's contents at once
 
```JavaScript
ctnApiClient.readMessage(messageId, 'utf8',
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            if (data.msgInfo.action === 'send') {
                console.log('Message sent from:', data.msgInfo.from);
            }

            console.log('Read message:', data.msgData);
        }
});
```

#### Retrieving the read message's contents in chunks

```JavaScript
function readMsgChunk(messageId, chunkCount, continuationToken) {
    chunkCount = chunkCount || 1;
    
    ctnApiClient.readMessage(messageId, {
        encoding: 'utf8',
        continuationToken: continuationToken,
        dataChunkSize: 1024
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            if (data.msgInfo && data.msgInfo.action === 'send') {
                console.log('Message sent from:', data.msgInfo.from);
            }
            
            console.log('Read message (chunk', chunkCount, '):', data.msgData);
            
            if (data.continuationToken) {
                // Get continuation token and get next message chunk
                setImmediate(readMsgChunk, messageId, chunkCount + 1, data.continuationToken);
            }
        }
    });
};

// Start reading message
readMsgChunk(messageId);
```

#### Reading message asynchronously

```JavaScript
function getAsyncProgress(cachedMessageId) {
    ctnApiClient.retrieveMessageProgress(cachedMessageId,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Number of bytes processed so far:', data.progress.bytesProcessed);
                
            if (data.progress.done) {
                if (data.progress.success) {
                    // Actually read the message now
                    readMsg(data.result.messageId, data.result.cachedMessageId);
                }
                else {
                    // Process error
                    console.error('Asynchronous processing error: [', data.progress.error.code, ' ] -', data.progress.error.message);
                }
            }
            else {
                // Asynchronous processing not done yet. Continue pooling
                setTimeout(getAsyncProgress, 3000, cachedMessageId);
            }
        }
    });
};

function readMsg(messageId, continuationToken) {
    ctnApiClient.readMessage(messageId, {
        encoding: 'utf8',
        continuationToken: continuationToken,
        async: true
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            if (data.cachedMessageId) {
                // Start pooling for asynchronous processing progress
                setTimeout(getAsyncProgress, 100, data.cachedMessageId);
            }
            else {
                if (data.msgInfo.action === 'send') {
                    console.log('Message sent from:', data.msgInfo.from);
                }
                
                console.log('Read message:', data.msgData);
            }
        }
    });
};

// Start reading message
readMsg(messageId);
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
            if (data.offChain) {
                console.log('IPFS CID of Catenis off-chain message envelope:', data.offChain.cid);
            }
            
            if (data.blockchain) {
                console.log('ID of blockchain transaction containing the message:', data.blockchain.txid);
            }
    
            if (data.externalStorage) {
                console.log('IPFS reference to message:', data.externalStorage.ipfs);
            }
        }
});
```

### Retrieving information about a message's origin

```JavaScript
ctnApiClient.retrieveMessageOrigin(messageId, 'Any text to be signed',
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            if (data.tx) {
                console.log('Catenis message transaction info:', data.tx);
            }

            if (data.offChainMsgEnvelope) {
                console.log('Off-chain message envelope info:', data.offChainMsgEnvelope);
            }

            if (data.proof) {
                console.log('Origin proof info:', data.proof);
            }
        }
});
```

### Retrieving asynchronous message processing progress

```JavaScript
ctnApiClient.retrieveMessageProgress(provisionalMessageId,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Number of bytes processed so far:', data.progress.bytesProcessed);
                
            if (data.progress.done) {
                if (data.progress.success) {
                    // Get result
                    console.log('Asynchronous processing result:', data.result);
                }
                else {
                    // Process error
                    console.error('Asynchronous processing error: [', data.progress.error.code, ' ] -', data.progress.error.message);
                }
            }
            else {
                // Asynchronous processing not done yet. Continue pooling
            }
        }
});
```

> **Note**: see the *Logging message asynchronously*, *Sending message asynchronously* and *Reading message
>asynchronously* sections above for more complete examples.

### Listing messages

```JavaScript
ctnApiClient.listMessages({
        action: 'send',
        direction: 'inbound',
        readState: 'unread',
        startDate: '20170101T000000Z'
    }, 200, 0,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            if (data.msgCount > 0) {
                console.log('Returned messages:', data.messages);
                
                if (data.hasMore) {
                    console.log('Not all messages have been returned');
                }
            }
        }
});
```

> **Note**: the parameters taken by the *listMessages* method do not exactly match the parameters taken by the List
 Messages Catenis API method. Most of the parameters, except for the last two (`limit` and `skip`), are
 mapped to fields of the first parameter (`selector`) of the *listMessages* method with a few singularities: parameters
 `fromDeviceIds` and `fromDeviceProdUniqueIds` and parameters `toDeviceIds` and `toDeviceProdUniqueIds` are replaced with
 fields `fromDevices` and `toDevices`, respectively. Those fields take an array of device ID objects, which is the same
 type of object taken by the first parameter (`targetDevice`) of the *sendMessage* method. Also, the date fields,
 `startDate` and `endDate`, accept not only strings containing ISO 8601 formatted dates/times but also *Date* objects.

### Issuing an amount of a new asset

```JavaScript
ctnApiClient.issueAsset({
        name: 'XYZ001',
        description: 'My first test asset',
        canReissue: true,
        decimalPlaces: 2
    }, 1500.00, null,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('ID of newly issued asset:', data.assetId);
        }
});
```

### Issuing an additional amount of an existing asset

```JavaScript
ctnApiClient.reissueAsset(assetId, 650.25, {
        id: otherDeviceId,
        isProdUniqueId: false
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Total existent asset balance (after issuance):', data.totalExistentBalance);
        }
});
```

### Transferring an amount of an asset to another device

```JavaScript
ctnApiClient.transferAsset(assetId, 50.75, {
        id: otherDeviceId,
        isProdUniqueId: false
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Remaining asset balance:', data.remainingBalance);
        }
});
```

### Creating a new non-fungible asset and issuing its (initial) non-fungible tokens

#### Passing non-fungible token contents in a single call

```JavaScript
ctnApiClient.issueNonFungibleAsset({
        assetInfo: {
            name: 'Catenis NFA 1',
            description: 'Non-fungible asset #1 for testing',
            canReissue: true
        }
    }, [{
        metadata: {
            name: 'NFA1 NFT 1',
            description: 'First token of Catenis non-fungible asset #1'
        },
        contents: {
            data: 'Contents of first token of Catenis non-fungible asset #1',
            encoding: 'utf8'
        }
    }, {
        metadata: {
            name: 'NFA1 NFT 2',
            description: 'Second token of Catenis non-fungible asset #1'
        },
        contents: {
            data: 'Contents of second token of Catenis non-fungible asset #1',
            encoding: 'utf8'
        }
    }],
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('ID of newly created non-fungible asset:', data.assetId);
            console.log('IDs of newly issued non-fungible tokens:', data.nfTokenIds);
        }
});
```

#### Passing non-fungible token contents in multiple calls

```JavaScript
function issueNFAsset(issuanceInfoOrContinuationToken, nftMetadata, nftContents, callIdx, callback) {
    var isContinuationCall = typeof issuanceInfoOrContinuationToken === 'string';
    
    var nfTokens;
    
    if (!isContinuationCall) {
        nfTokens = nftMetadata.map(function (metadata, tokenIdx) {
            var nfToken = {
                metdata: metadata
            };
            
            var contents = nftContents[tokenIdx];
            
            if (contents) {
                nfToken.contents = contents[callIdx];   
            }
            
            return nfToken;
        });
    }
    else {  // Continuation call
        nfTokens = nftContents.map(function (contents, tokenIdx) {
            return contents && callIdx < contents.length
                ? {contents: contents[callIdx]}
                : null;
        });
        
        if (nfTokens.every(function (nfToken) {return nfToken === null})) {
            nfTokens = undefined;
        }
    }
    
    ctnApiClient.issueNonFungibleAsset(
        issuanceInfoOrContinuationToken,
        nfTokens,
        nfTokens === undefined,
        function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                if (data.continuationToken) {
                    // Continue passing non-fungible tokens' contents
                    issueNFAsset(data.continuationToken, undefined, nftContents, ++callIdx, callback);
                }
                else {
                    // Return issuance result
                    callback(null, data);
                }
            }
    });
}

issueNFAsset({
        assetInfo: {
            name: 'Catenis NFA 1',
            description: 'Non-fungible asset #1 for testing',
            canReissue: true
        }
    }, [{
        name: 'NFA1 NFT 1',
        description: 'First token of Catenis non-fungible asset #1'
    }, {
        name: 'NFA1 NFT 2',
        description: 'Second token of Catenis non-fungible asset #1'
    }], [
        [{
            data: 'Contents of first token of Catenis non-fungible asset #1',
            encoding: 'utf8'
        }],
        [{
            data: 'Here is the contents of the second token of Catenis non-fungible asset #1 (part #1)',
            encoding: 'utf8'
        }, {
            data: '; and here is the last part of the contents of the second token of Catenis non-fungible asset #1.',
            encoding: 'utf8'
        }]
    ], 0,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('ID of newly created non-fungible asset:', data.assetId);
            console.log('IDs of newly issued non-fungible tokens:', data.nfTokenIds);
        }
});
```

#### Doing issuance asynchronously

```JavaScript
function getAsyncProgress (assetIssuanceId) {
    ctnApiClient.retrieveNonFungibleAssetIssuanceProgress(
        assetIssuanceId,
        function (err, data) {
            if (err) {
                // Process error
            }
            else {
                // Process returned data
                console.log('Percent processed:', data.progress.percentProcessed);
                    
                if (data.progress.done) {
                    if (data.progress.success) {
                        // Display result
                        console.log('ID of newly created non-fungible asset:', data.result.assetId);
                        console.log('IDs of newly issued non-fungible tokens:', data.result.nfTokenIds);
                    }
                    else {
                        // Process error
                        console.error('Asynchronous processing error: [', data.progress.error.code, ' ] -', data.progress.error.message);
                    }
                }
                else {
                    // Asynchronous processing not done yet. Continue pooling
                    setTimeout(getAsyncProgress, 100, assetIssuanceId);
                }
            }
        }
    );
}

ctnApiClient.issueNonFungibleAsset({
        assetInfo: {
            name: 'Catenis NFA 1',
            description: 'Non-fungible asset #1 for testing',
            canReissue: true
        },
        async: true
    }, [{
        metadata: {
            name: 'NFA1 NFT 1',
            description: 'First token of Catenis non-fungible asset #1'
        },
        contents: {
            data: 'Contents of first token of Catenis non-fungible asset #1',
            encoding: 'utf8'
         }
    }, {
        metadata: {
            name: 'NFA1 NFT 2',
            description: 'Second token of Catenis non-fungible asset #1'
        },
        contents: {
            data: 'Contents of second token of Catenis non-fungible asset #1',
            encoding: 'utf8'
        }
    }],
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Start pooling for asynchronous processing progress
            setTimeout(getAsyncProgress, 100, data.assetIssuanceId);
        }
});
```

### Issuing more non-fungible tokens for a previously created non-fungible asset

#### Passing non-fungible token contents in a single call

```JavaScript
ctnApiClient.reissueNonFungibleAsset(assetId, [{
        metadata: {
            name: 'NFA1 NFT 3',
            description: 'Third token of Catenis non-fungible asset #1'
        },
        contents: {
            data: 'Contents of third token of Catenis non-fungible asset #1',
            encoding: 'utf8'
        }
    }, {
        metadata: {
            name: 'NFA1 NFT 4',
            description: 'Forth token of Catenis non-fungible asset #1'
        },
        contents: {
            data: 'Contents of forth token of Catenis non-fungible asset #1',
            encoding: 'utf8'
        }
    }],
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('IDs of newly issued non-fungible tokens:', data.nfTokenIds);
        }
});
```

#### Passing non-fungible token contents in multiple calls

```JavaScript
function reissueNFAsset(assetId, issuanceInfoOrContinuationToken, nftMetadata, nftContents, callIdx, callback) {
    var isContinuationCall = typeof issuanceInfoOrContinuationToken === 'string';
    
    var nfTokens;
    
    if (!isContinuationCall) {
        nfTokens = nftMetadata.map(function (metadata, tokenIdx) {
            var nfToken = {
                metdata: metadata
            };
            
            var contents = nftContents[tokenIdx];
            
            if (contents) {
                nfToken.contents = contents[callIdx];   
            }
            
            return nfToken;
        });
    }
    else {  // Continuation call
        nfTokens = nftContents.map(function (contents, tokenIdx) {
            return contents && callIdx < contents.length
                ? {contents: contents[callIdx]}
                : null;
        });
        
        if (nfTokens.every(function (nfToken) {return nfToken === null})) {
            nfTokens = undefined;
        }
    }
    
    ctnApiClient.reissueNonFungibleAsset(
        assetId,
        issuanceInfoOrContinuationToken,
        nfTokens,
        nfTokens === undefined,
        function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                if (data.continuationToken) {
                    // Continue passing non-fungible tokens' contents
                    reissueNFAsset(assetId, data.continuationToken, undefined, nftContents, ++callIdx, callback);
                }
                else {
                    // Return reissuance result
                    callback(null, data);
                }
            }
    });
}

reissueNFAsset(assetId, undefined, [{
        name: 'NFA1 NFT 3',
        description: 'Third token of Catenis non-fungible asset #1'
    }, {
        name: 'NFA1 NFT 4',
        description: 'Forth token of Catenis non-fungible asset #1'
    }], [
        [{
            data: 'Contents of third token of Catenis non-fungible asset #1',
            encoding: 'utf8'
        }],
        [{
            data: 'Here is the contents of the forth token of Catenis non-fungible asset #1 (part #1)',
            encoding: 'utf8'
        }, {
            data: '; and here is the last part of the contents of the forth token of Catenis non-fungible asset #1.',
            encoding: 'utf8'
        }]
    ], 0,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('IDs of newly issued non-fungible tokens:', data.nfTokenIds);
        }
});
```

#### Doing issuance asynchronously

```JavaScript
function getAsyncProgress (assetIssuanceId) {
    ctnApiClient.retrieveNonFungibleAssetIssuanceProgress(
        assetIssuanceId,
        function (err, data) {
            if (err) {
                // Process error
            }
            else {
                // Process returned data
                console.log('Percent processed:', data.progress.percentProcessed);
                    
                if (data.progress.done) {
                    if (data.progress.success) {
                        // Display result
                        console.log('IDs of newly issued non-fungible tokens:', data.result.nfTokenIds);
                    }
                    else {
                        // Process error
                        console.error('Asynchronous processing error: [', data.progress.error.code, ' ] -', data.progress.error.message);
                    }
                }
                else {
                    // Asynchronous processing not done yet. Continue pooling
                    setTimeout(getAsyncProgress, 100, assetIssuanceId);
                }
            }
        }
    );
}

ctnApiClient.reissueNonFungibleAsset(assetId, {
        async: true
    }, [{
        metadata: {
            name: 'NFA1 NFT 3',
            description: 'Third token of Catenis non-fungible asset #1'
         },
         contents: {
            data: 'Contents of third token of Catenis non-fungible asset #1',
            encoding: 'utf8'
         }
    }, {
        metadata: {
            name: 'NFA1 NFT 4',
            description: 'Forth token of Catenis non-fungible asset #1'
        },
        contents: {
            data: 'Contents of forth token of Catenis non-fungible asset #1',
            encoding: 'utf8'
        }
    }],
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Start pooling for asynchronous processing progress
            setTimeout(getAsyncProgress, 100, data.assetIssuanceId);
        }
});
```

### Retrieving the data associated with a non-fungible token

#### Doing retrieval synchronously

```JavaScript
function retrieveNFToken(tokenId, optionsOrContinuationToken, nfTokenData, callback) {
    if (typeof optionsOrContinuationToken === 'string') {
        optionsOrContinuationToken = {continuationToken: optionsOrContinuationToken};
    }

    ctnApiClient.retrieveNonFungibleToken(
        tokenId,
        optionsOrContinuationToken,
        function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                if (!nfTokenData) {
                    // Get token data
                    nfTokenData = {
                        assetId: data.nonFungibleToken.assetId,
                        metadata: data.nonFungibleToken.metadata,
                        contents: [data.nonFungibleToken.contents.data]
                    };
                }
                else {
                    // Add next contents part to token data
                    nfTokenData.contents.push(data.nonFungibleToken.contents.data);
                }
                
                if (data.continuationToken) {
                    // Continue retrieving token's contents
                    retrieveNFToken(tokenId, data.continuationToken, nfTokenData, callback);
                }
                else {
                    // Return token data
                    callback(null, nfTokenData);
                }
            }
        }
    );
}

retrieveNFToken(tokenId, {}, undefined,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Non-fungible token data:', data);
        }
});
```

#### Doing retrieval asynchronously

```JavaScript
function retrieveNFToken(tokenId, optionsOrcontinuationToken, nfTokenData, callback) {
    if (typeof optionsOrcontinuationToken === 'string') {
        optionsOrcontinuationToken = {continuationToken: optionsOrcontinuationToken};
    }

    ctnApiClient.retrieveNonFungibleToken(
        tokenId,
        optionsOrcontinuationToken,
        function (err, data) {
            if (err) {
                callback(err);
            }
            else {
                if (!nfTokenData) {
                    // Get token data
                    nfTokenData = {
                        assetId: data.nonFungibleToken.assetId,
                        metadata: data.nonFungibleToken.metadata,
                        contents: [data.nonFungibleToken.contents.data]
                    };
                }
                else {
                    // Add next contents part to token data
                    nfTokenData.contents.push(data.nonFungibleToken.contents.data);
                }
                
                if (data.continuationToken) {
                    // Continue retrieving token's contents
                    retrieveNFToken(tokenId, data.continuationToken, nfTokenData, callback);
                }
                else {
                    // Return token data
                    callback(null, nfTokenData);
                }
            }
        }
    );
}

function getAsyncProgress (tokenId, tokenRetrievalId) {
    ctnApiClient.retrieveNonFungibleTokenRetrievalProgress(
        tokenId,
        tokenRetrievalId,
        function (err, data) {
            if (err) {
                // Process error
            }
            else {
                // Process returned data
                console.log('Bytes already retrieved:', data.progress.bytesRetrieved);

                if (data.progress.done) {
                    if (data.progress.success) {
                        // Finish retrieving the non-fungible token data
                        retrieveNFToken(tokenId, data.continuationToken, undefined,
                            function (err, data) {
                                if (err) {
                                    // Process error
                                }
                                else {
                                    // Display result
                                    console.log('Non-fungible token data:', data);
                                }
                            }
                        );
                    }
                    else {
                        // Process error
                        console.error('Asynchronous processing error: [', data.progress.error.code, ' ] -', data.progress.error.message);
                    }
                }
                else {
                    // Asynchronous processing not done yet. Continue pooling
                    setTimeout(getAsyncProgress, 100, tokenId, tokenRetrievalId);
                }
            }
        }
    );
}

ctnApiClient.retrieveNonFungibleToken(
    tokenId, {
        async: true
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Start pooling for asynchronous processing progress
            setTimeout(getAsyncProgress, 100, tokenId, data.tokenRetrievalId);
        }
});
```

### Transferring a non-fungible token to another device

#### Doing transfer synchronously

```JavaScript
ctnApiClient.transferNonFungibleToken(
    tokenId, {
        id: otherDeviceId,
        isProdUniqueId: false
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Non-fungible token successfully transferred');
        }
    }
);
```

#### Doing transfer asynchronously

```JavaScript
function getAsyncProgress (tokenId, tokenTransferId) {
    ctnApiClient.retrieveNonFungibleTokenTransferProgress(
        tokenId,
        tokenTransferId,
        function (err, data) {
            if (err) {
                // Process error
            }
            else {
                // Process returned data
                console.log('Current data manipulation:', data.progress.dataManipulation);

                if (data.progress.done) {
                    if (data.progress.success) {
                        // Display result
                        console.log('Non-fungible token successfuly transferred');
                    }
                    else {
                        // Process error
                        console.error('Asynchronous processing error: [', data.progress.error.code, ' ] -', data.progress.error.message);
                    }
                }
                else {
                    // Asynchronous processing not done yet. Continue pooling
                    setTimeout(getAsyncProgress, 100, tokenId, tokenTransferId);
                }
            }
        }
    );
}

ctnApiClient.transferNonFungibleToken(
    tokenId, {
        id: otherDeviceId,
        isProdUniqueId: false
    },
    true,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Start pooling for asynchronous processing progress
            setTimeout(getAsyncProgress, 100, tokenId, data.tokenTransferId);
        }
});
```

### Retrieving information about a given asset

```JavaScript
ctnApiClient.retrieveAssetInfo(assetId,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Asset info:', data);
        }
});
```

### Getting the current balance of a given asset held by the device

```JavaScript
ctnApiClient.getAssetBalance(assetId,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Current asset balance:', data.balance.total);
            console.log('Amount not yet confirmed:', data.balance.unconfirmed);
        }
});
```

### Listing assets owned by the device

```JavaScript
ctnApiClient.listOwnedAssets(200, 0,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            data.ownedAssets.forEach(function (ownedAsset, idx) {
                console.log('Owned asset #', idx + 1, ':');
                console.log('  - asset ID:', ownedAsset.assetId);
                console.log('  - current asset balance:', ownedAsset.balance.total);
                console.log('  - amount not yet confirmed:', ownedAsset.balance.unconfirmed);
            });

            if (data.hasMore) {
                console.log('Not all owned assets have been returned');
            }
        }
});
```

### Listing assets issued by the device

```JavaScript
ctnApiClient.listIssuedAssets(200, 0,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            data.issuedAssets.forEach(function (issuedAsset, idx) {
                console.log('Issued asset #', idx + 1, ':');
                console.log('  - asset ID:', issuedAsset.assetId);
                console.log('  - total existent balance:', issuedAsset.totalExistentBalance);
            });

            if (data.hasMore) {
                console.log('Not all issued assets have been returned');
            }
        }
});
```

### Retrieving issuance history for a given asset

```JavaScript
ctnApiClient.retrieveAssetIssuanceHistory(assetId, '20170101T000000Z', null, 200, 0,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            data.issuanceEvents.forEach(function (issuanceEvent, idx) {
                console.log('Issuance event #', idx + 1, ':');

                if (!issuanceEvent.nfTokenIds) {
                 console.log('  - issued amount:', issuanceEvent.amount);
                }
                else {
                 console.log('  - IDs of issued non-fungible tokens:', issuanceEvent.nfTokenIds);
                }
   
                if (!issuanceEvent.holdingDevices) {
                 console.log('  - device to which issued amount has been assigned:', issuanceEvent.holdingDevice);
                }
                else {
                 console.log('  - devices to which issued non-fungible tokens have been assigned:', issuanceEvent.holdingDevices);
                }

                console.log('  - date of issuance:', issuanceEvent.date);
            });

            if (data.hasMore) {
                console.log('Not all asset issuance events have been returned');
            }
        }
});
```

> **Note**: the parameters of the *retrieveAssetIssuanceHistory* method are slightly different from the ones taken by
>the Retrieve Asset Issuance History Catenis API method. In particular, the date parameters, `startDate` and `endDate`,
>accept not only strings containing ISO 8601 formatted dates/times but also *Date* objects.

### Listing devices that currently hold any amount of a given asset

```JavaScript
ctnApiClient.listAssetHolders(assetId, 200, 0,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            data.assetHolders.forEach(function (assetHolder, idx) {
                if (assetHolder.holder) {
                    console.log('Asset holder #', idx + 1, ':');
                    console.log('  - device holding an amount of the asset:', assetHolder.holder);
                    console.log('  - amount of asset currently held by device:', assetHolder.balance.total);
                    console.log('  - amount not yet confirmed:', assetHolder.balance.unconfirmed);
                }
                else {
                    console.log('Migrated asset:');
                    console.log('  - total migrated amount:', assetHolder.balance.total);
                    console.log('  - amount not yet confirmed:', assetHolder.balance.unconfirmed);
                }
            });

            if (data.hasMore) {
                console.log('Not all asset holders have been returned');
            }
        }
});
```

### Listing the non-fungible tokens of a given non-fungible asset that the device currently owns

```JavaScript
ctnApiClient.listOwnedNonFungibleTokens(assetId, 200, 0,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Owned non-fungible tokens:', data.ownedNFTokens);

            if (data.hasMore) {
                console.log('Not all owned non-fungible tokens have been returned');
            }
        }
});
```

### Identifying the device that currently owns a non-fungible token

```JavaScript
ctnApiClient.getNonFungibleTokenOwner(tokenId,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Owning device:', data.owner);
            console.log('Is confirmed:', data.isConfirmed);
        }
});
```

### Checking if a device currently owns one or more non-fungible tokens

```JavaScript
ctnApiClient.checkNonFungibleTokenOwnership({
        id: checkDeviceId,
        isProdUniqueId: false
    }, {
        id: assetId,
        isAssetId: true
    },
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Non-fungible tokens owned:', data.tokensOwned);
            console.log('Non-fungible tokens not yet confirmed:', data.tokensUnconfirmed);
        }
});
```

### Exporting an asset to a foreign blockchain

#### Estimating the export cost in the foreign blockchain's native coin

```JavaScript
var foreignBlockchain = 'ethereum';

ctnApiClient.exportAsset(assetId, foreignBlockchain, {
    name: 'Test Catenis token #01',
    symbol: 'CTK01'
}, {
    estimateOnly: true
}, function (error, data) {
    if (error) {
        // Process error
    }
    else {
        // Process returned data
        console.log('Estimated foreign blockchain transaction execution price:', data.estimatedPrice);
    }
});
```

#### Doing the export

```JavaScript
var getExportOutcome = function (assetId, foreignBlockchain) {
    ctnApiClient.assetExportOutcome(assetId, foreignBlockchain, function(error, data) {
        if (error) {
            // Process error
        }
        else {
            // Process returned data
            if (data.status === 'success') {
                // Asset successfully exported
                console.log('Foreign token ID (address):', data.token.id);
            }
            else if (data.status === 'pending') {
                // Final asset export state not yet reached. Continue polling
                setTimeout(getExportOutcome, 1000, assetId, foreignBlockchain);
            }
            else {
                // Asset export has failed. Process error
                console.error('Error executing foreign blockchain transaction:', data.foreignTransaction.error);
            }
        }
    });
};

var foreignBlockchain = 'ethereum';

ctnApiClient.exportAsset(assetId, foreignBlockchain, {
    name: 'Test Catenis token #01',
    symbol: 'CTK01'
}, function (error, data) {
    if (error) {
        // Process error
    }
    else {
        // Process returned data
        console.log('Foreign blockchain transaction ID (hash):', data.foreignTransaction.id);
        
        // Start polling for asset export outcome
        setTimeout(getExportOutcome, 1000, assetId, foreignBlockchain);
    }
});
```

### Migrating an asset amount to a foreign blockchain

#### Estimating the migration cost in the foreign blockchain's native coin

```JavaScript
var foreignBlockchain = 'ethereum';

ctnApiClient.migrateAsset(assetId, foreignBlockchain, {
    direction: 'outward',
    amount: 50,
    destAddress: '0xe247c9BfDb17e7D8Ae60a744843ffAd19C784943'
}, {
    estimateOnly: true
}, function (error, data) {
    if (error) {
        // Process error
    }
    else {
        // Process returned data
        console.log('Estimated foreign blockchain transaction execution price:', data.estimatedPrice);
    }
});
```

#### Doing the migration

```JavaScript
var getMigrationOutcome = function (migrationId) {
    ctnApiClient.assetMigrationOutcome(migrationId, function(error, data) {
        if (error) {
            // Process error
        }
        else {
            // Process returned data
            if (data.status === 'success') {
                // Asset amount successfully migrated
                console.log('Asset amount successfully migrated');
            }
            else if (data.status === 'pending') {
                // Final asset migration state not yet reached. Continue polling
                setTimeout(getMigrationOutcome, 1000, migrationId);
            }
            else {
                // Asset migration has failed. Process error
                if (data.catenisService.error) {
                    console.error('Error executing Catenis service:', data.catenisService.error);
                }
                
                if (data.foreignTransaction.error) {
                    console.error('Error executing foreign blockchain transaction:', data.foreignTransaction.error);
                }
            }
        }
    });
};

var foreignBlockchain = 'ethereum';

ctnApiClient.migrateAsset(assetId, foreignBlockchain, {
    direction: 'outward',
    amount: 50,
    destAddress: '0xe247c9BfDb17e7D8Ae60a744843ffAd19C784943'
}, function (error, data) {
    if (error) {
        // Process error
    }
    else {
        // Process returned data
        console.log('Asset migration ID:', data.migrationId);
    
        // Start polling for asset migration outcome
        setTimeout(getMigrationOutcome, 1000, data.migrationId);
    }
});
```

#### Reprocessing a (failed) migration

```JavaScript
var foreignBlockchain = 'ethereum';

ctnApiClient.migrateAsset(assetId, foreignBlockchain, migrationId, function (error, data) {
    if (error) {
        // Process error
    }
    else {
        // Start polling for asset migration outcome
    }
});
```

### Getting asset export outcome

```JavaScript
var foreignBlockchain = 'ethereum';

ctnApiClient.assetExportOutcome(assetId, foreignBlockchain, function(error, data) {
    if (error) {
        // Process error
    }
    else {
        // Process returned data
        if (data.status === 'success') {
            // Asset successfully exported
            console.log('Foreign token ID (address):', data.token.id);
        }
        else if (data.status === 'pending') {
            // Final asset export state not yet reached
        }
        else {
            // Asset export has failed. Process error
            console.error('Error executing foreign blockchain transaction:', data.foreignTransaction.error);
        }
    }
});
```

### Getting asset migration outcome

```JavaScript
ctnApiClient.assetMigrationOutcome(migrationId, function(error, data) {
    if (error) {
        // Process error
    }
    else {
        // Process returned data
        if (data.status === 'success') {
            // Asset amount successfully migrated
            console.log('Asset amount successfully migrated');
        }
        else if (data.status === 'pending') {
            // Final asset migration state not yet reached
        }
        else {
            // Asset migration has failed. Process error
            if (data.catenisService.error) {
                console.error('Error executing Catenis service:', data.catenisService.error);
            }
            
            if (data.foreignTransaction.error) {
                console.error('Error executing foreign blockchain transaction:', data.foreignTransaction.error);
            }
        }
    }
});
```

### Listing exported assets

```JavaScript
ctnApiClient.listExportedAssets({
    foreignBlockchain: 'ethereum',
    status: 'success',
    startDate: new Date('2021-08-01')
}, 200, 0, function (error, data) {
    if (error) {
        // Process error
    }
    else {
        // Process returned data
        if (data.exportedAssets.length > 0) {
            console.log('Returned asset exports:', data.exportedAssets);
            
            if (data.hasMore) {
                console.log('Not all asset exports have been returned');
            }
        }
    }
});
```

> **Note**: the parameters taken by the *listExportedAssets* method do not exactly match the parameters taken by the
 List Exported Assets Catenis API method. Most of the parameters, except for the last two (`limit` and `skip`), are
 mapped to fields of the first parameter (`selector`) of the *listExportedAssets* method with a few singularities: the
 date fields, `startDate` and `endDate`, accept not only strings containing ISO 8601 formatted dates/times but also
 *Date* objects.

### Listing asset migrations

```JavaScript
ctnApiClient.listAssetMigrations({
    foreignBlockchain: 'ethereum',
    direction: 'outward',
    status: 'success',
    startDate: new Date('2021-08-01')
}, 200, 0, function (error, data) {
    if (error) {
        // Process error
    }
    else {
        // Process returned data
        if (data.assetMigrations.length > 0) {
            console.log('Returned asset migrations:', data.assetMigrations);
            
            if (data.hasMore) {
                console.log('Not all asset migrations have been returned');
            }
        }
    }
});
```

> **Note**: the parameters taken by the *listAssetMigrations* method do not exactly match the parameters taken by the
 List Asset Migrations Catenis API method. Most of the parameters, except for the last two (`limit` and `skip`), are
 mapped to fields of the first parameter (`selector`) of the *listAssetMigrations* method with a few singularities: the
 date fields, `startDate` and `endDate`, accept not only strings containing ISO 8601 formatted dates/times but also
 *Date* objects.

### Listing system defined permission events

```JavaScript
ctnApiClient.listPermissionEvents(function (err, data) {
    if (err) {
        // Process error
    }
    else {
        // Process returned data
        Object.keys(data).forEach(function (eventName) {
            console.log('Event name:', eventName, '; event description:', data[eventName]);
        });
    }
});
```

### Retrieving permission rights currently set for a specified permission event

```JavaScript
ctnApiClient.retrievePermissionRights('receive-msg',
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Default (system) permission right:', data.system);
            
            if (data.catenisNode) {
                if (data.catenisNode.allow) {
                    console.log('Index of Catenis nodes with \'allow\' permission right:', data.catenisNode.allow);
                }
                
                if (data.catenisNode.deny) {
                    console.log('Index of Catenis nodes with \'deny\' permission right:', data.catenisNode.deny);
                }
            }
            
            if (data.client) {
                if (data.client.allow) {
                    console.log('ID of clients with \'allow\' permission right:', data.client.allow);
                }
                
                if (data.client.deny) {
                    console.log('ID of clients with \'deny\' permission right:', data.client.deny);
                }
            }
            
            if (data.device) {
                if (data.device.allow) {
                    console.log('Devices with \'allow\' permission right:', data.device.allow);
                }
                
                if (data.device.deny) {
                    console.log('Devices with \'deny\' permission right:', data.device.deny);
                }
            }
        }
});
```

### Setting permission rights at different levels for a specified permission event

```JavaScript
ctnApiClient.setPermissionRights('receive-msg', {
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
            console.log('Permission rights successfully set');
        }
});
```

### Checking effective permission right applied to a given device for a specified permission event

```JavaScript
ctnApiClient.checkEffectivePermissionRight('receive-msg', deviceProdUniqueId, true,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            var deviceId = Object.keys(data)[0];
            
            console.log('Effective right for device', deviceId, ':', data[deviceId]);
        }
});
```

### Retrieving identification information of a given device

```JavaScript
ctnApiClient.retrieveDeviceIdentificationInfo(deviceId, false,
    function (err, data) {
        if (err) {
            // Process error
        }
        else {
            // Process returned data
            console.log('Device\'s Catenis node ID info:', data.catenisNode);
            console.log('Device\'s client ID info:', data.client);
            console.log('Device\'s own ID info:', data.device);
        }
});
```

### Listing system defined notification events

```JavaScript
ctnApiClient.listNotificationEvents(function (err, data) {
    if (err) {
        // Process error
    }
    else {
        // Process returned data
        Object.keys(data).forEach(function (eventName) {
            console.log('Event name:', eventName, '; event description:', data[eventName]);
        });
    }
});
```

## Notifications

The Catenis API Client for Node.js makes it easy for receiving notifications from the Catenis system by embedding a
WebSocket client. All the end user needs to do is open a WebSocket notification channel for the desired Catenis
notification event, and monitor the activity on that channel.

### Receiving notifications

Instantiate WebSocket notification channel object.

```JavaScript
var wsNtfyChannel = ctnApiClient.createWsNotifyChannel(eventName);
```

Add listeners.

```JavaScript
wsNtfyChannel.addListener('error', function (error) {
    // Process error in the underlying WebSocket connection
});

wsNtfyChannel.addListener('close', function (code, reason) {
    // Process indication that underlying WebSocket connection has been closed
});

wsNtfyChannel.addListener('open', function () {
    // Process indication that notification channel is successfully open
    //  and ready to send notifications 
});

wsNtfyChannel.addListener('notify', function (data) {
    // Process received notification
    console.log('Received notification:', data);
});
```

> **Note**: the `data` argument of the *notify* event contains the deserialized JSON notification message (an object)
 of the corresponding notification event.

Open notification channel.

```JavaScript
wsNtfyChannel.open(function (err) {
    if (err) {
        // Process error establishing underlying WebSocket connection
    }
    else {
        // WebSocket client successfully connected. Wait for open event to make
        //  sure that notification channel is ready to send notifications
    }
});
```

Close notification channel.

```JavaScript
wsNtfyChannel.close();
```

## Error handling

Two types of error can take place when calling API methods: client or API error.

Client errors return generic error objects.

API errors, on the other hand, return a custom **CatenisApiError** object.

**CatenisApiError** objects are extended from Javascript's standard *Error* object, so they share the same
 characteristics with the following exceptions:

- The the value of the *name* field is set to `CatenisApiError`
- It has the following additional fields: *httpStatusMessage*, *httpStatusCode*, and *ctnErrorMessage*

> **Note**: the *ctnErrorMessage* field of the CatenisApiError object contains the error message returned by the
 Catenis system. However, there might be cases where that field is **undefined**.

Usage example:

```JavaScript
var CatenisApiError = require('catenis-api-client/lib/CatenisApiError');

ctnApiClient.readMessage('INVALID_MSG_ID', null,
    function (err, data) {
        if (err) {
            if (err instanceof CatenisApiError) {
                // Catenis API error
                console.log('HTTP status code:', err.httpStatusCode);
                console.log('HTTP status message:', err.httpStatusMessage);
                console.log('Catenis error message:', err.ctnErrorMessage);
                console.log('Compiled error message:', err.message);
            }
            else {
                // Client error
                console.log(err);
            }
        }
        else {
            // Process returned data
        }
});
```

Expected result:

```
HTTP status code: 400
HTTP status message: Bad Request
Catenis error message: Invalid message ID
Compiled error message: Error returned from Catenis API endpoint: [400] Invalid message ID
```

## Catenis API Documentation

For further information on the Catenis API, please reference the [Catenis API Documentation](https://catenis.com/docs/api).

## License

This Node.js module is released under the [MIT License](LICENSE). Feel free to fork, and modify!

Copyright © 2018-2022, Blockchain of Things Inc.
