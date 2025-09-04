import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useData } from '../contexts/DataContext';

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

const TreeItem = styled.div`
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

function SchemaViewer() {
  const { schema, marketData } = useData();
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedRevision, setSelectedRevision] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');


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

      // Create meta children from schema data
      const metaChildren = [];
      Object.entries(namespaceData).forEach(([metaId, metaInfo]) => {
        const metaName = metaInfo.displayName || 
                        (metaInfo.name && metaInfo.name.includes('::') ? metaInfo.name.split('::').pop() : metaInfo.name) ||
                        `Meta ${metaId}`;
        
        // Each meta has a revision - create a single revision node
        const revision = metaInfo.revision || 0;
        
        metaChildren.push({
          id: `meta_${namespaceKey}_${metaId}`,
          type: 'meta',
          name: metaName,
          namespaceKey,
          metaName,
          metaId,
          fullMeta: metaInfo,
          children: [{
            id: `revision_${namespaceKey}_${metaId}_${revision}`,
            type: 'revision',
            name: `Rev ${revision}`,
            namespaceKey,
            metaName,
            revision: revision,
            metaId,
            fullMeta: metaInfo,
            fullName: `${namespaceName.toLowerCase()}::${metaName}`
          }]
        });
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
        <GridHeader>
          {selectedRevision ? 
            `Field Definitions - ${selectedRevision.metaName} (Rev ${selectedRevision.revision})` :
            'Field Definitions'
          }
        </GridHeader>
        <GridContent>
          {renderFieldGrid()}
        </GridContent>
      </GridPanel>
    </Container>
  );
}

export default SchemaViewer;