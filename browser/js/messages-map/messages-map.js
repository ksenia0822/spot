app.config(function ($stateProvider) {
    $stateProvider.state('messages-map', {
        url: '/messages-map/:id?lon&lat',
        templateUrl: 'js/messages-map/messages-map.html', 
        controller: 'MapController'
    });
});

app.config(function(uiGmapGoogleMapApiProvider) {
    uiGmapGoogleMapApiProvider.configure({
        key: 'AIzaSyC1Mt5PaZY_ZRi0HADXDlBEsKL7yhwmEv4',
        v: '3.20',
        libraries: 'weather,geometry,visualization'
    });
})

app.controller("MapController", function($scope, uiGmapGoogleMapApi, $stateParams) {
    console.log($stateParams)
	$scope.map = { 
        center: { 
            // latitude: 40.7180007, longitude: -73.9620894 
            latitude: $stateParams.lat, longitude: $stateParams.lon
        }, 
        zoom: 14,

    };
    $scope.marker = {
      id: 0,
      coords: {
        latitude: $stateParams.lat,
        longitude: $stateParams.lon
      }
      // events: {
      //   dragend: function (marker, eventName, args) {
      //     $log.log('marker dragend');
      //     var lat = marker.getPosition().lat();
      //     var lon = marker.getPosition().lng();
      //     $log.log(lat);
      //     $log.log(lon);

      //     $scope.marker.options = {
      //       draggable: true,
      //       labelContent: "lat: " + $scope.marker.coords.latitude + ' ' + 'lon: ' + $scope.marker.coords.longitude,
      //       labelAnchor: "100 0",
      //       labelClass: "marker-labels"
      //     };
      //   }
      // }
    };
	
    uiGmapGoogleMapApi
    .then(function(maps) {
    });

});

/*
var marker = {
                    id: Date.now(),
                    coords: {
                        latitude: lat,
                        longitude: lon
                    }
                };
                $scope.map.markers.push(marker);
*/




