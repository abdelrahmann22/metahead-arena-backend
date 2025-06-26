/**
 * MetaHead Arena - Complete Socket Events Demo
 * Comprehensive testing interface for all backend socket events
 */

class SocketEventDemo {
  constructor() {
    // Connection State
    this.socket = null;
    this.isConnected = false;
    this.playerId = null;
    this.serverTime = null;

    // Player State
    this.walletAddress = null;
    this.username = "Anonymous";
    this.isInGame = false;

    // Room State
    this.roomId = null;
    this.roomCode = null;
    this.roomType = null;
    this.gameMode = "1v1";
    this.isReady = false;
    this.playersInRoom = [];
    this.playerPosition = null; // "player1" or "player2"
    this.isBallAuthority = false; // Whether this player is responsible for ball physics

    // Game State
    this.gameActive = false;
    this.score = { player1: 0, player2: 0 };
    this.gameTime = 60;
    this.matchId = null;

    // Physics State (Frontend-managed)
    this.players = {
      player1: {
        x: 150,
        y: 320,
        velocityX: 0,
        velocityY: 0,
        isOnGround: true,
        direction: "idle",
      },
      player2: {
        x: 650,
        y: 320,
        velocityX: 0,
        velocityY: 0,
        isOnGround: true,
        direction: "idle",
      },
    };
    this.ball = { x: 400, y: 300, velocityX: 0, velocityY: 0 };

    // Input State
    this.input = { left: false, right: false };
    this.keys = {};

    // Physics Constants
    this.physics = {
      gravity: 0.5,
      friction: 0.88,
      airResistance: 0.99,
      ballBounce: 0.75,
      playerSpeed: 4,
      jumpPower: 12,
      groundLevel: 320,
    };

    // Event Monitoring
    this.autoScroll = true;
    this.eventCount = 0;

    // Game Loop
    this.gameLoop = null;

    // Match History
    this.matchHistory = [];

    // Rematch State
    this.rematchRequested = false;
    this.rematchState = null;

    this.init();
  }

  init() {
    this.connectSocket();
    this.setupEventListeners();
    this.setupKeyboardControls();
    this.startGameLoop();
    this.logEvent("info", "Complete Socket Events Demo initialized");
    this.logEvent(
      "info",
      "Open multiple browser tabs to test multiplayer functionality"
    );
  }

  // ============ SOCKET CONNECTION & EVENT HANDLERS ============

