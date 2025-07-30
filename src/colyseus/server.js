const express = require('express');
const { createServer } = require('http');
const { Server } = require('colyseus');
const { monitor } = require('@colyseus/monitor');
const { HeadballRoom } = require('./rooms/HeadballRoom');
const { authMiddleware } = require('./middleware/authMiddleware');

/**
 * Colyseus Server Configuration for metaHead Arena
 * Maintains compatibility with existing Express app and authentication
 */

class ColyseusGameServer {
  constructor(existingApp = null) {
    // Use existing Express app or create new one
    this.app = existingApp || express();
    this.server = createServer(this.app);
    this.gameServer = new Server({
      server: this.server,
      // Enable Express integration for existing REST endpoints
      express: this.app
    });

    this.setupMiddleware();
    this.registerRooms();
    this.setupMonitoring();
  }

  setupMiddleware() {
    // Apply JWT authentication middleware to all rooms
    this.gameServer.onAuth = authMiddleware;

    // Custom matchmaking logic
    this.gameServer.onJoinRoom = (roomName, options, client) => {
      console.log(`[COLYSEUS] Client ${client.id} joining ${roomName}`, options);
      
      // Preserve existing wallet-based player identification
      if (options.walletAddress && options.userId) {
        client.userData = {
          userId: options.userId,
          walletAddress: options.walletAddress,
          joinedAt: Date.now()
        };
      }
    };

    // Handle disconnections gracefully
    this.gameServer.onLeaveRoom = (roomName, client) => {
      console.log(`[COLYSEUS] Client ${client.id} left ${roomName}`);
    };
  }

  registerRooms() {
    // Register the main 1v1 headball room
    this.gameServer.define('headball_1v1', HeadballRoom, {
      maxClients: 2,
      allowReconnection: true,
      metadata: {
        gameMode: '1v1',
        competitive: true,
        antiCheat: true
      }
    });

    // Register practice room (single player)
    this.gameServer.define('headball_practice', HeadballRoom, {
      maxClients: 1,
      allowReconnection: false,
      metadata: {
        gameMode: 'practice',
        competitive: false,
        antiCheat: false
      }
    });
  }

  setupMonitoring() {
    // Colyseus monitor for debugging (only in development)
    if (process.env.NODE_ENV !== 'production') {
      this.app.use('/colyseus', monitor());
    }

    // Health check endpoint
    this.app.get('/colyseus/health', (req, res) => {
      const stats = {
        uptime: process.uptime(),
        rooms: this.gameServer.roomCount,
        connections: this.gameServer.ccuCount,
        timestamp: Date.now()
      };
      res.json(stats);
    });
  }

  async listen(port = 3001) {
    await this.gameServer.listen(port);
    console.log(`[COLYSEUS] Game server listening on port ${port}`);
    console.log(`[COLYSEUS] Monitor available at http://localhost:${port}/colyseus`);
    return this.server;
  }

  getGameServer() {
    return this.gameServer;
  }

  getExpressApp() {
    return this.app;
  }
}

module.exports = { ColyseusGameServer };