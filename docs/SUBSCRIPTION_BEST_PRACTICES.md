# Caitlyn WebSocket Subscription Best Practices

## Overview

This document outlines the best practices for implementing real-time data subscriptions using the Caitlyn WebSocket protocol. It covers the binary protocol flow, subscription hub patterns, and production-ready implementation strategies.

## Protocol Updates

### Real-time Data Flow (Binary Protocol)

**⚠️ IMPORTANT**: The JSON-formatted protocol with `CMD_TA_PUSH_DATA` is **obsolete**. The binary protocol now uses:

- **CMD_AT_SUBSCRIBE_SORT**: The **only** command for receiving pushed real-time subscribed data
- **Binary Format**: All real-time data is delivered in binary format using `ATSubscribeSVRes`

### Complete Subscription Protocol Flow

```
1. Client → Server: CMD_AT_SUBSCRIBE (ATSubscribeReq)
2. Server → Client: CMD_AT_SUBSCRIBE (ATSubscribeRes) - Confirmation
3. Server → Client: CMD_TA_SUBSCRIBE_HEADER (ATSubscribeOrderRes) - Header setup
4. Server → Client: CMD_AT_SUBSCRIBE_SORT (ATSubscribeSVRes) - Real-time data (ongoing)
```

## Subscription Hub Architecture

### Problem Statement

Without a centralized subscription manager, applications suffer from:
- **Duplicate Subscriptions**: Multiple components subscribing to the same data
- **Resource Waste**: Excessive WebSocket connections and memory usage
- **Complex Management**: Difficult to track and coordinate subscriptions
- **Performance Issues**: Unnecessary network traffic and processing overhead

### Hub-Based Solution

Implement a **Subscription Hub** that centralizes all subscription management:

```javascript
class CaitlynSubscriptionHub {
  constructor(connection) {
    this.connection = connection;
    this.activeSubscriptions = new Map(); // key -> subscription info
    this.subscribers = new Map();          // key -> Set of callbacks
    this.subscriptionKeys = new Map();     // internal tracking
  }

  /**
   * Subscribe to real-time data with automatic deduplication
   * @param {string|string[]} markets - Market codes
   * @param {string|string[]} codes - Security codes  
   * @param {string|string[]} qualifiedNames - Metadata types
   * @param {string} namespace - 'global' or 'private'
   * @param {Function} callback - Data callback function
   * @param {Object} options - Subscription options
   * @returns {string} subscriber ID for unsubscribing
   */
  subscribe(markets, codes, qualifiedNames, namespace, callback, options = {}) {
    const subscriptionKey = this.generateSubscriptionKey(markets, codes, qualifiedNames, namespace, options);
    const subscriberId = this.generateSubscriberId();
    
    // Add subscriber to this subscription
    if (!this.subscribers.has(subscriptionKey)) {
      this.subscribers.set(subscriptionKey, new Set());
    }
    this.subscribers.get(subscriptionKey).add({ id: subscriberId, callback });
    
    // Create actual subscription only if not exists
    if (!this.activeSubscriptions.has(subscriptionKey)) {
      const internalKey = this.connection.subscribe(
        markets, codes, qualifiedNames, namespace, 
        (data) => this.broadcastToSubscribers(subscriptionKey, data),
        options
      );
      
      this.activeSubscriptions.set(subscriptionKey, {
        internalKey,
        markets: Array.isArray(markets) ? markets : [markets],
        codes: Array.isArray(codes) ? codes : [codes], 
        qualifiedNames: Array.isArray(qualifiedNames) ? qualifiedNames : [qualifiedNames],
        namespace,
        options,
        subscriberCount: 1,
        createdAt: new Date()
      });
      
      console.log(`📡 Created new subscription: ${subscriptionKey}`);
    } else {
      this.activeSubscriptions.get(subscriptionKey).subscriberCount++;
      console.log(`📡 Reused existing subscription: ${subscriptionKey} (${this.activeSubscriptions.get(subscriptionKey).subscriberCount} subscribers)`);
    }
    
    return subscriberId;
  }

  /**
   * Unsubscribe from real-time data
   * @param {string} subscriberId - ID returned from subscribe()
   */
  unsubscribe(subscriberId) {
    // Find and remove subscriber
    for (const [subscriptionKey, subscriberSet] of this.subscribers.entries()) {
      for (const subscriber of subscriberSet) {
        if (subscriber.id === subscriberId) {
          subscriberSet.delete(subscriber);
          
          // If no more subscribers, remove the actual subscription
          if (subscriberSet.size === 0) {
            this.subscribers.delete(subscriptionKey);
            
            if (this.activeSubscriptions.has(subscriptionKey)) {
              const subscription = this.activeSubscriptions.get(subscriptionKey);
              this.connection.unsubscribe(subscription.internalKey);
              this.activeSubscriptions.delete(subscriptionKey);
              console.log(`📡 Removed subscription: ${subscriptionKey}`);
            }
          } else {
            // Decrease subscriber count
            if (this.activeSubscriptions.has(subscriptionKey)) {
              this.activeSubscriptions.get(subscriptionKey).subscriberCount--;
            }
          }
          
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Broadcast data to all subscribers of a subscription
   */
  broadcastToSubscribers(subscriptionKey, data) {
    const subscriberSet = this.subscribers.get(subscriptionKey);
    if (subscriberSet) {
      for (const subscriber of subscriberSet) {
        try {
          subscriber.callback(data);
        } catch (error) {
          console.error(`Error in subscriber callback: ${error}`);
        }
      }
    }
  }

  /**
   * Generate unique subscription key for deduplication
   */
  generateSubscriptionKey(markets, codes, qualifiedNames, namespace, options) {
    const marketStr = Array.isArray(markets) ? markets.sort().join(',') : markets;
    const codeStr = Array.isArray(codes) ? codes.sort().join(',') : codes;
    const qnameStr = Array.isArray(qualifiedNames) ? qualifiedNames.sort().join(',') : qualifiedNames;
    const optsStr = JSON.stringify(options);
    return `${marketStr}|${codeStr}|${qnameStr}|${namespace}|${optsStr}`;
  }

  /**
   * Generate unique subscriber ID
   */
  generateSubscriberId() {
    return 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Get subscription statistics
   */
  getStats() {
    return {
      activeSubscriptions: this.activeSubscriptions.size,
      totalSubscribers: Array.from(this.subscribers.values()).reduce((sum, set) => sum + set.size, 0),
      subscriptions: Array.from(this.activeSubscriptions.entries()).map(([key, info]) => ({
        key,
        subscriberCount: info.subscriberCount,
        markets: info.markets,
        codes: info.codes,
        qualifiedNames: info.qualifiedNames,
        namespace: info.namespace,
        createdAt: info.createdAt
      }))
    };
  }
}
```

