# Caitlyn WASM Namespace Usage Guide

## Overview

The Caitlyn WASM system uses namespaces to organize metadata definitions and qualified names. This document clarifies the different namespace representations and their usage patterns throughout the codebase.

## Namespace Representations

### 1. WASM Constants
```javascript
this.wasmModule.NAMESPACE_GLOBAL = 0    // Global namespace
this.wasmModule.NAMESPACE_PRIVATE = 1   // Private namespace
```

### 2. String Representations
```javascript
'global'    // String representation for global namespace
'private'   // String representation for private namespace
```

### 3. Schema Storage Keys
```javascript
'0'         // Schema storage key for global namespace (this.schema['0'])
'1'         // Schema storage key for private namespace (this.schema['1'])
```

### 4. Qualified Name Prefixes
```javascript
'global::SampleQuote'     // Full qualified name with global namespace
'private::SampleQuote'    // Full qualified name with private namespace
```

## Usage Patterns by Context

### API Function Parameters
**Convention**: Use string representations (`'global'`, `'private'`)
```javascript
subscribe(market, code, qualifiedName = 'SampleQuote', namespace = 'global', callback, options = {})
fetchByCode(market, code, { qualifiedName: 'SampleQuote', namespace: 'global' })
```

**Rationale**: More readable and user-friendly for API consumers.

### Internal WASM Operations
**Convention**: Use WASM constants (0, 1)
```javascript
const namespaceId = namespace === 'global' ? this.wasmModule.NAMESPACE_GLOBAL : this.wasmModule.NAMESPACE_PRIVATE;
svObject.namespace = namespaceId;
```

**Rationale**: Required by WASM interface for StructValue processing.

### Schema Lookups
**Convention**: Use string keys ('0', '1')
```javascript
// Schema storage uses string keys
this.schema['0']    // Global namespace schema
this.schema['1']    // Private namespace schema

// Schema by namespace uses numeric keys
this.schemaByNamespace[0]   // Global namespace raw metadata
this.schemaByNamespace[1]   // Private namespace raw metadata
```

### Qualified Name Construction
**Convention**: Use string prefixes
```javascript
const fullQualifiedName = `${namespace}::${qualifiedName}`;
// Examples:
// "global::SampleQuote"
// "private::Market"
```

## Conversion Functions

### String to WASM Constant
```javascript
function getNamespaceId(namespaceString) {
  return namespaceString === 'global' ? this.wasmModule.NAMESPACE_GLOBAL : this.wasmModule.NAMESPACE_PRIVATE;
}
```

### WASM Constant to String  
```javascript
function getNamespaceString(namespaceId) {
  return namespaceId === 0 ? 'global' : 'private';
}
```

### String to Schema Key
```javascript
function getSchemaKey(namespaceString) {
  return namespaceString === 'global' ? '0' : '1';
}
```

### WASM Constant to Schema Key
```javascript
function getSchemaKeyFromId(namespaceId) {
  return namespaceId.toString();
}
```

## Implementation Standards

### 1. API Layer (Public Methods)
- **Input**: Accept string namespace (`'global'`, `'private'`)
- **Validation**: Validate against allowed values
- **Example**:
```javascript
subscribe(market, code, qualifiedName, namespace = 'global', callback, options = {}) {
  if (!['global', 'private'].includes(namespace)) {
    throw new Error(`Invalid namespace: ${namespace}. Must be 'global' or 'private'`);
  }
  // ... rest of implementation
}
```

### 2. Internal Processing
- **Convert Early**: Convert string to appropriate format at method entry
- **Use Consistently**: Maintain same format throughout method
- **Example**:
```javascript
subscribe(market, code, qualifiedName, namespace = 'global', callback, options = {}) {
  // Convert once at the beginning
  const namespaceId = namespace === 'global' ? this.wasmModule.NAMESPACE_GLOBAL : this.wasmModule.NAMESPACE_PRIVATE;
  const schemaKey = namespace === 'global' ? '0' : '1';
  const fullQualifiedName = `${namespace}::${qualifiedName}`;
  
  // Use converted values consistently
  const schema = this.schema[schemaKey];
  svObject.namespace = namespaceId;
  // ...
}
```

### 3. Schema Operations
- **Schema Storage**: Use string keys ('0', '1')
- **Raw Metadata**: Use numeric keys (0, 1)
- **Example**:
```javascript
// Schema field lookup
const processedSchema = this.schema[schemaKey];           // '0' or '1'
const rawMetadata = this.schemaByNamespace[namespaceId];  // 0 or 1
```

## Common Mistakes to Avoid

### ❌ Inconsistent Namespace Formats
```javascript
// Bad: Mixing formats within same method
const namespaceId = namespace === 'global' ? 0 : 1;
const schema = this.schema[namespace];  // Wrong! Should use '0'/'1'
```

### ❌ Magic Numbers
```javascript
// Bad: Using magic numbers
svObject.namespace = 0;  // What does 0 mean?

// Good: Using constants
svObject.namespace = this.wasmModule.NAMESPACE_GLOBAL;
```

### ❌ Incorrect Schema Key Usage
```javascript
// Bad: Using numeric keys for processed schema
const schema = this.schema[0];  // Wrong! Should be this.schema['0']

// Good: Using string keys for processed schema
const schema = this.schema['0'];
```

## Testing Namespace Handling

### Validation Tests
```javascript
// Test namespace parameter validation
expect(() => connection.subscribe('ICE', 'B<00>', 'SampleQuote', 'invalid')).toThrow();
expect(() => connection.subscribe('ICE', 'B<00>', 'SampleQuote', 'global')).not.toThrow();
expect(() => connection.subscribe('ICE', 'B<00>', 'SampleQuote', 'private')).not.toThrow();
```

### Schema Lookup Tests
```javascript
// Test schema lookups work with both namespaces
const globalFields = connection.getFieldsFromSchema('SampleQuote', 'global');
const privateFields = connection.getFieldsFromSchema('SampleQuote', 'private');
expect(globalFields).toBeDefined();
expect(privateFields).toBeDefined();
```

## Summary

| Context | Format | Example | Usage |
|---------|--------|---------|--------|
| API Parameters | String | `'global'`, `'private'` | User-facing methods |
| WASM Operations | Numeric | `0`, `1` | StructValue processing |
| Schema Storage | String Key | `'0'`, `'1'` | this.schema lookup |
| Raw Metadata | Numeric Key | `0`, `1` | this.schemaByNamespace lookup |
| Qualified Names | String Prefix | `'global::'`, `'private::'` | Full qualified names |

**Key Principle**: Convert namespace format once at method entry, then use consistently throughout the method to avoid confusion and bugs.