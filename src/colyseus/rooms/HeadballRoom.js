const { Room } = require('colyseus');
const { GameState } = require('../schema/GameState');
const { requireAuth, getAuthenticatedUser, validateWalletOwnership } = require('../middleware/authMiddleware');
const matchService = require('../../services/matchService');

/**
 * HeadballRoom - Main Colyseus room for 1v1 headball matches
 * Maintains server authority and anti-cheat mechanisms
 */
class HeadballRoom extends Room {
  constructor() {
    super();
    
    // Room configuration
    this.maxClients = 2;
    this.autoDispose = true;
    
    // Game loop configuration  
    this.gameLoopInterval = null;
    this.updateRate = 60; // 60 FPS server tick rate
    this.deltaTime = 1000 / this.updateRate;
    
    // Anti-cheat configuration
    this.antiCheat = {
      maxPositionDelta: 50, // Max pixels per update
      maxVelocity: 800, // Max velocity in pixels/second
      positionValidationEnabled: true,
      ballAuthorityEnabled: true
    };
    
    // Match persistence
    this.matchRecord = null;
    this.matchId = null;
  }

  /**
   * Room creation and initialization
   */
  async onCreate(options = {}) {
    console.log(`[HEADBALL_ROOM] Creating room with options:`, options);
    
    // Initialize game state
    this.setState(new GameState());
    
    // Configure room based on options
    this.setupRoomConfiguration(options);
    
    // Setup message handlers
    this.setupMessageHandlers();
    
    // Initialize anti-cheat if enabled
    if (options.metadata?.antiCheat) {
      this.antiCheat.positionValidationEnabled = true;
      console.log(`[HEADBALL_ROOM] Anti-cheat enabled for room ${this.roomId}`);
    }
    
    console.log(`[HEADBALL_ROOM] ✅ Room ${this.roomId} created successfully`);
  }

  /**
   * Setup room configuration from options
   */
  setupRoomConfiguration(options) {
    // Generate room code for private rooms
    if (options.private) {
      this.state.roomCode = this.generateRoomCode();
      this.setPrivate(true);
    }
    
    // Configure game settings
    if (options.settings) {
      this.state.settings = JSON.stringify({
        ...this.state.settings,
        ...options.settings
      });
    }
    
    // Set metadata
    this.setMetadata({
      gameMode: options.gameMode || '1v1',
      competitive: options.competitive !== false,
      antiCheat: options.antiCheat !== false,
      roomCode: this.state.roomCode
    });
  }

  /**
   * Setup message handlers for client communication
   */
  setupMessageHandlers() {
    // Player ready state
    this.onMessage('player_ready', (client, message) => {
      this.handlePlayerReady(client, message);
    });
    
    // Real-time position updates
    this.onMessage('player_position', (client, message) => {
      this.handlePlayerPosition(client, message);
    });
    
    // Ball state updates (only from ball authority)
    this.onMessage('ball_state', (client, message) => {
      this.handleBallState(client, message);
    });
    
    // Goal events
    this.onMessage('goal_scored', (client, message) => {
      this.handleGoalScored(client, message);
    });
    
    // Powerup events
    this.onMessage('powerup_spawned', (client, message) => {
      this.handlePowerupSpawned(client, message);
    });
    
    this.onMessage('powerup_collected', (client, message) => {
      this.handlePowerupCollected(client, message);
    });
    
    // Rematch system
    this.onMessage('request_rematch', (client, message) => {
      this.handleRematchRequest(client, message);
    });
    
    // Admin messages
    this.onMessage('admin_action', (client, message) => {
      this.handleAdminAction(client, message);
    });
  }

