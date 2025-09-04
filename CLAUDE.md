# Mini Wolverine Development Guide

## Project Overview

Mini Wolverine is a modern full-stack financial data processing application with a **backend-frontend architecture**. The Node.js backend handles all WASM operations and Caitlyn server communication, while the React frontend provides a clean, responsive user interface. This separation ensures optimal performance, security, and scalability for financial market data processing.

## Key Features

### 🎯 **Core Functionality**
- **React 18 Frontend**: Modern React application with hooks, contexts, and styled-components
- **Node.js Backend**: Express server handling WASM operations and WebSocket proxy functionality
- **Backend WASM Integration**: All Caitlyn WASM module operations handled server-side
- **WebSocket Proxy Architecture**: Backend acts as proxy between frontend and Caitlyn servers
- **Real-time Data Processing**: Live processing of market data streams with schema-driven parsing
- **Historical Data Management**: Comprehensive historical market data fetching and visualization
- **Interactive UI**: Modern, responsive React interface with real-time updates and debugging tools

### 🏗️ **Architecture Highlights**
- **Backend-Frontend Separation**: Clean separation of concerns with WASM processing on backend
- **Docker Multi-Service**: Docker Compose with backend and frontend services
- **WebSocket Communication**: Frontend ↔ Backend ↔ Caitlyn Server communication chain
- **Context-Based Frontend State**: React Context API with useReducer patterns
- **Express REST API**: RESTful endpoints for health checks, schema, and market data
- **Environment Configuration**: Comprehensive configuration via environment variables

## Technical Implementation

### Full-Stack Architecture Overview