## Implementation Best Practices

### 1. Subscription Request Patterns

#### ✅ **Recommended: Batch Subscriptions**

```javascript
// Good: Subscribe to multiple instruments at once
const subscriberId = hub.subscribe(
  ['ICE', 'DCE'],                    // Multiple markets
  ['B<00>', 'i<00>', 'j<00>'],       // Multiple codes
  ['SampleQuote'],                   // Specific metadata
  'global',
  (data) => handleRealTimeData(data),
  {
    granularities: [86400],          // Daily data
    fields: ['bid', 'ask', 'last', 'volume']  // Specific fields
  }
);
```

#### ❌ **Avoid: Individual Subscriptions**

```javascript
// Bad: Creates multiple duplicate connections
const sub1 = hub.subscribe('ICE', 'B<00>', 'SampleQuote', 'global', callback1);
const sub2 = hub.subscribe('ICE', 'B<00>', 'SampleQuote', 'global', callback2);
const sub3 = hub.subscribe('ICE', 'B<00>', 'SampleQuote', 'global', callback3);
```

### 2. Data Processing Patterns

#### **Real-time Data Handler**

```javascript
function handleRealTimeData(realTimeRecord) {
  const {
    market,
    code, 
    metaName,
    timestamp,
    granularity,
    fields
  } = realTimeRecord;
  
  console.log(`📊 Real-time data: ${market}:${code} (${metaName})`);
  console.log(`   Timestamp: ${timestamp}, Granularity: ${granularity}s`);
  console.log(`   Fields:`, fields);
  
  // Process field data based on metadata type
  switch (metaName) {
    case 'global::SampleQuote':
      processQuoteData(fields);
      break;
    case 'global::Market': 
      processMarketData(fields);
      break;
    default:
      console.log(`Unknown metadata type: ${metaName}`);
  }
}

function processQuoteData(fields) {
  // Extract quote-specific fields
  const { bid, ask, last, volume, open_interest } = fields;
  
  // Update UI, store in database, trigger alerts, etc.
  updateQuoteDisplay({
    bid: parseFloat(bid),
    ask: parseFloat(ask), 
    last: parseFloat(last),
    volume: parseInt(volume),
    openInterest: parseInt(open_interest)
  });
}
```

### 3. Subscription Lifecycle Management

#### **Application Startup**

