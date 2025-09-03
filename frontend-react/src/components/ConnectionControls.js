import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';

const ControlsSection = styled.section`
  background: var(--card-background);
  padding: 20px;
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  margin-bottom: 20px;
`;

const ControlGroup = styled.div`
  margin-bottom: 15px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Label = styled.label`
  display: block;
  margin-bottom: 5px;
  color: var(--text-color);
  font-weight: 600;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px 15px;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-size: 14px;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 15px;
`;

const Button = styled.button`
  padding: 10px 20px;
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
      transform: translateY(-2px);
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
`;

const CredentialInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 12px;
  background: rgba(52, 152, 219, 0.1);
  border-radius: 4px;
  font-size: 12px;
  color: var(--secondary-color);
`;

const ClearButton = styled.button`
  padding: 4px 8px;
  font-size: 11px;
  background: transparent;
  border: 1px solid var(--secondary-color);
  border-radius: 3px;
  color: var(--secondary-color);
  cursor: pointer;
  
  &:hover {
    background: var(--secondary-color);
    color: white;
  }
`;

function ConnectionControls() {
  const { 
    isConnected,
    caitlynConnected,
    isConnecting: wsConnecting, 
    serverUrl: contextServerUrl,
    authToken: contextAuthToken,
    actions: wsActions 
  } = useBackendWebSocket();
  
  const [serverUrl, setServerUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    const loadSavedCredentials = async () => {
      const savedCreds = wsActions.getSavedCredentials();
      
      if (savedCreds.url || savedCreds.token) {
        setServerUrl(savedCreds.url || '');
        setAuthToken(savedCreds.token || '');
        setShowSavedIndicator(true);
        // console.log('💾 Loaded saved credentials into form');
      } else {
        // Use environment variables as fallback
        setServerUrl(process.env.REACT_APP_WS_URL || 'wss://your-websocket-server.com/ws');
        setAuthToken(process.env.REACT_APP_WS_TOKEN || 'your-token-here');
      }
    };

    loadSavedCredentials();
  }, [wsActions]);

  // Also update from context if credentials are loaded there
  useEffect(() => {
    if (contextServerUrl && contextAuthToken) {
      setServerUrl(contextServerUrl);
      setAuthToken(contextAuthToken);
    }
  }, [contextServerUrl, contextAuthToken]);
  const handleConnect = async () => {
    if (!isConnected) {
      // First connect to backend
      wsActions.connectToBackend();
      return;
    }

    if (caitlynConnected) {
      // Disconnect from Caitlyn
      wsActions.disconnectFromCaitlyn();
      return;
    }

    if (!serverUrl) {
      alert('Server URL is required');
      return;
    }

    try {
      console.log('Attempting to connect to Caitlyn via backend:', serverUrl);
      console.log('Using token:', authToken);
      
      // Connect to Caitlyn through backend
      await wsActions.connectToCaitlyn(serverUrl, authToken);
      
    } catch (error) {
      console.error('Connection failed:', error);
      alert(`Connection failed: ${error.message}`);
    }
  };

  const handleClearLogs = () => {
    console.clear();
    alert('Console cleared');
  };

  const handleClearCredentials = () => {
    const success = wsActions.clearStoredCredentials();
    if (success) {
      setShowSavedIndicator(false);
      // Reset to environment defaults
      setServerUrl(process.env.REACT_APP_WS_URL || 'wss://your-websocket-server.com/ws');
      setAuthToken(process.env.REACT_APP_WS_TOKEN || 'your-token-here');
      alert('✅ Stored credentials cleared');
    } else {
      alert('❌ Failed to clear credentials');
    }
  };

  return (
    <ControlsSection>
      {showSavedIndicator && (
        <CredentialInfo>
          💾 Using saved credentials
          <ClearButton onClick={handleClearCredentials}>
            Clear Saved
          </ClearButton>
        </CredentialInfo>
      )}
      
      <ControlGroup>
        <Label htmlFor="server-url">WebSocket Server:</Label>
        <Input
          id="server-url"
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="ws://localhost:3009/ws/"
        />
      </ControlGroup>
      
      <ControlGroup>
        <Label htmlFor="auth-token">Auth Token:</Label>
        <Input
          id="auth-token"
          type="text"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
          placeholder="Enter auth token"
        />
      </ControlGroup>
      
      <ButtonGroup>
        <Button 
          className="primary" 
          onClick={handleConnect}
          disabled={wsConnecting}
        >
          {!isConnected ? 'Connect to Backend' : 
           caitlynConnected ? 'Disconnect from Caitlyn' : 
           (wsConnecting ? 'Connecting...' : 'Connect to Caitlyn')}
        </Button>
        <Button 
          className="secondary" 
          onClick={handleClearLogs}
        >
          Clear Console
        </Button>
      </ButtonGroup>
    </ControlsSection>
  );
}

export default ConnectionControls;