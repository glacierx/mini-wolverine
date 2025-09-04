import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import { createSingularityObject } from '../utils/SingularityObjects.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WasmService {
  constructor() {
    this.module = null;
    this.schema = null; // Public schema for frontend
    this.schemaByNamespace = null; // Internal schema for processing
    this.compressor = null;
    this.markets = null;
    this.futuresIndex = null; // Index of futures contracts by market
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
        
        // Build public schema structure using numeric namespace keys (frontend expects this format)
        const namespaceKey = meta.namespace.toString();
        if (!schemaData[namespaceKey]) {
          schemaData[namespaceKey] = {};
        }
        
        // Extract field definitions from meta
        const fields = [];
        if (meta.fields) {
          const fieldVector = meta.fields;
          const fieldCount = fieldVector.size();
          
          for (let j = 0; j < fieldCount; j++) {
            const field = fieldVector.get(j);
            fields.push({
              name: field.name || `field_${j}`,
              type: field.type || 'unknown'
            });
          }
        }
        
        schemaData[namespaceKey][meta.ID] = {
          name: fullName,
          displayName: displayName,
          namespace: namespace,
          namespaceId: meta.namespace,
          fields: fields
        };
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

  // Process universe revision data using global::Market
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
    
    // Create reusable SVObject instances for each metadata type
    const svObjectCache = {};
    
    // Process each namespace
    for (let i = 0; i < keys.size(); i++) {
      const namespaceKey = keys.get(i);
      const structValues = revs.get(namespaceKey);
      const namespaceId = namespaceKey === 'private' ? 1 : 0;
      
      logger.debug(`Processing namespace: "${namespaceKey}" (${structValues.size()} entries)`);
      
      // Process each StructValue
      for (let j = 0; j < structValues.size(); j++) {
        const sv = structValues.get(j);
        const marketCode = sv.stockCode;
        
        // Check if this is Market metadata and has schema info
        if (this.schemaByNamespace[namespaceId] && this.schemaByNamespace[namespaceId][sv.metaID]) {
          const meta = this.schemaByNamespace[namespaceId][sv.metaID];
          const qualifiedName = meta.name;
          
          // Only process Market types
          if (qualifiedName.includes('::Market')) {
            logger.debug(`Market: ${marketCode} (${qualifiedName})`);
            
            // Use SVObject pattern to extract data properly (reuse instance)
            if (!svObjectCache[qualifiedName]) {
              svObjectCache[qualifiedName] = createSingularityObject(qualifiedName, this.module);
              svObjectCache[qualifiedName].loadDefFromDict(this.schemaByNamespace);  // Load schema definition once
            }
            const marketData = svObjectCache[qualifiedName];
            marketData.fromSv(sv);
            
            // Extract data using SVObject's structured approach
            const marketJson = marketData.toJSON();
            const fields = marketJson.fields;
            
            if (fields.revs) {
              const revsData = JSON.parse(fields.revs);
              const tradeDay = fields.trade_day || 0;
              const displayName = fields.name || marketCode;
              
              if (!marketsData[namespaceKey]) {
                marketsData[namespaceKey] = {};
              }
              
              marketsData[namespaceKey][marketCode] = {
                revisions: revsData,
                trade_day: tradeDay,
                name: displayName
              };
            }
            
            // Note: SVObject instance reused - cleanup at end of function
          }
        }
        
        sv.delete();
      }
    }
    
    universeRes.delete();
    
    const globalCount = Object.keys(marketsData.global || {}).length;
    const privateCount = Object.keys(marketsData.private || {}).length;
    logger.info(`Extracted market data for ${globalCount} global markets and ${privateCount} private markets`);
    
    // Cleanup reused SVObject instances
    for (const qualifiedName in svObjectCache) {
      svObjectCache[qualifiedName].cleanup();
    }
    
    this.markets = marketsData;
    return marketsData;
  }
  
  // Note: findMetaByQualifiedName removed - now using SVObject pattern with schema lookup

  // Process universe seeds data and index available contracts
  processUniverseSeeds(content) {
    if (!this.ready || !this.compressor) {
      throw new Error('WASM module or compressor not initialized');
    }
    
    if (!content || content.byteLength === 0) {
      logger.warn('Empty content received for universe seeds');
      return { count: 0, total: 0, futures: {} };
    }
    
    logger.debug(`Processing seeds content of size: ${content.byteLength} bytes`);
    
    const seedsRes = new this.module.ATUniverseSeedsRes();
    seedsRes.setCompressor(this.compressor);
    seedsRes.decode(content);
    
    const seedData = seedsRes.seedData();
    const seedCount = seedData.size();
    logger.debug(`Seeds response contains ${seedCount} entries`);
    
    let processedCount = 0;
    
    // Use persistent index that accumulates across all universe seeds responses
    if (!this.futuresIndex) {
      this.futuresIndex = {}; // Initialize once
    }
    const securityIndex = this.futuresIndex; // Reference to persistent index
    
    // Create reusable SVObject instances for each metadata type
    const svObjectCache = {};
    
    for (let i = 0; i < seedCount; i++) {
      const entry = seedData.get(i);
      
      const market = entry.stockCode;  // The stockCode contains the actual market code (DCE, CFFEX, etc.)
      const code = entry.stockCode;    // For now, use market code as the code - will be enriched by SVObject data
      const metaID = entry.metaID;
      const namespace = entry.namespace;
      
      if (market && code) {
        // Get metadata to determine contract type
        let contractType = 'Unknown';
        let qualifiedName = 'Unknown';
        
        if (this.schemaByNamespace[namespace] && this.schemaByNamespace[namespace][metaID]) {
          const meta = this.schemaByNamespace[namespace][metaID];
          qualifiedName = meta.name;
          
          const nameParts = qualifiedName.split('::');
          if (nameParts.length >= 2) {
            contractType = nameParts[1]; // e.g., "Futures", "Security", etc.
          }
        }
        
        if (!securityIndex[market]) {
          securityIndex[market] = [];
        }
        
        const contractData = {
          code: code,
          metaID: metaID,
          namespace: namespace,
          type: contractType,
          timeTag: entry.timeTag || 0,
          granularity: entry.granularity || 0
        };
        
        // Use SVObject pattern to extract data properly (reuse instance)
        if (!svObjectCache[qualifiedName]) {
          svObjectCache[qualifiedName] = createSingularityObject(qualifiedName, this.module);
          svObjectCache[qualifiedName].loadDefFromDict(this.schemaByNamespace);  // Load schema definition once
        }
        const svObject = svObjectCache[qualifiedName];
        svObject.fromSv(entry);
        
        // Convert SVObject to JSON for easy access
        const objectData = svObject.toJSON();
        
        // For Security data, create individual entries for each security code
        if (contractType === 'Security' && objectData.fields && objectData.fields.code && objectData.fields.code.length > 0) {
          // Extract individual securities from the Security vectors
          for (let j = 0; j < objectData.fields.code.length; j++) {
            const securityData = {
              code: objectData.fields.code[j],  // Individual security code
              name: objectData.fields.name && objectData.fields.name[j] ? objectData.fields.name[j] : objectData.fields.code[j],
              metaID: metaID,
              namespace: namespace,
              type: contractType,
              timeTag: entry.timeTag || 0,
              granularity: entry.granularity || 0,
              // Additional Security-specific fields
              abbreviation: objectData.fields.abbreviation && objectData.fields.abbreviation[j] ? objectData.fields.abbreviation[j] : null,
              category: objectData.fields.category && objectData.fields.category[j] ? objectData.fields.category[j] : null,
              state: objectData.fields.state && objectData.fields.state[j] ? objectData.fields.state[j] : null,
              lastClose: objectData.fields.last_close && objectData.fields.last_close[j] ? objectData.fields.last_close[j] : null,
              svData: {
                rev: objectData.fields.rev,
                trade_day: objectData.fields.trade_day,
                totalSecurities: objectData.fields.code.length
              }
            };
            securityIndex[market].push(securityData);
          }
        } else {
          // For non-Security data or empty Security data, use original logic
          // Extract commonly available fields from SVObject
          if (objectData.fields) {
            // For Market: name field is the display name
            if (contractType === 'Market' && objectData.fields.name) {
              contractData.name = objectData.fields.name;
            }
            
            // For Future: names field contains contract names
            if (contractType === 'Futures' && objectData.fields.names && objectData.fields.names.length > 0) {
              contractData.name = objectData.fields.names[0];
            }
            
            // For Stock: names field contains company names
            if (contractType === 'Stock' && objectData.fields.names && objectData.fields.names.length > 0) {
              contractData.name = objectData.fields.names[0];
            }
            
            // For Commodity: codes field contains the identifiers
            if (contractType === 'Commodity' && objectData.fields.codes && objectData.fields.codes.length > 0) {
              contractData.name = objectData.fields.codes[0];
            }
            
            // Store complete SVObject data for advanced usage
            contractData.svData = objectData.fields;
          }
          
          securityIndex[market].push(contractData);
        }
        logger.debug(`Indexed contract: ${market}/${code} (${contractType}) - ${contractData.name || 'no name'}`);
      }
      
      entry.delete();
      processedCount++;
    }
    
    seedsRes.delete();
    
    // Note: this.futuresIndex is already updated by reference through securityIndex
    // No need to reassign as it would overwrite accumulated data
    
    const totalContracts = Object.values(this.futuresIndex).reduce((sum, contracts) => sum + contracts.length, 0);
    logger.info(`Successfully processed ${processedCount} seed entries, total indexed: ${totalContracts} securities across ${Object.keys(this.futuresIndex).length} markets`);
    
    // Cleanup reused SVObject instances
    for (const qualifiedName in svObjectCache) {
      svObjectCache[qualifiedName].cleanup();
    }
    
    return { count: processedCount, total: seedCount, securities: this.futuresIndex };
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

  // Create historical data request by code (following test.js pattern)
  createHistoricalDataByCodeRequest(token, sequenceId, market, code, qualifiedName, namespace, granularity, startTime, endTime, fields) {
    if (!this.ready) {
      throw new Error('WASM module not initialized');
    }
    
    // Create ATFetchByCode request following test.js pattern
    const fetchByCodeReq = new this.module.ATFetchByCodeReq();
    
    // Set request parameters based on test.js
    fetchByCodeReq.token = token;
    fetchByCodeReq.seq = sequenceId;
    fetchByCodeReq.namespace = namespace === 0 ? 'global' : 'private';
    fetchByCodeReq.qualifiedName = qualifiedName || 'SampleQuote'; // Default to SampleQuote
    fetchByCodeReq.revision = -1; // Default revision
    fetchByCodeReq.market = market;
    fetchByCodeReq.code = code;
    fetchByCodeReq.granularity = granularity;
    
    // Set fields using StringVector
    const fieldsVector = new this.module.StringVector();
    if (fields && Array.isArray(fields)) {
      fields.forEach(field => fieldsVector.push_back(field));
    } else {
      // Default fields for SampleQuote
      ['open', 'close', 'high', 'low', 'volume', 'turnover'].forEach(field => fieldsVector.push_back(field));
    }
    fetchByCodeReq.fields = fieldsVector;
    
    // Set time range (convert to milliseconds if needed)
    fetchByCodeReq.fromTimeTag = startTime.toString();
    fetchByCodeReq.toTimeTag = endTime.toString();
    
    // Encode and create message
    const pkg = new this.module.NetPackage();
    const encodedReq = fetchByCodeReq.encode();
    const encodedPkg = pkg.encode(this.module.CMD_AT_FETCH_BY_CODE, encodedReq);
    
    // Copy to regular ArrayBuffer
    const regularBuffer = new ArrayBuffer(encodedPkg.byteLength);
    const regularView = new Uint8Array(regularBuffer);
    const encodedView = new Uint8Array(encodedPkg);
    regularView.set(encodedView);
    
    // Cleanup WASM objects
    fetchByCodeReq.delete();
    pkg.delete();
    fieldsVector.delete();
    
    return regularBuffer;
  }

  // Create historical data request by time range
  createHistoricalDataByTimeRangeRequest(token, sequenceId, market, code, metaID, granularity, startTime, endTime, limit) {
    if (!this.ready) {
      throw new Error('WASM module not initialized');
    }
    
    const pkg = new this.module.NetPackage();
    
    const requestData = {
      token: token,
      sequence: sequenceId,
      market: market,
      code: code,
      metaID: metaID,
      granularity: granularity,
      startTime: startTime,
      endTime: endTime,
      limit: limit || 1000
    };
    
    const requestJson = JSON.stringify(requestData);
    const requestBuffer = new TextEncoder().encode(requestJson);
    
    const encodedPkg = pkg.encode(this.module.CMD_AT_FETCH_BY_TIME_RANGE, requestBuffer);
    
    // Copy to regular ArrayBuffer
    const regularBuffer = new ArrayBuffer(encodedPkg.byteLength);
    const regularView = new Uint8Array(regularBuffer);
    const encodedView = new Uint8Array(encodedPkg);
    regularView.set(encodedView);
    
    pkg.delete();
    
    return regularBuffer;
  }

  // Process CMD_AT_FETCH_BY_CODE response (following test.js pattern)
  processHistoricalDataResponse(content) {
    if (!this.ready || !this.compressor) {
      throw new Error('WASM module or compressor not initialized');
    }
    
    // Create and decode ATFetchSVRes response
    const res = new this.module.ATFetchSVRes();
    res.setCompressor(this.compressor);
    res.decode(content);
    
    // Extract StructValue results
    const results = res.results();
    const resultCount = results.size();
    
    logger.info(`Received ${resultCount} StructValues from server`);
    
    const records = [];
    
    // Process each StructValue using SVObject pattern
    for (let i = 0; i < resultCount; i++) {
      const sv = results.get(i);
      
      // Create record with basic info
      const record = {
        timestamp: sv.timeTag,
        market: sv.market,
        code: sv.stockCode,
        metaID: sv.metaID,
        namespace: sv.namespace
      };
      
      // Use SVObject to extract data if we have schema info
      if (this.schemaByNamespace[sv.namespace] && this.schemaByNamespace[sv.namespace][sv.metaID]) {
        const meta = this.schemaByNamespace[sv.namespace][sv.metaID];
        const qualifiedName = meta.name;
        
        // For SampleQuote or similar structures, use SVObject
        if (qualifiedName.includes('SampleQuote') || qualifiedName.includes('Quote')) {
          const svObject = createSingularityObject(qualifiedName, this.module);
          svObject.loadDefFromDict(this.schemaByNamespace);
          svObject.fromSv(sv);
          
          // Extract data using SVObject
          const objectData = svObject.toJSON();
          if (objectData.fields) {
            record.open = objectData.fields.open;
            record.close = objectData.fields.close;
            record.high = objectData.fields.high;
            record.low = objectData.fields.low;
            record.volume = objectData.fields.volume;
            record.turnover = objectData.fields.turnover;
          }
          
          svObject.cleanup();
        } else {
          // For other types, extract available fields generically
          const svObject = createSingularityObject(qualifiedName, this.module);
          svObject.loadDefFromDict(this.schemaByNamespace);
          svObject.fromSv(sv);
          
          const objectData = svObject.toJSON();
          record.svData = objectData.fields; // Store all extracted fields
          
          svObject.cleanup();
        }
      }
      
      // Calculate derived values for OHLCV data
      if (record.open && record.close) {
        record.change = record.close - record.open;
        record.changePercent = (record.change / record.open) * 100;
      }
      
      if (record.high && record.low && record.close) {
        record.typicalPrice = (record.high + record.low + record.close) / 3;
      }
      
      records.push(record);
      sv.delete();
    }
    
    res.delete();
    
    return {
      success: true,
      data: {
        records: records,
        totalCount: resultCount,
        requestTime: new Date().toISOString()
      },
      count: records.length
    };
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
    if (pkg.header.cmd !== this.module.NET_CMD_GOLD_ROUTE_KEEPALIVE && 
        pkg.header.cmd !== this.module.CMD_TA_MARKET_STATUS) {
      logger.debug(`Decoded message: cmd=${cmd}, raw_len=${arrayBuffer.byteLength}, content_len=${contentLength}`);
    }
    // NOW we can safely delete the pkg
    pkg.delete();
    

    // Log the sizes for debugging
    // logger.debug(`Decoded message: cmd=${cmd}, raw_len=${arrayBuffer.byteLength}, content_len=${contentLength}`);
    
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

  getFutures() {
    return this.futuresIndex;
  }

  // Get futures codes for a specific market
  getFuturesForMarket(market) {
    return this.futuresIndex ? (this.futuresIndex[market] || []) : [];
  }

  // Get all available markets with futures
  getMarketsWithFutures() {
    return this.futuresIndex ? Object.keys(this.futuresIndex) : [];
  }

  // Search securities by code pattern
  searchSecurities(codePattern, market = null) {
    if (!this.securityIndex) return [];
    
    const pattern = new RegExp(codePattern, 'i'); // case-insensitive
    const results = [];
    
    const marketsToSearch = market ? [market] : Object.keys(this.securityIndex);
    
    for (const mkt of marketsToSearch) {
      const securities = this.securityIndex[mkt] || [];
      const matches = securities.filter(security => pattern.test(security.code) || (security.name && pattern.test(security.name)));
      results.push(...matches.map(s => ({ ...s, market: mkt })));
    }
    
    return results;
  }
  
  // Backward compatibility alias
  searchFutures(codePattern, market = null) {
    return this.searchSecurities(codePattern, market);
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
    this.futuresIndex = null;
  }
}

export default WasmService;