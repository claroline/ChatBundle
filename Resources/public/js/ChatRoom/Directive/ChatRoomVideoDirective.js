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

    angular.module('ChatRoomModule').directive('chatRoomVideo', [
        'XmppMucService',
        function (XmppMucService) {
            return {
                restrict: 'E',
                replace: true,
                templateUrl: AngularApp.webDir + 'bundles/clarolinechat/js/ChatRoom/Directive/templates/chatRoomVideo.html',
                link: function (scope, element, attrs) {
                    var server = attrs['chatRoomXmppHost'];
                    var mucServer = attrs['chatRoomXmppMucHost'];
                    var boshPort = attrs['chatRoomBoshPort'];
                    var iceServers = attrs['chatRoomIceServers'];
                    var roomId = attrs['chatRoomId'];
                    var roomName = attrs['chatRoomName'];
                    var username = attrs['chatRoomUserUsername'];
                    var password = attrs['chatRoomUserPassword'];
                    var firstName = attrs['chatRoomUserFirstName'];
                    var lastName = attrs['chatRoomUserLastName'];
                    var color = attrs['chatRoomUserColor'];
                    XmppMucService.broadcastCustomEvent(
                        'IceServersSetupEvent', 
                        {iceServers: iceServers}
                    );
                    XmppMucService.connect(
                        server,
                        mucServer, 
                        boshPort,
                        roomId, 
                        roomName, 
                        username, 
                        password, 
                        firstName, 
                        lastName, 
                        color
                    );
                }
            };
        }
    ]);
})();