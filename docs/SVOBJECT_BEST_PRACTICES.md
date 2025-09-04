# SVObject and StructValue Codec Best Practices

## Overview

The **SVObject Doctrine** is a mandatory architectural pattern for all Caitlyn StructValue processing in Mini Wolverine applications. This pattern ensures **field alignment safety**, **schema compliance**, and **memory efficiency** while preventing crashes from schema mismatches and hardcoded field positions.

## Table of Contents

1. [Core Principles](#core-principles)
2. [SVObject Architecture](#svobject-architecture)
3. [Implementation Patterns](#implementation-patterns)
4. [Available SVObject Types](#available-svobject-types)
5. [Performance Optimization](#performance-optimization)
6. [Error Handling](#error-handling)
7. [Migration Guide](#migration-guide)
8. [Troubleshooting](#troubleshooting)

## Core Principles

### 🚫 NEVER Manipulate StructValue Objects Directly

**FORBIDDEN Direct StructValue Patterns:**
```javascript
// ❌ NEVER do this - Hardcoded field positions
const value = sv.getString(7);      // Brittle: Field positions can change
const tradeDay = sv.getInt32(0);    // Unsafe: No schema validation
if (!sv.isEmpty(1)) { ... }         // Error-prone: Manual field checking

// ❌ NEVER do this - Type assumptions without validation
const name = sv.getString(1);       // What if field 1 is not a string?
const price = sv.getDouble(3);      // What if field 3 doesn't exist?
```

### ✅ ALWAYS Use SVObject Pattern

**Two Valid SVObject Patterns:**

**1. Generic/Dynamic Types (Primary Pattern - Most Common):**
```javascript
// ✅ Use direct SVObject for any metadata types (primary pattern)
const svObject = new SVObject(wasmModule);
svObject.metaName = qualifiedName;   // e.g., 'SampleQuote', 'Future', etc.
svObject.namespace = namespace;      // 0 for global, 1 for private
svObject.loadDefFromDict(schemaByNamespace);
svObject.fromSv(sv);
const fields = svObject.toJSON().fields;
const extractedData = fields;        // ✅ Schema-compliant access
svObject.cleanup();                  // ✅ Proper memory management
```

**2. Predefined Singularity Types (Special Case):**
```javascript
// ✅ Use createSingularityObject only for known Singularity metadata types
const marketData = createSingularityObject("global::Market", wasmModule);
marketData.loadDefFromDict(schemaByNamespace);
marketData.fromSv(sv);
const fields = marketData.toJSON().fields;
const tradeDay = fields.trade_day;   // ✅ Schema-driven field access
const name = fields.name;            // ✅ Named field access
marketData.cleanup();                // ✅ Proper memory management
```

## SVObject Architecture

### Class Hierarchy

```
SVObject (Base Class)
├── MarketData (global::Market, private::Market)
├── HolidayData (global::Holiday, private::Holiday) 
├── SecurityData (global::Security, private::Security)
├── CommodityData (global::Commodity, private::Commodity)
├── FutureData (global::Future, private::Future)
├── StockData (global::Stock, private::Stock)
└── DividendData (global::Dividend, private::Dividend)
```

### Core Methods

**Required Methods for All SVObject Types:**
```javascript
// Schema initialization (call once per instance)
loadDefFromDict(schemaByNamespace)

// Data extraction from StructValue
fromSv(structValue)

// Structured data access
toJSON()

// Memory cleanup (mandatory)
cleanup()
```

### Pattern Selection Guide

**Use Pattern A (createSingularityObject) for:**
- ✅ Known metadata types: Market, Security, Holiday, Future, Stock, etc.
- ✅ Universe data processing (market revision, seeds)
- ✅ Static metadata structures with predefined schemas

**Use Pattern B (direct SVObject) for:**
- ✅ Historical data queries (SampleQuote, custom types)
- ✅ Dynamic metadata types determined at runtime
- ✅ Fetch-by-code responses with configurable metadata
- ✅ Custom query results with variable schemas

**Real-world Usage from CaitlynClientConnection:**
```javascript
// Pattern A: Market processing (universe revision)
const marketData = createSingularityObject("global::Market", this.wasmModule);

// Pattern B: Historical data processing (fetch responses)
const svObject = new SVObject(this.wasmModule);
svObject.metaName = queryInfo.qualifiedName; // e.g., 'SampleQuote'
svObject.namespace = queryInfo.namespace;
```

### Data Flow Architecture

```
StructValue (Binary) → SVObject.fromSv() → Schema Validation → Field Extraction → JSON Structure
     ↓                        ↓                  ↓                ↓                ↓
Binary Protocol         SVObject Instance    Field Mapping    Named Fields    Accessible Data
```

## Implementation Patterns

### 1. **Basic SVObject Usage Patterns**

**Pattern A: Predefined Metadata Types**

```javascript
import { createSingularityObject } from '../utils/SingularityObjects.js';

function processMarketData(structValue, schemaByNamespace, wasmModule) {
  // 1. Create predefined SVObject instance
  const marketData = createSingularityObject("global::Market", wasmModule);
  
  // 2. Load schema definitions (once per instance)
  marketData.loadDefFromDict(schemaByNamespace);
  
  // 3. Extract data from StructValue
  marketData.fromSv(structValue);
  
  // 4. Access structured fields
  const fields = marketData.toJSON().fields;
  const tradeDay = fields.trade_day;
  const marketName = fields.name;
  const timeZone = fields.time_zone;
  const revisions = JSON.parse(fields.revs || '{}');
  
  // 5. Cleanup (mandatory)
  marketData.cleanup();
  
  return {
    tradeDay,
    marketName,
    timeZone,
    revisions
  };
}
```

**Pattern B: Dynamic/Generic Types**

```javascript
import SVObject from '../utils/StructValueWrapper.js';

function processHistoricalData(structValue, qualifiedName, namespace, schemaByNamespace, wasmModule) {
  // 1. Create generic SVObject instance
  const svObject = new SVObject(wasmModule);
  
  // 2. Configure metadata properties
  svObject.metaName = qualifiedName;  // e.g., 'SampleQuote', 'Future'
  svObject.namespace = namespace;     // 0 for global, 1 for private
  
  // 3. Load schema definitions
  svObject.loadDefFromDict(schemaByNamespace);
  
  // 4. Extract data from StructValue
  svObject.fromSv(structValue);
  
  // 5. Access structured fields
  const fields = svObject.toJSON().fields;
  const extractedData = { ...fields }; // All fields available
  
  // 6. Cleanup (mandatory)
  svObject.cleanup();
  
  return extractedData;
}
```

### 2. **SVObject Instance Reuse Pattern (Recommended)**

```javascript
import { createSingularityObject } from '../utils/SingularityObjects.js';
import SVObject from '../utils/StructValueWrapper.js';

function processMultipleStructValues(structValues, schemaByNamespace, wasmModule) {
  // Create reusable SVObject cache
  const svObjectCache = {};
  const results = [];
  
  try {
    for (const sv of structValues) {
      const metaID = sv.metaID;
      const namespaceId = sv.namespaceID;
      const qualifiedName = determineQualifiedName(metaID, namespaceId); // e.g., "global::Market"
      
      if (!qualifiedName) continue;
      
      // Create or reuse SVObject instance using appropriate pattern
      if (!svObjectCache[qualifiedName]) {
        if (isKnownMetadataType(qualifiedName)) {
          // Pattern A: Use factory for predefined types
          svObjectCache[qualifiedName] = createSingularityObject(qualifiedName, wasmModule);
        } else {
          // Pattern B: Use generic SVObject for dynamic types
          svObjectCache[qualifiedName] = new SVObject(wasmModule);
          svObjectCache[qualifiedName].metaName = qualifiedName.split('::')[1];
          svObjectCache[qualifiedName].namespace = namespaceId;
        }
        
        svObjectCache[qualifiedName].loadDefFromDict(schemaByNamespace);  // Load schema once
      }
      
      // Reuse existing SVObject instance
      const svObject = svObjectCache[qualifiedName];
      svObject.fromSv(sv);  // Extract data from current StructValue
      
      // Access structured data
      const objectData = svObject.toJSON();
      results.push({
        type: qualifiedName,
        fields: objectData.fields
      });
    }
  } finally {
    // Cleanup all cached instances (MANDATORY)
    for (const metaName in svObjectCache) {
      svObjectCache[metaName].cleanup();
    }
  }
  
  return results;
}

function isKnownMetadataType(qualifiedName) {
  const knownTypes = [
    'global::Market', 'private::Market',
    'global::Security', 'private::Security', 
    'global::Holiday', 'private::Holiday',
    'global::Future', 'private::Future'
    // Add other predefined types as needed
  ];
  return knownTypes.includes(qualifiedName);
}

function determineQualifiedName(metaID, namespaceId) {
  // Implementation depends on your schema structure
  // This should match the actual implementation in CaitlynClientConnection
  return `${namespaceId === 0 ? 'global' : 'private'}::${getMetaNameFromID(metaID)}`;
}
```

### 3. **Schema-Based Factory Pattern**

```javascript
class SVObjectFactory {
  constructor(wasmModule, schemaByNamespace) {
    this.wasmModule = wasmModule;
    this.schemaByNamespace = schemaByNamespace;
    this.cache = new Map();
  }
  
  // Get or create SVObject instance
  getProcessor(qualifiedName) {
    if (!this.cache.has(qualifiedName)) {
      const svObject = createSingularityObject(qualifiedName, this.wasmModule);
      svObject.loadDefFromDict(this.schemaByNamespace);
      this.cache.set(qualifiedName, svObject);
    }
    
    return this.cache.get(qualifiedName);
  }
  
  // Process StructValue with appropriate SVObject
  process(structValue, qualifiedName) {
    const processor = this.getProcessor(qualifiedName);
    processor.fromSv(structValue);
    return processor.toJSON();
  }
  
  // Cleanup all instances
  cleanup() {
    for (const svObject of this.cache.values()) {
      svObject.cleanup();
    }
    this.cache.clear();
  }
}

// Usage
const factory = new SVObjectFactory(wasmModule, schemaByNamespace);
const marketData = factory.process(structValue, "global::Market");
factory.cleanup(); // When done processing
```

### 4. **Namespace-Aware Processing Pattern**

```javascript
function processUniverseData(universeResponse, schemaByNamespace, wasmModule) {
  const svObjectCache = {};
  const results = {
    global: {},
    private: {}
  };
  
  try {
    // Iterate through namespace entries
    for (let i = 0; i < universeResponse.size(); i++) {
      const entry = universeResponse.get(i);
      const namespaceId = entry.namespaceID;
      const namespaceStr = namespaceId === 0 ? 'global' : 'private';
      
      // Determine qualified name
      const metaID = entry.metaID;
      const meta = schemaByNamespace[namespaceStr]?.[metaID];
      if (!meta) continue;
      
      const qualifiedName = `${namespaceStr}::${meta.name}`;
      
      // Create or reuse SVObject
      if (!svObjectCache[qualifiedName]) {
        svObjectCache[qualifiedName] = createSingularityObject(qualifiedName, wasmModule);
        svObjectCache[qualifiedName].loadDefFromDict(schemaByNamespace);
      }
      
      // Process StructValue
      const svObject = svObjectCache[qualifiedName];
      svObject.fromSv(entry);
      const data = svObject.toJSON();
      
      // Organize by namespace
      if (!results[namespaceStr][meta.name]) {
        results[namespaceStr][meta.name] = [];
      }
      results[namespaceStr][meta.name].push(data.fields);
      
      // Cleanup entry
      entry.delete();
    }
  } finally {
    // Cleanup all cached instances
    for (const metaName in svObjectCache) {
      svObjectCache[metaName].cleanup();
    }
  }
  
  return results;
}
```

## Available SVObject Types

### 1. **MarketData** (global::Market, private::Market)

**Schema Fields:**
- `trade_day` (int32) - Current trading day
- `name` (string) - Market display name
- `time_zone` (string) - Market timezone
- `revs` (string) - JSON revision data

**Usage Example:**
```javascript
const marketData = createSingularityObject("global::Market", wasmModule);
marketData.loadDefFromDict(schemaByNamespace);
marketData.fromSv(structValue);

const fields = marketData.toJSON().fields;
console.log(`Market: ${fields.name} (${fields.time_zone})`);
console.log(`Trade Day: ${fields.trade_day}`);
const revisions = JSON.parse(fields.revs || '{}');
console.log(`Revisions:`, revisions);

marketData.cleanup();
```

### 2. **SecurityData** (global::Security, private::Security)

**Schema Fields:**
- `code` (string) - Security code/symbol
- `name` (string) - Security name
- `market_code` (string) - Associated market
- `type` (int) - Security type identifier
- `status` (int) - Trading status

**Usage Example:**
```javascript
const securityData = createSingularityObject("global::Security", wasmModule);
securityData.loadDefFromDict(schemaByNamespace);
securityData.fromSv(structValue);

const fields = securityData.toJSON().fields;
console.log(`Security: ${fields.code} - ${fields.name}`);
console.log(`Market: ${fields.market_code}, Type: ${fields.type}`);

securityData.cleanup();
```

### 3. **FutureData** (global::Future, private::Future)

**Schema Fields:**
- `symbol` (string) - Future contract symbol
- `underlying` (string) - Underlying asset
- `expiry_date` (string) - Contract expiration
- `contract_size` (double) - Contract multiplier
- `tick_size` (double) - Minimum price movement

**Usage Example:**
```javascript
const futureData = createSingularityObject("global::Future", wasmModule);
futureData.loadDefFromDict(schemaByNamespace);
futureData.fromSv(structValue);

const fields = futureData.toJSON().fields;
console.log(`Future: ${fields.symbol} (${fields.underlying})`);
console.log(`Expiry: ${fields.expiry_date}, Size: ${fields.contract_size}`);

futureData.cleanup();
```

### 4. **HolidayData** (global::Holiday, private::Holiday)

**Schema Fields:**
- `rev` (int) - Revision number
- `trade_day` (int32) - Holiday trade day
- `days` (array) - Holiday dates

**Usage Example:**
```javascript
const holidayData = createSingularityObject("global::Holiday", wasmModule);
holidayData.loadDefFromDict(schemaByNamespace);
holidayData.fromSv(structValue);

const fields = holidayData.toJSON().fields;
console.log(`Holiday Rev: ${fields.rev}, Trade Day: ${fields.trade_day}`);
console.log(`Holiday Days:`, fields.days);

holidayData.cleanup();
```

### 5. **CommodityData** (global::Commodity, private::Commodity)

**Usage follows the same pattern as other SVObject types.**

### 6. **StockData** (global::Stock, private::Stock)

**Usage follows the same pattern as other SVObject types.**

### 7. **DividendData** (global::Dividend, private::Dividend)

**Usage follows the same pattern as other SVObject types.**

## Performance Optimization

### 1. **SVObject Instance Reuse Benefits**

**Before (Creating New Instances):**
```javascript
// ❌ Inefficient: Creating 100 Market objects = 100 object creations + 100 schema loads
for (const sv of structValues) {
  const marketData = createSingularityObject("global::Market", wasmModule);
  marketData.loadDefFromDict(schemaByNamespace);  // Expensive schema load each time
  marketData.fromSv(sv);
  const data = marketData.toJSON();
  marketData.cleanup();
}
```

**After (Instance Reuse):**
```javascript
// ✅ Efficient: Processing 100 Markets = 1 object creation + 1 schema load + 100 data extractions
const marketData = createSingularityObject("global::Market", wasmModule);
marketData.loadDefFromDict(schemaByNamespace);  // Load schema once

for (const sv of structValues) {
  marketData.fromSv(sv);  // Fast data extraction
  const data = marketData.toJSON();
  processMarketData(data);
}

marketData.cleanup();  // Cleanup once at end
```

**Performance Impact:**
- **Memory Savings**: ~90% reduction in WASM object allocations
- **Speed Improvement**: Faster processing due to reduced object creation overhead
- **Schema Loading**: From O(n) to O(1) schema loading operations

### 2. **Batch Processing Pattern**

```javascript
function processBatchedStructValues(structValueBatch, schemaByNamespace, wasmModule) {
  // Group by qualified name to maximize reuse
  const groupedByType = new Map();
  
  // Group StructValues by their type
  for (const sv of structValueBatch) {
    const qualifiedName = determineQualifiedName(sv);
    if (!groupedByType.has(qualifiedName)) {
      groupedByType.set(qualifiedName, []);
    }
    groupedByType.get(qualifiedName).push(sv);
  }
  
  const results = new Map();
  
  // Process each type with optimal reuse
  for (const [qualifiedName, structValues] of groupedByType) {
    const svObject = createSingularityObject(qualifiedName, wasmModule);
    svObject.loadDefFromDict(schemaByNamespace);  // Once per type
    
    const typeResults = [];
    for (const sv of structValues) {
      svObject.fromSv(sv);  // Reuse same instance
      typeResults.push(svObject.toJSON());
    }
    
    results.set(qualifiedName, typeResults);
    svObject.cleanup();  // Cleanup once per type
  }
  
  return results;
}
```

### 3. **Memory Pool Pattern**

```javascript
class SVObjectPool {
  constructor(wasmModule, schemaByNamespace) {
    this.wasmModule = wasmModule;
    this.schemaByNamespace = schemaByNamespace;
    this.pool = new Map();
    this.inUse = new Set();
  }
  
  // Get SVObject from pool or create new one
  acquire(qualifiedName) {
    const key = qualifiedName;
    let svObject;
    
    if (this.pool.has(key) && this.pool.get(key).length > 0) {
      // Reuse from pool
      svObject = this.pool.get(key).pop();
    } else {
      // Create new instance
      svObject = createSingularityObject(qualifiedName, this.wasmModule);
      svObject.loadDefFromDict(this.schemaByNamespace);
    }
    
    this.inUse.add(svObject);
    return svObject;
  }
  
  // Return SVObject to pool
  release(svObject, qualifiedName) {
    if (this.inUse.has(svObject)) {
      this.inUse.delete(svObject);
      
      // Return to pool for reuse
      if (!this.pool.has(qualifiedName)) {
        this.pool.set(qualifiedName, []);
      }
      this.pool.get(qualifiedName).push(svObject);
    }
  }
  
  // Cleanup all pooled objects
  cleanup() {
    for (const instances of this.pool.values()) {
      for (const instance of instances) {
        instance.cleanup();
      }
    }
    
    for (const instance of this.inUse) {
      instance.cleanup();
    }
    
    this.pool.clear();
    this.inUse.clear();
  }
}
```

## Error Handling

### 1. **Schema Availability Checking**

```javascript
function safeProcessStructValue(structValue, qualifiedName, schemaByNamespace, wasmModule) {
  // Validate schema availability
  const [namespace, typeName] = qualifiedName.split('::');
  if (!schemaByNamespace[namespace] || !schemaByNamespace[namespace][typeName]) {
    throw new Error(`Schema not available for ${qualifiedName}`);
  }
  
  let svObject = null;
  try {
    svObject = createSingularityObject(qualifiedName, wasmModule);
    svObject.loadDefFromDict(schemaByNamespace);
    svObject.fromSv(structValue);
    
    return svObject.toJSON();
  } catch (error) {
    console.error(`SVObject processing failed for ${qualifiedName}:`, error);
    throw new Error(`Failed to process ${qualifiedName}: ${error.message}`);
  } finally {
    // Always cleanup, even on error
    if (svObject) {
      svObject.cleanup();
    }
  }
}
```

### 2. **Field Validation Pattern**

```javascript
function validateAndExtractFields(svObject, expectedFields) {
  const jsonData = svObject.toJSON();
  const fields = jsonData.fields || {};
  const result = {};
  const errors = [];
  
  for (const fieldName of expectedFields) {
    if (fieldName in fields) {
      result[fieldName] = fields[fieldName];
    } else {
      errors.push(`Missing field: ${fieldName}`);
    }
  }
  
  if (errors.length > 0) {
    console.warn('Field validation warnings:', errors);
  }
  
  return { data: result, errors };
}

// Usage
const marketData = createSingularityObject("global::Market", wasmModule);
marketData.loadDefFromDict(schemaByNamespace);
marketData.fromSv(structValue);

const { data, errors } = validateAndExtractFields(marketData, [
  'trade_day', 'name', 'time_zone', 'revs'
]);

if (errors.length === 0) {
  console.log('All fields present:', data);
} else {
  console.warn('Some fields missing:', errors);
}

marketData.cleanup();
```

### 3. **Defensive Processing Pattern**

```javascript
function robustStructValueProcessing(structValue, qualifiedName, schemaByNamespace, wasmModule) {
  // Multiple validation layers
  if (!structValue) {
    throw new Error('StructValue is null or undefined');
  }
  
  if (!qualifiedName || typeof qualifiedName !== 'string') {
    throw new Error('Invalid qualified name');
  }
  
  if (!schemaByNamespace) {
    throw new Error('Schema dictionary not available');
  }
  
  const [namespace, typeName] = qualifiedName.split('::');
  if (!namespace || !typeName) {
    throw new Error(`Invalid qualified name format: ${qualifiedName}`);
  }
  
  // Check schema availability
  const schemaEntry = schemaByNamespace[namespace]?.[typeName];
  if (!schemaEntry) {
    throw new Error(`No schema found for ${qualifiedName}`);
  }
  
  let svObject = null;
  try {
    svObject = createSingularityObject(qualifiedName, wasmModule);
    if (!svObject) {
      throw new Error(`Failed to create SVObject for ${qualifiedName}`);
    }
    
    svObject.loadDefFromDict(schemaByNamespace);
    svObject.fromSv(structValue);
    
    const result = svObject.toJSON();
    if (!result || !result.fields) {
      throw new Error('SVObject returned invalid JSON structure');
    }
    
    return result;
  } finally {
    if (svObject) {
      try {
        svObject.cleanup();
      } catch (cleanupError) {
        console.error('SVObject cleanup error:', cleanupError);
      }
    }
  }
}
```

## Migration Guide

### From Direct StructValue Access to SVObject Pattern

**Before (Direct Access - DEPRECATED):**
```javascript
// ❌ Old pattern - brittle and unsafe
function processMarketStructValue(sv) {
  const tradeDay = sv.getInt32(0);        // Hardcoded field position
  const name = sv.getString(1);           // Assumes field type
  const timeZone = sv.getString(2);       // No validation
  const revisions = sv.getString(7);      // Magic number
  
  return {
    tradeDay,
    name,
    timeZone,
    revisions: JSON.parse(revisions || '{}')
  };
}
```

**After (SVObject Pattern - REQUIRED):**

**Option 1: Predefined Metadata Types**
```javascript
// ✅ Pattern A - For known types (Market, Security, etc.)
function processMarketStructValue(sv, schemaByNamespace, wasmModule) {
  const marketData = createSingularityObject("global::Market", wasmModule);
  marketData.loadDefFromDict(schemaByNamespace);
  marketData.fromSv(sv);
  
  const fields = marketData.toJSON().fields;
  const result = {
    tradeDay: fields.trade_day,
    name: fields.name,
    timeZone: fields.time_zone,
    revisions: JSON.parse(fields.revs || '{}')
  };
  
  marketData.cleanup();
  return result;
}
```

**Option 2: Dynamic/Generic Types**
```javascript
// ✅ Pattern B - For dynamic types (historical data, etc.)
function processHistoricalStructValue(sv, qualifiedName, namespace, schemaByNamespace, wasmModule) {
  const svObject = new SVObject(wasmModule);
  svObject.metaName = qualifiedName;  // e.g., 'SampleQuote'
  svObject.namespace = namespace;     // 0 for global, 1 for private
  
  svObject.loadDefFromDict(schemaByNamespace);
  svObject.fromSv(sv);
  
  const fields = svObject.toJSON().fields;
  const result = { ...fields };  // All available fields
  
  svObject.cleanup();
  return result;
}
```

### Migration Steps

1. **Identify Direct StructValue Usage**:
   ```bash
   # Find all direct StructValue method calls
   grep -r "\.getString\|\.getInt32\|\.getDouble\|\.isEmpty" backend/src/
   ```

2. **Replace with SVObject Calls**:
   ```javascript
   // For each StructValue processing function:
   // 1. Import createSingularityObject
   // 2. Create appropriate SVObject
   // 3. Load schema definitions
   // 4. Extract data with fromSv()
   // 5. Access fields via toJSON()
   // 6. Cleanup SVObject
   ```

3. **Update Function Signatures**:
   ```javascript
   // Add required parameters
   function processData(
     structValue,              // Original parameter
     schemaByNamespace,        // Add schema dictionary
     wasmModule               // Add WASM module reference
   ) { ... }
   ```

4. **Test Schema Compliance**:
   ```javascript
   // Verify all field accesses use schema-defined names
   const fields = svObject.toJSON().fields;
   // ✅ Use: fields.trade_day
   // ❌ Never: sv.getInt32(0)
   ```

## Troubleshooting

### Common Issues

#### 1. **"SVObject cleanup() not called" Memory Leaks**

**Symptoms**: Increasing memory usage, WASM instance warnings
**Cause**: Missing cleanup() calls
**Solution**:
```javascript
function processWithProperCleanup(structValue, qualifiedName, schemaByNamespace, wasmModule) {
  let svObject = null;
  try {
    svObject = createSingularityObject(qualifiedName, wasmModule);
    svObject.loadDefFromDict(schemaByNamespace);
    svObject.fromSv(structValue);
    return svObject.toJSON();
  } finally {
    // ALWAYS cleanup, even on exceptions
    if (svObject) {
      svObject.cleanup();
    }
  }
}
```

#### 2. **"Schema not found" Errors**

**Symptoms**: SVObject creation fails with schema errors
**Cause**: Schema not loaded or incorrect qualified names
**Solution**:
```javascript
// Debug schema availability
function debugSchema(qualifiedName, schemaByNamespace) {
  const [namespace, typeName] = qualifiedName.split('::');
  
  console.log('Available namespaces:', Object.keys(schemaByNamespace));
  console.log(`Checking namespace '${namespace}':`, !!schemaByNamespace[namespace]);
  
  if (schemaByNamespace[namespace]) {
    console.log(`Available types in ${namespace}:`, Object.keys(schemaByNamespace[namespace]));
    console.log(`Looking for type '${typeName}':`, !!schemaByNamespace[namespace][typeName]);
  }
}
```

#### 3. **Field Access Errors**

**Symptoms**: `undefined` values for expected fields
**Cause**: Incorrect field names or schema mismatches
**Solution**:
```javascript
// Debug field availability
function debugFields(svObject, expectedFields) {
  const jsonData = svObject.toJSON();
  const availableFields = Object.keys(jsonData.fields || {});
  
  console.log('Available fields:', availableFields);
  console.log('Expected fields:', expectedFields);
  
  const missing = expectedFields.filter(f => !availableFields.includes(f));
  const extra = availableFields.filter(f => !expectedFields.includes(f));
  
  if (missing.length > 0) console.warn('Missing fields:', missing);
  if (extra.length > 0) console.log('Extra fields:', extra);
}
```

#### 4. **Performance Issues**

**Symptoms**: Slow processing with many StructValues
**Cause**: Not reusing SVObject instances
**Solution**: Use the **Instance Reuse Pattern** shown above

### Debug Tools

#### 1. **SVObject Inspector**

```javascript
function inspectSVObject(svObject, structValue) {
  console.log('=== SVObject Inspector ===');
  
  // Before processing
  console.log('StructValue metaID:', structValue.metaID);
  console.log('StructValue size:', structValue.size());
  
  // After processing
  svObject.fromSv(structValue);
  const jsonData = svObject.toJSON();
  
  console.log('Extracted fields:', Object.keys(jsonData.fields || {}));
  console.log('Field values:', jsonData.fields);
  console.log('=========================');
}
```

#### 2. **Schema Validator**

```javascript
function validateSchemaCompatibility(qualifiedName, schemaByNamespace) {
  const [namespace, typeName] = qualifiedName.split('::');
  
  const validation = {
    namespaceExists: !!schemaByNamespace[namespace],
    typeExists: !!(schemaByNamespace[namespace]?.[typeName]),
    qualifiedName,
    namespace,
    typeName
  };
  
  if (validation.typeExists) {
    const schema = schemaByNamespace[namespace][typeName];
    validation.schemaFields = schema.fields?.map(f => f.name) || [];
  }
  
  return validation;
}
```

#### 3. **Performance Monitor**

```javascript
class SVObjectPerformanceMonitor {
  constructor() {
    this.stats = {
      instancesCreated: 0,
      schemasLoaded: 0,
      processingTime: 0,
      cleanupCount: 0
    };
  }
  
  wrapSVObjectCreation(qualifiedName, namespace, wasmModule) {
    this.stats.instancesCreated++;
    const startTime = performance.now();
    
    // Use generic SVObject pattern for monitoring any type
    const svObject = new SVObject(wasmModule);
    svObject.metaName = qualifiedName;
    svObject.namespace = namespace || wasmModule.NAMESPACE_GLOBAL;
    
    // Wrap cleanup to track it
    const originalCleanup = svObject.cleanup;
    svObject.cleanup = () => {
      this.stats.cleanupCount++;
      this.stats.processingTime += performance.now() - startTime;
      return originalCleanup.call(svObject);
    };
    
    return svObject;
  }
  
  logStats() {
    console.log('SVObject Performance Stats:', this.stats);
    
    if (this.stats.instancesCreated !== this.stats.cleanupCount) {
      console.warn(`Memory leak detected: ${this.stats.instancesCreated - this.stats.cleanupCount} instances not cleaned up`);
    }
  }
}
```

## Async Request/Response Pattern with SVObject Integration

### Overview

The **Async Request/Response Pattern** demonstrates how CaitlynClientConnection handles all asynchronous operations (fetch by code, fetch by time, etc.) using query caching and event-driven processing. This pattern combines proper sequence ID tracking with SVObject-based data extraction, following the proven CaitlynClientConnection implementation.

### Core Async Pattern Principles

1. **Query Cache**: Store request parameters keyed by sequence ID
2. **Event-Driven**: Process responses when they arrive via message handlers
3. **No Timeouts**: Responses are handled asynchronously without artificial timeouts
4. **Sequence Matching**: Match responses to original requests using sequence IDs
5. **SVObject Processing**: Use cached request info to configure SVObjects properly

### Complete Implementation Example

```javascript
import SVObject from '../utils/StructValueWrapper.js';
import { createSingularityObject } from '../utils/SingularityObjects.js'; // Only for Singularity types
import { EventEmitter } from 'events';
import logger from '../utils/logger.js';

/**
 * Async Request/Response Service following CaitlynClientConnection pattern
 * Uses query caching and event-driven processing for all async operations
 */
class CaitlynAsyncQueryService extends EventEmitter {
  constructor(connection, schemaByNamespace) {
    super();
    this.connection = connection;
    this.schemaByNamespace = schemaByNamespace;
    this.wasmModule = connection.wasmModule;
    
    // Query cache for tracking request-response mapping (core pattern)
    this.queryCache = new Map(); // Map<sequenceId, queryInfo>
    
    // Sequence ID management
    this.sequenceCounter = 1;
    
    // Set up response handler
    this.setupResponseHandlers();
  }

  /**
   * Set up response handlers following CaitlynClientConnection pattern
   */
  setupResponseHandlers() {
    // Listen to connection's binary message events
    this.connection.on('binary_message', (cmd, pkg) => {
      if (cmd === this.wasmModule.CMD_AT_FETCH_SV_RES) {
        this.handleFetchByCodeResponse(pkg);
      } else if (cmd === this.wasmModule.CMD_AT_FETCH_BY_TIME_RES) {
        this.handleFetchByTimeResponse(pkg);
      }
    });
  }

  /**
   * Execute fetch by code request - follows CaitlynClientConnection pattern
   * @param {string} market - Market code (e.g., 'SHFE')
   * @param {string} code - Security code (e.g., 'cu2501') 
   * @param {Object} options - Fetch options
   * @returns {number} - Sequence ID for tracking
   */
  async fetchByCode(market, code, options = {}) {
    const {
      qualifiedName = 'SampleQuote',
      namespace = 'global',
      granularity = 86400, // Daily
      fromDate = new Date('2025-01-01'),
      toDate = new Date('2025-08-01'),
      fields = [],
      revision = -1
    } = options;

    const currentSeqId = ++this.sequenceCounter;
    
    logger.info(`📤 Fetch by code request: ${market}/${code} (${qualifiedName}) seq=${currentSeqId}`);
    
    // 1. Cache query parameters for async response processing (CORE PATTERN)
    const queryInfo = {
      type: 'fetchByCode',
      market: market,
      code: code,
      qualifiedName: qualifiedName,
      namespace: namespace,
      granularity: granularity,
      fromDate: fromDate,
      toDate: toDate,
      fields: fields,
      revision: revision,
      timestamp: Date.now()
    };
    
    this.queryCache.set(currentSeqId, queryInfo);
    logger.info(`💾 Cached query parameters for seq=${currentSeqId}`);
    
    // 2. Create WASM request
    const fetchReq = new this.wasmModule.ATFetchByCodeReq(
      this.connection.token,
      currentSeqId,
      revision,
      namespace === 'global' ? this.wasmModule.NAMESPACE_GLOBAL : this.wasmModule.NAMESPACE_PRIVATE,
      qualifiedName,
      market,
      code,
      Math.floor(fromDate.getTime() / 1000), // Unix timestamp
      Math.floor(toDate.getTime() / 1000),
      granularity,
      fields
    );
    
    // 3. Encode and send request
    const pkg = new this.wasmModule.NetPackage();
    const requestBuffer = pkg.encode(this.wasmModule.CMD_AT_FETCH_BY_CODE, fetchReq.encode());
    
    // Send via WebSocket
    this.connection.sendBinaryMessage(requestBuffer);
    
    // Clean up WASM objects
    fetchReq.delete();
    pkg.delete();
    
    logger.info(`✅ Sent fetch by code request for seq=${currentSeqId}`);
    
    // Return sequence ID for tracking (no promises or timeouts!)
    return currentSeqId;
  }

  /**
   * Handle fetch by code response - follows CaitlynClientConnection pattern exactly
   * Uses sequence ID to look up cached query parameters for proper SVObject setup
   */
  handleFetchByCodeResponse(pkg) {
    logger.info('📥 ===== FETCH RESPONSE (ASYNC QUERY PIPELINE) =====');
    
    const res = new this.wasmModule.ATFetchSVRes();
    res.setCompressor(this.connection.compressor);
    res.decode(pkg.content());
    
    const results = res.results();
    const resultCount = results.size();
    
    logger.info(`📦 Received ${resultCount} StructValues from server`);
    
    // Find cached query info by sequence ID (CORE PATTERN)
    const responseSeq = res.seq;
    const queryInfo = this.queryCache.get(responseSeq);
    
    if (!queryInfo) {
      logger.warn(`⚠️ No cached query info found for seq=${responseSeq}`);
      res.delete();
      return;
    }
    
    logger.info(`🔍 Using cached query info for seq=${responseSeq}: ${queryInfo.qualifiedName}`);
    
    const records = [];
    
    if (results && resultCount > 0) {
      logger.info('🎯 Processing StructValues using async query pipeline:');
      
      // Create SVObject with proper metadata configuration from cache (PATTERN B)
      const svObject = new SVObject(this.wasmModule);
      
      try {
        // Configure SVObject with cached query parameters
        svObject.metaName = queryInfo.qualifiedName;
        svObject.namespace = queryInfo.namespace === 'global' ? 
          this.wasmModule.NAMESPACE_GLOBAL : this.wasmModule.NAMESPACE_PRIVATE;
        svObject.granularity = queryInfo.granularity;
        
        logger.info(`✅ Configured SVObject: ${svObject.metaName} (namespace: ${queryInfo.namespace})`);
        
        svObject.loadDefFromDict(this.schemaByNamespace);
        
        const maxDisplay = Math.min(5, resultCount);
        
        for (let i = 0; i < maxDisplay; i++) {
          const sv = results.get(i);
          
          try {
            // Process with configured SVObject 
            svObject.fromSv(sv);
            const objectData = svObject.toJSON();
            const fields = objectData.fields || {};
            
            const record = {
              index: i,
              fields: fields,
              metadata: {
                qualifiedName: queryInfo.qualifiedName,
                namespace: queryInfo.namespace,
                market: queryInfo.market,
                code: queryInfo.code
              }
            };
            
            records.push(record);
            
            logger.debug(`📄 Record ${i + 1}:`, Object.keys(fields).slice(0, 3).join(', '));
            
          } catch (recordError) {
            logger.error(`❌ Failed to process record ${i}:`, recordError);
          } finally {
            sv.delete();
          }
        }
        
        if (resultCount > maxDisplay) {
          logger.info(`... and ${resultCount - maxDisplay} more records (not displayed)`);
        }
        
      } finally {
        // Cleanup SVObject
        svObject.cleanup();
      }
    }
    
    // Emit event with processed data
    this.emit('fetch_response', {
      sequenceId: responseSeq,
      queryInfo: queryInfo,
      totalRecords: resultCount,
      displayedRecords: records.length,
      records: records
    });
    
    // Clean up query cache entry and WASM objects
    this.queryCache.delete(responseSeq);
    logger.debug(`🗑️ Cleaned up query cache for seq=${responseSeq}`);
    
    res.delete();
  }

  /**
   * Optional: Handle fetch by time response (similar pattern)
   */
  handleFetchByTimeResponse(pkg) {
    // Similar implementation to handleFetchByCodeResponse
    // Follow the same pattern: sequence ID lookup, query cache, SVObject processing
    logger.info('📥 Fetch by time response received');
    // Implementation follows same pattern...
  }

  /**
   * Clean up service resources
   */
  cleanup() {
    // Clear query cache
    this.queryCache.clear();
    logger.info('🧹 CaitlynAsyncQueryService cleanup complete');
  }
}

// Usage Example following CaitlynClientConnection pattern
async function demonstrateAsyncQueryPattern(connection, schemaByNamespace) {
  const queryService = new CaitlynAsyncQueryService(connection, schemaByNamespace);
  
  // Set up event listeners for responses
  queryService.on('fetch_response', (responseData) => {
    console.log('📈 Fetch Response Received:', {
      sequenceId: responseData.sequenceId,
      market: responseData.queryInfo.market,
      code: responseData.queryInfo.code,
      totalRecords: responseData.totalRecords,
      sampleRecord: responseData.records[0]?.fields // First record fields
    });
    
    // Process the data as needed
    responseData.records.forEach((record, index) => {
      console.log(`Record ${index + 1}:`, record.fields);
    });
  });
  
  try {
    // Send multiple async requests - no promises or timeouts needed!
    const seq1 = await queryService.fetchByCode('SHFE', 'cu2501', {
      qualifiedName: 'Future',
      granularity: 86400, // Daily
      fromDate: new Date('2025-01-01'),
      toDate: new Date('2025-08-01')
    });
    
    const seq2 = await queryService.fetchByCode('DCE', 'i2501', {
      qualifiedName: 'Future', 
      granularity: 3600, // Hourly
      fromDate: new Date('2025-07-01'),
      toDate: new Date('2025-08-01')
    });
    
    console.log(`📤 Sent requests with sequence IDs: ${seq1}, ${seq2}`);
    console.log('🔄 Responses will be handled asynchronously via events');
    
    // Responses are handled automatically via event listeners
    // No need to wait for promises or manage timeouts
    
  } finally {
    // Clean up when done
    setTimeout(() => {
      queryService.cleanup();
    }, 30000); // Give time for responses to arrive
  }
}

## General Async Request/Response Pattern

### Overview

This section explains how **all async request and response pairs** work in the CaitlynClientConnection architecture, providing the universal patterns that apply to any WebSocket-based async operation in the Caitlyn ecosystem.

### Universal Async Pattern Components

#### 1. **Query Cache Management**

All async operations follow the same query cache pattern:

```javascript
class UniversalAsyncHandler {
  constructor() {
    // Universal query cache for ALL async operations  
    this.queryCache = new Map(); // Map<sequenceId, queryInfo>
    this.sequenceCounter = 1;
  }

  // Store request parameters for ANY async operation
  cacheQuery(type, params) {
    const sequenceId = ++this.sequenceCounter;
    this.queryCache.set(sequenceId, {
      type: type,               // 'fetchByCode', 'fetchByTime', 'universeSeeds', etc.
      timestamp: Date.now(),
      ...params                 // Operation-specific parameters
    });
    return sequenceId;
  }

  // Retrieve cached query for response processing
  getCachedQuery(sequenceId) {
    const queryInfo = this.queryCache.get(sequenceId);
    if (queryInfo) {
      // Remove from cache after retrieval (one-time use)
      this.queryCache.delete(sequenceId);
    }
    return queryInfo;
  }
}
```

#### 2. **Request Generation Pattern**

All requests follow the same WASM encoding pattern:

```javascript
async function sendAsyncRequest(requestType, requestData, sequenceId) {
  let wasmRequest;
  let command;
  
  // Create appropriate WASM request object
  switch (requestType) {
    case 'fetchByCode':
      wasmRequest = new wasmModule.ATFetchByCodeReq(/* params */);
      command = wasmModule.CMD_AT_FETCH_BY_CODE;
      break;
    case 'fetchByTime':
      wasmRequest = new wasmModule.ATFetchByTimeReq(/* params */);
      command = wasmModule.CMD_AT_FETCH_BY_TIME;
      break;
    case 'universeSeeds':
      wasmRequest = new wasmModule.ATUniverseSeedsReq(/* params */);
      command = wasmModule.CMD_AT_UNIVERSE_SEEDS;
      break;
  }
  
  // Universal encoding and sending pattern
  const pkg = new wasmModule.NetPackage();
  const requestBuffer = pkg.encode(command, wasmRequest.encode());
  
  // Send via WebSocket
  connection.send(requestBuffer);
  
  // Always clean up WASM objects
  wasmRequest.delete();
  pkg.delete();
  
  return sequenceId;
}
```

#### 3. **Response Handling Pattern**

All responses follow the same processing pattern:

```javascript
function handleAsyncResponse(command, pkg) {
  let wasmResponse;
  let sequenceId;
  
  // Create appropriate WASM response object
  switch (command) {
    case wasmModule.CMD_AT_FETCH_SV_RES:
      wasmResponse = new wasmModule.ATFetchSVRes();
      wasmResponse.setCompressor(connection.compressor);
      wasmResponse.decode(pkg.content());
      sequenceId = wasmResponse.seq;
      break;
      
    case wasmModule.CMD_AT_UNIVERSE_SEEDS_RES:
      wasmResponse = new wasmModule.ATUniverseSeedsRes();
      wasmResponse.setCompressor(connection.compressor); 
      wasmResponse.decode(pkg.content());
      sequenceId = wasmResponse.seq;
      break;
  }
  
  // Universal response processing pattern
  const queryInfo = getCachedQuery(sequenceId);
  if (!queryInfo) {
    logger.warn(`No cached query for sequence ${sequenceId}`);
    wasmResponse.delete();
    return;
  }
  
  // Process response data based on query type
  processResponseData(queryInfo.type, wasmResponse, queryInfo);
  
  // Always clean up WASM objects
  wasmResponse.delete();
}
```

#### 4. **Data Processing Integration**

All data processing follows the same SVObject integration:

```javascript
function processResponseData(queryType, wasmResponse, queryInfo) {
  const results = wasmResponse.results();
  const resultCount = results.size();
  
  if (resultCount > 0) {
    // Create SVObject with cached query parameters (universal pattern)
    const svObject = new SVObject(wasmModule);
    
    try {
      // Configure SVObject based on cached query info
      if (queryInfo.qualifiedName) {
        svObject.metaName = queryInfo.qualifiedName;
        svObject.namespace = queryInfo.namespace || wasmModule.NAMESPACE_GLOBAL;
        svObject.granularity = queryInfo.granularity || 86400;
      }
      
      svObject.loadDefFromDict(schemaByNamespace);
      
      // Process all StructValues
      const processedData = [];
      for (let i = 0; i < resultCount; i++) {
        const sv = results.get(i);
        
        try {
          svObject.fromSv(sv);
          processedData.push(svObject.toJSON());
        } finally {
          sv.delete(); // Always cleanup StructValue
        }
      }
      
      // Emit processed data
      emitProcessedData(queryType, queryInfo, processedData);
      
    } finally {
      svObject.cleanup(); // Always cleanup SVObject
    }
  }
}
```

### Complete Universal Implementation

```javascript
/**
 * Universal Async Handler for ALL Caitlyn WebSocket operations
 * Handles fetch by code, fetch by time, universe operations, etc.
 */
class CaitlynUniversalAsyncHandler extends EventEmitter {
  constructor(connection, schemaByNamespace) {
    super();
    this.connection = connection;
    this.schemaByNamespace = schemaByNamespace;
    this.wasmModule = connection.wasmModule;
    
    // Universal query cache for ALL async operations
    this.queryCache = new Map(); // Map<sequenceId, queryInfo>
    this.sequenceCounter = 1;
    
    this.setupUniversalResponseHandlers();
  }
  
  /**
   * Set up universal response handlers for ALL command types
   */
  setupUniversalResponseHandlers() {
    this.connection.on('binary_message', (cmd, pkg) => {
      switch (cmd) {
        case this.wasmModule.CMD_AT_FETCH_SV_RES:
          this.handleResponse('fetchByCode', cmd, pkg);
          break;
        case this.wasmModule.CMD_AT_FETCH_BY_TIME_RES:
          this.handleResponse('fetchByTime', cmd, pkg);
          break;
        case this.wasmModule.CMD_AT_UNIVERSE_SEEDS_RES:
          this.handleResponse('universeSeeds', cmd, pkg);
          break;
        // Add more response types as needed
      }
    });
  }
  
  /**
   * Universal async request sender
   */
  async sendRequest(requestType, requestParams) {
    const sequenceId = this.cacheQuery(requestType, requestParams);
    
    // Build and send request based on type
    let wasmRequest, command;
    
    switch (requestType) {
      case 'fetchByCode':
        wasmRequest = new this.wasmModule.ATFetchByCodeReq(
          this.connection.token,
          sequenceId,
          requestParams.revision || -1,
          requestParams.namespace || this.wasmModule.NAMESPACE_GLOBAL,
          requestParams.qualifiedName || 'SampleQuote',
          requestParams.market,
          requestParams.code,
          Math.floor(requestParams.fromDate.getTime() / 1000),
          Math.floor(requestParams.toDate.getTime() / 1000),
          requestParams.granularity || 86400,
          requestParams.fields || []
        );
        command = this.wasmModule.CMD_AT_FETCH_BY_CODE;
        break;
        
      case 'universeSeeds':
        wasmRequest = new this.wasmModule.ATUniverseSeedsReq(
          this.connection.token,
          sequenceId,
          requestParams.revision || -1,
          requestParams.namespace || this.wasmModule.NAMESPACE_GLOBAL,
          requestParams.qualifiedName,
          requestParams.market
        );
        command = this.wasmModule.CMD_AT_UNIVERSE_SEEDS;
        break;
    }
    
    // Universal send pattern
    const pkg = new this.wasmModule.NetPackage();
    const requestBuffer = pkg.encode(command, wasmRequest.encode());
    
    this.connection.sendBinaryMessage(requestBuffer);
    
    // Clean up WASM objects
    wasmRequest.delete();
    pkg.delete();
    
    logger.info(`✅ Sent ${requestType} request with sequence ID: ${sequenceId}`);
    return sequenceId;
  }
  
  /**
   * Universal response handler
   */
  handleResponse(responseType, cmd, pkg) {
    let wasmResponse, sequenceId;
    
    // Decode response based on type
    switch (responseType) {
      case 'fetchByCode':
      case 'fetchByTime':
        wasmResponse = new this.wasmModule.ATFetchSVRes();
        wasmResponse.setCompressor(this.connection.compressor);
        wasmResponse.decode(pkg.content());
        sequenceId = wasmResponse.seq;
        break;
        
      case 'universeSeeds':
        wasmResponse = new this.wasmModule.ATUniverseSeedsRes();
        wasmResponse.setCompressor(this.connection.compressor);
        wasmResponse.decode(pkg.content());
        sequenceId = wasmResponse.seq;
        break;
    }
    
    // Get cached query info
    const queryInfo = this.getCachedQuery(sequenceId);
    if (!queryInfo) {
      logger.warn(`No cached query for ${responseType} sequence ${sequenceId}`);
      wasmResponse.delete();
      return;
    }
    
    // Process response with SVObject
    this.processUniversalResponse(responseType, wasmResponse, queryInfo);
    
    // Clean up
    wasmResponse.delete();
  }
  
  /**
   * Universal data processing with SVObject integration
   */
  processUniversalResponse(responseType, wasmResponse, queryInfo) {
    const results = wasmResponse.results();
    const resultCount = results.size();
    
    logger.info(`📥 Processing ${responseType} response: ${resultCount} records`);
    
    const processedData = [];
    
    if (resultCount > 0) {
      // Create SVObject for processing
      const svObject = new SVObject(this.wasmModule);
      
      try {
        // Configure SVObject with cached query parameters
        if (queryInfo.qualifiedName) {
          svObject.metaName = queryInfo.qualifiedName;
          svObject.namespace = queryInfo.namespace || this.wasmModule.NAMESPACE_GLOBAL;
          svObject.granularity = queryInfo.granularity || 86400;
        }
        
        svObject.loadDefFromDict(this.schemaByNamespace);
        
        // Process all StructValues
        for (let i = 0; i < resultCount; i++) {
          const sv = results.get(i);
          
          try {
            svObject.fromSv(sv);
            const recordData = svObject.toJSON();
            
            processedData.push({
              index: i,
              fields: recordData.fields || {},
              metadata: {
                type: responseType,
                qualifiedName: queryInfo.qualifiedName,
                market: queryInfo.market,
                code: queryInfo.code
              }
            });
            
          } catch (recordError) {
            logger.error(`Failed to process record ${i}:`, recordError);
          } finally {
            sv.delete();
          }
        }
        
      } finally {
        svObject.cleanup();
      }
    }
    
    // Emit universal response event
    this.emit('async_response', {
      type: responseType,
      sequenceId: wasmResponse.seq,
      queryInfo: queryInfo,
      totalRecords: resultCount,
      processedRecords: processedData
    });
  }
  
  /**
   * Cache query information for async processing
   */
  cacheQuery(type, params) {
    const sequenceId = ++this.sequenceCounter;
    this.queryCache.set(sequenceId, {
      type: type,
      timestamp: Date.now(),
      ...params
    });
    return sequenceId;
  }
  
  /**
   * Get and remove cached query information
   */
  getCachedQuery(sequenceId) {
    const queryInfo = this.queryCache.get(sequenceId);
    if (queryInfo) {
      this.queryCache.delete(sequenceId); // One-time use
    }
    return queryInfo;
  }
  
  /**
   * Cleanup all resources
   */
  cleanup() {
    this.queryCache.clear();
    this.removeAllListeners();
    logger.info('🧹 Universal async handler cleanup complete');
  }
}
```

### Universal Usage Pattern

```javascript
// Create universal handler
const asyncHandler = new CaitlynUniversalAsyncHandler(connection, schemaByNamespace);

// Set up universal response listener
asyncHandler.on('async_response', (responseData) => {
  console.log(`📈 ${responseData.type} Response:`, {
    sequenceId: responseData.sequenceId,
    totalRecords: responseData.totalRecords,
    sampleData: responseData.processedRecords[0]?.fields
  });
});

// Send any type of async request
const seq1 = await asyncHandler.sendRequest('fetchByCode', {
  market: 'SHFE',
  code: 'cu2501',
  qualifiedName: 'Future',
  fromDate: new Date('2025-01-01'),
  toDate: new Date('2025-08-01')
});

const seq2 = await asyncHandler.sendRequest('universeSeeds', {
  qualifiedName: 'Market',
  market: 'SHFE'
});

// Both responses handled automatically via the same universal pattern
```

### Key Benefits of Universal Pattern

1. **Consistency**: Same pattern for ALL async operations
2. **Maintainability**: Single codebase handles all request types
3. **Scalability**: Easy to add new async operation types
4. **Memory Safety**: Universal cleanup patterns prevent leaks
5. **Error Handling**: Centralized error management
6. **Performance**: Optimal SVObject reuse and resource management

This universal pattern forms the foundation for all async operations in the Caitlyn ecosystem, ensuring consistent behavior and maintainable code across all WebSocket interactions.

---

  /**
   * Determine qualified name from metadata ID and namespace
   */
  determineQualifiedName(metaID, namespaceId) {
    const namespaceStr = namespaceId === 0 ? 'global' : 'private';
    const meta = this.schemaByNamespace[namespaceStr]?.[metaID];
    
    if (!meta) {
      return null;
    }
    
    return `${namespaceStr}::${meta.name}`;
  }

  /**
   * Check if qualified name is a known predefined metadata type
   */
  isKnownMetadataType(qualifiedName) {
    const knownTypes = [
      'global::Market', 'private::Market',
      'global::Security', 'private::Security', 
      'global::Holiday', 'private::Holiday',
      'global::Commodity', 'private::Commodity',
      'global::Future', 'private::Future',
      'global::Stock', 'private::Stock',
      'global::Dividend', 'private::Dividend'
    ];
    
    return knownTypes.includes(qualifiedName);
  }

  /**
   * Extract meta name from qualified name
   */
  extractMetaName(qualifiedName) {
    return qualifiedName.split('::')[1];
  }

  /**
   * Handle incoming binary response from connection
   * Called by connection pool when response arrives
   */
  handleIncomingResponse(cmd, content, sequenceId) {
    if (cmd !== this.wasmModule.CMD_AT_FETCH_SV_RES) {
      return false; // Not our response type
    }
    
    const request = this.activeRequests.get(sequenceId);
    if (!request) {
      logger.warn(`⚠️ Received response for unknown request ${sequenceId}`);
      return false;
    }
    
    try {
      request.resolve(content);
      return true;
    } catch (error) {
      request.reject(error);
      return false;
    }
  }

  /**
   * Get next sequence ID for requests
   */
  getNextSequenceId() {
    const current = this.sequenceCounter;
    this.sequenceCounter++;
    
    // Wrap around to prevent overflow
    if (this.sequenceCounter > 2147483647) { // Max 32-bit signed integer
      this.sequenceCounter = 1;
    }
    
    return current;
  }

  /**
   * Clean up service resources
   */
  async cleanup() {
    // Cancel all pending requests
    for (const [requestId, request] of this.activeRequests) {
      request.reject(new Error('Service shutting down'));
    }
    
    this.activeRequests.clear();
    
    // Clean up cached SVObjects
    for (const svObject of this.svObjectCache.values()) {
      svObject.cleanup();
    }
    
    this.svObjectCache.clear();
    
    logger.info('🧹 CaitlynFetchByCodeService cleanup complete');
  }
}

// Usage Example with CaitlynWebSocketService integration
export async function setupFetchByCodeService(caitlynService) {
  // Ensure connection pool is initialized
  if (!caitlynService.connectionPool?.isInitialized) {
    throw new Error('Connection pool must be initialized first');
  }
  
  const fetchService = new CaitlynFetchByCodeService(
    caitlynService.connectionPool,
    caitlynService.getSharedSchema(),
    caitlynService.connectionPool.wasmModule // Access WASM module from pool
  );
  
  // Register response handler with connection pool
  caitlynService.connectionPool.on('binary_message', (connectionId, cmd, content, sequenceId) => {
    fetchService.handleIncomingResponse(cmd, content, sequenceId);
  });
  
  return fetchService;
}

// Production usage example
async function demonstrateHistoricalDataFetch(caitlynService) {
  const fetchService = await setupFetchByCodeService(caitlynService);
  
  try {
    // Fetch copper futures data from SHFE
    const copperData = await fetchService.fetchHistoricalData('SHFE', 'cu2501', {
      qualifiedName: 'Future',
      granularity: 1440, // Daily data
      startTime: Date.now() - (30 * 24 * 60 * 60 * 1000), // 30 days ago
      endTime: Date.now(),
      maxRecords: 500
    });
    
    console.log('📈 Copper Futures Data:', {
      totalRecords: copperData.totalRecords,
      processingStats: copperData.processingStats,
      sampleRecord: copperData.records[0]?.fields // First record fields
    });
    
    // Process multiple securities in batch
    const securities = [
      { market: 'SHFE', code: 'au2412' }, // Gold
      { market: 'DCE', code: 'i2501' },   // Iron ore
      { market: 'CZCE', code: 'TA501' }   // PTA
    ];
    
    const batchResults = await Promise.all(
      securities.map(({ market, code }) => 
        fetchService.fetchHistoricalData(market, code, {
          qualifiedName: 'Future',
          granularity: 60, // Hourly data
          maxRecords: 100
        })
      )
    );
    
    console.log('📊 Batch processing complete:', 
      batchResults.map(result => ({
        market: result.market,
        code: result.code,
        records: result.totalRecords
      }))
    );
    
  } finally {
    // Always cleanup
    await fetchService.cleanup();
  }
}
```

### Key Integration Benefits

1. **Pool Resource Management**: Efficiently uses connection pool for scalable requests
2. **SVObject Safety**: Schema-compliant data extraction with proper cleanup
3. **Performance Optimization**: SVObject instance reuse reduces memory allocation
4. **Error Resilience**: Continues processing even if individual records fail
5. **Production Ready**: Comprehensive logging, error handling, and resource management

### Best Practices Demonstrated

- ✅ **Connection Pool Integration**: Proper use of available connections
- ✅ **SVObject Instance Reuse**: Cache SVObjects per request for performance
- ✅ **Memory Management**: Mandatory cleanup of all WASM objects
- ✅ **Schema Compliance**: Dynamic qualified name resolution
- ✅ **Error Handling**: Graceful degradation with detailed logging
- ✅ **Request Tracking**: Sequence ID management and timeout handling
- ✅ **Resource Cleanup**: Proper cleanup in finally blocks

This pattern provides the foundation for building robust historical data processing applications with Caitlyn integration.

---

## Conclusion

The **SVObject Doctrine** is essential for building reliable, maintainable Caitlyn applications. By following these patterns, you ensure:

- **Field Alignment Safety**: No crashes from schema mismatches
- **Schema Compliance**: All data extraction follows server schema definitions
- **Memory Safety**: Proper WASM object lifecycle management
- **Performance Optimization**: Instance reuse reduces overhead by ~90%
- **Code Consistency**: Same pattern across all components
- **Future-Proof Architecture**: Adapts automatically to schema changes

### Key Takeaways

🚫 **NEVER** access StructValue fields directly with hardcoded positions
✅ **ALWAYS** use SVObject pattern for all StructValue processing  
🔄 **CHOOSE** the right pattern: createSingularityObject for known types, direct SVObject for dynamic types
🔄 **REUSE** SVObject instances for optimal performance
🧹 **CLEANUP** SVObject instances to prevent memory leaks
📋 **VALIDATE** schema availability before processing
🎯 **FOLLOW** the established patterns consistently

### Pattern Decision Matrix

| Use Case | Pattern | Example |
|----------|---------|---------|
| **Market Data Processing** | Pattern A | `createSingularityObject("global::Market", wasmModule)` |
| **Security Data Processing** | Pattern A | `createSingularityObject("global::Security", wasmModule)` |
| **Universe Seeds Processing** | Pattern A | `createSingularityObject("global::Holiday", wasmModule)` |
| **Historical Data Queries** | Pattern B | `new SVObject(wasmModule)` + configure metadata |
| **Fetch By Code Responses** | Pattern B | `new SVObject(wasmModule)` + configure metadata |
| **Dynamic Query Results** | Pattern B | `new SVObject(wasmModule)` + configure metadata |

For implementation examples, see:
- `backend/src/utils/SingularityObjects.js` - SVObject factory functions
- `backend/src/utils/CaitlynClientConnection.js` - SVObject usage in production
- `docs/schema_decoder.js` - Schema analysis for field mapping
- `SVOBJECT_IMPLEMENTATION.md` - Detailed implementation guide

**Next Steps**: Apply SVObject pattern to all StructValue processing in your application for optimal safety and performance.

---

**Related Documentation:**
- **Connection Architecture**: `CAITLYN_CLIENT_CONNECTION_PATTERN.md` - Production-ready connection patterns
- **Implementation Files**: `SingularityObjects.js`, `StructValueWrapper.js` - SVObject class definitions
- **Usage Examples**: `CaitlynClientConnection.js` - Real-world SVObject usage patterns
- **Schema Analysis**: `schema_decoder.js` - Tool for understanding field mappings