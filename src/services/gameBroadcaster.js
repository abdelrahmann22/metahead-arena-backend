/**
 * @fileoverview Game Broadcaster Service
 * @description Handles Socket.IO broadcasting for real-time game events and state updates
 * @module services/gameBroadcaster
 */

/**
 * Game Broadcaster Service - Handles Socket.IO broadcasting for game events
 * @class GameBroadcaster
 */
class GameBroadcaster {
  constructor() {
    this.io = null;
    this.lastGameStates = new Map(); // roomId -> lastGameState (for change detection)
  }

  /**
   * Broadcast basic game state updates to room
   */
  broadcastGameState(roomId, gameState) {
    if (!this.io) return;

    const current = gameState.gameState;
    const last = this.lastGameStates.get(roomId);

    // Only broadcast if there are meaningful changes
    if (!last || this.hasSignificantChanges(current, last)) {
      this.io.to(roomId).emit("game-state", {
        room: gameState.room.toJSON(),
        gameState: current,
        timestamp: gameState.timestamp,
      });

      this.lastGameStates.set(roomId, { ...current });
    }
  }

  /**
   * Broadcast goal event
   */
  broadcastGoalEvent(roomId, goalData) {
    if (!this.io) return;

    this.io.to(roomId).emit("goal-scored", {
      type: "goal",
      scorer: goalData.scorer,
      newScore: goalData.newScore,
      goalEvent: goalData.goalEvent,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast game end
   */
  broadcastGameEnd(roomId, gameResult) {
    if (!this.io) return;

    this.io.to(roomId).emit("game-ended", {
      type: "game-ended",
      reason: gameResult.reason,
      finalScore: gameResult.finalScore,
      winner: gameResult.winner,
      duration: gameResult.duration,
      timestamp: gameResult.timestamp,
    });

    // Clean up last game state
    this.lastGameStates.delete(roomId);
  }

  /**
   * Broadcast game started
   */
  broadcastGameStarted(roomId, gameData) {
    if (!this.io) return;

    const gameStartEvent = {
      type: "game-started",
      message: gameData.message,
      room: gameData.room,
      matchDuration: gameData.matchDuration,
      gameState: {
        score: { player1: 0, player2: 0 },
        gameTime: gameData.matchDuration,
        isActive: true,
        isPaused: false,
      },
      timestamp: Date.now(),
    };

    this.io.to(roomId).emit("game-started", gameStartEvent);
  }

  /**
   * Broadcast player ready status change
   */
  broadcastPlayerReady(roomId, readyData) {
    if (!this.io) return;

    this.io.to(roomId).emit("player-ready", {
      type: "player-ready",
      playerId: readyData.playerId,
      username: readyData.username,
      isReady: readyData.isReady,
      allPlayersReady: readyData.allPlayersReady,
      room: readyData.room,
      timestamp: readyData.timestamp || Date.now(),
    });
  }

  /**
   * Broadcast player left room
   */
  broadcastPlayerLeft(roomId, playerData) {
    if (!this.io) return;

    this.io.to(roomId).emit("player-left-room", {
      type: "player-left",
      playerId: playerData.playerId,
      username: playerData.username,
      remainingPlayers: playerData.remainingPlayers,
      message: playerData.message,
      reason: playerData.reason || "left",
      timestamp: Date.now(),
    });
  }

  /**
   * Check if game state has significant changes worth broadcasting
   */
  hasSignificantChanges(current, last) {
    if (!last) return true;

    return (
      Math.abs(current.gameTime - last.gameTime) > 0.5 || // Time changed by more than 0.5 seconds
      current.score?.player1 !== last.score?.player1 ||
      current.score?.player2 !== last.score?.player2 ||
      current.isActive !== last.isActive ||
      current.isPaused !== last.isPaused
    );
  }

  /**
   * Broadcast error to specific socket
   */
  broadcastError(socketId, error) {
    if (!this.io) return;

    this.io.to(socketId).emit("error", {
      type: error.type || "GAME_ERROR",
      message: error.message,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast error to entire room
   */
  broadcastRoomError(roomId, error) {
    if (!this.io) return;

    this.io.to(roomId).emit("error", {
      type: error.type || "ROOM_ERROR",
      message: error.message,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast room created event
   */
  broadcastRoomCreated(socketId, roomData) {
    if (!this.io) return;

    this.io.to(socketId).emit("room-created", {
      type: "room-created",
      ...roomData,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast room joined event
   */
  broadcastRoomJoined(socketId, roomData) {
    if (!this.io) return;

    this.io.to(socketId).emit("room-joined", {
      type: "room-joined",
      ...roomData,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast rematch request
   */
  broadcastRematchRequest(roomId, player, rematchState) {
    if (!this.io) return;

    this.io.to(roomId).emit("rematch-requested", {
      type: "rematch-requested",
      requestedBy: player.username,
      rematchState: rematchState,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast rematch confirmed
   */
  broadcastRematchConfirmed(roomId, room) {
    if (!this.io) return;

    this.io.to(roomId).emit("rematch-confirmed", {
      type: "rematch-confirmed",
      message: "Rematch confirmed! Get ready for another round!",
      room: room,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast rematch declined
   */
  broadcastRematchDeclined(roomId, player) {
    if (!this.io) return;

    this.io.to(roomId).emit("rematch-declined", {
      type: "rematch-declined",
      declinedBy: player.username,
      message: "Rematch was declined. Room will be deleted soon.",
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast rematch timeout
   */
  broadcastRematchTimeout(roomId) {
    if (!this.io) return;

    this.io.to(roomId).emit("rematch-timeout", {
      type: "rematch-timeout",
      message: "Rematch window expired. Room will be deleted.",
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast game statistics
   */
  broadcastGameStats(gameStats) {
    if (!this.io) return;

    const totalGames = gameStats.finalScore
      ? gameStats.finalScore.player1 + gameStats.finalScore.player2
      : 0;

    this.io.emit("game-stats", {
      type: "game-stats",
      players: gameStats.totalPlayers,
      rooms: gameStats.totalRooms,
      activeGames: gameStats.activeRooms,
      totalGames: totalGames,
      serverUptime: gameStats.serverUptime,
      timestamp: gameStats.timestamp,
    });
  }

  /**
   * Set Socket.IO instance
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Clean up broadcaster resources
   */
  cleanup() {
    this.lastGameStates.clear();
  }
}

module.exports = new GameBroadcaster();
