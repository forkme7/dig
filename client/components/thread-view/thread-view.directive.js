'use strict';

angular.module('digApp.directives')
.directive('threadView', function(euiConfigs, textHighlightService) {
    return {
        restrict: 'EA',
        scope: {
            doc: '=',
            viewDetails: '='
        },
        templateUrl: 'components/thread-view/thread-view.partial.html',
        link: function($scope) {
            $scope.euiConfigs = euiConfigs;

            $scope.fieldIsArray = function(field) {
                return angular.isArray(field);
            };

            $scope.highlightCheck = function(field, highlightedText) {
                return textHighlightService.highlightCheck(field, highlightedText);
            };
        }
    };
});