# StructValue Design Guide: JavaScript Caitlyn WASM Integration

## Overview

StructValue is the fundamental data structure in the Caitlyn financial time series system when integrated with JavaScript through WebAssembly (WASM). It provides a typed, efficient, and serializable format for representing single frames of financial time series data across WebSocket connections and WASM module boundaries.

This guide covers the JavaScript-specific implementation patterns, WASM integration strategies, and practical usage examples for building financial applications with the Caitlyn WASM module.

## Architecture Philosophy

The JavaScript Caitlyn integration follows a **client-server model** with WASM processing:

- **Frontend JavaScript** - UI and data visualization layer
- **WASM Module** - Core financial data processing and protocol handling
- **WebSocket Communication** - Real-time data streaming from Caitlyn servers
- **Schema-Driven Processing** - Dynamic type resolution and field access

## StructValue Key Design

### 6-Dimensional Key Structure

Every StructValue is uniquely identified by a 6-dimensional key, accessed through JavaScript properties:

```javascript
// StructValue key components
{
  namespace: 0,           // 0 = global, 1 = private
  metaID: 3,             // Data structure type identifier
  granularity: 900,      // Time frame in seconds (15-minute bars)
  market: "SHFE",        // Market identifier
  stockCode: "au2412",   // Instrument identifier  
  timeTag: 1640995200000 // UTC timestamp in milliseconds
}
```

#### Key Components

1. **`namespace`** (int): Data scope identifier
   - `0` (NAMESPACE_GLOBAL): Shared market data
   - `1` (NAMESPACE_PRIVATE): Strategy-specific data

2. **`metaID`** (int): Structure type identifier
   - `3`: Market metadata structure
   - `4`: Holiday structure
   - `1`: Price quote data (SampleQuote)
   - Custom IDs for indicators and strategies

3. **`granularity`** (int): Time frame in seconds
   - `60`: 1-minute bars
   - `300`: 5-minute bars
   - `900`: 15-minute bars
   - `3600`: 1-hour bars
   - `86400`: Daily bars

4. **`market`** (string): Exchange identifier
   - `"SHFE"`: Shanghai Futures Exchange
   - `"DCE"`: Dalian Commodity Exchange
   - `"CZCE"`: Zhengzhou Commodity Exchange
   - `"CFFEX"`: China Financial Futures Exchange

5. **`stockCode`** (string): Instrument code
   - `"au2412"`: Gold December 2024 contract
   - `"i2412"`: Iron ore December 2024 contract

6. **`timeTag`** (int64): UTC timestamp in milliseconds
   - JavaScript Date.now() compatible format
   - Example: `1640995200000 = 2022-01-01 00:00:00 UTC`

### JavaScript Field Type System

StructValue supports a comprehensive type system accessible through JavaScript methods:

```javascript
// Scalar Types
structValue.getInt32(fieldIndex)     // 32-bit integer
structValue.getInt64(fieldIndex)     // 64-bit integer (as string in JS)
structValue.getDouble(fieldIndex)    // 64-bit floating point
structValue.getString(fieldIndex)    // UTF-8 string

// Vector Types
structValue.getInt32Vector(fieldIndex)    // Array of 32-bit integers
structValue.getInt64Vector(fieldIndex)    // Array of 64-bit integers 
structValue.getDoubleVector(fieldIndex)   // Array of 64-bit floats
structValue.getStringVector(fieldIndex)   // Array of UTF-8 strings

// Field Utilities
structValue.isEmpty(fieldIndex)           // Check if field has data
structValue.fieldCount                    // Number of fields in structure
```

## WASM Integration Architecture

### Core JavaScript Classes

#### 1. StructValue: Primary Data Interface

```javascript
// Create new StructValue instance
const sv = new wasmModule.StructValue();

// Set header information
sv.namespace = 0;           // Global namespace
sv.metaID = 1;             // SampleQuote structure
sv.granularity = 900;      // 15-minute bars
sv.market = "SHFE";        // Shanghai Futures Exchange  
sv.stockCode = "au2412";   // Gold December 2024
sv.timeTag = Date.now();   // Current timestamp

// Set field values
sv.setDouble(0, 2680.5);   // Field 0: Open price
sv.setDouble(1, 2685.2);   // Field 1: Close price
sv.setDouble(2, 2690.8);   // Field 2: High price
sv.setDouble(3, 2678.1);   // Field 3: Low price
sv.setInt64(4, 15420);     // Field 4: Volume

// Read field values
const closePrice = sv.getDouble(1);
const volume = sv.getInt64(4);
const isEmpty = sv.isEmpty(5); // Check if field 5 has data

// Always clean up WASM objects
sv.delete();
```

#### 2. Schema Processing and Field Mapping

