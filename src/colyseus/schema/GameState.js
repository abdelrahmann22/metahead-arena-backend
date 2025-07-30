const { Schema, type, MapSchema } = require('@colyseus/schema');

/**
 * Player position and state schema
 */
class PlayerState extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.velocityX = 0;
    this.velocityY = 0;
    this.score = 0;
    this.isReady = false;
    this.walletAddress = '';
    this.username = '';
    this.position = ''; // 'player1' or 'player2'
    this.powerups = [];
    this.lastUpdate = 0;
  }
}

// Define schema decorators
type('number')(PlayerState.prototype, 'x');
type('number')(PlayerState.prototype, 'y');
type('number')(PlayerState.prototype, 'velocityX');
type('number')(PlayerState.prototype, 'velocityY');
type('number')(PlayerState.prototype, 'score');
type('boolean')(PlayerState.prototype, 'isReady');
type('string')(PlayerState.prototype, 'walletAddress');
type('string')(PlayerState.prototype, 'username');
type('string')(PlayerState.prototype, 'position');
type(['string'])(PlayerState.prototype, 'powerups');
type('number')(PlayerState.prototype, 'lastUpdate');

/**
 * Ball state schema
 */
class BallState extends Schema {
  constructor() {
    super();
    this.x = 400; // Center of field
    this.y = 300;
    this.velocityX = 0;
    this.velocityY = 0;
    this.lastUpdate = 0;
    this.authorityPlayer = 'player1'; // Player 1 has ball authority
  }
}

type('number')(BallState.prototype, 'x');
type('number')(BallState.prototype, 'y');
type('number')(BallState.prototype, 'velocityX');
type('number')(BallState.prototype, 'velocityY');
type('number')(BallState.prototype, 'lastUpdate');
type('string')(BallState.prototype, 'authorityPlayer');

/**
 * Powerup state schema
 */
class PowerupState extends Schema {
  constructor() {
    super();
    this.id = '';
    this.type = '';
    this.x = 0;
    this.y = 0;
    this.active = false;
    this.spawnTime = 0;
    this.duration = 5000; // 5 seconds default
  }
}

type('string')(PowerupState.prototype, 'id');
type('string')(PowerupState.prototype, 'type');
type('number')(PowerupState.prototype, 'x');
type('number')(PowerupState.prototype, 'y');
type('boolean')(PowerupState.prototype, 'active');
type('number')(PowerupState.prototype, 'spawnTime');
type('number')(PowerupState.prototype, 'duration');

/**
 * Game event schema for tracking goals, etc.
 */
class GameEvent extends Schema {
  constructor() {
    super();
    this.type = '';
    this.player = '';
    this.timestamp = 0;
    this.data = {};
  }
}

type('string')(GameEvent.prototype, 'type');
type('string')(GameEvent.prototype, 'player');
type('number')(GameEvent.prototype, 'timestamp');
type('string')(GameEvent.prototype, 'data'); // JSON string

/**
 * Main game state schema
 * Mirrors the existing game state structure
 */
class GameState extends Schema {
  constructor() {
    super();
    
    // Players
    this.players = new MapSchema();
    
    // Game timing (matches existing 60-second format)
    this.gameTime = 60;
    this.isActive = false;
    this.isPaused = false;
    this.startedAt = 0;
    this.endedAt = 0;
    
    // Score tracking
    this.player1Score = 0;
    this.player2Score = 0;
    
    // Ball state
    this.ball = new BallState();
    
    // Powerups
    this.powerups = new MapSchema();
    
    // Game events
    this.events = [];
    this.lastGoal = null;
    
    // Room metadata
    this.status = 'waiting'; // waiting, playing, finished, paused
    this.roomCode = '';
    this.matchId = '';
    
    // Settings (match existing configuration)
    this.settings = {
      matchDuration: 60,
      allowTies: true,
      powerupsEnabled: false,
      maxGoals: null
    };
    
    // Rematch system
    this.rematchState = {
      player1Requested: false,
      player2Requested: false,
      timeoutActive: false
    };
    
    // Server authority tracking
    this.serverTick = 0;
    this.lastUpdate = 0;
  }
  
