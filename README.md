# 🐺 Mini Wolverine

**Empowering Financial Researchers and Engineers with Wolverine's Global Data Infrastructure**

A modern full-stack financial data processing application that enables financial researchers and engineers to leverage the powerful Wolverine ecosystem through a lightweight WASM binding (< 1MB). This **backend-frontend architecture** allows users to build fully functioning, rich visualization systems on top of Wolverine's comprehensive global datasets without the tedious work of building base infrastructure.

**Core Philosophy**: Fully functioning, minimized, and **AI-friendly** - perfect for AI coding agents like Cursor and Claude Code.

## 🎯 Project Vision

Mini Wolverine bridges the gap between complex financial infrastructure and practical application development:

- **🌍 Global Market Access**: Connect to different financial markets in real-time
- **🔧 Minimal Infrastructure**: Lightweight WASM binding eliminates heavy infrastructure work
- **🎨 Rich Visualization**: Build sophisticated financial dashboards and analysis tools
- **📈 Trading & Automation**: Simplified trading, backtesting, and automated execution features
- **🤖 AI-Ready Development**: Designed for AI coding agents and collaborative development
- **📚 Comprehensive Documentation**: Rich documentation ecosystem for rapid development

**Architecture**: Backend WASM + React Frontend + WebSocket Proxy + AI Coding Agent Ready

## 🚀 Quick Start

### Full-Stack Development

```bash
# Start backend (Node.js + WASM) and frontend (React) services
docker-compose up -d

# Access services:
# - Frontend UI: http://localhost:3000
# - Backend API: http://localhost:4000/api/health
```

### Environment Setup

```bash
# Configure Caitlyn server connection
cp .env.example .env
vim .env  # Set CAITLYN_WS_URL and CAITLYN_TOKEN
```


## 🏗️ Architecture Overview

### Backend-Frontend Separation

```
React Frontend (Port 3000)        Node.js Backend (Port 4000)
├── Pure React UI                 ├── Express REST API
├── WebSocket to Backend          ├── WebSocket Server
├── Context State Management      ├── WasmService (Caitlyn WASM)
├── Styled Components             ├── CaitlynWebSocketService
└── No WASM dependencies          └── All caitlyn_js.wasm processing
          │                                   │
          └─────── WebSocket API ─────────────┘
                           │
                    External Caitlyn Server
                   wss://116.wolverine-box.com/tm
```

### Tech Stack

**Frontend (React)**:
- React 18 with hooks and contexts
- Styled-components for CSS-in-JS
- WebSocket client for backend communication
- Responsive design with modern UI/UX

**Backend (Node.js)**:
- Express REST API server
- WebSocket proxy to Caitlyn servers
- Complete WASM integration (caitlyn_js.wasm)
- Winston logging and error handling
- Memory management for WASM objects

**Infrastructure**:
- Docker Compose multi-service setup
- Hot reload for both frontend and backend
- Environment-based configuration

### Project Structure

```
mini-wolverine/
├── frontend-react/              # Pure React UI (No WASM)
│   ├── src/
│   │   ├── components/          # React UI components
│   │   │   ├── Header.js        # Application header
│   │   │   ├── ConnectionControls.js  # Backend connection UI
│   │   │   ├── StatusSection.js # System status display
│   │   │   ├── TabSection.js    # Tabbed content (schema, data, historical)
│   │   │   ├── ActionsSection.js # Action buttons
│   │   │   └── Footer.js        # Application footer
│   │   ├── contexts/            # React state management
│   │   │   ├── BackendWebSocketContext.js  # Backend connection
│   │   │   └── DataContext.js   # Data from backend
│   │   └── App.js               # Main React component
│   └── Dockerfile.dev           # Frontend container
├── backend/                     # Node.js + WASM Backend
│   ├── src/
│   │   ├── services/
│   │   │   ├── WasmService.js   # All WASM operations
│   │   │   ├── CaitlynWebSocketService.js  # Caitlyn server proxy
│   │   │   └── CaitlynConnectionPool.js    # Connection pooling
│   │   ├── utils/
│   │   │   └── StructValueWrapper.js  # WASM object utilities
│   │   └── server.js            # Express + WebSocket server
│   ├── public/
│   │   ├── caitlyn_js.js        # WASM JavaScript wrapper
│   │   └── caitlyn_js.wasm      # WebAssembly binary
│   ├── test-*.js                # Comprehensive test suite
│   └── Dockerfile.dev           # Backend container
├── docs/                        # Comprehensive documentation
│   ├── CAITLYN_JS_API.md        # Complete API reference
│   ├── UNIVERSE_INITIALIZATION.md  # Protocol documentation
│   ├── WEBSOCKET_DATA_MANIPULATION_GUIDE.md  # Advanced patterns
│   └── test.js                  # Reference implementation
├── examples/
│   └── test.js                  # Universe initialization demo
├── docker-compose.yml           # Multi-service orchestration
└── CLAUDE.md                    # Detailed project guide
```

