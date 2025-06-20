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
  });

  // Connect GameService to Socket.IO for 60fps broadcasting
  gameService.setSocketIO(io);

  io.on("connection", (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.emit("welcome", {
      message: "Welcome to MetaHead Arena! 1v1 Football Game",
      playerId: socket.id,
    });

    // Event handlers using individual functions
    socket.on("join-game", (data) => handlePlayerJoin(socket, io, data));
    socket.on("find-match", () => handleFindMatch(socket, io));
    socket.on("player-ready", () => handlePlayerReady(socket, io));
    socket.on("ready", () => handlePlayerReady(socket, io));
    socket.on("game-action", (data) => handleGameAction(socket, io, data));
    socket.on("player-input", (data) => handlePlayerInput(socket, io, data));
    
    // Specific movement events
    socket.on("move-left", (data) => handlePlayerMovement(socket, "move-left", data));
    socket.on("move-right", (data) => handlePlayerMovement(socket, "move-right", data));
    socket.on("jump", (data) => handlePlayerMovement(socket, "jump", data));
    socket.on("kick", (data) => handlePlayerKick(socket, io, data));
    socket.on("stop-move", (data) => handlePlayerMovement(socket, "stop", data));

    // Room management
    socket.on("leave-room", () => handleLeaveRoom(socket, io));
    
    // Connection management
    socket.on("disconnect", () => handleDisconnect(socket, io));
    socket.on("error", (error) => {
      console.error(`Socket error from ${socket.id}:`, error);
    });
  });

  return io;
}

module.exports = { initializeSocket };
