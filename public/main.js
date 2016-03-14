'use strict';

window.app = angular.module('SpotApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate', 'uiGmapgoogle-maps']);

app.config(function ($urlRouterProvider, $locationProvider) {
    // This turns off hashbang urls (/#about) and changes it to something normal (/about)
    $locationProvider.html5Mode(true);
    // If we go to a URL that ui-router doesn't have registered, go to the "/" url.
    $urlRouterProvider.otherwise('/');
});

// This app.run is for controlling access to specific states.
app.run(function ($rootScope, AuthService, $state) {

    // The given state requires an authenticated user.
    var destinationStateRequiresAuth = function destinationStateRequiresAuth(state) {
        return state.data && state.data.authenticate;
    };

    // $stateChangeStart is an event fired
    // whenever the process of changing a state begins.
    $rootScope.$on('$stateChangeStart', function (event, toState, toParams) {

        if (!destinationStateRequiresAuth(toState)) {
            // The destination state does not require authentication
            // Short circuit with return.
            return;
        }

        if (AuthService.isAuthenticated()) {
            // The user is authenticated.
            // Short circuit with return.
            return;
        }

        // Cancel navigating to new state.
        event.preventDefault();

        AuthService.getLoggedInUser().then(function (user) {
            // If a user is retrieved, then renavigate to the destination
            // (the second time, AuthService.isAuthenticated() will work)
            // otherwise, if no user is logged in, go to "login" state.
            if (user) {
                $state.go(toState.name, toParams);
            } else {
                $state.go('login');
            }
        });
    });
});

app.config(function ($stateProvider) {
    $stateProvider.state('docs', {
        url: '/docs',
        templateUrl: 'js/docs/docs.html'
    });
});

(function () {

    'use strict';

    // Hope you didn't forget Angular! Duh-doy.

    if (!window.angular) throw new Error('I can\'t find Angular!');

    var app = angular.module('fsaPreBuilt', []);

    app.factory('Socket', function () {
        if (!window.io) throw new Error('socket.io not found!');
        return window.io(window.location.origin);
    });

    // AUTH_EVENTS is used throughout our app to
    // broadcast and listen from and to the $rootScope
    // for important events about authentication flow.
    app.constant('AUTH_EVENTS', {
        loginSuccess: 'auth-login-success',
        loginFailed: 'auth-login-failed',
        logoutSuccess: 'auth-logout-success',
        sessionTimeout: 'auth-session-timeout',
        notAuthenticated: 'auth-not-authenticated',
        notAuthorized: 'auth-not-authorized'
    });

    app.factory('AuthInterceptor', function ($rootScope, $q, AUTH_EVENTS) {
        var statusDict = {
            401: AUTH_EVENTS.notAuthenticated,
            403: AUTH_EVENTS.notAuthorized,
            419: AUTH_EVENTS.sessionTimeout,
            440: AUTH_EVENTS.sessionTimeout
        };
        return {
            responseError: function responseError(response) {
                $rootScope.$broadcast(statusDict[response.status], response);
                return $q.reject(response);
            }
        };
    });

    app.config(function ($httpProvider) {
        $httpProvider.interceptors.push(['$injector', function ($injector) {
            return $injector.get('AuthInterceptor');
        }]);
    });

    app.service('AuthService', function ($http, Session, $rootScope, AUTH_EVENTS, $q) {

        function onSuccessfulLogin(response) {
            var data = response.data;
            Session.create(data.id, data.user);
            $rootScope.$broadcast(AUTH_EVENTS.loginSuccess);
            return data.user;
        }

        // Uses the session factory to see if an
        // authenticated user is currently registered.
        this.isAuthenticated = function () {
            return !!Session.user;
        };

        this.getLoggedInUser = function (fromServer) {

            // If an authenticated session exists, we
            // return the user attached to that session
            // with a promise. This ensures that we can
            // always interface with this method asynchronously.

            // Optionally, if true is given as the fromServer parameter,
            // then this cached value will not be used.

            if (this.isAuthenticated() && fromServer !== true) {
                return $q.when(Session.user);
            }

            // Make request GET /session.
            // If it returns a user, call onSuccessfulLogin with the response.
            // If it returns a 401 response, we catch it and instead resolve to null.
            return $http.get('/session').then(onSuccessfulLogin).catch(function () {
                return null;
            });
        };

        this.getUserId = function () {
            this.getLoggedInUser().then(function (user) {
                return user._id;
            });
        };

        this.login = function (credentials) {
            return $http.post('/login', credentials).then(onSuccessfulLogin).catch(function () {
                return $q.reject({ message: 'Invalid login credentials.' });
            });
        };

        this.logout = function () {
            return $http.get('/logout').then(function () {
                Session.destroy();
                $rootScope.$broadcast(AUTH_EVENTS.logoutSuccess);
            });
        };
    });

    app.service('Session', function ($rootScope, AUTH_EVENTS) {

        var self = this;

        $rootScope.$on(AUTH_EVENTS.notAuthenticated, function () {
            self.destroy();
        });

        $rootScope.$on(AUTH_EVENTS.sessionTimeout, function () {
            self.destroy();
        });

        this.id = null;
        this.user = null;

        this.create = function (sessionId, user) {
            this.id = sessionId;
            this.user = user;
        };

        this.destroy = function () {
            this.id = null;
            this.user = null;
        };
    });
})();

app.config(function ($stateProvider) {

    $stateProvider.state('home', {
        url: '/',
        templateUrl: 'js/home/home.html'
    });
});
app.config(function ($stateProvider) {
    $stateProvider.state('leaveMessage', {
        url: '/leavemessage/:id',
        templateUrl: 'js/leave-message/leave-message.html',
        controller: "LeaveMessageController",
        resolve: {
            allFriends: function allFriends($stateParams, LeaveMessageFactory) {
                return LeaveMessageFactory.getFriends($stateParams.id);
            }
        }
    });
});

app.factory("LeaveMessageFactory", function ($http) {

    var LeaveMessageFactory = {};

    LeaveMessageFactory.getFriends = function (id) {
        return $http.get('/api/users/' + id + '/friends').then(function (res) {
            return res.data;
        });
    };

    LeaveMessageFactory.leaveMessage = function (newMsg) {
        return $http.post('/api/messages', newMsg).then(function (res) {
            console.log("res ", res);
            return res.data;
        });
    };

    return LeaveMessageFactory;
});

app.controller('LeaveMessageController', function ($scope, $state, AuthService, allFriends, LeaveMessageFactory) {
    $scope.currentUser = {};

    $scope.newMessage = {
        location: {
            coordinates: []
        }
    };

    AuthService.getLoggedInUser().then(function (user) {
        $scope.currentUser = user;
        $scope.newMessage.from = $scope.currentUser._id;
    });

    $scope.allFriends = allFriends;

    $scope.leaveMessage = function (msg) {
        LeaveMessageFactory.leaveMessage(msg);
        $state.go('main');
    };

    $scope.getLocation = function () {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition($scope.getPosition, $scope.getError);
        } else {
            $scope.newMessage.location.coordinates = [0, 0];
        }
    };

    $scope.getPosition = function (position) {
        $scope.newMessage.location.coordinates = [position.coords.longitude, position.coords.latitude];
    };

    $scope.getError = function (error) {
        if (error) {
            throw new Error();
        }
    };

    $scope.getLocation();
});

app.config(function ($stateProvider) {

    $stateProvider.state('login', {
        url: '/login',
        templateUrl: 'js/login/login.html',
        controller: 'LoginCtrl'
    });
});

app.controller('LoginCtrl', function ($scope, AuthService, $state) {

    $scope.login = {};
    $scope.error = null;

    $scope.sendLogin = function (loginInfo) {

        $scope.error = null;

        AuthService.login(loginInfo).then(function (currentUser) {
            $state.go('main', { id: currentUser._id });
            // $state.go('home', {id: currentUser._id});
        }).catch(function () {
            $scope.error = 'Invalid login credentials.';
        });
    };
});
app.config(function ($stateProvider) {
    $stateProvider.state('main', {
        url: '/main/:id',
        templateUrl: 'js/main-page/main.page.html',
        controller: 'MainPageController'
    });
});