  connectSocket() {
    this.socket = io();

    // === Connection Events ===
    this.socket.on("connect", () => {
      this.isConnected = true;
      this.updateConnectionStatus("Connected", true);
      this.logEvent(
        "success",
        `Connected to server with socket ID: ${this.socket.id}`
      );
      this.enableButton("joinGameBtn");
    });

    this.socket.on("disconnect", (reason) => {
      this.isConnected = false;
      this.updateConnectionStatus("Disconnected", false);
      this.logEvent("error", `Disconnected from server: ${reason}`);
      this.resetGameState();
    });

    this.socket.on("welcome", (data) => {
      this.playerId = data.playerId;
      this.serverTime = new Date(data.serverTime);
      this.updatePlayerInfo("playerId", data.playerId);
      this.updatePlayerInfo("serverTime", this.formatTime(this.serverTime));
      this.logEvent("socket", `Welcome message received`, data);
    });

    // === Player Events ===
    this.socket.on("player-created", (data) => {
      this.logEvent("success", `Player created: ${data.player.username}`, data);
      if (data.user) {
        this.updatePlayerInfo(
          "username",
          data.user.walletAddress.slice(0, 6) + "..."
        );
      }
    });

    this.socket.on("game-status", (data) => {
      this.logEvent("info", "Game status updated", data);
      this.updateStats(data);
    });

    // === Room Events ===
    this.socket.on("room-created", (data) => {
      this.handleRoomJoined(data);
      this.logEvent("success", `Room created: ${data.roomCode}`, data);
    });

    this.socket.on("room-joined", (data) => {
      this.handleRoomJoined(data);
      this.logEvent("success", `Joined room: ${data.roomCode}`, data);
    });

    this.socket.on("player-joined-room", (data) => {
      this.updatePlayersInRoom();
      this.logEvent(
        "info",
        `Player joined room: ${data.player.username}`,
        data
      );
      this.showGameOverlay(
        "Player Joined",
        `${data.player.username} joined the room`
      );
    });

    this.socket.on("room-full", (data) => {
      this.logEvent("warning", "Room is full - ready up to start!", data);
      this.showGameOverlay("Room Full", "Ready up to start the match!");
    });

    this.socket.on("left-room", (data) => {
      this.handleRoomLeft();
      this.logEvent("info", `Left room: ${data.roomId}`, data);
    });

    this.socket.on("player-left", (data) => {
      this.updatePlayersInRoom();
      this.logEvent("warning", `Player left: ${data.username}`, data);
      this.showGameOverlay("Player Left", `${data.username} left the room`);
    });

    // === Game Events ===
    this.socket.on("player-ready", (data) => {
      this.handlePlayerReady(data);
      this.logEvent(
        "info",
        `Player ready: ${data.username} (${
          data.isReady ? "ready" : "not ready"
        })`,
        data
      );
    });

    this.socket.on("game-started", (data) => {
      this.handleGameStarted(data);
      this.logEvent("success", "Game started!", data);
    });

    this.socket.on("match-ended", (data) => {
      this.handleMatchEnded(data);
      this.logEvent("success", `Match ended - Winner: ${data.winner}`, data);
    });

    this.socket.on("goal-scored", (data) => {
      this.handleGoalScored(data);
      this.logEvent("success", `Goal scored by ${data.scorer}!`, data);
    });

    // === Input Events ===
    this.socket.on("player-input", (data) => {
      this.handleRemotePlayerInput(data);
      this.logEvent(
        "socket",
        `Input from ${data.username}: ${data.action}`,
        data
      );
    });

    // === Ball Synchronization Events ===
    this.socket.on("ball-state", (data) => {
      this.handleBallStateUpdate(data);
    });

    // === Player Position Synchronization Events ===
    this.socket.on("player-position", (data) => {
      this.handlePlayerPositionUpdate(data);
    });

    // === Rematch Events ===
    this.socket.on("rematch-request", (data) => {
      this.handleRematchRequest(data);
      this.logEvent("info", "Rematch requested", data);
    });

    this.socket.on("rematch-confirmed", (data) => {
      this.handleRematchConfirmed(data);
      this.logEvent("success", "Rematch confirmed - starting new game!", data);
    });

    this.socket.on("rematch-declined", (data) => {
      this.handleRematchDeclined(data);
      this.logEvent("warning", "Rematch declined", data);
    });

    // === Error Events ===
    this.socket.on("error", (data) => {
      this.logEvent("error", data.message, data);
      this.showToast(data.message, "error");
    });
  }

  // ============ EVENT HANDLERS ============

  handleRoomJoined(data) {
    this.roomId = data.roomId;
    this.roomCode = data.roomCode;
    this.roomType = data.roomType;
    this.gameMode = data.gameMode;
    this.playersInRoom = data.players || [];

    this.updateRoomInfo();
    this.enableButton("toggleReadyBtn");
    this.enableButton("leaveRoomBtn");

    // Determine player position
    const thisPlayer = this.playersInRoom.find((p) => p.id === this.playerId);
    if (thisPlayer) {
      this.playerPosition = thisPlayer.position;
      this.isBallAuthority = this.playerPosition === "player1"; // Player 1 is ball authority
      this.logEvent("info", `You are ${this.playerPosition}`);
      if (this.isBallAuthority) {
        this.logEvent(
          "info",
          "You are the ball authority - managing ball physics"
        );
      }
    }

    this.showGameOverlay("Room Joined", "Ready up when you're ready to play!");
  }

  handleRoomLeft() {
    this.roomId = null;
    this.roomCode = null;
    this.roomType = null;
    this.isReady = false;
    this.playersInRoom = [];
    this.playerPosition = null;
    this.isBallAuthority = false; // Reset ball authority

    this.updateRoomInfo();
    this.updateReadyStatus();
    this.disableButton("toggleReadyBtn");
    this.disableButton("leaveRoomBtn");

    this.showGameOverlay("Left Room", "Join or create a room to play");
  }

