const express = require("express");
const gameRoutes = require("./game");
const userRoutes = require("./user");
const matchRoutes = require("./match");

const authRoutes = require("./auth");

const router = express.Router();

/**
 * @fileoverview Main API Router
 * @description Central router configuration for Head Ball Real-Time Game API
 * @module routes/index
 */

// Mount API route modules
router.use("/game", gameRoutes);
router.use("/users", userRoutes);
router.use("/matches", matchRoutes);

router.use("/auth", authRoutes);

module.exports = router;
