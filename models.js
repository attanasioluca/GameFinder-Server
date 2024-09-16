const mongoose = require("mongoose");

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
    token: { type: String },
});

const Login = mongoose.model("Login", loginSchema);
const Review = mongoose.model("Review", reviewSchema);
const Game = mongoose.model("Game", gameSchema);
const Platform = mongoose.model("Platform", platformSchema);
const Genre = mongoose.model("Genre", genreSchema);
const User = mongoose.model("User", userSchema);

module.exports = { Login, Review, Game, Platform, Genre, User };