```javascript
// Load schema from server response
const schema = new wasmModule.IndexSchema();
schema.load(binaryContent);

// Extract metadata definitions
const metas = schema.metas();
const schemaLookup = {};

// Build schema lookup table
for (let i = 0; i < metas.size(); i++) {
    const meta = metas.get(i);
    
    if (!schemaLookup[meta.namespace]) {
        schemaLookup[meta.namespace] = {};
    }
    
    schemaLookup[meta.namespace][meta.ID] = meta;
}

// Initialize compressor with schema
const compressor = new wasmModule.IndexSerializer();
compressor.updateSchema(schema);

// Clean up schema (compressor keeps internal reference)
schema.delete();
```

#### 3. Schema-Based Field Access

**Critical Pattern**: Always use schema definitions to determine field positions:

```javascript
// ❌ WRONG: Hardcoded field access
const tradeDay = sv.getInt32(2);  // Assumes field 2 is trade_day

// ✅ CORRECT: Schema-based field access
function getFieldValue(sv, schemaInfo, fieldName, dataType) {
    const meta = schemaInfo[sv.namespace][sv.metaID];
    const fieldIndex = meta.fieldMap[fieldName];
    
    switch(dataType) {
        case 'int32':
            return sv.getInt32(fieldIndex);
        case 'int64':
            return sv.getInt64(fieldIndex);
        case 'double':
            return sv.getDouble(fieldIndex);
        case 'string':
            return sv.getString(fieldIndex);
        default:
            throw new Error(`Unsupported data type: ${dataType}`);
    }
}

// Example: Market structure (metaID: 3) field access
const marketSv = // ... received from server
const tradeDay = getFieldValue(marketSv, schemaLookup, 'trade_day', 'int32');    // Field 0
const marketName = getFieldValue(marketSv, schemaLookup, 'name', 'string');      // Field 1
const timeZone = getFieldValue(marketSv, schemaLookup, 'time_zone', 'string');   // Field 2
const revisions = getFieldValue(marketSv, schemaLookup, 'revs', 'string');       // Field 7
```

### WebSocket Message Processing

#### Message Decoding Pipeline

```javascript
// WebSocket binary message handler
websocket.onmessage = function(event) {
    if (event.data instanceof ArrayBuffer) {
        processWasmMessage(event.data);
    }
};

function processWasmMessage(arrayBuffer) {
    // Decode NetPackage wrapper
    const pkg = new wasmModule.NetPackage();
    const uint8Array = new Uint8Array(arrayBuffer);
    pkg.decode(uint8Array);
    
    // Extract message information
    const cmd = pkg.header.cmd;
    const content = pkg.content();
    
    // Route based on command type
    switch (cmd) {
        case wasmModule.NET_CMD_GOLD_ROUTE_DATADEF:
            handleSchemaDefinition(content);
            break;
            
        case wasmModule.CMD_AT_UNIVERSE_REV:
            handleUniverseRevision(content);
            break;
            
        case wasmModule.CMD_AT_UNIVERSE_SEEDS:
            handleUniverseSeeds(content);
            break;
            
        case wasmModule.NET_CMD_GOLD_ROUTE_KEEPALIVE:
            // Heartbeat - no action needed
            break;
            
        default:
            console.log(`Unknown command: ${cmd}`);
    }
    
    // Clean up NetPackage
    pkg.delete();
}
```

#### StructValue Extraction from Responses

```javascript
function handleUniverseRevision(content) {
    const universeRes = new wasmModule.ATUniverseRes();
    universeRes.setCompressor(globalCompressor);
    universeRes.decode(content);
    
    // Extract revision map  
    const revs = universeRes.revs();
    const keys = revs.keys();
    
    // Process each namespace
    for (let i = 0; i < keys.size(); i++) {
        const namespaceKey = keys.get(i);
        const structValues = revs.get(namespaceKey);
        const namespaceId = namespaceKey === 'private' ? 1 : 0;
        
        // Process each StructValue
        for (let j = 0; j < structValues.size(); j++) {
            const sv = structValues.get(j);
            
            // Process based on metaID
            if (sv.metaID === 3) { // Market structure
                processMarketStructValue(sv, namespaceId);
            }
            
            // CRITICAL: Clean up each StructValue
            sv.delete();
        }
    }
    
    // Clean up response
    universeRes.delete();
}

function processMarketStructValue(sv, namespaceId) {
    const marketCode = sv.stockCode;
    
    // Extract market data using schema-based access
    const tradeDay = sv.isEmpty(0) ? 0 : sv.getInt32(0);       // Field 0: trade_day
    const marketName = sv.isEmpty(1) ? "" : sv.getString(1);    // Field 1: name
    const timeZone = sv.isEmpty(2) ? "" : sv.getString(2);      // Field 2: time_zone
    
    // Field 7 contains JSON revision data
    if (!sv.isEmpty(7)) {
        const revsJsonString = sv.getString(7);
        const revsData = JSON.parse(revsJsonString);
        
        console.log(`Market: ${marketCode} (${marketName})`);
        console.log(`Trade Day: ${tradeDay}, Time Zone: ${timeZone}`);
        console.log(`Revisions:`, revsData);
    }
}
```

