# Caitlyn JavaScript API Reference

**Mini Wolverine Backend WASM Integration Guide**

This document describes the official Caitlyn JavaScript interface as implemented in Mini Wolverine's backend architecture. All WASM operations are handled server-side by the Node.js backend, with the React frontend communicating via WebSocket.

## Architecture Overview

```
React Frontend                 Node.js Backend                External Server
     │                              │                            │
     │ ── WebSocket Message ──→ WasmService ── Binary Protocol ──→ Caitlyn Server
     │                           │                               │
     │                      WASM Processing                      │
     │                      (caitlyn_js.wasm)                   │
     │                              │                            │
     │ ←── JSON Response ─────── Response Handler ←── Binary ─── │
```

**Key Points:**
- **Backend-Only WASM**: All caitlyn_js.wasm operations happen in Node.js backend
- **WebSocket Proxy**: Backend acts as intelligent proxy between frontend and Caitlyn servers  
- **Memory Management**: Production-grade WASM object lifecycle handling
- **AI-Friendly**: Clean separation allows AI coding agents to easily extend functionality

## Command Constants

### Network Layer Commands
```javascript
// Connection and protocol management
wasmModule.NET_CMD_GOLD_ROUTE_KEEPALIVE     // Keepalive messages
wasmModule.NET_CMD_GOLD_ROUTE_DATADEF       // Schema definition messages
```

### Application Layer Commands
```javascript
// Universe and metadata operations
wasmModule.CMD_AT_UNIVERSE_REV               // Universe revision requests/responses
wasmModule.CMD_AT_UNIVERSE_META              // Universe metadata
wasmModule.CMD_AT_UNIVERSE_SEEDS             // Universe seeds (market data)

// Data fetching operations
wasmModule.CMD_AT_FETCH_BY_CODE              // Fetch data by security code
wasmModule.CMD_AT_FETCH_BY_TIME              // Fetch data by time
wasmModule.CMD_AT_FETCH_BY_TIME_RANGE        // Fetch data by time range

// Subscription operations
wasmModule.CMD_AT_SUBSCRIBE                  // Subscribe to data feeds
wasmModule.CMD_AT_SUBSCRIBE_SORT             // Subscribe with sorting
wasmModule.CMD_AT_UNSUBSCRIBE                // Unsubscribe from feeds

// Trading and account management (🔥 Planned for Mini Wolverine)
wasmModule.CMD_AT_MANUAL_TRADE               // Manual trading operations
wasmModule.CMD_AT_MANUAL_EDIT                // Edit manual trades
wasmModule.CMD_AT_ACCOUNT_ADD                // Add trading accounts
wasmModule.CMD_AT_ACCOUNT_DEL                // Delete trading accounts
wasmModule.CMD_AT_ACCOUNT_EDIT               // Edit trading accounts

// Backtesting operations (🔥 Upcoming: Simplified Implementation)
wasmModule.CMD_AT_START_BACKTEST             // Start backtest
wasmModule.CMD_AT_CTRL_BACKTEST              // Control backtest execution
wasmModule.CMD_AT_QUERY_ORDERS               // Query orders

// Market data push operations
wasmModule.CMD_TA_PUSH_DATA                  // Real-time market data push
wasmModule.CMD_TA_MARKET_STATUS              // Market status updates
wasmModule.CMD_TA_PUSH_PROGRESS              // Progress notifications
wasmModule.CMD_TA_PUSH_LOG                   // Log messages
wasmModule.CMD_TA_MARKET_SINGULARITY         // Market singularity events
```

### Namespace Constants
```javascript
wasmModule.NAMESPACE_GLOBAL                  // Global namespace (0)
wasmModule.NAMESPACE_PRIVATE                 // Private namespace (1)
```

## Core Classes

