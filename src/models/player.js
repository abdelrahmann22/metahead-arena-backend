class Player {
  constructor(socketId, username) {
    this.id = socketId;
    this.username = username || `Player-${socketId.slice(0, 5)}`;
    this.isReady = false;
    this.currentRoom = null;
    this.isOnline = true;
    this.joinedAt = new Date();
    this.stats = {
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      totalPlayTime: 0,
    };
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
      isReady: this.isReady,
      currentRoom: this.currentRoom,
      isOnline: this.isOnline,
      stats: this.stats,
      joinedAt: this.joinedAt.toISOString(),
    };
  }
}

module.exports = Player;