## Financial Data Patterns

### 1. Price Data Processing (SampleQuote)

Standard OHLCV data structure with JavaScript integration:

```javascript
class PriceDataHandler {
    constructor(wasmModule) {
        this.wasmModule = wasmModule;
    }
    
    createPriceQuote(market, stockCode, granularity, timestamp) {
        const sv = new this.wasmModule.StructValue();
        
        // Set identification
        sv.namespace = 0;           // Global namespace
        sv.metaID = 1;             // SampleQuote structure
        sv.market = market;        // e.g., "SHFE"  
        sv.stockCode = stockCode;  // e.g., "au2412"
        sv.granularity = granularity; // e.g., 900 (15-minute)
        sv.timeTag = timestamp;    // Unix timestamp in ms
        
        return sv;
    }
    
    setPriceData(sv, ohlcvData) {
        // Standard OHLCV field mapping (verify with schema!)
        sv.setDouble(0, ohlcvData.open);     // Field 0: Open price
        sv.setDouble(1, ohlcvData.close);    // Field 1: Close price  
        sv.setDouble(2, ohlcvData.high);     // Field 2: High price
        sv.setDouble(3, ohlcvData.low);      // Field 3: Low price
        sv.setInt64(4, ohlcvData.volume);    // Field 4: Volume
        sv.setDouble(5, ohlcvData.turnover); // Field 5: Turnover amount
    }
    
    extractPriceData(sv) {
        return {
            market: sv.market,
            stockCode: sv.stockCode,
            timestamp: sv.timeTag,
            granularity: sv.granularity,
            open: sv.getDouble(0),
            close: sv.getDouble(1),
            high: sv.getDouble(2),
            low: sv.getDouble(3),
            volume: sv.getInt64(4),
            turnover: sv.getDouble(5)
        };
    }
    
    cleanup(sv) {
        sv.delete();
    }
}

// Usage example
const priceHandler = new PriceDataHandler(wasmModule);
const priceQuote = priceHandler.createPriceQuote("SHFE", "au2412", 900, Date.now());

priceHandler.setPriceData(priceQuote, {
    open: 2680.5,
    close: 2685.2,
    high: 2690.8,
    low: 2678.1,
    volume: 15420,
    turnover: 41285640.5
});

const extractedData = priceHandler.extractPriceData(priceQuote);
priceHandler.cleanup(priceQuote);
```

### 2. Technical Indicators with State

JavaScript implementation of stateful indicators:

```javascript
class MovingAverageIndicator {
    constructor(wasmModule, period = 20) {
        this.wasmModule = wasmModule;
        this.period = period;
        this.prices = [];
    }
    
    createIndicatorStructValue(market, stockCode, granularity, timestamp) {
        const sv = new this.wasmModule.StructValue();
        
        sv.namespace = 1;          // Private namespace
        sv.metaID = 101;          // Custom indicator metaID
        sv.market = market;
        sv.stockCode = stockCode;
        sv.granularity = granularity;
        sv.timeTag = timestamp;
        
        return sv;
    }
    
    update(priceData) {
        this.prices.push(priceData.close);
        
        // Maintain rolling window
        if (this.prices.length > this.period) {
            this.prices.shift();
        }
        
        // Calculate moving average
        const ma = this.prices.reduce((sum, price) => sum + price, 0) / this.prices.length;
        
        // Create result StructValue
        const result = this.createIndicatorStructValue(
            priceData.market,
            priceData.stockCode, 
            priceData.granularity,
            priceData.timestamp
        );
        
        // Set indicator values
        result.setDouble(0, ma);                    // Field 0: Moving average value
        result.setInt32(1, this.period);           // Field 1: Period parameter
        result.setInt32(2, this.prices.length);   // Field 2: Sample count
        
        return result;
    }
    
    extractIndicatorData(sv) {
        return {
            ma_value: sv.getDouble(0),
            period: sv.getInt32(1),
            sample_count: sv.getInt32(2),
            timestamp: sv.timeTag
        };
    }
}

// Usage with price stream
const maIndicator = new MovingAverageIndicator(wasmModule, 20);

// Process incoming price data
function onPriceUpdate(priceData) {
    const indicatorResult = maIndicator.update(priceData);
    const indicatorData = maIndicator.extractIndicatorData(indicatorResult);
    
    console.log(`MA(${indicatorData.period}): ${indicatorData.ma_value}`);
    
    // Always clean up
    indicatorResult.delete();
}
```

### 3. Multi-Asset Portfolio Strategies

Vector-based data for portfolio management:

```javascript
class PortfolioStrategy {
    constructor(wasmModule, assets = []) {
        this.wasmModule = wasmModule;
        this.assets = assets; // Array of {market, stockCode} objects
        this.weights = new Array(assets.length).fill(0.0);
        this.signals = new Array(assets.length).fill(0);
        this.returns = new Array(assets.length).fill(0.0);
    }
    
    createPortfolioStructValue(timestamp) {
        const sv = new this.wasmModule.StructValue();
        
        sv.namespace = 1;       // Private namespace
        sv.metaID = 200;       // Portfolio strategy metaID
        sv.market = "MULTI";   // Multi-market identifier
        sv.stockCode = "PORTFOLIO";
        sv.granularity = 3600; // 1-hour rebalancing
        sv.timeTag = timestamp;
        
        return sv;
    }
    
    updatePortfolio(priceUpdates) {
        // Calculate returns and generate signals
        priceUpdates.forEach((price, index) => {
            if (index < this.assets.length) {
                this.returns[index] = price.changePercent || 0.0;
                this.signals[index] = price.close > price.ma20 ? 1 : -1;
            }
        });
        
        // Rebalance weights (example: equal weight for positive signals)
        const positiveSignals = this.signals.filter(s => s > 0).length;
        this.weights = this.signals.map(signal => 
            signal > 0 ? (1.0 / positiveSignals) : 0.0
        );
        
        // Calculate portfolio value
        const portfolioReturn = this.returns.reduce((sum, ret, i) => 
            sum + (ret * this.weights[i]), 0.0
        );
        
        // Create result StructValue
        const result = this.createPortfolioStructValue(Date.now());
        
        // Set portfolio metrics
        result.setDouble(0, portfolioReturn);           // Field 0: Portfolio return
        result.setDouble(1, 1.0 + portfolioReturn);     // Field 1: Net value
        
        // Set vector data
        result.setInt32Vector(2, this.signals);         // Field 2: Asset signals
        result.setDoubleVector(3, this.weights);        // Field 3: Asset weights
        result.setDoubleVector(4, this.returns);        // Field 4: Asset returns
        
        // Set asset identifiers
        const markets = this.assets.map(asset => asset.market);
        const stockCodes = this.assets.map(asset => asset.stockCode);
        result.setStringVector(5, markets);             // Field 5: Markets
        result.setStringVector(6, stockCodes);          // Field 6: Stock codes
        
        return result;
    }
    
    extractPortfolioData(sv) {
        return {
            portfolio_return: sv.getDouble(0),
            net_value: sv.getDouble(1),
            signals: sv.getInt32Vector(2),
            weights: sv.getDoubleVector(3),
            returns: sv.getDoubleVector(4),
            markets: sv.getStringVector(5),
            stock_codes: sv.getStringVector(6),
            timestamp: sv.timeTag
        };
    }
}

// Usage example
const portfolio = new PortfolioStrategy(wasmModule, [
    {market: "SHFE", stockCode: "au2412"},
    {market: "SHFE", stockCode: "ag2412"},
    {market: "DCE", stockCode: "i2412"}
]);

// Update with price data
const priceUpdates = [
    {close: 2685.2, ma20: 2680.0, changePercent: 0.0012},
    {close: 5420.5, ma20: 5425.0, changePercent: -0.0008},
    {close: 820.5, ma20: 815.0, changePercent: 0.0025}
];

const portfolioResult = portfolio.updatePortfolio(priceUpdates);
const portfolioData = portfolio.extractPortfolioData(portfolioResult);

console.log("Portfolio Data:", portfolioData);
portfolioResult.delete();
```

## Message Creation and Protocol Handling

### Binary Message Encoding

```javascript
class MessageEncoder {
    constructor(wasmModule, token) {
        this.wasmModule = wasmModule;
        this.token = token;
        this.sequenceId = 1;
    }
    
    createHandshakeMessage() {
        // JSON handshake message
        return JSON.stringify({
            cmd: 20512,
            token: this.token,
            protocol: 1,
            seq: this.sequenceId++
        });
    }
    
    createKeepaliveMessage() {
        const pkg = new this.wasmModule.NetPackage();
        const encoded = pkg.encode(
            this.wasmModule.NET_CMD_GOLD_ROUTE_KEEPALIVE, 
            new Uint8Array(0)
        );
        
        // Convert SharedArrayBuffer to regular ArrayBuffer for WebSocket
        const regularBuffer = this.copyToRegularBuffer(encoded);
        
        pkg.delete();
        return regularBuffer;
    }
    
    createUniverseRequest() {
        const universeReq = new this.wasmModule.ATUniverseReq(this.token, 2);
        const pkg = new this.wasmModule.NetPackage();
        
        const encodedReq = universeReq.encode();
        const encodedPkg = pkg.encode(this.wasmModule.CMD_AT_UNIVERSE_REV, encodedReq);
        
        const regularBuffer = this.copyToRegularBuffer(encodedPkg);
        
        universeReq.delete();
        pkg.delete();
        
        return regularBuffer;
    }
    
    createUniverseSeedsRequest(revision, namespace, qualifiedName, marketCode, tradeDay) {
        const seedsReq = new this.wasmModule.ATUniverseSeedsReq(
            this.token,
            this.sequenceId++,
            revision,
            namespace,
            qualifiedName,
            marketCode,
            tradeDay
        );
        
        const pkg = new this.wasmModule.NetPackage();
        const encodedReq = seedsReq.encode();
        const encodedPkg = pkg.encode(this.wasmModule.CMD_AT_UNIVERSE_SEEDS, encodedReq);
        
        const regularBuffer = this.copyToRegularBuffer(encodedPkg);
        
        seedsReq.delete();
        pkg.delete();
        
        return regularBuffer;
    }
    
    copyToRegularBuffer(sharedArrayBuffer) {
        // Critical: Copy SharedArrayBuffer to regular ArrayBuffer
        // WebSocket.send() doesn't support SharedArrayBuffer
        const regularBuffer = new ArrayBuffer(sharedArrayBuffer.byteLength);
        const regularView = new Uint8Array(regularBuffer);
        const sharedView = new Uint8Array(sharedArrayBuffer);
        regularView.set(sharedView);
        return regularBuffer;
    }
}

// Usage
const encoder = new MessageEncoder(wasmModule, authToken);

// Send handshake
websocket.send(encoder.createHandshakeMessage());

// Send keepalive
websocket.send(encoder.createKeepaliveMessage());

// Send universe request  
websocket.send(encoder.createUniverseRequest());

// Send seeds requests
websocket.send(encoder.createUniverseSeedsRequest(
    1, "global", "Commodity", "SHFE", 20240827
));
```