app.controller('MainPageController', function ($scope, AuthService) {
    $scope.currentUser = {};
    $scope.currentLocation = [];

    AuthService.getLoggedInUser().then(function (user) {
        $scope.currentUser = user;
    });

    $scope.getLocation = function () {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition($scope.getPosition, $scope.getError);
        } else {
            $scope.currentLocation = [0, 0];
        }
    };

    $scope.getPosition = function (position) {
        $scope.currentLocation = [position.coords.longitude, position.coords.latitude];
        return $scope.currentLocation;
    };

    $scope.getError = function (error) {
        if (error) {
            throw new Error();
        }
    };

    $scope.getLocation();
});

app.config(function ($stateProvider) {

    $stateProvider.state('membersOnly', {
        url: '/members-area',
        template: '<img ng-repeat="item in stash" width="300" ng-src="{{ item }}" />',
        controller: function controller($scope, SecretStash) {
            SecretStash.getStash().then(function (stash) {
                $scope.stash = stash;
            });
        },
        // The following data.authenticate is read by an event listener
        // that controls access to this state. Refer to app.js.
        data: {
            authenticate: true
        }
    });
});

app.factory('SecretStash', function ($http) {

    var getStash = function getStash() {
        return $http.get('/api/members/secret-stash').then(function (response) {
            return response.data;
        });
    };

    return {
        getStash: getStash
    };
});
app.config(function ($stateProvider) {
    $stateProvider.state('messages-map', {
        url: '/messages-map/:id?lon&lat',
        templateUrl: 'js/messages-map/messages-map.html',
        controller: 'MapController'
    });
});

app.config(function (uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyC1Mt5PaZY_ZRi0HADXDlBEsKL7yhwmEv4',
        v: '3.20',
        libraries: 'weather,geometry,visualization'
    });
});

app.controller("MapController", function ($scope, uiGmapGoogleMapApi, $stateParams) {
    console.log($stateParams);
    $scope.map = {
        center: {
            // latitude: 40.7180007, longitude: -73.9620894
            latitude: $stateParams.lat, longitude: $stateParams.lon
        },
        zoom: 14

    };
    $scope.marker = {
        id: 0,
        coords: {
            latitude: $stateParams.lat,
            longitude: $stateParams.lon
        }
        // events: {
        //   dragend: function (marker, eventName, args) {
        //     $log.log('marker dragend');
        //     var lat = marker.getPosition().lat();
        //     var lon = marker.getPosition().lng();
        //     $log.log(lat);
        //     $log.log(lon);

        //     $scope.marker.options = {
        //       draggable: true,
        //       labelContent: "lat: " + $scope.marker.coords.latitude + ' ' + 'lon: ' + $scope.marker.coords.longitude,
        //       labelAnchor: "100 0",
        //       labelClass: "marker-labels"
        //     };
        //   }
        // }
    };

    uiGmapGoogleMapApi.then(function (maps) {});
});

/*
var marker = {
                    id: Date.now(),
                    coords: {
                        latitude: lat,
                        longitude: lon
                    }
                };
                $scope.map.markers.push(marker);
*/

app.config(function ($stateProvider) {
    $stateProvider.state('messagesHere', {
        url: '/messages/to/:id?lon&lat',
        // url: '/messages/here/:id',
        templateUrl: 'js/see-msg/see.msg.html',
        controller: 'MessagesHereController',
        resolve: {
            allMessages: function allMessages($stateParams, MessagesHereFactory) {
                return MessagesHereFactory.inboxHere($stateParams.id, $stateParams.lon, $stateParams.lat);
            }
        }
    });
});

app.factory('MessagesHereFactory', function ($http) {

    var MessagesHereFactory = {};

    MessagesHereFactory.inboxHere = function (id, lon, lat) {
        console.log(lon + " " + lat);
        return $http.get('/api/messages/to/' + id + '?lon=' + lon + '&lat=' + lat).then(function (res) {
            return res.data;
        });
    };

    return MessagesHereFactory;
});

app.controller('MessagesHereController', function ($scope, AuthService, MessagesHereFactory, allMessages) {

    $scope.currentUser = {};

    AuthService.getLoggedInUser().then(function (user) {
        $scope.currentUser = user;
    });

    $scope.allMessages = allMessages;
});

app.config(function ($stateProvider) {
    $stateProvider.state('notifications', {
        url: '/notifications/:id',
        templateUrl: 'js/see-notifications/see.notifications.html',
        controller: 'NotificationsController',
        resolve: {
            allMessages: function allMessages($stateParams, NotificationsFactory) {
                return NotificationsFactory.getAllMessages($stateParams.id);
            }
        }
    });
});

app.factory('NotificationsFactory', function ($http) {
    var NotificationsFactory = {};

    NotificationsFactory.getAllMessages = function (id) {
        return $http.get('api/messages/to/all/' + id).then(function (res) {
            return res.data;
        });
    };
    return NotificationsFactory;
});

app.controller('NotificationsController', function ($scope, allMessages) {
    $scope.allMessages = allMessages;
});

app.factory('FullstackPics', function () {
    return ['https://pbs.twimg.com/media/B7gBXulCAAAXQcE.jpg:large', 'https://fbcdn-sphotos-c-a.akamaihd.net/hphotos-ak-xap1/t31.0-8/10862451_10205622990359241_8027168843312841137_o.jpg', 'https://pbs.twimg.com/media/B-LKUshIgAEy9SK.jpg', 'https://pbs.twimg.com/media/B79-X7oCMAAkw7y.jpg', 'https://pbs.twimg.com/media/B-Uj9COIIAIFAh0.jpg:large', 'https://pbs.twimg.com/media/B6yIyFiCEAAql12.jpg:large', 'https://pbs.twimg.com/media/CE-T75lWAAAmqqJ.jpg:large', 'https://pbs.twimg.com/media/CEvZAg-VAAAk932.jpg:large', 'https://pbs.twimg.com/media/CEgNMeOXIAIfDhK.jpg:large', 'https://pbs.twimg.com/media/CEQyIDNWgAAu60B.jpg:large', 'https://pbs.twimg.com/media/CCF3T5QW8AE2lGJ.jpg:large', 'https://pbs.twimg.com/media/CAeVw5SWoAAALsj.jpg:large', 'https://pbs.twimg.com/media/CAaJIP7UkAAlIGs.jpg:large', 'https://pbs.twimg.com/media/CAQOw9lWEAAY9Fl.jpg:large', 'https://pbs.twimg.com/media/B-OQbVrCMAANwIM.jpg:large', 'https://pbs.twimg.com/media/B9b_erwCYAAwRcJ.png:large', 'https://pbs.twimg.com/media/B5PTdvnCcAEAl4x.jpg:large', 'https://pbs.twimg.com/media/B4qwC0iCYAAlPGh.jpg:large', 'https://pbs.twimg.com/media/B2b33vRIUAA9o1D.jpg:large', 'https://pbs.twimg.com/media/BwpIwr1IUAAvO2_.jpg:large', 'https://pbs.twimg.com/media/BsSseANCYAEOhLw.jpg:large', 'https://pbs.twimg.com/media/CJ4vLfuUwAAda4L.jpg:large', 'https://pbs.twimg.com/media/CI7wzjEVEAAOPpS.jpg:large', 'https://pbs.twimg.com/media/CIdHvT2UsAAnnHV.jpg:large', 'https://pbs.twimg.com/media/CGCiP_YWYAAo75V.jpg:large', 'https://pbs.twimg.com/media/CIS4JPIWIAI37qu.jpg:large'];
});

