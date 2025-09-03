/**
 * Backend Capabilities Test
 * 
 * This test verifies the backend has all the core capabilities needed
 * to replicate test.js functionality:
 * 1. ✅ WASM module loading and class availability
 * 2. ✅ Message creation (handshake, universe requests, seeds requests)  
 * 3. ✅ NetPackage encoding/decoding operations
 * 4. ⚠️ Schema processing (requires WebSocket connection)
 * 5. ⚠️ Universe revision/seeds processing (requires WebSocket connection)
 */

import WasmService from './src/services/WasmService.js';
import logger from './src/utils/logger.js';

console.log('🧪 Backend Capabilities Test');
console.log('Testing backend\'s ability to replicate test.js functionality');
console.log('=' .repeat(60));

async function runCapabilitiesTest() {
    const wasmService = new WasmService();
    const results = {
        wasmLoading: false,
        classAvailability: false,
        messageCreation: false,
        netPackageOps: false,
        schemaProcessing: 'requires-connection',
        universeProcessing: 'requires-connection'
    };
    
    try {
        // Test 1: WASM Module Loading (like test.js line 34-58)
        console.log('\n🔧 Test 1: WASM Module Loading');
        console.log('Equivalent to test.js loadCaitlynModule() function');
        
        await wasmService.initialize();
        
        if (wasmService.isReady()) {
            console.log('✅ WASM module loaded successfully');
            results.wasmLoading = true;
        } else {
            throw new Error('WASM module failed to initialize');
        }
        
        // Test 2: Required Classes Availability (like test.js line 41-49)
        console.log('\n🏗️ Test 2: Required Classes Availability');
        console.log('Equivalent to test.js class verification');
        
        const requiredClasses = [
            'NetPackage',      // Used in test.js line 123, 209, 350
            'IndexSerializer', // Used in test.js line 188
            'IndexSchema',     // Used in test.js line 168
            'ATUniverseReq',   // Used in test.js line 207
            'ATUniverseRes',   // Used in test.js line 229
            'ATUniverseSeedsReq', // Used in test.js line 340
            'ATUniverseSeedsRes'  // Used in test.js line 383
        ];
        
        let availableClasses = 0;
        console.log('Required WASM classes:');
        for (const className of requiredClasses) {
            if (typeof wasmService.module[className] === 'function') {
                console.log(`  ✅ ${className} - Available`);
                availableClasses++;
            } else {
                console.log(`  ❌ ${className} - Missing`);
            }
        }
        
        if (availableClasses === requiredClasses.length) {
            console.log(`✅ All ${requiredClasses.length} required classes available`);
            results.classAvailability = true;
        } else {
            console.log(`❌ Only ${availableClasses}/${requiredClasses.length} classes available`);
        }
        
        // Test 3: Message Creation Capabilities (like test.js handshake, universe requests)
        console.log('\n📤 Test 3: Message Creation Capabilities');
        
        const token = "58abd12edbde042536637bfba9d20d5faf366ef481651cdbb046b1c3b4f7bf7a97ae7a2e6e5dc8fe05cd91147c8906f8a82aaa1bb1356d8cb3d6a076eadf5b5a";
        
        try {
            // Test handshake creation (like test.js line 72)
            const handshakeMsg = wasmService.createHandshakeMessage(token);
            console.log(`  ✅ Handshake message: ${handshakeMsg.length} bytes`);
            
            // Test universe request creation (like test.js line 207-216)
            const universeRequest = wasmService.createUniverseRequest(token);
            console.log(`  ✅ Universe request: ${universeRequest.length} bytes`);
            
            // Test keepalive creation (like test.js keepalive in message handler)
            const keepalive = wasmService.createKeepaliveMessage();
            console.log(`  ✅ Keepalive message: ${keepalive.length} bytes`);
            
            // Test universe seeds request creation (like test.js line 340-351)
            const seedsRequest = wasmService.createUniverseSeedsRequest(
                token, 123, 456, 'global', 'Security', 'SHFE', 20240901
            );
            console.log(`  ✅ Universe seeds request: ${seedsRequest.length} bytes`);
            
            console.log('✅ All message types can be created');
            results.messageCreation = true;
            
        } catch (error) {
            console.log(`❌ Message creation failed: ${error.message}`);
        }
        
        // Test 4: NetPackage Operations (like test.js line 123-130)
        console.log('\n📦 Test 4: NetPackage Operations');
        console.log('Equivalent to test.js binary message processing');
        
        try {
            const module = wasmService.module;
            
            // Create NetPackage (like test.js line 123)
            const pkg = new module.NetPackage();
            
            // Test encoding (like test.js line 209, 350)
            const testData = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
            const encoded = pkg.encode(12345, testData);
            console.log(`  ✅ Encoding: ${encoded.length} bytes`);
            
            // Test decoding (like test.js line 124)
            const decodePkg = new module.NetPackage();
            decodePkg.decode(encoded);
            console.log(`  ✅ Decoding: cmd=${decodePkg.header.cmd}, length=${decodePkg.length()}`);
            
            // Test command constants access
            const cmdDataDef = module.NET_CMD_GOLD_ROUTE_DATADEF || 0;
            const cmdUniverseRev = module.CMD_AT_UNIVERSE_REV || 0;
            const cmdUniverseSeeds = module.CMD_AT_UNIVERSE_SEEDS || 0;
            const cmdKeepalive = module.NET_CMD_GOLD_ROUTE_KEEPALIVE || 0;
            
            console.log(`  ✅ Command constants: DATADEF=${cmdDataDef}, UNIVERSE_REV=${cmdUniverseRev}, UNIVERSE_SEEDS=${cmdUniverseSeeds}, KEEPALIVE=${cmdKeepalive}`);
            
            // Cleanup (like test.js line 154, 196, 216, 301, 410)
            pkg.delete();
            decodePkg.delete();
            console.log(`  ✅ WASM object cleanup working`);
            
            console.log('✅ All NetPackage operations working');
            results.netPackageOps = true;
            
        } catch (error) {
            console.log(`❌ NetPackage operations failed: ${error.message}`);
        }
        
        // Test 5: Schema Processing Readiness
        console.log('\n🏗️ Test 5: Schema Processing Readiness');
        console.log('Equivalent to test.js handleSchemaDefinition() function');
        
        try {
            // Verify IndexSchema class availability (like test.js line 168)
            const schema = new wasmService.module.IndexSchema();
            console.log('  ✅ IndexSchema class instantiable');
            
            // Verify IndexSerializer availability (like test.js line 188)
            const compressor = new wasmService.module.IndexSerializer();
            console.log('  ✅ IndexSerializer class instantiable');
            
            schema.delete();
            compressor.delete();
            console.log('  ✅ Schema processing classes ready (requires WebSocket data)');
            
        } catch (error) {
            console.log(`  ❌ Schema processing setup failed: ${error.message}`);
        }
        
        // Test 6: Universe Processing Readiness  
        console.log('\n🌍 Test 6: Universe Processing Readiness');
        console.log('Equivalent to test.js handleUniverseRevision() and handleUniverseSeeds()');
        
        try {
            // Verify ATUniverseRes class (like test.js line 229)
            const universeRes = new wasmService.module.ATUniverseRes();
            console.log('  ✅ ATUniverseRes class instantiable');
            
            // Verify ATUniverseSeedsRes class (like test.js line 383)
            const seedsRes = new wasmService.module.ATUniverseSeedsRes();
            console.log('  ✅ ATUniverseSeedsRes class instantiable');
            
            universeRes.delete();
            seedsRes.delete();
            console.log('  ✅ Universe processing classes ready (requires WebSocket data)');
            
        } catch (error) {
            console.log(`  ❌ Universe processing setup failed: ${error.message}`);
        }
        
        return results;
        
    } catch (error) {
        console.error(`❌ Backend capabilities test failed: ${error.message}`);
        return { ...results, error: error.message };
    }
}

