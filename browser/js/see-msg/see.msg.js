app.config(function ($stateProvider) {
    $stateProvider.state('messagesHere', {
        url: '/messages/to/:id?lon&lat',
        // url: '/messages/here/:id',
        templateUrl: 'js/see-msg/see.msg.html', 
        controller:'MessagesHereController', 
        resolve: {
        	allMessages: function($stateParams, MessagesHereFactory) {
        	return MessagesHereFactory.inboxHere($stateParams.id, $stateParams.lon, $stateParams.lat)
        	}
        }
    });
});

app.factory('MessagesHereFactory', function($http) {
	
	var MessagesHereFactory = {};

	MessagesHereFactory.inboxHere = function(id, lon, lat) {
		console.log(lon + " " + lat);
		return $http.get('/api/messages/to/' + id + '?lon=' + lon + '&lat=' + lat)
		.then(function(res) {
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

