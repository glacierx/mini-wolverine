import util from 'util';
import ws from 'nodejs-websocket';

// Load Caitlyn WASM module using ES6 dynamic import
let caitlyn;
async function loadCaitlynModule() {
    try {
        const CaitlynModule = await import("../backend/public/caitlyn_js.js");
        caitlyn = await CaitlynModule.default();
        console.log("✅ Caitlyn module loaded successfully!");
        
        // Verify key classes are available
        if (typeof caitlyn.NetPackage === "function") {
            console.log("✅ NetPackage class is available.");
        } else {
            console.error("❌ NetPackage class is not available.");
        }
        
        if (typeof caitlyn.IndexSerializer === "function") {
            console.log("✅ IndexSerializer class is available.");
        } else {
            console.error("❌ IndexSerializer class is not available.");
        }
        
        // Start WebSocket connection after WASM is loaded
        startConnection();
        
    } catch (err) {
        console.error("❌ Failed to load Caitlyn module:", err);
    }
}

const TOKEN="";

function startConnection() {
    const client = ws.connect("wss://116.wolverine-box.com/tm", {}, () => {
        client.sendText('{"cmd":20512, "token":"'+TOKEN+'", "protocol":1, "seq":1}');
    });

    setupClientHandlers(client);
}

// Global variables to maintain state
var _compressor = null;
var _schema = {};

function setupClientHandlers(client) {
    client.on("text", function (msg) {
        console.log('📨 Text message:', msg);
    });

    function toArrayBuffer(buf) {
        var ab = new ArrayBuffer(buf.length);
        var view = new Uint8Array(ab);
        for (var i = 0; i < buf.length; ++i) {
            view[i] = buf[i];
        }
        return ab;
    }

    client.on("binary", stream => {
        var buf = Buffer.alloc(0);
        stream.on("data", src => {
            buf = Buffer.concat([buf, src])
        });
        stream.on("end", () => {
            var _buf = toArrayBuffer(buf);
            var pkg = new caitlyn.NetPackage();
            pkg.decode(_buf);
            
            console.log(util.format("📦 Message: raw_len=%d, cmd=%d, content_len=%d", 
                buf.length, pkg.header.cmd, pkg.length()));

            switch (pkg.header.cmd) {
                case caitlyn.NET_CMD_GOLD_ROUTE_DATADEF:
                    console.log('\n🏗️ ===== SCHEMA ANALYSIS =====');
                    var schema = new caitlyn.IndexSchema();
                    schema.load(pkg.content());
                    var _metas = schema.metas();
                    
                    console.log(`📋 Total metadata entries: ${_metas.size()}`);
                    
                    for (var i = 0; i < _metas.size(); i++) {
                        var meta = _metas.get(i);
                        
                        if (_schema[meta.namespace] === undefined) {
                            _schema[meta.namespace] = {}
                        }
                        _schema[meta.namespace][meta.ID] = meta;
                        
                        console.log(`\n📊 Meta ${i}:`);
                        console.log(`  Namespace: ${meta.namespace} (${meta.namespace === 0 ? 'global' : 'private'})`);
                        console.log(`  ID: ${meta.ID}`);
                        console.log(`  Name: ${meta.name}`);
                        
                        // Analyze fields
                        var fields = meta.fields;
                        console.log(`  Fields count: ${fields.size()}`);
                        
                        for (var j = 0; j < fields.size(); j++) {
                            var field = fields.get(j);
                            var typeNames = ['INT', 'DOUBLE', 'STRING', 'INT64'];
                            var typeName = typeNames[field.type] || `Unknown(${field.type})`;
                            console.log(`    Field ${j}: ${field.name} (type: ${typeName})`);
                        }
                    }
                    
                    console.log('\n🔧 Initializing compressor...');
                    _compressor = new caitlyn.IndexSerializer();
                    _compressor.updateSchema(schema);
                    
                    // Send universe revision request
                    requestUniverseData(client);
                    
                    schema.delete();
                    break;
                    
                case caitlyn.CMD_AT_UNIVERSE_REV:
                    console.log('\n🌍 ===== UNIVERSE REVISION ANALYSIS =====');
                    analyzeUniverseResponse(client, pkg.content());
                    break;
                    
                default:
                    console.log(`❓ Unhandled command: ${pkg.header.cmd}`);
                    break;
            }
            
            pkg.delete();
        });
    });
}

