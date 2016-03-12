app.config(function ($stateProvider) {
    $stateProvider.state('messagesHere', {
        // url: '/messages/here/:id?lon&lat',
        url: '/messages/here/:id',
        templateUrl: 'js/see-msg/see.msg.html', 
        controller:'MessagesHereController', 
        resolve: {
        	allMessages: function($stateParams, MessagesHereFactory) {
        	return MessagesHereFactory.inboxHere($stateParams.id)
        	}
        }
    });
});

app.factory('MessagesHereFactory', function($http) {
	
	var MessagesHereFactory = {};
	var curLoc = getLocation();

	function getLocation() {
		if (navigator.geolocation) {
	    navigator.geolocation.getCurrentPosition(getPosition, getError);
	  }
	}

	function getPosition(position) {
 		curLoc = [position.coords.longitude, position.coords.latitude]
 		console.log("this is my location: ", curLoc[0], curLoc[1])
 		return curLoc;
 	}

 	function getError (error) {
 		if(error) {
 			throw new Error();
 		}
 	}



	MessagesHereFactory.inboxHere = function(id) {
		return $http.get('/api/messages/to/' + id + '?lon=' + curLoc[0] + '&lat=' + curLoc[1])
		.then(function(res) {
			console.log("res.data: ", res.data)
			return res.data;
		});
	}


	return MessagesHereFactory;
})

app.controller('MessagesHereController', function($scope, AuthService, MessagesHereFactory, allMessages) {

	$scope.currentUser = {};

	AuthService.getLoggedInUser()
    .then(function(user) {
        $scope.currentUser = user;
    })

	$scope.allMessages = allMessages;

})


app.factory('LocationFactory', function() {

 var LocationFactory = {};
 var currentLocation = [];

 LocationFactory.getLocation = function() {
   if (navigator.geolocation) {
     navigator.geolocation.getCurrentPosition(function (position) {
        var currentLocation = [position.coords.latitude, position.coords.longitude]
         return currentLocation;
        }, function (error) {
            if(error) {
            throw new Error();
         }
     });
   } 
 }

     return LocationFactory;

})