## ✨ Features

### 🌟 AI-Powered Financial Development
- **🤖 AI Coding Agent Ready**: Optimized for Cursor, Claude Code, and other AI development tools
- **📚 Rich Documentation**: Comprehensive guides enable AI agents to understand and extend the system
- **🔄 Rapid Iteration**: Hot reload and structured architecture perfect for AI-assisted development
- **💡 Extensible Design**: Clean separation allows AI agents to add features without complexity

### 🎯 Wolverine Integration Excellence
- **🪶 Lightweight WASM**: < 1MB binding provides full Wolverine ecosystem access
- **🌍 Global Market Coverage**: 10+ major financial markets (CFFEX, DCE, SHFE, NYMEX, etc.)
- **⚡ Real-time Processing**: Live market data streaming with minimal latency
- **📊 Complete Protocol**: Full NetPackage encoding/decoding with 576 schema objects
- **🔗 WebSocket Proxy**: Intelligent backend proxy eliminates infrastructure complexity
- **📈 Trading Integration**: Simplified versions of Wolverine's flagship trading and automation features

### 🚀 Production-Ready Architecture
- **🏗️ Backend-Frontend Separation**: React UI + Node.js WASM processing
- **💾 Memory Management**: Proper WASM object lifecycle and cleanup patterns
- **🔄 Connection Pooling**: Efficient connection management with automatic reconnection
- **📈 Historical Data**: ATFetchByCode and ATFetchByTime implementation
- **🛡️ Error Recovery**: Production-ready error handling and logging
- **🐳 Docker Integration**: Complete containerized development environment

### 🎨 Visualization & User Experience
- **📱 Responsive Design**: Modern React UI with styled-components
- **📊 Rich Data Display**: Table views, charts, and real-time updates
- **📤 Data Export**: JSON export functionality for further analysis
- **🎛️ Interactive Controls**: Connection management and data exploration tools
- **🔍 Schema Explorer**: Visual exploration of available data structures

## 🔧 Development Workflow

### Full-Stack Development

```bash
# Start complete development environment
docker-compose up -d

# Services:
# - Backend: Node.js + WASM processing (Port 4000)
# - Frontend: React development server (Port 3000)
# - Hot reload enabled for both services
```

### Backend Development

```bash

node examples/test.js --url <ws_url> --token <token>  # Universe initialization

# Backend features:
# - All WASM operations (schema, universe, data fetching)
# - WebSocket proxy to Caitlyn servers
# - Memory management and cleanup
# - Winston logging with configurable levels
```

### Frontend Development

```bash
# Frontend connects to backend via WebSocket
# - Pure React UI with no WASM dependencies
# - Real-time updates from backend processing
# - Context-based state management
# - Responsive design with styled-components
```


## 🎮 Getting Started

### 1. Environment Setup

```bash
git clone <repository>
cd mini-wolverine

# Configure Caitlyn server connection
cp .env.example .env
# Edit .env with your Caitlyn server details:
# CAITLYN_WS_URL=wss://116.wolverine-box.com/tm
# CAITLYN_TOKEN=your-auth-token
```

### 2. Start Services

```bash
# Start backend + frontend services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f react-app
```

### 3. Access Application

- **Frontend UI**: http://localhost:3000
- **Backend API**: http://localhost:4000/api/health
- **Schema API**: http://localhost:4000/api/schema
- **Markets API**: http://localhost:4000/api/markets

### 4. Test WASM Integration

