import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useData } from '../contexts/DataContext';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const QueryForm = styled.div`
  background: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #dee2e6;
`;

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 500;
  color: #495057;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
  font-size: 14px;
  color: #495057;
  
  &:focus {
    border-color: #0066cc;
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
  }
`;

const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    border-color: #0066cc;
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
  }
`;

const QueryButton = styled.button`
  background: #0066cc;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover:not(:disabled) {
    background: #0052a3;
  }
  
  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
`;

const ResultsContainer = styled.div`
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
`;

const ResultsHeader = styled.div`
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ResultsTitle = styled.h4`
  margin: 0;
  color: #212529;
  font-size: 16px;
  font-weight: 600;
`;

const ViewToggle = styled.div`
  display: flex;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
`;

const ViewButton = styled.button`
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: #6c757d;
  font-size: 12px;
  cursor: pointer;
  
  &.active {
    background: #0066cc;
    color: white;
  }
`;

const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  
  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid #f1f3f4;
  }
  
  th {
    background: #f8f9fa;
    font-weight: 600;
    color: #495057;
    position: sticky;
    top: 0;
  }
  
  tbody tr:hover {
    background: #f8f9fa;
  }
`;

const TableContainer = styled.div`
  max-height: 400px;
  overflow: auto;
`;

const EmptyState = styled.div`
  padding: 40px 20px;
  text-align: center;
  color: #6c757d;
  font-size: 14px;
`;

const StatusInfo = styled.div`
  font-size: 12px;
  color: #6c757d;
  margin-top: 8px;
`;

