class PhysicsEngine {
  /**
   * Get NFT modifiers for a player
   */
  getPlayerNFTModifiers(room, socketId) {
    const player = room.players.find((p) => p.id === socketId);
    if (!player || !player.nftModifiers) {
      return {
        jumpMultiplier: 1.0,
        superkickMultiplier: 1.0,
        speedMultiplier: 1.0,
      };
    }
    return player.nftModifiers;
  }

  /**
   * Handle player input and movement
   */
  handlePlayerInput(room, socketId, inputData) {
    if (!room || !room.gameState.isActive) {
      return { success: false, reason: "Game not active" };
    }

    // Get player position (player1 or player2)
    const playerPosition = room.players.find(
      (p) => p.id === socketId
    )?.position;
    if (!playerPosition) {
      return { success: false, reason: "Player position not found" };
    }

    const gamePlayer = room.gameState.players[playerPosition];
    const physics = room.settings.physics;

    // Get NFT modifiers for this player
    const nftModifiers = this.getPlayerNFTModifiers(room, socketId);
    const modifiedPlayerSpeed =
      physics.playerSpeed * nftModifiers.speedMultiplier;

    let inputProcessed = false;
    let kickResult = null;

    switch (inputData.action) {
      case "move-left":
        if (inputData.pressed) {
          gamePlayer.direction = "left";
          // More responsive movement - set velocity directly for immediate response
          gamePlayer.velocityX = -modifiedPlayerSpeed;
        }
        inputProcessed = true;
        break;

      case "move-right":
        if (inputData.pressed) {
          gamePlayer.direction = "right";
          // More responsive movement - set velocity directly for immediate response
          gamePlayer.velocityX = modifiedPlayerSpeed;
        }
        inputProcessed = true;
        break;

      case "jump":
        if (
          inputData.pressed &&
          gamePlayer.isOnGround &&
          !gamePlayer.isJumping
        ) {
          // NFT modifiers affect jump power
          const modifiedJumpPower =
            physics.jumpPower * nftModifiers.jumpMultiplier;
          gamePlayer.velocityY = -modifiedJumpPower;
          gamePlayer.isJumping = true;
          gamePlayer.isOnGround = false;
          console.log(
            `${playerPosition} jumped with NFT-modified velocity ${-modifiedJumpPower.toFixed(
              1
            )} (modifier: ${nftModifiers.jumpMultiplier})`
          );
        }
        inputProcessed = true;
        break;

      case "kick":
        if (inputData.pressed) {
          const ball = room.gameState.ball;
          const kickRange = 50;
          const distanceX = Math.abs(gamePlayer.x - ball.x);
          const distanceY = Math.abs(gamePlayer.y - ball.y);
          const currentTime = Date.now();

          if (distanceX <= kickRange && distanceY <= kickRange) {
            // Anti-spam: 300ms cooldown between kicks
            if (
              !gamePlayer.lastKickTime ||
              currentTime - gamePlayer.lastKickTime > 300
            ) {
              kickResult = this.executeKick(
                room,
                playerPosition,
                gamePlayer,
                ball,
                socketId // Pass socketId to get NFT modifiers
              );
              gamePlayer.lastKickTime = currentTime;
            }
          }
        }
        inputProcessed = true;
        break;

      case "stop":
      case "stop-move":
        gamePlayer.direction = "idle";
        gamePlayer.velocityX *= 0.5; // Faster stop for more responsive control
        inputProcessed = true;
        break;
    }

    return {
      success: inputProcessed,
      player: { id: socketId, position: playerPosition },
      gamePlayer: gamePlayer,
      kickResult: kickResult,
      timestamp: Date.now(),
    };
  }

