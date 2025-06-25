/**
 * MetaHead Arena - Head Ball Game Client
 * Modern Socket.IO client with real-time gameplay
 */

class HeadBallClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.playerId = null;
    this.roomId = null;
    this.isReady = false;
    this.gameActive = false;

    // Movement states
    this.isMovingLeft = false;
    this.isMovingRight = false;
    this.keys = {};

    // Game state
    this.gameState = null;
    this.lastUpdate = Date.now();

    // Initialize the client
    this.init();
  }

  /**
   * Initialize the client
   */
  init() {
    this.connectSocket();
    this.setupEventListeners();
    this.setupKeyboardControls();
    this.log("MetaHead Arena - Head Ball Client initialized");
    this.log(
      "Keyboard Controls: WASD / Arrow Keys to move, Space to jump, S to kick"
    );
  }

  /**
   * Connect to Socket.IO server
   */
  connectSocket() {
    try {
      this.socket = io();

      this.socket.on("connect", () => {
        this.handleConnection();
      });

      this.socket.on("disconnect", () => {
        this.handleDisconnection();
      });

      this.socket.on("welcome", (data) => {
        this.handleWelcome(data);
      });

      this.socket.on("player-created", (data) => {
        this.handlePlayerCreated(data);
      });

      this.socket.on("room-joined", (data) => {
        this.handleRoomJoined(data);
      });

      this.socket.on("room-full", (data) => {
        this.handleRoomFull(data);
      });

      this.socket.on("player-ready-changed", (data) => {
        this.handlePlayerReadyChanged(data);
      });

      this.socket.on("game-started", (data) => {
        this.handleGameStarted(data);
      });

      this.socket.on("game-state-update", (data) => {
        this.handleGameStateUpdate(data);
      });

      this.socket.on("goal-scored", (data) => {
        this.handleGoalScored(data);
      });

      this.socket.on("game-ended", (data) => {
        this.handleGameEnded(data);
      });

      this.socket.on("error", (data) => {
        this.handleError(data);
      });

      this.socket.on("connect_error", (error) => {
        this.log(`Connection error: ${error.message}`, "error");
        this.updateConnectionStatus("Connection Error", false);
      });
    } catch (error) {
      this.log(`Socket initialization error: ${error.message}`, "error");
    }
  }

  /**
   * Handle successful connection
   */
  handleConnection() {
    this.isConnected = true;
    this.updateConnectionStatus("Connected", true);
    this.log("Connected to MetaHead Arena server!", "success");

    // Enable join game button
    const joinBtn = document.getElementById("joinGameBtn");
    if (joinBtn) {
      joinBtn.disabled = false;
    }
  }

  /**
   * Handle disconnection
   */
  handleDisconnection() {
    this.isConnected = false;
    this.updateConnectionStatus("Disconnected", false);
    this.log("Disconnected from server", "error");

    // Reset all states
    this.resetGameState();
  }

  /**
   * Handle welcome message
   */
  handleWelcome(data) {
    this.playerId = data.playerId;
    this.updatePlayerInfo("playerId", data.playerId);
    this.log(`${data.message}`, "info");
  }

  /**
   * Handle player creation
   */
  handlePlayerCreated(data) {
    this.log(`Player created: ${data.player.username}`, "success");
  }

  /**
   * Handle room joined
   */
  handleRoomJoined(data) {
    this.roomId = data.roomId;
    this.updatePlayerInfo("roomId", data.roomId);
    this.updatePlayerInfo(
      "playersInRoom",
      `${data.players ? data.players.length : 1}/2`
    );
    this.log(`Joined room: ${data.roomId}`, "success");

    // Enable ready button
    const readyBtn = document.getElementById("toggleReadyBtn");
    if (readyBtn) {
      readyBtn.disabled = false;
    }
  }

  /**
   * Handle room full
   */
  handleRoomFull(data) {
    this.log(`${data.message}`, "info");
    this.updatePlayerInfo("playersInRoom", "2/2");
  }

  /**
   * Handle player ready status change
   */
  handlePlayerReadyChanged(data) {
    console.log("handlePlayerReadyChanged called with data:", data);
    this.log(
      `${data.username} is ${data.isReady ? "ready" : "not ready"}`,
      "info"
    );

    // Update ready status for this player (server confirmation)
    if (data.playerId === this.playerId) {
      this.isReady = data.isReady;
      this.updateReadyStatus();
      this.log(
        `Ready status confirmed: ${data.isReady ? "Ready" : "Not Ready"}`,
        "success"
      );
    }

    if (data.allPlayersReady) {
      this.log("All players ready! Game starting...", "success");
      this.log("Waiting for game-started event from server...", "info");
    } else {
      this.log(
        `⏸️ Not all players ready yet (allPlayersReady: ${data.allPlayersReady})`,
        "info"
      );
    }
  }

  /**
   * Handle game started
   */
  handleGameStarted(data) {
    console.log("handleGameStarted called with data:", data);
    this.gameActive = true;
    this.log(`${data.message}`, "success");
    this.log(`Game is now active! Controls enabled.`, "success");

    // Initialize game state from room data
    if (data.room && data.room.gameState) {
      this.gameState = data.room.gameState;
      this.updateGameField(data.room.gameState);
      this.log("Initial game state loaded from room data", "success");
    } else {
      // Fallback: Initialize with default game state
      this.gameState = {
        players: {
          player1: { x: 150, y: 320 },
          player2: { x: 650, y: 320 },
        },
        ball: { x: 400, y: 200 },
        score: { player1: 0, player2: 0 },
        gameTime: 120,
        isActive: true,
      };
      this.updateGameField(this.gameState);
      this.log("Initialized with default game state", "info");
    }

    // Update UI for game mode
    this.setGameMode(true);

    // Update ready button to be disabled during game
    const readyBtn = document.getElementById("toggleReadyBtn");
    if (readyBtn) {
      readyBtn.disabled = true;
      readyBtn.innerHTML = '<i class="fas fa-gamepad"></i> Game In Progress';
    }
  }

  /**
   * Handle game state update (60fps)
   */
  handleGameStateUpdate(data) {
    if (!data) {
      console.warn("Received empty game-state-update data");
      return;
    }

    // Handle the server's actual data format: { changes, fullState }
    let gameStateToUse = null;

    if (data.fullState) {
      // Use full state when available (every 10th update)
      gameStateToUse = data.fullState;
      console.log("📦 Using fullState for game update");
    } else if (data.changes && this.gameState) {
      // Apply delta changes to existing state
      gameStateToUse = this.applyGameStateChanges(this.gameState, data.changes);
      console.log("Applied delta changes to game state");
    } else if (data.gameState) {
      // Fallback: direct gameState property (if server format changes)
      gameStateToUse = data.gameState;
      console.log("Using direct gameState property");
    } else {
      console.warn("No usable game state data in update:", data);
      return;
    }

    if (gameStateToUse) {
      this.gameState = gameStateToUse;
      this.updateGameField(gameStateToUse);
    }
  }

  /**
   * Apply delta changes to current game state
   */
  applyGameStateChanges(currentState, changes) {
    try {
      const newState = JSON.parse(JSON.stringify(currentState)); // Deep clone

      // Ensure basic structure exists
      if (!newState.players) {
        newState.players = { player1: {}, player2: {} };
      }
      if (!newState.ball) {
        newState.ball = {};
      }
      if (!newState.score) {
        newState.score = { player1: 0, player2: 0 };
      }

      // Apply player changes
      if (changes.players) {
        Object.keys(changes.players).forEach((playerKey) => {
          if (!newState.players[playerKey]) {
            newState.players[playerKey] = {};
          }
          Object.assign(
            newState.players[playerKey],
            changes.players[playerKey]
          );
        });
      }

      // Apply ball changes
      if (changes.ball) {
        Object.assign(newState.ball, changes.ball);
      }

      // Apply score changes
      if (changes.score) {
        newState.score = changes.score;
      }

      // Apply time changes
      if (changes.gameTime !== null && changes.gameTime !== undefined) {
        newState.gameTime = changes.gameTime;
      }

      return newState;
    } catch (error) {
      console.error("Error applying game state changes:", error);
      return currentState; // Return original state on error
    }
  }

  /**
   * Handle goal scored
   */
  handleGoalScored(data) {
    this.log(`GOAL! ${data.scorer} scored!`, "success");
    this.log(
      `Score: ${data.newScore.player1} - ${data.newScore.player2}`,
      "info"
    );

    // Add goal celebration animation
    this.celebrateGoal(data.scorer);
  }

  /**
   * Handle game ended
   */
  handleGameEnded(data) {
    this.gameActive = false;
    this.log(`Game Over! Result: ${data.result}`, "success");
    this.log(
      `Final Score: ${data.finalScore.player1} - ${data.finalScore.player2}`,
      "info"
    );

    if (data.winner) {
      this.log(`Winner: ${data.winner.username || data.winner}!`, "success");
    } else {
      this.log(`It's a draw!`, "info");
    }

    // Reset UI
    this.setGameMode(false);

    // Reset ready button
    const readyBtn = document.getElementById("toggleReadyBtn");
    if (readyBtn) {
      readyBtn.disabled = false;
      readyBtn.innerHTML = '<i class="fas fa-check-circle"></i> Ready Up!';
    }
  }

  /**
   * Handle error messages
   */
  handleError(data) {
    this.log(`Error: ${data.message}`, "error");

    // Show error in UI if it's a ready-related error
    if (data.message && data.message.includes("ready")) {
      this.log(`Ready State Error: ${data.message}`, "error");
      // Reset ready state on error
      this.isReady = false;
      this.updateReadyStatus();
    }
  }

  /**
   * Setup event listeners for UI elements
   */
  setupEventListeners() {
    // Web3 connection
    this.addClickListener("connectWalletBtn", () => this.connectWallet());

    // Game action buttons
    this.addClickListener("joinGameBtn", () => this.joinGame());
    this.addClickListener("findMatchBtn", () => this.findMatch());
    this.addClickListener("toggleReadyBtn", () => this.toggleReady());
    this.addClickListener("leaveRoomBtn", () => this.leaveRoom());

    // Control buttons - use mousedown/mouseup for continuous movement
    this.setupButtonControls();
    this.addClickListener("jumpBtn", () => this.jump());
    this.addClickListener("kickBtn", () => this.kick());

    // NFT selection change
    const nftSelect = document.getElementById("nftSelect");
    if (nftSelect) {
      nftSelect.addEventListener("change", () => this.updateNFTModifiers());
    }
  }

  /**
   * Add click listener helper
   */
  addClickListener(elementId, callback) {
    const element = document.getElementById(elementId);
    if (element) {
      element.addEventListener("click", callback);
    }
  }

  /**
   * Setup button controls for movement
   */
  setupButtonControls() {
    // Left button
    const leftBtn = document.getElementById("moveLeftBtn");
    if (leftBtn) {
      leftBtn.addEventListener("mousedown", () => {
        this.isMovingLeft = true;
        this.setControlActive("moveLeftBtn", true);
      });
      leftBtn.addEventListener("mouseup", () => {
        this.isMovingLeft = false;
        this.setControlActive("moveLeftBtn", false);
      });
      leftBtn.addEventListener("mouseleave", () => {
        this.isMovingLeft = false;
        this.setControlActive("moveLeftBtn", false);
      });
    }

    // Right button
    const rightBtn = document.getElementById("moveRightBtn");
    if (rightBtn) {
      rightBtn.addEventListener("mousedown", () => {
        this.isMovingRight = true;
        this.setControlActive("moveRightBtn", true);
      });
      rightBtn.addEventListener("mouseup", () => {
        this.isMovingRight = false;
        this.setControlActive("moveRightBtn", false);
      });
      rightBtn.addEventListener("mouseleave", () => {
        this.isMovingRight = false;
        this.setControlActive("moveRightBtn", false);
      });
    }
  }

  /**
   * Setup keyboard controls
   */
  setupKeyboardControls() {
    // Start continuous movement input loop
    this.startMovementLoop();

    document.addEventListener("keydown", (e) => {
      if (this.keys[e.key]) return; // Prevent key repeat
      this.keys[e.key] = true;

      switch (e.key.toLowerCase()) {
        case "arrowleft":
        case "a":
          this.isMovingLeft = true;
          this.setControlActive("moveLeftBtn", true);
          e.preventDefault();
          break;
        case "arrowright":
        case "d":
          this.isMovingRight = true;
          this.setControlActive("moveRightBtn", true);
          e.preventDefault();
          break;
        case "arrowup":
        case "w":
        case " ": // Spacebar
          this.jump();
          this.setControlActive("jumpBtn", true);
          setTimeout(() => this.setControlActive("jumpBtn", false), 200);
          e.preventDefault();
          break;
        case "arrowdown":
        case "s":
          this.kick();
          this.setControlActive("kickBtn", true);
          setTimeout(() => this.setControlActive("kickBtn", false), 200);
          e.preventDefault();
          break;
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.key] = false;

      switch (e.key.toLowerCase()) {
        case "arrowleft":
        case "a":
          this.isMovingLeft = false;
          this.setControlActive("moveLeftBtn", false);
          break;
        case "arrowright":
        case "d":
          this.isMovingRight = false;
          this.setControlActive("moveRightBtn", false);
          break;
      }
    });
  }

  /**
   * Start continuous movement input loop (60fps)
   */
  startMovementLoop() {
    setInterval(() => {
      if (!this.gameActive) return;

      if (this.isMovingLeft) {
        this.socket.emit("move-left", { pressed: true });
      } else if (this.isMovingRight) {
        this.socket.emit("move-right", { pressed: true });
      } else {
        // Send stop if not moving
        this.socket.emit("stop-move", { direction: "horizontal" });
      }
    }, 16); // 60fps movement updates
  }

  /**
   * Set control button active state
   */
  setControlActive(buttonId, active) {
    const button = document.getElementById(buttonId);
    if (button) {
      if (active) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    }
  }

  /**
   * Web3 Connection Methods
   */
  generateRandomWallet() {
    const chars = "0123456789abcdef";
    let result = "0x";
    for (let i = 0; i < 40; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  connectWallet() {
    // Generate random wallet address (username will be auto-generated by schema)
    const walletAddress = this.generateRandomWallet();

    // Generate username using schema logic for display
    const defaultUsername = `Player_${walletAddress.slice(-6)}`;

    // Update UI
    document.getElementById("walletAddress").textContent = walletAddress;

    // Store wallet data
    this.walletAddress = walletAddress;

    // Update button state
    const connectBtn = document.getElementById("connectWalletBtn");
    connectBtn.innerHTML = '<i class="fas fa-check"></i> Wallet Connected';
    connectBtn.disabled = true;
    connectBtn.classList.add("connected");

    // Enable join game button
    const joinBtn = document.getElementById("joinGameBtn");
    if (joinBtn) {
      joinBtn.disabled = false;
    }

    this.log(`Wallet connected: ${walletAddress}`, "success");
    this.log(
      `Username will be: ${defaultUsername} (auto-generated by schema)`,
      "info"
    );
  }

  updateNFTModifiers() {
    const nftSelect = document.getElementById("nftSelect");
    const modifiersDisplay = document.getElementById("nftModifiers");

    if (!nftSelect || !modifiersDisplay) return;

    const selectedNFT = nftSelect.value;
    let modifiers = { speed: 1.0, jump: 1.0, kick: 1.0 };

    // Set modifiers based on NFT selection
    switch (selectedNFT) {
      case "674a8f1c2d3e4f5g6h7i8j9k": // Fire Head
        modifiers = { speed: 1.2, jump: 1.0, kick: 1.0 };
        break;
      case "674a8f1c2d3e4f5g6h7i8j9l": // Ice Head
        modifiers = { speed: 1.0, jump: 1.15, kick: 1.0 };
        break;
      case "674a8f1c2d3e4f5g6h7i8j9m": // Lightning Head
        modifiers = { speed: 1.0, jump: 1.0, kick: 1.25 };
        break;
      default:
        modifiers = { speed: 1.0, jump: 1.0, kick: 1.0 };
    }

    // Update display
    modifiersDisplay.innerHTML = `
      <span class="modifier">Speed: ${modifiers.speed}x</span>
      <span class="modifier">Jump: ${modifiers.jump}x</span>
      <span class="modifier">Kick: ${modifiers.kick}x</span>
    `;

    this.log(
      `NFT modifiers updated: Speed ${modifiers.speed}x, Jump ${modifiers.jump}x, Kick ${modifiers.kick}x`,
      "info"
    );
  }

  /**
   * Game Actions
   */
  joinGame() {
    if (!this.isConnected) {
      this.log("Not connected to server", "error");
      return;
    }

    if (!this.walletAddress) {
      this.log("Please connect your wallet first", "error");
      return;
    }

    const nftSelect = document.getElementById("nftSelect");
    const selectedNFT = nftSelect ? nftSelect.value : null;

    const joinData = {
      walletAddress: this.walletAddress,
      nftId: selectedNFT || null,
    };

    this.socket.emit("join-game", joinData);
    this.log(`Joining game with wallet ${this.walletAddress}...`, "info");

    if (selectedNFT) {
      this.log(`Using NFT: ${selectedNFT}`, "info");
    }
  }

  findMatch() {
    if (!this.isConnected) {
      this.log("Not connected to server", "error");
      return;
    }

    this.socket.emit("find-match");
    this.log("Finding match...", "info");
  }

  toggleReady() {
    if (!this.roomId) {
      this.log("Not in a room", "error");
      return;
    }

    if (this.gameActive) {
      this.log("Cannot change ready status - game is already active", "error");
      return;
    }

    // Toggle the local state immediately for responsive UI
    this.isReady = !this.isReady;
    this.updateReadyStatus();

    this.socket.emit("ready");
    this.log(
      `${this.isReady ? "Setting ready" : "Canceling ready"}...`,
      "info"
    );
    this.log(`Sent ready event to server`, "debug");
  }

  leaveRoom() {
    if (!this.roomId) {
      this.log("Not in a room", "error");
      return;
    }

    this.socket.emit("leave-game");
    this.resetGameState();
    this.log("Left the room", "info");
  }

  /**
   * Player Controls
   */
  // Legacy movement functions removed - now using continuous movement loop

  jump() {
    this.socket.emit("jump", { pressed: true });
  }

  kick() {
    this.socket.emit("kick", { pressed: true });
  }

  /**
   * Update game field visualization
   */
  updateGameField(gameState) {
    if (!gameState || !gameState.players || !gameState.ball) {
      return;
    }

    const fieldWidth = 800; // Game field width
    const fieldHeight = 400; // Game field height
    const groundLevel = 320; // Ground level from game

    // Convert game coordinates to visual percentages
    const gameToVisual = (gameX, gameY) => {
      const visualX = (gameX / fieldWidth) * 100;
      const visualY = ((groundLevel - gameY) / fieldHeight) * 100;
      return { x: visualX, y: visualY };
    };

    // Update player1 position
    if (gameState.players.player1) {
      const p1Pos = gameToVisual(
        gameState.players.player1.x,
        gameState.players.player1.y
      );
      const p1Element = document.getElementById("player1Sprite");
      if (p1Element) {
        p1Element.style.left = `${Math.max(0, Math.min(95, p1Pos.x))}%`;
        p1Element.style.bottom = `${Math.max(5, Math.min(90, p1Pos.y))}%`;
      }
    }

    // Update player2 position
    if (gameState.players.player2) {
      const p2Pos = gameToVisual(
        gameState.players.player2.x,
        gameState.players.player2.y
      );
      const p2Element = document.getElementById("player2Sprite");
      if (p2Element) {
        p2Element.style.left = `${Math.max(0, Math.min(95, p2Pos.x))}%`;
        p2Element.style.bottom = `${Math.max(5, Math.min(90, p2Pos.y))}%`;
      }
    }

    // Update ball position
    if (gameState.ball) {
      const ballPos = gameToVisual(gameState.ball.x, gameState.ball.y);
      const ballElement = document.getElementById("ballSprite");
      if (ballElement) {
        ballElement.style.left = `${Math.max(0, Math.min(95, ballPos.x))}%`;
        ballElement.style.bottom = `${Math.max(5, Math.min(90, ballPos.y))}%`;
      }
    }

    // Update score
    if (gameState.score) {
      this.updatePlayerInfo("player1Score", gameState.score.player1);
      this.updatePlayerInfo("player2Score", gameState.score.player2);
    }

    // Update game time
    if (gameState.gameTime !== undefined) {
      const minutes = Math.floor(gameState.gameTime / 60);
      const seconds = Math.floor(gameState.gameTime % 60);
      this.updatePlayerInfo(
        "gameTime",
        `${minutes}:${seconds.toString().padStart(2, "0")}`
      );
    }
  }

  /**
   * Celebrate goal with animation
   */
  celebrateGoal(scorer) {
    const scorerElement =
      scorer === "player1"
        ? document.getElementById("player1Sprite")
        : document.getElementById("player2Sprite");

    if (scorerElement) {
      scorerElement.style.transform = "scale(1.2)";
      scorerElement.style.animation = "bounce 0.5s ease-in-out";

      setTimeout(() => {
        scorerElement.style.transform = "";
        scorerElement.style.animation = "";
      }, 500);
    }
  }

  /**
   * API Testing
   */

  /**
   * UI Helper Methods
   */
  updateConnectionStatus(status, connected) {
    const statusElement = document.getElementById("connectionStatus");
    const dotElement = document.getElementById("statusDot");

    if (statusElement) {
      statusElement.textContent = status;
    }

    if (dotElement) {
      if (connected) {
        dotElement.classList.add("connected");
      } else {
        dotElement.classList.remove("connected");
      }
    }
  }

  updatePlayerInfo(field, value) {
    const element = document.getElementById(field);
    if (element) {
      element.textContent = value;
    }
  }

  updateReadyStatus() {
    const statusElement = document.getElementById("readyStatus");
    const readyBtn = document.getElementById("toggleReadyBtn");

    if (statusElement) {
      statusElement.textContent = this.isReady ? "Ready" : "Not Ready";
      if (this.isReady) {
        statusElement.classList.add("ready");
      } else {
        statusElement.classList.remove("ready");
      }
    }

    if (readyBtn) {
      // Update button text and style
      readyBtn.innerHTML = this.isReady
        ? '<i class="fas fa-times-circle"></i> Cancel Ready'
        : '<i class="fas fa-check-circle"></i> Ready Up!';

      // Update button appearance
      if (this.isReady) {
        readyBtn.classList.add("ready-active");
      } else {
        readyBtn.classList.remove("ready-active");
      }
    }
  }

  setGameMode(active) {
    // Enable/disable control buttons based on game state
    const controlButtons = [
      "moveLeftBtn",
      "moveRightBtn",
      "jumpBtn",
      "kickBtn",
    ];
    controlButtons.forEach((buttonId) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.disabled = !active;
      }
    });
  }

  resetGameState() {
    this.roomId = null;
    this.isReady = false;
    this.gameActive = false;
    this.gameState = null;

    // Reset UI
    this.updatePlayerInfo("roomId", "None");
    this.updatePlayerInfo("playersInRoom", "0/2");
    this.updatePlayerInfo("player1Score", "0");
    this.updatePlayerInfo("player2Score", "0");
    this.updatePlayerInfo("gameTime", "2:00");
    this.updateReadyStatus();
    this.setGameMode(false);

    // Reset player positions
    const player1 = document.getElementById("player1Sprite");
    const player2 = document.getElementById("player2Sprite");
    const ball = document.getElementById("ballSprite");

    if (player1) {
      player1.style.left = "20%";
      player1.style.bottom = "10%";
    }
    if (player2) {
      player2.style.left = "75%";
      player2.style.bottom = "10%";
    }
    if (ball) {
      ball.style.left = "47.5%";
      ball.style.bottom = "50%";
    }
  }

  /**
   * Logging system (console only)
   */
  log(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const logLine = `[${timestamp}] ${message}`;

    // Log to console with appropriate level
    switch (type) {
      case "error":
        console.error(logLine);
        break;
      case "warning":
        console.warn(logLine);
        break;
      case "success":
      case "info":
      default:
        console.log(logLine);
        break;
    }
  }
}

// Initialize the client when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.headBallClient = new HeadBallClient();
});

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
    @keyframes bounce {
        0%, 20%, 60%, 100% {
            transform: translateY(0) scale(1.2);
        }
        40% {
            transform: translateY(-20px) scale(1.2);
        }
        80% {
            transform: translateY(-5px) scale(1.2);
        }
    }
`;
document.head.appendChild(style);
