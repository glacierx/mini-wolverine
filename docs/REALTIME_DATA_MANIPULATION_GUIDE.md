# Real-Time Data Manipulation Guide

## Overview

This guide covers the complete implementation of real-time data subscription and manipulation using the Caitlyn WASM module. Real-time subscriptions allow you to receive live market data updates as they occur on the server, providing a streaming data feed for financial applications.

## Architecture Overview

### Real-Time Data Flow

```text
Client Application
    ↓ ATSubscribeReq
Caitlyn Server
    ↓ ATSubscribeSVRes (continuous stream)
Client Application (callback processing)
```

The real-time system uses a **push-based model** where:

1. **Client subscribes** using `ATSubscribeReq` with filters and criteria
2. **Server responds** with `ATSubscribeRes` confirming subscription
3. **Server streams** `ATSubscribeSVRes` messages containing real-time data
4. **Client processes** each message through callback functions

## Core WASM Classes

### 1. ATSubscribeReq - Subscription Request

The `ATSubscribeReq` class is used to establish real-time data subscriptions:

```javascript
// Create subscription request
const subscribeReq = new wasmModule.ATSubscribeReq();

// Required properties
subscribeReq.token = "your_auth_token";
subscribeReq.seq = uniqueSequenceNumber;
subscribeReq.UUID = "unique-subscription-id"; // Must be unique per subscription

// Market and symbol specification
subscribeReq.markets = ["ICE", "DCE"];          // Market codes
subscribeReq.symbols = ["B<00>", "i<00>"];     // Symbol codes
subscribeReq.granularities = [60, 300];        // Time granularities in seconds
subscribeReq.qualifiedNames = ["SampleQuote"]; // Data type names

// Field selection (optional)
subscribeReq.fields = ["open", "close", "high", "low", "volume"];

// Pagination and sorting (optional)
subscribeReq.start = 0;      // Start index
subscribeReq.end = 100;      // End index
subscribeReq.sort = "timestamp";     // Sort field
subscribeReq.direction = 1;  // 1 = ascending, -1 = descending

// Advanced filtering (optional)
subscribeReq.filters = [/* ATSubscribeFilter objects */];
```

### 2. ATSubscribeRes - Subscription Response

Server confirms subscription with `ATSubscribeRes`:

```javascript
// Decode subscription response
const subscribeRes = new wasmModule.ATSubscribeRes();
subscribeRes.decode(binaryData);

// Check response
console.log("Subscription UUID:", subscribeRes.UUID);
console.log("Status:", subscribeRes.status);
console.log("Error:", subscribeRes.errorMsg);

// Cleanup
subscribeRes.delete();
```

### 3. ATSubscribeSVRes - Real-Time Data Stream

Continuous real-time data arrives via `ATSubscribeSVRes`:

```javascript
// Process real-time data response
const realTimeRes = new wasmModule.ATSubscribeSVRes();
realTimeRes.setCompressor(globalCompressor);
realTimeRes.decode(binaryData);

// Extract StructValues
const structValues = realTimeRes.values(); // Returns array of StructValue objects
const fields = realTimeRes.fields;         // Field metadata

// Process each StructValue
for (let i = 0; i < structValues.size(); i++) {
    const sv = structValues.get(i);
    
    // Extract data using SVObject pattern (recommended)
    const svObject = createSingularityObject("SampleQuote", wasmModule);
    svObject.loadDefFromDict(schemaByNamespace);
    svObject.fromSv(sv);
    const data = svObject.toJSON();
    
    console.log("Real-time data:", data.fields);
    
    svObject.cleanup();
}

realTimeRes.delete();
```

### 4. ATUnsubscribeReq - Unsubscribe Request

To stop receiving real-time data:

```javascript
// Create unsubscribe request
const unsubscribeReq = new wasmModule.ATUnsubscribeReq();
unsubscribeReq.token = "your_auth_token";
unsubscribeReq.seq = uniqueSequenceNumber;
unsubscribeReq.uuid = "subscription-uuid-to-cancel";

// Encode and send
const encoded = unsubscribeReq.encode();
webSocket.send(encoded);

unsubscribeReq.delete();
```

