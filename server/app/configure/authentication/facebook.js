'use strict';
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var mongoose = require('mongoose');
var UserModel = mongoose.model('User');

module.exports = function (app) {

    var facebookConfig = app.getValue('env').FACEBOOK;

    // var facebookCredentials = {
    //     clientID: facebookConfig.clientID,
    //     clientSecret: facebookConfig.clientSecret,
    //     callbackURL: facebookConfig.callbackURL
    // };

    var facebookCredentials = {
        clientID: "1562697910708276",
        clientSecret: "53953a811be6327cffb4c8b35be00c0b",
        callbackURL: "http://127.0.0.1:1337/auth/facebook/callback"
    };

    var verifyCallback = function (accessToken, refreshToken, profile, done) {
        console.log(profile)

        UserModel.findOne({ 'facebook.id': profile.id }).exec()
            .then(function (user) {

                if (user) {
                    return user;
                } else {
                    return UserModel.create({
                        facebook: {
                            id: profile.id
                        }
                    });
                }

            }).then(function (userToLogin) {
                done(null, userToLogin);
            }, function (err) {
                console.error('Error creating user from Facebook authentication', err);
                done(err);
            })

    };

    passport.use(new FacebookStrategy(facebookCredentials, verifyCallback));

    app.get('/auth/facebook', passport.authenticate('facebook', {scope: ['public_profile',  'email'] }));

    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', { failureRedirect: '/login', successRedirect: '/main' }),
        function (req, res) {
            res.redirect('/');
        });

};
