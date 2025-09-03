import WebSocket from 'ws';
import EventEmitter from 'events';
import logger from '../utils/logger.js';

/**
 * Connection Pool for Caitlyn WebSocket connections
 * Manages multiple connections to distribute load and prevent memory issues
 */
class CaitlynConnectionPool extends EventEmitter {
  constructor(wasmService, options = {}) {
    super();
    this.wasmService = wasmService;
    
    // Pool configuration
    this.poolSize = options.poolSize || 3;
    this.maxPoolSize = options.maxPoolSize || 5;
    this.connectionTimeout = options.connectionTimeout || 30000;
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 3;
    
    // Pool state
    this.connections = [];
    this.availableConnections = [];
    this.busyConnections = [];
    this.pendingRequests = [];
    
    // Connection tracking
    this.connectionId = 0;
    this.url = null;
    this.token = null;
    this.isShuttingDown = false;
  }

  /**
   * Initialize the connection pool
   */
  async initialize(url, token) {
    this.url = url;
    this.token = token;
    
    logger.info(`Initializing Caitlyn connection pool with ${this.poolSize} connections`);
    
    // Create initial connections
    const connectionPromises = [];
    for (let i = 0; i < this.poolSize; i++) {
      connectionPromises.push(this.createConnection());
    }
    
    try {
      await Promise.all(connectionPromises);
      logger.info(`Connection pool initialized with ${this.connections.length} active connections`);
      return true;
    } catch (error) {
      logger.error('Failed to initialize connection pool:', error);
      throw error;
    }
  }

