/**
 * Singularity Data Objects - SVObject subclasses for all Singularity metadata types
 * 
 * Based on SINGULARITY_DATA_MAINTENANCE.md documentation, this file defines
 * SVObject subclasses for all the key Singularity data types:
 * - Market (global::Market, private::Market)  
 * - Holiday (global::Holiday, private::Holiday)
 * - Security (global::Security, private::Security)
 * - Commodity (global::Commodity, private::Commodity)
 * - Future (global::Future, private::Future)
 * - Stock (global::Stock, private::Stock)
 * 
 * Each class follows the SVObject pattern from test.js, handling proper field
 * definitions, type mapping, and serialization/deserialization.
 */

import SVObject from './StructValueWrapper.js';

/**
 * Market - Fundamental market information and revision tracking
 * Follows SampleQuote pattern from test.js
 */
export class MarketData extends SVObject {
    constructor(wasmModule, namespace = 0) {
        super(wasmModule);
        this.namespace = namespace;
        this.metaName = 'Market';
        
        // Market-specific field properties (schema will define the actual field mappings)
        this.trade_day = null;
        this.name = null;
        this.time_zone = null;
        this.revs = null;
    }
    
    /**
     * Parse revisions JSON from field 7
     * @returns {Object} - Parsed revisions object
     */
    getRevisions() {
        return this.revs ? JSON.parse(this.revs) : {};
    }
    
    /**
     * Set revisions JSON to field 7  
     * @param {Object} revisions - Revisions object
     */
    setRevisions(revisions) {
        this.revs = JSON.stringify(revisions);
    }
}

/**
 * Holiday - Market holiday and trading calendar information
 * Follows SampleQuote pattern from test.js
 */
export class HolidayData extends SVObject {
    constructor(wasmModule, namespace = 0) {
        super(wasmModule);
        this.namespace = namespace;
        this.metaName = 'Holiday';
        
        // Holiday-specific field properties (schema will define the actual field mappings)
        this.rev = null;
        this.trade_day = null;
        this.dates = null;
    }
}

/**
 * Security - Securities list and basic information
 * Follows SampleQuote pattern from test.js
 */
export class SecurityData extends SVObject {
    constructor(wasmModule, namespace = 0) {
        super(wasmModule);
        this.namespace = namespace;
        this.metaName = 'Security';
        
        // Security-specific field properties (schema will define the actual field mappings)
        this.rev = null;
        this.trade_day = null;
        this.code = null;          // StringVector of security codes
        this.name = null;          // StringVector of security names  
        this.abbreviation = null;  // StringVector of abbreviations
        this.category = null;      // Int32Vector of categories
        this.state = null;         // Int32Vector of states
        this.last_close = null;    // DoubleVector of last close prices
        this.dividend_ratio = null; // DoubleVector of dividend ratios
        this.lists_at = null;      // Lists at date
        this.suspend = null;       // Suspend information
    }
}

/**
 * Commodity - Commodity definitions and trading parameters
 * Follows SampleQuote pattern from test.js
 */
export class CommodityData extends SVObject {
    constructor(wasmModule, namespace = 0) {
        super(wasmModule);
        this.namespace = namespace;
        this.metaName = 'Commodity';
        
        // Commodity-specific field properties (schema will define the actual field mappings)
        this.rev = null;
        this.trade_day = null;
        this.codes = null;
        this.names = null;
        this.trade_periods = null;
        this.UOM = null;
        this.volume_multiplier = null;
        this.surge_limit = null;
        this.plunge_limit = null;
        this.min_margin_rate = null;
    }
}

/**
 * Future - Futures contract specifications
 * Follows SampleQuote pattern from test.js
 */
export class FutureData extends SVObject {
    constructor(wasmModule, namespace = 0) {
        super(wasmModule);
        this.namespace = namespace;
        this.metaName = 'Futures';
        
        // Future-specific field properties (schema will define the actual field mappings)
        this.rev = null;
        this.trade_day = null;
        this.codes = null;
        this.names = null;
        this.commodity_codes = null;
        this.price_tick = null;
        this.lists_at = null;
        this.expires_at = null;
        this.start_delivery_date = null;
        this.end_delivery_date = null;
    }
}

/**
 * Stock - Listed company information
 * Follows SampleQuote pattern from test.js
 */
export class StockData extends SVObject {
    constructor(wasmModule, namespace = 0) {
        super(wasmModule);
        this.namespace = namespace;
        this.metaName = 'Stock';
        
        // Stock-specific field properties (schema will define the actual field mappings)
        this.rev = null;
        this.trade_day = null;
        this.codes = null;
        this.names = null;
        this.list_dates = null;
        this.list_prices = null;
        this.shares_outstanding = null;
    }
}

/**
 * Dividend - Dividend information
 * Follows SampleQuote pattern from test.js
 */
export class DividendData extends SVObject {
    constructor(wasmModule, namespace = 0) {
        super(wasmModule);
        this.namespace = namespace;
        this.metaName = 'Dividend';
        
        // Dividend-specific field properties (schema will define the actual field mappings)
        this.rev = null;
        this.trade_day = null;
        this.codes = null;
        this.amounts = null;
        this.dates = null;
    }
}

/**
 * Factory function to create appropriate SVObject subclass based on qualified name
 * @param {string} qualifiedName - e.g., "global::Market", "private::Future"
 * @param {Object} wasmModule - WASM module instance
 * @returns {SVObject} - Appropriate subclass instance
 */
export function createSingularityObject(qualifiedName, wasmModule) {
    const [namespaceStr, metaName] = qualifiedName.split('::');
    const namespace = namespaceStr === 'global' ? 0 : 1;
    
    switch (metaName) {
        case 'Market':
            return new MarketData(wasmModule, namespace);
        case 'Holiday':
            return new HolidayData(wasmModule, namespace);
        case 'Security':
            return new SecurityData(wasmModule, namespace);
        case 'Commodity':
            return new CommodityData(wasmModule, namespace);
        case 'Futures':
            return new FutureData(wasmModule, namespace);
        case 'Stock':
            return new StockData(wasmModule, namespace);
        case 'Dividend':
            return new DividendData(wasmModule, namespace);
        default:
            throw new Error(`Unknown Singularity metadata type: ${qualifiedName}`);
    }
}

/**
 * Get all available Singularity object types
 * @returns {string[]} - Array of qualified names
 */
export function getSingularityTypes() {
    const types = ['Market', 'Holiday', 'Security', 'Commodity', 'Future', 'Stock', 'Dividend'];
    const qualified = [];
    
    for (const type of types) {
        qualified.push(`global::${type}`);
        qualified.push(`private::${type}`);
    }
    
    return qualified;
}