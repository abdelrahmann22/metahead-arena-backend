const express = require("express");
const matchController = require("../controllers/matchController");

const router = express.Router();

// GET /api/matches/user/:userId/history - Get user match history (must come before /:matchId)
router.get("/user/:userId/history", matchController.getUserMatchHistory);

// GET /api/matches/:matchId - Get match by ID
router.get("/:matchId", matchController.getMatchById);

module.exports = router;
