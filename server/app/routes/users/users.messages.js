// 'use strict';

// // users/:id/messages

// var router = require('express').Router({mergeParams: true});
// module.exports = router;
// var mongoose = require('mongoose');
// var User = mongoose.model('User');
// var Message = mongoose.model('Message');


// router.get('/here', function(req, res, next) {
// 	Message.getInLocationForOne(req.params.id)
// 	.then(function(msgs) {
// 		res.send(msgs)
// 	})
// 	.then(null, next)
// })