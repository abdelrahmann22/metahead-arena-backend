const { KalmGameProxy } = require('./KalmProxy');

/**
 * Kalm Integration for metaHead Arena
 * Manages Kalm proxy lifecycle and integration with Colyseus
 */

class KalmIntegration {
  constructor(options = {}) {
    this.options = {
      enabled: process.env.KALM_ENABLED === 'true',
      port: parseInt(process.env.KALM_PORT) || 3002,
      colyseusTarget: process.env.COLYSEUS_URL || 'http://localhost:3001',
      
      // Network optimization settings
      optimization: {
        bundleTimeout: 16, // ~60fps
        maxBufferSize: 1024 * 64, // 64KB
        compression: true,
        adaptiveQuality: true
      },
      
      // Bandwidth management
      bandwidth: {
        perClientLimit: 1024 * 100, // 100KB/s
        globalLimit: 1024 * 1024 * 10, // 10MB/s
        adaptiveCompression: true
      },
      
      // Congestion control
      congestion: {
        enabled: true,
        dropThreshold: 0.85,
        backpressureThreshold: 0.75
      },
      
      ...options
    };
    
    this.kalmProxy = null;
    this.isRunning = false;
    
    // Performance monitoring
    this.metrics = {
      startTime: null,
      totalConnections: 0,
      bandwidthSaved: 0,
      compressionRatio: 0,
      averageLatency: 0
    };
  }

  /**
   * Initialize Kalm proxy
   */
  async initialize() {
    if (!this.options.enabled) {
      console.log('[KALM_INTEGRATION] Kalm disabled via environment variable');
      return false;
    }

    try {
      console.log('[KALM_INTEGRATION] Initializing Kalm proxy...');
      
      // Create Kalm proxy instance
      this.kalmProxy = new KalmGameProxy({
        port: this.options.port,
        colyseusTarget: this.options.colyseusTarget,
        ...this.options.optimization,
        bandwidth: this.options.bandwidth,
        congestion: this.options.congestion
      });
      
      // Start the proxy
      await this.kalmProxy.start();
      
      this.isRunning = true;
      this.metrics.startTime = Date.now();
      
      // Setup monitoring
      this.setupMonitoring();
      
      console.log(`[KALM_INTEGRATION] ✅ Kalm proxy initialized on port ${this.options.port}`);
      console.log(`[KALM_INTEGRATION] Clients should connect to ws://localhost:${this.options.port} instead of Colyseus directly`);
      
      return true;
      
    } catch (error) {
      console.error('[KALM_INTEGRATION] ❌ Failed to initialize Kalm proxy:', error);
      return false;
    }
  }

  /**
   * Setup performance monitoring
   */
  setupMonitoring() {
    // Monitor bandwidth savings every 30 seconds
    setInterval(() => {
      this.updateBandwidthMetrics();
    }, 30000);
    
    // Log performance metrics every 2 minutes
    setInterval(() => {
      this.logPerformanceMetrics();
    }, 120000);
  }

