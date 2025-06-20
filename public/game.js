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
        this.log('🚀 MetaHead Arena - Head Ball Client initialized');
        this.log('🎮 Keyboard Controls: WASD / Arrow Keys to move, Space to jump, S to kick');
    }

    /**
     * Connect to Socket.IO server
     */
    connectSocket() {
        try {
            this.socket = io();
            
            this.socket.on('connect', () => {
                this.handleConnection();
            });

            this.socket.on('disconnect', () => {
                this.handleDisconnection();
            });

            this.socket.on('welcome', (data) => {
                this.handleWelcome(data);
            });

            this.socket.on('player-created', (data) => {
                this.handlePlayerCreated(data);
            });

            this.socket.on('room-joined', (data) => {
                this.handleRoomJoined(data);
            });

            this.socket.on('room-full', (data) => {
                this.handleRoomFull(data);
            });

            this.socket.on('player-ready-changed', (data) => {
                this.handlePlayerReadyChanged(data);
            });

            this.socket.on('game-started', (data) => {
                this.handleGameStarted(data);
            });

            this.socket.on('game-state-update', (data) => {
                this.handleGameStateUpdate(data);
            });

            this.socket.on('goal-scored', (data) => {
                this.handleGoalScored(data);
            });

            this.socket.on('game-ended', (data) => {
                this.handleGameEnded(data);
            });

            this.socket.on('error', (data) => {
                this.handleError(data);
            });

            this.socket.on('connect_error', (error) => {
                this.log(`❌ Connection error: ${error.message}`, 'error');
                this.updateConnectionStatus('Connection Error', false);
            });

        } catch (error) {
            this.log(`❌ Socket initialization error: ${error.message}`, 'error');
        }
    }

    /**
     * Handle successful connection
     */
    handleConnection() {
        this.isConnected = true;
        this.updateConnectionStatus('Connected', true);
        this.log('✅ Connected to MetaHead Arena server!', 'success');
        
        // Enable join game button
        const joinBtn = document.getElementById('joinGameBtn');
        if (joinBtn) {
            joinBtn.disabled = false;
        }
    }

    /**
     * Handle disconnection
     */
    handleDisconnection() {
        this.isConnected = false;
        this.updateConnectionStatus('Disconnected', false);
        this.log('❌ Disconnected from server', 'error');
        
        // Reset all states
        this.resetGameState();
    }

    /**
     * Handle welcome message
     */
    handleWelcome(data) {
        this.playerId = data.playerId;
        this.updatePlayerInfo('playerId', data.playerId);
        this.log(`👋 ${data.message}`, 'info');
    }

    /**
     * Handle player creation
     */
    handlePlayerCreated(data) {
        this.log(`👤 Player created: ${data.player.username}`, 'success');
    }

    /**
     * Handle room joined
     */
    handleRoomJoined(data) {
        this.roomId = data.roomId;
        this.updatePlayerInfo('roomId', data.roomId);
        this.updatePlayerInfo('playersInRoom', `${data.players ? data.players.length : 1}/2`);
        this.log(`🏠 Joined room: ${data.roomId}`, 'success');
        
        // Enable ready button
        const readyBtn = document.getElementById('toggleReadyBtn');
        if (readyBtn) {
            readyBtn.disabled = false;
        }
    }

    /**
     * Handle room full
     */
    handleRoomFull(data) {
        this.log(`🎯 ${data.message}`, 'info');
        this.updatePlayerInfo('playersInRoom', '2/2');
    }

    /**
     * Handle player ready status change
     */
    handlePlayerReadyChanged(data) {
        this.log(`🔄 ${data.username} is ${data.isReady ? 'ready' : 'not ready'}`, 'info');
        
        // Update ready status for this player (server confirmation)
        if (data.playerId === this.playerId) {
            this.isReady = data.isReady;
            this.updateReadyStatus();
            this.log(`✅ Ready status confirmed: ${data.isReady ? 'Ready' : 'Not Ready'}`, 'success');
        }

        if (data.allPlayersReady) {
            this.log('🚀 All players ready! Game starting...', 'success');
        }
    }

    /**
     * Handle game started
     */
    handleGameStarted(data) {
        this.gameActive = true;
        this.log(`🎮 ${data.message}`, 'success');
        
        // Update UI for game mode
        this.setGameMode(true);
    }

    /**
     * Handle game state update (60fps)
     */
    handleGameStateUpdate(data) {
        if (!data.gameState) return;
        
        this.gameState = data.gameState;
        this.updateGameField(data.gameState);
    }

    /**
     * Handle goal scored
     */
    handleGoalScored(data) {
        this.log(`⚽ GOAL! ${data.scorer} scored!`, 'success');
        this.log(`📊 Score: ${data.newScore.player1} - ${data.newScore.player2}`, 'info');
        
        // Add goal celebration animation
        this.celebrateGoal(data.scorer);
    }

    /**
     * Handle game ended
     */
    handleGameEnded(data) {
        this.gameActive = false;
        this.log(`🏁 Game Over! Result: ${data.result}`, 'success');
        this.log(`📊 Final Score: ${data.finalScore.player1} - ${data.finalScore.player2}`, 'info');
        
        if (data.winner) {
            this.log(`🏆 Winner: ${data.winner}!`, 'success');
        } else {
            this.log(`🤝 It's a draw!`, 'info');
        }
        
        // Reset UI
        this.setGameMode(false);
    }

    /**
     * Handle error messages
     */
    handleError(data) {
        this.log(`❌ Error: ${data.message}`, 'error');
    }

    /**
     * Setup event listeners for UI elements
     */
    setupEventListeners() {
        // Game action buttons
        this.addClickListener('joinGameBtn', () => this.joinGame());
        this.addClickListener('findMatchBtn', () => this.findMatch());
        this.addClickListener('toggleReadyBtn', () => this.toggleReady());
        this.addClickListener('leaveRoomBtn', () => this.leaveRoom());

        // Control buttons
        this.addClickListener('moveLeftBtn', () => this.moveLeft());
        this.addClickListener('moveRightBtn', () => this.moveRight());
        this.addClickListener('jumpBtn', () => this.jump());
        this.addClickListener('kickBtn', () => this.kick());

        // API test buttons
        this.addClickListener('testStatsBtn', () => this.testAPI('/stats'));
        this.addClickListener('testRoomsBtn', () => this.testAPI('/rooms'));
        this.addClickListener('testPlayersBtn', () => this.testAPI('/players'));
        this.addClickListener('createRoomBtn', () => this.createRoom());
        this.addClickListener('clearLogBtn', () => this.clearLog());
    }

    /**
     * Add click listener helper
     */
    addClickListener(elementId, callback) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener('click', callback);
        }
    }

    /**
     * Setup keyboard controls
     */
    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            if (this.keys[e.key]) return; // Prevent key repeat
            this.keys[e.key] = true;
            
            switch(e.key.toLowerCase()) {
                case 'arrowleft':
                case 'a':
                    if (!this.isMovingLeft) {
                        this.moveLeft();
                        this.setControlActive('moveLeftBtn', true);
                    }
                    e.preventDefault();
                    break;
                case 'arrowright':
                case 'd':
                    if (!this.isMovingRight) {
                        this.moveRight();
                        this.setControlActive('moveRightBtn', true);
                    }
                    e.preventDefault();
                    break;
                case 'arrowup':
                case 'w':
                case ' ': // Spacebar
                    this.jump();
                    this.setControlActive('jumpBtn', true);
                    setTimeout(() => this.setControlActive('jumpBtn', false), 200);
                    e.preventDefault();
                    break;
                case 'arrowdown':
                case 's':
                    this.kick();
                    this.setControlActive('kickBtn', true);
                    setTimeout(() => this.setControlActive('kickBtn', false), 200);
                    e.preventDefault();
                    break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            
            switch(e.key.toLowerCase()) {
                case 'arrowleft':
                case 'a':
                    if (this.isMovingLeft) {
                        this.stopMoving();
                        this.setControlActive('moveLeftBtn', false);
                    }
                    break;
                case 'arrowright':
                case 'd':
                    if (this.isMovingRight) {
                        this.stopMoving();
                        this.setControlActive('moveRightBtn', false);
                    }
                    break;
            }
        });
    }

    /**
     * Set control button active state
     */
    setControlActive(buttonId, active) {
        const button = document.getElementById(buttonId);
        if (button) {
            if (active) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        }
    }

    /**
     * Game Actions
     */
    joinGame() {
        if (!this.isConnected) {
            this.log('❌ Not connected to server', 'error');
            return;
        }

        const username = `Player${Math.floor(Math.random() * 1000)}`;
        this.socket.emit('join-game', { username });
        this.log(`🎮 Joining game as ${username}...`, 'info');
    }

    findMatch() {
        if (!this.isConnected) {
            this.log('❌ Not connected to server', 'error');
            return;
        }

        this.socket.emit('find-match');
        this.log('🔍 Finding match...', 'info');
    }

    toggleReady() {
        if (!this.roomId) {
            this.log('❌ Not in a room', 'error');
            return;
        }

        // Toggle the local state immediately for responsive UI
        this.isReady = !this.isReady;
        this.updateReadyStatus();
        
        this.socket.emit('ready');
        this.log(`🔄 ${this.isReady ? 'Setting ready' : 'Canceling ready'}...`, 'info');
    }

    leaveRoom() {
        if (!this.roomId) {
            this.log('❌ Not in a room', 'error');
            return;
        }

        this.socket.emit('leave-game');
        this.resetGameState();
        this.log('👋 Left the room', 'info');
    }

    /**
     * Player Controls
     */
    moveLeft() {
        this.isMovingLeft = true;
        this.socket.emit('move-left', { pressed: true });
        
        // Auto-stop after 200ms if key not held
        setTimeout(() => {
            if (this.isMovingLeft && !this.keys['a'] && !this.keys['A'] && !this.keys['ArrowLeft']) {
                this.stopMoving();
            }
        }, 200);
    }

    moveRight() {
        this.isMovingRight = true;
        this.socket.emit('move-right', { pressed: true });
        
        // Auto-stop after 200ms if key not held
        setTimeout(() => {
            if (this.isMovingRight && !this.keys['d'] && !this.keys['D'] && !this.keys['ArrowRight']) {
                this.stopMoving();
            }
        }, 200);
    }

    stopMoving() {
        if (this.isMovingLeft || this.isMovingRight) {
            this.isMovingLeft = false;
            this.isMovingRight = false;
            this.socket.emit('stop-move', { direction: 'horizontal' });
        }
    }

    jump() {
        this.socket.emit('jump', { pressed: true });
    }

    kick() {
        this.socket.emit('kick', { pressed: true });
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
            const p1Pos = gameToVisual(gameState.players.player1.x, gameState.players.player1.y);
            const p1Element = document.getElementById('player1Sprite');
            if (p1Element) {
                p1Element.style.left = `${Math.max(0, Math.min(95, p1Pos.x))}%`;
                p1Element.style.bottom = `${Math.max(5, Math.min(90, p1Pos.y))}%`;
            }
        }

        // Update player2 position
        if (gameState.players.player2) {
            const p2Pos = gameToVisual(gameState.players.player2.x, gameState.players.player2.y);
            const p2Element = document.getElementById('player2Sprite');
            if (p2Element) {
                p2Element.style.left = `${Math.max(0, Math.min(95, p2Pos.x))}%`;
                p2Element.style.bottom = `${Math.max(5, Math.min(90, p2Pos.y))}%`;
            }
        }

        // Update ball position
        if (gameState.ball) {
            const ballPos = gameToVisual(gameState.ball.x, gameState.ball.y);
            const ballElement = document.getElementById('ballSprite');
            if (ballElement) {
                ballElement.style.left = `${Math.max(0, Math.min(95, ballPos.x))}%`;
                ballElement.style.bottom = `${Math.max(5, Math.min(90, ballPos.y))}%`;
            }
        }

        // Update score
        if (gameState.score) {
            this.updatePlayerInfo('player1Score', gameState.score.player1);
            this.updatePlayerInfo('player2Score', gameState.score.player2);
        }

        // Update game time
        if (gameState.gameTime !== undefined) {
            const minutes = Math.floor(gameState.gameTime / 60);
            const seconds = Math.floor(gameState.gameTime % 60);
            this.updatePlayerInfo('gameTime', `${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
    }

    /**
     * Celebrate goal with animation
     */
    celebrateGoal(scorer) {
        const scorerElement = scorer === 'player1' ? 
            document.getElementById('player1Sprite') : 
            document.getElementById('player2Sprite');

        if (scorerElement) {
            scorerElement.style.transform = 'scale(1.2)';
            scorerElement.style.animation = 'bounce 0.5s ease-in-out';
            
            setTimeout(() => {
                scorerElement.style.transform = '';
                scorerElement.style.animation = '';
            }, 500);
        }
    }

    /**
     * API Testing
     */
    async testAPI(endpoint) {
        try {
            this.log(`🔗 Testing API: ${endpoint}`, 'info');
            const response = await fetch(`/api/game${endpoint}`);
            const data = await response.json();
            this.log(`✅ API ${endpoint}: Success`, 'success');
            this.log(JSON.stringify(data, null, 2));
        } catch (error) {
            this.log(`❌ API Error ${endpoint}: ${error.message}`, 'error');
        }
    }

    async createRoom() {
        try {
            this.log('🏗️ Creating room...', 'info');
            const response = await fetch('/api/game/rooms/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    settings: { 
                        matchDuration: 120,
                        maxPlayers: 2
                    } 
                })
            });
            const data = await response.json();
            this.log(`✅ Room created: ${data.data?.id || 'Unknown'}`, 'success');
            this.log(JSON.stringify(data, null, 2));
        } catch (error) {
            this.log(`❌ Create room error: ${error.message}`, 'error');
        }
    }

    /**
     * UI Helper Methods
     */
    updateConnectionStatus(status, connected) {
        const statusElement = document.getElementById('connectionStatus');
        const dotElement = document.getElementById('statusDot');
        
        if (statusElement) {
            statusElement.textContent = status;
        }
        
        if (dotElement) {
            if (connected) {
                dotElement.classList.add('connected');
            } else {
                dotElement.classList.remove('connected');
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
        const statusElement = document.getElementById('readyStatus');
        const readyBtn = document.getElementById('toggleReadyBtn');
        
        if (statusElement) {
            statusElement.textContent = this.isReady ? 'Ready' : 'Not Ready';
            if (this.isReady) {
                statusElement.classList.add('ready');
            } else {
                statusElement.classList.remove('ready');
            }
        }
        
        if (readyBtn) {
            // Update button text and style
            readyBtn.innerHTML = this.isReady ? 
                '<i class="fas fa-times-circle"></i> Cancel Ready' : 
                '<i class="fas fa-check-circle"></i> Ready Up!';
            
            // Update button appearance
            if (this.isReady) {
                readyBtn.classList.add('ready-active');
            } else {
                readyBtn.classList.remove('ready-active');
            }
        }
    }

    setGameMode(active) {
        // Enable/disable control buttons based on game state
        const controlButtons = ['moveLeftBtn', 'moveRightBtn', 'jumpBtn', 'kickBtn'];
        controlButtons.forEach(buttonId => {
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
        this.updatePlayerInfo('roomId', 'None');
        this.updatePlayerInfo('playersInRoom', '0/2');
        this.updatePlayerInfo('player1Score', '0');
        this.updatePlayerInfo('player2Score', '0');
        this.updatePlayerInfo('gameTime', '2:00');
        this.updateReadyStatus();
        this.setGameMode(false);
        
        // Reset player positions
        const player1 = document.getElementById('player1Sprite');
        const player2 = document.getElementById('player2Sprite');
        const ball = document.getElementById('ballSprite');
        
        if (player1) {
            player1.style.left = '20%';
            player1.style.bottom = '10%';
        }
        if (player2) {
            player2.style.left = '75%';
            player2.style.bottom = '10%';
        }
        if (ball) {
            ball.style.left = '47.5%';
            ball.style.bottom = '50%';
        }
    }

    /**
     * Logging system with color coding
     */
    log(message, type = 'info') {
        const logElement = document.getElementById('eventLog');
        if (!logElement) return;

        const timestamp = new Date().toLocaleTimeString();
        const logLine = `[${timestamp}] ${message}\n`;
        
        const span = document.createElement('span');
        span.textContent = logLine;
        span.className = `log-${type}`;
        
        logElement.appendChild(span);
        logElement.scrollTop = logElement.scrollHeight;
    }

    clearLog() {
        const logElement = document.getElementById('eventLog');
        if (logElement) {
            logElement.innerHTML = '';
        }
    }
}

// Initialize the client when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.headBallClient = new HeadBallClient();
});

// Add CSS animations
const style = document.createElement('style');
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