  handlePlayerReady(data) {
    if (data.playerId === this.playerId) {
      this.isReady = data.isReady;
      this.updateReadyStatus();
    }

    if (data.allPlayersReady) {
      this.showGameOverlay("All Ready", "Game starting...");
    }
  }

  handleGameStarted(data) {
    this.gameActive = true;
    this.gameTime = data.matchDuration || 60;
    this.matchId = data.room.matchId;

    // Reset broadcast counters for fresh synchronization
    this.ballBroadcastCounter = 0;
    this.playerBroadcastCounter = 0;

    this.setGameMode(true);
    this.hideGameOverlay();
    this.disableButton("toggleReadyBtn");

    this.showToast("Game Started!", "success");
  }

  handleMatchEnded(data) {
    this.gameActive = false;
    this.score = data.finalScore;
    this.matchId = data.matchId;

    // Add to match history
    this.addToMatchHistory({
      score: data.finalScore,
      duration: data.duration,
      winner: data.winner,
      timestamp: new Date(),
    });

    this.setGameMode(false);
    this.showRematchPanel(data);
    this.enableButton("toggleReadyBtn");
  }

  handleGoalScored(data) {
    this.score = data.newScore || data.score;
    this.updateScoreDisplay();
    this.resetPositions();
    this.celebrateGoal(data.scorer);
  }

  handleRematchRequest(data) {
    this.rematchState = data.rematchState;
    this.updateRematchStatus(`${data.player.username} wants a rematch!`);
  }

  handleRematchConfirmed(data) {
    this.hideRematchPanel();
    this.resetGameState();
    this.showGameOverlay("Rematch Starting", "Get ready for round 2!");
    this.updateRematchStatus("");
  }

  handleRematchDeclined(data) {
    this.updateRematchStatus(`${data.player.username} declined the rematch`);
    setTimeout(() => {
      this.handleRoomLeft();
    }, 3000);
  }

  handleRemotePlayerInput(data) {
    // This method is no longer used for physics - kept for compatibility
    // Position synchronization now happens through handlePlayerPositionUpdate()
    return;
  }

  handlePlayerPositionUpdate(data) {
    // Only update remote player positions, not our own
    if (
      !data.position ||
      data.position === this.playerPosition ||
      !this.gameActive
    ) {
      return;
    }

    const remotePlayer = this.players[data.position];
    if (!remotePlayer) return;

    // Apply received position with interpolation to smooth network jitter
    const lerpFactor = 0.7; // How much to trust the received state vs current state

    remotePlayer.x =
      remotePlayer.x * (1 - lerpFactor) + data.player.x * lerpFactor;
    remotePlayer.y =
      remotePlayer.y * (1 - lerpFactor) + data.player.y * lerpFactor;
    remotePlayer.velocityX =
      remotePlayer.velocityX * (1 - lerpFactor) +
      data.player.velocityX * lerpFactor;
    remotePlayer.velocityY =
      remotePlayer.velocityY * (1 - lerpFactor) +
      data.player.velocityY * lerpFactor;
    remotePlayer.direction = data.player.direction;
    remotePlayer.isOnGround = data.player.isOnGround;
  }

  handleBallStateUpdate(data) {
    // Only non-authority players should receive and apply ball state updates
    if (this.isBallAuthority || !this.gameActive) return;

    // Apply received ball state with some interpolation to smooth out network jitter
    const lerpFactor = 0.8; // How much to trust the received state vs current state

    this.ball.x = this.ball.x * (1 - lerpFactor) + data.ball.x * lerpFactor;
    this.ball.y = this.ball.y * (1 - lerpFactor) + data.ball.y * lerpFactor;
    this.ball.velocityX =
      this.ball.velocityX * (1 - lerpFactor) + data.ball.velocityX * lerpFactor;
    this.ball.velocityY =
      this.ball.velocityY * (1 - lerpFactor) + data.ball.velocityY * lerpFactor;
  }

  // ============ FRONTEND PHYSICS ENGINE ============