## Advanced Filtering System

### ATSubscribeFilter - Conditional Filtering

Real-time subscriptions support advanced filtering using `ATSubscribeFilter`:

```javascript
// Create filter for price > 100
const filter = new wasmModule.ATSubscribeFilter();
filter.type = wasmModule.BaseSubFilterType.Compare;
filter.op = wasmModule.BaseSubFilterCompOp.Greater;
filter.left = "close";  // Field name
filter.right = 100.0;   // Threshold value

// Add to subscription
const filters = new wasmModule.ATSubscribeFilterVector();
filters.push_back(filter);
subscribeReq.filters = filters;
```

### Filter Operations

**Comparison Operators** (`BaseSubFilterCompOp`):

- `Greater` - Greater than (>)
- `NotLess` - Greater than or equal (>=)
- `Less` - Less than (<)
- `NotGreater` - Less than or equal (<=)
- `Equal` - Equal to (==)
- `NotEqual` - Not equal to (!=)

**Logic Operators** (`BaseSubFilterLogicOp`):

- `And` - Logical AND
- `Or` - Logical OR  
- `Not` - Logical NOT
- `Unknown` - Default/unspecified

### Complex Filter Examples

```javascript
// Filter: price > 100 AND volume > 1000
const priceFilter = new wasmModule.ATSubscribeFilter();
priceFilter.type = wasmModule.BaseSubFilterType.Compare;
priceFilter.op = wasmModule.BaseSubFilterCompOp.Greater;
priceFilter.left = "close";
priceFilter.right = 100.0;

const volumeFilter = new wasmModule.ATSubscribeFilter();
volumeFilter.type = wasmModule.BaseSubFilterType.Compare;
volumeFilter.op = wasmModule.BaseSubFilterCompOp.Greater;
volumeFilter.left = "volume";
volumeFilter.right = 1000.0;

const logicFilter = new wasmModule.ATSubscribeFilter();
logicFilter.type = wasmModule.BaseSubFilterType.Logic;
logicFilter.op = wasmModule.BaseSubFilterLogicOp.And;

const filters = new wasmModule.ATSubscribeFilterVector();
filters.push_back(priceFilter);
filters.push_back(volumeFilter);
filters.push_back(logicFilter);

subscribeReq.filters = filters;
```

## Protocol Constants

### Command Constants

```javascript
// Subscription commands
const CMD_AT_SUBSCRIBE = wasmModule.CMD_AT_SUBSCRIBE;           // Subscribe request
const CMD_AT_SUBSCRIBE_SORT = wasmModule.CMD_AT_SUBSCRIBE_SORT; // Sorted subscription
const CMD_AT_UNSUBSCRIBE = wasmModule.CMD_AT_UNSUBSCRIBE;       // Unsubscribe request
const CMD_TA_SUBSCRIBE_HEADER = wasmModule.CMD_TA_SUBSCRIBE_HEADER; // Header info
```

### Message Routing

```javascript
// Handle incoming binary messages
function handleBinaryMessage(binaryData) {
    const pkg = new wasmModule.NetPackage();
    pkg.load(binaryData);
    
    const cmd = pkg.cmd();
    const content = pkg.content();
    
    switch (cmd) {
        case wasmModule.CMD_AT_SUBSCRIBE:
            // Subscription confirmation
            handleSubscriptionResponse(content);
            break;
            
        case wasmModule.CMD_TA_SUBSCRIBE_HEADER:
            // Real-time data stream
            handleRealTimeData(content);
            break;
            
        case wasmModule.CMD_AT_UNSUBSCRIBE:
            // Unsubscribe confirmation
            handleUnsubscribeResponse(content);
            break;
    }
    
    pkg.delete();
}
```

## Complete Implementation Example

### 1. Subscription Setup

