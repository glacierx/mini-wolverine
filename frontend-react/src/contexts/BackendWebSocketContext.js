import { createContext, useContext, useReducer, useCallback, useRef, useEffect } from 'react';
import { useData } from './DataContext';
import { loadCredentials, saveCredentials, clearCredentials } from '../utils/storage';

// Initial state
const initialState = {
  backendWs: null,
  isConnected: false,
  isConnecting: false,
  error: null,
  caitlynConnected: false,
  serverUrl: null,
  authToken: null,
  clientId: null,
  assignedConnectionId: null,
  cachedSeeds: new Map(),
  lastSeedTimestamp: 0,
  poolReady: false,
  poolStats: {
    totalConnections: 0,
    availableConnections: 0,
    busyConnections: 0
  },
  stats: {
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    lastMessageType: null,
    lastMessageTime: null,
    cachedSeedsCount: 0
  }
};

// Action types
const WS_ACTIONS = {
  SET_CONNECTING: 'SET_CONNECTING',
  SET_CONNECTED: 'SET_CONNECTED',
  SET_DISCONNECTED: 'SET_DISCONNECTED',
  SET_CAITLYN_CONNECTED: 'SET_CAITLYN_CONNECTED',
  SET_CAITLYN_DISCONNECTED: 'SET_CAITLYN_DISCONNECTED',
  SET_ERROR: 'SET_ERROR',
  SET_WEBSOCKET: 'SET_WEBSOCKET',
  UPDATE_STATS: 'UPDATE_STATS',
  CLEAR_ERROR: 'CLEAR_ERROR',
  SET_CREDENTIALS: 'SET_CREDENTIALS',
  SET_CLIENT_INFO: 'SET_CLIENT_INFO',
  UPDATE_CACHED_SEEDS: 'UPDATE_CACHED_SEEDS',
  BATCH_UPDATE_CACHED_SEEDS: 'BATCH_UPDATE_CACHED_SEEDS',
  SET_POOL_READY: 'SET_POOL_READY',
  UPDATE_POOL_STATS: 'UPDATE_POOL_STATS'
};

// Reducer
function webSocketReducer(state, action) {
  switch (action.type) {
    case WS_ACTIONS.SET_CONNECTING:
      return { 
        ...state, 
        isConnecting: true, 
        isConnected: false, 
        error: null 
      };
      
    case WS_ACTIONS.SET_CONNECTED:
      return { 
        ...state, 
        isConnected: true, 
        isConnecting: false, 
        error: null 
      };
      
    case WS_ACTIONS.SET_DISCONNECTED:
      return { 
        ...state, 
        isConnected: false, 
        isConnecting: false,
        caitlynConnected: false,
        backendWs: null 
      };
      
    case WS_ACTIONS.SET_CAITLYN_CONNECTED:
      return {
        ...state,
        caitlynConnected: true
      };
      
    case WS_ACTIONS.SET_CAITLYN_DISCONNECTED:
      return {
        ...state,
        caitlynConnected: false
      };
      
    case WS_ACTIONS.SET_ERROR:
      return { 
        ...state, 
        error: action.payload, 
        isConnecting: false,
        stats: {
          ...state.stats,
          errors: state.stats.errors + 1
        }
      };
      
    case WS_ACTIONS.SET_WEBSOCKET:
      return { ...state, backendWs: action.payload };
      
    case WS_ACTIONS.UPDATE_STATS:
      return { 
        ...state, 
        stats: { ...state.stats, ...action.payload } 
      };
      
    case WS_ACTIONS.CLEAR_ERROR:
      return { ...state, error: null };
      
    case WS_ACTIONS.SET_CREDENTIALS:
      return { 
        ...state, 
        serverUrl: action.serverUrl,
        authToken: action.authToken
      };
      
    case WS_ACTIONS.SET_CLIENT_INFO:
      return {
        ...state,
        clientId: action.payload.clientId,
        assignedConnectionId: action.payload.assignedConnectionId,
        stats: {
          ...state.stats,
          cachedSeedsCount: action.payload.cachedSeedsCount || 0
        }
      };
      
    case WS_ACTIONS.UPDATE_CACHED_SEEDS:
      const newSeeds = new Map(state.cachedSeeds);
      newSeeds.set(action.payload.key, action.payload.data);
      return {
        ...state,
        cachedSeeds: newSeeds,
        lastSeedTimestamp: action.payload.timestamp || Date.now(),
        stats: {
          ...state.stats,
          cachedSeedsCount: newSeeds.size
        }
      };
      
    case WS_ACTIONS.BATCH_UPDATE_CACHED_SEEDS:
      const batchSeeds = new Map(state.cachedSeeds);
      action.payload.seeds.forEach(seed => {
        batchSeeds.set(seed.key, seed);
      });
      return {
        ...state,
        cachedSeeds: batchSeeds,
        lastSeedTimestamp: action.payload.currentTimestamp || Date.now(),
        stats: {
          ...state.stats,
          cachedSeedsCount: batchSeeds.size
        }
      };
      
    case WS_ACTIONS.SET_POOL_READY:
      return {
        ...state,
        poolReady: true,
        caitlynConnected: true
      };
      
    case WS_ACTIONS.UPDATE_POOL_STATS:
      return {
        ...state,
        poolStats: { ...state.poolStats, ...action.payload }
      };
      
    default:
      return state;
  }
}

