/**
 * Example Indicator Classes using StructValue Wrapper
 * 
 * These classes demonstrate how to create financial indicators and strategies
 * using the JavaScript StructValue wrapper, equivalent to the Python examples
 * in the design guide.
 * 
 * @version 1.0
 * @author Generated for Mini Wolverine
 */

import SVObject, { DataType, Namespace } from '../utils/StructValueWrapper.js';

/**
 * Standard market price data structure (OHLCV)
 * Equivalent to Python SampleQuote class
 */
export class SampleQuote extends SVObject {
    constructor(wasmModule) {
        super(wasmModule);
        this.metaName = "SampleQuote";
        this.metaId = 1; // Standard SampleQuote metaID
        this.namespace = Namespace.GLOBAL;
        
        // Price fields
        this.open = 0.0;      // Opening price
        this.close = 0.0;     // Closing price
        this.high = 0.0;      // Highest price
        this.low = 0.0;       // Lowest price
        this.volume = 0;      // Trading volume
        this.turnover = 0.0;  // Trading amount
    }
    
    initializeFields() {
        this.fields = [
            ['open', DataType.DOUBLE],
            ['close', DataType.DOUBLE],
            ['high', DataType.DOUBLE],
            ['low', DataType.DOUBLE],
            ['volume', DataType.INT_64],
            ['turnover', DataType.DOUBLE]
        ];
    }
    
    /**
     * Update with new OHLCV data
     * @param {number} o - Open price
     * @param {number} c - Close price  
     * @param {number} h - High price
     * @param {number} l - Low price
     * @param {number} v - Volume
     * @param {number} t - Turnover
     */
    updatePrice(o, c, h, l, v, t = 0) {
        this.open = o;
        this.close = c;
        this.high = h;
        this.low = l;
        this.volume = v;
        this.turnover = t;
        this.timetag = Date.now();
    }
    
    /**
     * Calculate typical price (HLC/3)
     * @returns {number} - Typical price
     */
    typicalPrice() {
        return (this.high + this.low + this.close) / 3.0;
    }
    
    /**
     * Calculate price change percentage
     * @returns {number} - Change percentage
     */
    changePercent() {
        if (this.open === 0) return 0;
        return (this.close - this.open) / this.open;
    }
}

/**
 * MACD Technical Indicator
 * Equivalent to Python MACD class
 */
export class MACD extends SVObject {
    constructor(wasmModule) {
        super(wasmModule);
        this.metaName = "MACD";
        this.metaId = 101; // Custom indicator metaID
        this.namespace = Namespace.PRIVATE;
        
        // MACD values
        this.macd = 0.0;        // MACD line
        this.signal = 0.0;      // Signal line
        this.histogram = 0.0;   // Histogram
        
        // Parameters
        this.fastPeriod = 12;
        this.slowPeriod = 26;
        this.signalPeriod = 9;
        
        // State variables
        this.fastEma = 0.0;
        this.slowEma = 0.0;
        this.signalEma = 0.0;
        this.initialized = false;
    }
    
    initializeFields() {
        this.fields = [
            ['macd', DataType.DOUBLE],
            ['signal', DataType.DOUBLE],
            ['histogram', DataType.DOUBLE],
            ['fastPeriod', DataType.INT],
            ['slowPeriod', DataType.INT],
            ['signalPeriod', DataType.INT],
            ['fastEma', DataType.DOUBLE],
            ['slowEma', DataType.DOUBLE],
            ['signalEma', DataType.DOUBLE],
            ['initialized', DataType.INT] // Boolean as int
        ];
    }
    
    /**
     * Update MACD with new price
     * @param {number} price - Current price (usually close)
     */
    update(price) {
        const fastAlpha = 2.0 / (this.fastPeriod + 1);
        const slowAlpha = 2.0 / (this.slowPeriod + 1);
        const signalAlpha = 2.0 / (this.signalPeriod + 1);
        
        if (!this.initialized) {
            this.fastEma = price;
            this.slowEma = price;
            this.initialized = true;
        } else {
            this.fastEma = fastAlpha * price + (1 - fastAlpha) * this.fastEma;
            this.slowEma = slowAlpha * price + (1 - slowAlpha) * this.slowEma;
        }
        
        // Calculate MACD line
        this.macd = this.fastEma - this.slowEma;
        
        // Calculate signal line
        if (this.signalEma === 0.0) {
            this.signalEma = this.macd;
        } else {
            this.signalEma = signalAlpha * this.macd + (1 - signalAlpha) * this.signalEma;
        }
        
        this.signal = this.signalEma;
        this.histogram = this.macd - this.signal;
        
        this.timetag = Date.now();
    }
    
    /**
     * Get MACD signal (-1: sell, 0: hold, 1: buy)
     * @returns {number} - Trading signal
     */
    getSignal() {
        if (this.histogram > 0) return 1;  // Bullish
        if (this.histogram < 0) return -1; // Bearish
        return 0; // Neutral
    }
}

/**
 * RSI Technical Indicator
 */
export class RSI extends SVObject {
    constructor(wasmModule, period = 14) {
        super(wasmModule);
        this.metaName = "RSI";
        this.metaId = 102;
        this.namespace = Namespace.PRIVATE;
        
        this.rsi = 50.0;
        this.period = period;
        
        // State
        this.avgGain = 0.0;
        this.avgLoss = 0.0;
        this.prevPrice = 0.0;
        this.sampleCount = 0;
    }
    
    initializeFields() {
        this.fields = [
            ['rsi', DataType.DOUBLE],
            ['period', DataType.INT],
            ['avgGain', DataType.DOUBLE],
            ['avgLoss', DataType.DOUBLE],
            ['prevPrice', DataType.DOUBLE],
            ['sampleCount', DataType.INT]
        ];
    }
    
