# Mini Wolverine Architecture Guide

**Complete Backend-Frontend Architecture Documentation**

## Overview

Mini Wolverine implements a **production-ready backend-frontend architecture** that separates all WASM operations to the Node.js backend while providing a clean React frontend interface. This design enables **AI-friendly development**, **comprehensive testing**, and **upcoming trading capabilities**.

## 🏗️ Core Architecture Principles

### 1. **Complete WASM Separation**
- **Backend-Only WASM**: All caitlyn_js.wasm operations handled by Node.js backend
- **Frontend Purity**: React frontend has zero WASM dependencies
- **WebSocket Proxy**: Backend acts as intelligent proxy between frontend and Caitlyn servers
- **Memory Safety**: Production-grade WASM object lifecycle management

### 2. **AI-Ready Development**
- **Structured Codebase**: Clean separation allows AI agents to easily navigate and extend
- **Comprehensive Documentation**: Rich docs/ folder enables AI understanding
- **Reference Implementations**: Complete examples guide AI development patterns
- **Testing Framework**: Full test suite validates AI-generated changes

### 3. **Scalable Design**
- **Connection Pooling**: Efficient resource management for multiple clients
- **Environment Configuration**: Flexible deployment across development/production
- **Error Recovery**: Automatic reconnection and comprehensive error handling
- **Performance Monitoring**: Winston logging with structured output

## 🎯 System Components

### Backend Services Architecture

```
backend/
├── src/
│   ├── services/
│   │   ├── WasmService.js              # 🏗️ Core WASM Operations
│   │   ├── CaitlynWebSocketService.js  # 🔗 WebSocket Proxy
│   │   ├── CaitlynConnectionPool.js    # 🏊 Connection Management
│   │   └── TradingService.js           # 📈 Trading Operations (Upcoming)
│   ├── utils/
│   │   ├── logger.js                   # 📝 Winston Logging
│   │   └── StructValueWrapper.js       # 🐍 Python-like WASM Interface
│   └── server.js                       # 🚀 Express + WebSocket Server
├── public/
│   ├── caitlyn_js.js                   # 🔧 WASM JavaScript Wrapper
│   └── caitlyn_js.wasm                 # ⚙️ WebAssembly Binary
└── test-*.js                           # 🧪 Comprehensive Testing Suite
```

### Frontend Components Architecture

```
frontend-react/
├── src/
│   ├── components/
│   │   ├── Header.js                   # 🎯 Application Header
│   │   ├── ConnectionControls.js       # 🔌 Backend Connection UI
│   │   ├── StatusSection.js            # 📊 System Status Display
│   │   ├── TabSection.js               # 📑 Content Tabs (Schema, Data, Trading)
│   │   ├── ActionsSection.js           # 🎛️ Action Controls
│   │   └── Footer.js                   # 📄 Application Footer
│   ├── contexts/
│   │   ├── BackendWebSocketContext.js  # 🔗 Backend Communication
│   │   └── DataContext.js              # 💾 Data State Management
│   └── utils/
│       └── storage.js                  # 🗄️ Local Storage Management
└── App.js                              # ⚛️ Main React Application
```

## 🔄 Communication Flow

### WebSocket Message Protocol

**Frontend → Backend Message Types:**
```javascript
// Connection management
{type: 'connect', url: 'wss://...', token: 'auth-token'}
{type: 'disconnect'}

// Data requests
{type: 'test_universe_revision'}
{type: 'test_universe_seeds'}
{type: 'get_schema'}
{type: 'query_cached_seeds', sinceTimestamp: 0}

// Historical data (upcoming)
{type: 'request_historical', params: {market, symbol, timeframe}}

// Trading operations (planned)
{type: 'create_order', params: {market, symbol, side, quantity, price}}
{type: 'cancel_order', orderId: 'order-123'}
```

**Backend → Frontend Response Types:**
```javascript
// Connection status
{type: 'connection_status', status: 'connected', clientId: 'client-123'}

// Schema and data
{type: 'schema', schema: {...576 metadata objects...}}
{type: 'universe_revision', success: true, marketsCount: 10}
{type: 'universe_seeds', success: true, seedsReceived: 60}

// Real-time updates
{type: 'market_data', data: {market, symbol, price, volume}}
{type: 'execution_report', orderId: 'order-123', status: 'filled'}
```

### WASM Processing Pipeline