### NetPackage - Binary Message Handling
```javascript
// 🏗️ Backend Implementation (WasmService.js)
// Create and manipulate binary network packages
const pkg = new wasmModule.NetPackage();

// Methods:
pkg.encode(cmd, content)                     // Encode command and content to binary
pkg.decode(uint8Array)                       // Decode binary data
pkg.header.cmd                               // Access command from header
pkg.header.seq                               // Access sequence number
pkg.content()                                // Get message content
pkg.length()                                 // Get content length
pkg.delete()                                 // ⚠️  CRITICAL: Always cleanup WASM object

// 🔧 Mini Wolverine Usage Example:
// backend/src/services/WasmService.js
createKeepaliveMessage() {
    const pkg = new this.module.NetPackage();
    const encoded = pkg.encode(this.module.NET_CMD_GOLD_ROUTE_KEEPALIVE, new Uint8Array(0));
    
    // Copy to regular ArrayBuffer for WebSocket transmission
    const regularBuffer = new ArrayBuffer(encoded.byteLength);
    const regularView = new Uint8Array(regularBuffer);
    regularView.set(new Uint8Array(encoded));
    
    pkg.delete(); // Always cleanup
    return regularBuffer;
}
```

### IndexSchema - Schema Management
```javascript
// Manage data schema definitions
const schema = new wasmModule.IndexSchema();

// Methods:
schema.load(content)                         // Load schema from binary content
schema.metas()                               // Get metadata collection
schema.delete()                              // Cleanup WASM object

// Metadata access:
const metas = schema.metas();
const metaCount = metas.size();
for (let i = 0; i < metaCount; i++) {
    const meta = metas.get(i);
    console.log(`${meta.namespace}.${meta.name} (ID: ${meta.ID})`);
}
```

### IndexSerializer - Data Compression
```javascript
// Handle data compression and serialization
const compressor = new wasmModule.IndexSerializer();

// Methods:
compressor.updateSchema(schema)              // Update with new schema
compressor.deserialize(data)                 // Deserialize compressed data
compressor.delete()                          // Cleanup WASM object
```

## Request Classes

### ATUniverseReq - Universe Revision Request
```javascript
// Request universe revision data
const req = new wasmModule.ATUniverseReq(token, sequenceId);

// Methods:
req.encode()                                 // Encode to binary
req.delete()                                 // Cleanup WASM object
```

### ATUniverseSeedsReq - Universe Seeds Request  
```javascript
// Request universe seeds (market data)
const req = new wasmModule.ATUniverseSeedsReq(
    token,          // Authentication token
    sequenceId,     // Sequence number
    revision,       // Data revision
    namespace,      // Data namespace
    qualifiedName,  // Qualified name
    market,         // Market identifier
    tradeDay        // Trading day timestamp
);

// Methods:
req.encode()                                 // Encode to binary
req.delete()                                 // Cleanup WASM object
```

### ATFetchByCodeReq - Fetch Data by Code
```javascript
// Fetch market data by security code
const req = new wasmModule.ATFetchByCodeReq(/* parameters */);
req.encode();
req.delete();
```

### ATFetchByTimeReq - Fetch Data by Time
```javascript
// Fetch market data by time range
const req = new wasmModule.ATFetchByTimeReq(/* parameters */);
req.encode();
req.delete();
```

## Response Classes

### ATUniverseRes - Universe Revision Response
```javascript
// Handle universe revision response
const res = new wasmModule.ATUniverseRes();

// Methods:
res.setCompressor(compressor)                // Set data compressor
res.decode(content)                          // Decode response content
res.revs()                                   // Get revisions map
res.delete()                                 // Cleanup WASM object

// Processing revisions:
const revs = res.revs();
const keys = revs.keys();
for (let i = 0; i < keys.size(); i++) {
    const key = keys.get(i);
    const values = revs.get(key);
    // Process revision data...
}
```

### ATUniverseSeedsRes - Universe Seeds Response
```javascript
// Handle universe seeds response  
const res = new wasmModule.ATUniverseSeedsRes();

// Methods:
res.setCompressor(compressor)                // Set data compressor
res.decode(content)                          // Decode response content
res.seedData()                               // Get seed data collection
res.delete()                                 // Cleanup WASM object

// Processing seed data:
const seedData = res.seedData();
for (let i = 0; i < seedData.size(); i++) {
    const entry = seedData.get(i);
    // Process individual seed entry...
}
```

## Common Usage Patterns

### 1. Complete Handshake and Initialization Flow