## Memory Management Best Practices

### Critical WASM Object Lifecycle

```javascript
// ✅ CORRECT: Always delete WASM objects after use
function processMarketData() {
    const pkg = new wasmModule.NetPackage();
    const schema = new wasmModule.IndexSchema();
    const compressor = new wasmModule.IndexSerializer();
    
    try {
        // Use objects...
        pkg.decode(binaryData);
        schema.load(schemaContent);
        compressor.updateSchema(schema);
        
        // Process data...
        
    } finally {
        // CRITICAL: Always clean up, even on error
        pkg.delete();
        schema.delete();
        compressor.delete();
    }
}

// ✅ CORRECT: WASM object deletion pattern
const structValues = response.getData();
for (let i = 0; i < structValues.size(); i++) {
    const sv = structValues.get(i);
    
    // Process StructValue...
    const data = extractData(sv);
    
    // Delete immediately after use
    sv.delete();
}

// ❌ WRONG: No cleanup
function badExample() {
    const pkg = new wasmModule.NetPackage();
    pkg.decode(data);
    // Missing: pkg.delete() - causes memory leak!
}

// ❌ WRONG: Conditional cleanup
function badCleanup(pkg) {
    if (pkg && typeof pkg.delete === 'function') {
        pkg.delete();
    }
    // Unnecessary checks - all WASM objects have delete()
}
```

### Error Handling Strategy

```javascript
// ✅ CORRECT: Let exceptions surface for debugging
function decodeMessage(arrayBuffer) {
    const pkg = new wasmModule.NetPackage();
    
    try {
        pkg.decode(arrayBuffer);
        return {
            cmd: pkg.header.cmd,
            content: pkg.content()
        };
    } finally {
        pkg.delete();
    }
}

// ❌ WRONG: Hiding errors
function badErrorHandling(arrayBuffer) {
    try {
        const pkg = wasmModule?.NetPackage ? new wasmModule.NetPackage() : null;
        if (pkg) {
            pkg.decode?.(arrayBuffer);
            return { cmd: pkg.header?.cmd || 0 };
        }
    } catch (e) {
        console.log('Failed but continuing anyway');
        return null;
    }
    // Defensive programming that hides real issues
}
```

### SharedArrayBuffer Handling

```javascript
// Critical pattern for WebSocket sending
function sendBinaryMessage(websocket, wasmArrayBuffer) {
    // WASM modules may return SharedArrayBuffer
    // WebSocket.send() requires regular ArrayBuffer
    
    if (wasmArrayBuffer instanceof SharedArrayBuffer) {
        // Copy to regular ArrayBuffer
        const regular = new ArrayBuffer(wasmArrayBuffer.byteLength);
        const regularView = new Uint8Array(regular);
        const sharedView = new Uint8Array(wasmArrayBuffer);
        regularView.set(sharedView);
        
        websocket.send(regular);
    } else {
        websocket.send(wasmArrayBuffer);
    }
}
```

## Advanced Integration Patterns

### 1. Real-time Data Processing Pipeline