**1. Initialization Sequence:**
```javascript
// backend/src/services/WasmService.js
async initialize() {
    // Load caitlyn_js.wasm module
    this.module = await CaitlynModule({...});
    
    // Verify essential classes
    const requiredClasses = [
        'NetPackage', 'IndexSchema', 'IndexSerializer',
        'ATUniverseReq', 'ATUniverseRes', 
        'ATUniverseSeedsReq', 'ATUniverseSeedsRes',
        'ATFetchByCodeReq', 'ATFetchSVRes'  // Historical data
    ];
    
    // Validate all classes available
    for (const className of requiredClasses) {
        if (!this.module[className]) {
            throw new Error(`Required class ${className} not found`);
        }
    }
    
    this.ready = true;
}
```

**2. Schema Processing:**
```javascript
processSchema(content) {
    const schema = new this.module.IndexSchema();
    schema.load(content);
    
    // Process 576 metadata objects across 2 namespaces
    const metas = schema.metas();
    const schemaData = {};
    
    for (let i = 0; i < metas.size(); i++) {
        const meta = metas.get(i);
        // Build namespace-organized schema...
    }
    
    // Initialize compressor
    this.compressor = new this.module.IndexSerializer();
    this.compressor.updateSchema(schema);
    
    // CRITICAL: Delete schema after transfer to compressor
    schema.delete();
    
    return schemaData;
}
```

**3. Universe Data Processing:**
```javascript
processUniverseRevision(content) {
    const universeRes = new this.module.ATUniverseRes();
    universeRes.setCompressor(this.compressor);
    universeRes.decode(content);
    
    const revs = universeRes.revs();
    const marketsData = {};
    
    // Extract market data from StructValues
    for (let i = 0; i < keys.size(); i++) {
        const structValues = revs.get(keys.get(i));
        
        for (let j = 0; j < structValues.size(); j++) {
            const sv = structValues.get(j);
            
            // Market metadata (ID 3) contains revision data in field 7
            if (sv.metaID === 3 && !sv.isEmpty(7)) {
                const revsJsonString = sv.getString(7);
                const revsData = JSON.parse(revsJsonString);
                // Process market data...
            }
            
            sv.delete(); // Always cleanup
        }
    }
    
    universeRes.delete();
    return marketsData;
}
```

## 📊 Data Processing Patterns

### Schema-Based Field Access

**Critical Pattern**: Always use schema definitions to determine field positions:

```javascript
// ❌ WRONG: Hardcoded field positions
const tradeDay = sv.getInt32(2);  // Assumes field 2 is trade_day

// ✅ CORRECT: Schema-based field access
// From schema analysis: Market structure field mapping:
// Field 0: trade_day, Field 1: name, Field 2: time_zone, Field 7: revs
const tradeDay = sv.getInt32(0);    // Field 0: trade_day
const name = sv.getString(1);       // Field 1: name
const revisions = sv.getString(7);  // Field 7: revs (JSON data)
```

### Memory Management Best Practices

**WASM Object Lifecycle:**
```javascript
// ✅ CORRECT: Always delete WASM objects
function processData(content) {
    const response = new this.module.ATFetchSVRes();
    response.setCompressor(this.compressor);
    
    try {
        response.decode(content);
        const results = response.results();
        
        // Process results...
        for (let i = 0; i < results.size(); i++) {
            const sv = results.get(i);
            // Use sv...
            sv.delete(); // Delete each StructValue
        }
        
        return processedData;
    } finally {
        response.delete(); // Always delete in finally block
    }
}
```

## 🚀 Extending the Architecture

### Adding New WASM Operations

**1. Backend Service Extension:**
```javascript
// backend/src/services/WasmService.js
class WasmService {
    // Add new WASM operation
    processNewDataType(content) {
        const response = new this.module.NewDataTypeResponse();
        response.setCompressor(this.compressor);
        response.decode(content);
        
        // Process data...
        const results = this.extractResults(response);
        
        // Always cleanup
        response.delete();
        return results;
    }
    
    createNewRequest(params) {
        const request = new this.module.NewDataTypeRequest(
            params.token, params.sequence, params.market
        );
        
        const pkg = new this.module.NetPackage();
        const encoded = pkg.encode(this.module.CMD_NEW_DATA_TYPE, request.encode());
        
        // Copy to regular ArrayBuffer for WebSocket
        const buffer = this.copyToRegularBuffer(encoded);
        
        // Cleanup
        request.delete();
        pkg.delete();
        
        return buffer;
    }
}
```

