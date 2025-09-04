import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial state
const initialState = {
  schema: {},
  marketData: {},
  securities: {},
  historicalData: new Map(),
  logs: [],
  rawMessages: [],
  isSchemaLoaded: false,
  dataCount: 0,
  maxLogs: 1000,
  maxRawMessages: 100
};

// Action types
const DATA_ACTIONS = {
  SET_SCHEMA: 'SET_SCHEMA',
  SET_MARKET_DATA: 'SET_MARKET_DATA',
  SET_SECURITIES: 'SET_SECURITIES',
  ADD_HISTORICAL_DATA: 'ADD_HISTORICAL_DATA',
  CLEAR_HISTORICAL_DATA: 'CLEAR_HISTORICAL_DATA',
  ADD_LOG: 'ADD_LOG',
  CLEAR_LOGS: 'CLEAR_LOGS',
  ADD_RAW_MESSAGE: 'ADD_RAW_MESSAGE',
  CLEAR_RAW_MESSAGES: 'CLEAR_RAW_MESSAGES'
};

// Reducer
function dataReducer(state, action) {
  switch (action.type) {
    case DATA_ACTIONS.SET_SCHEMA:
      const schemaPayload = action.payload || {};
      return {
        ...state,
        schema: schemaPayload,
        isSchemaLoaded: Object.keys(schemaPayload).length > 0
      };

    case DATA_ACTIONS.SET_MARKET_DATA:
      const marketPayload = action.payload || {};
      return {
        ...state,
        marketData: marketPayload,
        dataCount: Object.values(marketPayload).reduce((total, namespace) => {
          return total + (namespace ? Object.values(namespace).reduce((nsTotal, records) => {
            return nsTotal + (Array.isArray(records) ? records.length : 0);
          }, 0) : 0);
        }, 0)
      };
      
    case DATA_ACTIONS.SET_SECURITIES:
      const securitiesPayload = action.payload || {};
      return {
        ...state,
        securities: securitiesPayload
      };

    case DATA_ACTIONS.ADD_HISTORICAL_DATA:
      const newHistoricalData = new Map(state.historicalData);
      newHistoricalData.set(action.key, action.payload);
      return {
        ...state,
        historicalData: newHistoricalData
      };

    case DATA_ACTIONS.CLEAR_HISTORICAL_DATA:
      return {
        ...state,
        historicalData: new Map()
      };

    case DATA_ACTIONS.ADD_LOG:
      const newLogs = [...state.logs, action.payload];
      // Maintain max logs limit
      if (newLogs.length > state.maxLogs) {
        newLogs.splice(0, newLogs.length - state.maxLogs);
      }
      return {
        ...state,
        logs: newLogs
      };

    case DATA_ACTIONS.CLEAR_LOGS:
      return {
        ...state,
        logs: []
      };

    case DATA_ACTIONS.ADD_RAW_MESSAGE:
      const newRawMessages = [...state.rawMessages, action.payload];
      // Maintain max raw messages limit
      if (newRawMessages.length > state.maxRawMessages) {
        newRawMessages.splice(0, newRawMessages.length - state.maxRawMessages);
      }
      return {
        ...state,
        rawMessages: newRawMessages
      };

    case DATA_ACTIONS.CLEAR_RAW_MESSAGES:
      return {
        ...state,
        rawMessages: []
      };

    default:
      return state;
  }
}

// Context
const DataContext = createContext();

// Provider component
export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(dataReducer, initialState);

  const setSchema = useCallback((schema) => {
    dispatch({ type: DATA_ACTIONS.SET_SCHEMA, payload: schema });
  }, []);

  const setMarketData = useCallback((data) => {
    dispatch({ type: DATA_ACTIONS.SET_MARKET_DATA, payload: data });
  }, []);

  const setSecurities = useCallback((data) => {
    dispatch({ type: DATA_ACTIONS.SET_SECURITIES, payload: data });
  }, []);

  const addHistoricalData = useCallback((key, data) => {
    dispatch({ 
      type: DATA_ACTIONS.ADD_HISTORICAL_DATA, 
      key, 
      payload: data 
    });
  }, []);

  const clearHistoricalData = useCallback(() => {
    dispatch({ type: DATA_ACTIONS.CLEAR_HISTORICAL_DATA });
  }, []);

  const addLog = useCallback((level, message, data = null) => {
    const logEntry = {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      level,
      message,
      data
    };
    dispatch({ type: DATA_ACTIONS.ADD_LOG, payload: logEntry });
    
    // Also log to browser console
    const consoleMethod = level === 'error' ? 'error' : 
                         level === 'warning' ? 'warn' : 
                         level === 'success' ? 'log' : 'log';
    console[consoleMethod](`[${level.toUpperCase()}]`, message, data || '');
  }, []);

  const clearLogs = useCallback(() => {
    dispatch({ type: DATA_ACTIONS.CLEAR_LOGS });
  }, []);

  const addRawMessage = useCallback((rawMessage) => {
    dispatch({ type: DATA_ACTIONS.ADD_RAW_MESSAGE, payload: rawMessage });
  }, []);

  const clearRawMessages = useCallback(() => {
    dispatch({ type: DATA_ACTIONS.CLEAR_RAW_MESSAGES });
  }, []);

  const exportLogs = useCallback((format = 'json') => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mini-wolverine-logs-${timestamp}.${format}`;
    
    let content;
    if (format === 'json') {
      content = JSON.stringify({
        logs: state.logs,
        exported: new Date().toISOString(),
        count: state.logs.length
      }, null, 2);
    } else {
      // CSV format
      const csvHeader = 'Timestamp,Level,Message,Data\n';
      const csvRows = state.logs.map(log => 
        `"${log.timestamp.toISOString()}","${log.level}","${log.message}","${log.data ? JSON.stringify(log.data) : ''}"`
      ).join('\n');
      content = csvHeader + csvRows;
    }
    
    const blob = new Blob([content], { 
      type: format === 'json' ? 'application/json' : 'text/csv' 
    });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log(`Logs exported as ${filename}`);
  }, [state.logs]);

  const exportHistoricalData = useCallback(() => {
    if (state.historicalData.size === 0) {
      console.warn('No historical data to export');
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `mini-wolverine-historical-${timestamp}.json`;
    
    const exportData = {
      exported: new Date().toISOString(),
      datasets: Array.from(state.historicalData.entries()).map(([key, dataset]) => ({
        key,
        ...dataset,
        recordCount: dataset.data?.length || 0
      }))
    };
    
    const content = JSON.stringify(exportData, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    
    console.log(`Historical data exported as ${filename}`);
  }, [state.historicalData]);

  const value = {
    ...state,
    actions: {
      setSchema,
      setMarketData,
      setSecurities,
      addHistoricalData,
      clearHistoricalData,
      addLog,
      clearLogs,
      addRawMessage,
      clearRawMessages,
      exportLogs,
      exportHistoricalData
    }
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

// Custom hook
export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export { DATA_ACTIONS };