  /**
   * Create a new connection
   */
  async createConnection() {
    const connectionId = ++this.connectionId;
    const connection = {
      id: connectionId,
      ws: null,
      state: 'connecting',
      keepaliveInterval: null,
      reconnectAttempts: 0,
      lastActivity: Date.now(),
      isHandshakeComplete: false
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Connection ${connectionId} timed out`));
      }, this.connectionTimeout);

      try {
        connection.ws = new WebSocket(this.url);
        connection.ws.binaryType = 'arraybuffer';

        connection.ws.on('open', () => {
          clearTimeout(timeout);
          logger.info(`Connection ${connectionId} opened`);
          connection.state = 'connected';
          
          // Send handshake
          const handshake = this.wasmService.createHandshakeMessage(this.token);
          connection.ws.send(handshake);
          
          // Start keepalive
          this.startKeepalive(connection);
          
          // Add to pool
          this.connections.push(connection);
          this.availableConnections.push(connection);
          
          resolve(connection);
        });

        connection.ws.on('message', (data) => {
          this.handleMessage(connection, data);
        });

        connection.ws.on('close', () => {
          logger.warn(`Connection ${connectionId} closed`);
          this.handleConnectionClose(connection);
        });

        connection.ws.on('error', (error) => {
          clearTimeout(timeout);
          logger.error(`Connection ${connectionId} error:`, error);
          this.handleConnectionError(connection, error);
          reject(error);
        });

      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(connection, data) {
    connection.lastActivity = Date.now();
    
    try {
      // Handle text messages (JSON)
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        if (message.cmd === 20512) {
          // Handshake response
          if (message.status === 0 || !message.error_msg) {
            connection.isHandshakeComplete = true;
            logger.debug(`Connection ${connection.id} handshake complete`);
            this.emit('handshake_complete', connection);
          } else {
            logger.error(`Connection ${connection.id} handshake failed:`, message.error_msg);
            this.emit('handshake_failed', connection, message.error_msg);
          }
        }
        return;
      }

      // Handle binary messages
      const decoded = this.wasmService.decodeMessage(data);
      const commandName = this.wasmService.getCommandName(decoded.cmd);
      
      // Skip logging for keepalives
      if (decoded.cmd !== this.wasmService.getModule().NET_CMD_GOLD_ROUTE_KEEPALIVE && 
          decoded.cmd !== 20513) {
        logger.debug(`Connection ${connection.id} received: ${commandName}`);
      }
      
      // Emit message to listeners
      this.emit('message', connection, decoded, commandName);
      
    } catch (error) {
      logger.error(`Error handling message on connection ${connection.id}:`, error);
    }
  }

  /**
   * Handle connection close
   */
  handleConnectionClose(connection) {
    this.removeConnection(connection);
    
    // Attempt reconnection if not shutting down
    if (!this.isShuttingDown && connection.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectConnection(connection);
      }, this.reconnectDelay);
    }
  }

  /**
   * Handle connection error
   */
  handleConnectionError(connection, error) {
    logger.error(`Connection ${connection.id} error:`, error);
    this.removeConnection(connection);
  }

  /**
   * Reconnect a failed connection
   */
  async reconnectConnection(connection) {
    connection.reconnectAttempts++;
    logger.info(`Attempting to reconnect connection ${connection.id} (attempt ${connection.reconnectAttempts})`);
    
    try {
      const newConnection = await this.createConnection();
      logger.info(`Connection ${connection.id} reconnected as ${newConnection.id}`);
    } catch (error) {
      logger.error(`Failed to reconnect connection ${connection.id}:`, error);
      
      if (connection.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectConnection(connection);
        }, this.reconnectDelay * connection.reconnectAttempts);
      }
    }
  }

  /**
   * Remove connection from pool
   */
  removeConnection(connection) {
    this.connections = this.connections.filter(c => c.id !== connection.id);
    this.availableConnections = this.availableConnections.filter(c => c.id !== connection.id);
    this.busyConnections = this.busyConnections.filter(c => c.id !== connection.id);
    
    if (connection.keepaliveInterval) {
      clearInterval(connection.keepaliveInterval);
    }
    
    if (connection.ws) {
      connection.ws.close();
    }
  }

  /**
   * Get an available connection from the pool
   */
  async getConnection() {
    return new Promise((resolve, reject) => {
      // Check for available connection
      if (this.availableConnections.length > 0) {
        const connection = this.availableConnections.shift();
        this.busyConnections.push(connection);
        resolve(connection);
        return;
      }

      // If pool can grow, create new connection
      if (this.connections.length < this.maxPoolSize) {
        logger.info(`Pool expansion: creating connection ${this.connections.length + 1}/${this.maxPoolSize}`);
        this.createConnection()
          .then(connection => {
            this.availableConnections = this.availableConnections.filter(c => c.id !== connection.id);
            this.busyConnections.push(connection);
            resolve(connection);
          });
        return;
      } else {
        logger.warn(`Pool at maximum capacity (${this.maxPoolSize}), queueing request. Pending: ${this.pendingRequests.length + 1}`);
      }

      // Queue the request
      this.pendingRequests.push({ resolve, reject });
      
      // Set timeout for pending request
      setTimeout(() => {
        const index = this.pendingRequests.findIndex(req => req.resolve === resolve);
        if (index !== -1) {
          this.pendingRequests.splice(index, 1);
          reject(new Error('Connection request timed out'));
        }
      }, this.connectionTimeout);
    });
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(connection) {
    // Move from busy to available
    this.busyConnections = this.busyConnections.filter(c => c.id !== connection.id);
    this.availableConnections.push(connection);
    
    // Process pending requests
    if (this.pendingRequests.length > 0) {
      const request = this.pendingRequests.shift();
      const nextConnection = this.availableConnections.shift();
      this.busyConnections.push(nextConnection);
      request.resolve(nextConnection);
    }
  }

  /**
   * Send a message using any available connection
   */
  async sendMessage(messageBuffer) {
    const connection = await this.getConnection();
    
    try {
      if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageBuffer);
        return connection;
      } else {
        throw new Error(`Connection ${connection.id} is not ready`);
      }
    } catch (error) {
      this.releaseConnection(connection);
      throw error;
    }
  }

  /**
   * Start keepalive for a connection
   */
  startKeepalive(connection) {
    connection.keepaliveInterval = setInterval(() => {
      if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        try {
          const keepalive = this.wasmService.createKeepaliveMessage();
          connection.ws.send(keepalive);
        } catch (error) {
          logger.error(`Failed to send keepalive on connection ${connection.id}:`, error);
        }
      }
    }, 15000);
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.length,
      availableConnections: this.availableConnections.length,
      busyConnections: this.busyConnections.length,
      pendingRequests: this.pendingRequests.length,
      poolSize: this.poolSize,
      maxPoolSize: this.maxPoolSize
    };
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown() {
    this.isShuttingDown = true;
    logger.info('Shutting down connection pool...');
    
    // Reject pending requests
    for (const request of this.pendingRequests) {
      request.reject(new Error('Connection pool is shutting down'));
    }
    this.pendingRequests = [];
    
    // Close all connections
    for (const connection of this.connections) {
      if (connection.keepaliveInterval) {
        clearInterval(connection.keepaliveInterval);
      }
      if (connection.ws) {
        connection.ws.close();
      }
    }
    
    this.connections = [];
    this.availableConnections = [];
    this.busyConnections = [];
    
    logger.info('Connection pool shutdown complete');
  }
}

export default CaitlynConnectionPool;