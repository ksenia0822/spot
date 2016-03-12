app.config(function ($stateProvider) {
    $stateProvider.state('leaveMessage', {
        url: '/leavemessage/:id',
        templateUrl: 'js/leave-message/leave-message.html', 
        controller: "LeaveMessageController",
        resolve: {
        	allFriends: function ($stateParams, LeaveMessageFactory) {
        		return LeaveMessageFactory.getFriends($stateParams.id);
        	}
        }
    });
});

app.factory("LeaveMessageFactory", function($http) {

	var LeaveMessageFactory = {};

	LeaveMessageFactory.getFriends = function(id) {
		return $http.get('/api/users/' + id + '/friends')
 		.then(function(res){
 			return res.data;
 		});
	};

	LeaveMessageFactory.leaveMessage = function(newMsg) {
		return $http.post('/api/messages', newMsg)
		.then(function(res) {
			return res.data;
		})
	};

	return LeaveMessageFactory;
});

app.controller('LeaveMessageController', function($scope, AuthService, allFriends, LeaveMessageFactory) {
	$scope.currentUser = {};

	$scope.newMessage = {
		location: {
			coordinates: []
		}
	};

	AuthService.getLoggedInUser()
	.then(function(user) {
		$scope.currentUser = user;
		$scope.newMessage.from = $scope.currentUser._id
	})

	$scope.allFriends = allFriends;

	$scope.leaveMessage = function(msg) {
		console.log(msg)
		LeaveMessageFactory.leaveMessage(msg)
	};

	$scope.getLocation = function() {
	  if (navigator.geolocation) {
	    navigator.geolocation.getCurrentPosition($scope.getPosition, $scope.getError);
	  } else {
	    $scope.newMessage.location.coordinates = [0, 0];
	  }
	}

	$scope.getPosition = function(position) {
 		$scope.newMessage.location.coordinates = [position.coords.longitude, position.coords.latitude]
 	}

 	$scope.getError = function(error) {
 		if(error) {
 			throw new Error();
 		}
 	}

 	$scope.getLocation();
	

})














