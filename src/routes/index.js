const express = require("express");
const gameRoutes = require("./game");
const userRoutes = require("./user");
const nftRoutes = require("./nft");
const matchRoutes = require("./match");
const chestRoutes = require("./chest");

const router = express.Router();

// API Documentation
router.get("/", (req, res) => {
  res.json({
    message: "🏈 Head Ball Real-Time Game API",
    version: "1.0.0",
    architecture: "MCS (Model-Controller-Service)",
    endpoints: {
      "/": "API documentation and overview",
      "/game": "Game management (rooms, stats)",
      "/users": "User management (Web3 authentication, profiles)",
      "/nfts": "NFT management (collection, power modifiers)",
      "/matches": "Match management (create, start, end, history)",
      "/chests": "Chest management (user chests, rewards)",
    },
    websocket: "Socket.IO enabled at root for real-time gameplay",
    features: [
      "Real-time 1v1 matchmaking",
      "Web3 wallet authentication",
      "NFT-powered gameplay modifiers",
      "Match history and statistics",
      "WebSocket-based 60fps gameplay",
      "MongoDB user persistence",
    ],
    documentation: "Visit each endpoint for specific API docs",
  });
});

// Mount routes
router.use("/game", gameRoutes);
router.use("/users", userRoutes);
router.use("/nfts", nftRoutes);
router.use("/matches", matchRoutes);
router.use("/chests", chestRoutes);

module.exports = router;
