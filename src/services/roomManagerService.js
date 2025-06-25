const GameRoom = require("../models/gameRoom");

class RoomManagerService {
  constructor() {
    this.gameRooms = new Map();
    this.waitingPlayers = new Set();
    this.roomCodes = new Map(); // Map: code -> roomId
    this.roomToCode = new Map(); // Map: roomId -> code
  }

  /**
   * Generate a unique 6-character room code
   */
  generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code;
    let attempts = 0;

    do {
      code = "";
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      attempts++;
    } while (this.roomCodes.has(code) && attempts < 100);

    if (attempts >= 100) {
      throw new Error("Unable to generate unique room code");
    }

    return code;
  }

  /**
   * Get room by code
   */
  getRoomByCode(code) {
    const roomId = this.roomCodes.get(code);
    return roomId ? this.gameRooms.get(roomId) : null;
  }

  /**
   * Get code for room
   */
  getCodeForRoom(roomId) {
    return this.roomToCode.get(roomId);
  }

  /**
   * Create a new game room
   */
  createRoom(roomData = {}) {
    const roomId = this.generateRoomId();
    const room = new GameRoom(roomId);

    // Generate and assign room code
    const roomCode = this.generateRoomCode();
    room.code = roomCode;

    // Apply any custom settings
    if (roomData.settings) {
      Object.assign(room.settings, roomData.settings);
    }

    // Store room and code mappings
    this.gameRooms.set(roomId, room);
    this.roomCodes.set(roomCode, roomId);
    this.roomToCode.set(roomId, roomCode);

    console.log(`Room created: ${roomId} with code: ${roomCode}`);
    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId) {
    return this.gameRooms.get(roomId);
  }

  /**
   * Delete room
   */
  deleteRoom(roomId) {
    // Clean up code mappings
    const roomCode = this.roomToCode.get(roomId);
    if (roomCode) {
      this.roomCodes.delete(roomCode);
      this.roomToCode.delete(roomId);
    }

    return this.gameRooms.delete(roomId);
  }

  /**
   * Find available room for matchmaking
   */
  findAvailableRoom() {
    for (let room of this.gameRooms.values()) {
      if (!room.isFull() && room.status === "waiting") {
        return room;
      }
    }
    return null;
  }

  /**
   * Get all rooms (with pagination)
   */
  async getAvailableRooms({ page = 1, limit = 10, gameMode }) {
    const rooms = Array.from(this.gameRooms.values())
      .filter((room) => room.status === "waiting" && !room.isFull())
      .slice((page - 1) * limit, page * limit)
      .map((room) => room.toJSON());

    return {
      rooms,
      total: Array.from(this.gameRooms.values()).filter(
        (room) => room.status === "waiting"
      ).length,
    };
  }

  /**
   * Get all rooms for admin
   */
  async getAllRooms() {
    return Array.from(this.gameRooms.values()).map((room) => room.toJSON());
  }

  /**
   * Matchmaking - find or create room for player
   */
  findMatch(player) {
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

    this.waitingPlayers.delete(player.id);

    return {
      success: true,
      room: room,
      player: player,
    };
  }

  /**
   * Remove player from room
   */
  leaveRoom(player) {
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    const result = room.removePlayer(player.id);
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

  /**
   * Join specific room by code
   */
  async joinRoomByCode(player, roomCode) {
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    if (player.currentRoom) {
      return { success: false, reason: "Player already in a room" };
    }

    const room = this.getRoomByCode(roomCode.toUpperCase());
    if (!room) {
      return { success: false, reason: "Invalid room code" };
    }

    if (room.players.length >= room.maxPlayers) {
      return { success: false, reason: "Room is full" };
    }

    if (room.status !== "waiting") {
      return { success: false, reason: "Game already in progress" };
    }

    const result = room.addPlayer(player);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      room: room.toJSON(),
      player: player.toJSON(),
      message: `Successfully joined room ${roomCode}`,
    };
  }

  /**
   * Join specific room by ID (legacy support)
   */
  async joinSpecificRoom(player, roomId) {
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

    const result = room.addPlayer(player);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      room: room.toJSON(),
      player: player.toJSON(),
    };
  }

  /**
   * Leave specific room by ID
   */
  async leaveSpecificRoom(player, roomId) {
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    const result = room.removePlayer(player.id);
    if (!result.success) {
      return result;
    }

    // Clean up empty room
    if (result.isEmpty) {
      this.deleteRoom(roomId);
    }

    return {
      success: true,
      message: "Left room successfully",
    };
  }

  /**
   * Toggle player ready status
   */
  togglePlayerReady(player) {
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(player.currentRoom);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    // Don't allow ready changes if game is already in progress
    if (room.status !== "waiting") {
      return {
        success: false,
        reason: `Cannot change ready status - game is ${room.status}`,
      };
    }

    player.isReady = !player.isReady;
    console.log(
      `Player ${player.username} ready status changed to: ${player.isReady}`
    );

    return {
      success: true,
      player: player,
      room: room,
      canStart: room.canStart(),
    };
  }

  /**
   * Start game in room
   */
  startGame(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    if (room.players.length < 2) {
      return { success: false, reason: "Need 2 players to start" };
    }

    if (!room.canStart()) {
      return { success: false, reason: "Cannot start game" };
    }

    room.status = "playing";
    room.startedAt = new Date();
    room.gameState.isActive = true;
    room.gameState.score = { player1: 0, player2: 0 };
    room.gameState.gameTime = 120; // 2 minutes game duration

    // Initialize player positions
    room.gameState.players.player1.x = 150;
    room.gameState.players.player1.y = 320;
    room.gameState.players.player2.x = 650;
    room.gameState.players.player2.y = 320;

    console.log(`Game started in room ${roomId}`);
    return {
      success: true,
      room: room,
      message: "2D Head Ball match started with real-time physics!",
    };
  }

  /**
   * End game in room
   */
  endGame(roomId, winnerId = null) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    room.status = "finished";
    room.endedAt = new Date();
    room.gameState.isActive = false;

    const winner = winnerId
      ? room.players.find((p) => p.id === winnerId)
      : null;
    const finalScore = room.gameState.score;

    return {
      success: true,
      room: room,
      winner: winner,
      finalScore: finalScore,
    };
  }

  /**
   * Get room statistics
   */
  getRoomStats() {
    return {
      totalRooms: this.gameRooms.size,
      waitingRooms: Array.from(this.gameRooms.values()).filter(
        (room) => room.status === "waiting"
      ).length,
      activeRooms: Array.from(this.gameRooms.values()).filter(
        (room) => room.status === "playing"
      ).length,
      waitingPlayers: this.waitingPlayers.size,
    };
  }

  /**
   * Generate unique room ID
   */
  generateRoomId() {
    return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new RoomManagerService();
