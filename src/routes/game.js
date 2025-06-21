const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");

// API documentation
router.get("/", gameController.getDocumentation);

// Room management routes
router.get("/rooms", gameController.getRooms);
router.get("/rooms/:id", gameController.getRoom);
router.post("/rooms/create", gameController.createRoom);
router.post("/rooms/:id/join", gameController.joinRoom);
router.post("/rooms/:id/leave", gameController.leaveRoom);

// Player routes
router.get("/players", gameController.getPlayers);
router.get("/players/:id", gameController.getPlayer);

// Statistics and leaderboard routes
router.get("/stats", gameController.getStats);
router.get("/leaderboard", gameController.getLeaderboard);
router.get("/match-history", gameController.getMatchHistory);

// Match result route
router.get("/result/:roomId", gameController.getMatchResult);

module.exports = router;