```bash
# Test universe initialization (requires valid token)
node examples/test.js --url wss://116.wolverine-box.com/tm --token <your-token>

# Test backend WASM capabilities
node backend/test-backend-capabilities.js
```

## 🤖 AI-Powered Development

### Perfect for AI Coding Agents

Mini Wolverine is specifically designed to work seamlessly with AI coding agents like **Cursor** and **Claude Code**:

**Why AI Agents Love Mini Wolverine:**
- **📚 Rich Documentation**: Comprehensive `docs/` folder provides context for AI understanding
- **🏗️ Clean Architecture**: Clear separation of concerns makes it easy for AI to navigate
- **🔧 Modular Design**: Each component has single responsibility, perfect for AI modification
- **📋 Reference Implementations**: Complete examples guide AI agents in proper patterns
- **🧪 Comprehensive Testing**: Full test suite validates AI-generated changes
- **📝 Structured Codebase**: Consistent patterns and naming conventions

**AI Development Workflow:**
```bash
# 1. AI Agent analyzes documentation
# docs/ folder provides complete system understanding

# 2. AI Agent identifies extension points
# Clean interfaces in services/ and components/

# 3. AI Agent implements features
# Following established patterns and memory management

# 4. AI Agent validates with testing
# Comprehensive test suite ensures correctness
```

### AI-Assisted Feature Development

## 🔧 Adding New Features

### Backend WASM Features (AI-Friendly)

```javascript
// backend/src/services/WasmService.js
class WasmService {
  // Add new WASM operation
  processNewDataType(content) {
    const response = new this.module.NewDataTypeResponse();
    response.setCompressor(this.compressor);
    response.decode(content);
    
    // Process data...
    const results = response.getData();
    
    // Always cleanup WASM objects
    response.delete();
    return results;
  }
  
  createNewRequest(params) {
    const request = new this.module.NewDataTypeRequest(
      params.token,
      params.sequence,
      params.market,
      params.symbol
    );
    
    const pkg = new this.module.NetPackage();
    const encoded = pkg.encode(this.module.CMD_NEW_DATA_TYPE, request.encode());
    
    // Copy to regular ArrayBuffer for WebSocket
    const buffer = new ArrayBuffer(encoded.byteLength);
    new Uint8Array(buffer).set(new Uint8Array(encoded));
    
    // Cleanup
    request.delete();
    pkg.delete();
    
    return buffer;
  }
}
```

### Frontend React Features

```jsx
// frontend-react/src/components/NewFeature.js
import React from 'react';
import styled from 'styled-components';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';
import { useData } from '../contexts/DataContext';

const Container = styled.div`
  padding: 20px;
  background: var(--card-background);
  border-radius: var(--border-radius);
`;

function NewFeature() {
  const { isConnected, actions: wsActions } = useBackendWebSocket();
  const { data, actions: dataActions } = useData();
  
  const handleNewRequest = () => {
    if (isConnected) {
      // Send request to backend
      wsActions.sendMessage(JSON.stringify({
        type: 'new_data_request',
        params: {
          market: 'DCE',
          symbol: 'i2501',
          timeframe: '1m'
        }
      }));
    }
  };
  
  return (
    <Container>
      <h3>New Feature</h3>
      <button onClick={handleNewRequest} disabled={!isConnected}>
        Request New Data
      </button>
    </Container>
  );
}

export default NewFeature;
```

## 🔌 Integration Architecture

### Backend-Frontend Communication

```javascript
// Frontend → Backend WebSocket Messages
const wsActions = useBackendWebSocket();

// Connect to Caitlyn server via backend
wsActions.connectToCaitlyn({
  url: 'wss://116.wolverine-box.com/tm',
  token: 'your-auth-token'
});

// Request historical data
wsActions.sendMessage(JSON.stringify({
  type: 'request_historical',
  params: {
    market: 'DCE',
    symbol: 'i2501',
    granularity: 86400,  // Daily
    from: '2025-01-01',
    to: '2025-08-31'
  }
}));

// Backend processes WASM and responds
```

### WASM Memory Management

