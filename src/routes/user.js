const express = require("express");
const userController = require("../controllers/userController");
const { verifyLogin } = require("../middlewares/verify_login.middleware");

const router = express.Router();

/**
 * @fileoverview User Management Routes
 * @description RESTful API routes for Web3 user authentication and profile management
 * @module routes/user
 */

/**
 * @swagger
 * /api/users/wallet/{walletAddress}:
 *   get:
 *     summary: Get user by wallet address
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: User's wallet address
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/users/wallet/:walletAddress
 * Retrieve user profile by Web3 wallet address
 */
router.get("/wallet/:walletAddress", userController.getUserByWallet);

/**
 * @swagger
 * /api/users/profile/{userId}:
 *   get:
 *     summary: Get user profile with stats
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's database ID
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - JWT token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/users/profile/:userId
 * Retrieve user profile with game statistics by database ID
 */
router.get("/profile/:userId", verifyLogin, userController.getUserProfile);

module.exports = router;
