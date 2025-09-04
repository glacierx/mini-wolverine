/**
 * JavaScript StructValue Wrapper - Equivalent to Python sv_object
 * 
 * This class provides a JavaScript-friendly interface to WASM StructValue objects,
 * similar to the Python sv_object implementation. It handles field definitions,
 * type mapping, and serialization/deserialization between JavaScript objects
 * and WASM StructValue instances.
 * 
 * @version 1.0
 * @author Generated for Mini Wolverine
 */



/**
 * Base class for all StructValue-based objects
 * Equivalent to Python sv_object class
 */
export class SVObject {
    constructor(wasmModule) {
        if (!wasmModule) {
            throw new Error('WASM module is required');
        }
        
        this.wasmModule = wasmModule;
        
        // Core identification  
        this.namespace = wasmModule.NAMESPACE_PRIVATE;
        this.metaId = 0;
        this.metaName = '';
        this.market = '';
        this.code = '';
        this.timetag = null;
        this.granularity = null;
        this.revision = 0xFFFFFFFF;
        
        // Field definitions: [(name, type), ...]
        this.fields = [];
        this.fieldsSet = new Set(); // Fast lookup
        
        // Core StructValue instance
        this.sv = null;
        
        // Metadata
        this.overwrite = true;
        this.persistent = true;
        
        // Initialize fields
        this.initializeFields();
        this.buildFieldsSet();
    }
    
    /**
     * Initialize field definitions - to be overridden by subclasses
     */
    initializeFields() {
        // Override in subclasses to define fields
        // Example: this.fields = [['value', DataType.DOUBLE], ['count', DataType.INT]];
    }
    
    /**
     * Load field definitions from IndexMeta (equivalent to Python: load_def)
     * @param {Object} meta - WASM IndexMeta object
     */
    loadDef(meta) {
        this.meta = meta;
        this.metaId = meta.ID;
        this.revision = meta.revision;
        
        // Convert IndexMeta to field definitions (equivalent to Python: index_meta_to_fields_def)
        this.fields = this.indexMetaToFieldsDef(meta);
        this.buildFieldsSet();
    }
    
    /**
     * Load field definitions from schema dictionary (equivalent to Python: load_def_from_dict)
     * @param {Object} schema - Schema object organized by namespace and ID: schema[namespace][metaID] = meta
     */
    loadDefFromDict(schema) {
        // Find the best matching meta based on namespace, metaName, and revision
        let bestMeta = null;
        let maxRevision = -1;
        
        // Iterate through all metas in the target namespace
        for (const metaId in schema[this.namespace]) {
            const meta = schema[this.namespace][metaId];
            
            // Parse qualified name: "global::SampleQuote" or "private::SampleQuote"
            const nameParts = meta.name.split('::');
            const metaNameFromSchema = nameParts[1];
            // console.log(`Checking meta: ${meta.name} (ID: ${meta.ID}, Rev: ${meta.revision}). This.metaName=${this.metaName}, This.revision=${this.revision}`);
            if (metaNameFromSchema === this.metaName) {
                // Get revision from meta
                const metaRevision = meta.revision;
                
                // Find the best revision <= this.revision with highest value
                if (metaRevision <= this.revision && metaRevision >= maxRevision) {
                    bestMeta = meta;
                    maxRevision = metaRevision;
                }
            }
        }
        if(bestMeta === null) {
            throw new Error(`No matching metadata found for ${this.namespace}::${this.metaName} with revision <= ${this.revision}`);
        }
        this.loadDef(bestMeta);
    }
    
    /**
     * Convert IndexMeta to field definitions (equivalent to Python static method)
     * @param {Object} meta - WASM IndexMeta object
     * @returns {Array} - Array of [name, type] pairs
     */
    indexMetaToFieldsDef(meta) {
        const fields = [];
        const fieldVector = meta.fields;
        const fieldCount = fieldVector.size();
        
        for (let i = 0; i < fieldCount; i++) {
            const field = fieldVector.get(i);
            const name = field.name;
            const type = field.type;
            
            fields.push([name, type]);
        }
        
        return fields;
    }
    
    /**
     * Build field name set for fast lookup
     */
    buildFieldsSet() {
        this.fieldsSet = new Set(this.fields.map(field => field[0]));
    }
    
    /**
     * Get attribute value for StructValue serialization
     * @param {string} name - Field name
     * @returns {any} - Field value
     */
    getSvAttr(name) {
        return this[name];
    }
    
