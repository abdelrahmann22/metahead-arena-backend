const GameRoom = require("../models/gameRoom");

/**
 * @fileoverview Room Manager Service
 * @description Service for managing game rooms, matchmaking, and player coordination
 * @module services/roomManagerService
 */

/**
 * Room Manager Service - Handles room lifecycle, player management, and game state
 * @class RoomManagerService
 */
class RoomManagerService {
  constructor() {
    this.gameRooms = new Map(); // roomId -> GameRoom
    this.roomCodes = new Map(); // roomCode -> roomId
    this.waitingPlayers = new Set(); // Set of player IDs waiting for matches
  }

  /**
   * Generate 6-character room code
   */
  generateRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding I, O, 0, 1 for clarity
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Ensure uniqueness
    if (this.roomCodes.has(result)) {
      return this.generateRoomCode();
    }

    return result;
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
    for (let [code, id] of this.roomCodes.entries()) {
      if (id === roomId) return code;
    }
    return null;
  }

  /**
   * Create new game room
   */
  createRoom(roomData = {}) {
    const roomId = this.generateRoomId();
    const roomCode = this.generateRoomCode();

    const room = new GameRoom(roomId);
    room.code = roomCode;

    // Apply any custom room settings
    if (roomData.maxPlayers) room.maxPlayers = roomData.maxPlayers;
    if (roomData.settings) Object.assign(room.settings, roomData.settings);

    this.gameRooms.set(roomId, room);
    this.roomCodes.set(roomCode, roomId);

    return room;
  }

  /**
   * Get room by ID
   */
  getRoom(roomId) {
    return this.gameRooms.get(roomId);
  }

  /**
   * Delete room and cleanup
   */
  deleteRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return false;

    // Remove room code mapping
    if (room.code) {
      this.roomCodes.delete(room.code);
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
   * Reset room to waiting state (useful for troubleshooting stuck rooms)
   */
  resetRoomToWaiting(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    // Only reset if room is in a problematic state
    if (room.status === "playing" && !room.gameState.isActive) {
      console.log(
        `Resetting stuck room ${roomId} from ${room.status} to waiting`
      );
      room.status = "waiting";
      room.gameState.isActive = false;
      room.startedAt = null;

      // Reset player ready states
      room.players.forEach((player) => {
        player.isReady = false;
      });

      return { success: true, room };
    }

    return {
      success: false,
      reason: `Room ${roomId} is not in a resettable state (${room.status})`,
    };
  }

  /**
   * Matchmaking - find or create room for player
   */
  findMatch(player) {
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    // If player is in a room, check if it's finished
    if (player.currentRoom) {
      const currentRoom = this.getRoom(player.currentRoom);

      if (currentRoom && currentRoom.status === "finished") {
        // Automatically remove player from finished room
        console.log(
          `Auto-removing player ${player.username} from finished room ${currentRoom.id} to allow new match`
        );
        const leaveResult = this.leaveRoom(player);

        if (!leaveResult.success) {
          console.error(
            `Failed to auto-remove player from finished room: ${leaveResult.reason}`
          );
          return {
            success: false,
            reason: `Cannot leave finished room: ${leaveResult.reason}`,
          };
        }

        console.log(
          `Player ${player.username} successfully removed from finished room`
        );
      } else if (currentRoom) {
        // Player is in an active room
        return { success: false, reason: "Player already in a room" };
      } else {
        // Room doesn't exist anymore, clear the reference
        console.log(
          `Clearing stale room reference for player ${player.username}`
        );
        player.currentRoom = null;
      }
    }

    // Find existing room or create a new one
    let room = this.findAvailableRoom();
    if (!room) {
      room = this.createRoom();
    }

    // Ensure the room is in the correct state for new players
    if (room.status !== "waiting") {
      console.log(
        `Found room ${room.id} in status ${room.status}, checking if it needs reset...`
      );

      // If room is "playing" but game is not active, it's stuck - reset it
      if (room.status === "playing" && !room.gameState.isActive) {
        console.log(`Resetting stuck room ${room.id} to waiting state`);
        const resetResult = this.resetRoomToWaiting(room.id);
        if (!resetResult.success) {
          console.log(
            `Could not reset room ${room.id}, creating new room instead`
          );
          room = this.createRoom();
        }
      } else {
        // Room is in another problematic state, create a new room
        console.log(
          `Room ${room.id} is in ${room.status} state, creating new room instead`
        );
        room = this.createRoom();
      }
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
      console.log(`Deleting empty room ${room.id} after player left`);
      this.deleteRoom(room.id);
    } else if (room.status === "finished" && !room.rematchState.timeoutActive) {
      // If game is finished, someone leaves, and no rematch timer running, delete room immediately
      console.log(`Deleting finished room ${room.id} after player left`);
      this.deleteRoom(room.id);
    }

    return {
      success: true,
      player: result.player,
      room: room,
    };
  }

  /**
   * Join room using 6-character code
   */
  async joinRoomByCode(player, roomCode) {
    if (!player) {
      return { success: false, reason: "Player not found" };
    }

    // If player is in a room, check if it's finished
    if (player.currentRoom) {
      const currentRoom = this.getRoom(player.currentRoom);

      if (currentRoom && currentRoom.status === "finished") {
        // Automatically remove player from finished room
        console.log(
          `Auto-removing player ${player.username} from finished room ${currentRoom.id} to join new room`
        );
        const leaveResult = this.leaveRoom(player);

        if (!leaveResult.success) {
          console.error(
            `Failed to auto-remove player from finished room: ${leaveResult.reason}`
          );
          return {
            success: false,
            reason: `Cannot leave finished room: ${leaveResult.reason}`,
          };
        }

        console.log(
          `Player ${player.username} successfully removed from finished room`
        );
      } else if (currentRoom) {
        // Player is in an active room
        return { success: false, reason: "Player already in a room" };
      } else {
        // Room doesn't exist anymore, clear the reference
        console.log(
          `Clearing stale room reference for player ${player.username}`
        );
        player.currentRoom = null;
      }
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
      const message = `Cannot change ready status - game is ${room.status}`;
      console.log(`${message} for player ${player.username}`);
      return {
        success: false,
        reason: message,
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
    room.gameState.gameTime = 30; // 30 seconds game duration

    console.log(`Game started in room ${roomId}`);
    return {
      success: true,
      room: room,
      message: "2D Head Ball match started!",
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
   * Handle rematch request
   */
  requestRematch(player, roomId) {
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    if (room.status !== "finished") {
      return { success: false, reason: "Game is not finished" };
    }

    // Determine which player is requesting
    const playerPosition = player.position; // "player1" or "player2"
    if (!playerPosition) {
      return { success: false, reason: "Player position not found" };
    }

    // Set rematch request
    if (playerPosition === "player1") {
      room.rematchState.player1Requested = true;
    } else if (playerPosition === "player2") {
      room.rematchState.player2Requested = true;
    }

    console.log(
      `${player.username} (${playerPosition}) requested rematch in room ${roomId}`
    );

    // Check if both players have requested rematch
    const bothRequested =
      room.rematchState.player1Requested && room.rematchState.player2Requested;

    return {
      success: true,
      player: player.toJSON(),
      room: room.toJSON(),
      bothRequested,
      rematchState: room.rematchState,
    };
  }

  /**
   * Decline rematch request
   */
  declineRematch(player, roomId) {
    if (!player || !player.currentRoom) {
      return { success: false, reason: "Player not in a room" };
    }

    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    if (room.status !== "finished") {
      return { success: false, reason: "Game is not finished" };
    }

    console.log(`${player.username} declined rematch in room ${roomId}`);

    return {
      success: true,
      player: player.toJSON(),
      room: room.toJSON(),
      declined: true,
    };
  }

  /**
   * Execute rematch (reset room state)
   */
  executeRematch(roomId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: "Room not found" };
    }

    if (room.status !== "finished") {
      return { success: false, reason: "Game is not finished" };
    }

    if (
      !room.rematchState.player1Requested ||
      !room.rematchState.player2Requested
    ) {
      return { success: false, reason: "Both players must request rematch" };
    }

    // Reset room for rematch
    room.resetForRematch();

    console.log(
      `Rematch executed for room ${roomId} - room reset to waiting state`
    );

    return {
      success: true,
      room: room.toJSON(),
      message: "Rematch confirmed! Get ready for another round!",
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