```javascript
// backend/src/services/WasmService.js - CRITICAL PATTERNS

// ✅ CORRECT: Always delete WASM objects
processData(content) {
  const response = new this.module.ATFetchSVRes();
  response.setCompressor(this.compressor);
  response.decode(content);
  
  const results = response.results();
  // Process results...
  
  // CRITICAL: Delete WASM objects
  response.delete();  // Always delete
  return processedData;
}

// ✅ CORRECT: Schema-based field access
processStructValue(sv) {
  // Use schema to determine field positions
  const tradeDay = sv.getInt32(0);    // Field 0: trade_day
  const name = sv.getString(1);       // Field 1: name
  const revisions = sv.getString(7);  // Field 7: revs
  
  // Always cleanup
  sv.delete();
}
```

### Historical Data System

```javascript
// Complete flow: Frontend → Backend → Caitlyn → WASM → Response

// 1. Frontend requests data
const { actions } = useData();
actions.requestHistoricalData({
  market: 'SHFE',
  symbol: 'au2502',
  timeframe: '1h',
  lookback: 30  // days
});

// 2. Backend processes with WASM
// - Creates ATFetchByCode request
// - Sends to Caitlyn server
// - Receives binary response
// - Decodes with WASM compressor
// - Extracts StructValue data
// - Sends JSON to frontend

// 3. Frontend receives processed data
useEffect(() => {
  // Data automatically updated via DataContext
  if (historicalData.size > 0) {
    // Display charts, tables, export options
  }
}, [historicalData]);
```

## 🏗️ Backend WASM Architecture

### Complete WASM Integration

The backend provides full Caitlyn WASM functionality:

**Core Services**:
- **WasmService**: All WASM operations (schema, universe, data processing)
- **CaitlynWebSocketService**: WebSocket proxy with connection pooling
- **CaitlynConnectionPool**: Efficient connection management
- **StructValueWrapper**: Python-like interface for WASM objects

### Protocol Implementation

```javascript
// Complete Caitlyn protocol support:

// 1. Authentication
handshake: { cmd: 20512, token: 'auth', protocol: 1 }

// 2. Schema Definition (server push)
NET_CMD_GOLD_ROUTE_DATADEF → 576 metadata objects

// 3. Universe Revision
CMD_AT_UNIVERSE_REV → Market metadata with revisions JSON

// 4. Universe Seeds (per market)
CMD_AT_UNIVERSE_SEEDS → Seed data for each market/qualified_name

// 5. Historical Data Fetching
CMD_AT_FETCH_BY_CODE → Time series data with compression
CMD_AT_FETCH_BY_TIME → Point-in-time data retrieval

// 6. Real-time Data
CMD_AT_SUBSCRIBE → Live market data streaming
```

### Production Features

- **Memory Management**: Proper WASM object lifecycle with cleanup
- **Error Recovery**: Automatic reconnection and error handling
- **Logging**: Structured Winston logging with debug levels
- **Testing**: Comprehensive test suite for all WASM operations
- **Schema Processing**: Dynamic field mapping and validation
- **Connection Pooling**: Efficient resource management

## 📊 Data Processing & Visualization

### Real-time Market Data

**Current Implementation**:
- **Schema Viewer**: 576 metadata objects across global/private namespaces
- **Market Data**: 10+ global markets (DCE, SHFE, CFFEX, NYMEX, etc.)
- **Historical Data**: ATFetchByCode integration with time series
- **Live Updates**: WebSocket streaming with real-time processing
- **Export System**: JSON export for historical datasets

### Market Coverage

```javascript
// Supported Markets (discovered via universe initialization)
const globalMarkets = [
  'CFFEX',  // 中金所 - China Financial Futures Exchange
  'CZCE',   // 郑商所 - Zhengzhou Commodity Exchange  
  'DCE',    // 大商所 - Dalian Commodity Exchange
  'DME',    // Dubai Mercantile Exchange
  'HUOBI',  // 火币网 - Huobi Exchange
  'ICE',    // Intercontinental Exchange
  'INE',    // 上海国际能源交易中心 - Shanghai International Energy Exchange
  'NYMEX',  // New York Mercantile Exchange
  'SGX',    // 新交所 - Singapore Exchange
  'SHFE'    // 上期所 - Shanghai Futures Exchange
];

// Each market supports multiple qualified names:
// Commodity, Dividend, Futures, Holiday, Security, Stock
```

### Advanced Visualization Ready

