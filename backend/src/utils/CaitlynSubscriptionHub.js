/**
 * CaitlynSubscriptionHub - Centralized Subscription Management
 * 
 * This class provides centralized subscription management to:
 * - Avoid duplicate subscriptions to the same data
 * - Minimize WebSocket connections and network overhead
 * - Provide broadcast capability for multiple subscribers
 * - Handle subscription lifecycle and cleanup automatically
 * 
 * @version 1.0
 * @author Auto-generated from subscription best practices
 */

export default class CaitlynSubscriptionHub {
  constructor(connection, logger = console) {
    this.connection = connection;
    this.logger = logger;
    
    // Core subscription management
    this.activeSubscriptions = new Map(); // subscriptionKey -> subscription info
    this.subscribers = new Map();          // subscriptionKey -> Set of callbacks
    this.subscriptionKeys = new Map();     // subscriberId -> subscriptionKey mapping
    
    // Statistics and monitoring
    this.stats = {
      totalSubscriptions: 0,
      totalSubscribers: 0,
      messagesReceived: 0,
      startTime: new Date()
    };
  }

  /**
   * Subscribe to real-time data with automatic deduplication
   * @param {string|string[]} markets - Market codes (e.g., 'ICE' or ['ICE', 'DCE'])
   * @param {string|string[]} codes - Security codes (e.g., 'B<00>' or ['B<00>', 'i<00>'])
   * @param {string|string[]} qualifiedNames - Metadata types (e.g., 'SampleQuote' or ['SampleQuote', 'Market'])
   * @param {string} namespace - 'global' or 'private'
   * @param {Function} callback - Data callback function
   * @param {Object} options - Subscription options
   * @returns {string} subscriber ID for unsubscribing
   */
  subscribe(markets, codes, qualifiedNames, namespace = 'global', callback, options = {}) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Generate unique subscription key for deduplication
    const subscriptionKey = this.generateSubscriptionKey(markets, codes, qualifiedNames, namespace, options);
    const subscriberId = this.generateSubscriberId();
    
    this.logger.debug(`🎯 Hub: Processing subscription request - Key: ${subscriptionKey}`);
    
    // Add subscriber to this subscription
    if (!this.subscribers.has(subscriptionKey)) {
      this.subscribers.set(subscriptionKey, new Set());
    }
    this.subscribers.get(subscriptionKey).add({ id: subscriberId, callback });
    this.subscriptionKeys.set(subscriberId, subscriptionKey);
    
    // Create actual subscription only if not exists
    if (!this.activeSubscriptions.has(subscriptionKey)) {
      this.logger.info(`📡 Hub: Creating new subscription - ${subscriptionKey}`);
      
      try {
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
        
        this.stats.totalSubscriptions++;
        this.logger.info(`✅ Hub: New subscription created - ${subscriptionKey}`);
        
      } catch (error) {
        // Clean up on error
        this.subscribers.get(subscriptionKey).delete({ id: subscriberId, callback });
        if (this.subscribers.get(subscriptionKey).size === 0) {
          this.subscribers.delete(subscriptionKey);
        }
        this.subscriptionKeys.delete(subscriberId);
        
        this.logger.error(`❌ Hub: Failed to create subscription - ${subscriptionKey}:`, error);
        throw error;
      }
    } else {
      // Reuse existing subscription
      this.activeSubscriptions.get(subscriptionKey).subscriberCount++;
      this.logger.info(`♻️ Hub: Reused existing subscription - ${subscriptionKey} (${this.activeSubscriptions.get(subscriptionKey).subscriberCount} subscribers)`);
    }
    
    this.stats.totalSubscribers++;
    
