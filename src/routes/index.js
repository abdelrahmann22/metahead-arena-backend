const express = require("express");
const gameRoutes = require("./game");

const router = express.Router();

// API Documentation
router.get("/", (req, res) => {
  res.json({
    message: "🏈 Head Ball Real-Time Game API",
    version: "1.0.0",
    architecture: "MCS (Model-Controller-Service)",
    endpoints: {
      "/": "API documentation and overview",
      "/game": "Game management (rooms, stats, leaderboard)",
      "/game/rooms": "Room management endpoints",
      "/game/stats": "Live game statistics",
      "/game/leaderboard": "Player rankings",
    },
    websocket: "Socket.IO enabled at root for real-time gameplay",
    features: [
      "Real-time 1v1 matchmaking",
      "Live game rooms with physics",
      "Player statistics and leaderboards", 
      "WebSocket-based 60fps gameplay",
      "MongoDB user persistence",
    ],
    documentation: "Visit /game for game-specific API docs",
  });
});

// Mount game routes
router.use("/game", gameRoutes);

module.exports = router;
