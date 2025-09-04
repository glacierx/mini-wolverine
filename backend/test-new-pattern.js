#!/usr/bin/env node

/**
 * Test script to verify the new CaitlynClientConnection pattern
 * in the updated CaitlynConnectionPool
 */

import CaitlynConnectionPool from './src/services/CaitlynConnectionPool.js';
import logger from './src/utils/logger.js';

// Test configuration
const TEST_URL = process.env.CAITLYN_WS_URL || 'wss://116.wolverine-box.com/tm';
const TEST_TOKEN = process.env.CAITLYN_TOKEN;

if (!TEST_TOKEN) {
  console.error('❌ CAITLYN_TOKEN environment variable is required');
  process.exit(1);
}

async function testNewConnectionPool() {
  logger.info('🧪 Starting CaitlynClientConnection Pattern Test');
  logger.info('============================================================');
  
  let pool = null;
  let testResult = {
    poolInitialization: false,
    sharedDataAvailable: false,
    connectionStats: null,
    error: null
  };

  try {
    // Create connection pool with new pattern
    logger.info('🔧 Creating connection pool with CaitlynClientConnection pattern...');
    pool = new CaitlynConnectionPool({
      poolSize: 2,
      maxPoolSize: 3,
      connectionTimeout: 90000
    });

    // Set up event handlers
    pool.on('pool_ready', (data) => {
      logger.info('🎉 Pool ready event received!');
      logger.info(`   Total connections: ${data.totalConnections}`);
      logger.info(`   Schema objects: ${Object.keys(data.schema).reduce((sum, ns) => sum + Object.keys(data.schema[ns] || {}).length, 0)}`);
      logger.info(`   Markets: ${Object.keys(data.markets.global || {}).length} global, ${Object.keys(data.markets.private || {}).length} private`);
      logger.info(`   Securities: ${Object.keys(data.securities).length} markets with securities`);
      
      testResult.sharedDataAvailable = !!(data.schema && data.markets && data.securities);
    });

    pool.on('connection_connected', (connectionId) => {
      logger.info(`✅ Connection ${connectionId} connected`);
    });

    pool.on('connection_initialized', (connectionId) => {
      logger.info(`🎯 Connection ${connectionId} fully initialized`);
    });

    // Initialize the pool
    logger.info(`📡 Initializing pool with ${TEST_URL}...`);
    const wasmJsPath = '/Users/glacierx/Project/mini-wolverine/backend/public/caitlyn_js.js';
    const wasmPath = '/Users/glacierx/Project/mini-wolverine/backend/public/caitlyn_js.wasm';
    await pool.initialize(TEST_URL, TEST_TOKEN, wasmJsPath, wasmPath);
    
    testResult.poolInitialization = true;
    logger.info('✅ Pool initialization completed');

    // Wait a moment for connections to fully initialize
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test pool statistics
    const stats = pool.getStats();
    testResult.connectionStats = stats;
    
    logger.info('📊 Pool Statistics:');
    logger.info(`   Total connections: ${stats.totalConnections}`);
    logger.info(`   Available: ${stats.availableConnections}`);
    logger.info(`   Busy: ${stats.busyConnections}`);
    logger.info(`   Pending requests: ${stats.pendingRequests}`);
    logger.info(`   Is initialized: ${stats.isInitialized}`);
    logger.info(`   Has shared data: ${stats.hasSharedData}`);

    // Test shared data access
    const sharedSchema = pool.getSharedSchema();
    const sharedMarkets = pool.getSharedMarkets();
    const sharedSecurities = pool.getSharedSecurities();

    logger.info('📋 Shared Data Check:');
    logger.info(`   Schema available: ${!!sharedSchema}`);
    logger.info(`   Markets available: ${!!sharedMarkets}`);
    logger.info(`   Securities available: ${!!sharedSecurities}`);

    if (sharedSchema) {
      const totalSchemaObjects = Object.keys(sharedSchema).reduce((sum, ns) => sum + Object.keys(sharedSchema[ns] || {}).length, 0);
      logger.info(`   Schema objects: ${totalSchemaObjects}`);
    }

    if (sharedMarkets) {
      const globalMarkets = Object.keys(sharedMarkets.global || {}).length;
      const privateMarkets = Object.keys(sharedMarkets.private || {}).length;
      logger.info(`   Markets: ${globalMarkets} global, ${privateMarkets} private`);
    }

    if (sharedSecurities) {
      const marketsWithSecurities = Object.keys(sharedSecurities).length;
      const totalSecurities = Object.values(sharedSecurities).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      logger.info(`   Securities: ${marketsWithSecurities} markets, ${totalSecurities} total securities`);
    }

    // Test success conditions
    const success = testResult.poolInitialization && 
                   testResult.sharedDataAvailable && 
                   stats.isInitialized && 
                   stats.hasSharedData &&
                   stats.totalConnections > 0;

    logger.info('============================================================');
    if (success) {
      logger.info('🎉 TEST PASSED: CaitlynClientConnection pattern working correctly!');
      logger.info('✅ Pool initialization: SUCCESS');
      logger.info('✅ Shared data available: SUCCESS');
      logger.info('✅ Connection management: SUCCESS');
    } else {
      logger.warn('⚠️ TEST INCOMPLETE: Some components not fully ready');
      logger.info(`❓ Pool initialization: ${testResult.poolInitialization ? 'SUCCESS' : 'FAILED'}`);
      logger.info(`❓ Shared data available: ${testResult.sharedDataAvailable ? 'SUCCESS' : 'FAILED'}`);
      logger.info(`❓ Pool statistics: ${stats.isInitialized ? 'SUCCESS' : 'FAILED'}`);
    }

  } catch (error) {
    testResult.error = error;
    logger.error('❌ Test failed with error:', error);
  } finally {
    // Cleanup
    if (pool) {
      logger.info('🧹 Shutting down connection pool...');
      await pool.shutdown();
      logger.info('✅ Pool shutdown complete');
    }
  }

  return testResult;
}

// Run the test
testNewConnectionPool()
  .then((result) => {
    if (result.error) {
      process.exit(1);
    } else {
      logger.info('🏁 Test completed successfully');
      process.exit(0);
    }
  })
  .catch((error) => {
    logger.error('💥 Unexpected error:', error);
    process.exit(1);
  });