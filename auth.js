const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = require("../secret");
const { Login } = require("./models.js");

passport.use(
    new GoogleStrategy(
        {
            clientID: GOOGLE_CLIENT_ID,
            clientSecret: GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3000/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
            const email = profile.emails[0].value;

            try {
                // Find the user by email
                let login = await Login.findOne({ email });

                if (!login) {
                    return done(null, false, { message: "No user found with this email." });
                }

                // If user is found, proceed with login
                done(null, login);
            } catch (error) {
                done(error, null); // Handle errors
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

module.exports = passport;
