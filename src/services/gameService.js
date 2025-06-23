const Player = require("../models/player");
const User = require("../models/user");

// Import the new modular services
const userService = require("./userService");
const matchService = require("./matchService");
const roomManagerService = require("./roomManagerService");
const physicsEngine = require("./physicsEngine");
const gameBroadcaster = require("./gameBroadcaster");

class GameService {
  constructor() {
    this.connectedPlayers = new Map();
    this.gameLoops = new Map();
    this.startGameLoopCoordinator();
  }

  // Delegate to UserService
  async updateUserMatchStats(userId, matchResult) {
    return await userService.updateUserMatchStats(userId, matchResult);
  }

  // Delegate to RoomManagerService
  get gameRooms() {
    return roomManagerService.gameRooms;
  }

  get waitingPlayers() {
    return roomManagerService.waitingPlayers;
  }

  createRoom(roomData = {}) {
    return roomManagerService.createRoom(roomData);
  }

  getRoom(roomId) {
    return roomManagerService.getRoom(roomId);
  }

  deleteRoom(roomId) {
    return roomManagerService.deleteRoom(roomId);
  }

  findAvailableRoom() {
    return roomManagerService.findAvailableRoom();
  }

  async getAvailableRooms(options) {
    return await roomManagerService.getAvailableRooms(options);
  }

  async getAllRooms() {
    return await roomManagerService.getAllRooms();
  }

  findMatch(socketId) {
    const player = this.getPlayer(socketId);
    return roomManagerService.findMatch(player);
  }

  leaveRoom(socketId) {
    const player = this.getPlayer(socketId);
    return roomManagerService.leaveRoom(player);
  }

  async joinSpecificRoom(playerId, roomId) {
    const player = this.getPlayer(playerId);
    return await roomManagerService.joinSpecificRoom(player, roomId);
  }

  async leaveSpecificRoom(playerId, roomId) {
    const player = this.getPlayer(playerId);
    return await roomManagerService.leaveSpecificRoom(player, roomId);
  }

  togglePlayerReady(socketId) {
    const player = this.getPlayer(socketId);
    return roomManagerService.togglePlayerReady(player);
  }

  startGame(roomId) {
    const result = roomManagerService.startGame(roomId);
    if (result.success) {
      // Start the physics loop for this roomf
      this.startRoomGameWithLoop(result.room);
    }
    return result;
  }

  endGame(roomId, winnerId = null) {
    // Stop the game loop first
    this.stopGameLoop(roomId);

    // End the game in room manager
    const result = roomManagerService.endGame(roomId, winnerId);

    return result;
  }

  // Player Management (kept in GameService as it's Socket.IO specific)
  createPlayer(socketId, username, userId = null) {
    if (this.connectedPlayers.has(socketId)) {
      return { success: false, reason: "Player already exists" };
    }

    const player = new Player(socketId, username, userId);
    this.connectedPlayers.set(socketId, player);

    return { success: true, player: player };
  }

  getPlayer(socketId) {
    return this.connectedPlayers.get(socketId);
  }

  removePlayer(socketId) {
    const player = this.connectedPlayers.get(socketId);
    if (!player) return null;

    if (player.currentRoom) {
      this.leaveRoom(socketId);
    }

    // Remove from waiting players if they were waiting
    this.waitingPlayers.delete(socketId);

    // Remove from connected players
    this.connectedPlayers.delete(socketId);

    return player;
  }

  async getAllPlayers() {
    return Array.from(this.connectedPlayers.values()).map((player) =>
      player.toJSON()
    );
  }

