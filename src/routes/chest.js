const express = require("express");
const router = express.Router();
const ChestController = require("../controllers/chestController");

// GET /api/chests/:walletAddress - Get user's chest counts
router.get("/:walletAddress", ChestController.getUserChests);

// POST /api/chests/:walletAddress/add - Add chests to user
router.post("/:walletAddress/add", ChestController.addChests);

// POST /api/chests/:walletAddress/open - Open/consume chests
router.post("/:walletAddress/open", ChestController.openChests);

module.exports = router;
