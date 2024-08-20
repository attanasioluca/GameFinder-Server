const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const port = 3000;

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
    genre: {
        slug: { type: String, required: true },
    }
});
const genreSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    background_image: { type: String },
});

const Game = mongoose.model("Game", gameSchema);
const Platform = mongoose.model("Platform", platformSchema);
const Genre = mongoose.model("Genre", genreSchema);
// Route to fetch games with query parameters
app.get("/games", async (req, res) => {
    const {
        pageNum = 1,
        platform,
        genre,
        sortOrder,
        searchText,
    } = req.query;

    console.log("Received query params:", req.query);

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
        sort[key] = (sortOrder == "metacritic" || sortOrder == "rating_top")?-1:1;
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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
