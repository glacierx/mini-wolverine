import WebSocket from 'ws';
import logger from '../utils/logger.js';
import CaitlynConnectionPool from './CaitlynConnectionPool.js';

class CaitlynWebSocketService {
  constructor(wasmService, poolConfig = {}) {
    this.wasmService = wasmService;
    this.poolConfig = {
      poolSize: poolConfig.poolSize || process.env.CAITLYN_POOL_SIZE || 3,
      maxPoolSize: poolConfig.maxPoolSize || process.env.CAITLYN_MAX_POOL_SIZE || 5,
      connectionTimeout: poolConfig.connectionTimeout || 30000,
      reconnectDelay: poolConfig.reconnectDelay || 5000,
      maxReconnectAttempts: poolConfig.maxReconnectAttempts || 3,
      ...poolConfig
    };
    logger.info('CaitlynWebSocketService configured with pool settings:', this.poolConfig);
    
    // Shared singleton instances
    this.sharedConnectionPool = null;
    this.isPoolInitialized = false;
    this.globalCachedSeeds = new Map();
    this.universeDataFetched = false;
    this.clients = new Set();
    this.globalToken = null;
    this.currentUrl = null;
    
    // Sequence ID management for Caitlyn protocol
    this.sequenceCounter = 1; // Start from 1, increment for each request
    this.maxSequenceId = 2147483647; // Max 32-bit signed integer
  }

  /**
   * Get next sequence ID for Caitlyn protocol requests
   * Ensures proper sequence tracking within 32-bit integer limits
   */
  getNextSequenceId() {
    const current = this.sequenceCounter;
    this.sequenceCounter++;
    
    // Wrap around if we reach the max value (unlikely but safe)
    if (this.sequenceCounter > this.maxSequenceId) {
      this.sequenceCounter = 1;
      logger.warn('Sequence counter wrapped around to 1');
    }
    
    return current;
  }

  async initializePoolOnce(url, token) {
    if (this.isPoolInitialized) {
      logger.info('Connection pool already initialized, skipping...');
      return this.sharedConnectionPool;
    }

    if (!url || !token) {
      throw new Error('URL and token are required to initialize connection pool');
    }

    // Store URL and token for universe data requests
    this.currentUrl = url;
    this.globalToken = token;

    logger.info(`Initializing shared connection pool for the first time to: ${url}`);
    
    this.sharedConnectionPool = new CaitlynConnectionPool(this.wasmService, this.poolConfig);
    
    // Set up shared event handlers
    this.sharedConnectionPool.on('handshake_complete', async (connection) => {
      logger.info(`Shared connection ${connection.id} handshake complete`);
    });
    
    this.sharedConnectionPool.on('handshake_failed', (connection, error) => {
      logger.error(`Shared connection ${connection.id} handshake failed:`, error);
    });
    
    this.sharedConnectionPool.on('message', async (connection, decoded, commandName) => {
      await this.handleSharedPoolMessage(connection, decoded, commandName);
      if (this.sharedConnectionPool) {
        this.sharedConnectionPool.releaseConnection(connection);
      }
    });
    
    // Initialize the pool
    await this.sharedConnectionPool.initialize(url, token);
    this.isPoolInitialized = true;
    
    logger.info('Shared connection pool initialized successfully');
    return this.sharedConnectionPool;
  }

  async handleSharedPoolMessage(connection, decoded, commandName) {
    // Handle messages at service level and broadcast to all clients
    if (decoded.cmd !== this.wasmService.getModule().NET_CMD_GOLD_ROUTE_KEEPALIVE && 
        decoded.cmd !== 20513) {
      logger.debug(`Shared connection ${connection.id} - ${commandName} (${decoded.cmd})`);
    }
    
    switch (decoded.cmd) {
      case this.wasmService.getModule().NET_CMD_GOLD_ROUTE_KEEPALIVE:
      case 20513:
        break;
        
      case this.wasmService.getModule().NET_CMD_GOLD_ROUTE_DATADEF:
        logger.info(`Shared connection ${connection.id} - Schema received from server`);
        const schema = this.wasmService.processSchema(decoded.content);
        
        this.broadcastToAllClients({
          type: 'schema_received',
          data: schema
        });
        
        // Request universe data only once
        if (!this.universeDataFetched) {
          this.requestUniverseData();
        }
        break;
        
      case this.wasmService.getModule().CMD_AT_UNIVERSE_REV:
        logger.info(`Shared connection ${connection.id} - Universe revision received`);
        const markets = this.wasmService.processUniverseRevision(decoded.content);
        
        this.broadcastToAllClients({
          type: 'markets_received',
          data: markets
        });
        
        // Request universe seeds only once
        if (!this.universeDataFetched) {
          this.requestUniverseSeeds(markets);
          this.universeDataFetched = true;
        }
        break;
        
      case this.wasmService.getModule().CMD_AT_UNIVERSE_SEEDS:
        logger.debug(`Shared connection ${connection.id} - Universe seeds received`);
        const seedInfo = this.wasmService.processUniverseSeeds(decoded.content);
        
        // Cache the seeds data globally
        const seedKey = `${decoded.seq}`;
        this.globalCachedSeeds.set(seedKey, {
          data: seedInfo,
          timestamp: Date.now(),
          seq: decoded.seq
        });
        
        this.broadcastToAllClients({
          type: 'seeds_received',
          data: seedInfo,
          cached: true,
          cacheKey: seedKey,
          timestamp: Date.now()
        });
        break;
        
      case this.wasmService.getModule().CMD_TA_PUSH_DATA:
        logger.debug(`Shared connection ${connection.id} - Real-time market data received`);
        this.broadcastToAllClients({
          type: 'market_data',
          cmd: decoded.cmd,
          seq: decoded.seq
        });
        break;
        
      default:
        logger.debug(`Shared connection ${connection.id} - Unhandled command: ${commandName}`);
    }
  }

