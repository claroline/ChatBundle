/*
 * This file is part of the Claroline Connect package.
 *
 * (c) Claroline Consortium <consortium@claroline.net>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

(function () {
    'use strict';

    angular.module('ChatRoomModule').controller('ChatRoomUsersCtrl', [
        '$scope', 
        '$rootScope',
        'XmppMucService',
        function ($scope, $rootScope, XmppMucService) {
            $scope.users = [];
            $scope.bannedUsers = [];
            
            $scope.kickUser = function (username) {
                XmppMucService.kickUser(username);
            };
            
            $scope.muteUser = function (username) {
                XmppMucService.muteUser(username);
            };
            
            $scope.unmuteUser = function (username) {
                XmppMucService.unmuteUser(username);
            };
            
            $scope.banUser = function (username) {
                XmppMucService.banUser(username);
            };
            
            $scope.unbanUser = function (username) {
                XmppMucService.unbanUser(username);
            };
            
            $scope.isAdmin = function () {
                
                return XmppMucService.isAdmin();
            };
            
            $scope.isModerator = function () {
                
                return XmppMucService.isModerator();
            };
            
            $scope.$on('userMucPresenceUpdateEvent', function () {
                $scope.users = XmppMucService.getUsers();
                $scope.$apply();
            });

            $scope.$on('userConnectionEvent', function (event, userDatas) {
                $scope.users = XmppMucService.getUsers();
                $scope.$apply();
            });

            $scope.$on('userDisconnectionEvent', function (event, userDatas) {
                $scope.users = XmppMucService.getUsers();
                $scope.$apply();
                var status = 'disconnection';
                
                switch (userDatas['statusCode']) {
                    case '301':
                        status = 'banned';
                        break;
                    case '307':
                        status = 'kicked';
                        break;
                    default:
                        status = 'disconnection';
                }
                
                $rootScope.$broadcast(
                    'newPresenceEvent',
                    {
                        username: userDatas['username'], 
                        name: userDatas['name'], 
                        status: status
                    }
                );
            });

            $rootScope.$on('xmppMucBanUserEvent', function (event, username) {
                $scope.bannedUsers = XmppMucService.getBannedUsers();
                $scope.$apply();
            });

            $rootScope.$on('xmppMucUnbanUserEvent', function (event, username) {
                $scope.bannedUsers = XmppMucService.getBannedUsers();
                $scope.$apply();
            });
        }
    ]);
})();