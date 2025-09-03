import React, { useState } from 'react';
import styled from 'styled-components';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';

const ActionsContainer = styled.section`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
`;

const ActionGroup = styled.div`
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  padding: 20px;
`;

const GroupTitle = styled.h4`
  margin: 0 0 15px 0;
  color: var(--primary-color);
  font-size: 16px;
  font-weight: 600;
`;

const ActionButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const HistoricalControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 10px;
`;

const ControlRow = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
`;

const ControlInput = styled.select`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  background: white;
  
  &:disabled {
    background: #f8f9fa;
    color: var(--text-muted);
    cursor: not-allowed;
  }
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const NumberInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const ActionButton = styled.button`
  padding: 8px 16px;
  border: none;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.3s ease;
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &.primary {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    
    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: var(--shadow);
    }
  }
  
  &.secondary {
    background: var(--text-muted);
    color: white;
    
    &:hover:not(:disabled) {
      background: #6c757d;
    }
  }
  
  &.success {
    background: var(--success-color);
    color: white;
  }
  
  &.warning {
    background: var(--warning-color);
    color: white;
  }
`;

function ActionsSection() {
  const { isConnected, caitlynConnected, actions: wsActions } = useBackendWebSocket();
  
  // Historical data state
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('5');
  const [lookbackDays, setLookbackDays] = useState('7');
  const [isHistoricalLoading, setIsHistoricalLoading] = useState(false);

  // Mock available markets and symbols
  const availableMarkets = ['DME', 'NYMEX', 'ICE', 'CME'];
  const availableSymbols = {
    'DME': ['BRENT', 'DME_OIL', 'DME_GAS'],
    'NYMEX': ['CL', 'GC', 'NG', 'SI'],
    'ICE': ['ICE_BRENT', 'ICE_GAS', 'ICE_POWER'],
    'CME': ['ES', 'NQ', 'YM', 'RTY']
  };

  const handleDataRequest = (type) => {
    if (!isConnected) {
      alert('Not connected to server');
      return;
    }

    console.log(`Requesting ${type}...`);
    
    // Placeholder for actual data requests
    setTimeout(() => {
      console.log(`${type} request completed (placeholder)`);
      alert(`${type} request sent (placeholder implementation)`);
    }, 500);
  };

  const handleHistoricalDataFetch = async () => {
    if (!selectedMarket || !selectedSymbol) {
      alert('Please select both market and symbol');
      return;
    }

    if (!isConnected) {
      alert('Not connected to server');
      return;
    }

    setIsHistoricalLoading(true);
    
    try {
      console.log('Fetching historical data:', {
        market: selectedMarket,
        symbol: selectedSymbol,
        timeframe,
        lookbackDays
      });

      // Placeholder for historical data fetching
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Historical data fetch completed (placeholder)');
      alert(`Historical data request sent for ${selectedSymbol} (${selectedMarket})`);
      
    } catch (error) {
      console.error('Historical data fetch failed:', error);
      alert(`Failed to fetch historical data: ${error.message}`);
    } finally {
      setIsHistoricalLoading(false);
    }
  };

  const handleTestCommand = (command) => {
    console.log(`Executing test command: ${command}`);
    
    switch (command) {
      case 'keepalive':
        if (isConnected) {
          console.log('Sending keepalive...');
        }
        break;
      case 'fetch':
        console.log('Testing fetch functionality...');
        break;
      case 'debug_backend':
        console.log('Backend Connection Info:', {
          backendConnected: isConnected,
          caitlynConnected: caitlynConnected
        });
        break;
      default:
        console.log('Unknown test command');
    }
    
    alert(`${command} executed (placeholder)`);
  };

  const symbolsForMarket = selectedMarket ? (availableSymbols[selectedMarket] || []) : [];

  return (
    <ActionsContainer>
      <ActionGroup>
        <GroupTitle>📡 Data Requests</GroupTitle>
        <ActionButtons>
          <ActionButton 
            className="primary"
            disabled={!isConnected}
            onClick={() => handleDataRequest('Schema')}
          >
            Request Schema
          </ActionButton>
          <ActionButton 
            className="primary"
            disabled={!isConnected}
            onClick={() => handleDataRequest('Universe')}
          >
            Request Universe
          </ActionButton>
          <ActionButton 
            className="primary"
            disabled={!isConnected}
            onClick={() => handleDataRequest('Seeds')}
          >
            Request Seeds
          </ActionButton>
        </ActionButtons>
      </ActionGroup>

      <ActionGroup>
        <GroupTitle>📊 Historical Data</GroupTitle>
        <HistoricalControls>
          <ControlRow>
            <ControlInput
              value={selectedMarket}
              onChange={(e) => {
                setSelectedMarket(e.target.value);
                setSelectedSymbol(''); // Reset symbol when market changes
              }}
              disabled={!isConnected}
            >
              <option value="">Select Market...</option>
              {availableMarkets.map(market => (
                <option key={market} value={market}>{market}</option>
              ))}
            </ControlInput>
            <ControlInput
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              disabled={!isConnected || !selectedMarket}
            >
              <option value="">Select Symbol...</option>
              {symbolsForMarket.map(symbol => (
                <option key={symbol} value={symbol}>{symbol}</option>
              ))}
            </ControlInput>
          </ControlRow>
          <ControlRow>
            <ControlInput
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="1">1 minute</option>
              <option value="5">5 minutes</option>
              <option value="15">15 minutes</option>
              <option value="60">1 hour</option>
              <option value="240">4 hours</option>
              <option value="1440">1 day</option>
            </ControlInput>
            <NumberInput
              type="number"
              value={lookbackDays}
              onChange={(e) => setLookbackDays(e.target.value)}
              placeholder="Days"
              min="1"
              max="30"
            />
          </ControlRow>
          <ControlRow>
            <ActionButton
              className="primary"
              disabled={!isConnected || !selectedMarket || !selectedSymbol || isHistoricalLoading}
              onClick={handleHistoricalDataFetch}
            >
              {isHistoricalLoading ? 'Fetching...' : 'Fetch Historical Data'}
            </ActionButton>
            <ActionButton
              className="secondary"
              onClick={() => {
                setSelectedMarket('');
                setSelectedSymbol('');
                console.log('Historical data cleared (placeholder)');
              }}
            >
              Clear Data
            </ActionButton>
          </ControlRow>
        </HistoricalControls>
      </ActionGroup>

      <ActionGroup>
        <GroupTitle>🧪 Test Commands</GroupTitle>
        <ActionButtons>
          <ActionButton 
            className="secondary"
            disabled={!isConnected}
            onClick={() => handleTestCommand('keepalive')}
          >
            Send Keepalive
          </ActionButton>
          <ActionButton 
            className="secondary"
            disabled={!isConnected}
            onClick={() => handleTestCommand('fetch')}
          >
            Test Fetch
          </ActionButton>
          <ActionButton 
            className="warning"
            onClick={() => handleTestCommand('debug_backend')}
          >
            Debug Backend
          </ActionButton>
        </ActionButtons>
      </ActionGroup>
    </ActionsContainer>
  );
}

export default ActionsSection;