    return subscriberId;
  }

  /**
   * Unsubscribe from real-time data
   * @param {string} subscriberId - ID returned from subscribe()
   * @returns {boolean} true if successfully unsubscribed
   */
  unsubscribe(subscriberId) {
    const subscriptionKey = this.subscriptionKeys.get(subscriberId);
    if (!subscriptionKey) {
      this.logger.warn(`⚠️ Hub: Subscriber ${subscriberId} not found`);
      return false;
    }
    
    const subscriberSet = this.subscribers.get(subscriptionKey);
    if (!subscriberSet) {
      this.logger.warn(`⚠️ Hub: Subscription ${subscriptionKey} not found`);
      return false;
    }
    
    // Find and remove subscriber
    let subscriberFound = false;
    for (const subscriber of subscriberSet) {
      if (subscriber.id === subscriberId) {
        subscriberSet.delete(subscriber);
        subscriberFound = true;
        break;
      }
    }
    
    if (!subscriberFound) {
      this.logger.warn(`⚠️ Hub: Subscriber ${subscriberId} not found in subscription ${subscriptionKey}`);
      return false;
    }
    
    this.subscriptionKeys.delete(subscriberId);
    this.stats.totalSubscribers--;
    
    // If no more subscribers, remove the actual subscription
    if (subscriberSet.size === 0) {
      this.subscribers.delete(subscriptionKey);
      
      if (this.activeSubscriptions.has(subscriptionKey)) {
        const subscription = this.activeSubscriptions.get(subscriptionKey);
        
        try {
          const unsubscribed = this.connection.unsubscribe(subscription.internalKey);
          if (unsubscribed) {
            this.activeSubscriptions.delete(subscriptionKey);
            this.stats.totalSubscriptions--;
            this.logger.info(`🗑️ Hub: Removed subscription - ${subscriptionKey}`);
          } else {
            this.logger.warn(`⚠️ Hub: Failed to unsubscribe from ${subscription.internalKey}`);
          }
        } catch (error) {
          this.logger.error(`❌ Hub: Error unsubscribing from ${subscription.internalKey}:`, error);
        }
      }
    } else {
      // Decrease subscriber count
      if (this.activeSubscriptions.has(subscriptionKey)) {
        this.activeSubscriptions.get(subscriptionKey).subscriberCount--;
        this.logger.debug(`📊 Hub: Decreased subscriber count for ${subscriptionKey} to ${this.activeSubscriptions.get(subscriptionKey).subscriberCount}`);
      }
    }
    
    return true;
  }

  /**
   * Broadcast data to all subscribers of a subscription
   * @param {string} subscriptionKey - The subscription key
   * @param {Object} data - The real-time data to broadcast
   */
  broadcastToSubscribers(subscriptionKey, data) {
    const subscriberSet = this.subscribers.get(subscriptionKey);
    if (!subscriberSet || subscriberSet.size === 0) {
      this.logger.warn(`⚠️ Hub: No subscribers for ${subscriptionKey}`);
      return;
    }
    
    this.stats.messagesReceived++;
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const subscriber of subscriberSet) {
      try {
        subscriber.callback(data);
        successCount++;
      } catch (error) {
        errorCount++;
        this.logger.error(`❌ Hub: Error in subscriber callback for ${subscriptionKey}:`, error);
      }
    }
    
    this.logger.debug(`📡 Hub: Broadcasted to ${successCount} subscribers for ${subscriptionKey} (${errorCount} errors)`);
  }

  /**
   * Generate unique subscription key for deduplication
   * @param {*} markets 
   * @param {*} codes 
   * @param {*} qualifiedNames 
   * @param {*} namespace 
   * @param {*} options 
   * @returns {string} subscription key
   */
  generateSubscriptionKey(markets, codes, qualifiedNames, namespace, options) {
    const marketStr = Array.isArray(markets) ? markets.sort().join(',') : markets;
    const codeStr = Array.isArray(codes) ? codes.sort().join(',') : codes;
    const qnameStr = Array.isArray(qualifiedNames) ? qualifiedNames.sort().join(',') : qualifiedNames;
    
    // Create deterministic options string (exclude callback-specific options)
    const optsCopy = { ...options };
    delete optsCopy.callback; // Remove callback if present
    const optsStr = JSON.stringify(optsCopy, Object.keys(optsCopy).sort());
    
    return `${marketStr}|${codeStr}|${qnameStr}|${namespace}|${optsStr}`;
  }

  /**
   * Generate unique subscriber ID
   * @returns {string} subscriber ID
   */
  generateSubscriberId() {
    return 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  /**
   * Get subscription statistics and status
   * @returns {Object} subscription statistics
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime.getTime();
    
    return {
      activeSubscriptions: this.activeSubscriptions.size,
      totalSubscribers: this.stats.totalSubscribers,
      messagesReceived: this.stats.messagesReceived,
      uptime: Math.round(uptime / 1000), // seconds
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

  /**
   * Get all active subscription keys
   * @returns {string[]} array of subscription keys
   */
  getActiveSubscriptionKeys() {
    return Array.from(this.activeSubscriptions.keys());
  }

  /**
   * Get subscription info by key
   * @param {string} subscriptionKey 
   * @returns {Object|null} subscription info or null if not found
   */
  getSubscriptionInfo(subscriptionKey) {
    return this.activeSubscriptions.get(subscriptionKey) || null;
  }

  /**
   * Cleanup inactive or orphaned subscriptions
   * @returns {number} number of subscriptions cleaned up
   */
  cleanup() {
    let cleanedUp = 0;
    
    // Find subscriptions with no subscribers
    for (const [subscriptionKey, subscription] of this.activeSubscriptions.entries()) {
      const subscriberSet = this.subscribers.get(subscriptionKey);
      
      if (!subscriberSet || subscriberSet.size === 0) {
        this.logger.warn(`🧹 Hub: Cleaning up orphaned subscription - ${subscriptionKey}`);
        
        try {
          this.connection.unsubscribe(subscription.internalKey);
          this.activeSubscriptions.delete(subscriptionKey);
          this.subscribers.delete(subscriptionKey);
          cleanedUp++;
        } catch (error) {
          this.logger.error(`❌ Hub: Failed to cleanup subscription ${subscriptionKey}:`, error);
        }
      }
    }
    
    if (cleanedUp > 0) {
      this.logger.info(`🧹 Hub: Cleaned up ${cleanedUp} orphaned subscriptions`);
    }
    
    return cleanedUp;
  }

  /**
   * Shutdown the hub and unsubscribe from all subscriptions
   */
  shutdown() {
    this.logger.info(`🔄 Hub: Shutting down (${this.activeSubscriptions.size} active subscriptions)...`);
    
    let unsubscribed = 0;
    for (const [subscriptionKey, subscription] of this.activeSubscriptions.entries()) {
      try {
        this.connection.unsubscribe(subscription.internalKey);
        unsubscribed++;
      } catch (error) {
        this.logger.error(`❌ Hub: Failed to unsubscribe ${subscriptionKey}:`, error);
      }
    }
    
    // Clear all data structures
    this.activeSubscriptions.clear();
    this.subscribers.clear();
    this.subscriptionKeys.clear();
    
    this.stats.totalSubscriptions = 0;
    this.stats.totalSubscribers = 0;
    
    this.logger.info(`✅ Hub: Shutdown complete (${unsubscribed} subscriptions unsubscribed)`);
  }
}