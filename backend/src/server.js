import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import WasmService from './services/WasmService.js';
import CaitlynWebSocketService from './services/CaitlynWebSocketService.js';
import logger from './utils/logger.js';

dotenv.config();

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize services with connection pool configuration
const wasmService = new WasmService();

// Connection pool configuration - TESTING: Single connection, no expansion
const poolConfig = {
  poolSize: 1, // Single connection only
  maxPoolSize: 1, // Disable pool expansion
  connectionTimeout: parseInt(process.env.CAITLYN_CONNECTION_TIMEOUT) || 30000,
  reconnectDelay: parseInt(process.env.CAITLYN_RECONNECT_DELAY) || 5000,
  maxReconnectAttempts: parseInt(process.env.CAITLYN_MAX_RECONNECT_ATTEMPTS) || 3
};

const caitlynService = new CaitlynWebSocketService(wasmService, poolConfig);

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    wasm: wasmService.isReady(),
    poolConfig: poolConfig,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/schema', async (req, res) => {
  const schema = await wasmService.getSchema();
  res.json(schema);
});

app.get('/api/markets', async (req, res) => {
  const markets = await wasmService.getMarkets();
  res.json(markets);
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  logger.info('New WebSocket connection from frontend');
  
  // Create a client handler for this connection
  const clientHandler = caitlynService.createClientHandler(ws);
  
  // Auto-connect to Caitlyn server - DISABLED for testing
  // const autoConnectUrl = process.env.CAITLYN_WS_URL || 'wss://116.wolverine-box.com/tm';
  // const autoConnectToken = process.env.CAITLYN_TOKEN;
  
  // setTimeout(async () => {
  //   logger.info('Auto-connecting frontend to Caitlyn server...');
  //   await clientHandler.connectToCaitlyn(autoConnectUrl, autoConnectToken, true);
  // }, 100);
  
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    logger.debug('Received message from frontend:', data.type);
    
    switch (data.type) {
      case 'connect':
        // Global connection - any client can change backend's global Caitlyn server configuration
        try {
          // First check if we need to shutdown existing connections
          if (caitlynService.isPoolInitialized) {
            // Check if URL or token changed
            const currentUrl = caitlynService.currentUrl;
            const currentToken = caitlynService.globalToken;
            
            if (currentUrl !== data.url || currentToken !== data.token) {
              logger.info(`Configuration change detected. Old: ${currentUrl} | New: ${data.url}`);
              await caitlynService.resetConfiguration();
            }
          }
          
          await clientHandler.connectToCaitlyn(data.url, data.token, false);
        } catch (error) {
          logger.error('Failed to connect to Caitlyn server:', error.message);
          ws.send(JSON.stringify({
            type: 'connection_status',
            status: 'failed',
            error: error.message
          }));
        }
        break;
        
      case 'query_cached_seeds':
        // Query cached seeds with optional timestamp filter
        const seedCount = await clientHandler.queryCachedSeeds(data.sinceTimestamp || 0);
        logger.info(`Sent ${seedCount} cached seeds to frontend`);
        break;
        
      case 'disconnect':
        await clientHandler.disconnect();
        break;
        
      case 'request_historical':
        await clientHandler.requestHistoricalData(data.params);
        break;
        
      case 'get_schema':
        const schema = wasmService.getSchema();
        if (!schema) {
          ws.send(JSON.stringify({
            type: 'schema',
            schema: null,
            error: 'Schema not available. Please connect to Caitlyn server first.'
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'schema',
            schema: schema
          }));
        }
        break;
        
      case 'get_client_info':
        // Send client information using shared global cache
        ws.send(JSON.stringify({
          type: 'client_info',
          clientId: clientHandler.clientId,
          assignedConnectionId: null, // No longer using assigned connections
          isConnected: clientHandler.isConnected,
          cachedSeedsCount: caitlynService.globalCachedSeeds.size
        }));
        break;
        
      case 'test_universe_revision':
        if (!clientHandler.isConnected) {
          ws.send(JSON.stringify({
            type: 'universe_revision',
            success: false,
            error: 'Not connected to Caitlyn server. Please connect first.'
          }));
          break;
        }
        const revisionResult = await clientHandler.testUniverseRevision();
        ws.send(JSON.stringify({
          type: 'universe_revision',
          success: revisionResult.success,
          marketsCount: revisionResult.marketsCount,
          globalMarkets: revisionResult.globalMarkets,
          privateMarkets: revisionResult.privateMarkets
        }));
        break;
        
      case 'test_universe_seeds':
        if (!clientHandler.isConnected) {
          ws.send(JSON.stringify({
            type: 'universe_seeds',
            success: false,
            error: 'Not connected to Caitlyn server. Please connect first.'
          }));
          break;
        }
        const seedsResult = await clientHandler.testUniverseSeeds();
        ws.send(JSON.stringify({
          type: 'universe_seeds',
          success: seedsResult.success,
          seedsReceived: seedsResult.seedsReceived,
          totalEntries: seedsResult.totalEntries
        }));
        break;
        
      default:
        logger.warn('Unknown message type:', data.type);
    }
  });
  
  ws.on('close', async () => {
    logger.info('Frontend WebSocket disconnected');
    await clientHandler.cleanup();
  });
  
  ws.on('error', async (error) => {
    logger.error('Frontend WebSocket error:', error);
    await clientHandler.cleanup();
  });
});

// Initialize WASM module on startup
async function initialize() {
  logger.info('Initializing WASM module...');
  await wasmService.initialize();
  logger.info('WASM module initialized successfully');
  
  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    logger.info(`Backend server running on port ${PORT}`);
  });
}

initialize();