  /**
   * Update game physics for a room
   */
  updateGamePhysics(room, deltaTime = 16.67) {
    if (!room || !room.gameState.isActive) {
      return null;
    }

    const gameState = room.gameState;
    const physics = room.settings.physics;

    // Update player physics
    this.updatePlayerPhysics(room, deltaTime);

    // Update ball physics
    this.updateBallPhysics(room, deltaTime);

    // Check collisions
    this.checkPlayerBallCollisions(room, deltaTime);

    // Check goal collisions
    const goalResult = this.checkGoalCollision(
      room,
      gameState.ball,
      room.settings.field
    );

    // Update game time
    gameState.gameTime -= deltaTime / 1000;
    if (gameState.gameTime <= 0) {
      gameState.gameTime = 0;
      console.log(`⏰ Time's up! Ending game for room ${room.id}`);
      return this.endGameByTime(room);
    }

    return {
      room: room,
      goalResult: goalResult,
      gameState: gameState,
      timestamp: Date.now(),
    };
  }

  /**
   * Update ball physics
   */
  updateBallPhysics(room, deltaTime) {
    const ball = room.gameState.ball;
    const physics = room.settings.physics;
    const field = room.settings.field;

    // Apply gravity
    ball.velocityY += physics.gravity;

    // Apply air resistance
    ball.velocityX *= physics.airResistance;
    ball.velocityY *= physics.airResistance;

    // Update position
    ball.x += ball.velocityX;
    ball.y += ball.velocityY;

    // Ground collision
    if (ball.y >= field.groundLevel - ball.radius) {
      ball.y = field.groundLevel - ball.radius;
      ball.velocityY *= -physics.ballBounce;

      // Stop tiny bounces
      if (Math.abs(ball.velocityY) < 1) {
        ball.velocityY = 0;
      }

      // Ground friction
      ball.velocityX *= physics.friction;
    }

    // Wall collisions
    if (ball.x <= ball.radius) {
      ball.x = ball.radius;
      ball.velocityX *= -0.8;
    } else if (ball.x >= field.width - ball.radius) {
      ball.x = field.width - ball.radius;
      ball.velocityX *= -0.8;
    }

    // Ceiling collision
    if (ball.y <= ball.radius) {
      ball.y = ball.radius;
      ball.velocityY *= -physics.ballBounce;
    }
  }

  /**
   * Check goal collision
   */
  checkGoalCollision(room, ball, field) {
    const goalHeight = field.goalHeight;
    const goalY = field.groundLevel - goalHeight;
    const ballRadius = ball.radius;

    console.log(
      `🔍 Goal check - Ball: (${ball.x.toFixed(1)}, ${ball.y.toFixed(
        1
      )}), GoalY: ${goalY}, GroundLevel: ${field.groundLevel}`
    );

    // Left goal (player2 scores) - ball center crosses goal line
    if (
      ball.x - ballRadius <= 0 &&
      ball.y >= goalY &&
      ball.y <= field.groundLevel
    ) {
      console.log(
        `⚽ LEFT GOAL! Player2 scores! Ball position: (${ball.x.toFixed(
          1
        )}, ${ball.y.toFixed(1)})`
      );
      return this.handleGoal(room, "player2");
    }

    // Right goal (player1 scores) - ball center crosses goal line
    if (
      ball.x + ballRadius >= field.width &&
      ball.y >= goalY &&
      ball.y <= field.groundLevel
    ) {
      console.log(
        `⚽ RIGHT GOAL! Player1 scores! Ball position: (${ball.x.toFixed(
          1
        )}, ${ball.y.toFixed(1)})`
      );
      return this.handleGoal(room, "player1");
    }

    return null;
  }

  /**
   * Handle goal scoring
   */
  handleGoal(room, scoringPlayer) {
    console.log(`⚽ GOAL! ${scoringPlayer} scored!`);

    // Update score
    room.gameState.score[scoringPlayer]++;

    // Reset positions immediately
    room.gameState.players.player1.x = 150;
    room.gameState.players.player1.y = 320;
    room.gameState.players.player1.velocityX = 0;
    room.gameState.players.player1.velocityY = 0;
    room.gameState.players.player1.isJumping = false;
    room.gameState.players.player1.isOnGround = true;

    room.gameState.players.player2.x = 650;
    room.gameState.players.player2.y = 320;
    room.gameState.players.player2.velocityX = 0;
    room.gameState.players.player2.velocityY = 0;
    room.gameState.players.player2.isJumping = false;
    room.gameState.players.player2.isOnGround = true;

    // Reset ball to center
    this.resetBallPosition(room);

    // Add to game events
    const goalEvent = {
      type: "goal",
      player: scoringPlayer,
      time: Date.now(),
      newScore: { ...room.gameState.score },
      positionsReset: true,
    };

    room.gameState.gameEvents.push(goalEvent);
    room.gameState.lastGoal = goalEvent;

    return {
      type: "goal",
      scorer: scoringPlayer,
      newScore: room.gameState.score,
      goalEvent: goalEvent,
      positionsReset: true,
    };
  }