  startGameLoop() {
    this.gameLoop = setInterval(() => {
      if (this.gameActive) {
        this.updatePhysics();

        // Only ball authority handles collisions to avoid conflicts
        if (this.isBallAuthority) {
          this.checkCollisions();
        }

        this.updateTimer();
      }
      this.renderGame();
    }, 16); // 60 FPS
  }

  updatePhysics() {
    // Each player only updates their own physics
    if (this.playerPosition) {
      this.updatePlayerPhysics(this.playerPosition);
      this.broadcastPlayerPosition();
    }

    // Only the ball authority updates ball physics
    if (this.isBallAuthority) {
      this.updateBallPhysics();
      this.broadcastBallState();
    }
  }

  updatePlayerPhysics(playerKey) {
    const player = this.players[playerKey];

    // Apply gravity
    if (!player.isOnGround) {
      player.velocityY += this.physics.gravity;
    }

    // Apply movement input
    if (this.input.left) {
      player.velocityX = -this.physics.playerSpeed;
      player.direction = "left";
    } else if (this.input.right) {
      player.velocityX = this.physics.playerSpeed;
      player.direction = "right";
    } else {
      player.velocityX *= this.physics.friction;
      player.direction = "idle";
    }

    // Apply air resistance
    player.velocityX *= this.physics.airResistance;
    player.velocityY *= this.physics.airResistance;

    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;

    // Ground collision
    if (player.y >= this.physics.groundLevel) {
      player.y = this.physics.groundLevel;
      player.velocityY = 0;
      player.isOnGround = true;
    } else {
      player.isOnGround = false;
    }

    // Wall boundaries
    if (player.x < 25) player.x = 25;
    if (player.x > 775) player.x = 775;
  }

  updateBallPhysics() {
    // Apply gravity
    this.ball.velocityY += this.physics.gravity;

    // Apply air resistance
    this.ball.velocityX *= this.physics.airResistance;
    this.ball.velocityY *= this.physics.airResistance;

    // Update position
    this.ball.x += this.ball.velocityX;
    this.ball.y += this.ball.velocityY;

    // Ground collision
    if (this.ball.y >= this.physics.groundLevel + 15) {
      this.ball.y = this.physics.groundLevel + 15;
      this.ball.velocityY *= -this.physics.ballBounce;
      this.ball.velocityX *= this.physics.friction;
    }

    // Wall collisions
    if (this.ball.x <= 15) {
      this.ball.x = 15;
      this.ball.velocityX *= -0.8;
    }
    if (this.ball.x >= 785) {
      this.ball.x = 785;
      this.ball.velocityX *= -0.8;
    }

    // Ceiling collision
    if (this.ball.y <= 15) {
      this.ball.y = 15;
      this.ball.velocityY *= -this.physics.ballBounce;
    }
  }

  checkCollisions() {
    // Player-ball collisions
    ["player1", "player2"].forEach((playerKey) => {
      const player = this.players[playerKey];
      const dx = player.x - this.ball.x;
      const dy = player.y - this.ball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 35) {
        const kickPower = 8;
        const normalizedX = dx / distance;
        const normalizedY = dy / distance;

        this.ball.velocityX = -normalizedX * kickPower;
        this.ball.velocityY = -normalizedY * kickPower * 0.7;

        this.ball.x -= normalizedX * 30;
        this.ball.y -= normalizedY * 30;
      }
    });

