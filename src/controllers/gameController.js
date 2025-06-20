const gameService = require("../services/gameService");

/**
 * Get game management documentation
 */
const getDocumentation = async (req, res) => {
  res.json({
    success: true,
    message: "Head Ball Game - Real-time Game Management API",
    description: "Active game management and real-time operations",
    endpoints: {
      "/": "GET - Game API documentation",
      "/rooms": "GET - Get available game rooms",
      "/rooms/create": "POST - Create a new game room",
      "/rooms/:id": "GET - Get specific room details",
      "/rooms/:id/join": "POST - Join a specific room",
      "/rooms/:id/leave": "POST - Leave a specific room",
      "/players": "GET - Get all connected players",
      "/players/:id": "GET - Get specific player details",
      "/stats": "GET - Live game statistics",
      "/leaderboard": "GET - Real-time leaderboard",
      "/match-history": "GET - Recent match history"
    },
    socketEvents: {
      client: {
        "join-game": "Join the game with username",
        "find-match": "Join matchmaking for 1v1",
        "player-input": "Send player input (move, jump, kick)",
        "move-left": "Move player left",
        "move-right": "Move player right",
        "jump": "Player jump action",
        "kick": "Kick the ball",
        "leave-game": "Leave current game/room"
      },
      server: {
        "welcome": "Welcome message with player ID",
        "player-created": "Player successfully created",
        "room-joined": "Successfully joined a room",
        "match-found": "Match found, game starting",
        "game-state-update": "60fps game state updates",
        "goal-scored": "Goal event with scorer info",
        "game-ended": "Match finished with results",
        "error": "Game error occurred"
      }
    },
    gameFeatures: {
      "realTimePhysics": "60fps ball and player physics",
      "collisionDetection": "Player-ball collision system",
      "goalDetection": "Automatic goal scoring",
      "timerSystem": "2-minute match timer",
      "drawSupport": "Matches can end in ties"
    }
  });
};

/**
 * Get available game rooms
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
 */
const getStats = async (req, res) => {
  try {
    const stats = await gameService.getLiveGameStats();

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
 * Get global leaderboard
 */
const getLeaderboard = async (req, res) => {
  try {
    const { page = 1, limit = 20, period = "all" } = req.query;

    const result = await gameService.getLeaderboard({
      page: parseInt(page),
      limit: parseInt(limit),
      period,
    });

    res.json({
      success: true,
      message: "Leaderboard retrieved successfully",
      data: result.players,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting leaderboard:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Join a specific game room
 */
const joinRoom = async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: "Player ID is required"
      });
    }

    const result = await gameService.joinSpecificRoom(playerId, roomId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.reason
      });
    }

    res.json({
      success: true,
      message: "Successfully joined room",
      data: {
        room: result.room,
        player: result.player
      }
    });
  } catch (error) {
    console.error("Error joining room:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Leave a specific game room
 */
const leaveRoom = async (req, res) => {
  try {
    const { id: roomId } = req.params;
    const { playerId } = req.body;

    if (!playerId) {
      return res.status(400).json({
        success: false,
        message: "Player ID is required"
      });
    }

    const result = await gameService.leaveSpecificRoom(playerId, roomId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.reason
      });
    }

    res.json({
      success: true,
      message: "Successfully left room",
      data: result
    });
  } catch (error) {
    console.error("Error leaving room:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get recent match history
 */
const getMatchHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, playerId } = req.query;

    const result = await gameService.getMatchHistory({
      page: parseInt(page),
      limit: parseInt(limit),
      playerId
    });

    res.json({
      success: true,
      message: "Match history retrieved successfully",
      data: result.matches || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total || 0,
        totalPages: Math.ceil((result.total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error getting match history:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get specific room details
 */
const getRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const room = gameService.getRoom(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: "Room not found"
      });
    }

    res.json({
      success: true,
      message: "Room details retrieved successfully",
      data: room.toJSON()
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
 * Get all connected players
 */
const getPlayers = async (req, res) => {
  try {
    const players = await gameService.getAllPlayers();
    res.json({
      success: true,
      message: "Players retrieved successfully",
      data: players
    });
  } catch (error) {
    console.error("Error getting players:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get specific player details
 */
const getPlayer = async (req, res) => {
  try {
    const { id } = req.params;
    const player = gameService.getPlayer(id);

    if (!player) {
      return res.status(404).json({
        success: false,
        message: "Player not found"
      });
    }

    res.json({
      success: true,
      message: "Player details retrieved successfully",
      data: player.toJSON()
    });
  } catch (error) {
    console.error("Error getting player:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getDocumentation,
  getRooms,
  createRoom,
  getStats,
  getLeaderboard,
  joinRoom,
  leaveRoom,
  getMatchHistory,
  getRoom,
  getPlayers,
  getPlayer
};