```javascript
class CaitlynDataProcessor {
    constructor(wasmModule) {
        this.wasmModule = wasmModule;
        this.compressor = null;
        this.schema = {};
        this.dataHandlers = new Map();
    }
    
    initialize(schemaContent) {
        // Load schema
        const schema = new this.wasmModule.IndexSchema();
        schema.load(schemaContent);
        
        // Build lookup table
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
    }
    
    registerHandler(metaID, handler) {
        this.dataHandlers.set(metaID, handler);
    }
    
    processMessage(arrayBuffer) {
        const pkg = new this.wasmModule.NetPackage();
        
        try {
            pkg.decode(arrayBuffer);
            const cmd = pkg.header.cmd;
            
            switch (cmd) {
                case this.wasmModule.CMD_TA_PUSH_DATA:
                    this.processDataPush(pkg.content());
                    break;
                // Handle other commands...
            }
        } finally {
            pkg.delete();
        }
    }
    
    processDataPush(content) {
        // Decode compressed StructValue data
        const structValues = this.compressor.decode(content);
        
        for (let i = 0; i < structValues.size(); i++) {
            const sv = structValues.get(i);
            
            try {
                const handler = this.dataHandlers.get(sv.metaID);
                if (handler) {
                    handler(sv, this.schema[sv.namespace][sv.metaID]);
                }
            } finally {
                sv.delete();
            }
        }
    }
}

// Usage
const processor = new CaitlynDataProcessor(wasmModule);
processor.initialize(schemaContent);

// Register price data handler
processor.registerHandler(1, (sv, meta) => {
    const priceData = {
        market: sv.market,
        stockCode: sv.stockCode,
        open: sv.getDouble(0),
        close: sv.getDouble(1),
        high: sv.getDouble(2),
        low: sv.getDouble(3),
        volume: sv.getInt64(4)
    };
    
    updatePriceChart(priceData);
});
```

### 2. Schema-Based Dynamic Field Access

```javascript
class DynamicFieldAccessor {
    constructor(schema) {
        this.schema = schema;
        this.fieldMaps = this.buildFieldMaps();
    }
    
    buildFieldMaps() {
        const maps = {};
        
        for (const namespace in this.schema) {
            maps[namespace] = {};
            
            for (const metaID in this.schema[namespace]) {
                const meta = this.schema[namespace][metaID];
                maps[namespace][metaID] = this.extractFieldMap(meta);
            }
        }
        
        return maps;
    }
    
    extractFieldMap(meta) {
        // Extract field information from metadata
        // Implementation depends on schema structure
        const fieldMap = {};
        const fields = meta.fields || [];
        
        fields.forEach((field, index) => {
            fieldMap[field.name] = {
                index: index,
                type: field.type
            };
        });
        
        return fieldMap;
    }
    
    getValue(sv, fieldName) {
        const fieldMap = this.fieldMaps[sv.namespace]?.[sv.metaID];
        if (!fieldMap || !fieldMap[fieldName]) {
            throw new Error(`Field ${fieldName} not found for metaID ${sv.metaID}`);
        }
        
        const field = fieldMap[fieldName];
        
        switch (field.type) {
            case 'INT':
                return sv.getInt32(field.index);
            case 'DOUBLE':
                return sv.getDouble(field.index);
            case 'STRING':
                return sv.getString(field.index);
            case 'VINT':
                return sv.getInt32Vector(field.index);
            case 'VDOUBLE':
                return sv.getDoubleVector(field.index);
            case 'VSTRING':
                return sv.getStringVector(field.index);
            default:
                throw new Error(`Unsupported field type: ${field.type}`);
        }
    }
    
    setValue(sv, fieldName, value) {
        const fieldMap = this.fieldMaps[sv.namespace]?.[sv.metaID];
        if (!fieldMap || !fieldMap[fieldName]) {
            throw new Error(`Field ${fieldName} not found for metaID ${sv.metaID}`);
        }
        
        const field = fieldMap[fieldName];
        
        switch (field.type) {
            case 'INT':
                sv.setInt32(field.index, value);
                break;
            case 'DOUBLE':
                sv.setDouble(field.index, value);
                break;
            case 'STRING':
                sv.setString(field.index, value);
                break;
            case 'VINT':
                sv.setInt32Vector(field.index, value);
                break;
            case 'VDOUBLE':
                sv.setDoubleVector(field.index, value);
                break;
            case 'VSTRING':
                sv.setStringVector(field.index, value);
                break;
            default:
                throw new Error(`Unsupported field type: ${field.type}`);
        }
    }
}

// Usage
const accessor = new DynamicFieldAccessor(schema);

// Type-safe field access
const tradeDay = accessor.getValue(marketSv, 'trade_day');
const marketName = accessor.getValue(marketSv, 'name');
const revisions = accessor.getValue(marketSv, 'revs');

// Type-safe field setting
accessor.setValue(indicatorSv, 'ma_value', 2685.5);
accessor.setValue(indicatorSv, 'signals', [1, -1, 0, 1]);
```

### 3. WebSocket Connection Manager

