function CatenisApiError(httpStatusMessage, httpStatusCode, ctnErrorMessage) {
    var instance = new Error('Error returned from Catenis API endpoint: [' + httpStatusCode + '] ' + (ctnErrorMessage ? ctnErrorMessage : httpStatusMessage));

    instance.name = 'CatenisApiError';
    instance.httpStatusMessage = httpStatusMessage;
    instance.httpStatusCode = httpStatusCode;
    instance.ctnErrorMessage = ctnErrorMessage;

    Object.setPrototypeOf(instance, Object.getPrototypeOf(this));
    if (Error.captureStackTrace) {
        Error.captureStackTrace(instance, CatenisApiError);
    }

    return instance;
}

CatenisApiError.prototype = Object.create(Error.prototype, {
    constructor: {
        value: Error,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

if (Object.setPrototypeOf){
    Object.setPrototypeOf(CatenisApiError, Error);
} else {
    CatenisApiError.__proto__ = Error;
}

exports = module.exports = CatenisApiError;
