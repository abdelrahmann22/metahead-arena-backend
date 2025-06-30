const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const gameService = require("../services/gameService");
const matchService = require("../services/matchService");
const gameBroadcaster = require("../services/gameBroadcaster");
const userService = require("../services/userService");

/**
 * @fileoverview WebSocket Configuration and Event Handlers
 * @description Socket.IO event handlers for real-time headball gameplay
 * @module config/socket
 */

// === Authentication Helpers ===

// Removed parseCookies function as we're now using localStorage tokens

/**
 * Verify JWT token from socket connection
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {Object|null} - Decoded JWT payload or null if invalid
 */
const verifySocketAuth = (socket) => {
  try {
    // Try to get token from query parameters first (recommended for WebSocket)
    let token = socket.handshake.query.token;

    // If not in query, try from auth object
    if (!token && socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    }

    // If not found, try from Authorization header (fallback)
    if (!token) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return null;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error("Socket auth verification failed:", error.message);
    return null;
  }
};

// === Socket Event Handlers ===

/**
 * Handle player joining the game
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} data - Player join data (no walletAddress needed)
 */
const handlePlayerJoin = async (socket, io, data) => {
  try {
    // Verify authentication from JWT token
    const authPayload = verifySocketAuth(socket);
    if (!authPayload) {
      socket.emit("error", {
        message: "Authentication required. Please login first.",
        type: "AUTH_REQUIRED",
      });
      return;
    }

    // Get user from database using authenticated userId
    const userResult = await userService.findUserById(authPayload.userId);
    if (!userResult.success || !userResult.user) {
      socket.emit("error", {
        message: "User not found in database",
        type: "USER_ERROR",
      });
      return;
    }

    const user = userResult.user;

    // Store authenticated user info in socket for future use
    socket.userId = user._id;
    socket.walletAddress = user.walletAddress;

    // Create player or get existing
    let result = gameService.createPlayer(
      socket.id,
      user.walletAddress,
      user._id
    );
    if (!result.success && result.reason === "Player already exists") {
      const existingPlayer = gameService.getPlayer(socket.id);
      if (existingPlayer) {
        result = { success: true, player: existingPlayer };
      }
    }

    if (result.success) {
      socket.emit("player-created", {
        player: result.player.toJSON(),
        user: { walletAddress: user.walletAddress },
      });

      socket.emit("game-status", gameService.getGameStats());
    } else {
      gameBroadcaster.broadcastError(socket.id, { message: result.reason });
    }
  } catch (error) {
    console.error("Error in handlePlayerJoin:", error);
    socket.emit("error", {
      message: "Failed to join game",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Middleware to check authentication for socket events
 * @param {Socket} socket - Socket.IO socket instance
 * @returns {boolean} - True if authenticated, false otherwise
 */
const requireAuth = (socket) => {
  const authPayload = verifySocketAuth(socket);
  if (!authPayload) {
    socket.emit("error", {
      message: "Authentication required for this action",
      type: "AUTH_REQUIRED",
    });
    return false;
  }
  return true;
};

/**
 * Handle finding a match through matchmaking
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const handleFindMatch = (socket, io) => {
  try {
    // Check authentication
    if (!requireAuth(socket)) return;

    const result = gameService.findMatch(socket.id);

    if (result.success) {
      const room = result.room;
      socket.join(room.id);

      // Notify player
      gameBroadcaster.broadcastRoomJoined(socket.id, {
        roomId: room.id,
        roomCode: room.code,
        players: room.players.map((p) => p.toJSON()),
        waitingForPlayers: room.maxPlayers - room.players.length,
        gameMode: "1v1",
        roomType: "matchmaking",
      });

      // Notify other players in room
      socket.to(room.id).emit("player-joined-room", {
        player: gameService.getPlayer(socket.id).toJSON(),
        waitingForPlayers: room.maxPlayers - room.players.length,
      });

      // Check if room is full
      if (room.isFull()) {
        io.to(room.id).emit("room-full", {
          message: "Found opponent! Ready up for 1v1 match.",
          roomId: room.id,
          timestamp: Date.now(),
        });
      }
    } else {
      gameBroadcaster.broadcastError(socket.id, { message: result.reason });
    }
  } catch (error) {
    console.error("Error in handleFindMatch:", error);
    socket.emit("error", {
      message: "Failed to find match",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Handle creating a new game room
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const handleCreateRoom = async (socket, io) => {
  try {
    // Check authentication
    if (!requireAuth(socket)) return;

    const player = gameService.getPlayer(socket.id);
    if (!player) {
      socket.emit("error", {
        message: "Player not found. Please join the game first.",
        type: "PLAYER_NOT_FOUND",
      });
      return;
    }

    if (player.currentRoom) {
      socket.emit("error", {
        message: "You are already in a room",
        type: "ALREADY_IN_ROOM",
      });
      return;
    }

    const room = gameService.createRoom();
    const joinResult = room.addPlayer(player);

    if (!joinResult.success) {
      socket.emit("error", {
        message: joinResult.reason || "Failed to join created room",
        type: "ROOM_JOIN_ERROR",
      });
      return;
    }

    socket.join(room.id);

    gameBroadcaster.broadcastRoomCreated(socket.id, {
      roomId: room.id,
      roomCode: room.code,
      players: room.players.map((p) => p.toJSON()),
      waitingForPlayers: room.maxPlayers - room.players.length,
      gameMode: room.gameMode || "1v1",
      roomType: "created",
    });
  } catch (error) {
    console.error("Error in handleCreateRoom:", error);
    socket.emit("error", {
      message: "Failed to create room",
      type: "ROOM_CREATE_ERROR",
    });
  }
};

/**
 * Handle joining a room by code
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} data - Data containing roomCode
 */
const handleJoinRoomByCode = async (socket, io, data) => {
  try {
    // Check authentication
    if (!requireAuth(socket)) return;

    const { roomCode } = data;
    if (!roomCode) {
      socket.emit("error", {
        message: "Room code is required",
        type: "VALIDATION_ERROR",
      });
      return;
    }

    const result = await gameService.joinRoomByCode(socket.id, roomCode);
    if (result.success) {
      const roomData = result.room;
      const actualRoom = gameService.getRoom(roomData.id);

      socket.join(roomData.id);

      gameBroadcaster.broadcastRoomJoined(socket.id, {
        roomId: roomData.id,
        roomCode: roomCode,
        players: roomData.players,
        waitingForPlayers: roomData.maxPlayers - roomData.players.length,
        gameMode: roomData.gameMode || "1v1",
        roomType: "code",
      });

      // Notify other players
      socket.to(roomData.id).emit("player-joined-room", {
        player: gameService.getPlayer(socket.id).toJSON(),
        waitingForPlayers: roomData.maxPlayers - roomData.players.length,
      });

      if (actualRoom?.isFull()) {
        io.to(roomData.id).emit("room-full", {
          message: "Room is full! Ready up for match.",
          roomId: roomData.id,
          timestamp: Date.now(),
        });
      }
    } else {
      socket.emit("error", {
        message: result.reason || "Failed to join room",
        type: "ROOM_JOIN_ERROR",
        roomCode: roomCode,
      });
    }
  } catch (error) {
    console.error("Error in handleJoinRoomByCode:", error);
    socket.emit("error", {
      message: "Failed to join room",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Handle player ready/unready toggle
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const handlePlayerReady = async (socket, io) => {
  try {
    // Check authentication
    if (!requireAuth(socket)) return;

    const result = gameService.togglePlayerReady(socket.id);

    if (result.success) {
      const { player, room, canStart } = result;

      gameBroadcaster.broadcastPlayerReady(room.id, {
        playerId: player.id,
        username: player.username,
        playerPosition: player.position, // Add the missing playerPosition field
        isReady: player.isReady,
        allPlayersReady: canStart,
        room: room.toJSON(),
        timestamp: Date.now(),
      });

      if (canStart) {
        const startResult = gameService.startGame(room.id);
        if (startResult.success) {
          // Create match in database
          try {
            const [player1, player2] = room.players;
            const matchResult = await matchService.createMatch(
              { userId: player1.userId },
              { userId: player2.userId }
            );

            if (matchResult.success) {
              await matchService.startMatch(matchResult.match._id);
              room.matchId = matchResult.match._id;
            }
          } catch (error) {
            console.error("Error creating database match:", error);
          }

          gameBroadcaster.broadcastGameStarted(room.id, {
            message: "1v1 Match Starting!",
            room: startResult.room.toJSON(),
            matchDuration: startResult.room.settings.matchDuration,
          });
        } else {
          gameBroadcaster.broadcastError(room.id, {
            message: `Failed to start game: ${startResult.reason}`,
            type: "GAME_START_ERROR",
          });
        }
      }
    } else {
      gameBroadcaster.broadcastError(socket.id, {
        message: result.reason,
        type: "READY_ERROR",
      });
    }
  } catch (error) {
    console.error("Error in handlePlayerReady:", error);
    socket.emit("error", {
      message: "Failed to update ready status",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Handle game end event
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} data - Game end data with final score and duration
 */
const handleGameEnd = async (socket, io, data) => {
  try {
    const player = gameService.getPlayer(socket.id);
    if (!player?.currentRoom) {
      socket.emit("error", { message: "Player not in a room" });
      return;
    }

    const room = gameService.getRoom(player.currentRoom);
    if (!room?.matchId) {
      socket.emit("error", { message: "No active match found" });
      return;
    }

    const matchResult = await matchService.endMatch(
      room.matchId,
      data.finalScore,
      data.duration
    );
    if (matchResult.success) {
      // Update user stats
      const [player1, player2] = room.players;
      const winner = matchResult.match.result.winner;

      const updateStats = async (player, isWinner) => {
        if (player.userId) {
          const outcome = isWinner
            ? "win"
            : winner === "draw"
            ? "draw"
            : "loss";
          await userService.updateUserMatchStats(player.userId, { outcome });
        }
      };

      await Promise.all([
        updateStats(player1, winner === player1.userId),
        updateStats(player2, winner === player2.userId),
      ]);

      io.to(room.id).emit("match-ended", {
        message: "Match completed!",
        finalScore: data.finalScore,
        duration: data.duration,
        matchId: room.matchId,
        winner: winner,
      });
    }
  } catch (error) {
    console.error("Error in handleGameEnd:", error);
    socket.emit("error", { message: "Failed to end match" });
  }
};

/**
 * Handle goal scored event
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} data - Goal data
 */
const handleGoalScored = (socket, io, data) => {
  try {
    const result = gameService.handleGameAction(socket.id, "goal", data);
    if (!result.success) {
      socket.emit("error", {
        message: result.reason || "Failed to process goal",
        type: "GOAL_ERROR",
      });
    }
  } catch (error) {
    console.error("Error in handleGoalScored:", error);
    socket.emit("error", {
      message: "Failed to process goal",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Handle game state update event
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} data - Game state data
 */
const handleGameStateUpdate = (socket, io, data) => {
  try {
    const result = gameService.handleGameAction(
      socket.id,
      "game_state_update",
      data
    );
    if (!result.success) {
      socket.emit("error", {
        message: result.reason || "Failed to update game state",
        type: "GAME_STATE_ERROR",
      });
    }
  } catch (error) {
    console.error("Error in handleGameStateUpdate:", error);
    socket.emit("error", {
      message: "Failed to update game state",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Handle player input events for real-time gameplay
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} data - Input data
 */
const handlePlayerInput = (socket, io, data) => {
  try {
    const player = gameService.getPlayer(socket.id);
    if (!player || !player.currentRoom) {
      return;
    }

    const room = gameService.getRoom(player.currentRoom);
    if (!room || !room.gameState.isActive) {
      return;
    }

    // Relay input to other players in the room for frontend physics
    socket.to(room.id).emit("player-input", {
      playerId: player.id,
      username: player.username,
      position: player.position,
      action: data.action,
      input: data,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("Error in handlePlayerInput:", error);
  }
};

/**
 * Handle ball state synchronization from the ball authority
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} data - Ball state data
 */
const handleBallState = (socket, io, data) => {
  try {
    const player = gameService.getPlayer(socket.id);
    if (!player || !player.currentRoom) {
      return;
    }

    const room = gameService.getRoom(player.currentRoom);
    if (!room || !room.gameState.isActive) {
      return;
    }

    // Only player1 should be sending ball state (ball authority)
    if (player.position !== "player1") {
      return;
    }

    // Relay ball state to other players in the room
    socket.to(room.id).emit("ball-state", {
      ball: data.ball,
      timestamp: data.timestamp,
    });
  } catch (error) {
    console.error("Error in handleBallState:", error);
  }
};

/**
 * Handle player position synchronization
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 * @param {Object} data - Player position data
 */
const handlePlayerPosition = (socket, io, data) => {
  try {
    const player = gameService.getPlayer(socket.id);
    if (!player || !player.currentRoom) {
      console.log(`[POSITION] Player ${socket.id} not found or not in room`);
      return;
    }

    const room = gameService.getRoom(player.currentRoom);
    if (!room || !room.gameState.isActive) {
      console.log(
        `[POSITION] Room ${
          player.currentRoom
        } not found or game not active. Room: ${!!room}, Active: ${
          room?.gameState.isActive
        }`
      );
      return;
    }

    // CRITICAL: Validate that player is sending their own position
    console.log(`[POSITION] Position validation:`, {
      socketId: socket.id,
      playerStoredPosition: player.position,
      dataSentPosition: data.position,
      match: player.position === data.position,
      timestamp: new Date().toISOString(),
    });

    if (player.position !== data.position) {
      console.warn(`[POSITION] ❌ POSITION MISMATCH DETECTED!`, {
        socketId: socket.id,
        playerStoredPosition: player.position,
        dataSentPosition: data.position,
        reason: "Frontend-backend position assignment mismatch",
        action: "Position update REJECTED",
      });
      return;
    }

    console.log(
      `[POSITION] ✅ Position update accepted for ${player.position}:`,
      {
        socketId: socket.id,
        x: data.player?.x,
        y: data.player?.y,
        velocityX: data.player?.velocityX,
        velocityY: data.player?.velocityY,
      }
    );

    // Relay player position to other players in the room
    socket.to(room.id).emit("player-position", {
      position: data.position,
      player: data.player,
      timestamp: data.timestamp,
    });

    console.log(
      `[POSITION] Position broadcasted to room ${room.id} (${
        room.players.length - 1
      } other players)`
    );
  } catch (error) {
    console.error("Error in handlePlayerPosition:", error);
  }
};

/**
 * Handle player leaving room
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const handleLeaveRoom = (socket, io) => {
  try {
    const result = gameService.leaveRoom(socket.id);
    if (result.success) {
      const { room, player } = result;
      socket.leave(room.id);
      socket.emit("left-room", { roomId: room.id });

      gameBroadcaster.broadcastPlayerLeft(room.id, {
        playerId: player.id,
        username: player.username,
        remainingPlayers: room.players.length,
        message: `${player.username} left the match`,
      });
    } else {
      socket.emit("error", {
        message: result.reason || "Failed to leave room",
        type: "ROOM_ERROR",
      });
    }
  } catch (error) {
    console.error("Error in handleLeaveRoom:", error);
    socket.emit("error", {
      message: "Failed to leave room",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Handle player disconnection
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const handleDisconnect = (socket, io) => {
  const player = gameService.removePlayer(socket.id);
  if (player?.currentRoom) {
    gameBroadcaster.broadcastPlayerLeft(player.currentRoom, {
      playerId: player.id,
      username: player.username,
      message: `${player.username} disconnected`,
      reason: "disconnect",
    });
  }
};

/**
 * Handle rematch request
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const handleRequestRematch = async (socket, io) => {
  try {
    console.log(`[REMATCH] Player ${socket.id} requested rematch`);

    if (!socket.userId) {
      console.warn(`Player ${socket.id} not authenticated for rematch`);
      socket.emit("error", {
        message: "Authentication required for rematch",
        type: "AUTH_REQUIRED",
      });
      return;
    }

    const player = gameService.getPlayer(socket.id);
    if (!player || !player.currentRoom) {
      console.warn(`Player ${socket.id} not in a room for rematch`);
      socket.emit("error", {
        message: "You must be in a room to request rematch",
        type: "NOT_IN_ROOM",
      });
      return;
    }

    const room = gameService.getRoom(player.currentRoom);
    if (!room) {
      console.warn(`Room ${player.currentRoom} not found for rematch`);
      socket.emit("error", {
        message: "Room not found",
        type: "ROOM_NOT_FOUND",
      });
      return;
    }

    if (room.status !== "finished") {
      console.warn(
        `Room ${room.id} not finished, cannot rematch (status: ${room.status})`
      );
      socket.emit("error", {
        message: "Game must be finished to request rematch",
        type: "GAME_NOT_FINISHED",
      });
      return;
    }

    // Use the gameService rematch system which handles the roomManager
    const rematchResult = gameService.requestRematch(socket.id);

    if (rematchResult.success) {
      console.log(
        `[REMATCH] ✅ Rematch request processed for ${player.username}`
      );

      // Notify all players about the rematch request using direct socket emission
      io.to(room.id).emit("rematch-requested", {
        type: "rematch-requested",
        requesterId: player.id,
        requesterUsername: player.username,
        requesterPosition: player.position,
        message: `${player.username} wants a rematch!`,
        rematchState: rematchResult.rematchState || {
          player1Requested: player.position === "player1",
          player2Requested: player.position === "player2",
          timeoutActive: false,
        },
        timestamp: Date.now(),
      });

      // Check if this completed the rematch (both players requested)
      if (rematchResult.bothRequested) {
        console.log(
          `[REMATCH] 🎮 Both players want rematch in room ${room.id} - executing automatic restart`
        );

        // The executeRematch method in gameService will handle:
        // 1. Room reset
        // 2. Auto-ready both players
        // 3. Auto-start new game
        // 4. Broadcast events
        // This was already called by gameService.requestRematch() when bothRequested is true
      }
    } else {
      console.error(
        `[REMATCH] ❌ Failed to process rematch request: ${rematchResult.reason}`
      );
      socket.emit("error", {
        message: rematchResult.reason || "Failed to request rematch",
        type: "REMATCH_ERROR",
      });
    }
  } catch (error) {
    console.error("Error in handleRequestRematch:", error);
    socket.emit("error", {
      message: "Failed to request rematch",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Handle rematch decline
 * @param {Socket} socket - Socket.IO socket instance
 * @param {Server} io - Socket.IO server instance
 */
const handleDeclineRematch = async (socket, io) => {
  try {
    console.log(`[REMATCH] Player ${socket.id} declined rematch`);

    if (!socket.userId) {
      console.warn(`Player ${socket.id} not authenticated for rematch decline`);
      return;
    }

    const player = gameService.getPlayer(socket.id);
    if (!player.currentRoom) {
      console.warn(`Player ${player.id} not in a room for rematch decline`);
      return;
    }

    const room = gameService.getRoom(player.currentRoom);
    if (!room) {
      console.warn(`Room ${player.currentRoom} not found for rematch decline`);
      return;
    }

    // Mark this player as declining rematch
    const roomPlayer = room.players.find((p) => p.id === player.id);
    if (roomPlayer) {
      roomPlayer.requestedRematch = false;

      // Broadcast rematch declined to all players using direct socket emission
      io.to(room.id).emit("rematch-declined", {
        type: "rematch-declined",
        declinerId: player.id,
        declinerUsername: player.username,
        message: `${player.username} declined the rematch`,
        timestamp: Date.now(),
      });

      console.log(
        `[REMATCH] Rematch declined by ${player.id} in room ${room.id}`
      );

      // Reset all rematch requests since one player declined
      room.players.forEach((p) => {
        p.requestedRematch = false;
      });
    }
  } catch (error) {
    console.error("Error in handleDeclineRematch:", error);
    socket.emit("error", {
      message: "Failed to decline rematch",
      type: "SERVER_ERROR",
    });
  }
};

/**
 * Initialize Socket.IO server with event handlers
 * @param {Server} server - HTTP server instance
 * @returns {Server} Socket.IO server instance
 */
function initializeSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps)
        if (!origin) return callback(null, true);

        const allowedOrigins =
          process.env.NODE_ENV === "production"
            ? [process.env.FRONTEND_URL].filter(Boolean)
            : [
                "http://localhost:3000",
                "http://localhost:3001", // Next.js default port
                "http://127.0.0.1:3000",
                "http://127.0.0.1:3001",
                "http://localhost:5500",
              ];

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // For development, be more permissive
        if (process.env.NODE_ENV !== "production") {
          return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      credentials: true, // Enable credentials for cookie authentication
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    allowUpgrades: true,
    perMessageDeflate: false,
    httpCompression: false,
  });

  // Initialize services with Socket.IO instance
  gameService.setSocketIO(io);
  gameBroadcaster.setSocketIO(io);

  let connectionCount = 0;

  io.on("connection", (socket) => {
    connectionCount++;

    // Verify authentication on connection
    const authPayload = verifySocketAuth(socket);
    if (authPayload) {
      socket.emit("welcome", {
        message: "Welcome to MetaHead Arena!",
        playerId: socket.id,
        authenticated: true,
        walletAddress: authPayload.address,
        serverTime: Date.now(),
      });
    } else {
      socket.emit("welcome", {
        message: "Welcome to MetaHead Arena!",
        playerId: socket.id,
        authenticated: false,
        notice: "Please authenticate to join games",
        serverTime: Date.now(),
      });
    }

    // === Core Game Event Handlers ===
    socket.on("join-game", (data) => handlePlayerJoin(socket, io, data));
    socket.on("find-match", () => handleFindMatch(socket, io));
    socket.on("create-room", () => handleCreateRoom(socket, io));
    socket.on("join-room-by-code", (data) =>
      handleJoinRoomByCode(socket, io, data)
    );
    socket.on("player-ready", () => handlePlayerReady(socket, io));
    socket.on("game-end", (data) => handleGameEnd(socket, io, data));
    socket.on("leave-room", () => handleLeaveRoom(socket, io));
    socket.on("request-rematch", () => handleRequestRematch(socket, io));
    socket.on("decline-rematch", () => handleDeclineRematch(socket, io));

    // === Gameplay Event Handlers ===
    socket.on("goal-scored", (data) => handleGoalScored(socket, io, data));
    socket.on("game-state-update", (data) =>
      handleGameStateUpdate(socket, io, data)
    );

    // === Input relay for frontend physics ===
    const inputEvents = [
      "move-left",
      "move-right",
      "jump",
      "kick",
      "stop-move",
    ];
    inputEvents.forEach((eventName) => {
      socket.on(eventName, (data) => {
        const actionName = eventName === "stop-move" ? "stop" : eventName;
        handlePlayerInput(socket, io, {
          action: actionName,
          pressed: data?.pressed ?? true,
          ...data,
        });
      });
    });

    socket.on("player-input", (data) => {
      handlePlayerInput(socket, io, data);
    });

    // === Ball State Synchronization ===
    socket.on("ball-state", (data) => {
      handleBallState(socket, io, data);
    });

    // === Player Position Synchronization ===
    socket.on("player-position", (data) => {
      handlePlayerPosition(socket, io, data);
    });

    // === Connection Management ===
    socket.on("disconnect", (reason) => {
      connectionCount--;
      handleDisconnect(socket, io);
    });
  });

  return io;
}

module.exports = { initializeSocket };
