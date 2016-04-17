'use strict';
// window.app = angular.module('SpotApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate', 'uiGmapgoogle-maps']);

window.app = angular.module('SpotApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate']);

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
// app.config(function ($stateProvider) {
//     $stateProvider.state('messages-map', {
//         url: '/messages-map/:id?lon&lat',
//         templateUrl: 'js/messages-map/messages-map.html',
//         controller: 'MapController'
//     });
// });

// app.config(function(uiGmapGoogleMapApiProvider) {
//     uiGmapGoogleMapApiProvider.configure({
//         key: 'AIzaSyC1Mt5PaZY_ZRi0HADXDlBEsKL7yhwmEv4',
//         v: '3.20',
//         libraries: 'weather,geometry,visualization'
//     });
// })

// app.controller("MapController", function($scope, uiGmapGoogleMapApi, $stateParams) {
//     console.log($stateParams)
// 	$scope.map = {
//         center: {
//             latitude: $stateParams.lat, longitude: $stateParams.lon
//         },
//         zoom: 14,

//     };
//     $scope.marker = {
//       id: 0,
//       coords: {
//         latitude: $stateParams.lat,
//         longitude: $stateParams.lon
//       }
//     };

//     uiGmapGoogleMapApi
//     .then(function(maps) {
//     });

