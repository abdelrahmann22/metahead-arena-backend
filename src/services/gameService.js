const Player = require("../models/player");

// Import the new modular services
const userService = require("./userService");
const matchService = require("./matchService");
const roomManagerService = require("./roomManagerService");
const gameBroadcaster = require("./gameBroadcaster");

/**
 * @fileoverview Main Game Service
 * @description Central service for managing game flow, player connections, and coordinating with room manager
 * @module services/gameService
 */

/**
 * Game Service - Manages game flow, player connections, and coordinates with room manager
 * @class GameService
 */
class GameService {
  constructor() {
    this.connectedPlayers = new Map(); // socketId -> Player
    this.gameLoops = new Map(); // roomId -> intervalId
    this.rematchTimers = new Map(); // roomId -> timeoutId
    this.io = null;
    this.startGameLoopCoordinator();
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

  findMatch(socketId) {
    const player = this.getPlayer(socketId);
    return roomManagerService.findMatch(player);
  }

  leaveRoom(socketId) {
    const player = this.getPlayer(socketId);
    return roomManagerService.leaveRoom(player);
  }

  async joinRoomByCode(playerId, roomCode) {
    const player = this.getPlayer(playerId);
    return await roomManagerService.joinRoomByCode(player, roomCode);
  }

  togglePlayerReady(socketId) {
    const player = this.getPlayer(socketId);
    return roomManagerService.togglePlayerReady(player);
  }

  startGame(roomId) {
    const result = roomManagerService.startGame(roomId);
    if (result.success) {
      console.log(`Game started in room ${result.room.id}`);
    }
    return result;
  }

  // Player Management (kept in GameService as it's Socket.IO specific)
  createPlayer(socketId, walletAddress, userId = null) {
    if (this.connectedPlayers.has(socketId)) {
      return { success: false, reason: "Player already exists" };
    }

    const player = new Player(socketId, walletAddress, userId);
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

  // Game Action Handling (coordinates state updates and broadcasting)
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
      case "goal":
        return this.handleGoal(socketId, data);
      case "game_state_update":
        return this.handleGameStateUpdate(socketId, data);
      default:
        return { success: false, reason: "Unknown action" };
    }
  }

