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

    // Register our *about* state.
    $stateProvider.state('about', {
        url: '/about',
        controller: 'AboutController',
        templateUrl: 'js/about/about.html'
    });
});

app.controller('AboutController', function ($scope, FullstackPics) {

    // Images of beautiful Fullstack people.
    $scope.images = _.shuffle(FullstackPics);
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
            return res.data;
        });
    };

    return LeaveMessageFactory;
});

app.controller('LeaveMessageController', function ($scope, AuthService, allFriends, LeaveMessageFactory) {
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
        console.log(msg);
        LeaveMessageFactory.leaveMessage(msg);
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

    $scope.getMyLocation = function () {
        $scope.getLocation();
    };

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

// app.factory('LocationFactory', function() {

//  var LocationFactory = {};

//  LocationFactory.getLocation = function() {
//    if (navigator.geolocation) {
//      navigator.geolocation.getCurrentPosition(LocationFactory.getPosition, LocationFactory.getError);
//    } else {
//       var currentLocation = [0,0];
//       return currentLocation;
//    }
//  }

//  LocationFactory.getPosition = function(position) {
//          var currentLocation = [position.coords.latitude, position.coords.longitude]
//          return currentLocation;
//      }

//      LocationFactory.getError = function(error) {
//          if(error) {
//              throw new Error();
//          }
//      }

//      return LocationFactory;

// })

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
            console.log("res.data: ", res.data);
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
        url: '/notifications',
        templateUrl: 'js/see-msg/see.msg.html'
    });
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