```javascript
class CaitlynWebSocketManager {
    constructor(wasmModule, url, token) {
        this.wasmModule = wasmModule;
        this.url = url;
        this.token = token;
        this.websocket = null;
        this.messageEncoder = null;
        this.dataProcessor = null;
        this.connected = false;
        this.ready = false;
    }
    
    async connect() {
        return new Promise((resolve, reject) => {
            this.websocket = new WebSocket(this.url);
            this.messageEncoder = new MessageEncoder(this.wasmModule, this.token);
            
            this.websocket.onopen = () => {
                console.log('WebSocket connected');
                this.connected = true;
                
                // Send handshake
                this.websocket.send(this.messageEncoder.createHandshakeMessage());
            };
            
            this.websocket.onmessage = (event) => {
                if (typeof event.data === 'string') {
                    console.log('Text message:', event.data);
                    resolve();
                } else if (event.data instanceof ArrayBuffer) {
                    this.processBinaryMessage(event.data);
                }
            };
            
            this.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            this.websocket.onclose = () => {
                console.log('WebSocket closed');
                this.connected = false;
                this.ready = false;
            };
        });
    }
    
    processBinaryMessage(arrayBuffer) {
        const pkg = new this.wasmModule.NetPackage();
        
        try {
            pkg.decode(arrayBuffer);
            const cmd = pkg.header.cmd;
            
            switch (cmd) {
                case this.wasmModule.NET_CMD_GOLD_ROUTE_DATADEF:
                    this.handleSchema(pkg.content());
                    break;
                    
                case this.wasmModule.CMD_AT_UNIVERSE_REV:
                    this.handleUniverseRevision(pkg.content());
                    break;
                    
                default:
                    console.log(`Received command: ${cmd}`);
            }
        } finally {
            pkg.delete();
        }
    }
    
    handleSchema(content) {
        console.log('Loading schema...');
        
        if (!this.dataProcessor) {
            this.dataProcessor = new CaitlynDataProcessor(this.wasmModule);
        }
        
        this.dataProcessor.initialize(content);
        this.ready = true;
        
        console.log('Schema loaded, requesting universe data...');
        this.requestUniverseData();
    }
    
    requestUniverseData() {
        if (!this.ready || !this.connected) return;
        
        const universeRequest = this.messageEncoder.createUniverseRequest();
        this.websocket.send(universeRequest);
    }
    
    handleUniverseRevision(content) {
        console.log('Processing universe revision...');
        this.dataProcessor.processUniverseRevision(content);
    }
    
    disconnect() {
        if (this.websocket) {
            this.websocket.close();
        }
    }
}

// Usage
const wsManager = new CaitlynWebSocketManager(
    wasmModule, 
    'wss://your-server.com/tm',
    'your-auth-token'
);

wsManager.connect()
    .then(() => console.log('Connected and initialized'))
    .catch(error => console.error('Connection failed:', error));
```

## Performance Optimization

### 1. Object Pooling for High-Frequency Data

```javascript
class StructValuePool {
    constructor(wasmModule, initialSize = 10) {
        this.wasmModule = wasmModule;
        this.available = [];
        this.inUse = new Set();
        
        // Pre-allocate objects
        for (let i = 0; i < initialSize; i++) {
            this.available.push(new this.wasmModule.StructValue());
        }
    }
    
    acquire() {
        let sv;
        
        if (this.available.length > 0) {
            sv = this.available.pop();
        } else {
            sv = new this.wasmModule.StructValue();
        }
        
        this.inUse.add(sv);
        return sv;
    }
    
    release(sv) {
        if (this.inUse.has(sv)) {
            this.inUse.delete(sv);
            
            // Reset object state
            sv.namespace = 0;
            sv.metaID = 0;
            sv.timeTag = 0;
            sv.fieldCount = 0;
            
            this.available.push(sv);
        }
    }
    
    cleanup() {
        // Clean up all objects
        this.available.forEach(sv => sv.delete());
        this.inUse.forEach(sv => sv.delete());
        this.available = [];
        this.inUse.clear();
    }
}

// Usage for high-frequency data
const svPool = new StructValuePool(wasmModule, 50);

function processHighFrequencyData(dataStream) {
    dataStream.forEach(data => {
        const sv = svPool.acquire();
        
        try {
            // Set data
            sv.namespace = data.namespace;
            sv.metaID = data.metaID;
            // ... process data
            
        } finally {
            svPool.release(sv); // Return to pool instead of delete
        }
    });
}
```

### 2. Batch Processing for Large Datasets

```javascript
class BatchProcessor {
    constructor(wasmModule, batchSize = 100) {
        this.wasmModule = wasmModule;
        this.batchSize = batchSize;
        this.buffer = [];
    }
    
    async processBatch(dataArray) {
        const results = [];
        
        for (let i = 0; i < dataArray.length; i += this.batchSize) {
            const batch = dataArray.slice(i, i + this.batchSize);
            const batchResults = await this.processChunk(batch);
            results.push(...batchResults);
            
            // Allow other tasks to run
            if (i % (this.batchSize * 5) === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        return results;
    }
    
    async processChunk(chunk) {
        const results = [];
        
        chunk.forEach(data => {
            const sv = new this.wasmModule.StructValue();
            
            try {
                // Process data
                this.populateStructValue(sv, data);
                const result = this.extractResult(sv);
                results.push(result);
            } finally {
                sv.delete();
            }
        });
        
        return results;
    }
}
```

