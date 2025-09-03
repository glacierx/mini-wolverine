# Caitlyn WASM Global Structures Reference

This document provides a comprehensive reference of all global data structures discovered through reverse engineering the Caitlyn WASM module and WebSocket protocol analysis.

## Table of Contents

1. [Schema Structure](#schema-structure)
2. [Market Data Structure](#market-data-structure)
3. [Universe Revision Structure](#universe-revision-structure)
4. [Field Access Patterns](#field-access-patterns)
5. [Command Constants](#command-constants)
6. [WASM Class Hierarchy](#wasm-class-hierarchy)
7. [Protocol Flow](#protocol-flow)

## Schema Structure

### Global Schema Layout

The schema is organized into two main namespaces:

```javascript
_schema = {
  '0': {  // Global namespace (public data)
    '1': IndexMeta {},  // Global metadata definitions
    '2': IndexMeta {},
    '3': IndexMeta {},  // Market metadata (critical for universe initialization)
    // ... more metadata IDs
  },
  '1': {  // Private namespace (private data)
    '1': IndexMeta {},  // Private metadata definitions
    '2': IndexMeta {},
    '3': IndexMeta {},  // Private Market metadata
    // ... more metadata IDs
  }
}
```

### IndexMeta Structure

Each IndexMeta object contains:
- `namespace`: 0 (global) or 1 (private)
- `ID`: Unique identifier within namespace
- `name`: Human-readable name (e.g., "global::Market", "private::Market")
- `fields`: Collection of field definitions with types

### Field Types

Field types are enumerated as:
```javascript
const FIELD_TYPES = {
  0: 'INT',     // 32-bit integer
  1: 'DOUBLE',  // Double precision float
  2: 'STRING',  // String data
  3: 'INT64'    // 64-bit integer
};
```

## Market Data Structure

### Discovered Markets (Global Namespace)

```javascript
const GLOBAL_MARKETS = {
  'CFFEX': {
    name: '中金所',  // China Financial Futures Exchange
    revisions: {
      'Commodity': 1802,
      'Dividend': 1789,
      'Futures': 3276,
      'Holiday': 1799,
      'Security': 1904,
      'Stock': 1789
    }
  },
  'CZCE': {
    name: '郑商所',  // Zhengzhou Commodity Exchange
    revisions: {
      'Commodity': 1821,
      'Dividend': 1782,
      'Futures': 6330,
      'Holiday': 1794,
      'Security': 2070,
      'Stock': 1782
    }
  },
  'DCE': {
    name: '大商所',  // Dalian Commodity Exchange
    revisions: {
      'Commodity': 1856,
      'Dividend': 1783,
      'Futures': 6606,
      'Holiday': 1797,
      'Security': 1964,
      'Stock': 1783
    }
  },
  'DME': {
    name: 'DME',  // Dubai Mercantile Exchange
    revisions: {
      'Commodity': 1989,
      'Dividend': 1865,
      'Futures': 2226,
      'Holiday': 1902,
      'Security': 2113,
      'Stock': 1865
    }
  },
  'HUOBI': {
    name: '火币网',  // Huobi Exchange
    revisions: {
      'Commodity': 9,
      'Dividend': 9,
      'Futures': 9,
      'Holiday': 9,
      'Security': 68,
      'Stock': 9
    }
  },
  'ICE': {
    name: 'ICE',  // Intercontinental Exchange
    revisions: {
      'Commodity': 2128,
      'Dividend': 2046,
      'Futures': 4569,
      'Holiday': 2082,
      'Security': 2651,
      'Stock': 2046
    }
  },
  'INE': {
    name: '上海国际能源交易中心',  // Shanghai International Energy Exchange
    revisions: {
      'Commodity': 1298,
      'Dividend': 1274,
      'Futures': 1760,
      'Holiday': 1282,
      'Security': 1425,
      'Stock': 1274
    }
  },
  'NYMEX': {
    name: 'NYMEX',  // New York Mercantile Exchange
    revisions: {
      'Commodity': 4452,
      'Dividend': 4382,
      'Futures': 8218,
      'Holiday': 4425,
      'Security': 5169,
      'Stock': 4382
    }
  },
  'SGX': {
    name: '新交所',  // Singapore Exchange
    revisions: {
      'Commodity': 1621,
      'Dividend': 1607,
      'Futures': 2099,
      'Holiday': 1613,
      'Security': 1686,
      'Stock': 1606
    }
  },
  'SHFE': {
    name: '上期所',  // Shanghai Futures Exchange
    revisions: {
      'Commodity': 1803,
      'Dividend': 1783,
      'Futures': 5843,
      'Holiday': 1792,
      'Security': 1962,
      'Stock': 1783
    }
  }
};
```

### Private Markets

```javascript
const PRIVATE_MARKETS = {
  'EINSTEIN': {
    name: 'EINSTEIN',
    revisions: {}  // Empty - no active revisions
  },
  'MTM': {
    name: 'MTM',
    revisions: {}  // Empty - no active revisions
  },
  'STRATEGY': {
    name: 'STRATEGY',
    revisions: {}  // Empty - no active revisions
  }
};
```

## Universe Revision Structure

### ATUniverseRes Response Structure

```javascript
const UNIVERSE_REVISION_RESPONSE = {
  revs: {  // RevisionMap (string → StructValueConstVector)
    'global': [
      {
        metaID: 3,  // Market metadata ID
        namespace: 0,  // Global namespace
        stockCode: 'CFFEX',  // Market identifier
        timeTag: <timestamp>,
        market: <market_name>,
        granularity: <granularity_value>,
        // Field access patterns:
        // field[1]: Market display name
        // field[7]: JSON string containing revisions data
      },
      // ... more StructValue entries for other markets
    ],
    'private': [
      // Similar structure for private namespace markets
    ]
  }
};
```

## Field Access Patterns

### Critical Discovery: Market Metadata Field Layout

For Market metadata (metaID = 3), the field structure is:

```javascript
const MARKET_METADATA_FIELDS = {
  0: 'Unknown',
  1: 'Market Display Name (STRING)',  // e.g., "中金所", "郑商所"
  2: 'Unknown',
  3: 'Unknown',
  4: 'Unknown',
  5: 'Unknown',
  6: 'Unknown',
  7: 'Revisions JSON Data (STRING)',  // Critical: Contains {"Commodity":1802,"Futures":3276,...}
  // ... additional fields
};
```

### StructValue Field Access Methods

```javascript
// Field access based on type
const FIELD_ACCESS_METHODS = {
  INT: 'sv.getInt32(fieldIndex)',
  DOUBLE: 'sv.getDouble(fieldIndex)', 
  STRING: 'sv.getString(fieldIndex)',
  INT64: 'sv.getInt64(fieldIndex)'
};

// Check if field is empty
const isEmpty = sv.isEmpty(fieldIndex);
```

## Command Constants

### WebSocket Protocol Commands

```javascript
const CAITLYN_COMMANDS = {
  // Network layer commands
  NET_CMD_GOLD_ROUTE_DATADEF: 26216,    // Schema definition
  NET_CMD_GOLD_ROUTE_KEEPALIVE: <value>, // Keepalive messages
  
  // Application layer commands
  CMD_AT_UNIVERSE_REV: 20483,           // Universe revision request/response
  CMD_AT_UNIVERSE_SEEDS: <value>,       // Universe seeds request/response
  CMD_AT_FETCH_BY_CODE: <value>,        // Fetch by code
  CMD_AT_FETCH_BY_TIME: <value>,        // Fetch by time
  CMD_AT_SUBSCRIBE: <value>,            // Subscribe to data
  CMD_AT_UNSUBSCRIBE: <value>,          // Unsubscribe from data
  
  // Trading commands
  CMD_AT_MANUAL_TRADE: <value>,         // Manual trade
  CMD_AT_MANUAL_EDIT: <value>,          // Edit manual trade
  
  // Account management
  CMD_AT_ACCOUNT_ADD: <value>,          // Add account
  CMD_AT_ACCOUNT_EDIT: <value>,         // Edit account
  CMD_AT_ACCOUNT_DEL: <value>,          // Delete account
  
  // Strategy management
  CMD_AT_ADD_STRATEGY_INSTANCE: <value>, // Add strategy instance
  CMD_AT_DEL_STRATEGY_INSTANCE: <value>, // Delete strategy instance
  CMD_AT_EDIT_STRATEGY_INSTANCE: <value>, // Edit strategy instance
  CMD_AT_QUERY_STRATEGY_INSTANCE: <value>, // Query strategy instance
  
  // Backtesting
  CMD_AT_START_BACKTEST: <value>,       // Start backtest
  CMD_AT_CTRL_BACKTEST: <value>,        // Control backtest
  CMD_AT_SHARE_BACKTEST: <value>,       // Share backtest
  
  // Market data
  CMD_TA_MARKET_STATUS: <value>,        // Market status
  CMD_TA_PUSH_DATA: <value>,            // Push market data
  CMD_TA_MARKET_SINGULARITY: <value>,   // Market singularity
  
  // Formula and calculation
  CMD_AT_RUN_FORMULA: <value>,          // Run formula
  CMD_AT_REG_FORMULA: <value>,          // Register formula
  CMD_AT_DEL_FORMULA: <value>,          // Delete formula
  CMD_AT_CAL_FORMULA: <value>,          // Calculate formula
  
  // Library management
  CMD_AT_REG_LIBRARIES: <value>,        // Register libraries
  CMD_AT_MODIFY_BASKET: <value>,        // Modify basket
  
  // Debug and system
  CMD_AT_DEBUG_LIVE: <value>,           // Debug live
  CMD_AT_DEBUG_COVERUP: <value>,        // Debug coverup
  CMD_AT_DEBUG_ADD_ACCOUNT: <value>,    // Debug add account
  CMD_AT_HANDSHAKE: <value>,            // Handshake
  CMD_AT_QUERY_ORDERS: <value>          // Query orders
};
```

## WASM Class Hierarchy

### Core Classes

```javascript
const WASM_CORE_CLASSES = {
  // Network and serialization
  'NetPackage': 'Binary message container with header and content',
  'IndexSchema': 'Schema definition container',
  'IndexSerializer': 'Data compression/decompression engine',
  'IndexMeta': 'Metadata definition with fields',
  
  // Data structures
  'StructValue': 'Dynamic data container with typed field access',
  'RevisionMap': 'Map from string keys to StructValueConstVector',
  'StructValueConstVector': 'Vector of StructValue objects',
  
  // Request classes
  'ATUniverseReq': 'Universe revision request',
  'ATUniverseSeedsReq': 'Universe seeds request',
  'ATFetchByCodeReq': 'Fetch by code request',
  'ATFetchByTimeReq': 'Fetch by time request',
  'ATSubscribeReq': 'Subscribe request',
  'ATUnsubscribeReq': 'Unsubscribe request',
  'ATBaseRequest': 'Base request class',
  'ATBaseFormulaReq': 'Base formula request',
  
  // Response classes
  'ATUniverseRes': 'Universe revision response',
  'ATUniverseSeedsRes': 'Universe seeds response', 
  'ATFetchSVRes': 'Fetch StructValue response',
  'ATSubscribeRes': 'Subscribe response',
  'ATBaseResponse': 'Base response class',
  
  // Trading classes
  'ATManualTradeReq': 'Manual trade request',
  'ATManualTradeRes': 'Manual trade response',
  'ATManualTradeEditReq': 'Manual trade edit request',
  
  // Account management
  'ATAccountAddReq': 'Add account request',
  'ATAccountAddRes': 'Add account response',
  'ATAccountEditReq': 'Edit account request',
  'ATAccountDelReq': 'Delete account request',
  
  // Strategy management
  'ATAddStrategyInstanceReq': 'Add strategy instance request',
  'ATAddStrategyInstanceRes': 'Add strategy instance response',
  'ATDelStrategyInstanceReq': 'Delete strategy instance request',
  'ATEditStrategyInstanceReq': 'Edit strategy instance request',
  'ATQueryStrategyInstanceReq': 'Query strategy instance request',
  'ATQueryStrategyInstanceRes': 'Query strategy instance response',
  'ATQueryStrategyInstanceLogReq': 'Query strategy instance log request',
  
  // Backtesting
  'ATStartBacktestReq': 'Start backtest request',
  'ATStartBacktestRes': 'Start backtest response',
  'ATControlBacktestReq': 'Control backtest request',
  
  // Formula and calculation
  'ATRegFormulaRes': 'Register formula response',
  'ATDelFormulaReq': 'Delete formula request',
  'ATCalFormulaRes': 'Calculate formula response',
  
  // Library management
  'ATRegLibrariesReq': 'Register libraries request',
  'ATRegLibrariesRes': 'Register libraries response',
  'ATModifyBasketReq': 'Modify basket request'
};
```

### Class Constructor Patterns

```javascript
// Request classes typically take (token, sequence_id, ...)
const REQUEST_PATTERNS = {
  'ATUniverseReq': '(token, sequence_id)',
  'ATUniverseSeedsReq': '(token, sequence_id, revision, namespace, qualified_name, market_code, trade_day)',
  'ATFetchByCodeReq': '(token, sequence_id, ...)',
  'ATSubscribeReq': '(token, sequence_id)',
};

// Response classes vary in constructor requirements
const RESPONSE_PATTERNS = {
  'ATUniverseRes': '() - requires setCompressor() before decode()',
  'ATUniverseSeedsRes': '() - requires setCompressor() before decode()',
  'ATFetchSVRes': '() - requires setCompressor() before decode()',
  'ATSubscribeRes': '(sequence_id, token)',
  'ATBaseResponse': '() - no setCompressor() method',
};
```

## Protocol Flow

### Complete Universe Initialization Sequence

```javascript
const INITIALIZATION_FLOW = {
  1: {
    trigger: 'WebSocket Connection Established',
    client_sends: 'Handshake JSON message',
    message: '{"cmd":20512, "token":"<TOKEN>", "protocol":1, "seq":1}'
  },
  
  2: {
    trigger: 'Server Response',
    server_sends: 'NET_CMD_GOLD_ROUTE_DATADEF (26216)',
    client_action: [
      'Create IndexSchema',
      'Load schema from message content',
      'Build global _schema lookup',
      'Initialize IndexSerializer with schema',
      'Clean up schema object',
      'Send ATUniverseReq'
    ]
  },
  
  3: {
    trigger: 'Schema Loaded',
    client_sends: 'CMD_AT_UNIVERSE_REV (20483)',
    request_class: 'ATUniverseReq(TOKEN, 2)',
    purpose: 'Request universe revision data'
  },
  
  4: {
    trigger: 'Universe Revision Response',
    server_sends: 'CMD_AT_UNIVERSE_REV (20483)',
    response_class: 'ATUniverseRes()',
    client_action: [
      'Create ATUniverseRes',
      'Set compressor reference',
      'Decode message content',
      'Extract RevisionMap from res.revs()',
      'Iterate through namespaces (global, private)',
      'Process StructValue entries',
      'Extract market codes from sv.stockCode',
      'Parse revisions JSON from sv.getString(7)',
      'Clean up response object',
      'Send multiple ATUniverseSeedsReq (one per market + qualified_name combo)'
    ]
  },
  
  5: {
    trigger: 'Universe Revision Processed',
    client_sends: 'Multiple CMD_AT_UNIVERSE_SEEDS requests',
    request_pattern: 'ATUniverseSeedsReq(TOKEN, seq++, revision, namespace, qualified_name, market_code, trade_day)',
    typical_count: '60 requests (10 markets × 6 qualified_names)',
    qualified_names: ['Commodity', 'Dividend', 'Futures', 'Holiday', 'Security', 'Stock']
  },
  
  6: {
    trigger: 'Universe Seeds Responses',
    server_sends: 'Multiple CMD_AT_UNIVERSE_SEEDS responses',
    response_class: 'ATUniverseSeedsRes()',
    content: 'Seed data for each market/qualified_name combination',
    completion: 'Universe initialization complete when all seeds received'
  }
};
```

### Critical Implementation Notes

1. **Memory Management**: All WASM objects created with `new` MUST be deleted with `.delete()`
2. **Compressor Lifecycle**: IndexSerializer must be initialized once after schema loading and reused
3. **Field Access Pattern**: Market revisions are in field[7] as JSON string, not field[1]
4. **Market Structure**: Markets are keyed by stockCode (CFFEX, CZCE, etc.) with nested revisions
5. **Token Usage**: Authentication token must be used consistently, never hardcoded "test"
6. **Namespace Mapping**: 'global' maps to 0, 'private' maps to 1 in schema lookups
7. **SharedArrayBuffer**: WebSocket send requires copying ArrayBuffer, not direct WASM buffer

### Error Patterns to Avoid

```javascript
const COMMON_ERRORS = {
  'Memory Leaks': 'Not calling .delete() on WASM objects',
  'Wrong Field Access': 'Using getString(1) instead of getString(7) for revisions',
  'Schema Premature Deletion': 'Deleting schema before compressor initialization',
  'SharedArrayBuffer Error': 'Sending WASM ArrayBuffer directly to WebSocket',
  'Hardcoded Values': 'Using "test" instead of actual authentication token',
  'Incorrect Market Structure': 'Expecting metaName keys instead of market code keys'
};
```

## Usage Examples

### Complete Initialization Implementation

```javascript
// 1. Schema Processing
case caitlyn.NET_CMD_GOLD_ROUTE_DATADEF:
  var schema = new caitlyn.IndexSchema();
  schema.load(pkg.content());
  var _metas = schema.metas();
  
  // Build schema lookup
  for (var i = 0; i < _metas.size(); i++) {
    var meta = _metas.get(i);
    if (_schema[meta.namespace] === undefined) {
      _schema[meta.namespace] = {};
    }
    _schema[meta.namespace][meta.ID] = meta;
  }
  
  // Initialize compressor
  _compressor = new caitlyn.IndexSerializer();
  _compressor.updateSchema(schema);
  
  // Send universe request
  var _rev_req = new caitlyn.ATUniverseReq(TOKEN, 2);
  var pkg = new caitlyn.NetPackage();
  var _msg = Buffer.from(pkg.encode(caitlyn.CMD_AT_UNIVERSE_REV, _rev_req.encode()));
  client.sendBinary(_msg);
  
  // Cleanup
  _rev_req.delete();
  pkg.delete();
  schema.delete();
  break;

// 2. Universe Revision Processing
case caitlyn.CMD_AT_UNIVERSE_REV:
  var res = new caitlyn.ATUniverseRes();
  res.setCompressor(_compressor);
  res.decode(pkg.content());
  
  var revs = res.revs();
  var keys = revs.keys();
  var marketsData = {};
  
  for (var i = 0; i < keys.size(); i++) {
    var k = keys.get(i);
    var v = revs.get(k);
    var ns = k === 'private' ? 1 : 0;
    
    for (var j = 0; j < v.size(); j++) {
      var sv = v.get(j);
      
      if (sv.metaID === 3 && !sv.isEmpty(7)) {  // Market metadata
        var revsJsonString = sv.getString(7);   // Field 7 contains revisions JSON
        var revsData = JSON.parse(revsJsonString);
        
        if (!marketsData[k]) marketsData[k] = {};
        marketsData[k][sv.stockCode] = {
          revisions: revsData,
          trade_day: 0,
          name: sv.getString(1)  // Field 1 contains display name
        };
      }
      
      sv.delete();
    }
  }
  
  res.delete();
  
  // Send seeds requests for each market + qualified_name combination
  sendUniverseSeedsRequests(client, marketsData);
  break;
```

---

**Document Version**: 1.0  
**Generated**: 2025-08-27  
**Based on**: Reverse engineering of Caitlyn WASM module and WebSocket protocol analysis  
**Status**: Complete universe initialization sequence verified and documented