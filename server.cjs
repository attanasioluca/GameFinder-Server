const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const session = require('express-session');
require("./auth");
const jwt_secret = "decesare"
const app = express();
const port = 3000;
// Esempio di verifica delle credenziali
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

app.use(session({
    resave : false,
    saveUninitialized : true, 
    secret : "cats" 
}));
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
    reviews: [reviewSchema],
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
    token: { type: String }
}) 

const Login = mongoose.model("Login", loginSchema)
const Review = mongoose.model("Review", reviewSchema)
const Game = mongoose.model("Game", gameSchema);
const Platform = mongoose.model("Platform", platformSchema);
const Genre = mongoose.model("Genre", genreSchema);
const User = mongoose.model("User", userSchema);
var LoggedUser = null;

function isLogged (req, res, next){
    req.user ? next() : res.sendStatus(401);
}

// Get function
app.get("/", (req, res) => {
    res.send("<a href='/auth/google'> accedi con google </a>");
});
app.get("/auth/google", passport.authenticate('google', {scope : ["email", "profile"]}), (req, res) =>{
    //res = token se autenticato 
});
app.get("/google/callback",
    passport.authenticate("google", {
        successRedirect : "/protected",
        failureRedirect : "/failure"
    })
);
app.get("/failure", (req,res) => {
    res.send("errore...");
});       
app.get("/protected", isLogged, (req, res) => {
    //query su login con email
    // crea token
    // manda token a client

    res.redirect(`/users/${req.user.email}`);
});
app.get("/users/:usermail", isLogged, async (req, res) => {
    const { usermail } = req.params;
    console.log(usermail);

    try {
        const result = await Login.findOne({ email: usermail });
        if (result) {
            LoggedUser = result;
            res.json(result);
        }
        else {
            res.sendStatus(404);
            LoggedUser = null;
        }
    } catch (error) {
        console.error("Error fetching user from id:", error);
        res.status(500).send(error.message);
    }
});
app.get("/gamesById", async (req, res) => {
    const ids = req.query.ids;
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
app.get("/users/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await User.findOne({ id: userId });
        res.json(result);
    } catch (error) {
        console.error("Error fetching user from id:", error);
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
        // If user doesn't exist, return an error
        if (!user) {
            console.log("User not found");
            return res.status(404).json({ error: "User not found" });
        }
        if (!friendId) {
            console.log("No friend id");
            return res.status(404).json({ error: "Game id doesn't exist" });
        }
        if (add) {
            if (!user.friends.includes(friendId)) {
                user.friends.push(friendId);
            }
        } else {
            if (user.friends.includes(friendId)) {
                user.friends.remove(friendId); // Add gameId to the games array
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
        // Find the game by gameId
        const game = await Game.findOne({ id: gameId });
        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }
        // Find the user by userId
        const user = await User.findOne({ id: author });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Create a new review/comment
        const newReview = new Review({
            author: author, // Reference to the user who posted the review
            authorName: authorName,
            gameId: gameId, // Reference to the game being reviewed
            comment: comment, // The comment text
            rating: rating, // The rating value
        });
        console.log("sending review");
        // Save the review in the reviews collection
        game.reviews.push(newReview);
        await game.save();
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
        // Find the game by gameId
        const game = await Game.findOne({ id: gameId });
        if (!game) {
            return res.status(404).json({ error: "Game not found" });
        }

        // Find the index of the review by author
        const reviewIndex = game.reviews.findIndex(
            (review) => review.author === author
        );
        if (reviewIndex === -1) {
            return res.status(404).json({ error: "Review not found" });
        }

        // Remove the review from the reviews array
        game.reviews.splice(reviewIndex, 1);

        // Save the game document after removing the review
        await game.save();

        // Send a success response
        res.status(200).json({ message: "Review removed successfully!" });
    } catch (err) {
        console.error("Error removing review:", err);
        res.status(500).json({ error: "Server error" });
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    console.log(req.body);
    try {
      const user = await Login.findOne({ email: email });
        
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }
      console.log("email check");
  
      const isMatch = await bcrypt.compare(password, user.password);
  
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }
  
      // Genera un token JWT
      const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '1h' });
    console.log("sent token:", token);
      res.json({ token });
      
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
