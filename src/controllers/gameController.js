const gameService = require("../services/gameService");

/**
 * Get available game rooms
 * @route GET /api/game/rooms
 * @query {number} page - Page number for pagination (default: 1)
 * @query {number} limit - Number of rooms per page (default: 10)
 * @query {string} gameMode - Filter by game mode (optional)
 */
const getRooms = async (req, res) => {
  try {
    const { page = 1, limit = 10, gameMode } = req.query;

    const result = await gameService.getAvailableRooms({
      page: parseInt(page),
      limit: parseInt(limit),
      gameMode,
    });

    res.json({
      success: true,
      message: "Game rooms retrieved successfully",
      data: result.rooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting rooms:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create a new game room
 * @route POST /api/game/rooms
 * @body {object} roomData - Room configuration data
 */
const createRoom = async (req, res) => {
  try {
    const roomData = req.body;
    const room = await gameService.createRoom(roomData);

    res.status(201).json({
      success: true,
      message: "Game room created successfully",
      data: room,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get live game statistics
 * @route GET /api/game/stats
 */
const getStats = async (req, res) => {
  try {
    const stats = gameService.getGameStats();

    res.json({
      success: true,
      message: "Live game statistics retrieved successfully",
      data: stats,
    });
  } catch (error) {
    console.error("Error getting live game stats:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get specific room details
 * @route GET /api/game/rooms/:id
 * @param {string} id - Room ID
 */
const getRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = gameService.getRoom(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    res.json({
      success: true,
      message: "Room details retrieved successfully",
      data: room.toJSON(),
    });
  } catch (error) {
    console.error("Error getting room:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get room code for sharing
 * @route GET /api/game/rooms/:id/code
 * @param {string} id - Room ID
 */
const getRoomCode = async (req, res) => {
  try {
    const { id: roomId } = req.params;

    const roomManager = require("../services/roomManagerService");
    const room = roomManager.getRoom(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found",
      });
    }

    const roomCode = roomManager.getCodeForRoom(roomId);

    if (!roomCode) {
      return res.status(500).json({
        success: false,
        message: "Room code not available",
      });
    }

    res.json({
      success: true,
      roomCode,
      roomId,
      players: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.status,
      gameMode: room.gameMode,
    });
  } catch (error) {
    console.error("Error getting room code:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getRooms,
  createRoom,
  getStats,
  getRoom,
  getRoomCode,
};
