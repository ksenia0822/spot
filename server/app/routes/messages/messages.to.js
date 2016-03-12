'use strict';

// /messages/to

var router = require('express').Router({mergeParams: true});
module.exports = router;
var mongoose = require('mongoose');
var User = mongoose.model('User');
var Message = mongoose.model('Message');

// /messages/to/userID
router.get('/:id', function(req, res, next) {
	console.log(req.query);
	var longitude, latitude;
	if(req.query.lon && req.query.lat) {
		longitude = Number(req.query.lon);
		latitude = Number(req.query.lat);		
	} else {
		longitude = Number(0);
		latitude = Number(0);	
	}

	console.log(longitude, latitude);
	Message.getInLocationForOne(req.params.id, [longitude, latitude])
	.then(function(msgs) {
		res.send(msgs)
	})
	.then(null, next)
})