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
    $scope.currentLocaton = [5, 6];

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
        console.log("current location: ", $scope.currentLocation);
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

// app.factory('LocationFactory', function() {

//  var LocationFactory = {};

//  LocationFactory.getLocation = function() {
//    if (navigator.geolocation) {
//      navigator.geolocation.getCurrentPosition(function (position) {
//         var currentLocation = [position.coords.latitude, position.coords.longitude]
//          return currentLocation;
//         }, function (error) {
//             if(error) {
//             throw new Error();
//          }
//      });
//    }
//  }

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
        // url: '/messages/here/:id?lon&lat',
        url: '/messages/here/:id',
        templateUrl: 'js/see-msg/see.msg.html',
        controller: 'MessagesHereController',
        resolve: {
            allMessages: function allMessages($stateParams, MessagesHereFactory) {
                return MessagesHereFactory.inboxHere($stateParams.id);
            }
        }
    });
});

app.factory('MessagesHereFactory', function ($http) {

    var MessagesHereFactory = {};
    var curLoc = getLocation();

    function getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(getPosition, getError);
        }
    }

    function getPosition(position) {
        curLoc = [position.coords.longitude, position.coords.latitude];
        console.log("this is my location: ", curLoc[0], curLoc[1]);
        return curLoc;
    }

    function getError(error) {
        if (error) {
            throw new Error();
        }
    }

    MessagesHereFactory.inboxHere = function (id) {
        return $http.get('/api/messages/to/' + id + '?lon=' + curLoc[0] + '&lat=' + curLoc[1]).then(function (res) {
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

app.factory('LocationFactory', function () {

    var LocationFactory = {};
    var currentLocation = [];

    LocationFactory.getLocation = function () {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                var currentLocation = [position.coords.latitude, position.coords.longitude];
                return currentLocation;
            }, function (error) {
                if (error) {
                    throw new Error();
                }
            });
        }
    };

    return LocationFactory;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImFwcC5qcyIsImFib3V0L2Fib3V0LmpzIiwiZG9jcy9kb2NzLmpzIiwiZnNhL2ZzYS1wcmUtYnVpbHQuanMiLCJsZWF2ZS1tZXNzYWdlL2xlYXZlLW1lc3NhZ2UuanMiLCJsb2dpbi9sb2dpbi5qcyIsIm1haW4tcGFnZS9tYWluLnBhZ2UuanMiLCJtZW1iZXJzLW9ubHkvbWVtYmVycy1vbmx5LmpzIiwic2VlLW1zZy9zZWUubXNnLmpzIiwic2VlLW5vdGlmaWNhdGlvbnMvc2VlLm5vdGlmaWNhdGlvbnMuanMiLCJjb21tb24vZmFjdG9yaWVzL0Z1bGxzdGFja1BpY3MuanMiLCJjb21tb24vZmFjdG9yaWVzL1JhbmRvbUdyZWV0aW5ncy5qcyIsImNvbW1vbi9kaXJlY3RpdmVzL2Z1bGxzdGFjay1sb2dvL2Z1bGxzdGFjay1sb2dvLmpzIiwiY29tbW9uL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUFDQSxPQUFBLEdBQUEsR0FBQSxRQUFBLE1BQUEsQ0FBQSx1QkFBQSxFQUFBLENBQUEsYUFBQSxFQUFBLFdBQUEsRUFBQSxjQUFBLEVBQUEsV0FBQSxDQUFBLENBQUE7O0FBRUEsSUFBQSxNQUFBLENBQUEsVUFBQSxrQkFBQSxFQUFBLGlCQUFBLEVBQUE7O0FBRUEsc0JBQUEsU0FBQSxDQUFBLElBQUE7O0FBRkEsc0JBSUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxFQUpBO0NBQUEsQ0FBQTs7O0FBUUEsSUFBQSxHQUFBLENBQUEsVUFBQSxVQUFBLEVBQUEsV0FBQSxFQUFBLE1BQUEsRUFBQTs7O0FBR0EsUUFBQSwrQkFBQSxTQUFBLDRCQUFBLENBQUEsS0FBQSxFQUFBO0FBQ0EsZUFBQSxNQUFBLElBQUEsSUFBQSxNQUFBLElBQUEsQ0FBQSxZQUFBLENBREE7S0FBQTs7OztBQUhBLGNBU0EsQ0FBQSxHQUFBLENBQUEsbUJBQUEsRUFBQSxVQUFBLEtBQUEsRUFBQSxPQUFBLEVBQUEsUUFBQSxFQUFBOztB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Q0FBQSxDQUFBOztBQWFBLElBQUEsT0FBQSxDQUFBLHFCQUFBLEVBQUEsVUFBQSxLQUFBLEVBQUE7O0FBRUEsUUFBQSxzQkFBQSxFQUFBLENBRkE7O0FBSUEsd0JBQUEsVUFBQSxHQUFBLFVBQUEsRUFBQSxFQUFBO0FBQ0EsZUFBQSxNQUFBLEdBQUEsQ0FBQSxnQkFBQSxFQUFBLEdBQUEsVUFBQSxDQUFBLENBQ0EsSUFEQSxDQUNBLFVBQUEsR0FBQSxFQUFBO0FBQ0EsbUJBQUEsSUFBQSxJQUFBLENBREE7U0FBQSxDQURBLENBREE7S0FBQSxDQUpBOztBQVdBLHdCQUFBLFlBQUEsR0FBQSxVQUFBLE1BQUEsRUFBQTtBQUNBLGVBQUEsTUFBQSxJQUFBLENBQUEsZUFBQSxFQUFBLE1BQUEsRUFDQSxJQURBLENBQ0EsVUFBQSxHQUFBLEVBQUE7QUFDQSxtQkFBQSxJQUFBLElBQUEsQ0FEQTtTQUFBLENBREEsQ0FEQTtLQUFBLENBWEE7O0FBa0JBLFdBQUEsbUJBQUEsQ0FsQkE7Q0FBQSxDQUFBOztBQXlCQSxJQUFBLFVBQUEsQ0FBQSx3QkFBQSxFQUFBLFVBQUEsTUFBQSxFQUFBLFdBQUEsRUFBQSxVQUFBLEVBQUEsbUJBQUEsRUFBQTtBQUNBLFdBQUEsV0FBQSxHQUFBLEVBQUEsQ0FEQTs7QUFHQSxXQUFBLFVBQUEsR0FBQTtBQUNBLGtCQUFBO0FBQ0EseUJBQUEsRUFBQTtTQURBO0tBREEsQ0FIQTs7QUFTQSxnQkFBQSxlQUFBLEdBQ0EsSUFEQSxDQUNBLFVBQUEsSUFBQSxFQUFBO0FBQ0EsZUFBQSxXQUFBLEdBQUEsSUFBQSxDQURBO0FBRUEsZUFBQSxVQUFBLENBQUEsSUFBQSxHQUFBLE9BQUEsV0FBQSxDQUFBLEdBQUEsQ0FGQTtLQUFBLENBREEsQ0FUQTs7QUFlQSxXQUFBLFVBQUEsR0FBQSxVQUFBLENBZkE7O0FBaUJBLFdBQUEsWUFBQSxHQUFBLFVBQUEsR0FBQSxFQUFBO0FBQ0EsZ0JBQUEsR0FBQSxDQUFBLEdBQUEsRUFEQTtBQUVBLDRCQUFBLFlBQUEsQ0FBQSxHQUFBLEVBRkE7S0FBQSxD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QUFBLEdBQUEsQ0FBQSxZQUFBLGFBQUEsRUFBQSxVQUFBLEVBbENBO0FBbUNBLHVCQUFBLEdBQUEsQ0FBQSxZQUFBLGNBQUEsRUFBQSxVQUFBLEVBbkNBO1NBQUE7O0tBSkEsQ0FGQTtDQUFBLENBQUEiLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcbndpbmRvdy5hcHAgPSBhbmd1bGFyLm1vZHVsZSgnRnVsbHN0YWNrR2VuZXJhdGVkQXBwJywgWydmc2FQcmVCdWlsdCcsICd1aS5yb3V0ZXInLCAndWkuYm9vdHN0cmFwJywgJ25nQW5pbWF0ZSddKTtcblxuYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHVybFJvdXRlclByb3ZpZGVyLCAkbG9jYXRpb25Qcm92aWRlcikge1xuICAgIC8vIFRoaXMgdHVybnMgb2ZmIGhhc2hiYW5nIHVybHMgKC8jYWJvdXQpIGFuZCBjaGFuZ2VzIGl0IHRvIHNvbWV0aGluZyBub3JtYWwgKC9hYm91dClcbiAgICAkbG9jYXRpb25Qcm92aWRlci5odG1sNU1vZGUodHJ1ZSk7XG4gICAgLy8gSWYgd2UgZ28gdG8gYSBVUkwgdGhhdCB1aS1yb3V0ZXIgZG9lc24ndCBoYXZlIHJlZ2lzdGVyZWQsIGdvIHRvIHRoZSBcIi9cIiB1cmwuXG4gICAgJHVybFJvdXRlclByb3ZpZGVyLm90aGVyd2lzZSgnLycpO1xufSk7XG5cbi8vIFRoaXMgYXBwLnJ1biBpcyBmb3IgY29udHJvbGxpbmcgYWNjZXNzIHRvIHNwZWNpZmljIHN0YXRlcy5cbmFwcC5ydW4oZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCAkc3RhdGUpIHtcblxuICAgIC8vIFRoZSBnaXZlbiBzdGF0ZSByZXF1aXJlcyBhbiBhdXRoZW50aWNhdGVkIHVzZXIuXG4gICAgdmFyIGRlc3RpbmF0aW9uU3RhdGVSZXF1aXJlc0F1dGggPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICAgICAgcmV0dXJuIHN0YXRlLmRhdGEgJiYgc3RhdGUuZGF0YS5hdXRoZW50aWNhdGU7XG4gICAgfTtcblxuICAgIC8vICRzdGF0ZUNoYW5nZVN0YXJ0IGlzIGFuIGV2ZW50IGZpcmVkXG4gICAgLy8gd2hlbmV2ZXIgdGhlIHByb2Nlc3Mgb2YgY2hhbmdpbmcgYSBzdGF0ZSBiZWdpbnMuXG4gICAgJHJvb3RTY29wZS4kb24oJyRzdGF0ZUNoYW5nZVN0YXJ0JywgZnVuY3Rpb24gKGV2ZW50LCB0b1N0YXRlLCB0b1BhcmFtcykge1xuXG4gICAgICAgIGlmICghZGVzdGluYXRpb25TdGF0ZVJlcXVpcmVzQXV0aCh0b1N0YXRlKSkge1xuICAgICAgICAgICAgLy8gVGhlIGRlc3RpbmF0aW9uIHN0YXRlIGRvZXMgbm90IHJlcXVpcmUgYXV0aGVudGljYXRpb25cbiAgICAgICAgICAgIC8vIFNob3J0IGNpcmN1aXQgd2l0aCByZXR1cm4uXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXV0aFNlcnZpY2UuaXNBdXRoZW50aWNhdGVkKCkpIHtcbiAgICAgICAgICAgIC8vIFRoZSB1c2VyIGlzIGF1dGhlbnRpY2F0ZWQuXG4gICAgICAgICAgICAvLyBTaG9ydCBjaXJjdWl0IHdpdGggcmV0dXJuLlxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ2FuY2VsIG5hdmlnYXRpbmcgdG8gbmV3IHN0YXRlLlxuICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgIC8vIElmIGEgdXNlciBpcyByZXRyaWV2ZWQsIHRoZW4gcmVuYXZpZ2F0ZSB0byB0aGUgZGVzdGluYXRpb25cbiAgICAgICAgICAgIC8vICh0aGUgc2Vjb25kIHRpbWUsIEF1dGhTZXJ2aWNlLmlzQXV0aGVudGljYXRlZCgpIHdpbGwgd29yaylcbiAgICAgICAgICAgIC8vIG90aGVyd2lzZSwgaWYgbm8gdXNlciBpcyBsb2dnZWQgaW4sIGdvIHRvIFwibG9naW5cIiBzdGF0ZS5cbiAgICAgICAgICAgIGlmICh1c2VyKSB7XG4gICAgICAgICAgICAgICAgJHN0YXRlLmdvKHRvU3RhdGUubmFtZSwgdG9QYXJhbXMpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2xvZ2luJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgfSk7XG5cbn0pO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcblxuICAgIC8vIFJlZ2lzdGVyIG91ciAqYWJvdXQqIHN0YXRlLlxuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdhYm91dCcsIHtcbiAgICAgICAgdXJsOiAnL2Fib3V0JyxcbiAgICAgICAgY29udHJvbGxlcjogJ0Fib3V0Q29udHJvbGxlcicsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvYWJvdXQvYWJvdXQuaHRtbCdcbiAgICB9KTtcblxufSk7XG5cbmFwcC5jb250cm9sbGVyKCdBYm91dENvbnRyb2xsZXInLCBmdW5jdGlvbiAoJHNjb3BlLCBGdWxsc3RhY2tQaWNzKSB7XG5cbiAgICAvLyBJbWFnZXMgb2YgYmVhdXRpZnVsIEZ1bGxzdGFjayBwZW9wbGUuXG4gICAgJHNjb3BlLmltYWdlcyA9IF8uc2h1ZmZsZShGdWxsc3RhY2tQaWNzKTtcblxufSk7IiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnZG9jcycsIHtcbiAgICAgICAgdXJsOiAnL2RvY3MnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL2RvY3MvZG9jcy5odG1sJ1xuICAgIH0pO1xufSk7XG4iLCIoZnVuY3Rpb24gKCkge1xuXG4gICAgJ3VzZSBzdHJpY3QnO1xuXG4gICAgLy8gSG9wZSB5b3UgZGlkbid0IGZvcmdldCBBbmd1bGFyISBEdWgtZG95LlxuICAgIGlmICghd2luZG93LmFuZ3VsYXIpIHRocm93IG5ldyBFcnJvcignSSBjYW5cXCd0IGZpbmQgQW5ndWxhciEnKTtcblxuICAgIHZhciBhcHAgPSBhbmd1bGFyLm1vZHVsZSgnZnNhUHJlQnVpbHQnLCBbXSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnU29ja2V0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIXdpbmRvdy5pbykgdGhyb3cgbmV3IEVycm9yKCdzb2NrZXQuaW8gbm90IGZvdW5kIScpO1xuICAgICAgICByZXR1cm4gd2luZG93LmlvKHdpbmRvdy5sb2NhdGlvbi5vcmlnaW4pO1xuICAgIH0pO1xuXG4gICAgLy8gQVVUSF9FVkVOVFMgaXMgdXNlZCB0aHJvdWdob3V0IG91ciBhcHAgdG9cbiAgICAvLyBicm9hZGNhc3QgYW5kIGxpc3RlbiBmcm9tIGFuZCB0byB0aGUgJHJvb3RTY29wZVxuICAgIC8vIGZvciBpbXBvcnRhbnQgZXZlbnRzIGFib3V0IGF1dGhlbnRpY2F0aW9uIGZsb3cuXG4gICAgYXBwLmNvbnN0YW50KCdBVVRIX0VWRU5UUycsIHtcbiAgICAgICAgbG9naW5TdWNjZXNzOiAnYXV0aC1sb2dpbi1zdWNjZXNzJyxcbiAgICAgICAgbG9naW5GYWlsZWQ6ICdhdXRoLWxvZ2luLWZhaWxlZCcsXG4gICAgICAgIGxvZ291dFN1Y2Nlc3M6ICdhdXRoLWxvZ291dC1zdWNjZXNzJyxcbiAgICAgICAgc2Vzc2lvblRpbWVvdXQ6ICdhdXRoLXNlc3Npb24tdGltZW91dCcsXG4gICAgICAgIG5vdEF1dGhlbnRpY2F0ZWQ6ICdhdXRoLW5vdC1hdXRoZW50aWNhdGVkJyxcbiAgICAgICAgbm90QXV0aG9yaXplZDogJ2F1dGgtbm90LWF1dGhvcml6ZWQnXG4gICAgfSk7XG5cbiAgICBhcHAuZmFjdG9yeSgnQXV0aEludGVyY2VwdG9yJywgZnVuY3Rpb24gKCRyb290U2NvcGUsICRxLCBBVVRIX0VWRU5UUykge1xuICAgICAgICB2YXIgc3RhdHVzRGljdCA9IHtcbiAgICAgICAgICAgIDQwMTogQVVUSF9FVkVOVFMubm90QXV0aGVudGljYXRlZCxcbiAgICAgICAgICAgIDQwMzogQVVUSF9FVkVOVFMubm90QXV0aG9yaXplZCxcbiAgICAgICAgICAgIDQxOTogQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsXG4gICAgICAgICAgICA0NDA6IEFVVEhfRVZFTlRTLnNlc3Npb25UaW1lb3V0XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICByZXNwb25zZUVycm9yOiBmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgICAgICAkcm9vdFNjb3BlLiRicm9hZGNhc3Qoc3RhdHVzRGljdFtyZXNwb25zZS5zdGF0dXNdLCByZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLnJlamVjdChyZXNwb25zZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9KTtcblxuICAgIGFwcC5jb25maWcoZnVuY3Rpb24gKCRodHRwUHJvdmlkZXIpIHtcbiAgICAgICAgJGh0dHBQcm92aWRlci5pbnRlcmNlcHRvcnMucHVzaChbXG4gICAgICAgICAgICAnJGluamVjdG9yJyxcbiAgICAgICAgICAgIGZ1bmN0aW9uICgkaW5qZWN0b3IpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJGluamVjdG9yLmdldCgnQXV0aEludGVyY2VwdG9yJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIF0pO1xuICAgIH0pO1xuXG4gICAgYXBwLnNlcnZpY2UoJ0F1dGhTZXJ2aWNlJywgZnVuY3Rpb24gKCRodHRwLCBTZXNzaW9uLCAkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUywgJHEpIHtcblxuICAgICAgICBmdW5jdGlvbiBvblN1Y2Nlc3NmdWxMb2dpbihyZXNwb25zZSkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSByZXNwb25zZS5kYXRhO1xuICAgICAgICAgICAgU2Vzc2lvbi5jcmVhdGUoZGF0YS5pZCwgZGF0YS51c2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dpblN1Y2Nlc3MpO1xuICAgICAgICAgICAgcmV0dXJuIGRhdGEudXNlcjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFVzZXMgdGhlIHNlc3Npb24gZmFjdG9yeSB0byBzZWUgaWYgYW5cbiAgICAgICAgLy8gYXV0aGVudGljYXRlZCB1c2VyIGlzIGN1cnJlbnRseSByZWdpc3RlcmVkLlxuICAgICAgICB0aGlzLmlzQXV0aGVudGljYXRlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiAhIVNlc3Npb24udXNlcjtcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlciA9IGZ1bmN0aW9uIChmcm9tU2VydmVyKSB7XG5cbiAgICAgICAgICAgIC8vIElmIGFuIGF1dGhlbnRpY2F0ZWQgc2Vzc2lvbiBleGlzdHMsIHdlXG4gICAgICAgICAgICAvLyByZXR1cm4gdGhlIHVzZXIgYXR0YWNoZWQgdG8gdGhhdCBzZXNzaW9uXG4gICAgICAgICAgICAvLyB3aXRoIGEgcHJvbWlzZS4gVGhpcyBlbnN1cmVzIHRoYXQgd2UgY2FuXG4gICAgICAgICAgICAvLyBhbHdheXMgaW50ZXJmYWNlIHdpdGggdGhpcyBtZXRob2QgYXN5bmNocm9ub3VzbHkuXG5cbiAgICAgICAgICAgIC8vIE9wdGlvbmFsbHksIGlmIHRydWUgaXMgZ2l2ZW4gYXMgdGhlIGZyb21TZXJ2ZXIgcGFyYW1ldGVyLFxuICAgICAgICAgICAgLy8gdGhlbiB0aGlzIGNhY2hlZCB2YWx1ZSB3aWxsIG5vdCBiZSB1c2VkLlxuXG4gICAgICAgICAgICBpZiAodGhpcy5pc0F1dGhlbnRpY2F0ZWQoKSAmJiBmcm9tU2VydmVyICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuICRxLndoZW4oU2Vzc2lvbi51c2VyKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWFrZSByZXF1ZXN0IEdFVCAvc2Vzc2lvbi5cbiAgICAgICAgICAgIC8vIElmIGl0IHJldHVybnMgYSB1c2VyLCBjYWxsIG9uU3VjY2Vzc2Z1bExvZ2luIHdpdGggdGhlIHJlc3BvbnNlLlxuICAgICAgICAgICAgLy8gSWYgaXQgcmV0dXJucyBhIDQwMSByZXNwb25zZSwgd2UgY2F0Y2ggaXQgYW5kIGluc3RlYWQgcmVzb2x2ZSB0byBudWxsLlxuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL3Nlc3Npb24nKS50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKS5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZ2V0VXNlcklkID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLmdldExvZ2dlZEluVXNlcigpXG4gICAgICAgICAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHVzZXIuX2lkXG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5sb2dpbiA9IGZ1bmN0aW9uIChjcmVkZW50aWFscykge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLnBvc3QoJy9sb2dpbicsIGNyZWRlbnRpYWxzKVxuICAgICAgICAgICAgICAgIC50aGVuKG9uU3VjY2Vzc2Z1bExvZ2luKVxuICAgICAgICAgICAgICAgIC5jYXRjaChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAkcS5yZWplY3QoeyBtZXNzYWdlOiAnSW52YWxpZCBsb2dpbiBjcmVkZW50aWFscy4nIH0pO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMubG9nb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuICRodHRwLmdldCgnL2xvZ291dCcpLnRoZW4oZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIFNlc3Npb24uZGVzdHJveSgpO1xuICAgICAgICAgICAgICAgICRyb290U2NvcGUuJGJyb2FkY2FzdChBVVRIX0VWRU5UUy5sb2dvdXRTdWNjZXNzKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9O1xuXG4gICAgfSk7XG5cbiAgICBhcHAuc2VydmljZSgnU2Vzc2lvbicsIGZ1bmN0aW9uICgkcm9vdFNjb3BlLCBBVVRIX0VWRU5UUykge1xuXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgICAgICAkcm9vdFNjb3BlLiRvbihBVVRIX0VWRU5UUy5ub3RBdXRoZW50aWNhdGVkLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBzZWxmLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmlkID0gbnVsbDtcbiAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcblxuICAgICAgICB0aGlzLmNyZWF0ZSA9IGZ1bmN0aW9uIChzZXNzaW9uSWQsIHVzZXIpIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBzZXNzaW9uSWQ7XG4gICAgICAgICAgICB0aGlzLnVzZXIgPSB1c2VyO1xuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRoaXMuaWQgPSBudWxsO1xuICAgICAgICAgICAgdGhpcy51c2VyID0gbnVsbDtcbiAgICAgICAgfTtcblxuICAgIH0pO1xuXG59KSgpO1xuIiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbGVhdmVNZXNzYWdlJywge1xuICAgICAgICB1cmw6ICcvbGVhdmVtZXNzYWdlLzppZCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbGVhdmUtbWVzc2FnZS9sZWF2ZS1tZXNzYWdlLmh0bWwnLCBcbiAgICAgICAgY29udHJvbGxlcjogXCJMZWF2ZU1lc3NhZ2VDb250cm9sbGVyXCIsXG4gICAgICAgIHJlc29sdmU6IHtcbiAgICAgICAgXHRhbGxGcmllbmRzOiBmdW5jdGlvbiAoJHN0YXRlUGFyYW1zLCBMZWF2ZU1lc3NhZ2VGYWN0b3J5KSB7XG4gICAgICAgIFx0XHRyZXR1cm4gTGVhdmVNZXNzYWdlRmFjdG9yeS5nZXRGcmllbmRzKCRzdGF0ZVBhcmFtcy5pZCk7XG4gICAgICAgIFx0fVxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLmZhY3RvcnkoXCJMZWF2ZU1lc3NhZ2VGYWN0b3J5XCIsIGZ1bmN0aW9uKCRodHRwKSB7XG5cblx0dmFyIExlYXZlTWVzc2FnZUZhY3RvcnkgPSB7fTtcblxuXHRMZWF2ZU1lc3NhZ2VGYWN0b3J5LmdldEZyaWVuZHMgPSBmdW5jdGlvbihpZCkge1xuXHRcdHJldHVybiAkaHR0cC5nZXQoJy9hcGkvdXNlcnMvJyArIGlkICsgJy9mcmllbmRzJylcbiBcdFx0LnRoZW4oZnVuY3Rpb24ocmVzKXtcbiBcdFx0XHRyZXR1cm4gcmVzLmRhdGE7XG4gXHRcdH0pO1xuXHR9O1xuXG5cdExlYXZlTWVzc2FnZUZhY3RvcnkubGVhdmVNZXNzYWdlID0gZnVuY3Rpb24obmV3TXNnKSB7XG5cdFx0cmV0dXJuICRodHRwLnBvc3QoJy9hcGkvbWVzc2FnZXMnLCBuZXdNc2cpXG5cdFx0LnRoZW4oZnVuY3Rpb24ocmVzKSB7XG5cdFx0XHRyZXR1cm4gcmVzLmRhdGE7XG5cdFx0fSlcblx0fTtcblxuXHRyZXR1cm4gTGVhdmVNZXNzYWdlRmFjdG9yeTtcbn0pO1xuXG5cblxuXG5cbmFwcC5jb250cm9sbGVyKCdMZWF2ZU1lc3NhZ2VDb250cm9sbGVyJywgZnVuY3Rpb24oJHNjb3BlLCBBdXRoU2VydmljZSwgYWxsRnJpZW5kcywgTGVhdmVNZXNzYWdlRmFjdG9yeSkge1xuXHQkc2NvcGUuY3VycmVudFVzZXIgPSB7fTtcblxuXHQkc2NvcGUubmV3TWVzc2FnZSA9IHtcblx0XHRsb2NhdGlvbjoge1xuXHRcdFx0Y29vcmRpbmF0ZXM6IFtdXG5cdFx0fVxuXHR9O1xuXG5cdEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpXG5cdC50aGVuKGZ1bmN0aW9uKHVzZXIpIHtcblx0XHQkc2NvcGUuY3VycmVudFVzZXIgPSB1c2VyO1xuXHRcdCRzY29wZS5uZXdNZXNzYWdlLmZyb20gPSAkc2NvcGUuY3VycmVudFVzZXIuX2lkXG5cdH0pXG5cblx0JHNjb3BlLmFsbEZyaWVuZHMgPSBhbGxGcmllbmRzO1xuXG5cdCRzY29wZS5sZWF2ZU1lc3NhZ2UgPSBmdW5jdGlvbihtc2cpIHtcblx0XHRjb25zb2xlLmxvZyhtc2cpXG5cdFx0TGVhdmVNZXNzYWdlRmFjdG9yeS5sZWF2ZU1lc3NhZ2UobXNnKVxuXHR9O1xuXG5cdCRzY29wZS5nZXRMb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuXHQgIGlmIChuYXZpZ2F0b3IuZ2VvbG9jYXRpb24pIHtcblx0ICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oJHNjb3BlLmdldFBvc2l0aW9uLCAkc2NvcGUuZ2V0RXJyb3IpO1xuXHQgIH0gZWxzZSB7XG5cdCAgICAkc2NvcGUubmV3TWVzc2FnZS5sb2NhdGlvbi5jb29yZGluYXRlcyA9IFswLCAwXTtcblx0ICB9XG5cdH1cblxuXHQkc2NvcGUuZ2V0UG9zaXRpb24gPSBmdW5jdGlvbihwb3NpdGlvbikge1xuIFx0XHQkc2NvcGUubmV3TWVzc2FnZS5sb2NhdGlvbi5jb29yZGluYXRlcyA9IFtwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlLCBwb3NpdGlvbi5jb29yZHMubGF0aXR1ZGVdXG4gXHR9XG5cbiBcdCRzY29wZS5nZXRFcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gXHRcdGlmKGVycm9yKSB7XG4gXHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG4gXHRcdH1cbiBcdH1cblxuIFx0JHNjb3BlLmdldExvY2F0aW9uKCk7XG5cdFxuXG59KVxuXG5cblxuXG5cblxuXG5cblxuXG5cblxuXG5cbiIsImFwcC5jb25maWcoZnVuY3Rpb24gKCRzdGF0ZVByb3ZpZGVyKSB7XG5cbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbG9naW4nLCB7XG4gICAgICAgIHVybDogJy9sb2dpbicsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvbG9naW4vbG9naW4uaHRtbCcsXG4gICAgICAgIGNvbnRyb2xsZXI6ICdMb2dpbkN0cmwnXG4gICAgfSk7XG5cbn0pO1xuXG5hcHAuY29udHJvbGxlcignTG9naW5DdHJsJywgZnVuY3Rpb24gKCRzY29wZSwgQXV0aFNlcnZpY2UsICRzdGF0ZSkge1xuXG4gICAgJHNjb3BlLmxvZ2luID0ge307XG4gICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICRzY29wZS5zZW5kTG9naW4gPSBmdW5jdGlvbiAobG9naW5JbmZvKSB7XG5cbiAgICAgICAgJHNjb3BlLmVycm9yID0gbnVsbDtcblxuICAgICAgICBBdXRoU2VydmljZS5sb2dpbihsb2dpbkluZm8pLnRoZW4oZnVuY3Rpb24gKGN1cnJlbnRVc2VyKSB7XG4gICAgICAgICAgICAkc3RhdGUuZ28oJ21haW4nLCB7aWQ6IGN1cnJlbnRVc2VyLl9pZH0pO1xuICAgICAgICAgICAgLy8gJHN0YXRlLmdvKCdob21lJywge2lkOiBjdXJyZW50VXNlci5faWR9KTtcbiAgICAgICAgfSkuY2F0Y2goZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgJHNjb3BlLmVycm9yID0gJ0ludmFsaWQgbG9naW4gY3JlZGVudGlhbHMuJztcbiAgICAgICAgfSk7XG5cbiAgICB9O1xuXG59KTsiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdtYWluJywge1xuICAgICAgICB1cmw6ICcvbWFpbi86aWQnLFxuICAgICAgICB0ZW1wbGF0ZVVybDogJ2pzL21haW4tcGFnZS9tYWluLnBhZ2UuaHRtbCcsIFxuICAgICAgICBjb250cm9sbGVyOiAnTWFpblBhZ2VDb250cm9sbGVyJ1xuICAgIH0pO1xufSk7XG5cbmFwcC5jb250cm9sbGVyKCdNYWluUGFnZUNvbnRyb2xsZXInLCBmdW5jdGlvbigkc2NvcGUsIEF1dGhTZXJ2aWNlKSB7XG4gICAgJHNjb3BlLmN1cnJlbnRVc2VyID0ge307XG4gICAgJHNjb3BlLmN1cnJlbnRMb2NhdG9uID0gWzUsIDZdO1xuICAgIFxuXG4gICAgQXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50VXNlciA9IHVzZXI7XG4gICAgfSlcblxuICAgICRzY29wZS5nZXRMb2NhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKG5hdmlnYXRvci5nZW9sb2NhdGlvbikge1xuICAgICAgICBuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uZ2V0Q3VycmVudFBvc2l0aW9uKCRzY29wZS5nZXRQb3NpdGlvbiwgJHNjb3BlLmdldEVycm9yKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50TG9jYXRpb24gPSBbMCwgMF07XG4gICAgICB9XG4gICAgfVxuXG4gICAgJHNjb3BlLmdldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbiAgICAgICAgJHNjb3BlLmN1cnJlbnRMb2NhdGlvbiA9IFtwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlLCBwb3NpdGlvbi5jb29yZHMubGF0aXR1ZGVdXG4gICAgICAgIHJldHVybiAkc2NvcGUuY3VycmVudExvY2F0aW9uO1xuICAgICAgICBjb25zb2xlLmxvZyhcImN1cnJlbnQgbG9jYXRpb246IFwiLCAkc2NvcGUuY3VycmVudExvY2F0aW9uKVxuICAgIH1cblxuICAgICRzY29wZS5nZXRFcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4gICAgICAgIGlmKGVycm9yKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgICRzY29wZS5nZXRMb2NhdGlvbigpO1xuXG5cbn0pXG5cblxuLy8gYXBwLmZhY3RvcnkoJ0xvY2F0aW9uRmFjdG9yeScsIGZ1bmN0aW9uKCkge1xuXG4vLyAgdmFyIExvY2F0aW9uRmFjdG9yeSA9IHt9O1xuXG4vLyAgTG9jYXRpb25GYWN0b3J5LmdldExvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4vLyAgICBpZiAobmF2aWdhdG9yLmdlb2xvY2F0aW9uKSB7XG4vLyAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oTG9jYXRpb25GYWN0b3J5LmdldFBvc2l0aW9uLCBMb2NhdGlvbkZhY3RvcnkuZ2V0RXJyb3IpO1xuLy8gICAgfSBlbHNlIHtcbi8vICAgICAgIHZhciBjdXJyZW50TG9jYXRpb24gPSBbMCwwXTtcbi8vICAgICAgIHJldHVybiBjdXJyZW50TG9jYXRpb247XG4vLyAgICB9XG4vLyAgfVxuXG4vLyAgTG9jYXRpb25GYWN0b3J5LmdldFBvc2l0aW9uID0gZnVuY3Rpb24ocG9zaXRpb24pIHtcbi8vICAgICAgICAgIHZhciBjdXJyZW50TG9jYXRpb24gPSBbcG9zaXRpb24uY29vcmRzLmxhdGl0dWRlLCBwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlXVxuLy8gICAgICAgICAgcmV0dXJuIGN1cnJlbnRMb2NhdGlvbjtcbi8vICAgICAgfVxuXG4vLyAgICAgIExvY2F0aW9uRmFjdG9yeS5nZXRFcnJvciA9IGZ1bmN0aW9uKGVycm9yKSB7XG4vLyAgICAgICAgICBpZihlcnJvcikge1xuLy8gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuLy8gICAgICAgICAgfVxuLy8gICAgICB9XG5cbi8vICAgICAgcmV0dXJuIExvY2F0aW9uRmFjdG9yeTtcblxuLy8gfSlcblxuLy8gYXBwLmZhY3RvcnkoJ0xvY2F0aW9uRmFjdG9yeScsIGZ1bmN0aW9uKCkge1xuXG4vLyAgdmFyIExvY2F0aW9uRmFjdG9yeSA9IHt9O1xuXG4vLyAgTG9jYXRpb25GYWN0b3J5LmdldExvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4vLyAgICBpZiAobmF2aWdhdG9yLmdlb2xvY2F0aW9uKSB7XG4vLyAgICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24gKHBvc2l0aW9uKSB7XG4vLyAgICAgICAgIHZhciBjdXJyZW50TG9jYXRpb24gPSBbcG9zaXRpb24uY29vcmRzLmxhdGl0dWRlLCBwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlXVxuLy8gICAgICAgICAgcmV0dXJuIGN1cnJlbnRMb2NhdGlvbjtcbi8vICAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4vLyAgICAgICAgICAgICBpZihlcnJvcikge1xuLy8gICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4vLyAgICAgICAgICB9XG4vLyAgICAgIH0pO1xuLy8gICAgfSBcbi8vICB9XG5cbi8vICAgICAgcmV0dXJuIExvY2F0aW9uRmFjdG9yeTtcblxuLy8gfSkiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuXG4gICAgJHN0YXRlUHJvdmlkZXIuc3RhdGUoJ21lbWJlcnNPbmx5Jywge1xuICAgICAgICB1cmw6ICcvbWVtYmVycy1hcmVhJyxcbiAgICAgICAgdGVtcGxhdGU6ICc8aW1nIG5nLXJlcGVhdD1cIml0ZW0gaW4gc3Rhc2hcIiB3aWR0aD1cIjMwMFwiIG5nLXNyYz1cInt7IGl0ZW0gfX1cIiAvPicsXG4gICAgICAgIGNvbnRyb2xsZXI6IGZ1bmN0aW9uICgkc2NvcGUsIFNlY3JldFN0YXNoKSB7XG4gICAgICAgICAgICBTZWNyZXRTdGFzaC5nZXRTdGFzaCgpLnRoZW4oZnVuY3Rpb24gKHN0YXNoKSB7XG4gICAgICAgICAgICAgICAgJHNjb3BlLnN0YXNoID0gc3Rhc2g7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgLy8gVGhlIGZvbGxvd2luZyBkYXRhLmF1dGhlbnRpY2F0ZSBpcyByZWFkIGJ5IGFuIGV2ZW50IGxpc3RlbmVyXG4gICAgICAgIC8vIHRoYXQgY29udHJvbHMgYWNjZXNzIHRvIHRoaXMgc3RhdGUuIFJlZmVyIHRvIGFwcC5qcy5cbiAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgYXV0aGVudGljYXRlOiB0cnVlXG4gICAgICAgIH1cbiAgICB9KTtcblxufSk7XG5cbmFwcC5mYWN0b3J5KCdTZWNyZXRTdGFzaCcsIGZ1bmN0aW9uICgkaHR0cCkge1xuXG4gICAgdmFyIGdldFN0YXNoID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJGh0dHAuZ2V0KCcvYXBpL21lbWJlcnMvc2VjcmV0LXN0YXNoJykudGhlbihmdW5jdGlvbiAocmVzcG9uc2UpIHtcbiAgICAgICAgICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZ2V0U3Rhc2g6IGdldFN0YXNoXG4gICAgfTtcblxufSk7IiwiYXBwLmNvbmZpZyhmdW5jdGlvbiAoJHN0YXRlUHJvdmlkZXIpIHtcbiAgICAkc3RhdGVQcm92aWRlci5zdGF0ZSgnbWVzc2FnZXNIZXJlJywge1xuICAgICAgICAvLyB1cmw6ICcvbWVzc2FnZXMvaGVyZS86aWQ/bG9uJmxhdCcsXG4gICAgICAgIHVybDogJy9tZXNzYWdlcy9oZXJlLzppZCcsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvc2VlLW1zZy9zZWUubXNnLmh0bWwnLCBcbiAgICAgICAgY29udHJvbGxlcjonTWVzc2FnZXNIZXJlQ29udHJvbGxlcicsIFxuICAgICAgICByZXNvbHZlOiB7XG4gICAgICAgIFx0YWxsTWVzc2FnZXM6IGZ1bmN0aW9uKCRzdGF0ZVBhcmFtcywgTWVzc2FnZXNIZXJlRmFjdG9yeSkge1xuICAgICAgICBcdHJldHVybiBNZXNzYWdlc0hlcmVGYWN0b3J5LmluYm94SGVyZSgkc3RhdGVQYXJhbXMuaWQpXG4gICAgICAgIFx0fVxuICAgICAgICB9XG4gICAgfSk7XG59KTtcblxuYXBwLmZhY3RvcnkoJ01lc3NhZ2VzSGVyZUZhY3RvcnknLCBmdW5jdGlvbigkaHR0cCkge1xuXHRcblx0dmFyIE1lc3NhZ2VzSGVyZUZhY3RvcnkgPSB7fTtcblx0dmFyIGN1ckxvYyA9IGdldExvY2F0aW9uKCk7XG5cblx0ZnVuY3Rpb24gZ2V0TG9jYXRpb24oKSB7XG5cdFx0aWYgKG5hdmlnYXRvci5nZW9sb2NhdGlvbikge1xuXHQgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihnZXRQb3NpdGlvbiwgZ2V0RXJyb3IpO1xuXHQgIH1cblx0fVxuXG5cdGZ1bmN0aW9uIGdldFBvc2l0aW9uKHBvc2l0aW9uKSB7XG4gXHRcdGN1ckxvYyA9IFtwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlLCBwb3NpdGlvbi5jb29yZHMubGF0aXR1ZGVdXG4gXHRcdGNvbnNvbGUubG9nKFwidGhpcyBpcyBteSBsb2NhdGlvbjogXCIsIGN1ckxvY1swXSwgY3VyTG9jWzFdKVxuIFx0XHRyZXR1cm4gY3VyTG9jO1xuIFx0fVxuXG4gXHRmdW5jdGlvbiBnZXRFcnJvciAoZXJyb3IpIHtcbiBcdFx0aWYoZXJyb3IpIHtcbiBcdFx0XHR0aHJvdyBuZXcgRXJyb3IoKTtcbiBcdFx0fVxuIFx0fVxuXG5cblxuXHRNZXNzYWdlc0hlcmVGYWN0b3J5LmluYm94SGVyZSA9IGZ1bmN0aW9uKGlkKSB7XG5cdFx0cmV0dXJuICRodHRwLmdldCgnL2FwaS9tZXNzYWdlcy90by8nICsgaWQgKyAnP2xvbj0nICsgY3VyTG9jWzBdICsgJyZsYXQ9JyArIGN1ckxvY1sxXSlcblx0XHQudGhlbihmdW5jdGlvbihyZXMpIHtcblx0XHRcdGNvbnNvbGUubG9nKFwicmVzLmRhdGE6IFwiLCByZXMuZGF0YSlcblx0XHRcdHJldHVybiByZXMuZGF0YTtcblx0XHR9KTtcblx0fVxuXG5cblx0cmV0dXJuIE1lc3NhZ2VzSGVyZUZhY3Rvcnk7XG59KVxuXG5hcHAuY29udHJvbGxlcignTWVzc2FnZXNIZXJlQ29udHJvbGxlcicsIGZ1bmN0aW9uKCRzY29wZSwgQXV0aFNlcnZpY2UsIE1lc3NhZ2VzSGVyZUZhY3RvcnksIGFsbE1lc3NhZ2VzKSB7XG5cblx0JHNjb3BlLmN1cnJlbnRVc2VyID0ge307XG5cblx0QXV0aFNlcnZpY2UuZ2V0TG9nZ2VkSW5Vc2VyKClcbiAgICAudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgICRzY29wZS5jdXJyZW50VXNlciA9IHVzZXI7XG4gICAgfSlcblxuXHQkc2NvcGUuYWxsTWVzc2FnZXMgPSBhbGxNZXNzYWdlcztcblxufSlcblxuXG5hcHAuZmFjdG9yeSgnTG9jYXRpb25GYWN0b3J5JywgZnVuY3Rpb24oKSB7XG5cbiB2YXIgTG9jYXRpb25GYWN0b3J5ID0ge307XG4gdmFyIGN1cnJlbnRMb2NhdGlvbiA9IFtdO1xuXG4gTG9jYXRpb25GYWN0b3J5LmdldExvY2F0aW9uID0gZnVuY3Rpb24oKSB7XG4gICBpZiAobmF2aWdhdG9yLmdlb2xvY2F0aW9uKSB7XG4gICAgIG5hdmlnYXRvci5nZW9sb2NhdGlvbi5nZXRDdXJyZW50UG9zaXRpb24oZnVuY3Rpb24gKHBvc2l0aW9uKSB7XG4gICAgICAgIHZhciBjdXJyZW50TG9jYXRpb24gPSBbcG9zaXRpb24uY29vcmRzLmxhdGl0dWRlLCBwb3NpdGlvbi5jb29yZHMubG9uZ2l0dWRlXVxuICAgICAgICAgcmV0dXJuIGN1cnJlbnRMb2NhdGlvbjtcbiAgICAgICAgfSwgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICBpZihlcnJvcikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCk7XG4gICAgICAgICB9XG4gICAgIH0pO1xuICAgfSBcbiB9XG5cbiAgICAgcmV0dXJuIExvY2F0aW9uRmFjdG9yeTtcblxufSkiLCJhcHAuY29uZmlnKGZ1bmN0aW9uICgkc3RhdGVQcm92aWRlcikge1xuICAgICRzdGF0ZVByb3ZpZGVyLnN0YXRlKCdub3RpZmljYXRpb25zJywge1xuICAgICAgICB1cmw6ICcvbm90aWZpY2F0aW9ucycsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvc2VlLW1zZy9zZWUubXNnLmh0bWwnXG4gICAgfSk7XG59KTtcbiIsImFwcC5mYWN0b3J5KCdGdWxsc3RhY2tQaWNzJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBbXG4gICAgICAgICdodHRwczovL3Bicy50d2ltZy5jb20vbWVkaWEvQjdnQlh1bENBQUFYUWNFLmpwZzpsYXJnZScsXG4gICAgICAgICdodHRwczovL2ZiY2RuLXNwaG90b3MtYy1hLmFrYW1haWhkLm5ldC9ocGhvdG9zLWFrLXhhcDEvdDMxLjAtOC8xMDg2MjQ1MV8xMDIwNTYyMjk5MDM1OTI0MV84MDI3MTY4ODQzMzEyODQxMTM3X28uanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLUxLVXNoSWdBRXk5U0suanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNzktWDdvQ01BQWt3N3kuanBnJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLVVqOUNPSUlBSUZBaDAuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNnlJeUZpQ0VBQXFsMTIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRS1UNzVsV0FBQW1xcUouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRXZaQWctVkFBQWs5MzIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRWdOTWVPWElBSWZEaEsuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DRVF5SUROV2dBQXU2MEIuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQ0YzVDVRVzhBRTJsR0ouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQWVWdzVTV29BQUFMc2ouanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQWFKSVA3VWtBQWxJR3MuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DQVFPdzlsV0VBQVk5RmwuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CLU9RYlZyQ01BQU53SU0uanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9COWJfZXJ3Q1lBQXdSY0oucG5nOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNVBUZHZuQ2NBRUFsNHguanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CNHF3QzBpQ1lBQWxQR2guanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9CMmIzM3ZSSVVBQTlvMUQuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9Cd3BJd3IxSVVBQXZPMl8uanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9Cc1NzZUFOQ1lBRU9oTHcuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSjR2TGZ1VXdBQWRhNEwuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSTd3empFVkVBQU9QcFMuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSWRIdlQyVXNBQW5uSFYuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DR0NpUF9ZV1lBQW83NVYuanBnOmxhcmdlJyxcbiAgICAgICAgJ2h0dHBzOi8vcGJzLnR3aW1nLmNvbS9tZWRpYS9DSVM0SlBJV0lBSTM3cXUuanBnOmxhcmdlJ1xuICAgIF07XG59KTtcbiIsImFwcC5mYWN0b3J5KCdSYW5kb21HcmVldGluZ3MnLCBmdW5jdGlvbiAoKSB7XG5cblxuICAgIHZhciBnZXRSYW5kb21Gcm9tQXJyYXkgPSBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgIHJldHVybiBhcnJbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogYXJyLmxlbmd0aCldO1xuICAgIH07XG5cblxuICAgIHZhciBncmVldGluZ3MgPSBbXG4gICAgICAgICdIZWxsbywgd29ybGQhJyxcbiAgICAgICAgJ0F0IGxvbmcgbGFzdCwgSSBsaXZlIScsXG4gICAgICAgICdIZWxsbywgc2ltcGxlIGh1bWFuLicsXG4gICAgICAgICdXaGF0IGEgYmVhdXRpZnVsIGRheSEnLFxuICAgICAgICAnSVxcJ20gbGlrZSBhbnkgb3RoZXIgcHJvamVjdCwgZXhjZXB0IHRoYXQgSSBhbSB5b3Vycy4gOiknLFxuICAgICAgICAnVGhpcyBlbXB0eSBzdHJpbmcgaXMgZm9yIExpbmRzYXkgTGV2aW5lLicsXG4gICAgICAgICfjgZPjgpPjgavjgaHjga/jgIHjg6bjg7zjgrbjg7zmp5jjgIInLFxuICAgICAgICAnV2VsY29tZS4gVG8uIFdFQlNJVEUuJyxcbiAgICAgICAgJzpEJyxcbiAgICAgICAgJ1llcywgSSB0aGluayB3ZVxcJ3ZlIG1ldCBiZWZvcmUuJyxcbiAgICAgICAgJ0dpbW1lIDMgbWlucy4uLiBJIGp1c3QgZ3JhYmJlZCB0aGlzIHJlYWxseSBkb3BlIGZyaXR0YXRhJyxcbiAgICAgICAgJ0lmIENvb3BlciBjb3VsZCBvZmZlciBvbmx5IG9uZSBwaWVjZSBvZiBhZHZpY2UsIGl0IHdvdWxkIGJlIHRvIG5ldlNRVUlSUkVMIScsXG4gICAgXTtcblxuICAgIHZhciBnZXRMb2NhdGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbmF2aWdhdG9yLmdlb2xvY2F0aW9uLmdldEN1cnJlbnRQb3NpdGlvbihmdW5jdGlvbihkYXRhKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGRhdGFcbiAgICAgICAgICAgIH0pXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZ3JlZXRpbmdzOiBncmVldGluZ3MsXG4gICAgICAgIGdldFJhbmRvbUdyZWV0aW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0UmFuZG9tRnJvbUFycmF5KGdyZWV0aW5ncyk7XG4gICAgICAgIH0sXG5cbiAgICAgICAgZ2V0TG9jYXRpb246IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgXG4gICAgICAgICAgICByZXR1cm4gZ2V0TG9jYXRpb24oKTtcbiAgICAgICAgXG4gICAgICAgIH0sIFxuXG5cbiAgICB9O1xuXG59KTtcblxuXG5cblxuXG4iLCJhcHAuZGlyZWN0aXZlKCdmdWxsc3RhY2tMb2dvJywgZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB7XG4gICAgICAgIHJlc3RyaWN0OiAnRScsXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvZnVsbHN0YWNrLWxvZ28vZnVsbHN0YWNrLWxvZ28uaHRtbCdcbiAgICB9O1xufSk7IiwiYXBwLmRpcmVjdGl2ZSgnbmF2YmFyJywgZnVuY3Rpb24gKCRyb290U2NvcGUsIEF1dGhTZXJ2aWNlLCBBVVRIX0VWRU5UUywgJHN0YXRlKSB7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICByZXN0cmljdDogJ0UnLFxuICAgICAgICBzY29wZToge30sXG4gICAgICAgIHRlbXBsYXRlVXJsOiAnanMvY29tbW9uL2RpcmVjdGl2ZXMvbmF2YmFyL25hdmJhci5odG1sJyxcbiAgICAgICAgbGluazogZnVuY3Rpb24gKHNjb3BlKSB7XG5cbiAgICAgICAgICAgIHNjb3BlLml0ZW1zID0gW1xuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdIb21lJywgc3RhdGU6ICdob21lJyB9LFxuICAgICAgICAgICAgICAgIHsgbGFiZWw6ICdBYm91dCcsIHN0YXRlOiAnYWJvdXQnIH0sXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ0RvY3VtZW50YXRpb24nLCBzdGF0ZTogJ2RvY3MnIH0sXG4gICAgICAgICAgICAgICAgeyBsYWJlbDogJ01lbWJlcnMgT25seScsIHN0YXRlOiAnbWVtYmVyc09ubHknLCBhdXRoOiB0cnVlIH1cbiAgICAgICAgICAgIF07XG5cbiAgICAgICAgICAgIHNjb3BlLnVzZXIgPSBudWxsO1xuXG4gICAgICAgICAgICBzY29wZS5pc0xvZ2dlZEluID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBBdXRoU2VydmljZS5pc0F1dGhlbnRpY2F0ZWQoKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNjb3BlLmxvZ291dCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBBdXRoU2VydmljZS5sb2dvdXQoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICAgICAkc3RhdGUuZ28oJ2hvbWUnKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHZhciBzZXRVc2VyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIEF1dGhTZXJ2aWNlLmdldExvZ2dlZEluVXNlcigpLnRoZW4oZnVuY3Rpb24gKHVzZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgc2NvcGUudXNlciA9IHVzZXI7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICB2YXIgcmVtb3ZlVXNlciA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICBzY29wZS51c2VyID0gbnVsbDtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHNldFVzZXIoKTtcblxuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMubG9naW5TdWNjZXNzLCBzZXRVc2VyKTtcbiAgICAgICAgICAgICRyb290U2NvcGUuJG9uKEFVVEhfRVZFTlRTLmxvZ291dFN1Y2Nlc3MsIHJlbW92ZVVzZXIpO1xuICAgICAgICAgICAgJHJvb3RTY29wZS4kb24oQVVUSF9FVkVOVFMuc2Vzc2lvblRpbWVvdXQsIHJlbW92ZVVzZXIpO1xuXG4gICAgICAgIH1cblxuICAgIH07XG5cbn0pO1xuIl0sInNvdXJjZVJvb3QiOiIvc291cmNlLyJ9