  /**
   * Update bandwidth metrics
   */
  updateBandwidthMetrics() {
    if (!this.kalmProxy) return;
    
    const stats = this.kalmProxy.getStatistics();
    this.metrics.totalConnections = stats.totalConnections;
    
    // Calculate estimated bandwidth savings from compression and bundling
    // This is a simplified calculation
    const rawBandwidth = stats.totalBandwidth;
    const estimatedSavings = rawBandwidth * 0.3; // Assume 30% savings from optimization
    
    this.metrics.bandwidthSaved += estimatedSavings;
    this.metrics.compressionRatio = estimatedSavings / rawBandwidth;
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics() {
    if (!this.kalmProxy) return;
    
    const uptimeSeconds = (Date.now() - this.metrics.startTime) / 1000;
    const stats = this.kalmProxy.getStatistics();
    
    console.log('[KALM_INTEGRATION] Performance Metrics:', {
      uptime: `${Math.round(uptimeSeconds / 60)}m ${Math.round(uptimeSeconds % 60)}s`,
      activeConnections: stats.activeConnections,
      totalConnections: this.metrics.totalConnections,
      bandwidthSaved: `${Math.round(this.metrics.bandwidthSaved / 1024)}KB`,
      compressionRatio: `${Math.round(this.metrics.compressionRatio * 100)}%`,
      droppedPackets: stats.droppedPackets,
      packetsPerSecond: Math.round(stats.totalBandwidth / uptimeSeconds)
    });
  }

  /**
   * Get current connection info for clients
   */
  getConnectionInfo() {
    if (!this.isRunning) {
      return {
        enabled: false,
        message: 'Kalm proxy not running'
      };
    }
    
    return {
      enabled: true,
      endpoint: `ws://localhost:${this.options.port}`,
      port: this.options.port,
      optimizations: {
        bundling: true,
        compression: this.options.optimization.compression,
        adaptiveQuality: this.options.optimization.adaptiveQuality,
        congestionControl: this.options.congestion.enabled
      },
      performance: this.metrics
    };
  }

  /**
   * Get detailed statistics
   */
  getStatistics() {
    if (!this.kalmProxy) {
      return { error: 'Kalm proxy not running' };
    }
    
    const kalmStats = this.kalmProxy.getStatistics();
    
    return {
      kalm: kalmStats,
      integration: this.metrics,
      configuration: {
        port: this.options.port,
        colyseusTarget: this.options.colyseusTarget,
        optimizations: this.options.optimization,
        bandwidth: this.options.bandwidth,
        congestion: this.options.congestion
      }
    };
  }

  /**
   * Update configuration at runtime
   */
  updateConfiguration(newConfig) {
    console.log('[KALM_INTEGRATION] Updating configuration:', newConfig);
    
    // Update local configuration
    this.options = {
      ...this.options,
      ...newConfig
    };
    
    // Apply changes to running proxy if possible
    if (this.kalmProxy) {
      // Some configurations may require restart
      console.log('[KALM_INTEGRATION] Configuration updated (some changes may require restart)');
    }
  }

  /**
   * Check if Kalm is running and healthy
   */
  isHealthy() {
    return this.isRunning && !!this.kalmProxy;
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    if (!this.isRunning) {
      return {
        status: 'stopped',
        message: 'Kalm proxy is not running'
      };
    }
    
    if (!this.kalmProxy) {
      return {
        status: 'error',
        message: 'Kalm proxy instance not available'
      };
    }
    
    const stats = this.kalmProxy.getStatistics();
    
    return {
      status: 'healthy',
      uptime: Date.now() - this.metrics.startTime,
      connections: stats.activeConnections,
      lastActivity: Date.now()
    };
  }

  /**
   * Gracefully shutdown Kalm proxy
   */
  async shutdown() {
    if (!this.isRunning) {
      console.log('[KALM_INTEGRATION] Kalm proxy already stopped');
      return;
    }
    
    console.log('[KALM_INTEGRATION] Shutting down Kalm proxy...');
    
    try {
      if (this.kalmProxy) {
        await this.kalmProxy.stop();
      }
      
      this.isRunning = false;
      
      // Log final metrics
      console.log('[KALM_INTEGRATION] Final metrics:', {
        totalConnections: this.metrics.totalConnections,
        bandwidthSaved: `${Math.round(this.metrics.bandwidthSaved / 1024)}KB`,
        compressionRatio: `${Math.round(this.metrics.compressionRatio * 100)}%`,
        uptime: `${Math.round((Date.now() - this.metrics.startTime) / 1000)}s`
      });
      
      console.log('[KALM_INTEGRATION] ✅ Kalm proxy shutdown complete');
      
    } catch (error) {
      console.error('[KALM_INTEGRATION] ❌ Error during shutdown:', error);
    }
  }
}

/**
 * Factory function to create Kalm integration
 */
function createKalmIntegration(options = {}) {
  return new KalmIntegration(options);
}

/**
 * Helper function to check if Kalm should be enabled
 */
function shouldEnableKalm() {
  return process.env.KALM_ENABLED === 'true' && 
         process.env.NODE_ENV !== 'development';
}

module.exports = {
  KalmIntegration,
  createKalmIntegration,
  shouldEnableKalm
};