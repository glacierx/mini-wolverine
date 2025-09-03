import React, { useState } from 'react';
import styled from 'styled-components';
import { useData } from '../contexts/DataContext';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';

const TabsContainer = styled.section`
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
  overflow: hidden;
  margin-bottom: 20px;
`;

const TabButtons = styled.div`
  display: flex;
  background: #f8f9fa;
  border-bottom: 1px solid var(--border-color);
  overflow-x: auto;
`;

const TabButton = styled.button`
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-weight: 600;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.3s ease;
  white-space: nowrap;
  
  &.active {
    color: var(--secondary-color);
    border-bottom-color: var(--secondary-color);
    background: var(--card-background);
  }
  
  &:hover:not(.active) {
    color: var(--text-color);
    background: rgba(52, 152, 219, 0.1);
  }
`;

const TabContent = styled.div`
  min-height: 400px;
`;

const TabPanel = styled.div`
  padding: 20px;
  display: ${props => props.$active ? 'block' : 'none'};
`;

const PanelHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const PanelTitle = styled.h3`
  margin: 0;
  color: var(--primary-color);
  font-size: 18px;
  font-weight: 600;
`;

const EmptyState = styled.div`
  text-align: center;
  color: var(--text-muted);
  padding: 40px 20px;
  font-style: italic;
`;

const PlaceholderContent = styled.div`
  padding: 20px;
  background: #f8f9fa;
  border: 1px dashed var(--border-color);
  border-radius: var(--border-radius);
  text-align: center;
  color: var(--text-muted);
`;

const SchemaContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
  background: #f8f9fa;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
`;

const SchemaNamespace = styled.div`
  border-bottom: 1px solid var(--border-color);
  
  &:last-child {
    border-bottom: none;
  }
`;

const SchemaHeader = styled.div`
  padding: 12px 16px;
  background: var(--primary-color);
  color: white;
  font-weight: 600;
  cursor: pointer;
  
  &:hover {
    background: #2980b9;
  }
`;

const SchemaItems = styled.div`
  padding: 0;
`;

const SchemaItem = styled.div`
  padding: 8px 24px;
  border-bottom: 1px solid #e9ecef;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: #f1f3f4;
  }
`;

const MessageContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
  background: #f8f9fa;
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  font-family: 'Courier New', monospace;
  font-size: 12px;
`;

const Message = styled.div`
  padding: 8px 12px;
  border-bottom: 1px solid #e9ecef;
  
  &:last-child {
    border-bottom: none;
  }
  
  &:hover {
    background: #f1f3f4;
  }
`;

const MessageTime = styled.span`
  color: var(--text-muted);
  margin-right: 10px;
`;

const MessageType = styled.span`
  color: var(--secondary-color);
  font-weight: 600;
  margin-right: 10px;
`;

