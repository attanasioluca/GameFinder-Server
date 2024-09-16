const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const app = express();
const port = 3000;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { jwt_secret } = require("../secret");
require("./auth");
const { Login, Review, Game, Platform, Genre, User } = require("./models");
// utilizzabile solo dal mio computer (Luca)

app.use(
    session({
        resave: false,
        saveUninitialized: true,
        secret: "cats",
    })
);
app.use(passport.initialize());
app.use(passport.session());
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/GameFinder");

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", async () => {
    console.log("Connected to MongoDB");
});

var LoggedUser = null;

function isLogged(req, res, next) {
    req.user ? next() : res.sendStatus(401);
}
// Get function
app.get("/", (req, res) => {
    res.send("<a href='/auth/google'> accedi con google </a>");
});
app.get(
    "/auth/google",
    passport.authenticate("google", { scope: ["email", "profile"] }),
    (req, res) => {}
);
app.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "/failure",
    }),
    async (req, res) => {
        try {
            // Access the authenticated user's email from req.user
            const email = req.user.email;

            // Find the corresponding Login object in your MongoDB
            const user = await Login.findOne({ email });

            if (user) {
                // If the token is already present in the Login object
                if (user.token) {
                    // Use the existing token and redirect to your frontend
                    res.redirect(
                        `http://localhost:5173/googleLogin?token=${user.token}`
                    );
                } else {
                    // If no token, generate a new token, store it in the Login object
                    const token = jwt.sign(
                        { id: user._id, email: user.email },
                        jwt_secret,
                        {
                            expiresIn: "1h",
                        }
                    );

                    // Save the token to the user
                    user.token = token;
                    await user.save();

                    // Redirect with the newly generated token
                    res.redirect(
                        `http://localhost:5173/googleLogin?token=${token}`
                    );
                }
            } else {
                // If the user is not found, handle it
                res.status(404).send("User not found.");
            }
        } catch (error) {
            console.error("Error during Google callback:", error);
            res.status(500).send("Internal server error.");
        }
    }
);

app.get("/failure", (req, res) => {
    res.send("errore...");
});
app.get("/protected", isLogged, (req, res) => {
    res.redirect(`http://localhost:5173/googleLogin/${isLogged.token}`);
});
app.get("/users/:usermail", isLogged, async (req, res) => {
    const { usermail } = req.params;
    console.log(usermail);

    try {
        const result = await Login.findOne({ email: usermail });
        if (result) {
            LoggedUser = result;
            res.redirect(`http://localhost:5173/googleLogin/${isLogged.token}`);
        } else {
            res.sendStatus(404);
            LoggedUser = null;
        }
    } catch (error) {
        console.error("Error fetching user from id:", error);
        res.status(500).send(error.message);
    }
});
app.get("/gamesById", async (req, res) => {
    const { ids } = req.query;
    console.log(ids);
    const filter = { id: { $in: ids } };
    try {
        const games = await Game.find(filter);
        res.json(games);
    } catch (error) {
        console.error("Error fetching games by ids:", error);
        res.status(500).send(error.message);
    }
});
app.get("/games", async (req, res) => {
    const { pageNum = 1, platform, genre, sortOrder, searchText } = req.query;

    const filter = {};
    if (genre) {
        filter["genre"] = genre;
    }

    if (platform) {
        filter["parent_platforms.id"] = platform;
    }
    if (searchText) {
        filter["name"] = { $regex: searchText, $options: "i" }; // Case insensitive search
    }
    const sort = {};
    if (sortOrder) {
        const [key, order] = sortOrder.split(":");
        sort[key] =
            sortOrder == "metacritic" || sortOrder == "rating_top" ? -1 : 1;
    }

    const pageSize = 16;
    const skip = (pageNum - 1) * pageSize;

    try {
        const games = await Game.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(pageSize);
        res.json(games);
    } catch (error) {
        console.error("Error fetching games:", error);
        res.status(500).send(error.message);
    }
});
app.get("/games/:gameId", async (req, res) => {
    const { gameId } = req.params;
    try {
        const result = await Game.findOne({ id: gameId });
        res.json(result);
    } catch (error) {
        console.error("Error fetching game from id:", error);
        res.status(500).send(error.message);
    }
});
app.get("/platforms", async (req, res) => {
    try {
        const result = await Platform.find();
        res.json(result);
    } catch (error) {
        console.error("Error fetching platforms:", error);
        res.status(500).send(error.message);
    }
});
app.get("/genres", async (req, res) => {
    try {
        const result = await Genre.find();
        res.json(result);
    } catch (error) {
        console.error("Error fetching genres:", error);
        res.status(500).send(error.message);
    }
});
app.get("/userById/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await User.findOne({ id: userId });
        res.json(result);
    } catch (error) {
        console.error("Error fetching user from id:", error);
        res.status(500).send(error.message);
    }
});
app.get("/allUsers/:userId", async (req, res) => {
    // all but the one with iserId
    const { userId } = req.params;
    try {
        const result = await User.find({ id: { $ne: userId } });
        res.json(result);
        console.log(result);
    } catch (error) {
        console.error("Error fetching users from id:", error);
        res.status(500).send(error.message);
    }
});
app.get("/userByToken/:token", async (req, res) => {
    const { token } = req.params;
    try {
        const log = await Login.findOne({ token: token });
        if (!log) {
            return res.status(400).json({ message: "Login not found" });
        }
        const result = await User.findOne({ username: log.username });
        if (!result) {
            return res.status(400).json({ message: "User not found" });
        }
        res.json(result);
    } catch (error) {
        console.error("Error fetching user from token:", error);
        res.status(500).send(error.message);
    }
});

