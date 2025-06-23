class GameRoom {
  constructor(roomId) {
    this.id = roomId;
    this.players = [];
    this.maxPlayers = 2;
    this.status = "waiting"; // waiting, playing, finished, paused

    // Enhanced 2D Physics Game State
    this.gameState = {
      // Score tracking
      score: { player1: 0, player2: 0 },

      // Time management (2-minute matches)
      gameTime: 120, // seconds remaining (countdown)
      isActive: false,
      isPaused: false,

      // 2D Player positions (800x400 field)
      players: {
        player1: {
          x: 150, // Left side starting position
          y: 320, // Ground level - players stand ON the ground
          velocityX: 0,
          velocityY: 0,
          isJumping: false,
          direction: "idle", // "left", "right", "idle"
          isOnGround: true,
          side: "left", // This player defends left goal
        },
        player2: {
          x: 650, // Right side starting position
          y: 320, // Ground level - players stand ON the ground
          velocityX: 0,
          velocityY: 0,
          isJumping: false,
          direction: "idle",
          isOnGround: true,
          side: "right", // This player defends right goal
        },
      },

      // Ball physics (starts at center)
      ball: {
        x: 400, // Center of 800px field
        y: 200, // Middle height
        velocityX: 0,
        velocityY: 0,
        radius: 15,
        lastTouchedBy: null, // "player1" or "player2"
        lastKickTime: {}, // Cooldown tracking per player
      },

      // Game events
      lastGoal: null, // { player: "player1", time: timestamp }
      gameEvents: [], // Array of game events for replay/analysis
    };

    // Field and physics settings
    this.settings = {
      // Field dimensions (classic 2D side-view)
      field: {
        width: 800,
        height: 400,
        groundLevel: 320, // Y position of ground
        goalWidth: 80,
        goalHeight: 120,
        centerLine: 400, // X position of center line
      },

      // Physics constants
      physics: {
        gravity: 0.8, // Downward acceleration
        friction: 0.85, // Ground friction
        airResistance: 0.98, // Air resistance
        ballBounce: 0.7, // Ball bounce damping
        playerSpeed: 5, // Horizontal movement speed (balanced for gameplay)
        jumpPower: 16, // Initial jump velocity
        maxVelocity: 20, // Maximum velocity cap
      },

      // Game rules
      rules: {
        matchDuration: 120, // 2 minutes in seconds
        allowTies: true, // Matches can end in draws
        maxGoals: null, // No goal limit (time-based only)
        respawnDelay: 2000, // Ball respawn delay after goal (ms)
      },

      // Feature flags
      features: {
        powerupsEnabled: false, // Start simple, add later
        specialAbilities: false,
        audioCues: true,
      },
    };

    this.createdAt = new Date();
    this.startedAt = null;
    this.endedAt = null;
    this.lastUpdate = Date.now(); // For 60fps calculations
  }

  // Add player to room
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

    console.log(
      `Player ${player.username} added to room ${this.id} as ${player.position}`
    );

    return { success: true, player, room: this };
  }

  // Remove player from room
  removePlayer(socketId) {
    const playerIndex = this.players.findIndex((p) => p.id === socketId);
    if (playerIndex === -1) {
      return { success: false, reason: "Player not in room" };
    }

    const player = this.players[playerIndex];
    this.players.splice(playerIndex, 1);
    player.currentRoom = null;
    player.position = null;

    console.log(`Player ${player.username} removed from room ${this.id}`);

    return {
      success: true,
      player,
      isEmpty: this.players.length === 0,
    };
  }

  // Check if room is full
  isFull() {
    return this.players.length >= this.maxPlayers;
  }

  // Check if room can start (has 2 players)
  canStart() {
    const hasEnoughPlayers = this.players.length === 2;
    const allReady = this.players.every((p) => p.isReady);
    const isWaiting = this.status === "waiting";
    const result = hasEnoughPlayers && allReady && isWaiting;

    console.log(`🔍 canStart() check for room ${this.id}:`, {
      hasEnoughPlayers,
      allReady,
      isWaiting,
      currentStatus: this.status,
      canStart: result,
      playerCount: this.players.length,
      players: this.players.map((p) => ({
        username: p.username,
        isReady: p.isReady,
      })),
    });

    return result;
  }

  // Pure data transformation only - no business logic
  toJSON() {
    return {
      id: this.id,
      players: this.players.map((p) => p.toJSON()),
      maxPlayers: this.maxPlayers,
      status: this.status,

      // Enhanced game state for 2D physics
      gameState: {
        score: this.gameState.score,
        gameTime: this.gameState.gameTime,
        isActive: this.gameState.isActive,
        isPaused: this.gameState.isPaused,
        players: this.gameState.players,
        ball: this.gameState.ball,
        lastGoal: this.gameState.lastGoal,
        gameEvents: this.gameState.gameEvents,
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
