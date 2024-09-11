const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;

const GOOGLE_CLIENT_ID = "234758678387-i57d6ed6qtal6ees2ti845dr33rlpirk.apps.googleusercontent.com";
const GOOGLE_CLIENT_SECRET = "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";

passport.use(new GoogleStrategy({
    clientID : GOOGLE_CLIENT_ID,
    clientSecret : GOOGLE_CLIENT_SECRET,
    callbackURL : "http://localhost:3000/google/callback",
    passReqToCallback : true
},
function (request, accessToken, refreshToken, profile, done) {
    return done(null, profile);
}));

passport.serializeUser(function (user, done) {
    done (null, user);
})

passport.deserializeUser(function (user, done) {
    done(null, user);
})