app.get("/userByUsername/:username", async (req, res) => {
    const { username } = req.params;
    try {
        const user = await User.findOne({ username: username });
        if (!user) {
            return res.status(400).json({ message: "Login not found" });
        }
        res.json(result);
    } catch (error) {
        console.error("Error fetching user from token:", error);
        res.status(500).send(error.message);
    }
});
app.get("/gameStatus", async (req, res) => {
    const { userId, gameId } = req.query;
    let result = { inCollection: false, inWishlist: false };
    try {
        const user = await User.findOne({ id: userId });
        if (user) {
            result.inCollection = user.games.includes(gameId);
            result.inWishlist = user.wishlist.includes(gameId);
        } else console.log(req);
    } catch (error) {
        console.error("Error fetching user from id:", error);
        res.status(500).send(error.message);
    }
    res.json(result);
});
app.get("/reviews/:gameId", async (req, res) => {
    const { gameId } = req.params;
    console.log(req.params);
    const reviews = await Review.find({ gameId: gameId });
    if (reviews) {
        res.json(reviews);
    }
});
// Post functions
app.post("/changeGameStatus", async (req, res) => {
    const { userId, gameId, type, add } = req.body;
    console.log(req.body);
    try {
        // Find the user by userId
        const user = await User.findOne({ id: userId });
        // If user doesn't exist, return an error
        if (!user) {
            console.log("User not found");
            return res.status(404).json({ error: "User not found" });
        }
        if (!gameId) {
            console.log("No game id");
            return res.status(404).json({ error: "Game id doesn't exist" });
        }
        // Depending on the "type", add the gameId to either "games" or "wishlist"
        if (add) {
            if (type === 1) {
                if (!user.games.includes(gameId)) {
                    user.games.push(gameId); // Add gameId to the games array
                }
            } else if (type === 2) {
                if (!user.wishlist.includes(gameId)) {
                    user.wishlist.push(gameId); // Add gameId to the wishlist array
                }
            }
        } else {
            if (type === 1) {
                if (user.games.includes(gameId)) {
                    user.games.remove(gameId); // Add gameId to the games array
                }
            } else if (type === 2) {
                if (user.wishlist.includes(gameId)) {
                    user.wishlist.remove(gameId); // Add gameId to the wishlist array
                }
            }
        }
        await user.save();

        // Send a success response
        res.status(200).json({
            message: `gameId ${gameId} added to ${type} for user ${userId}`,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/changeFriendStatus", async (req, res) => {
    const { userId, friendId, add } = req.body;
    console.log(req.body);
    try {
        // Find the user by userId
        const user = await User.findOne({ id: userId });
        const friend = await User.findOne({ id: friendId });
        // If user doesn't exist, return an error
        if (!user) {
            console.log("User not found");
            return res.status(404).json({ error: "User not found" });
        }
        if (!friend) {
            console.log("No friend id");
            return res.status(404).json({ error: "Game id doesn't exist" });
        }
        if (add) {
            if (!user.friends.includes(friendId)) {
                user.friends.push(friendId);
                friend.friends.push(userId);
            }
        }
        await user.save();

        // Send a success response
        if (add) {
            res.status(200).json({
                message: `FriendId ${friendId} added to user ${userId}`,
            });
        } else {
            res.status(200).json({
                message: `FriendId ${friendId} removed from user ${userId}`,
            });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/addReview", async (req, res) => {
    const { author, authorName, gameId, comment, rating } = req.body;
    try {
        // Create a new review/comment
        const newReview = new Review({
            author: author, // Reference to the user who posted the review
            authorName: authorName,
            gameId: gameId, // Reference to the game being reviewed
            comment: comment, // The comment text
            rating: rating, // The rating value
        });
        console.log("sending review");
        await newReview.save()
        res.status(200).json({ message: "Review added successfully!" });
    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/deleteReview", async (req, res) => {
    const { author, gameId } = req.body;
    Review.deleteOne({ author: author, gameId: gameId})
    .then(result => {
        console.log("Delete result:", result);
    })
    .catch(error => {
        console.error("Error deleting document:", error);
    });
});
app.post("/signup", async (req, res) => {
    const { email, username, password, user_type } = req.body;
    console.log(req.body);
    const oldUser = await User.findOne({ username: username });
    const oldLogin = await Login.findOne({ email: email });
    if (oldUser) {
        return res.status(404).json({ error: "username already in use" });
    }
    if (oldLogin) {
        return res.status(404).json({ error: "email already in use" });
    }

    const userId = (await User.countDocuments()) + 1;

    const newUser = new User({
        id: userId,
        username: username,
        member_since: new Date(),
        user_type: user_type,
        friends: [],
        wishlist: [],
        games: [],
    });
    async function hashPassword(password) {
        const saltRounds = 10;
        try {
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            return hashedPassword;
        } catch (error) {
            console.error("Error hashing password:", error);
            throw error;
        }
    }

    hashPassword(password).then((hashedPassword) => {
        const newLogin = new Login({
            email: email,
            username: username,
            password: hashedPassword,
            token: jwt.sign({ id: username }, jwt_secret, {
                expiresIn: "168h",
            }),
        });
        newLogin.save();
        newUser.save();
        res.json(newLogin.token);
        console.log("sent token:", newLogin.token);
    });
});
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body);
    try {
        const login = await Login.findOne({ email: email });
        if (!login) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, login.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }
        // Genera un token JWT
        console.log(jwt_secret);
        const token = jwt.sign({ id: email }, jwt_secret, {
            expiresIn: "900h",
        });

        const filter = { email: email };
        const update = {
            $set: {
                token: token,
            },
        };
        await Login.updateOne(filter, update);
        res.json(token);
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
