import { Client } from 'colyseus.js';

/**
 * Colyseus Client for metaHead Arena
 * Example implementation for connecting to the new backend
 */

class HeadballColyseusClient {
  constructor(serverUrl = 'ws://localhost:3001') {
    this.client = new Client(serverUrl);
    this.room = null;
    this.authToken = null;
    this.gameState = null;
    
    // Event callbacks
    this.onRoomJoined = null;
    this.onPlayerJoined = null;
    this.onGameStarted = null;
    this.onPlayerPosition = null;
    this.onBallState = null;
    this.onGoalScored = null;
    this.onGameEnded = null;
    this.onError = null;
  }

  /**
   * Connect to room with authentication
   */
  async joinRoom(roomName = 'headball_1v1', options = {}) {
    try {
      // Get auth token from localStorage (maintaining compatibility)
      this.authToken = localStorage.getItem('auth_token');
      
      if (!this.authToken) {
        throw new Error('Authentication token required. Please login first.');
      }

      // Join room with authentication
      this.room = await this.client.joinOrCreate(roomName, {
        token: this.authToken,
        ...options
      });

      console.log('[COLYSEUS] ✅ Successfully joined room:', this.room.roomId);
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Callback
      if (this.onRoomJoined) {
        this.onRoomJoined(this.room.roomId);
      }

      return this.room;

    } catch (error) {
      console.error('[COLYSEUS] ❌ Failed to join room:', error.message);
      
      if (this.onError) {
        this.onError(error.message);
      }
      
      throw error;
    }
  }

  /**
   * Setup event handlers for room events
   */
  setupEventHandlers() {
    if (!this.room) return;

    // State synchronization
    this.room.onStateChange((state) => {
      this.gameState = state;
      console.log('[COLYSEUS] State updated:', {
        status: state.status,
        players: state.players.size,
        gameTime: state.gameTime,
        score: `${state.player1Score}-${state.player2Score}`
      });
    });

    // Player joined
    this.room.onMessage('player_joined', (data) => {
      console.log('[COLYSEUS] Player joined:', data.player.username);
      if (this.onPlayerJoined) {
        this.onPlayerJoined(data);
      }
    });

    // Room full and ready
    this.room.onMessage('room_full', (data) => {
      console.log('[COLYSEUS] Room full:', data.message);
      // Auto-ready for demo purposes (in real game, user clicks ready)
      this.setReady(true);
    });

    // Game started
    this.room.onMessage('game_started', (data) => {
      console.log('[COLYSEUS] 🎮 Game started! Match ID:', data.matchId);
      if (this.onGameStarted) {
        this.onGameStarted(data);
      }
    });

    // Real-time position updates
    this.room.onMessage('player_position', (data) => {
      if (this.onPlayerPosition) {
        this.onPlayerPosition(data);
      }
    });

    // Ball state updates
    this.room.onMessage('ball_state', (data) => {
      if (this.onBallState) {
        this.onBallState(data);
      }
    });

    // Goal scored
    this.room.onMessage('goal_scored', (data) => {
      console.log('[COLYSEUS] ⚽ Goal scored by', data.scoringPlayer);
      if (this.onGoalScored) {
        this.onGoalScored(data);
      }
    });

    // Game ended
    this.room.onMessage('game_ended', (data) => {
      console.log('[COLYSEUS] 🏁 Game ended. Winner:', data.result.winner || 'tie');
      if (this.onGameEnded) {
        this.onGameEnded(data);
      }
    });

    // Timer updates
    this.room.onMessage('timer_update', (data) => {
      console.log('[COLYSEUS] ⏰ Time remaining:', data.gameTime.toFixed(1));
    });

    // Error handling
    this.room.onMessage('error', (data) => {
      console.error('[COLYSEUS] Server error:', data.message);
      if (this.onError) {
        this.onError(data.message);
      }
    });

    // Connection issues
    this.room.onError((code, message) => {
      console.error('[COLYSEUS] Connection error:', { code, message });
      if (this.onError) {
        this.onError(`Connection error: ${message}`);
      }
    });

    // Room left
    this.room.onLeave((code) => {
      console.log('[COLYSEUS] Left room with code:', code);
      this.room = null;
    });
  }

  /**
   * Set player ready state
   */
  setReady(ready = true) {
    if (!this.room) return;
    
    this.room.send('player_ready', { ready });
    console.log('[COLYSEUS] Set ready state:', ready);
  }

