import React, { useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { useData } from '../contexts/DataContext';
import { useBackendWebSocket } from '../contexts/BackendWebSocketContext';

// Helper function to render complex field values
const renderFieldValue = (value) => {
  if (value === null || value === undefined) {
    return <span style={{ color: '#6c757d', fontStyle: 'italic' }}>null</span>;
  }
  
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span style={{ color: '#6c757d', fontStyle: 'italic' }}>[]</span>;
    }
    
    // Show first few elements for arrays
    const preview = value.slice(0, 3).map(item => 
      typeof item === 'number' ? item.toFixed(3) : String(item)
    ).join(', ');
    
    const suffix = value.length > 3 ? `, ...${value.length - 3} more` : '';
    return <span title={JSON.stringify(value)} style={{ color: '#0066cc' }}>
      [{preview}{suffix}]
    </span>;
  }
  
  if (typeof value === 'object') {
    return <span title={JSON.stringify(value)} style={{ color: '#0066cc' }}>
      {'{...}'}
    </span>;
  }
  
  if (typeof value === 'number') {
    return value.toFixed(4);
  }
  
  if (typeof value === 'string' && value.length > 50) {
    return <span title={value}>{value.substring(0, 50)}...</span>;
  }
  
  return String(value);
};

const Container = styled.div`
  display: flex;
  gap: 20px;
  height: 600px;
`;

const TreePanel = styled.div`
  flex: 0 0 300px;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
`;

const GridPanel = styled.div`
  flex: 1;
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
`;

const TreeHeader = styled.div`
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-weight: 600;
  color: #495057;
`;

const SearchInput = styled.input`
  width: 100%;
  margin-top: 8px;
  padding: 6px 10px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  font-weight: normal;
  
  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
  }
  
  &::placeholder {
    color: #6c757d;
  }
`;

const GridHeader = styled.div`
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-weight: 600;
  color: #495057;
`;

const TreeContent = styled.div`
  height: calc(100% - 47px);
  overflow-y: auto;
`;

const GridContent = styled.div`
  height: calc(100% - 47px);
  overflow-y: auto;
`;

const TreeNode = styled.div`
  user-select: none;
`;

const TreeItem = styled.div.withConfig({
  shouldForwardProp: (prop) => !['selected', 'level', 'isRevision'].includes(prop)
})`
  padding: 8px;
  padding-left: ${props => props.level * 20 + 12}px;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 14px;
  border-bottom: 1px solid #f8f9fa;
  
  &:hover {
    background: #f8f9fa;
  }
  
  ${props => props.selected && `
    background: #e3f2fd;
    color: #0066cc;
    font-weight: 500;
  `}
  
  ${props => props.isRevision && `
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 12px;
  `}
`;

const TreeIcon = styled.span`
  margin-right: 6px;
  width: 12px;
  color: #6c757d;
`;

const RevisionBadge = styled.span`
  background: #28a745;
  color: white;
  padding: 1px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  margin-left: 8px;
`;

const FieldTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
`;

const FieldHeader = styled.th`
  background: #f8f9fa;
  padding: 12px;
  text-align: left;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
  color: #495057;
  position: sticky;
  top: 0;
`;

const FieldRow = styled.tr`
  &:nth-child(even) {
    background: #f9f9f9;
  }
  
  &:hover {
    background: #e3f2fd;
  }
`;

const FieldCell = styled.td`
  padding: 10px 12px;
  border-bottom: 1px solid #f1f3f4;
  vertical-align: top;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #6c757d;
  font-size: 14px;
  font-style: italic;
`;

const MetaInfo = styled.div`
  padding: 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  font-size: 12px;
  color: #495057;
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #dee2e6;
  background: #f8f9fa;
`;

const Tab = styled.button`
  flex: 1;
  padding: 12px 16px;
  border: none;
  background: ${props => props.$active ? '#ffffff' : 'transparent'};
  color: ${props => props.$active ? '#495057' : '#6c757d'};
  font-weight: ${props => props.$active ? '600' : 'normal'};
  cursor: pointer;
  border-bottom: ${props => props.$active ? '2px solid #0066cc' : '2px solid transparent'};
  transition: all 0.2s ease;
  
  &:hover {
    background: ${props => props.$active ? '#ffffff' : '#e9ecef'};
    color: #495057;
  }
  
  &:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px rgba(0, 102, 204, 0.25);
  }
