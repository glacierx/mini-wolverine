# StructValue Wrapper Usage Guide

## Overview

This guide demonstrates how to use the JavaScript StructValue wrapper (`SVObject`) that provides a Python `sv_object`-equivalent interface for working with Caitlyn WASM StructValue objects.

## Quick Start

### 1. Basic Setup

```javascript
import SVObject, { DataType, Namespace } from '../src/utils/StructValueWrapper.js';
import { SampleQuote, MACD, RSI } from '../src/examples/IndicatorExamples.js';

// Load your WASM module (or use mock for testing)
const wasmModule = await loadWasmModule();
```

### 2. Creating a Simple Price Quote

```javascript
// Create a price quote
const quote = new SampleQuote(wasmModule);

// Update with OHLCV data
quote.updatePrice(
    2680.5,  // open
    2685.2,  // close  
    2690.8,  // high
    2678.1,  // low
    15420,   // volume
    41285640.5 // turnover
);

// Set market information
quote.market = 'SHFE';
quote.code = 'au2412';
quote.granularity = 900; // 15-minute bars
quote.timetag = Date.now();

console.log(`Quote: ${quote.market}/${quote.code} @ ${quote.close}`);
console.log(`Change: ${(quote.changePercent() * 100).toFixed(2)}%`);
```

### 3. Working with Technical Indicators

```javascript
// Create MACD indicator
const macd = new MACD(wasmModule);
macd.market = 'SHFE';
macd.code = 'au2412';

// Feed price data
const prices = [2680, 2685, 2682, 2688, 2691, 2687, 2683, 2686, 2689, 2692];
prices.forEach(price => {
    macd.update(price);
    console.log(`MACD: ${macd.macd.toFixed(4)}, Signal: ${macd.signal.toFixed(4)}`);
});

// Get trading signal
const signal = macd.getSignal(); // -1, 0, or 1
console.log(`Trading Signal: ${signal === 1 ? 'BUY' : signal === -1 ? 'SELL' : 'HOLD'}`);
```

### 4. Serialization to WASM StructValue

```javascript
// Convert JavaScript object to WASM StructValue
const structValue = quote.toSv();

console.log(`StructValue created:`);
console.log(`  - metaID: ${structValue.metaID}`);
console.log(`  - market: ${structValue.market}`);
console.log(`  - open: ${structValue.getDouble(0)}`);
console.log(`  - close: ${structValue.getDouble(1)}`);

// Always clean up WASM objects
quote.cleanup(); // This calls structValue.delete()
```

### 5. Deserialization from WASM StructValue

```javascript
// Create new quote from existing StructValue
const newQuote = new SampleQuote(wasmModule);
newQuote.fromSv(structValue);

console.log(`Restored quote: ${newQuote.market}/${newQuote.code}`);
console.log(`Price: ${newQuote.close}, Volume: ${newQuote.volume}`);
```

## Advanced Usage

### Creating Custom Indicators