```javascript
class RealTimeSubscriptionManager {
    constructor(wasmModule, webSocket) {
        this.wasmModule = wasmModule;
        this.webSocket = webSocket;
        this.subscriptions = new Map();
        this.callbacks = new Map();
        this.sequenceCounter = 1000;
    }
    
    /**
     * Subscribe to real-time data
     */
    subscribe(markets, symbols, qualifiedNames, options = {}) {
        const uuid = this.generateUUID();
        const seq = this.sequenceCounter++;
        
        // Create subscription request
        const req = new this.wasmModule.ATSubscribeReq();
        req.token = options.token || globalAuthToken;
        req.seq = seq;
        req.UUID = uuid;
        req.markets = markets;
        req.symbols = symbols;
        req.qualifiedNames = qualifiedNames;
        
        // Optional parameters
        if (options.granularities) req.granularities = options.granularities;
        if (options.fields) req.fields = options.fields;
        if (options.filters) req.filters = options.filters;
        if (options.start !== undefined) req.start = options.start;
        if (options.end !== undefined) req.end = options.end;
        if (options.sort) req.sort = options.sort;
        if (options.direction) req.direction = options.direction;
        
        // Store subscription info
        this.subscriptions.set(uuid, {
            markets,
            symbols,
            qualifiedNames,
            seq,
            timestamp: Date.now()
        });
        
        if (options.callback) {
            this.callbacks.set(uuid, options.callback);
        }
        
        // Encode and send
        const pkg = new this.wasmModule.NetPackage();
        pkg.init(this.wasmModule.CMD_AT_SUBSCRIBE, req.encode());
        
        this.webSocket.send(pkg.encode());
        
        // Cleanup
        req.delete();
        pkg.delete();
        
        return uuid;
    }
    
    /**
     * Unsubscribe from real-time data
     */
    unsubscribe(uuid) {
        if (!this.subscriptions.has(uuid)) {
            console.warn(`Subscription ${uuid} not found`);
            return false;
        }
        
        const req = new this.wasmModule.ATUnsubscribeReq();
        req.token = globalAuthToken;
        req.seq = this.sequenceCounter++;
        req.uuid = uuid;
        
        // Encode and send
        const pkg = new this.wasmModule.NetPackage();
        pkg.init(this.wasmModule.CMD_AT_UNSUBSCRIBE, req.encode());
        
        this.webSocket.send(pkg.encode());
        
        // Clean up local storage
        this.subscriptions.delete(uuid);
        this.callbacks.delete(uuid);
        
        // Cleanup WASM objects
        req.delete();
        pkg.delete();
        
        return true;
    }
    
    /**
     * Process real-time data message
     */
    processRealTimeData(binaryData) {
        const res = new this.wasmModule.ATSubscribeSVRes();
        res.setCompressor(globalCompressor);
        res.decode(binaryData);
        
        const structValues = res.values();
        const fields = res.fields;
        
        // Process each StructValue
        for (let i = 0; i < structValues.size(); i++) {
            const sv = structValues.get(i);
            
            // Extract market/symbol info to match subscription
            const market = this.extractMarketFromSV(sv);
            const symbol = this.extractSymbolFromSV(sv);
            const qualifiedName = this.extractQualifiedNameFromSV(sv);
            
            // Find matching subscription
            const uuid = this.findMatchingSubscription(market, symbol, qualifiedName);
            
            if (uuid && this.callbacks.has(uuid)) {
                // Process data using SVObject pattern
                const svObject = createSingularityObject(qualifiedName, this.wasmModule);
                svObject.loadDefFromDict(schemaByNamespace);
                svObject.fromSv(sv);
                
                const data = {
                    uuid,
                    market,
                    symbol,
                    qualifiedName,
                    timestamp: Date.now(),
                    fields: svObject.toJSON().fields
                };
                
                // Invoke callback
                this.callbacks.get(uuid)(data);
                
                svObject.cleanup();
            }
        }
        
        res.delete();
    }
    
    generateUUID() {
        return 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    findMatchingSubscription(market, symbol, qualifiedName) {
        for (const [uuid, sub] of this.subscriptions) {
            if (sub.markets.includes(market) && 
                sub.symbols.includes(symbol) && 
                sub.qualifiedNames.includes(qualifiedName)) {
                return uuid;
            }
        }
        return null;
    }
}
```

