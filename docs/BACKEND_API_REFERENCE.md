# Mini Wolverine Backend API Reference

This document provides a comprehensive reference for the backend API available to the frontend, including REST endpoints and WebSocket protocol specifications.

## Architecture Overview

The Mini Wolverine backend follows a **backend-frontend separation architecture** where:

- **Backend (Node.js)**: Handles all WASM operations, Caitlyn server communication, and data processing
- **Frontend (React)**: Pure UI layer with no WASM dependencies
- **Communication**: REST API for static data + WebSocket for real-time operations

```
Frontend (Port 3000) ↔ Backend API (Port 4000) ↔ Caitlyn Server
```

## Base URL

- **Development**: `http://localhost:4000`
- **WebSocket**: `ws://localhost:4000`

## Authentication

The backend handles authentication with the Caitlyn server using environment variables:
- `CAITLYN_TOKEN`: Required authentication token
- `CAITLYN_WS_URL`: Caitlyn server WebSocket URL (default: `wss://116.wolverine-box.com/tm`)

No frontend authentication is required - the backend acts as a proxy.

---

## REST API Endpoints

### Health and Status

#### `GET /api/health`

Returns backend health status and connection pool statistics.

**Response:**
```json
{
  "status": "healthy",
  "pool": {
    "totalConnections": 1,
    "activeConnections": 1,
    "availableConnections": 1,
    "pendingRequests": 0
  },
  "poolConfig": {
    "poolSize": 1,
    "maxPoolSize": 1,
    "connectionTimeout": 60000,
    "reconnectDelay": 5000,
    "maxReconnectAttempts": 2
  },
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Schema and Metadata

#### `GET /api/schema`

Returns the complete Caitlyn schema definition with metadata for all objects.

**Response:**
```json
{
  "global": {
    "3": {
      "name": "Market",
      "fields": [
        {
          "name": "trade_day",
          "type": "int32"
        },
        {
          "name": "name", 
          "type": "string"
        }
      ]
    }
  },
  "private": { /* private namespace objects */ }
}
```

#### `GET /api/markets`

Returns available markets from universe revision data.

**Response:**
```json
{
  "global": {
    "DCE": { /* market data */ },
    "SHFE": { /* market data */ },
    "CZCE": { /* market data */ }
  },
  "private": { /* private markets */ }
}
```

#### `GET /api/securities`

Returns securities data indexed by market.

**Response:**
```json
{
  "DCE": [
    {
      "codes": ["i<00>", "i<01>"],
      "names": ["Iron Ore Main", "Iron Ore Secondary"]
    }
  ],
  "SHFE": [
    {
      "codes": ["cu<00>", "cu<01>"],
      "names": ["Copper Main", "Copper Secondary"]
    }
  ]
}
```

### Market Data Queries

#### `GET /api/futures`

Alias for `/api/securities`. Returns all futures contracts.

#### `GET /api/futures/markets`

Returns array of available market names.

**Response:**
```json
["DCE", "SHFE", "CZCE", "CFFEX", "INE", "ICE", "NYMEX", "SGX", "DME", "HUOBI"]
```

#### `GET /api/futures/:market`

Returns futures contracts for a specific market.

**Parameters:**
- `market` (string): Market code (e.g., "DCE", "SHFE")

**Response:**
```json
[
  {
    "codes": ["i<00>", "i<01>"],
    "names": ["Iron Ore Main", "Iron Ore Secondary"]
  }
]
```

#### `GET /api/futures/search/:pattern`

Search futures contracts by symbol or name pattern.

**Parameters:**
- `pattern` (string): Search pattern
- `market` (query, optional): Limit search to specific market

**Example:** `/api/futures/search/iron?market=DCE`

**Response:**
```json
[
  {
    "symbol": "i<00>",
    "name": "Iron Ore Main Contract",
    "market": "DCE"
  }
]
```

---

## WebSocket API Protocol

Connect to `ws://localhost:4000` to establish a WebSocket connection.

### Connection Lifecycle

1. **Frontend connects** → Backend sends immediate status
2. **Backend sends cached data** (schema, markets, securities)
3. **Frontend sends requests** → Backend processes and responds
4. **Real-time data** flows continuously once subscriptions are active

### Message Format

All WebSocket messages use JSON format:

