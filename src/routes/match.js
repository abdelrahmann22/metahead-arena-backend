const express = require("express");
const matchController = require("../controllers/matchController");

const router = express.Router();

/**
 * @fileoverview Match Management Routes
 * @description RESTful API routes for match history and game result management
 * @module routes/match
 */

/**
 * @swagger
 * /api/matches/user/{userId}/history:
 *   get:
 *     summary: Get user match history
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's database ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *         description: Number of matches to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *           default: 0
 *         description: Number of matches to skip
 *     responses:
 *       200:
 *         description: User match history retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 matches:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Match'
 *                 total:
 *                   type: number
 *                   description: Total number of matches
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/matches/user/:userId/history
 * Retrieve paginated match history for a specific user
 */
router.get("/user/:userId/history", matchController.getUserMatchHistory);

/**
 * @swagger
 * /api/matches/user/{userId}/match/{matchId}:
 *   get:
 *     summary: Get specific match for a specific user
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User's database ID
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *     responses:
 *       200:
 *         description: User specific match retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     match:
 *                       $ref: '#/components/schemas/Match'
 *                     userPlayer:
 *                       type: object
 *                       description: User's player data in the match
 *                     opponent:
 *                       type: object
 *                       description: Opponent's player data
 *                     userOutcome:
 *                       type: string
 *                       enum: [win, loss, draw]
 *                       description: Match outcome from user's perspective
 *                     userStats:
 *                       type: object
 *                       properties:
 *                         goals:
 *                           type: number
 *                         position:
 *                           type: string
 *                     opponentStats:
 *                       type: object
 *                       properties:
 *                         goals:
 *                           type: number
 *                         position:
 *                           type: string
 *                         username:
 *                           type: string
 *       404:
 *         description: Match not found or user not in this match
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Bad request - missing parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/matches/user/:userId/match/:matchId
 * Retrieve detailed match information from specific user's perspective
 */
router.get(
  "/user/:userId/match/:matchId",
  matchController.getUserSpecificMatch
);

/**
 * @swagger
 * /api/matches/{matchId}:
 *   get:
 *     summary: Get match by ID
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *     responses:
 *       200:
 *         description: Match details retrieved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 *       404:
 *         description: Match not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/matches/:matchId
 * Retrieve complete match details by match ID
 */
router.get("/:matchId", matchController.getMatchById);

module.exports = router;
