/**
 * CaitlynClientConnection - Encapsulated Caitlyn WebSocket Client
 * 
 * This class encapsulates the complete Caitlyn WebSocket connection lifecycle:
 * 1. WASM module loading and verification
 * 2. WebSocket connection establishment
 * 3. Protocol handshake
 * 4. Schema loading and processing
 * 5. Universe revision and seeds initialization
 * 6. Real-time message handling
 * 
 * Based on the proven patterns from examples/test.js
 * 
 * @version 1.0
 * @author Auto-generated from test.js patterns
 */

import ws from 'nodejs-websocket';
import path from 'path';
import { createSingularityObject } from './SingularityObjects.js';
import SVObject from './StructValueWrapper.js';

class CaitlynClientConnection {
  constructor(options = {}) {
    // Connection configuration
    this.url = options.url;
    this.token = options.token;
    this.logger = options.logger || console;
    
    // Connection state
    this.wsClient = null;
    this.isConnected = false;
    this.isInitialized = false;
    this.isDisconnecting = false;
    
    // WASM module and processing
    this.wasmModule = null;
    this.compressor = null;
    this.schema = {};
    this.schemaByNamespace = {};
    
    // Universe data
    this.marketsData = {};
    this.securitiesByMarket = {};
    
    // Request tracking
    this.sequenceId = 3;
    this.expectedSeedsResponses = 0;
    this.receivedSeedsResponses = 0;
    
    // Async query cache for tracking request-response mapping
    this.queryCache = new Map(); // Map<sequenceId, queryInfo>
    
    // Event handlers
    this.eventHandlers = {
      'connected': [],
      'initialized': [],
      'schema_loaded': [],
      'universe_loaded': [],
      'seeds_loaded': [],
      'message': [],
      'error': [],
      'disconnected': []
    };
  }

