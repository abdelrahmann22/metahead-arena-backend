const socketIo = require("socket.io");
const gameService = require("../services/gameService");
const matchService = require("../services/matchService");
const gameBroadcaster = require("../services/gameBroadcaster");
const userService = require("../services/userService");
const nftService = require("../services/nftService");

// Socket event handlers as individual functions
const handlePlayerJoin = async (socket, io, data) => {
  try {
    // Validate required data - only check what exists in User model
    if (!data || !data.walletAddress) {
      socket.emit("error", {
        message: "Wallet address is required",
        type: "VALIDATION_ERROR",
      });
      return;
    }

    // Create or get user from database
    const userResult = await userService.createUserFromWallet(
      data.walletAddress,
      data.username // username is optional, has default
    );

    if (!userResult.success) {
      socket.emit("error", {
        message: userResult.error,
        type: "USER_ERROR",
      });
      return;
    }

    const user = userResult.user;

    // Get NFT modifiers if player specifies an NFT
    let nftModifiers = null;
    if (data.nftId) {
      const nftResult = await nftService.getNFTById(data.nftId);
      if (nftResult.success) {
        nftModifiers = nftService.getGameModifiers(nftResult.nft);
      }
    }

    // Default modifiers if no NFT specified
    if (!nftModifiers) {
      nftModifiers = {
        speedMultiplier: 1.0,
        jumpMultiplier: 1.0,
        superkickMultiplier: 1.0,
      };
    }

    // Create player with Web3 data
    const result = gameService.createPlayer(
      socket.id,
      data.username,
      user._id // Link to database user
    );

    if (result.success) {
      // Store additional Web3 data in player object
      result.player.walletAddress = user.walletAddress;
      result.player.nftModifiers = nftModifiers;

      gameBroadcaster.broadcastPlayerCreated(socket.id, {
        player: result.player.toJSON(),
        user: {
          walletAddress: user.walletAddress,
        },
        nftModifiers: nftModifiers,
      });

      socket.emit("game-status", gameService.getGameStats());
      console.log(
        `${result.player.username} (${
          user.walletAddress
        }) joined the game with modifiers: ${JSON.stringify(nftModifiers)}`
      );
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

const handleFindMatch = (socket, io) => {
  const result = gameService.findMatch(socket.id);

  if (result.success) {
    const room = result.room;
    socket.join(room.id);

    console.log(
      `Player ${socket.id} joined room ${room.id}. Players in room: ${room.players.length}`
    );

    // Notify player
    gameBroadcaster.broadcastRoomJoined(socket.id, {
      roomId: room.id,
      players: room.players.map((p) => p.toJSON()),
      waitingForPlayers: room.maxPlayers - room.players.length,
      gameMode: "1v1",
    });

    // Notify other players in room
    socket.to(room.id).emit("player-joined-room", {
      player: gameService.getPlayer(socket.id).toJSON(),
      waitingForPlayers: room.maxPlayers - room.players.length,
    });

    // Check if room is full (2 players for 1v1)
    if (room.isFull()) {
      gameBroadcaster.broadcastRoomFull(
        room.id,
        "Found opponent! Both players can now ready up for 1v1 match."
      );
    }
  } else {
    gameBroadcaster.broadcastError(socket.id, { message: result.reason });
  }
};

const handlePlayerReady = async (socket, io) => {
  const result = gameService.togglePlayerReady(socket.id);

  if (result.success) {
    const { player, room, canStart } = result;

    console.log(`🔄 Player ready status changed:`, {
      playerId: player.id,
      username: player.username,
      isReady: player.isReady,
      roomId: room.id,
      playersInRoom: room.players.length,
      allPlayersReady: canStart,
      roomStatus: room.status,
    });

    // Log all players' ready status for debugging
    console.log(
      `📊 All players ready status in room ${room.id}:`,
      room.players.map((p) => ({
        username: p.username,
        isReady: p.isReady,
      }))
    );

    // Notify all players in room
    gameBroadcaster.broadcastPlayerReady(room.id, {
      playerId: player.id,
      username: player.username,
      isReady: player.isReady,
      allPlayersReady: canStart,
    });

    // Start 1v1 game if both players are ready
    if (canStart) {
      console.log(`🚀 Starting game in room ${room.id} - all players ready!`);
      const startResult = gameService.startGame(room.id);
      if (startResult.success) {
        console.log(
          `Game starting in room ${room.id} with players:`,
          room.players.map((p) => p.username)
        );

        // Create match in database with validated user data
        try {
          const player1 = room.players[0];
          const player2 = room.players[1];

          const matchResult = await matchService.createMatch(
            {
              userId: player1.userId, // Now properly set from database
            },
            {
              userId: player2.userId,
            }
          );

          if (matchResult.success) {
            // Start the match in database
            await matchService.startMatch(matchResult.match._id);

            // Store match ID in room for later use
            room.matchId = matchResult.match._id;

            console.log(
              `Database match created with ID: ${matchResult.match._id}`
            );
          }
        } catch (error) {
          console.error("Error creating database match:", error);
        }

        gameBroadcaster.broadcastGameStarted(room.id, {
          message: "1v1 Match Starting! Good luck!",
          room: startResult.room.toJSON(),
          matchDuration: startResult.room.settings.matchDuration,
        });
      }
    }
  } else {
    gameBroadcaster.broadcastError(socket.id, { message: result.reason });
  }
};

const handleGameAction = (socket, io, data) => {
  console.log(`Received game action from ${socket.id}:`, data);

  const result = gameService.handleGameAction(socket.id, data.action, data);

  if (result.success) {
    const player = result.player;
    const room = gameService.getRoom(player.currentRoom);

    console.log(
      `Action successful for ${player.username}, broadcasting to room ${room.id}`
    );

    // Broadcast action to other player
    socket.to(room.id).emit("opponent-action", {
      playerId: player.id,
      username: player.username,
      action: result.action,
      data: result.data,
      timestamp: Date.now(),
    });

    // If it's a movement action or kick, broadcast game state update
    if (result.gameState) {
      io.to(room.id).emit("game-state-update", {
        gameState: result.gameState,
        action: result.action,
        playerId: player.id,
        timestamp: Date.now(),
      });
    }

    // If it's a goal, broadcast score update
    if (result.action === "goal") {
      io.to(room.id).emit("score-update", {
        scorer: player.username,
        newScore: result.newScore,
        timestamp: Date.now(),
      });
    }

    console.log(`${player.username} performed action: ${result.action}`);
  } else {
    console.log(`Action failed for ${socket.id}:`, result.reason);
  }
};

const handleGameEnd = async (socket, io, data) => {
  try {
    const player = gameService.getPlayer(socket.id);
    if (!player || !player.currentRoom) {
      socket.emit("error", { message: "Player not in a room" });
      return;
    }

    const room = gameService.getRoom(player.currentRoom);
    if (!room || !room.matchId) {
      socket.emit("error", { message: "No active match found" });
      return;
    }

    // End match in database
    const matchResult = await matchService.endMatch(
      room.matchId,
      data.finalScore, // { player1: 2, player2: 1 }
      data.duration // Duration in seconds
    );

    if (matchResult.success) {
      console.log(`Match ${room.matchId} ended successfully`);

      // Update user stats for both players
      try {
        const player1 = room.players[0];
        const player2 = room.players[1];
        const winner = matchResult.match.result.winner;

        if (player1.userId) {
          const outcome =
            winner === player1.userId
              ? "win"
              : winner === "draw"
              ? "draw"
              : "loss";
          await userService.updateUserMatchStats(player1.userId, { outcome });
        }

        if (player2.userId) {
          const outcome =
            winner === player2.userId
              ? "win"
              : winner === "draw"
              ? "draw"
              : "loss";
          await userService.updateUserMatchStats(player2.userId, { outcome });
        }

        console.log(`User stats updated for match ${room.matchId}`);
      } catch (statsError) {
        console.error("Error updating user stats:", statsError);
      }

      // Broadcast match end to all players in room
      io.to(room.id).emit("match-ended", {
        message: "Match completed!",
        finalScore: data.finalScore,
        duration: data.duration,
        matchId: room.matchId,
        winner: matchResult.match.result.winner,
      });
    } else {
      console.error("Error ending match:", matchResult.error);
    }
  } catch (error) {
    console.error("Error in handleGameEnd:", error);
    socket.emit("error", { message: "Failed to end match" });
  }
};

const handlePlayerInput = (socket, io, data) => {
  const result = gameService.handlePlayerInput(socket.id, data);

  if (result.success) {
    const player = result.player;
    const room = gameService.getRoom(player.currentRoom);

    if (room && room.gameState.isActive) {
      // Broadcast movement to room (60fps updates handled separately)
      io.to(room.id).emit("player-movement", {
        playerId: player.id,
        input: data,
        timestamp: Date.now(),
      });
    }
  }
};

const handlePlayerMovement = (socket, action, data) => {
  gameService.handlePlayerInput(socket.id, {
    action: action,
    pressed: data.pressed || true,
  });
};

const handlePlayerKick = (socket, io, data) => {
  const result = gameService.handlePlayerInput(socket.id, {
    action: "kick",
    pressed: data.pressed || true,
  });

  if (result.success && result.kickResult) {
    const player = result.player;
    const room = gameService.getRoom(player.currentRoom);

    // Broadcast kick action to room
    io.to(room.id).emit("player-kicked-ball", {
      playerId: player.id,
      username: player.username,
      kickPower: result.kickResult.kickPower,
      direction: result.kickResult.direction,
      timestamp: Date.now(),
    });
  }
};

const handleLeaveRoom = (socket, io) => {
  const result = gameService.leaveRoom(socket.id);

  if (result.success) {
    const { room, player } = result;

    socket.leave(room.id);
    socket.emit("left-room", { roomId: room.id });

    // Notify opponent
    socket.to(room.id).emit("player-left-room", {
      playerId: player.id,
      username: player.username,
      remainingPlayers: room.players.length,
      message: `${player.username} left the match`,
    });

    console.log(`${player.username} left room ${room.id}`);
  }
};

const handleDisconnect = (socket, io) => {
  const player = gameService.removePlayer(socket.id);

  if (player && player.currentRoom) {
    // Notify opponent about disconnection
    socket.to(player.currentRoom).emit("player-left-room", {
      playerId: player.id,
      username: player.username,
      message: `${player.username} disconnected`,
      reason: "disconnect",
    });
  }

  console.log(`Player disconnected: ${socket.id}`);
};

function initializeSocket(server) {
  const io = socketIo(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    // Enhanced Socket.IO configuration for better performance
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    allowUpgrades: true,
    perMessageDeflate: false, // Disable compression for lower latency
    httpCompression: false,
  });

  // Connect services to Socket.IO for broadcasting
  gameService.setSocketIO(io);
  gameBroadcaster.setSocketIO(io);

  // Performance monitoring
  let connectionCount = 0;

  io.on("connection", (socket) => {
    connectionCount++;
    console.log(`Player connected: ${socket.id} (Total: ${connectionCount})`);

    // Enhanced welcome with server info
    gameBroadcaster.broadcastWelcome(socket.id, {
      message: "Welcome to MetaHead Arena! 1v1 Football Game",
      playerId: socket.id,
      serverTime: Date.now(),
      gameVersion: "1.0.0",
      features: ["realtime-physics", "60fps-updates", "anti-cheat"],
    });

    // Input rate limiting per socket
    let inputCount = 0;
    let lastInputReset = Date.now();

    const checkInputRate = () => {
      const now = Date.now();
      if (now - lastInputReset > 1000) {
        // Reset every second
        inputCount = 0;
        lastInputReset = now;
      }

      inputCount++;
      if (inputCount > 120) {
        // Max 120 inputs per second
        socket.emit("error", {
          message: "Input rate limit exceeded",
          type: "RATE_LIMIT",
        });
        return false;
      }
      return true;
    };

    // Enhanced event handlers with validation
    socket.on("join-game", async (data) => {
      try {
        if (!data || !data.walletAddress) {
          socket.emit("error", {
            message: "Wallet address is required",
            type: "VALIDATION_ERROR",
          });
          return;
        }
        await handlePlayerJoin(socket, io, data);
      } catch (error) {
        console.error(`Error in join-game:`, error);
        socket.emit("error", {
          message: "Internal server error",
          type: "SERVER_ERROR",
        });
      }
    });

    socket.on("find-match", () => {
      try {
        handleFindMatch(socket, io);
      } catch (error) {
        console.error(`Error in find-match:`, error);
        socket.emit("error", {
          message: "Matchmaking error",
          type: "SERVER_ERROR",
        });
      }
    });

    socket.on("player-ready", () => handlePlayerReady(socket, io));
    socket.on("ready", () => handlePlayerReady(socket, io));

    // Game end event
    socket.on("game-end", (data) => handleGameEnd(socket, io, data));

    // Enhanced input handling with rate limiting
    const inputEvents = [
      "move-left",
      "move-right",
      "jump",
      "kick",
      "stop-move",
    ];
    inputEvents.forEach((eventName) => {
      socket.on(eventName, (data) => {
        if (!checkInputRate()) return;

        const actionName = eventName === "stop-move" ? "stop" : eventName;
        handlePlayerMovement(socket, actionName, data || { pressed: true });
      });
    });

    // Generic player input handler
    socket.on("player-input", (data) => {
      if (!checkInputRate()) return;
      if (!data || !data.action) {
        socket.emit("error", {
          message: "Invalid input data",
          type: "VALIDATION_ERROR",
        });
        return;
      }
      handlePlayerInput(socket, io, data);
    });

    // Room management
    socket.on("leave-room", () => handleLeaveRoom(socket, io));

    // Connection management with cleanup
    socket.on("disconnect", (reason) => {
      connectionCount--;
      console.log(
        `Player disconnected: ${socket.id} (Reason: ${reason}, Total: ${connectionCount})`
      );
      handleDisconnect(socket, io);
    });

    socket.on("error", (error) => {
      console.error(`Socket error from ${socket.id}:`, error);
    });

    // Heartbeat for connection quality monitoring
    socket.on("ping", (callback) => {
      if (typeof callback === "function") {
        callback(Date.now());
      }
    });
  });

  // Performance monitoring (logs only)
  setInterval(() => {
    const stats = {
      connections: connectionCount,
      rooms: gameService.gameRooms.size,
      activeGames: Array.from(gameService.gameRooms.values()).filter(
        (room) => room.status === "playing"
      ).length,
      uptime: Math.floor(process.uptime()),
      memory: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
    };

    console.log(
      `Server Stats: ${stats.connections} players, ${stats.rooms} rooms, ${stats.activeGames} active games, ${stats.memory}MB RAM`
    );
  }, 60000); // Every 60 seconds

  return io;
}

module.exports = { initializeSocket };