  broadcastToAllClients(message) {
    for (const client of this.clients) {
      client.sendToFrontend(message);
    }
  }

  async requestUniverseData() {
    if (!this.sharedConnectionPool) {
      logger.warn('Cannot request universe data - shared pool not initialized');
      return;
    }
    
    const request = this.wasmService.createUniverseRequest(this.globalToken);
    const connection = await this.sharedConnectionPool.sendMessage(request);
    logger.info(`Universe revision request sent via shared connection ${connection.id}`);
  }

  async requestUniverseSeeds(marketsData) {
    if (!this.sharedConnectionPool) {
      logger.warn('Cannot request universe seeds - shared pool not initialized');
      return;
    }
    
    logger.info('Sending universe seeds requests using shared connection pool');
    const allRequests = [];
    let sequenceId = 3;
    
    for (const namespaceStr in marketsData) {
      const namespaceData = marketsData[namespaceStr];
      for (const marketCode in namespaceData) {
        const marketInfo = namespaceData[marketCode];
        const qualifiedNamesRevisions = marketInfo.revisions;
        const tradeDay = marketInfo.trade_day;
        
        for (const qualifiedName in qualifiedNamesRevisions) {
          const revision = qualifiedNamesRevisions[qualifiedName];
          allRequests.push({
            sequenceId: sequenceId++,
            revision,
            namespaceStr,
            qualifiedName,
            marketCode,
            tradeDay
          });
        }
      }
    }
    
    logger.info(`Sending ${allRequests.length} universe seeds requests using shared pool`);
    
    const requestPromises = allRequests.map(async (reqData) => {
      const request = this.wasmService.createUniverseSeedsRequest(
        this.globalToken, // use global token
        reqData.sequenceId,
        reqData.revision,
        reqData.namespaceStr,
        reqData.qualifiedName,
        reqData.marketCode,
        reqData.tradeDay
      );
      
      const connection = await this.sharedConnectionPool.sendMessage(request);
      return { success: true, connection: connection.id };
    });
    
    const results = await Promise.allSettled(requestPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
    logger.info(`Universe seeds requests completed: ${successful} successful`);
  }

  createClientHandler(frontendWs) {
    const client = new ClientHandler(frontendWs, this.wasmService, this.poolConfig, this);
    this.clients.add(client);
    return client;
  }

  removeClient(client) {
    this.clients.delete(client);
  }

  async resetConfiguration() {
    logger.info('Resetting global configuration...');
    
    if (this.sharedConnectionPool) {
      await this.sharedConnectionPool.shutdown();
    }
    
    this.sharedConnectionPool = null;
    this.isPoolInitialized = false;
    this.globalCachedSeeds.clear();
    this.universeDataFetched = false;
    this.currentUrl = null;
    this.globalToken = null;
    
    logger.info('Global configuration reset complete');
  }
}

class ClientHandler {
  constructor(frontendWs, wasmService, poolConfig, caitlynService) {
    this.frontendWs = frontendWs;
    this.wasmService = wasmService;
    this.poolConfig = poolConfig;
    this.caitlynService = caitlynService;
    this.token = null;
    this.isConnected = false;
    this.clientId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async connectToCaitlyn(url, token, autoConnect = false) {
    if (!url || !token) {
      throw new Error('URL and token are required to connect to Caitlyn server');
    }
    
    this.token = token;
    
    logger.info(`Client ${this.clientId} connecting to Caitlyn server: ${url}`);
    
    // Use shared connection pool - initialize only once
    await this.caitlynService.initializePoolOnce(url, this.token);
    
    this.isConnected = true;
    this.sendToFrontend({
      type: 'connection_status',
      status: 'connected',
      clientId: this.clientId,
      message: `Connected to shared Caitlyn server pool`
    });
    
    this.sendToFrontend({
      type: 'handshake_success',
      message: 'Authentication successful'
    });
    
    // Send existing schema and market data if available
    if (this.wasmService.getSchema()) {
      this.sendToFrontend({
        type: 'schema_received',
        data: this.wasmService.getSchema()
      });
    }
    
    if (this.wasmService.getMarkets()) {
      this.sendToFrontend({
        type: 'markets_received',
        data: this.wasmService.getMarkets()
      });
    }
    
    // Auto-query cached seeds if this is an auto-connect
    if (autoConnect) {
      await this.queryCachedSeeds();
    }
    
    logger.info(`Client ${this.clientId} connected to shared pool successfully`);
  }

  // Pool message handling is now done at service level

  // Keepalive is now handled by individual connections in the pool
  // These methods are kept for compatibility but do nothing
  startKeepalive() {
    logger.debug('Keepalive is managed by connection pool');
  }

  stopKeepalive() {
    logger.debug('Keepalive is managed by connection pool');
  }

  sendToFrontend(data) {
    if (this.frontendWs && this.frontendWs.readyState === WebSocket.OPEN) {
      this.frontendWs.send(JSON.stringify(data));
    }
  }

  async disconnect() {
    this.isConnected = false;
    
    this.sendToFrontend({
      type: 'connection_status',
      status: 'disconnected',
      message: 'Disconnected from Caitlyn server'
    });
  }

  async testUniverseRevision() {
    if (!this.isConnected) {
      throw new Error('Not connected to Caitlyn server');
    }

    logger.info('Testing universe revision functionality...');
    
    // Use already loaded market data from shared service
    const marketsData = this.wasmService.getMarkets();
    if (!marketsData) {
      logger.warn('No markets data available yet - shared pool may still be fetching data');
      return {
        success: false,
        marketsCount: 0,
        globalMarkets: 0,
        privateMarkets: 0,
        message: 'Markets data not yet available - shared pool initializing'
      };
    }
    
    const globalMarkets = Object.keys(marketsData.global || {}).length;
    const privateMarkets = Object.keys(marketsData.private || {}).length;
    const marketsCount = globalMarkets + privateMarkets;
    
    return {
      success: marketsCount > 0,
      marketsCount,
      globalMarkets,
      privateMarkets
    };
  }

  async testUniverseSeeds() {
    if (!this.isConnected) {
      throw new Error('Not connected to Caitlyn server');
    }

    logger.info('Testing universe seeds functionality...');
    
    // Use cached seeds data from shared service
    const cachedSeedsCount = this.caitlynService.globalCachedSeeds.size;
    let totalEntries = 0;
    
    // Count total entries in cached seeds
    for (const [key, seedData] of this.caitlynService.globalCachedSeeds) {
      if (seedData.data && seedData.data.seedEntries) {
        totalEntries += seedData.data.seedEntries.length;
      }
    }
    
    return {
      success: cachedSeedsCount > 0,
      seedsReceived: cachedSeedsCount,
      totalEntries
    };
  }

  // Helper method to limit markets data for testing (avoid overwhelming the server)
  limitMarketsForTesting(marketsData) {
    const limited = {};
    
    for (const namespaceStr in marketsData) {
      limited[namespaceStr] = {};
      const markets = Object.keys(marketsData[namespaceStr]);
      
      // Process all markets in namespace
      for (let i = 0; i < markets.length; i++) {
        const marketCode = markets[i];
        const marketInfo = marketsData[namespaceStr][marketCode];
        
        // Include Security data for proper futures/securities display
        if (marketInfo.revisions) {
          const qualifiedNames = Object.keys(marketInfo.revisions);
          const limitedRevisions = {};
          
          // Always include Security if available, plus first few others
          if (marketInfo.revisions['Security']) {
            limitedRevisions['Security'] = marketInfo.revisions['Security'];
          }
          
          // Add other qualified names (up to 3 total including Security)
          for (let j = 0; j < qualifiedNames.length && Object.keys(limitedRevisions).length < 3; j++) {
            const qualName = qualifiedNames[j];
            if (qualName !== 'Security') {  // Don't duplicate Security
              limitedRevisions[qualName] = marketInfo.revisions[qualName];
            }
          }
          
          limited[namespaceStr][marketCode] = {
            ...marketInfo,
            revisions: limitedRevisions
          };
        }
      }
    }
    
    return limited;
  }

  async cleanup() {
    // Remove client from service's client list
    if (this.caitlynService) {
      this.caitlynService.removeClient(this);
    }
    await this.disconnect();
  }
  
  /**
   * Query all cached seeds data or only newer than specified timestamp
   */
  async queryCachedSeeds(sinceTimestamp = 0) {
    logger.info(`Client ${this.clientId} querying cached seeds since ${sinceTimestamp}`);
    
    const seedsToSend = [];
    
    // Use global cached seeds from service
    for (const [key, seedData] of this.caitlynService.globalCachedSeeds) {
      if (seedData.timestamp > sinceTimestamp) {
        seedsToSend.push({
          key,
          ...seedData
        });
      }
    }
    
    logger.info(`Sending ${seedsToSend.length} cached seeds to client ${this.clientId}`);
    
    this.sendToFrontend({
      type: 'cached_seeds_batch',
      seeds: seedsToSend,
      totalCached: this.caitlynService.globalCachedSeeds.size,
      sinceTimestamp,
      currentTimestamp: Date.now()
    });
    
    return seedsToSend.length;
  }
  
}

export default CaitlynWebSocketService;