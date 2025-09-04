import React from 'react';
import styled from 'styled-components';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';

const Container = styled.div`
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  margin-bottom: 20px;
`;

const ConnectionRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const ConnectionInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const StatusDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$connected ? '#28a745' : '#dc3545'};
`;

const ConnectionText = styled.div`
  font-size: 14px;
  color: #212529;
  font-weight: 500;
`;

const ConnectionStatus = styled.div`
  font-size: 12px;
  color: #6c757d;
`;

const Button = styled.button`
  background: ${props => props.$variant === 'danger' ? '#dc3545' : '#0066cc'};
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover:not(:disabled) {
    background: ${props => props.$variant === 'danger' ? '#c82333' : '#0052a3'};
  }
  
  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`;

function ConnectionControls() {
  const { 
    isConnected, 
    caitlynConnected, 
    isConnecting,
    error,
    actions 
  } = useBackendWebSocket();

  const getConnectionStatus = () => {
    if (error) return 'Connection Error';
    if (isConnecting) return 'Connecting...';
    if (!isConnected) return 'Backend Disconnected';
    if (!caitlynConnected) return 'Caitlyn Disconnected';
    return 'Connected & Ready';
  };

  const getConnectionDetails = () => {
    if (error) return error;
    if (isConnecting) return 'Establishing connection to backend';
    if (!isConnected) return 'Not connected to backend WebSocket';
    if (!caitlynConnected) return 'Backend connected, waiting for Caitlyn server';
    return 'Connected to backend and Caitlyn server';
  };

  const handleAction = () => {
    if (!isConnected) {
      actions.connectToBackend();
    } else if (isConnected && !caitlynConnected) {
      // Auto-connect with default credentials or show message
      console.log('Backend is ready, Caitlyn connection should initialize automatically');
    } else {
      actions.disconnectFromBackend();
    }
  };

  const getButtonText = () => {
    if (!isConnected) return 'Connect';
    if (isConnected && !caitlynConnected) return 'Connecting...';
    return 'Disconnect';
  };

  return (
    <Container>
      <ConnectionRow>
        <ConnectionInfo>
          <StatusDot $connected={isConnected && caitlynConnected} />
          <div>
            <ConnectionText>{getConnectionStatus()}</ConnectionText>
            <ConnectionStatus>{getConnectionDetails()}</ConnectionStatus>
          </div>
        </ConnectionInfo>
        
        <Button
          onClick={handleAction}
          disabled={isConnecting}
          $variant={isConnected && caitlynConnected ? 'danger' : 'primary'}
        >
          {getButtonText()}
        </Button>
      </ConnectionRow>
    </Container>
  );
}

export default ConnectionControls;