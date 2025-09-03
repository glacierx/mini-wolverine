import React from 'react';
import styled from 'styled-components';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';
import { useData } from '../contexts/DataContext';

const StatusContainer = styled.section`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const StatusCard = styled.div`
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  padding: 20px;
`;

const CardTitle = styled.h3`
  margin: 0 0 15px 0;
  color: var(--primary-color);
  font-size: 18px;
  font-weight: 600;
`;

const StatusItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const StatusLabel = styled.span`
  color: var(--text-color);
  font-weight: 600;
`;

const StatusValue = styled.span`
  &.status-loading { color: var(--warning-color); }
  &.status-loaded { color: var(--success-color); }
  &.status-error { color: var(--error-color); }
  &.status-connected { color: var(--success-color); }
  &.status-connecting { color: var(--warning-color); }
  &.status-disconnected { color: var(--text-muted); }
  &.status-active { color: var(--success-color); }
  &.status-inactive { color: var(--text-muted); }
  &.status-not-loaded { color: var(--text-muted); }
`;

function StatusSection() {
  const { isConnected, caitlynConnected, isConnecting, stats } = useBackendWebSocket();
  const { isSchemaLoaded, dataCount, schema } = useData();

  const getBackendStatus = () => {
    if (isConnecting) return { text: 'Connecting...', className: 'status-connecting' };
    if (isConnected) return { text: 'Connected', className: 'status-connected' };
    return { text: 'Disconnected', className: 'status-disconnected' };
  };

  const getCaitlynStatus = () => {
    if (!isConnected) return { text: 'Backend Offline', className: 'status-inactive' };
    if (caitlynConnected) return { text: 'Connected', className: 'status-connected' };
    return { text: 'Disconnected', className: 'status-disconnected' };
  };

  const getSchemaStatus = () => {
    if (isSchemaLoaded) return { text: 'Loaded', className: 'status-loaded' };
    return { text: 'Not Loaded', className: 'status-not-loaded' };
  };

  const backendStatus = getBackendStatus();
  const caitlynStatus = getCaitlynStatus();
  const schemaStatus = getSchemaStatus();

  return (
    <StatusContainer>
      <StatusCard>
        <CardTitle>🔧 System Status</CardTitle>
        <StatusItem>
          <StatusLabel>Backend:</StatusLabel>
          <StatusValue className={backendStatus.className}>
            {backendStatus.text}
          </StatusValue>
        </StatusItem>
        <StatusItem>
          <StatusLabel>Caitlyn Server:</StatusLabel>
          <StatusValue className={caitlynStatus.className}>
            {caitlynStatus.text}
          </StatusValue>
        </StatusItem>
        <StatusItem>
          <StatusLabel>Schema:</StatusLabel>
          <StatusValue className={schemaStatus.className}>
            {schemaStatus.text}
          </StatusValue>
        </StatusItem>
        <StatusItem>
          <StatusLabel>Data Processor:</StatusLabel>
          <StatusValue className={isSchemaLoaded && caitlynConnected ? 'status-active' : 'status-inactive'}>
            {isSchemaLoaded && caitlynConnected ? 'Active' : 'Inactive'}
          </StatusValue>
        </StatusItem>
      </StatusCard>

      <StatusCard>
        <CardTitle>📊 Statistics</CardTitle>
        <StatusItem>
          <StatusLabel>Messages Received:</StatusLabel>
          <StatusValue>{stats.messagesReceived?.toLocaleString() || 0}</StatusValue>
        </StatusItem>
        <StatusItem>
          <StatusLabel>Schema Objects:</StatusLabel>
          <StatusValue>
            {schema ? Object.values(schema).reduce((total, namespace) => 
              total + Object.keys(namespace).length, 0) : 0}
          </StatusValue>
        </StatusItem>
        <StatusItem>
          <StatusLabel>Market Data:</StatusLabel>
          <StatusValue>{dataCount?.toLocaleString() || 0}</StatusValue>
        </StatusItem>
        <StatusItem>
          <StatusLabel>Errors:</StatusLabel>
          <StatusValue>{stats.errors || 0}</StatusValue>
        </StatusItem>
      </StatusCard>
    </StatusContainer>
  );
}

export default StatusSection;