```json
{
  "type": "message_type",
  "data": { /* message-specific data */ },
  "requestId": "optional-request-id",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Frontend → Backend Messages

#### Connection Management

##### `connect`
**Deprecated** - Backend is pre-initialized, connection requests are ignored.

```json
{
  "type": "connect",
  "url": "wss://116.wolverine-box.com/tm", 
  "token": "auth-token"
}
```

##### `disconnect`
Gracefully disconnects from the Caitlyn server.

```json
{
  "type": "disconnect"
}
```

#### Data Retrieval

##### `get_schema`
Requests the current schema definition.

```json
{
  "type": "get_schema"
}
```

##### `get_client_info`
Requests client connection information.

```json
{
  "type": "get_client_info"
}
```

##### `query_cached_seeds`
Queries cached universe seeds data with optional timestamp filtering.

```json
{
  "type": "query_cached_seeds",
  "sinceTimestamp": 1672531200000
}
```

#### Historical Data Queries

##### `fetch_by_code`
Fetches historical data for a specific market/code combination.

```json
{
  "type": "fetch_by_code",
  "market": "DCE",
  "code": "i<00>",
  "fromTime": 1672531200,
  "toTime": 1672617600,
  "granularity": 86400,
  "fields": ["open", "close", "high", "low", "volume"],
  "metaName": "SampleQuote",
  "namespace": "global",
  "revision": -1
}
```

**Parameters:**
- `market` (string): Market code
- `code` (string): Security code  
- `fromTime` (number): Start time (Unix timestamp)
- `toTime` (number): End time (Unix timestamp)
- `granularity` (number): Time granularity in seconds
- `fields` (array): Requested field names
- `metaName` (string): Metadata type name
- `namespace` (string): "global" or "private"
- `revision` (number): Schema revision (-1 for latest)

##### `query_historical_by_code`
Alternative historical data query format.

```json
{
  "type": "query_historical_by_code",
  "params": {
    "market": "SHFE",
    "code": "cu<00>",
    "metaID": 123,
    "granularity": 3600,
    "startTime": 1672531200000,
    "endTime": 1672617600000,
    "namespace": "global",
    "qualifiedName": "SampleQuote",
    "fields": ["close", "volume"]
  }
}
```

#### Testing and Debugging

##### `test_universe_revision`
Tests universe revision data retrieval.

```json
{
  "type": "test_universe_revision"
}
```

##### `test_universe_seeds`
Tests universe seeds data retrieval.

```json
{
  "type": "test_universe_seeds"
}
```

### Backend → Frontend Messages

#### Connection Status

##### `connection_status`
Reports connection status to Caitlyn server.

```json
{
  "type": "connection_status",
  "status": "connected",
  "message": "Connected to pre-initialized Caitlyn server"
}
```

#### Schema and Metadata

##### `schema_received`
Delivers schema definition data.

```json
{
  "type": "schema_received",
  "data": {
    "global": { /* schema objects */ },
    "private": { /* schema objects */ }
  },
  "message": "Schema available from pre-initialized backend"
}
```

##### `markets_received`  
Delivers markets data.

```json
{
  "type": "markets_received",
  "data": {
    "global": { /* markets data */ },
    "private": { /* markets data */ }
  },
  "message": "Markets data available from pre-initialized backend"
}
```

##### `securities_received`
Delivers securities data.

```json
{
  "type": "securities_received", 
  "data": {
    "DCE": [{ /* security data */ }],
    "SHFE": [{ /* security data */ }]
  },
  "message": "Securities data available from pre-initialized backend"
}
```

#### Client Information

##### `client_info`
Provides client connection details.

```json
{
  "type": "client_info",
  "clientId": "client_123456",
  "assignedConnectionId": null,
  "isConnected": true,
  "cachedSeedsCount": 60
}
```

#### Historical Data Responses

##### `fetch_by_code_response`
Response to `fetch_by_code` requests.

```json
{
  "type": "fetch_by_code_response",
  "success": true,
  "data": {
    "records": [
      {
        "timestamp": 1672531200,
        "datetime": "2025-01-01T00:00:00.000Z",
        "market": "DCE",
        "code": "i<00>",
        "open": 850.25,
        "close": 852.75,
        "high": 855.00,
        "low": 848.50,
        "volume": 12580
      }
    ],
    "totalCount": 1,
    "processingTime": "2025-01-01T12:00:00.000Z",
    "source": "caitlyn_server",
    "fieldCount": 5
  },
  "message": "Historical data fetched successfully for DCE/i<00>",
  "queryParams": {
    "market": "DCE",
    "code": "i<00>",
    "fromTime": 1672531200,
    "toTime": 1672617600,
    "granularity": 86400,
    "fieldCount": 5
  }
}
```

##### `historical_query_response`
Response to alternative historical data queries.

```json
{
  "type": "historical_query_response", 
  "success": true,
  "message": "Historical data retrieved for SHFE/cu<00>",
  "data": {
    "records": [/* historical records */],
    "totalCount": 50,
    "processingTime": "2025-01-01T12:00:00.000Z"
  },
  "requestId": 1672531200000,
  "params": {
    "market": "SHFE",
    "code": "cu<00>",
    "granularity": 3600,
    "timeRange": "2025-01-01T00:00:00.000Z to 2025-01-02T00:00:00.000Z"
  }
}
```

#### Testing Responses

##### `universe_revision`
Response to universe revision tests.

```json
{
  "type": "universe_revision",
  "success": true,
  "marketsCount": 10,
  "globalMarkets": ["DCE", "SHFE", "CZCE"],
  "privateMarkets": []
}
```

##### `universe_seeds`
Response to universe seeds tests.

```json
{
  "type": "universe_seeds", 
  "success": true,
  "seedsReceived": 60,
  "totalEntries": 1500
}
```

#### Error Messages

All error responses follow this format:

```json
{
  "type": "response_type",
  "success": false,
  "error": "Error description",
  "requestId": "optional-request-id"
}
```

---

## Data Models

### Historical Record

```typescript
interface HistoricalRecord {
  timestamp: number;           // Unix timestamp
  datetime: string;            // ISO date string
  market: string;              // Market code
  code: string;                // Security code
  [fieldName: string]: any;    // Dynamic fields based on request
}
```

### Market Data

```typescript
interface MarketData {
  [marketCode: string]: {
    trade_day: number;
    name: string;
    time_zone: string;
    revs: string;              // JSON string with revision data
  }
}
```

### Security Data

```typescript
interface SecurityData {
  codes: string[];             // Array of security codes
  names: string[];             // Array of security names
}
```

### Schema Definition

```typescript
interface SchemaObject {
  name: string;                // Object name (e.g., "Market", "SampleQuote")
  fields: FieldDefinition[];   // Field definitions
}