// });

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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImRvY3MvZG9jcy5qcyIsImZzYS9mc2EtcHJlLWJ1aWx0LmpzIiwiaG9tZS9ob21lLmpzIiwibGVhdmUtbWVzc2FnZS9sZWF2ZS1tZXNzYWdlLmpzIiwibG9naW4vbG9naW4uanMiLCJtYWluLXBhZ2UvbWFpbi5wYWdlLmpzIiwibWVtYmVycy1vbmx5L21lbWJlcnMtb25seS5qcyIsInNlZS1tc2cvc2VlLm1zZy5qcyIsInNlZS1ub3RpZmljYXRpb25zL3NlZS5ub3RpZmljYXRpb25zLmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9GdWxsc3RhY2tQaWNzLmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9SYW5kb21HcmVldGluZ3MuanMiLCJjb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7QUFFQSxPQUFBLEdBQUEsR0FBQSxRQUFBLE1BQUEsQ0FBQSxTQUFBLEVBQUEsQ0FBQSxhQUFBLEVBQUEsV0FBQSxFQUFBLGNBQUEsRUFBQSxXQUFBLENBQUEsQ0FBQTs7QUFHQSxJQUFBLE1BQUEsQ0FBQSxVQUFBLGtCQUFBLEVBQUEsaUJBQUEsRUFBQTs7QUFFQSxzQkFBQSxTQUFBLENBQUEsSUFBQTs7QUFGQSxzQkFJQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLEVBSkE7Q0FBQSxDQUFBOzs7QUFRQSxJQUFBLEdBQUEsQ0FBQSxVQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUEsTUFBQSxFQUFBOzs7QUFHQSxRQUFBLCtCQUFBLFNBQUEsNEJBQUEsQ0FBQSxLQUFBLEVBQUE7QUFDQSxlQUFBLE1BQUEsSUFBQSxJQUFBLE1BQUEsSUFBQSxDQUFBLFlBQUEsQ0FEQTtLQUFBOzs7O0FBSEEsY0FTQSxDQUFBLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUEsS0FBQSxFQUFBLE9BQUEsRUFBQSxRQUFBLEVBQUE7O0FBRUEsWUFBQSxDQUFBLDZCQUFBLE9BQUEsQ0FBQSxFQUFBOzs7QUFHQSxtQkFIQTtTQUFBOztB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QUEsVUFBQSxDQUFBLFFBQUEsQ0FBQSxXQUFBLEdBQUEsQ0FBQSxDQUFBLEVBQUEsQ0FBQSxDQUFBLENBREE7U0FGQTtLQURBLENBdEJBOztBQThCQSxXQUFBLFdBQUEsR0FBQSxVQUFBLFFBQUEsRUFBQTtBQUNBLGVBQUEsVUFBQSxDQUFBLFFBQUEsQ0FBQSxXQUFBLEdBQUEsQ0FBQSxTQUFBLE1BQUEsQ0FBQSxTQUFBLEVBQUEsU0FBQSxNQUFBLENBQUEsUUFBQSxDQUFBLENBREE7S0FBQSxDQTlCQTs7QUFrQ0EsV0FBQSxRQUFBLEdBQUEsVUFBQSxLQUFBLEVBQUE7QUFDQSxZQUFBLEtBQUEsRUFBQTtBQUNBLGtCQUFBLElBQUEsS0FBQSxFQUFBLENBREE7U0FBQTtLQURBLENBbENBOztBQXdDQSxXQUFBLFdBQUEsR0F4Q0E7Q0FBQSxDQUFBOztBQ25DQSxJQUFBLE1BQUEsQ0FBQSxVQUFBLGNBQUEsRUFBQTs7QUFFQSxtQkFBQSxLQUFBLENBQUEsT0FBQSxFQUFBO0FBQ0EsYUFBQSxRQUFBO0FBQ0EscUJBQUEscUJBQUE7QUFDQSxvQkFBQSxXQUFBO0tBSEEsRUFGQTtDQUFBLENBQUE7O0FBVUEsSUFBQSxVQUFBLENBQUEsV0FBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLFdBQUEsRUFBQSxNQUFBLEVBQUE7O0FBRUEsV0FBQSxLQUFBLEdBQUEsRUFBQSxDQUZBO0FBR0EsV0FBQSxLQUFBLEdBQUEsSUFBQSxDQUhBOztBQUtBLFdBQUEsU0FBQSxHQUFBLFVBQUEsU0FBQSxFQUFBOztBQUVBLGVBQUEsS0FBQSxHQUFBLElBQUEsQ0FGQTs7QUFJQSxvQkFBQSxLQUFBLENBQUEsU0FBQSxFQUFBLElBQUEsQ0FBQSxVQUFBLFdBQUEsRUFBQTtBQUNBLG1CQUFBLEVBQUEsQ0FBQSxNQUFBLEVBQUEsRUFBQSxJQUFBLFlBQUEsR0FBQSxFQUFBOztBQURBLFNBQUEsQ0FBQSxDQUdBLEtBSEEsQ0FHQSxZQUFBO0FBQ0EsbUJBQUEsS0FBQSxHQUFBLDRCQUFBLENBREE7U0FBQSxDQUhBLENBSkE7S0FBQSxDQUxB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QSxJQUFBLENBREE7YUFBQSxDQXhCQTs7QUE0QkEsc0JBNUJBOztBQThCQSx1QkFBQSxHQUFBLENBQUEsWUFBQSxZQUFBLEVBQUEsT0FBQSxFQTlCQTtBQStCQSx1QkFBQSxHQUFBLENBQUEsWUFBQSxhQUFBLEVBQUEsVUFBQSxFQS9CQTtBQWdDQSx1QkFBQSxHQUFBLENBQUEsWUFBQSxjQUFBLEVBQUEsVUFBQSxFQWhDQTtTQUFBOztLQUpBLENBRkE7Q0FBQSxDQUFBIiwiZmlsZSI6Im1haW4uanMiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG4vLyB3aW5kb3cuYXBwID0gYW5ndWxhci5tb2R1bGUoJ1Nwb3RBcHAnLCBbJ2ZzYVByZUJ1aWx0JywgJ3VpLnJvdXRlcicsICd1aS5ib290c3RyYXAnLCAnbmdBbmltYXRlJywgJ3VpR21hcGdvb2dsZS1tYXBzJ10pO1xud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdTcG90QXBwJywgWydmc2FQcmVCdWlsdCcsICd1aS5yb3V0ZXInLCAndWkuYm9vdHN0cmFwJywgJ25nQW5pbWF0ZSddKTtcblxuXG5hcHAuY29uZmlnKGZ1bmN0aW9uICgkdXJsUm91dGVyUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyKSB7XG4gICAgLy8gVGhpcyB0dXJucyBvZmYgaGFzaGJhbmcgdXJscyAoLyNhYm91dCkgYW5kIGNoYW5nZXMgaXQgdG8gc29tZXRoaW5nIG5vcm1hbCAoL2Fib3V0KVxuICAgICRsb2NhdGlvblByb3ZpZGVyLmh0bWw1TW9kZSh0cnVlKTtcbiAgICAvLyBJZiB3ZSBnbyB0byBhIFVSTCB0aGF0IHVpLXJvdXRlciBkb2Vzbid0IGhhdmUgcmVnaXN0ZXJlZCwgZ28gdG8gdGhlIFwiL1wiIHVybC5cbiAgICAkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKCcvJyk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG5cbiAgICAgICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAgICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28odG9TdGF0ZS5uYW1lLCB0b1BhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbG9naW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9KTtcblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdkb2NzJywge1xuICAgICAgICB1cmw6ICcvZG9jcycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvZG9jcy9kb2NzLmh0bWwnXG4gICAgfSk7XG59KTtcbiIsIihmdW5jdGlvbiAoKSB7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBIb3BlIHlvdSBkaWRuJ3QgZm9yZ2V0IEFuZ3VsYXIhIER1aC1kb3kuXG4gICAgaWYgKCF3aW5kb3cuYW5ndWxhcikgdGhyb3cgbmV3IEVycm9yKCdJIGNhblxcJ3QgZmluZCBBbmd1bGFyIScpO1xuXG4gICAgdmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdmc2FQcmVCdWlsdCcsIFtdKTtcblxuICAgIGFwcC5mYWN0b3J5KCdTb2NrZXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghd2luZG93LmlvKSB0aHJvdyBuZXcgRXJyb3IoJ3NvY2tldC5pbyBub3QgZm91bmQhJyk7XG4gICAgICAgIHJldHVybiB3aW5kb3cuaW8od2luZG93LmxvY2F0aW9uLm9yaWdpbik7XG4gICAgfSk7XG5cbiAgICAvLyBBVVRIX0VWRU5UUyBpcyB1c2VkIHRocm91Z2hvdXQgb3VyIGFwcCB0b1xuICAgIC8vIGJyb2FkY2FzdCBhbmQgbGlzdGVuIGZyb20gYW5kIHRvIHRoZSAkcm9vdFNjb3BlXG4gICAgLy8gZm9yIGltcG9ydGFudCBldmVudHMgYWJvdXQgYXV0aGVudGljYXRpb24gZmxvdy5cbiAgICBhcHAuY29uc3RhbnQoJ0FVVEhfRVZFTlRTJywge1xuICAgICAgICBsb2dpblN1Y2Nlc3M6ICdhdXRoLWxvZ2luLXN1Y2Nlc3MnLFxuICAgICAgICBsb2dpbkZhaWxlZDogJ2F1dGgtbG9naW4tZmFpbGVkJyxcbiAgICAgICAgbG9nb3V0U3VjY2VzczogJ2F1dGgtbG9nb3V0LXN1Y2Nlc3MnLFxuICAgICAgICBzZXNzaW9uVGltZW91dDogJ2F1dGgtc2Vzc2lvbi10aW1lb3V0JyxcbiAgICAgICAgbm90QXV0aGVudGljYXRlZDogJ2F1dGgtbm90LWF1dGhlbnRpY2F0ZWQnLFxuICAgICAgICBub3RBdXRob3JpemVkOiAnYXV0aC1ub3QtYXV0aG9yaXplZCdcbiAgICB9KTtcblxuICAgIGFwcC5mYWN0b3J5KCdBdXRoSW50ZXJjZXB0b3InLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHEsIEFVVEhfRVZFTlRTKSB7XG4gICAgICAgIHZhciBzdGF0dXNEaWN0ID0ge1xuICAgICAgICAgICAgNDAxOiBBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLFxuICAgICAgICAgICAgNDAzOiBBVVRIX0VWRU5UUy5ub3RBdXRob3JpemVkLFxuICAgICAgICAgICAgNDE5OiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCxcbiAgICAgICAgICAgIDQ0MDogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXRcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJlc3BvbnNlRXJyb3I6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChzdGF0dXNEaWN0W3Jlc3BvbnNlLnN0YXR1c10sIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgYXBwLmNvbmZpZyhmdW5jdGlvbiAoJGh0dHBQcm92aWRlcikge1xuICAgICAgICAkaHR0cFByb3ZpZGVyLmludGVyY2VwdG9ycy5wdXNoKFtcbiAgICAgICAgICAgICckaW5qZWN0b3InLFxuICAgICAgICAgICAgZnVuY3Rpb24gKCRpbmplY3Rvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiAkaW5qZWN0b3IuZ2V0KCdBdXRoSW50ZXJjZXB0b3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXSk7XG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnQXV0aFNlcnZpY2UnLCBmdW5jdGlvbiAoJGh0dHAsIFNlc3Npb24sICRyb290U2NvcGUsIEFVVEhfRVZFTlRTLCAkcSkge1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uU3VjY2Vzc2Z1bExvZ2luKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZShkYXRhLmlkLCBkYXRhLnVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcyk7XG4gICAgICAgICAgICByZXR1cm4gZGF0YS51c2VyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlcyB0aGUgc2Vzc2lvbiBmYWN0b3J5IHRvIHNlZSBpZiBhblxuICAgICAgICAvLyBhdXRoZW50aWNhdGVkIHVzZXIgaXMgY3VycmVudGx5IHJlZ2lzdGVyZWQuXG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhU2Vzc2lvbi51c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyID0gZnVuY3Rpb24gKGZyb21TZXJ2ZXIpIHtcblxuICAgICAgICAgICAgLy8gSWYgYW4gYXV0aGVudGljYXRlZCBzZXNzaW9uIGV4aXN0cywgd2VcbiAgICAgICAgICAgIC8vIHJldHVybiB0aGUgdXNlciBhdHRhY2hlZCB0byB0aGF0IHNlc3Npb25cbiAgICAgICAgICAgIC8vIHdpdGggYSBwcm9taXNlLiBUaGlzIGVuc3VyZXMgdGhhdCB3ZSBjYW5cbiAgICAgICAgICAgIC8vIGFsd2F5cyBpbnRlcmZhY2Ugd2l0aCB0aGlzIG1ldGhvZCBhc3luY2hyb25vdXNseS5cblxuICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgaWYgdHJ1ZSBpcyBnaXZlbiBhcyB0aGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIsXG4gICAgICAgICAgICAvLyB0aGVuIHRoaXMgY2FjaGVkIHZhbHVlIHdpbGwgbm90IGJlIHVzZWQuXG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCgpICYmIGZyb21TZXJ2ZXIgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEud2hlbihTZXNzaW9uLnVzZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNYWtlIHJlcXVlc3QgR0VUIC9zZXNzaW9uLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIHVzZXIsIGNhbGwgb25TdWNjZXNzZnVsTG9naW4gd2l0aCB0aGUgcmVzcG9uc2UuXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgNDAxIHJlc3BvbnNlLCB3ZSBjYXRjaCBpdCBhbmQgaW5zdGVhZCByZXNvbHZlIHRvIG51bGwuXG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nZXRVc2VySWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdXNlci5faWRcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgICAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdTZXNzaW9uJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEFVVEhfRVZFTlRTKSB7XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuaWQgPSBudWxsO1xuICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlID0gZnVuY3Rpb24gKHNlc3Npb25JZCwgdXNlcikge1xuICAgICAgICAgICAgdGhpcy5pZCA9IHNlc3Npb25JZDtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IHVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbn0pKCk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2hvbWUnLCB7XG4gICAgICAgIHVybDogJy8nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2hvbWUvaG9tZS5odG1sJ1xuICAgIH0pO1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsZWF2ZU1lc3NhZ2UnLCB7XG4gICAgICAgIHVybDogJy9sZWF2ZW1lc3NhZ2UvOmlkJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sZWF2ZS1tZXNzYWdlL2xlYXZlLW1lc3NhZ2UuaHRtbCcsIFxuICAgICAgICBjb250cm9sbGVyOiBcIkxlYXZlTWVzc2FnZUNvbnRyb2xsZXJcIixcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICBcdGFsbEZyaWVuZHM6IGZ1bmN0aW9uICgkc3RhdGVQYXJhbXMsIExlYXZlTWVzc2FnZUZhY3RvcnkpIHtcbiAgICAgICAgXHRcdHJldHVybiBMZWF2ZU1lc3NhZ2VGYWN0b3J5LmdldEZyaWVuZHMoJHN0YXRlUGFyYW1zLmlkKTtcbiAgICAgICAgXHR9XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5hcHAuZmFjdG9yeShcIkxlYXZlTWVzc2FnZUZhY3RvcnlcIiwgZnVuY3Rpb24oJGh0dHApIHtcblxuXHR2YXIgTGVhdmVNZXNzYWdlRmFjdG9yeSA9IHt9O1xuXG5cdExlYXZlTWVzc2FnZUZhY3RvcnkuZ2V0RnJpZW5kcyA9IGZ1bmN0aW9uKGlkKSB7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS91c2Vycy8nICsgaWQgKyAnL2ZyaWVuZHMnKVxuIFx0XHQudGhlbihmdW5jdGlvbihyZXMpe1xuIFx0XHRcdHJldHVybiByZXMuZGF0YTtcbiBcdFx0fSk7XG5cdH07XG5cblx0TGVhdmVNZXNzYWdlRmFjdG9yeS5sZWF2ZU1lc3NhZ2UgPSBmdW5jdGlvbihuZXdNc2cpIHtcblx0XHRyZXR1cm4gJGh0dHAucG9zdCgnL2FwaS9tZXNzYWdlcycsIG5ld01zZylcblx0XHQudGhlbihmdW5jdGlvbihyZXMpIHtcblx0XHRcdGNvbnNvbGUubG9nKFwicmVzIFwiLCByZXMpXG5cdFx0XHRyZXR1cm4gcmVzLmRhdGE7XG5cdFx0fSlcblx0fTtcblxuXHRyZXR1cm4gTGVhdmVNZXNzYWdlRmFjdG9yeTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignTGVhdmVNZXNzYWdlQ29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgJHN0YXRlLCBBdXRoU2VydmljZSwgYWxsRnJpZW5kcywgTGVhdmVNZXNzYWdlRmFjdG9yeSkge1xuXHQkc2NvcGUuY3VycmVudFVzZXIgPSB7fTtcblxuXHQkc2NvcGUubmV3TWVzc2FnZSA9IHtcblx0XHRsb2NhdGlvbjoge1xuXHRcdFx0Y29vcmRpbmF0ZXM6IFtdXG5cdFx0fVxuXHR9O1xuXG5cdEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG5cdC50aGVuKGZ1bmN0aW9uKHVzZXIpIHtcblx0XHQkc2NvcGUuY3VycmVudFVzZXIgPSB1c2VyO1xuXHRcdCRzY29wZS5uZXdNZXNzYWdlLmZyb20gPSAkc2NvcGUuY3VycmVudFVzZXIuX2lkXG5cdH0pXG5cblx0JHNjb3BlLmFsbEZyaWVuZHMgPSBhbGxGcmllbmRzO1xuXG5cdCRzY29wZS5sZWF2ZU1lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcblx0XHRMZWF2ZU1lc3NhZ2VGYWN0b3J5LmxlYXZlTWVzc2FnZShtc2cpXG5cdFx0JHN0YXRlLmdvKCdtYWluJylcblx0fTtcblxuXHQkc2NvcGUuZ2V0TG9jYXRpb24gPSBmdW5jdGlvbigpIHtcblx0ICBpZiAobmF2aWdhdG9yLmdlb2xvY2F0aW9uKSB7XG5cdCAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKCRzY29wZS5nZXRQb3NpdGlvbiwgJHNjb3BlLmdldEVycm9yKTtcblx0ICB9IGVsc2Uge1xuXHQgICAgJHNjb3BlLm5ld01lc3NhZ2UubG9jYXRpb24uY29vcmRpbmF0ZXMgPSBbMCwgMF07XG5cdCAgfVxuXHR9XG5cblx0JHNjb3BlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiBcdFx0JHNjb3BlLm5ld01lc3NhZ2UubG9jYXRpb24uY29vcmRpbmF0ZXMgPSBbcG9zaXRpb24uY29vcmRzLmxvbmdpdHVkZSwgcG9zaXRpb24uY29vcmRzLmxhdGl0dWRlXVxuIFx0fVxuXG4gXHQkc2NvcGUuZ2V0RXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xuIFx0XHRpZihlcnJvcikge1xuIFx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuIFx0XHR9XG4gXHR9XG5cbiBcdCRzY29wZS5nZXRMb2NhdGlvbigpO1xuXHRcblxufSlcblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2xvZ2luJywge1xuICAgICAgICB1cmw6ICcvbG9naW4nLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2xvZ2luL2xvZ2luLmh0bWwnLFxuICAgICAgICBjb250cm9sbGVyOiAnTG9naW5DdHJsJ1xuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0xvZ2luQ3RybCcsIGZ1bmN0aW9uICgkc2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgICRzY29wZS5sb2dpbiA9IHt9O1xuICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAkc2NvcGUuc2VuZExvZ2luID0gZnVuY3Rpb24gKGxvZ2luSW5mbykge1xuXG4gICAgICAgICRzY29wZS5lcnJvciA9IG51bGw7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UubG9naW4obG9naW5JbmZvKS50aGVuKGZ1bmN0aW9uIChjdXJyZW50VXNlcikge1xuICAgICAgICAgICAgJHN0YXRlLmdvKCdtYWluJywge2lkOiBjdXJyZW50VXNlci5faWR9KTtcbiAgICAgICAgICAgIC8vICRzdGF0ZS5nbygnaG9tZScsIHtpZDogY3VycmVudFVzZXIuX2lkfSk7XG4gICAgICAgIH0pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICRzY29wZS5lcnJvciA9ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLic7XG4gICAgICAgIH0pO1xuXG4gICAgfTtcblxufSk7IiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWFpbicsIHtcbiAgICAgICAgdXJsOiAnL21haW4vOmlkJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9tYWluLXBhZ2UvbWFpbi5wYWdlLmh0bWwnLCBcbiAgICAgICAgY29udHJvbGxlcjogJ01haW5QYWdlQ29udHJvbGxlcidcbiAgICB9KTtcbn0pO1xuXG5hcHAuY29udHJvbGxlcignTWFpblBhZ2VDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBBdXRoU2VydmljZSkge1xuICAgICRzY29wZS5jdXJyZW50VXNlciA9IHt9O1xuICAgICRzY29wZS5jdXJyZW50TG9jYXRpb24gPSBbXTtcblxuICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgLnRoZW4oZnVuY3Rpb24odXNlcikge1xuICAgICAgICAkc2NvcGUuY3VycmVudFVzZXIgPSB1c2VyO1xuICAgIH0pXG5cbiAgICAkc2NvcGUuZ2V0TG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICAgIGlmIChuYXZpZ2F0b3IuZ2VvbG9jYXRpb24pIHtcbiAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbigkc2NvcGUuZ2V0UG9zaXRpb24sICRzY29wZS5nZXRFcnJvcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAkc2NvcGUuY3VycmVudExvY2F0aW9uID0gWzAsIDBdO1xuICAgICAgfVxuICAgIH1cblxuICAgICRzY29wZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50TG9jYXRpb24gPSBbcG9zaXRpb24uY29vcmRzLmxvbmdpdHVkZSwgcG9zaXRpb24uY29vcmRzLmxhdGl0dWRlXVxuICAgICAgICByZXR1cm4gJHNjb3BlLmN1cnJlbnRMb2NhdGlvbjsgICBcbiAgICB9XG5cbiAgICAkc2NvcGUuZ2V0RXJyb3IgPSBmdW5jdGlvbihlcnJvcikge1xuICAgICAgICBpZihlcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAkc2NvcGUuZ2V0TG9jYXRpb24oKTtcblxuXG59KVxuXG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWVtYmVyc09ubHknLCB7XG4gICAgICAgIHVybDogJy9tZW1iZXJzLWFyZWEnLFxuICAgICAgICB0ZW1wbGF0ZTogJzxpbWcgbmctcmVwZWF0PVwiaXRlbSBpbiBzdGFzaFwiIHdpZHRoPVwiMzAwXCIgbmctc3JjPVwie3sgaXRlbSB9fVwiIC8+JyxcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24gKCRzY29wZSwgU2VjcmV0U3Rhc2gpIHtcbiAgICAgICAgICAgIFNlY3JldFN0YXNoLmdldFN0YXNoKCkudGhlbihmdW5jdGlvbiAoc3Rhc2gpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUuc3Rhc2ggPSBzdGFzaDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICAvLyBUaGUgZm9sbG93aW5nIGRhdGEuYXV0aGVudGljYXRlIGlzIHJlYWQgYnkgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgLy8gdGhhdCBjb250cm9scyBhY2Nlc3MgdG8gdGhpcyBzdGF0ZS4gUmVmZXIgdG8gYXBwLmpzLlxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBhdXRoZW50aWNhdGU6IHRydWVcbiAgICAgICAgfVxuICAgIH0pO1xuXG59KTtcblxuYXBwLmZhY3RvcnkoJ1NlY3JldFN0YXNoJywgZnVuY3Rpb24gKCRodHRwKSB7XG5cbiAgICB2YXIgZ2V0U3Rhc2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvbWVtYmVycy9zZWNyZXQtc3Rhc2gnKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZXRTdGFzaDogZ2V0U3Rhc2hcbiAgICB9O1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtZXNzYWdlc0hlcmUnLCB7XG4gICAgICAgIHVybDogJy9tZXNzYWdlcy90by86aWQ/bG9uJmxhdCcsXG4gICAgICAgIC8vIHVybDogJy9tZXNzYWdlcy9oZXJlLzppZCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvc2VlLW1zZy9zZWUubXNnLmh0bWwnLCBcbiAgICAgICAgY29udHJvbGxlcjonTWVzc2FnZXNIZXJlQ29udHJvbGxlcicsIFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgIFx0YWxsTWVzc2FnZXM6IGZ1bmN0aW9uKCRzdGF0ZVBhcmFtcywgTWVzc2FnZXNIZXJlRmFjdG9yeSkge1xuICAgICAgICBcdHJldHVybiBNZXNzYWdlc0hlcmVGYWN0b3J5LmluYm94SGVyZSgkc3RhdGVQYXJhbXMuaWQsICRzdGF0ZVBhcmFtcy5sb24sICRzdGF0ZVBhcmFtcy5sYXQpXG4gICAgICAgIFx0fVxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLmZhY3RvcnkoJ01lc3NhZ2VzSGVyZUZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCkge1xuXHRcblx0dmFyIE1lc3NhZ2VzSGVyZUZhY3RvcnkgPSB7fTtcblxuXHRNZXNzYWdlc0hlcmVGYWN0b3J5LmluYm94SGVyZSA9IGZ1bmN0aW9uKGlkLCBsb24sIGxhdCkge1xuXHRcdGNvbnNvbGUubG9nKGxvbiArIFwiIFwiICsgbGF0KTtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL21lc3NhZ2VzL3RvLycgKyBpZCArICc/bG9uPScgKyBsb24gKyAnJmxhdD0nICsgbGF0KVxuXHRcdC50aGVuKGZ1bmN0aW9uKHJlcykge1xuXHRcdFx0cmV0dXJuIHJlcy5kYXRhO1xuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIE1lc3NhZ2VzSGVyZUZhY3Rvcnk7XG59KVxuXG5hcHAuY29udHJvbGxlcignTWVzc2FnZXNIZXJlQ29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgQXV0aFNlcnZpY2UsIE1lc3NhZ2VzSGVyZUZhY3RvcnksIGFsbE1lc3NhZ2VzKSB7XG5cblx0JHNjb3BlLmN1cnJlbnRVc2VyID0ge307XG5cblx0QXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50VXNlciA9IHVzZXI7XG4gICAgfSlcblxuXHQkc2NvcGUuYWxsTWVzc2FnZXMgPSBhbGxNZXNzYWdlcztcblxufSlcblxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbm90aWZpY2F0aW9ucycsIHtcbiAgICAgICAgdXJsOiAnL25vdGlmaWNhdGlvbnMvOmlkJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9zZWUtbm90aWZpY2F0aW9ucy9zZWUubm90aWZpY2F0aW9ucy5odG1sJywgXG4gICAgICAgIGNvbnRyb2xsZXI6ICdOb3RpZmljYXRpb25zQ29udHJvbGxlcicsXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgXHRhbGxNZXNzYWdlczogZnVuY3Rpb24oJHN0YXRlUGFyYW1zLCBOb3RpZmljYXRpb25zRmFjdG9yeSkge1xuICAgICAgICBcdFx0cmV0dXJuIE5vdGlmaWNhdGlvbnNGYWN0b3J5LmdldEFsbE1lc3NhZ2VzKCRzdGF0ZVBhcmFtcy5pZClcbiAgICAgICAgXHR9XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5hcHAuZmFjdG9yeSgnTm90aWZpY2F0aW9uc0ZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCkge1xuXHR2YXIgTm90aWZpY2F0aW9uc0ZhY3RvcnkgPSB7fTtcblxuXHROb3RpZmljYXRpb25zRmFjdG9yeS5nZXRBbGxNZXNzYWdlcyA9IGZ1bmN0aW9uKGlkKSB7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnYXBpL21lc3NhZ2VzL3RvL2FsbC8nICsgaWQpXG5cdFx0LnRoZW4oZnVuY3Rpb24ocmVzKSB7XG5cdFx0XHRyZXR1cm4gcmVzLmRhdGE7XG5cdFx0fSk7XG5cdH1cblx0cmV0dXJuIE5vdGlmaWNhdGlvbnNGYWN0b3J5O1xufSlcblxuYXBwLmNvbnRyb2xsZXIoJ05vdGlmaWNhdGlvbnNDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBhbGxNZXNzYWdlcykge1xuXHQgJHNjb3BlLmFsbE1lc3NhZ2VzID0gYWxsTWVzc2FnZXM7XG59KVxuIiwiYXBwLmZhY3RvcnkoJ0Z1bGxzdGFja1BpY3MnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CN2dCWHVsQ0FBQVhRY0UuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vZmJjZG4tc3Bob3Rvcy1jLWEuYWthbWFpaGQubmV0L2hwaG90b3MtYWsteGFwMS90MzEuMC04LzEwODYyNDUxXzEwMjA1NjIyOTkwMzU5MjQxXzgwMjcxNjg4NDMzMTI4NDExMzdfby5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItTEtVc2hJZ0FFeTlTSy5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I3OS1YN29DTUFBa3c3eS5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItVWo5Q09JSUFJRkFoMC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I2eUl5RmlDRUFBcWwxMi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFLVQ3NWxXQUFBbXFxSi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFdlpBZy1WQUFBazkzMi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFZ05NZU9YSUFJZkRoSy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFUXlJRE5XZ0FBdTYwQi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NDRjNUNVFXOEFFMmxHSi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBZVZ3NVNXb0FBQUxzai5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBYUpJUDdVa0FBbElHcy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBUU93OWxXRUFBWTlGbC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItT1FiVnJDTUFBTndJTS5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I5Yl9lcndDWUFBd1JjSi5wbmc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I1UFRkdm5DY0FFQWw0eC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I0cXdDMGlDWUFBbFBHaC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0IyYjMzdlJJVUFBOW8xRC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0J3cEl3cjFJVUFBdk8yXy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0JzU3NlQU5DWUFFT2hMdy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NKNHZMZnVVd0FBZGE0TC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJN3d6akVWRUFBT1BwUy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJZEh2VDJVc0FBbm5IVi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NHQ2lQX1lXWUFBbzc1Vi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJUzRKUElXSUFJMzdxdS5qcGc6bGFyZ2UnXG4gICAgXTtcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1JhbmRvbUdyZWV0aW5ncycsIGZ1bmN0aW9uICgpIHtcblxuXG4gICAgdmFyIGdldFJhbmRvbUZyb21BcnJheSA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgcmV0dXJuIGFycltNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKV07XG4gICAgfTtcblxuXG4gICAgdmFyIGdyZWV0aW5ncyA9IFtcbiAgICAgICAgJ0hlbGxvLCB3b3JsZCEnLFxuICAgICAgICAnQXQgbG9uZyBsYXN0LCBJIGxpdmUhJyxcbiAgICAgICAgJ0hlbGxvLCBzaW1wbGUgaHVtYW4uJyxcbiAgICAgICAgJ1doYXQgYSBiZWF1dGlmdWwgZGF5IScsXG4gICAgICAgICdJXFwnbSBsaWtlIGFueSBvdGhlciBwcm9qZWN0LCBleGNlcHQgdGhhdCBJIGFtIHlvdXJzLiA6KScsXG4gICAgICAgICdUaGlzIGVtcHR5IHN0cmluZyBpcyBmb3IgTGluZHNheSBMZXZpbmUuJyxcbiAgICAgICAgJ+OBk+OCk+OBq+OBoeOBr+OAgeODpuODvOOCtuODvOanmOOAgicsXG4gICAgICAgICdXZWxjb21lLiBUby4gV0VCU0lURS4nLFxuICAgICAgICAnOkQnLFxuICAgICAgICAnWWVzLCBJIHRoaW5rIHdlXFwndmUgbWV0IGJlZm9yZS4nLFxuICAgICAgICAnR2ltbWUgMyBtaW5zLi4uIEkganVzdCBncmFiYmVkIHRoaXMgcmVhbGx5IGRvcGUgZnJpdHRhdGEnLFxuICAgICAgICAnSWYgQ29vcGVyIGNvdWxkIG9mZmVyIG9ubHkgb25lIHBpZWNlIG9mIGFkdmljZSwgaXQgd291bGQgYmUgdG8gbmV2U1FVSVJSRUwhJyxcbiAgICBdO1xuXG4gICAgdmFyIGdldExvY2F0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBncmVldGluZ3M6IGdyZWV0aW5ncyxcbiAgICAgICAgZ2V0UmFuZG9tR3JlZXRpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRSYW5kb21Gcm9tQXJyYXkoZ3JlZXRpbmdzKTtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXRMb2NhdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBnZXRMb2NhdGlvbigpO1xuICAgICAgICBcbiAgICAgICAgfSwgXG5cblxuICAgIH07XG5cbn0pO1xuXG5cblxuXG5cbiIsImFwcC5kaXJlY3RpdmUoJ25hdmJhcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgQVVUSF9FVkVOVFMsICRzdGF0ZSkge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgc2NvcGU6IHt9LFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuXG4gICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcblxuICAgICAgICAgICAgc2NvcGUuaXNMb2dnZWRJbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY29wZS5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UubG9nb3V0KCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY29wZS5nb0hvbWUgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ21haW4nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdmFyIHNldFVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgICAgICAgICBzY29wZS51c2VyID0gdXNlcjtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciByZW1vdmVVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNjb3BlLnVzZXIgPSBudWxsO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc2V0VXNlcigpO1xuXG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MsIHNldFVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9nb3V0U3VjY2VzcywgcmVtb3ZlVXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgcmVtb3ZlVXNlcik7XG5cbiAgICAgICAgfVxuXG4gICAgfTtcblxufSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
