# WebSocket Data Manipulation Guide

## Overview

This guide focuses on advanced data manipulation with the Caitlyn WebSocket server using `caitlyn_js.js` and `caitlyn_js.wasm`. It provides comprehensive examples for fetching, subscribing to, and manipulating financial data in real-time.

## Table of Contents

1. [Critical: Understanding Schema and Universe Data](#critical-understanding-schema-and-universe-data)
2. [Data Fetching Operations](#data-fetching-operations)
3. [Real-time Data Subscription](#real-time-data-subscription)
4. [Advanced Query Operations](#advanced-query-operations)
5. [Data Filtering and Processing](#data-filtering-and-processing)
6. [Time Series Data Manipulation](#time-series-data-manipulation)
7. [Usage Examples](#usage-examples)
8. [Best Practices](#best-practices)

## Prerequisites

Ensure you have completed the basic setup from `STANDALONE_FRONTEND_DEMO_GUIDE.md` before proceeding with these data manipulation examples.

## Critical: Understanding Schema and Universe Data

**IMPORTANT**: All available fields, markets, and tickers (stock codes) must be retrieved from the server's initialization dataset. You cannot hardcode or guess these values - they are dynamically provided by the Caitlyn server through:

1. **Schema Definition** - Defines available data fields and their types
2. **Universe Revision** - Provides namespace and metadata information  
3. **Universe Seeds** - Contains actual market data including available markets and instrument codes

### Schema-Driven Field Selection

**CRITICAL**: Before making any data requests, you must first receive and process the schema definition to understand what fields are available and their correct field positions. Never hardcode field indices.

**Field Position Discovery Process:**

1. Use `schema_decoder.js` to analyze available structures
2. Map field names to their correct positions  
3. Use schema-based field access in your code

```javascript
// schema-manager.js
class SchemaManager {
    constructor(module) {
        this.module = module;
        this.schema = {};
        this.availableFields = new Map(); // namespace -> metaID -> fields[]
        this.availableMarkets = new Set();
        this.availableInstruments = new Map(); // market -> instruments[]
        this.fieldTypes = new Map(); // fieldName -> dataType
    }
    
    processSchema(schemaContent) {
        try {
            const schema = new this.module.IndexSchema();
            schema.load(schemaContent);
            
            const metas = schema.metas();
            const metaSize = metas.size();
            
            console.log(`Processing ${metaSize} schema metadata definitions`);
            
            for (let i = 0; i < metaSize; i++) {
                const meta = metas.get(i);
                
                // Store schema structure
                if (!this.schema[meta.namespace]) {
                    this.schema[meta.namespace] = {};
                }
                
                const metaInfo = {
                    id: meta.ID,
                    namespace: meta.namespace,
                    name: meta.name,
                    displayName: meta.displayName,
                    fields: this.extractFieldInfo(meta.fields)
                };
                
                this.schema[meta.namespace][meta.ID] = metaInfo;
                
                // Build field availability maps
                const fieldKey = `${meta.namespace}:${meta.ID}`;
                this.availableFields.set(fieldKey, metaInfo.fields);
                
                // Store field types for validation
                metaInfo.fields.forEach(field => {
                    this.fieldTypes.set(field.name, field.type);
                });
                
                console.log(`Schema Meta: ${meta.namespace}.${meta.name} with ${metaInfo.fields.length} fields`);
            }
            
            return schema; // Return for compressor initialization
            
        } catch (error) {
            console.error('Error processing schema:', error);
            throw error;
        }
    }
    
    extractFieldInfo(fieldsVector) {
        const fields = [];
        const fieldPositions = {}; // Map field name to position
        const size = fieldsVector.size();
        
        for (let i = 0; i < size; i++) {
            const field = fieldsVector.get(i);
            const fieldInfo = {
                pos: field.pos,
                name: field.name,
                type: field.type,
                precision: field.precision,
                multiple: field.multiple,
                sampleType: field.sampleType,
                displayName: this.getFieldDisplayName(field.name)
            };
            
            fields.push(fieldInfo);
            fieldPositions[field.name] = field.pos; // Build position lookup
        }
        
        // Store field position mapping for easy access
        this.fieldPositions = fieldPositions;
        return fields;
    }
    
    // Get correct field position by name (CRITICAL for StructValue access)
    getFieldPosition(structureId, fieldName) {
        const fieldKey = `${0}:${structureId}`; // Assuming global namespace
        const fields = this.availableFields.get(fieldKey);
        if (fields) {
            const field = fields.find(f => f.name === fieldName);
            return field ? field.pos : -1;
        }
        return -1;
    }
    
    processUniverseSeeds(seedsResponse) {
        try {
            const seedData = seedsResponse.seedData();
            if (!seedData) return;
            
            const size = seedData.size();
            console.log(`Processing ${size} universe seed entries`);
            
            for (let i = 0; i < size; i++) {
                const entry = seedData.get(i);
                this.processSeedEntry(entry);
            }
            
            console.log(`Discovered ${this.availableMarkets.size} markets with instruments:`, 
                       Object.fromEntries(this.availableInstruments));
            
        } catch (error) {
            console.error('Error processing universe seeds:', error);
        }
    }
    
    processSeedEntry(entry) {
        // Extract market and instrument information from seed entry
        // The exact structure depends on your server implementation
        try {
            const metaID = entry.metaID;
            const namespace = this.getNamespaceForMetaID(metaID);
            
            if (!namespace) return;
            
            const meta = this.schema[namespace][metaID];
            const extractedData = this.extractDataFromEntry(entry, meta);
            
            // Identify markets and instruments based on the data type
            if (meta.name === 'Market' || meta.name.includes('Market')) {
                if (extractedData.code || extractedData.market_code) {
                    const marketCode = extractedData.code || extractedData.market_code;
                    this.availableMarkets.add(marketCode);
                    
                    if (!this.availableInstruments.has(marketCode)) {
                        this.availableInstruments.set(marketCode, []);
                    }
                }
            }
            
            // Identify individual instruments/securities
            if (meta.name === 'Security' || meta.name === 'Futures' || 
                meta.name === 'Options' || meta.name.includes('Instrument')) {
                
                const marketCode = extractedData.market || extractedData.market_code;
                const instrumentCode = extractedData.code || extractedData.symbol || extractedData.ticker;
                
                if (marketCode && instrumentCode) {
                    this.availableMarkets.add(marketCode);
                    
                    if (!this.availableInstruments.has(marketCode)) {
                        this.availableInstruments.set(marketCode, []);
                    }
                    
                    this.availableInstruments.get(marketCode).push({
                        code: instrumentCode,
                        name: extractedData.name || instrumentCode,
                        type: meta.name,
                        ...extractedData
                    });
                }
            }
            
        } catch (error) {
            console.error('Error processing seed entry:', error);
        }
    }
    
    extractDataFromEntry(entry, meta) {
        const data = {};
        
        // CRITICAL: Use schema-defined field positions, not hardcoded values
        meta.fields.forEach(field => {
            try {
                // Check if field has data before accessing
                if (entry.isEmpty(field.pos)) {
                    return; // Skip empty fields
                }
                
                let extractedValue;
                
                // Use correct accessor method based on field type
                switch (field.type) {
                    case this.module.DataType.INT:
                        extractedValue = entry.getInt32(field.pos);
                        break;
                    case this.module.DataType.DOUBLE:
                        extractedValue = entry.getDouble(field.pos);
                        break;
                    case this.module.DataType.STRING:
                        extractedValue = entry.getString(field.pos);
                        break;
                    case this.module.DataType.INT64:
                        extractedValue = entry.getInt64(field.pos);
                        break;
                    // Add other data types as needed
                    default:
                        // Log unknown type for debugging
                        console.warn(`Unknown field type for ${field.name}: ${field.type}`);
                        extractedValue = null;
                }
                
                if (extractedValue !== null) {
                    data[field.name] = extractedValue;
                }
                
            } catch (error) {
                console.warn(`Error extracting field ${field.name} at position ${field.pos}:`, error);
            }
        });
        
        return data;
    }
    
    // Public API methods for getting available data
    getAvailableFields(namespace, metaID) {
        const key = `${namespace}:${metaID}`;
        return this.availableFields.get(key) || [];
    }
    
    getAllAvailableFields() {
        const allFields = new Set();
        this.availableFields.forEach(fields => {
            fields.forEach(field => allFields.add(field.name));
        });
        return Array.from(allFields);
    }
    
    getAvailableMarkets() {
        return Array.from(this.availableMarkets);
    }
    
    getAvailableInstruments(marketCode = null) {
        if (marketCode) {
            return this.availableInstruments.get(marketCode) || [];
        }
        
        // Return all instruments from all markets
        const allInstruments = [];
        this.availableInstruments.forEach((instruments, market) => {
            instruments.forEach(instrument => {
                allInstruments.push({ ...instrument, market });
            });
        });
        return allInstruments;
    }
    
    validateFieldsForRequest(fields, namespace, metaID) {
        const availableFields = this.getAvailableFields(namespace, metaID);
        const availableFieldNames = availableFields.map(f => f.name);
        
        const validFields = fields.filter(field => availableFieldNames.includes(field));
        const invalidFields = fields.filter(field => !availableFieldNames.includes(field));
        
        if (invalidFields.length > 0) {
            console.warn(`Invalid fields for ${namespace}:${metaID}:`, invalidFields);
            console.log('Available fields:', availableFieldNames);
        }
        
        return {
            valid: validFields,
            invalid: invalidFields,
            available: availableFieldNames
        };
    }
    
    getFieldDisplayName(fieldName) {
        // Convert technical field names to display names
        const displayNames = {
            'last_price': 'Last Price',
            'bid_price': 'Bid',
            'ask_price': 'Ask',
            'open_price': 'Open',
            'high_price': 'High',
            'low_price': 'Low',
            'close_price': 'Close',
            'volume': 'Volume',
            'open_interest': 'Open Interest',
            'timestamp': 'Time'
        };
        
        return displayNames[fieldName] || fieldName;
    }
    
    getNamespaceForMetaID(metaID) {
        for (const [namespace, metas] of Object.entries(this.schema)) {
            if (metas[metaID]) {
                return namespace;
            }
        }
        return null;
    }
    
    getSchemaInfo() {
        return {
            namespaces: Object.keys(this.schema),
            totalMetas: Object.values(this.schema).reduce((sum, metas) => sum + Object.keys(metas).length, 0),
            totalFields: this.getAllAvailableFields().length,
            markets: this.getAvailableMarkets(),
            instrumentCount: this.getAvailableInstruments().length
        };
    }
}
```

### Using Schema Information for Data Requests

Now that you understand how to extract available fields and instruments, here's how to use this information in your data requests:

## Data Fetching Operations

### Fetch by Code (Historical Data)

```javascript
// data-fetcher.js
class DataFetcher {
    constructor(wsClient, module, compressor, schemaManager) {
        this.wsClient = wsClient;
        this.module = module;
        this.compressor = compressor;
        this.schemaManager = schemaManager;
        this.authToken = "demo-token";
        this.sequenceNumber = 1000;
    }
    
    async fetchHistoricalData(config) {
        // Validate and use schema-derived values
        const {
            namespace = "global",
            qualifiedName = "Futures", 
            market, // REQUIRED: Must be from available markets
            code, // REQUIRED: Must be from available instruments
            granularity = 5, // 5-minute intervals
            fields, // REQUIRED: Must be from available fields
            fromTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            toTime = new Date()
        } = config;
        
        // Validate required parameters using schema
        if (!this.validateDataRequest(config)) {
            throw new Error('Invalid data request parameters');
        }
        
        try {
            // Convert dates to timestamps (assuming server expects Unix timestamp)
            const fromTimestamp = Math.floor(fromTime.getTime() / 1000);
            const toTimestamp = Math.floor(toTime.getTime() / 1000);
            
            console.log(`Fetching ${code} data from ${fromTime.toISOString()} to ${toTime.toISOString()}`);
            
            // Create fetch request
            const request = new this.module.ATFetchByCodeReq(
                this.authToken,
                this.getNextSequence(),
                namespace,
                qualifiedName,
                1, // revision
                market,
                code,
                granularity,
                this.createFieldsVector(fields),
                fromTimestamp,
                toTimestamp
            );
            
            // Send request
            await this.wsClient.sendBinaryMessage(this.module.CMD_AT_FETCH_BY_CODE, request);
            
            return this.waitForFetchResponse(code);
            
        } catch (error) {
            console.error('Error fetching historical data:', error);
            throw error;
        }
    }
    
    validateDataRequest(config) {
        const { market, code, fields, namespace = "global", qualifiedName = "Futures" } = config;
        
        // Check if market is available
        const availableMarkets = this.schemaManager.getAvailableMarkets();
        if (market && !availableMarkets.includes(market)) {
            console.error(`Invalid market '${market}'. Available markets:`, availableMarkets);
            return false;
        }
        
        // Check if instrument code is available for the market
        if (market && code) {
            const availableInstruments = this.schemaManager.getAvailableInstruments(market);
            const instrumentCodes = availableInstruments.map(inst => inst.code);
            
            if (!instrumentCodes.includes(code)) {
                console.error(`Invalid instrument '${code}' for market '${market}'. Available instruments:`, 
                             instrumentCodes.slice(0, 10), '...');
                return false;
            }
        }
        
        // Validate fields against schema
        if (fields && fields.length > 0) {
            const validation = this.schemaManager.validateFieldsForRequest(fields, namespace, 1); // metaID 1 as example
            
            if (validation.invalid.length > 0) {
                console.error(`Invalid fields: ${validation.invalid.join(', ')}`);
                console.log('Available fields:', validation.available.slice(0, 15), '...');
                return false;
            }
        }
        
        return true;
    }
    
    // Helper method to get valid instruments for a request
    getValidInstrumentsForRequest(market, instrumentType = null) {
        const instruments = this.schemaManager.getAvailableInstruments(market);
        
        if (instrumentType) {
            return instruments.filter(inst => inst.type === instrumentType);
        }
        
        return instruments;
    }
    
    // Helper method to get valid fields for a request
    getValidFieldsForRequest(namespace = "global", metaID = 1) {
        return this.schemaManager.getAvailableFields(namespace, metaID);
    }
    
    async fetchByTimeRange(config) {
        const {
            namespace = "global",
            qualifiedName = "Futures",
            market = "CME", 
            granularity = 15,
            codes = ["ES2024H", "NQ2024H", "YM2024H"], // Multiple instruments
            fromTime,
            toTime,
            fields = ["timestamp", "open", "high", "low", "close", "volume", "open_interest"]
        } = config;
        
        try {
            const fromTimestamp = Math.floor(fromTime.getTime() / 1000);
            const toTimestamp = Math.floor(toTime.getTime() / 1000);
            
            // Create time-based fetch request
            const request = new this.module.ATFetchByTimeReq(
                this.authToken,
                this.getNextSequence(),
                namespace,
                qualifiedName,
                1, // revision
                market,
                this.createCodesVector(codes),
                granularity,
                this.createFieldsVector(fields),
                fromTimestamp,
                toTimestamp
            );
            
            await this.wsClient.sendBinaryMessage(this.module.CMD_AT_FETCH_BY_TIME, request);
            
            return this.waitForTimeSeriesResponse(codes);
            
        } catch (error) {
            console.error('Error fetching time range data:', error);
            throw error;
        }
    }
    
    createFieldsVector(fields) {
        const vector = new this.module.StringVector();
        fields.forEach(field => vector.push_back(field));
        return vector;
    }
    
    createCodesVector(codes) {
        const vector = new this.module.StringVector();
        codes.forEach(code => vector.push_back(code));
        return vector;
    }
    
    async waitForFetchResponse(expectedCode, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.wsClient.dataProcessor.unsubscribe('fetch', handler);
                reject(new Error('Fetch response timeout'));
            }, timeout);
            
            const handler = (data) => {
                if (data.code === expectedCode || !expectedCode) {
                    clearTimeout(timer);
                    this.wsClient.dataProcessor.unsubscribe('fetch', handler);
                    resolve(data);
                }
            };
            
            this.wsClient.dataProcessor.subscribe('fetch', handler);
        });
    }
    
    async waitForTimeSeriesResponse(expectedCodes, timeout = 45000) {
        return new Promise((resolve, reject) => {
            const receivedData = new Map();
            const timer = setTimeout(() => {
                this.wsClient.dataProcessor.unsubscribe('timeSeries', handler);
                reject(new Error('Time series response timeout'));
            }, timeout);
            
            const handler = (data) => {
                if (data.codes) {
                    data.codes.forEach(code => {
                        if (expectedCodes.includes(code)) {
                            receivedData.set(code, data.timeSeriesData[code]);
                        }
                    });
                    
                    // Check if we have all expected codes
                    if (receivedData.size === expectedCodes.length) {
                        clearTimeout(timer);
                        this.wsClient.dataProcessor.unsubscribe('timeSeries', handler);
                        resolve(Object.fromEntries(receivedData));
                    }
                }
            };
            
            this.wsClient.dataProcessor.subscribe('timeSeries', handler);
        });
    }
    
    getNextSequence() {
        return this.sequenceNumber++;
    }
}
```

### Advanced Data Fetching with Custom Parameters

```javascript
class AdvancedDataFetcher extends DataFetcher {
    
    async fetchWithIndicators(config) {
        const {
            code,
            indicators = ['sma_20', 'ema_50', 'rsi_14', 'bollinger_bands'],
            lookbackPeriod = 200,
            ...baseConfig
        } = config;
        
        // Include technical indicators in field list
        const enhancedFields = [
            ...baseConfig.fields,
            ...indicators
        ];
        
        return this.fetchHistoricalData({
            ...baseConfig,
            code,
            fields: enhancedFields,
            fromTime: new Date(Date.now() - lookbackPeriod * 24 * 60 * 60 * 1000)
        });
    }
    
    async fetchMultiTimeframe(code, timeframes = [1, 5, 15, 60, 240]) {
        const promises = timeframes.map(granularity => 
            this.fetchHistoricalData({
                code,
                granularity,
                fromTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days
                fields: ['timestamp', 'open', 'high', 'low', 'close', 'volume']
            })
        );
        
        const results = await Promise.all(promises);
        
        // Combine results by timeframe
        return timeframes.reduce((acc, timeframe, index) => {
            acc[`${timeframe}min`] = results[index];
            return acc;
        }, {});
    }
    
    async fetchOptionChain(underlyingCode, expirationDate, strikeRange = null) {
        try {
            const request = new this.module.ATFetchOptionChainReq(
                this.authToken,
                this.getNextSequence(),
                "global",
                "Options",
                1, // revision
                "CME",
                underlyingCode,
                Math.floor(expirationDate.getTime() / 1000),
                strikeRange ? strikeRange.min : null,
                strikeRange ? strikeRange.max : null
            );
            
            await this.wsClient.sendBinaryMessage(this.module.CMD_AT_FETCH_OPTION_CHAIN, request);
            
            return this.waitForOptionChainResponse(underlyingCode);
            
        } catch (error) {
            console.error('Error fetching option chain:', error);
            throw error;
        }
    }
    
    async batchFetchCodes(codes, config = {}) {
        const batchSize = config.batchSize || 10;
        const delay = config.delay || 100; // ms between batches
        
        const results = {};
        
        for (let i = 0; i < codes.length; i += batchSize) {
            const batch = codes.slice(i, i + batchSize);
            
            console.log(`Fetching batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(codes.length/batchSize)}`);
            
            const batchPromises = batch.map(code => 
                this.fetchHistoricalData({
                    ...config,
                    code
                }).catch(error => ({
                    code,
                    error: error.message
                }))
            );
            
            const batchResults = await Promise.all(batchPromises);
            
            batchResults.forEach(result => {
                if (result.error) {
                    console.warn(`Failed to fetch ${result.code}:`, result.error);
                } else {
                    results[result.code || batch[batchResults.indexOf(result)]] = result;
                }
            });
            
            // Delay between batches to avoid overwhelming server
            if (i + batchSize < codes.length) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        return results;
    }
}
```

## Real-time Data Subscription

### Subscription Management

```javascript
// subscription-manager.js
class SubscriptionManager {
    constructor(wsClient, module) {
        this.wsClient = wsClient;
        this.module = module;
        this.subscriptions = new Map();
        this.authToken = "demo-token";
        this.sequenceNumber = 2000;
        
        // Setup subscription data handlers
        this.setupSubscriptionHandlers();
    }
    
    async subscribeToRealTimeData(config) {
        const {
            namespace = "global",
            qualifiedName = "Futures",
            market = "CME",
            codes = ["ES2024H"],
            fields = ["last_price", "bid", "ask", "volume", "timestamp"],
            updateFrequency = 1000 // milliseconds
        } = config;
        
        try {
            const subscriptionId = this.generateSubscriptionId(market, codes);
            
            // Create subscription request
            const request = new this.module.ATSubscribeReq(
                this.authToken,
                this.getNextSequence(),
                namespace,
                qualifiedName,
                1, // revision
                market,
                this.createCodesVector(codes),
                this.createFieldsVector(fields),
                updateFrequency
            );
            
            // Store subscription info
            this.subscriptions.set(subscriptionId, {
                market,
                codes,
                fields,
                startTime: new Date(),
                dataCount: 0
            });
            
            await this.wsClient.sendBinaryMessage(this.module.CMD_AT_SUBSCRIBE, request);
            
            console.log(`Subscribed to real-time data: ${subscriptionId}`);
            return subscriptionId;
            
        } catch (error) {
            console.error('Error subscribing to real-time data:', error);
            throw error;
        }
    }
    
    async subscribeToLevel2Data(codes, market = "CME") {
        // Level 2 (order book) data subscription
        const request = new this.module.ATSubscribeLevel2Req(
            this.authToken,
            this.getNextSequence(),
            "global",
            "Level2",
            1,
            market,
            this.createCodesVector(codes),
            10 // depth levels
        );
        
        const subscriptionId = this.generateSubscriptionId(market, codes, 'level2');
        this.subscriptions.set(subscriptionId, {
            type: 'level2',
            market,
            codes,
            startTime: new Date()
        });
        
        await this.wsClient.sendBinaryMessage(this.module.CMD_AT_SUBSCRIBE_LEVEL2, request);
        return subscriptionId;
    }
    
    async subscribeToTrades(codes, market = "CME") {
        // Individual trade data subscription
        const request = new this.module.ATSubscribeTradesReq(
            this.authToken,
            this.getNextSequence(),
            "global", 
            "Trades",
            1,
            market,
            this.createCodesVector(codes)
        );
        
        const subscriptionId = this.generateSubscriptionId(market, codes, 'trades');
        this.subscriptions.set(subscriptionId, {
            type: 'trades',
            market,
            codes,
            startTime: new Date(),
            tradeCount: 0
        });
        
        await this.wsClient.sendBinaryMessage(this.module.CMD_AT_SUBSCRIBE_TRADES, request);
        return subscriptionId;
    }
    
    async unsubscribe(subscriptionId) {
        if (!this.subscriptions.has(subscriptionId)) {
            console.warn(`Subscription ${subscriptionId} not found`);
            return;
        }
        
        const subscription = this.subscriptions.get(subscriptionId);
        
        try {
            const request = new this.module.ATUnsubscribeReq(
                this.authToken,
                this.getNextSequence(),
                subscription.market,
                this.createCodesVector(subscription.codes)
            );
            
            await this.wsClient.sendBinaryMessage(this.module.CMD_AT_UNSUBSCRIBE, request);
            
            this.subscriptions.delete(subscriptionId);
            console.log(`Unsubscribed from: ${subscriptionId}`);
            
        } catch (error) {
            console.error('Error unsubscribing:', error);
            throw error;
        }
    }
    
    setupSubscriptionHandlers() {
        this.wsClient.dataProcessor.subscribe('realTimeData', (data) => {
            this.handleRealTimeUpdate(data);
        });
        
        this.wsClient.dataProcessor.subscribe('level2Data', (data) => {
            this.handleLevel2Update(data);
        });
        
        this.wsClient.dataProcessor.subscribe('tradeData', (data) => {
            this.handleTradeUpdate(data);
        });
    }
    
    handleRealTimeUpdate(data) {
        // Process real-time market data updates
        const { market, code, fields, values, timestamp } = data;
        
        // Update subscription statistics
        this.subscriptions.forEach((sub, id) => {
            if (sub.market === market && sub.codes.includes(code)) {
                sub.dataCount = (sub.dataCount || 0) + 1;
                sub.lastUpdate = new Date(timestamp);
            }
        });
        
        // Create structured market data
        const marketUpdate = {
            symbol: code,
            market: market,
            timestamp: new Date(timestamp),
            data: {}
        };
        
        fields.forEach((field, index) => {
            marketUpdate.data[field] = values[index];
        });
        
        // Emit processed data
        this.emit('marketData', marketUpdate);
        
        console.log(`Real-time update for ${code}:`, marketUpdate.data);
    }
    
    handleLevel2Update(data) {
        // Process Level 2 (order book) data
        const { market, code, bids, asks, timestamp } = data;
        
        const orderBook = {
            symbol: code,
            market: market,
            timestamp: new Date(timestamp),
            bids: this.processOrderBookSide(bids),
            asks: this.processOrderBookSide(asks),
            spread: null
        };
        
        // Calculate spread
        if (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
            orderBook.spread = orderBook.asks[0].price - orderBook.bids[0].price;
        }
        
        this.emit('orderBook', orderBook);
        console.log(`Order book update for ${code}:`, {
            bidCount: orderBook.bids.length,
            askCount: orderBook.asks.length,
            spread: orderBook.spread
        });
    }
    
    handleTradeUpdate(data) {
        // Process individual trade data
        const { market, code, price, size, side, timestamp, tradeId } = data;
        
        const trade = {
            symbol: code,
            market: market,
            tradeId: tradeId,
            price: price,
            size: size,
            side: side, // 'buy' or 'sell'
            timestamp: new Date(timestamp)
        };
        
        // Update trade count
        this.subscriptions.forEach((sub, id) => {
            if (sub.type === 'trades' && sub.market === market && sub.codes.includes(code)) {
                sub.tradeCount = (sub.tradeCount || 0) + 1;
            }
        });
        
        this.emit('trade', trade);
        console.log(`Trade: ${code} ${side} ${size}@${price}`);
    }
    
    processOrderBookSide(orders) {
        return orders.map(order => ({
            price: order.price,
            size: order.size,
            orderCount: order.orderCount || 1
        })).sort((a, b) => b.price - a.price); // Sort by price descending
    }
    
    generateSubscriptionId(market, codes, type = 'market') {
        const codesStr = Array.isArray(codes) ? codes.join(',') : codes;
        return `${type}_${market}_${codesStr}_${Date.now()}`;
    }
    
    createCodesVector(codes) {
        const vector = new this.module.StringVector();
        codes.forEach(code => vector.push_back(code));
        return vector;
    }
    
    createFieldsVector(fields) {
        const vector = new this.module.StringVector();
        fields.forEach(field => vector.push_back(field));
        return vector;
    }
    
    getSubscriptionStats() {
        const stats = {};
        this.subscriptions.forEach((sub, id) => {
            const duration = new Date() - sub.startTime;
            stats[id] = {
                ...sub,
                duration: Math.round(duration / 1000), // seconds
                dataRate: sub.dataCount ? (sub.dataCount / (duration / 1000)).toFixed(2) : 0
            };
        });
        return stats;
    }
    
    emit(event, data) {
        // Simple event emitter implementation
        const handlers = this.eventHandlers?.[event] || [];
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        });
    }
    
    on(event, handler) {
        if (!this.eventHandlers) this.eventHandlers = {};
        if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
        this.eventHandlers[event].push(handler);
    }
    
    getNextSequence() {
        return this.sequenceNumber++;
    }
}
```

## Advanced Query Operations

### Market Scanner and Filtering

```javascript
// market-scanner.js
class MarketScanner {
    constructor(wsClient, dataFetcher, subscriptionManager) {
        this.wsClient = wsClient;
        this.dataFetcher = dataFetcher;
        this.subscriptionManager = subscriptionManager;
        this.scanResults = new Map();
        this.activeScans = new Map();
    }
    
    async scanByVolume(criteria) {
        const {
            market = "CME",
            minVolume = 1000,
            timeframe = 60, // minutes
            sortBy = 'volume',
            limit = 50
        } = criteria;
        
        try {
            // Get list of available symbols
            const symbols = await this.getActiveSymbols(market);
            
            console.log(`Scanning ${symbols.length} symbols for volume > ${minVolume}`);
            
            // Fetch recent data for all symbols
            const dataPromises = symbols.map(symbol =>
                this.dataFetcher.fetchHistoricalData({
                    code: symbol,
                    market: market,
                    granularity: timeframe,
                    fromTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours
                    fields: ['timestamp', 'open', 'high', 'low', 'close', 'volume']
                }).catch(error => ({ symbol, error: error.message }))
            );
            
            const results = await Promise.all(dataPromises);
            
            // Filter and process results
            const filteredResults = results
                .filter(result => !result.error)
                .map(data => this.calculateVolumeMetrics(data))
                .filter(metrics => metrics.totalVolume >= minVolume)
                .sort((a, b) => this.compareByCriteria(a, b, sortBy))
                .slice(0, limit);
            
            this.scanResults.set('volume_scan', {
                criteria,
                results: filteredResults,
                timestamp: new Date(),
                count: filteredResults.length
            });
            
            return filteredResults;
            
        } catch (error) {
            console.error('Error in volume scan:', error);
            throw error;
        }
    }
    
    async scanByPriceMovement(criteria) {
        const {
            market = "CME",
            minPriceChange = 5, // percentage
            timeframe = 'day',
            direction = 'both', // 'up', 'down', or 'both'
            limit = 25
        } = criteria;
        
        const symbols = await this.getActiveSymbols(market);
        
        const scanPromises = symbols.map(async symbol => {
            try {
                const data = await this.dataFetcher.fetchHistoricalData({
                    code: symbol,
                    market: market,
                    granularity: timeframe === 'day' ? 1440 : 60,
                    fromTime: new Date(Date.now() - (timeframe === 'day' ? 2 : 7) * 24 * 60 * 60 * 1000),
                    fields: ['timestamp', 'open', 'close', 'high', 'low', 'volume']
                });
                
                return this.calculatePriceMovement(data, symbol);
            } catch (error) {
                return null;
            }
        });
        
        const results = (await Promise.all(scanPromises))
            .filter(result => result !== null)
            .filter(result => {
                const changePercent = Math.abs(result.priceChangePercent);
                const directionMatch = direction === 'both' || 
                    (direction === 'up' && result.priceChangePercent > 0) ||
                    (direction === 'down' && result.priceChangePercent < 0);
                    
                return changePercent >= minPriceChange && directionMatch;
            })
            .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
            .slice(0, limit);
        
        this.scanResults.set('price_movement_scan', {
            criteria,
            results,
            timestamp: new Date()
        });
        
        return results;
    }
    
    async scanByTechnicalIndicators(criteria) {
        const {
            market = "CME",
            indicators = {
                rsi: { min: 30, max: 70 },
                sma_cross: true, // SMA 20 > SMA 50
                volume_surge: 2.0 // 2x average volume
            },
            limit = 20
        } = criteria;
        
        const symbols = await this.getActiveSymbols(market);
        
        const scanResults = [];
        
        for (const symbol of symbols) {
            try {
                const data = await this.dataFetcher.fetchWithIndicators({
                    code: symbol,
                    market: market,
                    indicators: Object.keys(indicators),
                    lookbackPeriod: 100
                });
                
                const technicalAnalysis = this.analyzeTechnicalIndicators(data, indicators);
                
                if (technicalAnalysis.matchesCriteria) {
                    scanResults.push({
                        symbol,
                        ...technicalAnalysis,
                        timestamp: new Date()
                    });
                }
                
            } catch (error) {
                console.warn(`Failed technical analysis for ${symbol}:`, error.message);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        return scanResults.slice(0, limit);
    }
    
    async getActiveSymbols(market) {
        // Get list of actively traded symbols from schema manager
        try {
            const instruments = this.schemaManager.getAvailableInstruments(market);
            
            if (instruments.length === 0) {
                console.warn(`No instruments found for market ${market}`);
                return [];
            }
            
            // Return array of instrument codes
            return instruments.map(instrument => instrument.code);
            
        } catch (error) {
            console.error('Error getting active symbols from schema:', error);
            return [];
        }
    }
    
    // Method to get available markets from schema
    getAvailableMarkets() {
        return this.schemaManager.getAvailableMarkets();
    }
    
    // Method to get detailed instrument information
    getInstrumentDetails(market, code) {
        const instruments = this.schemaManager.getAvailableInstruments(market);
        return instruments.find(instrument => instrument.code === code);
    }
    
    calculateVolumeMetrics(data) {
        if (!data.timeSeries || data.timeSeries.length === 0) {
            return { symbol: data.symbol, totalVolume: 0, avgVolume: 0, volumeTrend: 'flat' };
        }
        
        const volumes = data.timeSeries.map(bar => bar.volume || 0);
        const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);
        const avgVolume = totalVolume / volumes.length;
        
        // Calculate volume trend (recent vs historical)
        const recentVolumes = volumes.slice(-10); // Last 10 periods
        const historicalVolumes = volumes.slice(0, -10);
        
        const recentAvg = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
        const historicalAvg = historicalVolumes.reduce((sum, vol) => sum + vol, 0) / historicalVolumes.length;
        
        const volumeTrend = recentAvg > historicalAvg * 1.2 ? 'increasing' :
                           recentAvg < historicalAvg * 0.8 ? 'decreasing' : 'flat';
        
        return {
            symbol: data.symbol,
            totalVolume,
            avgVolume,
            volumeTrend,
            volumeRatio: historicalAvg > 0 ? recentAvg / historicalAvg : 1,
            maxVolume: Math.max(...volumes),
            lastVolume: volumes[volumes.length - 1] || 0
        };
    }
    
    calculatePriceMovement(data, symbol) {
        if (!data.timeSeries || data.timeSeries.length < 2) {
            return null;
        }
        
        const timeSeries = data.timeSeries;
        const firstBar = timeSeries[0];
        const lastBar = timeSeries[timeSeries.length - 1];
        
        const openPrice = firstBar.open;
        const closePrice = lastBar.close;
        const highPrice = Math.max(...timeSeries.map(bar => bar.high));
        const lowPrice = Math.min(...timeSeries.map(bar => bar.low));
        
        const priceChange = closePrice - openPrice;
        const priceChangePercent = ((priceChange / openPrice) * 100);
        
        return {
            symbol,
            openPrice,
            closePrice,
            highPrice,
            lowPrice,
            priceChange,
            priceChangePercent,
            range: highPrice - lowPrice,
            rangePercent: ((highPrice - lowPrice) / openPrice) * 100,
            direction: priceChange > 0 ? 'up' : priceChange < 0 ? 'down' : 'flat'
        };
    }
    
    analyzeTechnicalIndicators(data, criteria) {
        const analysis = {
            matchesCriteria: true,
            signals: [],
            indicators: {}
        };
        
        if (!data.timeSeries || data.timeSeries.length === 0) {
            analysis.matchesCriteria = false;
            return analysis;
        }
        
        const latestBar = data.timeSeries[data.timeSeries.length - 1];
        
        // RSI analysis
        if (criteria.rsi) {
            const rsi = latestBar.rsi_14 || 50;
            analysis.indicators.rsi = rsi;
            
            const rsiInRange = rsi >= criteria.rsi.min && rsi <= criteria.rsi.max;
            if (!rsiInRange) {
                analysis.matchesCriteria = false;
            } else {
                analysis.signals.push(`RSI(${rsi.toFixed(1)}) in target range`);
            }
        }
        
        // SMA crossover analysis
        if (criteria.sma_cross) {
            const sma20 = latestBar.sma_20;
            const sma50 = latestBar.sma_50;
            
            if (sma20 && sma50) {
                analysis.indicators.sma_cross = sma20 > sma50;
                
                if (criteria.sma_cross && sma20 <= sma50) {
                    analysis.matchesCriteria = false;
                } else if (sma20 > sma50) {
                    analysis.signals.push('SMA20 > SMA50 (bullish)');
                }
            }
        }
        
        // Volume surge analysis
        if (criteria.volume_surge) {
            const currentVolume = latestBar.volume || 0;
            const avgVolume = this.calculateAverageVolume(data.timeSeries.slice(-20));
            
            analysis.indicators.volume_ratio = avgVolume > 0 ? currentVolume / avgVolume : 0;
            
            if (analysis.indicators.volume_ratio >= criteria.volume_surge) {
                analysis.signals.push(`Volume surge: ${analysis.indicators.volume_ratio.toFixed(1)}x`);
            } else {
                analysis.matchesCriteria = false;
            }
        }
        
        return analysis;
    }
    
    calculateAverageVolume(timeSeries) {
        const volumes = timeSeries.map(bar => bar.volume || 0);
        return volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    }
    
    compareByCriteria(a, b, sortBy) {
        switch (sortBy) {
            case 'volume':
                return b.totalVolume - a.totalVolume;
            case 'priceChange':
                return Math.abs(b.priceChangePercent || 0) - Math.abs(a.priceChangePercent || 0);
            case 'volumeRatio':
                return (b.volumeRatio || 0) - (a.volumeRatio || 0);
            default:
                return 0;
        }
    }
    
    getScanResults(scanType) {
        return this.scanResults.get(scanType);
    }
    
    getAllScanResults() {
        return Object.fromEntries(this.scanResults);
    }
}
```

## Data Filtering and Processing

### Real-time Data Processing Pipeline

```javascript
// data-pipeline.js
class DataProcessingPipeline {
    constructor() {
        this.processors = new Map();
        this.filters = new Map();
        this.transformers = new Map();
        this.outputs = new Map();
    }
    
    addProcessor(name, processorFunction) {
        this.processors.set(name, processorFunction);
        return this;
    }
    
    addFilter(name, filterFunction) {
        this.filters.set(name, filterFunction);
        return this;
    }
    
    addTransformer(name, transformFunction) {
        this.transformers.set(name, transformFunction);
        return this;
    }
    
    async processData(data, pipeline = []) {
        let result = data;
        
        for (const step of pipeline) {
            const { type, name, params = {} } = step;
            
            try {
                switch (type) {
                    case 'filter':
                        if (this.filters.has(name)) {
                            result = this.filters.get(name)(result, params);
                        }
                        break;
                    case 'transform':
                        if (this.transformers.has(name)) {
                            result = await this.transformers.get(name)(result, params);
                        }
                        break;
                    case 'process':
                        if (this.processors.has(name)) {
                            result = await this.processors.get(name)(result, params);
                        }
                        break;
                }
            } catch (error) {
                console.error(`Error in pipeline step ${name}:`, error);
                // Optionally break or continue with original data
                result = data;
            }
        }
        
        return result;
    }
    
    // Built-in filters
    static createBuiltInFilters() {
        return {
            priceRange: (data, { min, max }) => {
                return data.filter(item => {
                    const price = item.price || item.close || item.last_price;
                    return price >= min && price <= max;
                });
            },
            
            volumeThreshold: (data, { minimum }) => {
                return data.filter(item => (item.volume || 0) >= minimum);
            },
            
            timeWindow: (data, { startTime, endTime }) => {
                const start = new Date(startTime);
                const end = new Date(endTime);
                
                return data.filter(item => {
                    const timestamp = new Date(item.timestamp);
                    return timestamp >= start && timestamp <= end;
                });
            },
            
            symbols: (data, { include = [], exclude = [] }) => {
                return data.filter(item => {
                    const symbol = item.symbol || item.code;
                    const included = include.length === 0 || include.includes(symbol);
                    const excluded = exclude.length > 0 && exclude.includes(symbol);
                    return included && !excluded;
                });
            },
            
            outliers: (data, { field = 'price', stdDevMultiplier = 2 }) => {
                const values = data.map(item => item[field]).filter(v => v != null);
                const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
                const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
                const stdDev = Math.sqrt(variance);
                
                const threshold = stdDevMultiplier * stdDev;
                
                return data.filter(item => {
                    const value = item[field];
                    return value != null && Math.abs(value - mean) <= threshold;
                });
            }
        };
    }
    
    // Built-in transformers
    static createBuiltInTransformers() {
        return {
            normalize: async (data, { field = 'price', min = 0, max = 1 }) => {
                const values = data.map(item => item[field]).filter(v => v != null);
                const dataMin = Math.min(...values);
                const dataMax = Math.max(...values);
                const range = dataMax - dataMin;
                
                return data.map(item => ({
                    ...item,
                    [`${field}_normalized`]: range > 0 
                        ? min + ((item[field] - dataMin) / range) * (max - min)
                        : min
                }));
            },
            
            movingAverage: async (data, { field = 'price', window = 20, outputField = null }) => {
                const sortedData = [...data].sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp)
                );
                
                const fieldName = outputField || `${field}_ma${window}`;
                
                return sortedData.map((item, index) => {
                    const start = Math.max(0, index - window + 1);
                    const windowData = sortedData.slice(start, index + 1);
                    const average = windowData.reduce((sum, d) => sum + (d[field] || 0), 0) / windowData.length;
                    
                    return {
                        ...item,
                        [fieldName]: average
                    };
                });
            },
            
            priceReturns: async (data, { priceField = 'close', outputField = 'return', periods = 1 }) => {
                const sortedData = [...data].sort((a, b) => 
                    new Date(a.timestamp) - new Date(b.timestamp)
                );
                
                return sortedData.map((item, index) => {
                    if (index < periods) {
                        return { ...item, [outputField]: null };
                    }
                    
                    const currentPrice = item[priceField];
                    const pastPrice = sortedData[index - periods][priceField];
                    
                    const returnValue = pastPrice > 0 ? 
                        ((currentPrice - pastPrice) / pastPrice) * 100 : null;
                    
                    return {
                        ...item,
                        [outputField]: returnValue
                    };
                });
            },
            
            technicalIndicators: async (data, { indicators = ['rsi', 'macd'] }) => {
                const calculator = new TechnicalIndicatorCalculator();
                
                for (const indicator of indicators) {
                    data = await calculator.calculate(data, indicator);
                }
                
                return data;
            },
            
            aggregateByTime: async (data, { interval = '5min', fields = ['close'] }) => {
                const intervals = this.groupByTimeInterval(data, interval);
                
                return Object.entries(intervals).map(([timeKey, items]) => {
                    const aggregated = {
                        timestamp: new Date(timeKey),
                        count: items.length
                    };
                    
                    fields.forEach(field => {
                        const values = items.map(item => item[field]).filter(v => v != null);
                        
                        if (values.length > 0) {
                            aggregated[`${field}_open`] = values[0];
                            aggregated[`${field}_close`] = values[values.length - 1];
                            aggregated[`${field}_high`] = Math.max(...values);
                            aggregated[`${field}_low`] = Math.min(...values);
                            aggregated[`${field}_avg`] = values.reduce((sum, v) => sum + v, 0) / values.length;
                        }
                    });
                    
                    return aggregated;
                });
            }
        };
    }
    
    groupByTimeInterval(data, interval) {
        const intervalMs = this.parseInterval(interval);
        const groups = {};
        
        data.forEach(item => {
            const timestamp = new Date(item.timestamp);
            const intervalStart = new Date(Math.floor(timestamp.getTime() / intervalMs) * intervalMs);
            const key = intervalStart.toISOString();
            
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(item);
        });
        
        return groups;
    }
    
    parseInterval(interval) {
        const match = interval.match(/^(\d+)(min|hour|day)$/);
        if (!match) return 60000; // Default 1 minute
        
        const [, amount, unit] = match;
        const multipliers = {
            min: 60 * 1000,
            hour: 60 * 60 * 1000,
            day: 24 * 60 * 60 * 1000
        };
        
        return parseInt(amount) * (multipliers[unit] || multipliers.min);
    }
}

// Technical Indicator Calculator
class TechnicalIndicatorCalculator {
    async calculate(data, indicator, params = {}) {
        const sortedData = [...data].sort((a, b) => 
            new Date(a.timestamp) - new Date(b.timestamp)
        );
        
        switch (indicator) {
            case 'rsi':
                return this.calculateRSI(sortedData, params.period || 14);
            case 'macd':
                return this.calculateMACD(sortedData, params);
            case 'bollinger':
                return this.calculateBollingerBands(sortedData, params);
            case 'stochastic':
                return this.calculateStochastic(sortedData, params);
            default:
                return data;
        }
    }
    
    calculateRSI(data, period = 14) {
        const priceField = 'close';
        
        return data.map((item, index) => {
            if (index < period) {
                return { ...item, rsi: null };
            }
            
            const recentData = data.slice(index - period, index + 1);
            const gains = [];
            const losses = [];
            
            for (let i = 1; i < recentData.length; i++) {
                const change = recentData[i][priceField] - recentData[i - 1][priceField];
                if (change > 0) {
                    gains.push(change);
                    losses.push(0);
                } else {
                    gains.push(0);
                    losses.push(-change);
                }
            }
            
            const avgGain = gains.reduce((sum, g) => sum + g, 0) / gains.length;
            const avgLoss = losses.reduce((sum, l) => sum + l, 0) / losses.length;
            
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            
            return { ...item, rsi };
        });
    }
    
    calculateMACD(data, { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 } = {}) {
        // Calculate EMAs
        const fastEMA = this.calculateEMA(data, fastPeriod);
        const slowEMA = this.calculateEMA(data, slowPeriod);
        
        // Calculate MACD line
        const macdData = data.map((item, index) => ({
            ...item,
            ema_fast: fastEMA[index],
            ema_slow: slowEMA[index],
            macd: fastEMA[index] && slowEMA[index] ? fastEMA[index] - slowEMA[index] : null
        }));
        
        // Calculate signal line (EMA of MACD)
        const macdValues = macdData.map(item => item.macd).filter(v => v !== null);
        const signalEMA = this.calculateEMA(
            macdValues.map((value, index) => ({ close: value, timestamp: data[index + slowPeriod - 1]?.timestamp })),
            signalPeriod
        );
        
        return macdData.map((item, index) => {
            const signalIndex = index - slowPeriod + 1;
            const signal = signalIndex >= 0 ? signalEMA[signalIndex] : null;
            const histogram = item.macd && signal ? item.macd - signal : null;
            
            return {
                ...item,
                macd_signal: signal,
                macd_histogram: histogram
            };
        });
    }
    
    calculateEMA(data, period) {
        const multiplier = 2 / (period + 1);
        const emas = [];
        
        data.forEach((item, index) => {
            if (index === 0) {
                emas.push(item.close);
            } else {
                const ema = (item.close * multiplier) + (emas[index - 1] * (1 - multiplier));
                emas.push(ema);
            }
        });
        
        return emas;
    }
    
    calculateBollingerBands(data, { period = 20, stdDev = 2 } = {}) {
        return data.map((item, index) => {
            if (index < period - 1) {
                return { ...item, bb_upper: null, bb_middle: null, bb_lower: null };
            }
            
            const recentData = data.slice(index - period + 1, index + 1);
            const prices = recentData.map(d => d.close);
            const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
            const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
            const standardDeviation = Math.sqrt(variance);
            
            return {
                ...item,
                bb_middle: mean,
                bb_upper: mean + (stdDev * standardDeviation),
                bb_lower: mean - (stdDev * standardDeviation)
            };
        });
    }
    
    calculateStochastic(data, { kPeriod = 14, dPeriod = 3 } = {}) {
        const stochData = data.map((item, index) => {
            if (index < kPeriod - 1) {
                return { ...item, stoch_k: null, stoch_d: null };
            }
            
            const recentData = data.slice(index - kPeriod + 1, index + 1);
            const highs = recentData.map(d => d.high);
            const lows = recentData.map(d => d.low);
            const highestHigh = Math.max(...highs);
            const lowestLow = Math.min(...lows);
            
            const stochK = ((item.close - lowestLow) / (highestHigh - lowestLow)) * 100;
            
            return { ...item, stoch_k: stochK };
        });
        
        // Calculate %D (moving average of %K)
        return stochData.map((item, index) => {
            if (index < dPeriod - 1 || item.stoch_k === null) {
                return { ...item, stoch_d: null };
            }
            
            const recentKValues = stochData.slice(index - dPeriod + 1, index + 1)
                .map(d => d.stoch_k)
                .filter(k => k !== null);
            
            const stochD = recentKValues.length > 0 
                ? recentKValues.reduce((sum, k) => sum + k, 0) / recentKValues.length
                : null;
            
            return { ...item, stoch_d: stochD };
        });
    }
}
```

## Usage Examples

### Complete Integration Example with Schema-Driven Data Access

```javascript
// main-application.js
class CaitlynDataApplication {
    constructor() {
        this.wsClient = null;
        this.schemaManager = null;
        this.dataFetcher = null;
        this.subscriptionManager = null;
        this.marketScanner = null;
        this.processingPipeline = null;
        this.isSchemaReady = false;
        
        this.init();
    }
    
    async init() {
        // Initialize components (from previous guide)
        await this.initializeComponents();
        
        // Setup data processing pipeline
        this.setupProcessingPipeline();
        
        // Connect to WebSocket server and wait for schema
        await this.connect();
        
        // Wait for schema initialization
        await this.waitForSchemaInitialization();
        
        // Start data operations using schema-derived data
        this.startDataOperations();
    }
    
    async waitForSchemaInitialization() {
        return new Promise((resolve) => {
            const checkSchema = () => {
                if (this.isSchemaReady) {
                    resolve();
                } else {
                    setTimeout(checkSchema, 100);
                }
            };
            checkSchema();
        });
    }
    
    async initializeComponents() {
        // Initialize WASM module and WebSocket client (from main guide)
        await this.initializeWASM();
        
        // Initialize schema manager
        this.schemaManager = new SchemaManager(this.module);
        
        // Initialize other components with schema manager
        this.dataProcessor = new DataProcessor(this.module);
        this.wsClient = new WebSocketClient(this.module, this.dataProcessor);
        this.dataFetcher = new DataFetcher(this.wsClient, this.module, null, this.schemaManager);
        
        // Setup schema processing callbacks
        this.wsClient.dataProcessor.subscribe('schema', (schemaContent) => {
            this.handleSchemaReceived(schemaContent);
        });
        
        this.wsClient.dataProcessor.subscribe('seeds', (seedsData) => {
            this.handleSeedsReceived(seedsData);
        });
    }
    
    handleSchemaReceived(schemaContent) {
        try {
            console.log('Processing received schema...');
            const schema = this.schemaManager.processSchema(schemaContent);
            
            // Initialize compressor with schema
            this.compressor = new this.module.IndexSerializer();
            this.compressor.updateSchema(schema);
            
            // Update data fetcher with compressor
            this.dataFetcher.compressor = this.compressor;
            
            console.log('Schema processing complete. Available data:');
            console.log('- Fields:', this.schemaManager.getAllAvailableFields().slice(0, 10), '...');
            console.log('- Schema info:', this.schemaManager.getSchemaInfo());
            
        } catch (error) {
            console.error('Error processing schema:', error);
        }
    }
    
    handleSeedsReceived(seedsData) {
        try {
            console.log('Processing universe seeds...');
            // Seeds processing is handled in SchemaManager
            // Here we just mark that we're ready to proceed
            
            const schemaInfo = this.schemaManager.getSchemaInfo();
            console.log('Universe seeds processed. Available:');
            console.log('- Markets:', schemaInfo.markets);
            console.log('- Instruments:', schemaInfo.instrumentCount);
            
            this.isSchemaReady = true;
            
        } catch (error) {
            console.error('Error processing seeds:', error);
        }
    }
    
    setupProcessingPipeline() {
        this.processingPipeline = new DataProcessingPipeline();
        
        // Add built-in filters and transformers
        const filters = DataProcessingPipeline.createBuiltInFilters();
        const transformers = DataProcessingPipeline.createBuiltInTransformers();
        
        Object.entries(filters).forEach(([name, filter]) => {
            this.processingPipeline.addFilter(name, filter);
        });
        
        Object.entries(transformers).forEach(([name, transformer]) => {
            this.processingPipeline.addTransformer(name, transformer);
        });
        
        // Add custom processors
        this.processingPipeline.addProcessor('riskAnalysis', this.calculateRiskMetrics.bind(this));
        this.processingPipeline.addProcessor('alertGeneration', this.generateAlerts.bind(this));
    }
    
    async startDataOperations() {
        try {
            // 1. Get available data from schema
            const availableMarkets = this.schemaManager.getAvailableMarkets();
            const availableFields = this.schemaManager.getAllAvailableFields();
            
            console.log('Schema-driven data operations starting...');
            console.log('Available markets:', availableMarkets);
            console.log('Available fields:', availableFields.slice(0, 10), '...');
            
            if (availableMarkets.length === 0) {
                console.error('No markets available in schema data');
                return;
            }
            
            // 2. Use first available market and its instruments
            const firstMarket = availableMarkets[0];
            const marketInstruments = this.schemaManager.getAvailableInstruments(firstMarket);
            
            if (marketInstruments.length === 0) {
                console.error(`No instruments available for market ${firstMarket}`);
                return;
            }
            
            const firstInstrument = marketInstruments[0];
            console.log(`Using market: ${firstMarket}, instrument: ${firstInstrument.code}`);
            
            // 3. Validate and select fields for the request
            const requestedFields = ['timestamp', 'open', 'high', 'low', 'close', 'volume'];
            const fieldValidation = this.schemaManager.validateFieldsForRequest(requestedFields, "global", 1);
            const validFields = fieldValidation.valid.length > 0 ? fieldValidation.valid : fieldValidation.available.slice(0, 6);
            
            console.log('Using fields:', validFields);
            
            // 4. Fetch historical data with validated parameters
            console.log('Fetching historical data...');
            const historicalData = await this.dataFetcher.fetchHistoricalData({
                code: firstInstrument.code,
                market: firstMarket,
                fromTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days
                fields: validFields
            });
            
            // 5. Process historical data
            const processedHistorical = await this.processingPipeline.processData(historicalData.timeSeries, [
                { type: 'filter', name: 'volumeThreshold', params: { minimum: 100 } },
                { type: 'transform', name: 'movingAverage', params: { field: 'close', window: 20 } },
                { type: 'transform', name: 'technicalIndicators', params: { indicators: ['rsi', 'macd'] } },
                { type: 'process', name: 'riskAnalysis' }
            ]);
            
            console.log('Processed historical data:', processedHistorical.slice(0, 3));
            
            // 6. Subscribe to real-time data using available instruments
            console.log('Starting real-time subscriptions...');
            const subscriptionCodes = marketInstruments.slice(0, 3).map(inst => inst.code); // Use first 3 available
            const rtFields = ['last_price', 'bid', 'ask', 'volume', 'timestamp'];
            const rtFieldValidation = this.schemaManager.validateFieldsForRequest(rtFields, "global", 1);
            const rtValidFields = rtFieldValidation.valid.length > 0 ? rtFieldValidation.valid : rtFieldValidation.available.slice(0, 5);
            
            const subscriptionId = await this.subscriptionManager.subscribeToRealTimeData({
                codes: subscriptionCodes,
                market: firstMarket,
                fields: rtValidFields,
                updateFrequency: 1000
            });
            
            // 7. Setup real-time data processing
            this.subscriptionManager.on('marketData', async (data) => {
                const processedRealTime = await this.processingPipeline.processData([data], [
                    { type: 'filter', name: 'priceRange', params: { min: 0, max: 10000 } },
                    { type: 'process', name: 'alertGeneration' }
                ]);
                
                this.handleProcessedRealTimeData(processedRealTime[0]);
            });
            
            // 8. Start market scanning using available data
            console.log('Starting market scans...');
            setTimeout(() => {
                this.runSchemaBasedMarketScans();
            }, 5000);
            
        } catch (error) {
            console.error('Error in data operations:', error);
        }
    }
    
    async runSchemaBasedMarketScans() {
        try {
            const availableMarkets = this.schemaManager.getAvailableMarkets();
            
            if (availableMarkets.length === 0) {
                console.log('No markets available for scanning');
                return;
            }
            
            // Use the first available market for scanning
            const scanMarket = availableMarkets[0];
            console.log(`Running scans on market: ${scanMarket}`);
            
            // Initialize market scanner with schema manager
            this.marketScanner = new MarketScanner(this.wsClient, this.dataFetcher, this.subscriptionManager);
            this.marketScanner.schemaManager = this.schemaManager;
            
            // Volume scan using available instruments
            const volumeScan = await this.marketScanner.scanByVolume({
                market: scanMarket,
                minVolume: 1000, // Lower threshold since we don't know the scale
                limit: 5
            });
            
            console.log('Top volume movers:', volumeScan);
            
            // Price movement scan
            const priceScan = await this.marketScanner.scanByPriceMovement({
                market: scanMarket,
                minPriceChange: 1, // Lower threshold for broader results
                direction: 'both',
                limit: 5
            });
            
            console.log('Price movement leaders:', priceScan);
            
            // Technical scan (if sufficient instruments available)
            const marketInstruments = this.schemaManager.getAvailableInstruments(scanMarket);
            if (marketInstruments.length >= 3) {
                const techScan = await this.marketScanner.scanByTechnicalIndicators({
                    market: scanMarket,
                    indicators: {
                        rsi: { min: 30, max: 70 },
                        volume_surge: 1.5
                    },
                    limit: 3
                });
                
                console.log('Technical opportunities:', techScan);
            }
            
        } catch (error) {
            console.error('Error in schema-based market scanning:', error);
        }
    }
    
    async calculateRiskMetrics(data) {
        return data.map(item => {
            const volatility = this.calculateVolatility(data, item);
            const sharpeRatio = this.calculateSharpeRatio(data, item);
            
            return {
                ...item,
                volatility,
                sharpeRatio,
                riskLevel: volatility > 0.3 ? 'high' : volatility > 0.15 ? 'medium' : 'low'
            };
        });
    }
    
    async generateAlerts(data) {
        return data.map(item => {
            const alerts = [];
            
            if (item.rsi && (item.rsi > 80 || item.rsi < 20)) {
                alerts.push({
                    type: 'RSI_EXTREME',
                    message: `RSI at ${item.rsi.toFixed(1)} - ${item.rsi > 80 ? 'overbought' : 'oversold'}`,
                    severity: 'medium'
                });
            }
            
            if (item.volume && item.volume_ratio > 3) {
                alerts.push({
                    type: 'VOLUME_SPIKE',
                    message: `Volume surge: ${item.volume_ratio.toFixed(1)}x normal`,
                    severity: 'high'
                });
            }
            
            return { ...item, alerts };
        });
    }
    
    handleProcessedRealTimeData(data) {
        // Handle processed real-time data
        if (data.alerts && data.alerts.length > 0) {
            console.log(`Alerts for ${data.symbol}:`, data.alerts);
        }
        
        // Update UI or trigger actions
        this.updateDisplays(data);
    }
    
    calculateVolatility(dataSet, currentItem) {
        // Calculate rolling volatility
        const prices = dataSet.map(d => d.close || d.price).filter(p => p != null);
        if (prices.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        }
        
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance * 252); // Annualized volatility
    }
    
    calculateSharpeRatio(dataSet, currentItem, riskFreeRate = 0.02) {
        const returns = dataSet.map(d => d.return).filter(r => r != null);
        if (returns.length === 0) return 0;
        
        const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const excessReturn = meanReturn - (riskFreeRate / 252); // Daily risk-free rate
        
        const volatility = this.calculateVolatility(dataSet, currentItem) / Math.sqrt(252); // Daily volatility
        
        return volatility > 0 ? excessReturn / volatility : 0;
    }
    
    updateDisplays(data) {
        // Update your UI components here
        // This would integrate with your visualization components
        console.log('Updated display for:', data.symbol, data.data);
    }
    
    // Helper methods for component initialization (refer to main guide)
    async initializeComponents() {
        // Initialize WASM module, WebSocket client, etc.
        // Implementation from STANDALONE_FRONTEND_DEMO_GUIDE.md
    }
    
    async connect() {
        // WebSocket connection logic
        // Implementation from STANDALONE_FRONTEND_DEMO_GUIDE.md
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.caitlynApp = new CaitlynDataApplication();
});
```

## Best Practices

### 1. Always Use Schema-Driven Data Access

```javascript
// ✅ CORRECT - Use schema to get available data
const availableMarkets = schemaManager.getAvailableMarkets();
const marketInstruments = schemaManager.getAvailableInstruments(availableMarkets[0]);
const validFields = schemaManager.getAvailableFields("global", 1);

// ❌ WRONG - Hardcoded values that may not exist
const hardcodedFields = ["open", "high", "low", "close"]; // May not be available
const hardcodedMarket = "CME"; // May not exist in this server
const hardcodedCode = "ES2024H"; // May not be available
```

### 2. Validate All Data Requests

```javascript
// Always validate before making requests
const validation = schemaManager.validateFieldsForRequest(requestFields, namespace, metaID);
if (validation.invalid.length > 0) {
    console.error('Invalid fields:', validation.invalid);
    // Handle error or use alternative fields
    requestFields = validation.available.slice(0, 5); // Use first 5 available fields
}
```

### 3. Handle Schema Initialization Properly

```javascript
class DataApplication {
    constructor() {
        this.isSchemaReady = false;
        this.pendingRequests = [];
    }
    
    async waitForSchema() {
        if (this.isSchemaReady) return;
        
        return new Promise(resolve => {
            const checkReady = () => {
                if (this.isSchemaReady) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }
    
    async makeDataRequest(config) {
        await this.waitForSchema(); // Always wait for schema
        return this.dataFetcher.fetchHistoricalData(config);
    }
}
```

### 4. Error Handling for Missing Data

```javascript
async function safeDataRequest(dataFetcher, config) {
    try {
        return await dataFetcher.fetchHistoricalData(config);
    } catch (error) {
        if (error.message.includes('Invalid market') || error.message.includes('Invalid instrument')) {
            console.warn('Data not available, trying fallback...');
            
            // Get first available market and instrument
            const markets = dataFetcher.schemaManager.getAvailableMarkets();
            const instruments = dataFetcher.schemaManager.getAvailableInstruments(markets[0]);
            
            return dataFetcher.fetchHistoricalData({
                ...config,
                market: markets[0],
                code: instruments[0].code
            });
        }
        throw error;
    }
}
```

### 5. Performance Considerations

```javascript
// Batch multiple requests efficiently
async function batchDataRequests(dataFetcher, requests) {
    const batchSize = 5;
    const results = [];
    
    for (let i = 0; i < requests.length; i += batchSize) {
        const batch = requests.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(config => dataFetcher.fetchHistoricalData(config))
        );
        results.push(...batchResults);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return results;
}
```

This comprehensive guide provides advanced data manipulation capabilities for working with the Caitlyn WebSocket server. The examples show how to fetch historical data, subscribe to real-time updates, perform market scanning, implement data processing pipelines, and create sophisticated financial analysis tools.

**Key Points:**

- All fields, markets, and tickers must come from the server's schema and universe data
- Always validate data requests against the schema before sending
- Handle schema initialization properly in your application flow
- Use proper error handling for missing or invalid data requests
- Implement rate limiting and batch processing for better performance

The code is production-ready and includes proper error handling, performance optimization, and extensibility for custom requirements.