```jsx
// Recharts integration for financial charts
import { LineChart, CandlestickChart, XAxis, YAxis } from 'recharts';

function FinancialChart({ historicalData }) {
  return (
    <CandlestickChart width={1000} height={400} data={historicalData}>
      <XAxis dataKey="timestamp" />
      <YAxis domain={['dataMin', 'dataMax']} />
      <Candlestick dataKey={['open', 'high', 'low', 'close']} />
    </CandlestickChart>
  );
}
```

## 🚢 Deployment & Configuration

### Development Deployment

```bash
# Start full-stack development
docker-compose up -d

# Monitor services
docker-compose logs -f backend    # WASM + WebSocket processing
docker-compose logs -f react-app  # React UI development

# Health checks
curl http://localhost:4000/api/health  # Backend API
open http://localhost:3000            # Frontend UI
```

### Environment Configuration

```bash
# .env file configuration

# Backend Configuration
PORT=4000
LOG_LEVEL=info
CAPITAL_WS_URL=wss://116.wolverine-box.com/tm
CAPITAL_TOKEN=your-caitlyn-auth-token
CAPITAL_CONNECTION_TIMEOUT=30000
CAPITAL_RECONNECT_DELAY=5000
CAPITAL_MAX_RECONNECT_ATTEMPTS=3

# Frontend Configuration  
REACT_APP_BACKEND_WS_URL=ws://localhost:4000
CHOKIDAR_USEPOLLING=true  # For Docker file watching

# Production overrides
# REACT_APP_BACKEND_WS_URL=wss://your-domain.com/api/ws
# LOG_LEVEL=warn
```

### Production Considerations

- **Security**: Proper CORS and WebSocket security headers
- **Performance**: Connection pooling and WASM memory management
- **Monitoring**: Winston logging with structured output
- **Scaling**: Backend can handle multiple frontend connections
- **Health**: REST API endpoints for service monitoring

## 🔧 Configuration

### Docker Compose Profiles

- **development**: React dev server with hot reload
- **production**: Optimized build with Nginx

### Environment Variables

#### React App
- `REACT_APP_WS_URL`: WebSocket server URL
- `NODE_ENV`: Environment (development/production)
- `CHOKIDAR_USEPOLLING`: Enable file watching in Docker

#### Backend
- `WS_PORT`: WebSocket server port (default: 3009)
- `NODE_ENV`: Server environment

## 📚 Comprehensive Documentation

### Essential Reading
- **[CLAUDE.md](./CLAUDE.md)** - Complete project guide with architecture details
- **[docs/CAITLYN_JS_API.md](./docs/CAITLYN_JS_API.md)** - Complete WASM API reference
- **[docs/UNIVERSE_INITIALIZATION.md](./docs/UNIVERSE_INITIALIZATION.md)** - Protocol initialization guide
- **[docs/WEBSOCKET_DATA_MANIPULATION_GUIDE.md](./docs/WEBSOCKET_DATA_MANIPULATION_GUIDE.md)** - Advanced data manipulation

### Reference Implementations
- **[examples/test.js](./examples/test.js)** - Complete universe initialization demo
- **[backend/test-backend-core.js](./backend/test-backend-core.js)** - Full integration test
- **[backend/src/utils/StructValueWrapper.js](./backend/src/utils/StructValueWrapper.js)** - Python-like WASM interface

### API Documentation
- **REST API**: `GET /api/health`, `/api/schema`, `/api/markets`
- **WebSocket API**: Backend-frontend message protocol
- **WASM Integration**: Complete command constants and class references

### Development Guides
- **Memory Management**: Proper WASM object cleanup patterns
- **Schema Processing**: Dynamic field mapping and validation
- **Error Handling**: Production-ready error recovery strategies

## 🤝 Contributing

1. **Development Setup**
   ```bash
   docker-compose --profile development up
   ```

2. **Code Standards**
   - Use React hooks and functional components
   - Style with styled-components
   - Follow responsive design patterns
   - Add proper error handling

3. **Testing**
   ```bash
   cd frontend-react
   npm test
   ```

## 📄 License

This project is designed as a demonstration and reference implementation. See individual component licenses for specific terms.

## 🚀 Current Status & Future Opportunities

### ✅ Fully Functioning Foundation