`;

const TabContent = styled.div`
  height: calc(100% - 47px);
  overflow-y: auto;
`;

const QueryPanel = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const QuerySection = styled.div`
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
`;

const SectionTitle = styled.h4`
  margin: 0 0 12px 0;
  color: #495057;
  font-size: 14px;
  font-weight: 600;
`;

const FormRow = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: center;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const FormLabel = styled.label`
  min-width: 100px;
  font-size: 13px;
  font-weight: 500;
  color: #495057;
`;

const FormInput = styled.input`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  
  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
  }
`;

const FormSelect = styled.select`
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  background: white;
  
  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
  }
`;

const FieldSelector = styled.div`
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  background: white;
`;

const FieldOption = styled.label`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f1f3f4;
  
  &:hover {
    background: #f8f9fa;
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  input {
    margin-right: 8px;
  }
`;

const QueryButton = styled.button`
  padding: 10px 20px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #0056b3;
  }
  
  &:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
  }
`;

const DataGrid = styled.div`
  border: 1px solid #dee2e6;
  border-radius: 4px;
  overflow: hidden;
`;

const DataTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
`;

const DataHeader = styled.th`
  background: #f8f9fa;
  padding: 10px 8px;
  text-align: left;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
  color: #495057;
  position: sticky;
  top: 0;
`;

const DataRow = styled.tr`
  &:nth-child(even) {
    background: #f9f9f9;
  }
  
  &:hover {
    background: #e3f2fd;
  }
`;

const DataCell = styled.td`
  padding: 8px;
  border-bottom: 1px solid #f1f3f4;
  vertical-align: top;
  font-family: monospace;
  font-size: 11px;
`;

const ComboContainer = styled.div`
  position: relative;
  flex: 1;
`;

const ComboInput = styled.input`
  width: 100%;
  padding: 8px 32px 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 13px;
  
  &:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
  }
`;

const ComboButton = styled.button`
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  border: none;
  background: #f8f9fa;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #6c757d;
  
  &:hover {
    background: #e9ecef;
    color: #495057;
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.25);
  }
`;

const DropdownList = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ced4da;
  border-top: none;
  border-radius: 0 0 4px 4px;
  max-height: 200px;
  overflow-y: auto;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const DropdownItem = styled.div`
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  border-bottom: 1px solid #f1f3f4;
  
  &:hover {
    background: #f8f9fa;
  }
  
  &:last-child {
    border-bottom: none;
  }
  
  .code {
    font-weight: 500;
    color: #495057;
  }
  
  .name {
    font-size: 11px;
    color: #6c757d;
    margin-left: 8px;
  }
`;