app.factory('RandomGreetings', function () {

    var getRandomFromArray = function getRandomFromArray(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    };

    var greetings = ['Hello, world!', 'At long last, I live!', 'Hello, simple human.', 'What a beautiful day!', 'I\'m like any other project, except that I am yours. :)', 'This empty string is for Lindsay Levine.', 'こんにちは、ユーザー様。', 'Welcome. To. WEBSITE.', ':D', 'Yes, I think we\'ve met before.', 'Gimme 3 mins... I just grabbed this really dope frittata', 'If Cooper could offer only one piece of advice, it would be to nevSQUIRREL!'];

    var _getLocation = function _getLocation() {
        navigator.geolocation.getCurrentPosition(function (data) {
            return data;
        });
    };

    return {
        greetings: greetings,
        getRandomGreeting: function getRandomGreeting() {
            return getRandomFromArray(greetings);
        },

        getLocation: function getLocation() {

            return _getLocation();
        }

    };
});

app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state) {

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'js/common/directives/navbar/navbar.html',
        link: function link(scope) {

            scope.user = null;

            scope.isLoggedIn = function () {
                return AuthService.isAuthenticated();
            };

            scope.logout = function () {
                AuthService.logout().then(function () {
                    $state.go('home');
                });
            };

            scope.goHome = function () {
                $state.go('main');
            };

            var setUser = function setUser() {
                AuthService.getLoggedInUser().then(function (user) {
                    scope.user = user;
                });
            };

            var removeUser = function removeUser() {
                scope.user = null;
            };

            setUser();

            $rootScope.$on(AUTH_EVENTS.loginSuccess, setUser);
            $rootScope.$on(AUTH_EVENTS.logoutSuccess, removeUser);
            $rootScope.$on(AUTH_EVENTS.sessionTimeout, removeUser);
        }

    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImRvY3MvZG9jcy5qcyIsImZzYS9mc2EtcHJlLWJ1aWx0LmpzIiwiaG9tZS9ob21lLmpzIiwibGVhdmUtbWVzc2FnZS9sZWF2ZS1tZXNzYWdlLmpzIiwibG9naW4vbG9naW4uanMiLCJtYWluLXBhZ2UvbWFpbi5wYWdlLmpzIiwibWVtYmVycy1vbmx5L21lbWJlcnMtb25seS5qcyIsIm1lc3NhZ2VzLW1hcC9tZXNzYWdlcy1tYXAuanMiLCJzZWUtbXNnL3NlZS5tc2cuanMiLCJzZWUtbm90aWZpY2F0aW9ucy9zZWUubm90aWZpY2F0aW9ucy5qcyIsImNvbW1vbi9mYWN0b3JpZXMvRnVsbHN0YWNrUGljcy5qcyIsImNvbW1vbi9mYWN0b3JpZXMvUmFuZG9tR3JlZXRpbmdzLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUFDQSxPQUFBLEdBQUEsR0FBQSxRQUFBLE1BQUEsQ0FBQSxTQUFBLEVBQUEsQ0FBQSxhQUFBLEVBQUEsV0FBQSxFQUFBLGNBQUEsRUFBQSxXQUFBLEVBQUEsbUJBQUEsQ0FBQSxDQUFBOztBQUVBLElBQUEsTUFBQSxDQUFBLFVBQUEsa0JBQUEsRUFBQSxpQkFBQSxFQUFBOztBQUVBLHNCQUFBLFNBQUEsQ0FBQSxJQUFBOztBQUZBLHNCQUlBLENBQUEsU0FBQSxDQUFBLEdBQUEsRUFKQTtDQUFBLENBQUE7OztBQVFBLElBQUEsR0FBQSxDQUFBLFVBQUEsVUFBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUE7OztBQUdBLFFBQUEsK0JBQUEsU0FBQSw0QkFBQSxDQUFBLEtBQUEsRUFBQTtBQUNBLGVBQUEsTUFBQSxJQUFBLElBQUEsTUFBQSxJQUFBLENBQUEsWUFBQSxDQURBO0tBQUE7Ozs7QUFIQSxjQVNBLENBQUEsR0FBQSxDQUFBLG1CQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUEsT0FBQSxFQUFBLFFBQUEsRUFBQTs7QUFFQSxZQUFBLENBQUEs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QUEsT0FBQSxRQUFBLENBQUEsQ0FEQTtTQUFBLE1BRUE7QUFDQSxtQkFBQSxVQUFBLENBQUEsUUFBQSxDQUFBLFdBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FEQTtTQUZBO0tBREEsQ0F0QkE7O0FBOEJBLFdBQUEsV0FBQSxHQUFBLFVBQUEsUUFBQSxFQUFBO0FBQ0EsZUFBQSxVQUFBLENBQUEsUUFBQSxDQUFBLFdBQUEsR0FBQSxDQUFBLFNBQUEsTUFBQSxDQUFBLFNBQUEsRUFBQSxTQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsQ0FEQTtLQUFBLENBOUJBOztBQWtDQSxXQUFBLFFBQUEsR0FBQSxVQUFBLEtBQUEsRUFBQTtBQUNBLFlBQUEsS0FBQSxFQUFBO0FBQ0Esa0JBQUEsSUFBQSxLQUFBLEVBQUEsQ0FEQTtTQUFBO0tBREEsQ0FsQ0E7O0FBd0NBLFdBQUEsV0FBQSxHQXhDQTtDQUFBLENBQUE7O0FDbkNBLElBQUEsTUFBQSxDQUFBLFVBQUEsY0FBQSxFQUFBOztBQUVBLG1CQUFBLEtBQUEsQ0FBQSxPQUFBLEVBQUE7QUFDQSxhQUFBLFFBQUE7QUFDQSxxQkFBQSxxQkFBQTtBQUNBLG9CQUFBLFdBQUE7S0FIQSxFQUZBO0NBQUEsQ0FBQTs7QUFVQSxJQUFBLFVBQUEsQ0FBQSxXQUFBLEVBQUEsVUFBQSxNQUFBLEVBQUEsV0FBQSxFQUFBLE1BQUEsRUFBQTs7QUFFQSxXQUFBLEtBQUEsR0FBQSxFQUFBLENBRkE7QUFHQSxXQUFBLEtBQUEsR0FBQSxJQUFBLENBSEE7O0FBS0EsV0FBQSxTQUFBLEdBQUEsVUFBQSxTQUFBLEVBQUE7O0FBRUEsZUFBQSxLQUFBLEdBQUEsSUFBQSxDQUZBOztBQUlBLG9CQUFBLEtBQUEsQ0FBQSxTQUFBLEVBQUEsSUFBQSxDQUFBLFVBQUEsV0FBQSxFQUFBO0FBQ0EsbUJBQUEsRUFBQSxDQUFBLE1BQUEsRUFBQSxFQUFBLElBQUEsWUFBQSxHQUFBLEVBQUE7O0FBREEsU0FBQSxDQUFBLENBR0EsS0FIQSxDQUdBLFlBQUE7QUFDQSxtQkFBQSxLQUFBLEdBQUEsNEJBQUEsQ0FEQTtTQUFBLENBSEEsQ0FKQTtLQUFBLENBTEE7Q0FBQSxDQUFBO0FDVkEsSUFBQSxNQUFBLENBQUEsVUFBQSxjQUFBLEVBQUE7QUFDQSxtQkFBQSxLQUFBLENBQUEsTUFBQSxFQUFBO0FBQ0EsYUFBQSxXQUFBO0FBQ0EscUJBQUEsNkJBQUE7QUFDQSxvQkFBQSxvQkFBQTtLQUhBLEVBREE7Q0FBQSxDQUFBOztBQVFBLElBQUEsVUFBQSxDQUFBLG9CQUFBLEVBQUEsVUFBQSxNQUFBLEVBQUEsV0FBQSxFQUFBO0FBQ0EsV0FBQSxXQUFBLEdBQUEsRUFBQSxDQURBO0FBRUEsV0FBQSxlQUFBLEdBQUEsRUFBQSxDQUZBOztBQUlBLGdCQUFBLGVBQUEsR0FDQSxJQURBLENBQ0EsVUFBQSxJQUFBLEVBQUE7QUFDQSxlQUFBLFdBQUEsR0FBQSxJQUFBLENBREE7S0FBQSxDQURBLENBSkE7O0FBU0EsV0FBQSxXQUFBLEdBQUEsWUFBQTtBQUNBLFlBQUEsVUFBQSxXQUFBLEVBQUE7QUFDQSxzQkFBQSxXQUFBLENBQUEsa0JBQUEsQ0FBQSxPQUFBLFdBQUEsRUFBQSxPQUFBLFFBQUEsQ0FBQSxDQURBO1NBQUEsTUFFQTtBQUNBLG1CQUFBLGVBQUEsR0FBQSxDQUFBLENBQUEsRUFBQSxDQUFBLENBQUEsQ0FEQTtTQUZBO0tBREEsQ0FUQTs7QUFpQkEsV0FBQSxXQUFBLEdBQUEsVUFBQSxRQUFBLEVBQUE7QUFDQSxlQUFBLGVBQUEsR0FBQSxDQUFBLFNBQUEsTUFBQSxDQUFBLFNBQUEsRUFBQSxTQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsQ0FEQTtBQUVBLGVBQUEsT0FBQSxlQUFBLENBRkE7S0FBQSxDQWpCQTs7QUFzQkEsV0FBQSxRQUFBLEdBQUEsVUFBQSxLQUFBLEVBQUE7QUFDQSxZQUFBLEtBQUEsRUFBQTtBQUNBLGtCQUFBLElBQUEsS0FBQSxFQUFBLENBREE7U0FBQTtLQURBLENBdEJBOztBQTRCQSxXQUFBLFdBQUEsR0E1QkE7Q0FBQSxDQUFBOztBQ1JBLElBQUEsTUFBQSxDQUFB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b250ZW50IjpbIid1c2Ugc3RyaWN0JztcbndpbmRvdy5hcHAgPSBhbmd1bGFyLm1vZHVsZSgnU3BvdEFwcCcsIFsnZnNhUHJlQnVpbHQnLCAndWkucm91dGVyJywgJ3VpLmJvb3RzdHJhcCcsICduZ0FuaW1hdGUnLCAndWlHbWFwZ29vZ2xlLW1hcHMnXSk7XG5cbmFwcC5jb25maWcoZnVuY3Rpb24gKCR1cmxSb3V0ZXJQcm92aWRlciwgJGxvY2F0aW9uUHJvdmlkZXIpIHtcbiAgICAvLyBUaGlzIHR1cm5zIG9mZiBoYXNoYmFuZyB1cmxzICgvI2Fib3V0KSBhbmQgY2hhbmdlcyBpdCB0byBzb21ldGhpbmcgbm9ybWFsICgvYWJvdXQpXG4gICAgJGxvY2F0aW9uUHJvdmlkZXIuaHRtbDVNb2RlKHRydWUpO1xuICAgIC8vIElmIHdlIGdvIHRvIGEgVVJMIHRoYXQgdWktcm91dGVyIGRvZXNuJ3QgaGF2ZSByZWdpc3RlcmVkLCBnbyB0byB0aGUgXCIvXCIgdXJsLlxuICAgICR1cmxSb3V0ZXJQcm92aWRlci5vdGhlcndpc2UoJy8nKTtcbn0pO1xuXG4vLyBUaGlzIGFwcC5ydW4gaXMgZm9yIGNvbnRyb2xsaW5nIGFjY2VzcyB0byBzcGVjaWZpYyBzdGF0ZXMuXG5hcHAucnVuKGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlKSB7XG5cbiAgICAvLyBUaGUgZ2l2ZW4gc3RhdGUgcmVxdWlyZXMgYW4gYXV0aGVudGljYXRlZCB1c2VyLlxuICAgIHZhciBkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgICAgIHJldHVybiBzdGF0ZS5kYXRhICYmIHN0YXRlLmRhdGEuYXV0aGVudGljYXRlO1xuICAgIH07XG5cbiAgICAvLyAkc3RhdGVDaGFuZ2VTdGFydCBpcyBhbiBldmVudCBmaXJlZFxuICAgIC8vIHdoZW5ldmVyIHRoZSBwcm9jZXNzIG9mIGNoYW5naW5nIGEgc3RhdGUgYmVnaW5zLlxuICAgICRyb290U2NvcGUuJG9uKCckc3RhdGVDaGFuZ2VTdGFydCcsIGZ1bmN0aW9uIChldmVudCwgdG9TdGF0ZSwgdG9QYXJhbXMpIHtcblxuICAgICAgICBpZiAoIWRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGgodG9TdGF0ZSkpIHtcbiAgICAgICAgICAgIC8vIFRoZSBkZXN0aW5hdGlvbiBzdGF0ZSBkb2VzIG5vdCByZXF1aXJlIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpKSB7XG4gICAgICAgICAgICAvLyBUaGUgdXNlciBpcyBhdXRoZW50aWNhdGVkLlxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENhbmNlbCBuYXZpZ2F0aW5nIHRvIG5ldyBzdGF0ZS5cbiAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAvLyBJZiBhIHVzZXIgaXMgcmV0cmlldmVkLCB0aGVuIHJlbmF2aWdhdGUgdG8gdGhlIGRlc3RpbmF0aW9uXG4gICAgICAgICAgICAvLyAodGhlIHNlY29uZCB0aW1lLCBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSB3aWxsIHdvcmspXG4gICAgICAgICAgICAvLyBvdGhlcndpc2UsIGlmIG5vIHVzZXIgaXMgbG9nZ2VkIGluLCBnbyB0byBcImxvZ2luXCIgc3RhdGUuXG4gICAgICAgICAgICBpZiAodXNlcikge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbyh0b1N0YXRlLm5hbWUsIHRvUGFyYW1zKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdsb2dpbicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgIH0pO1xuXG59KTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2RvY3MnLCB7XG4gICAgICAgIHVybDogJy9kb2NzJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9kb2NzL2RvY3MuaHRtbCdcbiAgICB9KTtcbn0pO1xuIiwiKGZ1bmN0aW9uICgpIHtcblxuICAgICd1c2Ugc3RyaWN0JztcblxuICAgIC8vIEhvcGUgeW91IGRpZG4ndCBmb3JnZXQgQW5ndWxhciEgRHVoLWRveS5cbiAgICBpZiAoIXdpbmRvdy5hbmd1bGFyKSB0aHJvdyBuZXcgRXJyb3IoJ0kgY2FuXFwndCBmaW5kIEFuZ3VsYXIhJyk7XG5cbiAgICB2YXIgYXBwID0gYW5ndWxhci5tb2R1bGUoJ2ZzYVByZUJ1aWx0JywgW10pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ1NvY2tldCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCF3aW5kb3cuaW8pIHRocm93IG5ldyBFcnJvcignc29ja2V0LmlvIG5vdCBmb3VuZCEnKTtcbiAgICAgICAgcmV0dXJuIHdpbmRvdy5pbyh3aW5kb3cubG9jYXRpb24ub3JpZ2luKTtcbiAgICB9KTtcblxuICAgIC8vIEFVVEhfRVZFTlRTIGlzIHVzZWQgdGhyb3VnaG91dCBvdXIgYXBwIHRvXG4gICAgLy8gYnJvYWRjYXN0IGFuZCBsaXN0ZW4gZnJvbSBhbmQgdG8gdGhlICRyb290U2NvcGVcbiAgICAvLyBmb3IgaW1wb3J0YW50IGV2ZW50cyBhYm91dCBhdXRoZW50aWNhdGlvbiBmbG93LlxuICAgIGFwcC5jb25zdGFudCgnQVVUSF9FVkVOVFMnLCB7XG4gICAgICAgIGxvZ2luU3VjY2VzczogJ2F1dGgtbG9naW4tc3VjY2VzcycsXG4gICAgICAgIGxvZ2luRmFpbGVkOiAnYXV0aC1sb2dpbi1mYWlsZWQnLFxuICAgICAgICBsb2dvdXRTdWNjZXNzOiAnYXV0aC1sb2dvdXQtc3VjY2VzcycsXG4gICAgICAgIHNlc3Npb25UaW1lb3V0OiAnYXV0aC1zZXNzaW9uLXRpbWVvdXQnLFxuICAgICAgICBub3RBdXRoZW50aWNhdGVkOiAnYXV0aC1ub3QtYXV0aGVudGljYXRlZCcsXG4gICAgICAgIG5vdEF1dGhvcml6ZWQ6ICdhdXRoLW5vdC1hdXRob3JpemVkJ1xuICAgIH0pO1xuXG4gICAgYXBwLmZhY3RvcnkoJ0F1dGhJbnRlcmNlcHRvcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCAkcSwgQVVUSF9FVkVOVFMpIHtcbiAgICAgICAgdmFyIHN0YXR1c0RpY3QgPSB7XG4gICAgICAgICAgICA0MDE6IEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsXG4gICAgICAgICAgICA0MDM6IEFVVEhfRVZFTlRTLm5vdEF1dGhvcml6ZWQsXG4gICAgICAgICAgICA0MTk6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LFxuICAgICAgICAgICAgNDQwOiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dFxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgcmVzcG9uc2VFcnJvcjogZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KHN0YXR1c0RpY3RbcmVzcG9uc2Uuc3RhdHVzXSwgcmVzcG9uc2UpO1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QocmVzcG9uc2UpXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSk7XG5cbiAgICBhcHAuY29uZmlnKGZ1bmN0aW9uICgkaHR0cFByb3ZpZGVyKSB7XG4gICAgICAgICRodHRwUHJvdmlkZXIuaW50ZXJjZXB0b3JzLnB1c2goW1xuICAgICAgICAgICAgJyRpbmplY3RvcicsXG4gICAgICAgICAgICBmdW5jdGlvbiAoJGluamVjdG9yKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRpbmplY3Rvci5nZXQoJ0F1dGhJbnRlcmNlcHRvcicpO1xuICAgICAgICAgICAgfVxuICAgICAgICBdKTtcbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdBdXRoU2VydmljZScsIGZ1bmN0aW9uICgkaHR0cCwgU2Vzc2lvbiwgJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMsICRxKSB7XG5cbiAgICAgICAgZnVuY3Rpb24gb25TdWNjZXNzZnVsTG9naW4ocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgICAgIFNlc3Npb24uY3JlYXRlKGRhdGEuaWQsIGRhdGEudXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzKTtcbiAgICAgICAgICAgIHJldHVybiBkYXRhLnVzZXI7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBVc2VzIHRoZSBzZXNzaW9uIGZhY3RvcnkgdG8gc2VlIGlmIGFuXG4gICAgICAgIC8vIGF1dGhlbnRpY2F0ZWQgdXNlciBpcyBjdXJyZW50bHkgcmVnaXN0ZXJlZC5cbiAgICAgICAgdGhpcy5pc0F1dGhlbnRpY2F0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gISFTZXNzaW9uLnVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nZXRMb2dnZWRJblVzZXIgPSBmdW5jdGlvbiAoZnJvbVNlcnZlcikge1xuXG4gICAgICAgICAgICAvLyBJZiBhbiBhdXRoZW50aWNhdGVkIHNlc3Npb24gZXhpc3RzLCB3ZVxuICAgICAgICAgICAgLy8gcmV0dXJuIHRoZSB1c2VyIGF0dGFjaGVkIHRvIHRoYXQgc2Vzc2lvblxuICAgICAgICAgICAgLy8gd2l0aCBhIHByb21pc2UuIFRoaXMgZW5zdXJlcyB0aGF0IHdlIGNhblxuICAgICAgICAgICAgLy8gYWx3YXlzIGludGVyZmFjZSB3aXRoIHRoaXMgbWV0aG9kIGFzeW5jaHJvbm91c2x5LlxuXG4gICAgICAgICAgICAvLyBPcHRpb25hbGx5LCBpZiB0cnVlIGlzIGdpdmVuIGFzIHRoZSBmcm9tU2VydmVyIHBhcmFtZXRlcixcbiAgICAgICAgICAgIC8vIHRoZW4gdGhpcyBjYWNoZWQgdmFsdWUgd2lsbCBub3QgYmUgdXNlZC5cblxuICAgICAgICAgICAgaWYgKHRoaXMuaXNBdXRoZW50aWNhdGVkKCkgJiYgZnJvbVNlcnZlciAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAkcS53aGVuKFNlc3Npb24udXNlcik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIE1ha2UgcmVxdWVzdCBHRVQgL3Nlc3Npb24uXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgdXNlciwgY2FsbCBvblN1Y2Nlc3NmdWxMb2dpbiB3aXRoIHRoZSByZXNwb25zZS5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSA0MDEgcmVzcG9uc2UsIHdlIGNhdGNoIGl0IGFuZCBpbnN0ZWFkIHJlc29sdmUgdG8gbnVsbC5cbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9zZXNzaW9uJykudGhlbihvblN1Y2Nlc3NmdWxMb2dpbikuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldFVzZXJJZCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5nZXRMb2dnZWRJblVzZXIoKVxuICAgICAgICAgICAgLnRoZW4oZnVuY3Rpb24odXNlcikge1xuICAgICAgICAgICAgICAgIHJldHVybiB1c2VyLl9pZFxuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMubG9naW4gPSBmdW5jdGlvbiAoY3JlZGVudGlhbHMpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5wb3N0KCcvbG9naW4nLCBjcmVkZW50aWFscylcbiAgICAgICAgICAgICAgICAudGhlbihvblN1Y2Nlc3NmdWxMb2dpbilcbiAgICAgICAgICAgICAgICAuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHsgbWVzc2FnZTogJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJyB9KTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9sb2dvdXQnKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBTZXNzaW9uLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3QoQVVUSF9FVkVOVFMubG9nb3V0U3VjY2Vzcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ1Nlc3Npb24nLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgQVVUSF9FVkVOVFMpIHtcblxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgIHRoaXMudXNlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy5jcmVhdGUgPSBmdW5jdGlvbiAoc2Vzc2lvbklkLCB1c2VyKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gc2Vzc2lvbklkO1xuICAgICAgICAgICAgdGhpcy51c2VyID0gdXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IG51bGw7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxufSkoKTtcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnaG9tZScsIHtcbiAgICAgICAgdXJsOiAnLycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvaG9tZS9ob21lLmh0bWwnXG4gICAgfSk7XG5cbn0pOyIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xlYXZlTWVzc2FnZScsIHtcbiAgICAgICAgdXJsOiAnL2xlYXZlbWVzc2FnZS86aWQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2xlYXZlLW1lc3NhZ2UvbGVhdmUtbWVzc2FnZS5odG1sJywgXG4gICAgICAgIGNvbnRyb2xsZXI6IFwiTGVhdmVNZXNzYWdlQ29udHJvbGxlclwiLFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgIFx0YWxsRnJpZW5kczogZnVuY3Rpb24gKCRzdGF0ZVBhcmFtcywgTGVhdmVNZXNzYWdlRmFjdG9yeSkge1xuICAgICAgICBcdFx0cmV0dXJuIExlYXZlTWVzc2FnZUZhY3RvcnkuZ2V0RnJpZW5kcygkc3RhdGVQYXJhbXMuaWQpO1xuICAgICAgICBcdH1cbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG5cbmFwcC5mYWN0b3J5KFwiTGVhdmVNZXNzYWdlRmFjdG9yeVwiLCBmdW5jdGlvbigkaHR0cCkge1xuXG5cdHZhciBMZWF2ZU1lc3NhZ2VGYWN0b3J5ID0ge307XG5cblx0TGVhdmVNZXNzYWdlRmFjdG9yeS5nZXRGcmllbmRzID0gZnVuY3Rpb24oaWQpIHtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL3VzZXJzLycgKyBpZCArICcvZnJpZW5kcycpXG4gXHRcdC50aGVuKGZ1bmN0aW9uKHJlcyl7XG4gXHRcdFx0cmV0dXJuIHJlcy5kYXRhO1xuIFx0XHR9KTtcblx0fTtcblxuXHRMZWF2ZU1lc3NhZ2VGYWN0b3J5LmxlYXZlTWVzc2FnZSA9IGZ1bmN0aW9uKG5ld01zZykge1xuXHRcdHJldHVybiAkaHR0cC5wb3N0KCcvYXBpL21lc3NhZ2VzJywgbmV3TXNnKVxuXHRcdC50aGVuKGZ1bmN0aW9uKHJlcykge1xuXHRcdFx0Y29uc29sZS5sb2coXCJyZXMgXCIsIHJlcylcblx0XHRcdHJldHVybiByZXMuZGF0YTtcblx0XHR9KVxuXHR9O1xuXG5cdHJldHVybiBMZWF2ZU1lc3NhZ2VGYWN0b3J5O1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdMZWF2ZU1lc3NhZ2VDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCAkc3RhdGUsIEF1dGhTZXJ2aWNlLCBhbGxGcmllbmRzLCBMZWF2ZU1lc3NhZ2VGYWN0b3J5KSB7XG5cdCRzY29wZS5jdXJyZW50VXNlciA9IHt9O1xuXG5cdCRzY29wZS5uZXdNZXNzYWdlID0ge1xuXHRcdGxvY2F0aW9uOiB7XG5cdFx0XHRjb29yZGluYXRlczogW11cblx0XHR9XG5cdH07XG5cblx0QXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcblx0LnRoZW4oZnVuY3Rpb24odXNlcikge1xuXHRcdCRzY29wZS5jdXJyZW50VXNlciA9IHVzZXI7XG5cdFx0JHNjb3BlLm5ld01lc3NhZ2UuZnJvbSA9ICRzY29wZS5jdXJyZW50VXNlci5faWRcblx0fSlcblxuXHQkc2NvcGUuYWxsRnJpZW5kcyA9IGFsbEZyaWVuZHM7XG5cblx0JHNjb3BlLmxlYXZlTWVzc2FnZSA9IGZ1bmN0aW9uKG1zZykge1xuXHRcdExlYXZlTWVzc2FnZUZhY3RvcnkubGVhdmVNZXNzYWdlKG1zZylcblx0XHQkc3RhdGUuZ28oJ21haW4nKVxuXHR9O1xuXG5cdCRzY29wZS5nZXRMb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuXHQgIGlmIChuYXZpZ2F0b3IuZ2VvbG9jYXRpb24pIHtcblx0ICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oJHNjb3BlLmdldFBvc2l0aW9uLCAkc2NvcGUuZ2V0RXJyb3IpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICAkc2NvcGUubmV3TWVzc2FnZS5sb2NhdGlvbi5jb29yZGluYXRlcyA9IFswLCAwXTtcblx0ICB9XG5cdH1cblxuXHQkc2NvcGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuIFx0XHQkc2NvcGUubmV3TWVzc2FnZS5sb2NhdGlvbi5jb29yZGluYXRlcyA9IFtwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlLCBwb3NpdGlvbi5jb29yZHMubGF0aXR1ZGVdXG4gXHR9XG5cbiBcdCRzY29wZS5nZXRFcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gXHRcdGlmKGVycm9yKSB7XG4gXHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG4gXHRcdH1cbiBcdH1cblxuIFx0JHNjb3BlLmdldExvY2F0aW9uKCk7XG5cdFxuXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbG9naW4nLCB7XG4gICAgICAgIHVybDogJy9sb2dpbicsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbG9naW4vbG9naW4uaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignTG9naW5DdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgJHNjb3BlLmxvZ2luID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICRzY29wZS5zZW5kTG9naW4gPSBmdW5jdGlvbiAobG9naW5JbmZvKSB7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICAgICBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pLnRoZW4oZnVuY3Rpb24gKGN1cnJlbnRVc2VyKSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ21haW4nLCB7aWQ6IGN1cnJlbnRVc2VyLl9pZH0pO1xuICAgICAgICAgICAgLy8gJHN0YXRlLmdvKCdob21lJywge2lkOiBjdXJyZW50VXNlci5faWR9KTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJztcbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtYWluJywge1xuICAgICAgICB1cmw6ICcvbWFpbi86aWQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL21haW4tcGFnZS9tYWluLnBhZ2UuaHRtbCcsIFxuICAgICAgICBjb250cm9sbGVyOiAnTWFpblBhZ2VDb250cm9sbGVyJ1xuICAgIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdNYWluUGFnZUNvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsIEF1dGhTZXJ2aWNlKSB7XG4gICAgJHNjb3BlLmN1cnJlbnRVc2VyID0ge307XG4gICAgJHNjb3BlLmN1cnJlbnRMb2NhdGlvbiA9IFtdO1xuXG4gICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50VXNlciA9IHVzZXI7XG4gICAgfSlcblxuICAgICRzY29wZS5nZXRMb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKG5hdmlnYXRvci5nZW9sb2NhdGlvbikge1xuICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKCRzY29wZS5nZXRQb3NpdGlvbiwgJHNjb3BlLmdldEVycm9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50TG9jYXRpb24gPSBbMCwgMF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgJHNjb3BlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICAgICAgJHNjb3BlLmN1cnJlbnRMb2NhdGlvbiA9IFtwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlLCBwb3NpdGlvbi5jb29yZHMubGF0aXR1ZGVdXG4gICAgICAgIHJldHVybiAkc2NvcGUuY3VycmVudExvY2F0aW9uOyAgIFxuICAgIH1cblxuICAgICRzY29wZS5nZXRFcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgIGlmKGVycm9yKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICRzY29wZS5nZXRMb2NhdGlvbigpO1xuXG5cbn0pXG5cblxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtZW1iZXJzT25seScsIHtcbiAgICAgICAgdXJsOiAnL21lbWJlcnMtYXJlYScsXG4gICAgICAgIHRlbXBsYXRlOiAnPGltZyBuZy1yZXBlYXQ9XCJpdGVtIGluIHN0YXNoXCIgd2lkdGg9XCIzMDBcIiBuZy1zcmM9XCJ7eyBpdGVtIH19XCIgLz4nLFxuICAgICAgICBjb250cm9sbGVyOiBmdW5jdGlvbiAoJHNjb3BlLCBTZWNyZXRTdGFzaCkge1xuICAgICAgICAgICAgU2VjcmV0U3Rhc2guZ2V0U3Rhc2goKS50aGVuKGZ1bmN0aW9uIChzdGFzaCkge1xuICAgICAgICAgICAgICAgICRzY29wZS5zdGFzaCA9IHN0YXNoO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sXG4gICAgICAgIC8vIFRoZSBmb2xsb3dpbmcgZGF0YS5hdXRoZW50aWNhdGUgaXMgcmVhZCBieSBhbiBldmVudCBsaXN0ZW5lclxuICAgICAgICAvLyB0aGF0IGNvbnRyb2xzIGFjY2VzcyB0byB0aGlzIHN0YXRlLiBSZWZlciB0byBhcHAuanMuXG4gICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgIGF1dGhlbnRpY2F0ZTogdHJ1ZVxuICAgICAgICB9XG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuZmFjdG9yeSgnU2VjcmV0U3Rhc2gnLCBmdW5jdGlvbiAoJGh0dHApIHtcblxuICAgIHZhciBnZXRTdGFzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2FwaS9tZW1iZXJzL3NlY3JldC1zdGFzaCcpLnRoZW4oZnVuY3Rpb24gKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGdldFN0YXNoOiBnZXRTdGFzaFxuICAgIH07XG5cbn0pOyIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21lc3NhZ2VzLW1hcCcsIHtcbiAgICAgICAgdXJsOiAnL21lc3NhZ2VzLW1hcC86aWQ/bG9uJmxhdCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbWVzc2FnZXMtbWFwL21lc3NhZ2VzLW1hcC5odG1sJywgXG4gICAgICAgIGNvbnRyb2xsZXI6ICdNYXBDb250cm9sbGVyJ1xuICAgIH0pO1xufSk7XG5cbmFwcC5jb25maWcoZnVuY3Rpb24odWlHbWFwR29vZ2xlTWFwQXBpUHJvdmlkZXIpIHtcbiAgICB1aUdtYXBHb29nbGVNYXBBcGlQcm92aWRlci5jb25maWd1cmUoe1xuICAgICAgICBrZXk6ICdBSXphU3lDMU10NVBhWllfWlJpMEhBRFhEbEJFc0tMN3lod21FdjQnLFxuICAgICAgICB2OiAnMy4yMCcsXG4gICAgICAgIGxpYnJhcmllczogJ3dlYXRoZXIsZ2VvbWV0cnksdmlzdWFsaXphdGlvbidcbiAgICB9KTtcbn0pXG5cbmFwcC5jb250cm9sbGVyKFwiTWFwQ29udHJvbGxlclwiLCBmdW5jdGlvbigkc2NvcGUsIHVpR21hcEdvb2dsZU1hcEFwaSwgJHN0YXRlUGFyYW1zKSB7XG4gICAgY29uc29sZS5sb2coJHN0YXRlUGFyYW1zKVxuXHQkc2NvcGUubWFwID0geyBcbiAgICAgICAgY2VudGVyOiB7IFxuICAgICAgICAgICAgLy8gbGF0aXR1ZGU6IDQwLjcxODAwMDcsIGxvbmdpdHVkZTogLTczLjk2MjA4OTQgXG4gICAgICAgICAgICBsYXRpdHVkZTogJHN0YXRlUGFyYW1zLmxhdCwgbG9uZ2l0dWRlOiAkc3RhdGVQYXJhbXMubG9uXG4gICAgICAgIH0sIFxuICAgICAgICB6b29tOiAxNCxcblxuICAgIH07XG4gICAgJHNjb3BlLm1hcmtlciA9IHtcbiAgICAgIGlkOiAwLFxuICAgICAgY29vcmRzOiB7XG4gICAgICAgIGxhdGl0dWRlOiAkc3RhdGVQYXJhbXMubGF0LFxuICAgICAgICBsb25naXR1ZGU6ICRzdGF0ZVBhcmFtcy5sb25cbiAgICAgIH1cbiAgICAgIC8vIGV2ZW50czoge1xuICAgICAgLy8gICBkcmFnZW5kOiBmdW5jdGlvbiAobWFya2VyLCBldmVudE5hbWUsIGFyZ3MpIHtcbiAgICAgIC8vICAgICAkbG9nLmxvZygnbWFya2VyIGRyYWdlbmQnKTtcbiAgICAgIC8vICAgICB2YXIgbGF0ID0gbWFya2VyLmdldFBvc2l0aW9uKCkubGF0KCk7XG4gICAgICAvLyAgICAgdmFyIGxvbiA9IG1hcmtlci5nZXRQb3NpdGlvbigpLmxuZygpO1xuICAgICAgLy8gICAgICRsb2cubG9nKGxhdCk7XG4gICAgICAvLyAgICAgJGxvZy5sb2cobG9uKTtcblxuICAgICAgLy8gICAgICRzY29wZS5tYXJrZXIub3B0aW9ucyA9IHtcbiAgICAgIC8vICAgICAgIGRyYWdnYWJsZTogdHJ1ZSxcbiAgICAgIC8vICAgICAgIGxhYmVsQ29udGVudDogXCJsYXQ6IFwiICsgJHNjb3BlLm1hcmtlci5jb29yZHMubGF0aXR1ZGUgKyAnICcgKyAnbG9uOiAnICsgJHNjb3BlLm1hcmtlci5jb29yZHMubG9uZ2l0dWRlLFxuICAgICAgLy8gICAgICAgbGFiZWxBbmNob3I6IFwiMTAwIDBcIixcbiAgICAgIC8vICAgICAgIGxhYmVsQ2xhc3M6IFwibWFya2VyLWxhYmVsc1wiXG4gICAgICAvLyAgICAgfTtcbiAgICAgIC8vICAgfVxuICAgICAgLy8gfVxuICAgIH07XG5cdFxuICAgIHVpR21hcEdvb2dsZU1hcEFwaVxuICAgIC50aGVuKGZ1bmN0aW9uKG1hcHMpIHtcbiAgICB9KTtcblxufSk7XG5cbi8qXG52YXIgbWFya2VyID0ge1xuICAgICAgICAgICAgICAgICAgICBpZDogRGF0ZS5ub3coKSxcbiAgICAgICAgICAgICAgICAgICAgY29vcmRzOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBsYXRpdHVkZTogbGF0LFxuICAgICAgICAgICAgICAgICAgICAgICAgbG9uZ2l0dWRlOiBsb25cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgJHNjb3BlLm1hcC5tYXJrZXJzLnB1c2gobWFya2VyKTtcbiovXG5cblxuXG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21lc3NhZ2VzSGVyZScsIHtcbiAgICAgICAgdXJsOiAnL21lc3NhZ2VzL3RvLzppZD9sb24mbGF0JyxcbiAgICAgICAgLy8gdXJsOiAnL21lc3NhZ2VzL2hlcmUvOmlkJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9zZWUtbXNnL3NlZS5tc2cuaHRtbCcsIFxuICAgICAgICBjb250cm9sbGVyOidNZXNzYWdlc0hlcmVDb250cm9sbGVyJywgXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgXHRhbGxNZXNzYWdlczogZnVuY3Rpb24oJHN0YXRlUGFyYW1zLCBNZXNzYWdlc0hlcmVGYWN0b3J5KSB7XG4gICAgICAgIFx0cmV0dXJuIE1lc3NhZ2VzSGVyZUZhY3RvcnkuaW5ib3hIZXJlKCRzdGF0ZVBhcmFtcy5pZCwgJHN0YXRlUGFyYW1zLmxvbiwgJHN0YXRlUGFyYW1zLmxhdClcbiAgICAgICAgXHR9XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5hcHAuZmFjdG9yeSgnTWVzc2FnZXNIZXJlRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwKSB7XG5cdFxuXHR2YXIgTWVzc2FnZXNIZXJlRmFjdG9yeSA9IHt9O1xuXG5cdE1lc3NhZ2VzSGVyZUZhY3RvcnkuaW5ib3hIZXJlID0gZnVuY3Rpb24oaWQsIGxvbiwgbGF0KSB7XG5cdFx0Y29uc29sZS5sb2cobG9uICsgXCIgXCIgKyBsYXQpO1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvbWVzc2FnZXMvdG8vJyArIGlkICsgJz9sb249JyArIGxvbiArICcmbGF0PScgKyBsYXQpXG5cdFx0LnRoZW4oZnVuY3Rpb24ocmVzKSB7XG5cdFx0XHRyZXR1cm4gcmVzLmRhdGE7XG5cdFx0fSk7XG5cdH1cblxuXHRyZXR1cm4gTWVzc2FnZXNIZXJlRmFjdG9yeTtcbn0pXG5cbmFwcC5jb250cm9sbGVyKCdNZXNzYWdlc0hlcmVDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBBdXRoU2VydmljZSwgTWVzc2FnZXNIZXJlRmFjdG9yeSwgYWxsTWVzc2FnZXMpIHtcblxuXHQkc2NvcGUuY3VycmVudFVzZXIgPSB7fTtcblxuXHRBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgJHNjb3BlLmN1cnJlbnRVc2VyID0gdXNlcjtcbiAgICB9KVxuXG5cdCRzY29wZS5hbGxNZXNzYWdlcyA9IGFsbE1lc3NhZ2VzO1xuXG59KVxuXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdub3RpZmljYXRpb25zJywge1xuICAgICAgICB1cmw6ICcvbm90aWZpY2F0aW9ucy86aWQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3NlZS1ub3RpZmljYXRpb25zL3NlZS5ub3RpZmljYXRpb25zLmh0bWwnLCBcbiAgICAgICAgY29udHJvbGxlcjogJ05vdGlmaWNhdGlvbnNDb250cm9sbGVyJyxcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICBcdGFsbE1lc3NhZ2VzOiBmdW5jdGlvbigkc3RhdGVQYXJhbXMsIE5vdGlmaWNhdGlvbnNGYWN0b3J5KSB7XG4gICAgICAgIFx0XHRyZXR1cm4gTm90aWZpY2F0aW9uc0ZhY3RvcnkuZ2V0QWxsTWVzc2FnZXMoJHN0YXRlUGFyYW1zLmlkKVxuICAgICAgICBcdH1cbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG5cbmFwcC5mYWN0b3J5KCdOb3RpZmljYXRpb25zRmFjdG9yeScsIGZ1bmN0aW9uKCRodHRwKSB7XG5cdHZhciBOb3RpZmljYXRpb25zRmFjdG9yeSA9IHt9O1xuXG5cdE5vdGlmaWNhdGlvbnNGYWN0b3J5LmdldEFsbE1lc3NhZ2VzID0gZnVuY3Rpb24oaWQpIHtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCdhcGkvbWVzc2FnZXMvdG8vYWxsLycgKyBpZClcblx0XHQudGhlbihmdW5jdGlvbihyZXMpIHtcblx0XHRcdHJldHVybiByZXMuZGF0YTtcblx0XHR9KTtcblx0fVxuXHRyZXR1cm4gTm90aWZpY2F0aW9uc0ZhY3Rvcnk7XG59KVxuXG5hcHAuY29udHJvbGxlcignTm90aWZpY2F0aW9uc0NvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsIGFsbE1lc3NhZ2VzKSB7XG5cdCAkc2NvcGUuYWxsTWVzc2FnZXMgPSBhbGxNZXNzYWdlcztcbn0pXG4iLCJhcHAuZmFjdG9yeSgnRnVsbHN0YWNrUGljcycsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gW1xuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I3Z0JYdWxDQUFBWFFjRS5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9mYmNkbi1zcGhvdG9zLWMtYS5ha2FtYWloZC5uZXQvaHBob3Rvcy1hay14YXAxL3QzMS4wLTgvMTA4NjI0NTFfMTAyMDU2MjI5OTAzNTkyNDFfODAyNzE2ODg0MzMxMjg0MTEzN19vLmpwZycsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQi1MS1VzaElnQUV5OVNLLmpwZycsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjc5LVg3b0NNQUFrdzd5LmpwZycsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQi1VajlDT0lJQUlGQWgwLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjZ5SXlGaUNFQUFxbDEyLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0UtVDc1bFdBQUFtcXFKLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0V2WkFnLVZBQUFrOTMyLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0VnTk1lT1hJQUlmRGhLLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0VReUlETldnQUF1NjBCLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0NGM1Q1UVc4QUUybEdKLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0FlVnc1U1dvQUFBTHNqLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0FhSklQN1VrQUFsSUdzLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0FRT3c5bFdFQUFZOUZsLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQi1PUWJWckNNQUFOd0lNLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjliX2Vyd0NZQUF3UmNKLnBuZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjVQVGR2bkNjQUVBbDR4LmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjRxd0MwaUNZQUFsUEdoLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjJiMzN2UklVQUE5bzFELmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQndwSXdyMUlVQUF2TzJfLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQnNTc2VBTkNZQUVPaEx3LmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0o0dkxmdVV3QUFkYTRMLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0k3d3pqRVZFQUFPUHBTLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0lkSHZUMlVzQUFubkhWLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0dDaVBfWVdZQUFvNzVWLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0lTNEpQSVdJQUkzN3F1LmpwZzpsYXJnZSdcbiAgICBdO1xufSk7XG4iLCJhcHAuZmFjdG9yeSgnUmFuZG9tR3JlZXRpbmdzJywgZnVuY3Rpb24gKCkge1xuXG5cbiAgICB2YXIgZ2V0UmFuZG9tRnJvbUFycmF5ID0gZnVuY3Rpb24gKGFycikge1xuICAgICAgICByZXR1cm4gYXJyW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpXTtcbiAgICB9O1xuXG5cbiAgICB2YXIgZ3JlZXRpbmdzID0gW1xuICAgICAgICAnSGVsbG8sIHdvcmxkIScsXG4gICAgICAgICdBdCBsb25nIGxhc3QsIEkgbGl2ZSEnLFxuICAgICAgICAnSGVsbG8sIHNpbXBsZSBodW1hbi4nLFxuICAgICAgICAnV2hhdCBhIGJlYXV0aWZ1bCBkYXkhJyxcbiAgICAgICAgJ0lcXCdtIGxpa2UgYW55IG90aGVyIHByb2plY3QsIGV4Y2VwdCB0aGF0IEkgYW0geW91cnMuIDopJyxcbiAgICAgICAgJ1RoaXMgZW1wdHkgc3RyaW5nIGlzIGZvciBMaW5kc2F5IExldmluZS4nLFxuICAgICAgICAn44GT44KT44Gr44Gh44Gv44CB44Om44O844K244O85qeY44CCJyxcbiAgICAgICAgJ1dlbGNvbWUuIFRvLiBXRUJTSVRFLicsXG4gICAgICAgICc6RCcsXG4gICAgICAgICdZZXMsIEkgdGhpbmsgd2VcXCd2ZSBtZXQgYmVmb3JlLicsXG4gICAgICAgICdHaW1tZSAzIG1pbnMuLi4gSSBqdXN0IGdyYWJiZWQgdGhpcyByZWFsbHkgZG9wZSBmcml0dGF0YScsXG4gICAgICAgICdJZiBDb29wZXIgY291bGQgb2ZmZXIgb25seSBvbmUgcGllY2Ugb2YgYWR2aWNlLCBpdCB3b3VsZCBiZSB0byBuZXZTUVVJUlJFTCEnLFxuICAgIF07XG5cbiAgICB2YXIgZ2V0TG9jYXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGdyZWV0aW5nczogZ3JlZXRpbmdzLFxuICAgICAgICBnZXRSYW5kb21HcmVldGluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFJhbmRvbUZyb21BcnJheShncmVldGluZ3MpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGdldExvY2F0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGdldExvY2F0aW9uKCk7XG4gICAgICAgIFxuICAgICAgICB9LCBcblxuXG4gICAgfTtcblxufSk7XG5cblxuXG5cblxuIiwiYXBwLmRpcmVjdGl2ZSgnbmF2YmFyJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCBBVVRIX0VWRU5UUywgJHN0YXRlKSB7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICBzY29wZToge30sXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7XG5cbiAgICAgICAgICAgIHNjb3BlLnVzZXIgPSBudWxsO1xuXG4gICAgICAgICAgICBzY29wZS5pc0xvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjb3BlLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2hvbWUnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjb3BlLmdvSG9tZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbWFpbicpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgc2V0VXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHJlbW92ZVVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IG51bGw7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzZXRVc2VyKCk7XG5cbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcywgc2V0VXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzLCByZW1vdmVVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCByZW1vdmVVc2VyKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG59KTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
