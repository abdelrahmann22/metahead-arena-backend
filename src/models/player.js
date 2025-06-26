/**
 * Player Model - Socket.IO Session Handler
 *
 * Purpose: Manages temporary Socket.IO connection sessions
 * Scope: In-memory only, not persisted to database
 * Lifespan: While user is connected to Socket.IO
 *
 * Features: Session management, room assignment, ready state tracking
 *
 * Note: For persistent user data (stats, NFTs, matches), use User model
 */
class Player {
  /**
   * Create a new Player session
   * @param {string} socketId - Socket.IO connection ID
   * @param {string} walletAddress - User's wallet address
   * @param {string|null} userId - Link to User model ID (optional)
   */
  constructor(socketId, walletAddress, userId = null) {
    this.id = socketId;
    this.walletAddress = walletAddress || null;
    this.userId = userId; // Link to User model for persistent data
    this.isReady = false;
    this.currentRoom = null;
    this.position = null; // Track player position in room: "player1" or "player2"
    this.joinedAt = new Date();

    // Session-only game state (temporary, not persistent)
    this.gameState = {
      position: { x: 0, y: 0 },
      score: 0,
      powerups: [],
    };

    // NFT modifiers for gameplay (applied when NFT is equipped)
    this.nftModifiers = {
      speedMultiplier: 1.0,
      jumpMultiplier: 1.0,
      superkickMultiplier: 1.0,
    };
  }

  /**
   * Get display name from wallet address
   * @returns {string} Formatted username for display
   */
  get username() {
    if (this.walletAddress) {
      return `${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(
        -4
      )}`;
    }
    return `Guest-${this.id.slice(0, 5)}`;
  }

  /**
   * Convert player to JSON for API responses
   * @returns {Object} Serialized player data
   */
  toJSON() {
    return {
      id: this.id,
      username: this.username,
      walletAddress: this.walletAddress,
      userId: this.userId,
      isReady: this.isReady,
      currentRoom: this.currentRoom,
      position: this.position, // Include position in JSON output
      joinedAt: this.joinedAt.toISOString(),
      nftModifiers: this.nftModifiers,
    };
  }
}

module.exports = Player;
