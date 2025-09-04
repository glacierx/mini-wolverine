import express from 'express';
import http from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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

// Initialize services with enhanced connection pool configuration

// Connection pool configuration - Conservative single connection to avoid WASM abort
const poolConfig = {
  poolSize: 1, // Single connection only to avoid WASM conflicts
  maxPoolSize: 1, // No pool expansion to prevent WASM abort errors
  connectionTimeout: parseInt(process.env.CAITLYN_CONNECTION_TIMEOUT) || 60000,
  reconnectDelay: parseInt(process.env.CAITLYN_RECONNECT_DELAY) || 5000,
  maxReconnectAttempts: parseInt(process.env.CAITLYN_MAX_RECONNECT_ATTEMPTS) || 2
};

const caitlynService = new CaitlynWebSocketService(poolConfig);

// Helper function to generate mock historical data on server side
function generateServerMockData(params) {
  const { market, code, metaID, namespace, metaName, granularity, startTime, endTime, fieldIndices } = params;
  const interval = granularity * 60 * 1000; // Convert minutes to milliseconds
  const mockRecords = [];
  
  let currentTime = startTime;
  let basePrice = 3000 + Math.random() * 200;
  
  // Get schema for proper field definitions
  const schema = caitlynService.getSharedSchema();
  let fieldDefs = [];
  
  if (schema && schema[namespace] && schema[namespace][metaID]) {
    const meta = schema[namespace][metaID];
    fieldDefs = fieldIndices ? fieldIndices.map(idx => meta.fields[idx]).filter(Boolean) : meta.fields || [];
    
    // Safety limit: prevent too many fields from being processed
    if (fieldDefs.length > 20) {
      logger.warn(`Too many fields (${fieldDefs.length}), limiting to first 20`);
      fieldDefs = fieldDefs.slice(0, 20);
    }
  }
  
  while (currentTime <= endTime && mockRecords.length < 100) { // Reduced limit to prevent frontend crash
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
  const poolStats = caitlynService.connectionPool ? caitlynService.connectionPool.getStats() : null;
  res.json({ 
    status: 'healthy',
    pool: poolStats,
    poolConfig: caitlynService.poolConfig,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/schema', async (req, res) => {
  const schema = caitlynService.getSharedSchema();
  res.json(schema || {});
});

app.get('/api/markets', async (req, res) => {
  const markets = caitlynService.getSharedMarkets();
  res.json(markets || {});
});

app.get('/api/securities', async (req, res) => {
  const securities = caitlynService.getSharedSecurities();
  res.json(securities || {});
});

// New API endpoints for historical data querying by code

app.get('/api/futures', async (req, res) => {
  const securities = caitlynService.getSharedSecurities();
  res.json(securities || {});
});

app.get('/api/futures/markets', async (req, res) => {
  // Get actual market names from markets data (from universe revision)
  const marketsData = caitlynService.getSharedMarkets();
  if (marketsData && marketsData.global) {
    // Return array of market names from the global markets data
    const marketNames = Object.keys(marketsData.global);
    res.json(marketNames);
  } else {
    // Fallback to futures index if markets data not available
    const markets = Object.keys(caitlynService.getSharedMarkets()?.global || {});
    res.json(markets);
  }
});

app.get('/api/futures/:market', async (req, res) => {
  const { market } = req.params;
  const securities = caitlynService.getSharedSecurities();
  const futures = securities[market] || [];
  res.json(futures);
});

app.get('/api/futures/search/:pattern', async (req, res) => {
  const { pattern } = req.params;
  const { market } = req.query;
  const securities = caitlynService.getSharedSecurities();
  let results = Object.values(securities).flat().filter(f => 
    f.symbol?.toLowerCase().includes(pattern.toLowerCase()) || 
    f.name?.toLowerCase().includes(pattern.toLowerCase())
  );
  if (market) {
    results = securities[market]?.filter(f => 
      f.symbol?.toLowerCase().includes(pattern.toLowerCase()) || 
      f.name?.toLowerCase().includes(pattern.toLowerCase())
    ) || [];
  }
  res.json(results);
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  logger.info('New WebSocket connection from frontend - using pre-initialized Caitlyn connection');
  
  // Create a client handler for this connection (uses pre-initialized shared pool)
  const clientHandler = caitlynService.createClientHandler(ws);
  
  // Immediately notify frontend that connection is ready
  ws.send(JSON.stringify({
    type: 'connection_status',
    status: 'connected',
    message: 'Connected to pre-initialized Caitlyn server'
  }));
  
  // Send schema and markets data immediately if available
  const schema = caitlynService.getSharedSchema();
  const markets = caitlynService.getSharedMarkets();
  const securities = caitlynService.getSharedSecurities();
  
  if (schema && Object.keys(schema).length > 0) {
    ws.send(JSON.stringify({
      type: 'schema_received',
      data: schema,
      message: 'Schema available from pre-initialized backend'
    }));
  }
  
  if (markets && Object.keys(markets).length > 0) {
    ws.send(JSON.stringify({
      type: 'markets_received',
      data: markets,
      message: 'Markets data available from pre-initialized backend'
    }));
  }
  
  if (securities && Object.keys(securities).length > 0) {
    ws.send(JSON.stringify({
      type: 'securities_received',
      data: securities,
      message: 'Securities data available from pre-initialized backend'
    }));
  }
  
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    logger.debug('Received message from frontend:', data.type);
    
    switch (data.type) {
      case 'connect':
        // Reconfiguration disabled - backend is pre-initialized
        logger.info('Frontend reconfiguration request ignored - backend uses pre-configured connection');
        ws.send(JSON.stringify({
          type: 'connection_status',
          status: 'connected',
          message: 'Using pre-configured Caitlyn connection (reconfiguration disabled)'
        }));
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
          
          // Historical data requests now handled by connection pool
          logger.info(`Preparing historical data request for ${market}/${code}`);
          
          // Send the request to Caitlyn server and process the response
          logger.info(`Sending historical data request to Caitlyn server: ${market}/${code}`);
          
          try {
            // Send the request to the actual Caitlyn server via the connection pool
            // This should trigger a CMD_AT_FETCH_BY_CODE request
            const activeConnection = caitlynService.sharedConnectionPool?.getAvailableConnection();
            
            if (!activeConnection) {
              throw new Error('No active connection to Caitlyn server available');
            }
            
            // Send the binary request to Caitlyn server
            logger.info(`Sending binary request buffer (${requestBuffer.byteLength} bytes) to Caitlyn server`);
            activeConnection.send(requestBuffer);
            
            // For now, we'll need to handle the response asynchronously
            // The actual response will come back through the WebSocket message handler
            // For testing purposes, return a placeholder response
            ws.send(JSON.stringify({
              type: 'historical_data_response',
              success: true,
              data: {
                records: [],
                totalCount: 0,
                source: 'caitlyn_server_request_sent',
                processingTime: new Date().toISOString(),
                note: 'Request sent to Caitlyn server - response handling needs implementation'
              },
              requestId: data.requestId || Date.now(),
              message: `Historical data request sent to Caitlyn server for ${market}/${code}`,
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
            
          } catch (realDataError) {
            logger.error('Error sending request to Caitlyn server:', realDataError);
            ws.send(JSON.stringify({
              type: 'historical_data_response',
              success: false,
              error: `Failed to send request to Caitlyn server: ${realDataError.message}`,
              requestId: data.requestId || Date.now()
            }));
          }
          
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
        // Use connection pool to fetch historical data
        try {
          const result = await caitlynService.fetchHistoricalData(market, code, {
            namespace: namespace || 0,
            qualifiedName: qualifiedName || 'SampleQuote',
            granularity: granularity,
            startTime: startTime,
            endTime: endTime,
            fields: fields
          });
          
          // Send successful response with actual data
          ws.send(JSON.stringify({
            type: 'historical_query_response',
            success: true,
            message: `Historical data retrieved for ${market}/${code}`,
            data: result,
            requestId: Date.now(),
            params: {
              market,
              code,
              granularity,
              timeRange: `${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`
            }
          }));
        } catch (error) {
          logger.error(`Historical data fetch failed for ${market}/${code}:`, error);
          ws.send(JSON.stringify({
            type: 'historical_query_response',
            success: false,
            error: error.message,
            params: { market, code }
          }));
        }
        break;
        
      case 'get_schema':
        const schema = caitlynService.getSharedSchema();
        if (!schema || Object.keys(schema).length === 0) {
          ws.send(JSON.stringify({
            type: 'schema',
            schema: null,
            error: 'Schema not yet loaded. Backend may still be initializing universe data.'
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'schema_received',
            data: schema,
            message: 'Schema loaded from pre-initialized backend'
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
          cachedSeedsCount: caitlynService.globalCachedSeeds?.size || 0
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

// Initialize enhanced connection pool on startup
async function initialize() {
  const caitlynUrl = process.env.CAITLYN_WS_URL || 'wss://116.wolverine-box.com/tm';
  const caitlynToken = process.env.CAITLYN_TOKEN;
  
  if (!caitlynToken) {
    logger.error('CAITLYN_TOKEN environment variable is required');
    process.exit(1);
  }
  
  logger.info(`🚀 Initializing enhanced connection pool to: ${caitlynUrl}`);
  
  try {
    // Determine WASM paths based on environment
    const wasmJsPath = path.join(__dirname, '..', 'public', 'caitlyn_js.js');
    const wasmPath = path.join(__dirname, '..', 'public', 'caitlyn_js.wasm');
    
    // Initialize the enhanced connection pool with WASM paths
    await caitlynService.initializePoolOnce(caitlynUrl, caitlynToken, wasmJsPath, wasmPath);
    logger.info('✅ Enhanced connection pool initialized successfully');
    
    const PORT = process.env.PORT || 4000;
    server.listen(PORT, () => {
      logger.info(`✅ Backend server ready on port ${PORT} with enhanced Caitlyn connection pool`);
    });
  } catch (error) {
    logger.error('❌ Failed to initialize enhanced connection pool:', error);
    process.exit(1);
  }
}


initialize();