  // Game Action Handling (coordinates physics and broadcasting)
  handleGameAction(socketId, action, data = {}) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room || !room.gameState.isActive) {
      return { success: false, reason: "Game not active" };
    }

    // Handle action based on type
    switch (action) {
      case "kick":
        return this.handlePlayerKick(socketId, data);
      case "move":
        return this.handlePlayerInput(socketId, data);
      default:
        return { success: false, reason: "Unknown action" };
    }
  }

  handlePlayerInput(socketId, inputData) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room || !room.gameState.isActive) {
      return { success: false, reason: "Game not active" };
    }

    // Delegate to physics engine
    const result = physicsEngine.handlePlayerInput(room, socketId, inputData);

    if (result.success && result.kickResult) {
      // Broadcast kick action
      gameBroadcaster.broadcastPlayerKick(
        room.id,
        player.id,
        player.username,
        result.kickResult
      );
    }

    return result;
  }

  handlePlayerKick(socketId, data) {
    return this.handlePlayerInput(socketId, {
      action: "kick",
      pressed: data.pressed || true,
    });
  }

  // Save match after game ends
  async saveMatchAfterGameEnd(room, gameResult) {
    try {
      console.log(`💾 saveMatchAfterGameEnd called for room ${room.id}`);
      console.log(`💾 Room matchId: ${room.matchId}`);
      console.log(`💾 Game result:`, JSON.stringify(gameResult, null, 2));

      if (!room.matchId) {
        console.log(
          `❌ No matchId found for room ${room.id}, skipping match save`
        );
        return;
      }

      // Check if match is already finished to prevent duplicate saves
      const currentMatch = await matchService.getMatchById(room.matchId);
      if (currentMatch.success && currentMatch.match.status === "finished") {
        console.log(`⚠️ Match ${room.matchId} already finished, skipping save`);
        return;
      }

      const finalScore = gameResult.finalScore || room.gameState.score;
      const duration = 120 - room.gameState.gameTime; // Calculate duration from remaining time

      console.log(`💾 Saving match ${room.matchId} after game end...`);
      console.log(`💾 Final score:`, finalScore);
      console.log(`💾 Duration:`, duration);

      const matchResult = await matchService.endMatch(
        room.matchId,
        finalScore,
        duration
      );

      if (matchResult.success) {
        console.log(`Match ${room.matchId} saved successfully after game end`);

        // Update user stats for both players
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
      } else {
        console.error("Error saving match after game end:", matchResult.error);
      }
    } catch (error) {
      console.error("Error in saveMatchAfterGameEnd:", error);
    }
  }

  // Physics and Game Loop Management
  async updateGamePhysics(roomId, deltaTime = 16.67) {
    const room = this.getRoom(roomId);

    // Validate room exists and game is active
    if (!room) {
      console.warn(`updateGamePhysics: Room ${roomId} not found`);
      this.stopGameLoop(roomId); // Stop loop for non-existent room
      return null;
    }

    if (!room.gameState || !room.gameState.isActive) {
      console.log(
        `updateGamePhysics: Game not active for room ${roomId}, stopping loop`
      );
      this.stopGameLoop(roomId);
      return null;
    }

    const result = physicsEngine.updateGamePhysics(room, deltaTime);

    if (result) {
      // Broadcast game state updates
      gameBroadcaster.broadcastGameState(roomId, result);

      // Handle goal events
      if (result.goalResult) {
        gameBroadcaster.broadcastGoalEvent(roomId, result.goalResult);
      }

      // Handle game end
      if (result.type === "game-ended") {
        console.log(`🏁 Game ended for room ${roomId}, processing...`);

        // Mark game as inactive BEFORE stopping loop
        room.gameState.isActive = false;
        room.status = "finished";
        this.stopGameLoop(roomId);

        console.log(
          `🏁 Room ${roomId} status set to finished, saving match...`
        );

        // Save match to database after game status is set to finished
        await this.saveMatchAfterGameEnd(room, result);

        gameBroadcaster.broadcastGameEnd(roomId, result);
        return result;
      }
    }

    return result;
  }

  // Game Loop Management
  startGameLoopCoordinator() {
    // Check for active games every 100ms and ensure they have game loops
    setInterval(() => {
      this.gameRooms.forEach((room, roomId) => {
        // Only start loops for actively playing games
        if (
          room.gameState.isActive &&
          room.status === "playing" &&
          !this.gameLoops.has(roomId)
        ) {
          console.log(`🔄 Coordinator starting game loop for room ${roomId}`);
          this.startGameLoop(roomId);
        }

        // Stop loops for inactive games or finished games
        if (
          (!room.gameState.isActive || room.status !== "playing") &&
          this.gameLoops.has(roomId)
        ) {
          console.log(
            `🔄 Coordinator stopping game loop for room ${roomId} (status: ${room.status}, active: ${room.gameState.isActive})`
          );
          this.stopGameLoop(roomId);
        }
      });
    }, 100);
  }

  startGameLoop(roomId) {
    if (this.gameLoops.has(roomId)) {
      console.log(`Game loop already running for room ${roomId}`);
      return;
    }

    console.log(`🎮 Starting 60fps game loop for room ${roomId}`);

    let lastUpdate = Date.now();
    const targetFPS = 60;
    const targetDelta = 1000 / targetFPS; // 16.67ms

    const gameLoop = setInterval(async () => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastUpdate;
      lastUpdate = currentTime;

      try {
        // Check if room still exists before updating
        const room = this.getRoom(roomId);
        if (!room) {
          console.log(`🛑 Room ${roomId} no longer exists, stopping game loop`);
          this.stopGameLoop(roomId);
          return;
        }

        // Check if game is still active
        if (!room.gameState.isActive || room.status !== "playing") {
          console.log(
            `🛑 Game no longer active for room ${roomId}, stopping game loop`
          );
          this.stopGameLoop(roomId);
          return;
        }

        const result = await this.updateGamePhysics(roomId, deltaTime);

        // If game ended, stop the loop
        if (result && result.type === "game-ended") {
          this.stopGameLoop(roomId);
        }
      } catch (error) {
        console.error(`Error in game loop for room ${roomId}:`, error);
        console.error(`Error details:`, error.stack);
        this.stopGameLoop(roomId);
      }
    }, targetDelta);

    this.gameLoops.set(roomId, gameLoop);
  }

  stopGameLoop(roomId) {
    const gameLoop = this.gameLoops.get(roomId);
    if (gameLoop) {
      clearInterval(gameLoop);
      this.gameLoops.delete(roomId);
      console.log(`🛑 Stopped game loop for room ${roomId}`);
    }
  }

  // Enhanced game start with loop
  startRoomGameWithLoop(room) {
    // Game loop will be started automatically by coordinator
    console.log(`Game started in room ${room.id} with 60fps physics loop`);
  }

  // Unified Statistics API
  getGameStats() {
    const roomStats = roomManagerService.getRoomStats();
    return {
      totalPlayers: this.connectedPlayers.size,
      ...roomStats,
      serverUptime: process.uptime(),
      timestamp: Date.now(),
    };
  }

  // Socket.IO Integration
  setSocketIO(io) {
    gameBroadcaster.setSocketIO(io);
  }
}

module.exports = new GameService();