```javascript
class MarketDataApplication {
  constructor() {
    this.connection = new CaitlynClientConnection({
      url: process.env.CAITLYN_WS_URL,
      token: process.env.CAITLYN_TOKEN
    });
    
    this.subscriptionHub = new CaitlynSubscriptionHub(this.connection);
    this.activeSubscribers = new Set();
  }

  async initialize() {
    // 1. Connect and initialize
    await this.connection.connect();
    
    // 2. Set up essential subscriptions
    await this.setupCoreSubscriptions();
    
    // 3. Set up UI event handlers
    this.setupUIHandlers();
  }

  async setupCoreSubscriptions() {
    // Subscribe to major market data
    const coreMarkets = ['ICE', 'DCE', 'CFFEX'];
    const coreCodes = ['B<00>', 'i<00>', 'j<00>'];
    
    const coreSubscriberId = this.subscriptionHub.subscribe(
      coreMarkets,
      coreCodes,
      'SampleQuote',
      'global',
      (data) => this.handleCoreMarketData(data),
      { granularities: [86400] }
    );
    
    this.activeSubscribers.add(coreSubscriberId);
  }

  addUserSubscription(markets, codes, callback) {
    const subscriberId = this.subscriptionHub.subscribe(
      markets, codes, 'SampleQuote', 'global', callback, 
      { granularities: [86400] }
    );
    
    this.activeSubscribers.add(subscriberId);
    return subscriberId;
  }

  removeUserSubscription(subscriberId) {
    if (this.subscriptionHub.unsubscribe(subscriberId)) {
      this.activeSubscribers.delete(subscriberId);
      return true;
    }
    return false;
  }

  async shutdown() {
    // Unsubscribe from all subscriptions
    for (const subscriberId of this.activeSubscribers) {
      this.subscriptionHub.unsubscribe(subscriberId);
    }
    
    // Disconnect
    this.connection.disconnect();
  }
}
```

### 4. Error Handling and Reconnection

#### **Robust Subscription Management**

```javascript
class RobustSubscriptionManager {
  constructor(connection) {
    this.hub = new CaitlynSubscriptionHub(connection);
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscriptionBackup = new Map();
  }

  async subscribe(markets, codes, qualifiedNames, namespace, callback, options) {
    try {
      const subscriberId = this.hub.subscribe(markets, codes, qualifiedNames, namespace, callback, options);
      
      // Backup subscription details for reconnection
      this.subscriptionBackup.set(subscriberId, {
        markets, codes, qualifiedNames, namespace, callback, options
      });
      
      return subscriberId;
    } catch (error) {
      console.error('Subscription failed:', error);
      
      // Attempt reconnection if needed
      if (this.shouldAttemptReconnection(error)) {
        await this.attemptReconnection();
        return this.subscribe(markets, codes, qualifiedNames, namespace, callback, options);
      }
      
      throw error;
    }
  }

  async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      throw new Error('Max reconnection attempts exceeded');
    }
    
    this.reconnectAttempts++;
    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
    
    try {
      // Reconnect the underlying connection
      await this.hub.connection.connect();
      
      // Restore all subscriptions
      await this.restoreSubscriptions();
      
      this.reconnectAttempts = 0; // Reset on success
    } catch (error) {
      console.error('Reconnection failed:', error);
      
      // Exponential backoff
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      throw error;
    }
  }

  async restoreSubscriptions() {
    const restorePromises = [];
    
    for (const [subscriberId, subscription] of this.subscriptionBackup.entries()) {
      const promise = this.hub.subscribe(
        subscription.markets,
        subscription.codes, 
        subscription.qualifiedNames,
        subscription.namespace,
        subscription.callback,
        subscription.options
      );
      
      restorePromises.push(promise);
    }
    
    await Promise.all(restorePromises);
    console.log(`Restored ${restorePromises.length} subscriptions`);
  }

  shouldAttemptReconnection(error) {
    // Define conditions that warrant reconnection attempts
    return error.code === 'ECONNRESET' || 
           error.code === 'ENOTFOUND' || 
           error.message.includes('WebSocket');
  }
}
```

## Performance Optimization

### 1. Subscription Batching

```javascript
// Batch multiple subscription requests
const batchSubscriptionManager = {
  pendingSubscriptions: [],
  batchTimeout: null,
  
  requestSubscription(markets, codes, qualifiedNames, namespace, callback, options) {
    this.pendingSubscriptions.push({
      markets, codes, qualifiedNames, namespace, callback, options
    });
    
    // Batch subscriptions with debouncing
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }
    
    this.batchTimeout = setTimeout(() => {
      this.processBatch();
    }, 100); // 100ms batching window
  },
  
  processBatch() {
    // Group similar subscriptions
    const groups = this.groupSimilarSubscriptions(this.pendingSubscriptions);
    
    // Send batch requests
    for (const group of groups) {
      this.sendBatchSubscription(group);
    }
    
    this.pendingSubscriptions = [];
    this.batchTimeout = null;
  }
};
```

