const Kalm = require('kalm-js');
const http = require('http');
const httpProxy = require('http-proxy-middleware');

/**
 * Kalm Network Optimization Proxy for metaHead Arena
 * Provides bandwidth optimization, congestion control, and high-frequency update optimization
 */

class KalmGameProxy {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3002,
      colyseusTarget: options.colyseusTarget || 'http://localhost:3001',
      
      // Kalm configuration
      kalm: {
        bundleTimeout: options.bundleTimeout || 16, // 16ms = ~60fps
        bundleByPackets: options.bundleByPackets || 10,
        maxBufferSize: options.maxBufferSize || 1024 * 64, // 64KB
        
        // Network optimization
        compression: true,
        bundling: true,
        
        // High-frequency update optimization
        priorityChannels: ['position', 'ball_state'],
        throttleChannels: ['timer_update', 'game_status']
      },
      
      // Bandwidth management
      bandwidth: {
        perClientLimit: options.perClientLimit || 1024 * 100, // 100KB/s per client
        adaptiveCompression: true,
        prioritizeGameplay: true
      },
      
      // Congestion control
      congestion: {
        enabled: true,
        dropThreshold: 0.85, // Drop non-critical packets at 85% capacity
        backpressureThreshold: 0.75,
        adaptiveQuality: true
      }
    };
    
    // Kalm server instance
    this.kalmServer = null;
    this.httpServer = null;
    this.proxy = null;
    
    // Client connection management
    this.clients = new Map();
    this.connectionStats = {
      totalConnections: 0,
      activeConnections: 0,
      totalBandwidth: 0,
      droppedPackets: 0
    };
    
    // Message prioritization
    this.messagePriorities = {
      // Critical (never drop)
      'player_ready': 100,
      'goal_scored': 100,
      'game_started': 100,
      'game_ended': 100,
      'error': 100,
      
      // High priority (rarely drop)
      'player_position': 80,
      'ball_state': 80,
      'player_joined': 75,
      
      // Medium priority
      'timer_update': 50,
      'room_state': 50,
      
      // Low priority (can drop under load)
      'game_status': 25,
      'stats_update': 10
    };
  }

  /**
   * Start the Kalm proxy server
   */
  async start() {
    try {
      console.log(`[KALM] Starting Kalm proxy server on port ${this.options.port}...`);
      
      // Create HTTP server
      this.httpServer = http.createServer();
      
      // Setup HTTP proxy for REST API calls
      this.setupHttpProxy();
      
      // Create Kalm server
      this.kalmServer = new Kalm.Server({
        port: this.options.port,
        server: this.httpServer,
        ...this.options.kalm
      });
      
      // Setup Kalm event handlers
      this.setupKalmHandlers();
      
      // Start the server
      await new Promise((resolve, reject) => {
        this.httpServer.listen(this.options.port, (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      
      console.log(`[KALM] ✅ Kalm proxy server running on port ${this.options.port}`);
      console.log(`[KALM] Proxying to Colyseus at ${this.options.colyseusTarget}`);
      
      // Start background optimization tasks
      this.startOptimizationTasks();
      
    } catch (error) {
      console.error('[KALM] ❌ Failed to start Kalm proxy:', error);
      throw error;
    }
  }

  /**
   * Setup HTTP proxy for REST API and WebSocket upgrade requests
   */
  setupHttpProxy() {
    this.proxy = httpProxy.createProxyMiddleware({
      target: this.options.colyseusTarget,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying
      
      // Custom logic for optimization
      onProxyReq: (proxyReq, req, res) => {
        // Add optimization headers
        proxyReq.setHeader('X-Kalm-Proxy', 'true');
        proxyReq.setHeader('X-Kalm-Version', '1.0');
      },
      
      onProxyRes: (proxyRes, req, res) => {
        // Add CORS headers if needed
        proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      },
      
      onError: (err, req, res) => {
        console.error('[KALM] Proxy error:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Kalm proxy error');
      }
    });
    
    // Apply proxy to HTTP server
    this.httpServer.on('request', this.proxy);
    this.httpServer.on('upgrade', this.proxy.upgrade);
  }

  /**
   * Setup Kalm server event handlers
   */
  setupKalmHandlers() {
    // Client connection
    this.kalmServer.on('connection', (client) => {
      this.handleClientConnection(client);
    });
    
    // Client disconnection
    this.kalmServer.on('disconnection', (client) => {
      this.handleClientDisconnection(client);
    });
    
    // Message routing and optimization
    this.kalmServer.on('message', (client, channel, payload) => {
      this.handleMessage(client, channel, payload);
    });
    
    // Error handling
    this.kalmServer.on('error', (error) => {
      console.error('[KALM] Server error:', error);
    });
  }

  /**
   * Handle new client connection
   */
  handleClientConnection(client) {
    console.log(`[KALM] Client connected: ${client.id}`);
    
    const clientData = {
      id: client.id,
      connectedAt: Date.now(),
      bandwidthUsed: 0,
      messagesSent: 0,
      messagesReceived: 0,
      lastActivity: Date.now(),
      
      // Quality adaptation
      quality: 'high', // high, medium, low
      adaptiveSettings: {
        positionUpdateRate: 60, // Hz
        compressionLevel: 1 // 1-9
      },
      
      // Congestion control
      congestionState: 'normal', // normal, backpressure, congested
      droppedMessages: 0
    };
    
    this.clients.set(client.id, clientData);
    this.connectionStats.activeConnections++;
    this.connectionStats.totalConnections++;
    
    // Setup client-specific optimizations
    this.setupClientOptimizations(client, clientData);
    
    // Create Colyseus connection proxy
    this.createColyseusProxy(client);
  }

  /**
   * Handle client disconnection
   */
  handleClientDisconnection(client) {
    console.log(`[KALM] Client disconnected: ${client.id}`);
    
    const clientData = this.clients.get(client.id);
    if (clientData) {
      console.log(`[KALM] Client ${client.id} stats:`, {
        duration: (Date.now() - clientData.connectedAt) / 1000,
        messagesSent: clientData.messagesSent,
        messagesReceived: clientData.messagesReceived,
        bandwidthUsed: clientData.bandwidthUsed,
        droppedMessages: clientData.droppedMessages
      });
    }
    
    this.clients.delete(client.id);
    this.connectionStats.activeConnections--;
  }

  /**
   * Setup client-specific optimizations
   */
  setupClientOptimizations(client, clientData) {
    // Adaptive quality based on connection
    this.adaptClientQuality(client, clientData);
    
    // Bandwidth monitoring
    this.monitorClientBandwidth(client, clientData);
    
    // Setup message bundling for high-frequency updates
    this.setupMessageBundling(client, clientData);
  }

  /**
   * Create proxy connection to Colyseus for this client
   */
  createColyseusProxy(client) {
    // Create WebSocket connection to Colyseus
    const colyseusWsUrl = this.options.colyseusTarget.replace('http', 'ws');
    
    // For demonstration - in real implementation, you'd create actual WebSocket proxy
    console.log(`[KALM] Creating Colyseus proxy for client ${client.id} -> ${colyseusWsUrl}`);
    
    // Store proxy reference for message forwarding
    client.colyseusProxy = {
      url: colyseusWsUrl,
      connected: true,
      lastMessage: Date.now()
    };
  }

  /**
   * Handle incoming messages with optimization
   */
  handleMessage(client, channel, payload) {
    const clientData = this.clients.get(client.id);
    if (!clientData) return;
    
    clientData.messagesReceived++;
    clientData.lastActivity = Date.now();
    
    // Check message priority
    const priority = this.messagePriorities[channel] || 50;
    
    // Apply congestion control
    if (this.shouldDropMessage(client, clientData, channel, priority)) {
      clientData.droppedMessages++;
      this.connectionStats.droppedPackets++;
      console.log(`[KALM] Dropped low-priority message: ${channel} for client ${client.id}`);
      return;
    }
    
    // Optimize message based on type
    const optimizedPayload = this.optimizeMessage(channel, payload, clientData);
    
    // Apply compression if beneficial
    const finalPayload = this.applyCompression(optimizedPayload, clientData);
    
    // Forward to Colyseus (in real implementation)
    this.forwardToColyseus(client, channel, finalPayload);
    
    // Update bandwidth tracking
    this.updateBandwidthUsage(clientData, finalPayload);
  }

  /**
   * Determine if message should be dropped due to congestion
   */
  shouldDropMessage(client, clientData, channel, priority) {
    // Never drop critical messages
    if (priority >= 100) return false;
    
    // Check client congestion state
    if (clientData.congestionState === 'normal') return false;
    
    // Drop based on priority and congestion level
    if (clientData.congestionState === 'backpressure' && priority < 30) {
      return Math.random() < 0.3; // 30% drop rate
    }
    
    if (clientData.congestionState === 'congested' && priority < 70) {
      return Math.random() < 0.6; // 60% drop rate
    }
    
    return false;
  }

  /**
   * Optimize message payload based on type and client state
   */
  optimizeMessage(channel, payload, clientData) {
    switch (channel) {
      case 'player_position':
        return this.optimizePositionUpdate(payload, clientData);
        
      case 'ball_state':
        return this.optimizeBallUpdate(payload, clientData);
        
      case 'timer_update':
        return this.optimizeTimerUpdate(payload, clientData);
        
      default:
        return payload;
    }
  }

  /**
   * Optimize position updates based on client quality settings
   */
  optimizePositionUpdate(payload, clientData) {
    if (clientData.quality === 'low') {
      // Reduce precision for low-quality connections
      return {
        ...payload,
        player: {
          x: Math.round(payload.player.x / 5) * 5, // 5-pixel precision
          y: Math.round(payload.player.y / 5) * 5,
          velocityX: Math.round(payload.player.velocityX / 10) * 10,
          velocityY: Math.round(payload.player.velocityY / 10) * 10
        }
      };
    }
    
    return payload;
  }

  /**
   * Optimize ball state updates
   */
  optimizeBallUpdate(payload, clientData) {
    if (clientData.quality === 'low') {
      // Reduce ball position precision
      return {
        ...payload,
        ball: {
          x: Math.round(payload.ball.x / 2) * 2,
          y: Math.round(payload.ball.y / 2) * 2,
          velocityX: Math.round(payload.ball.velocityX / 5) * 5,
          velocityY: Math.round(payload.ball.velocityY / 5) * 5
        }
      };
    }
    
    return payload;
  }

  /**
   * Optimize timer updates (can be throttled)
   */
  optimizeTimerUpdate(payload, clientData) {
    // Round to nearest 0.1 seconds for bandwidth saving
    return {
      ...payload,
      gameTime: Math.round(payload.gameTime * 10) / 10
    };
  }

  /**
   * Apply compression to payload
   */
  applyCompression(payload, clientData) {
    if (!this.options.bandwidth.adaptiveCompression) {
      return payload;
    }
    
    // Simple compression - remove unnecessary fields based on client state
    if (clientData.quality === 'low') {
      // Remove timestamp for low-quality connections
      const { timestamp, ...compressedPayload } = payload;
      return compressedPayload;
    }
    
    return payload;
  }

  /**
   * Forward message to Colyseus (placeholder)
   */
  forwardToColyseus(client, channel, payload) {
    // In real implementation, forward via WebSocket proxy
    console.log(`[KALM] Forwarding ${channel} to Colyseus for client ${client.id}`);
  }

  /**
   * Update bandwidth usage tracking
   */
  updateBandwidthUsage(clientData, payload) {
    const messageSize = JSON.stringify(payload).length;
    clientData.bandwidthUsed += messageSize;
    this.connectionStats.totalBandwidth += messageSize;
    
    // Check if client exceeds bandwidth limit
    const timeDiff = (Date.now() - clientData.connectedAt) / 1000;
    const bandwidthRate = clientData.bandwidthUsed / timeDiff;
    
    if (bandwidthRate > this.options.bandwidth.perClientLimit) {
      this.adaptClientQuality(null, clientData, 'reduce');
    }
  }

  /**
   * Adapt client quality based on connection conditions
   */
  adaptClientQuality(client, clientData, action = 'auto') {
    const currentQuality = clientData.quality;
    let newQuality = currentQuality;
    
    if (action === 'reduce' || (action === 'auto' && this.detectCongestion(clientData))) {
      // Reduce quality
      if (currentQuality === 'high') newQuality = 'medium';
      else if (currentQuality === 'medium') newQuality = 'low';
    } else if (action === 'auto' && this.canIncreaseQuality(clientData)) {
      // Increase quality
      if (currentQuality === 'low') newQuality = 'medium';
      else if (currentQuality === 'medium') newQuality = 'high';
    }
    
    if (newQuality !== currentQuality) {
      console.log(`[KALM] Adapting client ${clientData.id} quality: ${currentQuality} -> ${newQuality}`);
      clientData.quality = newQuality;
      
      // Update adaptive settings
      switch (newQuality) {
        case 'high':
          clientData.adaptiveSettings.positionUpdateRate = 60;
          clientData.adaptiveSettings.compressionLevel = 1;
          break;
        case 'medium':
          clientData.adaptiveSettings.positionUpdateRate = 30;
          clientData.adaptiveSettings.compressionLevel = 3;
          break;
        case 'low':
          clientData.adaptiveSettings.positionUpdateRate = 15;
          clientData.adaptiveSettings.compressionLevel = 6;
          break;
      }
    }
  }

  /**
   * Detect network congestion for a client
   */
  detectCongestion(clientData) {
    const timeDiff = (Date.now() - clientData.connectedAt) / 1000;
    const bandwidthRate = clientData.bandwidthUsed / timeDiff;
    
    return bandwidthRate > this.options.bandwidth.perClientLimit * 0.8;
  }

  /**
   * Check if client quality can be increased
   */
  canIncreaseQuality(clientData) {
    const timeDiff = (Date.now() - clientData.connectedAt) / 1000;
    const bandwidthRate = clientData.bandwidthUsed / timeDiff;
    
    return bandwidthRate < this.options.bandwidth.perClientLimit * 0.5;
  }

  /**
   * Setup message bundling for high-frequency updates
   */
  setupMessageBundling(client, clientData) {
    // Create bundle queues for different message types
    clientData.bundles = {
      position: [],
      ball_state: [],
      timer: []
    };
    
    // Setup periodic bundle flushing
    clientData.bundleTimer = setInterval(() => {
      this.flushMessageBundles(client, clientData);
    }, this.options.kalm.bundleTimeout);
  }

  /**
   * Flush bundled messages
   */
  flushMessageBundles(client, clientData) {
    Object.keys(clientData.bundles).forEach(bundleType => {
      const bundle = clientData.bundles[bundleType];
      
      if (bundle.length > 0) {
        // Send bundled messages
        const bundledPayload = {
          type: 'bundle',
          bundleType: bundleType,
          messages: bundle,
          timestamp: Date.now()
        };
        
        // Forward bundle to client
        this.sendToClient(client, 'bundle', bundledPayload);
        
        // Clear bundle
        clientData.bundles[bundleType] = [];
      }
    });
  }

  /**
   * Send message to client
   */
  sendToClient(client, channel, payload) {
    client.send(channel, payload);
  }

  /**
   * Monitor client bandwidth usage
   */
  monitorClientBandwidth(client, clientData) {
    // Bandwidth monitoring happens in updateBandwidthUsage
    // This is placeholder for additional monitoring logic
  }

  /**
   * Start background optimization tasks
   */
  startOptimizationTasks() {
    // Periodic quality adaptation
    setInterval(() => {
      this.runQualityAdaptation();
    }, 5000); // Every 5 seconds
    
    // Statistics logging
    setInterval(() => {
      this.logStatistics();
    }, 30000); // Every 30 seconds
    
    // Cleanup disconnected clients
    setInterval(() => {
      this.cleanupDisconnectedClients();
    }, 60000); // Every minute
  }

  /**
   * Run quality adaptation for all clients
   */
  runQualityAdaptation() {
    this.clients.forEach((clientData, clientId) => {
      this.adaptClientQuality(null, clientData, 'auto');
    });
  }

  /**
   * Log server statistics
   */
  logStatistics() {
    console.log('[KALM] Server Statistics:', {
      activeConnections: this.connectionStats.activeConnections,
      totalConnections: this.connectionStats.totalConnections,
      totalBandwidth: Math.round(this.connectionStats.totalBandwidth / 1024) + 'KB',
      droppedPackets: this.connectionStats.droppedPackets,
      uptime: Math.round(process.uptime()) + 's'
    });
  }

  /**
   * Cleanup disconnected clients
   */
  cleanupDisconnectedClients() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    
    this.clients.forEach((clientData, clientId) => {
      if (now - clientData.lastActivity > timeout) {
        console.log(`[KALM] Cleaning up inactive client: ${clientId}`);
        
        // Clear bundle timer
        if (clientData.bundleTimer) {
          clearInterval(clientData.bundleTimer);
        }
        
        this.clients.delete(clientId);
        this.connectionStats.activeConnections--;
      }
    });
  }

  /**
   * Get server statistics
   */
  getStatistics() {
    return {
      ...this.connectionStats,
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        quality: client.quality,
        bandwidthUsed: client.bandwidthUsed,
        messagesReceived: client.messagesReceived,
        droppedMessages: client.droppedMessages,
        congestionState: client.congestionState
      }))
    };
  }

  /**
   * Stop the Kalm proxy server
   */
  async stop() {
    console.log('[KALM] Stopping Kalm proxy server...');
    
    // Close all client connections
    this.clients.forEach((clientData, clientId) => {
      if (clientData.bundleTimer) {
        clearInterval(clientData.bundleTimer);
      }
    });
    
    // Close Kalm server
    if (this.kalmServer) {
      await this.kalmServer.close();
    }
    
    // Close HTTP server
    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(resolve);
      });
    }
    
    console.log('[KALM] ✅ Kalm proxy server stopped');
  }
}

module.exports = { KalmGameProxy };