    /**
     * Set attribute value from StructValue deserialization
     * @param {string} name - Field name
     * @param {any} value - Field value
     */
    setSvAttr(name, value) {
        this[name] = value;
    }
    
    /**
     * Create and populate StructValue from JavaScript object
     * Equivalent to Python to_sv() method
     * @returns {Object} - WASM StructValue instance
     */
    toSv() {
        if (this.sv) {
            this.sv.delete();
        }
        
        this.sv = new this.wasmModule.StructValue();
        this.sv.reset();
        this.sv.resize(this.fields.length);
        
        // Set header information
        this.sv.metaID = this.metaId;
        this.sv.market = this.market;
        this.sv.stockCode = this.code;
        this.sv.granularity = this.granularity || 0;
        this.sv.timeTag = this.timetag || 0;
        this.sv.namespace = this.namespace;
        
        // Set field count
        this.sv.fieldCount = this.fields.length;
        
        // Set field values by type
        for (let i = 0; i < this.fields.length; i++) {
            const [name, type] = this.fields[i];
            const attr = this.getSvAttr(name);
            
            if (attr === null || attr === undefined) {
                continue; // Skip empty fields
            }
            // Use FieldType enum comparison like fromSv()
            // C++ signatures: setXXX(value, position) - value first, position second
            if (type.value === this.wasmModule.FieldType.Integer.value) {
                this.sv.setInt32(parseInt(attr), i);
            } else if (type.value === this.wasmModule.FieldType.Double.value) {
                this.sv.setDouble(parseFloat(attr), i);
            } else if (type.value === this.wasmModule.FieldType.String.value) {
                this.sv.setString(String(attr), i);
            } else if (type.value === this.wasmModule.FieldType.Integer64.value) {
                // For int64, use setInt64 which maps to setInt64S in C++ (takes string parameter)
                this.sv.setInt64(String(attr), i);
            } else if (type.value === this.wasmModule.FieldType.IntegerVector.value) {
                this.sv.setInt32Vector(Array.isArray(attr) ? attr : [], i);
            } else if (type.value === this.wasmModule.FieldType.DoubleVector.value) {
                this.sv.setDoubleVector(Array.isArray(attr) ? attr : [], i);
            } else if (type.value === this.wasmModule.FieldType.StringVector.value) {
                this.sv.setStringVector(Array.isArray(attr) ? attr : [], i);
            } else if (type.value === this.wasmModule.FieldType.Integer64Vector.value) {
                // For int64 vector, should be string array from fromSv()
                this.sv.setInt64Vector(Array.isArray(attr) ? attr : [], i);
            }
        }
        
        return this.sv;
    }
    
    /**
     * Populate JavaScript object from StructValue
     * Equivalent to Python from_sv() method
     * @param {Object} sv - WASM StructValue instance
     */
    fromSv(sv) {
        // Update header information
        this.timetag = sv.timeTag;
        this.market = sv.market;
        this.code = sv.stockCode;
        this.granularity = sv.granularity;
        
        // Extract field values by type
        for (let i = 0; i < this.fields.length; i++) {
            const [name, type] = this.fields[i];
            
            if (sv.isEmpty(i)) {
                this.setSvAttr(name, null);
                continue;
            }
            
            let value;
            // Use .value property for enum comparison
            if (type.value === this.wasmModule.FieldType.Integer.value) {
                value = sv.getInt32(i);
            } else if (type.value === this.wasmModule.FieldType.Double.value) {
                value = sv.getDouble(i);
            } else if (type.value === this.wasmModule.FieldType.String.value) {
                value = sv.getString(i);
            } else if (type.value === this.wasmModule.FieldType.Integer64.value) {
                // Use getInt64() which returns string representation of int64
                value = sv.getInt64(i);
            } else if (type.value === this.wasmModule.FieldType.IntegerVector.value) {
                const vector = sv.getInt32Vector(i);
                value = this.convertVectorToArray(vector);
            } else if (type.value === this.wasmModule.FieldType.DoubleVector.value) {
                const vector = sv.getDoubleVector(i);
                value = this.convertVectorToArray(vector);
            } else if (type.value === this.wasmModule.FieldType.StringVector.value) {
                const vector = sv.getStringVector(i);
                value = this.convertVectorToArray(vector);
            } else if (type.value === this.wasmModule.FieldType.Integer64Vector.value) {
                // Use getInt64Vector() which returns vector<string> representation of vector<int64>
                const vector = sv.getInt64Vector(i);
                value = this.convertVectorToArray(vector);
            }
            this.setSvAttr(name, value);
        }
    }
    
