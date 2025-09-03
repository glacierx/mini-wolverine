/**
 * Utility functions for persistent storage of application settings
 */

const STORAGE_KEYS = {
  WS_SERVER_URL: 'mini_wolverine_ws_url',
  WS_AUTH_TOKEN: 'mini_wolverine_ws_token',
  WS_CREDENTIALS: 'mini_wolverine_ws_credentials',
  USER_PREFERENCES: 'mini_wolverine_preferences'
};

/**
 * Save WebSocket server credentials to localStorage
 * @param {string} url - WebSocket server URL
 * @param {string} token - Authentication token
 */
export const saveCredentials = (url, token) => {
  try {
    const credentials = {
      url: url || '',
      token: token || '',
      savedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    localStorage.setItem(STORAGE_KEYS.WS_CREDENTIALS, JSON.stringify(credentials));
    console.log('💾 Server credentials saved to localStorage');
    return true;
  } catch (error) {
    console.error('❌ Failed to save credentials:', error);
    return false;
  }
};

/**
 * Load WebSocket server credentials from localStorage
 * @returns {Object} Credentials object with url and token
 */
export const loadCredentials = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.WS_CREDENTIALS);
    if (!stored) {
      return {
        url: process.env.REACT_APP_WS_URL || '',
        token: process.env.REACT_APP_WS_TOKEN || ''
      };
    }
    
    const credentials = JSON.parse(stored);
    // console.log('📥 Server credentials loaded from localStorage');
    
    // Return credentials with fallback to environment variables
    return {
      url: credentials.url || process.env.REACT_APP_WS_URL || '',
      token: credentials.token || process.env.REACT_APP_WS_TOKEN || '',
      savedAt: credentials.savedAt,
      version: credentials.version
    };
  } catch (error) {
    console.error('❌ Failed to load credentials:', error);
    // Return environment variables as fallback
    return {
      url: process.env.REACT_APP_WS_URL || '',
      token: process.env.REACT_APP_WS_TOKEN || ''
    };
  }
};

/**
 * Clear stored WebSocket credentials
 */
export const clearCredentials = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.WS_CREDENTIALS);
    console.log('🗑️ Server credentials cleared from localStorage');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear credentials:', error);
    return false;
  }
};

/**
 * Check if credentials are stored
 * @returns {boolean} True if credentials exist in storage
 */
export const hasStoredCredentials = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.WS_CREDENTIALS);
    return !!stored;
  } catch (error) {
    return false;
  }
};

/**
 * Save user preferences
 * @param {Object} preferences - User preference object
 */
export const savePreferences = (preferences) => {
  try {
    const prefs = {
      ...preferences,
      savedAt: new Date().toISOString(),
      version: '1.0'
    };
    
    localStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(prefs));
    console.log('💾 User preferences saved');
    return true;
  } catch (error) {
    console.error('❌ Failed to save preferences:', error);
    return false;
  }
};

/**
 * Load user preferences
 * @returns {Object} User preferences object
 */
export const loadPreferences = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
    if (!stored) {
      return getDefaultPreferences();
    }
    
    const preferences = JSON.parse(stored);
    console.log('📥 User preferences loaded');
    return { ...getDefaultPreferences(), ...preferences };
  } catch (error) {
    console.error('❌ Failed to load preferences:', error);
    return getDefaultPreferences();
  }
};

/**
 * Get default user preferences
 * @returns {Object} Default preferences
 */
const getDefaultPreferences = () => ({
  autoConnect: false,
  rememberCredentials: true,
  debugMode: false,
  theme: 'auto'
});

/**
 * Clear all stored data
 */
export const clearAllStorage = () => {
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🗑️ All stored data cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear storage:', error);
    return false;
  }
};

/**
 * Get storage usage info for debugging
 * @returns {Object} Storage usage information
 */
export const getStorageInfo = () => {
  try {
    const info = {
      hasCredentials: hasStoredCredentials(),
      storageKeys: Object.keys(STORAGE_KEYS),
      totalItems: 0
    };
    
    Object.values(STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        info.totalItems++;
        info[key] = {
          size: item.length,
          exists: true
        };
      } else {
        info[key] = { exists: false };
      }
    });
    
    return info;
  } catch (error) {
    console.error('❌ Failed to get storage info:', error);
    return { error: error.message };
  }
};