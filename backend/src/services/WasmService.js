import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WasmService {
  constructor() {
    this.module = null;
    this.schema = null; // Public schema for frontend
    this.schemaByNamespace = null; // Internal schema for processing
    this.compressor = null;
    this.markets = null;
    this.ready = false;
  }

  async initialize() {
    // Load the WASM module
    const wasmPath = path.join(__dirname, '../../public/caitlyn_js.wasm');
    const jsPath = path.join(__dirname, '../../public/caitlyn_js.js');
    
    // Check if files exist
    await fs.access(wasmPath);
    await fs.access(jsPath);
    
    // Load the JavaScript wrapper using dynamic import for ES modules
    const { default: CaitlynModule } = await import(`file://${jsPath}`);
    
    // Initialize the module
    this.module = await new Promise((resolve, reject) => {
      CaitlynModule({
        locateFile: (filename) => {
          if (filename.endsWith('.wasm')) {
            return wasmPath;
          }
          return filename;
        },
        onRuntimeInitialized: function() {
          resolve(this);
        }
      }).catch(reject);
    });
    
    // Verify essential classes are available
    const requiredClasses = [
      'NetPackage',
      'IndexSchema',
      'IndexSerializer',
      'ATUniverseReq',
      'ATUniverseRes',
      'ATUniverseSeedsReq',
      'ATUniverseSeedsRes'
    ];
    
    for (const className of requiredClasses) {
      if (!this.module[className]) {
        throw new Error(`Required class ${className} not found in WASM module`);
      }
    }
    
    logger.info('WASM module loaded successfully');
    this.ready = true;
  }

  isReady() {
    return this.ready;
  }

  getModule() {
    if (!this.ready) {
      throw new Error('WASM module not initialized');
    }
    return this.module;
  }

  // Process schema data
  processSchema(content) {
    if (!this.ready) {
      throw new Error('WASM module not initialized');
    }
    
    // Clean up existing compressor
    if (this.compressor) {
      this.compressor.delete();
      this.compressor = null;
    }
    
    // Create and load schema
    const schema = new this.module.IndexSchema();
    schema.load(content);
    
    // Process metadata
    const metas = schema.metas();
    const metaCount = metas ? metas.size() : 0;
    logger.info(`Schema contains ${metaCount} metadata definitions`);
    
    // Build schema object with proper namespace grouping
    const schemaData = {};
    const schemaByNamespace = {}; // For internal lookup
    let namespaceCounts = {};
    
    if (metas && metaCount > 0) {
      for (let i = 0; i < metaCount; i++) {
        const meta = metas.get(i);
        
        // Extract namespace index for internal storage
        if (schemaByNamespace[meta.namespace] === undefined) {
          schemaByNamespace[meta.namespace] = {};
        }
        schemaByNamespace[meta.namespace][meta.ID] = meta;
        
        // Parse the name field which contains "namespace::name" format
        const fullName = meta.name || '';
        const parts = fullName.split('::');
        const namespace = parts[0] || 'unknown';
        const displayName = parts[1] || `Unnamed_${meta.ID}`;
        
        // Count namespaces
        namespaceCounts[namespace] = (namespaceCounts[namespace] || 0) + 1;
        
        // Build public schema structure
        if (!schemaData[namespace]) {
          schemaData[namespace] = [];
        }
        
        schemaData[namespace].push({
          id: meta.ID,
          name: displayName,
          fullName: fullName,
          namespace: namespace,
          namespaceId: meta.namespace, // numeric namespace for internal use
          fields: [] // Will be populated if needed
        });
      }
    }
    
    // Log namespace counts
    for (const ns in namespaceCounts) {
      logger.info(`Namespace '${ns}': ${namespaceCounts[ns]} objects`);
    }
    
    // Initialize compressor
    this.compressor = new this.module.IndexSerializer();
    this.compressor.updateSchema(schema);
    
    // Delete temporary schema object (compressor keeps it internally)
    schema.delete();
    
    // Store both public and internal schemas
    this.schema = schemaData; // Public schema for frontend
    this.schemaByNamespace = schemaByNamespace; // Internal schema for processing
    
    logger.info(`Schema processed: ${Object.keys(namespaceCounts).join(', ')}`);
    
    return schemaData;
  }

  // Process universe revision data
  processUniverseRevision(content) {
    if (!this.ready || !this.compressor) {
      throw new Error('WASM module or compressor not initialized');
    }
    
    const universeRes = new this.module.ATUniverseRes();
    universeRes.setCompressor(this.compressor);
    universeRes.decode(content);
    
    const revs = universeRes.revs();
    const keys = revs.keys();
    
    logger.info(`Processing ${keys.size()} namespaces`);
    
    const marketsData = {};
    
    // Process each namespace
    for (let i = 0; i < keys.size(); i++) {
      const namespaceKey = keys.get(i);
      const structValues = revs.get(namespaceKey);
      const namespaceId = namespaceKey === 'private' ? 1 : 0;
      
      logger.debug(`Processing namespace: "${namespaceKey}" (${structValues.size()} entries)`);
      
      // Process each StructValue
      for (let j = 0; j < structValues.size(); j++) {
        const sv = structValues.get(j);
        
        // Look for Market metadata (ID 3)
        if (sv.metaID === 3 && this.schemaByNamespace && this.schemaByNamespace[namespaceId] && this.schemaByNamespace[namespaceId][sv.metaID]) {
          const meta = this.schemaByNamespace[namespaceId][sv.metaID];
          const metaName = meta.name || 'Market';
          const marketCode = sv.stockCode;
          
          logger.debug(`Market: ${marketCode} (${metaName})`);
          
          // Field 7 contains the revisions JSON data
          if (!sv.isEmpty(7)) {
            const revsJsonString = sv.getString(7);
            const revsData = JSON.parse(revsJsonString);
            
            // Get trade_day from field 0
            let tradeDay = 0;
            if (!sv.isEmpty(0)) {
              tradeDay = sv.getInt32(0);
            }
            
            // Store market data
            if (!marketsData[namespaceKey]) {
              marketsData[namespaceKey] = {};
            }
            
            marketsData[namespaceKey][marketCode] = {
              revisions: revsData,
              trade_day: tradeDay,
              name: sv.getString(1)
            };
          }
        }
        
        // Clean up StructValue
        sv.delete();
      }
    }
    
    // Clean up response
    universeRes.delete();
    
    const globalCount = Object.keys(marketsData.global || {}).length;
    const privateCount = Object.keys(marketsData.private || {}).length;
    logger.info(`Extracted market data for ${globalCount} global markets and ${privateCount} private markets`);
    
    this.markets = marketsData;
    return marketsData;
  }

  // Process universe seeds data
  processUniverseSeeds(content) {
    if (!this.ready || !this.compressor) {
      throw new Error('WASM module or compressor not initialized');
    }
    
    // Check content size before processing
    if (!content || content.byteLength === 0) {
      logger.warn('Empty content received for universe seeds');
      return { count: 0, total: 0 };
    }
    
    // Log content size for debugging
    logger.debug(`Processing seeds content of size: ${content.byteLength} bytes`);
    
    const seedsRes = new this.module.ATUniverseSeedsRes();
    seedsRes.setCompressor(this.compressor);
    seedsRes.decode(content);
    
    // Get seed data
    const seedData = seedsRes.seedData();
    const seedCount = seedData ? seedData.size() : 0;
    logger.debug(`Seeds response contains ${seedCount} entries`);
    
    let processedCount = 0;
    
    // Only process if we have reasonable amount of data
    if (seedCount > 0 && seedCount < 10000) {  // Sanity check - prevent huge arrays
      for (let i = 0; i < seedCount; i++) {
        const entry = seedData.get(i);
        // Immediately clean up entry
        if (entry) {
          entry.delete();
        }
        processedCount++;
      }
    } else if (seedCount >= 10000) {
      logger.warn(`Unusually large seed count (${seedCount}), skipping processing to prevent memory issues`);
    }
    
    // Cleanup
    seedsRes.delete();
    
    logger.info(`Successfully processed ${processedCount} seed entries`);
    return { count: processedCount, total: seedCount };
  }

  // Create encoded messages
  createHandshakeMessage(token) {
    return JSON.stringify({
      cmd: 20512,
      token: token,
      protocol: 1,
      seq: 1
    });
  }

  createKeepaliveMessage() {
    if (!this.ready) {
      throw new Error('WASM module not initialized');
    }
    
    const pkg = new this.module.NetPackage();
    const encoded = pkg.encode(this.module.NET_CMD_GOLD_ROUTE_KEEPALIVE, new Uint8Array(0));
    
    // Copy to regular ArrayBuffer
    const regularBuffer = new ArrayBuffer(encoded.byteLength);
    const regularView = new Uint8Array(regularBuffer);
    const encodedView = new Uint8Array(encoded);
    regularView.set(encodedView);
    
    pkg.delete();
    return regularBuffer;
  }

  createUniverseRequest(token) {
    if (!this.ready) {
      throw new Error('WASM module not initialized');
    }
    
    const universeReq = new this.module.ATUniverseReq(token, 2);
    const pkg = new this.module.NetPackage();
    
    const encodedReq = universeReq.encode();
    const encodedPkg = pkg.encode(this.module.CMD_AT_UNIVERSE_REV, encodedReq);
    
    // Copy to regular ArrayBuffer
    const regularBuffer = new ArrayBuffer(encodedPkg.byteLength);
    const regularView = new Uint8Array(regularBuffer);
    const encodedView = new Uint8Array(encodedPkg);
    regularView.set(encodedView);
    
    universeReq.delete();
    pkg.delete();
    
    return regularBuffer;
  }

  createUniverseSeedsRequest(token, sequenceId, revision, namespace, qualifiedName, marketCode, tradeDay) {
    if (!this.ready) {
      throw new Error('WASM module not initialized');
    }
    
    const seedsReq = new this.module.ATUniverseSeedsReq(
      token,
      sequenceId,
      revision,
      namespace,
      qualifiedName,
      marketCode,
      tradeDay
    );
    
    const pkg = new this.module.NetPackage();
    const encodedReq = seedsReq.encode();
    const encodedPkg = pkg.encode(this.module.CMD_AT_UNIVERSE_SEEDS, encodedReq);
    
    // Copy to regular ArrayBuffer
    const regularBuffer = new ArrayBuffer(encodedPkg.byteLength);
    const regularView = new Uint8Array(regularBuffer);
    const encodedView = new Uint8Array(encodedPkg);
    regularView.set(encodedView);
    
    seedsReq.delete();
    pkg.delete();
    
    return regularBuffer;
  }

  // Decode binary messages
  decodeMessage(arrayBuffer) {
    if (!this.ready) {
      throw new Error('WASM module not initialized');
    }
    
    const pkg = new this.module.NetPackage();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    pkg.decode(uint8Array);
    
    // Get header information
    const cmd = pkg.header.cmd;
    const seq = pkg.header.seq;
    
    // Get content and copy it to a new buffer BEFORE deleting pkg
    // This is critical - the content() returns a view into WASM memory
    // that becomes invalid after pkg.delete()
    const contentView = pkg.content();
    const contentLength = pkg.length();
    
    // Create a copy of the content
    const content = new Uint8Array(contentLength);
    content.set(new Uint8Array(contentView));
    
    // NOW we can safely delete the pkg
    pkg.delete();
    
    // Log the sizes for debugging
    logger.debug(`Decoded message: cmd=${cmd}, raw_len=${arrayBuffer.byteLength}, content_len=${contentLength}`);
    
    return { cmd, seq, content };
  }

  // Get command name from constant
  getCommandName(cmd) {
    if (!this.ready) return `Unknown(${cmd})`;
    
    const cmdConstants = [
      'NET_CMD_GOLD_ROUTE_KEEPALIVE', 'NET_CMD_GOLD_ROUTE_DATADEF',
      'CMD_AT_UNIVERSE_REV', 'CMD_AT_UNIVERSE_SEEDS', 'CMD_AT_UNIVERSE_META',
      'CMD_AT_FETCH_BY_CODE', 'CMD_AT_FETCH_BY_TIME', 'CMD_AT_FETCH_BY_TIME_RANGE',
      'CMD_AT_SUBSCRIBE', 'CMD_AT_UNSUBSCRIBE', 'CMD_AT_START_BACKTEST',
      'CMD_TA_PUSH_DATA', 'CMD_TA_MARKET_STATUS', 'CMD_TA_PUSH_PROGRESS',
      'CMD_TA_PUSH_LOG', 'CMD_TA_MARKET_SINGULARITY'
    ];
    
    for (const constantName of cmdConstants) {
      if (this.module[constantName] === cmd) {
        return constantName;
      }
    }
    
    return `Unknown(${cmd})`;
  }

  // Getters for stored data
  getSchema() {
    return this.schema;
  }

  getMarkets() {
    return this.markets;
  }

  // Cleanup
  cleanup() {
    if (this.compressor) {
      this.compressor.delete();
      this.compressor = null;
    }
    this.schema = null;
    this.schemaByNamespace = null;
    this.markets = null;
  }
}

export default WasmService;