```javascript
// 1. JSON Handshake (sent as text)
const handshake = {
    cmd: 20512,
    token: authToken,
    protocol: 1,
    seq: 1
};
websocket.send(JSON.stringify(handshake));

// 2. Wait for schema definition (binary message)
function handleSchemaMessage(content) {
    const schema = new wasmModule.IndexSchema();
    schema.load(content);
    
    const compressor = new wasmModule.IndexSerializer();
    compressor.updateSchema(schema);
    
    // Store globally
    window.caitlynSchema = schema;
    window.caitlynCompressor = compressor;
    
    // Request universe data
    requestUniverseData();
}

// 3. Request universe revision
function requestUniverseData() {
    const req = new wasmModule.ATUniverseReq(token, 2);
    const pkg = new wasmModule.NetPackage();
    
    const encodedReq = req.encode();
    const encodedPkg = pkg.encode(wasmModule.CMD_AT_UNIVERSE_REV, encodedReq);
    
    websocket.send(encodedPkg);
    
    req.delete();
    pkg.delete();
}
```

### 2. Binary Message Processing

```javascript
function handleBinaryMessage(arrayBuffer) {
    const pkg = new wasmModule.NetPackage();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    try {
        pkg.decode(uint8Array);
        const cmd = pkg.header.cmd;
        const seq = pkg.header.seq;
        const content = pkg.content();
        
        // Route based on command
        switch (cmd) {
            case wasmModule.NET_CMD_GOLD_ROUTE_KEEPALIVE:
                // Keepalive - no action needed
                break;
            case wasmModule.NET_CMD_GOLD_ROUTE_DATADEF:
                handleSchemaMessage(content);
                break;
            case wasmModule.CMD_AT_UNIVERSE_REV:
                handleUniverseRevision(content);
                break;
            case wasmModule.CMD_AT_UNIVERSE_SEEDS:
                handleUniverseSeeds(content);
                break;
        }
    } finally {
        pkg.delete(); // Always cleanup
    }
}
```

### 3. Memory Management Best Practices

```javascript
// Always cleanup WASM objects
function processData() {
    const req = new wasmModule.ATUniverseReq(token, seq);
    const pkg = new wasmModule.NetPackage();
    
    try {
        // Use objects...
        const encoded = req.encode();
        const message = pkg.encode(cmd, encoded);
        websocket.send(message);
    } finally {
        // Always cleanup, even on exceptions
        req.delete();
        pkg.delete();
    }
}

// Use try-finally or cleanup in catch blocks
function safeProcessing() {
    let objects = [];
    
    try {
        const schema = new wasmModule.IndexSchema();
        objects.push(schema);
        
        const compressor = new wasmModule.IndexSerializer();
        objects.push(compressor);
        
        // Process data...
        
    } catch (error) {
        console.error('Processing failed:', error);
    } finally {
        // Cleanup all objects
        objects.forEach(obj => {
            if (typeof obj.delete === 'function') {
                obj.delete();
            }
        });
    }
}
```

## Error Handling

```javascript
// Check for class availability before use
if (!wasmModule.NetPackage) {
    throw new Error('NetPackage class not available in WASM module');
}

// Validate method existence
if (typeof pkg.encode !== 'function') {
    throw new Error('NetPackage.encode method not available');
}

// Handle WASM exceptions
try {
    pkg.decode(data);
} catch (wasmError) {
    console.error('WASM decode error:', wasmError);
    // Handle gracefully
}
```

## Performance Tips

1. **Reuse Objects When Possible**: Create WASM objects once and reuse them
2. **Batch Operations**: Process multiple messages before cleanup
3. **Monitor Memory**: Use browser dev tools to track WASM memory usage
4. **Avoid Frequent Allocation**: Pool WASM objects for high-frequency operations
5. **Clean Up Immediately**: Don't hold WASM objects longer than necessary

## Version Compatibility

```javascript
// Check WASM module version
const version = wasmModule.version();  // Returns: 2022012301
console.log('Caitlyn WASM version:', version);

// Verify required constants exist
const requiredConstants = [
    'NET_CMD_GOLD_ROUTE_KEEPALIVE',
    'NET_CMD_GOLD_ROUTE_DATADEF', 
    'CMD_AT_UNIVERSE_REV'
];

for (const constant of requiredConstants) {
    if (typeof wasmModule[constant] === 'undefined') {
        throw new Error(`Required constant ${constant} not found`);
    }
}
```