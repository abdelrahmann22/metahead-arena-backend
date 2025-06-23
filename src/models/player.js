/**
 * Player Model - Socket.IO Session Handler
 *
 * Purpose: Manages temporary Socket.IO connection sessions
 * Scope: In-memory only, not persisted to database
 * Lifespan: While user is connected to Socket.IO
 *
 * Note: For persistent user data (stats, NFTs, matches), use User model
 */
class Player {
  constructor(socketId, username, userId = null) {
    this.id = socketId;
    this.username = username || `Player-${socketId.slice(0, 5)}`;
    this.userId = userId; // Link to User model for persistent data
    this.isReady = false;
    this.currentRoom = null;
    this.joinedAt = new Date();
    // Session-only game state (temporary, not persistent)
    this.gameState = {
      position: { x: 0, y: 0 },
      score: 0,
      powerups: [],
    };
  }

  // Pure data transformation only - no business logic
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      userId: this.userId,
      isReady: this.isReady,
      currentRoom: this.currentRoom,
      joinedAt: this.joinedAt.toISOString(),
    };
  }
}

module.exports = Player;
