/**
 * GameRoom Model - In-Memory Game Session Handler
 *
 * Purpose: Manages temporary game room sessions and state
 * Scope: In-memory only, not persisted to database
 * Lifespan: While game room is active
 *
 * Features: Player management, game state tracking, rematch system
 *
 * Note: For persistent match data, use Match model
 */
class GameRoom {
  constructor(roomId, code = null) {
    this.id = roomId;
    this.code = code || null; // Room join code
    this.players = [];
    this.maxPlayers = 2;
    this.status = "waiting"; // waiting, playing, finished, paused

    // Game State Management
    this.gameState = {
      // Score tracking
      score: { player1: 0, player2: 0 },

      // Time management (60-second matches)
      gameTime: 60, // seconds remaining (countdown)
      isActive: false,
      isPaused: false,

      // Game events
      lastGoal: null, // { player: "player1", time: timestamp }
      gameEvents: [], // Array of game events for replay/analysis
    };

    // Game Configuration
    this.settings = {
      // Game rules
      rules: {
        matchDuration: 60, // 60 seconds
        allowTies: true, // Matches can end in draws
        maxGoals: null, // No goal limit (time-based only)
      },

      // Feature flags
      features: {
        powerupsEnabled: false,
        specialAbilities: false,
        audioCues: true,
      },
    };

    this.createdAt = new Date();
    this.startedAt = null;
    this.endedAt = null;
    this.lastUpdate = Date.now();

    // Rematch system
    this.rematchState = {
      player1Requested: false,
      player2Requested: false,
      timeoutActive: false,
    };
  }

  /**
   * Add player to room
   * @param {Player} player - Player object to add
   * @returns {Object} Success result with player and room data
   */
  addPlayer(player) {
    if (this.players.length >= this.maxPlayers) {
      return { success: false, reason: "Room is full" };
    }

    // Check if player already in room
    if (this.players.find((p) => p.id === player.id)) {
      return { success: false, reason: "Player already in room" };
    }

    this.players.push(player);
    player.currentRoom = this.id;

    // Assign player position (player1 = left, player2 = right)
    if (this.players.length === 1) {
      player.position = "player1";
    } else if (this.players.length === 2) {
      player.position = "player2";
    }

    return { success: true, player, room: this };
  }

  /**
   * Remove player from room
   * @param {string} socketId - Socket ID of player to remove
   * @returns {Object} Success result with player data and empty status
   */
  removePlayer(socketId) {
    const playerIndex = this.players.findIndex((p) => p.id === socketId);
    if (playerIndex === -1) {
      return { success: false, reason: "Player not in room" };
    }

    const player = this.players[playerIndex];
    this.players.splice(playerIndex, 1);
    player.currentRoom = null;
    player.position = null;

    return {
      success: true,
      player,
      isEmpty: this.players.length === 0,
    };
  }

  /**
   * Check if room is full
   * @returns {boolean} True if room has maximum players
   */
  isFull() {
    return this.players.length >= this.maxPlayers;
  }

  /**
   * Check if room can start a game
   * @returns {boolean} True if game can start (2 players, all ready, waiting status)
   */
  canStart() {
    const hasEnoughPlayers = this.players.length === 2;
    const allReady = this.players.every((p) => p.isReady);
    const isWaiting = this.status === "waiting";

    return hasEnoughPlayers && allReady && isWaiting;
  }

  /**
   * Reset room state for rematch
   */
  resetForRematch() {
    // Reset game state for rematch
    this.status = "waiting";
    this.gameState.score = { player1: 0, player2: 0 };
    this.gameState.gameTime = 60;
    this.gameState.isActive = false;
    this.gameState.isPaused = false;
    this.gameState.lastGoal = null;
    this.gameState.gameEvents = [];

    // Reset rematch state
    this.rematchState.player1Requested = false;
    this.rematchState.player2Requested = false;
    this.rematchState.timeoutActive = false;

    // Reset player ready states
    this.players.forEach((player) => {
      player.isReady = false;
    });

    this.startedAt = null;
    this.endedAt = null;
    this.lastUpdate = Date.now();
  }

  /**
   * Convert room to JSON for API responses
   * @returns {Object} Serialized room data
   */
  toJSON() {
    // Ensure gameState is never null - reinitialize if needed
    if (!this.gameState) {
      console.warn(`GameRoom ${this.id}: gameState was null, reinitializing`);
      this.gameState = {
        score: { player1: 0, player2: 0 },
        gameTime: 60,
        isActive: false,
        isPaused: false,
        lastGoal: null,
        gameEvents: [],
      };
    }

    return {
      id: this.id,
      code: this.code, // Include room code for sharing
      players: this.players.map((p) => p.toJSON()),
      maxPlayers: this.maxPlayers,
      status: this.status,

      // Game state data with null safety
      gameState: {
        score: this.gameState?.score || { player1: 0, player2: 0 },
        gameTime: this.gameState?.gameTime || 60,
        isActive: this.gameState?.isActive || false,
        isPaused: this.gameState?.isPaused || false,
        lastGoal: this.gameState?.lastGoal || null,
        gameEvents: this.gameState?.gameEvents || [],
      },

      // Rematch state for UI display
      rematchState: {
        player1Requested: this.rematchState?.player1Requested || false,
        player2Requested: this.rematchState?.player2Requested || false,
        timeoutActive: this.rematchState?.timeoutActive || false,
      },

      settings: this.settings,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString() || null,
      endedAt: this.endedAt?.toISOString() || null,
      lastUpdate: this.lastUpdate,
    };
  }
}

module.exports = GameRoom;
