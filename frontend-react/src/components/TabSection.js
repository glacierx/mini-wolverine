import React, { useState } from 'react';
import styled from 'styled-components';
import { useData } from '../contexts/DataContext';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';
import HistoricalDataQuery from './HistoricalDataQuery';
import SchemaViewer from './SchemaViewer';

const Container = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  overflow: hidden;
`;

const TabNav = styled.nav`
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
`;

const TabButton = styled.button`
  padding: 16px 24px;
  border: none;
  background: transparent;
  color: #6c757d;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &.active {
    color: #0066cc;
    background: white;
    border-bottom: 2px solid #0066cc;
  }
  
  &:hover:not(.active) {
    color: #495057;
  }
`;

const TabContent = styled.div`
  padding: 24px;
  min-height: 400px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const Title = styled.h3`
  margin: 0;
  color: #212529;
  font-size: 18px;
  font-weight: 600;
`;

const SimpleButton = styled.button`
  background: #0066cc;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #0052a3;
  }
  
  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`;

const ContentBox = styled.div`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  max-height: 500px;
  overflow-y: auto;
`;

const EmptyState = styled.div`
  text-align: center;
  color: #6c757d;
  padding: 60px 20px;
  font-size: 14px;
`;


// Console Components
const LogEntry = styled.div`
  padding: 8px 16px;
  border-bottom: 1px solid #f1f3f4;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 13px;
  
  &:last-child { border-bottom: none; }
`;

const LogTime = styled.span`
  color: #6c757d;
  margin-right: 12px;
`;

const LogLevel = styled.span`
  font-weight: 600;
  margin-right: 12px;
  
  &.error { color: #dc3545; }
  &.success { color: #28a745; }
  &.warning { color: #ffc107; }
  &.info { color: #17a2b8; }
`;

function TabSection() {
  const [activeTab, setActiveTab] = useState('schema');
  const { logs } = useData();

  const tabs = [
    { id: 'schema', label: 'Schema & Revisions' },
    { id: 'historical', label: 'Historical Data' },
    { id: 'console', label: 'Console' }
  ];

  const renderSchema = () => (
    <div>
      <SectionHeader>
        <Title>Schema Definitions</Title>
      </SectionHeader>
      <SchemaViewer />
    </div>
  );

  const renderHistorical = () => (
    <div>
      <SectionHeader>
        <Title>Historical Data Query</Title>
      </SectionHeader>
      <HistoricalDataQuery />
    </div>
  );

  const renderConsole = () => (
    <div>
      <SectionHeader>
        <Title>Application Console</Title>
        <SimpleButton onClick={() => window.location.reload()}>
          Clear
        </SimpleButton>
      </SectionHeader>
      
      <ContentBox>
        {logs && logs.length > 0 ? (
          logs.slice(-50).map((log, index) => (
            <LogEntry key={index}>
              <LogTime>{new Date(log.timestamp).toLocaleTimeString()}</LogTime>
              <LogLevel className={log.level}>{log.level.toUpperCase()}</LogLevel>
              <span>{log.message}</span>
              {log.data && (
                <div style={{ marginTop: '4px', opacity: 0.7, fontSize: '12px' }}>
                  {typeof log.data === 'string' ? log.data : JSON.stringify(log.data)}
                </div>
              )}
            </LogEntry>
          ))
        ) : (
          <EmptyState>
            No logs yet.<br />
            Connect to backend to see application logs.
          </EmptyState>
        )}
      </ContentBox>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'schema': return renderSchema();
      case 'historical': return renderHistorical();
      case 'console': return renderConsole();
      default: return <EmptyState>Select a tab</EmptyState>;
    }
  };

  return (
    <Container>
      <TabNav>
        {tabs.map(tab => (
          <TabButton
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </TabNav>
      
      <TabContent>
        {renderTabContent()}
      </TabContent>
    </Container>
  );
}

export default TabSection;