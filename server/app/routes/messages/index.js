'use strict';

var router = require('express').Router();
module.exports = router;
var mongoose = require('mongoose');
var Message = mongoose.model('Message');
var Promise = require('bluebird');

router.use('/to', require('./messages.to'));

// Passed query
router.get('/', function(req, res, next){
  Message.find()
  .then(function(allMessages){
    res.json(allMessages);
  })
  .then(null, next);
});

router.post('/', function(req, res, next){
  Message.create(req.body)
  .then(function(message) {
    res.json(message)
  })
  .then(null, next);
});

router.delete('/', function(req, res, next){
  Message.remove({})
  .then(function(msg) {
    res.json(msg)
  })
  .then(null, next);
});

router.param('id', function(req, res, next, id){
  Message.findById(id)
  .then(function(message){
    req.message = message;
    next();
  })
});

router.route('/:id')
//update one message
  .put(function(req, res, next){
    req.Message.set(req.body);
    req.Message.save()
    .then(function(updatedMessage){
      res.json(updatedMessage)
    })
    .then(null, next)
  })
//delete one message
  .delete(function(req, res, next){
    req.message.remove()
    .then(function(response){
      res.send(response);
    })
    .then(null, next)
  });