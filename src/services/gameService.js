const Player = require("../models/player");
const GameRoom = require("../models/gameRoom");
const User = require("../models/user");

class GameService {
  constructor() {
    this.connectedPlayers = new Map();
    this.gameRooms = new Map();
    this.waitingPlayers = new Set();
    this.gameLoops = new Map();
    this.socketIO = null;
    this.startGameLoopCoordinator();
  }

  async updateUserGameStats(userId, matchResult) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      user.gameStats.totalMatches += 1;

      if (matchResult.won) {
        user.gameStats.totalWins += 1;
        user.gameStats.experience += 50;
        user.gameStats.rankPoints += 25;
      } else {
        user.gameStats.totalLosses += 1;
        user.gameStats.experience += 10;
        user.gameStats.rankPoints = Math.max(0, user.gameStats.rankPoints - 15);
      }

      user.gameStats.totalGoals += matchResult.goals || 0;
      user.gameStats.totalPlayTime += matchResult.playTime || 0;

      // Level up logic
      const requiredExp = user.gameStats.level * 100;
      if (user.gameStats.experience >= requiredExp) {
        user.gameStats.level += 1;
        user.gameStats.experience = 0;
      }

      user.lastActiveAt = new Date();
      return await user.save();
    } catch (error) {
      console.error("Error updating user game stats:", error);
      return null;
    }
  }

  async setUserOnline(userId, socketId = null) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      user.isOnline = true;
      user.socketId = socketId;
      user.lastActiveAt = new Date();
      return await user.save();
    } catch (error) {
      console.error("Error setting user online:", error);
      return null;
    }
  }

  async setUserOffline(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return null;

      user.isOnline = false;
      user.socketId = null;
      user.lastActiveAt = new Date();
      return await user.save();
    } catch (error) {
      console.error("Error setting user offline:", error);
      return null;
    }
  }

  async findUserBySocketId(socketId) {
    try {
      return await User.findOne({ socketId });
    } catch (error) {
      console.error("Error finding user by socket ID:", error);
      return null;
    }
  }

  async getUserLeaderboard(limit = 10) {
    try {
      return await User.find({ isActive: true })
        .sort({ "gameStats.rankPoints": -1 })
        .limit(limit)
        .select("username gameStats");
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      return [];
    }
  }

  async getOnlineUsers() {
    try {
      return await User.find({ isOnline: true }).select(
        "username gameStats socketId"
      );
    } catch (error) {
      console.error("Error getting online users:", error);
      return [];
    }
  }

  // Player model business logic (moved from model)
  updatePlayerStats(player, gameResult) {
    player.stats.gamesPlayed++;
    if (gameResult.won) {
      player.stats.wins++;
    } else {
      player.stats.losses++;
    }
  }

  resetPlayerGameState(player) {
    player.gameState = {
      position: { x: 0, y: 0 },
      score: 0,
      powerups: [],
    };
  }

  // GameRoom model business logic (moved from model)
  addPlayerToRoom(room, player) {
    if (room.players.length >= room.maxPlayers) {
      return { success: false, reason: "Room is full" };
    }
    if (room.players.find((p) => p.id === player.id)) {
      return { success: false, reason: "Player already in room" };
    }
    room.players.push(player);
    player.currentRoom = room.id;
    return { success: true };
  }

  removePlayerFromRoom(room, playerId) {
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex === -1) {
      return { success: false, reason: "Player not found" };
    }
    const player = room.players[playerIndex];
    room.players.splice(playerIndex, 1);
    player.currentRoom = null;
    player.isReady = false;

    return {
      success: true,
      isEmpty: room.players.length === 0,
      player: player,
    };
  }

  isRoomFull(room) {
    return room.players.length >= room.maxPlayers;
  }

  canRoomStart(room) {
    return (
      room.players.length === room.maxPlayers &&
      room.players.every((p) => p.isReady) &&
      room.status === "waiting"
    );
  }

  startRoomGame(room) {
    console.log(`Attempting to start game in room ${room.id}`);

    if (!this.canRoomStart(room)) {
      console.log(`Cannot start game in room ${room.id}`);
      return { success: false, reason: "Cannot start game" };
    }

    room.status = "playing";
    room.startedAt = new Date();
    room.gameState.isActive = true;
    room.gameState.score = { player1: 0, player2: 0 };
    room.gameState.gameTime = 120; // 2 minutes game duration

    // Reset all players' game states
    room.players.forEach((player) => {
      this.resetPlayerGameState(player);
    });

    // Initialize player positions using the new system
    room.gameState.players.player1.x = 150;
    room.gameState.players.player1.y = 320;
    room.gameState.players.player2.x = 650;
    room.gameState.players.player2.y = 320;

    console.log(`Game started in room ${room.id}`);
    return { success: true };
  }

  endRoomGame(room, winnerIndex = 0) {
    room.status = "finished";
    room.endedAt = new Date();
    room.gameState.isActive = false;

    const winner = room.players[winnerIndex];
    const loser = room.players[1 - winnerIndex];

    return {
      winner: winner,
      loser: loser,
      finalScore: room.gameState.score,
      duration: room.endedAt - room.startedAt,
    };
  }

  updatePlayerPosition(room, playerId, position) {
    if (room.status !== "playing") {
      return { success: false, reason: "Game is not active" };
    }
    
    // Find which player this is and update their position
    const playerIndex = room.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== -1) {
      const playerKey = playerIndex === 0 ? "player1" : "player2";
      room.gameState.players[playerKey].x = position.x;
      room.gameState.players[playerKey].y = position.y;
    }
    
    return { success: true };
  }

  setPlayerReady(room, playerId, ready = true) {
    const player = room.players.find((p) => p.id === playerId);
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    player.isReady = ready;
    return {
      success: true,
      allReady: room.players.every((p) => p.isReady),
      canStart: this.canRoomStart(room),
    };
  }

  // API service methods for controllers
  async getApiDocumentation() {
    return {
      message: "🏈 Head Ball Real-Time Game API",
      version: "1.0.0",
      architecture: "MCS (Model-Controller-Service)",
      endpoints: {
        "/stats": "GET - Global game statistics",
        "/rooms": "GET - All active game rooms",
        "/rooms/:roomId": "GET - Specific room info",
        "/players": "GET - All connected players",
        "/players/:playerId": "GET - Specific player info",
      },
      websocket: "Socket.IO enabled for real-time gameplay",
      note: "All business logic handled in service layer",
    };
  }

  async getAllRooms() {
    return Array.from(this.gameRooms.values()).map((room) => room.toJSON());
  }

  async getAllPlayers() {
    return Array.from(this.connectedPlayers.values()).map((player) =>
      player.toJSON()
    );
  }

  async getGlobalStats() {
    return {
      connectedPlayers: this.connectedPlayers.size,
      activeRooms: this.gameRooms.size,
      waitingPlayers: this.waitingPlayers.size,
      totalUsers: await User.countDocuments({ isActive: true }),
      onlineUsers: await User.countDocuments({ isOnline: true }),
    };
  }

  async getLeaderboard({ page = 1, limit = 20, period = "all" }) {
    const players = await this.getUserLeaderboard(limit);
    return {
      players,
      total: await User.countDocuments({ isActive: true }),
    };
  }

  async getAvailableRooms({ page = 1, limit = 10, gameMode }) {
    const rooms = Array.from(this.gameRooms.values())
      .filter((room) => room.status === "waiting" && !this.isRoomFull(room))
      .slice((page - 1) * limit, page * limit)
      .map((room) => room.toJSON());

    return {
      rooms,
      total: Array.from(this.gameRooms.values()).filter(
        (room) => room.status === "waiting"
      ).length,
    };
  }

  async createRoom(roomData = {}) {
    const roomId = this.generateRoomId();
    const room = new GameRoom(roomId);

    // Apply any custom settings
    if (roomData.settings) {
      Object.assign(room.settings, roomData.settings);
    }

    this.gameRooms.set(roomId, room);
    return room.toJSON();
  }

  // Player Management (Socket-based for real-time game)
  createPlayer(socketId, username) {
    if (this.connectedPlayers.has(socketId)) {
      return { success: false, reason: "Player already exists" };
    }

    const player = new Player(socketId, username);
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
      this.leaveRoom(socketId, player.currentRoom);
    }

    // Remove from waiting players if they were waiting
    this.waitingPlayers.delete(socketId);

    // Remove from connected players
    this.connectedPlayers.delete(socketId);

    return player;
  }

  // Room Management
  createRoom() {
    const roomId = this.generateRoomId();
    const room = new GameRoom(roomId);
    this.gameRooms.set(roomId, room);

    return room;
  }

  getRoom(roomId) {
    return this.gameRooms.get(roomId);
  }

  deleteRoom(roomId) {
    const room = this.gameRooms.get(roomId);
    if (room) {
      this.gameRooms.delete(roomId);
    }
    return room;
  }
  findAvailableRoom() {
    for (let room of this.gameRooms.values()) {
      if (!room.isFull() && room.status === "waiting") {
        return room;
      }
    }
    return null;
  }

  // Matchmaking - simplified for 1v1 only
  findMatch(socketId) {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    if (player.currentRoom) {
      return { success: false, reason: "Player already in a room" };
    }

    // Find existing room or create a new one
    let room = this.findAvailableRoom();
    if (!room) {
      room = this.createRoom();
    }

    // Add player to the room
    const result = room.addPlayer(player);
    if (!result.success) {
      return { success: false, reason: result.reason };
    }

    this.waitingPlayers.delete(socketId);

    return {
      success: true,
      room: room,
      player: player,
    };
  }

  leaveRoom(socketId) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    const result = room.removePlayer(socketId);
    if (!result.success) {
      return { success: false, reason: result.reason };
    }

    // If room is empty, delete it
    if (result.isEmpty) {
      this.deleteRoom(room.id);
    }

    return {
      success: true,
      player: result.player,
      room: room,
    };
  }

  togglePlayerReady(socketId) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }
    player.isReady = !player.isReady;
    return {
      success: true,
      player: player,
      room: room,
      canStart: room.canStart(),
    };
  }
  startGame(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    if (room.players.length < 2) {
      return { success: false, reason: "Need 2 players to start" };
    }

    // Use enhanced game start with 60fps loop
    const result = this.startRoomGameWithLoop(room);
    if (!result.success) {
      return { success: false, reason: result.reason };
    }

    console.log(
      `🎮 2D Head Ball game started in room ${roomId} with 60fps physics!`
    );

    return {
      success: true,
      room: room,
      message: "2D Head Ball match started with real-time physics!",
    };
  }

  endGame(roomId, winnerId = null) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }
    const result = room.endGame();

    setTimeout(() => {
      this.deleteRoom(roomId);
    }, 30000); // Delay before deleting room
    return { success: true, room: room, gameResult: result };
  }

  handleGameAction(socketId, action, data = {}) {
    const player = this.getPlayer(socketId);
    if (!player || !player.currentRoom) {
      console.log(`Action failed: Player ${socketId} not in active game`);
      return { success: false, reason: "Player not in active game" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room) {
      console.log(`Action failed: Room ${player.currentRoom} not found`);
      return { success: false, reason: "Room not found" };
    }

    if (room.status !== "playing") {
      console.log(
        `❌ Action failed: Room ${room.id} status is "${room.status}", not "playing"`
      );
      return { success: false, reason: "Game not active" };
    }

    console.log(
      `✅ Processing action "${action}" for player ${player.username} in room ${room.id}`
    );

    // Handle different game actions
    switch (action) {
      case "goal":
      case "GOAL":
        const scored = room.updateScore(player.id, 1);
        if (scored) {
          console.log(`Goal scored by ${player.username} in room ${room.id}`);
          return {
            success: true,
            action: "goal",
            player: player,
            newScore: room.gameState.score,
            gameState: room.getGameState(),
          };
        }
        break;

      case "MOVE_UP":
      case "MOVE_DOWN":
      case "MOVE_LEFT":
      case "MOVE_RIGHT":
        // Handle movement actions
        const moved = room.movePlayer(player.id, action);
        if (moved) {
          console.log(`${player.username} moved: ${action}`);
          return {
            success: true,
            action: action,
            player: player,
            gameState: room.getGameState(),
          };
        }
        break;

      case "kick":
      case "KICK":
        // Handle kick action (moves ball)
        const kicked = room.movePlayer(player.id, "KICK");
        if (kicked) {
          console.log(`${player.username} kicked the ball`);
          return {
            success: true,
            action: "KICK",
            player: player,
            gameState: room.getGameState(),
          };
        }
        break;

      case "jump":
      case "JUMP":
      case "tackle":
      case "TACKLE":
      case "powerup":
      case "POWERUP":
        // These are just animation events, no position change
        console.log(`${player.username} performed action: ${action}`);
        return {
          success: true,
          action: action,
          player: player,
          data: data,
        };
    }

    return { success: false, reason: "Invalid action" };
  }

  // Player movement input handler
  handlePlayerInput(socketId, inputData) {
    const player = this.getPlayer(socketId);
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room || !room.gameState.isActive) {
      return { success: false, reason: "No active game" };
    }

    // Determine which player this is (player1 or player2)
    const playerIndex = room.players.findIndex((p) => p.id === socketId);
    if (playerIndex === -1) {
      return { success: false, reason: "Player not in room" };
    }

    const playerKey = playerIndex === 0 ? "player1" : "player2";
    const playerState = room.gameState.players[playerKey];

    // Handle different input actions
    switch (inputData.action) {
      case "move-left":
        if (inputData.pressed) {
          playerState.direction = "left";
          playerState.velocityX = -room.settings.physics.playerSpeed;
        }
        break;

      case "move-right":
        if (inputData.pressed) {
          playerState.direction = "right";
          playerState.velocityX = room.settings.physics.playerSpeed;
        }
        break;

      case "jump":
        if (inputData.pressed && playerState.isOnGround) {
          playerState.isJumping = true;
          playerState.isOnGround = false;
          playerState.velocityY = -room.settings.physics.jumpPower; // Negative = up
        }
        break;

      case "stop":
        if (inputData.direction === "horizontal") {
          playerState.direction = "idle";
          playerState.velocityX = 0;
        }
        break;

      default:
        return { success: false, reason: "Unknown input action" };
    }

    // Update last update timestamp for 60fps sync
    room.lastUpdate = Date.now();

    return {
      success: true,
      player: player,
      playerKey: playerKey,
      playerState: playerState,
      room: room,
    };
  }

  // Ball physics engine
  updateBallPhysics(room, deltaTime) {
    const ball = room.gameState.ball;
    const physics = room.settings.physics;
    const field = room.settings.field;

    // Apply gravity
    ball.velocityY += physics.gravity * deltaTime;

    // Apply air resistance
    ball.velocityX *= physics.airResistance;
    ball.velocityY *= physics.airResistance;

    // Update ball position
    ball.x += ball.velocityX * deltaTime;
    ball.y += ball.velocityY * deltaTime;

    // Ground collision
    if (ball.y + ball.radius >= field.groundLevel) {
      ball.y = field.groundLevel - ball.radius;
      ball.velocityY = -ball.velocityY * physics.ballBounce; // Bounce with damping

      // Apply ground friction
      ball.velocityX *= physics.friction;
    }

    // Ceiling collision
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.velocityY = -ball.velocityY * physics.ballBounce;
    }

    // Wall collisions and goal detection
    const goalResult = this.checkGoalCollision(room, ball, field);
    if (goalResult.isGoal) {
      return goalResult;
    }

    // Side wall bounces (if not a goal)
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.velocityX = -ball.velocityX * physics.ballBounce;
    }
    if (ball.x + ball.radius >= field.width) {
      ball.x = field.width - ball.radius;
      ball.velocityX = -ball.velocityX * physics.ballBounce;
    }

    // Cap maximum velocity
    const maxVel = physics.maxVelocity;
    if (Math.abs(ball.velocityX) > maxVel) {
      ball.velocityX = Math.sign(ball.velocityX) * maxVel;
    }
    if (Math.abs(ball.velocityY) > maxVel) {
      ball.velocityY = Math.sign(ball.velocityY) * maxVel;
    }

    return { isGoal: false };
  }

  checkGoalCollision(room, ball, field) {
    const goalHeight = field.goalHeight;
    const goalY = field.groundLevel - goalHeight;

    // Left goal (player2 scores)
    if (ball.x - ball.radius <= 0) {
      if (ball.y >= goalY && ball.y <= field.groundLevel) {
        return this.handleGoal(room, "player2");
      }
    }

    // Right goal (player1 scores)
    if (ball.x + ball.radius >= field.width) {
      if (ball.y >= goalY && ball.y <= field.groundLevel) {
        return this.handleGoal(room, "player1");
      }
    }

    return { isGoal: false };
  }

  handleGoal(room, scoringPlayer) {
    // Update score
    room.gameState.score[scoringPlayer]++;

    // Record goal event
    const goalEvent = {
      type: "goal",
      player: scoringPlayer,
      time: room.settings.rules.matchDuration - room.gameState.gameTime,
      timestamp: Date.now(),
    };

    room.gameState.gameEvents.push(goalEvent);
    room.gameState.lastGoal = goalEvent;

    // Reset ball to center
    this.resetBallPosition(room);

    console.log(
      `GOAL! ${scoringPlayer} scored! Score: ${room.gameState.score.player1}-${room.gameState.score.player2}`
    );

    return {
      isGoal: true,
      scorer: scoringPlayer,
      newScore: room.gameState.score,
      goalEvent: goalEvent,
    };
  }

  resetBallPosition(room) {
    const field = room.settings.field;
    room.gameState.ball = {
      x: field.centerLine,
      y: 200, // Middle height
      velocityX: 0,
      velocityY: 0,
      radius: 15,
      lastTouchedBy: null,
      lastKickTime: {},
    };
  }

  // Player-ball collision detection
  checkPlayerBallCollisions(room, deltaTime) {
    const ball = room.gameState.ball;
    const players = room.gameState.players;

    // Check collision with both players
    ["player1", "player2"].forEach((playerKey) => {
      const player = players[playerKey];
      const collision = this.detectPlayerBallCollision(player, ball);

      if (collision.isColliding) {
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

  detectPlayerBallCollision(player, ball) {
    // Player dimensions - match visual representation (30px circles)
    const playerRadius = 15; // 30px diameter = 15px radius (like visual)

    // Calculate distance between player center and ball center
    const distanceX = player.x - ball.x;
    const distanceY = player.y - ball.y;
    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

    // Collision if distance is less than combined radii + small buffer
    const collisionDistance = playerRadius + ball.radius + 5; // 5px buffer for easier contact

    if (distance < collisionDistance) {
      // Determine collision direction
      const relativeX = ball.x - player.x;
      const relativeY = ball.y - player.y;

      return {
        isColliding: true,
        relativeX: relativeX,
        relativeY: relativeY,
        distance: distance,
      };
    }

    return { isColliding: false };
  }

  handlePlayerBallCollision(room, playerKey, player, ball, collision) {
    // Check if this player recently touched the ball (prevent spam)
    const currentTime = Date.now();
    if (!ball.lastKickTime) ball.lastKickTime = {};
    
    // 200ms cooldown per player to prevent continuous kicking
    if (ball.lastKickTime[playerKey] && currentTime - ball.lastKickTime[playerKey] < 200) {
      return;
    }

    // Check if ball was recently touched by opponent (for smooth player vs player)
    const otherPlayer = playerKey === "player1" ? "player2" : "player1";
    const recentOpponentTouch = ball.lastKickTime[otherPlayer] && 
                               currentTime - ball.lastKickTime[otherPlayer] < 300;

    // Calculate kick strength based on player movement
    let kickPower = Math.abs(player.velocityX) + Math.abs(player.velocityY) + 2;
    
    // If opponent recently touched ball, this is a tackle/steal
    if (recentOpponentTouch) {
      kickPower *= 1.2; // Stronger tackle
    }

    // Determine kick direction based on collision position
    const normalizedX = collision.relativeX / Math.max(Math.abs(collision.relativeX), 1);
    const normalizedY = collision.relativeY / Math.max(Math.abs(collision.relativeY), 1);
    
    let kickX = normalizedX * kickPower;
    let kickY = normalizedY * kickPower * 0.4; // Less vertical force

    // Add player's velocity to the kick (momentum transfer)
    kickX += player.velocityX * 0.8;
    kickY += player.velocityY * 0.4;

    // Apply kick to ball
    ball.velocityX = kickX;
    ball.velocityY = kickY;
    ball.lastTouchedBy = playerKey;
    ball.lastKickTime[playerKey] = currentTime;

    // Move ball away from player to prevent sticking
    const pushDistance = ball.radius + 15; // Increased separation
    const pushX = normalizedX * pushDistance;
    const pushY = normalizedY * pushDistance;
    
    ball.x += pushX;
    ball.y += pushY;

    // Ensure ball stays in bounds
    const field = room.settings.field;
    ball.x = Math.max(ball.radius, Math.min(field.width - ball.radius, ball.x));
    ball.y = Math.max(ball.radius, Math.min(field.groundLevel, ball.y));

    console.log(
      `${playerKey} ${recentOpponentTouch ? 'tackled' : 'kicked'} the ball! Velocity: (${kickX.toFixed(
        1
      )}, ${kickY.toFixed(1)})`
    );
  }

  // Player physics update
  updatePlayerPhysics(room, deltaTime) {
    const physics = room.settings.physics;
    const field = room.settings.field;

    ["player1", "player2"].forEach((playerKey) => {
      const player = room.gameState.players[playerKey];

      // Apply gravity to players
      if (!player.isOnGround) {
        player.velocityY += physics.gravity * deltaTime;
      }

      // Update player position
      player.x += player.velocityX * deltaTime;
      player.y += player.velocityY * deltaTime;

      // Ground collision for players
      if (player.y >= field.groundLevel) {
        player.y = field.groundLevel;
        player.velocityY = 0;
        player.isOnGround = true;
        player.isJumping = false;
      }

      // Keep players within field bounds (using same radius as collision detection)
      const playerRadius = 15;
      if (player.x - playerRadius < 0) {
        player.x = playerRadius;
      }
      if (player.x + playerRadius > field.width) {
        player.x = field.width - playerRadius;
      }

      // Apply friction when on ground
      if (player.isOnGround) {
        player.velocityX *= physics.friction;
      }
    });
  }

  // Main physics update (60fps)
  updateGamePhysics(roomId, deltaTime = 16.67) {
    // ~60fps = 16.67ms
    const room = this.getRoom(roomId);
    if (!room || !room.gameState.isActive) {
      return { success: false, reason: "No active game" };
    }

    // Convert deltaTime from milliseconds to a normalized factor
    const timeFactor = deltaTime / 16.67; // Normalize to 60fps

    // Update player physics
    this.updatePlayerPhysics(room, timeFactor);

    // Update ball physics
    const ballResult = this.updateBallPhysics(room, timeFactor);

    // Check player-ball collisions
    this.checkPlayerBallCollisions(room, timeFactor);

    // Update game time (countdown)
    room.gameState.gameTime -= deltaTime / 1000; // Convert ms to seconds

    // Check if game should end
    if (room.gameState.gameTime <= 0) {
      return this.endGameByTime(room);
    }

    // Update last update timestamp
    room.lastUpdate = Date.now();

    return {
      success: true,
      room: room,
      ballResult: ballResult,
      gameState: {
        players: room.gameState.players,
        ball: room.gameState.ball,
        score: room.gameState.score,
        gameTime: room.gameState.gameTime,
        isActive: room.gameState.isActive,
      },
    };
  }

  endGameByTime(room) {
    room.status = "finished";
    room.gameState.isActive = false;
    room.endedAt = new Date();

    const score = room.gameState.score;
    let winner = null;
    let result = "draw";

    if (score.player1 > score.player2) {
      winner = "player1";
      result = "player1_wins";
    } else if (score.player2 > score.player1) {
      winner = "player2";
      result = "player2_wins";
    }

    console.log(
      `Game ended by time! Final score: ${score.player1}-${score.player2} (${result})`
    );

    return {
      success: true,
      gameEnded: true,
      winner: winner,
      result: result,
      finalScore: score,
      room: room,
    };
  }

  generateRoomId() {
    return `room-${Math.random().toString(36).substring(2, 9)}`;
  }

  getGameStats() {
    return {
      totalPlayers: this.connectedPlayers.size,
      activeRooms: this.gameRooms.size,
      waitingPlayers: this.waitingPlayers.size,
      playingPlayers: Array.from(this.gameRooms.values())
        .filter((room) => room.status === "playing")
        .reduce((count, room) => count + room.players.length, 0),
    };
  }

  startGameLoopCoordinator() {
    // Check for active games every 100ms and ensure they have game loops
    setInterval(() => {
      this.gameRooms.forEach((room, roomId) => {
        if (room.gameState.isActive && !this.gameLoops.has(roomId)) {
          this.startGameLoop(roomId);
        }
        if (!room.gameState.isActive && this.gameLoops.has(roomId)) {
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

    console.log(`Starting 60fps game loop for room ${roomId}`);

    let lastTime = Date.now();

    const gameLoop = setInterval(() => {
      const currentTime = Date.now();
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Update game physics
      const result = this.updateGamePhysics(roomId, deltaTime);

      if (result.success) {
        // Handle special events (goals, game end)
        if (result.ballResult && result.ballResult.isGoal) {
          this.broadcastGoalEvent(roomId, result.ballResult);
        }

        if (result.gameEnded) {
          this.broadcastGameEnd(roomId, result);
          this.stopGameLoop(roomId);
        } else {
          // Only broadcast game state if game is still active
          this.broadcastGameState(roomId, result);
        }
      } else {
        // Game no longer active, stop loop
        this.stopGameLoop(roomId);
      }
    }, 16.67); // ~60fps (16.67ms intervals)

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

  // Real-time broadcasting
  broadcastGameState(roomId, updateResult) {
    if (!this.socketIO || !updateResult || !updateResult.gameState) {
      return;
    }

    const room = updateResult.room;
    const gameState = updateResult.gameState;

    // Validate gameState structure
    if (!gameState.players || !gameState.players.player1 || !gameState.players.player2 || !gameState.ball) {
      console.warn(`Invalid gameState structure for room ${roomId}`);
      return;
    }

    // Prepare optimized game state for frontend
    const broadcastData = {
      type: "game-state-update",
      roomId: roomId,
      timestamp: Date.now(),
      gameState: {
        players: {
          player1: {
            x: Math.round(gameState.players.player1.x * 10) / 10, // Round to 1 decimal
            y: Math.round(gameState.players.player1.y * 10) / 10,
            velocityX:
              Math.round(gameState.players.player1.velocityX * 10) / 10,
            velocityY:
              Math.round(gameState.players.player1.velocityY * 10) / 10,
            direction: gameState.players.player1.direction,
            isJumping: gameState.players.player1.isJumping,
            isOnGround: gameState.players.player1.isOnGround,
          },
          player2: {
            x: Math.round(gameState.players.player2.x * 10) / 10,
            y: Math.round(gameState.players.player2.y * 10) / 10,
            velocityX:
              Math.round(gameState.players.player2.velocityX * 10) / 10,
            velocityY:
              Math.round(gameState.players.player2.velocityY * 10) / 10,
            direction: gameState.players.player2.direction,
            isJumping: gameState.players.player2.isJumping,
            isOnGround: gameState.players.player2.isOnGround,
          },
        },
        ball: {
          x: Math.round(gameState.ball.x * 10) / 10,
          y: Math.round(gameState.ball.y * 10) / 10,
          velocityX: Math.round(gameState.ball.velocityX * 10) / 10,
          velocityY: Math.round(gameState.ball.velocityY * 10) / 10,
          lastTouchedBy: gameState.ball.lastTouchedBy,
        },
        score: gameState.score,
        gameTime: Math.round(gameState.gameTime * 10) / 10,
        isActive: gameState.isActive,
      },
    };

    // Broadcast to all players in the room
    this.socketIO.to(roomId).emit("game-state-update", broadcastData);
  }

  broadcastGoalEvent(roomId, goalResult) {
    if (!this.socketIO) return;

    const goalData = {
      type: "goal-scored",
      roomId: roomId,
      timestamp: Date.now(),
      scorer: goalResult.scorer,
      newScore: goalResult.newScore,
      goalEvent: goalResult.goalEvent,
    };

    console.log(`Broadcasting goal event to room ${roomId}:`, goalData);
    this.socketIO.to(roomId).emit("goal-scored", goalData);

    // Pause game briefly for goal celebration
    setTimeout(() => {
      if (this.socketIO) {
        this.socketIO.to(roomId).emit("goal-celebration-end", {
          roomId: roomId,
          timestamp: Date.now(),
        });
      }
    }, 2000); // 2 second pause
  }

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

    console.log(`Broadcasting game end to room ${roomId}:`, endData);
    this.socketIO.to(roomId).emit("game-ended", endData);
  }

  // Enhanced game start with loop
  startRoomGameWithLoop(room) {
    const startResult = this.startRoomGame(room);

    if (startResult.success) {
      // Initialize proper player positions for 2D game
      room.gameState.players.player1.x = 150;
      room.gameState.players.player1.y = 320;
      room.gameState.players.player2.x = 650;
      room.gameState.players.player2.y = 320;

      // Reset ball to center
      this.resetBallPosition(room);

      // Game loop will be started automatically by coordinator
      console.log(`Game started in room ${room.id} with 60fps physics loop`);
    }

    return startResult;
  }

  // Set Socket.IO instance for broadcasting
  setSocketIO(io) {
    this.socketIO = io;
  }

  // HACKATHON RAPID FIXES - Missing API methods
  async getLiveGameStats() {
    return {
      totalPlayers: this.connectedPlayers.size,
      activeRooms: this.gameRooms.size,
      waitingPlayers: this.waitingPlayers.size,
      playingPlayers: Array.from(this.gameRooms.values())
        .filter((room) => room.status === "playing")
        .reduce((count, room) => count + room.players.length, 0),
      serverUptime: process.uptime(),
      timestamp: Date.now()
    };
  }

  async getMatchHistory({ page = 1, limit = 20, playerId }) {
    // For hackathon - return mock data for now
    const mockMatches = [
      {
        id: "match-1",
        players: ["Player1", "Player2"],
        score: { player1: 2, player2: 1 },
        duration: 120,
        winner: "Player1",
        timestamp: Date.now() - 3600000
      },
      {
        id: "match-2", 
        players: ["Player3", "Player4"],
        score: { player1: 0, player2: 3 },
        duration: 85,
        winner: "Player4",
        timestamp: Date.now() - 7200000
      }
    ];

    return {
      matches: mockMatches.slice((page - 1) * limit, page * limit),
      total: mockMatches.length
    };
  }

  async joinSpecificRoom(playerId, roomId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    if (room.players.length >= room.maxPlayers) {
      return { success: false, reason: "Room is full" };
    }

    const result = this.addPlayerToRoom(room, player);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      room: room.toJSON(),
      player: player.toJSON()
    };
  }

  async leaveSpecificRoom(playerId, roomId) {
    const player = this.getPlayer(playerId);
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    const result = this.removePlayerFromRoom(room, playerId);
    if (!result.success) {
      return result;
    }

    // Clean up empty room
    if (result.isEmpty) {
      this.deleteRoom(roomId);
    }

    return {
      success: true,
      message: "Left room successfully"
    };
  }
}

module.exports = new GameService();
