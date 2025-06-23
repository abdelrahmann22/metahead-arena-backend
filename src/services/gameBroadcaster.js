class GameBroadcaster {
  constructor() {
    this.socketIO = null;
  }

  /**
   * Set Socket.IO instance for broadcasting
   */
  setSocketIO(io) {
    this.socketIO = io;
  }

  /**
   * Broadcast game state updates to room
   */
  broadcastGameState(roomId, updateResult) {
    if (!this.socketIO || !updateResult) {
      console.warn(`broadcastGameState: Invalid parameters for room ${roomId}`);
      return;
    }

    const currentState = updateResult.gameState;
    const room = updateResult.room;

    // Validate required data structure
    if (!currentState || !room) {
      console.warn(
        `broadcastGameState: Missing gameState or room data for room ${roomId}`
      );
      return;
    }

    // Check if game is still active - don't broadcast for ended games
    if (!currentState.isActive) {
      console.log(
        `broadcastGameState: Game not active for room ${roomId}, skipping broadcast`
      );
      return;
    }

    // Store last state for delta comparison
    if (!room.lastBroadcastState) {
      room.lastBroadcastState = {
        players: {
          player1: {
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            direction: "idle",
            isJumping: false,
            isOnGround: true,
          },
          player2: {
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            direction: "idle",
            isJumping: false,
            isOnGround: true,
          },
        },
        ball: { x: 0, y: 0, velocityX: 0, velocityY: 0 },
        score: { player1: 0, player2: 0 },
        gameTime: 120,
      };
    }

    const lastState = room.lastBroadcastState;

    // Validate gameState structure
    if (
      !currentState.players ||
      !currentState.players.player1 ||
      !currentState.players.player2 ||
      !currentState.ball
    ) {
      console.warn(`Invalid gameState structure for room ${roomId}`);
      return;
    }

    // Calculate delta changes (only send what changed)
    const changes = {
      players: {},
      ball: {},
      score: null,
      gameTime: null,
    };

    // Player changes
    ["player1", "player2"].forEach((playerKey) => {
      const current = currentState.players[playerKey];
      const last = lastState.players[playerKey];

      const playerChanges = {};
      [
        "x",
        "y",
        "velocityX",
        "velocityY",
        "direction",
        "isJumping",
        "isOnGround",
      ].forEach((prop) => {
        if (Math.abs(current[prop] - (last[prop] || 0)) > 0.1) {
          // Threshold for float comparison
          playerChanges[prop] = Math.round(current[prop] * 10) / 10;
        }
      });

      if (Object.keys(playerChanges).length > 0) {
        changes.players[playerKey] = playerChanges;
      }
    });

    // Ball changes
    const ballCurrent = currentState.ball;
    const ballLast = lastState.ball;
    const ballChanges = {};

    ["x", "y", "velocityX", "velocityY"].forEach((prop) => {
      if (Math.abs(ballCurrent[prop] - (ballLast[prop] || 0)) > 0.1) {
        ballChanges[prop] = Math.round(ballCurrent[prop] * 10) / 10;
      }
    });

    if (Object.keys(ballChanges).length > 0) {
      changes.ball = ballChanges;
    }

    // Score changes
    if (
      currentState.score.player1 !== lastState.score.player1 ||
      currentState.score.player2 !== lastState.score.player2
    ) {
      changes.score = currentState.score;
    }

    // Game time changes (every second)
    if (Math.abs(currentState.gameTime - lastState.gameTime) >= 1) {
      changes.gameTime = Math.round(currentState.gameTime);
    }

    // Only broadcast if there are significant changes
    const hasChanges =
      Object.keys(changes.players).length > 0 ||
      Object.keys(changes.ball).length > 0 ||
      changes.score ||
      changes.gameTime !== null;

    if (hasChanges) {
      const broadcastData = {
        type: "game-state-update",
        roomId: roomId,
        timestamp: Date.now(),
        changes: changes, // Delta data
        // Full state every 10th update for sync
        fullState:
          Date.now() % 10 === 0
            ? {
                players: {
                  player1: {
                    x: Math.round(currentState.players.player1.x * 10) / 10,
                    y: Math.round(currentState.players.player1.y * 10) / 10,
                    velocityX:
                      Math.round(currentState.players.player1.velocityX * 10) /
                      10,
                    velocityY:
                      Math.round(currentState.players.player1.velocityY * 10) /
                      10,
                    direction: currentState.players.player1.direction,
                    isJumping: currentState.players.player1.isJumping,
                    isOnGround: currentState.players.player1.isOnGround,
                  },
                  player2: {
                    x: Math.round(currentState.players.player2.x * 10) / 10,
                    y: Math.round(currentState.players.player2.y * 10) / 10,
                    velocityX:
                      Math.round(currentState.players.player2.velocityX * 10) /
                      10,
                    velocityY:
                      Math.round(currentState.players.player2.velocityY * 10) /
                      10,
                    direction: currentState.players.player2.direction,
                    isJumping: currentState.players.player2.isJumping,
                    isOnGround: currentState.players.player2.isOnGround,
                  },
                },
                ball: {
                  x: Math.round(currentState.ball.x * 10) / 10,
                  y: Math.round(currentState.ball.y * 10) / 10,
                  velocityX: Math.round(currentState.ball.velocityX * 10) / 10,
                  velocityY: Math.round(currentState.ball.velocityY * 10) / 10,
                },
                score: currentState.score,
                gameTime: Math.round(currentState.gameTime * 10) / 10,
                isActive: currentState.isActive,
              }
            : null,
      };

      this.socketIO.to(roomId).emit("game-state-update", broadcastData);

      // Update last broadcast state
      room.lastBroadcastState = JSON.parse(JSON.stringify(currentState));
    }
  }

  /**
   * Broadcast goal events
   */
  broadcastGoalEvent(roomId, goalResult) {
    if (!this.socketIO) return;

    const goalData = {
      type: "goal-scored",
      roomId: roomId,
      timestamp: Date.now(),
      scorer: goalResult.scorer,
      newScore: goalResult.newScore,
      goalEvent: goalResult.goalEvent,
      celebrationDuration: 1000, // 1 second celebration
      positionsReset: true,
    };

    console.log(`Broadcasting goal to room ${roomId}:`, goalData);
    this.socketIO.to(roomId).emit("goal-scored", goalData);

    // Pause game briefly for goal celebration (1 second)
    setTimeout(() => {
      if (this.socketIO) {
        this.socketIO.to(roomId).emit("goal-celebration-end", {
          roomId: roomId,
          timestamp: Date.now(),
          message: "Game resumed after goal!",
        });
      }
    }, 1000); // 1 second pause
  }

  /**
   * Broadcast game end
   */
  broadcastGameEnd(roomId, gameResult) {
    if (!this.socketIO) return;

    const endData = {
      type: "game-ended",
      roomId: roomId,
      timestamp: Date.now(),
      result: gameResult.result,
      winner: gameResult.winner,
      finalScore: gameResult.finalScore,
      gameStats: {
        duration: 120 - gameResult.room.gameState.gameTime,
        totalGoals:
          gameResult.finalScore.player1 + gameResult.finalScore.player2,
        events: gameResult.room.gameState.gameEvents,
      },
    };

    console.log(
      `Broadcasting game end to room ${roomId}:`,
      JSON.stringify(endData, null, 2)
    );
    this.socketIO.to(roomId).emit("game-ended", endData);
  }

  /**
   * Broadcast player movement
   */
  broadcastPlayerMovement(roomId, playerId, input) {
    if (!this.socketIO) return;

    this.socketIO.to(roomId).emit("player-movement", {
      playerId: playerId,
      input: input,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast player kick action
   */
  broadcastPlayerKick(roomId, playerId, username, kickResult) {
    if (!this.socketIO) return;

    this.socketIO.to(roomId).emit("player-kicked-ball", {
      playerId: playerId,
      username: username,
      kickPower: kickResult.kickPower,
      direction: kickResult.direction,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast room events
   */
  broadcastRoomJoined(socketId, roomData) {
    if (!this.socketIO) return;

    const socket = this.socketIO.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("room-joined", roomData);
    }
  }

  broadcastRoomFull(roomId, message) {
    if (!this.socketIO) return;

    this.socketIO.to(roomId).emit("room-full", {
      message: message,
    });
  }

  broadcastPlayerReady(roomId, playerData) {
    if (!this.socketIO) return;

    this.socketIO.to(roomId).emit("player-ready-changed", playerData);
  }

  broadcastGameStarted(roomId, gameData) {
    if (!this.socketIO) return;

    this.socketIO.to(roomId).emit("game-started", gameData);
  }

  broadcastPlayerLeft(roomId, playerData) {
    if (!this.socketIO) return;

    this.socketIO.to(roomId).emit("player-left-room", playerData);
  }

  /**
   * Broadcast error to specific socket
   */
  broadcastError(socketId, errorData) {
    if (!this.socketIO) return;

    const socket = this.socketIO.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("error", errorData);
    }
  }

  /**
   * Broadcast welcome message to new connection
   */
  broadcastWelcome(socketId, welcomeData) {
    if (!this.socketIO) return;

    const socket = this.socketIO.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("welcome", welcomeData);
    }
  }

  /**
   * Broadcast player created confirmation
   */
  broadcastPlayerCreated(socketId, playerData) {
    if (!this.socketIO) return;

    const socket = this.socketIO.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("player-created", playerData);
    }
  }
}

module.exports = new GameBroadcaster();
