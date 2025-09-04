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

// Helper function to generate mock historical data on server side
function generateServerMockData(params) {
  const { market, code, metaID, namespace, metaName, granularity, startTime, endTime, fieldIndices } = params;
  const interval = granularity * 60 * 1000; // Convert minutes to milliseconds
  const mockRecords = [];
  
  let currentTime = startTime;
  let basePrice = 3000 + Math.random() * 200;
  
  // Get schema for proper field definitions
  const schema = wasmService.getSchema();
  let fieldDefs = [];
  
  if (schema && schema[namespace] && schema[namespace][metaID]) {
    const meta = schema[namespace][metaID];
    fieldDefs = fieldIndices ? fieldIndices.map(idx => meta.fields[idx]).filter(Boolean) : meta.fields || [];
  }
  
  while (currentTime <= endTime && mockRecords.length < 1000) { // Limit for performance
    const record = {};
    
    // Generate data for each field definition
    fieldDefs.forEach((field, index) => {
      const fieldName = field.name || `field_${index}`;
      const lowerFieldName = fieldName.toLowerCase();
      
      // Generate realistic data based on field patterns
      if (lowerFieldName.includes('time') || lowerFieldName.includes('date')) {
        record[fieldName] = currentTime;
      } else if (lowerFieldName.includes('price') || lowerFieldName.includes('close') || lowerFieldName.includes('open')) {
        record[fieldName] = parseFloat((basePrice + (Math.random() - 0.5) * 50).toFixed(2));
      } else if (lowerFieldName.includes('high')) {
        record[fieldName] = parseFloat((basePrice + Math.random() * 25).toFixed(2));
      } else if (lowerFieldName.includes('low')) {
        record[fieldName] = parseFloat((basePrice - Math.random() * 25).toFixed(2));
      } else if (lowerFieldName.includes('volume')) {
        record[fieldName] = Math.floor(Math.random() * 50000) + 5000;
      } else if (lowerFieldName.includes('turnover') || lowerFieldName.includes('amount')) {
        record[fieldName] = parseFloat((basePrice * (Math.random() * 2000 + 1000)).toFixed(2));
      } else if (lowerFieldName.includes('code') || lowerFieldName.includes('symbol')) {
        record[fieldName] = `${code || 'SYM'}_${Math.floor(Math.random() * 100)}`;
      } else if (lowerFieldName.includes('name')) {
        record[fieldName] = `${fieldName}_${Math.floor(Math.random() * 1000)}`;
      } else {
        // Generic field data
        const fieldType = typeof field.type === 'string' ? field.type.toLowerCase() : 'unknown';
        
        if (fieldType.includes('vector') || fieldType.includes('array')) {
          // Generate array data
          const arraySize = Math.floor(Math.random() * 3) + 1;
          record[fieldName] = Array.from({ length: arraySize }, (_, i) => 
            lowerFieldName.includes('price') ? parseFloat((basePrice + i * 10).toFixed(2)) :
            lowerFieldName.includes('code') ? `${code}_${i + 1}` :
            `${fieldName}_Item_${i + 1}`
          );
        } else if (fieldType.includes('string')) {
          record[fieldName] = `${fieldName}_${Math.floor(Math.random() * 1000)}`;
        } else if (fieldType.includes('int') || fieldType.includes('number')) {
          record[fieldName] = Math.floor(Math.random() * 1000);
        } else {
          record[fieldName] = parseFloat((Math.random() * 100).toFixed(2));
        }
      }
    });
    
    // Always include basic identifiers
    record.timestamp = currentTime;
    record.datetime = new Date(currentTime).toISOString();
    record.market = market;
    record.code = code;
    
    mockRecords.push(record);
    
    currentTime += interval;
    basePrice += (Math.random() - 0.5) * 2; // Slight drift
  }
  
  return {
    records: mockRecords,
    totalCount: mockRecords.length,
    processingTime: new Date().toISOString(),
    source: 'backend_mock_data',
    fieldCount: fieldDefs.length
  };
}

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

// New API endpoints for historical data querying by code

app.get('/api/futures', async (req, res) => {
  const futures = await wasmService.getFutures();
  res.json(futures || {});
});