  /**
   * Load and initialize the WASM module
   * @param {string} wasmJsPath - Path to caitlyn_js.js
   * @param {string} wasmPath - Path to caitlyn_js.wasm
   */
  async loadWasmModule(wasmJsPath = './public/caitlyn_js.js', wasmPath = './public/caitlyn_js.wasm') {
    try {
      this.logger.info('🔧 Loading WASM module...');
      
      // Dynamic import for ES modules with proper path resolution
      // Convert relative paths to absolute paths based on project root
      let resolvedPath;
      if (wasmJsPath.startsWith('/')) {
        // Absolute path
        resolvedPath = wasmJsPath;
      } else if (wasmJsPath.startsWith('.')) {
        // Relative path - resolve from project root
        resolvedPath = path.resolve(process.cwd(), wasmJsPath);
      } else {
        // Bare path
        resolvedPath = wasmJsPath;
      }
      
      this.logger.debug(`Resolving WASM path: ${wasmJsPath} -> ${resolvedPath}`);
      const CaitlynModule = await import(resolvedPath);
      this.wasmModule = await CaitlynModule.default();
      
      this.logger.info('✅ WASM module loaded successfully!');
      
      // Verify essential classes
      const requiredClasses = [
        'NetPackage', 'IndexSerializer', 'IndexSchema', 
        'ATUniverseReq', 'ATUniverseRes', 
        'ATUniverseSeedsReq', 'ATUniverseSeedsRes',
        'ATFetchByCodeReq', 'ATFetchSVRes'
      ];
      
      for (const className of requiredClasses) {
        if (typeof this.wasmModule[className] === "function") {
          this.logger.info(`✅ ${className} class is available.`);
        } else {
          throw new Error(`❌ ${className} class is not available.`);
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('❌ Failed to load WASM module:', error);
      throw error;
    }
  }

  /**
   * Connect to Caitlyn server and perform full initialization
   */
  async connect() {
    if (!this.wasmModule) {
      throw new Error('WASM module must be loaded before connecting');
    }
    
    if (!this.url || !this.token) {
      throw new Error('URL and token must be provided');
    }
    
    return new Promise((resolve, reject) => {
      this.logger.info("🔗 Connecting to Caitlyn server...");
      
      // Create WebSocket connection
      this.wsClient = ws.connect(this.url, {
        rejectUnauthorized: false
      }, () => {
        this.logger.info("🤝 WebSocket connected, sending handshake...");
        this.isConnected = true;
        this.emit('connected');
        
        // Send handshake message
        const handshakeMsg = `{"cmd":20512, "token":"${this.token}", "protocol":1, "seq":1}`;
        this.wsClient.sendText(handshakeMsg);
      });

      // Set up message handlers
      this.setupMessageHandlers(resolve, reject);
      
      // Set up error handlers
      this.wsClient.on("error", (error) => {
        this.logger.error("❌ WebSocket error:", error);
        this.isConnected = false;
        this.emit('error', error);
        reject(error);
      });
      
      this.wsClient.on("close", () => {
        this.logger.info("🔌 WebSocket connection closed");
        this.isConnected = false;
        
        // Only emit disconnected if we're not already in disconnect process
        if (!this.isDisconnecting) {
          this.emit('disconnected');
        }
      });
    });
  }

  /**
   * Set up WebSocket message handlers for initialization flow
   */
  setupMessageHandlers(resolve, reject) {
    // Handle text messages (handshake responses)
    this.wsClient.on("text", (msg) => {
      this.logger.info("📨 Text message:", msg);
      this.emit('message', { type: 'text', data: msg });
    });

    // Handle binary messages - complete initialization flow
    this.wsClient.on("binary", stream => {
      let buf = Buffer.alloc(0);
      
      stream.on("data", src => {
        buf = Buffer.concat([buf, src]);
      });
      
      stream.on("end", () => {
        try {
          // Convert Buffer to ArrayBuffer
          const _buf = this.bufferToArrayBuffer(buf);
          const pkg = new this.wasmModule.NetPackage();
          pkg.decode(_buf);
          
          // Log non-keepalive messages
          if (pkg.header.cmd !== this.wasmModule.NET_CMD_GOLD_ROUTE_KEEPALIVE && 
              pkg.header.cmd !== this.wasmModule.CMD_TA_MARKET_STATUS) {
            this.logger.info(`📦 Message: cmd=${pkg.header.cmd}, content_len=${pkg.length()}`);
          }
          
          // Route messages
          this.handleBinaryMessage(pkg, resolve, reject);
          
          // Cleanup
          pkg.delete();
          
        } catch (error) {
          this.logger.error('Error processing binary message:', error);
          this.emit('error', error);
          if (!this.isInitialized) {
            reject(error);
          }
        }
      });
    });
  }

  /**
   * Handle binary message routing
   */
  handleBinaryMessage(pkg, resolve, reject) {
    const cmd = pkg.header.cmd;
    
    switch (cmd) {
      case this.wasmModule.NET_CMD_GOLD_ROUTE_DATADEF:
        this.handleSchemaDefinition(pkg);
        break;
        
      case this.wasmModule.CMD_AT_UNIVERSE_REV:
        this.handleUniverseRevision(pkg, resolve);
        break;
        
      case this.wasmModule.CMD_AT_UNIVERSE_SEEDS:
        this.handleUniverseSeeds(pkg);
        break;
        
      case this.wasmModule.CMD_AT_FETCH_BY_TIME:
        this.handleFetchByCodeResponse(pkg);
        break;
        
      case this.wasmModule.CMD_AT_FETCH_BY_CODE:
        this.handleFetchByCodeResponse(pkg);
        break;
        
      case this.wasmModule.CMD_TA_MARKET_STATUS:
        // Market status - ignore for now
        break;
        
      default:
        this.logger.debug(`❓ Unhandled command: ${cmd}`);
        break;
    }
  }

  /**
   * Handle schema definition processing
   */
  handleSchemaDefinition(pkg) {
    this.logger.info('🏗️ ===== SCHEMA PROCESSING =====');
    
    // Create and load schema
    const schema = new this.wasmModule.IndexSchema();
    schema.load(pkg.content());
    const metas = schema.metas();
    
    this.logger.info(`📋 Loading ${metas.size()} metadata definitions...`);
    
    // Build schema lookup tables
    this.schema = {};
    this.schemaByNamespace = {};
    
    for (let i = 0; i < metas.size(); i++) {
      const meta = metas.get(i);
      
      // Internal schema for processing
      if (this.schemaByNamespace[meta.namespace] === undefined) {
        this.schemaByNamespace[meta.namespace] = {};
      }
      this.schemaByNamespace[meta.namespace][meta.ID] = meta;
      
      // Public schema structure
      const fullName = meta.name || '';
      const parts = fullName.split('::');
      const namespace = parts[0] || 'unknown';
      const displayName = parts[1] || `Unnamed_${meta.ID}`;
      
      const namespaceKey = meta.namespace.toString();
      if (!this.schema[namespaceKey]) {
        this.schema[namespaceKey] = {};
      }
      
      // Extract field definitions with memory-efficient approach
      const fields = [];
      
      if (meta.fields && typeof meta.fields.size === 'function') {
        const fieldCount = meta.fields.size();
        this.logger.debug(`  Extracting ${fieldCount} fields for meta ${meta.ID}`);
        
        // Limit field extraction to prevent memory issues
        const maxFields = Math.min(fieldCount, 100); // Limit to 100 fields per meta
        if (fieldCount > maxFields) {
          this.logger.debug(`  WARNING: Meta ${meta.ID} has ${fieldCount} fields, limiting to ${maxFields} for memory efficiency`);
        }
        
        for (let j = 0; j < maxFields; j++) {
          const field = meta.fields.get(j);
          if (field) {
            // Extract field type as integer enum value
            let fieldType = 0;
            if (field.type !== undefined) {
              // Handle case where type is already a number
              if (typeof field.type === 'number') {
                fieldType = field.type;
              } else if (field.type && typeof field.type === 'object' && field.type.value !== undefined) {
                // Handle C++ enum wrapped in object
                fieldType = field.type.value;
              } else {
                // Fallback: try to convert to number
                fieldType = parseInt(field.type) || 0;
              }
            }
            
            // Extract all field information
            fields.push({
              name: field.name || `field_${j}`,
              type: fieldType,
              pos: field.pos || j,
              precision: field.precision || 0,
              multiple: field.multiple || false,
              sampleType: field.sampleType || 0
            });
          }
        }
      } else {
        this.logger.debug(`  Meta ${meta.ID} has no fields or fields.size() is not a function`);
      }
      
      this.schema[namespaceKey][meta.ID] = {
        name: fullName,
        displayName: displayName,
        namespace: namespace,
        namespaceId: meta.namespace,
        revision: meta.revision || 0,
        fields: fields,
        description: meta.description || ''
      };
    }
    
    this.logger.info("✅ Schema loaded and organized by namespace");
    this.logger.info(`   - Global namespace (0): ${Object.keys(this.schema[0] || {}).length} metadata definitions`);
    this.logger.info(`   - Private namespace (1): ${Object.keys(this.schema[1] || {}).length} metadata definitions`);
    
    // Initialize compressor
    this.compressor = new this.wasmModule.IndexSerializer();
    this.compressor.updateSchema(schema);
    this.logger.info("🔧 IndexSerializer initialized with schema");
    
    // Clean up schema object - this should fix the memory leak
    schema.delete();
    
    this.emit('schema_loaded', { schema: this.schema, schemaByNamespace: this.schemaByNamespace });
    
    // Request universe revision
    this.requestUniverseRevision();
  }

  /**
   * Request universe revision data
   */
  requestUniverseRevision() {
    this.logger.info('📤 Requesting universe revision data...');
    
    const revReq = new this.wasmModule.ATUniverseReq(this.token, 2);
    const pkg = new this.wasmModule.NetPackage();
    const msg = Buffer.from(pkg.encode(this.wasmModule.CMD_AT_UNIVERSE_REV, revReq.encode()));
    
    this.wsClient.sendBinary(msg);
    this.logger.info("✅ Universe revision request sent");
    
    // Cleanup
    revReq.delete();
    pkg.delete();
  }

  /**
   * Handle universe revision response
   */
  handleUniverseRevision(pkg, resolve) {
    this.logger.info('🌍 ===== UNIVERSE REVISION PROCESSING =====');
    
    const res = new this.wasmModule.ATUniverseRes();
    res.setCompressor(this.compressor);
    res.decode(pkg.content());
    
    const revs = res.revs();
    const keys = revs.keys();
    
    this.logger.info(`📊 Processing ${keys.size()} namespaces`);
    
    this.marketsData = {};
    const svObjectCache = {};
    
    // Process each namespace
    for (let i = 0; i < keys.size(); i++) {
      const namespaceKey = keys.get(i);
      const structValues = revs.get(namespaceKey);
      const namespaceId = namespaceKey === 'private' ? 1 : 0;
      
      this.logger.debug(`Processing namespace: "${namespaceKey}" (${structValues.size()} entries)`);
      
      // Process each StructValue
      for (let j = 0; j < structValues.size(); j++) {
        const sv = structValues.get(j);
        
        // Look for Market metadata
        if (sv.metaID === 3 && this.schemaByNamespace[namespaceId] && this.schemaByNamespace[namespaceId][sv.metaID]) {
          const metaName = this.schemaByNamespace[namespaceId][sv.metaID].name;
          const marketCode = sv.stockCode;
          
          this.logger.debug(`  📈 Market: ${marketCode} (${metaName})`);
          
          // Use SVObject to extract data
          if (!svObjectCache[metaName]) {
            svObjectCache[metaName] = createSingularityObject(metaName, this.wasmModule);
            svObjectCache[metaName].loadDefFromDict(this.schemaByNamespace);
          }
          const marketData = svObjectCache[metaName];
          marketData.fromSv(sv);
          
          const marketJson = marketData.toJSON();
          const fields = marketJson.fields;
          
          if (fields.revs) {
            try {
              const revsData = JSON.parse(fields.revs);
              
              if (!this.marketsData[namespaceKey]) {
                this.marketsData[namespaceKey] = {};
              }
              
              this.marketsData[namespaceKey][marketCode] = {
                revisions: revsData,
                trade_day: fields.trade_day || 0,
                name: fields.name || marketCode
              };
              
              const qualifiedNames = Object.keys(revsData);
              this.logger.debug(`    ├─ Trade day: ${fields.trade_day}`);
              this.logger.debug(`    ├─ Market name: ${fields.name}`);
              this.logger.debug(`    └─ Qualified names: ${qualifiedNames.join(', ')}`);
              
            } catch (e) {
              this.logger.debug(`    ⚠️ Error parsing revisions data: ${e.message}`);
            }
          }
        }
        
        sv.delete();
      }
    }
    
    res.delete();
    
    // Cleanup SVObject instances
    for (const metaName in svObjectCache) {
      svObjectCache[metaName].cleanup();
    }
    
    const globalCount = Object.keys(this.marketsData.global || {}).length;
    const privateCount = Object.keys(this.marketsData.private || {}).length;
    this.logger.info(`✅ Extracted market data for ${globalCount} global markets and ${privateCount} private markets`);
    
    this.emit('universe_loaded', { markets: this.marketsData });
    
    // Request universe seeds
    this.requestUniverseSeeds(this.marketsData);
    
    // Initialization is complete
    this.isInitialized = true;
    this.emit('initialized');
    resolve(this);
  }

  /**
   * Request universe seeds for all markets
   */
  requestUniverseSeeds(marketsData) {
    this.logger.info('🌱 ===== UNIVERSE SEEDS REQUESTS =====');
    
    let requestsSent = 0;
    
    // Process each namespace and market
    for (const namespaceStr in marketsData) {
      const namespaceData = marketsData[namespaceStr];
      this.logger.debug(`Processing ${namespaceStr} namespace:`);
      
      for (const marketCode in namespaceData) {
        const marketInfo = namespaceData[marketCode];
        this.logger.debug(`  🏪 Market: ${marketCode} (${marketInfo.name})`);
        
        if (marketInfo.revisions && Object.keys(marketInfo.revisions).length > 0) {
          // Send seeds request for each qualified_name
          for (const qualifiedName in marketInfo.revisions) {
            const revision = marketInfo.revisions[qualifiedName];
            
            this.logger.debug(`    📤 Seeds request: ${qualifiedName} (rev: ${revision})`);
            
            const seedsReq = new this.wasmModule.ATUniverseSeedsReq(
              this.token,
              this.sequenceId++,
              revision,
              namespaceStr,
              qualifiedName,
              marketCode,
              marketInfo.trade_day
            );
            
            const pkg = new this.wasmModule.NetPackage();
            const msg = Buffer.from(pkg.encode(this.wasmModule.CMD_AT_UNIVERSE_SEEDS, seedsReq.encode()));
            
            this.wsClient.sendBinary(msg);
            requestsSent++;
            
            // Cleanup
            seedsReq.delete();
            pkg.delete();
          }
        }
      }
    }
    
    this.logger.info(`✅ Universe seeds requests completed: ${requestsSent} requests sent`);
    this.expectedSeedsResponses = requestsSent;
  }

  /**
   * Handle universe seeds response
   */
  handleUniverseSeeds(pkg) {
    const res = new this.wasmModule.ATUniverseSeedsRes();
    res.setCompressor(this.compressor);
    res.decode(pkg.content());
    
    const seedData = res.seedData();
    this.logger.debug(`📊 Received seeds response with ${seedData.size()} entries`);
    
    if (seedData.size() > 0) {
      const svObjectCache = {};
      
      for (let i = 0; i < seedData.size(); i++) {
        const entry = seedData.get(i);
        const market = entry.market;
        const code = entry.stockCode;
        
        // Process Security data specifically
        if (this.schemaByNamespace[entry.namespace] && this.schemaByNamespace[entry.namespace][entry.metaID]) {
          const metaName = this.schemaByNamespace[entry.namespace][entry.metaID].name;
          
          if (metaName.includes('Security')) {
            const actualMarket = entry.stockCode;
            
            if (!this.securitiesByMarket[actualMarket]) {
              this.securitiesByMarket[actualMarket] = [];
            }
            
            try {
              if (!svObjectCache[metaName]) {
                svObjectCache[metaName] = createSingularityObject(metaName, this.wasmModule);
                svObjectCache[metaName].loadDefFromDict(this.schemaByNamespace);
              }
              const svObject = svObjectCache[metaName];
              svObject.fromSv(entry);
              
              const objectData = svObject.toJSON();
              
              if (objectData.fields) {
                const securityData = {
                  code: code,
                  market: actualMarket,
                  codes: objectData.fields.code || [],
                  names: objectData.fields.name || [],
                  abbreviations: objectData.fields.abbreviation || [],
                  categories: objectData.fields.category || [],
                  states: objectData.fields.state || [],
                  lastClose: objectData.fields.last_close || [],
                  dividendRatio: objectData.fields.dividend_ratio || [],
                  tradeDay: objectData.fields.trade_day,
                  rev: objectData.fields.rev
                };
                
                this.securitiesByMarket[actualMarket].push(securityData);
              }
              
            } catch (e) {
              this.logger.debug(`⚠️ Error processing Security SVObject: ${e.message}`);
            }
          }
        }
        
        entry.delete();
      }
      
      // Cleanup SVObject instances
      for (const metaName in svObjectCache) {
        svObjectCache[metaName].cleanup();
      }
    }
    
    res.delete();
    
    // Track responses
    this.receivedSeedsResponses++;
    
    // Check if all responses received
    if (this.receivedSeedsResponses >= this.expectedSeedsResponses) {
      this.logger.info('🎉 All universe seeds responses received');
      this.emit('seeds_loaded', { securities: this.securitiesByMarket });
    }
  }

  /**
   * Handle ATFetchByCode/ATFetchByTime response using cached query parameters
   * Uses sequence ID to look up original query parameters for proper SVObject setup
   */
  handleFetchByCodeResponse(pkg) {
    this.logger.info('📥 ===== FETCH RESPONSE (ASYNC QUERY PIPELINE) =====');
    
    const res = new this.wasmModule.ATFetchSVRes();
    res.setCompressor(this.compressor);
    res.decode(pkg.content());
    
    this.logger.info(`🔍 Response decode completed, checking results availability...`);
    this.logger.info(`🔍 Response seq: ${res.seq}`);
    this.logger.info(`🔍 Response status: ${res.status}`);
    this.logger.info(`🔍 Response errorCode: ${res.errorCode}`);
    this.logger.info(`🔍 Response errorMsg: ${res.errorMsg}`);
    
    // Find cached query info by sequence ID
    const responseSeq = res.seq;
    const queryInfo = this.queryCache.get(responseSeq);
    
    if (!queryInfo) {
      this.logger.error(`❌ No cached query info found for seq=${responseSeq}`);
      res.delete();
      return;
    }
    
    // Check if the response indicates an error
    // A successful response typically has status 0 and errorCode 0
    if (res.errorCode !== 0) {
      this.logger.error(`❌ Server returned error response: ${res.errorMsg} (code: ${res.errorCode})`);
      if (queryInfo.reject) {
        queryInfo.reject(new Error(`Server error: ${res.errorMsg} (code: ${res.errorCode})`));
      }
      res.delete();
      this.queryCache.delete(responseSeq);
      return;
    }
    
    this.logger.info(`🔍 Attempting to access results...`);
    const results = res.results();
    const resultCount = results.size();
    
    this.logger.info(`📦 Received ${resultCount} StructValues from server`);
    this.logger.info(`🔍 Using cached query info for seq=${responseSeq}: ${queryInfo.qualifiedName}`);
    
    const records = [];
    
    if (results && resultCount > 0) {
      this.logger.info('🎯 Processing StructValues using async query pipeline:');
      
      // Create SVObject with proper metadata configuration from cache
      const svObject = new SVObject(this.wasmModule);
      
      // Configure SVObject with cached query parameters
      svObject.metaName = queryInfo.qualifiedName;
      svObject.namespace = queryInfo.namespace === 'global' ? this.wasmModule.NAMESPACE_GLOBAL : this.wasmModule.NAMESPACE_PRIVATE;
      svObject.granularity = queryInfo.granularity;
      this.logger.info(`✅ Configured SVObject: ${svObject.metaName} (namespace: ${queryInfo.namespace})`);
      
      svObject.loadDefFromDict(this.schemaByNamespace);
      
      const maxDisplay = resultCount; // Process all records instead of limiting to 5
      
      for (let i = 0; i < maxDisplay; i++) {
        const sv = results.get(i);
        
        try {
          // Process with configured SVObject - let it crash if issues
          svObject.fromSv(sv);
          const objectData = svObject.toJSON();
          const allFields = objectData.fields || {};
          
          // Filter to only return requested fields
          const fields = {};
          if (queryInfo.fields && Array.isArray(queryInfo.fields)) {
            for (const requestedField of queryInfo.fields) {
              if (allFields.hasOwnProperty(requestedField)) {
                fields[requestedField] = allFields[requestedField];
              }
            }
          } else {
            // If no fields specified, return all fields (backward compatibility)
            Object.assign(fields, allFields);
          }
          
          const record = {
            market: svObject.market || 'unknown',
            code: svObject.code || 'unknown',
            timestamp: svObject.timetag ? String(svObject.timetag) : '0', // Keep as string (milliseconds)
            metaID: sv.metaID,
            namespace: sv.namespace,
            metaName: queryInfo.qualifiedName,
            fieldCount: sv.fieldCount,
            granularity: svObject.granularity,
            fields: fields,
            queryInfo: queryInfo
          };
          
          this.logger.info(`📊 Record ${i + 1}: ${record.market}/${record.code} (${record.metaName})`);
          this.logger.info(`      📋 Fields: ${Object.keys(fields).join(', ')}`);
          if (Object.keys(fields).length > 0) {
            const fieldEntries = Object.entries(fields).slice(0, 4);
            const fieldSummary = fieldEntries.map(([name, value]) => `${name}=${value}`).join(', ');
            this.logger.info(`      📈 Values: ${fieldSummary}`);
          }
          
          records.push(record);
          
        } catch (e) {
          this.logger.error(`Error processing record ${i + 1}:`, e);
          records.push({
            market: sv.market || 'unknown',
            code: sv.stockCode || 'unknown',
            timestamp: sv.timeTag ? String(sv.timeTag) : '0',
            metaID: sv.metaID,
            namespace: sv.namespace,
            error: e.message,
            fields: {}
          });
        } finally {
          sv.delete();
        }
      }
      
      // Cleanup SVObject
      try {
        svObject.cleanup();
      } catch (cleanupError) {
        this.logger.debug('SVObject cleanup handled');
      }
      
      if (resultCount > maxDisplay) {
        this.logger.info(`... and ${resultCount - maxDisplay} more records available`);
      }
    } else {
      this.logger.info('📭 No data returned for request parameters');
    }
    
    res.delete();
    
    // Resolve the Promise with the decoded records
    if (queryInfo.resolve) {
      queryInfo.resolve({
        records: records,
        count: resultCount,
        qualifiedName: queryInfo.qualifiedName,
        market: queryInfo.market,
        code: queryInfo.code,
        success: true
      });
    }
    
    // Clean up query cache entry
    this.queryCache.delete(responseSeq);
    this.logger.debug(`🗑️ Cleaned up query cache for seq=${responseSeq}`);
    
    // Also emit event for backward compatibility
    this.emit('historical_data', { records, count: resultCount });
  }

  /**
   * Generic fetch by code method - works with any metadata type
   * Returns Promise that resolves with decoded SVObject instances
   */
  async fetchByCode(market, code, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Connection must be initialized before fetching data');
    }
    
    const {
      qualifiedName,
      namespace = 0,  // 0 for global, 1 for private
      granularity = 86400,
      fromTime,
      toTime,
      fields = [],
      revision = -1  // Support revision parameter
    } = options;
    
    // Convert Unix timestamps (seconds) to Date objects for logging
    const fromDate = fromTime ? new Date(fromTime * 1000) : new Date('2025-01-01');
    const toDate = toTime ? new Date(toTime * 1000) : new Date('2025-08-01');
    
    if (!qualifiedName) {
      throw new Error('qualifiedName is required for generic fetch operations');
    }
    
    const currentSeqId = ++this.sequenceId;
    
    this.logger.info(`📤 Generic fetch request: ${market}/${code} (${qualifiedName}) seq=${currentSeqId}`);
    
    // Return Promise that resolves when response is received
    return new Promise((resolve, reject) => {
      // Cache query parameters AND Promise resolver for async response processing
      const queryInfo = {
        type: 'fetchByCode',
        market: market,
        code: code,
        qualifiedName: qualifiedName,
        namespace: namespace,
        granularity: granularity,
        fromDate: fromDate,
        toDate: toDate,
        fields: fields,
        revision: revision,
        timestamp: Date.now(),
        resolve: resolve,  // Store Promise resolver
        reject: reject    // Store Promise rejector
      };
      
      this.queryCache.set(currentSeqId, queryInfo);
      this.logger.info(`💾 Cached query parameters for seq=${currentSeqId}`);
      
      try {
        // Create ATFetchByCode request
        const fetchByCodeReq = new this.wasmModule.ATFetchByCodeReq();
        
        this.logger.info(`🔍 ATFetchByCodeReq Parameters:`);
        this.logger.info(`   token: "${this.token}"`);
        this.logger.info(`   seq: ${currentSeqId}`);
        this.logger.info(`   namespace: "${namespace}"`);
        this.logger.info(`   qualifiedName: "${qualifiedName}"`);
        this.logger.info(`   revision: ${revision}`);
        this.logger.info(`   market: "${market}"`);
        this.logger.info(`   code: "${code}"`);
        this.logger.info(`   granularity: ${granularity}`);
        this.logger.info(`   fromDate: ${fromDate.toISOString()} (${fromDate.getTime()})`);
        this.logger.info(`   toDate: ${toDate.toISOString()} (${toDate.getTime()})`);
        this.logger.info(`   fields: [${fields.map(f => `"${f}"`).join(', ')}] (${fields.length} total)`);
        
        fetchByCodeReq.token = this.token;
        fetchByCodeReq.seq = currentSeqId;
        fetchByCodeReq.namespace = namespace.toString();  // Convert integer to string for WASM
        fetchByCodeReq.qualifiedName = qualifiedName;
        fetchByCodeReq.revision = revision;
        fetchByCodeReq.market = market;
        fetchByCodeReq.code = code;
        fetchByCodeReq.granularity = granularity;
        
        // Set fields if provided
        const fieldsVector = new this.wasmModule.StringVector();
        if (fields && fields.length > 0) {
          fields.forEach((field, index) => {
            this.logger.info(`   Adding field[${index}]: "${field}"`);
            fieldsVector.push_back(field);
          });
        }
        fetchByCodeReq.fields = fieldsVector;
        
        // Set time range - Use Unix timestamps converted to milliseconds as strings
        const fromTimeTag = fromTime ? (fromTime * 1000).toString() : fromDate.getTime().toString();
        const toTimeTag = toTime ? (toTime * 1000).toString() : toDate.getTime().toString();
        this.logger.info(`   fromTimeTag: "${fromTimeTag}" (from Unix ${fromTime})`);
        this.logger.info(`   toTimeTag: "${toTimeTag}" (from Unix ${toTime})`);
        
        fetchByCodeReq.fromTimeTag = fromTimeTag;
        fetchByCodeReq.toTimeTag = toTimeTag;
        
        // Encode and send
        const pkg = new this.wasmModule.NetPackage();
        const encodedMsg = pkg.encode(this.wasmModule.CMD_AT_FETCH_BY_CODE, fetchByCodeReq.encode());
        const msgBuffer = Buffer.from(encodedMsg);
        
        this.wsClient.sendBinary(msgBuffer);
        this.logger.info(`✅ Generic fetch request sent: ${qualifiedName} (seq=${currentSeqId})`);
        
        // Cleanup
        fetchByCodeReq.delete();
        pkg.delete();
        fieldsVector.delete();
        
      } catch (error) {
        this.logger.error(`❌ Error sending fetch request: ${error.message}`);
        this.queryCache.delete(currentSeqId);
        reject(error);
      }
    });
  }

  /**
   * Generic fetch by time range method - works with any metadata type  
   */
  async fetchByTimeRange(market, code, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Connection must be initialized before fetching data');
    }
    
    const {
      metaID,
      granularity = 86400,
      fromDate = new Date('2025-01-01'),
      toDate = new Date('2025-08-01'),
      limit = 1000
    } = options;
    
    if (metaID === undefined) {
      throw new Error('metaID is required for fetch by time range operations');
    }
    
    const currentSeqId = ++this.sequenceId;
    
    this.logger.info(`📤 Generic fetch by time range: ${market}/${code} (metaID: ${metaID}) seq=${currentSeqId}`);
    
    // Cache query parameters for async response processing
    const queryInfo = {
      type: 'fetchByTimeRange',
      market: market,
      code: code,
      metaID: metaID,
      granularity: granularity,
      fromDate: fromDate,
      toDate: toDate,
      limit: limit,
      timestamp: Date.now()
    };
    
    this.queryCache.set(currentSeqId, queryInfo);
    this.logger.info(`💾 Cached query parameters for seq=${currentSeqId}`);
    
    const pkg = new this.wasmModule.NetPackage();
    
    const requestData = {
      token: this.token,
      sequence: currentSeqId,
      market: market,
      code: code,
      metaID: metaID,
      granularity: granularity,
      startTime: fromDate.getTime(),
      endTime: toDate.getTime(),
      limit: limit
    };
    
    const requestJson = JSON.stringify(requestData);
    const requestBuffer = new TextEncoder().encode(requestJson);
    
    const encodedPkg = pkg.encode(this.wasmModule.CMD_AT_FETCH_BY_TIME_RANGE, requestBuffer);
    const msgBuffer = Buffer.from(encodedPkg);
    
    this.wsClient.sendBinary(msgBuffer);
    this.logger.info(`✅ Generic fetch by time range request sent: metaID=${metaID} (seq=${currentSeqId})`);
    
    pkg.delete();
    
    return true;
  }

