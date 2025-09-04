import WebSocket from 'ws';

// Test script to debug historical data query exactly like frontend
const ws = new WebSocket('ws://localhost:4000');

let requestId = Date.now();

ws.on('open', function open() {
  console.log('✅ Connected to backend WebSocket');
  
  // First connect to Caitlyn server (like frontend does)
  console.log('🔌 Connecting to Caitlyn server...');
  ws.send(JSON.stringify({
    type: 'connect',
    url: 'wss://116.wolverine-box.com/tm',
    token: process.env.CAITLYN_TOKEN || 'test-token'
  }));
});

ws.on('message', function message(data) {
  try {
    const message = JSON.parse(data);
    console.log('📨 Received:', message.type, message.message || '');
    
    if (message.type === 'connection_status' && message.status === 'connected') {
      console.log('✅ Caitlyn server connected - requesting schema...');
      
      // Request universe revision and seeds to populate schema
      console.log('🌍 Requesting universe revision...');
      ws.send(JSON.stringify({
        type: 'test_universe_revision'
      }));
    }
    
    if (message.type === 'universe_revision') {
      console.log('🌍 Universe revision received - requesting universe seeds...');
      ws.send(JSON.stringify({
        type: 'test_universe_seeds'
      }));
    }
    
    if (message.type === 'universe_seeds') {
      console.log('🌱 Universe seeds received - now requesting schema...');
      ws.send(JSON.stringify({
        type: 'get_schema'
      }));
    }
    
    if (message.type === 'schema_received' || message.type === 'schema') {
      console.log('📋 Schema received - analyzing schema structure...');
      
      const schema = message.data || message.schema;
      if (schema) {
        console.log('Schema namespaces:', Object.keys(schema));
        
        // Look for BlackForestYCK003 in private namespace
        if (schema['1']) {
          console.log('Private namespace metadata:', Object.keys(schema['1']).length, 'entries');
          
          // Find BlackForestYCK003 metadata ID
          for (const [metaId, meta] of Object.entries(schema['1'])) {
            if (meta.name && meta.name.includes('BlackForest')) {
              console.log(`Found BlackForest metadata: ID=${metaId}, name=${meta.name}, fields=${meta.fields?.length || 0}`);
            }
          }
        }
      } else {
        console.warn('❌ Schema is empty or missing');
        return;
      }
      
      // Wait a bit for universe initialization to complete
      setTimeout(() => {
        console.log('🔍 Sending historical data query...');
        console.log('Parameters:');
        console.log('  Market: DCE');
        console.log('  Code: i<00>');
        console.log('  Metadata: BlackForestYCK003 (latest revision)');
        console.log('  Namespace: 1 (Private)');
        console.log('  Date range: 2025-08-01 to 2025-08-15');
        console.log('  Granularity: 15 minutes');
        
        // Create the exact same request as frontend
        const queryParams = {
          market: 'DCE',
          code: 'i<00>',
          namespace: 1, // Private namespace
          metaID: 717, // BlackForestYCK003 meta ID (will need to find correct one)
          metaName: 'private::BlackForestYCK003',
          granularity: 15, // 15 minutes
          startTime: new Date('2025-08-01T00:00:00Z').getTime(),
          endTime: new Date('2025-08-15T23:59:59Z').getTime(),
          fields: ['forecasts', 'forecast_confidence', 'selected_forecast_step', 'ema_win_rate'], // Fields user selected
          fieldIndices: [0, 1, 2, 3], // First 4 fields
          requestId: requestId
        };
        
        ws.send(JSON.stringify({
          type: 'query_historical_data',
          params: queryParams,
          requestId: requestId
        }));
        
      }, 3000); // Wait 3 seconds for universe initialization
    }
    
    if (message.type === 'historical_data_response') {
      console.log('📈 Historical data response received!');
      console.log('Success:', message.success);
      
      if (message.success) {
        console.log('✅ Query successful!');
        console.log('Record count:', message.data?.totalCount || 0);
        console.log('Field count:', message.params?.fieldCount || 0);
        console.log('Source:', message.data?.source || 'unknown');
        console.log('Processing time:', message.data?.processingTime);
        
        if (message.data?.records && message.data.records.length > 0) {
          console.log('📊 Sample record:');
          console.log(JSON.stringify(message.data.records[0], null, 2));
        }
      } else {
        console.error('❌ Query failed:', message.error);
      }
      
      console.log('✅ Test completed - disconnecting');
      process.exit(0);
    }
    
    if (message.type === 'error') {
      console.error('❌ Backend error:', message.message);
      process.exit(1);
    }
    
  } catch (e) {
    console.log('Raw message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
  process.exit(1);
});

ws.on('close', function close() {
  console.log('🔌 Connection closed');
  process.exit(0);
});

// Timeout after 60 seconds
setTimeout(() => {
  console.log('⏰ Test timed out');
  process.exit(1);
}, 60000);