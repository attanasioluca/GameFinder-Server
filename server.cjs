const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const app = express();
const port = 3000;
// Esempio di verifica delle credenziali
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { jwt_secret, sessionSecret } = require("../secret");
require("./auth");
// utilizzabile solo dal mio computer (Luca)

app.use(
    session({
        resave: false,
        saveUninitialized: true,
        secret: sessionSecret,
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

// Define the Game schema and model
const platformSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
});
const reviewSchema = new mongoose.Schema({
    author: { type: String, required: true },
    authorName: { type: String, required: true },
    gameId: { type: String, required: true },
    comment: { type: String, required: true },
    rating: { type: Number, required: true },
});
const gameSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    background_image: { type: String },
    parent_platforms: [platformSchema],
    metacritic: { type: Number },
    rating_top: { type: Number },
    released: { type: Date },
    added: { type: Number },
    genre: [{ type: String }],
});
const genreSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    background_image: { type: String },
});
const userSchema = new mongoose.Schema({
    id: { type: String, required: true },
    username: { type: String, required: true },
    member_since: { type: Date, required: true },
    user_type: { type: String, required: true },
    friends: [{ type: String }],
    wishlist: [{ type: String }],
    games: [{ type: String }],
});
const loginSchema = new mongoose.Schema({
    email: { type: String, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    token: { type: String },
});

const Login = mongoose.model("Login", loginSchema);
const Review = mongoose.model("Review", reviewSchema);
const Game = mongoose.model("Game", gameSchema);
const Platform = mongoose.model("Platform", platformSchema);
const Genre = mongoose.model("Genre", genreSchema);
const User = mongoose.model("User", userSchema);
var LoggedUser = null;
const saltRounds = 10;

function isLogged(req, res, next) {
    req.user ? next() : res.sendStatus(401);
}

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
        successRedirect: "/protected",
        failureRedirect: "/failure",
    })
);
app.get("/failure", (req, res) => {
    res.send("errore...");
});
app.get("/protected", isLogged, async (req, res) => {
    try {
        const result = await Login.findOne({ email: req.user.email });
        if (result) {
            LoggedUser = result;
            res.redirect(`http://localhost:5173/?token=${LoggedUser.token}`);
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
app.get("/reviews/:gameId", async (req, res) => {
    const { gameId } = req.params;
    try {
        const reviews = await Review.find({ gameId: gameId });
        res.json(reviews);
    } catch (error) {
        console.error("Error fetching reviews:", error);
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
    const { userId } = req.params;
    try {
        const user = await User.findOne({ id: userId });
        if (!user) {
            console.error("Error fetching user from id:", error);
            res.status(500).send(error.message);
        }
        const result = await User.find({
            id: { $ne: userId, $nin: user.friends },
        });
        res.json(result);
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


app.post("/changeGameStatus", async (req, res) => {
    const { userId, gameId, type, add } = req.body;
    console.log(req.body);
    try {
        const user = await User.findOne({ id: userId });
        if (!user) {
            console.log("User not found");
            return res.status(404).json({ error: "User not found" });
        }
        if (!gameId) {
            console.log("No game id");
            return res.status(404).json({ error: "Game id doesn't exist" });
        }
        if (add) {
            if (type === 1) {
                if (!user.games.includes(gameId)) {
                    user.games.push(gameId); 
                }
            } else if (type === 2) {
                if (!user.wishlist.includes(gameId)) {
                    user.wishlist.push(gameId);
                }
            }
        } else {
            if (type === 1) {
                if (user.games.includes(gameId)) {
                    user.games.remove(gameId);
                }
            } else if (type === 2) {
                if (user.wishlist.includes(gameId)) {
                    user.wishlist.remove(gameId);
                }
            }
        }
        await user.save();

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
    try {
        const user = await User.findOne({ id: userId });
        const friend = await User.findOne({ id: friendId });
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
            }
            if (!friend.friends.includes(userId)) {
                friend.friends.push(userId);
            }
            res.status(200).json({
                message: `FriendId ${friendId} added to user ${userId}`,
            });
        } else {
            if (user.friends.includes(friendId)) {
                user.friends.remove(friendId);
            }
            if (friend.friends.includes(userId)) {
                friend.friends.remove(userId);
            }
            res.status(200).json({
                message: `FriendId ${friendId} added to user ${userId}`,
            });
        }
        await user.save();
        await friend.save();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/addReview", async (req, res) => {
    const { author, authorName, gameId, comment, rating } = req.body;
    try {
        const newReview = new Review({
            author: author, 
            authorName: authorName,
            gameId: gameId,
            comment: comment,
            rating: rating,
        });
        console.log("sending review");
        await newReview.save();
        // Send a success response
        res.status(200).json({ message: "Review added successfully!" });
    } catch (err) {
        console.error("Error adding comment:", err);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/deleteReview", async (req, res) => {
    const { author, gameId } = req.body;
    try {
        console.log(author, gameId);
        const review = await Review.findOne({ gameId: gameId, author: author });
        await Review.deleteOne({ _id: review._id });
        res.status(200).json({ message: "Review removed successfully!" });
    } catch (err) {
        console.error("Error removing review:", err);
        res.status(500).json({ error: "Server error" });
    }
});
app.post("/signup", async (req, res) => {
    const { email, username, password, user_type } = req.body;

    console.log("SignUp:", req.body);
    if (await User.findOne({ username: username })) {
        return res.status(404).json({ error: "username already in use" });
    }
    if (await Login.findOne({ email: email })) {
        return res.status(404).json({ error: "email already in use" });
    }
    console.log("Ok checks");

    const newUserId = (await User.countDocuments()) + 1;
    const newPassword = await bcrypt.hash(password, saltRounds);
    const newToken = jwt.sign({ id: username }, jwt_secret, {
        expiresIn: "168h",
    });

    const newUser = new User({
        id: newUserId,
        username: username,
        member_since: new Date(),
        user_type: user_type,
        friends: [],
        wishlist: [],
        games: [],
    });
    const newLogin = new Login({
        email: email,
        username: username,
        password: newPassword,
        token: newToken,
    });

    console.log("User Created:", newUser);
    console.log("Login created", newLogin);
    await newLogin.save();
    await newUser.save();
    res.json(newToken);
    console.log("sent token:", newToken);
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

app.post("/getGoogleToken", async (req, res) => {
    try {
        if (LoggedUser) {
            console.log(LoggedUser.token);
            res.json(LoggedUser.token);
        } else {
            console.log("no logged user");
        }
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