  /**
   * Find meta by qualified name in schema
   */
  findMetaByQualifiedName(namespace, qualifiedName) {
    if (!this.schemaByNamespace[namespace]) return null;
    
    const ns = namespace === this.wasmModule.NAMESPACE_GLOBAL ? "global" : "private";
    
    for (const metaId in this.schemaByNamespace[namespace]) {
      const meta = this.schemaByNamespace[namespace][metaId];
      const parts = meta.name.split("::");
      const metaNs = parts[0];
      const name = parts[1];
      
      if (metaNs === ns && name === qualifiedName) {
        return meta;
      }
    }
    
    return null;
  }

  /**
   * Convert Buffer to ArrayBuffer
   */
  bufferToArrayBuffer(buf) {
    const ab = new ArrayBuffer(buf.length);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buf.length; ++i) {
      view[i] = buf[i];
    }
    return ab;
  }

  /**
   * Add event listener
   */
  on(event, handler) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(handler);
  }

  /**
   * Remove event listener
   */
  off(event, handler) {
    if (this.eventHandlers[event]) {
      const index = this.eventHandlers[event].indexOf(handler);
      if (index > -1) {
        this.eventHandlers[event].splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  emit(event, data) {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.logger.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    // Prevent recursive disconnect calls
    if (this.isDisconnecting) {
      return;
    }
    
    this.isDisconnecting = true;
    this.logger.debug('🔌 Starting disconnect process...');
    
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    this.isConnected = false;
    this.isInitialized = false;
    
    // Cleanup WASM objects
    if (this.compressor) {
      this.compressor.delete();
      this.compressor = null;
    }
    
    this.logger.debug('✅ Disconnect process completed');
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      initialized: this.isInitialized,
      url: this.url,
      marketsCount: Object.keys(this.marketsData.global || {}).length,
      securitiesCount: Object.values(this.securitiesByMarket).reduce((sum, arr) => sum + arr.length, 0),
      schemaObjects: Object.keys(this.schema).reduce((sum, ns) => sum + Object.keys(this.schema[ns]).length, 0)
    };
  }
}

export default CaitlynClientConnection;