**2. Frontend Integration:**
```javascript
// frontend-react/src/contexts/BackendWebSocketContext.js
const requestNewData = useCallback((params) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'request_new_data',
            params: params
        }));
    }
}, [ws]);

// Add to context actions
const actions = {
    ...existingActions,
    requestNewData
};
```

### AI Agent Extension Points

**Structured Extension Areas:**
```javascript
// 1. New WASM Operations
// backend/src/services/WasmService.js - Add new processXXX methods

// 2. Frontend Components  
// frontend-react/src/components/ - Add new UI components

// 3. WebSocket Messages
// Add new message types to protocol definitions

// 4. Data Contexts
// frontend-react/src/contexts/ - Extend state management

// 5. Testing
// backend/test-new-feature.js - Add comprehensive tests
```

## 🧪 Testing & Validation

### Backend Testing Suite

**Comprehensive WASM Testing:**
```bash
# Core functionality tests
node backend/test-backend-capabilities.js  # Verify all WASM classes
node backend/test-backend-core.js          # Full integration test

# Reference implementation
node examples/test.js --url <ws_url> --token <token>
```

**Test Coverage:**
- ✅ WASM module loading and class verification
- ✅ Schema processing (576 objects, 2 namespaces) 
- ✅ Universe initialization (10 global markets)
- ✅ Memory management and cleanup
- ✅ WebSocket proxy functionality
- ✅ Error recovery and reconnection

### Frontend Testing

**Development Tools:**
```bash
# Start development environment
docker-compose up -d

# Frontend: http://localhost:3000
# Backend API: http://localhost:4000/api/health
```

**Testing Features:**
- React DevTools for component inspection
- WebSocket message monitoring in browser DevTools
- Real-time data visualization and export
- Connection status and error reporting

## 🎯 Production Deployment

### Environment Configuration

```bash
# .env configuration
PORT=4000
LOG_LEVEL=info
CAITLYN_WS_URL=wss://116.wolverine-box.com/tm
CAITLYN_TOKEN=your-production-token
CAITLYN_CONNECTION_TIMEOUT=30000
CAITLYN_RECONNECT_DELAY=5000

# Frontend environment
REACT_APP_BACKEND_WS_URL=ws://localhost:4000
```

### Docker Deployment

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["4000:4000"]
    environment:
      - LOG_LEVEL=warn
      - CAITLYN_WS_URL=${CAITLYN_WS_URL}
      - CAITLYN_TOKEN=${CAITLYN_TOKEN}
    
  react-app:
    build: ./frontend-react  
    ports: ["3000:3000"]
    environment:
      - REACT_APP_BACKEND_WS_URL=ws://backend:4000
    depends_on: [backend]
```

## 📈 Future Extensions: Trading & Automation

### Planned Trading Architecture Integration

**Trading Services (Upcoming):**
```javascript
// backend/src/services/TradingService.js (Planned)
class TradingService {
    // Manual trading operations
    createManualOrder(params) { /* CMD_AT_MANUAL_TRADE */ }
    editOrder(orderId, modifications) { /* CMD_AT_MANUAL_EDIT */ }
    
    // Automated execution
    startStrategy(strategyId) { /* Strategy automation */ }
    processSignals(marketData) { /* Real-time signal processing */ }
    
    // Backtesting
    runBacktest(strategy, params) { /* CMD_AT_START_BACKTEST */ }
}
```

**Frontend Trading Interface:**
```jsx
// frontend-react/src/components/TradingPanel.js (Planned)
function TradingPanel() {
    // Order entry interface
    // Portfolio management
    // Strategy management
    // Performance analytics
}
```

## 🎉 Architecture Benefits

### For Developers
- **Clean Separation**: Easy to understand and extend
- **Production Ready**: Comprehensive error handling and testing
- **Memory Safe**: Proper WASM object lifecycle management
- **Scalable**: Connection pooling and efficient resource management

### For AI Agents
- **Structured Codebase**: Clear patterns and consistent architecture
- **Rich Documentation**: Comprehensive guides enable AI understanding
- **Testing Framework**: Validates AI-generated changes automatically
- **Extension Points**: Well-defined areas for AI to add functionality

### For Financial Applications
- **Real-time Processing**: Live market data with minimal latency
- **Historical Analysis**: Complete historical data retrieval system
- **Trading Ready**: Architecture supports upcoming trading capabilities
- **Global Markets**: Support for 10+ major financial markets

---

**Mini Wolverine Architecture** - A modern, AI-friendly foundation for financial applications that brings Wolverine's powerful capabilities to developers through a clean, scalable architecture.