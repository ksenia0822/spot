'use strict';

var router = require('express').Router({mergeParams: true});
module.exports = router;
var mongoose = require('mongoose');
var User = mongoose.model('User');

// get all friends of the user
router.get("/", function (req, res, next) {
	User.findById(req.params.id)
	.populate('friends') 
	.then(function(user){
		res.send(user.friends)
	})
	.then(null, next)
})