    /**
     * Convert WASM Vector to JavaScript Array
     * @param {Object} vector - WASM Vector object (StringVector, Int32Vector, etc.)
     * @returns {Array} - JavaScript array
     */
    convertVectorToArray(vector) {
        if (!vector || typeof vector.size !== 'function') {
            return [];
        }
        
        const array = [];
        const size = vector.size();
        
        for (let i = 0; i < size; i++) {
            array.push(vector.get(i));
        }
        
        return array;
    }
    
    /**
     * Check if this object is compatible with a StructValue
     * @param {Object} sv - WASM StructValue instance
     * @returns {boolean} - True if compatible
     */
    isCompatible(sv) {
        return (
            this.namespace === sv.namespace &&
            (this.metaId === 0 || this.metaId === sv.metaID)
        );
    }
    
    /**
     * Create a copy of this object
     * @returns {SVObject} - New instance with same data
     */
    clone() {
        const Constructor = this.constructor;
        const cloned = new Constructor(this.wasmModule);
        
        // Copy all field values
        for (const [name] of this.fields) {
            const value = this.getSvAttr(name);
            if (Array.isArray(value)) {
                cloned.setSvAttr(name, [...value]);
            } else {
                cloned.setSvAttr(name, value);
            }
        }
        
        // Copy header information
        cloned.namespace = this.namespace;
        cloned.metaId = this.metaId;
        cloned.metaName = this.metaName;
        cloned.market = this.market;
        cloned.code = this.code;
        cloned.timetag = this.timetag;
        cloned.granularity = this.granularity;
        
        return cloned;
    }
    
    /**
     * Convert to JSON representation
     * @returns {Object} - JSON object
     */
    toJSON() {
        const result = {
            // Header information
            namespace: this.namespace,
            metaId: this.metaId,
            metaName: this.metaName,
            market: this.market,
            code: this.code,
            timetag: this.timetag,
            granularity: this.granularity,
            
            // Field data
            fields: {}
        };
        
        for (const [name] of this.fields) {
            result.fields[name] = this.getSvAttr(name);
        }
        
        return result;
    }
    
    /**
     * Populate from JSON representation
     * @param {Object} json - JSON object
     */
    fromJSON(json) {
        // Set header information
        this.namespace = json.namespace || this.namespace;
        this.metaId = json.metaId || this.metaId;
        this.metaName = json.metaName || this.metaName;
        this.market = json.market || this.market;
        this.code = json.code || this.code;
        this.timetag = json.timetag;
        this.granularity = json.granularity;
        
        // Set field values
        if (json.fields) {
            for (const [name] of this.fields) {
                if (json.fields.hasOwnProperty(name)) {
                    this.setSvAttr(name, json.fields[name]);
                }
            }
        }
    }
    
    /**
     * Get string representation
     * @returns {string} - String description
     */
    toString() {
        const fieldValues = this.fields.map(([name, type]) => {
            const value = this.getSvAttr(name);
            return `${name}(${type}): ${JSON.stringify(value)}`;
        }).join(', ');
        
        return `${this.metaName}[${this.namespace}:${this.metaId}] ${this.market}/${this.code}@${this.granularity}s - {${fieldValues}}`;
    }
    
    /**
     * Cleanup WASM resources
     */
    cleanup() {
        if (this.sv) {
            this.sv.delete();
            this.sv = null;
        }
    }
    
    /**
     * Destructor - cleanup resources
     */
    delete() {
        this.cleanup();
    }
}

/**
 * Helper function to convert IndexMeta to field definitions
 * Equivalent to Python index_meta_to_fields_def function
 * @param {Object} meta - WASM IndexMeta object
 * @returns {Array} - Array of [name, type] pairs
 */
export function indexMetaToFieldsDef(meta) {
    const fields = [];
    
    // This would need to be implemented based on the actual
    // WASM IndexMeta interface when available
    if (meta && meta.fields) {
        for (const field of meta.fields) {
            const name = field.name || field.get_name?.() || '';
            const type = field.type || field.get_type?.() || DataType.STRING;
            fields.push([name.toString(), type]);
        }
    }
    
    return fields;
}

export default SVObject;