function SchemaViewer() {
  const { schema, marketData, securities } = useData();
  const { sendMessage, lastMessage } = useBackendWebSocket();
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('fields');
  
  // Historical data query state
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [market, setMarket] = useState('');
  const [code, setCode] = useState('');
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  const [granularity, setGranularity] = useState('86400'); // Default to 1 day
  const [historicalData, setHistoricalData] = useState([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(100);
  
  // Dropdown state
  const [showMarketDropdown, setShowMarketDropdown] = useState(false);
  const [showCodeDropdown, setShowCodeDropdown] = useState(false);
  const [marketFilter, setMarketFilter] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  
  // Handle WebSocket messages for historical data responses
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'fetch_by_code_response') {
      console.log('🔍 DEBUG: Processing fetch_by_code_response', {
        lastMessage: lastMessage,
        success: lastMessage.success,
        hasData: !!lastMessage.data
      });
      
      setIsQuerying(false);
      
      if (lastMessage.success && lastMessage.data) {
        const responseData = lastMessage.data;
        
        console.log('🔍 DEBUG: Response data structure', {
          responseData: responseData,
          hasRecords: !!responseData.records,
          recordsIsArray: Array.isArray(responseData.records),
          recordCount: responseData.records?.length || 0
        });
        
        // Convert backend response to frontend format
        let processedData = [];
        if (responseData.records && Array.isArray(responseData.records)) {
          processedData = responseData.records.map((record, index) => {
            // Flatten the fields structure for data grid access
            const flatRecord = {
              ...record,
              row_id: index + 1,
              timestamp: record.timestamp ? 
                new Date(parseInt(record.timestamp)).toISOString() : 
                new Date().toISOString() // Parse timestamp from milliseconds
            };
            
            // If fields are nested under a "fields" property, flatten them to top level
            if (record.fields && typeof record.fields === 'object') {
              Object.assign(flatRecord, record.fields);
            }
            
            return flatRecord;
          });
        }
        
        console.log('🔍 DEBUG: Setting historicalData', {
          processedDataLength: processedData.length,
          firstRecord: processedData[0],
          firstRecordKeys: processedData[0] ? Object.keys(processedData[0]) : [],
          fieldsFlattened: processedData[0] && responseData.records[0] && responseData.records[0].fields ? 
            'Yes - fields moved to top level' : 'No nested fields found'
        });
        
        setHistoricalData(processedData);
        setCurrentPage(1);
        
        console.log('Historical data received:', {
          recordCount: processedData.length,
          message: lastMessage.message,
          source: responseData.source
        });
      } else {
        console.error('Historical data fetch failed:', lastMessage.message);
        alert('Historical data fetch failed: ' + (lastMessage.message || 'Unknown error'));
      }
    }
  }, [lastMessage]);


  const treeData = useMemo(() => {
    if (!schema) {
      return [];
    }

    const tree = [];

    // Create namespace nodes directly from schema data
    ['0', '1'].forEach(namespaceKey => {
      const namespaceName = namespaceKey === '0' ? 'Global' : 'Private';
      const namespaceData = schema[namespaceKey];
      
      if (!namespaceData) return;

      // Group metas by name and collect all their revisions
      const metaGroups = {};
      Object.entries(namespaceData).forEach(([metaId, metaInfo]) => {
        const metaName = metaInfo.displayName || 
                        (metaInfo.name && metaInfo.name.includes('::') ? metaInfo.name.split('::').pop() : metaInfo.name) ||
                        `Meta ${metaId}`;
        
        const revision = metaInfo.revision || 0;
        
        if (!metaGroups[metaName]) {
          metaGroups[metaName] = {
            metaName,
            revisions: []
          };
        }
        
        metaGroups[metaName].revisions.push({
          id: `revision_${namespaceKey}_${metaId}_${revision}`,
          type: 'revision',
          name: `Rev ${revision}`,
          namespaceKey,
          metaName,
          revision: revision,
          metaId,
          fullMeta: metaInfo,
          fullName: `${namespaceName.toLowerCase()}::${metaName}`
        });
      });
      
      // Create meta children with grouped revisions
      const metaChildren = Object.entries(metaGroups).map(([metaName, group]) => {
        // Sort revisions by revision number
        const sortedRevisions = group.revisions.sort((a, b) => a.revision - b.revision);
        
        return {
          id: `meta_${namespaceKey}_${metaName}`,
          type: 'meta',
          name: `${metaName} (${sortedRevisions.length} revision${sortedRevisions.length > 1 ? 's' : ''})`,
          namespaceKey,
          metaName,
          children: sortedRevisions
        };
      });

      if (metaChildren.length > 0) {
        tree.push({
          id: `namespace_${namespaceKey}`,
          type: 'namespace',
          name: namespaceName,
          namespaceKey,
          children: metaChildren.sort((a, b) => a.name.localeCompare(b.name))
        });
      }
    });

    return tree;
  }, [schema]);

  // Process available markets
  const availableMarkets = useMemo(() => {
    if (!marketData) return [];
    
    const markets = [];
    
    // Add global markets
    if (marketData.global) {
      Object.entries(marketData.global).forEach(([code, market]) => {
        markets.push({
          code: code,
          name: market.name || code,
          type: 'global'
        });
      });
    }
    
    // Add private markets  
    if (marketData.private) {
      Object.entries(marketData.private).forEach(([code, market]) => {
        markets.push({
          code: code,
          name: market.name || code,
          type: 'private'
        });
      });
    }
    
    return markets.sort((a, b) => a.code.localeCompare(b.code));
  }, [marketData]);

  // Process available securities/codes
  const availableCodes = useMemo(() => {
    if (!securities) return [];
    
    const codes = [];
    
    // Process securities by market
    Object.entries(securities).forEach(([marketCode, securityList]) => {
      if (Array.isArray(securityList)) {
        securityList.forEach(security => {
          if (security.codes && Array.isArray(security.codes)) {
            security.codes.forEach((code, index) => {
              const name = security.names && security.names[index] ? security.names[index] : code;
              codes.push({
                code: code,
                name: name,
                market: marketCode,
                category: security.categories && security.categories[index] ? security.categories[index] : 'Unknown'
              });
            });
          }
        });
      }
    });
    
    return codes.sort((a, b) => a.code.localeCompare(b.code));
  }, [securities]);

  const filteredTreeData = useMemo(() => {
    if (!searchQuery.trim()) return treeData;
    
    const filterTree = (nodes) => {
      return nodes.reduce((filtered, node) => {
        const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             node.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             node.marketCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             node.marketName?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Filter children recursively
        const filteredChildren = node.children ? filterTree(node.children) : [];
        
        // Include node if it matches search or has matching children
        if (matchesSearch || filteredChildren.length > 0) {
          const filteredNode = {
            ...node,
            children: filteredChildren
          };
          
          // Auto-expand nodes that contain search matches
          if (filteredChildren.length > 0) {
            setExpandedNodes(prev => new Set([...prev, node.id]));
          }
          
          filtered.push(filteredNode);
        }
        
        return filtered;
      }, []);
    };
    
    return filterTree(treeData);
  }, [treeData, searchQuery]);

  const toggleNode = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const selectRevision = (node) => {
    if (node.type === 'revision') {
      setSelectedRevision(node);
    }
  };

  const renderTreeNode = (node, level = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedRevision?.id === node.id;

    return (
      <TreeNode key={node.id}>
        <TreeItem
          level={level}
          selected={isSelected}
          isRevision={node.type === 'revision'}
          onClick={() => {
            if (hasChildren) {
              toggleNode(node.id);
            }
            selectRevision(node);
          }}
        >
          <TreeIcon>
            {hasChildren ? (isExpanded ? '▼' : '▶') : 
             node.type === 'revision' ? '📄' : '📁'}
          </TreeIcon>
          {node.name}
          {node.type === 'revision' && <RevisionBadge>Rev {node.revision}</RevisionBadge>}
        </TreeItem>
        
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </TreeNode>
    );
  };

  const getTypeName = (type) => {
    const types = {
      0x01: 'INT',        // DataType.INT = 0x01
      0x02: 'DOUBLE',     // DataType.DOUBLE = 0x02  
      0x03: 'STRING',     // DataType.STRING = 0x03
      0x04: 'VINT',       // DataType.VINT = 0x04 (vector<int32_t>)
      0x05: 'VDOUBLE',    // DataType.VDOUBLE = 0x05 (vector<double>)
      0x06: 'VSTRING',    // DataType.VSTRING = 0x06 (vector<string>)
      0x07: 'INT64',      // DataType.INT64 = 0x07
      0x08: 'VINT64'      // DataType.VINT64 = 0x08 (vector<int64_t>)
    };
    return types[type] || `UNKNOWN_0x${type.toString(16).toUpperCase()}`;
  };

  const renderFieldGrid = () => {
    if (!selectedRevision) {
      return (
        <EmptyState>
          Select a revision from the tree to view field definitions
        </EmptyState>
      );
    }

    const meta = selectedRevision.fullMeta;
    const fields = meta.fields || [];

    return (
      <div>
        <MetaInfo>
          <div><strong>Full Name:</strong> {selectedRevision.fullName}</div>
          <div><strong>Namespace:</strong> {selectedRevision.namespaceKey === '0' ? 'Global' : selectedRevision.namespaceKey === '1' ? 'Private' : `Namespace ${selectedRevision.namespaceKey}`}</div>
          <div><strong>Meta ID:</strong> {selectedRevision.metaId}</div>
          <div><strong>Revision:</strong> {selectedRevision.revision}</div>
          {selectedRevision.marketCode && <div><strong>Market:</strong> {selectedRevision.marketName} ({selectedRevision.marketCode})</div>}
          <div><strong>Field Count:</strong> {fields.length}</div>
          {meta.description && <div><strong>Description:</strong> {meta.description}</div>}
        </MetaInfo>
        
        {fields.length > 0 ? (
          <FieldTable>
            <thead>
              <tr>
                <FieldHeader>Index</FieldHeader>
                <FieldHeader>Field Name</FieldHeader>
                <FieldHeader>Type</FieldHeader>
                <FieldHeader>Position</FieldHeader>
                <FieldHeader>Precision</FieldHeader>
                <FieldHeader>Multiple</FieldHeader>
                <FieldHeader>Sample Type</FieldHeader>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, index) => (
                <FieldRow key={index}>
                  <FieldCell style={{ fontFamily: 'monospace', color: '#6c757d' }}>
                    {index}
                  </FieldCell>
                  <FieldCell style={{ fontWeight: '500' }}>
                    {field.name || `field_${index}`}
                  </FieldCell>
                  <FieldCell>
                    <code style={{ 
                      background: '#f8f9fa', 
                      padding: '2px 6px', 
                      borderRadius: '3px',
                      color: '#8e44ad'
                    }}>
                      {getTypeName(field.type)}
                    </code>
                  </FieldCell>
                  <FieldCell style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {field.pos !== undefined ? field.pos : index}
                  </FieldCell>
                  <FieldCell style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {field.precision || 0}
                  </FieldCell>
                  <FieldCell style={{ fontSize: '12px', textAlign: 'center' }}>
                    {field.multiple ? (
                      <span style={{ color: '#28a745', fontWeight: 'bold' }}>✓</span>
                    ) : (
                      <span style={{ color: '#dc3545' }}>✗</span>
                    )}
                  </FieldCell>
                  <FieldCell style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                    {field.sampleType || 0}
                  </FieldCell>
                </FieldRow>
              ))}
            </tbody>
          </FieldTable>
        ) : (
          <EmptyState>
            No fields defined for this revision
          </EmptyState>
        )}
      </div>
    );
  };

  const renderMarketCombo = () => {
    const filteredMarkets = availableMarkets.filter(m => 
      m.code.toLowerCase().includes(marketFilter.toLowerCase()) ||
      m.name.toLowerCase().includes(marketFilter.toLowerCase())
    );

    return (
      <ComboContainer>
        <ComboInput
          type="text"
          value={market}
          onChange={(e) => {
            setMarket(e.target.value);
            setMarketFilter(e.target.value);
            setShowMarketDropdown(true);
          }}
          onFocus={() => {
            setMarketFilter(market);
            setShowMarketDropdown(true);
          }}
          onBlur={() => {
            // Delay hiding to allow click on dropdown items
            setTimeout(() => setShowMarketDropdown(false), 150);
          }}
          placeholder="e.g., SHFE, DCE, CZCE or type to search..."
        />
        <ComboButton
          type="button"
          onClick={() => {
            setMarketFilter('');
            setShowMarketDropdown(!showMarketDropdown);
          }}
        >
          ▼
        </ComboButton>
        {showMarketDropdown && (
          <DropdownList>
            {filteredMarkets.length > 0 ? (
              filteredMarkets.map((marketItem, index) => (
                <DropdownItem
                  key={index}
                  onClick={() => {
                    setMarket(marketItem.code);
                    setShowMarketDropdown(false);
                  }}
                >
                  <span className="code">{marketItem.code}</span>
                  <span className="name">- {marketItem.name}</span>
                </DropdownItem>
              ))
            ) : (
              <DropdownItem>No markets found</DropdownItem>
            )}
          </DropdownList>
        )}
      </ComboContainer>
    );
  };

  const renderCodeCombo = () => {
    // Filter codes by selected market if one is chosen
    const relevantCodes = market 
      ? availableCodes.filter(c => c.market === market)
      : availableCodes;
      
    const filteredCodes = relevantCodes.filter(c => 
      c.code.toLowerCase().includes(codeFilter.toLowerCase()) ||
      c.name.toLowerCase().includes(codeFilter.toLowerCase())
    );

    return (
      <ComboContainer>
        <ComboInput
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setCodeFilter(e.target.value);
            setShowCodeDropdown(true);
          }}
          onFocus={() => {
            setCodeFilter(code);
            setShowCodeDropdown(true);
          }}
          onBlur={() => {
            // Delay hiding to allow click on dropdown items
            setTimeout(() => setShowCodeDropdown(false), 150);
          }}
          placeholder="e.g., cu2401, i2401 or type to search..."
        />
        <ComboButton
          type="button"
          onClick={() => {
            setCodeFilter('');
            setShowCodeDropdown(!showCodeDropdown);
          }}
        >
          ▼
        </ComboButton>
        {showCodeDropdown && (
          <DropdownList>
            {filteredCodes.length > 0 ? (
              filteredCodes.slice(0, 50).map((codeItem, index) => ( // Limit to 50 items for performance
                <DropdownItem
                  key={index}
                  onClick={() => {
                    setCode(codeItem.code);
                    setShowCodeDropdown(false);
                  }}
                >
                  <span className="code">{codeItem.code}</span>
                  <span className="name">- {codeItem.name}</span>
                  {market !== codeItem.market && (
                    <span className="name">({codeItem.market})</span>
                  )}
                </DropdownItem>
              ))
            ) : (
              <DropdownItem>No codes found {market && `for ${market}`}</DropdownItem>
            )}
            {filteredCodes.length > 50 && (
              <DropdownItem style={{fontStyle: 'italic', color: '#6c757d'}}>
                Showing first 50 results... type to refine search
              </DropdownItem>
            )}
          </DropdownList>
        )}
      </ComboContainer>
    );
  };

  const renderHistoricalDataQuery = () => {
    if (!selectedRevision) {
      return (
        <EmptyState>
          Select a revision from the tree to configure historical data query
        </EmptyState>
      );
    }

    const meta = selectedRevision.fullMeta;
    const fields = meta.fields || [];

    const handleFieldToggle = (fieldName) => {
      const newSelected = new Set(selectedFields);
      if (newSelected.has(fieldName)) {
        newSelected.delete(fieldName);
      } else {
        newSelected.add(fieldName);
      }
      setSelectedFields(newSelected);
    };

    const handleQuery = () => {
      if (!market || !code || !fromTime || !toTime || selectedFields.size === 0) {
        alert('Please fill in all required fields and select at least one field');
        return;
      }

      setIsQuerying(true);
      
      // Convert datetime-local to timestamp
      const fromTimestamp = Math.floor(new Date(fromTime).getTime() / 1000);
      const toTimestamp = Math.floor(new Date(toTime).getTime() / 1000);
      
      const queryParams = {
        market: market,
        code: code,
        fromTime: fromTimestamp,
        toTime: toTimestamp,
        granularity: parseInt(granularity),
        fields: Array.from(selectedFields),
        metaName: selectedRevision.metaName,
        namespace: selectedRevision.namespaceKey
      };

      console.log('Executing historical data query:', queryParams);

      // Send fetchByCode message to backend
      sendMessage({
        type: 'fetch_by_code',
        ...queryParams
      });

      // Response will be handled by useEffect when fetch_by_code_response is received
    };

    // Pagination
    const totalPages = Math.ceil(historicalData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = historicalData.slice(startIndex, startIndex + itemsPerPage);

    return (
      <QueryPanel>
        <QuerySection>
          <SectionTitle>Query Parameters</SectionTitle>
          <FormRow>
            <FormLabel>Market:</FormLabel>
            {renderMarketCombo()}
          </FormRow>
          <FormRow>
            <FormLabel>Code:</FormLabel>
            {renderCodeCombo()}
          </FormRow>
          <FormRow>
            <FormLabel>From Time:</FormLabel>
            <FormInput 
              type="datetime-local" 
              value={fromTime} 
              onChange={(e) => setFromTime(e.target.value)}
            />
          </FormRow>
          <FormRow>
            <FormLabel>To Time:</FormLabel>
            <FormInput 
              type="datetime-local" 
              value={toTime} 
              onChange={(e) => setToTime(e.target.value)}
            />
          </FormRow>
          <FormRow>
            <FormLabel>Granularity:</FormLabel>
            <FormSelect value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              <option value="60">1 Minute (60s)</option>
              <option value="300">5 Minutes (300s)</option>
              <option value="900">15 Minutes (900s)</option>
              <option value="3600">1 Hour (3600s)</option>
              <option value="14400">4 Hours (14400s)</option>
              <option value="86400">1 Day (86400s)</option>
            </FormSelect>
          </FormRow>
        </QuerySection>

        <QuerySection>
          <SectionTitle>Field Selection ({selectedFields.size} selected)</SectionTitle>
          <FieldSelector>
            {fields.map((field, index) => (
              <FieldOption key={index}>
                <input 
                  type="checkbox"
                  checked={selectedFields.has(field.name)}
                  onChange={() => handleFieldToggle(field.name)}
                />
                <strong>{field.name}</strong>
                <span style={{ marginLeft: '8px', color: '#6c757d' }}>
                  ({getTypeName(field.type)})
                </span>
              </FieldOption>
            ))}
          </FieldSelector>
        </QuerySection>

        <div>
          <QueryButton 
            onClick={handleQuery} 
            disabled={isQuerying || selectedFields.size === 0}
          >
            {isQuerying ? 'Querying...' : 'Execute Query'}
          </QueryButton>
        </div>

        {historicalData.length > 0 && (
          <QuerySection>
            <SectionTitle>Query Results ({historicalData.length} records)</SectionTitle>
            <DataGrid>
              <DataTable>
                <thead>
                  <tr>
                    <DataHeader>Timestamp</DataHeader>
                    <DataHeader>Row ID</DataHeader>
                    {Array.from(selectedFields).map(field => (
                      <DataHeader key={field}>{field}</DataHeader>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((record, index) => (
                    <DataRow key={index}>
                      <DataCell>{new Date(record.timestamp).toLocaleString()}</DataCell>
                      <DataCell>{record.row_id}</DataCell>
                      {Array.from(selectedFields).map(field => (
                        <DataCell key={field}>
                          {renderFieldValue(record[field])}
                        </DataCell>
                      ))}
                    </DataRow>
                  ))}
                </tbody>
              </DataTable>
            </DataGrid>
            
            {totalPages > 1 && (
              <div style={{ 
                marginTop: '16px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '8px' 
              }}>
                <button 
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{ 
                    padding: '6px 12px', 
                    border: '1px solid #dee2e6', 
                    background: currentPage === 1 ? '#f8f9fa' : 'white',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '13px', color: '#6c757d' }}>
                  Page {currentPage} of {totalPages} ({historicalData.length} total records)
                </span>
                <button 
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  style={{ 
                    padding: '6px 12px', 
                    border: '1px solid #dee2e6', 
                    background: currentPage === totalPages ? '#f8f9fa' : 'white',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </QuerySection>
        )}
      </QueryPanel>
    );
  };

  if (!schema || Object.keys(schema).length === 0) {
    return (
      <Container>
        <EmptyState style={{ width: '100%', height: '400px' }}>
          No schema loaded yet.<br />
          Connect to server to load schema definitions.
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <TreePanel>
        <TreeHeader>
          Schema Tree
          <SearchInput
            type="text"
            placeholder="Search schemas, markets, or revisions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </TreeHeader>
        <TreeContent>
          {filteredTreeData.length > 0 ? 
            filteredTreeData.map(node => renderTreeNode(node)) :
            <EmptyState>No tree nodes to display</EmptyState>
          }
        </TreeContent>
      </TreePanel>
      
      <GridPanel>
        <TabContainer>
          <Tab 
            $active={activeTab === 'fields'} 
            onClick={() => setActiveTab('fields')}
          >
            Field Definitions
          </Tab>
          <Tab 
            $active={activeTab === 'historical'} 
            onClick={() => setActiveTab('historical')}
          >
            Historical Data Query
          </Tab>
        </TabContainer>
        <TabContent>
          {activeTab === 'fields' ? renderFieldGrid() : renderHistoricalDataQuery()}
        </TabContent>
      </GridPanel>
    </Container>
  );
}

export default SchemaViewer;