interface FieldDefinition {
  name: string;                // Field name
  type: string;                // Field type
  index?: number;              // Field index
}
```

---

## Error Handling

### Connection Errors

- **Not Connected**: Backend not connected to Caitlyn server
- **Pool Exhausted**: No available connections in pool
- **Timeout**: Request exceeded timeout limit
- **Authentication**: Invalid or expired token

### Data Errors

- **Invalid Parameters**: Missing or malformed request parameters
- **Schema Not Found**: Requested metadata type not available
- **Market Not Found**: Invalid market code
- **No Data**: No data available for requested time range

### Error Response Format

```json
{
  "type": "error_response",
  "success": false,
  "error": "Detailed error message",
  "errorType": "connection_error|data_error|validation_error",
  "requestId": "optional-request-id",
  "params": { /* original request parameters */ }
}
```

---

## Performance Considerations

### Connection Pool

- **Single Connection**: Backend uses 1 connection to prevent WASM conflicts
- **Pre-initialization**: Schema and markets loaded on startup
- **Shared State**: All clients share cached data for efficiency

### Data Limits

- **Record Limit**: Historical queries limited to 100 records per request
- **Field Limit**: Maximum 20 fields per request to prevent crashes
- **Timeout**: 30-second timeout for historical data requests

### Caching Strategy

- **Schema**: Cached permanently until restart
- **Markets**: Cached permanently until restart  
- **Securities**: Cached permanently until restart
- **Historical Data**: Not cached (real-time requests)

---

## Integration Examples

### React Frontend Example

```javascript
// WebSocket connection
const ws = new WebSocket('ws://localhost:4000');

// Request historical data
ws.send(JSON.stringify({
  type: 'fetch_by_code',
  market: 'DCE',
  code: 'i<00>',
  fromTime: Math.floor(Date.now() / 1000) - 86400,
  toTime: Math.floor(Date.now() / 1000),
  granularity: 3600,
  fields: ['open', 'close', 'high', 'low', 'volume'],
  metaName: 'SampleQuote',
  namespace: 'global'
}));

// Handle response
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'fetch_by_code_response') {
    if (data.success) {
      console.log('Historical data:', data.data.records);
    } else {
      console.error('Error:', data.error);
    }
  }
};
```

### REST API Example

```javascript
// Fetch available markets
const marketsResponse = await fetch('http://localhost:4000/api/futures/markets');
const markets = await marketsResponse.json();

// Get securities for a specific market
const securitiesResponse = await fetch(`http://localhost:4000/api/futures/${markets[0]}`);
const securities = await securitiesResponse.json();

// Search for specific contracts
const searchResponse = await fetch('http://localhost:4000/api/futures/search/iron?market=DCE');
const searchResults = await searchResponse.json();
```

---

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check if backend is running on port 4000
   - Verify no firewall blocking connections

2. **No Schema Data**
   - Backend may still be initializing
   - Check backend logs for Caitlyn connection status

3. **Historical Data Timeout**
   - Reduce time range or field count
   - Check Caitlyn server connectivity

4. **Empty Response**
   - Verify market/code combination exists
   - Check time range is valid

### Debug Endpoints

- `GET /api/health` - Check backend status
- `GET /api/schema` - Verify schema loaded
- WebSocket message `get_client_info` - Check client status

---

This API reference provides comprehensive coverage of the Mini Wolverine backend API for frontend integration. The backend handles all WASM operations and Caitlyn server communication, providing a clean REST and WebSocket API for the React frontend.