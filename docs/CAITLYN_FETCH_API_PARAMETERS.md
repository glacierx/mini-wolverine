# Caitlyn WASM Fetch API Parameters Documentation

## Overview

This document provides a comprehensive guide to the parameter requirements for Caitlyn WASM's historical data fetch APIs, specifically `fetchByCode` and `fetchByTimeRange`. These APIs are used to retrieve historical market data from Caitlyn servers.

## API Methods

### 1. `fetchByCode(market, code, options)`

Fetches historical data for a specific market/code combination with metadata-driven field extraction.

### 2. `fetchByTimeRange(market, code, options)`

Fetches historical data within a specific time range with direct field specification.

## Critical Parameter Format Requirements

### ✅ **Correct Parameter Format (Working)**

Based on the working `test_connection.js` implementation:

```javascript
await connection.fetchByCode('DCE', 'i<00>', {
  qualifiedName: 'SampleQuote',        // ✅ Just metadata name, no namespace prefix
  namespace: 'global',                 // ✅ String format: 'global' or 'private'
  granularity: 86400,                  // ✅ Seconds (86400 = daily)
  fromDate: new Date('2025-01-01T00:00:00Z'),  // ✅ JavaScript Date object
  toDate: new Date('2025-08-01T00:00:00Z'),    // ✅ JavaScript Date object
  fields: ['open', 'close', 'high', 'low', 'volume', 'turnover'], // ✅ Array of field names
  revision: -1                         // ✅ Optional: -1 for latest, or specific revision number
});
```

### ❌ **Incorrect Parameter Format (Causes Errors)**

These formats will cause "Namespace is invalid" or other WASM errors:

```javascript
// ❌ WRONG: Namespace prefix in qualifiedName
{
  qualifiedName: 'global::SampleQuote',  // ❌ Don't include namespace prefix
  namespace: '0',                        // ❌ Don't use string numbers
}

// ❌ WRONG: Integer namespace
{
  qualifiedName: 'SampleQuote',
  namespace: 0,                          // ❌ Don't use integer values
}

// ❌ WRONG: Unix timestamp instead of Date objects
{
  fromDate: 1735689600,                  // ❌ Don't use Unix timestamps
  toDate: 1754006400,                    // ❌ Use Date objects instead
}
```

## Parameter Reference

### Core Parameters

| Parameter | Type | Description | Example | Required |
|-----------|------|-------------|---------|----------|
| `market` | string | Market exchange code | `'DCE'`, `'SHFE'`, `'CZCE'` | Yes |
| `code` | string | Security/contract code | `'i<00>'`, `'rb2501'` | Yes |

### Options Object Parameters

| Parameter | Type | Description | Example | Required |
|-----------|------|-------------|---------|----------|
| `qualifiedName` | string | Metadata type name (no namespace prefix) | `'SampleQuote'`, `'Market'`, `'Security'` | Yes |
| `namespace` | string | Namespace as string | `'global'`, `'private'` | Yes |
| `granularity` | number | Time granularity in seconds | `86400` (daily), `3600` (hourly), `60` (minute) | Yes |
| `fromDate` | Date | Start date as JavaScript Date object | `new Date('2025-01-01T00:00:00Z')` | Yes |
| `toDate` | Date | End date as JavaScript Date object | `new Date('2025-08-01T00:00:00Z')` | Yes |
| `fields` | string[] | Array of field names to retrieve | `['open', 'close', 'high', 'low']` | Yes |
| `revision` | number | Schema revision (-1 for latest) | `-1`, `123` | No |
| `timeout` | number | Request timeout in milliseconds | `30000` | No |

## Field Names Reference

### Common OHLCV Fields
```javascript
fields: [
  'open',       // Opening price
  'close',      // Closing price
  'high',       // Highest price
  'low',        // Lowest price
  'volume',     // Trading volume
  'turnover'    // Trading turnover/value
]
```

### Market-Specific Fields
Different markets and security types may support additional fields. Always verify field availability through schema inspection.

## Namespace Mapping

| Frontend Input | String Format | Description |
|---------------|---------------|-------------|
| `"0"` | `"global"` | Global namespace (public data) |
| `"1"` | `"private"` | Private namespace (user-specific data) |

## Time Granularity Values

| Granularity | Seconds | Description |
|-------------|---------|-------------|
| 60 | 60 | 1-minute bars |
| 300 | 300 | 5-minute bars |
| 900 | 900 | 15-minute bars |
| 3600 | 3600 | 1-hour bars |
| 14400 | 14400 | 4-hour bars |
| 86400 | 86400 | Daily bars |

## Internal WASM Parameter Transformation

When the parameters reach the WASM layer, they undergo the following transformations:

