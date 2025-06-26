const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");

/**
 * @fileoverview Game Management Routes
 * @description Essential HTTP API routes for game monitoring and room code sharing
 * @module routes/game
 *
 * Note: Most game operations (create room, join room, gameplay) are handled via Socket.IO
 */

/**
 * @swagger
 * /api/game/rooms/{id}/code:
 *   get:
 *     summary: Get room code for sharing
 *     description: Returns the shareable room code that players can use to join this room
 *     tags: [Game]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID to get code for
 *     responses:
 *       200:
 *         description: Room code retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 roomCode:
 *                   type: string
 *                   example: "ABC123"
 *                   description: 6-character alphanumeric room code
 *                 roomId:
 *                   type: string
 *                   example: "room_12345"
 *                 players:
 *                   type: number
 *                   example: 1
 *                   description: Current number of players
 *                 maxPlayers:
 *                   type: number
 *                   example: 2
 *                   description: Maximum players allowed
 *                 status:
 *                   type: string
 *                   example: "waiting"
 *                   enum: [waiting, playing, finished]
 *                 gameMode:
 *                   type: string
 *                   example: "1v1"
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/game/rooms/:id/code
 * Get shareable room code for inviting players
 */
router.get("/rooms/:id/code", gameController.getRoomCode);

/**
 * @swagger
 * /api/game/stats:
 *   get:
 *     summary: Get live game statistics
 *     description: Retrieve current server statistics including player counts and active rooms
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Game statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Live game statistics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPlayers:
 *                       type: number
 *                       description: Total number of online players
 *                       example: 25
 *                     activeRooms:
 *                       type: number
 *                       description: Number of active game rooms
 *                       example: 8
 *                     playersInQueue:
 *                       type: number
 *                       description: Players waiting for matches
 *                       example: 3
 *                     serverUptime:
 *                       type: number
 *                       description: Server uptime in seconds
 *                       example: 86400
 *                     timestamp:
 *                       type: number
 *                       description: Current timestamp
 *                       example: 1640995200000
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
/**
 * GET /api/game/stats
 * Retrieve current game server statistics and player counts
 */
router.get("/stats", gameController.getStats);

module.exports = router;
