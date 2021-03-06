/*
 * This file is part of the Claroline Connect package.
 *
 * (c) Claroline Consortium <consortium@claroline.net>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

var RTC = null;
var ice_config = {
    iceServers: [
        {urls: ['stun:stun.l.google.com:19302']}
    ]
};
var RTCPeerconnection = null;
var AUTOACCEPT = true;
var PRANSWER = false; // use either pranswer or autoaccept
var connection = null;
var roomjid = null;
var myUsername = null;
var users = {};
var sids = {};
var lastSpeakingUser = null;

(function () {
    'use strict';

    angular.module('ChatRoomModule').controller('ChatRoomVideoCtrl', [
        '$scope',
        '$rootScope', 
        'XmppService', 
        'XmppMucService', 
        function ($scope, $rootScope, XmppService, XmppMucService) {
            $scope.localStream = null;
            $scope.streams = [];
            $scope.currentVideoId = null;
            $scope.myUsername = null;
            $scope.myMicroEnabled = true;
            $scope.myCameraEnabled = true;
            $scope.speakingUser = null;
            $scope.selectedUser = null;

            function configureIceServers(servers)
            {
                if (servers) {
                    var serversArray = servers.split(',');
                    ice_config['iceServers'][0]['urls'] = serversArray;
                }
            }

            function checkStream()
            {
                updateUsers();
                checkUsersStatus();
                checkSids();
                initiateCalls();
                cleanSids();
            }

            function updateUsers()
            {
                updatePresentUsers();
                updateNewUsers('waiting');
            }
            
            // status = ['toCall', 'waiting', 'pending', 'working']
            function updateNewUsers(status)
            {
                var allUsers = XmppMucService.getUsers();
                
                for (var i = 0; i < allUsers.length; i++) {
                    var username = allUsers[i]['username'];
                    
                    if (username !== myUsername) {
                        
                        if (users[username] === undefined || users[username] === null) {
                            
                            users[username] = {username: username, sid: null, status: status, iteration: 0, micro: true, camera: true};
                            requestUserStatus(username);
                        }
                    }
                }
            }
            
            function updatePresentUsers()
            {
                for (var username in users) {
                    
                    if (users[username] !== null && !XmppMucService.hasUser(username)) {
                        users[username] = null;
                    }
                }
            }
            
            function checkUsersStatus()
            {
                for (var username in users) {
                   
                    if (users[username] !== null) {
                        
                        if (users[username]['status'] !== 'toCall' &&
                            users[username]['sid'] === null && 
                            users[username]['iteration'] > 3) {
                        
                            users[username]['status'] = 'toCall';
                            users[username]['iteration'] = 0;
                        } else {
                            users[username]['iteration']++;
                        }
                    }
                }
            }
            
            function initiateCalls()
            {
                for (var username in users) {
                    
                    if (users[username] !== null && users[username]['sid'] === null && 
                        users[username]['status'] === 'toCall') {
                        
                        var session = connection.jingle.initiate(
                            roomjid + '/' + username,
                            roomjid + '/' + myUsername

                        );
                        
                        if (session['sid']) {
                            users[username]['sid'] = session['sid'];
                            users[username]['status'] = 'pending';
                            users[username]['iteration'] = 0;
                            addSid(session['sid'], username);
                        }
                    }
                }
            }
            
            function checkSids()
            {
                for (var sid in sids) {
                    
                    if (sids[sid] !== null) {
                        sids[sid]['iteration']++;
                    }
                }
            }
            
            function addSid(sid, username)
            {
                sids[sid] = {username: username, iteration: 0}
            }
            
            function removeSid(sid)
            {
                sids[sid] = null;
            }
            
            function cleanSids()
            {
                for (var username in users) {
                    
                    if (users[username] !== null && 
                        users[username]['status'] === 'working' &&
                        users[username]['iteration'] > 10) {
                        
                        var workingSid = users[username]['sid'];
                        
                        for (var sid in sids) {
                            
                            if (sid !== workingSid && 
                                sids[sid] !== null && 
                                sids[sid]['username'] === username &&
                                sids[sid]['iteration'] > 10) {
                            
                                if (connection.jingle.sessions[sid]) {
                                    connection.jingle.sessions[sid].terminate('unused stream');
                                    console.log('Manually terminate : ' + sid);
                                }
                                removeSid(sid);
                            }
                        }
                    }
                }
            }
            
            function manageDisconnectedSid(sid)
            {
                if (sids[sid] !== undefined && sids[sid] !== null) {
                    var username = sids[sid]['username'];
                    removeSid(sid);

                    if (users[username] !== undefined && 
                        users[username] !== null && 
                        users[username]['sid'] === sid) {

                        users[username]['sid'] = null;
                        users[username]['status'] = 'waiting';
                        users[username]['iteration'] = 0;
                    }
                }
            }
            
            function enableMicro(username, enabled)
            {
                var isEnabled = (enabled === 'true');
                
                if (username === myUsername) {
                    $scope.myMicroEnabled = isEnabled;
                    $scope.$apply();
                } else if (users[username] !== undefined && users[username] !== null) {
                    users[username]['micro'] = isEnabled;
                    updateMicro(username);
                }
            }
            
            function enableCamera(username, enabled)
            {   
                var isEnabled = (enabled === 'true');
                
                if (username === myUsername) {
                    $scope.myCameraEnabled = isEnabled;
                    $scope.$apply();
                } else if (users[username] !== undefined && users[username] !== null) {
                    users[username]['camera'] = isEnabled;
                    updateCamera(username);
                }
            }
            
            function updateMicro(username)
            {
                if (users[username] !== undefined && users[username] !== null) {
                    var isEnabled = users[username]['micro'];
                    var sid = users[username]['sid'];

                    if (sid && connection.jingle.sessions[sid] && connection.jingle.sessions[sid].remoteStream) {
                        var session = connection.jingle.sessions[sid];
                        var audioTracks = session.remoteStream.getAudioTracks();

                        for (var i = 0; i < audioTracks.length; i++) {
                            audioTracks[i].enabled = isEnabled;
                        }
                    }
                    $scope.setStreamMicro(username, isEnabled);
                    $scope.$apply();
                }
            }
            
            function updateCamera(username)
            {
                if (users[username] !== undefined && users[username] !== null) {
                    var isEnabled = users[username]['camera'];
                    var sid = users[username]['sid'];

                    if (sid && connection.jingle.sessions[sid] && connection.jingle.sessions[sid].remoteStream) {
                        var session = connection.jingle.sessions[sid];
                        var videoTracks = session.remoteStream.getVideoTracks();

                        for (var i = 0; i < videoTracks.length; i++) {
                            videoTracks[i].enabled = isEnabled;
                        }
                    }
                    $scope.setStreamCamera(username, isEnabled);
                    $scope.$apply();
                }
            }
            
            function sendMicroStatus(username, enabled)
            {
                XmppService.getConnection().send(
                    $msg({
                        to: XmppMucService.getRoom(),
                        type: "groupchat"
                    }).c('body').t('')
                    .up()
                    .c(
                        'datas',
                        {
                            status: 'management',
                            username: username,
                            type: 'video-micro',
                            value: enabled
                        }
                    )
                );
            }
            
            function sendCameraStatus(enabled)
            {
                XmppService.getConnection().send(
                    $msg({
                        to: XmppMucService.getRoom(),
                        type: "groupchat"
                    }).c('body').t('')
                    .up()
                    .c(
                        'datas',
                        {
                            status: 'management',
                            username: myUsername,
                            type: 'video-camera',
                            value: enabled
                        }
                    )
                );
            }
            
            function requestUserStatus(username)
            {
                XmppService.getConnection().send(
                    $msg({
                        to: XmppMucService.getRoom(),
                        type: "groupchat"
                    }).c('body').t('')
                    .up()
                    .c(
                        'datas',
                        {
                            status: 'management',
                            username: username,
                            type: 'video-status-resend',
                            value: null
                        }
                    )
                );
            }
            
            function updateVideoSelection(username)
            {
                $scope.selectedUser = ($scope.selectedUser === username) ? null : username;
            }
            
            function updateVideoSpeaking(username)
            {
                $scope.speakingUser = username;
                $scope.$apply();
            }
            
            function updateMainVideoDisplay()
            {
                var mainVideo = document.getElementById('main-video');
                var userToDisplay = myUsername;
                var videoId = 'my-video';
                
                if ($scope.selectedUser) {
                    userToDisplay = $scope.selectedUser;
                } else if ($scope.speakingUser) {
                    userToDisplay = $scope.speakingUser;
                }
                lastSpeakingUser = userToDisplay;
                
                if (userToDisplay !== myUsername && users[userToDisplay]) {
                    var sid = users[userToDisplay]['sid'];
                    videoId = 'participant-video-' + sid;
                }
                var element = document.getElementById(videoId);
                
                if (element) {
                    if (RTC.browser === 'firefox') {
                        mainVideo.mozSrcObject = element.mozSrcObject;
                    } else {
                        mainVideo.src = element.src;
                    }
                }
            }
            
            function checkMainVideoDisplay()
            {
                if ($scope.selectedUser === null && $scope.speakingUser !== lastSpeakingUser) {
                    updateMainVideoDisplay();
                }
            }
            
            function sendSpeakingNotification()
            {
                XmppService.getConnection().send(
                    $msg({
                        to: XmppMucService.getRoom(),
                        type: "groupchat"
                    }).c('body').t('')
                    .up()
                    .c(
                        'datas',
                        {
                            status: 'management',
                            username: myUsername,
                            type: 'speaking',
                            value: 1
                        }
                    )
                );
            }

            function onMediaReady(event, stream)
            {
                $scope.localStream = stream;
                connection.jingle.localStream = stream;
                for (var i = 0; i < $scope.localStream.getAudioTracks().length; i++) {
                    console.log('using audio device "' + $scope.localStream.getAudioTracks()[i].label + '"');
                }
                for (i = 0; i < $scope.localStream.getVideoTracks().length; i++) {
                    console.log('using video device "' + $scope.localStream.getVideoTracks()[i].label + '"');
                }
                // mute video on firefox and recent canary
                
                if (RTC.browser === 'firefox') {
                    $('#my-video')[0].muted = true;
                    $('#my-video')[0].volume = 0;
                } else {
                    document.getElementById('my-video').muted = true;
                    document.getElementById('main-video').muted = true;
                }

                RTC.attachMediaStream($('#my-video'), $scope.localStream);
                updateMainVideoDisplay();

                if (typeof hark === "function") {
                    var options = { interval: 400 };
                    var speechEvents = hark(stream, options);

                    speechEvents.on('speaking', function () {
                        
                        if ($scope.myMicroEnabled) {
                            sendSpeakingNotification();
                        }
                    });

                    speechEvents.on('stopped_speaking', function () {
//                        console.log('Stopped speaking.');
                    });
                    speechEvents.on('volume_change', function (volume, treshold) {
                        
                        if ($scope.myMicroEnabled && $scope.speakingUser !== myUsername && volume > -50) {
                            sendSpeakingNotification();
                        }
                      //console.log('volume', volume, treshold);
//                        if (volume < -60) { // vary between -60 and -35
//                            $('#ownvolume').css('width', 0);
//                        } else if (volume > -35) {
//                            $('#ownvolume').css('width', '100%');
//                        } else {
//                            $('#ownvolume').css('width', (volume + 100) * 100 / 25 - 160 + '%');
//                        }
                    });
                } else {
                    console.warn('without hark, you are missing quite a nice feature');
                }
            }

            function onMediaFailure()
            {
                console.log('Media failure');
            }

            function onCallIncoming(event, sid)
            {
                console.log('Incoming call : ' + sid);
                var sess = connection.jingle.sessions[sid];
                var initiator = Strophe.getResourceFromJid(sess['initiator']);
                sess.sendAnswer();
                sess.accept();
                addSid(sid, initiator);

                // alternatively...
                //sess.terminate(busy)
                //connection.jingle.terminate(sid);
            }
            
            function onCallActive(event, videoelem, sid)
            {
                console.log('+++++++++++ CALL ACTIVE : ' + sid + ' +++++++++++');
                
                if (sids[sid] !== undefined && sids[sid] !== null) {
                    var username = sids[sid]['username'];

                    if (users[username] === undefined ||
                        users[username] === null || 
                        users[username]['sid'] !== sid || 
                        users[username]['status'] !== 'working') {

                        if (users[username] !== undefined &&
                            users[username] !== null && 
                            users[username]['sid']) {

                            console.log('Closing because of newer stream : ' + users[username]['sid']);
                            $scope.removeStream(users[username]['sid']);
                        }
                        users[username]['sid'] = sid;
                        users[username]['status'] = 'working';
                        users[username]['iteration'] = 0;
                        var name = XmppMucService.getUserFullName(username);
                        updateMicro(username);
                        updateCamera(username);
                        $scope.addStream(sid, sids[sid]['username'], name);
        //                videoelem[0].style.display = 'inline-block';
                        $(videoelem).appendTo('#participant-stream-' + sid + ' .participant-video-panel');
                        connection.jingle.sessions[sid].getStats(1000);
                    }
                }
            }

            function onCallTerminated(event, sid, reason)
            {
                console.log('Call terminated ' + sid + (reason ? (': ' + reason) : ''));
                
                if (Object.keys(connection.jingle.sessions).length === 0) {
                    console.log('All calls terminated');
                }
                $('#participants-video-container #participant-video-' + sid).remove();
            }
            
            function waitForRemoteVideo(selector, sid)
            {
                var sess = connection.jingle.sessions[sid];
                var videoTracks = sess.remoteStream.getVideoTracks();
                if (videoTracks.length === 0 || selector[0].currentTime > 0) {
                    $(document).trigger('callactive.jingle', [selector, sid]);
                    RTC.attachMediaStream(selector, sess.remoteStream); // FIXME: why do i have to do this for FF?
                    console.log('waitForremotevideo', sess.peerconnection.iceConnectionState, sess.peerconnection.signalingState);
                } else {
                    setTimeout(function () { waitForRemoteVideo(selector, sid); }, 100);
                }
            }

            function onRemoteStreamAdded(event, data, sid)
            {
                console.log('Remote stream for session ' + sid + ' added.');
                
                if ($('#participant-video-' + sid).length !== 0) {
                    console.log('ignoring duplicate onRemoteStreamAdded...'); // FF 20
                    
                    return;
                }
                // after remote stream has been added, wait for ice to become connected
                // old code for compat with FF22 beta
                var el = $('<video autoplay="autoplay" class="participant-video"/>').attr('id', 'participant-video-' + sid);
                RTC.attachMediaStream(el, data.stream);
                waitForRemoteVideo(el, sid);
                /* does not yet work for remote streams -- https://code.google.com/p/webrtc/issues/detail?id=861
                var options = { interval:500 };
                var speechEvents = hark(data.stream, options);

                speechEvents.on('volume_change', function (volume, treshold) {
                  console.log('volume for ' + sid, volume, treshold);
                });
                */
            }

            function onRemoteStreamRemoved(event, data, sid)
            {
                console.log('Remote stream for session ' + sid + ' removed.');
            }

            function onIceConnectionStateChanged(event, sid, sess)
            {
                console.log('ice state for', sid, sess.peerconnection.iceConnectionState);
//                console.log('sig state for', sid, sess.peerconnection.signalingState);
                console.log(sess['initiator']);
                
                if (sess.peerconnection.iceConnectionState === 'connected') {
                    console.log('add new stream');
                } else if (sess.peerconnection.iceConnectionState === 'disconnected') {
                    connection.jingle.sessions[sid].terminate('disconnected');
                    console.log('remove stream');
                    $scope.removeStream(sid);
                    manageDisconnectedSid(sid);
                } else if (sess.peerconnection.iceConnectionState === 'failed' || 
                    sess.peerconnection.iceConnectionState === 'closed') {
                
                    $scope.removeStream(sid);
                    manageDisconnectedSid(sid);
                }
                
                // works like charm, unfortunately only in chrome and FF nightly, not FF22 beta
//                
//                if (sess.peerconnection.signalingState === 'stable' && sess.peerconnection.iceConnectionState === 'connected') {
//                    var el = $('<video autoplay="autoplay" class="participant-video"/>').attr('id', 'participant-video-' + sid);
//                    $(document).trigger('callactive.jingle', [el, sid]);
//                    RTC.attachMediaStream(el, sess.remoteStream); // moving this before the trigger doesn't work in FF?!
//                }              
            }

            function noStunCandidates(event)
            {
                console.log('webrtc did not encounter stun candidates, NAT traversal will not work');
                console.warn('webrtc did not encounter stun candidates, NAT traversal will not work');
            }

            $rootScope.$on('xmppMucConnectedEvent', function (event) {
                XmppMucService.setConnected(true);
                connection = XmppService.getConnection();
                roomjid = XmppMucService.getRoom();
                myUsername = XmppService.getUsername();
                lastSpeakingUser = myUsername;
                $scope.myUsername = myUsername;
                $scope.speakingUser = myUsername;
                console.log('MUC CONNECT');
                
                RTC = setupRTC();
                getUserMediaWithConstraints(['audio', 'video']);
                connection.jingle.ice_config = ice_config;
                
                if (RTC) {
                    connection.jingle.pc_constraints = RTC.pc_constraints;
                }
                
                $(document).bind('mediaready.jingle', onMediaReady);
                $(document).bind('mediafailure.jingle', onMediaFailure);
                $(document).bind('callincoming.jingle', onCallIncoming);
                $(document).bind('callactive.jingle', onCallActive);
                $(document).bind('callterminated.jingle', onCallTerminated);

                $(document).bind('remotestreamadded.jingle', onRemoteStreamAdded);
                $(document).bind('remotestreamremoved.jingle', onRemoteStreamRemoved);
                $(document).bind('iceconnectionstatechange.jingle', onIceConnectionStateChanged);
                $(document).bind('nostuncandidates.jingle', noStunCandidates);
                $(document).bind('ack.jingle', function (event, sid, ack) {
                    console.log('got stanza ack for ' + sid, ack);
                });
                $(document).bind('error.jingle', function (event, sid, err) {
                    console.log('got stanza error for ' + sid, err);
                });
                $(document).bind('packetloss.jingle', function (event, sid, loss) {
//                    console.warn('packetloss', sid, loss);
                });
                
                if (RTC !== null) {
                    RTCPeerconnection = RTC.peerconnection;
                    
                    if (RTC.browser === 'firefox') {
                        //connection.jingle.media_constraints.mandatory.MozDontOfferDataChannel = true;
                        connection.jingle.media_constraints = {
                            offerToReceiveAudio: true,
                            offerToReceiveVideo: true,
                            mozDontOfferDataChannel: true
                        };
                    }
                } else {
                    console.log('webrtc capable browser required');
                }
            });
            
            $rootScope.$on('myPresenceConfirmationEvent', function () {
                updateNewUsers('toCall');
                initiateCalls();
                setInterval(checkStream, 3000);
                setInterval(checkMainVideoDisplay, 1000);
            });

            $scope.$on('userDisconnectionEvent', function (event, userDatas) {
                $scope.removeUserStream(userDatas['username']);
            });

            $rootScope.$on('managementEvent', function (event, datas) {
                var type = datas['type'];
                var username = datas['username'];
                var value = datas['value'];
                
                if (type === 'video-micro') {
                    enableMicro(username, value);
                } else if (type === 'video-camera') {
                    enableCamera(username, value);
                } else if (type === 'video-status-resend') {
                    
                    if (username === myUsername) {
                        sendMicroStatus(myUsername, $scope.myMicroEnabled);
                        sendCameraStatus($scope.myCameraEnabled);
                    }
                } else if (type === 'speaking') {
                    
                    if ($scope.speakingUser !== username) {
                        updateVideoSpeaking(username);
                        
//                        if ($scope.selectedUser === null) {
//                            updateMainVideoDisplay();
//                        }
                    }
                    
                }
            });

            $scope.$on('IceServersSetupEvent', function (event, datas) {
                configureIceServers(datas['iceServers']);
            });
            
            $scope.getUsernameFromSid = function (sid) {
                var username = null;
                
                for (var i = 0; i < $scope.streams.length; i++) {
                    
                    if ($scope.streams[i]['sid'] === sid) {
                        username = $scope.streams[i]['username'];
                        break;
                    }
                }
                
                return username;
            };

            $scope.removeUserStream = function (username) {
                
                for (var i = $scope.streams.length - 1; i >= 0; i--) {
                    
                    if ($scope.streams[i]['username'] === username) {
                        $scope.streams.splice(i, 1);
                    }
                }
                $scope.$apply();
            };

            $scope.hasStreamFromUsername = function (username) {
                var isPresent = false;

                for (var i = 0; i < $scope.streams.length; i++) {
                                                                                
                    if ($scope.streams[i]['username'] === username) {
                        isPresent = true;
                        break;
                    }
                }

                return isPresent;
            };

            $scope.getStreamFromUsername = function (username) {
                var stream = null;

                for (var i = 0; i < $scope.streams.length; i++) {
                                                                                
                    if ($scope.streams[i]['username'] === username) {
                        stream = $scope.streams[i];
                        break;
                    }
                }

                return stream;
            };

            $scope.setStreamMicro = function (username, microEnabled) {

                for (var i = 0; i < $scope.streams.length; i++) {
                                                                                
                    if ($scope.streams[i]['username'] === username) {
                        $scope.streams[i]['micro'] = microEnabled;
                        break;
                    }
                }
            };

            $scope.setStreamCamera = function (username, cameraEnabled) {

                for (var i = 0; i < $scope.streams.length; i++) {
                                                                                
                    if ($scope.streams[i]['username'] === username) {
                        $scope.streams[i]['camera'] = cameraEnabled;
                        break;
                    }
                }
            };

            $scope.addStream = function (sid, username, name) {
                var isPresent = false;
                
                for (var i = 0; i < $scope.streams.length; i++) {
                    
                    if ($scope.streams[i]['sid'] === sid) {
                        isPresent = true;
                        break;
                    }
                }
                
                if (!isPresent) {
                    var microEnabled = true;
                    
                    if (users[username]) {
                        microEnabled = users[username]['micro'];
                    }
                    $scope.streams.push({sid: sid, username: username, name: name, micro: microEnabled});
                    $scope.$apply();
                }
            };
            
            $scope.removeStream = function (sid) {
                
                for (var i = 0; i < $scope.streams.length; i++) {
                    
                    if ($scope.streams[i]['sid'] === sid) {
                        $scope.streams.splice(i, 1);
                        $scope.$apply();
                        break;
                    }
                }
            };
            
            $scope.disconnect = function () {
                XmppMucService.disconnect();
            };
            
            $scope.closeRoom = function () {
                XmppMucService.closeRoom();
            };
            
            $scope.openRoom = function () {
                XmppMucService.openRoom();
            };
            
            $scope.updateMainVideoSrc = function (username) {
                updateVideoSelection(username);
                updateMainVideoDisplay();
            };
            
            $scope.manageMicrophone = function (username) {
                var microEnabled = true;
                
                if (username === myUsername) {
                    microEnabled = $scope.myMicroEnabled;
                } else {
                    var stream = $scope.getStreamFromUsername(username);
                    
                    if (stream !== null) {
                        microEnabled = stream['micro'];
                    }
                }
                microEnabled = !microEnabled;
                sendMicroStatus(username, microEnabled);
            };
            
            $scope.manageCamera = function () {
                var cameraEnabled = !$scope.myCameraEnabled;
                sendCameraStatus(cameraEnabled);
            };
            
            $scope.streamClassName = function (username) {
                var streamClass = 'panel panel-default participant-panel';
                
                if ($scope.selectedUser === username) {
                    streamClass += ' video-selected';
                }
                
                if ($scope.speakingUser === username) {
                    streamClass += ' video-speaking';
                }
                
                return streamClass;
            };
        }
    ]);
})();
 