  /**
   * Reset ball position to center
   */
  resetBallPosition(room) {
    const field = room.settings.field;
    const ball = room.gameState.ball;

    ball.x = field.centerLine;
    ball.y = 200; // Middle height
    ball.velocityX = 0;
    ball.velocityY = 0;
    ball.lastTouchedBy = null;
    ball.lastKickTime = {};

    console.log("Ball reset to center position");
  }

  /**
   * Check player-ball collisions
   */
  checkPlayerBallCollisions(room, deltaTime) {
    const ball = room.gameState.ball;
    const players = room.gameState.players;

    ["player1", "player2"].forEach((playerKey) => {
      const player = players[playerKey];
      const collision = this.detectPlayerBallCollision(player, ball);

      if (collision.detected) {
        this.handlePlayerBallCollision(
          room,
          playerKey,
          player,
          ball,
          collision
        );
      }
    });
  }

  /**
   * Detect collision between player and ball
   */
  detectPlayerBallCollision(player, ball) {
    const playerRadius = 25; // Player collision radius
    const ballRadius = ball.radius;
    const minDistance = playerRadius + ballRadius;

    const dx = player.x - ball.x;
    const dy = player.y - ball.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      return {
        detected: true,
        distance: distance,
        overlap: minDistance - distance,
        relativeX: dx,
        relativeY: dy,
      };
    }

