'use strict';
var crypto = require('crypto');
var mongoose = require('mongoose');
var _ = require('lodash');

var messageSchema = new mongoose.Schema({
    date: { 
        type: Date, 
        default: Date.now, 
        required: true
    },
    location: {
        type: {type: String, default: 'Point' },
        coordinates: [Number]
    },
    subject: {
        type: String, 
        default: "No Subject"
    },
    body: {
        type: String, 
        required: true
    }, 
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }, 
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    } 
});

messageSchema.index({
    location: '2dsphere'
});

//get all messages from 1 user:
messageSchema.statics.getAllWhereSender = function(senderId) {
    return this.find({from: senderId})
    .populate('from to')
}

messageSchema.statics.getInLocationForOne = function(id, coords) {
    return this.find({
        to: id, 
        location: {
            $near: {
                $geometry : {type : "Point", coordinates : coords},
                $maxDistance : 70
            }
        }
    })
    .populate('to from')
}





mongoose.model('Message', messageSchema);


