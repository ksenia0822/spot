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









