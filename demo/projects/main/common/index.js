define([

    'app',

    'main/common/body/controller'

], function(app) {
    'use strict';

    app.config(function($locationProvider) {
        $locationProvider.html5Mode(true);
        $locationProvider.hashPrefix('!');
    });

    app.run(function($rootScope) {
        $rootScope.$loading = false;
    });
});