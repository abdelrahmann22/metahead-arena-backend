const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

/**
 * @fileoverview User Management Routes
 * @description RESTful API routes for Web3 user authentication and profile management
 * @module routes/user
 */

/**
 * @swagger
 * /api/users/auth:
 *   post:
 *     summary: Create or login user with wallet
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletAddress
 *             properties:
 *               walletAddress:
 *                 type: string
 *                 description: Web3 wallet address
 *                 example: "0x742d35Cc6634C0532925a3b8D"
 *     responses:
 *       200:
 *         description: User successfully authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * POST /api/users/auth
 * Authenticate user with Web3 wallet address (create if new, login if exists)
 */
router.post("/auth", userController.createOrLoginUser);

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
router.get("/profile/:userId", userController.getUserProfile);

module.exports = router;
