/*

This seed file is only a placeholder. It should be expanded and altered
to fit the development of your application.

It uses the same file the server uses to establish
the database connection:
--- server/db/index.js

The name of the database used is set in your environment files:
--- server/env/*

This seed file has a safety check to see if you already have users
in the database. If you are developing multiple applications with the
fsg scaffolding, keep in mind that fsg always uses the same database
name in the environment files.

*/

var mongoose = require('mongoose');
var Promise = require('bluebird');
var chalk = require('chalk');
var connectToDb = require('./server/db');
// var User = Promise.promisifyAll(mongoose.model('User'));
var chance = require('chance')(123);
var _ = require('lodash');
var User = mongoose.model('User');
var Message = mongoose.model('Message');


var seedUsers = function () {

    var users = [
        {
            email: 'testing@fsa.com',
            password: 'password'
        },
        {
            email: 'obama@gmail.com',
            password: 'potus'
        }
    ];

    return User.createAsync(users);

};
var numLocations  = 5;
var numMessages = 50;
var users = ["56e0f5d51e10c2d215d2a716",  
            "56e0e2db03531ad2141607b4",
            "56e0e2db03531ad2141607b5",
            "56e0e2db03531ad2141607b6",
            "56e0e2db03531ad2141607b7"]

var locations = _.times(numLocations, function() {
        return chance.coordinates();
    })

var newLoc = locations.forEach(function(loc) {
    var arr = loc.split(" ")
    parseInt(arr[0])
    parseInt(arr[1])
    return loc
})

function randMessage() {
    return new Message({
        date: chance.date(),
        loc: parseInt(locations[0], 10),
        subject: chance.word(),
        body: chance.sentence(), 
        to: chance.pickone(users),
        from: chance.pickone(users)
    })
}

function generateAllMessages() {
    var msgs = _.times(numMessages, function() {
        return randMessage();
    })
    return msgs;
}

function seedMessages() {
    var docs = generateAllMessages();
        return Promise.map(docs, function(doc) {
            return doc.save();
        })
}
connectToDb
.then(function(db){
    db.drop = Promise.promisify(db.db.dropDatabase.bind(db.db));
    db.drop()
    .then(function () {
        console.log('database successfully dropped, about to seed')
        return Promise.all([
            seedMessages() 
        ])
    })
    .then(function () {
        console.log('Seeding successful');
    }, function (err) {
        console.error('Error while seeding');
        console.error(err.stack);
    })
    .then(function () {
        process.exit();
    });
})
