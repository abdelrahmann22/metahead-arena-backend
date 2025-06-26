const express = require("express");
const router = express.Router();
const chestController = require("../controllers/chestController");

/**
 * @fileoverview Chest Management Routes
 * @description RESTful API routes for managing user chests and rewards
 * @module routes/chest
 */

/**
 * @swagger
 * /api/chests/{walletAddress}:
 *   get:
 *     summary: Get user's chest counts
 *     tags: [Chests]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: User's wallet address
 *     responses:
 *       200:
 *         description: User's chest counts retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 bronze:
 *                   type: number
 *                   description: Number of bronze chests
 *                 silver:
 *                   type: number
 *                   description: Number of silver chests
 *                 gold:
 *                   type: number
 *                   description: Number of gold chests
 *                 legendary:
 *                   type: number
 *                   description: Number of legendary chests
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/chests/:walletAddress
 * Retrieve user's chest inventory counts by wallet address
 */
router.get("/:walletAddress", chestController.getUserChests);

/**
 * @swagger
 * /api/chests/{walletAddress}/add:
 *   post:
 *     summary: Add chests to user
 *     tags: [Chests]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: User's wallet address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bronze:
 *                 type: number
 *                 description: Number of bronze chests to add
 *               silver:
 *                 type: number
 *                 description: Number of silver chests to add
 *               gold:
 *                 type: number
 *                 description: Number of gold chests to add
 *               legendary:
 *                 type: number
 *                 description: Number of legendary chests to add
 *     responses:
 *       200:
 *         description: Chests added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 chests:
 *                   type: object
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * POST /api/chests/:walletAddress/add
 * Add chests to user's inventory (reward system)
 */
router.post("/:walletAddress/add", chestController.addChests);

/**
 * @swagger
 * /api/chests/{walletAddress}/open:
 *   post:
 *     summary: Open/consume chests
 *     tags: [Chests]
 *     parameters:
 *       - in: path
 *         name: walletAddress
 *         required: true
 *         schema:
 *           type: string
 *         description: User's wallet address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chestType
 *               - count
 *             properties:
 *               chestType:
 *                 type: string
 *                 enum: [bronze, silver, gold, legendary]
 *                 description: Type of chest to open
 *               count:
 *                 type: number
 *                 minimum: 1
 *                 description: Number of chests to open
 *     responses:
 *       200:
 *         description: Chests opened successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 rewards:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       value:
 *                         type: number
 *                 remainingChests:
 *                   type: object
 *       400:
 *         description: Invalid request or insufficient chests
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
 * POST /api/chests/:walletAddress/open
 * Open chests and receive rewards (consumes chest inventory)
 */
router.post("/:walletAddress/open", chestController.openChests);

module.exports = router;