### 2. Usage Example

```javascript
// Initialize subscription manager
const subscriptionManager = new RealTimeSubscriptionManager(wasmModule, webSocket);

// Subscribe to real-time SampleQuote data for ICE/B<00>
const subscriptionUUID = subscriptionManager.subscribe(
    ['ICE'],              // markets
    ['B<00>'],           // symbols
    ['SampleQuote'],     // qualifiedNames
    {
        fields: ['open', 'close', 'high', 'low', 'volume'],
        granularities: [60],
        callback: (data) => {
            console.log('Real-time data received:', data);
            console.log(`${data.market}/${data.symbol}: close=${data.fields.close}`);
        }
    }
);

// Later: unsubscribe
setTimeout(() => {
    subscriptionManager.unsubscribe(subscriptionUUID);
    console.log('Unsubscribed from real-time data');
}, 60000);
```

## Integration with CaitlynClientConnection

For integration with the existing `CaitlynClientConnection` class:

```javascript
// Add to CaitlynClientConnection class
class CaitlynClientConnection {
    constructor() {
        // ... existing constructor code ...
        this.subscriptions = new Map();
        this.subscriptionCallbacks = new Map();
    }
    
    subscribe(market, code, qualifiedName = 'SampleQuote', namespace = 'global', callback) {
        const subscriptionKey = `${market}/${code}/${qualifiedName}/${namespace}`;
        const uuid = this.generateSubscriptionUUID();
        
        // Store subscription info
        const subscriptionInfo = {
            market,
            code,
            qualifiedName,
            namespace,
            uuid,
            timestamp: Date.now()
        };
        
        this.subscriptions.set(subscriptionKey, subscriptionInfo);
        
        if (callback) {
            this.subscriptionCallbacks.set(subscriptionKey, callback);
        }
        
        // Create and send subscription request
        const req = new this.wasmModule.ATSubscribeReq();
        req.token = this.authToken;
        req.seq = this.getNextSeq();
        req.UUID = uuid;
        req.markets = [market];
        req.symbols = [code];
        req.qualifiedNames = [qualifiedName];
        
        this.sendRequest(this.wasmModule.CMD_AT_SUBSCRIBE, req);
        req.delete();
        
        return subscriptionKey;
    }
    
    unsubscribe(subscriptionKey) {
        if (!this.subscriptions.has(subscriptionKey)) {
            return false;
        }
        
        const subscriptionInfo = this.subscriptions.get(subscriptionKey);
        
        const req = new this.wasmModule.ATUnsubscribeReq();
        req.token = this.authToken;
        req.seq = this.getNextSeq();
        req.uuid = subscriptionInfo.uuid;
        
        this.sendRequest(this.wasmModule.CMD_AT_UNSUBSCRIBE, req);
        req.delete();
        
        // Clean up
        this.subscriptions.delete(subscriptionKey);
        this.subscriptionCallbacks.delete(subscriptionKey);
        
        return true;
    }
    
    handleRealTimeDataMessage(binaryData) {
        // Process ATSubscribeSVRes messages
        this.processRealTimeSubscriptionData(binaryData);
    }
}
```

## Performance Considerations

### 1. Memory Management