function requestUniverseData(client) {
    console.log('\n📤 Requesting universe revision data...');
    var _rev_req = new caitlyn.ATUniverseReq(TOKEN, 2);
    var pkg = new caitlyn.NetPackage();
    var _msg = Buffer.from(pkg.encode(caitlyn.CMD_AT_UNIVERSE_REV, _rev_req.encode()));
    client.sendBinary(_msg);
    
    _rev_req.delete();
    pkg.delete();
}

function analyzeUniverseResponse(client, content) {
    var res = new caitlyn.ATUniverseRes();
    res.setCompressor(_compressor);
    res.decode(content);
    
    console.log('📋 Universe revision response decoded');
    var revs = res.revs();
    var keys = revs.keys();
    
    console.log(`📊 Found ${keys.size()} revision namespaces`);
    
    for (var i = 0; i < keys.size(); i++) {
        var k = keys.get(i);
        var v = revs.get(k);
        
        console.log(`\n🔍 Analyzing namespace: "${k}"`);
        console.log(`  Contains ${v.size()} StructValue entries`);
        
        for (var j = 0; j < v.size(); j++) {
            var sv = v.get(j);
            
            console.log(`\n  📄 StructValue ${j}:`);
            console.log(`    MetaID: ${sv.metaID}`);
            console.log(`    Namespace: ${sv.namespace}`);
            console.log(`    TimeTag: ${sv.timeTag}`);
            console.log(`    StockCode: ${sv.stockCode}`);
            console.log(`    Market: ${sv.market}`);
            console.log(`    Granularity: ${sv.granularity}`);
            
            // Find the schema definition for this StructValue
            var ns = sv.namespace;
            var metaID = sv.metaID;
            
            if (_schema[ns] && _schema[ns][metaID]) {
                var meta = _schema[ns][metaID];
                console.log(`    Schema name: ${meta.name}`);
                console.log(`    Field analysis:`);
                
                var fields = meta.fields;
                for (var f = 0; f < fields.size(); f++) {
                    var field = fields.get(f);
                    var isEmpty = sv.isEmpty(f);
                    
                    var typeNames = ['INT', 'DOUBLE', 'STRING', 'INT64'];
                    var typeName = typeNames[field.type] || `Unknown(${field.type})`;
                    
                    if (!isEmpty) {
                        var value = null;
                        try {
                            switch (field.type) {
                                case 0: // INT
                                    value = sv.getInt32(f);
                                    break;
                                case 1: // DOUBLE
                                    value = sv.getDouble(f);
                                    break;
                                case 2: // STRING
                                    value = sv.getString(f);
                                    break;
                                case 3: // INT64
                                    value = sv.getInt64(f);
                                    break;
                                default:
                                    value = `Unknown type ${field.type}`;
                            }
                            console.log(`      Field ${f} (${field.name}, ${typeName}): "${value}"`);
                        } catch (e) {
                            console.log(`      Field ${f} (${field.name}, ${typeName}): Error reading - ${e.message}`);
                        }
                    } else {
                        console.log(`      Field ${f} (${field.name}, ${typeName}): <empty>`);
                    }
                }
            } else {
                console.log(`    ⚠️ No schema found for namespace ${ns}, metaID ${metaID}`);
            }
            
            sv.delete();
        }
    }
    
    res.delete();
    
    console.log('\n✅ Universe analysis complete. Exiting...');
    process.exit(0);
}

// Start the application by loading the WASM module
loadCaitlynModule();