  /**
   * Player joins the room
   */
  async onJoin(client, options) {
    try {
      console.log(`[HEADBALL_ROOM] Client ${client.id} joining room ${this.roomId}`);
      
      // Validate authentication
      requireAuth(client, 'onJoin');
      const authData = getAuthenticatedUser(client);
      
      // Determine player position
      const playerPosition = this.assignPlayerPosition();
      
      if (!playerPosition) {
        throw new Error('Room is full');
      }
      
      // Add player to game state
      const player = this.state.addPlayer(client.id, authData, playerPosition);
      
      // Store client metadata
      client.userData = {
        ...authData,
        position: playerPosition,
        joinedAt: Date.now()
      };
      
      console.log(`[HEADBALL_ROOM] ✅ Player ${authData.username} joined as ${playerPosition}`);
      
      // Notify other players
      this.broadcast('player_joined', {
        clientId: client.id,
        player: {
          username: authData.username,
          walletAddress: authData.walletAddress,
          position: playerPosition
        },
        roomStatus: this.state.status,
        playersCount: this.state.players.size
      }, { except: client });
      
      // Send room state to new player
      client.send('room_state', {
        roomId: this.roomId,
        roomCode: this.state.roomCode,
        status: this.state.status,
        players: Array.from(this.state.players.values()).map(p => ({
          username: p.username,
          position: p.position,
          isReady: p.isReady
        }))
      });
      
      // Check if room is full and ready to start
      if (this.state.players.size === this.maxClients) {
        this.handleRoomFull();
      }
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] ❌ Error joining room:`, error.message);
      client.error(error.message);
      await client.leave();
    }
  }

  /**
   * Player leaves the room
   */
  async onLeave(client, consented) {
    try {
      console.log(`[HEADBALL_ROOM] Client ${client.id} leaving room ${this.roomId} (consented: ${consented})`);
      
      const player = this.state.players.get(client.id);
      
      if (player) {
        // Handle mid-game disconnection
        if (this.state.isActive) {
          this.handleMidGameDisconnection(client, player);
        }
        
        // Remove player from state
        this.state.removePlayer(client.id);
        
        // Notify remaining players
        this.broadcast('player_left', {
          clientId: client.id,
          player: {
            username: player.username,
            position: player.position
          },
          roomStatus: this.state.status,
          playersCount: this.state.players.size
        });
        
        // End game if no players left or not enough for match
        if (this.state.players.size === 0) {
          this.handleRoomEmpty();
        } else if (this.state.players.size < 2 && this.state.isActive) {
          this.handleInsufficientPlayers();
        }
      }
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error handling player leave:`, error);
    }
  }

  /**
   * Assign player position (player1 or player2)
   */
  assignPlayerPosition() {
    const existingPositions = new Set();
    
    for (const player of this.state.players.values()) {
      existingPositions.add(player.position);
    }
    
    if (!existingPositions.has('player1')) {
      return 'player1';
    } else if (!existingPositions.has('player2')) {
      return 'player2';
    }
    
    return null; // Room is full
  }

  /**
   * Handle player ready state
   */
  handlePlayerReady(client, message) {
    try {
      requireAuth(client, 'player_ready');
      
      const player = this.state.players.get(client.id);
      if (!player) {
        throw new Error('Player not found in room');
      }
      
      player.isReady = message.ready === true;
      player.lastUpdate = Date.now();
      
      console.log(`[HEADBALL_ROOM] Player ${player.position} ready state: ${player.isReady}`);
      
      // Broadcast ready state
      this.broadcast('player_ready_state', {
        clientId: client.id,
        position: player.position,
        isReady: player.isReady
      });
      
      // Check if all players are ready
      this.checkAllPlayersReady();
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error handling player ready:`, error.message);
      client.send('error', { message: error.message });
    }
  }

  /**
   * Handle real-time player position updates with anti-cheat validation
   */
  handlePlayerPosition(client, message) {
    try {
      if (!this.state.isActive) return;
      
      requireAuth(client, 'player_position');
      
      const player = this.state.players.get(client.id);
      if (!player) return;
      
      // CRITICAL: Validate position ownership (anti-cheat)
      if (this.antiCheat.positionValidationEnabled) {
        if (message.position !== player.position) {
          console.warn(`[ANTI_CHEAT] ❌ Position spoofing attempt:`, {
            clientId: client.id,
            actualPosition: player.position,
            claimedPosition: message.position
          });
          return;
        }
        
        // Validate position delta (movement speed)
        if (this.validatePositionDelta(player, message.player)) {
          console.warn(`[ANTI_CHEAT] ❌ Suspicious movement detected for ${player.position}`);
          return;
        }
      }
      
      // Update player position
      player.x = message.player.x;
      player.y = message.player.y;
      player.velocityX = message.player.velocityX;
      player.velocityY = message.player.velocityY;
      player.lastUpdate = Date.now();
      
      // Broadcast to other players (no need to echo back)
      this.broadcast('player_position', {
        position: player.position,
        player: {
          x: player.x,
          y: player.y,
          velocityX: player.velocityX,
          velocityY: player.velocityY
        },
        timestamp: player.lastUpdate
      }, { except: client });
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error handling player position:`, error.message);
    }
  }

  /**
   * Handle ball state updates (only from ball authority)
   */
  handleBallState(client, message) {
    try {
      if (!this.state.isActive) return;
      
      requireAuth(client, 'ball_state');
      
      const player = this.state.players.get(client.id);
      if (!player) return;
      
      // CRITICAL: Only ball authority can update ball state
      if (this.antiCheat.ballAuthorityEnabled && player.position !== this.state.ball.authorityPlayer) {
        console.warn(`[ANTI_CHEAT] ❌ Unauthorized ball update attempt:`, {
          clientId: client.id,
          playerPosition: player.position,
          ballAuthority: this.state.ball.authorityPlayer
        });
        return;
      }
      
      // Update ball state
      this.state.ball.x = message.ball.x;
      this.state.ball.y = message.ball.y;
      this.state.ball.velocityX = message.ball.velocityX;
      this.state.ball.velocityY = message.ball.velocityY;
      this.state.ball.lastUpdate = Date.now();
      
      // Broadcast ball state to non-authority players
      this.broadcast('ball_state', {
        ball: {
          x: this.state.ball.x,
          y: this.state.ball.y,
          velocityX: this.state.ball.velocityX,
          velocityY: this.state.ball.velocityY
        },
        timestamp: this.state.ball.lastUpdate
      }, { except: client });
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error handling ball state:`, error.message);
    }
  }

  /**
   * Handle goal scored
   */
  handleGoalScored(client, message) {
    try {
      if (!this.state.isActive) return;
      
      requireAuth(client, 'goal_scored');
      
      const player = this.state.players.get(client.id);
      if (!player) return;
      
      // Only ball authority can report goals
      if (player.position !== this.state.ball.authorityPlayer) {
        console.warn(`[ANTI_CHEAT] ❌ Unauthorized goal report from ${player.position}`);
        return;
      }
      
      const scoringPlayer = message.scoringPlayer;
      
      if (scoringPlayer !== 'player1' && scoringPlayer !== 'player2') {
        console.warn(`[HEADBALL_ROOM] Invalid scoring player: ${scoringPlayer}`);
        return;
      }
      
      // Handle goal
      this.state.handleGoal(scoringPlayer);
      
      console.log(`[HEADBALL_ROOM] ⚽ Goal scored by ${scoringPlayer}! Score: ${this.state.player1Score}-${this.state.player2Score}`);
      
      // Broadcast goal event
      this.broadcast('goal_scored', {
        scoringPlayer: scoringPlayer,
        score: {
          player1: this.state.player1Score,
          player2: this.state.player2Score
        },
        timestamp: Date.now()
      });
      
      // Reset ball position after goal
      this.resetBallPosition();
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error handling goal:`, error.message);
    }
  }

  /**
   * Handle rematch request
   */
  handleRematchRequest(client, message) {
    try {
      requireAuth(client, 'request_rematch');
      
      const player = this.state.players.get(client.id);
      if (!player) return;
      
      if (this.state.status !== 'finished') {
        client.send('error', { message: 'Game must be finished to request rematch' });
        return;
      }
      
      // Update rematch state
      const rematchState = JSON.parse(this.state.rematchState || '{}');
      
      if (player.position === 'player1') {
        rematchState.player1Requested = true;
      } else if (player.position === 'player2') {
        rematchState.player2Requested = true;
      }
      
      this.state.rematchState = JSON.stringify(rematchState);
      
      console.log(`[HEADBALL_ROOM] Rematch requested by ${player.position}`);
      
      // Broadcast rematch request
      this.broadcast('rematch_requested', {
        requestedBy: player.position,
        rematchState: rematchState
      });
      
      // Check if both players requested rematch
      if (rematchState.player1Requested && rematchState.player2Requested) {
        this.startRematch();
      }
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error handling rematch request:`, error.message);
    }
  }

  /**
   * Check if all players are ready and start game
   */
  checkAllPlayersReady() {
    if (this.state.players.size < 2) return;
    
    let allReady = true;
    for (const player of this.state.players.values()) {
      if (!player.isReady) {
        allReady = false;
        break;
      }
    }
    
    if (allReady && this.state.status === 'waiting') {
      this.startGame();
    }
  }

  /**
   * Start the game
   */
  async startGame() {
    try {
      console.log(`[HEADBALL_ROOM] 🎮 Starting game in room ${this.roomId}`);
      
      // Create match record
      await this.createMatchRecord();
      
      // Initialize game state
      this.state.startGame();
      this.state.matchId = this.matchId;
      
      // Start game loop
      this.startGameLoop();
      
      // Broadcast game start
      this.broadcast('game_started', {
        matchId: this.matchId,
        startTime: this.state.startedAt,
        duration: this.state.gameTime
      });
      
      console.log(`[HEADBALL_ROOM] ✅ Game started successfully - Match ID: ${this.matchId}`);
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error starting game:`, error);
      this.broadcast('error', { message: 'Failed to start game' });
    }
  }

  /**
   * Start game loop for server-side updates
   */
  startGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }
    
    this.gameLoopInterval = setInterval(() => {
      this.updateGameState();
    }, this.deltaTime);
    
    console.log(`[HEADBALL_ROOM] Game loop started - ${this.updateRate}fps`);
  }

  /**
   * Update game state on server tick
   */
  updateGameState() {
    if (!this.state.isActive) {
      this.stopGameLoop();
      return;
    }
    
    // Update timer
    this.state.updateTimer(this.deltaTime);
    this.state.serverTick++;
    this.state.lastUpdate = Date.now();
    
    // Check for game end conditions
    if (this.state.gameTime <= 0) {
      this.endGame();
    }
    
    // Send periodic updates (every second for timer)
    if (this.state.serverTick % this.updateRate === 0) {
      this.broadcast('timer_update', {
        gameTime: this.state.gameTime,
        serverTick: this.state.serverTick
      });
    }
  }

  /**
   * End the game
   */
  async endGame() {
    try {
      console.log(`[HEADBALL_ROOM] 🏁 Game ended in room ${this.roomId}`);
      
      this.state.endGame();
      this.stopGameLoop();
      
      // Determine winner
      const result = this.determineWinner();
      
      // Save match result
      await this.saveMatchResult(result);
      
      // Broadcast game end
      this.broadcast('game_ended', {
        result: result,
        finalScore: {
          player1: this.state.player1Score,
          player2: this.state.player2Score
        },
        duration: (this.state.endedAt - this.state.startedAt) / 1000,
        matchId: this.matchId
      });
      
      console.log(`[HEADBALL_ROOM] ✅ Game ended - Result: ${result.winner || 'tie'}`);
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error ending game:`, error);
    }
  }

  /**
   * Determine game winner
   */
  determineWinner() {
    if (this.state.player1Score > this.state.player2Score) {
      return {
        winner: 'player1',
        score: { player1: this.state.player1Score, player2: this.state.player2Score }
      };
    } else if (this.state.player2Score > this.state.player1Score) {
      return {
        winner: 'player2', 
        score: { player1: this.state.player1Score, player2: this.state.player2Score }
      };
    } else {
      return {
        winner: null, // tie
        score: { player1: this.state.player1Score, player2: this.state.player2Score }
      };
    }
  }

  /**
   * Create match record in database
   */
  async createMatchRecord() {
    try {
      const players = Array.from(this.state.players.values());
      
      if (players.length < 2) {
        throw new Error('Not enough players for match record');
      }
      
      const player1 = players.find(p => p.position === 'player1');
      const player2 = players.find(p => p.position === 'player2');
      
      const matchResult = await matchService.createMatch(
        {
          userId: this.clients.find(c => c.userData?.position === 'player1')?.auth?.userId,
          walletAddress: player1.walletAddress
        },
        {
          userId: this.clients.find(c => c.userData?.position === 'player2')?.auth?.userId,
          walletAddress: player2.walletAddress
        }
      );
      
      if (matchResult.success) {
        this.matchRecord = matchResult.match;
        this.matchId = matchResult.match.matchId;
        console.log(`[HEADBALL_ROOM] ✅ Match record created: ${this.matchId}`);
      }
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error creating match record:`, error);
    }
  }

  /**
   * Save match result to database
   */
  async saveMatchResult(gameResult) {
    try {
      if (!this.matchRecord) {
        console.warn(`[HEADBALL_ROOM] No match record to update`);
        return;
      }
      
      await matchService.endMatch(this.matchId, {
        player1Goals: this.state.player1Score,
        player2Goals: this.state.player2Score,
        winner: gameResult.winner,
        duration: (this.state.endedAt - this.state.startedAt) / 1000
      });
      
      console.log(`[HEADBALL_ROOM] ✅ Match result saved for ${this.matchId}`);
      
    } catch (error) {
      console.error(`[HEADBALL_ROOM] Error saving match result:`, error);
    }
  }

  /**
   * Generate room code for private rooms
   */
  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate position delta for anti-cheat
   */
  validatePositionDelta(player, newPosition) {
    if (!this.antiCheat.positionValidationEnabled) return false;
    
    const deltaX = Math.abs(newPosition.x - player.x);
    const deltaY = Math.abs(newPosition.y - player.y);
    const maxDelta = this.antiCheat.maxPositionDelta;
    
    return deltaX > maxDelta || deltaY > maxDelta;
  }

  /**
   * Reset ball to center position
   */
  resetBallPosition() {
    this.state.ball.x = 400;
    this.state.ball.y = 300;
    this.state.ball.velocityX = 0;
    this.state.ball.velocityY = 0;
    
    this.broadcast('ball_reset', {
      ball: {
        x: this.state.ball.x,
        y: this.state.ball.y,
        velocityX: 0,
        velocityY: 0
      }
    });
  }

  /**
   * Handle room full (2 players joined)
   */
  handleRoomFull() {
    console.log(`[HEADBALL_ROOM] Room ${this.roomId} is full - waiting for players to ready up`);
    
    this.broadcast('room_full', {
      message: 'Room is full! Ready up to start the match.',
      playersCount: this.state.players.size
    });
  }

  /**
   * Start rematch
   */
  startRematch() {
    console.log(`[HEADBALL_ROOM] Starting rematch in room ${this.roomId}`);
    
    // Reset game state
    this.state.player1Score = 0;
    this.state.player2Score = 0;
    this.state.gameTime = 60;
    this.state.status = 'waiting';
    this.state.isActive = false;
    this.state.events = [];
    this.state.lastGoal = null;
    
    // Reset player ready states
    for (const player of this.state.players.values()) {
      player.isReady = false;
    }
    
    // Reset rematch state
    this.state.rematchState = JSON.stringify({
      player1Requested: false,
      player2Requested: false,
      timeoutActive: false
    });
    
    // Reset ball
    this.resetBallPosition();
    
    this.broadcast('rematch_started', {
      message: 'Rematch starting! Ready up to begin.'
    });
  }

  /**
   * Handle mid-game disconnection
   */
  handleMidGameDisconnection(client, player) {
    console.log(`[HEADBALL_ROOM] Mid-game disconnection: ${player.position}`);
    
    // End the game due to disconnection
    this.broadcast('player_disconnected', {
      disconnectedPlayer: player.position,
      message: `${player.username} disconnected. Game ended.`
    });
    
    // Award win to remaining player
    if (this.state.isActive) {
      this.endGame();
    }
  }

  /**
   * Handle insufficient players
   */
  handleInsufficientPlayers() {
    console.log(`[HEADBALL_ROOM] Insufficient players to continue game`);
    
    this.state.isActive = false;
    this.state.status = 'finished';
    this.stopGameLoop();
    
    this.broadcast('game_aborted', {
      reason: 'insufficient_players',
      message: 'Game ended due to player leaving.'
    });
  }

  /**
   * Handle empty room
   */
  handleRoomEmpty() {
    console.log(`[HEADBALL_ROOM] Room ${this.roomId} is empty - disposing`);
    this.stopGameLoop();
    // Room will auto-dispose due to autoDispose: true
  }

  /**
   * Stop game loop
   */
  stopGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
      console.log(`[HEADBALL_ROOM] Game loop stopped`);
    }
  }

  /**
   * Room disposal
   */
  async onDispose() {
    console.log(`[HEADBALL_ROOM] Disposing room ${this.roomId}`);
    this.stopGameLoop();
  }

  // Additional handler methods for powerups, admin actions, etc.
  handlePowerupSpawned(client, message) {
    // Implementation for powerup spawning
  }

  handlePowerupCollected(client, message) {
    // Implementation for powerup collection
  }

  handleAdminAction(client, message) {
    // Implementation for admin actions
  }
}

module.exports = { HeadballRoom };