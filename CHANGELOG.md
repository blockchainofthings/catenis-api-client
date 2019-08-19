# Changelog

## [4.0.1] - 2019-08-19

### Changes
- Updated README file to fix sample code for using API methods that had their interface changed in version 4.0.0 of the library.

## [4.0.0] - 2019-08-16

### Breaking changes
- The `countExceeded` property of the object returned from a successful call to the *listMessages* method has been
 replaced with the new `hasMore` property.
- The `countExceeded` property of the object returned from a successful call to the *retrieveAssetIssuanceHistory*
 method has been replaced with the new `hasMore` property.

### Changes
- Changed interface of *listMessages* method: first parameter renamed to `selector`; new parameters `limit` and `skip` added.
- Changed interface of *retrieveAssetIssuanceHistory* method: new parameters `limit` and `skip` added.

### New features
- Added options (when instantiating API client) to send/receive compressed data, which is on by default.
- Added support for changes introduced by version 0.8 of the Catenis Enterprise API: "pagination" (limit/skip) for API
 methods List Messages and Retrieve Asset Issuance History; new URI format for notification endpoints.

## [3.1.0] - 2019-05-29

### New features
- WebSocket notification channel object emits new `open` event.

### Changes
- Update dependency module `request` to its latest available version (2.88.0)

## [3.0.0] - 2019-03-13

### Breaking changes
- Changed interface of *sendMessage* method: parameters `message` and `targetDevice` have swapped positions.

### New features
- Added support for version 0.7 of the Catenis Enterprise API.

## [2.2.0] - 2019-01-02

### Changes
- Changed interface of API methods that take optional parameters so that the optional parameters can be suppressed when
 calling those methods.

## [2.1.0] - 2018-12-10

### Deprecations
- The `message` event of the WebSocket notification channel object has been deprecated in favour of the new `notify`
 event. The difference between the two is that the new `notify` event returns a deserialized JSON object whereas the
 `message` event returns the originally received JSON string.

### New features
- New `notify` event added to WebSocket notification channel object.

## [2.0.0] - 2018-12-03

### Breaking changes
- Changed interface of *listMessages* method: fields `fromDeviceIds`, `fromDeviceProdUniqueIds`, `toDeviceIds`,
 and `toDeviceProdUniqueIds` of *options* parameter replaced with fields `fromDevices` and `toDevices`.
- Changed type of returned error from API method calls.

### Other changes
- Changed interface of *listMessages* method: date fields now accept *Date* objects in addition to strings.
- Changed interface of *retrieveAssetIssuanceHistory* method: date fields now accept *Date* object in addition to
 strings.
- Removed unnecessary instance variables from *ApiClient* objects.
- Updated README file to account for the changes in the API methods and error handling.
- Added CHANGELOG (this) file.

### Fixes
- Proper handling of time stamp and sign date values used for signing request.
- Signing of requests with empty URL parameters.
