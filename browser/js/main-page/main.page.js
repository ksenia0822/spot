app.config(function ($stateProvider) {
    $stateProvider.state('main', {
        url: '/main/:id',
        templateUrl: 'js/main-page/main.page.html', 
        controller: 'MainPageController'
    });
});

app.controller('MainPageController', function($scope, AuthService) {
    $scope.currentUser = {};
    $scope.currentLocation = [];

    $scope.getMyLocation = function() {
        $scope.getLocation();
    }

    AuthService.getLoggedInUser()
    .then(function(user) {
        $scope.currentUser = user;
    })

    $scope.getLocation = function() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition($scope.getPosition, $scope.getError);
      } else {
        $scope.currentLocation = [0, 0];
      }
    }

    $scope.getPosition = function(position) {
        $scope.currentLocation = [position.coords.longitude, position.coords.latitude]
        return $scope.currentLocation;   
    }

    $scope.getError = function(error) {
        if(error) {
            throw new Error();
        }
    }

    $scope.getLocation();


})


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