app.directive('fullstackLogo', function () {
    return {
        restrict: 'E',
        templateUrl: 'js/common/directives/fullstack-logo/fullstack-logo.html'
    };
});
app.directive('navbar', function ($rootScope, AuthService, AUTH_EVENTS, $state) {

    return {
        restrict: 'E',
        scope: {},
        templateUrl: 'js/common/directives/navbar/navbar.html',
        link: function link(scope) {

            scope.items = [{ label: 'Home', state: 'home' }, { label: 'About', state: 'about' }, { label: 'Documentation', state: 'docs' }, { label: 'Members Only', state: 'membersOnly', auth: true }];

            scope.user = null;

            scope.isLoggedIn = function () {
                return AuthService.isAuthenticated();
            };

            scope.logout = function () {
                AuthService.logout().then(function () {
                    $state.go('home');
                });
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

// // app.directive('randoGreeting', function (RandomGreetings) {
// //     return {
// //         restrict: 'E',
// //         templateUrl: 'js/common/directives/rando-greeting/rando-greeting.html',
// //         controller: "MessageController"
// //     };

// // });

// app.factory('MessageFactory', function($http) {
// 	MessageFactory = {};
// 	MessageFactory.currentLocation;
// 	MessageFactory.getLocation = function() {
// 	  if (navigator.geolocation) {
// 	    navigator.geolocation.getCurrentPosition(getPosition, getError);
// 	  } else {
// 	    MessageFactory.currentLocation = [undefined, undefined];
// 	  }
// 	}

// 	MessageFactory.getPosition = function(position) {
//  		MessageFactory.currentLocation = [position.coords.latitude, position.coords.longitude]
//  	}

//  	MessageFactory.getError = function(error) {
//  		if(error) {
//  			MessageFactory.currentLocation = [undefined, undefined];
//  		}
//  	}

//  	MessageFactory.getFriends = function(id) {
//  		return $http.get('/api/users' + id + '/friends')
//  		.then(function(res){
//  			return res.data;
//  		})
//  	}

//  	// MessageFactory.leaveMessage - function() {
//  	// 	return $http.post('/api/messages', {
//  	// 		location: currentLocation,
//  	// 		subject:
//  	// 		body:
//  	// 		from:
//  	// 		to:
//  	// 	})
//  	// }
//  	return MessageFactory;

// })

// app.controller("MessageController", function($scope, allFriends, AuthService, MessageFactory) {
// 	$scope.currentUser = AuthService.getLoggedInUser();
// 	console.log($scope.currentUser)
// 	$scope.currentLocation = MessageFactory.currentLocation

// 	// $scope.currentUser = AuthService.getLoggedInUser();
// 	// console.log("user is: ", $scope.currentUser)
// 	$scope.allFriends = allFriends;
// 	console.log($scope.allFriends);
// 	// $scope.currentLocation = "";
// 	// $scope.getLocation = function() {
// 	//   if (navigator.geolocation) {
// 	//     navigator.geolocation.getCurrentPosition($scope.showPosition, $scope.showError);
// 	//   } else {
// 	//     $scope.currentLocation = "Geolocation is not supported by this browser.";
// 	//   }
// 	// }

// 	// $scope.showPosition = function(position) {
//  //  		var geoPoint = position.coords.latitude + "," + position.coords.longitude;
//  // 		$scope.currentLocation = "Your location is: " + position.coords.latitude + " ,  " + position.coords.longitude;
//  // 	}

// 	// // show our errors for debuging
// 	// $scope.showError = function(error) {
// 	//   switch (error.code) {
// 	//     case error.PERMISSION_DENIED:
// 	//       $scope.currentLocation = "Denied the request for Geolocation. Maybe, ask the user in a more polite way?"
// 	//       break;
// 	//     case error.POSITION_UNAVAILABLE:
// 	//       $scope.currentLocation = "Location information is unavailable.";
// 	//       break;
// 	//     case error.TIMEOUT:
// 	//       $scope.currentLocation = "The request to get location timed out.";
// 	//       break;
// 	//     case error.UNKNOWN_ERROR:
// 	//       $scope.currentLocation = "An unknown error occurred :(";
// 	//       break;
// 	//   }

// })
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFib3V0L2Fib3V0LmpzIiwiZG9jcy9kb2NzLmpzIiwiZnNhL2ZzYS1wcmUtYnVpbHQuanMiLCJsZWF2ZS1tZXNzYWdlL2xlYXZlLW1lc3NhZ2UuanMiLCJsb2dpbi9sb2dpbi5qcyIsIm1haW4tcGFnZS9tYWluLnBhZ2UuanMiLCJtZW1iZXJzLW9ubHkvbWVtYmVycy1vbmx5LmpzIiwic2VlLW1zZy9zZWUubXNnLmpzIiwic2VlLW5vdGlmaWNhdGlvbnMvc2VlLm5vdGlmaWNhdGlvbnMuanMiLCJjb21tb24vZmFjdG9yaWVzL0Z1bGxzdGFja1BpY3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1JhbmRvbUdyZWV0aW5ncy5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL2Z1bGxzdGFjay1sb2dvL2Z1bGxzdGFjay1sb2dvLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUFDQSxPQUFBLEdBQUEsR0FBQSxRQUFBLE1BQUEsQ0FBQSx1QkFBQSxFQUFBLENBQUEsYUFBQSxFQUFBLFdBQUEsRUFBQSxjQUFBLEVBQUEsV0FBQSxDQUFBLENBQUE7O0FBRUEsSUFBQSxNQUFBLENBQUEsVUFBQSxrQkFBQSxFQUFBLGlCQUFBLEVBQUE7O0FBRUEsc0JBQUEsU0FBQSxDQUFBLElBQUE7O0FBRkEsc0JBSUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxFQUpBO0NBQUEsQ0FBQTs7O0FBUUEsSUFBQSxHQUFBLENBQUEsVUFBQSxVQUFBLEVBQUEsV0FBQSxFQUFBLE1BQUEsRUFBQTs7O0FBR0EsUUFBQSwrQkFBQSxTQUFBLDRCQUFBLENBQUEsS0FBQSxFQUFBO0FBQ0EsZUFBQSxNQUFBLElBQUEsSUFBQSxNQUFBLElBQUEsQ0FBQSxZQUFBLENBREE7S0FBQTs7OztBQUhBLGNBU0EsQ0FBQSxHQUFBLENBQUEsbUJBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxPQUFBLEVBQUEsUUFBQSxFQUFBOztB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Q0FBQSxDQUFBOztBQWFBLElBQUEsT0FBQSxDQUFBLHFCQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUE7O0FBRUEsUUFBQSxzQkFBQSxFQUFBLENBRkE7O0FBSUEsd0JBQUEsVUFBQSxHQUFBLFVBQUEsRUFBQSxFQUFBO0FBQ0EsZUFBQSxNQUFBLEdBQUEsQ0FBQSxnQkFBQSxFQUFBLEdBQUEsVUFBQSxDQUFBLENBQ0EsSUFEQSxDQUNBLFVBQUEsR0FBQSxFQUFBO0FBQ0EsbUJBQUEsSUFBQSxJQUFBLENBREE7U0FBQSxDQURBLENBREE7S0FBQSxDQUpBOztBQVdBLHdCQUFBLFlBQUEsR0FBQSxVQUFBLE1BQUEsRUFBQTtBQUNBLGVBQUEsTUFBQSxJQUFBLENBQUEsZUFBQSxFQUFBLE1BQUEsRUFDQSxJQURBLENBQ0EsVUFBQSxHQUFBLEVBQUE7QUFDQSxtQkFBQSxJQUFBLElBQUEsQ0FEQTtTQUFBLENBREEsQ0FEQTtLQUFBLENBWEE7O0FBa0JBLFdBQUEsbUJBQUEsQ0FsQkE7Q0FBQSxDQUFBOztBQXFCQSxJQUFBLFVBQUEsQ0FBQSx3QkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLFdBQUEsRUFBQSxVQUFBLEVBQUEsbUJBQUEsRUFBQTtBQUNBLFdBQUEsV0FBQSxHQUFBLEVBQUEsQ0FEQTs7QUFHQSxXQUFBLFVBQUEsR0FBQTtBQUNBLGtCQUFBO0FBQ0EseUJBQUEsRUFBQTtTQURBO0tBREEsQ0FIQTs7QUFTQSxnQkFBQSxlQUFBLEdBQ0EsSUFEQSxDQUNBLFVBQUEsSUFBQSxFQUFBO0FBQ0EsZUFBQSxXQUFBLEdBQUEsSUFBQSxDQURBO0FBRUEsZUFBQSxVQUFBLENBQUEsSUFBQSxHQUFBLE9BQUEsV0FBQSxDQUFBLEdBQUEsQ0FGQTtLQUFBLENBREEsQ0FUQTs7QUFlQSxXQUFBLFVBQUEsR0FBQSxVQUFBLENBZkE7O0FBaUJBLFdBQUEsWUFBQSxHQUFBLFVBQUEsR0FBQSxFQUFBO0FBQ0EsZ0JBQUEsR0FBQSxDQUFBLEdBQUEsRUFEQTtBQUVBLDRCQUFBLFlBQUEsQ0FBQSxHQUFBLEVBRkE7S0FBQSxD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QUEsR0FBQSxFQUFBLGFBQUEsR0FBQSxDQUFBLENBREE7YUFBQTtTQURBO0tBTEEsRUFEQTtDQUFBLENBQUE7O0FBY0EsSUFBQSxPQUFBLENBQUEscUJBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQTs7QUFFQSxRQUFBLHNCQUFBLEVBQUEsQ0FGQTs7QUFJQSx3QkFBQSxTQUFBLEdBQUEsVUFBQSxFQUFBLEVBQUEsR0FBQSxFQUFBLEdBQUEsRUFBQTtBQUNBLGdCQUFBLEdBQUEsQ0FBQSxNQUFBLEdBQUEsR0FBQSxHQUFBLENBQUEsQ0FEQTtBQUVBLGVBQUEsTUFBQSxHQUFBLENBQUEsc0JBQUEsRUFBQSxHQUFBLE9BQUEsR0FBQSxHQUFBLEdBQUEsT0FBQSxHQUFBLEdBQUEsQ0FBQSxDQUNBLElBREEsQ0FDQSxVQUFBLEdBQUEsRUFBQTtBQUNBLG9CQUFBLEdBQUEsQ0FBQSxZQUFBLEVBQUEsSUFBQSxJQUFBLENBQUEsQ0FEQTtBQUVBLG1CQUFBLElBQUEsSUFBQSxDQUZBO1NBQUEsQ0FEQSxDQUZBO0tBQUEsQ0FKQTs7QUFhQSxXQUFBLG1CQUFBLENBYkE7Q0FBQSxDQUFBOztBQWdCQSxJQUFBLFVBQUEsQ0FBQSx3QkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLFdBQUEsRUFBQSxtQkFBQSxFQUFBLFdBQUEsRUFBQTs7QUFFQSxXQUFBLFdBQUEsR0FBQSxFQUFBLENBRkE7O0FBSUEsZ0JBQUEsZUFBQSxHQUNBLElBREEsQ0FDQSxVQUFBLElBQUEsRUFBQTtBQUNBLGVBQUEsV0FBQSxHQUFBLElBQUEsQ0FEQTtLQUFBLENBREEsQ0FKQTs7QUFTQSxXQUFBLFdBQUEsR0FBQSxXQUFBLENBVEE7Q0FBQSxDQUFBOztBQzlCQSxJQUFBLE1BQUEsQ0FBQSxVQUFBLGNBQUEsRUFBQTtBQUNBLG1CQUFBLEtBQUEsQ0FBQSxlQUFBLEVBQUE7QUFDQSxhQUFBLGdCQUFBO0FBQ0EscUJBQUEseUJBQUE7S0FGQSxFQURBO0NBQUEsQ0FBQTs7QUNBQSxJQUFBLE9BQUEsQ0FBQSxlQUFBLEVBQUEsWUFBQTtBQUNBLFdBQUEs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QURBO2FBQUEsQ0EzQkE7O0FBK0JBLHNCQS9CQTs7QUFpQ0EsdUJBQUEsR0FBQSxDQUFBLFlBQUEsWUFBQSxFQUFBLE9BQUEsRUFqQ0E7QUFrQ0EsdUJBQUEsR0FBQSxDQUFBLFlBQUEsYUFBQSxFQUFBLFVBQUEsRUFsQ0E7QUFtQ0EsdUJBQUEsR0FBQSxDQUFBLFlBQUEsY0FBQSxFQUFBLFVBQUEsRUFuQ0E7U0FBQTs7S0FKQSxDQUZBO0NBQUEsQ0FBQSIsImZpbGUiOiJtYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xud2luZG93LmFwcCA9IGFuZ3VsYXIubW9kdWxlKCdGdWxsc3RhY2tHZW5lcmF0ZWRBcHAnLCBbJ2ZzYVByZUJ1aWx0JywgJ3VpLnJvdXRlcicsICd1aS5ib290c3RyYXAnLCAnbmdBbmltYXRlJ10pO1xuXG5hcHAuY29uZmlnKGZ1bmN0aW9uICgkdXJsUm91dGVyUHJvdmlkZXIsICRsb2NhdGlvblByb3ZpZGVyKSB7XG4gICAgLy8gVGhpcyB0dXJucyBvZmYgaGFzaGJhbmcgdXJscyAoLyNhYm91dCkgYW5kIGNoYW5nZXMgaXQgdG8gc29tZXRoaW5nIG5vcm1hbCAoL2Fib3V0KVxuICAgICRsb2NhdGlvblByb3ZpZGVyLmh0bWw1TW9kZSh0cnVlKTtcbiAgICAvLyBJZiB3ZSBnbyB0byBhIFVSTCB0aGF0IHVpLXJvdXRlciBkb2Vzbid0IGhhdmUgcmVnaXN0ZXJlZCwgZ28gdG8gdGhlIFwiL1wiIHVybC5cbiAgICAkdXJsUm91dGVyUHJvdmlkZXIub3RoZXJ3aXNlKCcvJyk7XG59KTtcblxuLy8gVGhpcyBhcHAucnVuIGlzIGZvciBjb250cm9sbGluZyBhY2Nlc3MgdG8gc3BlY2lmaWMgc3RhdGVzLlxuYXBwLnJ1bihmdW5jdGlvbiAoJHJvb3RTY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgLy8gVGhlIGdpdmVuIHN0YXRlIHJlcXVpcmVzIGFuIGF1dGhlbnRpY2F0ZWQgdXNlci5cbiAgICB2YXIgZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgICAgICByZXR1cm4gc3RhdGUuZGF0YSAmJiBzdGF0ZS5kYXRhLmF1dGhlbnRpY2F0ZTtcbiAgICB9O1xuXG4gICAgLy8gJHN0YXRlQ2hhbmdlU3RhcnQgaXMgYW4gZXZlbnQgZmlyZWRcbiAgICAvLyB3aGVuZXZlciB0aGUgcHJvY2VzcyBvZiBjaGFuZ2luZyBhIHN0YXRlIGJlZ2lucy5cbiAgICAkcm9vdFNjb3BlLiRvbignJHN0YXRlQ2hhbmdlU3RhcnQnLCBmdW5jdGlvbiAoZXZlbnQsIHRvU3RhdGUsIHRvUGFyYW1zKSB7XG5cbiAgICAgICAgaWYgKCFkZXN0aW5hdGlvblN0YXRlUmVxdWlyZXNBdXRoKHRvU3RhdGUpKSB7XG4gICAgICAgICAgICAvLyBUaGUgZGVzdGluYXRpb24gc3RhdGUgZG9lcyBub3QgcmVxdWlyZSBhdXRoZW50aWNhdGlvblxuICAgICAgICAgICAgLy8gU2hvcnQgY2lyY3VpdCB3aXRoIHJldHVybi5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKSkge1xuICAgICAgICAgICAgLy8gVGhlIHVzZXIgaXMgYXV0aGVudGljYXRlZC5cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyBDYW5jZWwgbmF2aWdhdGluZyB0byBuZXcgc3RhdGUuXG4gICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cbiAgICAgICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKCkudGhlbihmdW5jdGlvbiAodXNlcikge1xuICAgICAgICAgICAgLy8gSWYgYSB1c2VyIGlzIHJldHJpZXZlZCwgdGhlbiByZW5hdmlnYXRlIHRvIHRoZSBkZXN0aW5hdGlvblxuICAgICAgICAgICAgLy8gKHRoZSBzZWNvbmQgdGltZSwgQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkgd2lsbCB3b3JrKVxuICAgICAgICAgICAgLy8gb3RoZXJ3aXNlLCBpZiBubyB1c2VyIGlzIGxvZ2dlZCBpbiwgZ28gdG8gXCJsb2dpblwiIHN0YXRlLlxuICAgICAgICAgICAgaWYgKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28odG9TdGF0ZS5uYW1lLCB0b1BhcmFtcyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICRzdGF0ZS5nbygnbG9naW4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICB9KTtcblxufSk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgLy8gUmVnaXN0ZXIgb3VyICphYm91dCogc3RhdGUuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ2Fib3V0Jywge1xuICAgICAgICB1cmw6ICcvYWJvdXQnLFxuICAgICAgICBjb250cm9sbGVyOiAnQWJvdXRDb250cm9sbGVyJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9hYm91dC9hYm91dC5odG1sJ1xuICAgIH0pO1xuXG59KTtcblxuYXBwLmNvbnRyb2xsZXIoJ0Fib3V0Q29udHJvbGxlcicsIGZ1bmN0aW9uICgkc2NvcGUsIEZ1bGxzdGFja1BpY3MpIHtcblxuICAgIC8vIEltYWdlcyBvZiBiZWF1dGlmdWwgRnVsbHN0YWNrIHBlb3BsZS5cbiAgICAkc2NvcGUuaW1hZ2VzID0gXy5zaHVmZmxlKEZ1bGxzdGFja1BpY3MpO1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdkb2NzJywge1xuICAgICAgICB1cmw6ICcvZG9jcycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvZG9jcy9kb2NzLmh0bWwnXG4gICAgfSk7XG59KTtcbiIsIihmdW5jdGlvbiAoKSB7XG5cbiAgICAndXNlIHN0cmljdCc7XG5cbiAgICAvLyBIb3BlIHlvdSBkaWRuJ3QgZm9yZ2V0IEFuZ3VsYXIhIER1aC1kb3kuXG4gICAgaWYgKCF3aW5kb3cuYW5ndWxhcikgdGhyb3cgbmV3IEVycm9yKCdJIGNhblxcJ3QgZmluZCBBbmd1bGFyIScpO1xuXG4gICAgdmFyIGFwcCA9IGFuZ3VsYXIubW9kdWxlKCdmc2FQcmVCdWlsdCcsIFtdKTtcblxuICAgIGFwcC5mYWN0b3J5KCdTb2NrZXQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghd2luZG93LmlvKSB0aHJvdyBuZXcgRXJyb3IoJ3NvY2tldC5pbyBub3QgZm91bmQhJyk7XG4gICAgICAgIHJldHVybiB3aW5kb3cuaW8od2luZG93LmxvY2F0aW9uLm9yaWdpbik7XG4gICAgfSk7XG5cbiAgICAvLyBBVVRIX0VWRU5UUyBpcyB1c2VkIHRocm91Z2hvdXQgb3VyIGFwcCB0b1xuICAgIC8vIGJyb2FkY2FzdCBhbmQgbGlzdGVuIGZyb20gYW5kIHRvIHRoZSAkcm9vdFNjb3BlXG4gICAgLy8gZm9yIGltcG9ydGFudCBldmVudHMgYWJvdXQgYXV0aGVudGljYXRpb24gZmxvdy5cbiAgICBhcHAuY29uc3RhbnQoJ0FVVEhfRVZFTlRTJywge1xuICAgICAgICBsb2dpblN1Y2Nlc3M6ICdhdXRoLWxvZ2luLXN1Y2Nlc3MnLFxuICAgICAgICBsb2dpbkZhaWxlZDogJ2F1dGgtbG9naW4tZmFpbGVkJyxcbiAgICAgICAgbG9nb3V0U3VjY2VzczogJ2F1dGgtbG9nb3V0LXN1Y2Nlc3MnLFxuICAgICAgICBzZXNzaW9uVGltZW91dDogJ2F1dGgtc2Vzc2lvbi10aW1lb3V0JyxcbiAgICAgICAgbm90QXV0aGVudGljYXRlZDogJ2F1dGgtbm90LWF1dGhlbnRpY2F0ZWQnLFxuICAgICAgICBub3RBdXRob3JpemVkOiAnYXV0aC1ub3QtYXV0aG9yaXplZCdcbiAgICB9KTtcblxuICAgIGFwcC5mYWN0b3J5KCdBdXRoSW50ZXJjZXB0b3InLCBmdW5jdGlvbiAoJHJvb3RTY29wZSwgJHEsIEFVVEhfRVZFTlRTKSB7XG4gICAgICAgIHZhciBzdGF0dXNEaWN0ID0ge1xuICAgICAgICAgICAgNDAxOiBBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLFxuICAgICAgICAgICAgNDAzOiBBVVRIX0VWRU5UUy5ub3RBdXRob3JpemVkLFxuICAgICAgICAgICAgNDE5OiBBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCxcbiAgICAgICAgICAgIDQ0MDogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXRcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJlc3BvbnNlRXJyb3I6IGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChzdGF0dXNEaWN0W3Jlc3BvbnNlLnN0YXR1c10sIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEucmVqZWN0KHJlc3BvbnNlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0pO1xuXG4gICAgYXBwLmNvbmZpZyhmdW5jdGlvbiAoJGh0dHBQcm92aWRlcikge1xuICAgICAgICAkaHR0cFByb3ZpZGVyLmludGVyY2VwdG9ycy5wdXNoKFtcbiAgICAgICAgICAgICckaW5qZWN0b3InLFxuICAgICAgICAgICAgZnVuY3Rpb24gKCRpbmplY3Rvcikge1xuICAgICAgICAgICAgICAgIHJldHVybiAkaW5qZWN0b3IuZ2V0KCdBdXRoSW50ZXJjZXB0b3InKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgXSk7XG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnQXV0aFNlcnZpY2UnLCBmdW5jdGlvbiAoJGh0dHAsIFNlc3Npb24sICRyb290U2NvcGUsIEFVVEhfRVZFTlRTLCAkcSkge1xuXG4gICAgICAgIGZ1bmN0aW9uIG9uU3VjY2Vzc2Z1bExvZ2luKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IHJlc3BvbnNlLmRhdGE7XG4gICAgICAgICAgICBTZXNzaW9uLmNyZWF0ZShkYXRhLmlkLCBkYXRhLnVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcyk7XG4gICAgICAgICAgICByZXR1cm4gZGF0YS51c2VyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVXNlcyB0aGUgc2Vzc2lvbiBmYWN0b3J5IHRvIHNlZSBpZiBhblxuICAgICAgICAvLyBhdXRoZW50aWNhdGVkIHVzZXIgaXMgY3VycmVudGx5IHJlZ2lzdGVyZWQuXG4gICAgICAgIHRoaXMuaXNBdXRoZW50aWNhdGVkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICEhU2Vzc2lvbi51c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyID0gZnVuY3Rpb24gKGZyb21TZXJ2ZXIpIHtcblxuICAgICAgICAgICAgLy8gSWYgYW4gYXV0aGVudGljYXRlZCBzZXNzaW9uIGV4aXN0cywgd2VcbiAgICAgICAgICAgIC8vIHJldHVybiB0aGUgdXNlciBhdHRhY2hlZCB0byB0aGF0IHNlc3Npb25cbiAgICAgICAgICAgIC8vIHdpdGggYSBwcm9taXNlLiBUaGlzIGVuc3VyZXMgdGhhdCB3ZSBjYW5cbiAgICAgICAgICAgIC8vIGFsd2F5cyBpbnRlcmZhY2Ugd2l0aCB0aGlzIG1ldGhvZCBhc3luY2hyb25vdXNseS5cblxuICAgICAgICAgICAgLy8gT3B0aW9uYWxseSwgaWYgdHJ1ZSBpcyBnaXZlbiBhcyB0aGUgZnJvbVNlcnZlciBwYXJhbWV0ZXIsXG4gICAgICAgICAgICAvLyB0aGVuIHRoaXMgY2FjaGVkIHZhbHVlIHdpbGwgbm90IGJlIHVzZWQuXG5cbiAgICAgICAgICAgIGlmICh0aGlzLmlzQXV0aGVudGljYXRlZCgpICYmIGZyb21TZXJ2ZXIgIT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJHEud2hlbihTZXNzaW9uLnVzZXIpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBNYWtlIHJlcXVlc3QgR0VUIC9zZXNzaW9uLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIHVzZXIsIGNhbGwgb25TdWNjZXNzZnVsTG9naW4gd2l0aCB0aGUgcmVzcG9uc2UuXG4gICAgICAgICAgICAvLyBJZiBpdCByZXR1cm5zIGEgNDAxIHJlc3BvbnNlLCB3ZSBjYXRjaCBpdCBhbmQgaW5zdGVhZCByZXNvbHZlIHRvIG51bGwuXG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvc2Vzc2lvbicpLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5nZXRVc2VySWQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHRoaXMuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHVzZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdXNlci5faWRcbiAgICAgICAgICAgIH0pXG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmxvZ2luID0gZnVuY3Rpb24gKGNyZWRlbnRpYWxzKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAucG9zdCgnL2xvZ2luJywgY3JlZGVudGlhbHMpXG4gICAgICAgICAgICAgICAgLnRoZW4ob25TdWNjZXNzZnVsTG9naW4pXG4gICAgICAgICAgICAgICAgLmNhdGNoKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdCh7IG1lc3NhZ2U6ICdJbnZhbGlkIGxvZ2luIGNyZWRlbnRpYWxzLicgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvbG9nb3V0JykudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgU2Vzc2lvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICAgICAgJHJvb3RTY29wZS4kYnJvYWRjYXN0KEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH07XG5cbiAgICB9KTtcblxuICAgIGFwcC5zZXJ2aWNlKCdTZXNzaW9uJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEFVVEhfRVZFTlRTKSB7XG5cbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLm5vdEF1dGhlbnRpY2F0ZWQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5zZXNzaW9uVGltZW91dCwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuaWQgPSBudWxsO1xuICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuXG4gICAgICAgIHRoaXMuY3JlYXRlID0gZnVuY3Rpb24gKHNlc3Npb25JZCwgdXNlcikge1xuICAgICAgICAgICAgdGhpcy5pZCA9IHNlc3Npb25JZDtcbiAgICAgICAgICAgIHRoaXMudXNlciA9IHVzZXI7XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgdGhpcy5pZCA9IG51bGw7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSBudWxsO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbn0pKCk7XG4iLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdsZWF2ZU1lc3NhZ2UnLCB7XG4gICAgICAgIHVybDogJy9sZWF2ZW1lc3NhZ2UvOmlkJyxcbiAgICAgICAgdGVtcGxhdGVVcmw6ICdqcy9sZWF2ZS1tZXNzYWdlL2xlYXZlLW1lc3NhZ2UuaHRtbCcsIFxuICAgICAgICBjb250cm9sbGVyOiBcIkxlYXZlTWVzc2FnZUNvbnRyb2xsZXJcIixcbiAgICAgICAgcmVzb2x2ZToge1xuICAgICAgICBcdGFsbEZyaWVuZHM6IGZ1bmN0aW9uICgkc3RhdGVQYXJhbXMsIExlYXZlTWVzc2FnZUZhY3RvcnkpIHtcbiAgICAgICAgXHRcdHJldHVybiBMZWF2ZU1lc3NhZ2VGYWN0b3J5LmdldEZyaWVuZHMoJHN0YXRlUGFyYW1zLmlkKTtcbiAgICAgICAgXHR9XG4gICAgICAgIH1cbiAgICB9KTtcbn0pO1xuXG5hcHAuZmFjdG9yeShcIkxlYXZlTWVzc2FnZUZhY3RvcnlcIiwgZnVuY3Rpb24oJGh0dHApIHtcblxuXHR2YXIgTGVhdmVNZXNzYWdlRmFjdG9yeSA9IHt9O1xuXG5cdExlYXZlTWVzc2FnZUZhY3RvcnkuZ2V0RnJpZW5kcyA9IGZ1bmN0aW9uKGlkKSB7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS91c2Vycy8nICsgaWQgKyAnL2ZyaWVuZHMnKVxuIFx0XHQudGhlbihmdW5jdGlvbihyZXMpe1xuIFx0XHRcdHJldHVybiByZXMuZGF0YTtcbiBcdFx0fSk7XG5cdH07XG5cblx0TGVhdmVNZXNzYWdlRmFjdG9yeS5sZWF2ZU1lc3NhZ2UgPSBmdW5jdGlvbihuZXdNc2cpIHtcblx0XHRyZXR1cm4gJGh0dHAucG9zdCgnL2FwaS9tZXNzYWdlcycsIG5ld01zZylcblx0XHQudGhlbihmdW5jdGlvbihyZXMpIHtcblx0XHRcdHJldHVybiByZXMuZGF0YTtcblx0XHR9KVxuXHR9O1xuXG5cdHJldHVybiBMZWF2ZU1lc3NhZ2VGYWN0b3J5O1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdMZWF2ZU1lc3NhZ2VDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBBdXRoU2VydmljZSwgYWxsRnJpZW5kcywgTGVhdmVNZXNzYWdlRmFjdG9yeSkge1xuXHQkc2NvcGUuY3VycmVudFVzZXIgPSB7fTtcblxuXHQkc2NvcGUubmV3TWVzc2FnZSA9IHtcblx0XHRsb2NhdGlvbjoge1xuXHRcdFx0Y29vcmRpbmF0ZXM6IFtdXG5cdFx0fVxuXHR9O1xuXG5cdEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG5cdC50aGVuKGZ1bmN0aW9uKHVzZXIpIHtcblx0XHQkc2NvcGUuY3VycmVudFVzZXIgPSB1c2VyO1xuXHRcdCRzY29wZS5uZXdNZXNzYWdlLmZyb20gPSAkc2NvcGUuY3VycmVudFVzZXIuX2lkXG5cdH0pXG5cblx0JHNjb3BlLmFsbEZyaWVuZHMgPSBhbGxGcmllbmRzO1xuXG5cdCRzY29wZS5sZWF2ZU1lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcblx0XHRjb25zb2xlLmxvZyhtc2cpXG5cdFx0TGVhdmVNZXNzYWdlRmFjdG9yeS5sZWF2ZU1lc3NhZ2UobXNnKVxuXHR9O1xuXG5cdCRzY29wZS5nZXRMb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuXHQgIGlmIChuYXZpZ2F0b3IuZ2VvbG9jYXRpb24pIHtcblx0ICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oJHNjb3BlLmdldFBvc2l0aW9uLCAkc2NvcGUuZ2V0RXJyb3IpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICAkc2NvcGUubmV3TWVzc2FnZS5sb2NhdGlvbi5jb29yZGluYXRlcyA9IFswLCAwXTtcblx0ICB9XG5cdH1cblxuXHQkc2NvcGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuIFx0XHQkc2NvcGUubmV3TWVzc2FnZS5sb2NhdGlvbi5jb29yZGluYXRlcyA9IFtwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlLCBwb3NpdGlvbi5jb29yZHMubGF0aXR1ZGVdXG4gXHR9XG5cbiBcdCRzY29wZS5nZXRFcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gXHRcdGlmKGVycm9yKSB7XG4gXHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG4gXHRcdH1cbiBcdH1cblxuIFx0JHNjb3BlLmdldExvY2F0aW9uKCk7XG5cdFxuXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbG9naW4nLCB7XG4gICAgICAgIHVybDogJy9sb2dpbicsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbG9naW4vbG9naW4uaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignTG9naW5DdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgJHNjb3BlLmxvZ2luID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICRzY29wZS5zZW5kTG9naW4gPSBmdW5jdGlvbiAobG9naW5JbmZvKSB7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICAgICBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pLnRoZW4oZnVuY3Rpb24gKGN1cnJlbnRVc2VyKSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ21haW4nLCB7aWQ6IGN1cnJlbnRVc2VyLl9pZH0pO1xuICAgICAgICAgICAgLy8gJHN0YXRlLmdvKCdob21lJywge2lkOiBjdXJyZW50VXNlci5faWR9KTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJztcbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtYWluJywge1xuICAgICAgICB1cmw6ICcvbWFpbi86aWQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL21haW4tcGFnZS9tYWluLnBhZ2UuaHRtbCcsIFxuICAgICAgICBjb250cm9sbGVyOiAnTWFpblBhZ2VDb250cm9sbGVyJ1xuICAgIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdNYWluUGFnZUNvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsIEF1dGhTZXJ2aWNlKSB7XG4gICAgJHNjb3BlLmN1cnJlbnRVc2VyID0ge307XG4gICAgJHNjb3BlLmN1cnJlbnRMb2NhdGlvbiA9IFtdO1xuXG4gICAgJHNjb3BlLmdldE15TG9jYXRpb24gPSBmdW5jdGlvbigpIHtcbiAgICAgICAgJHNjb3BlLmdldExvY2F0aW9uKCk7XG4gICAgfVxuXG4gICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50VXNlciA9IHVzZXI7XG4gICAgfSlcblxuICAgICRzY29wZS5nZXRMb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKG5hdmlnYXRvci5nZW9sb2NhdGlvbikge1xuICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKCRzY29wZS5nZXRQb3NpdGlvbiwgJHNjb3BlLmdldEVycm9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50TG9jYXRpb24gPSBbMCwgMF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgJHNjb3BlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICAgICAgJHNjb3BlLmN1cnJlbnRMb2NhdGlvbiA9IFtwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlLCBwb3NpdGlvbi5jb29yZHMubGF0aXR1ZGVdXG4gICAgICAgIHJldHVybiAkc2NvcGUuY3VycmVudExvY2F0aW9uOyAgIFxuICAgIH1cblxuICAgICRzY29wZS5nZXRFcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgIGlmKGVycm9yKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICRzY29wZS5nZXRMb2NhdGlvbigpO1xuXG5cbn0pXG5cblxuLy8gYXBwLmZhY3RvcnkoJ0xvY2F0aW9uRmFjdG9yeScsIGZ1bmN0aW9uKCkge1xuXG4vLyAgdmFyIExvY2F0aW9uRmFjdG9yeSA9IHt9O1xuXG4vLyAgTG9jYXRpb25GYWN0b3J5LmdldExvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4vLyAgICBpZiAobmF2aWdhdG9yLmdlb2xvY2F0aW9uKSB7XG4vLyAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oTG9jYXRpb25GYWN0b3J5LmdldFBvc2l0aW9uLCBMb2NhdGlvbkZhY3RvcnkuZ2V0RXJyb3IpO1xuLy8gICAgfSBlbHNlIHtcbi8vICAgICAgIHZhciBjdXJyZW50TG9jYXRpb24gPSBbMCwwXTtcbi8vICAgICAgIHJldHVybiBjdXJyZW50TG9jYXRpb247XG4vLyAgICB9XG4vLyAgfVxuXG4vLyAgTG9jYXRpb25GYWN0b3J5LmdldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbi8vICAgICAgICAgIHZhciBjdXJyZW50TG9jYXRpb24gPSBbcG9zaXRpb24uY29vcmRzLmxhdGl0dWRlLCBwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlXVxuLy8gICAgICAgICAgcmV0dXJuIGN1cnJlbnRMb2NhdGlvbjtcbi8vICAgICAgfVxuXG4vLyAgICAgIExvY2F0aW9uRmFjdG9yeS5nZXRFcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4vLyAgICAgICAgICBpZihlcnJvcikge1xuLy8gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuLy8gICAgICAgICAgfVxuLy8gICAgICB9XG5cbi8vICAgICAgcmV0dXJuIExvY2F0aW9uRmFjdG9yeTtcblxuLy8gfSlcbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWVtYmVyc09ubHknLCB7XG4gICAgICAgIHVybDogJy9tZW1iZXJzLWFyZWEnLFxuICAgICAgICB0ZW1wbGF0ZTogJzxpbWcgbmctcmVwZWF0PVwiaXRlbSBpbiBzdGFzaFwiIHdpZHRoPVwiMzAwXCIgbmctc3JjPVwie3sgaXRlbSB9fVwiIC8+JyxcbiAgICAgICAgY29udHJvbGxlcjogZnVuY3Rpb24gKCRzY29wZSwgU2VjcmV0U3Rhc2gpIHtcbiAgICAgICAgICAgIFNlY3JldFN0YXNoLmdldFN0YXNoKCkudGhlbihmdW5jdGlvbiAoc3Rhc2gpIHtcbiAgICAgICAgICAgICAgICAkc2NvcGUuc3Rhc2ggPSBzdGFzaDtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgICAvLyBUaGUgZm9sbG93aW5nIGRhdGEuYXV0aGVudGljYXRlIGlzIHJlYWQgYnkgYW4gZXZlbnQgbGlzdGVuZXJcbiAgICAgICAgLy8gdGhhdCBjb250cm9scyBhY2Nlc3MgdG8gdGhpcyBzdGF0ZS4gUmVmZXIgdG8gYXBwLmpzLlxuICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICBhdXRoZW50aWNhdGU6IHRydWVcbiAgICAgICAgfVxuICAgIH0pO1xuXG59KTtcblxuYXBwLmZhY3RvcnkoJ1NlY3JldFN0YXNoJywgZnVuY3Rpb24gKCRodHRwKSB7XG5cbiAgICB2YXIgZ2V0U3Rhc2ggPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiAkaHR0cC5nZXQoJy9hcGkvbWVtYmVycy9zZWNyZXQtc3Rhc2gnKS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAgICAgcmV0dXJuIHJlc3BvbnNlLmRhdGE7XG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBnZXRTdGFzaDogZ2V0U3Rhc2hcbiAgICB9O1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtZXNzYWdlc0hlcmUnLCB7XG4gICAgICAgIHVybDogJy9tZXNzYWdlcy90by86aWQ/bG9uJmxhdCcsXG4gICAgICAgIC8vIHVybDogJy9tZXNzYWdlcy9oZXJlLzppZCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvc2VlLW1zZy9zZWUubXNnLmh0bWwnLCBcbiAgICAgICAgY29udHJvbGxlcjonTWVzc2FnZXNIZXJlQ29udHJvbGxlcicsIFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgIFx0YWxsTWVzc2FnZXM6IGZ1bmN0aW9uKCRzdGF0ZVBhcmFtcywgTWVzc2FnZXNIZXJlRmFjdG9yeSkge1xuICAgICAgICBcdHJldHVybiBNZXNzYWdlc0hlcmVGYWN0b3J5LmluYm94SGVyZSgkc3RhdGVQYXJhbXMuaWQsICRzdGF0ZVBhcmFtcy5sb24sICRzdGF0ZVBhcmFtcy5sYXQpXG4gICAgICAgIFx0fVxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLmZhY3RvcnkoJ01lc3NhZ2VzSGVyZUZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCkge1xuXHRcblx0dmFyIE1lc3NhZ2VzSGVyZUZhY3RvcnkgPSB7fTtcblxuXHRNZXNzYWdlc0hlcmVGYWN0b3J5LmluYm94SGVyZSA9IGZ1bmN0aW9uKGlkLCBsb24sIGxhdCkge1xuXHRcdGNvbnNvbGUubG9nKGxvbiArIFwiIFwiICsgbGF0KTtcblx0XHRyZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL21lc3NhZ2VzL3RvLycgKyBpZCArICc/bG9uPScgKyBsb24gKyAnJmxhdD0nICsgbGF0KVxuXHRcdC50aGVuKGZ1bmN0aW9uKHJlcykge1xuXHRcdFx0Y29uc29sZS5sb2coXCJyZXMuZGF0YTogXCIsIHJlcy5kYXRhKVxuXHRcdFx0cmV0dXJuIHJlcy5kYXRhO1xuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIE1lc3NhZ2VzSGVyZUZhY3Rvcnk7XG59KVxuXG5hcHAuY29udHJvbGxlcignTWVzc2FnZXNIZXJlQ29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgQXV0aFNlcnZpY2UsIE1lc3NhZ2VzSGVyZUZhY3RvcnksIGFsbE1lc3NhZ2VzKSB7XG5cblx0JHNjb3BlLmN1cnJlbnRVc2VyID0ge307XG5cblx0QXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50VXNlciA9IHVzZXI7XG4gICAgfSlcblxuXHQkc2NvcGUuYWxsTWVzc2FnZXMgPSBhbGxNZXNzYWdlcztcblxufSlcblxuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbm90aWZpY2F0aW9ucycsIHtcbiAgICAgICAgdXJsOiAnL25vdGlmaWNhdGlvbnMnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL3NlZS1tc2cvc2VlLm1zZy5odG1sJ1xuICAgIH0pO1xufSk7XG4iLCJhcHAuZmFjdG9yeSgnRnVsbHN0YWNrUGljcycsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gW1xuICAgICAgICAnaHR0cHM6Ly9wYnMudHdpbWcuY29tL21lZGlhL0I3Z0JYdWxDQUFBWFFjRS5qcGc6bGFyZ2UnLFxuICAgICAgICAnaHR0cHM6Ly9mYmNkbi1zcGhvdG9zLWMtYS5ha2FtYWloZC5uZXQvaHBob3Rvcy1hay14YXAxL3QzMS4wLTgvMTA4NjI0NTFfMTAyMDU2MjI5OTAzNTkyNDFfODAyNzE2ODg0MzMxMjg0MTEzN19vLmpwZycsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQi1MS1VzaElnQUV5OVNLLmpwZycsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjc5LVg3b0NNQUFrdzd5LmpwZycsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQi1VajlDT0lJQUlGQWgwLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjZ5SXlGaUNFQUFxbDEyLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0UtVDc1bFdBQUFtcXFKLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0V2WkFnLVZBQUFrOTMyLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0VnTk1lT1hJQUlmRGhLLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0VReUlETldnQUF1NjBCLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0NGM1Q1UVc4QUUybEdKLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0FlVnc1U1dvQUFBTHNqLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0FhSklQN1VrQUFsSUdzLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0FRT3c5bFdFQUFZOUZsLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQi1PUWJWckNNQUFOd0lNLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjliX2Vyd0NZQUF3UmNKLnBuZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjVQVGR2bkNjQUVBbDR4LmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjRxd0MwaUNZQUFsUEdoLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjJiMzN2UklVQUE5bzFELmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQndwSXdyMUlVQUF2TzJfLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQnNTc2VBTkNZQUVPaEx3LmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0o0dkxmdVV3QUFkYTRMLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0k3d3pqRVZFQUFPUHBTLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0lkSHZUMlVzQUFubkhWLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0dDaVBfWVdZQUFvNzVWLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQ0lTNEpQSVdJQUkzN3F1LmpwZzpsYXJnZSdcbiAgICBdO1xufSk7XG4iLCJhcHAuZmFjdG9yeSgnUmFuZG9tR3JlZXRpbmdzJywgZnVuY3Rpb24gKCkge1xuXG5cbiAgICB2YXIgZ2V0UmFuZG9tRnJvbUFycmF5ID0gZnVuY3Rpb24gKGFycikge1xuICAgICAgICByZXR1cm4gYXJyW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpXTtcbiAgICB9O1xuXG5cbiAgICB2YXIgZ3JlZXRpbmdzID0gW1xuICAgICAgICAnSGVsbG8sIHdvcmxkIScsXG4gICAgICAgICdBdCBsb25nIGxhc3QsIEkgbGl2ZSEnLFxuICAgICAgICAnSGVsbG8sIHNpbXBsZSBodW1hbi4nLFxuICAgICAgICAnV2hhdCBhIGJlYXV0aWZ1bCBkYXkhJyxcbiAgICAgICAgJ0lcXCdtIGxpa2UgYW55IG90aGVyIHByb2plY3QsIGV4Y2VwdCB0aGF0IEkgYW0geW91cnMuIDopJyxcbiAgICAgICAgJ1RoaXMgZW1wdHkgc3RyaW5nIGlzIGZvciBMaW5kc2F5IExldmluZS4nLFxuICAgICAgICAn44GT44KT44Gr44Gh44Gv44CB44Om44O844K244O85qeY44CCJyxcbiAgICAgICAgJ1dlbGNvbWUuIFRvLiBXRUJTSVRFLicsXG4gICAgICAgICc6RCcsXG4gICAgICAgICdZZXMsIEkgdGhpbmsgd2VcXCd2ZSBtZXQgYmVmb3JlLicsXG4gICAgICAgICdHaW1tZSAzIG1pbnMuLi4gSSBqdXN0IGdyYWJiZWQgdGhpcyByZWFsbHkgZG9wZSBmcml0dGF0YScsXG4gICAgICAgICdJZiBDb29wZXIgY291bGQgb2ZmZXIgb25seSBvbmUgcGllY2Ugb2YgYWR2aWNlLCBpdCB3b3VsZCBiZSB0byBuZXZTUVVJUlJFTCEnLFxuICAgIF07XG5cbiAgICB2YXIgZ2V0TG9jYXRpb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24oZGF0YSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhXG4gICAgICAgICAgICB9KVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGdyZWV0aW5nczogZ3JlZXRpbmdzLFxuICAgICAgICBnZXRSYW5kb21HcmVldGluZzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldFJhbmRvbUZyb21BcnJheShncmVldGluZ3MpO1xuICAgICAgICB9LFxuXG4gICAgICAgIGdldExvY2F0aW9uOiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgcmV0dXJuIGdldExvY2F0aW9uKCk7XG4gICAgICAgIFxuICAgICAgICB9LCBcblxuXG4gICAgfTtcblxufSk7XG5cblxuXG5cblxuIiwiYXBwLmRpcmVjdGl2ZSgnZnVsbHN0YWNrTG9nbycsIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL2Z1bGxzdGFjay1sb2dvL2Z1bGxzdGFjay1sb2dvLmh0bWwnXG4gICAgfTtcbn0pOyIsImFwcC5kaXJlY3RpdmUoJ25hdmJhcicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBdXRoU2VydmljZSwgQVVUSF9FVkVOVFMsICRzdGF0ZSkge1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgcmVzdHJpY3Q6ICdFJyxcbiAgICAgICAgc2NvcGU6IHt9LFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2NvbW1vbi9kaXJlY3RpdmVzL25hdmJhci9uYXZiYXIuaHRtbCcsXG4gICAgICAgIGxpbms6IGZ1bmN0aW9uIChzY29wZSkge1xuXG4gICAgICAgICAgICBzY29wZS5pdGVtcyA9IFtcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnSG9tZScsIHN0YXRlOiAnaG9tZScgfSxcbiAgICAgICAgICAgICAgICB7IGxhYmVsOiAnQWJvdXQnLCBzdGF0ZTogJ2Fib3V0JyB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdEb2N1bWVudGF0aW9uJywgc3RhdGU6ICdkb2NzJyB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdNZW1iZXJzIE9ubHknLCBzdGF0ZTogJ21lbWJlcnNPbmx5JywgYXV0aDogdHJ1ZSB9XG4gICAgICAgICAgICBdO1xuXG4gICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcblxuICAgICAgICAgICAgc2NvcGUuaXNMb2dnZWRJbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzY29wZS5sb2dvdXQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgQXV0aFNlcnZpY2UubG9nb3V0KCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgJHN0YXRlLmdvKCdob21lJyk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgc2V0VXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5nZXRMb2dnZWRJblVzZXIoKS50aGVuKGZ1bmN0aW9uICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIHNjb3BlLnVzZXIgPSB1c2VyO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgdmFyIHJlbW92ZVVzZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IG51bGw7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzZXRVc2VyKCk7XG5cbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ2luU3VjY2Vzcywgc2V0VXNlcik7XG4gICAgICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzLCByZW1vdmVVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0LCByZW1vdmVVc2VyKTtcblxuICAgICAgICB9XG5cbiAgICB9O1xuXG59KTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