    this.checkGoals();
  }

  checkGoals() {
    // Left goal (player2 scores)
    if (this.ball.x <= 0 && this.ball.y >= 250 && this.ball.y <= 390) {
      this.handleLocalGoal("player2");
    }
    // Right goal (player1 scores)
    if (this.ball.x >= 800 && this.ball.y >= 250 && this.ball.y <= 390) {
      this.handleLocalGoal("player1");
    }
  }

  handleLocalGoal(scorer) {
    this.logEvent("success", `Local goal detected: ${scorer} scored!`);
    this.socket.emit("goal-scored", { scorer: scorer });
    this.resetPositions();
  }

  resetPositions() {
    this.players.player1 = {
      x: 150,
      y: 320,
      velocityX: 0,
      velocityY: 0,
      isOnGround: true,
      direction: "idle",
    };
    this.players.player2 = {
      x: 650,
      y: 320,
      velocityX: 0,
      velocityY: 0,
      isOnGround: true,
      direction: "idle",
    };
    this.ball = { x: 400, y: 250, velocityX: 0, velocityY: 0 };
  }

  updateTimer() {
    this.gameTime -= 0.016;
    if (this.gameTime <= 0) {
      this.gameTime = 0;
      this.endGame();
    }
  }

  endGame() {
    if (!this.gameActive) return;

    this.gameActive = false;
    let winner = "draw";
    if (this.score.player1 > this.score.player2) winner = "player1";
    if (this.score.player2 > this.score.player1) winner = "player2";

    this.socket.emit("game-end", {
      finalScore: this.score,
      duration: 60 - this.gameTime,
      winner: winner,
    });

    this.logEvent("success", `Time's up! Winner: ${winner}`);
  }

  renderGame() {
    // Update score display
    this.updateScoreDisplay();

    // Update timer
    const minutes = Math.floor(this.gameTime / 60);
    const seconds = Math.floor(this.gameTime % 60);
    this.updateElement(
      "gameTime",
      `${minutes}:${seconds.toString().padStart(2, "0")}`
    );

    // Update sprite positions
    this.updateSpritePosition("player1Sprite", this.players.player1);
    this.updateSpritePosition("player2Sprite", this.players.player2);
    this.updateSpritePosition("ballSprite", this.ball, true);
  }

  updateSpritePosition(elementId, object, isBall = false) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.style.left = `${object.x}px`;
    element.style.bottom = `${600 - object.y}px`;

    if (!isBall && object.direction) {
      element.className = element.className.replace(/(left|right|idle)/g, "");
      element.classList.add(object.direction);
    }
  }

  // ============ INPUT HANDLING ============

  setupKeyboardControls() {
    document.addEventListener("keydown", (e) => {
      if (!this.gameActive || !this.playerPosition) return;

      const key = e.key.toLowerCase();
      if (this.keys[key]) return;
      this.keys[key] = true;

      let inputSent = false;

      switch (key) {
        case "a":
        case "arrowleft":
          this.input.left = true;
          this.sendInput("move-left", { pressed: true });
          inputSent = true;
          break;
        case "d":
        case "arrowright":
          this.input.right = true;
          this.sendInput("move-right", { pressed: true });
          inputSent = true;
          break;
        case "w":
        case "arrowup":
        case " ":
          if (this.players[this.playerPosition].isOnGround) {
            this.players[this.playerPosition].velocityY =
              -this.physics.jumpPower;
            this.players[this.playerPosition].isOnGround = false;
            this.sendInput("jump", { pressed: true });
            inputSent = true;
          }
          break;
        case "s":
        case "arrowdown":
          this.sendInput("kick", { pressed: true });
          inputSent = true;
          break;
      }

      if (inputSent) e.preventDefault();
    });

    document.addEventListener("keyup", (e) => {
      if (!this.gameActive || !this.playerPosition) return;

      const key = e.key.toLowerCase();
      this.keys[key] = false;

      switch (key) {
        case "a":
        case "arrowleft":
          this.input.left = false;
          this.sendInput("move-left", { pressed: false });
          break;
        case "d":
        case "arrowright":
          this.input.right = false;
          this.sendInput("move-right", { pressed: false });
          break;
      }
    });
  }

  sendInput(action, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(action, data);
    }
  }

  broadcastBallState() {
    // Only broadcast if we're the ball authority and connected
    if (
      !this.isBallAuthority ||
      !this.socket ||
      !this.isConnected ||
      !this.gameActive
    ) {
      return;
    }

    // Throttle ball state broadcasts to avoid spam (every 2nd frame)
    if (!this.ballBroadcastCounter) this.ballBroadcastCounter = 0;
    this.ballBroadcastCounter++;

    if (this.ballBroadcastCounter % 2 !== 0) return;

    this.socket.emit("ball-state", {
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        velocityX: this.ball.velocityX,
        velocityY: this.ball.velocityY,
      },
      timestamp: Date.now(),
    });
  }

  broadcastPlayerPosition() {
    // Only broadcast if we have a position and are connected
    if (
      !this.playerPosition ||
      !this.socket ||
      !this.isConnected ||
      !this.gameActive
    ) {
      return;
    }

    // Throttle player position broadcasts to avoid spam (every 3rd frame)
    if (!this.playerBroadcastCounter) this.playerBroadcastCounter = 0;
    this.playerBroadcastCounter++;

    if (this.playerBroadcastCounter % 3 !== 0) return;

    const player = this.players[this.playerPosition];

    this.socket.emit("player-position", {
      position: this.playerPosition,
      player: {
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        direction: player.direction,
        isOnGround: player.isOnGround,
      },
      timestamp: Date.now(),
    });
  }

  // ============ UI EVENT HANDLERS ============

  setupEventListeners() {
    // Connection actions
    this.addClickListener("connectWalletBtn", () => this.connectWallet());
    this.addClickListener("joinGameBtn", () => this.joinGame());

    // Room management
    this.addClickListener("findMatchBtn", () => this.findMatch());
    this.addClickListener("createRoomBtn", () => this.createRoom());
    this.addClickListener("joinByCodeBtn", () => this.joinRoomByCode());
    this.addClickListener("toggleReadyBtn", () => this.toggleReady());
    this.addClickListener("leaveRoomBtn", () => this.leaveRoom());

    // Game controls
    this.addClickListener("goalPlayer1Btn", () => this.testGoal("player1"));
    this.addClickListener("goalPlayer2Btn", () => this.testGoal("player2"));
    this.addClickListener("endGameBtn", () => this.endGame());

    // Rematch controls
    this.addClickListener("requestRematchBtn", () => this.requestRematch());
    this.addClickListener("declineRematchBtn", () => this.declineRematch());

    // Monitor controls
    this.addClickListener("clearLogsBtn", () => this.clearLogs());
    this.addClickListener("toggleAutoScrollBtn", () => this.toggleAutoScroll());
  }

  addClickListener(elementId, callback) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener("click", callback);
    }
  }

  // ============ ACTION METHODS ============

  connectWallet() {
    // Simulate wallet connection - generate valid 40-character hex address
    let hexString = "";
    for (let i = 0; i < 40; i++) {
      hexString += Math.floor(Math.random() * 16).toString(16);
    }
    this.walletAddress = "0x" + hexString;

    this.updatePlayerInfo(
      "walletAddress",
      this.walletAddress.slice(0, 6) + "..." + this.walletAddress.slice(-4)
    );
    this.toggleButtonState("connectWalletBtn", true, "Connected");
    this.logEvent("success", `Wallet connected: ${this.walletAddress}`);
  }

  joinGame() {
    if (!this.walletAddress) {
      this.showToast("Please connect wallet first", "error");
      return;
    }

    this.socket.emit("join-game", {
      walletAddress: this.walletAddress,
    });

    this.logEvent("socket", "Joining game...");
  }

  findMatch() {
    this.socket.emit("find-match");
    this.logEvent("socket", "Finding match...");
    this.showToast("Looking for opponent...", "info");
  }

  createRoom() {
    this.socket.emit("create-room");
    this.logEvent("socket", "Creating room...");
  }

  joinRoomByCode() {
    const roomCode = document.getElementById("roomCodeInput").value.trim();
    if (!roomCode) {
      this.showToast("Please enter a room code", "error");
      return;
    }

    this.socket.emit("join-room-by-code", { roomCode });
    this.logEvent("socket", `Attempting to join room: ${roomCode}`);
  }

  toggleReady() {
    this.socket.emit("player-ready");
    this.logEvent("socket", "Toggling ready status...");
  }

  leaveRoom() {
    this.socket.emit("leave-room");
    this.logEvent("socket", "Leaving room...");
  }

  testGoal(scorer) {
    if (!this.gameActive) {
      this.showToast("Game must be active to score goals", "warning");
      return;
    }

    this.socket.emit("goal-scored", { scorer });
    this.logEvent("socket", `Test goal: ${scorer} scored!`);
  }

  requestRematch() {
    this.socket.emit("request-rematch");
    this.rematchRequested = true;
    this.updateRematchStatus("Rematch request sent...");
    this.logEvent("socket", "Requesting rematch...");
  }

  declineRematch() {
    this.socket.emit("decline-rematch");
    this.updateRematchStatus("Rematch declined");
    this.logEvent("socket", "Declining rematch...");
  }

  clearLogs() {
    const eventLog = document.getElementById("eventLog");
    eventLog.innerHTML =
      '<div class="log-entry info"><span class="timestamp">[' +
      this.formatTime(new Date()) +
      ']</span><span class="event-type info">[INFO]</span><span class="message">Event log cleared</span></div>';
    this.eventCount = 1;
  }

  toggleAutoScroll() {
    this.autoScroll = !this.autoScroll;
    const btn = document.getElementById("toggleAutoScrollBtn");
    btn.innerHTML = this.autoScroll
      ? '<i class="fas fa-arrow-down"></i> Auto-scroll'
      : '<i class="fas fa-pause"></i> Manual';
    this.logEvent(
      "info",
      `Auto-scroll ${this.autoScroll ? "enabled" : "disabled"}`
    );
  }

  // ============ UI UPDATE METHODS ============

  updateConnectionStatus(status, connected) {
    this.updateElement("connectionStatus", status);
    const statusDot = document.getElementById("statusDot");
    if (statusDot) {
      statusDot.className = connected ? "status-dot connected" : "status-dot";
    }
  }

  updatePlayerInfo(field, value) {
    this.updateElement(field, value);
  }

  updateRoomInfo() {
    this.updateElement("roomId", this.roomId || "None");
    this.updateElement("roomCode", this.roomCode || "None");
    this.updateElement("roomType", this.roomType || "None");
    this.updateElement("gameMode", this.gameMode);
    this.updateElement("playersInRoom", `${this.playersInRoom.length}/2`);
  }

  updateReadyStatus() {
    const statusElement = document.getElementById("readyStatus");
    const readyBtn = document.getElementById("toggleReadyBtn");

    if (statusElement) {
      statusElement.textContent = this.isReady ? "Ready" : "Not Ready";
      statusElement.className = this.isReady
        ? "status-badge ready"
        : "status-badge not-ready";
    }

    if (readyBtn) {
      readyBtn.innerHTML = this.isReady
        ? '<i class="fas fa-times"></i> Unready'
        : '<i class="fas fa-check-circle"></i> Ready Up!';
      readyBtn.className = this.isReady ? "btn btn-warning" : "btn btn-success";
    }
  }

  updateScoreDisplay() {
    this.updateElement("player1Score", this.score.player1);
    this.updateElement("player2Score", this.score.player2);
  }

  updatePlayersInRoom() {
    this.updateElement("playersInRoom", `${this.playersInRoom.length}/2`);
  }

  updateStats(stats) {
    if (stats.totalPlayers !== undefined)
      this.updateElement("totalPlayers", stats.totalPlayers);
    if (stats.activeRooms !== undefined)
      this.updateElement("activeRooms", stats.activeRooms);
    if (stats.memoryUsage !== undefined)
      this.updateElement("memoryUsage", stats.memoryUsage);
  }

  setGameMode(active) {
    const gameField = document.getElementById("gameField");
    if (gameField) {
      gameField.className = active ? "game-field active" : "game-field";
    }

    // Enable/disable game controls
    const gameControls = ["goalPlayer1Btn", "goalPlayer2Btn", "endGameBtn"];
    gameControls.forEach((id) => {
      const element = document.getElementById(id);
      if (element) element.disabled = !active;
    });
  }

  showGameOverlay(title, message) {
    const overlay = document.getElementById("gameOverlay");
    const titleEl = document.getElementById("overlayTitle");
    const messageEl = document.getElementById("overlayMessage");

    if (overlay && titleEl && messageEl) {
      titleEl.textContent = title;
      messageEl.textContent = message;
      overlay.classList.remove("hidden");
    }
  }

  hideGameOverlay() {
    const overlay = document.getElementById("gameOverlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }
  }

  showRematchPanel(data) {
    const panel = document.getElementById("rematchPanel");
    const finalScore = document.getElementById("finalScore");
    const matchDuration = document.getElementById("matchDuration");
    const matchWinner = document.getElementById("matchWinner");

    if (panel) panel.style.display = "block";
    if (finalScore)
      finalScore.textContent = `${data.finalScore.player1} - ${data.finalScore.player2}`;
    if (matchDuration) matchDuration.textContent = `${data.duration}s`;
    if (matchWinner) matchWinner.textContent = data.winner;
  }

  hideRematchPanel() {
    const panel = document.getElementById("rematchPanel");
    if (panel) panel.style.display = "none";
  }

  updateRematchStatus(message) {
    const status = document.getElementById("rematchStatus");
    if (status) status.textContent = message;
  }

  celebrateGoal(scorer) {
    const scoreElement = document.getElementById(scorer + "Score");
    if (scoreElement) {
      scoreElement.classList.add("score-update");
      setTimeout(() => scoreElement.classList.remove("score-update"), 500);
    }

    this.showToast(`Goal by ${scorer}!`, "success");
  }

  showToast(message, type = "info") {
    // Simple toast notification (could be enhanced)
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  addToMatchHistory(match) {
    this.matchHistory.unshift(match);
    this.updateMatchHistoryDisplay();
  }

  updateMatchHistoryDisplay() {
    const container = document.getElementById("matchHistory");
    if (!container) return;

    if (this.matchHistory.length === 0) {
      container.innerHTML = '<p class="no-matches">No matches played yet</p>';
      return;
    }

    container.innerHTML = this.matchHistory
      .slice(0, 5)
      .map(
        (match) => `
      <div class="match-item">
        <div class="match-header">
          <span class="match-score">${match.score.player1} - ${match.score.player2}</span>
          <span class="match-duration">${match.duration}s</span>
        </div>
        <div class="match-result">Winner: ${match.winner}</div>
      </div>
    `
      )
      .join("");
  }

  // ============ UTILITY METHODS ============

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  enableButton(id) {
    const element = document.getElementById(id);
    if (element) element.disabled = false;
  }

  disableButton(id) {
    const element = document.getElementById(id);
    if (element) element.disabled = true;
  }

  toggleButtonState(id, connected, connectedText) {
    const element = document.getElementById(id);
    if (element) {
      if (connected) {
        element.classList.add("connected");
        element.innerHTML = `<i class="fas fa-check"></i> ${connectedText}`;
      } else {
        element.classList.remove("connected");
        element.innerHTML = `<i class="fas fa-link"></i> Connect Wallet (Demo)`;
      }
    }
  }

  formatTime(date) {
    return date.toLocaleTimeString();
  }

  getPlayerPosition(playerId) {
    const player = this.playersInRoom.find((p) => p.id === playerId);
    return player ? player.position : null;
  }

  logEvent(type, message, data = null) {
    const timestamp = this.formatTime(new Date());
    const eventLog = document.getElementById("eventLog");

    if (!eventLog) return;

    const logEntry = document.createElement("div");
    logEntry.className = "log-entry";
    logEntry.innerHTML = `
      <span class="timestamp">[${timestamp}]</span>
      <span class="event-type ${type}">[${type.toUpperCase()}]</span>
      <span class="message">${message}${
      data ? " - " + JSON.stringify(data, null, 2) : ""
    }</span>
    `;

    eventLog.appendChild(logEntry);
    this.eventCount++;

    // Auto-scroll to bottom
    if (this.autoScroll) {
      eventLog.scrollTop = eventLog.scrollHeight;
    }

    // Limit log entries
    while (eventLog.children.length > 100) {
      eventLog.removeChild(eventLog.firstChild);
    }
  }

  resetGameState() {
    this.gameActive = false;
    this.isReady = false;
    this.score = { player1: 0, player2: 0 };
    this.gameTime = 60;
    this.matchId = null;
    this.isBallAuthority = false; // Reset ball authority

    // Reset broadcast counters
    this.ballBroadcastCounter = 0;
    this.playerBroadcastCounter = 0;

    this.resetPositions();
    this.updateScoreDisplay();
    this.updateReadyStatus();
    this.setGameMode(false);
    this.hideRematchPanel();
    this.showGameOverlay("Disconnected", "Please reconnect and join a room");
  }
}

// Initialize the demo when page loads
document.addEventListener("DOMContentLoaded", () => {
  window.gameDemo = new SocketEventDemo();
});
