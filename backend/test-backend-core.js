/**
 * Backend Core Features Test
 * 
 * This script tests the three core functionalities of the backend:
 * 1. Schema retrieval and processing
 * 2. Universe revision initialization 
 * 3. Universe seeds handling
 * 
 * Tests the backend's ability to replicate test.js functionality
 */

import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const BACKEND_WS_URL = process.env.BACKEND_WS_URL || 'ws://localhost:4000';
const CAITLYN_WS_URL = process.env.CAITLYN_WS_URL;
const TOKEN = process.env.CAITLYN_TOKEN;

let testResults = {
    schemaRetrieved: false,
    universeRevisionInitialized: false,
    universeSeedsReceived: false,
    errors: []
};

let ws = null;
let testTimeout = null;

console.log('🧪 Starting Backend Core Features Test');
console.log('=' .repeat(60));
console.log(`Backend URL: ${BACKEND_WS_URL}`);
console.log(`Caitlyn URL: ${CAITLYN_WS_URL}`);
console.log('');

function runTest() {
    return new Promise((resolve, reject) => {
        // Set overall test timeout (60 seconds)
        testTimeout = setTimeout(() => {
            if (ws) ws.close();
            reject(new Error('Test timed out after 60 seconds'));
        }, 60000);

        // Connect to backend
        console.log('🔗 Connecting to backend...');
        ws = new WebSocket(BACKEND_WS_URL);

        ws.on('open', () => {
            console.log('✅ Connected to backend');
            
            // Send connection request to Caitlyn server
            console.log('📤 Requesting connection to Caitlyn server...');
            ws.send(JSON.stringify({
                type: 'connect',
                url: CAITLYN_WS_URL,
                token: TOKEN
            }));
        });

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                handleBackendMessage(message, resolve);
            } catch (e) {
                console.log('📨 Received non-JSON message:', data.toString().substring(0, 100));
            }
        });

        ws.on('error', (error) => {
            testResults.errors.push(`WebSocket error: ${error.message}`);
            console.error('❌ WebSocket error:', error);
            clearTimeout(testTimeout);
            reject(error);
        });

        ws.on('close', () => {
            console.log('🔌 Connection to backend closed');
        });
    });
}

function handleBackendMessage(message, resolve) {
    console.log(`📨 Backend message: ${message.type}`);

    switch (message.type) {
        case 'connection_status':
            if (message.backendConnected && message.caitlynConnected) {
                console.log('✅ Both backend and Caitlyn connections established');
                
                // Request schema after connection is established
                setTimeout(() => {
                    console.log('📤 Requesting schema...');
                    ws.send(JSON.stringify({ type: 'get_schema' }));
                }, 1000);
            } else if (message.backendConnected && !message.caitlynConnected) {
                console.log('⚠️ Backend connected but Caitlyn connection pending...');
            }
            break;

        case 'schema':
            console.log('🏗️ Schema received from backend');
            if (message.schema && Object.keys(message.schema).length > 0) {
                testResults.schemaRetrieved = true;
                console.log('✅ Schema retrieval test PASSED');
                
                const totalSchemaObjects = Object.values(message.schema)
                    .reduce((total, namespace) => total + Object.keys(namespace).length, 0);
                console.log(`   - Total schema objects: ${totalSchemaObjects}`);
                console.log(`   - Namespaces: ${Object.keys(message.schema).join(', ')}`);
                
                // Test universe revision after schema is loaded
                setTimeout(() => {
                    console.log('📤 Testing universe revision...');
                    ws.send(JSON.stringify({ type: 'test_universe_revision' }));
                }, 1000);
            } else {
                testResults.errors.push('Schema is empty or invalid');
                console.log('❌ Schema retrieval test FAILED - empty schema');
            }
            break;

        case 'universe_revision':
            console.log('🌍 Universe revision data received from backend');
            if (message.success && message.marketsCount > 0) {
                testResults.universeRevisionInitialized = true;
                console.log('✅ Universe revision test PASSED');
                console.log(`   - Markets processed: ${message.marketsCount}`);
                console.log(`   - Global markets: ${message.globalMarkets || 0}`);
                console.log(`   - Private markets: ${message.privateMarkets || 0}`);
                
                // Test universe seeds after revision is processed
                setTimeout(() => {
                    console.log('📤 Testing universe seeds...');
                    ws.send(JSON.stringify({ type: 'test_universe_seeds' }));
                }, 1000);
            } else {
                testResults.errors.push('Universe revision failed or returned no markets');
                console.log('❌ Universe revision test FAILED');
            }
            break;

        case 'universe_seeds':
            console.log('🌱 Universe seeds data received from backend');
            if (message.success && message.seedsReceived > 0) {
                testResults.universeSeedsReceived = true;
                console.log('✅ Universe seeds test PASSED');
                console.log(`   - Seeds responses received: ${message.seedsReceived}`);
                console.log(`   - Total seed entries: ${message.totalEntries || 0}`);
                
                // All tests complete - finish
                setTimeout(() => {
                    finishTest(resolve);
                }, 2000);
            } else {
                testResults.errors.push('Universe seeds failed or returned no data');
                console.log('❌ Universe seeds test FAILED');
                finishTest(resolve);
            }
            break;

        case 'error':
            testResults.errors.push(`Backend error: ${message.error}`);
            console.log(`❌ Backend error: ${message.error}`);
            break;

        case 'log':
            if (message.level === 'error') {
                testResults.errors.push(`Backend log error: ${message.message}`);
            }
            console.log(`📝 Backend log [${message.level}]: ${message.message}`);
            break;
    }
}

function finishTest(resolve) {
    clearTimeout(testTimeout);
    
    console.log('\n🏁 Test Results Summary');
    console.log('=' .repeat(40));
    
    const tests = [
        { name: 'Schema Retrieval', passed: testResults.schemaRetrieved },
        { name: 'Universe Revision', passed: testResults.universeRevisionInitialized },
        { name: 'Universe Seeds', passed: testResults.universeSeedsReceived }
    ];
    
    let passedTests = 0;
    tests.forEach(test => {
        const status = test.passed ? '✅ PASSED' : '❌ FAILED';
        console.log(`${test.name}: ${status}`);
        if (test.passed) passedTests++;
    });
    
    console.log(`\nOverall: ${passedTests}/${tests.length} tests passed`);
    
    if (testResults.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        testResults.errors.forEach((error, i) => {
            console.log(`   ${i + 1}. ${error}`);
        });
    }
    
    if (ws) {
        ws.close();
    }
    
    const success = passedTests === tests.length && testResults.errors.length === 0;
    if (success) {
        console.log('\n🎉 All core backend features are working correctly!');
        resolve(testResults);
    } else {
        resolve(testResults);
    }
}

// Run the test
runTest()
    .then((results) => {
        const allPassed = results.schemaRetrieved && 
                         results.universeRevisionInitialized && 
                         results.universeSeedsReceived &&
                         results.errors.length === 0;
        
        process.exit(allPassed ? 0 : 1);
    })
    .catch((error) => {
        console.error('💥 Test failed with error:', error.message);
        process.exit(1);
    });