  // Handle goal scored (called by frontend)
  handleGoal(socketId, data) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room || !room.gameState.isActive) {
      return { success: false, reason: "Game not active" };
    }

    const { scorer } = data;
    if (!scorer || !["player1", "player2"].includes(scorer)) {
      return { success: false, reason: "Invalid scorer" };
    }

    // Update score
    room.gameState.score[scorer]++;

    // Add to game events
    const goalEvent = {
      type: "goal",
      player: scorer,
      time: Date.now(),
      newScore: { ...room.gameState.score },
    };

    room.gameState.gameEvents.push(goalEvent);
    room.gameState.lastGoal = goalEvent;

    // Broadcast goal event
    gameBroadcaster.broadcastGoalEvent(room.id, {
      type: "goal",
      scorer: scorer,
      newScore: room.gameState.score,
      goalEvent: goalEvent,
    });

    return { success: true, goalEvent };
  }

  // Handle game state updates from frontend
  handleGameStateUpdate(socketId, data) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room || !room.gameState.isActive) {
      return { success: false, reason: "Game not active" };
    }

    // Update basic game state (frontend sends essential info)
    if (data.gameTime !== undefined) {
      room.gameState.gameTime = data.gameTime;
    }

    return { success: true };
  }

  // Save match after game ends
  async saveMatchAfterGameEnd(room, gameResult) {
    try {
      console.log(`saveMatchAfterGameEnd called for room ${room.id}`);
      console.log(`Room matchId: ${room.matchId}`);
      console.log(`Game result:`, JSON.stringify(gameResult, null, 2));

      if (!room.matchId) {
        console.log(
          `No matchId found for room ${room.id}, skipping match save`
        );
        return;
      }

      // Check if match is already finished to prevent duplicate saves
      const currentMatch = await matchService.getMatchById(room.matchId);
      if (currentMatch.success && currentMatch.match.status === "finished") {
        console.log(`Match ${room.matchId} already finished, skipping save`);
        return;
      }

      const finalScore = gameResult.finalScore || room.gameState.score;
      const duration = 60 - room.gameState.gameTime; // Calculate duration from remaining time

      console.log(`Saving match ${room.matchId} after game end...`);
      console.log(`Final score:`, finalScore);
      console.log(`Duration:`, duration);

      const matchResult = await matchService.endMatch(
        room.matchId,
        finalScore,
        duration
      );

      if (matchResult.success) {
        console.log(`Match ${room.matchId} saved successfully after game end`);

        // Update user stats for both players
        if (room.players.length >= 2) {
          const player1 = room.players[0];
          const player2 = room.players[1];
          const winner = matchResult.match.result.winner;

          if (player1 && player1.userId) {
            const outcome =
              winner === player1.userId
                ? "win"
                : winner === "draw"
                ? "draw"
                : "loss";
            await userService.updateUserMatchStats(player1.userId, { outcome });
          }

          if (player2 && player2.userId) {
            const outcome =
              winner === player2.userId
                ? "win"
                : winner === "draw"
                ? "draw"
                : "loss";
            await userService.updateUserMatchStats(player2.userId, { outcome });
          }
        }

        console.log(`User stats updated for match ${room.matchId}`);
      } else {
        console.error("Error saving match after game end:", matchResult.error);
      }
    } catch (error) {
      console.error("Error in saveMatchAfterGameEnd:", error);
    }
  }

  // Game State and Timer Management
  async updateGameState(roomId, deltaTime = 16.67) {
    const room = this.getRoom(roomId);

    // Validate room exists and game is active
    if (!room) {
      console.warn(`updateGameState: Room ${roomId} not found`);
      this.stopGameLoop(roomId);
      return null;
    }

    if (!room.gameState || !room.gameState.isActive) {
      console.log(
        `updateGameState: Game not active for room ${roomId}, stopping loop`
      );
      this.stopGameLoop(roomId);
      return null;
    }

    // Update game timer
    const previousTime = room.gameState.gameTime;
    room.gameState.gameTime -= deltaTime / 1000;

    // Ensure timer doesn't go negative
    if (room.gameState.gameTime < 0) {
      room.gameState.gameTime = 0;
    }

    // Send timer updates every second or when time changes significantly
    const shouldSendTimerUpdate =
      Math.floor(previousTime) !== Math.floor(room.gameState.gameTime) ||
      room.gameState.gameTime <= 0;

    if (shouldSendTimerUpdate) {
      // Send dedicated timer update
      gameBroadcaster.broadcastTimerUpdate(roomId, {
        gameTime: room.gameState.gameTime,
        timeRemaining: room.gameState.gameTime,
        elapsedTime: 60 - room.gameState.gameTime, // Assuming 60s match
        timestamp: Date.now(),
      });

      // Send timer warnings
      if (room.gameState.gameTime <= 30 && room.gameState.gameTime > 29) {
        gameBroadcaster.broadcastTimerWarning(roomId, {
          warning: "low-time",
          timeRemaining: room.gameState.gameTime,
          message: "30 seconds remaining!",
        });
      } else if (room.gameState.gameTime <= 10 && room.gameState.gameTime > 9) {
        gameBroadcaster.broadcastTimerWarning(roomId, {
          warning: "critical-time",
          timeRemaining: room.gameState.gameTime,
          message: "10 seconds remaining!",
        });
      }
    }

    // Check if game should end
    if (room.gameState.gameTime <= 0) {
      console.log(`Time's up! Ending game for room ${roomId}`);

      // Send time-up event first
      gameBroadcaster.broadcastTimeUp(roomId, {
        message: "Time's up!",
        finalTime: 0,
        timestamp: Date.now(),
      });

      // End the game and return the result
      const gameResult = this.endGameByTime(room);
      console.log(`Game ended by time for room ${roomId}:`, gameResult);

      return gameResult;
    }

    // Broadcast basic game state (less frequently to reduce spam)
    gameBroadcaster.broadcastGameState(roomId, {
      room: room,
      gameState: room.gameState,
      timestamp: Date.now(),
    });

    return {
      room: room,
      gameState: room.gameState,
      timestamp: Date.now(),
    };
  }

  // End game when time runs out
  endGameByTime(room) {
    const finalScore = room.gameState.score;
    let winner = null;

    if (finalScore.player1 > finalScore.player2) {
      winner = "player1";
    } else if (finalScore.player2 > finalScore.player1) {
      winner = "player2";
    } else {
      winner = "draw";
    }

    const gameResult = {
      type: "game-ended",
      reason: "time-up",
      finalScore: finalScore,
      winner: winner,
      duration: 60, // Match duration
      timestamp: Date.now(),
    };

    console.log(
      `Game ended for room ${room.id}: ${winner} wins with score ${finalScore.player1}-${finalScore.player2}`
    );

    room.gameState.isActive = false;
    room.status = "finished";
    room.endedAt = new Date();

    return gameResult;
  }

  // Game Loop Management
  startGameLoopCoordinator() {
    console.log("Game State Coordinator started");
    let lastLogTime = 0;

    // Check for active games every 100ms and ensure they have game loops
    setInterval(() => {
      const now = Date.now();

      this.gameRooms.forEach((room, roomId) => {
        // Only log room status every 5 seconds to reduce spam, unless there's a status change
        const shouldLog = now - lastLogTime > 5000;

        // Only start loops for actively playing games
        if (
          room.gameState.isActive &&
          room.status === "playing" &&
          !this.gameLoops.has(roomId)
        ) {
          this.startGameLoop(roomId);
        }

        // Stop loops for inactive games or finished games
        if (
          (!room.gameState.isActive || room.status !== "playing") &&
          this.gameLoops.has(roomId)
        ) {
          console.log(
            `Coordinator stopping game loop for room ${roomId} (status: ${room.status}, active: ${room.gameState.isActive})`
          );
          this.stopGameLoop(roomId);
        }
      });

      if (now - lastLogTime > 5000) {
        lastLogTime = now;
      }
    }, 1000);
  }

  startGameLoop(roomId) {
    if (this.gameLoops.has(roomId)) {
      console.log(`Game loop already running for room ${roomId}`);
      return;
    }

    console.log(`Starting game state loop for room ${roomId}`);

    let lastUpdate = Date.now();
    const targetFPS = 10; // Lower frequency for timer-only updates
    const targetDelta = 1000 / targetFPS; // 100ms

    const gameLoop = setInterval(async () => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastUpdate;
      lastUpdate = currentTime;

      try {
        // Check if room still exists before updating
        const room = this.getRoom(roomId);
        if (!room) {
          console.log(`Room ${roomId} no longer exists, stopping game loop`);
          this.stopGameLoop(roomId);
          return;
        }

        // Check if game is still active
        if (!room.gameState.isActive || room.status !== "playing") {
          console.log(
            `Game no longer active for room ${roomId}, stopping game loop`
          );
          this.stopGameLoop(roomId);
          return;
        }

        const result = await this.updateGameState(roomId, deltaTime);

        // If game ended, stop the loop and handle end game
        if (result && result.type === "game-ended") {
          console.log(`Game ended for room ${roomId}, processing...`);

          // Mark game as inactive BEFORE stopping loop
          room.gameState.isActive = false;
          room.status = "finished";
          this.stopGameLoop(roomId);

          console.log(`Room ${roomId} status set to finished, saving match...`);

          // Save match to database after game status is set to finished
          await this.saveMatchAfterGameEnd(room, result);

          // CRITICAL: Broadcast game end event to trigger rematch UI
          gameBroadcaster.broadcastGameEnd(roomId, result);

          // Start rematch decision timer (3 minutes)
          this.startRematchTimer(roomId);
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
      console.log(`Stopped game loop for room ${roomId}`);
    }
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

  // Rematch Timer Management
  startRematchTimer(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    console.log(`Starting 3-minute rematch timer for room ${roomId}`);

    // Mark timeout as active
    room.rematchState.timeoutActive = true;

    const timer = setTimeout(() => {
      console.log(`Rematch timer expired for room ${roomId}, deleting room`);
      this.handleRematchTimeout(roomId);
    }, 180000); // 3 minutes

    this.rematchTimers.set(roomId, timer);
  }

  stopRematchTimer(roomId) {
    const timer = this.rematchTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.rematchTimers.delete(roomId);

      // Mark timeout as inactive
      const room = this.getRoom(roomId);
      if (room && room.rematchState) {
        room.rematchState.timeoutActive = false;
      }

      console.log(`Stopped rematch timer for room ${roomId}`);
    }
  }

  handleRematchTimeout(roomId) {
    const room = this.getRoom(roomId);
    if (room && room.status === "finished") {
      // Notify players that rematch window expired
      gameBroadcaster.broadcastRematchTimeout(roomId);

      // Delete room after timeout
      setTimeout(() => {
        console.log(`Deleting room ${roomId} after rematch timeout`);
        roomManagerService.deleteRoom(roomId);
      }, 2000); // 2-second delay for final notification
    }
    this.stopRematchTimer(roomId);
  }

  // Rematch Request Management
  requestRematch(socketId) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const result = roomManagerService.requestRematch(
      player,
      player.currentRoom
    );

    if (result.success && result.bothRequested) {
      // Both players requested - execute rematch
      this.executeRematch(player.currentRoom);
    }

    return result;
  }

  declineRematch(socketId) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const result = roomManagerService.declineRematch(
      player,
      player.currentRoom
    );

    if (result.success) {
      // Stop rematch timer and schedule room deletion
      this.stopRematchTimer(player.currentRoom);

      // Delete room after brief delay
      setTimeout(() => {
        console.log(
          `Deleting room ${player.currentRoom} after rematch declined`
        );
        roomManagerService.deleteRoom(player.currentRoom);
      }, 2000);
    }

    return result;
  }

  executeRematch(roomId) {
    const result = roomManagerService.executeRematch(roomId);
    if (result.success) {
      // Stop the rematch timer since players agreed to rematch
      this.stopRematchTimer(roomId);

      // Broadcast rematch confirmation
      gameBroadcaster.broadcastRematchConfirmed(roomId, result.room);
    }
    return result;
  }

  // Socket.IO Integration
  setSocketIO(io) {
    this.io = io;
    gameBroadcaster.setSocketIO(io);
  }
}

module.exports = new GameService();
