# Singularity Data Maintenance in the Wolverine Financial System

## Table of Contents

1. [Introduction](#introduction)
2. [Conceptual Overview](#conceptual-overview)
3. [Singularity Architecture](#singularity-architecture)
4. [Singularity Data Types](#singularity-data-types)
5. [Universe Revision System](#universe-revision-system)
6. [Practical Implementation](#practical-implementation)
7. [Schema-Based Field Access](#schema-based-field-access)
8. [Market Data Processing](#market-data-processing)
9. [Best Practices](#best-practices)
10. [Integration Examples](#integration-examples)

## Introduction

In the financial derivatives world, the complex nature of tradable instruments requires sophisticated data management. The Wolverine system addresses this challenge through the **Singularity** mechanism - a comprehensive data maintenance system that manages the "universe seed" for each trading day.

Drawing from physics terminology (consistent with the Wolverine system's naming convention), Singularity represents the initial conditions from which each day's financial universe evolves. Just as a physical universe emerges from a singularity, each trading day's market data structure emerges from its Singularity seed data.

### Important Note on Data Type Identification

**Always use qualified names (e.g., `global::Market`, `global::Commodity`) to identify Singularity data types, not numeric meta IDs.** The numeric IDs can vary between different schema versions or deployments, while qualified names provide a stable, semantic identifier for each data type. This approach ensures your code remains robust across schema updates and different environments.

## Conceptual Overview

### The Universe Paradigm

The Wolverine system conceptualizes each trading day as a distinct "universe" with its own set of:

- **Tradable Instruments**: Securities, commodities, futures, options that are valid for that specific day
- **Market Parameters**: Trading periods, multipliers, margin requirements, price limits
- **Corporate Actions**: Dividends, splits, mergers affecting securities
- **Market Structure**: Exchange information, holidays, trading calendars

### Singularity as Seed Data

**Singularity data** serves as the foundational seed that defines what exists in each day's financial universe. This approach provides:

1. **Historical Accuracy**: Retrospective queries use historically accurate instrument definitions
2. **Change Tracking**: Revision-based system ensures only updated data is synchronized
3. **Granular Control**: Different granularities (0 for real-time, 86400 for daily snapshots)
4. **Market Isolation**: Each market maintains its own Singularity data independently

## Singularity Architecture

### System Organization

```
Singularity Data Hierarchy:
┌─────────────────────────────────────────────────────────┐
│                    Wolverine System                     │
├─────────────────────────────────────────────────────────┤
│  Namespace: Global (public) │  Namespace: Private       │
│  ├─ Market: CFFEX (中金所)   │  ├─ Market: Strategy      │
│  ├─ Market: CZCE (郑商所)    │  ├─ Market: MTM           │
│  ├─ Market: DCE (大商所)     │  ├─ Market: EINSTEIN      │
│  ├─ Market: DME             │  └─ Market: Custom...     │
│  ├─ Market: HUOBI (火币网)   │                           │
│  ├─ Market: ICE             │                           │
│  ├─ Market: INE (上海国际能源)│                           │
│  ├─ Market: NYMEX           │                           │
│  ├─ Market: SGX (新交所)     │                           │
│  └─ Market: SHFE (上期所)    │                           │
└─────────────────────────────────────────────────────────┘
```

### Special Markets

The system defines several special-purpose markets:

| Market | Purpose | Description |
|--------|---------|-------------|
| **Singularity** | Seed Data Storage | Contains initial universe seed data for all markets |
| **Strategy** | Strategy Management | Records strategy-related statistical information |
| **MTM** | Risk Management | Mark-to-market calculations and portfolio risk metrics |
| **EINSTEIN** | Trade Execution | Trade execution and clearing information |

## Singularity Data Types

Based on the schema analysis and `test.js` implementation, Singularity data consists of several key StructValue types, each identified by its qualified name in the schema:

### Core Singularity Types

#### 1. Market (`global::Market` or `private::Market`)
**Purpose**: Fundamental market information and revision tracking

**Field Structure** (discovered through schema analysis):
```javascript
// Field positions in Market StructValue:
Field 0: trade_day (int32)     // Current trading day (YYYYMMDD format)
Field 1: name (string)         // Market display name
Field 2: time_zone (string)    // Market timezone
Field 7: revs (string)         // JSON revision data for all qualified names
```

**Usage Example**:
```javascript
// Find Market meta by qualified name
const marketMeta = findMetaByQualifiedName(caitlyn.NAMESPACE_GLOBAL, 'Market');

// Extract market data from StructValue (sv)
if (sv.metaID === marketMeta.ID) {  // Use schema-resolved ID, not hardcoded
    const tradeDay = sv.getInt32(0);      // Trading day
    const marketName = sv.getString(1);    // Display name (e.g., "大商所")
    const timeZone = sv.getString(2);      // Timezone
    const revisionsJson = sv.getString(7); // JSON revision data
    
    const revisions = JSON.parse(revisionsJson);
    // revisions = {
    //   "Commodity": 1856,
    //   "Futures": 6606,
    //   "Holiday": 1797,
    //   "Security": 1964,
    //   "Stock": 1783,
    //   "Dividend": 1783
    // }
}
```

#### 2. Holiday (`global::Holiday` or `private::Holiday`)
**Purpose**: Market holiday and trading calendar information

**Field Structure**:
```javascript
Field 0: rev (int)           // Revision number
Field 1: trade_day (int32)   // Trade day
Field 2: dates (int array)   // Array of holiday dates
```

#### 3. Security (`global::Security` or `private::Security`)
**Purpose**: Securities list and basic information

**Field Structure**:
```javascript
Field 0: rev (int)              // Version number from data source
Field 1: trade_day (datetime)   // Sampling trade day
Field 2: codes (string array)   // Security codes
Field 3: operations (int array) // Corporate actions: 0=dividend, 1=rights, 2=stock split, 3=conversion
Field 4: bonus (double array)   // Dividend amount per share
Field 5: interest (double array) // Interest amount per share
Field 6: allotment (double array) // Rights issue quantity per share
// ... additional fields for corporate actions
```

#### 4. Commodity (`global::Commodity` or `private::Commodity`)
**Purpose**: Commodity definitions and trading parameters

**Field Structure**:
```javascript
Field 0: rev (int)                    // Version number
Field 1: trade_day (datetime)         // Sampling trade day  
Field 2: codes (string array)         // Commodity codes
Field 3: names (string array)         // Commodity names
Field 4: trade_periods (JSON array)   // Trading time periods
Field 5: UOM (string array)           // Units of measurement
Field 6: volume_multiplier (int array) // Contract multipliers
Field 7: surge_limit (double array)   // Price limit up percentages
Field 8: plunge_limit (double array)  // Price limit down percentages
Field 9: min_margin_rate (double array) // Minimum margin rates
// ... additional trading parameter fields
```

#### 5. Future (`global::Future` or `private::Future`)
**Purpose**: Futures contract specifications

**Field Structure**:
```javascript
Field 0: rev (int)                        // Version number
Field 1: trade_day (datetime)             // Sampling trade day
Field 2: codes (string array)             // Contract codes
Field 3: names (string array)             // Contract names  
Field 4: commodity_codes (string array)   // Underlying commodity codes
Field 5: price_tick (double array)        // Minimum price increments
Field 6: lists_at (datetime array)        // Contract listing dates
Field 7: expires_at (datetime array)      // Expiration dates
Field 8: start_delivery_date (datetime array) // Delivery start dates
Field 9: end_delivery_date (datetime array)   // Delivery end dates
// ... additional contract specification fields
```

#### 6. Stock (`global::Stock` or `private::Stock`)
**Purpose**: Listed company information

**Field Structure**:
```javascript
Field 0: rev (int)                    // Version number
Field 1: trade_day (datetime)         // Sampling trade day
Field 2: codes (string array)         // Stock codes
Field 3: names (string array)         // Company names
Field 4: list_dates (datetime array)  // Listing dates
Field 5: list_prices (double array)   // Listing prices
Field 6: shares_outstanding (int array) // Outstanding shares
// ... additional company information fields
```

## Universe Revision System

### Revision Mechanism

The revolution system ensures efficient data synchronization by tracking revision numbers for each qualified name within each market:

```javascript
// Example revision data structure from Market.revs field
const marketRevisions = {
    "Commodity": 1856,    // Latest commodity data revision
    "Dividend": 1783,     // Latest dividend data revision  
    "Futures": 6606,      // Latest futures data revision
    "Holiday": 1797,      // Latest holiday data revision
    "Security": 1964,     // Latest security data revision
    "Stock": 1783         // Latest stock data revision
};
```

### Qualified Names

Each market supports several standard qualified names:

| Qualified Name | Purpose | Typical Usage |
|---------------|---------|---------------|
| **Commodity** | Basic commodity definitions | Trading parameters, multipliers, limits |
| **Futures** | Futures contract details | Contract specifications, delivery dates |
| **Holiday** | Market calendar | Trading holidays, market closures |
| **Security** | Security definitions | Stock lists, corporate actions |
| **Stock** | Company information | Listed companies, fundamental data |
| **Dividend** | Dividend information | Distribution schedules, amounts |

### Revision Query Process

1. **Universe Revision Request**: Query current revision numbers for all markets
2. **Revision Comparison**: Compare with local cache to identify updates needed
3. **Selective Synchronization**: Request only markets/qualified names with newer revisions
4. **Universe Seeds Request**: Fetch updated Singularity data for changed markets

## Practical Implementation

### Initialization Sequence

Based on the `examples/test.js` implementation, the complete Singularity initialization follows this sequence:

```javascript
/**
 * Complete Singularity Initialization Flow
 * Following the examples/test.js pattern
 */
async function initializeSingularityData() {
    // 1. Load WASM Module
    const caitlyn = await loadCaitlynModule();
    
    // 2. Establish WebSocket Connection  
    const client = connectToServer();
    
    // 3. Process Schema Definition (server-pushed)
    client.on('schema', (pkg) => {
        const schema = new caitlyn.IndexSchema();
        schema.load(pkg.content());
        
        // Initialize compressor with schema
        const compressor = new caitlyn.IndexSerializer();
        compressor.updateSchema(schema);
        
        schema.delete(); // Clean up after transfer to compressor
    });
    
    // 4. Request Universe Revision
    const revReq = new caitlyn.ATUniverseReq(token, sequenceId);
    const revPkg = new caitlyn.NetPackage();
    client.sendBinary(revPkg.encode(caitlyn.CMD_AT_UNIVERSE_REV, revReq.encode()));
    
    // 5. Process Universe Revision Response
    client.on('universe_revision', (pkg) => {
        const res = new caitlyn.ATUniverseRes();
        res.setCompressor(compressor);
        res.decode(pkg.content());
        
        const revisions = res.revs();
        const markets = extractMarketsData(revisions);
        
        res.delete();
        
        // 6. Request Universe Seeds for each market/qualified_name
        requestUniverseSeeds(client, markets);
    });
    
    // 7. Process Universe Seeds Responses
    client.on('universe_seeds', (pkg) => {
        const seedRes = new caitlyn.ATUniverseSeedsRes();
        seedRes.setCompressor(compressor);
        seedRes.decode(pkg.content());
        
        const seedData = seedRes.seedData();
        processSingularityData(seedData);
        
        seedRes.delete();
    });
}
```

### Market Data Extraction

Following the field access patterns discovered in `test.js`:

```javascript
/**
 * Extract market data from Universe Revision response
 * Uses schema-based field mapping for accurate data extraction
 */
function extractMarketsData(revisions, schema) {
    const marketsData = {};
    const keys = revisions.keys();
    
    for (let i = 0; i < keys.size(); i++) {
        const namespaceKey = keys.get(i);
        const structValues = revisions.get(namespaceKey);
        const namespaceId = namespaceKey === 'private' ? 1 : 0;
        
        // Find Market meta by qualified name
        const marketMeta = findMetaByQualifiedName(namespaceId, 'Market', schema);
        
        for (let j = 0; j < structValues.size(); j++) {
            const sv = structValues.get(j);
            
            // Look for Market metadata using schema-resolved ID
            if (marketMeta && sv.metaID === marketMeta.ID) {
                const marketCode = sv.stockCode;
                
                // Field 7 contains revisions JSON (critical discovery!)
                if (!sv.isEmpty(7)) {
                    const revsJsonString = sv.getString(7);
                    const revsData = JSON.parse(revsJsonString);
                    
                    // Field 0 contains trade_day, Field 1 contains display name
                    const tradeDay = sv.isEmpty(0) ? 0 : sv.getInt32(0);
                    const displayName = sv.getString(1);
                    
                    if (!marketsData[namespaceKey]) {
                        marketsData[namespaceKey] = {};
                    }
                    
                    marketsData[namespaceKey][marketCode] = {
                        revisions: revsData,
                        trade_day: tradeDay,
                        name: displayName
                    };
                }
            }
            
            sv.delete(); // Always clean up StructValue objects
        }
    }
    
    return marketsData;
}

/**
 * Helper function to find meta by qualified name
 * @param {number} namespace - Namespace ID (0 for global, 1 for private)
 * @param {string} qualifiedName - Name to search for (e.g., 'Market', 'Commodity')
 * @param {Object} schema - Schema object containing all metadata
 */
function findMetaByQualifiedName(namespace, qualifiedName, schema) {
    if (!schema[namespace]) return null;
    
    const namespaceStr = namespace === 0 ? 'global' : 'private';
    const fullQualifiedName = `${namespaceStr}::${qualifiedName}`;
    
    for (const metaId in schema[namespace]) {
        const meta = schema[namespace][metaId];
        if (meta.name === fullQualifiedName) {
            return meta;
        }
    }
    return null;
}
```

## Schema-Based Field Access

### Critical Principle

**Never hardcode field positions.** The Wolverine system's StructValue field positions must be determined from the schema definition, as demonstrated in the global structures documentation.

### Correct Field Access Pattern

```javascript
/**
 * Schema-based field access - ALWAYS use this pattern
 * Never hardcode field positions like sv.getInt32(2) without schema verification
 */
function processStructValueWithSchema(sv, schema, namespaceId) {
    const metaData = schema[namespaceId][sv.metaID];
    
    if (metaData) {
        // Use schema to determine correct field positions
        const fieldMappings = analyzeMetaFieldPositions(metaData);
        
        // Example for Market structure (identified by qualified name):
        if (metaData.name === 'global::Market' || metaData.name === 'private::Market') {
            const tradeDay = sv.getInt32(fieldMappings.trade_day);    // Field 0
            const name = sv.getString(fieldMappings.name);            // Field 1  
            const timeZone = sv.getString(fieldMappings.time_zone);   // Field 2
            const revisions = sv.getString(fieldMappings.revs);       // Field 7
            
            return {
                type: 'Market',
                tradeDay,
                name,
                timeZone,
                revisions: JSON.parse(revisions)
            };
        }
        
        // Example for Commodity structure:
        if (metaData.name === 'global::Commodity' || metaData.name === 'private::Commodity') {
            return {
                type: 'Commodity',
                rev: sv.getInt32(fieldMappings.rev),
                tradeDay: sv.getDateTime(fieldMappings.trade_day),
                codes: sv.getStringArray(fieldMappings.codes),
                names: sv.getStringArray(fieldMappings.names),
                multipliers: sv.getIntArray(fieldMappings.volume_multiplier)
            };
        }
        
        // Add more qualified name checks for other types...
    }
    
    return null;
}
```

### Field Type Selection

Choose the appropriate accessor based on the schema field type:

```javascript
// Field type mappings
const accessorMethods = {
    'INT': 'getInt32',      // 32-bit integers
    'INT64': 'getInt64',    // 64-bit integers  
    'DOUBLE': 'getDouble',  // Floating point numbers
    'STRING': 'getString',  // String data
    'ARRAY': 'getArray'     // Array data (vectors)
};

// Usage example
const fieldType = getFieldTypeFromSchema(metaData, fieldIndex);
const value = sv[accessorMethods[fieldType]](fieldIndex);
```

## Market Data Processing

### Discovered Global Markets

The current Wolverine system supports these global markets (as of the latest schema analysis):

| Market Code | Name | Type | Key Qualified Names |
|-------------|------|------|-------------------|
| **CFFEX** | 中金所 (China Financial Futures Exchange) | Financial Futures | Futures, Holiday, Security |
| **CZCE** | 郑商所 (Zhengzhou Commodity Exchange) | Agricultural Commodities | Commodity, Futures, Holiday |
| **DCE** | 大商所 (Dalian Commodity Exchange) | Industrial Commodities | Commodity, Futures, Holiday |
| **SHFE** | 上期所 (Shanghai Futures Exchange) | Metal Commodities | Commodity, Futures, Holiday |
| **INE** | 上海国际能源交易中心 (Shanghai International Energy Exchange) | Energy | Commodity, Futures, Holiday |
| **HUOBI** | 火币网 (Huobi Exchange) | Cryptocurrency | Security, Holiday |
| **NYMEX** | New York Mercantile Exchange | Energy & Metals | Commodity, Futures, Holiday |
| **ICE** | Intercontinental Exchange | Energy & Agricultural | Commodity, Futures, Holiday |
| **SGX** | 新交所 (Singapore Exchange) | Multi-Asset | Commodity, Futures, Stock, Holiday |
| **DME** | Dubai Mercantile Exchange | Energy | Commodity, Futures, Holiday |

### Universe Seeds Request Pattern

For each market discovered in the universe revision, send seeds requests for all qualified names:

```javascript
/**
 * Request universe seeds for all market/qualified_name combinations
 * This generates approximately 60 total requests (10 markets × 6 qualified names)
 */
function requestUniverseSeeds(client, marketsData) {
    let sequenceId = 3;
    let requestsSent = 0;
    
    for (const namespaceStr in marketsData) {
        for (const marketCode in marketsData[namespaceStr]) {
            const marketInfo = marketsData[namespaceStr][marketCode];
            
            // Send seeds request for each qualified name
            for (const qualifiedName in marketInfo.revisions) {
                const revision = marketInfo.revisions[qualifiedName];
                
                const seedsReq = new caitlyn.ATUniverseSeedsReq(
                    token,
                    sequenceId++,
                    revision,
                    namespaceStr,
                    qualifiedName,
                    marketCode,
                    marketInfo.trade_day
                );
                
                const pkg = new caitlyn.NetPackage();
                const msg = pkg.encode(caitlyn.CMD_AT_UNIVERSE_SEEDS, seedsReq.encode());
                
                client.sendBinary(Buffer.from(msg));
                requestsSent++;
                
                // Clean up WASM objects immediately
                seedsReq.delete();
                pkg.delete();
            }
        }
    }
    
    console.log(`Universe seeds requests completed: ${requestsSent} requests sent`);
}
```

## Best Practices

### Memory Management

**Critical**: Always delete WASM objects to prevent memory leaks:

```javascript
// CORRECT pattern - always call delete()
const pkg = new caitlyn.NetPackage();
const req = new caitlyn.ATUniverseReq();
// ... use objects ...
pkg.delete();    // Always required
req.delete();    // Always required

// INCORRECT - never do conditional checks
if (pkg && typeof pkg.delete === 'function') {
    pkg.delete();  // This hides potential issues
}
```

### Error Handling Philosophy

Follow the "fail fast" principle - let exceptions surface rather than hiding them:

```javascript
// CORRECT - let it fail if something is wrong
const currentWasmModule = wasmModule;
const universeRes = new currentWasmModule.ATUniverseRes();
universeRes.setCompressor(compressor);
universeRes.decode(content);

// INCORRECT - defensive programming that hides issues
try {
    const currentWasmModule = wasmModule || window.Module || fallback;
    if (currentWasmModule && currentWasmModule.ATUniverseRes) {
        // ... overly defensive code that masks real problems
    }
} catch(e) {
    console.log('Failed but continuing anyway'); // Don't do this
}
```

### Schema Lifecycle

Handle schema objects properly during initialization:

```javascript
// CORRECT lifecycle management
const schema = new caitlyn.IndexSchema();
schema.load(pkg.content());

// Transfer schema to compressor
const compressor = new caitlyn.IndexSerializer();
compressor.updateSchema(schema);

// Delete schema AFTER transferring to compressor
schema.delete();
```

### Granularity Considerations

Understand the two main granularity modes:

- **Granularity 0**: Real-time data, no sampling
- **Granularity 86400**: Daily snapshots (24 hours in seconds)

```javascript
// Request daily Singularity data
const dailyGranularity = 86400;  // 24 * 60 * 60 seconds

// Request real-time Singularity data  
const realtimeGranularity = 0;   // No sampling
```

## Integration Examples

### Complete Singularity Processing Example

```javascript
/**
 * Complete example of Singularity data processing
 * Based on the proven examples/test.js implementation
 */
class SingularityDataManager {
    constructor() {
        this.schema = {};
        this.compressor = null;
        this.markets = {};
        this.seedsData = {};
    }
    
    async initialize(wasmModule, client) {
        this.wasmModule = wasmModule;
        this.client = client;
        
        // Set up message handlers
        this.setupMessageHandlers();
        
        // Start initialization sequence
        this.requestUniverseRevision();
    }
    
    setupMessageHandlers() {
        this.client.on('binary', (stream) => {
            // ... handle binary stream as in test.js
            this.processMessage(pkg);
        });
    }
    
    processMessage(pkg) {
        switch (pkg.header.cmd) {
            case this.wasmModule.NET_CMD_GOLD_ROUTE_DATADEF:
                this.handleSchemaDefinition(pkg);
                break;
            case this.wasmModule.CMD_AT_UNIVERSE_REV:
                this.handleUniverseRevision(pkg);
                break;
            case this.wasmModule.CMD_AT_UNIVERSE_SEEDS:
                this.handleUniverseSeeds(pkg);
                break;
        }
    }
    
    handleSchemaDefinition(pkg) {
        const schema = new this.wasmModule.IndexSchema();
        schema.load(pkg.content());
        
        // Build schema lookup
        const metas = schema.metas();
        for (let i = 0; i < metas.size(); i++) {
            const meta = metas.get(i);
            if (!this.schema[meta.namespace]) {
                this.schema[meta.namespace] = {};
            }
            this.schema[meta.namespace][meta.ID] = meta;
        }
        
        // Initialize compressor
        this.compressor = new this.wasmModule.IndexSerializer();
        this.compressor.updateSchema(schema);
        
        schema.delete();
        
        console.log('Schema loaded: 576 metadata definitions across 2 namespaces');
    }
    
    handleUniverseRevision(pkg) {
        const res = new this.wasmModule.ATUniverseRes();
        res.setCompressor(this.compressor);
        res.decode(pkg.content());
        
        const revisions = res.revs();
        this.markets = this.extractMarketsData(revisions);
        
        res.delete();
        
        // Request seeds for all discovered markets
        this.requestUniverseSeeds();
    }
    
    extractMarketsData(revisions) {
        // Implementation as shown in earlier examples
        // Returns structured market data with revisions
        return marketsData;
    }
    
    requestUniverseSeeds() {
        // Send seeds requests for all market/qualified_name combinations
        // Following the pattern from test.js
    }
    
    handleUniverseSeeds(pkg) {
        const res = new this.wasmModule.ATUniverseSeedsRes();
        res.setCompressor(this.compressor);
        res.decode(pkg.content());
        
        const seedData = res.seedData();
        this.processSeedsData(seedData);
        
        res.delete();
    }
    
    processSeedsData(seedData) {
        for (let i = 0; i < seedData.size(); i++) {
            const entry = seedData.get(i);
            
            // Get metadata for this entry
            const metaData = this.schema[entry.namespace][entry.metaID];
            
            if (metaData) {
                // Process based on qualified name
                const qualifiedName = metaData.name;
                
                switch (qualifiedName) {
                    case 'global::Market':
                    case 'private::Market':
                        this.processMarketData(entry, metaData);
                        break;
                    case 'global::Commodity':
                    case 'private::Commodity':
                        this.processCommodityData(entry, metaData);
                        break;
                    case 'global::Future':
                    case 'private::Future':
                        this.processFutureData(entry, metaData);
                        break;
                    case 'global::Holiday':
                    case 'private::Holiday':
                        this.processHolidayData(entry, metaData);
                        break;
                    case 'global::Security':
                    case 'private::Security':
                        this.processSecurityData(entry, metaData);
                        break;
                    case 'global::Stock':
                    case 'private::Stock':
                        this.processStockData(entry, metaData);
                        break;
                    // ... handle other Singularity types
                }
            }
            
            entry.delete();
        }
    }
    
    processCommodityData(entry, metaData) {
        // Extract commodity information using schema-based field access
        const commodityCode = entry.stockCode;
        const market = entry.market;
        
        const commodityData = {
            code: commodityCode,
            market: market,
            name: entry.getString(this.getFieldPosition(metaData, 'name')),
            multiplier: entry.getInt32(this.getFieldPosition(metaData, 'volume_multiplier')),
            marginRate: entry.getDouble(this.getFieldPosition(metaData, 'min_margin_rate')),
            // ... extract other commodity fields based on schema
        };
        
        this.storeCommodityData(market, commodityCode, commodityData);
    }
    
    getFieldPosition(metaData, fieldName) {
        // Helper to find field position in schema
        for (let i = 0; i < metaData.fields.size(); i++) {
            const field = metaData.fields.get(i);
            if (field.name === fieldName) {
                return i;
            }
        }
        return -1;
    }
}
```

### Historical Data Retrieval

Singularity data supports historical queries for any past trading day:

```javascript
/**
 * Retrieve historical Singularity data for specific trade day
 */
async function getHistoricalSingularityData(tradeDay, marketCode, qualifiedName) {
    // Request historical universe seeds for specific trade day
    const seedsReq = new caitlyn.ATUniverseSeedsReq(
        token,
        sequenceId++,
        -1,           // Use -1 for latest revision
        'global',     // or 'private'
        qualifiedName, // 'Commodity', 'Futures', etc.
        marketCode,   // 'DCE', 'CZCE', etc.
        tradeDay      // YYYYMMDD format
    );
    
    const pkg = new caitlyn.NetPackage();
    const msg = pkg.encode(caitlyn.CMD_AT_UNIVERSE_SEEDS, seedsReq.encode());
    
    client.sendBinary(Buffer.from(msg));
    
    // Clean up
    seedsReq.delete();
    pkg.delete();
}

// Usage examples:
await getHistoricalSingularityData(20250101, 'DCE', 'Commodity');  // New Year's Day commodities
await getHistoricalSingularityData(20240315, 'SHFE', 'Futures');   // March 15, 2024 futures
```

## Conclusion

Singularity data maintenance is the foundation of the Wolverine financial system, providing:

- **Accurate Historical Context**: Each trading day's universe is preserved exactly as it existed
- **Efficient Synchronization**: Revision-based updates minimize data transfer
- **Comprehensive Coverage**: Supports all major global commodity and financial exchanges
- **Flexible Granularity**: Real-time and daily snapshot modes for different use cases

The `examples/test.js` file serves as the definitive reference implementation, demonstrating the complete initialization sequence with proper WASM memory management, schema-based field access, and comprehensive error handling.

By following the patterns and best practices outlined in this document, developers can effectively integrate Singularity data maintenance into their financial applications, ensuring accurate and efficient processing of market metadata and seed data across the entire Wolverine ecosystem.