function HistoricalDataQuery() {
  const [market, setMarket] = useState('');
  const [security, setSecurity] = useState('');
  const [revision, setRevision] = useState('');
  const [granularity, setGranularity] = useState('900');
  const [lookbackDays, setLookbackDays] = useState('1');
  const [viewMode, setViewMode] = useState('table');
  const [isLoading, setIsLoading] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  
  const { schema, marketData, securities } = useData();
  const { isConnected, caitlynConnected, actions } = useBackendWebSocket();

  const granularityOptions = [
    { value: '60', label: '1 Minute' },
    { value: '300', label: '5 Minutes' },
    { value: '900', label: '15 Minutes' },
    { value: '3600', label: '1 Hour' },
    { value: '86400', label: '1 Day' }
  ];

  const getAvailableRevisions = () => {
    if (!schema) return [];
    const revisions = new Set();
    Object.values(schema).forEach(namespace => {
      Object.values(namespace).forEach(meta => {
        if (meta.revision !== undefined) {
          revisions.add(meta.revision);
        }
      });
    });
    return Array.from(revisions).sort((a, b) => a - b);
  };

  const getMarkets = () => {
    if (!marketData?.global) return [];
    return Object.keys(marketData.global);
  };

  const getSecurities = () => {
    if (!securities || !market || !securities[market]) return [];
    return securities[market] || [];
  };

  useEffect(() => {
    const handleHistoricalDataEvent = (event) => {
      const { success, data, totalCount, error } = event.detail;
      setIsLoading(false);
      
      if (success) {
        setQueryResult({
          data: data || [],
          totalCount: totalCount || 0,
          timestamp: new Date().toISOString()
        });
      } else {
        setQueryResult({
          error: error || 'Query failed',
          timestamp: new Date().toISOString()
        });
      }
    };

    window.addEventListener('historicalDataReceived', handleHistoricalDataEvent);
    return () => {
      window.removeEventListener('historicalDataReceived', handleHistoricalDataEvent);
    };
  }, []);

  const handleQuery = () => {
    if (!market || !security || !revision) return;
    
    setIsLoading(true);
    setQueryResult(null);
    
    const queryParams = {
      market,
      code: security,
      revision: parseInt(revision),
      namespace: 0, // Global namespace
      metaName: 'SampleQuote', // Default to price data
      granularity: parseInt(granularity),
      lookbackDays: parseInt(lookbackDays)
    };

    actions.requestHistoricalData(queryParams);
  };

  const renderDataTable = () => {
    if (!queryResult || !queryResult.data || queryResult.data.length === 0) {
      return <EmptyState>No data available</EmptyState>;
    }

    const data = queryResult.data;
    const columns = data.length > 0 ? Object.keys(data[0]) : [];

    return (
      <TableContainer>
        <DataTable>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((row, idx) => (
              <tr key={idx}>
                {columns.map(col => (
                  <td key={col}>
                    {typeof row[col] === 'number' ? 
                      row[col].toLocaleString() : 
                      String(row[col] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableContainer>
    );
  };

  const canQuery = isConnected && caitlynConnected && market && security && revision && !isLoading;
  const availableRevisions = getAvailableRevisions();
  const markets = getMarkets();
  const securitiesList = getSecurities();

  return (
    <Container>
      <QueryForm>
        <FormGrid>
          <FormGroup>
            <Label>Market</Label>
            <Select 
              value={market} 
              onChange={(e) => {
                setMarket(e.target.value);
                setSecurity(''); // Reset security when market changes
              }}
            >
              <option value="">Select Market</option>
              {markets.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
          </FormGroup>
          
          <FormGroup>
            <Label>Security</Label>
            <Select 
              value={security} 
              onChange={(e) => setSecurity(e.target.value)}
              disabled={!market}
            >
              <option value="">Select Security</option>
              {securitiesList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </FormGroup>
          
          <FormGroup>
            <Label>Revision</Label>
            <Select 
              value={revision} 
              onChange={(e) => setRevision(e.target.value)}
            >
              <option value="">Select Revision</option>
              {availableRevisions.map(rev => (
                <option key={rev} value={rev}>Revision {rev}</option>
              ))}
            </Select>
          </FormGroup>
          
          <FormGroup>
            <Label>Timeframe</Label>
            <Select 
              value={granularity} 
              onChange={(e) => setGranularity(e.target.value)}
            >
              {granularityOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </FormGroup>
          
          <FormGroup>
            <Label>Lookback (Days)</Label>
            <Input 
              type="number" 
              min="1" 
              max="30" 
              value={lookbackDays}
              onChange={(e) => setLookbackDays(e.target.value)}
            />
          </FormGroup>
          
          <FormGroup>
            <Label>&nbsp;</Label>
            <QueryButton 
              onClick={handleQuery} 
              disabled={!canQuery}
            >
              {isLoading ? 'Querying...' : 'Query Data'}
            </QueryButton>
          </FormGroup>
        </FormGrid>
        
        <StatusInfo>
          {!isConnected && "Backend not connected"}
          {isConnected && !caitlynConnected && "Caitlyn server not connected"}
          {isConnected && caitlynConnected && `Ready • ${markets.length} markets • ${availableRevisions.length} revisions`}
        </StatusInfo>
      </QueryForm>

      {(queryResult || isLoading) && (
        <ResultsContainer>
          <ResultsHeader>
            <ResultsTitle>
              Query Results
              {queryResult && !queryResult.error && (
                <span style={{ fontWeight: 400, marginLeft: '8px', color: '#6c757d' }}>
                  ({queryResult.totalCount} records)
                </span>
              )}
            </ResultsTitle>
            
            {queryResult && !queryResult.error && (
              <ViewToggle>
                <ViewButton 
                  className={viewMode === 'table' ? 'active' : ''}
                  onClick={() => setViewMode('table')}
                >
                  Table
                </ViewButton>
                <ViewButton 
                  className={viewMode === 'chart' ? 'active' : ''}
                  onClick={() => setViewMode('chart')}
                >
                  Chart
                </ViewButton>
              </ViewToggle>
            )}
          </ResultsHeader>
          
          {isLoading && (
            <EmptyState>Loading historical data...</EmptyState>
          )}
          
          {queryResult && queryResult.error && (
            <EmptyState>
              Error: {queryResult.error}
            </EmptyState>
          )}
          
          {queryResult && !queryResult.error && viewMode === 'table' && renderDataTable()}
          
          {queryResult && !queryResult.error && viewMode === 'chart' && (
            <EmptyState>
              Chart view coming soon...
            </EmptyState>
          )}
        </ResultsContainer>
      )}
    </Container>
  );
}

export default HistoricalDataQuery;