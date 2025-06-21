const socketIo = require("socket.io");
const gameService = require("../services/gameService");

// Socket event handlers as individual functions
const handlePlayerJoin = (socket, io, data) => {
  const result = gameService.createPlayer(socket.id, data.username);

  if (result.success) {
    socket.emit("player-created", {
      player: result.player.toJSON(),
    });

    socket.emit("game-status", gameService.getGameStats());
    console.log(`${result.player.username} joined the game`);
  } else {
    socket.emit("error", { message: result.reason });
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
    socket.emit("room-joined", {
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
      io.to(room.id).emit("room-full", {
        message: "Found opponent! Both players can now ready up for 1v1 match.",
        room: room.toJSON(),
      });
    }
  } else {
    socket.emit("error", { message: result.reason });
  }
};

const handlePlayerReady = (socket, io) => {
  const result = gameService.togglePlayerReady(socket.id);

  if (result.success) {
    const { player, room, canStart } = result;

    // Notify all players in room
    io.to(room.id).emit("player-ready-changed", {
      playerId: player.id,
      username: player.username,
      isReady: player.isReady,
      allPlayersReady: canStart,
    });

    // Start 1v1 game if both players are ready
    if (canStart) {
      const startResult = gameService.startGame(room.id);
      if (startResult.success) {
        console.log(
          `Game starting in room ${room.id} with players:`,
          room.players.map((p) => p.username)
        );
        io.to(room.id).emit("game-started", {
          message: "1v1 Match Starting! Good luck!",
          room: startResult.room.toJSON(),
          matchDuration: startResult.room.settings.matchDuration,
        });
      }
    }
  } else {
    socket.emit("error", { message: result.reason });
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

  // Connect GameService to Socket.IO for 60fps broadcasting
  gameService.setSocketIO(io);

  // Performance monitoring
  let connectionCount = 0;
  
  io.on("connection", (socket) => {
    connectionCount++;
    console.log(`Player connected: ${socket.id} (Total: ${connectionCount})`);

    // Enhanced welcome with server info
    socket.emit("welcome", {
      message: "Welcome to MetaHead Arena! 1v1 Football Game",
      playerId: socket.id,
      serverTime: Date.now(),
      gameVersion: "1.0.0",
      features: ["realtime-physics", "60fps-updates", "anti-cheat"]
    });

    // Input rate limiting per socket
    let inputCount = 0;
    let lastInputReset = Date.now();
    
    const checkInputRate = () => {
      const now = Date.now();
      if (now - lastInputReset > 1000) { // Reset every second
        inputCount = 0;
        lastInputReset = now;
      }
      
      inputCount++;
      if (inputCount > 120) { // Max 120 inputs per second
        socket.emit("error", { 
          message: "Input rate limit exceeded", 
          type: "RATE_LIMIT" 
        });
        return false;
      }
      return true;
    };

    // Enhanced event handlers with validation
    socket.on("join-game", (data) => {
      try {
        if (!data || typeof data.username !== 'string') {
          socket.emit("error", { message: "Invalid username", type: "VALIDATION_ERROR" });
          return;
        }
        handlePlayerJoin(socket, io, data);
      } catch (error) {
        console.error(`Error in join-game:`, error);
        socket.emit("error", { message: "Internal server error", type: "SERVER_ERROR" });
      }
    });

    socket.on("find-match", () => {
      try {
        handleFindMatch(socket, io);
      } catch (error) {
        console.error(`Error in find-match:`, error);
        socket.emit("error", { message: "Matchmaking error", type: "SERVER_ERROR" });
      }
    });

    socket.on("player-ready", () => handlePlayerReady(socket, io));
    socket.on("ready", () => handlePlayerReady(socket, io));

    // Enhanced input handling with rate limiting
    const inputEvents = ["move-left", "move-right", "jump", "kick", "stop-move"];
    inputEvents.forEach(eventName => {
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
        socket.emit("error", { message: "Invalid input data", type: "VALIDATION_ERROR" });
        return;
      }
      handlePlayerInput(socket, io, data);
    });

    // Room management
    socket.on("leave-room", () => handleLeaveRoom(socket, io));
    
    // Connection management with cleanup
    socket.on("disconnect", (reason) => {
      connectionCount--;
      console.log(`Player disconnected: ${socket.id} (Reason: ${reason}, Total: ${connectionCount})`);
      handleDisconnect(socket, io);
    });

    socket.on("error", (error) => {
      console.error(`Socket error from ${socket.id}:`, error);
    });

    // Heartbeat for connection quality monitoring
    socket.on("ping", (callback) => {
      if (typeof callback === 'function') {
        callback(Date.now());
      }
    });
  });

  // Server-side performance monitoring
  setInterval(() => {
    const stats = {
      connections: connectionCount,
      rooms: gameService.gameRooms.size,
      activeGames: Array.from(gameService.gameRooms.values())
        .filter(room => room.status === "playing").length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: Date.now()
    };
    
    // Emit to admin clients if needed
    io.emit("server-stats", stats);
  }, 30000); // Every 30 seconds

  return io;
}

module.exports = { initializeSocket };