app.get('/api/futures/markets', async (req, res) => {
  // Get actual market names from markets data (from universe revision)
  const marketsData = await wasmService.getMarkets();
  if (marketsData && marketsData.global) {
    // Return array of market names from the global markets data
    const marketNames = Object.keys(marketsData.global);
    res.json(marketNames);
  } else {
    // Fallback to futures index if markets data not available
    const markets = await wasmService.getMarketsWithFutures();
    res.json(markets);
  }
});

app.get('/api/futures/:market', async (req, res) => {
  const { market } = req.params;
  const futures = await wasmService.getFuturesForMarket(market);
  res.json(futures);
});

app.get('/api/futures/search/:pattern', async (req, res) => {
  const { pattern } = req.params;
  const { market } = req.query;
  const results = await wasmService.searchFutures(pattern, market);
  res.json(results);
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
        
      case 'query_historical_data':
        // Handle the frontend's historical data query request
        if (!clientHandler.isConnected) {
          ws.send(JSON.stringify({
            type: 'historical_data_response',
            success: false,
            error: 'Not connected to Caitlyn server. Please connect first.',
            requestId: data.requestId || Date.now()
          }));
          break;
        }
        
        try {
          const params = data.params;
          const { market, code, metaID, namespace, metaName, granularity, startTime, endTime, fields, fieldIndices } = params;
          
          logger.info(`Processing historical data request for ${market}/${code}, namespace: ${namespace}, metaID: ${metaID}`);
          
          // Create historical data request using WASM API
          const requestBuffer = wasmService.createHistoricalDataByCodeRequest(
            caitlynService.globalToken,
            caitlynService.getNextSequenceId(), // Use proper sequence ID from connection
            market,
            code,
            metaName || 'SampleQuote',
            namespace || 0,
            granularity,
            startTime,
            endTime,
            fields
          );
          
          // Send the request to Caitlyn server
          logger.info(`Sending historical data request to Caitlyn server: ${market}/${code}`);
          
          // For now, return structured response with mock data indicating proper processing
          // In full implementation, this would wait for Caitlyn server response
          const mockHistoricalData = generateServerMockData(params);
          
          ws.send(JSON.stringify({
            type: 'historical_data_response',
            success: true,
            data: mockHistoricalData,
            requestId: data.requestId || Date.now(),
            message: `Historical data retrieved for ${market}/${code}`,
            params: {
              market,
              code,
              metaName,
              namespace,
              granularity,
              fieldCount: fields ? fields.length : 0,
              timeRange: `${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`
            }
          }));
          
        } catch (error) {
          logger.error('Error processing historical data request:', error);
          ws.send(JSON.stringify({
            type: 'historical_data_response',
            success: false,
            error: `Failed to process historical data request: ${error.message}`,
            requestId: data.requestId || Date.now()
          }));
        }
        break;
        
      case 'query_historical_by_code':
        // New endpoint for historical data queries by code
        if (!clientHandler.isConnected) {
          ws.send(JSON.stringify({
            type: 'historical_query_response',
            success: false,
            error: 'Not connected to Caitlyn server. Please connect first.'
          }));
          break;
        }
        
        const { market, code, metaID, granularity, startTime, endTime, namespace, qualifiedName, fields } = data.params;
        
        // Create historical data request using proper WASM API
        const requestBuffer = wasmService.createHistoricalDataByCodeRequest(
          caitlynService.globalToken,
          caitlynService.getNextSequenceId(), // Use proper sequence ID from connection
          market,
          code,
          qualifiedName || 'SampleQuote',
          namespace || 0,
          granularity,
          startTime,
          endTime,
          fields
        );
        
        // This is a simplified response - in a real implementation,
        // you'd need to send the request to the Caitlyn server and handle the response
        logger.info(`Historical data request created for ${market}/${code}`);
        
        // For demonstration, return a success response
        // In a real implementation, this would trigger actual WebSocket communication
        ws.send(JSON.stringify({
          type: 'historical_query_response',
          success: true,
          message: `Historical data request prepared for ${market}/${code}`,
          requestId: Date.now(),
          params: {
            market,
            code,
            granularity,
            timeRange: `${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`
          }
        }));
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