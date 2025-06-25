const express = require("express");
const router = express.Router();
const gameController = require("../controllers/gameController");

/**
 * @swagger
 * /api/game/rooms:
 *   get:
 *     summary: Get all game rooms
 *     tags: [Game Rooms]
 *     responses:
 *       200:
 *         description: List of all game rooms
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/GameRoom'
 */
router.get("/rooms", gameController.getRooms);

/**
 * @swagger
 * /api/game/rooms/{id}:
 *   get:
 *     summary: Get a specific game room
 *     tags: [Game Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Game room details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameRoom'
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/rooms/:id", gameController.getRoom);

/**
 * @swagger
 * /api/game/rooms/create:
 *   post:
 *     summary: Create a new game room
 *     tags: [Game Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Room name
 *               maxPlayers:
 *                 type: number
 *                 default: 2
 *                 description: Maximum players allowed
 *               userId:
 *                 type: string
 *                 description: Creator user ID
 *     responses:
 *       201:
 *         description: Room created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GameRoom'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/rooms/create", gameController.createRoom);

/**
 * @swagger
 * /api/game/rooms/{id}/code:
 *   get:
 *     summary: Get room code for sharing
 *     description: Returns the shareable room code that players can use to join this room
 *     tags: [Game Rooms]
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
router.get("/rooms/:id/code", gameController.getRoomCode);

/**
 * @swagger
 * /api/game/stats:
 *   get:
 *     summary: Get game statistics
 *     tags: [Game]
 *     responses:
 *       200:
 *         description: Game statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRooms:
 *                   type: number
 *                   description: Total number of rooms
 *                 activeRooms:
 *                   type: number
 *                   description: Number of active rooms
 *                 totalPlayers:
 *                   type: number
 *                   description: Total number of online players
 *                 playingPlayers:
 *                   type: number
 *                   description: Number of players currently in game
 */
router.get("/stats", gameController.getStats);

module.exports = router;