function TabSection() {
  const [activeTab, setActiveTab] = useState('console');
  const [expandedNamespaces, setExpandedNamespaces] = useState(new Set());
  const { schema, marketData, logs, rawMessages } = useData();
  const { isConnected, caitlynConnected } = useBackendWebSocket();

  const toggleNamespace = (namespace) => {
    const newExpanded = new Set(expandedNamespaces);
    if (newExpanded.has(namespace)) {
      newExpanded.delete(namespace);
    } else {
      newExpanded.add(namespace);
    }
    setExpandedNamespaces(newExpanded);
  };

  const tabs = [
    { id: 'console', label: 'Console' },
    { id: 'schema', label: 'Schema' },
    { id: 'data', label: 'Market Data' },
    { id: 'historical', label: 'Historical Data' },
    { id: 'raw', label: 'Raw Messages' }
  ];

  const renderTabContent = (tabId) => {
    switch (tabId) {
      case 'console':
        return (
          <div>
            <PanelHeader>
              <PanelTitle>📝 Application Console</PanelTitle>
              <button className="btn btn-mini btn-secondary">Export Logs</button>
            </PanelHeader>
            {logs && logs.length > 0 ? (
              <MessageContainer>
                {logs.map((log, index) => (
                  <Message key={index}>
                    <MessageTime>{new Date(log.timestamp).toLocaleTimeString()}</MessageTime>
                    <MessageType style={{color: 
                      log.level === 'error' ? '#e74c3c' :
                      log.level === 'success' ? '#27ae60' :
                      log.level === 'warning' ? '#f39c12' : '#3498db'
                    }}>
                      {log.level.toUpperCase()}
                    </MessageType>
                    <div style={{ marginTop: '4px' }}>
                      {log.message}
                      {log.data && (
                        <div style={{ marginTop: '2px', fontSize: '11px', color: '#666' }}>
                          {typeof log.data === 'string' ? log.data : JSON.stringify(log.data)}
                        </div>
                      )}
                    </div>
                  </Message>
                ))}
              </MessageContainer>
            ) : (
              <EmptyState>
                No logs yet. Connect to backend and Caitlyn server to see application logs.
              </EmptyState>
            )}
          </div>
        );
        
      case 'schema':
        return (
          <div>
            <PanelHeader>
              <PanelTitle>🏗️ Data Schema</PanelTitle>
              <button className="btn btn-mini btn-secondary">Refresh</button>
            </PanelHeader>
            {schema && Object.keys(schema).length > 0 ? (
              <SchemaContainer>
                {Object.keys(schema).map(namespaceKey => {
                  const namespaceData = schema[namespaceKey];
                  const namespaceName = namespaceKey === '0' ? 'Global' : namespaceKey === '1' ? 'Private' : `Namespace ${namespaceKey}`;
                  const isExpanded = expandedNamespaces.has(namespaceKey);
                  
                  return (
                    <SchemaNamespace key={namespaceKey}>
                      <SchemaHeader onClick={() => toggleNamespace(namespaceKey)}>
                        {isExpanded ? '▼' : '▶'} {namespaceName} ({Object.keys(namespaceData).length} definitions)
                      </SchemaHeader>
                      {isExpanded && (
                        <SchemaItems>
                          {Object.keys(namespaceData).map(metaId => {
                            const metadata = namespaceData[metaId];
                            return (
                              <SchemaItem key={metaId}>
                                <strong>ID {metaId}:</strong> {metadata.name || 'Unnamed'} 
                                {metadata.description && ` - ${metadata.description}`}
                              </SchemaItem>
                            );
                          })}
                        </SchemaItems>
                      )}
                    </SchemaNamespace>
                  );
                })}
              </SchemaContainer>
            ) : (
              <EmptyState>
                No schema loaded. Connect to server to load schema definitions.
              </EmptyState>
            )}
          </div>
        );
        
      case 'data':
        return (
          <div>
            <PanelHeader>
              <PanelTitle>📈 Market Data</PanelTitle>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                  <option value="">All Namespaces</option>
                </select>
                <button className="btn btn-mini btn-secondary">Export Data</button>
              </div>
            </PanelHeader>
            <EmptyState>
              No market data available. Establish connection and request data.
            </EmptyState>
          </div>
        );
        
      case 'historical':
        return (
          <div>
            <PanelHeader>
              <PanelTitle>📊 Historical Data</PanelTitle>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <select style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                  <option value="table">Table View</option>
                  <option value="chart">Chart View</option>
                </select>
                <button className="btn btn-mini btn-secondary">Export Data</button>
              </div>
            </PanelHeader>
            <PlaceholderContent>
              <p><strong>Historical Data Visualization Placeholder</strong></p>
              <p>This section will display historical market data in table and chart formats.</p>
              <p>Use the Historical Data controls in the Actions section to fetch data.</p>
            </PlaceholderContent>
          </div>
        );
        
      case 'raw':
        return (
          <div>
            <PanelHeader>
              <PanelTitle>🔍 Raw Messages</PanelTitle>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input type="checkbox" defaultChecked />
                  Auto-scroll
                </label>
                <button className="btn btn-mini btn-secondary">Export</button>
              </div>
            </PanelHeader>
            {rawMessages && rawMessages.length > 0 ? (
              <MessageContainer>
                {rawMessages.map((message, index) => (
                  <Message key={index}>
                    <MessageTime>{new Date(message.timestamp).toLocaleTimeString()}</MessageTime>
                    <MessageType>{message.type}</MessageType>
                    <div style={{ marginTop: '4px', color: '#666' }}>
                      {typeof message.data === 'string' ? message.data : JSON.stringify(message.data, null, 2)}
                    </div>
                  </Message>
                ))}
              </MessageContainer>
            ) : (
              <EmptyState>
                No raw messages captured yet. {caitlynConnected ? 'Messages will appear here once data starts flowing.' : 'Connect to Caitlyn server to see messages.'}
              </EmptyState>
            )}
          </div>
        );
        
      default:
        return <EmptyState>Tab content not implemented</EmptyState>;
    }
  };

  return (
    <TabsContainer>
      <TabButtons>
        {tabs.map(tab => (
          <TabButton
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </TabButtons>
      
      <TabContent>
        {tabs.map(tab => (
          <TabPanel key={tab.id} $active={activeTab === tab.id}>
            {renderTabContent(tab.id)}
          </TabPanel>
        ))}
      </TabContent>
    </TabsContainer>
  );
}

export default TabSection;