**Core Infrastructure (Production Ready)**:
- ✅ **Wolverine Integration**: Complete WASM binding (< 1MB) with 576 schema objects
- ✅ **Global Market Access**: Real-time connection to 10+ financial markets
- ✅ **AI-Ready Architecture**: Optimized for Cursor, Claude Code, and AI development
- ✅ **Rich Documentation**: Comprehensive guides enabling rapid AI-assisted development
- ✅ **Memory Management**: Production-grade WASM object lifecycle handling
- ✅ **Testing Suite**: Complete validation framework for reliable development

**User Experience (Complete)**:
- ✅ **Responsive UI**: Modern React interface with real-time updates
- ✅ **WebSocket Communication**: Seamless backend-frontend data flow  
- ✅ **Data Visualization**: Interactive tables, charts, and export functionality
- ✅ **Docker Development**: Hot reload environment for rapid iteration

**Developer Experience (AI-Optimized)**:
- ✅ **Clean Codebase**: Structured architecture perfect for AI navigation
- ✅ **Reference Implementations**: Complete examples guide proper patterns
- ✅ **Environment Configuration**: Flexible deployment scenarios
- ✅ **Error Handling**: Production-ready recovery and logging

### 🎯 Roadmap: Trading & Automation Features

**🔥 Upcoming: Simplified Trading Suite**
Mini Wolverine will include **simplified and minimized** versions of Wolverine's flagship trading capabilities:

**📈 Trading Operations (Slim Implementation)**:
- **Manual Trading**: Simplified order entry and management interface
- **Portfolio Management**: Real-time position tracking and P&L monitoring  
- **Risk Controls**: Basic risk management and position sizing tools
- **Order Types**: Support for market, limit, stop, and conditional orders

**🤖 Automated Strategy Execution (Minimized)**:
- **Strategy Builder**: Visual strategy construction with drag-and-drop components
- **Backtesting Engine**: Streamlined historical strategy validation
- **Paper Trading**: Risk-free strategy testing with live market data
- **Auto-Execution**: Simplified automated order execution system

**⚡ Real-time Automation (AI-Friendly)**:
- **Signal Processing**: Real-time market signal detection and processing
- **Event-Driven Trading**: Automated responses to market events and conditions
- **Performance Analytics**: Real-time strategy performance monitoring
- **Alert System**: Customizable notifications for trading opportunities

**🎯 Integration Philosophy**: 
All trading features will maintain Mini Wolverine's core principles:
- **Lightweight Implementation**: Slim versions of flagship Wolverine features
- **AI-Assisted Development**: Easy for AI agents to understand and extend
- **Production Ready**: Fully functional despite being minimized
- **Rich Documentation**: Comprehensive guides for rapid development

### 🚀 AI-Assisted Extension Opportunities

**Enhanced Visualization (AI-Friendly)**:
- Advanced charting libraries (Recharts/D3.js integration)
- Technical indicators and financial analysis tools
- Real-time candlestick and multi-timeframe charts
- Custom dashboard creation with drag-and-drop

**Advanced Analytics (Perfect for AI Development)**:
- Machine learning model integration
- Quantitative research and model validation
- Risk management and portfolio optimization
- Market sentiment analysis and correlation studies

**Enterprise Features (Scalable Architecture)**:
- Multi-user authentication and sessions
- Real-time collaborative analysis and trading
- Advanced data export (CSV, Excel, PDF reports)
- Performance monitoring and alerting systems

### 🎉 Mission: Complete Financial Trading Platform

**Mini Wolverine** delivers a **complete, minimized, and AI-friendly** financial infrastructure that empowers researchers and engineers to build sophisticated trading and analysis applications on Wolverine's global data ecosystem **without infrastructure complexity**.

**Current Status**: Production-ready data processing and visualization platform
**Next Phase**: Adding simplified trading, backtesting, and automated execution capabilities from Wolverine's flagship features

**Perfect for**: 
- **Financial Researchers**: Access to global market data and analysis tools
- **Quantitative Analysts**: Backtesting and strategy development platform
- **Algorithmic Traders**: Automated execution and risk management systems
- **Fintech Developers**: Complete trading infrastructure foundation
- **AI Coding Agents**: Structured, documented codebase for rapid extension

---

**Mini Wolverine** - A modern, scalable foundation for financial data applications. Built with React, WebAssembly, and Docker for professional development workflows.