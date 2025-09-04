import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';
import { useData } from '../contexts/DataContext';

const QueryContainer = styled.div`
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 20px;
  margin-bottom: 20px;
`;

const QueryForm = styled.form`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const Label = styled.label`
  font-weight: 600;
  color: var(--text-color);
  font-size: 12px;
  text-transform: uppercase;
`;

const Select = styled.select`
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: white;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const Input = styled.input`
  padding: 8px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: var(--secondary-color);
    box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
  }
`;

const QueryButton = styled.button`
  padding: 10px 20px;
  background: var(--secondary-color);
  color: white;
  border: none;
  border-radius: 4px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  
  &:hover:not(:disabled) {
    background: #2980b9;
  }
  
  &:disabled {
    background: #bdc3c7;
    cursor: not-allowed;
  }
`;

const ResultsContainer = styled.div`
  margin-top: 20px;
`;

const ResultsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
`;

const ResultsTitle = styled.h3`
  margin: 0;
  color: var(--primary-color);
`;

const ResultsInfo = styled.div`
  color: var(--text-muted);
  font-size: 14px;
`;

const DataGrid = styled.div`
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: 4px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
`;

const TableHeader = styled.th`
  background: #f8f9fa;
  padding: 10px;
  text-align: left;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
  color: var(--text-color);
  white-space: nowrap;
`;

const TableCell = styled.td`
  padding: 8px 10px;
  border-bottom: 1px solid #f0f0f0;
  color: var(--text-color);
  
  &:last-child {
    border-bottom: none;
  }
`;

const TableRow = styled.tr`
  &:nth-child(even) {
    background: #f9f9f9;
  }
  
  &:hover {
    background: #e3f2fd;
  }
`;

const Pagination = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-top: 1px solid var(--border-color);
`;

const PaginationButton = styled.button`
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  background: white;
  cursor: pointer;
  border-radius: 4px;
  margin: 0 2px;
  
  &:hover:not(:disabled) {
    background: #e3f2fd;
  }
  
  &:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  &.active {
    background: var(--secondary-color);
    color: white;
    border-color: var(--secondary-color);
  }
`;

const ErrorMessage = styled.div`
  background: #ffebee;
  color: #c62828;
  padding: 10px;
  border-radius: 4px;
  border: 1px solid #ffcdd2;
  margin-bottom: 15px;
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
`;

const FieldSelectionContainer = styled.div`
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 15px;
  background: #f8f9fa;
`;

const FieldSelectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const FieldSelectionTitle = styled.h4`
  margin: 0;
  color: var(--primary-color);
  font-size: 14px;
`;

const FieldSelectionActions = styled.div`
  display: flex;
  gap: 10px;
`;

const FieldActionButton = styled.button`
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  background: white;
  color: var(--text-color);
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  
  &:hover {
    background: var(--secondary-color);
    color: white;
  }
`;

const FieldCheckboxGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px;
  max-height: 120px;
  overflow-y: auto;
`;

const FieldCheckboxItem = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  
  &:hover {
    background: #f0f0f0;
  }
  
  input[type="checkbox"] {
    margin: 0;
  }
`;

const FieldLabel = styled.span`
  color: var(--text-color);
  flex: 1;
`;

const FieldType = styled.span`
  color: var(--text-muted);
  font-size: 10px;
  font-style: italic;
`;