### 2. Memory Management

```javascript
// Regular cleanup of inactive subscriptions
setInterval(() => {
  const stats = subscriptionHub.getStats();
  console.log(`📊 Subscription stats: ${stats.activeSubscriptions} subscriptions, ${stats.totalSubscribers} subscribers`);
  
  // Clean up subscriptions with no active subscribers
  subscriptionHub.cleanup();
}, 60000); // Every minute
```

## Testing Subscription Implementation

### Unit Tests

```javascript
describe('Subscription Hub', () => {
  let hub;
  let mockConnection;
  
  beforeEach(() => {
    mockConnection = {
      subscribe: jest.fn().mockReturnValue('mock-key'),
      unsubscribe: jest.fn()
    };
    hub = new CaitlynSubscriptionHub(mockConnection);
  });

  test('should deduplicate identical subscriptions', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    const sub1 = hub.subscribe('ICE', 'B<00>', 'SampleQuote', 'global', callback1);
    const sub2 = hub.subscribe('ICE', 'B<00>', 'SampleQuote', 'global', callback2);
    
    // Should only create one actual subscription
    expect(mockConnection.subscribe).toHaveBeenCalledTimes(1);
    expect(hub.getStats().activeSubscriptions).toBe(1);
    expect(hub.getStats().totalSubscribers).toBe(2);
  });

  test('should broadcast data to all subscribers', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    hub.subscribe('ICE', 'B<00>', 'SampleQuote', 'global', callback1);
    hub.subscribe('ICE', 'B<00>', 'SampleQuote', 'global', callback2);
    
    const testData = { market: 'ICE', code: 'B<00>', fields: { bid: 100 } };
    
    // Simulate data broadcast
    const subscriptionKey = hub.generateSubscriptionKey('ICE', 'B<00>', 'SampleQuote', 'global', {});
    hub.broadcastToSubscribers(subscriptionKey, testData);
    
    expect(callback1).toHaveBeenCalledWith(testData);
    expect(callback2).toHaveBeenCalledWith(testData);
  });
});
```

## Monitoring and Debugging

### Subscription Analytics

```javascript
class SubscriptionAnalytics {
  constructor(hub) {
    this.hub = hub;
    this.metrics = {
      subscriptionCount: 0,
      dataMessagesReceived: 0,
      averageLatency: 0,
      errorRate: 0
    };
  }

  logSubscriptionMetrics() {
    const stats = this.hub.getStats();
    
    console.log('📈 Subscription Metrics:');
    console.log(`   Active Subscriptions: ${stats.activeSubscriptions}`);
    console.log(`   Total Subscribers: ${stats.totalSubscribers}`);
    console.log(`   Data Messages: ${this.metrics.dataMessagesReceived}`);
    console.log(`   Average Latency: ${this.metrics.averageLatency}ms`);
    console.log(`   Error Rate: ${this.metrics.errorRate}%`);
  }

  trackDataMessage(latency) {
    this.metrics.dataMessagesReceived++;
    this.updateAverageLatency(latency);
  }

  updateAverageLatency(newLatency) {
    const count = this.metrics.dataMessagesReceived;
    this.metrics.averageLatency = ((this.metrics.averageLatency * (count - 1)) + newLatency) / count;
  }
}
```

## Summary

### Key Takeaways

1. **Protocol Update**: Use `CMD_AT_SUBSCRIBE_SORT` for all real-time data (CMD_TA_PUSH_DATA is obsolete)
2. **Hub Architecture**: Implement centralized subscription management to avoid duplicates
3. **Batch Operations**: Group similar subscriptions to minimize network overhead
4. **Error Handling**: Implement robust reconnection and restoration mechanisms
5. **Performance**: Monitor and optimize subscription lifecycle and memory usage
6. **Testing**: Unit test subscription deduplication and data broadcasting logic

### Implementation Checklist

- [ ] Implement `CaitlynSubscriptionHub` class
- [ ] Update protocol handlers to use `CMD_AT_SUBSCRIBE_SORT` only
- [ ] Add subscription deduplication logic
- [ ] Implement robust error handling and reconnection
- [ ] Add subscription analytics and monitoring
- [ ] Create comprehensive test suite
- [ ] Document subscription patterns for team use

This architecture ensures efficient, scalable, and maintainable real-time data subscription management in production environments.