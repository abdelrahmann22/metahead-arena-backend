const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

// POST /api/users/auth - Create or login user with wallet
router.post("/auth", userController.createOrLoginUser);

// GET /api/users/wallet/:walletAddress - Get user by wallet address
router.get("/wallet/:walletAddress", userController.getUserByWallet);

// GET /api/users/profile/:userId - Get user profile with stats
router.get("/profile/:userId", userController.getUserProfile);

// PUT /api/users/:userId/match-stats - Update user match statistics
router.put("/:userId/match-stats", userController.updateMatchStats);

module.exports = router;