  /**
   * Send player position update
   */
  updatePlayerPosition(position, playerData) {
    if (!this.room || !this.gameState?.isActive) return;
    
    this.room.send('player_position', {
      position: position, // 'player1' or 'player2'
      player: {
        x: playerData.x,
        y: playerData.y,
        velocityX: playerData.velocityX || 0,
        velocityY: playerData.velocityY || 0
      },
      timestamp: Date.now()
    });
  }

  /**
   * Send ball state update (only if you have ball authority)
   */
  updateBallState(ballData) {
    if (!this.room || !this.gameState?.isActive) return;
    
    // Only send if you're the ball authority (Player 1)
    const myPlayer = this.getMyPlayer();
    if (!myPlayer || myPlayer.position !== 'player1') return;
    
    this.room.send('ball_state', {
      ball: {
        x: ballData.x,
        y: ballData.y,
        velocityX: ballData.velocityX || 0,
        velocityY: ballData.velocityY || 0
      },
      timestamp: Date.now()
    });
  }

  /**
   * Report goal scored
   */
  reportGoal(scoringPlayer) {
    if (!this.room || !this.gameState?.isActive) return;
    
    // Only ball authority (Player 1) can report goals
    const myPlayer = this.getMyPlayer();
    if (!myPlayer || myPlayer.position !== 'player1') return;
    
    this.room.send('goal_scored', {
      scoringPlayer: scoringPlayer // 'player1' or 'player2'
    });
    
    console.log('[COLYSEUS] ⚽ Reported goal for:', scoringPlayer);
  }

  /**
   * Request rematch
   */
  requestRematch() {
    if (!this.room) return;
    
    this.room.send('request_rematch', {});
    console.log('[COLYSEUS] Rematch requested');
  }

  /**
   * Get my player from game state
   */
  getMyPlayer() {
    if (!this.room || !this.gameState) return null;
    
    return this.gameState.players.get(this.room.sessionId);
  }

  /**
   * Get opponent player
   */
  getOpponentPlayer() {
    if (!this.room || !this.gameState) return null;
    
    for (const [clientId, player] of this.gameState.players) {
      if (clientId !== this.room.sessionId) {
        return player;
      }
    }
    
    return null;
  }

  /**
   * Leave room
   */
  async leaveRoom() {
    if (this.room) {
      await this.room.leave();
      this.room = null;
      console.log('[COLYSEUS] Left room');
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    this.leaveRoom();
    // Client doesn't need explicit disconnect
  }
}

// Usage example:
async function example() {
  const game = new HeadballColyseusClient();
  
  // Setup callbacks
  game.onRoomJoined = (roomId) => {
    console.log('Joined room:', roomId);
  };
  
  game.onGameStarted = (data) => {
    console.log('Game started! Match ID:', data.matchId);
    
    // Start your game loop
    startGameLoop(game);
  };
  
  game.onPlayerPosition = (data) => {
    // Update opponent position in your game
    updateOpponentPosition(data.position, data.player);
  };
  
  game.onBallState = (data) => {
    // Update ball position in your game (if you're not ball authority)
    const myPlayer = game.getMyPlayer();
    if (myPlayer?.position !== 'player1') {
      updateBallPosition(data.ball);
    }
  };
  
  // Join room
  try {
    await game.joinRoom();
  } catch (error) {
    console.error('Failed to join game:', error);
  }
}

function startGameLoop(game) {
  // Your game rendering loop
  function gameLoop() {
    // Get player input and position
    const playerPosition = getPlayerPosition(); // Your implementation
    const myPlayer = game.getMyPlayer();
    
    if (myPlayer) {
      // Send position update
      game.updatePlayerPosition(myPlayer.position, playerPosition);
      
      // If you're ball authority, send ball updates
      if (myPlayer.position === 'player1') {
        const ballPosition = getBallPosition(); // Your implementation
        game.updateBallState(ballPosition);
        
        // Check for goals
        const goal = checkForGoal(); // Your implementation
        if (goal) {
          game.reportGoal(goal.scoringPlayer);
        }
      }
    }
    
    requestAnimationFrame(gameLoop);
  }
  
  gameLoop();
}

// Mock functions for example
function updateOpponentPosition(position, playerData) {
  console.log(`Update ${position} position:`, playerData);
}

function updateBallPosition(ballData) {
  console.log('Update ball position:', ballData);
}

function getPlayerPosition() {
  return { x: 100, y: 200, velocityX: 0, velocityY: 0 };
}

function getBallPosition() {
  return { x: 400, y: 300, velocityX: 10, velocityY: 5 };
}

function checkForGoal() {
  // Your goal detection logic
  return null;
}

export { HeadballColyseusClient };