// Context
const BackendWebSocketContext = createContext();

// Provider component
export function BackendWebSocketProvider({ children }) {
  const [state, dispatch] = useReducer(webSocketReducer, initialState);
  const { actions: dataActions } = useData();
  const wsRef = useRef(null);
  const hasAutoConnected = useRef(false);

  // Load saved credentials on component mount
  useEffect(() => {
    const credentials = loadCredentials();
    if (credentials.url || credentials.token) {
      dispatch({
        type: WS_ACTIONS.SET_CREDENTIALS,
        serverUrl: credentials.url,
        authToken: credentials.token
      });
    }
  }, []);

  const connectToBackend = useCallback(() => {
    // Strong connection guard - prevent multiple simultaneous connections
    if (state.isConnected || state.isConnecting || wsRef.current) {
      console.log('⚠️ Already connected or connecting to backend, connection state:', {
        isConnected: state.isConnected,
        isConnecting: state.isConnecting,
        hasWebSocket: !!wsRef.current
      });
      return;
    }

    console.log('🔌 Starting backend connection process...');
    dispatch({ type: WS_ACTIONS.SET_CONNECTING });

    const backendUrl = process.env.REACT_APP_BACKEND_WS_URL || 'ws://localhost:4000';
    console.log(`🔌 Connecting to backend: ${backendUrl}`);
    
    const ws = new WebSocket(backendUrl);
    wsRef.current = ws;
    dispatch({ type: WS_ACTIONS.SET_WEBSOCKET, payload: ws });

    ws.onopen = () => {
      console.log('✅ Connected to backend');
      dispatch({ type: WS_ACTIONS.SET_CONNECTED });
      
      // Request client info and connect to Caitlyn server
      setTimeout(() => {
        console.log('📤 Requesting client info...');
        ws.send(JSON.stringify({ type: 'get_client_info' }));
        
        console.log('ℹ️ Backend pre-initialized with Caitlyn connection - no reconfiguration needed');
        
        // After connection, the enhanced pool will automatically initialize
        // and send pool_ready event with all data
        setTimeout(() => {
          console.log('📤 Requesting client info and pool status...');
          ws.send(JSON.stringify({ type: 'get_pool_stats' }));
        }, 1000); // Wait 1 second for pool initialization
      }, 500);
      
      dispatch({ 
        type: WS_ACTIONS.UPDATE_STATS, 
        payload: { 
          messagesSent: state.stats.messagesSent + 1,
          lastMessageType: 'connection',
          lastMessageTime: new Date().toISOString()
        } 
      });
    };

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log('📨 Backend message:', message.type);
        
        handleBackendMessage(message);
        
        dispatch({ 
          type: WS_ACTIONS.UPDATE_STATS, 
          payload: { 
            messagesReceived: state.stats.messagesReceived + 1,
            lastMessageType: message.type,
            lastMessageTime: new Date().toISOString()
          } 
        });
      };

      ws.onerror = (error) => {
        console.error('❌ Backend WebSocket error:', error);
        dispatch({ 
          type: WS_ACTIONS.SET_ERROR, 
          payload: 'Backend connection error' 
        });
      };

      ws.onclose = (event) => {
        console.log('🔌 Backend WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean
        });
        
        // Clean up WebSocket reference
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        
        dispatch({ type: WS_ACTIONS.SET_DISCONNECTED });
      };
  }, []); // Remove state dependencies to prevent connection recreation

  // Auto-connect to backend WebSocket on mount and handle cleanup
  useEffect(() => {
    // Prevent multiple auto-connection attempts
    if (hasAutoConnected.current) {
      console.log('🔒 Auto-connection already attempted, skipping...');
      return;
    }
    
    hasAutoConnected.current = true;
    console.log('🚀 Auto-connecting to backend on mount...');
    
    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(() => {
      connectToBackend();
    }, 100);
    
    // Cleanup function: close WebSocket and clear timeout
    return () => {
      console.log('🧹 BackendWebSocketContext cleanup - closing WebSocket...');
      clearTimeout(timeoutId);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, []); // Empty dependency array prevents re-runs

  const handleBackendMessage = useCallback((message) => {
    // Add all messages to raw messages log
    dataActions.addRawMessage({
      timestamp: new Date(),
      type: message.type || 'unknown',
      data: message
    });

    switch (message.type) {
      case 'connection_status':
        if (message.status === 'connected') {
          console.log('✅ Caitlyn server connected via backend');
          dispatch({ type: WS_ACTIONS.SET_CAITLYN_CONNECTED });
          dataActions.addLog('success', 'Connected to Caitlyn server via backend');
        } else if (message.status === 'disconnected') {
          console.log('🔌 Caitlyn server disconnected');
          dispatch({ type: WS_ACTIONS.SET_CAITLYN_DISCONNECTED });
          dataActions.addLog('info', 'Disconnected from Caitlyn server');
        }
        break;
        
      case 'client_info':
        console.log('📋 Client info received:', message);
        dispatch({
          type: WS_ACTIONS.SET_CLIENT_INFO,
          payload: {
            clientId: message.clientId,
            assignedConnectionId: message.assignedConnectionId,
            cachedSeedsCount: message.cachedSeedsCount || 0
          }
        });
        dataActions.addLog('info', 'Client assigned to dedicated connection', {
          clientId: message.clientId,
          connectionId: message.assignedConnectionId
        });
        break;
        
      case 'cached_seeds_batch':
        console.log('🌱 Cached seeds batch received:', message.count || 0, 'seeds');
        if (message.seeds && message.seeds.length > 0) {
          dispatch({
            type: WS_ACTIONS.BATCH_UPDATE_CACHED_SEEDS,
            payload: {
              seeds: message.seeds,
              currentTimestamp: message.currentTimestamp || Date.now()
            }
          });
          dataActions.addLog('success', 'Cached seeds data loaded', {
            seedCount: message.seeds.length,
            fromCache: true
          });
        }
        break;
        
      case 'pool_ready':
        console.log('🎆 Enhanced connection pool ready!');
        dispatch({ type: WS_ACTIONS.SET_POOL_READY });
        
        // Handle all the data from the pool
        if (message.schema) {
          console.log('📋 Schema received from pool');
          dataActions.setSchema(message.schema);
          dataActions.addLog('success', 'Schema definitions loaded from pool', { 
            definitionsCount: Object.keys(message.schema).reduce((sum, ns) => sum + Object.keys(message.schema[ns] || {}).length, 0)
          });
        }
        
        if (message.markets) {
          console.log('🌍 Markets data received from pool');
          dataActions.setMarketData(message.markets);
          const globalCount = Object.keys(message.markets?.global || {}).length;
          const privateCount = Object.keys(message.markets?.private || {}).length;
          dataActions.addLog('success', 'Market data loaded from pool', { 
            globalMarkets: globalCount, 
            privateMarkets: privateCount 
          });
        }
        
        if (message.securities) {
          console.log('🗺️ Securities data received from pool');
          dataActions.setSecurities(message.securities);
          const marketsCount = Object.keys(message.securities).length;
          const totalSecurities = Object.values(message.securities).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
          dataActions.addLog('success', 'Securities data loaded from pool', {
            marketsWithSecurities: marketsCount,
            totalSecurities: totalSecurities
          });
        }
        
        dataActions.addLog('success', 'Enhanced connection pool fully initialized and ready');
        break;
        
      case 'handshake_success':
        console.log('✅ Caitlyn handshake successful');
        dataActions.addLog('success', 'Caitlyn handshake completed successfully');
        break;
        
      case 'handshake_failed':
        console.error('❌ Caitlyn handshake failed:', message.message);
        dispatch({ 
          type: WS_ACTIONS.SET_ERROR, 
          payload: `Handshake failed: ${message.message}` 
        });
        dataActions.addLog('error', 'Caitlyn handshake failed', { error: message.message });
        break;
        
      case 'schema_received':
      case 'schema':
        console.log('📋 Schema received from backend with revision support');
        const schemaData = message.data || message.schema;
        
        // Log revision information if available
        let totalRevisions = 0;
        if (schemaData) {
          Object.values(schemaData).forEach(namespace => {
            Object.values(namespace).forEach(meta => {
              if (meta.revision !== undefined) {
                totalRevisions++;
              }
            });
          });
        }
        
        dataActions.setSchema(schemaData);
        dataActions.addLog('success', 'Schema definitions with revisions loaded', { 
          definitionsCount: Object.keys(schemaData || {}).length,
          totalRevisions: totalRevisions
        });
        break;
        
      case 'markets_received':
        console.log('🌍 Markets data received from backend');
        dataActions.setMarketData(message.data);
        const globalCount = Object.keys(message.data?.global || {}).length;
        const privateCount = Object.keys(message.data?.private || {}).length;
        dataActions.addLog('success', 'Market data received', { 
          globalMarkets: globalCount, 
          privateMarkets: privateCount 
        });
        break;
        
      case 'seeds_received':
        console.log('🌱 Seeds data received from backend');
        // Handle individual seed updates
        if (message.key && message.data) {
          dispatch({
            type: WS_ACTIONS.UPDATE_CACHED_SEEDS,
            payload: {
              key: message.key,
              data: message.data,
              timestamp: message.timestamp || Date.now()
            }
          });
        }
        dataActions.addLog('info', 'Universe seeds data received', { 
          seedCount: message.data?.count || 0,
          key: message.key
        });
        break;
        
      case 'universe_revision':
        console.log('🌍 Universe revision received from backend');
        if (message.success) {
          // Create market data structure from universe revision response
          const marketData = {
            global: message.globalMarkets || {},
            private: message.privateMarkets || {}
          };
          dataActions.setMarketData(marketData);
          dataActions.addLog('success', 'Universe revision data loaded', {
            totalMarkets: message.marketsCount || 0,
            globalMarkets: Object.keys(message.globalMarkets || {}).length,
            privateMarkets: Object.keys(message.privateMarkets || {}).length
          });
        } else {
          dataActions.addLog('error', 'Failed to load universe revision');
        }
        break;
        
      case 'market_data':
        console.log('📊 Real-time market data received');
        dataActions.addLog('info', 'Real-time market data received', {
          cmd: message.cmd,
          seq: message.seq
        });
        break;
        
      case 'historical_data_response':
        console.log('📈 Historical data response received:', message.success ? 'Success' : 'Failed');
        if (message.success && message.data) {
          // Store historical data in DataContext
          const dataKey = `${message.params?.market || 'unknown'}_${message.params?.code || 'unknown'}_${Date.now()}`;
          dataActions.addHistoricalData(dataKey, {
            requestId: message.requestId,
            market: message.params?.market,
            code: message.params?.code,
            metaName: message.params?.metaName,
            namespace: message.params?.namespace,
            granularity: message.params?.granularity,
            fieldCount: message.params?.fieldCount || 0,
            timeRange: message.params?.timeRange,
            data: message.data.records || [],
            totalCount: message.data.totalCount || 0,
            source: message.data.source || 'backend',
            processingTime: message.data.processingTime,
            receivedAt: new Date().toISOString()
          });
          
          dataActions.addLog('success', 'Historical data retrieved successfully', {
            market: message.params?.market,
            code: message.params?.code,
            recordCount: message.data.totalCount || 0,
            fieldCount: message.params?.fieldCount,
            source: message.data.source
          });
          
          // Dispatch custom event for HistoricalDataQuery component to catch
          window.dispatchEvent(new CustomEvent('historicalDataReceived', {
            detail: {
              success: true,
              data: message.data.records || [],
              totalCount: message.data.totalCount || 0,
              requestId: message.requestId,
              params: message.params
            }
          }));
        } else {
          dataActions.addLog('error', 'Historical data query failed', { 
            error: message.error,
            market: message.params?.market,
            code: message.params?.code
          });
          
          // Dispatch error event
          window.dispatchEvent(new CustomEvent('historicalDataReceived', {
            detail: {
              success: false,
              error: message.error || 'Unknown error',
              requestId: message.requestId
            }
          }));
        }
        break;
        
      case 'connection_error':
        console.error('❌ Pool connection error:', message.connectionId, message.error);
        dataActions.addLog('error', 'Connection pool error', { 
          connectionId: message.connectionId,
          error: message.error 
        });
        break;
        
      case 'pool_shutdown':
        console.log('📋 Connection pool shutdown');
        dispatch({ type: WS_ACTIONS.SET_CAITLYN_DISCONNECTED });
        dataActions.addLog('warning', 'Connection pool has been shut down');
        break;
        
      case 'securities_data':
        console.log('🗺️ Securities data received from backend');
        if (message.data) {
          dataActions.setSecurities(message.data);
          const marketsCount = Object.keys(message.data).length;
          const totalSecurities = Object.values(message.data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
          dataActions.addLog('success', 'Securities data loaded', {
            marketsWithSecurities: marketsCount,
            totalSecurities: totalSecurities
          });
        }
        break;
        
      case 'securities_not_ready':
        console.log('⚠️ Securities data not yet ready');
        dataActions.addLog('info', 'Securities data not yet available - pool initializing');
        break;
        
      case 'error':
        console.error('❌ Backend error:', message.message);
        dispatch({ 
          type: WS_ACTIONS.SET_ERROR, 
          payload: message.message 
        });
        dataActions.addLog('error', 'Backend error', { error: message.message });
        break;
        
      default:
        console.log('❓ Unknown backend message type:', message.type);
        dataActions.addLog('warning', 'Unknown message type received', { type: message.type });
    }
  }, [dataActions]);

  const connectToCaitlyn = useCallback((serverUrl, authToken) => {
    if (!state.isConnected) {
      console.warn('⚠️ Not connected to backend');
      return;
    }

    // Save credentials
    if (serverUrl && authToken) {
      saveCredentials(serverUrl, authToken);
      dispatch({
        type: WS_ACTIONS.SET_CREDENTIALS,
        serverUrl,
        authToken
      });
    }

    console.log(`🔌 Requesting connection to Caitlyn server via backend`);
    
    const message = {
      type: 'connect',
      url: serverUrl,
      token: authToken
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, [state.isConnected]);

  const disconnectFromCaitlyn = useCallback(() => {
    if (!state.isConnected) {
      console.warn('⚠️ Not connected to backend');
      return;
    }

    console.log('🔌 Requesting disconnection from Caitlyn server');
    
    const message = {
      type: 'disconnect'
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, [state.isConnected]);

  const disconnectFromBackend = useCallback(() => {
    if (wsRef.current) {
      console.log('🔌 Manually disconnecting from backend...');
      wsRef.current.close(1000, 'User requested disconnect');
      wsRef.current = null;
    }
    
    // Reset auto-connection flag to allow reconnection
    hasAutoConnected.current = false;
    
    dispatch({ type: WS_ACTIONS.SET_DISCONNECTED });
  }, []);

  const requestHistoricalData = useCallback((params) => {
    if (!state.isConnected) {
      console.warn('⚠️ Not connected to backend');
      return;
    }

    console.log('📊 Requesting historical data via backend with revision:', params.revision);
    
    // Ensure revision is included in the request
    const enhancedParams = {
      ...params,
      revision: params.revision || 0xFFFFFFFF, // Default to latest revision if not specified
      requestId: Date.now() // Add request ID for tracking
    };
    
    const message = {
      type: 'request_historical',
      params: enhancedParams
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, [state.isConnected]);

  const clearError = useCallback(() => {
    dispatch({ type: WS_ACTIONS.CLEAR_ERROR });
  }, []);

  const clearStoredCredentials = useCallback(() => {
    const success = clearCredentials();
    if (success) {
      console.log('🗑️ Stored credentials cleared');
      dispatch({ 
        type: WS_ACTIONS.SET_CREDENTIALS, 
        serverUrl: '', 
        authToken: '' 
      });
    }
    return success;
  }, []);

  const getSavedCredentials = useCallback(() => {
    return loadCredentials();
  }, []);

  const sendMessage = useCallback((message) => {
    if (!state.isConnected) {
      console.warn('⚠️ Not connected to backend');
      return;
    }

    console.log('📤 Sending message to backend:', message.type);
    wsRef.current.send(JSON.stringify(message));
  }, [state.isConnected]);

  const value = {
    ...state,
    sendMessage,
    actions: {
      connectToBackend,
      disconnectFromBackend,
      connectToCaitlyn,
      disconnectFromCaitlyn,
      requestHistoricalData,
      clearError,
      clearStoredCredentials,
      getSavedCredentials
    }
  };

  return (
    <BackendWebSocketContext.Provider value={value}>
      {children}
    </BackendWebSocketContext.Provider>
  );
}

// Custom hook
export function useBackendWebSocket() {
  const context = useContext(BackendWebSocketContext);
  if (!context) {
    throw new Error('useBackendWebSocket must be used within a BackendWebSocketProvider');
  }
  return context;
}

export { WS_ACTIONS };