```
Backend-Frontend Architecture:
┌─────────────────────────────────────────────────────────────┐
│ React Frontend (Port 3000)                                  │
│ ├── Pure React UI components                                │
│ ├── BackendWebSocketContext (connects to backend)           │
│ ├── DataContext (receives processed data from backend)      │
│ └── No WASM dependencies                                    │
└─────────────────────────────────────────────────────────────┘
                              │ WebSocket API
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Node.js Backend (Port 4000)                                 │
│ ├── Express REST API (/api/health, /api/schema)             │
│ ├── WebSocket Server (frontend connections)                 │
│ ├── WasmService (all WASM operations)                       │
│ ├── CaitlynWebSocketService (Caitlyn server proxy)          │
│ └── All caitlyn_js.wasm processing                          │
└─────────────────────────────────────────────────────────────┘
                              │ WebSocket/WASM
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ External Caitlyn Server                                    │
│ └── wss://116.wolverine-box.com/tm                        │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture (No WASM)

The React frontend is now a **pure UI layer** with no WASM dependencies:

```
frontend-react/
├── src/
│   ├── components/                    # React UI components
│   │   ├── Header.js                 # Application header
│   │   ├── ConnectionControls.js     # Backend connection UI
│   │   ├── StatusSection.js          # System status display
│   │   ├── TabSection.js             # Tabbed content area
│   │   ├── ActionsSection.js         # Action buttons and controls
│   │   └── Footer.js                 # Application footer
│   ├── contexts/                     # React state management
│   │   ├── BackendWebSocketContext.js # Backend connection
│   │   └── DataContext.js            # Data from backend
│   ├── App.js                        # Main component
│   └── index.js                      # React entry point
└── Dockerfile.dev                    # Frontend container
```

**Frontend Responsibilities:**
- **Pure UI**: React components with no WASM code
- **Backend Communication**: WebSocket connection to Node.js backend
- **State Management**: React Context for UI state and data from backend
- **User Interface**: Modern, responsive design with real-time updates

### Backend Architecture (WASM Processing)

The Node.js backend handles **all WASM operations** and acts as a proxy:

```
backend/
├── src/
│   ├── services/
│   │   ├── WasmService.js            # All WASM operations
│   │   └── CaitlynWebSocketService.js # Caitlyn server proxy
│   ├── utils/
│   │   └── logger.js                 # Winston logging
│   └── server.js                     # Express + WebSocket server
├── public/
│   ├── caitlyn_js.js                 # WASM JavaScript wrapper
│   └── caitlyn_js.wasm               # WebAssembly binary
├── test-*.js                         # Comprehensive test suite
└── Dockerfile.dev                    # Backend container
```

**Backend Responsibilities:**
- **WASM Module Loading**: Initialize and manage caitlyn_js.wasm
- **Schema Processing**: Handle schema definitions and metadata
- **Universe Operations**: Process universe revision and seeds data
- **Binary Protocol**: NetPackage encoding/decoding operations  
- **WebSocket Proxy**: Relay between frontend and Caitlyn servers
- **Memory Management**: Proper WASM object cleanup and lifecycle
- **REST API**: Health checks, schema endpoints, market data

### WebSocket Communication Flow

The application uses a **three-layer communication architecture**:

```javascript
// Frontend → Backend → Caitlyn Server Communication Flow
1. Frontend connects to Backend WebSocket (ws://localhost:4000)
2. Frontend sends connection request: {type: 'connect', url: '...', token: '...'}
3. Backend establishes connection to Caitlyn Server (wss://116.wolverine-box.com/tm)
4. Backend handles WASM processing and relays processed data to Frontend
```

**Connection Configuration:**
- **Frontend Environment**: `REACT_APP_WS_URL`, `REACT_APP_WS_TOKEN` (for UI defaults)
- **Backend Environment**: `CAITLYN_WS_URL`, `CAITLYN_TOKEN` (for server connection)
- **Runtime Configuration**: Users can override server URL and token in UI
- **Automatic Proxy**: Backend handles all Caitlyn protocol communication

**Message Flow:**
- **Frontend → Backend**: JSON messages via WebSocket API
- **Backend → Caitlyn**: Binary protocol with WASM processing
- **Backend → Frontend**: Processed JSON responses with schema, data, status

### WASM Integration Patterns

The project follows the official Caitlyn JavaScript interface defined in `docs/cxx/caitlyn_js.cpp`. Key integration patterns include:

#### 1. **Module Loading and Initialization**

- Safe module loading with timeout and error handling
- Proper class availability verification (`NetPackage`, `IndexSchema`, etc.)
- Global module reference management

#### 2. **Command Constants Usage**

- Use named constants instead of magic numbers
- `NET_CMD_GOLD_ROUTE_KEEPALIVE`, `NET_CMD_GOLD_ROUTE_DATADEF`
- `CMD_AT_UNIVERSE_REV`, `CMD_AT_UNIVERSE_SEEDS`
- Dynamic command name resolution for debugging

#### 3. **Binary Protocol Handling**

- NetPackage class for encode/decode operations  
- Proper header and content extraction
- Message routing based on command constants
- Memory management with cleanup

#### 4. **Schema Processing**

- IndexSchema for metadata definitions
- IndexSerializer for data compression
- Global schema and compressor storage
- Automatic initialization sequence

#### 5. **Request/Response Pattern**

- Use proper request classes (`ATUniverseReq`, `ATUniverseSeedsReq`)
- Response classes with compressor integration
- Proper WASM object lifecycle management
- Binary message encoding/sending

**📖 For detailed implementation examples, see:**

- `docs/CAITLYN_JS_API.md` - Complete API reference
- `docs/CAITLYN_WASM_INITIALIZATION.md` - Initialization guide
- `docs/WEBSOCKET_DATA_MANIPULATION_GUIDE.md` - Protocol details

### Historical Data Retrieval System

The Mini Wolverine application includes a comprehensive historical data retrieval system demonstrating advanced Caitlyn WASM integration patterns.

#### **Architecture Overview**

**Data Flow:**

1. **User Selection**: Market and symbol selection via dropdown menus
2. **Request Formation**: Timeframe and lookback period configuration
3. **WebSocket Communication**: Structured historical data requests
4. **Server Processing**: Server generates realistic OHLCV time series data
5. **Client Processing**: Data validation, formatting, and storage
6. **Visualization**: Table and chart views with interactive controls

#### **Key Features**

**User Interface:**

- Market and symbol selection dropdowns
- Timeframe selector (1, 5, 15, 60, 240, 1440 minutes)
- Lookback period input (1-30 days)
- Table and chart view toggle
- Export functionality

**Data Management:**

- Efficient data storage using Maps
- Request-response matching with sequence tracking
- Automatic cleanup and error handling
- Real-time UI state management

#### **Integration Strategy**

**Real-time vs Historical Data:**

- **Real-time**: Binary WebSocket messages with WASM parsing
- **Historical**: Request-response pattern with configurable parameters
- **Shared Infrastructure**: Same WebSocket connection and schema definitions
- **UI Integration**: Seamless integration in separate tabs with export support

**📖 For detailed implementation examples, see:**

- `docs/WEBSOCKET_DATA_MANIPULATION_GUIDE.md` - Historical data protocols
- `frontend-react/src/components/TabSection.js` - UI implementation
- `frontend-react/src/contexts/DataContext.js` - State management

## Development Workflow

### Getting Started

1. **Environment Setup**: Configure Caitlyn server details in `.env`
   ```bash
   # Update .env file:
   REACT_APP_WS_URL=wss://116.wolverine-box.com/tm
   REACT_APP_WS_TOKEN=your-caitlyn-token
   BACKEND_WS_URL=ws://localhost:4000  
   CAITLYN_WS_URL=wss://116.wolverine-box.com/tm
   CAITLYN_TOKEN=your-caitlyn-token
   ```

2. **Start Full Stack**: Run `docker-compose up -d` for complete development environment
   ```bash
   # Starts both backend (port 4000) and frontend (port 3000)
   docker-compose up -d
   ```

3. **Access Application**: 
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:4000/api/health

### Development Guidelines

#### **Frontend Development (React)**

- **Pure UI Components**: No WASM code, focus on user interface
- **Backend Communication**: Use BackendWebSocketContext for all server communication
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Context State Management**: Centralized state using React Context API
- **Styled Components**: Component-level styling with CSS-in-JS
- **Performance**: Optimized re-renders with useMemo and useCallback

#### **Backend Development (Node.js + WASM)**

- **Service Architecture**: Use WasmService for all WASM operations, CaitlynWebSocketService for connections
- **Error Handling**: Comprehensive WASM error handling with proper cleanup
- **WebSocket Proxy**: Handle frontend-backend-Caitlyn communication chain
- **Memory Management**: Critical WASM object lifecycle management
- **Logging**: Winston logger for structured backend logging
- **Testing**: Comprehensive test suite for WASM functionality verification

##### Memory Management and Object Deletion

**Correct WASM Object Deletion Pattern:**
```javascript
// CORRECT: Always call delete() on WASM objects after use
const pkg = new wasmModule.NetPackage();
const req = new wasmModule.ATUniverseReq();
// ... use the objects ...
pkg.delete();  // No conditional checks needed
req.delete();  // delete() is always available on WASM objects
```

**Incorrect patterns to avoid:**
```javascript
// AVOID: Unnecessary conditional checks
if (pkg && typeof pkg.delete === 'function') {
  pkg.delete();
}

// AVOID: Try-catch blocks around delete
try {
  pkg.delete();
} catch(e) {
  console.error('Failed to delete');
}
```

**Key Principle**: All WASM objects created with `new` MUST be deleted. The `delete()` method is guaranteed to exist on all Emscripten-generated WASM objects. Conditional checks are unnecessary and hide potential issues.

##### Error Handling Philosophy

**Let Exceptions Surface - Don't Hide Them**

The codebase should favor clarity and debuggability over defensive programming:

1. **No Excessive Try-Catch**: Avoid wrapping every WASM operation in try-catch blocks. Let exceptions bubble up so developers can see the actual error and fix the root cause.

2. **No Fallback Chains**: Don't use patterns like `wasmModule || window.Module || window.CaitlynModule`. Use direct references and let it fail if the module isn't loaded.

3. **No Defensive Type Checking**: Don't check if methods exist on WASM objects. They are guaranteed by the C++ interface definition.

**Good Pattern:**
```javascript
// Direct, clear, will fail fast if something is wrong
const currentWasmModule = wasmModule;
const universeRes = new currentWasmModule.ATUniverseRes();
universeRes.setCompressor(window.caitlynCompressor);
universeRes.decode(content);
```

**Bad Pattern:**
```javascript
// Defensive, hides problems, makes debugging harder
try {
  const currentWasmModule = wasmModule || window.Module || fallback;
  if (currentWasmModule && currentWasmModule.ATUniverseRes) {
    const universeRes = new currentWasmModule.ATUniverseRes();
    if (typeof universeRes.setCompressor === 'function') {
      universeRes.setCompressor(window.caitlynCompressor);
    }
  }
} catch(e) {
  console.log('Failed but continuing anyway');
}
```

##### Core WASM Guidelines

1. **Direct Module Access**: Use `wasmModule` directly without fallback chains
2. **Immediate Deletion**: Delete WASM objects immediately after use, no conditional checks
3. **Let It Fail**: Allow exceptions to surface for better debugging
4. **Schema Lifecycle**: Delete schema objects AFTER transferring data to compressor
5. **SharedArrayBuffer Copying**: Always copy WASM ArrayBuffers before WebSocket send
6. **Global References**: Keep compressor and processed schema globally for reuse
7. **Binary Protocol**: Use proper command constants and NetPackage for encoding
8. **Memory Leak Prevention**: Every `new` must have a corresponding `delete()`
9. **Schema-Based Field Access**: Always use schema definitions to determine correct field positions for StructValue objects
10. **No Try-catch to `stablize` the system**: Always let the errors surface with full callstack to help human see and debug. THIS IS CRITICAL!!
11. **No fallback to patch possible error**: Always NOT use fallbacks to patch possible system flaw or error, just let it crash. THIS IS CRITICAL!!

#### Mock data as fallback

1. **DON'T MAKE MOCK DATA AS FALLBACK**: CRITICAL! Just let the system fail and let me see the error. Making mock data to patch is HARMFUL!

##### SVObject Doctrine - MANDATORY for All StructValue Processing

**🚫 NEVER manipulate StructValue objects directly** - Always use SVObject subclasses for all Caitlyn data processing.

**✅ REQUIRED SVObject Pattern with Reuse:**

```javascript
// 1. Create reusable SVObject cache (once per function/scope)
const svObjectCache = {};

// 2. Create or reuse SVObject instance (generic pattern - most common)
if (!svObjectCache[qualifiedName]) {
  svObjectCache[qualifiedName] = new SVObject(wasmModule);
  svObjectCache[qualifiedName].metaName = qualifiedName;
  svObjectCache[qualifiedName].namespace = namespace || wasmModule.NAMESPACE_GLOBAL;
  svObjectCache[qualifiedName].revision = revision || 0xFFFFFFFF;  // Use latest revision by default
  svObjectCache[qualifiedName].loadDefFromDict(schemaByNamespace);  // Load schema once
}

// 3. Reuse existing SVObject instance
const svObject = svObjectCache[qualifiedName];
svObject.fromSv(structValue);  // Extract data from current StructValue

// 4. Access structured data
const objectData = svObject.toJSON();
const fieldValue = objectData.fields.fieldName;

// 5. Cleanup all cached instances at end of scope (MANDATORY)
for (const metaName in svObjectCache) {
  svObjectCache[metaName].cleanup();
}
```

**🏗️ SVObject Initialization Steps:**

1. **Import Required Classes:**

   ```javascript
   import SVObject from '../utils/StructValueWrapper.js';
   ```

2. **Schema Availability Check:**

   ```javascript
   if (schemaByNamespace[namespace] && schemaByNamespace[namespace][metaID]) {
     const meta = schemaByNamespace[namespace][metaID];
     const qualifiedName = meta.name; // e.g., "global::Market"
   }
   ```

3. **SVObject Creation and Schema Loading:**

   ```javascript
   const svObject = new SVObject(wasmModule);
   svObject.metaName = qualifiedName;
   svObject.namespace = namespace || wasmModule.NAMESPACE_GLOBAL;
   svObject.loadDefFromDict(schemaByNamespace);  // Schema-driven field definitions
   ```

4. **Data Extraction:**

   ```javascript
   svObject.fromSv(structValue);  // Safe field extraction using schema
   const data = svObject.toJSON(); // Structured field access
   ```

5. **Memory Management:**

   ```javascript
   svObject.cleanup();  // Always cleanup - prevents memory leaks
   ```

**📋 Special Case - Available Singularity SVObject Types:**

Use `createSingularityObject()` only for these predefined Singularity types:
- `MarketData` (global::Market, private::Market)
- `HolidayData` (global::Holiday, private::Holiday)
- `SecurityData` (global::Security, private::Security)
- `CommodityData` (global::Commodity, private::Commodity)
- `FutureData` (global::Future, private::Future)
- `StockData` (global::Stock, private::Stock)
- `DividendData` (global::Dividend, private::Dividend)

For all other types (SampleQuote, custom queries, etc.), use generic SVObject pattern.

**❌ FORBIDDEN Direct StructValue Patterns:**

```javascript
// NEVER do this:
const value = sv.getString(7);      // ❌ Hardcoded field positions
const tradeDay = sv.getInt32(0);    // ❌ Direct field access
if (!sv.isEmpty(1)) { ... }         // ❌ Manual field checking
```

**✅ CORRECT SVObject Patterns:**

```javascript
// Primary pattern - Generic SVObject (most common):
const svObject = new SVObject(wasmModule);
svObject.metaName = qualifiedName;  // e.g., 'SampleQuote', 'Future'
svObject.namespace = namespace;     // wasmModule.NAMESPACE_GLOBAL or NAMESPACE_PRIVATE
svObject.loadDefFromDict(schemaByNamespace);
svObject.fromSv(sv);
const fields = svObject.toJSON().fields;
const extractedData = fields;       // ✅ Schema-driven field access
svObject.cleanup();

// Special case - Singularity types only:
const marketData = createSingularityObject("global::Market", wasmModule);
marketData.loadDefFromDict(schemaByNamespace);
marketData.fromSv(sv);
const fields = marketData.toJSON().fields;
const tradeDay = fields.trade_day;   // ✅ Schema-driven field access
const name = fields.name;            // ✅ Named field access
marketData.cleanup();
```

**🎯 Benefits of SVObject Doctrine:**

- **Field Alignment Safety**: No crashes from schema mismatches
- **Schema Compliance**: All data extraction follows server schema
- **Code Consistency**: Same pattern across all components
- **Memory Safety**: Proper WASM object lifecycle management
- **Maintainability**: Easy to extend for new metadata types
- **Performance Optimization**: Instance reuse reduces object creation overhead

**⚡ SVObject Reuse Guidelines:**

1. **Create Cache Once**: Initialize `svObjectCache = {}` at function start
2. **Reuse by Qualified Name**: Cache key should be full qualified name (e.g., "global::Market")
3. **Load Schema Once**: Call `loadDefFromDict()` only when creating new instances
4. **Multiple fromSv() Calls**: Same SVObject can process multiple StructValues
5. **Cleanup at End**: Always cleanup all cached instances when function completes
6. **Scope-Based Caching**: Create cache per function/method scope, not globally

**📊 Performance Impact:**
- **Before**: Creating 100 Market objects = 100 object creations + 100 schema loads
- **After**: Processing 100 Markets = 1 object creation + 1 schema load + 100 data extractions
- **Memory Savings**: ~90% reduction in WASM object allocations
- **Speed Improvement**: Faster processing due to reduced object creation overhead

### Testing and Debugging

#### **Backend Testing Suite**

The backend includes a comprehensive testing suite:

```bash
# Core WASM functionality tests
node backend/test-backend-capabilities.js     # Tests all WASM classes and operations
node backend/simple-connection-test.js        # Tests basic WebSocket connection
node backend/test-backend-core.js             # Full integration test with Caitlyn server
```

**Test Coverage:**
- ✅ **WASM Module Loading**: Verify all 7 required classes available
- ✅ **Schema Processing**: Test schema retrieval (576 objects, 2 namespaces)
- ✅ **Message Creation**: Test handshake, universe, seeds requests
- ✅ **NetPackage Operations**: Test binary encoding/decoding
- ✅ **Memory Management**: Verify proper WASM object cleanup

#### **Frontend Testing**

- **React Developer Tools**: Chrome extension for component state inspection
- **WebSocket Inspection**: Browser DevTools Network tab for message monitoring
- **Backend Integration**: Frontend connects to backend WebSocket API

#### **Debug Strategies**

1. **Backend Logs**: `docker-compose logs backend --follow` for real-time WASM operations
2. **Frontend Console**: Browser DevTools for React state and WebSocket messages
3. **Step-by-Step Connection**: Backend → Caitlyn connection → Schema loading → Data processing

### Common Development Scenarios

#### **Adding New Features**

1. **Backend Features**: Add new WASM operations to WasmService, update CaitlynWebSocketService
2. **Frontend Features**: Update contexts and create visualization components
3. **WebSocket Protocol**: Extend message handlers in both frontend and backend
4. **UI Enhancements**: Use styled-components and CSS-in-JS patterns

#### **Critical Bug Fixes Applied**

1. **Memory Leak Resolution**: Fixed IndexSchema objects not being deleted, causing memory leaks and connection instability
2. **Missing Protocol Messages**: Added universe revision and universe seeds requests to complete the handshake sequence
3. **SharedArrayBuffer WebSocket Issue**: Fixed "ArrayBufferView value must not be shared" error by copying to regular ArrayBuffer
4. **Excessive Logging**: Implemented debug level controls to reduce keepalive message spam
5. **React Context Dependencies**: Fixed provider ordering (DataProvider → WasmProvider → WebSocketProvider)
6. **WASM Class Name Corrections**: Fixed typos in class names (ATUniverseSeedsReq vs ATUnverseSeedsReq)
7. **StructValue Field Access Corrections**: Fixed incorrect field position usage by implementing schema-based field mapping

**📖 For detailed development guides, see:**

- `frontend-react/README.md` - React-specific documentation
- `frontend-react/src/components/` - Component architecture examples  
- `frontend-react/src/contexts/` - State management patterns

## Deployment Considerations

### Production Environment

#### **Required Configuration**

- **Security Headers**: CORS headers for SharedArrayBuffer support
- **MIME Types**: Proper WASM file serving configuration  
- **Performance**: Gzip compression and CDN integration

### Monitoring and Maintenance

#### **Health Checks**

- React application availability
- Docker container status monitoring
- WebSocket connection health

#### **Performance Metrics**

- WebSocket message throughput
- WASM processing times
- UI update frequencies
- Memory usage patterns

## Extending the Project

### Integration with External Caitlyn Servers

The React frontend supports external Caitlyn server integration:

1. **Environment Configuration**: Set `REACT_APP_WS_URL` and `REACT_APP_WS_TOKEN`
2. **Runtime Configuration**: User input for server details in UI
3. **Authentication**: Token-based authentication with WebSocket context
4. **Protocol Compliance**: Full binary protocol compatibility
5. **Error Handling**: Production-level error recovery and reconnection

### Adding Advanced Features

#### **Planned Enhancements**

- **Data Persistence**: IndexedDB integration for offline capability
- **Real-time Charts**: Chart.js or D3.js integration
- **Advanced Analytics**: Statistical analysis using WASM capabilities
- **Performance Optimization**: Object pooling, Web Workers, caching strategies

### Future Roadmap

#### **Technical Enhancements**

- **Multi-market Support**: Multiple simultaneous connections
- **Advanced Visualization**: 3D charts, heat maps, technical indicators
- **Mobile Optimization**: Progressive Web App features
- **AI Integration**: Machine learning for market prediction

#### **Technology Adoption**

- **WebAssembly 2.0**: Leverage new WASM features
- **WebRTC**: Peer-to-peer data sharing
- **Service Workers**: Offline capability
- **WebGL**: GPU-accelerated visualization

## Troubleshooting Guide

### Common Issues

1. **WASM Module Loading**: Check browser compatibility and CORS headers
2. **SharedArrayBuffer Errors**: Ensure proper security headers are set
3. **WebSocket Connection**: Verify server URL and network connectivity
4. **Data Processing**: Ensure schema is loaded before requesting data
5. **Memory Leaks**: Check that all WASM objects are properly deleted with `object.delete()`
6. **WebSocket Disconnects**: Verify complete protocol handshake (handshake → schema → universe revision → universe seeds)
7. **React Context Errors**: Ensure proper provider nesting order

### Debug Strategies

1. **Step-by-Step Verification**: WASM loading → WebSocket connection → Schema loading → Data processing
2. **Logging Analysis**: Enable debug logging and export for analysis
3. **Performance Profiling**: Use browser tools to monitor memory and processing times
4. **Memory Leak Detection**: Watch for Embind "leaked C++ instance" warnings in console
5. **WebSocket Message Flow**: Use browser Network tab to verify outgoing client requests
6. **Debug Level Control**: Use `localStorage.setItem('wsDebugLevel', '4')` for verbose logging

## Support and Resources

### Documentation

- **Main README**: Quick start guide
- **React Frontend Guide**: React-specific documentation  
- **API Reference**: `docs/CAITLYN_JS_API.md`
- **Initialization Guide**: `docs/CAITLYN_WASM_INITIALIZATION.md`

### Debug Resources

- **Global Debug Object**: Available in browser console for context inspection
- **React Developer Tools**: Chrome extension for component state inspection
- **Network Analysis**: Browser DevTools for WebSocket message monitoring

---

This project demonstrates the integration of the Caitlyn WASM module with external WebSocket servers in a modern React environment. It serves as both a functional demo and a comprehensive reference for developers building financial applications with WebAssembly technology and React development workflows.

**📖 For detailed implementation examples, always refer to the `docs/` folder for the latest information.**

## Documentation Library Overview

The `docs/` folder contains comprehensive technical documentation covering all aspects of Caitlyn WASM integration. Each document serves as a specialized reference for different aspects of the system:

### **Core Integration Documentation**

- **`CAITLYN_JS_API.md`** - Complete JavaScript API reference for all WASM classes, methods, and data structures. Essential for understanding available functionality.
- **`CAITLYN_WASM_INITIALIZATION.md`** - Detailed initialization procedures and configuration patterns. Critical for proper system startup.
- **`CAITLYN_GLOBAL_STRUCTURES.md`** - Comprehensive catalog of all discovered data structures, market definitions, and protocol constants. Generated from reverse engineering analysis.

### **Advanced Architecture Patterns**

- **`CAITLYN_CLIENT_CONNECTION_PATTERN.md`** - Comprehensive guide for the CaitlynClientConnection pattern with autonomous connections, resource pooling, and production deployment strategies. The modern approach for scalable Caitlyn applications.
- **`SVOBJECT_BEST_PRACTICES.md`** - Essential documentation for SVObject and StructValue processing patterns. Mandatory reading for all developers working with Caitlyn binary data structures.

### **Protocol and WebSocket Documentation**

- **`UNIVERSE_INITIALIZATION.md`** - Complete universe initialization flow documentation with step-by-step protocol analysis. The theoretical foundation for practical implementation.
- **`WEBSOCKET_DATA_MANIPULATION_GUIDE.md`** - Advanced WebSocket protocol patterns, message handling, and data manipulation techniques.
- **`WEBSOCKET_FIXES_AND_BEST_PRACTICES.md`** - Critical bug fixes, memory management patterns, and production best practices discovered through development.

### **Implementation Examples**

- **`STANDALONE_FRONTEND_DEMO_GUIDE.md`** - Complete guide for building standalone frontend applications with Caitlyn WASM integration.

### **Critical Implementation Files**

- **`test.js`** - Definitive reference implementation for universe initialization (see detailed section below)
- **`schema_decoder.js`** - Diagnostic tool for analyzing WASM schema structures
- **`simple_decoder.js`** - Simplified decoder for understanding basic protocol patterns
- **`cxx/caitlyn_js.cpp`** - C++ source code defining the JavaScript interface (reference only)

### **Documentation Usage Strategy**

1. **Start with** `UNIVERSE_INITIALIZATION.md` for theoretical understanding
2. **Reference** `CAITLYN_GLOBAL_STRUCTURES.md` for data structure definitions  
3. **Architecture** `CAITLYN_CLIENT_CONNECTION_PATTERN.md` for production-ready connection patterns
4. **Data Processing** `SVOBJECT_BEST_PRACTICES.md` for safe StructValue handling (mandatory)
5. **Implement using** `test.js` as the practical template
6. **Debug with** `WEBSOCKET_FIXES_AND_BEST_PRACTICES.md` when issues arise
7. **Consult** `CAITLYN_JS_API.md` for specific API details

This documentation suite represents the complete knowledge base for Caitlyn WASM integration, from high-level concepts to implementation details.

## Critical Reference Implementation

### Universe Initialization Test (`docs/test.js`)

**🚀 CRITICAL SAMPLE**: The `docs/test.js` file contains the definitive reference implementation for Caitlyn WASM universe initialization. This is the most important code example in the project for understanding the complete initialization flow.

#### **What it demonstrates:**

- **Complete Protocol Flow**: Handshake → Schema → Universe Revision → Universe Seeds
- **Proper WASM Integration**: Module loading, class verification, memory management
- **Correct Field Access Patterns**: Critical discovery that field[7] contains revisions JSON data
- **Market Data Processing**: Extraction of all global and private market information
- **Authentication Integration**: Proper token usage throughout the protocol
- **Error Handling**: Production-ready error handling and logging

#### **Key Technical Insights:**

```javascript
// Schema-based field access pattern (CRITICAL: Always use schema to determine field positions)
// Example: Market structure analysis from schema_decoder.js shows:
// Field 0: trade_day, Field 1: name, Field 2: time_zone, Field 7: revs

const tradeDay = sv.getInt32(0);         // Field 0: trade_day (NOT field 2 which is time_zone!)
const marketName = sv.getString(1);      // Field 1: display name
const revsJsonString = sv.getString(7);  // Field 7: revisions JSON data

// Proper WASM memory management
schema.delete();    // Always delete WASM objects
res.delete();      // Prevents memory leaks
pkg.delete();      // Required for all WASM instances
entry.delete();    // Delete StructValue entries from iteration
```

#### **Universe Initialization Sequence:**

1. **WASM Module Loading**: Load and verify essential classes
2. **WebSocket Connection**: Establish connection with proper handshake
3. **Schema Processing**: Load metadata definitions and initialize compressor
4. **Universe Revision**: Extract current market revision numbers
5. **Universe Seeds**: Request seed data for all market/qualified_name combinations

#### **Market Data Discovered:**

- **10 Global Markets**: CFFEX (中金所), CZCE (郑商所), DCE (大商所), DME, HUOBI (火币网), ICE, INE (上海国际能源交易中心), NYMEX, SGX (新交所), SHFE (上期所)
- **6 Qualified Names per Market**: Commodity, Dividend, Futures, Holiday, Security, Stock
- **60 Total Universe Seeds Requests**: Complete market coverage

#### **Usage as Reference:**

This file serves as the **canonical example** for:

- New developers learning Caitlyn WASM integration
- Debugging universe initialization issues
- Understanding the correct protocol message flow
- Implementing proper WASM memory management
- Learning field access patterns for StructValue objects

**📋 Run the test:** `node docs/test.js` to see the complete initialization sequence in action.

### StructValue Field Access Best Practices

#### **Schema-Based Field Mapping**

**CRITICAL PRINCIPLE**: Never hardcode field positions. Always use the schema definition to determine correct field offsets for StructValue objects.

**Correct Approach:**

1. **Use `schema_decoder.js` to analyze structures**:
```bash
cd docs && node schema_decoder.js | grep -A 20 "global::Market"
```

2. **Extract field mappings from schema output**:
```
Field 0: trade_day (type: Unknown([object Object]))
Field 1: name (type: Unknown([object Object]))  
Field 2: time_zone (type: Unknown([object Object]))
Field 7: revs (type: Unknown([object Object]))
```

3. **Apply correct field positions in code**:
```javascript
// CORRECT: Schema-based field access
const tradeDay = sv.getInt32(0);    // Field 0: trade_day
const name = sv.getString(1);       // Field 1: name  
const timeZone = sv.getString(2);   // Field 2: time_zone
const revisions = sv.getString(7);  // Field 7: revs

// INCORRECT: Hardcoded assumptions
const tradeDay = sv.getInt32(2);    // Wrong! Field 2 is time_zone, not trade_day
```

#### **Field Access Method Selection**

Use the correct accessor method based on field type:
- `getInt32(fieldIndex)` - for integer fields
- `getString(fieldIndex)` - for string fields  
- `getDouble(fieldIndex)` - for floating point fields
- `isEmpty(fieldIndex)` - to check if field has data

#### **Common Structure Field Mappings**

Based on `schema_decoder.js` analysis:

**Market Structure (ID: 3)**:
- Field 0: `trade_day` (int32) - Current trading day
- Field 1: `name` (string) - Market display name
- Field 2: `time_zone` (string) - Market timezone
- Field 7: `revs` (string) - JSON revision data

**Holiday Structure (ID: 4)**:
- Field 0: `rev` (int) - Revision number
- Field 1: `trade_day` (int32) - Holiday trade day
- Field 2: `days` (array) - Holiday dates

#### **Implementation Pattern**

```javascript
// 1. Load and analyze schema first
const schema = new caitlyn.IndexSchema();
schema.load(pkg.content());

// 2. Build field mapping reference
const fieldMappings = analyzeSchemaStructure(schema);

// 3. Use mappings for field access
if (sv.metaID === 3) { // Market structure
    const tradeDay = sv.getInt32(fieldMappings.Market.trade_day);  // Field 0
    const name = sv.getString(fieldMappings.Market.name);          // Field 1
    const revisions = sv.getString(fieldMappings.Market.revs);     // Field 7
}
```

### Recent Critical Fixes

See `docs/WEBSOCKET_FIXES_AND_BEST_PRACTICES.md` for complete details on:

- Memory leak resolution (IndexSchema cleanup)
- SharedArrayBuffer WebSocket restrictions
- Complete protocol message flow implementation
- React Context provider ordering fixes
- Debug level controls and testing procedures
- Schema-based field access corrections

---

## Summary

**Mini Wolverine** has been successfully refactored into a **modern backend-frontend architecture** that provides:

### ✅ **Complete WASM Separation**
- **Frontend**: Pure React UI with no WASM dependencies
- **Backend**: All WASM operations handled server-side with Node.js
- **Clean Architecture**: Clear separation of concerns and responsibilities

### ✅ **Production-Ready Features**
- **576 Schema Objects**: Full schema processing across 2 namespaces
- **Universe Processing**: Complete universe revision and seeds handling
- **WebSocket Proxy**: Seamless frontend ↔ backend ↔ Caitlyn server communication
- **Memory Management**: Proper WASM object lifecycle and cleanup
- **Comprehensive Testing**: Full test suite verifying all functionality

### ✅ **Development Benefits**
- **Docker Multi-Service**: Easy development with `docker-compose up -d`
- **Hot Reload**: Real-time development for both frontend and backend
- **Structured Logging**: Winston logger for backend operations
- **Debug Tools**: Comprehensive testing and monitoring capabilities

### 🎯 **Architecture Achievement**

The project demonstrates a **complete migration** from a frontend-WASM architecture to a **backend-WASM architecture** while maintaining 100% feature parity with the original `test.js` functionality.

**Data Flow:**
```
React Frontend (Port 3000)
    ↓ WebSocket API
Node.js Backend (Port 4000) 
    ↓ Binary Protocol + WASM
External Caitlyn Server
```

This architecture provides **optimal performance**, **security isolation**, and **scalability** for financial data processing applications.

**📖 For detailed implementation examples, always refer to the `docs/` folder and `backend/test-*.js` files for the latest information.**

---

**🚀 Mission Accomplished**: Mini Wolverine now provides a robust, scalable platform for financial market data processing with modern full-stack architecture and comprehensive WASM integration.
