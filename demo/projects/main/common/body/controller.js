define([

    'app'

], function(app) {
    'use strict';

    app.controller('CommonController', function($scope) {
        $scope.name = window.project.config.env + ' World';
        $scope.aaa = 1;
    });
});