```javascript
// Create custom indicator class
class BollingerBands extends SVObject {
    constructor(wasmModule, period = 20, stdDev = 2) {
        super(wasmModule);
        this.metaName = "BollingerBands";
        this.metaId = 104; // Custom indicator ID
        this.namespace = Namespace.PRIVATE;
        
        this.period = period;
        this.stdDev = stdDev;
        this.middle = 0.0;    // SMA
        this.upper = 0.0;     // Upper band
        this.lower = 0.0;     // Lower band
        this.prices = [];
    }
    
    initializeFields() {
        this.fields = [
            ['middle', DataType.DOUBLE],
            ['upper', DataType.DOUBLE],
            ['lower', DataType.DOUBLE],
            ['period', DataType.INT],
            ['stdDev', DataType.DOUBLE],
            ['prices', DataType.VDOUBLE]
        ];
    }
    
    update(price) {
        this.prices.push(price);
        
        // Maintain rolling window
        if (this.prices.length > this.period) {
            this.prices.shift();
        }
        
        if (this.prices.length >= this.period) {
            // Calculate SMA
            this.middle = this.prices.reduce((a, b) => a + b) / this.prices.length;
            
            // Calculate standard deviation
            const variance = this.prices.reduce((sum, price) => {
                return sum + Math.pow(price - this.middle, 2);
            }, 0) / this.prices.length;
            const stdDev = Math.sqrt(variance);
            
            // Calculate bands
            this.upper = this.middle + (this.stdDev * stdDev);
            this.lower = this.middle - (this.stdDev * stdDev);
        }
        
        this.timetag = Date.now();
    }
    
    getPosition(price) {
        if (price > this.upper) return 1;      // Above upper band
        if (price < this.lower) return -1;     // Below lower band
        return 0; // Within bands
    }
}

// Usage
const bb = new BollingerBands(wasmModule, 20, 2);
bb.market = 'SHFE';
bb.code = 'au2412';

const prices = [2680, 2685, 2682, /* ... more prices ... */];
prices.forEach(price => bb.update(price));

console.log(`Bollinger Bands: ${bb.lower.toFixed(2)} | ${bb.middle.toFixed(2)} | ${bb.upper.toFixed(2)}`);
```

### Portfolio Management

```javascript
import { PortfolioStrategy } from '../src/examples/IndicatorExamples.js';

const portfolio = new PortfolioStrategy(wasmModule, 3);

// Add assets
portfolio.updateAsset(0, 'SHFE', 'au2412', 2685.2, 0.025);  // Gold +2.5%
portfolio.updateAsset(1, 'SHFE', 'ag2412', 5420.5, -0.010); // Silver -1.0%
portfolio.updateAsset(2, 'DCE', 'i2412', 820.5, 0.035);     // Iron +3.5%

// Generate signals and rebalance
portfolio.update();

console.log('Portfolio Status:');
console.log(`Net Value: ${portfolio.nv.toFixed(4)}`);
console.log(`Signals: [${portfolio.signals.join(', ')}]`);
console.log(`Weights: [${portfolio.weights.map(w => (w * 100).toFixed(1) + '%').join(', ')}]`);

// Serialize portfolio state
const portfolioSV = portfolio.toSv();
console.log(`Portfolio StructValue created with ${portfolioSV.fieldCount} fields`);
```

### JSON Serialization

```javascript
// Convert to JSON for storage/transmission
const quoteJSON = quote.toJSON();
console.log('Quote JSON:', JSON.stringify(quoteJSON, null, 2));

// Restore from JSON
const restoredQuote = new SampleQuote(wasmModule);
restoredQuote.fromJSON(quoteJSON);
console.log(`Restored: ${restoredQuote.market}/${restoredQuote.code}`);
```

### Real-time Data Processing Pipeline

```javascript
class DataProcessor {
    constructor(wasmModule) {
        this.wasmModule = wasmModule;
        this.quotes = new Map();
        this.indicators = new Map();
    }
    
    processBar(symbol, ohlcv) {
        // Get or create quote
        let quote = this.quotes.get(symbol);
        if (!quote) {
            quote = new SampleQuote(this.wasmModule);
            quote.market = 'DEMO';
            quote.code = symbol;
            this.quotes.set(symbol, quote);
        }
        
        // Update quote
        quote.updatePrice(ohlcv.open, ohlcv.close, ohlcv.high, ohlcv.low, ohlcv.volume);
        
        // Get or create indicators
        let indicators = this.indicators.get(symbol);
        if (!indicators) {
            indicators = {
                macd: new MACD(this.wasmModule),
                rsi: new RSI(this.wasmModule, 14)
            };
            this.indicators.set(symbol, indicators);
        }
        
        // Update indicators
        indicators.macd.update(ohlcv.close);
        indicators.rsi.update(ohlcv.close);
        
        // Generate signals
        const signals = {
            macd: indicators.macd.getSignal(),
            rsi_overbought: indicators.rsi.isOverbought(),
            rsi_oversold: indicators.rsi.isOversold()
        };
        
        return {
            quote: quote.toJSON(),
            indicators: {
                macd: indicators.macd.toJSON(),
                rsi: indicators.rsi.toJSON()
            },
            signals
        };
    }
}

// Usage
const processor = new DataProcessor(wasmModule);

const result = processor.processBar('GOLD', {
    open: 2680.5,
    high: 2690.8,
    low: 2678.1,
    close: 2685.2,
    volume: 15420
});

console.log('Processing Result:', result.signals);
```

