var verReSource = '^(\\d+)\\.(\\d+)$';

// ApiVersion function class
//
function ApiVersion(ver) {
    if (!isValidVersion(ver)) {
        throw new Error('Invalid API version:' + ver);
    }

    if (typeof ver === 'string') {
        // Passed version is a string; parse it
        var matchResult = ver.match(new RegExp(verReSource));

        this.major = parseInt(matchResult[1]);
        this.minor = parseInt(matchResult[2]);
    }
    else {
        // Passed version is an ApiVersion instance; just copy its properties over
        this.major = ver.major;
        this.minor = ver.minor;
    }
}

ApiVersion.prototype.toString = function () {
    return this.major.toString() + '.' + this.minor.toString();
};

// Test if this version is equal to another version
ApiVersion.prototype.eq = function (ver) {
    ver = ApiVersion.checkVersion(ver);

    return this.major === ver.major && this.minor === ver.minor;
};

// Test if this version is not equal to another version
ApiVersion.prototype.ne = function (ver) {
    ver = ApiVersion.checkVersion(ver);

    return this.major !== ver.major || this.minor !== ver.minor;
};

// Test if this version is greater than another version
ApiVersion.prototype.gt = function (ver) {
    ver = ApiVersion.checkVersion(ver);

    return this.major > ver.major || (this.major === ver.major && this.minor > ver.minor);
};

// Test if this version is less than another version
ApiVersion.prototype.lt = function (ver) {
    ver = ApiVersion.checkVersion(ver);

    return this.major < ver.major || (this.major === ver.major && this.minor < ver.minor);
};

// Test if this version is greater than or equal to another version
ApiVersion.prototype.gte = function (ver) {
    ver = ApiVersion.checkVersion(ver);

    return this.major > ver.major || (this.major === ver.major && (this.minor > ver.minor || this.minor === ver.minor));
};

// Test if this version is less than or equal to another version
ApiVersion.prototype.lte = function (ver) {
    ver = ApiVersion.checkVersion(ver);

    return this.major < ver.major || (this.major === ver.major && (this.minor < ver.minor || this.minor === ver.minor));
};

ApiVersion.checkVersion = function (ver, reportError) {
    if (isValidVersion(ver)) {
        return typeof ver === 'string' ? new ApiVersion(ver) : ver;
    }
    else if (reportError === undefined || !!reportError) {
        throw new Error('Invalid API version: ' + ver);
    }
};

function isValidVersion(ver) {
    return (typeof ver === 'string' && new RegExp(verReSource).test(ver)) || (ver instanceof ApiVersion);
}

exports = module.exports = ApiVersion;
