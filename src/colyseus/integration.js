const { ColyseusGameServer } = require('./server');

/**
 * Integration layer for gradual migration from Socket.IO to Colyseus
 * Allows running both systems in parallel during transition period
 */

class MigrationIntegration {
  constructor(expressApp) {
    this.expressApp = expressApp;
    this.colyseusServer = null;
    this.isColyseusEnabled = process.env.COLYSEUS_ENABLED === 'true';
    this.migrationMode = process.env.MIGRATION_MODE || 'parallel'; // 'parallel' or 'colyseus-only'
  }

  /**
   * Initialize Colyseus alongside existing Socket.IO
   */
  async initializeColyseus() {
    if (!this.isColyseusEnabled) {
      console.log('[MIGRATION] Colyseus disabled via environment variable');
      return;
    }

    try {
      console.log('[MIGRATION] Initializing Colyseus server...');
      
      // Create Colyseus server with existing Express app
      this.colyseusServer = new ColyseusGameServer(this.expressApp);
      
      // Start Colyseus on different port for parallel operation
      const colyseusPort = process.env.COLYSEUS_PORT || 3001;
      await this.colyseusServer.listen(colyseusPort);
      
      console.log(`[MIGRATION] ✅ Colyseus server running on port ${colyseusPort}`);
      
      // Add migration endpoints
      this.setupMigrationEndpoints();
      
    } catch (error) {
      console.error('[MIGRATION] ❌ Failed to initialize Colyseus:', error);
      throw error;
    }
  }

  /**
   * Setup REST endpoints for migration management
   */
  setupMigrationEndpoints() {
    // Endpoint to check migration status
    this.expressApp.get('/api/migration/status', (req, res) => {
      res.json({
        migrationMode: this.migrationMode,
        colyseusEnabled: this.isColyseusEnabled,
        colyseusRunning: !!this.colyseusServer,
        endpoints: {
          socketio: process.env.SOCKETIO_URL || 'ws://localhost:3000',
          colyseus: process.env.COLYSEUS_URL || 'ws://localhost:3001'
        }
      });
    });

    // Endpoint to join Colyseus room (for testing migration)
    this.expressApp.post('/api/colyseus/join', async (req, res) => {
      try {
        if (!this.colyseusServer) {
          return res.status(503).json({ error: 'Colyseus not available' });
        }

        const { roomName, options } = req.body;
        
        // Return connection info for client
        res.json({
          success: true,
          colyseusEndpoint: process.env.COLYSEUS_URL || 'ws://localhost:3001',
          roomName: roomName || 'headball_1v1',
          options: options || {}
        });

      } catch (error) {
        console.error('[MIGRATION] Error handling Colyseus join request:', error);
        res.status(500).json({ error: 'Failed to process join request' });
      }
    });

    // Endpoint for room statistics
    this.expressApp.get('/api/colyseus/stats', (req, res) => {
      if (!this.colyseusServer) {
        return res.status(503).json({ error: 'Colyseus not available' });
      }

      const gameServer = this.colyseusServer.getGameServer();
      
      res.json({
        rooms: gameServer.roomCount,
        connections: gameServer.ccuCount,
        uptime: process.uptime(),
        timestamp: Date.now()
      });
    });
  }

  /**
   * Get Colyseus server instance
   */
  getColyseusServer() {
    return this.colyseusServer;
  }

  /**
   * Check if Colyseus is available
   */
  isColyseusAvailable() {
    return this.isColyseusEnabled && !!this.colyseusServer;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    if (this.colyseusServer) {
      console.log('[MIGRATION] Shutting down Colyseus server...');
      // Colyseus doesn't expose a direct shutdown method, but we can cleanup
      // The HTTP server will be closed by the main app shutdown process
    }
  }
}

module.exports = { MigrationIntegration };