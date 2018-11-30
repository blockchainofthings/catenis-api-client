jasmine.getEnv().configure({
    random: false,           // This replaces 'random' property on config json file
    oneFailurePerSpec: false // This (supposedly) replaces 'stopSpecOnExceptionFailure' property on config json file
});
