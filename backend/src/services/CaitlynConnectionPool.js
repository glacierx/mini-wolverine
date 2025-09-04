import EventEmitter from 'events';
import logger from '../utils/logger.js';
import CaitlynClientConnection from '../utils/CaitlynClientConnection.js';

/**
 * Enhanced Connection Pool using CaitlynClientConnection pattern
 * 
 * This pool manages fully initialized CaitlynClientConnection instances
 * that handle their own WASM operations, initialization, and message handling.
 * 
 * Benefits:
 * - Each connection is fully autonomous with complete initialization
 * - Proven initialization pattern from CaitlynClientConnection
 * - Better resource isolation and memory management
 * - Event-driven architecture for better coordination
 */
class CaitlynConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Pool configuration
    this.poolSize = options.poolSize || 3;
    this.maxPoolSize = options.maxPoolSize || 5;
    this.connectionTimeout = options.connectionTimeout || 60000; // Longer for full initialization
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 3;
    
    // Pool state
    this.connections = new Map(); // connectionId -> CaitlynClientConnection
    this.availableConnections = new Set(); // Set of connection IDs
    this.busyConnections = new Set(); // Set of connection IDs
    this.pendingRequests = []; // Queue of {resolve, reject, timestamp}
    
    // Pool metadata
    this.connectionIdCounter = 0;
    this.url = null;
    this.token = null;
    this.isShuttingDown = false;
    this.isInitialized = false;
    
    // Shared data from first connection
    this.sharedSchema = null;
    this.sharedMarkets = null;
    this.sharedSecurities = null;
  }

  /**
   * Initialize the connection pool with CaitlynClientConnection instances
   */
  async initialize(url, token, wasmJsPath = './public/caitlyn_js.js', wasmPath = './public/caitlyn_js.wasm') {
    if (this.isInitialized) {
      logger.warn('Connection pool already initialized');
      return true;
    }

    this.url = url;
    this.token = token;
    
    logger.info(`🚀 Initializing CaitlynConnectionPool with ${this.poolSize} connections`);
    logger.info(`   URL: ${url}`);
    logger.info(`   WASM paths: ${wasmJsPath}, ${wasmPath}`);
    
    // Create initial connections
    const connectionPromises = [];
    for (let i = 0; i < this.poolSize; i++) {
      connectionPromises.push(this.createConnection(wasmJsPath, wasmPath));
    }
    
    try {
      const createdConnections = await Promise.all(connectionPromises);
      const successCount = createdConnections.filter(conn => conn !== null).length;
      
      if (successCount === 0) {
        throw new Error('Failed to create any connections');
      }
      
      logger.info(`✅ Connection pool initialized with ${successCount}/${this.poolSize} connections`);
      logger.info(`⏳ Waiting for universe initialization to complete...`);
      this.isInitialized = true;
      
      // Don't emit pool_ready immediately - wait for seeds_loaded event
      // The pool_ready event will be emitted when seeds are actually loaded
      
      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Create a new CaitlynClientConnection instance
   */
  async createConnection(wasmJsPath, wasmPath) {
    const connectionId = `conn_${++this.connectionIdCounter}`;
    
    logger.info(`🔧 Creating connection ${connectionId}...`);
    
    try {
      // Create CaitlynClientConnection instance
      const connection = new CaitlynClientConnection({
        url: this.url,
        token: this.token,
        logger: logger
      });

      // Set up event handlers
      this.setupConnectionEventHandlers(connection, connectionId);

      // Load WASM and connect with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Connection ${connectionId} initialization timed out`)), this.connectionTimeout);
      });

      const initPromise = (async () => {
        // Load WASM module
        await connection.loadWasmModule(wasmJsPath, wasmPath);
        logger.info(`✅ WASM loaded for connection ${connectionId}`);
        
        // Connect and initialize
        await connection.connect();
        logger.info(`✅ Connection ${connectionId} fully initialized`);
        
        return connection;
      })();

      const initializedConnection = await Promise.race([initPromise, timeoutPromise]);

      // Store connection
      this.connections.set(connectionId, initializedConnection);
      this.availableConnections.add(connectionId);
      
      // Store shared data from first successful connection
      if (!this.sharedSchema && initializedConnection.schema) {
        this.sharedSchema = initializedConnection.schema;
        this.sharedMarkets = initializedConnection.marketsData;
        this.sharedSecurities = initializedConnection.securitiesByMarket;
        
        logger.info(`📊 Shared data captured from connection ${connectionId}`);
        logger.info(`   Schema objects: ${Object.keys(this.sharedSchema).reduce((sum, ns) => sum + Object.keys(this.sharedSchema[ns] || {}).length, 0)}`);
        logger.info(`   Markets: ${Object.keys(this.sharedMarkets.global || {}).length} global, ${Object.keys(this.sharedMarkets.private || {}).length} private`);
        logger.info(`   Securities: ${Object.keys(this.sharedSecurities).length} markets`);
      }
      
      logger.info(`✅ Connection ${connectionId} added to pool (${this.connections.size} total)`);
      
      return initializedConnection;
      
    } catch (error) {
      logger.error(`❌ Failed to create connection ${connectionId}:`, error);
      return null;
    }
  }

  /**
   * Set up event handlers for a CaitlynClientConnection
   */
  setupConnectionEventHandlers(connection, connectionId) {
    // Store connection ID for reference
    connection.poolConnectionId = connectionId;
    
    // Handle connection events
    connection.on('connected', () => {
      logger.debug(`🤝 Connection ${connectionId} connected`);
      this.emit('connection_connected', connectionId);
    });
    
    connection.on('initialized', () => {
      logger.debug(`🎯 Connection ${connectionId} fully initialized`);
      this.emit('connection_initialized', connectionId);
    });
    
    connection.on('schema_loaded', (data) => {
      logger.debug(`📋 Connection ${connectionId} schema loaded`);
      this.emit('connection_schema_loaded', connectionId, data);
    });
    
    connection.on('universe_loaded', (data) => {
      logger.debug(`🌍 Connection ${connectionId} universe loaded`);
      this.emit('connection_universe_loaded', connectionId, data);
    });
    
    connection.on('seeds_loaded', (data) => {
      logger.info(`🌱 Connection ${connectionId} seeds loaded - universe initialization complete!`);
      this.emit('connection_seeds_loaded', connectionId, data);
      
      // Now that universe initialization is complete, emit pool_ready
      this.emit('pool_ready', { 
        totalConnections: this.connections.size,
        schema: this.sharedSchema,
        markets: this.sharedMarkets,
        securities: this.sharedSecurities
      });
    });
    
    connection.on('historical_data', (data) => {
      logger.debug(`📊 Connection ${connectionId} historical data received`);
      this.emit('historical_data_received', connectionId, data);
    });
    
    connection.on('error', (error) => {
      logger.error(`❌ Connection ${connectionId} error:`, error);
      this.handleConnectionError(connectionId, error);
    });
    
    connection.on('disconnected', () => {
      logger.warn(`🔌 Connection ${connectionId} disconnected`);
      this.handleConnectionDisconnected(connectionId);
    });
  }

  /**
   * Handle connection error
   */
  handleConnectionError(connectionId, error) {
    this.removeConnection(connectionId);
    this.emit('connection_error', connectionId, error);
    
    // DISABLED: Prevent infinite reconnection loops during WASM failures
    // if (!this.isShuttingDown) {
    //   setTimeout(() => {
    //     this.attemptReconnection(connectionId);
    //   }, this.reconnectDelay);
    // }
    
    logger.error(`❌ Connection error disabled reconnection to prevent loops: ${error.message}`);
  }

  /**
   * Handle connection disconnection
   */
  handleConnectionDisconnected(connectionId) {
    this.removeConnection(connectionId);
    this.emit('connection_disconnected', connectionId);
    
    // DISABLED: Prevent infinite reconnection loops during WASM failures
    // if (!this.isShuttingDown) {
    //   setTimeout(() => {
    //     this.attemptReconnection(connectionId);
    //   }, this.reconnectDelay);
    // }
    
    logger.error(`❌ Connection disconnected, reconnection disabled to prevent loops`);
  }

  /**
   * Attempt to reconnect a failed connection - DISABLED
   */
  async attemptReconnection(connectionId) {
    logger.warn(`🚫 Reconnection disabled for ${connectionId} to prevent WASM conflicts`);
    // DISABLED: All reconnection attempts disabled to prevent WASM memory corruption
    return;
  }

  /**
   * Remove connection from pool
   */
  removeConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Disconnect and cleanup
      connection.disconnect();
      
      // Remove from tracking
      this.connections.delete(connectionId);
      this.availableConnections.delete(connectionId);
      this.busyConnections.delete(connectionId);
      
      logger.debug(`🗑️ Connection ${connectionId} removed from pool`);
    }
  }

  /**
   * Get an available connection from the pool
   */
  async getConnection() {
    return new Promise((resolve, reject) => {
      // Check for available connection
      if (this.availableConnections.size > 0) {
        const connectionId = this.availableConnections.values().next().value;
        const connection = this.connections.get(connectionId);
        
        if (connection && connection.isInitialized) {
          // Move to busy
          this.availableConnections.delete(connectionId);
          this.busyConnections.add(connectionId);
          
          resolve({ connection, connectionId });
          return;
        }
      }

      // DISABLED: No pool expansion to prevent WASM conflicts after crash
      // if (this.connections.size < this.maxPoolSize) {
      //   logger.info(`📈 Pool expansion: creating connection ${this.connections.size + 1}/${this.maxPoolSize}`);
      //   
      //   this.createConnection('./public/caitlyn_js.js', './public/caitlyn_js.wasm')
      //     .then(connection => {
      //       if (connection) {
      //         const connectionId = connection.poolConnectionId;
      //         
      //         // Move to busy immediately
      //         this.availableConnections.delete(connectionId);
      //         this.busyConnections.add(connectionId);
      //         
      //         resolve({ connection, connectionId });
      //       } else {
      //         reject(new Error('Failed to create new connection'));
      //       }
      //     })
      //     .catch(reject);
      //   return;
      // }

      // No available connections and expansion disabled
      reject(new Error('No available connections in pool and expansion disabled after WASM crash'));
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionIdOrObject) {
    let connectionId;
    
    if (typeof connectionIdOrObject === 'string') {
      connectionId = connectionIdOrObject;
    } else if (connectionIdOrObject && connectionIdOrObject.poolConnectionId) {
      connectionId = connectionIdOrObject.poolConnectionId;
    } else {
      logger.error('❌ Invalid connection object for release');
      return;
    }
    
    // Move from busy to available
    if (this.busyConnections.has(connectionId)) {
      this.busyConnections.delete(connectionId);
      this.availableConnections.add(connectionId);
      
      // Process pending requests
      if (this.pendingRequests.length > 0) {
        const request = this.pendingRequests.shift();
        const connection = this.connections.get(connectionId);
        
        if (connection && connection.isInitialized) {
          // Move back to busy
          this.availableConnections.delete(connectionId);
          this.busyConnections.add(connectionId);
          
          request.resolve({ connection, connectionId });
        } else {
          // Connection not ready, reject the request
          request.reject(new Error('Connection not available'));
        }
      }
    }
  }

  /**
   * Execute a fetch request using the pool - now uses CaitlynClientConnection.fetchByCode() directly
   */
  async executeFetchByCode(market, code, options = {}) {
    const { connection, connectionId } = await this.getConnection();
    
    try {
      // CaitlynClientConnection.fetchByCode() now returns a Promise with decoded SVObject instances
      const result = await connection.fetchByCode(market, code, options);
      return result;
      
    } catch (error) {
      throw error;
    } finally {
      // Release connection back to pool
      this.releaseConnection(connectionId);
    }
  }

  /**
   * Execute a fetch by time range request using the pool
   */
  async executeFetchByTimeRange(market, code, options = {}) {
    const { connection, connectionId } = await this.getConnection();
    
    try {
      await connection.fetchByTimeRange(market, code, options);
      
      // Wait for the response via event handling
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Fetch request timed out'));
        }, options.timeout || 30000);

        const handleHistoricalData = (connId, data) => {
          if (connId === connectionId) {
            clearTimeout(timeout);
            connection.off('historical_data', handleHistoricalData);
            resolve(data);
          }
        };

        connection.on('historical_data', handleHistoricalData);
      });
      
    } catch (error) {
      throw error;
    } finally {
      // Release connection back to pool
      this.releaseConnection(connectionId);
    }
  }

  /**
   * Get shared schema data
   */
  getSharedSchema() {
    return this.sharedSchema;
  }

  /**
   * Get shared markets data
   */
  getSharedMarkets() {
    return this.sharedMarkets;
  }

  /**
   * Get shared securities data
   */
  getSharedSecurities() {
    return this.sharedSecurities;
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      availableConnections: this.availableConnections.size,
      busyConnections: this.busyConnections.size,
      pendingRequests: this.pendingRequests.length,
      poolSize: this.poolSize,
      maxPoolSize: this.maxPoolSize,
      isInitialized: this.isInitialized,
      hasSharedData: !!(this.sharedSchema && this.sharedMarkets)
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown() {
    this.isShuttingDown = true;
    logger.info('🛑 Shutting down CaitlynConnectionPool...');
    
    // Reject pending requests
    for (const request of this.pendingRequests) {
      request.reject(new Error('Connection pool is shutting down'));
    }
    this.pendingRequests = [];
    
    // Disconnect all connections
    const disconnectPromises = [];
    for (const [connectionId, connection] of this.connections) {
      logger.debug(`🔌 Disconnecting ${connectionId}`);
      disconnectPromises.push(
        Promise.resolve().then(() => connection.disconnect())
      );
    }
    
    try {
      await Promise.allSettled(disconnectPromises);
    } catch (error) {
      logger.error('Error during pool shutdown:', error);
    }
    
    // Clear all tracking
    this.connections.clear();
    this.availableConnections.clear();
    this.busyConnections.clear();
    
    // Clear shared data
    this.sharedSchema = null;
    this.sharedMarkets = null;
    this.sharedSecurities = null;
    this.isInitialized = false;
    
    logger.info('✅ Connection pool shutdown complete');
    this.emit('pool_shutdown');
  }
}

export default CaitlynConnectionPool;