### ATFetchByCodeReq WASM Object Structure
```javascript
// Internal WASM request parameters (for reference only)
fetchByCodeReq.token = "your-auth-token";
fetchByCodeReq.seq = 64;                           // Auto-generated sequence ID
fetchByCodeReq.namespace = "global";               // String namespace
fetchByCodeReq.qualifiedName = "SampleQuote";     // Just the metadata name
fetchByCodeReq.revision = -1;                      // -1 for latest
fetchByCodeReq.market = "DCE";
fetchByCodeReq.code = "i<00>";
fetchByCodeReq.granularity = 86400;
fetchByCodeReq.fromTimeTag = "1735689600000";      // Date.getTime() as string
fetchByCodeReq.toTimeTag = "1754006400000";        // Date.getTime() as string
fetchByCodeReq.fields = StringVector(['open', 'close', ...]);  // WASM StringVector
```

## Response Data Structure

### Successful Response
```javascript
{
  type: 'fetch_by_code_response',
  success: true,
  data: {
    records: [
      {
        market: 'DCE',
        code: 'i<00>',
        timestamp: '1754265600000',
        metaID: 1,
        namespace: 0,
        metaName: 'SampleQuote',
        fieldCount: 6,
        granularity: 86400,
        fields: {
          open: 787,
          close: 792,
          high: 794,
          low: 782,
          volume: '263634',
          turnover: 20802841350
        }
      }
      // ... more records
    ]
  },
  message: 'Historical data fetched successfully for DCE/i<00>'
}
```

### Error Response
```javascript
{
  type: 'fetch_by_code_response',
  success: false,
  message: 'Server error: Namespace is invalid. (code: 42)',
  error: {
    type: 'Error',
    message: 'Server error: Namespace is invalid. (code: 42)'
  }
}
```

## Common Error Codes

| Error Code | Error Message | Cause | Solution |
|------------|---------------|--------|----------|
| 42 | "Namespace is invalid" | Using `namespace: "0"` instead of `"global"` | Use `namespace: "global"` or `"private"` |
| - | "Cannot pass non-string to std::string" | Using integer namespace in WASM binding | Ensure namespace is converted to string before WASM call |
| - | "MetaID not found" | Invalid qualifiedName or namespace combination | Verify metadata exists in schema |

## Best Practices

### 1. **Parameter Validation**
Always validate parameters before sending to WASM:
```javascript
if (!['global', 'private'].includes(options.namespace)) {
  throw new Error('Invalid namespace. Use "global" or "private"');
}
```

### 2. **Date Handling**
Always use JavaScript Date objects for time parameters:
```javascript
// ✅ Correct
fromDate: new Date('2025-01-01T00:00:00Z')

// ❌ Wrong
fromDate: 1735689600  // Unix timestamp
```

### 3. **Field Verification**
Verify field names exist in schema before requesting:
```javascript
const meta = schema.findMetaByName('global', 'SampleQuote');
const availableFields = meta.fields.map(f => f.name);
const requestFields = fields.filter(f => availableFields.includes(f));
```

### 4. **Error Handling**
Always implement proper error handling for WASM responses:
```javascript
if (res.errorCode !== 0) {
  throw new Error(`Server error: ${res.errorMsg} (code: ${res.errorCode})`);
}
```

## Example Implementation

### Complete Working Example
```javascript
async function fetchHistoricalData() {
  try {
    const result = await connection.fetchByCode('DCE', 'i<00>', {
      qualifiedName: 'SampleQuote',
      namespace: 'global',
      granularity: 86400,
      fromDate: new Date('2025-01-01T00:00:00Z'),
      toDate: new Date('2025-08-01T00:00:00Z'),
      fields: ['open', 'close', 'high', 'low', 'volume', 'turnover'],
      revision: -1,
      timeout: 30000
    });
    
    console.log(`Received ${result.records.length} records`);
    return result;
  } catch (error) {
    console.error('Fetch failed:', error.message);
    throw error;
  }
}
```

## Integration Notes

### Frontend-Backend Parameter Flow
1. **Frontend** sends: `{market: 'DCE', code: 'i<00>', namespace: '0', metaName: 'SampleQuote'}`
2. **Backend** transforms: `namespace: '0' → 'global'`, `qualifiedName: 'SampleQuote'` (removes namespace prefix)
3. **WASM** receives: `{namespace: "global", qualifiedName: "SampleQuote"}` in correct format

### Schema Dependencies
- Schema must be loaded before making fetch requests
- Metadata definitions determine available fields
- Universe initialization required for proper operation

This documentation reflects the working implementation as verified by successful test cases and production usage in the Mini Wolverine project.