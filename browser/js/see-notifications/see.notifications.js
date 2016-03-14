app.config(function ($stateProvider) {
    $stateProvider.state('notifications', {
        url: '/notifications/:id',
        templateUrl: 'js/see-notifications/see.notifications.html', 
        controller: 'NotificationsController',
        resolve: {
        	allMessages: function($stateParams, NotificationsFactory) {
        		return NotificationsFactory.getAllMessages($stateParams.id)
        	}
        }
    });
});

app.factory('NotificationsFactory', function($http) {
	var NotificationsFactory = {};

	NotificationsFactory.getAllMessages = function(id) {
		return $http.get('api/messages/to/all/' + id)
		.then(function(res) {
			return res.data;
		});
	}
	return NotificationsFactory;
})

app.controller('NotificationsController', function($scope, allMessages) {
	 $scope.allMessages = allMessages;

     // console.log($scope.allMessages[0].location.coordinates[0])

})
