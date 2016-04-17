// app.config(function ($stateProvider) {
//     $stateProvider.state('messages-map', {
//         url: '/messages-map/:id?lon&lat',
//         templateUrl: 'js/messages-map/messages-map.html', 
//         controller: 'MapController'
//     });
// });

// app.config(function(uiGmapGoogleMapApiProvider) {
//     uiGmapGoogleMapApiProvider.configure({
//         key: 'AIzaSyC1Mt5PaZY_ZRi0HADXDlBEsKL7yhwmEv4',
//         v: '3.20',
//         libraries: 'weather,geometry,visualization'
//     });
// })

// app.controller("MapController", function($scope, uiGmapGoogleMapApi, $stateParams) {
//     console.log($stateParams)
// 	$scope.map = { 
//         center: { 
//             latitude: $stateParams.lat, longitude: $stateParams.lon
//         }, 
//         zoom: 14,

//     };
//     $scope.marker = {
//       id: 0,
//       coords: {
//         latitude: $stateParams.lat,
//         longitude: $stateParams.lon
//       }
//     };
	
//     uiGmapGoogleMapApi
//     .then(function(maps) {
//     });

// });



