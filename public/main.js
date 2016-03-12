'use strict';

window.app = angular.module('FullstackGeneratedApp', ['fsaPreBuilt', 'ui.router', 'ui.bootstrap', 'ngAnimate']);

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
                    $state.go('login');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImRvY3MvZG9jcy5qcyIsImZzYS9mc2EtcHJlLWJ1aWx0LmpzIiwibGVhdmUtbWVzc2FnZS9sZWF2ZS1tZXNzYWdlLmpzIiwibG9naW4vbG9naW4uanMiLCJtYWluLXBhZ2UvbWFpbi5wYWdlLmpzIiwibWVtYmVycy1vbmx5L21lbWJlcnMtb25seS5qcyIsInNlZS1tc2cvc2VlLm1zZy5qcyIsInNlZS1ub3RpZmljYXRpb25zL3NlZS5ub3RpZmljYXRpb25zLmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9GdWxsc3RhY2tQaWNzLmpzIiwiY29tbW9uL2ZhY3Rvcmllcy9SYW5kb21HcmVldGluZ3MuanMiLCJjb21tb24vZGlyZWN0aXZlcy9uYXZiYXIvbmF2YmFyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOztBQUNBLE9BQUEsR0FBQSxHQUFBLFFBQUEsTUFBQSxDQUFBLHVCQUFBLEVBQUEsQ0FBQSxhQUFBLEVBQUEsV0FBQSxFQUFBLGNBQUEsRUFBQSxXQUFBLENBQUEsQ0FBQTs7QUFFQSxJQUFBLE1BQUEsQ0FBQSxVQUFBLGtCQUFBLEVBQUEsaUJBQUEsRUFBQTs7QUFFQSxzQkFBQSxTQUFBLENBQUEsSUFBQTs7QUFGQSxzQkFJQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLEVBSkE7Q0FBQSxDQUFBOzs7QUFRQSxJQUFBLEdBQUEsQ0FBQSxVQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUEsTUFBQSxFQUFBOzs7QUFHQSxRQUFBLCtCQUFBLFNBQUEsNEJBQUEsQ0FBQSxLQUFBLEVBQUE7QUFDQSxlQUFBLE1BQUEsSUFBQSxJQUFBLE1BQUEsSUFBQSxDQUFBLFlBQUEsQ0FEQTtLQUFBOzs7O0FBSEEsY0FTQSxDQUFBLEdBQUEsQ0FBQSxtQkFBQSxFQUFBLFVBQUEsS0FBQSxFQUFBLE9BQUEsRUFBQSxRQUFBLEVBQUE7O0FBRUEsWUFBQSxDQUFBLDZCQUFBLE9BQUEsQ0FBQSxFQUFBOzs7QUFHQSxtQkFIQTtTQUFBOztBQU1BLFlBQUEsWUFBQSxlQUFBLEVBQUEsRUFBQTs7O0FBR0EsbUJBSEE7U0FBQTs7O0FBUkEsYUFlQSxDQUFBLGNBQUEsR0FmQTs7QUFpQkEsb0JBQUEsZUFBQSxHQUFBLElBQUEsQ0FBQSxVQUFBLElBQUEsRUFBQTs7OztBQUlBLGdCQUFBLElBQUEsRUFBQTtBQUNBLHVCQUFBLEVBQUEsQ0FBQSxRQUFBLElBQUEsRUFBQSxRQUFBLEVBREE7YUFBQSxNQUVBO0FBQ0EsdUJBQUEsRUFBQSxDQUFBLE9BQUEsRUFEQTthQUZBO1NBSkEsQ0FBQSxDQWpCQTtLQUFBLENBQUEsQ0FUQTtDQUFBLENBQUE7O0FDWEEsSUFBQSxNQUFBLENBQUEsVUFBQSxjQUFBLEVBQUE7QUFDQSxtQkFBQSxLQUFBLENBQUEsTUFBQSxFQUFBO0FBQ0EsYUFBQSxPQUFBO0FBQ0EscUJBQUEsbUJBQUE7S0FGQSxFQURBO0NBQUEsQ0FBQTs7QUNBQSxDQUFBLFlBQUE7O0FBRUE7OztBQUZBO0FBS0EsUUFBQSxDQUFBLE9BQUEsT0FBQSxFQUFBLE1BQUEsSUFBQSxLQUFBLENBQUEsd0JBQUEsQ0FBQSxDQUFBOztBQUVBLFFBQUEsTUFBQSxRQUFBLE1BQUEsQ0FBQSxhQUFBLEVBQUEsRUFBQSxDQUFBLENBUEE7O0FBU0EsUUFBQSxPQUFBLENBQUEsUUFBQSxFQUFBLFlBQUE7QUFDQSxZQUFBLENBQUEsT0FBQSxFQUFBLEVBQUEsTUFBQSxJQUFBLEtBQUEsQ0FBQSxzQkFBQSxDQUFBLENBQUE7QUFDQSxlQUFBLE9BQUEsRUFBQSxDQUFBLE9BQUEsUUFBQSxDQUFBLE1BQUEsQ0FBQSxDQUZBO0tBQUEsQ0FBQTs7Ozs7QUFUQSxPQWlCQSxDQUFBLFFBQUEsQ0FBQSxhQUFBLEVBQUE7QUFDQSxzQkFBQSxvQkFBQTtBQUNBLHFCQUFBLG1CQUFBO0FBQ0EsdUJBQUEscUJBQUE7QUFDQSx3QkFBQSxzQkFBQTtBQUNBLDBCQUFBLHdCQUFBO0FBQ0EsdUJBQUEscUJBQUE7S0FOQSxFQWpCQTs7QUEwQkEsUUFBQSxPQUFBLENBQUEsaUJBQUEsRUFBQSxVQUFBLFVBQUEsRUFBQSxFQUFBLEVBQUEsV0FBQSxFQUFBO0FBQ0EsWUFBQSxhQUFBO0FBQ0EsaUJBQUEsWUFBQSxnQkFBQTtBQUNBLGlCQUFBLFlBQUEsYUFBQTtBQUNBLGlCQUFBLFlBQUEsY0FBQTtBQUNBLGlCQUFBLFlBQUEsY0FBQTtTQUpBLENBREE7QUFPQSxlQUFBO0FBQ0EsMkJBQUEsdUJBQUEsUUFBQSxFQUFBO0FBQ0EsMkJBQUEsVUFBQSxDQUFBLFdBQUEsU0FBQSxNQUFBLENBQUEsRUFBQSxRQUFBLEVBREE7QUFFQSx1QkFBQSxHQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsQ0FGQTthQUFBO1NBREEsQ0FQQTtLQUFBLENBQUEsQ0ExQkE7O0FBeUNBLFFBQUEsTUFBQSxDQUFBLFVBQUEsYUFBQSxFQUFBO0FBQ0Esc0JBQUEsWUFBQSxDQUFBLElBQUEsQ0FBQSxDQUNBLFdBREEsRUFFQSxVQUFBLFNBQUEsRUFBQTtBQUNBLG1CQUFBLFVBQUEsR0FBQSxDQUFBLGlCQUFBLENBQUEsQ0FEQTtTQUFBLENBRkEsRUFEQTtLQUFBLENBQUEsQ0F6Q0E7O0FBa0RBLFFBQUEsT0FBQSxDQUFBLGFBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxPQUFBLEVBQUEsVUFBQSxFQUFBLFdBQUEsRUFBQSxFQUFBLEVBQUE7O0FBRUEsaUJBQUEsaUJBQUEsQ0FBQSxRQUFBLEVBQUE7QUFDQSxnQkFBQSxPQUFBLFNBQUEsSUFBQSxDQURBO0FBRUEsb0JBQUEsTUFBQSxDQUFBLEtBQUEsRUFBQSxFQUFBLEtBQUEsSUFBQSxDQUFBLENBRkE7QUFHQSx1QkFBQSxVQUFBLENBQUEsWUFBQSxZQUFBLENBQUEsQ0FIQTtBQUlBLG1CQUFBLEtBQUEsSUFBQSxDQUpBO1NBQUE7Ozs7QUFGQSxZQVdBLENBQUEsZUFBQSxHQUFBLFlBQUE7QUFDQSxtQkFBQSxDQUFBLENBQUEsUUFBQSxJQUFBLENBREE7U0FBQSxDQVhBOztBQWVBLGFBQUEsZUFBQSxHQUFBLFVBQUEsVUFBQSxFQUFBOzs7Ozs7Ozs7O0FBVUEsZ0JBQUEsS0FBQSxlQUFBLE1BQUEsZUFBQSxJQUFBLEVBQUE7QUFDQSx1QkFBQSxHQUFBLElBQUEsQ0FBQSxRQUFBLElBQUEsQ0FBQSxDQURBO2FBQUE7Ozs7O0FBVkEsbUJBaUJBLE1BQUEsR0FBQSxDQUFBLFVBQUEsRUFBQSxJQUFBLENBQUEsaUJBQUEsRUFBQSxLQUFBLENBQUEsWUFBQTtBQUNBLHVCQUFBLElBQUEsQ0FEQTthQUFBLENBQUEsQ0FqQkE7U0FBQSxDQWZBOztBQXNDQSxhQUFBLFNBQUEsR0FBQSxZQUFBO0FBQ0EsaUJBQUEsZUFBQSxHQUNBLElBREEsQ0FDQSxVQUFBLElBQUEsRUFBQTtBQUNBLHVCQUFBLEtBQUEsR0FBQSxDQURBO2FBQUEsQ0FEQSxDQURBO1NBQUEsQ0F0Q0E7O0FBNkNBLGFBQUEsS0FBQSxHQUFBLFVBQUEsV0FBQSxFQUFBO0FBQ0EsbUJBQUEsTUFBQSxJQUFBLENBQUEsUUFBQSxFQUFBLFdBQUEsRUFDQSxJQURBLENBQ0EsaUJBREEsRUFFQSxLQUZBLENBRUEsWUFBQTtBQUNBLHVCQUFBLEdBQUEsTUFBQSxDQUFBLEVBQUEsU0FBQSw0QkFBQSxFQUFBLENBQUEsQ0FEQTthQUFBLENBRkEsQ0FEQTtTQUFBLENBN0NBOztBQXFEQSxhQUFBLE1BQUEsR0FBQSxZQUFBO0FBQ0EsbUJBQUEsTUFBQSxHQUFBLENBQUEsU0FBQSxFQUFBLElBQUEsQ0FBQSxZQUFBO0FBQ0Esd0JBQUEsT0FBQSxHQURBO0FBRUEsMkJBQUEsVUFBQSxDQUFBLFlBQUEsYUFBQSxDQUFBLENBRkE7YUFBQSxDQUFBLENBREE7U0FBQSxDQXJEQTtLQUFBLENBQUEsQ0FsREE7O0FBZ0hBLFFBQUEsT0FBQSxDQUFBLFNBQUEsRUFBQSxVQUFBLFVBQUEsRUFBQSxXQUFBLEVBQUE7O0FBRUEsWUFBQSxPQUFBLElBQUEsQ0FGQTs7QUFJQSxtQkFBQSxHQUFBLENBQUEsWUFBQSxnQkFBQSxFQUFBLFlBQUE7QUFDQSxpQkFBQSxPQUFBLEdBREE7U0FBQSxDQUFBLENBSkE7O0FBUUEsbUJBQUEsR0FBQSxDQUFBLFlBQUEsY0FBQSxFQUFBLFlBQUE7QUFDQSxpQkFBQSxPQUFBLEdBREE7U0FBQSxDQUFBLENBUkE7O0FBWUEsYUFBQSxFQUFBLEdBQUEsSUFBQSxDQVpBO0FBYUEsYUFBQSxJQUFBLEdBQUEsSUFBQSxDQWJBOztBQWVBLGFBQUEsTUFBQSxHQUFBLFVBQUEsU0FBQSxFQUFBLElBQUEsRUFBQTtBQUNBLGlCQUFBLEVBQUEsR0FBQSxTQUFBLENBREE7QUFFQSxpQkFBQSxJQUFBLEdBQUEsSUFBQSxDQUZBO1NBQUEsQ0FmQTs7QUFvQkEsYUFBQSxPQUFBLEdBQUEsWUFBQTtBQUNBLGlCQUFBLEVBQUEsR0FBQSxJQUFBLENBREE7QUFFQSxpQkFBQSxJQUFBLEdBQUEsSUFBQSxDQUZBO1NBQUEsQ0FwQkE7S0FBQSxDQUFBLENBaEhBO0NBQUEsQ0FBQTs7QUNBQSxJQUFBLE1BQUEsQ0FBQSxVQUFBLGNBQUEsRUFBQTtBQUNBLG1CQUFBLEtBQUEsQ0FBQSxjQUFBLEVBQUE7QUFDQSxhQUFBLG1CQUFBO0FBQ0EscUJBQUEscUNBQUE7QUFDQSxvQkFBQSx3QkFBQTtBQUNBLGlCQUFBO0FBQ0Esd0JBQUEsb0JBQUEsWUFBQSxFQUFBLG1CQUFBLEVBQUE7QUFDQSx1QkFBQSxvQkFBQSxVQUFBLENBQUEsYUFBQSxFQUFBLENBQUEsQ0FEQTthQUFBO1NBREE7S0FKQSxFQURBO0NBQUEsQ0FBQTs7QUFhQSxJQUFBLE9BQUEsQ0FBQSxxQkFBQSxFQUFBLFVBQUEsS0FBQSxFQUFBOztBQUVBLFFBQUEsc0JBQUEsRUFBQSxDQUZBOztBQUlBLHdCQUFBLFVBQUEsR0FBQSxVQUFBLEVBQUEsRUFBQTtBQUNBLGVBQUEsTUFBQSxHQUFBLENBQUEsZ0JBQUEsRUFBQSxHQUFBLFVBQUEsQ0FBQSxDQUNBLElBREEsQ0FDQSxVQUFBLEdBQUEsRUFBQTtBQUNBLG1CQUFBLElBQUEsSUFBQSxDQURBO1NBQUEsQ0FEQSxDQURBO0tBQUEsQ0FKQTs7QUFXQSx3QkFBQSxZQUFBLEdBQUEsVUFBQSxNQUFBLEVBQUE7QUFDQSxlQUFBLE1BQUEsSUFBQSxDQUFBLGVBQUEsRUFBQSxNQUFBLEVBQ0EsSUFEQSxDQUNBLFVBQUEsR0FBQSxFQUFBO0FBQ0Esb0JBQUEsR0FBQSxDQUFBLE1BQUEsRUFBQSxHQUFBLEVBREE7QUFFQSxtQkFBQSxJQUFBLElBQUEsQ0FGQTtTQUFBLENBREEsQ0FEQTtLQUFBLENBWEE7O0FBbUJBLFdBQUEsbUJBQUEsQ0FuQkE7Q0FBQSxDQUFBOztBQXNCQSxJQUFBLFVBQUEsQ0FBQSx3QkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLE1BQUEsRUFBQSxXQUFBLEVBQUEsVUFBQSxFQUFBLG1CQUFBLEVBQUE7QUFDQSxXQUFBLFdBQUEsR0FBQSxFQUFBLENBREE7O0FBR0EsV0FBQSxVQUFBLEdBQUE7QUFDQSxrQkFBQTtBQUNBLHlCQUFBLEVBQUE7U0FEQTtLQURBLENBSEE7O0FBU0EsZ0JBQUEsZUFBQSxHQUNBLElBREEsQ0FDQSxVQUFBLElBQUEsRUFBQTtBQUNBLGVBQUEsV0FBQSxHQUFBLElBQUEsQ0FEQTtBQUVBLGVBQUEsVUFBQSxDQUFBLElBQUEsR0FBQSxPQUFBLFdBQUEsQ0FBQSxHQUFBLENBRkE7S0FBQSxDQURBLENBVEE7O0FBZUEsV0FBQSxVQUFBLEdBQUEsVUFBQSxDQWZBOztBQWlCQSxXQUFBLFlBQUEsR0FBQSxVQUFBLEdBQUEsRUFBQTtBQUNBLDRCQUFBLFlBQUEsQ0FBQSxHQUFBLEVBREE7QUFFQSxlQUFBLEVBQUEsQ0FBQSxNQUFBLEVBRkE7S0FBQSxDQWpCQTs7QUFzQkEsV0FBQSxXQUFBLEdBQUEsWUFBQTtBQUNBLFlBQUEsVUFBQSxXQUFBLEVBQUE7QUFDQSxzQkFBQSxXQUFBLENBQUEsa0JBQUEsQ0FBQSxPQUFBLFdBQUEsRUFBQSxPQUFBLFFBQUEsQ0FBQSxDQURBO1NBQUEsTUFFQTtBQUNBLG1CQUFBLFVBQUEsQ0FBQSxRQUFBLENBQUEsV0FBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQURBO1NBRkE7S0FEQSxDQXRCQTs7QUE4QkEsV0FBQSxXQUFBLEdBQUEsVUFBQSxRQUFBLEVBQUE7QUFDQSxlQUFBLFVBQUEsQ0FBQSxRQUFBLENBQUEsV0FBQSxHQUFBLENBQUEsU0FBQSxNQUFBLENBQUEsU0FBQSxFQUFBLFNBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxDQURBO0tBQUEsQ0E5QkE7O0FBa0NBLFdBQUEsUUFBQSxHQUFBLFVBQUEsS0FBQSxFQUFBO0FBQ0EsWUFBQSxLQUFBLEVBQUE7QUFDQSxrQkFBQSxJQUFBLEtBQUEsRUFBQSxDQURBO1NBQUE7S0FEQSxDQWxDQTs7QUF3Q0EsV0FBQSxXQUFBLEdBeENBO0NBQUEsQ0FBQTs7QUNuQ0EsSUFBQSxNQUFBLENBQUEsVUFBQSxjQUFBLEVBQUE7O0FBRUEsbUJBQUEsS0FBQSxDQUFBLE9BQUEsRUFBQTtBQUNBLGFBQUEsUUFBQTtBQUNBLHFCQUFBLHFCQUFBO0FBQ0Esb0JBQUEsV0FBQTtLQUhBLEVBRkE7Q0FBQSxDQUFBOztBQVVBLElBQUEsVUFBQSxDQUFBLFdBQUEsRUFBQSxVQUFBLE1BQUEsRUFBQSxXQUFBLEVBQUEsTUFBQSxFQUFBOztBQUVBLFdBQUEsS0FBQSxHQUFBLEVBQUEsQ0FGQTtBQUdBLFdBQUEsS0FBQSxHQUFBLElBQUEsQ0FIQTs7QUFLQSxXQUFBLFNBQUEsR0FBQSxVQUFBLFNBQUEsRUFBQTs7QUFFQSxlQUFBLEtBQUEsR0FBQSxJQUFBLENBRkE7O0FBSUEsb0JBQUEsS0FBQSxDQUFBLFNBQUEsRUFBQSxJQUFBLENBQUEsVUFBQSxXQUFBLEVBQUE7QUFDQSxtQkFBQSxFQUFBLENBQUEsTUFBQSxFQUFBLEVBQUEsSUFBQSxZQUFBLEdBQUEsRUFBQTs7QUFEQSxTQUFBLENBQUEsQ0FHQSxLQUhBLENBR0EsWUFBQTtBQUNBLG1CQUFBLEtBQUEsR0FBQSw0QkFBQSxDQURBO1NBQUEsQ0FIQSxDQUpBO0tBQUEsQ0FMQTtDQUFBLENBQUE7QUNWQSxJQUFBLE1BQUEsQ0FBQSxVQUFBLGNBQUEsRUFBQTtBQUNBLG1CQUFBLEtBQUEsQ0FBQSxNQUFBLEVBQUE7QUFDQSxhQUFBLFdBQUE7QUFDQSxxQkFBQSw2QkFBQTtBQUNBLG9CQUFBLG9CQUFBO0tBSEEsRUFEQTtDQUFBLENBQUE7O0FBUUEsSUFBQSxVQUFBLENBQUEsb0JBQUEsRUFBQSxVQUFBLE1BQUEsRUFBQSxXQUFBLEVBQUE7QUFDQSxXQUFBLFdBQUEsR0FBQSxFQUFBLENBREE7QUFFQSxXQUFBLGVBQUEsR0FBQSxFQUFBLENBRkE7O0FBSUEsZ0JBQUEsZUFBQSxHQUNBLElBREEsQ0FDQSxVQUFBLElBQUEsRUFBQTtBQUNBLGVBQUEsV0FBQSxHQUFBLElBQUEsQ0FEQTtLQUFBLENBREEsQ0FKQTs7QUFTQSxXQUFBLFdBQUEsR0FBQSxZQUFBO0FBQ0EsWUFBQSxVQUFBLFdBQUEsRUFBQTtBQUNBLHNCQUFBLFdBQUEsQ0FBQSxrQkFBQSxDQUFBLE9BQUEsV0FBQSxFQUFBLE9BQUEsUUFBQSxDQUFBLENBREE7U0FBQSxNQUVBO0FBQ0EsbUJBQUEsZUFBQSxHQUFBLENBQUEsQ0FBQSxFQUFBLENBQUEsQ0FBQSxDQURBO1NBRkE7S0FEQSxDQVRBOztBQWlCQSxXQUFBLFdBQUEsR0FBQSxVQUFBLFFBQUEsRUFBQTtBQUNBLGVBQUEsZUFBQSxHQUFBLENBQUEsU0FBQSxNQUFBLENBQUEsU0FBQSxFQUFBLFNBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxDQURBO0FBRUEsZUFBQSxPQUFBLGVBQUEsQ0FGQTtLQUFBLENBakJBOztBQXNCQSxXQUFBLFFBQUEsR0FBQSxVQUFBLEtBQUEsRUFBQTtBQUNBLFlBQUEsS0FBQSxFQUFBO0FBQ0Esa0JBQUEsSUFBQSxLQUFBLEVBQUEsQ0FEQTtTQUFBO0tBREEsQ0F0QkE7O0FBNEJBLFdBQUEsV0FBQSxHQTVCQTtDQUFBLENBQUE7O0FDUkEsSUFBQSxNQUFBLENBQUEsVUFBQSxjQUFBLEVBQUE7O0FBRUEsbUJBQUEsS0FBQSxDQUFBLGFBQUEsRUFBQTtBQUNBLGFBQUEsZUFBQTtBQUNBLGtCQUFBLG1FQUFBO0FBQ0Esb0JBQUEsb0JBQUEsTUFBQSxFQUFBLFdBQUEsRUFBQTtBQUNBLHdCQUFBLFFBQUEsR0FBQSxJQUFBLENBQUEsVUFBQSxLQUFBLEVBQUE7QUFDQSx1QkFBQSxL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QUFBLEVBaENBO1NBQUE7O0tBSkEsQ0FGQTtDQUFBLENBQUEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcbndpbmRvdy5hcHAgPSBhbmd1bGFyLm1vZHVsZSgnRnVsbHN0YWNrR2VuZXJhdGVkQXBwJywgWydmc2FQcmVCdWlsdCcsICd1aS5yb3V0ZXInLCAndWkuYm9vdHN0cmFwJywgJ25nQW5pbWF0ZSddKTtcblxuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHVybFJvdXRlclByb3ZpZGVyLCAkbG9jYXRpb25Qcm92aWRlcikge1xuICAgIC8vIFRoaXMgdHVybnMgb2ZmIGhhc2hiYW5nIHVybHMgKC8jYWJvdXQpIGFuZCBjaGFuZ2VzIGl0IHRvIHNvbWV0aGluZyBub3JtYWwgKC9hYm91dClcbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSk7XG4gICAgLy8gSWYgd2UgZ28gdG8gYSBVUkwgdGhhdCB1aS1yb3V0ZXIgZG9lc24ndCBoYXZlIHJlZ2lzdGVyZWQsIGdvIHRvIHRoZSBcIi9cIiB1cmwuXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnLycpO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgY29udHJvbGxpbmcgYWNjZXNzIHRvIHNwZWNpZmljIHN0YXRlcy5cbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgIC8vIFRoZSBnaXZlbiBzdGF0ZSByZXF1aXJlcyBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gICAgdmFyIGRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGggPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5hdXRoZW50aWNhdGU7XG4gICAgfTtcblxuICAgIC8vICRzdGF0ZUNoYW5nZVN0YXJ0IGlzIGFuIGV2ZW50IGZpcmVkXG4gICAgLy8gd2hlbmV2ZXIgdGhlIHByb2Nlc3Mgb2YgY2hhbmdpbmcgYSBzdGF0ZSBiZWdpbnMuXG4gICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN0YXJ0JywgZnVuY3Rpb24gKGV2ZW50LCB0b1N0YXRlLCB0b1BhcmFtcykge1xuXG4gICAgICAgIGlmICghZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCh0b1N0YXRlKSkge1xuICAgICAgICAgICAgLy8gVGhlIGRlc3RpbmF0aW9uIHN0YXRlIGRvZXMgbm90IHJlcXVpcmUgYXV0aGVudGljYXRpb25cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgICAgICAgIC8vIFRoZSB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQuXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FuY2VsIG5hdmlnYXRpbmcgdG8gbmV3IHN0YXRlLlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIC8vIElmIGEgdXNlciBpcyByZXRyaWV2ZWQsIHRoZW4gcmVuYXZpZ2F0ZSB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgICAgICAgIC8vICh0aGUgc2Vjb25kIHRpbWUsIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpIHdpbGwgd29yaylcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSwgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4sIGdvIHRvIFwibG9naW5cIiBzdGF0ZS5cbiAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKHRvU3RhdGUubmFtZSwgdG9QYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2xvZ2luJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSk7XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnZG9jcycsIHtcbiAgICAgICAgdXJsOiAnL2RvY3MnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2RvY3MvZG9jcy5odG1sJ1xuICAgIH0pO1xufSk7XG4iLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gSG9wZSB5b3UgZGlkbid0IGZvcmdldCBBbmd1bGFyISBEdWgtZG95LlxuICAgIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcignSSBjYW5cXCd0IGZpbmQgQW5ndWxhciEnKTtcblxuICAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnZnNhUHJlQnVpbHQnLCBbXSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXdpbmRvdy5pbykgdGhyb3cgbmV3IEVycm9yKCdzb2NrZXQuaW8gbm90IGZvdW5kIScpO1xuICAgICAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pO1xuICAgIH0pO1xuXG4gICAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAgIC8vIGZvciBpbXBvcnRhbnQgZXZlbnRzIGFib3V0IGF1dGhlbnRpY2F0aW9uIGZsb3cuXG4gICAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICAgICAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgICAgICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gICAgICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICAgICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gICAgfSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEpIHtcblxuICAgICAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbihyZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgU2Vzc2lvbi5jcmVhdGUoZGF0YS5pZCwgZGF0YS51c2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIGRhdGEudXNlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZXMgdGhlIHNlc3Npb24gZmFjdG9yeSB0byBzZWUgaWYgYW5cbiAgICAgICAgLy8gYXV0aGVudGljYXRlZCB1c2VyIGlzIGN1cnJlbnRseSByZWdpc3RlcmVkLlxuICAgICAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAhIVNlc3Npb24udXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlciA9IGZ1bmN0aW9uIChmcm9tU2VydmVyKSB7XG5cbiAgICAgICAgICAgIC8vIElmIGFuIGF1dGhlbnRpY2F0ZWQgc2Vzc2lvbiBleGlzdHMsIHdlXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhlIHVzZXIgYXR0YWNoZWQgdG8gdGhhdCBzZXNzaW9uXG4gICAgICAgICAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgICAgICAgICAvLyBhbHdheXMgaW50ZXJmYWNlIHdpdGggdGhpcyBtZXRob2QgYXN5bmNocm9ub3VzbHkuXG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIGlmIHRydWUgaXMgZ2l2ZW4gYXMgdGhlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyLFxuICAgICAgICAgICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc0F1dGhlbnRpY2F0ZWQoKSAmJiBmcm9tU2VydmVyICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLndoZW4oU2Vzc2lvbi51c2VyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWFrZSByZXF1ZXN0IEdFVCAvc2Vzc2lvbi5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSB1c2VyLCBjYWxsIG9uU3VjY2Vzc2Z1bExvZ2luIHdpdGggdGhlIHJlc3BvbnNlLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIDQwMSByZXNwb25zZSwgd2UgY2F0Y2ggaXQgYW5kIGluc3RlYWQgcmVzb2x2ZSB0byBudWxsLlxuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL3Nlc3Npb24nKS50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ2V0VXNlcklkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVzZXIuX2lkXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QoeyBtZXNzYWdlOiAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2xvZ291dCcpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIFNlc3Npb24uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnU2Vzc2lvbicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUykge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNyZWF0ZSA9IGZ1bmN0aW9uIChzZXNzaW9uSWQsIHVzZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBzZXNzaW9uSWQ7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSB1c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG59KSgpO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbGVhdmVNZXNzYWdlJywge1xuICAgICAgICB1cmw6ICcvbGVhdmVtZXNzYWdlLzppZCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbGVhdmUtbWVzc2FnZS9sZWF2ZS1tZXNzYWdlLmh0bWwnLCBcbiAgICAgICAgY29udHJvbGxlcjogXCJMZWF2ZU1lc3NhZ2VDb250cm9sbGVyXCIsXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgXHRhbGxGcmllbmRzOiBmdW5jdGlvbiAoJHN0YXRlUGFyYW1zLCBMZWF2ZU1lc3NhZ2VGYWN0b3J5KSB7XG4gICAgICAgIFx0XHRyZXR1cm4gTGVhdmVNZXNzYWdlRmFjdG9yeS5nZXRGcmllbmRzKCRzdGF0ZVBhcmFtcy5pZCk7XG4gICAgICAgIFx0fVxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLmZhY3RvcnkoXCJMZWF2ZU1lc3NhZ2VGYWN0b3J5XCIsIGZ1bmN0aW9uKCRodHRwKSB7XG5cblx0dmFyIExlYXZlTWVzc2FnZUZhY3RvcnkgPSB7fTtcblxuXHRMZWF2ZU1lc3NhZ2VGYWN0b3J5LmdldEZyaWVuZHMgPSBmdW5jdGlvbihpZCkge1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvdXNlcnMvJyArIGlkICsgJy9mcmllbmRzJylcbiBcdFx0LnRoZW4oZnVuY3Rpb24ocmVzKXtcbiBcdFx0XHRyZXR1cm4gcmVzLmRhdGE7XG4gXHRcdH0pO1xuXHR9O1xuXG5cdExlYXZlTWVzc2FnZUZhY3RvcnkubGVhdmVNZXNzYWdlID0gZnVuY3Rpb24obmV3TXNnKSB7XG5cdFx0cmV0dXJuICRodHRwLnBvc3QoJy9hcGkvbWVzc2FnZXMnLCBuZXdNc2cpXG5cdFx0LnRoZW4oZnVuY3Rpb24ocmVzKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhcInJlcyBcIiwgcmVzKVxuXHRcdFx0cmV0dXJuIHJlcy5kYXRhO1xuXHRcdH0pXG5cdH07XG5cblx0cmV0dXJuIExlYXZlTWVzc2FnZUZhY3Rvcnk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0xlYXZlTWVzc2FnZUNvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsICRzdGF0ZSwgQXV0aFNlcnZpY2UsIGFsbEZyaWVuZHMsIExlYXZlTWVzc2FnZUZhY3RvcnkpIHtcblx0JHNjb3BlLmN1cnJlbnRVc2VyID0ge307XG5cblx0JHNjb3BlLm5ld01lc3NhZ2UgPSB7XG5cdFx0bG9jYXRpb246IHtcblx0XHRcdGNvb3JkaW5hdGVzOiBbXVxuXHRcdH1cblx0fTtcblxuXHRBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuXHQudGhlbihmdW5jdGlvbih1c2VyKSB7XG5cdFx0JHNjb3BlLmN1cnJlbnRVc2VyID0gdXNlcjtcblx0XHQkc2NvcGUubmV3TWVzc2FnZS5mcm9tID0gJHNjb3BlLmN1cnJlbnRVc2VyLl9pZFxuXHR9KVxuXG5cdCRzY29wZS5hbGxGcmllbmRzID0gYWxsRnJpZW5kcztcblxuXHQkc2NvcGUubGVhdmVNZXNzYWdlID0gZnVuY3Rpb24obXNnKSB7XG5cdFx0TGVhdmVNZXNzYWdlRmFjdG9yeS5sZWF2ZU1lc3NhZ2UobXNnKVxuXHRcdCRzdGF0ZS5nbygnbWFpbicpXG5cdH07XG5cblx0JHNjb3BlLmdldExvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG5cdCAgaWYgKG5hdmlnYXRvci5nZW9sb2NhdGlvbikge1xuXHQgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbigkc2NvcGUuZ2V0UG9zaXRpb24sICRzY29wZS5nZXRFcnJvcik7XG5cdCAgfSBlbHNlIHtcblx0ICAgICRzY29wZS5uZXdNZXNzYWdlLmxvY2F0aW9uLmNvb3JkaW5hdGVzID0gWzAsIDBdO1xuXHQgIH1cblx0fVxuXG5cdCRzY29wZS5nZXRQb3NpdGlvbiA9IGZ1bmN0aW9uKHBvc2l0aW9uKSB7XG4gXHRcdCRzY29wZS5uZXdNZXNzYWdlLmxvY2F0aW9uLmNvb3JkaW5hdGVzID0gW3Bvc2l0aW9uLmNvb3Jkcy5sb25naXR1ZGUsIHBvc2l0aW9uLmNvb3Jkcy5sYXRpdHVkZV1cbiBcdH1cblxuIFx0JHNjb3BlLmdldEVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcbiBcdFx0aWYoZXJyb3IpIHtcbiBcdFx0XHR0aHJvdyBuZXcgRXJyb3IoKTtcbiBcdFx0fVxuIFx0fVxuXG4gXHQkc2NvcGUuZ2V0TG9jYXRpb24oKTtcblx0XG5cbn0pXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsb2dpbicsIHtcbiAgICAgICAgdXJsOiAnL2xvZ2luJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sb2dpbi9sb2dpbi5odG1sJyxcbiAgICAgICAgY29udHJvbGxlcjogJ0xvZ2luQ3RybCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdMb2dpbkN0cmwnLCBmdW5jdGlvbiAoJHNjb3BlLCBBdXRoU2VydmljZSwgJHN0YXRlKSB7XG5cbiAgICAkc2NvcGUubG9naW4gPSB7fTtcbiAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuXG4gICAgJHNjb3BlLnNlbmRMb2dpbiA9IGZ1bmN0aW9uIChsb2dpbkluZm8pIHtcblxuICAgICAgICAkc2NvcGUuZXJyb3IgPSBudWxsO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmxvZ2luKGxvZ2luSW5mbykudGhlbihmdW5jdGlvbiAoY3VycmVudFVzZXIpIHtcbiAgICAgICAgICAgICRzdGF0ZS5nbygnbWFpbicsIHtpZDogY3VycmVudFVzZXIuX2lkfSk7XG4gICAgICAgICAgICAvLyAkc3RhdGUuZ28oJ2hvbWUnLCB7aWQ6IGN1cnJlbnRVc2VyLl9pZH0pO1xuICAgICAgICB9KS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAkc2NvcGUuZXJyb3IgPSAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nO1xuICAgICAgICB9KTtcblxuICAgIH07XG5cbn0pOyIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21haW4nLCB7XG4gICAgICAgIHVybDogJy9tYWluLzppZCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbWFpbi1wYWdlL21haW4ucGFnZS5odG1sJywgXG4gICAgICAgIGNvbnRyb2xsZXI6ICdNYWluUGFnZUNvbnRyb2xsZXInXG4gICAgfSk7XG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ01haW5QYWdlQ29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgQXV0aFNlcnZpY2UpIHtcbiAgICAkc2NvcGUuY3VycmVudFVzZXIgPSB7fTtcbiAgICAkc2NvcGUuY3VycmVudExvY2F0aW9uID0gW107XG5cbiAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKVxuICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgJHNjb3BlLmN1cnJlbnRVc2VyID0gdXNlcjtcbiAgICB9KVxuXG4gICAgJHNjb3BlLmdldExvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAobmF2aWdhdG9yLmdlb2xvY2F0aW9uKSB7XG4gICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oJHNjb3BlLmdldFBvc2l0aW9uLCAkc2NvcGUuZ2V0RXJyb3IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgJHNjb3BlLmN1cnJlbnRMb2NhdGlvbiA9IFswLCAwXTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAkc2NvcGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuICAgICAgICAkc2NvcGUuY3VycmVudExvY2F0aW9uID0gW3Bvc2l0aW9uLmNvb3Jkcy5sb25naXR1ZGUsIHBvc2l0aW9uLmNvb3Jkcy5sYXRpdHVkZV1cbiAgICAgICAgcmV0dXJuICRzY29wZS5jdXJyZW50TG9jYXRpb247ICAgXG4gICAgfVxuXG4gICAgJHNjb3BlLmdldEVycm9yID0gZnVuY3Rpb24oZXJyb3IpIHtcbiAgICAgICAgaWYoZXJyb3IpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgJHNjb3BlLmdldExvY2F0aW9uKCk7XG5cblxufSlcblxuXG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21lbWJlcnNPbmx5Jywge1xuICAgICAgICB1cmw6ICcvbWVtYmVycy1hcmVhJyxcbiAgICAgICAgdGVtcGxhdGU6ICc8aW1nIG5nLXJlcGVhdD1cIml0ZW0gaW4gc3Rhc2hcIiB3aWR0aD1cIjMwMFwiIG5nLXNyYz1cInt7IGl0ZW0gfX1cIiAvPicsXG4gICAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uICgkc2NvcGUsIFNlY3JldFN0YXNoKSB7XG4gICAgICAgICAgICBTZWNyZXRTdGFzaC5nZXRTdGFzaCgpLnRoZW4oZnVuY3Rpb24gKHN0YXNoKSB7XG4gICAgICAgICAgICAgICAgJHNjb3BlLnN0YXNoID0gc3Rhc2g7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBkYXRhLmF1dGhlbnRpY2F0ZSBpcyByZWFkIGJ5IGFuIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIC8vIHRoYXQgY29udHJvbHMgYWNjZXNzIHRvIHRoaXMgc3RhdGUuIFJlZmVyIHRvIGFwcC5qcy5cbiAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgYXV0aGVudGljYXRlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcblxufSk7XG5cbmFwcC5mYWN0b3J5KCdTZWNyZXRTdGFzaCcsIGZ1bmN0aW9uICgkaHR0cCkge1xuXG4gICAgdmFyIGdldFN0YXNoID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL21lbWJlcnMvc2VjcmV0LXN0YXNoJykudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZ2V0U3Rhc2g6IGdldFN0YXNoXG4gICAgfTtcblxufSk7IiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWVzc2FnZXNIZXJlJywge1xuICAgICAgICB1cmw6ICcvbWVzc2FnZXMvdG8vOmlkP2xvbiZsYXQnLFxuICAgICAgICAvLyB1cmw6ICcvbWVzc2FnZXMvaGVyZS86aWQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3NlZS1tc2cvc2VlLm1zZy5odG1sJywgXG4gICAgICAgIGNvbnRyb2xsZXI6J01lc3NhZ2VzSGVyZUNvbnRyb2xsZXInLCBcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICBcdGFsbE1lc3NhZ2VzOiBmdW5jdGlvbigkc3RhdGVQYXJhbXMsIE1lc3NhZ2VzSGVyZUZhY3RvcnkpIHtcbiAgICAgICAgXHRyZXR1cm4gTWVzc2FnZXNIZXJlRmFjdG9yeS5pbmJveEhlcmUoJHN0YXRlUGFyYW1zLmlkLCAkc3RhdGVQYXJhbXMubG9uLCAkc3RhdGVQYXJhbXMubGF0KVxuICAgICAgICBcdH1cbiAgICAgICAgfVxuICAgIH0pO1xufSk7XG5cbmFwcC5mYWN0b3J5KCdNZXNzYWdlc0hlcmVGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHApIHtcblx0XG5cdHZhciBNZXNzYWdlc0hlcmVGYWN0b3J5ID0ge307XG5cblx0TWVzc2FnZXNIZXJlRmFjdG9yeS5pbmJveEhlcmUgPSBmdW5jdGlvbihpZCwgbG9uLCBsYXQpIHtcblx0XHRjb25zb2xlLmxvZyhsb24gKyBcIiBcIiArIGxhdCk7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS9tZXNzYWdlcy90by8nICsgaWQgKyAnP2xvbj0nICsgbG9uICsgJyZsYXQ9JyArIGxhdClcblx0XHQudGhlbihmdW5jdGlvbihyZXMpIHtcblx0XHRcdHJldHVybiByZXMuZGF0YTtcblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiBNZXNzYWdlc0hlcmVGYWN0b3J5O1xufSlcblxuYXBwLmNvbnRyb2xsZXIoJ01lc3NhZ2VzSGVyZUNvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsIEF1dGhTZXJ2aWNlLCBNZXNzYWdlc0hlcmVGYWN0b3J5LCBhbGxNZXNzYWdlcykge1xuXG5cdCRzY29wZS5jdXJyZW50VXNlciA9IHt9O1xuXG5cdEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG4gICAgLnRoZW4oZnVuY3Rpb24odXNlcikge1xuICAgICAgICAkc2NvcGUuY3VycmVudFVzZXIgPSB1c2VyO1xuICAgIH0pXG5cblx0JHNjb3BlLmFsbE1lc3NhZ2VzID0gYWxsTWVzc2FnZXM7XG5cbn0pXG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ25vdGlmaWNhdGlvbnMnLCB7XG4gICAgICAgIHVybDogJy9ub3RpZmljYXRpb25zLzppZCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvc2VlLW5vdGlmaWNhdGlvbnMvc2VlLm5vdGlmaWNhdGlvbnMuaHRtbCcsIFxuICAgICAgICBjb250cm9sbGVyOiAnTm90aWZpY2F0aW9uc0NvbnRyb2xsZXInLFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgIFx0YWxsTWVzc2FnZXM6IGZ1bmN0aW9uKCRzdGF0ZVBhcmFtcywgTm90aWZpY2F0aW9uc0ZhY3RvcnkpIHtcbiAgICAgICAgXHRcdHJldHVybiBOb3RpZmljYXRpb25zRmFjdG9yeS5nZXRBbGxNZXNzYWdlcygkc3RhdGVQYXJhbXMuaWQpXG4gICAgICAgIFx0fVxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLmZhY3RvcnkoJ05vdGlmaWNhdGlvbnNGYWN0b3J5JywgZnVuY3Rpb24oJGh0dHApIHtcblx0dmFyIE5vdGlmaWNhdGlvbnNGYWN0b3J5ID0ge307XG5cblx0Tm90aWZpY2F0aW9uc0ZhY3RvcnkuZ2V0QWxsTWVzc2FnZXMgPSBmdW5jdGlvbihpZCkge1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJ2FwaS9tZXNzYWdlcy90by9hbGwvJyArIGlkKVxuXHRcdC50aGVuKGZ1bmN0aW9uKHJlcykge1xuXHRcdFx0cmV0dXJuIHJlcy5kYXRhO1xuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIE5vdGlmaWNhdGlvbnNGYWN0b3J5O1xufSlcblxuYXBwLmNvbnRyb2xsZXIoJ05vdGlmaWNhdGlvbnNDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBhbGxNZXNzYWdlcykge1xuXHQgJHNjb3BlLmFsbE1lc3NhZ2VzID0gYWxsTWVzc2FnZXM7XG59KVxuIiwiYXBwLmZhY3RvcnkoJ0Z1bGxzdGFja1BpY3MnLCBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIFtcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CN2dCWHVsQ0FBQVhRY0UuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vZmJjZG4tc3Bob3Rvcy1jLWEuYWthbWFpaGQubmV0L2hwaG90b3MtYWsteGFwMS90MzEuMC04LzEwODYyNDUxXzEwMjA1NjIyOTkwMzU5MjQxXzgwMjcxNjg4NDMzMTI4NDExMzdfby5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItTEtVc2hJZ0FFeTlTSy5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I3OS1YN29DTUFBa3c3eS5qcGcnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItVWo5Q09JSUFJRkFoMC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I2eUl5RmlDRUFBcWwxMi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFLVQ3NWxXQUFBbXFxSi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFdlpBZy1WQUFBazkzMi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFZ05NZU9YSUFJZkRoSy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NFUXlJRE5XZ0FBdTYwQi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NDRjNUNVFXOEFFMmxHSi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBZVZ3NVNXb0FBQUxzai5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBYUpJUDdVa0FBbElHcy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NBUU93OWxXRUFBWTlGbC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0ItT1FiVnJDTUFBTndJTS5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I5Yl9lcndDWUFBd1JjSi5wbmc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I1UFRkdm5DY0FFQWw0eC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I0cXdDMGlDWUFBbFBHaC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0IyYjMzdlJJVUFBOW8xRC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0J3cEl3cjFJVUFBdk8yXy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0JzU3NlQU5DWUFFT2hMdy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NKNHZMZnVVd0FBZGE0TC5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJN3d6akVWRUFBT1BwUy5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJZEh2VDJVc0FBbm5IVi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NHQ2lQX1lXWUFBbzc1Vi5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0NJUzRKUElXSUFJMzdxdS5qcGc6bGFyZ2UnXG4gICAgXTtcbn0pO1xuIiwiYXBwLmZhY3RvcnkoJ1JhbmRvbUdyZWV0aW5ncycsIGZ1bmN0aW9uICgpIHtcblxuXG4gICAgdmFyIGdldFJhbmRvbUZyb21BcnJheSA9IGZ1bmN0aW9uIChhcnIpIHtcbiAgICAgICAgcmV0dXJuIGFycltNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiBhcnIubGVuZ3RoKV07XG4gICAgfTtcblxuXG4gICAgdmFyIGdyZWV0aW5ncyA9IFtcbiAgICAgICAgJ0hlbGxvLCB3b3JsZCEnLFxuICAgICAgICAnQXQgbG9uZyBsYXN0LCBJIGxpdmUhJyxcbiAgICAgICAgJ0hlbGxvLCBzaW1wbGUgaHVtYW4uJyxcbiAgICAgICAgJ1doYXQgYSBiZWF1dGlmdWwgZGF5IScsXG4gICAgICAgICdJXFwnbSBsaWtlIGFueSBvdGhlciBwcm9qZWN0LCBleGNlcHQgdGhhdCBJIGFtIHlvdXJzLiA6KScsXG4gICAgICAgICdUaGlzIGVtcHR5IHN0cmluZyBpcyBmb3IgTGluZHNheSBMZXZpbmUuJyxcbiAgICAgICAgJ+OBk+OCk+OBq+OBoeOBr+OAgeODpuODvOOCtuODvOanmOOAgicsXG4gICAgICAgICdXZWxjb21lLiBUby4gV0VCU0lURS4nLFxuICAgICAgICAnOkQnLFxuICAgICAgICAnWWVzLCBJIHRoaW5rIHdlXFwndmUgbWV0IGJlZm9yZS4nLFxuICAgICAgICAnR2ltbWUgMyBtaW5zLi4uIEkganVzdCBncmFiYmVkIHRoaXMgcmVhbGx5IGRvcGUgZnJpdHRhdGEnLFxuICAgICAgICAnSWYgQ29vcGVyIGNvdWxkIG9mZmVyIG9ubHkgb25lIHBpZWNlIG9mIGFkdmljZSwgaXQgd291bGQgYmUgdG8gbmV2U1FVSVJSRUwhJyxcbiAgICBdO1xuXG4gICAgdmFyIGdldExvY2F0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKGZ1bmN0aW9uKGRhdGEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZGF0YVxuICAgICAgICAgICAgfSlcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBncmVldGluZ3M6IGdyZWV0aW5ncyxcbiAgICAgICAgZ2V0UmFuZG9tR3JlZXRpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRSYW5kb21Gcm9tQXJyYXkoZ3JlZXRpbmdzKTtcbiAgICAgICAgfSxcblxuICAgICAgICBnZXRMb2NhdGlvbjogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHJldHVybiBnZXRMb2NhdGlvbigpO1xuICAgICAgICBcbiAgICAgICAgfSwgXG5cblxuICAgIH07XG5cbn0pO1xuXG5cblxuXG5cbiIsImFwcC5kaXJlY3RpdmUoJ25hdmJhcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgQVVUSF9FVkVOVFMsICRzdGF0ZSkge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgc2NvcGU6IHt9LFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuXG4gICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcblxuICAgICAgICAgICAgc2NvcGUuaXNMb2dnZWRJbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY29wZS5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UubG9nb3V0KCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdsb2dpbicpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgc2NvcGUuZ29Ib21lID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdtYWluJyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBzZXRVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IHVzZXI7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgcmVtb3ZlVXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNldFVzZXIoKTtcblxuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzLCBzZXRVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MsIHJlbW92ZVVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIHJlbW92ZVVzZXIpO1xuXG4gICAgICAgIH1cblxuICAgIH07XG5cbn0pO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
