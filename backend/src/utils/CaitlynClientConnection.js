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
import CaitlynSubscriptionHub from './CaitlynSubscriptionHub.js';

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
    
    // Real-time subscription management
    this.subscriptions = new Map(); // Map<subscriptionKey, subscriptionInfo>
    this.subscriptionCallbacks = new Map(); // Map<subscriptionKey, callback>
    
    // Enhanced subscription hub (optional, for deduplication and optimization)
    this.subscriptionHub = options.useSubscriptionHub !== false ? new CaitlynSubscriptionHub(this, this.logger) : null;
    
    // Event handlers
    this.eventHandlers = {
      'connected': [],
      'initialized': [],
      'schema_loaded': [],
      'universe_loaded': [],
      'seeds_loaded': [],
      'message': [],
      'error': [],
      'disconnected': [],
      'real_time_data': [] // Add real-time data event
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
        'ATFetchByCodeReq', 'ATFetchSVRes',
        'ATSubscribeReq', 'ATSubscribeRes', 'ATUnsubscribeReq',
        'ATSubscribeSVRes', 'ATSubscribeOrderRes', 'StringVector', 'StringMatrix', 'Uint32Vector', 'Uint8Vector'
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
            this.logger.info(`📦 Message: cmd=${this.getCommandName(pkg.header.cmd)} (${pkg.header.cmd}), content_len=${pkg.length()}`);
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
        
      case this.wasmModule.CMD_AT_SUBSCRIBE:
        this.handleSubscriptionConfirmation(pkg);  // ATSubscribeRes
        break;
        
      case this.wasmModule.CMD_AT_UNSUBSCRIBE:
        this.handleUnsubscriptionResponse(pkg);
        break;
                
      case this.wasmModule.CMD_AT_SUBSCRIBE_SORT:
        this.handleSubscriptionData(pkg);  // ATSubscribeSVRes - the actual data
        break;
        
      case this.wasmModule.CMD_TA_SUBSCRIBE_HEADER:
        this.logger.info(`📦 Received ${this.getCommandName(this.wasmModule.CMD_TA_SUBSCRIBE_HEADER)}`);
        this.handleSubscriptionHeader(pkg);  // ATSubscribeOrderRes
        break;
        
      case this.wasmModule.CMD_TA_MARKET_STATUS:
        // Market status - ignore for now
        break;
      case this.wasmModule.CMD_TA_PUSH_DATA:
        // Check if this might be real-time market data
        this.handlePotentialRealTimeData(pkg);
        break;
      default:
        this.logger.debug(`❓ Unhandled command: ${this.getCommandName(cmd)} (${cmd})`);
        let errRes = new this.wasmModule.ATBaseResponse()
        errRes.decode(pkg.content());
        this.logger.warn(`⚠️ Unhandled message: cmd=${this.getCommandName(cmd)} (${cmd}), status=${errRes.status}, errorCode=${errRes.errorCode}, errorMsg=${errRes.errorMsg}`);
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
    this.logger.info(`✅ ${this.getCommandName(this.wasmModule.CMD_AT_UNIVERSE_REV)} sent`);
    
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
            
            this.logger.debug(`📤 Sent ${this.getCommandName(this.wasmModule.CMD_AT_UNIVERSE_SEEDS)} for ${marketCode}::${qualifiedName}`);
            
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
   * Handle subscription response (ATSubscribeRes)
   */
  handleSubscriptionResponse(pkg) {
    const subscribeRes = new this.wasmModule.ATSubscribeRes();
    subscribeRes.decode(pkg.content());
    
    this.logger.info('📡 ===== SUBSCRIPTION RESPONSE =====');
    this.logger.info(`🆔 UUID: ${subscribeRes.UUID}`);
    this.logger.info(`✅ Status: ${subscribeRes.status}`);
    
    // UUID verification - Check if server UUID exists in local subscriptions
    const serverUUID = subscribeRes.UUID;
    let foundSubscription = null;
    let subscriptionKey = null;
    
    for (const [key, info] of this.subscriptions.entries()) {
      if (info.uuid === serverUUID) {
        foundSubscription = info;
        subscriptionKey = key;
        break;
      }
    }
    
    if (!foundSubscription) {
      this.logger.error(`❌ UUID VERIFICATION FAILED: Server returned UUID ${serverUUID} which does not exist in local subscriptions`);
      this.logger.error(`   📋 Local subscription UUIDs: ${Array.from(this.subscriptions.values()).map(s => s.uuid).join(', ')}`);
      subscribeRes.delete();
      return;
    }
    
    this.logger.info(`✅ UUID verification passed: ${serverUUID} matches local subscription for ${subscriptionKey}`);
    
    if (subscribeRes.status !== 0) {
      this.logger.error(`❌ Subscription failed: ${subscribeRes.errorMsg}`);
      foundSubscription.confirmed = false;
      foundSubscription.error = subscribeRes.errorMsg;
    } else {
      this.logger.info('🎯 Subscription established successfully');
      foundSubscription.confirmed = true;
    }
    
    foundSubscription.confirmedAt = new Date();
    foundSubscription.serverStatus = subscribeRes.status;
    
    subscribeRes.delete();
  }

  /**
   * Handle unsubscription response
   */
  handleUnsubscriptionResponse(pkg) {
    // ATUnsubscribeReq doesn't have a specific response class, just log success
    this.logger.info('📡 ===== UNSUBSCRIPTION RESPONSE =====');
    this.logger.info('✅ Unsubscription confirmed');
  }

  /**
   * Handle real-time subscription data (ATSubscribeSVRes)
   */
  handleRealTimeSubscriptionData(pkg) {
    const realTimeRes = new this.wasmModule.ATSubscribeSVRes();
    realTimeRes.setCompressor(this.compressor);
    realTimeRes.decode(pkg.content());
    
    const structValues = realTimeRes.values();
    const fieldCount = realTimeRes.fields ? realTimeRes.fields.length : 0;
    
    this.logger.info('📡 ===== REAL-TIME SUBSCRIPTION DATA =====');
    this.logger.info(`📊 Received ${structValues.size()} StructValues`);
    this.logger.info(`🏷️ Fields: ${fieldCount}`);
    
    // Process each StructValue and match to subscriptions
    for (let i = 0; i < structValues.size(); i++) {
      const sv = structValues.get(i);
      this.processRealTimeDataForSubscription(sv);
    }
    
    realTimeRes.delete();
  }

  /**
   * Process individual StructValue for subscription matching
   */
  processRealTimeDataForSubscription(sv) {
    // Extract metadata
    const metaID = sv.metaID;
    const namespace = sv.namespace;
    
    // Find meta information
    const meta = this.schemaByNamespace[namespace]?.[metaID];
    if (!meta) {
      this.logger.debug(`⚠️ Meta not found: ID=${metaID}, namespace=${namespace}`);
      return;
    }
    
    const qualifiedName = meta.name;
    const namespaceStr = namespace === 0 ? 'global' : 'private';
    
    // Extract market/code information from the StructValue
    let market = 'unknown';
    let code = 'unknown';
    
    // Use SVObject to extract data
    const svObject = createSingularityObject(qualifiedName, this.wasmModule);
    if (svObject) {
      svObject.loadDefFromDict(this.schemaByNamespace);
      svObject.fromSv(sv);
      const data = svObject.toJSON();
      
      // Extract market/code from common field patterns
      market = data.fields.market || data.fields.marketCode || 'unknown';
      code = data.fields.code || data.fields.symbol || data.fields.stockCode || 'unknown';
      
      // Match against active subscriptions
      for (const [subscriptionKey, subscriptionInfo] of this.subscriptions.entries()) {
        if (subscriptionInfo.active &&
            subscriptionInfo.market === market &&
            subscriptionInfo.code === code &&
            subscriptionInfo.qualifiedName === qualifiedName &&
            subscriptionInfo.namespace === namespaceStr) {
          
          // Call subscription callback
          const callback = this.subscriptionCallbacks.get(subscriptionKey);
          if (callback) {
            const realTimeRecord = {
              subscriptionKey,
              market,
              code,
              qualifiedName,
              namespace: namespaceStr,
              timestamp: Date.now(),
              fields: data.fields
            };
            
            callback(realTimeRecord);
            this.logger.debug(`📡 Delivered real-time data to subscription: ${subscriptionKey}`);
          }
        }
      }
      
      svObject.cleanup();
    }
  }

  /**
   * Handle subscription confirmation using ATSubscribeRes
   */
  handleSubscriptionConfirmation(pkg) {
    try {
      this.logger.info(`📦 Processing subscription confirmation, content length: ${pkg.content().length} bytes`);
      
      const res = new this.wasmModule.ATSubscribeRes();
      res.decode(pkg.content());

      this.logger.info(`🔍 Subscription confirmation - errorCode: ${res.errorCode}`);
      this.logger.info(`🔍 Subscription confirmation - errorMsg: ${res.errorMsg}`);

      if (res.errorCode !== 0) {
        this.logger.error(`❌ Subscription error: ${res.errorMsg} (code: ${res.errorCode})`);
        res.delete();
        return;
      }

      this.logger.info(`✅ Subscription confirmed successfully`);
      res.delete();
      
    } catch (error) {
      this.logger.error('Error handling subscription confirmation:', error);
    }
  }

  /**
   * Handle subscription header using ATSubscribeOrderRes
   */
  handleSubscriptionHeader(pkg) {
    try {
      this.logger.info(`📦 Processing subscription header, content length: ${pkg.content().length} bytes`);
      
      const res = new this.wasmModule.ATSubscribeOrderRes();
      res.decode(pkg.content());

      this.logger.info(`🔍 Subscription header - errorCode: ${res.errorCode}`);
      this.logger.info(`🔍 Subscription header - errorMsg: ${res.errorMsg}`);

      if (res.errorCode !== 0) {
        this.logger.error(`❌ Subscription header error: ${res.errorMsg} (code: ${res.errorCode})`);
        res.delete();
        return;
      }

      this.logger.info(`✅ Subscription header processed successfully`);
      
      // The header typically contains metadata about the subscription stream
      // For now, just log success - actual data will come in subsequent messages
      
      res.delete();
      
    } catch (error) {
      this.logger.error('Error handling subscription header:', error);
    }
  }

  /**
   * Handle subscription data using ATSubscribeSVRes (the actual data)
   */
  handleSubscriptionData(pkg) {
    try {
      this.logger.info(`📦 Processing subscription data, content length: ${pkg.content().length} bytes`);
      
      const res = new this.wasmModule.ATSubscribeSVRes();
      res.setCompressor(this.compressor);
      res.decode(pkg.content());

      this.logger.info(`🔍 Subscription data - errorCode: ${res.errorCode}`);
      this.logger.info(`🔍 Subscription data - errorMsg: ${res.errorMsg}`);

      if (res.errorCode !== 0) {
        this.logger.error(`❌ Subscription data error: ${res.errorMsg} (code: ${res.errorCode})`);
        res.delete();
        return;
      }

      // Process StructValues using same approach as fetchByCode
      const structValues = res.values();
      if (!structValues || structValues.size() === 0) {
        this.logger.debug('📡 No StructValues in subscription data');
        res.delete();
        return;
      }

      const records = [];
      const svObjectCache = {}; // Reusable SVObject cache
      
      this.logger.info(`📡 Processing ${structValues.size()} StructValues from subscription data`);

      try {
        for (let i = 0; i < structValues.size(); i++) {
          const sv = structValues.get(i);
          
          try {
            // Extract metadata
            const metaID = sv.metaID;
            const namespace = sv.namespace;
            
            // Find meta information
            const meta = this.schemaByNamespace[namespace]?.[metaID];
            if (!meta) {
              this.logger.debug(`⚠️ Meta not found: ID=${metaID}, namespace=${namespace}`);
              sv.delete();
              continue;
            }
            
            const qualifiedName = meta.name;
            
            // Create or reuse SVObject instance
            if (!svObjectCache[qualifiedName]) {
              svObjectCache[qualifiedName] = new SVObject(this.wasmModule);
              svObjectCache[qualifiedName].metaName = qualifiedName;
              svObjectCache[qualifiedName].namespace = namespace;
              svObjectCache[qualifiedName].revision = 0xFFFFFFFF;
              svObjectCache[qualifiedName].loadDefFromDict(this.schemaByNamespace);
            }

            // Reuse existing SVObject instance
            const svObject = svObjectCache[qualifiedName];
            svObject.fromSv(sv);
            const objectData = svObject.toJSON();
            
            // Create record
            const record = {
              metaName: qualifiedName,
              namespace: namespace === 0 ? 'global' : 'private',
              fields: objectData.fields || {},
              timestamp: Date.now(),
              receivedAt: new Date().toISOString()
            };
            
            records.push(record);
            
          } finally {
            sv.delete();
          }
        }
        
        // Cleanup all cached SVObjects
        for (const metaName in svObjectCache) {
          svObjectCache[metaName].cleanup();
        }
        
        // Process records through subscription callbacks
        this.processSubscriptionRecords(records);
        
      } catch (processingError) {
        this.logger.error('Error processing subscription StructValues:', processingError);
        
        // Cleanup cached SVObjects on error
        for (const metaName in svObjectCache) {
          try {
            svObjectCache[metaName].cleanup();
          } catch (cleanupError) {
            this.logger.error('Error cleaning up SVObject:', cleanupError);
          }
        }
      }
      
      res.delete();
      
    } catch (error) {
      this.logger.error('Error handling subscription data:', error);
    }
  }

  /**
   * Process subscription records and call appropriate callbacks
   */
  processSubscriptionRecords(records) {
    if (records.length === 0) {
      this.logger.debug('📡 No subscription records to process');
      return;
    }

    this.logger.info(`📡 Processing ${records.length} subscription records`);
    let matchedRecords = 0;
    let verifiedDeliveries = 0;

    for (const record of records) {
      let recordMatched = false;
      
      // Try to match to active subscriptions with verification
      for (const [subscriptionKey, subscriptionInfo] of this.subscriptions.entries()) {
        // Subscription verification checklist
        const checks = {
          active: subscriptionInfo.active,
          confirmed: subscriptionInfo.confirmed,
          hasUUID: !!subscriptionInfo.uuid,
          validCallback: this.subscriptionCallbacks.has(subscriptionKey)
        };
        
        // Only process for fully verified subscriptions
        if (!checks.active) {
          this.logger.debug(`⚠️ Skipping inactive subscription: ${subscriptionKey}`);
          continue;
        }
        
        if (!checks.confirmed) {
          this.logger.warn(`⚠️ Skipping unconfirmed subscription: ${subscriptionKey} (UUID: ${subscriptionInfo.uuid})`);
          continue;
        }
        
        if (!checks.hasUUID) {
          this.logger.error(`❌ VERIFICATION FAILED: Subscription ${subscriptionKey} has no UUID - data rejected`);
          continue;
        }
        
        if (!checks.validCallback) {
          this.logger.error(`❌ VERIFICATION FAILED: No callback found for subscription ${subscriptionKey} (UUID: ${subscriptionInfo.uuid})`);
          continue;
        }
        
        // Check if this record matches any of the subscribed qualified names
        const matchesQualifiedName = subscriptionInfo.qualifiedNames.some(qn => 
          qn === record.metaName || qn === `${record.namespace}::${record.metaName.split('::')[1]}`
        );
        
        if (matchesQualifiedName) {
          recordMatched = true;
          
          this.logger.debug(`✅ Subscription verification passed for ${subscriptionKey}`);
          this.logger.debug(`   🆔 UUID: ${subscriptionInfo.uuid}`);
          this.logger.debug(`   📊 Data: ${record.namespace}::${record.metaName}`);
          this.logger.debug(`   📋 Fields: ${Object.keys(record.fields).length} fields`);
          
          // Call the subscription callback
          const callback = this.subscriptionCallbacks.get(subscriptionKey);
          try {
            // Enhance record with subscription UUID for traceability
            const enhancedRecord = {
              ...record,
              subscriptionKey,
              subscriptionUUID: subscriptionInfo.uuid,
              market: record.fields.market || record.fields.marketCode || 'unknown',
              code: record.fields.code || record.fields.symbol || record.fields.stockCode || 'unknown'
            };
            
            callback(enhancedRecord);
            verifiedDeliveries++;
            
            this.logger.debug(`📡 Successfully delivered data to subscription ${subscriptionKey} (UUID: ${subscriptionInfo.uuid})`);
            
          } catch (callbackError) {
            this.logger.error(`❌ Error in subscription callback for ${subscriptionKey} (UUID: ${subscriptionInfo.uuid}): ${callbackError.message}`);
          }
          
          // Emit real-time data event with subscription context
          this.emit('real_time_data', {
            ...record,
            subscriptionKey,
            subscriptionUUID: subscriptionInfo.uuid
          });
        }
      }
      
      if (recordMatched) {
        matchedRecords++;
      } else {
        this.logger.debug(`⚠️ No active subscriptions matched record: ${record.namespace}::${record.metaName}`);
      }
    }
    
    this.logger.info(`📊 Subscription processing summary:`);
    this.logger.info(`   📦 Records processed: ${records.length}`);
    this.logger.info(`   ✅ Records matched: ${matchedRecords}`);
    this.logger.info(`   📡 Verified deliveries: ${verifiedDeliveries}`);
    this.logger.info(`   🎯 Active subscriptions: ${Array.from(this.subscriptions.values()).filter(s => s.active).length}`);
  }

  /**
   * Handle potential real-time market data messages
   */
  handlePotentialRealTimeData(pkg) {
    if (this.subscriptions.size === 0) {
      return; // No active subscriptions
    }
    
    // Skip if we can't process the content
    if (!pkg.content) {
      return;
    }
    
    this.logger.debug(`📡 Processing potential real-time data message (cmd: ${this.getCommandName(pkg.header.cmd)} (${pkg.header.cmd}))`);
    
    // Try to decode as ATSubscribeSVRes for real-time subscription data
    try {
      const realTimeRes = new this.wasmModule.ATSubscribeSVRes();
      realTimeRes.setCompressor(this.compressor);
      realTimeRes.decode(pkg.content());
      
      const structValues = realTimeRes.values();
      if (!structValues || structValues.size() === 0) {
        realTimeRes.delete();
        return;
      }

      const resultCount = structValues.size();
      this.logger.debug(`📡 Processing ${resultCount} StructValues from subscription data`);

      // Process each StructValue
      for (let i = 0; i < resultCount; i++) {
        const sv = structValues.get(i);
        
        try {
          // Process the StructValue for subscription matching
          this.processRealTimeDataForSubscription(sv);
          
        } finally {
          sv.delete();
        }
      }
      
      realTimeRes.delete();
      
    } catch (error) {
      this.logger.debug(`Could not decode as ATSubscribeSVRes: ${error.message}`);
    }
  }

  /**
   * Process real-time data for a specific subscription
   */
  processRealTimeDataForSubscription(sv, subscriptionInfo = null, subscriptionKey = null) {
    // If no subscription info provided, try to match from StructValue
    if (!subscriptionInfo) {
      // Extract metadata
      const metaID = sv.metaID;
      const namespace = sv.namespace;
      
      // Find meta information
      const meta = this.schemaByNamespace[namespace]?.[metaID];
      if (!meta) {
        this.logger.debug(`⚠️ Meta not found: ID=${metaID}, namespace=${namespace}`);
        return;
      }
      
      const qualifiedName = meta.name;
      const namespaceStr = namespace === 0 ? 'global' : 'private';
      
      // Try to match to an active subscription
      let matchedSubscription = null;
      let matchedKey = null;
      
      for (const [key, info] of this.subscriptions.entries()) {
        if (info.active && info.qualifiedName === qualifiedName && info.namespace === namespaceStr) {
          matchedSubscription = info;
          matchedKey = key;
          break;
        }
      }
      
      if (!matchedSubscription) {
        this.logger.debug(`📡 No active subscription found for ${qualifiedName} (${namespaceStr})`);
        return;
      }
      
      subscriptionInfo = matchedSubscription;
      subscriptionKey = matchedKey;
    }
    try {
      // Create SVObject for processing
      const svObject = new SVObject(this.wasmModule);
      svObject.metaName = subscriptionInfo.qualifiedName;
      svObject.namespace = subscriptionInfo.namespace === 'global' ? 
        this.wasmModule.NAMESPACE_GLOBAL : this.wasmModule.NAMESPACE_PRIVATE;
      
      // Load schema definition
      svObject.loadDefFromDict(this.schemaByNamespace);
      
      // Process the StructValue
      svObject.fromSv(sv);
      const objectData = svObject.toJSON();
      
      // Create real-time data record
      const realTimeRecord = {
        market: svObject.market || subscriptionInfo.market,
        code: svObject.code || subscriptionInfo.code,
        timestamp: svObject.timetag ? String(svObject.timetag) : String(Date.now()),
        metaName: subscriptionInfo.qualifiedName,
        namespace: subscriptionInfo.namespace,
        fields: objectData.fields || {},
        subscriptionKey: subscriptionKey,
        receivedAt: new Date().toISOString()
      };

      this.logger.debug(`📡 Real-time data: ${subscriptionInfo.market}/${subscriptionInfo.code} (${subscriptionInfo.qualifiedName})`);
      
      // Call the subscription callback
      const callback = this.subscriptionCallbacks.get(subscriptionKey);
      if (callback) {
        try {
          callback(realTimeRecord);
        } catch (callbackError) {
          this.logger.error(`Error in subscription callback for ${subscriptionKey}: ${callbackError.message}`);
        }
      }
      
      // Emit real-time data event
      this.emit('real_time_data', realTimeRecord);
      
      // Cleanup SVObject
      svObject.cleanup();
    } catch (error) {
      this.logger.error(`Error processing real-time data for subscription ${subscriptionKey}:`, error);
    }
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
      this.logger.info(`✅ ${this.getCommandName(this.wasmModule.CMD_AT_FETCH_BY_CODE)} sent: ${qualifiedName} (seq=${currentSeqId})`);
      // Cleanup
      fetchByCodeReq.delete();
      pkg.delete();
      fieldsVector.delete();
      

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
    this.logger.info(`✅ ${this.getCommandName(this.wasmModule.CMD_AT_FETCH_BY_TIME_RANGE)} sent: metaID=${metaID} (seq=${currentSeqId})`);
    
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
   * Get field names from schema for a qualified name
   * @param {string} qualifiedName - The qualified name (e.g., 'SampleQuote')
   * @param {string} schemaKey - The schema key ('0' for global, '1' for private)
   * @returns {string[]|null} Array of field names or null if not found
   */
  getFieldsFromSchema(qualifiedName, schemaKey) {
    // Look for the metadata in the processed schema (this.schema has the field information)
    if (this.schema[schemaKey]) {
      for (const metaId in this.schema[schemaKey]) {
        const meta = this.schema[schemaKey][metaId];
        if (meta.name && meta.name.endsWith(`::${qualifiedName}`)) {
          // Found the metadata, extract field names
          const fieldNames = [];
          if (meta.fields && Array.isArray(meta.fields)) {
            for (const field of meta.fields) {
              if (field.name && field.name !== 'field_0' && !field.name.startsWith('field_')) {
                fieldNames.push(field.name);
              }
            }
          }
          this.logger.debug(`📋 Found ${fieldNames.length} fields in schema for ${qualifiedName} (namespace ${schemaKey}): ${fieldNames.join(', ')}`);
          return fieldNames;
        }
      }
    }
    
    this.logger.debug(`⚠️ No schema fields found for ${qualifiedName} in namespace ${schemaKey}, using defaults`);
    return null;
  }

  /**
   * Get command name from command code for better logging
   * Complete list of all commands from caitlyn_js.cpp
   */
  getCommandName(cmd) {
    // Complete map of all command codes to names from caitlyn_js.cpp
    const commandNames = {
      // NET_CMD constants
      [this.wasmModule.NET_CMD_GOLD_ROUTE_KEEPALIVE]: 'NET_CMD_GOLD_ROUTE_KEEPALIVE',
      [this.wasmModule.NET_CMD_GOLD_ROUTE_DATADEF]: 'NET_CMD_GOLD_ROUTE_DATADEF',
      
      // CMD_AT constants (client to server)
      [this.wasmModule.CMD_AT_START_BACKTEST]: 'CMD_AT_START_BACKTEST',
      [this.wasmModule.CMD_AT_CTRL_BACKTEST]: 'CMD_AT_CTRL_BACKTEST',
      [this.wasmModule.CMD_AT_UNIVERSE_REV]: 'CMD_AT_UNIVERSE_REV',
      [this.wasmModule.CMD_AT_UNIVERSE_META]: 'CMD_AT_UNIVERSE_META',
      [this.wasmModule.CMD_AT_UNIVERSE_SEEDS]: 'CMD_AT_UNIVERSE_SEEDS',
      [this.wasmModule.CMD_AT_FETCH_BY_CODE]: 'CMD_AT_FETCH_BY_CODE',
      [this.wasmModule.CMD_AT_FETCH_BY_TIME]: 'CMD_AT_FETCH_BY_TIME',
      [this.wasmModule.CMD_AT_FETCH_BY_TIME_RANGE]: 'CMD_AT_FETCH_BY_TIME_RANGE',
      [this.wasmModule.CMD_AT_RUN_FORMULA]: 'CMD_AT_RUN_FORMULA',
      [this.wasmModule.CMD_AT_REG_FORMULA]: 'CMD_AT_REG_FORMULA',
      [this.wasmModule.CMD_AT_DEL_FORMULA]: 'CMD_AT_DEL_FORMULA',
      [this.wasmModule.CMD_AT_CAL_FORMULA]: 'CMD_AT_CAL_FORMULA',
      [this.wasmModule.CMD_AT_REG_LIBRARIES]: 'CMD_AT_REG_LIBRARIES',
      [this.wasmModule.CMD_AT_SUBSCRIBE]: 'CMD_AT_SUBSCRIBE',
      [this.wasmModule.CMD_AT_SUBSCRIBE_SORT]: 'CMD_AT_SUBSCRIBE_SORT',
      [this.wasmModule.CMD_AT_UNSUBSCRIBE]: 'CMD_AT_UNSUBSCRIBE',
      [this.wasmModule.CMD_AT_ACCOUNT_ADD]: 'CMD_AT_ACCOUNT_ADD',
      [this.wasmModule.CMD_AT_ACCOUNT_DEL]: 'CMD_AT_ACCOUNT_DEL',
      [this.wasmModule.CMD_AT_ACCOUNT_EDIT]: 'CMD_AT_ACCOUNT_EDIT',
      [this.wasmModule.CMD_AT_MODIFY_BASKET]: 'CMD_AT_MODIFY_BASKET',
      [this.wasmModule.CMD_AT_MANUAL_TRADE]: 'CMD_AT_MANUAL_TRADE',
      [this.wasmModule.CMD_AT_MANUAL_EDIT]: 'CMD_AT_MANUAL_EDIT',
      [this.wasmModule.CMD_AT_ADD_STRATEGY_INSTANCE]: 'CMD_AT_ADD_STRATEGY_INSTANCE',
      [this.wasmModule.CMD_AT_DEL_STRATEGY_INSTANCE]: 'CMD_AT_DEL_STRATEGY_INSTANCE',
      [this.wasmModule.CMD_AT_EDIT_STRATEGY_INSTANCE]: 'CMD_AT_EDIT_STRATEGY_INSTANCE',
      [this.wasmModule.CMD_AT_QUERY_STRATEGY_INSTANCE]: 'CMD_AT_QUERY_STRATEGY_INSTANCE',
      [this.wasmModule.CMD_AT_QUERY_STRATEGY_INSTANCE_LOG]: 'CMD_AT_QUERY_STRATEGY_INSTANCE_LOG',
      [this.wasmModule.CMD_AT_SHARE_BACKTEST]: 'CMD_AT_SHARE_BACKTEST',
      [this.wasmModule.CMD_AT_QUERY_ORDERS]: 'CMD_AT_QUERY_ORDERS',
      [this.wasmModule.CMD_AT_DEBUG_LIVE]: 'CMD_AT_DEBUG_LIVE',
      [this.wasmModule.CMD_AT_DEBUG_COVERUP]: 'CMD_AT_DEBUG_COVERUP',
      [this.wasmModule.CMD_AT_DEBUG_ADD_ACCOUNT]: 'CMD_AT_DEBUG_ADD_ACCOUNT',
      [this.wasmModule.CMD_AT_HANDSHAKE]: 'CMD_AT_HANDSHAKE',
      [this.wasmModule.CMD_AT_ACCOUNT_CHANGE_CAPITAL]: 'CMD_AT_ACCOUNT_CHANGE_CAPITAL',
      [this.wasmModule.CMD_AT_QUERY_BACK_TEST_PROCS]: 'CMD_AT_QUERY_BACK_TEST_PROCS',
      [this.wasmModule.CMD_AT_QUERY_BACK_TEST_PROC_LOG]: 'CMD_AT_QUERY_BACK_TEST_PROC_LOG',
      [this.wasmModule.CMD_AT_QUERY_BACK_TEST_PROC_CONTROL]: 'CMD_AT_QUERY_BACK_TEST_PROC_CONTROL',
      [this.wasmModule.CMD_AT_ADD_LIMITS]: 'CMD_AT_ADD_LIMITS',
      [this.wasmModule.CMD_AT_DEL_LIMITS]: 'CMD_AT_DEL_LIMITS',
      [this.wasmModule.CMD_AT_SKIP_BREACH]: 'CMD_AT_SKIP_BREACH',
      
      // CMD_TA constants (server to client)
      [this.wasmModule.CMD_TA_MARKET_STATUS]: 'CMD_TA_MARKET_STATUS',
      [this.wasmModule.CMD_TA_PUSH_DATA]: 'CMD_TA_PUSH_DATA',
      [this.wasmModule.CMD_TA_SUBSCRIBE_HEADER]: 'CMD_TA_SUBSCRIBE_HEADER',
      [this.wasmModule.CMD_TA_PUSH_PROGRESS]: 'CMD_TA_PUSH_PROGRESS',
      [this.wasmModule.CMD_TA_PUSH_LOG]: 'CMD_TA_PUSH_LOG',
      [this.wasmModule.CMD_TA_MARKET_SINGULARITY]: 'CMD_TA_MARKET_SINGULARITY',
      [this.wasmModule.CMD_TA_PUSH_FORMULA]: 'CMD_TA_PUSH_FORMULA'
    };

    return commandNames[cmd] || `UNKNOWN_CMD_${cmd}`;
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
    
    // Shutdown subscription hub BEFORE closing WebSocket connection
    // This allows unsubscribe messages to be sent properly
    this.shutdownHub();
    
    // Now close the WebSocket connection
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
   * Subscribe to real-time data updates using ATSubscribeReq WASM command
   * @param {string|string[]} markets - Market code(s) (e.g., 'ICE' or ['ICE', 'DCE'])
   * @param {string|string[]} codes - Security code(s) (e.g., 'B<00>' or ['B<00>', 'i<00>'])
   * @param {string|string[]} qualifiedNames - Metadata type(s) (e.g., 'SampleQuote' or ['SampleQuote', 'Market'])
   * @param {string} namespace - Namespace ('global' or 'private')
   * @param {Function} callback - Function to call with real-time data updates
   * @param {Object} options - Additional subscription options
   * @returns {string} subscription key for unsubscribing
   */
  subscribe(markets, codes, qualifiedNames, namespace = 'global', callback, options = {}) {
    if (!this.isInitialized) {
      throw new Error('Connection must be initialized before subscribing');
    }
    
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    // Validate namespace parameter
    if (!['global', 'private'].includes(namespace)) {
      throw new Error(`Invalid namespace: ${namespace}. Must be 'global' or 'private'`);
    }
    
    // Normalize inputs to arrays
    const marketList = Array.isArray(markets) ? markets : [markets];
    const codeList = Array.isArray(codes) ? codes : [codes];
    const qualifiedNameList = Array.isArray(qualifiedNames) ? qualifiedNames : [qualifiedNames];
    
    // Validate inputs
    if (marketList.length === 0 || codeList.length === 0 || qualifiedNameList.length === 0) {
      throw new Error('Markets, codes, and qualifiedNames cannot be empty');
    }
    
    // Convert namespace formats once at the beginning for consistent usage
    const schemaKey = namespace === 'global' ? '0' : '1';
    
    // Generate unique subscription UUID
    const subscriptionUUID = this.generateSubscriptionUUID();
    const subscriptionKey = `${marketList.join(',')}/${codeList.join(',')}/${qualifiedNameList.join(',')}/${namespace}`;
    
    // Create ATSubscribeReq using WASM - no constructor parameters
    const currentSeq = this.getNextSeq();
    const subscribeReq = new this.wasmModule.ATSubscribeReq();
    
    // Set basic properties (refer to caitlyn_js.cpp for exact property names)
    subscribeReq.token = this.token;
    subscribeReq.seq = currentSeq;
    subscribeReq.UUID = subscriptionUUID;
    
    // Create vectors for markets
    const marketsVector = new this.wasmModule.StringVector();
    marketList.forEach(market => marketsVector.push_back(market));
    
    // Create vectors for symbols
    const symbolsVector = new this.wasmModule.StringVector();
    codeList.forEach(code => symbolsVector.push_back(code));
    
    // Create vectors for qualified names (with namespace prefix)
    const qualifiedNamesVector = new this.wasmModule.StringVector();
    qualifiedNameList.forEach(qualifiedName => {
      const fullQualifiedName = `${namespace}::${qualifiedName}`;
      qualifiedNamesVector.push_back(fullQualifiedName);
    });
    
    // Set arrays using proper WASM methods (refer to caitlyn_js.cpp for exact field names)
    subscribeReq.markets = marketsVector;
    subscribeReq.symbols = symbolsVector;
    subscribeReq.qualifiedNames = qualifiedNamesVector;  // JavaScript property name: "qualifiedNames"
    
    // Set granularities (required)
    const granularities = options.granularities;
    if (!granularities || !Array.isArray(granularities) || granularities.length === 0) {
      throw new Error('Granularities must be provided as a non-empty array');
    }
    const granularitiesVector = new this.wasmModule.Uint32Vector();
    granularities.forEach(g => granularitiesVector.push_back(g));
    subscribeReq.granularities = granularitiesVector;
    
    // Set fields using StringMatrix (vector<vector<string>>)
    const fieldsMatrix = new this.wasmModule.StringMatrix();
    
    // Each qualified name must have its corresponding field set
    // The server requires: qualified_names.size() == fields.size()
    for (let i = 0; i < qualifiedNameList.length; i++) {
      const qualifiedName = qualifiedNameList[i];
      const fieldsRow = new this.wasmModule.StringVector();
      
      if (options.fields && Array.isArray(options.fields)) {
        if (Array.isArray(options.fields[i])) {
          // Use specific fields for this qualified name index
          options.fields[i].forEach(field => fieldsRow.push_back(field));
        } else if (typeof options.fields[0] === 'string' && qualifiedNameList.length === 1) {
          // Single qualified name with flat array of fields
          options.fields.forEach(field => fieldsRow.push_back(field));
        } else {
          throw new Error(`Fields array must contain ${qualifiedNameList.length} field arrays, one for each qualified name`);
        }
      } else {
        // Look up fields from schema for this qualified name
        const schemaFields = this.getFieldsFromSchema(qualifiedName, schemaKey);
        
        if (!schemaFields || schemaFields.length === 0) {
          throw new Error(`No fields found in schema for ${qualifiedName} in namespace ${namespace}. Please provide fields explicitly.`);
        }
        
        schemaFields.forEach(field => fieldsRow.push_back(field));
      }
      
      fieldsMatrix.push_back(fieldsRow);
      fieldsRow.delete();
    }
    
    subscribeReq.fields = fieldsMatrix;
    
    // Debug: Check sizes match server requirement
    this.logger.debug(`🔍 Debug: qualified_names.size()=${qualifiedNamesVector.size()}, fields.size()=${fieldsMatrix.size()}`);
    
    // Set optional parameters
    if (options.start !== undefined) {
      subscribeReq.start = options.start;
    }
    if (options.end !== undefined) {
      subscribeReq.end = options.end;
    }
    if (options.sort && Array.isArray(options.sort)) {
      const sortVector = new this.wasmModule.StringVector();
      options.sort.forEach(s => sortVector.push_back(s));
      subscribeReq.sort = sortVector;
      sortVector.delete();
    }
    if (options.direction && Array.isArray(options.direction)) {
      const directionVector = new this.wasmModule.Uint8Vector();
      options.direction.forEach(d => directionVector.push_back(d));
      subscribeReq.direction = directionVector;
      directionVector.delete();
    }
    
    // Store subscription info
    const subscriptionInfo = {
      uuid: subscriptionUUID,
      markets: marketList,
      codes: codeList,
      qualifiedNames: qualifiedNameList.map(qn => `${namespace}::${qn}`),
      namespace,
      subscribedAt: new Date(),
      active: true,
      seq: currentSeq,
      granularities: granularities,
      options: { ...options }
    };
    
    this.subscriptions.set(subscriptionKey, subscriptionInfo);
    this.subscriptionCallbacks.set(subscriptionKey, callback);
    
    // Create NetPackage and send
    const pkg = new this.wasmModule.NetPackage();
    const msgBuffer = Buffer.from(pkg.encode(this.wasmModule.CMD_AT_SUBSCRIBE, subscribeReq.encode()));

    this.wsClient.sendBinary(msgBuffer);
    
    this.logger.info(`📡 Sent ${this.getCommandName(this.wasmModule.CMD_AT_SUBSCRIBE)} for: ${subscriptionKey}`);
    this.logger.info(`   🆔 UUID: ${subscriptionUUID}`);
    this.logger.info(`   📊 Markets: [${marketList.join(', ')}], Codes: [${codeList.join(', ')}]`);
    this.logger.info(`   🧬 Qualified Names (${qualifiedNameList.length}): [${qualifiedNameList.map(qn => `${namespace}::${qn}`).join(', ')}]`);
    this.logger.info(`   🏷️ Fields Matrix (${fieldsMatrix.size()} rows): One field set per qualified name`);
    this.logger.info(`   ⏱️ Granularities: [${granularities.join(', ')}] seconds`);
    
    // Cleanup WASM objects
    marketsVector.delete();
    symbolsVector.delete();
    qualifiedNamesVector.delete();
    granularitiesVector.delete();
    fieldsMatrix.delete();
    subscribeReq.delete();
    pkg.delete();
    
    return subscriptionKey;
  }
  
  /**
   * Unsubscribe from real-time data using ATUnsubscribeReq WASM command
   * @param {string} subscriptionKey - Key returned from subscribe()
   */
  unsubscribe(subscriptionKey) {
    if (!this.subscriptions.has(subscriptionKey)) {
      this.logger.warn(`⚠️ Subscription not found: ${subscriptionKey}`);
      return false;
    }
    
    const subscription = this.subscriptions.get(subscriptionKey);
    
    // Create ATUnsubscribeReq using WASM - no constructor parameters
    const currentSeq = this.getNextSeq();
    const unsubscribeReq = new this.wasmModule.ATUnsubscribeReq();
    
    // Set basic properties
    unsubscribeReq.token = this.token;
    unsubscribeReq.seq = currentSeq;
    unsubscribeReq.uuid = subscription.uuid;
    
    // Create NetPackage and send
    const pkg = new this.wasmModule.NetPackage();
    const msgBuffer = Buffer.from(pkg.encode(this.wasmModule.CMD_AT_UNSUBSCRIBE, unsubscribeReq.encode()));
    
    // Check if WebSocket is still available before sending
    if (this.wsClient && this.isConnected) {
      this.wsClient.sendBinary(msgBuffer);
      this.logger.info(`📡 Sending ${this.getCommandName(this.wasmModule.CMD_AT_UNSUBSCRIBE)} for: ${subscriptionKey}`);
      this.logger.info(`   🆔 UUID: ${subscription.uuid}`);
    } else {
      this.logger.warn(`⚠️ Cannot send unsubscribe - WebSocket is disconnected for: ${subscriptionKey}`);
    }
    
    // Mark as inactive and clean up
    subscription.active = false;
    this.subscriptions.delete(subscriptionKey);
    this.subscriptionCallbacks.delete(subscriptionKey);
    
    // Cleanup WASM objects
    unsubscribeReq.delete();
    pkg.delete();
    
    return true;
  }
  
  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions() {
    const activeSubscriptions = {};
    for (const [key, info] of this.subscriptions.entries()) {
      if (info.active) {
        activeSubscriptions[key] = info;
      }
    }
    return activeSubscriptions;
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
      schemaObjects: Object.keys(this.schema).reduce((sum, ns) => sum + Object.keys(this.schema[ns]).length, 0),
      activeSubscriptions: this.subscriptions.size
    };
  }

  /**
   * Generate unique subscription UUID
   */
  generateSubscriptionUUID() {
    return 'sub-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Get next sequence ID for requests
   */
  getNextSeq() {
    return ++this.sequenceId;
  }

  // ===== SUBSCRIPTION HUB METHODS =====
  
  /**
   * Subscribe using the hub (recommended for production)
   * Provides automatic deduplication and broadcast capabilities
   * @param {string|string[]} markets - Market codes
   * @param {string|string[]} codes - Security codes
   * @param {string|string[]} qualifiedNames - Metadata types
   * @param {string} namespace - 'global' or 'private'
   * @param {Function} callback - Data callback function
   * @param {Object} options - Subscription options
   * @returns {string} subscriber ID for unsubscribing
   */
  subscribeHub(markets, codes, qualifiedNames, namespace = 'global', callback, options = {}) {
    if (!this.subscriptionHub) {
      throw new Error('Subscription hub is not enabled. Set useSubscriptionHub: true in constructor options.');
    }
    
    return this.subscriptionHub.subscribe(markets, codes, qualifiedNames, namespace, callback, options);
  }

  /**
   * Unsubscribe using the hub
   * @param {string} subscriberId - ID returned from subscribeHub()
   * @returns {boolean} true if successfully unsubscribed
   */
  unsubscribeHub(subscriberId) {
    if (!this.subscriptionHub) {
      throw new Error('Subscription hub is not enabled.');
    }
    
    return this.subscriptionHub.unsubscribe(subscriberId);
  }

  /**
   * Get subscription hub statistics
   * @returns {Object} subscription statistics
   */
  getHubStats() {
    if (!this.subscriptionHub) {
      return { error: 'Subscription hub is not enabled' };
    }
    
    return this.subscriptionHub.getStats();
  }

  /**
   * Cleanup orphaned subscriptions in the hub
   * @returns {number} number of subscriptions cleaned up
   */
  cleanupHubSubscriptions() {
    if (!this.subscriptionHub) {
      return 0;
    }
    
    return this.subscriptionHub.cleanup();
  }

  /**
   * Shutdown the subscription hub
   */
  shutdownHub() {
    if (this.subscriptionHub) {
      this.subscriptionHub.shutdown();
    }
  }
}

export default CaitlynClientConnection;