```javascript
// Always clean up WASM objects
function processSubscriptionSafely(binaryData) {
    const res = new wasmModule.ATSubscribeSVRes();
    const svObjectCache = {};
    
    try {
        res.setCompressor(globalCompressor);
        res.decode(binaryData);
        
        const structValues = res.values();
        
        for (let i = 0; i < structValues.size(); i++) {
            const sv = structValues.get(i);
            
            // Reuse SVObject instances
            const qualifiedName = getQualifiedName(sv);
            if (!svObjectCache[qualifiedName]) {
                svObjectCache[qualifiedName] = createSingularityObject(qualifiedName, wasmModule);
                svObjectCache[qualifiedName].loadDefFromDict(schemaByNamespace);
            }
            
            const svObject = svObjectCache[qualifiedName];
            svObject.fromSv(sv);
            
            // Process data...
        }
    } finally {
        // Cleanup all objects
        for (const qualifiedName in svObjectCache) {
            svObjectCache[qualifiedName].cleanup();
        }
        res.delete();
    }
}
```

### 2. Subscription Limits

- **Maximum Subscriptions**: Limit concurrent subscriptions to avoid server overload
- **Field Selection**: Only subscribe to required fields to reduce bandwidth
- **Filter Usage**: Use server-side filtering to reduce client processing

### 3. Error Handling

```javascript
function robustSubscriptionHandling() {
    try {
        const uuid = subscriptionManager.subscribe(/* parameters */);
        
        // Set timeout for subscription confirmation
        setTimeout(() => {
            if (!subscriptionManager.isConfirmed(uuid)) {
                console.warn(`Subscription ${uuid} not confirmed, retrying...`);
                subscriptionManager.retrySubscription(uuid);
            }
        }, 5000);
        
    } catch (error) {
        console.error('Subscription failed:', error);
        // Implement retry logic or fallback
    }
}
```

## Best Practices

### 1. Subscription Lifecycle Management

- **Unique UUIDs**: Always use unique subscription identifiers
- **Proper Cleanup**: Unsubscribe when no longer needed
- **Connection Resilience**: Resubscribe after WebSocket reconnection

### 2. Data Processing Patterns

- **SVObject Caching**: Reuse SVObject instances for better performance
- **Field Validation**: Verify expected fields are present before processing
- **Error Recovery**: Handle malformed or unexpected data gracefully

### 3. Scalability Considerations

- **Batch Processing**: Process multiple StructValues in batches
- **Memory Monitoring**: Track WASM object creation and cleanup
- **Callback Optimization**: Keep callback functions lightweight and fast

## Debugging and Monitoring

### 1. Subscription Status Monitoring

```javascript
// Monitor subscription health
class SubscriptionMonitor {
    constructor(subscriptionManager) {
        this.subscriptionManager = subscriptionManager;
        this.metrics = {
            messagesReceived: 0,
            lastMessageTime: null,
            avgProcessingTime: 0
        };
    }
    
    logSubscriptionStats() {
        console.log('Active subscriptions:', this.subscriptionManager.subscriptions.size);
        console.log('Messages received:', this.metrics.messagesReceived);
        console.log('Last message:', this.metrics.lastMessageTime);
        console.log('Avg processing time:', this.metrics.avgProcessingTime + 'ms');
    }
}
```

### 2. Debug Logging

```javascript
// Enable debug logging
const DEBUG_SUBSCRIPTIONS = true;

function debugLog(message, data) {
    if (DEBUG_SUBSCRIPTIONS) {
        console.log(`[SUBSCRIPTION] ${message}:`, data);
    }
}

// Usage in callbacks
callback: (data) => {
    debugLog('Real-time data received', {
        market: data.market,
        symbol: data.symbol,
        fieldCount: Object.keys(data.fields).length
    });
}
```

## Conclusion

The Caitlyn WASM real-time subscription system provides a powerful and flexible way to receive live market data. By following the patterns and best practices outlined in this guide, you can build robust real-time financial applications with proper resource management and optimal performance.

Key takeaways:

- Use `ATSubscribeReq` for establishing subscriptions
- Process `ATSubscribeSVRes` messages for real-time data
- Implement proper WASM object lifecycle management
- Use SVObject pattern for safe data extraction
- Monitor subscription health and implement error recovery

This system forms the foundation for building sophisticated real-time trading applications, market data displays, and analytical tools.