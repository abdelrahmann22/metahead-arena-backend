const gameService = require("../services/gameService");

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
  getStats,
  getRoomCode,
};
