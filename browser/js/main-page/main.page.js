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