## Best Practices

### 1. Memory Management

```javascript
// ✅ GOOD: Always clean up
function processData() {
    const quote = new SampleQuote(wasmModule);
    
    try {
        quote.updatePrice(100, 105, 107, 99, 1000);
        const sv = quote.toSv();
        
        // Process data...
        
        return result;
    } finally {
        quote.cleanup(); // Always clean up
    }
}

// ❌ BAD: No cleanup
function badProcessing() {
    const quote = new SampleQuote(wasmModule);
    quote.updatePrice(100, 105, 107, 99, 1000);
    return quote.toSv(); // Memory leak!
}
```

### 2. Error Handling

```javascript
// ✅ GOOD: Proper error handling
function safeProcessing(wasmModule, priceData) {
    try {
        const quote = new SampleQuote(wasmModule);
        quote.updatePrice(...priceData);
        
        // Validate data
        if (quote.high < quote.low) {
            throw new Error('Invalid OHLC data: high < low');
        }
        
        return quote.toSv();
    } catch (error) {
        console.error('Processing failed:', error);
        throw error; // Re-throw for caller to handle
    }
}
```

### 3. Field Definition Best Practices

```javascript
// ✅ GOOD: Clear, typed field definitions
class MyIndicator extends SVObject {
    initializeFields() {
        this.fields = [
            ['signal_value', DataType.DOUBLE],        // Clear naming
            ['confidence', DataType.DOUBLE],          // Descriptive
            ['lookback_period', DataType.INT],        // Configuration
            ['price_history', DataType.VDOUBLE],      // Appropriate vector type
            ['is_ready', DataType.INT]                // Boolean as int
        ];
    }
}

// ❌ BAD: Unclear field definitions  
class BadIndicator extends SVObject {
    initializeFields() {
        this.fields = [
            ['val', DataType.STRING],     // Wrong type for numeric value
            ['x', DataType.DOUBLE],       // Meaningless name
            ['data', DataType.VSTRING]    // Generic name, unclear purpose
        ];
    }
}
```

## Testing Your Implementation

```javascript
// Run the comprehensive test suite
import runTests from '../backend/test-structvalue-wrapper.js';
await runTests();

// Run integration demo  
import runDemo from '../backend/test-structvalue-integration.js';
await runDemo();
```

## Integration with Existing Codebase

### With WasmService

```javascript
import WasmService from '../backend/src/services/WasmService.js';
import { SampleQuote } from '../backend/src/examples/IndicatorExamples.js';

const wasmService = new WasmService();
await wasmService.initialize();

// Use wrapper with real WASM module
const quote = new SampleQuote(wasmService.getModule());
quote.updatePrice(2680.5, 2685.2, 2690.8, 2678.1, 15420);

// Serialize to real StructValue
const realSV = quote.toSv();
console.log(`Real StructValue: ${realSV.getDouble(1)}`); // close price

quote.cleanup();
```

### With WebSocket Data

```javascript
websocket.on('message', (data) => {
    if (data instanceof ArrayBuffer) {
        // Decode message using WasmService
        const { cmd, content } = wasmService.decodeMessage(data);
        
        if (cmd === wasmService.getModule().CMD_TA_PUSH_DATA) {
            // Process StructValue data with wrapper
            const quote = new SampleQuote(wasmService.getModule());
            quote.fromSv(content); // Assuming content is StructValue
            
            console.log(`Received: ${quote.market}/${quote.code} @ ${quote.close}`);
        }
    }
});
```

This wrapper provides a clean, Python-like interface for working with WASM StructValue objects in JavaScript, making financial data processing more intuitive and maintainable.