function HistoricalDataQuery() {
  const { sendMessage, isConnected } = useBackendWebSocket();
  const { schema } = useData(); // Get schema from DataContext
  
  // Form state
  const [selectedMarket, setSelectedMarket] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('0'); // Default to Global (0)
  const [selectedMetaId, setSelectedMetaId] = useState(''); // Selected metadata ID
  const [selectedFields, setSelectedFields] = useState([]); // Selected field indices
  const [granularity, setGranularity] = useState('60'); // Default 1 hour
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to 7 days ago
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [pageSize, setPageSize] = useState(50);
  
  // Data state
  const [markets, setMarkets] = useState([]);
  const [futuresForMarket, setFuturesForMarket] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Load available markets after connection and schema processing
  useEffect(() => {
    if (isConnected) {
      // Wait a bit for the universe initialization to complete
      const timer = setTimeout(() => {
        loadMarkets();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isConnected]);
  
  // Load futures for selected market
  useEffect(() => {
    if (selectedMarket) {
      loadFuturesForMarket(selectedMarket);
      setSelectedCode(''); // Reset code selection when market changes
    }
  }, [selectedMarket]);

  // Listen for historical data response from backend
  useEffect(() => {
    const handleHistoricalDataReceived = (event) => {
      const { success, data, totalCount, error, requestId } = event.detail;
      
      if (success) {
        setHistoricalData(data || []);
        setTotalRecords(totalCount || 0);
        setLoading(false);
        setError('');
      } else {
        setError(error || 'Failed to retrieve historical data from backend');
        setLoading(false);
        setHistoricalData([]);
        setTotalRecords(0);
      }
    };

    window.addEventListener('historicalDataReceived', handleHistoricalDataReceived);
    
    return () => {
      window.removeEventListener('historicalDataReceived', handleHistoricalDataReceived);
    };
  }, []);

  // Update available fields when metadata ID changes
  useEffect(() => {
    if (selectedMetaId && schema && schema[selectedNamespace] && schema[selectedNamespace][selectedMetaId]) {
      const meta = schema[selectedNamespace][selectedMetaId];
      const defaultFields = meta.fields ? meta.fields.slice(0, 4).map((_, index) => index) : [];
      setSelectedFields(defaultFields);
    } else {
      setSelectedFields([]);
    }
  }, [selectedMetaId, selectedNamespace, schema]);
  
  // Listen for WebSocket messages to refresh markets when universe seeds are processed
  useEffect(() => {
    // This is a simple polling approach - in a real app you'd listen to WebSocket events
    if (isConnected) {
      const pollForMarkets = setInterval(() => {
        loadMarkets();
      }, 10000); // Check every 10 seconds
      
      return () => clearInterval(pollForMarkets);
    }
  }, [isConnected]);
  
  const loadMarkets = async () => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/futures/markets`);
    const marketsData = await response.json();
    setMarkets(marketsData);
  };
  
  const loadFuturesForMarket = async (market) => {
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';
    const response = await fetch(`${backendUrl}/api/futures/${market}`);
    const futuresData = await response.json();
    setFuturesForMarket(futuresData);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedNamespace || !selectedMetaId) {
      setError('Please select both namespace and metadata type');
      return;
    }
    
    if (selectedFields.length === 0) {
      setError('Please select at least one field to display');
      return;
    }
    
    if (!selectedMarket || !selectedCode) {
      setError('Please select both market and code');
      return;
    }
    
    setLoading(true);
    setError('');
    setHistoricalData([]);
    setCurrentPage(1);
    
    // Get the selected metadata definition
    const selectedMeta = schema[selectedNamespace][selectedMetaId];
    if (!selectedMeta) {
      setError('Selected metadata not found in schema');
      setLoading(false);
      return;
    }
    
    // Find the selected futures contract to get additional info
    const selectedFuture = futuresForMarket.find(f => f.code === selectedCode);
    if (!selectedFuture) {
      setError('Selected security/contract not found');
      setLoading(false);
      return;
    }
    
    // Convert dates to timestamps
    const startTime = new Date(startDate + 'T00:00:00Z').getTime();
    const endTime = new Date(endDate + 'T23:59:59Z').getTime();
    
    // Get selected field names for the query
    const selectedFieldNames = selectedFields.map(fieldIndex => {
      const field = availableFields.find(f => f.index === fieldIndex);
      return field ? field.name : `field_${fieldIndex}`;
    });
    
    // Send query request via WebSocket
    const queryParams = {
      market: selectedMarket,
      code: selectedCode,
      namespace: parseInt(selectedNamespace),
      metaID: parseInt(selectedMetaId),
      metaName: selectedMeta.name,
      granularity: parseInt(granularity),
      startTime,
      endTime,
      fields: selectedFieldNames,
      fieldIndices: selectedFields,
      limit: pageSize * 10 // Request more data for pagination
    };
    
    // Add request ID for tracking
    const requestId = Date.now();
    queryParams.requestId = requestId;
    
    sendMessage({
      type: 'query_historical_data',
      params: queryParams,
      requestId: requestId
    });
  };
  
  
  // Pagination logic
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return historicalData.slice(startIndex, startIndex + pageSize);
  }, [historicalData, currentPage, pageSize]);
  
  const totalPages = Math.ceil(totalRecords / pageSize);
  
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleFieldToggle = (fieldIndex) => {
    setSelectedFields(prev => {
      if (prev.includes(fieldIndex)) {
        return prev.filter(f => f !== fieldIndex);
      } else {
        return [...prev, fieldIndex];
      }
    });
  };

  const handleSelectAllFields = () => {
    setSelectedFields(availableFields.map(field => field.index));
  };

  const handleClearAllFields = () => {
    setSelectedFields([]);
  };
  
  const granularityOptions = [
    { value: '1', label: '1 minute' },
    { value: '5', label: '5 minutes' },
    { value: '15', label: '15 minutes' },
    { value: '60', label: '1 hour' },
    { value: '240', label: '4 hours' },
    { value: '1440', label: '1 day' }
  ];

  // Get available namespaces from schema
  const getNamespaceOptions = () => {
    if (!schema) return [];
    return Object.keys(schema).map(namespaceId => ({
      value: namespaceId,
      label: namespaceId === '0' ? 'Global' : namespaceId === '1' ? 'Private' : `Namespace ${namespaceId}`
    }));
  };

  // Get available metadata types for selected namespace
  const getMetadataOptions = () => {
    if (!schema || !selectedNamespace || !schema[selectedNamespace]) return [];
    
    return Object.entries(schema[selectedNamespace]).map(([metaId, meta]) => ({
      value: metaId,
      label: meta.name ? String(meta.name).split('::')[1] || String(meta.name) : `ID ${metaId}`,
      fullName: String(meta.name || `Unnamed (ID: ${metaId})`)
    }));
  };

  // Get available fields for selected metadata
  const getAvailableFields = () => {
    if (!schema || !selectedNamespace || !selectedMetaId || 
        !schema[selectedNamespace] || !schema[selectedNamespace][selectedMetaId]) {
      return [];
    }
    
    const meta = schema[selectedNamespace][selectedMetaId];
    if (!meta.fields) return [];
    
    return meta.fields.map((field, index) => ({
      index: index,
      name: field.name || `Field ${index}`,
      type: typeof field.type === 'object' ? JSON.stringify(field.type) : String(field.type || 'unknown')
    }));
  };

  const namespaceOptions = getNamespaceOptions();
  const metadataOptions = getMetadataOptions(); 
  const availableFields = getAvailableFields();
  
  return (
    <QueryContainer>
      <h3>Historical Data Query by Code</h3>
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
      
      <QueryForm onSubmit={handleSubmit}>
        <FormGroup>
          <Label>Namespace</Label>
          <Select 
            value={selectedNamespace} 
            onChange={(e) => {
              setSelectedNamespace(e.target.value);
              setSelectedMetaId(''); // Reset metadata selection
            }}
            disabled={!isConnected || namespaceOptions.length === 0}
          >
            <option value="">Select Namespace</option>
            {namespaceOptions.map(namespace => (
              <option key={namespace.value} value={namespace.value}>{namespace.label}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Metadata Type</Label>
          <Select 
            value={selectedMetaId} 
            onChange={(e) => setSelectedMetaId(e.target.value)}
            disabled={!selectedNamespace || metadataOptions.length === 0}
          >
            <option value="">Select Metadata</option>
            {metadataOptions.map(meta => (
              <option key={meta.value} value={meta.value} title={meta.fullName}>
                {meta.label}
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup>
          <Label>Market</Label>
          <Select 
            value={selectedMarket} 
            onChange={(e) => setSelectedMarket(e.target.value)}
            disabled={!isConnected}
          >
            <option value="">Select Market</option>
            {[...new Set(markets)].map(market => (
              <option key={market} value={market}>{market}</option>
            ))}
          </Select>
        </FormGroup>
        
        <FormGroup>
          <Label>Futures Code</Label>
          <Select 
            value={selectedCode} 
            onChange={(e) => setSelectedCode(e.target.value)}
            disabled={!selectedMarket || futuresForMarket.length === 0}
          >
            <option value="">Select Code</option>
            {futuresForMarket.map((future, index) => (
              <option key={`${future.code}-${index}`} value={future.code}>
                {future.code} {future.type && `[${future.type}]`} {future.name && `(${future.name})`}
              </option>
            ))}
          </Select>
        </FormGroup>
        
        <FormGroup>
          <Label>Granularity</Label>
          <Select 
            value={granularity} 
            onChange={(e) => setGranularity(e.target.value)}
          >
            {granularityOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </FormGroup>
        
        <FormGroup>
          <Label>Start Date</Label>
          <Input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
          />
        </FormGroup>
        
        <FormGroup>
          <Label>End Date</Label>
          <Input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
          />
        </FormGroup>
        
        <FormGroup>
          <Label>Page Size</Label>
          <Select 
            value={pageSize} 
            onChange={(e) => setPageSize(parseInt(e.target.value))}
          >
            <option value="25">25 records</option>
            <option value="50">50 records</option>
            <option value="100">100 records</option>
            <option value="200">200 records</option>
          </Select>
        </FormGroup>
        
        <FormGroup style={{ gridColumn: '1 / -1' }}>
          <Label>Select Fields to Display</Label>
          <FieldSelectionContainer>
            <FieldSelectionHeader>
              <FieldSelectionTitle>
                Available Fields ({availableFields.length}) - Selected ({selectedFields.length})
              </FieldSelectionTitle>
              <FieldSelectionActions>
                <FieldActionButton type="button" onClick={handleSelectAllFields} disabled={availableFields.length === 0}>
                  Select All
                </FieldActionButton>
                <FieldActionButton type="button" onClick={handleClearAllFields} disabled={selectedFields.length === 0}>
                  Clear All
                </FieldActionButton>
              </FieldSelectionActions>
            </FieldSelectionHeader>
            
            {availableFields.length > 0 ? (
              <FieldCheckboxGrid>
                {availableFields.map(field => (
                  <FieldCheckboxItem key={field.index}>
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.index)}
                      onChange={() => handleFieldToggle(field.index)}
                    />
                    <FieldLabel>{field.name}</FieldLabel>
                    <FieldType>{typeof field.type === 'object' ? JSON.stringify(field.type) : (field.type || 'unknown')}</FieldType>
                  </FieldCheckboxItem>
                ))}
              </FieldCheckboxGrid>
            ) : (
              <div style={{ padding: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {selectedMetaId ? 'No fields available for selected metadata' : 'Select namespace and metadata to see available fields'}
              </div>
            )}
          </FieldSelectionContainer>
        </FormGroup>
        
        <FormGroup>
          <Label>&nbsp;</Label>
          <QueryButton type="submit" disabled={loading || !isConnected || selectedFields.length === 0}>
            {loading ? 'Querying...' : 'Query Historical Data'}
          </QueryButton>
        </FormGroup>
      </QueryForm>
      
      {loading && (
        <LoadingMessage>
          Querying historical data for {selectedMarket}/{selectedCode}...
        </LoadingMessage>
      )}
      
      {historicalData.length > 0 && (
        <ResultsContainer>
          <ResultsHeader>
            <ResultsTitle>
              Historical Data: {selectedMarket}/{selectedCode}
              {selectedMetaId && schema && schema[selectedNamespace] && schema[selectedNamespace][selectedMetaId] && (
                ` • ${String(schema[selectedNamespace][selectedMetaId].name || '')}`
              )}
            </ResultsTitle>
            <ResultsInfo>
              {totalRecords} records • {granularityOptions.find(g => g.value === granularity)?.label} intervals • {selectedFields.length} fields
            </ResultsInfo>
          </ResultsHeader>
          
          <DataGrid>
            <Table>
              <thead>
                <tr>
                  {selectedFields.map(fieldIndex => {
                    const field = availableFields.find(f => f.index === fieldIndex);
                    return (
                      <TableHeader key={fieldIndex}>
                        {field ? String(field.name || `Field ${fieldIndex}`) : `Field ${fieldIndex}`}
                      </TableHeader>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((record, index) => (
                  <TableRow key={index}>
                    {selectedFields.map(fieldIndex => {
                      const field = availableFields.find(f => f.index === fieldIndex);
                      const fieldName = field ? String(field.name || `field_${fieldIndex}`) : `field_${fieldIndex}`;
                      
                      // Get field value from record data using exact field name (not lowercase)
                      let cellValue = record[fieldName] || record[`field_${fieldIndex}`] || 'N/A';
                      
                      // Special formatting for different data types
                      if (Array.isArray(cellValue)) {
                        // Vector/Array fields: show count and first few items
                        if (cellValue.length === 0) {
                          cellValue = '[]';
                        } else if (cellValue.length <= 3) {
                          cellValue = `[${cellValue.join(', ')}]`;
                        } else {
                          // Show first 3 items + count for large arrays
                          cellValue = `[${cellValue.slice(0, 3).join(', ')}, ...] (${cellValue.length} items)`;
                        }
                      } else if (typeof cellValue === 'object' && cellValue !== null) {
                        // Object fields: show JSON representation
                        cellValue = JSON.stringify(cellValue);
                      } else if (typeof cellValue === 'number') {
                        // Numeric fields: format based on field name patterns
                        const lowerFieldName = fieldName.toLowerCase();
                        if (lowerFieldName.includes('price') || lowerFieldName.includes('amount') || lowerFieldName.includes('turnover')) {
                          cellValue = cellValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        } else if (lowerFieldName.includes('ratio') || lowerFieldName.includes('rate') || lowerFieldName.includes('percent')) {
                          cellValue = (cellValue * 100).toFixed(2) + '%';
                        } else if (lowerFieldName.includes('volume') || lowerFieldName.includes('count')) {
                          cellValue = cellValue.toLocaleString();
                        } else {
                          cellValue = cellValue.toLocaleString();
                        }
                      } else if ((fieldName === 'timestamp' || fieldName === 'datetime' || fieldName.toLowerCase().includes('time')) && 
                                 (typeof cellValue === 'number' || !isNaN(Date.parse(cellValue)))) {
                        // Time fields: format as readable datetime
                        const date = new Date(cellValue);
                        if (!isNaN(date.getTime())) {
                          cellValue = date.toLocaleString();
                        }
                      } else if (typeof cellValue === 'boolean') {
                        // Boolean fields: show as Yes/No
                        cellValue = cellValue ? 'Yes' : 'No';
                      } else if (cellValue === null || cellValue === undefined) {
                        cellValue = 'N/A';
                      } else {
                        // String and other types: display as-is but ensure it's a string
                        cellValue = String(cellValue);
                      }
                      
                      return (
                        <TableCell key={fieldIndex} title={Array.isArray(record[fieldName]) ? `Full array: ${JSON.stringify(record[fieldName])}` : String(cellValue)}>
                          {cellValue}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </tbody>
            </Table>
          </DataGrid>
          
          {totalPages > 1 && (
            <Pagination>
              <div>
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
              </div>
              
              <div>
                <PaginationButton 
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  First
                </PaginationButton>
                <PaginationButton 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </PaginationButton>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, currentPage - 2) + i;
                  if (page <= totalPages) {
                    return (
                      <PaginationButton
                        key={page}
                        className={page === currentPage ? 'active' : ''}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </PaginationButton>
                    );
                  }
                  return null;
                })}
                
                <PaginationButton 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </PaginationButton>
                <PaginationButton 
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </PaginationButton>
              </div>
            </Pagination>
          )}
        </ResultsContainer>
      )}
    </QueryContainer>
  );
}

export default HistoricalDataQuery;