## Error Handling and Debugging

### 1. Comprehensive Error Context

```javascript
class CaitlynError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.name = 'CaitlynError';
        this.context = context;
        this.timestamp = new Date().toISOString();
    }
}

function safeWasmOperation(operation, context = {}) {
    try {
        return operation();
    } catch (error) {
        throw new CaitlynError(
            `WASM operation failed: ${error.message}`,
            {
                ...context,
                originalError: error.message,
                stack: error.stack
            }
        );
    }
}

// Usage
try {
    const result = safeWasmOperation(() => {
        const sv = new wasmModule.StructValue();
        sv.setDouble(0, priceValue);
        return sv.getDouble(0);
    }, {
        operation: 'price_data_processing',
        market: 'SHFE',
        stockCode: 'au2412'
    });
} catch (error) {
    if (error instanceof CaitlynError) {
        console.error('Caitlyn Error:', error.message);
        console.error('Context:', error.context);
    }
}
```

### 2. Debug Utilities

```javascript
class DebugUtils {
    static inspectStructValue(sv, schema = null) {
        const info = {
            namespace: sv.namespace,
            metaID: sv.metaID,
            market: sv.market,
            stockCode: sv.stockCode,
            timeTag: sv.timeTag,
            granularity: sv.granularity,
            fieldCount: sv.fieldCount,
            fields: []
        };
        
        // Extract field values
        for (let i = 0; i < sv.fieldCount; i++) {
            const field = {
                index: i,
                isEmpty: sv.isEmpty(i)
            };
            
            if (!field.isEmpty) {
                try {
                    field.stringValue = sv.getString(i);
                } catch (e) {
                    try {
                        field.doubleValue = sv.getDouble(i);
                    } catch (e) {
                        try {
                            field.int32Value = sv.getInt32(i);
                        } catch (e) {
                            field.error = 'Could not read field';
                        }
                    }
                }
            }
            
            info.fields.push(field);
        }
        
        return info;
    }
    
    static logMessageFlow(direction, cmd, size, wasmModule) {
        const cmdName = this.getCommandName(cmd, wasmModule);
        console.log(`${direction} [${cmdName}] ${size} bytes`);
    }
    
    static getCommandName(cmd, wasmModule) {
        const commands = [
            'NET_CMD_GOLD_ROUTE_KEEPALIVE',
            'NET_CMD_GOLD_ROUTE_DATADEF', 
            'CMD_AT_UNIVERSE_REV',
            'CMD_AT_UNIVERSE_SEEDS'
        ];
        
        for (const name of commands) {
            if (wasmModule[name] === cmd) {
                return name;
            }
        }
        
        return `Unknown(${cmd})`;
    }
}

// Debug usage
const debugInfo = DebugUtils.inspectStructValue(structValue);
console.log('StructValue Debug Info:', debugInfo);

DebugUtils.logMessageFlow('→', cmd, arrayBuffer.byteLength, wasmModule);
```

## Best Practices Summary

### 1. Memory Management
- **Always call delete()** on WASM objects after use
- **Use try-finally blocks** to ensure cleanup even on errors
- **Avoid conditional cleanup** - all WASM objects have delete()
- **Use object pooling** for high-frequency operations

### 2. Field Access
- **Use schema-based field mapping** instead of hardcoded indices
- **Validate field existence** with isEmpty() before reading
- **Choose correct accessor method** based on data type
- **Handle field type mismatches** gracefully

### 3. WebSocket Integration
- **Convert SharedArrayBuffer to ArrayBuffer** before sending
- **Handle both text and binary messages** appropriately
- **Implement proper message routing** based on command types
- **Use proper error handling** throughout the pipeline

### 4. Performance
- **Batch process large datasets** to avoid blocking UI
- **Use object pooling** for frequently created objects
- **Implement proper cleanup** to prevent memory leaks
- **Monitor memory usage** in development

### 5. Error Handling
- **Let exceptions surface** for debugging
- **Provide meaningful error context**
- **Use proper error types** for different failure modes
- **Log sufficient information** for troubleshooting

## Summary

The JavaScript StructValue design provides a powerful, efficient interface for financial time series processing through WASM integration. Key benefits include:

1. **Type-Safe Data Access**: Schema-driven field access prevents runtime errors
2. **Efficient Memory Management**: Proper WASM object lifecycle prevents leaks
3. **Real-time Processing**: Low-latency data processing through WebSocket integration
4. **Scalable Architecture**: Support for both single-asset and portfolio-level strategies
5. **Cross-Platform Compatibility**: JavaScript integration enables web and Node.js deployment
6. **Protocol Compliance**: Full compatibility with Caitlyn server protocols
7. **Performance Optimization**: Object pooling and batch processing for high-frequency data
8. **Developer Experience**: Comprehensive error handling and debugging utilities

By following the patterns and best practices outlined in this guide, developers can build robust, efficient financial applications that integrate seamlessly with the Caitlyn ecosystem through JavaScript and WebAssembly.