    update(price) {
        if (this.prevPrice === 0.0) {
            this.prevPrice = price;
            this.sampleCount = 1;
            return;
        }
        
        const change = price - this.prevPrice;
        const gain = Math.max(change, 0);
        const loss = Math.max(-change, 0);
        
        const alpha = 1.0 / this.period;
        
        if (this.sampleCount === 1) {
            this.avgGain = gain;
            this.avgLoss = loss;
        } else {
            this.avgGain = alpha * gain + (1 - alpha) * this.avgGain;
            this.avgLoss = alpha * loss + (1 - alpha) * this.avgLoss;
        }
        
        if (this.avgLoss !== 0) {
            const rs = this.avgGain / this.avgLoss;
            this.rsi = 100 - (100 / (1 + rs));
        } else {
            this.rsi = 100;
        }
        
        this.prevPrice = price;
        this.sampleCount++;
        this.timetag = Date.now();
    }
    
    isOverbought(threshold = 70) {
        return this.rsi > threshold;
    }
    
    isOversold(threshold = 30) {
        return this.rsi < threshold;
    }
}

/**
 * Multi-Asset Portfolio Strategy
 * Equivalent to Python PortfolioStrategy class
 */
export class PortfolioStrategy extends SVObject {
    constructor(wasmModule, numAssets = 10) {
        super(wasmModule);
        this.metaName = "PortfolioStrategy";
        this.metaId = 200;
        this.namespace = Namespace.PRIVATE;
        
        // Portfolio metrics
        this.pv = 0.0;          // Portfolio value
        this.nv = 1.0;          // Net value
        
        // Per-asset arrays
        this.signals = new Array(numAssets).fill(0);        // Buy/sell signals
        this.weights = new Array(numAssets).fill(0.0);      // Portfolio weights
        this.returns = new Array(numAssets).fill(0.0);      // Asset returns
        this.prices = new Array(numAssets).fill(0.0);       // Current prices
        
        // Asset identifiers
        this.markets = new Array(numAssets).fill("");       // Market names
        this.codes = new Array(numAssets).fill("");         // Asset codes
        
        this.numAssets = numAssets;
    }
    
    initializeFields() {
        this.fields = [
            ['pv', DataType.DOUBLE],
            ['nv', DataType.DOUBLE],
            ['signals', DataType.VINT],
            ['weights', DataType.VDOUBLE],
            ['returns', DataType.VDOUBLE],
            ['prices', DataType.VDOUBLE],
            ['markets', DataType.VSTRING],
            ['codes', DataType.VSTRING],
            ['numAssets', DataType.INT]
        ];
    }
    
    /**
     * Update asset data
     * @param {number} index - Asset index
     * @param {string} market - Market name
     * @param {string} code - Asset code
     * @param {number} price - Current price
     * @param {number} returnValue - Asset return
     */
    updateAsset(index, market, code, price, returnValue) {
        if (index >= 0 && index < this.numAssets) {
            this.markets[index] = market;
            this.codes[index] = code;
            this.prices[index] = price;
            this.returns[index] = returnValue;
        }
    }
    
    /**
     * Generate signals based on returns
     */
    generateSignals() {
        for (let i = 0; i < this.numAssets; i++) {
            if (this.returns[i] > 0.02) {        // Strong positive return
                this.signals[i] = 1;  // Buy
            } else if (this.returns[i] < -0.02) { // Strong negative return
                this.signals[i] = -1; // Sell
            } else {
                this.signals[i] = 0;  // Hold
            }
        }
    }
    
    /**
     * Rebalance portfolio weights
     */
    rebalance() {
        const positiveSignals = this.signals.filter(s => s > 0).length;
        
        if (positiveSignals === 0) {
            this.weights.fill(0.0);
            return;
        }
        
        const equalWeight = 1.0 / positiveSignals;
        
        for (let i = 0; i < this.numAssets; i++) {
            this.weights[i] = this.signals[i] > 0 ? equalWeight : 0.0;
        }
    }
    
    /**
     * Calculate portfolio metrics
     */
    calculateMetrics() {
        let portfolioReturn = 0.0;
        
        for (let i = 0; i < this.numAssets; i++) {
            portfolioReturn += this.returns[i] * this.weights[i];
        }
        
        this.pv = this.nv * (1 + portfolioReturn);
        this.nv = this.pv; // Update net value
        this.timetag = Date.now();
    }
    
    /**
     * Full update cycle
     */
    update() {
        this.generateSignals();
        this.rebalance();
        this.calculateMetrics();
    }
}

/**
 * Simple Moving Average Indicator
 */
export class SMA extends SVObject {
    constructor(wasmModule, period = 20) {
        super(wasmModule);
        this.metaName = "SMA";
        this.metaId = 103;
        this.namespace = Namespace.PRIVATE;
        
        this.value = 0.0;
        this.period = period;
        this.prices = [];
        this.sum = 0.0;
    }
    
    initializeFields() {
        this.fields = [
            ['value', DataType.DOUBLE],
            ['period', DataType.INT],
            ['sum', DataType.DOUBLE],
            ['prices', DataType.VDOUBLE]
        ];
    }
    
    update(price) {
        this.prices.push(price);
        this.sum += price;
        
        // Maintain rolling window
        if (this.prices.length > this.period) {
            this.sum -= this.prices.shift();
        }
        
        this.value = this.sum / this.prices.length;
        this.timetag = Date.now();
    }
    
    isReady() {
        return this.prices.length >= this.period;
    }
}

export default {
    SampleQuote,
    MACD,
    RSI,
    PortfolioStrategy,
    SMA
};