    return { detected: false };
  }

  /**
   * Handle player-ball collision
   */
  handlePlayerBallCollision(room, playerKey, player, ball, collision) {
    const currentTime = Date.now();

    // 200ms cooldown per player to prevent continuous kicking
    if (
      ball.lastKickTime[playerKey] &&
      currentTime - ball.lastKickTime[playerKey] < 200
    ) {
      return;
    }

    // Check if ball was recently touched by opponent (for smooth player vs player)
    const otherPlayer = playerKey === "player1" ? "player2" : "player1";
    const recentOpponentTouch =
      ball.lastKickTime[otherPlayer] &&
      currentTime - ball.lastKickTime[otherPlayer] < 300;

    // Get NFT modifiers for the colliding player
    const socketId = room.players.find((p) => p.position === playerKey)?.id;
    const nftModifiers = socketId
      ? this.getPlayerNFTModifiers(room, socketId)
      : { superkickMultiplier: 1.0 };

    // Calculate kick power with NFT modifiers
    const basePower = recentOpponentTouch ? 12 : 8; // Stronger for tackles
    const playerSpeed = Math.abs(player.velocityX) + Math.abs(player.velocityY);
    const kickPower =
      (basePower + playerSpeed * 0.3) * nftModifiers.superkickMultiplier;

    // Determine kick direction based on collision position
    const normalizedX =
      collision.relativeX / Math.max(Math.abs(collision.relativeX), 1);
    const normalizedY =
      collision.relativeY / Math.max(Math.abs(collision.relativeY), 1);

    let kickX = normalizedX * kickPower;
    let kickY = normalizedY * kickPower * 0.7; // Reduce vertical component

    // Apply kick to ball
    ball.velocityX = -kickX; // Negative because we want ball to move away from player
    ball.velocityY = -kickY;
    ball.lastTouchedBy = playerKey;
    ball.lastKickTime[playerKey] = currentTime;

    // Push ball away from player to prevent sticking
    const pushDistance = 30;
    ball.x -= normalizedX * pushDistance;
    ball.y -= normalizedY * pushDistance;

    console.log(
      `${playerKey} ${
        recentOpponentTouch ? "tackled" : "kicked"
      } the ball with NFT-modified power! Velocity: (${kickX.toFixed(
        1
      )}, ${kickY.toFixed(1)}) Modifier: ${nftModifiers.superkickMultiplier}`
    );
  }

  /**
   * Update player physics
   */
  updatePlayerPhysics(room, deltaTime) {
    const physics = room.settings.physics;
    const field = room.settings.field;

    ["player1", "player2"].forEach((playerKey) => {
      const player = room.gameState.players[playerKey];

      // Apply gravity
      if (!player.isOnGround) {
        player.velocityY += physics.gravity;
      }

      // Apply air resistance
      player.velocityX *= physics.airResistance;
      if (!player.isOnGround) {
        player.velocityY *= physics.airResistance;
      }

      // Update position
      player.x += player.velocityX;
      player.y += player.velocityY;

      // Ground collision
      if (player.y >= field.groundLevel) {
        player.y = field.groundLevel;
        player.velocityY = 0;
        player.isOnGround = true;
        player.isJumping = false;
      } else {
        player.isOnGround = false;
      }

      // Boundary checks
      player.x = Math.max(25, Math.min(field.width - 25, player.x));
      player.y = Math.max(0, player.y);

      // Apply friction when on ground
      if (player.isOnGround) {
        player.velocityX *= physics.friction;
      }
    });
  }

  /**
   * End game by time
   */
  endGameByTime(room) {
    const score = room.gameState.score;
    let result = "draw";
    let winner = null;

    if (score.player1 > score.player2) {
      result = "player1_wins";
      winner = room.players[0];
    } else if (score.player2 > score.player1) {
      result = "player2_wins";
      winner = room.players[1];
    }

    console.log(`🏁 endGameByTime called for room ${room.id}`);
    console.log(`🏁 Final score: ${score.player1} - ${score.player2}`);
    console.log(`🏁 Result: ${result}, Winner:`, winner);

    return {
      type: "game-ended",
      result: result,
      winner: winner,
      finalScore: score,
      room: room,
    };
  }

  /**
   * Execute kick action
   */
  executeKick(room, playerPosition, gamePlayer, ball, socketId = null) {
    // Calculate kick direction and power based on player position relative to ball
    const directionX = ball.x - gamePlayer.x;
    const directionY = ball.y - gamePlayer.y;
    const distance = Math.sqrt(
      directionX * directionX + directionY * directionY
    );

    if (distance === 0) return null; // Prevent division by zero

    // Normalize direction
    const normalizedX = directionX / distance;
    const normalizedY = directionY / distance;

    // Get NFT modifiers for kick power
    const nftModifiers = socketId
      ? this.getPlayerNFTModifiers(room, socketId)
      : { superkickMultiplier: 1.0 };

    // Calculate kick power (stronger if player is moving)
    const playerSpeedBonus =
      Math.abs(gamePlayer.velocityX) + Math.abs(gamePlayer.velocityY);
    const basePower = 8;
    const kickPower =
      (basePower + playerSpeedBonus * 0.5) * nftModifiers.superkickMultiplier;

    // Apply kick to ball
    ball.velocityX = normalizedX * kickPower;
    ball.velocityY = normalizedY * kickPower * 0.6; // Reduce vertical force
    ball.lastTouchedBy = playerPosition;

    // Push ball away from player to prevent sticking
    const pushDistance = ball.radius + 20;
    ball.x += normalizedX * pushDistance;
    ball.y += normalizedY * pushDistance;

    // Keep ball in bounds
    const field = room.settings.field;
    ball.x = Math.max(ball.radius, Math.min(field.width - ball.radius, ball.x));
    ball.y = Math.max(ball.radius, Math.min(field.groundLevel, ball.y));

    console.log(
      `${playerPosition} kicked ball with NFT-modified power ${kickPower.toFixed(
        1
      )} (modifier: ${nftModifiers.superkickMultiplier})`
    );

    return {
      kickPower: kickPower,
      direction: { x: normalizedX, y: normalizedY },
      ballVelocity: { x: ball.velocityX, y: ball.velocityY },
    };
  }
}

module.exports = new PhysicsEngine();