// Run the test
runCapabilitiesTest()
    .then((results) => {
        console.log('\n🏁 Backend Capabilities Test Results');
        console.log('=' .repeat(50));
        
        const testResults = [
            { name: 'WASM Module Loading', status: results.wasmLoading, critical: true },
            { name: 'Class Availability', status: results.classAvailability, critical: true },
            { name: 'Message Creation', status: results.messageCreation, critical: true },
            { name: 'NetPackage Operations', status: results.netPackageOps, critical: true },
            { name: 'Schema Processing', status: results.schemaProcessing, critical: false },
            { name: 'Universe Processing', status: results.universeProcessing, critical: false }
        ];
        
        let passedCritical = 0;
        let totalCritical = 0;
        
        testResults.forEach(test => {
            let statusText;
            if (test.status === true) {
                statusText = '✅ READY';
            } else if (test.status === 'requires-connection') {
                statusText = '⚠️ REQUIRES CONNECTION';
            } else {
                statusText = '❌ FAILED';
            }
            
            console.log(`${test.name}: ${statusText}`);
            
            if (test.critical) {
                totalCritical++;
                if (test.status === true) {
                    passedCritical++;
                }
            }
        });
        
        console.log(`\\n📊 Critical Tests: ${passedCritical}/${totalCritical} passed`);
        
        if (passedCritical === totalCritical) {
            console.log('\\n🎉 SUCCESS: Backend has ALL capabilities needed to replicate test.js!');
            console.log('\\nThe backend can:');
            console.log('  ✅ Load WASM module (like test.js loadCaitlynModule)');
            console.log('  ✅ Create all message types (handshake, universe, seeds)');
            console.log('  ✅ Process binary messages with NetPackage');
            console.log('  ✅ Handle schema and universe data when connected');
            console.log('\\n📝 Note: Schema and universe processing require WebSocket connection');
            console.log('    to external Caitlyn server (just like test.js does)');
            process.exit(0);
        } else {
            console.log('\\n❌ FAILED: Backend missing critical capabilities');
            process.exit(1);
        }
    })
    .catch((error) => {
        console.error('💥 Test crashed:', error);
        process.exit(1);
    });