  /**
   * Add player to game state
   */
  addPlayer(clientId, authData, position) {
    const player = new PlayerState();
    player.walletAddress = authData.walletAddress;
    player.username = authData.username;
    player.position = position;
    player.lastUpdate = Date.now();
    
    this.players.set(clientId, player);
    
    console.log(`[GAME_STATE] Added player ${position} (${authData.walletAddress}) with clientId ${clientId}`);
    return player;
  }
  
  /**
   * Remove player from game state
   */
  removePlayer(clientId) {
    const player = this.players.get(clientId);
    if (player) {
      console.log(`[GAME_STATE] Removing player ${player.position} (${player.walletAddress})`);
      this.players.delete(clientId);
    }
  }
  
  /**
   * Start the game
   */
  startGame() {
    this.isActive = true;
    this.status = 'playing';
    this.startedAt = Date.now();
    this.gameTime = this.settings.matchDuration;
    
    // Reset ball to center
    this.ball.x = 400;
    this.ball.y = 300;
    this.ball.velocityX = 0;
    this.ball.velocityY = 0;
    
    console.log(`[GAME_STATE] Game started at ${new Date(this.startedAt).toISOString()}`);
  }
  
  /**
   * End the game
   */
  endGame() {
    this.isActive = false;
    this.status = 'finished';
    this.endedAt = Date.now();
    this.gameTime = 0;
    
    console.log(`[GAME_STATE] Game ended. Final score: P1=${this.player1Score}, P2=${this.player2Score}`);
  }
  
  /**
   * Update game timer
   */
  updateTimer(deltaTime) {
    if (this.isActive && !this.isPaused) {
      this.gameTime -= deltaTime / 1000;
      
      if (this.gameTime <= 0) {
        this.gameTime = 0;
        this.endGame();
      }
    }
  }
  
  /**
   * Handle goal scored
   */
  handleGoal(scoringPlayer) {
    if (scoringPlayer === 'player1') {
      this.player1Score++;
    } else if (scoringPlayer === 'player2') {
      this.player2Score++;
    }
    
    // Add goal event
    const goalEvent = {
      type: 'goal',
      player: scoringPlayer,
      timestamp: Date.now(),
      score: { player1: this.player1Score, player2: this.player2Score }
    };
    
    this.lastGoal = JSON.stringify(goalEvent);
    this.events.push(JSON.stringify(goalEvent));
    
    console.log(`[GAME_STATE] Goal scored by ${scoringPlayer}! Score: ${this.player1Score}-${this.player2Score}`);
  }
}

// Define schema decorators for GameState
type({ map: PlayerState })(GameState.prototype, 'players');
type('number')(GameState.prototype, 'gameTime');
type('boolean')(GameState.prototype, 'isActive');
type('boolean')(GameState.prototype, 'isPaused');
type('number')(GameState.prototype, 'startedAt');
type('number')(GameState.prototype, 'endedAt');
type('number')(GameState.prototype, 'player1Score');
type('number')(GameState.prototype, 'player2Score');
type(BallState)(GameState.prototype, 'ball');
type({ map: PowerupState })(GameState.prototype, 'powerups');
type(['string'])(GameState.prototype, 'events');
type('string')(GameState.prototype, 'lastGoal');
type('string')(GameState.prototype, 'status');
type('string')(GameState.prototype, 'roomCode');
type('string')(GameState.prototype, 'matchId');
type('string')(GameState.prototype, 'settings'); // JSON string
type('string')(GameState.prototype, 'rematchState'); // JSON string
type('number')(GameState.prototype, 'serverTick');
type('number')(GameState.prototype, 'lastUpdate');

module.exports = {
  GameState,
  PlayerState,
  BallState,
  PowerupState,
  GameEvent
};