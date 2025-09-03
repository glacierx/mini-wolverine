#include <corestdafx.h>
#include <boost/cstdint.hpp>
#include <boost/date_time.hpp>
#include <boost/date_time/c_local_time_adjustor.hpp>
#include <boost/any.hpp>
#include <utils/time.hpp>
#include <precompile/types.hpp>
#include <string>
#include <iostream>
#include <emscripten/bind.h>
#include <protocol/caitlyn_tm_protocol_entity.hpp>
#include <protocol/caitlyn_tm_comm_protocol.hpp>
#include <go/caitlyn_go_codec.hpp>
#include <utils/strings.hpp>

#include <caitlyn_js_types.hpp>
#include <caitlyn_js_sv.hpp>

using namespace emscripten;
using namespace raisethink::caitlyn::net::commandType;
using namespace raisethink::caitlyn::protocol::commandType;
using namespace raisethink::caitlyn::protocol;

double mypi() {
    return 3.1415926535;
}
// inline void test(){
//     _python3_calculator ent;
//     __decode_common_binary_as_str(ent, "");
// }

uint32_t version(){
    return 2022012301;
}

int main(int argc, char**argv) {
    // std::cout << "Hello, world!"<< std::endl;    
    // std::cout << raisethink::annie::utils::now() << std::endl;
    // ByteArray data;
    // boost::iostreams::back_insert_device<ByteArray> sink(data);
    // raisethink::caitlyn::serializer::ArrayDevice os(sink);
    // os<<(uint32_t)32;
    // HistoryRequestCommunicationProtocol req;
    // req.encode_binary(data);
    return 0;
}
ByteArray __encode_buffer;

val _encode_package(
    _net_package& pkg, 
    int16_t cmd, 
    const std::string & content) 
{
    pkg.m_pkgHeader.cmd = cmd;
    pkg.m_pkgContent.resize(content.size());
    std::copy(content.begin(), content.end(), pkg.m_pkgContent.begin());
    ByteArray __buf;
    __encode_buffer.clear();
    pkg.encode(__buf);
    raisethink::caitlyn::serializer::compress(__buf, __encode_buffer);
    return val(typed_memory_view(__encode_buffer.size(), &__encode_buffer[0]));
}
void _decode_package(_net_package& pkg, const std::string &data) {
    ByteArray __buf;
    if(data.size()>0){
        raisethink::caitlyn::serializer::uncompress((uint8_t*)&data[0], data.size(), __buf);
        // printf("OK %lu %lu\n", data.size(), __buf.size());
        pkg.decode((uint8_t*)&__buf[8], __buf.size()-8);
    }
}
val _package_content(_net_package&pkg){
    // std::string ret;
    // ret.resize(pkg.m_pkgContent.size());
    // // std::copy(pkg.m_pkgContent.begin(), pkg.m_pkgContent.end(), ret.begin());
    // return ret;
    return val(typed_memory_view(pkg.m_pkgContent.size(), &pkg.m_pkgContent[0]));
}
size_t _package_length(_net_package&pkg) {
    return pkg.m_pkgContent.size();
}


void _update_schema(_index_serializer& compressor, boost::shared_ptr<_index_schema> schema){
    compressor.update_schema(schema);
}

EMSCRIPTEN_BINDINGS(test) {
    function("mypi", &mypi);
    function("version", &version);
    

    constant("NET_CMD_GOLD_ROUTE_KEEPALIVE",NET_CMD_GOLD_ROUTE_KEEPALIVE);
    constant("NET_CMD_GOLD_ROUTE_DATADEF",NET_CMD_GOLD_ROUTE_DATADEF);
    constant("CMD_AT_START_BACKTEST",CMD_AT_START_BACKTEST);
    constant("CMD_AT_CTRL_BACKTEST",CMD_AT_CTRL_BACKTEST);
    constant("CMD_AT_UNIVERSE_REV",CMD_AT_UNIVERSE_REV);
    constant("CMD_AT_UNIVERSE_META",CMD_AT_UNIVERSE_META);
    constant("CMD_AT_UNIVERSE_SEEDS",CMD_AT_UNIVERSE_SEEDS);
    constant("CMD_AT_FETCH_BY_CODE",CMD_AT_FETCH_BY_CODE);
    constant("CMD_AT_FETCH_BY_TIME",CMD_AT_FETCH_BY_TIME);
    constant("CMD_AT_FETCH_BY_TIME_RANGE",CMD_AT_FETCH_BY_TIME_RANGE);
    constant("CMD_AT_RUN_FORMULA",CMD_AT_RUN_FORMULA);
    constant("CMD_AT_REG_FORMULA",CMD_AT_REG_FORMULA);
    constant("CMD_AT_DEL_FORMULA",CMD_AT_DEL_FORMULA);
    constant("CMD_AT_CAL_FORMULA",CMD_AT_CAL_FORMULA);
    constant("CMD_AT_REG_LIBRARIES",CMD_AT_REG_LIBRARIES);
    constant("CMD_AT_SUBSCRIBE",CMD_AT_SUBSCRIBE);
    constant("CMD_AT_SUBSCRIBE_SORT",CMD_AT_SUBSCRIBE_SORT);
    constant("CMD_AT_UNSUBSCRIBE",CMD_AT_UNSUBSCRIBE);
    constant("CMD_AT_ACCOUNT_ADD",CMD_AT_ACCOUNT_ADD);
    constant("CMD_AT_ACCOUNT_DEL",CMD_AT_ACCOUNT_DEL);
    constant("CMD_AT_ACCOUNT_EDIT",CMD_AT_ACCOUNT_EDIT);
    constant("CMD_AT_MODIFY_BASKET",CMD_AT_MODIFY_BASKET);
    constant("CMD_AT_MANUAL_TRADE",CMD_AT_MANUAL_TRADE);
    constant("CMD_AT_MANUAL_EDIT",CMD_AT_MANUAL_EDIT);
    constant("CMD_AT_ADD_STRATEGY_INSTANCE",CMD_AT_ADD_STRATEGY_INSTANCE);
    constant("CMD_AT_DEL_STRATEGY_INSTANCE",CMD_AT_DEL_STRATEGY_INSTANCE);
    constant("CMD_AT_EDIT_STRATEGY_INSTANCE",CMD_AT_EDIT_STRATEGY_INSTANCE);
    constant("CMD_AT_QUERY_STRATEGY_INSTANCE",CMD_AT_QUERY_STRATEGY_INSTANCE);
    constant("CMD_AT_QUERY_STRATEGY_INSTANCE_LOG",CMD_AT_QUERY_STRATEGY_INSTANCE_LOG);
    constant("CMD_AT_SHARE_BACKTEST",CMD_AT_SHARE_BACKTEST);
    constant("CMD_AT_QUERY_ORDERS",CMD_AT_QUERY_ORDERS);
    constant("CMD_AT_DEBUG_LIVE",CMD_AT_DEBUG_LIVE);
    constant("CMD_AT_DEBUG_COVERUP",CMD_AT_DEBUG_COVERUP);
    constant("CMD_AT_DEBUG_ADD_ACCOUNT",CMD_AT_DEBUG_ADD_ACCOUNT);
    constant("CMD_AT_HANDSHAKE",CMD_AT_HANDSHAKE);
    constant("CMD_TA_MARKET_STATUS",CMD_TA_MARKET_STATUS);
    constant("CMD_TA_PUSH_DATA",CMD_TA_PUSH_DATA);
    constant("CMD_TA_SUBSCRIBE_HEADER",CMD_TA_SUBSCRIBE_HEADER);
    // constant("CMD_TA_SUBSCRIBE_HEADER",0x0524);
    constant("CMD_TA_PUSH_PROGRESS",CMD_TA_PUSH_PROGRESS );
    constant("CMD_TA_PUSH_LOG",CMD_TA_PUSH_LOG);
    constant("CMD_TA_MARKET_SINGULARITY",CMD_TA_MARKET_SINGULARITY);
    constant("CMD_TA_PUSH_FORMULA",CMD_TA_PUSH_FORMULA);
    constant("CMD_AT_ACCOUNT_CHANGE_CAPITAL",CMD_AT_ACCOUNT_CHANGE_CAPITAL);
    constant("CMD_AT_QUERY_BACK_TEST_PROCS",CMD_AT_QUERY_BACK_TEST_PROCS);
    constant("CMD_AT_QUERY_BACK_TEST_PROC_LOG",CMD_AT_QUERY_BACK_TEST_PROC_LOG);
    constant("CMD_AT_QUERY_BACK_TEST_PROC_CONTROL",CMD_AT_QUERY_BACK_TEST_PROC_CONTROL);
    constant("CMD_AT_ADD_LIMITS",CMD_AT_ADD_LIMITS);
    constant("CMD_AT_DEL_LIMITS",CMD_AT_DEL_LIMITS);
    constant("CMD_AT_SKIP_BREACH",CMD_AT_SKIP_BREACH);

    enum_<ERROR_CODE>("ErrorCode")
        .value("CAITLYN_ERROR_SUCCESS",ERROR_SUCCESS)
        .value("ERROR_FORMAT",ERROR_FORMAT)
        .value("ERROR_NO_CMD",ERROR_NO_CMD)
        .value("ERROR_NO_FIELD",ERROR_NO_FIELD)
        .value("ERROR_EXIST_ACCOUNT",ERROR_EXIST_ACCOUNT)
        .value("ERROR_SAVE_ACCOUNT",ERROR_SAVE_ACCOUNT)
        .value("ERROR_SAVE_ORDER",ERROR_SAVE_ORDER)
        .value("ERROR_CANCEL_ORDER",ERROR_CANCEL_ORDER)
        .value("ERROR_HANDLE_DB",ERROR_HANDLE_DB)
        .value("ERROR_LOGIN_ACCOUNT",ERROR_LOGIN_ACCOUNT)
        .value("ERROR_NO_SEQ",ERROR_NO_SEQ)
        .value("ERROR_NO_LOGIN",ERROR_NO_LOGIN)
        .value("ERROR_NO_LOGIN_PATTERN",ERROR_NO_LOGIN_PATTERN)
        .value("ERROR_VALUE_NOT_EXIST",ERROR_VALUE_NOT_EXIST)
        .value("ERROR_NETWORK",ERROR_NETWORK)
        .value("ERROR_RESPONSE",ERROR_RESPONSE)
        .value("ERROR_NO_INTERFACE",ERROR_NO_INTERFACE)
        .value("ERROR_ACTION",ERROR_ACTION)
        .value("CAITLYN_ERROR_NOT_READY",ERROR_NOT_READY)
        .value("ERROR_INSUFFICIENT",ERROR_INSUFFICIENT)
        .value("ERROR_NO_SUPPORT_CMD",ERROR_NO_SUPPORT_CMD)
        .value("ERROR_NO_SUPPORT_VALUE",ERROR_NO_SUPPORT_VALUE)
        .value("ERROR_SUCCESS_FORMULA",ERROR_SUCCESS_FORMULA)
        .value("ERROR_SUCCESS_EXECUTER",ERROR_SUCCESS_EXECUTER)
        .value("ERROR_PLUGIN",ERROR_PLUGIN)
        .value("ERROR_DATABASE",ERROR_DATABASE)
        .value("ERROR_INVALID_FIELD_TYPE",ERROR_INVALID_FIELD_TYPE)
        .value("ERROR_TOKEN",ERROR_TOKEN)
        .value("ERROR_MARKET",ERROR_MARKET)
        .value("ERROR_NAMESPACE",ERROR_NAMESPACE)
        .value("ERROR_QUALIFIED_NAME",ERROR_QUALIFIED_NAME)
        .value("CAITLYN_ERROR_INVALID_PARAMETER",ERROR_INVALID_PARAMETER)
        .value("ERROR_INVALID_GRAMMAR",ERROR_INVALID_GRAMMAR)
        .value("CAITLYN_ERROR_NO_TOKEN",ERROR_NO_TOKEN)
        .value("ERROR_EXPIRE_TOKEN",ERROR_EXPIRE_TOKEN)
        .value("ERROR_CALCULATE_FAILURE",ERROR_CALCULATE_FAILURE)
        .value("ERROR_FEYNMAN_NOT_READY",ERROR_FEYNMAN_NOT_READY)
        .value("ERROR_INVALID_UUID",ERROR_INVALID_UUID)
        .value("ERROR_NO_SESSION",ERROR_NO_SESSION)
        .value("ERROR_BINDED_ACCOUNT",ERROR_BINDED_ACCOUNT)
        .value("ERROR_SYNC_FALURE",ERROR_SYNC_FALURE)
        .value("ERROR_NO_INDEX",ERROR_NO_INDEX)
        .value("ERROR_BROKER",ERROR_BROKER)
        .value("ERROR_USER_RATE",ERROR_USER_RATE)
        .value("ERROR_NO_ACCOUNT",ERROR_NO_ACCOUNT)
        .value("ERROR_TRADE_LIMIT",ERROR_TRADE_LIMIT)
        .value("ERROR_UNKNOWN",ERROR_UNKNOWN)
    ;
    class_<_net_header>("NetHeader")
        .constructor<>()
        .property("cmd", &_net_header::cmd)
    ;
    class_<_net_package>("NetPackage")
        .constructor<>()
        .property("header", &_net_package::m_pkgHeader)
        .function("length", &_package_length)
        .function("content", &_package_content)
        .function("encode", &_encode_package)
        .function("decode", &_decode_package)
    ;
    
    constant("NAMESPACE_GLOBAL", 0);
    constant("NAMESPACE_PRIVATE", 1);

    class_<_sv>("StructValue")
        .smart_ptr_constructor("StructValue", &boost::make_shared<_sv>)
        // .smart_ptr<boost::shared_ptr<_sv>>("StructValue")
        .property("namespace", &_sv::getNamespace, &_sv::setNamespace)
        .property("metaID", &_sv::getMetaID, &_sv::setMetaID)
        .property("timeTag", &_sv::getTimeTagS, &_sv::setTimeTagS)
        .property("granularity", &_sv::getGranularity, &_sv::setGranularity)
        .property("market", &_sv::getMarket, &_sv::setMarket)
        .property("stockCode", &_sv::getStockCode, &_sv::setStockCode)
        .property("fieldCount", &_sv::size, &_sv::resize)
        .function("getInt32", &_sv::getInt)
        .function("setInt32", &_sv::getInt)
        .function("getInt64", &_sv::getInt64S)
        .function("setInt64", &_sv::setInt64S)
        .function("getDouble", &_sv::getDouble)
        .function("setDouble", &_sv::setDouble)
        .function("getString", &_sv::getString)
        .function("setString", &_sv::setString)
        .function("getInt32Vector", &_sv::getInt32Vector)
        .function("setInt32Vector", &_sv::setInt32Vector)
        .function("getInt64Vector", &_sv::getInt64VectorS)
        .function("setInt64Vector", &_sv::setInt64VectorS)
        .function("getStringVector", &_sv::getStringVector)
        .function("setStringVector", &_sv::setStringVector)
        .function("getDoubleVector", &_sv::getDoubleVector)
        .function("setDoubleVector", &_sv::setDoubleVector)
        .function("isEmpty", &_sv::isEmpty)
        .function("reset", &_sv::reset)
        ;
    register_vector<int32_t>("Int32Vector");
    register_vector<int64_t>("Int64Vector");
    register_vector<uint64_t>("Uint64Vector");
    register_vector<std::string>("StringVector");
    register_vector<std::vector<std::string>>("StringMatrix");
    register_vector<double>("DoubleVector");

    enum_<_data_type>("DataType")
        .value("INT", _data_type::INT)
        .value("DOUBLE", _data_type::DOUBLE)
        .value("STRING", _data_type::STRING)
        .value("VINT", _data_type::VINT)
        .value("VDOUBLE", _data_type::VDOUBLE)
        .value("VSTRING", _data_type::VSTRING)
        .value("INT64", _data_type::INT64)
        .value("VINT64", _data_type::VINT64)
        ;
    class_<_index_field>("Field")
        .property("pos", &_index_field::pos_)
        .property("name", &_index_field::name_)
        .property("type", &_index_field::type_)
        .property("precision", &_index_field::precision_)
        .property("multiple", &_index_field::multiple_)
        .property("sampleType", &_index_field::sample_type_)
        ;
    register_vector<_index_field>("IndexFieldVector");
    class_<_index_share_opt>("ShareOption")
        .property("all", &_index_share_opt::all_)
        .property("userIDs", &_index_share_opt::user_ids_)
        ;
    class_<_index_meta>("IndexMeta")
        .property("ID", &_index_meta::id_)
        .property("namespace", &_index_meta::namespace_)
        .property("name", &_index_meta::name_)
        .property("displayName", &_index_meta::display_name_)
        .property("granularities", &_get_meta_granularities)
        .property("share", &_index_meta::share_)
        .property("indexType", &_index_meta::index_type_)
        .property("revision", &_index_meta::revision_)
        .property("authorUUID", &_index_meta::author_uuid_)
        .property("fields", &_index_meta::fields_)
        ;
    register_vector<_index_meta>("IndexMetaVector")
        ;
    register_vector<uint32_t>("Uint32Vector");
    
    class_<_index_schema>("IndexSchema") 
        .smart_ptr_constructor("IndexSchema", &boost::make_shared<_index_schema>)
        .function("load", &_load_index_schema_from_string)
        .function("load_old_version", &_load_index_schema_from_string_old_version)
        // .function("save", &_index_schema::save)
        .function("metas", &_get_index_schema_metas)
        ;
    class_<_index_serializer>("IndexSerializer")
        .smart_ptr_constructor("IndexSerializer", &boost::make_shared<_index_serializer>)
        .function("deserializeByTime", &_deserialize_by_time)
        .function("updateSchema", &_update_schema)
        ;
            
    class_<_base_request>("ATBaseRequest")
        .constructor<const std::string &, int32_t>()
        // .property("seq", &_base_request::seq)
        // .property("token", &_base_request::token)
        .DEF_PROPERTY(seq, _base_request)
        .DEF_PROPERTY(token, _base_request)
    ;
    class_<_base_response>("ATBaseResponse")
        .constructor<>()
        .constructor<int32_t>()
        .property("seq", &_base_response::seq)
        .property("status", &_base_response::status)
        .property("errorCode", &_base_response::error_code)
        .property("errorMsg", &_base_response::error_msg)
        .function("decode", __decode_ws_binary_as_str<_base_response>)
    ;

    class_<_at_universe_req, base<_base_request>>("ATUniverseReq")
        .constructor<const std::string &, int32_t>()
        .function("encode", __encode_ws_binary_as_str<_at_universe_req>)
    ;
    register_vector<_sv_ptr>("StructValueConstVector");
    register_map<std::string, _sv_const_ptr_array >("RevisionMap");

    class_<_at_universe_res, base<_base_response>>("ATUniverseRes")
        .constructor<>()
        .constructor<int32_t>()
        .smart_ptr<boost::shared_ptr<_at_universe_res>>("ATUniverseRes")
        .function("revs", &_get_revisions)
        .function("setCompressor", &_set_compressor<_at_universe_res>)
        .function("decode", __decode_ws_binary_as_str<_at_universe_res>)
    ;
    class_<_at_universe_seeds_req, base<_base_request>>("ATUniverseSeedsReq")
        .constructor<>()
        .constructor<const std::string&, 
            int32_t, 
            uint32_t, 
            const std::string&, 
            const std::string& , 
            const std::string &, 
            int32_t>()
        .smart_ptr<boost::shared_ptr<_at_universe_seeds_req>>("ATUniverseSeedsReq")
        .function("encode", __encode_ws_binary_as_str<_at_universe_seeds_req>)
        .DEF_PROPERTY(revision_, _at_universe_seeds_req)
        .DEF_PROPERTY(namespace_, _at_universe_seeds_req)
        .DEF_PROPERTY(qualified_name_, _at_universe_seeds_req)
        .DEF_PROPERTY(market_, _at_universe_seeds_req)
        .DEF_PROPERTY(trade_day_, _at_universe_seeds_req)

    ;

    class_<_at_universe_seeds_res, base<_base_response>>("ATUniverseSeedsRes")
        .constructor<>()
        .constructor<int32_t, const std::string&>()
        .function("setCompressor", &_set_compressor<_at_universe_seeds_res>)
        .function("decode", __decode_ws_binary_as_str<_at_universe_seeds_res>)
        .function("seedData", &_get_seed_data)
    ;

    class_<_at_fetch_by_code_req, base<_base_request>>("ATFetchByCodeReq")
        .constructor<>()
        .constructor<const std::string &,
                    int32_t,
                    const std::string &,
                    const std::string &,
                    uint32_t,
                    const std::string &,
                    const std::string &,
                    uint64_t ,
                    uint64_t ,
                    uint32_t ,
                    const std::vector<std::string>&>()
        .smart_ptr<boost::shared_ptr<_at_fetch_by_code_req>>("ATFetchByCodeReq")
        .function("encode", __encode_ws_binary_as_str<_at_fetch_by_code_req>)
        // .property("namespace", &_at_fetch_by_code_req::_ns)
        // .property("qualifiedName", &_at_fetch_by_code_req::qualified_name)
        // .property("revision", &_at_fetch_by_code_req::revision)
        // .property("market", &_at_fetch_by_code_req::market)
        // .property("code", &_at_fetch_by_code_req::market)
        // .property("from_time_tag", &_at_fetch_by_code_req::from_time_tag)
        // .property("to_time_tag", &_at_fetch_by_code_req::to_time_tag)
        // .property("granularity", &_at_fetch_by_code_req::granularity)
        // .property("fields", &_at_fetch_by_code_req::fields)
        .DEF_PROPERTY2(_ns, _at_fetch_by_code_req, "namespace")
        .DEF_PROPERTY2(qualified_name, _at_fetch_by_code_req, "qualifiedName")
        .DEF_PROPERTY2(revision, _at_fetch_by_code_req, "revision")
        .DEF_PROPERTY2(market, _at_fetch_by_code_req, "market")
        .DEF_PROPERTY2(code, _at_fetch_by_code_req, "code")
        .DEF_PROPERTY2(from_time_tag, _at_fetch_by_code_req, "fromTimeTag")
        .DEF_PROPERTY2(to_time_tag, _at_fetch_by_code_req, "toTimeTag")
        .DEF_PROPERTY2(granularity, _at_fetch_by_code_req, "granularity")
        .DEF_PROPERTY2(fields, _at_fetch_by_code_req, "fields")

    ;

    class_<_at_fetch_by_time_req, base<_base_request>>("ATFetchByTimeReq")
        .constructor<>()
        .constructor<const std::string& ,
                    int ,
                    const std::string& ,
                    const std::string& ,
                    Uint32 ,
                    const std::vector<std::string>& ,
                    const std::vector<std::string>& ,
                    Uint64 ,
                    Uint32 ,
                    const std::vector<std::string>& >()
        .smart_ptr<boost::shared_ptr<_at_fetch_by_time_req>>("ATFetchByTimeReq")
        .function("encode", __encode_ws_binary_as_str<_at_fetch_by_time_req>)
        // .property("namespace", &_at_fetch_by_time_req::_ns)
        // .property("qualifiedName", &_at_fetch_by_time_req::qualified_name)
        // .property("revision", &_at_fetch_by_time_req::revision)
        // .property("markets", &_at_fetch_by_time_req::markets)
        // .property("codes", &_at_fetch_by_time_req::codes)
        // .property("time_tag", &_at_fetch_by_time_req::time_tag)
        // .property("granularity", &_at_fetch_by_time_req::granularity)
        // .property("fields", &_at_fetch_by_time_req::fields)
        .DEF_PROPERTY2(_ns, _at_fetch_by_time_req, "namespace")
        .DEF_PROPERTY2(qualified_name, _at_fetch_by_time_req, "qualifiedName")
        .DEF_PROPERTY2(revision, _at_fetch_by_time_req, "revisions")
        .DEF_PROPERTY2(markets, _at_fetch_by_time_req, "markets")
        .DEF_PROPERTY2(codes, _at_fetch_by_time_req, "codes")
        .DEF_PROPERTY2(time_tag, _at_fetch_by_time_req, "timeTag")
        .DEF_PROPERTY2(granularity, _at_fetch_by_time_req, "granularity")
        .DEF_PROPERTY2(fields, _at_fetch_by_time_req, "fields")

    ;
    class_<_at_fetch_by_time_range_req, base<_base_request>>("ATFetchByTimeRangeReq")
        .constructor<>()
        .smart_ptr<boost::shared_ptr<_at_fetch_by_time_range_req>>("ATFetchByTimeRangeReq")
        .function("encode", __encode_ws_binary_as_str<_at_fetch_by_time_range_req>)
        .DEF_PROPERTY2(_ns, _at_fetch_by_time_range_req, "namespace")
        .DEF_PROPERTY2(qualified_name, _at_fetch_by_time_range_req, "qualifiedName")
        .DEF_PROPERTY2(revision, _at_fetch_by_time_range_req, "revision")
        .DEF_PROPERTY2(markets, _at_fetch_by_time_range_req, "markets")
        .DEF_PROPERTY2(codes, _at_fetch_by_time_range_req, "codes")
        .DEF_PROPERTY2(from_time_tag, _at_fetch_by_time_range_req, "fromTimeTag")
        .DEF_PROPERTY2(to_time_tag, _at_fetch_by_time_range_req, "toTimeTag")
        .DEF_PROPERTY2(granularity, _at_fetch_by_time_range_req, "granularity")
        .DEF_PROPERTY2(fields, _at_fetch_by_time_range_req, "fields")

    ;
    class_<_at_fetch_sv_res, base<_base_response>>("ATFetchSVRes")
        .constructor<>()
        .constructor<int32_t,
                    const std::vector<std::string>& ,
                    const std::string&>()
        .smart_ptr<boost::shared_ptr<_at_fetch_sv_res>>("ATFetchSVRes")
        .function("setCompressor", &_set_compressor<_at_fetch_sv_res>)
        .function("decode", __decode_ws_binary_as_str<_at_fetch_sv_res>)
        .function("results", &_get_sv_res)
        .function("json_results", &_get_json_sv_res)
        .property("fields", &_at_fetch_sv_res::fields_)
        .property("namespace", &_at_fetch_sv_res::namespace_)
    ;

    enum_<_client_category>("ClientCategory")
        .value("None", _client_category::None)
        .value("IndexCalculator", _client_category::IndexCalculate)
        .value("StrategyCalculator", _client_category::StrategyCalculate)
        .value("Einstein", _client_category::Einstein)
        .value("Dirac", _client_category::Dirac)
        .value("Bohr", _client_category::Bohr)
        .value("Custom", _client_category::Custom)
    ;

    enum_<_runtime_type>("RuntimeType")
        .value("Test", _runtime_type::BackTest)
        .value("Live",_runtime_type::Live)
    ;

    class_<_backtest_params>("BacktestParams")
        .constructor<>()
        .DEF_ENCODE_COMMON(_backtest_params)
        .DEF_DECODE_COMMON(_backtest_params)
        .DEF_PROPERTY2(runtime, _backtest_params, "RunTime")
        .DEF_PROPERTY2(start_time, _backtest_params, "startTime")
        .DEF_PROPERTY2(end_time, _backtest_params, "endTime")
        .DEF_PROPERTY2(restore_length, _backtest_params, "restoreLength")
        .DEF_PROPERTY2(granularity, _backtest_params, "granularity")
        .DEF_PROPERTY2(universe_in, _backtest_params, "universeIn")
        .DEF_PROPERTY2(universe_out, _backtest_params, "universeOut")
    ;
    register_pair<int32_t, int32_t>("Int32Pair");
    register_vector<std::pair<int32_t, int32_t>>("Int32PairVector");
    register_map<std::string, std::vector<std::pair<int32_t, int32_t>>>("TradingPeriodMap");

    enum_<_uout_sampler_configuration_type>("SamplerConfigurationType")
        .value("NONE", _uout_sampler_configuration_type::NONE)
        .value("MARKET", _uout_sampler_configuration_type::MARKET)
        .value("CUSTOM", _uout_sampler_configuration_type::CUSTOM)
    ;

    class_<_uout_sampler_configuration>("SamplerConfiguration")
        .constructor<>()
        .DEF_PROPERTY2(type, _uout_sampler_configuration, "type")
        .DEF_PROPERTY2(market, _uout_sampler_configuration, "market")
        .DEF_PROPERTY2(time_zone, _uout_sampler_configuration, "timeZone")
        .DEF_PROPERTY2(trading_period, _uout_sampler_configuration, "tradingPeriod")
        .DEF_PROPERTY2(holidays, _uout_sampler_configuration, "holidays")
    ;

    class_<_at_start_backtest_req, base<_base_request>>("ATStartBacktestReq")
        .constructor<>()
        .constructor<const std::string&, 
                    int32_t, 
                    _client_category, 
                    int32_t, 
                    int32_t>()
        // .property("category", &_at_start_backtest_req::category)
        // .property("targetID", &_at_start_backtest_req::target_id)
        // .property("revision", &_at_start_backtest_req::revision)
        // .property("parmameters", &_at_start_backtest_req::parameters)
        // .property("originalContent", &_at_start_backtest_req::original_content)
        .function("encode", __encode_ws_binary_as_str<_at_start_backtest_req>)
        .DEF_DECODE(_at_start_backtest_req)
        .DEF_PROPERTY2(category, _at_start_backtest_req, "category")
        .DEF_PROPERTY2(target_id, _at_start_backtest_req, "targetID")
        .DEF_PROPERTY2(revision, _at_start_backtest_req, "revision")
        .DEF_PROPERTY2(parameters, _at_start_backtest_req, "parameters")
        .DEF_PROPERTY2(original_content, _at_start_backtest_req, "originalContent")
        .DEF_PROPERTY2(manage, _at_start_backtest_req, "isManaged")
    ;

    enum_<_feynman_type>("FenymanType")
        .value("Feynman", _feynman_type::Feynman)
        .value("Maxwell", _feynman_type::Maxwell)
    ;
    enum_<_security_category>("SecurityCategory")
        .value("Stock", _security_category::Stock)
        .value("Future", _security_category::Future)
        .value("LogicFuture", _security_category::LogicFuture)
        .value("Index", _security_category::Index)
        .value("Option", _security_category::Option)
        .value("Etf", _security_category::Etf)
        .value("Fund", _security_category::Fund)
        .value("ACCOUNT_UUID", _security_category::ACCOUNT_UUID)
        .value("STRATEGY_UUID", _security_category::STRATEGY_UUID)
    ;

    enum_<_security_state>("SecurityState")
        .value("Normal", _security_state::Normal)
        .value("Suspension", _security_state::Suspension)
        .value("Delisting", _security_state::Delisting)
        .value("Delivery", _security_state::Delivery)
    ;

    enum_<_account_type>("AccountType")
        .value("Real", _account_type::Real)
        .value("Virtual", _account_type::Virtual)
        .value("Basket", _account_type::Basket)
    ;

    enum_<_account_category>("AccountCategory")
        .value("StockAccount", _account_category::StockAccount)
        .value("FutureAccount", _account_category::FutureAccount)
        .value("AnyAccount", _account_category::AnyAccount)
    ;

    enum_<_rate_type>("RateType")
        .value("ByMoney", _rate_type::ByMoney)
        .value("ByVolume", _rate_type::ByVolume)
        .value("ByFixed", _rate_type::ByFixed)
    ;
    enum_<_margin_algorithm>("MarginAlgorithm")
        .value("ByCost", _margin_algorithm::ByCost)
        .value("ByPreSettlement", _margin_algorithm::ByPreSettlement)
        .value("ByMarketValue", _margin_algorithm::ByMarketValue)
    ;

    register_vector<_security_category>("SecurityCategoryVector");

    enum_<_field_type>("FieldType")
        .value("Integer", _field_type::Integer)
        .value("Double", _field_type::Double)
        .value("String", _field_type::String)
        .value("IntegerVector", _field_type::IntegerVector)
        .value("DoubleVector", _field_type::DoubleVector)
        .value("StringVector", _field_type::StringVector)
        .value("Integer64", _field_type::Integer64)
        .value("Integer64Vector", _field_type::Integer64Vector)
    ;
    class_<_security_selector>("SecuritySelector")
        .constructor<>()
        .DEF_PROPERTY2(meta_name, _security_selector, "metaName")
        .DEF_PROPERTY2(type, _security_selector,  "type")
        .DEF_PROPERTY2(target_field, _security_selector, "targetField")
        .DEF_PROPERTY2(condition_field, _security_selector, "conditionField")
    ;

    register_vector<_security_selector>("SecuritySelectorVector");

    class_<_universe_in_import>("UniverseInImport")
        .constructor<>()
        .DEF_PROPERTY2(fields, _universe_in_import, "fields")
        .DEF_PROPERTY2(revision, _universe_in_import, "revision")
        .DEF_PROPERTY2(selectors, _universe_in_import, "selectors")
        .function("addSecurity", &_add_security<_universe_in_import>)
        .function("delSecurity", &_del_security<_universe_in_import>)
        .function("getSecurity", &_get_security<_universe_in_import>)
        .function("addSecurityCategory", &_add_security_cat<_universe_in_import>)
        .function("delSecurityCategory", &_del_security_cat<_universe_in_import>)
        .function("getSecurityCategory", &_get_security_cat<_universe_in_import>)
    ;
    class_<_universe_in>("UniverseIn")
        .constructor<>()
        // .property("imports", &_universe_in::imports)
        .DEF_PROPERTY2(imports, _universe_in, "imports")
        // .function("encode", __encode_ws_binary_as_str<_universe_in>)
    ;
    register_map<std::string, _universe_in_import >("UniverseInImportMap");
    class_<_universe_out_export_def>("UniverseOutExpDef")
        .constructor<>()
        .constructor<const std::string&, 
                    const std::string&,
					const std::string&, 
                    int32_t, 
                    int32_t, 
                    int32_t>()
        // .property("name", &_universe_out_export_def::name)
        // .property("display_name", &_universe_out_export_def::display_name)
        // .property("type", &_universe_out_export_def::type)
        // .property("precision", &_universe_out_export_def::precision)
        // .property("multiple", &_universe_out_export_def::multiple)
        // .property("sample_type", &_universe_out_export_def::sample_type)
        .DEF_PROPERTY2(name, _universe_out_export_def, "name")
        .DEF_PROPERTY2(display_name, _universe_out_export_def, "displayName")
        .DEF_PROPERTY2(type, _universe_out_export_def, "type")
        .DEF_PROPERTY2(precision, _universe_out_export_def, "precision")
        .DEF_PROPERTY2(multiple, _universe_out_export_def, "multiple")
        .DEF_PROPERTY2(sample_type, _universe_out_export_def, "sampleType")
    ;
    register_vector<_universe_out_export_def>("UniverseOutExpDefVector");

    class_<_universe_out_export>("UniverseOutExp")
        .constructor<>()
        // .constructor<int32_t, int32_t>()
        .constructor<const std::string&, int32_t>()
        // .property("id", &_universe_out_export::id)
        // .property("uuid", &_universe_out_export::uuid)
        // .property("revision", &_universe_out_export::revision)
        // .property("fields", &_universe_out_export::fields)
        .DEF_PROPERTY2(id, _universe_out_export, "ID")
        .DEF_PROPERTY2(is_tradable, _universe_out_export, "isTradable")
        .DEF_PROPERTY2(uuid, _universe_out_export, "UUID")
        .DEF_PROPERTY2(revision, _universe_out_export, "revision")
        .DEF_PROPERTY2(fields, _universe_out_export, "defs")
    ;
    
    register_map<std::string, _universe_out_export>("UniverseOutExportMap");

    enum_<_universe_out_sample_granularity_type>("UniverseOutSampleGranularityType")
        .value("MIN", _universe_out_sample_granularity_type::MIN)
        .value("ENUM", _universe_out_sample_granularity_type::ENUM)
    ;

    class_<_universe_out_subaccount>("UniverseOutSubAccount")
        .constructor<>()
        // .constructor<const std::string&,
		// 				_account_category,
		// 				const std::string&,
		// 				const std::string&,
		// 				double>()
        // .property("uuid", &_universe_out_subaccount::uuid)
        // .property("category", &_universe_out_subaccount::category)
        // .property("strategy_uuid", &_universe_out_subaccount::strategy_uuid)
        // .property("market", &_universe_out_subaccount::market)
        // .property("capital", &_universe_out_subaccount::capital)
        // .property("name", &_universe_out_subaccount::name)
        // .function("categories", &_subaccount_categories)
        // .function("securities", &_subaccount_securities)
        .DEF_PROPERTY2(uuid, _universe_out_subaccount, "UUID")
        .DEF_PROPERTY2(category, _universe_out_subaccount, "category")
        .DEF_PROPERTY2(strategy_uuid, _universe_out_subaccount, "strategyUUID")
        .DEF_PROPERTY2(currency, _universe_out_subaccount, "currency")
        .DEF_PROPERTY2(broker_uuid, _universe_out_subaccount, "brokerUUID")
        .DEF_PROPERTY2(ref_uuid, _universe_out_subaccount, "refUUID")
        // .property("categories", &_universe_out_subaccount_get_categories, &_universe_out_subaccount_set_categories)
        // .property("securites", &_universe_out_subaccount_get_securites, &_universe_out_subaccount_set_securites)
        .DEF_PROPERTY2(capital, _universe_out_subaccount, "capital")
        .DEF_PROPERTY2(name, _universe_out_subaccount, "name")
    ;

    register_vector<_universe_out_subaccount>("UniverseOutSubAccountVector");
    
    class_<_universe_out_sample_granularity>("UniverseOutSampleGranularity") 
        .constructor<>()
        // .property("type", &_universe_out_sample_granularity::type)
        // .property("cycles", &_universe_out_sample_granularity::cycles)
        .DEF_PROPERTY2(type, _universe_out_sample_granularity, "type")
        .DEF_PROPERTY2(cycles, _universe_out_sample_granularity, "cycles")
    ;

    class_<_universe_out>("UniverseOut")
        .constructor<>()
        .function("addSecurity", &_add_security<_universe_out>)
        .function("delSecurity", &_del_security<_universe_out>)
        .function("getSecurity", &_get_security<_universe_out>)
        .function("addSecurityCategory", &_add_security_cat<_universe_out>)
        .function("delSecurityCategory", &_del_security_cat<_universe_out>)
        .function("getSecurityCategory", &_get_security_cat<_universe_out>)
        // .property("exports", &_universe_out::exports)
        // .property("account_uuid", &_universe_out::account_uuid)
        // .property("strategy_uuid", &_universe_out::strategy_uuid)
        // .property("sample_granularities", &_universe_out::sample_granularities)
        // .property("market_accounts", &_universe_out::market_accounts)
        .DEF_PROPERTY2(account_uuid, _universe_out, "accountUUID")
        .DEF_PROPERTY2(strategy_uuid, _universe_out, "strategyUUID")
        .DEF_PROPERTY2(sample_granularities, _universe_out, "sampleGranularities")
        .DEF_PROPERTY2(market_accounts, _universe_out, "marketAccounts")
        .DEF_PROPERTY2(exports, _universe_out, "exports")
        .DEF_PROPERTY2(sampler_configurations, _universe_out, "samplerConfiguration")

    ;
    register_map<std::string, _universe_out>("UniverseOutMap");

    class_<_at_start_backtest_res, base<_base_response>>("ATStartBacktestRes")
        // .property("sessionID", &_at_start_backtest_res::session_id)
        // .property("framework", &_at_start_backtest_res::framework)
        // .property("binaryFileUrl", &_at_start_backtest_res::binary_file_url)
        // .property("category", &_at_start_backtest_res::category)
        // .property("universeOut", &_at_start_backtest_res::universe_out)
        .constructor<>()
        .DEF_DECODE(_at_start_backtest_res)
        .DEF_PROPERTY2(session_id, _at_start_backtest_res, "sessionID")
        .DEF_PROPERTY2(framework, _at_start_backtest_res, "framework")
        .DEF_PROPERTY2(binary_file_url, _at_start_backtest_res, "binaryFileURL")
        .DEF_PROPERTY2(category, _at_start_backtest_res, "category")
        .DEF_PROPERTY2(universe_out, _at_start_backtest_res, "universeOut")
        .DEF_PROPERTY2(hosts, _at_start_backtest_res, "hosts")

    ;

    class_<_at_rebuild_backtest_req, base<_base_request>>("ATRebuildBacktestReq")
        .constructor<>()
        // .property("sessionID", &_at_rebuild_backtest_req::session_id)
        // .property("start_time", &_at_rebuild_backtest_req::start_time)
        // .property("end_time", &_at_rebuild_backtest_req::end_time)
        .function("encode", __encode_ws_binary_as_str<_at_rebuild_backtest_req>)
        .DEF_PROPERTY2(session_id, _at_rebuild_backtest_req, "sessionID")
        .DEF_PROPERTY2(start_time, _at_rebuild_backtest_req, "startTime")
        .DEF_PROPERTY2(end_time, _at_rebuild_backtest_req, "endTime")
    ;
    enum_<_control_backtest_op>("ControlBacktestOperation")
        .value("Deploy", _control_backtest_op::Deploy)
        .value("Retire", _control_backtest_op::Retire)
        .value("Runpass", _control_backtest_op::Runpass)
        .value("Tail", _control_backtest_op::Tail)
        .value("Stop", _control_backtest_op::Stop)
        .value("Continue", _control_backtest_op::Continue)
    ;
    class_<_at_control_backtest_req, base<_base_request>>("ATControlBacktestReq")
        .constructor<>()
        // .property("sessionID", &_at_control_backtest_req::session_id)
        // .property("operation", &_at_control_backtest_req::operation)
        // .property("rebuild", &_at_control_backtest_req::rebuild)
        // .property("from", &_at_control_backtest_req::from)
        // .property("to", &_at_control_backtest_req::to)
        .function("encode", __encode_ws_binary_as_str<_at_control_backtest_req>)
        .DEF_PROPERTY2(session_id, _at_control_backtest_req, "sessionID")
        .DEF_PROPERTY2(operation, _at_control_backtest_req, "operation")
        .DEF_PROPERTY2(rebuild, _at_control_backtest_req, "rebuild")
        .DEF_PROPERTY2(from, _at_control_backtest_req, "from")
        .DEF_PROPERTY2(to, _at_control_backtest_req, "to")
    ;

    class_<_at_query_backtest_req, base<_base_request>>("ATQueryBacktestReq")
        .constructor<>()
        .DEF_PROPERTY2(session_id, _at_query_backtest_req, "sessionID")
    ;
    register_map<std::string, _universe_in>("UniverseInMap");
    // register_map<std::string, _universe_out>("UniverseOutMap");

    // class_<_at_query_backtest_res, base<_base_response>>("ATQueryBacktestRes")
        
    // ;
    enum_<fetch_order_category>("FetchOrderCategory")
        .value("StrategyUUID", fetch_order_category::StrategyUUID)
        .value("PhysicalAccountUUID", fetch_order_category::PhysicalAccountUUID)
        .value("VirtualAccountUUID", fetch_order_category::VirtualAccountUUID)
        .value("BasketAccountUUID", fetch_order_category::BasketAccountUUID)
    ;
    enum_<fetch_order_type>("FetchOrderType")
        .value("FetchOrder", fetch_order_type::FetchOrder)
        .value("FetchTransaction", fetch_order_type::FetchTransaction)
    ;
    class_<_at_fetch_order_by_code_req, base<_base_request>>("ATFetchOrderByCode")
        .constructor<>()
        .function("encode", __encode_ws_binary_as_str<_at_fetch_order_by_code_req>)
        // .property("code", &_at_fetch_order_by_code_req::code)
        // .property("fromTimeTag", &_at_fetch_order_by_code_req::from_time_tag)
        // .property("toTimeTag", &_at_fetch_order_by_code_req::to_time_tag)
        // .property("fields", &_at_fetch_order_by_code_req::fields)
        .DEF_PROPERTY2(code, _at_fetch_order_by_code_req, "code")
        .DEF_PROPERTY2(secondary_code, _at_fetch_order_by_code_req, "secondaryCode")
        .DEF_PROPERTY2(from_time_tag, _at_fetch_order_by_code_req, "fromTimeTag")
        .DEF_PROPERTY2(to_time_tag, _at_fetch_order_by_code_req, "toTimeTag")
        .DEF_PROPERTY2(fields, _at_fetch_order_by_code_req, "fields")
        .DEF_PROPERTY2(category, _at_fetch_order_by_code_req, "category")
        .DEF_PROPERTY2(type, _at_fetch_order_by_code_req, "type")
    ;
    enum_<_base_sub_filter_type>("BaseSubFilterType")
        .value("Logic", _base_sub_filter_type::Logic)
        .value("Compare", _base_sub_filter_type::Condition)
    ;

    enum_<_base_sub_filter_comp_op>("BaseSubFilterCompOp")
        .value("Greater", _base_sub_filter_comp_op::Greater)
        .value("NotLess", _base_sub_filter_comp_op::NotLess)
        .value("Less", _base_sub_filter_comp_op::Less)
        .value("NotGreater", _base_sub_filter_comp_op::NotGreater)
        .value("Equal", _base_sub_filter_comp_op::Equal)
        .value("NotEqual", _base_sub_filter_comp_op::NotEqual)
    ;

    enum_<_base_sub_filter_logic_op>("BaseSubFilterLogicOp")
        .value("Unkown", _base_sub_filter_logic_op::Unkown)
        .value("And", _base_sub_filter_logic_op::And)
        .value("Or", _base_sub_filter_logic_op::Or)
        .value("Not", _base_sub_filter_logic_op::Not)
    ;

    class_<_base_sub_filter>("BaseSubFilter")
        .constructor<>()
        .constructor<_base_sub_filter_logic_op>()
        .constructor<_base_sub_filter_comp_op, double_t>()
        .property("type", &_base_sub_filter::type)
        .property("right", &_base_sub_filter::right)
    ;
    class_<_sub_symbol>("SubscribeSymbol")
        .constructor<>()
        .constructor<const std::string&, uint32_t >()
        .property("symbol", &_sub_symbol::symbol)
        .property("granularity", &_sub_symbol::granularity)
    ;
    register_vector<_sub_symbol>("SubSymbolVector");
    register_map<std::string, std::vector<_sub_symbol>>("SubSymbolVectorMap");
    class_<_sub_filter_left>("SubFilterLeftType")
        .constructor<const std::string &, const std::string &>()
        .property("first", &_sub_filter_left::first) 
        .property("second", &_sub_filter_left::second) 
    ;
    register_vector<_sub_filter_left>("SubFilterLeftTypeVector");

    class_<_sub_filter, base<_base_sub_filter>>("SubFilter")
        .constructor<>()
        .constructor<_sub_filter_left&, _base_sub_filter_comp_op, double_t>()
        .constructor<_base_sub_filter_logic_op>()
        .property("left", &_sub_filter::left)
    ;
    register_vector<_sub_filter>("SubFilterVector");
    class_<_sub_sort_field>("SubSortField")
        .constructor<const std::string&, const std::string&, uint8_t>()
    ;
    // class_<_at_subscribe_req, base<_base_request>>("ATSubscribeReq")
    //     .constructor<>()
    //     .constructor<const std::string & , int32_t>()
    //     .property("allMarkets", &_at_subscribe_req::get_all_markets, &_at_subscribe_req::set_all_markets)
    //     .property("globalMarkets", &_at_subscribe_req::get_global_markets, &_at_subscribe_req::set_global_markets)
    //     .property("fields", &_at_subscribe_req::get_fields, &_at_subscribe_req::set_fields)
    //     .property("sortFields", &_at_subscribe_req::get_sort_fields, &_at_subscribe_req::set_sort_fields)
    //     .property("start", &_at_subscribe_req::get_start, &_at_subscribe_req::set_start)
    //     .property("end", &_at_subscribe_req::get_end, &_at_subscribe_req::set_end)
    //     .property("filters", &_at_subscribe_req::get_filters, &_at_subscribe_req::set_filters)
    //     .property("uuid", &_at_subscribe_req::get_uuid, &_at_subscribe_req::set_uuid)
    //     .property("update", &_at_subscribe_req::get_update, &_at_subscribe_req::set_update)
    //     .function("encode", __encode_ws_binary_as_str<_at_subscribe_req>)
    // ;

    class_<_at_subscribe_filter>("ATSubscribeFilter")
        .constructor<>()
        .DEF_PROPERTY2(type, _at_subscribe_filter, "type")
        .DEF_PROPERTY2(op, _at_subscribe_filter, "op")
        .DEF_PROPERTY2(left, _at_subscribe_filter, "left")
        .DEF_PROPERTY2(right, _at_subscribe_filter, "right")
    ;

    register_vector<_at_subscribe_filter>("ATSubscribeFilterVector");

    class_<_at_subscribe_req, base<_base_request>>("ATSubscribeReq")
        .constructor<>()
        .DEF_PROPERTY2(uuid, _at_subscribe_req, "UUID")
        .DEF_PROPERTY2(markets, _at_subscribe_req, "markets")
        .DEF_PROPERTY2(symbols, _at_subscribe_req, "symbols")
        .DEF_PROPERTY2(granularities, _at_subscribe_req, "granularities")
        .DEF_PROPERTY2(qualified_names, _at_subscribe_req, "qualifiedNames")
        .DEF_PROPERTY2(fields, _at_subscribe_req, "fields")
        .DEF_PROPERTY2(start, _at_subscribe_req, "start")
        .DEF_PROPERTY2(end, _at_subscribe_req, "end")
        .DEF_PROPERTY2(sort, _at_subscribe_req, "sort")
        .DEF_PROPERTY2(direction, _at_subscribe_req, "direction")
        .DEF_PROPERTY2(filters, _at_subscribe_req, "filters")
        .DEF_ENCODE(_at_subscribe_req)
    ;

    class_<_at_subscribe_res, base<_base_response>>("ATSubscribeRes")
        .constructor<>()
        .constructor<int32_t, const std::string & >()
        // .property("uuid", &_at_subscribe_res::uuid)
        .DEF_PROPERTY2(uuid, _at_subscribe_res, "UUID")
        .function("decode", __decode_ws_binary_as_str<_at_subscribe_res>)
    ;

    class_<_at_unsubscribe_req, base<_base_request>>("ATUnsubscribeReq")
        .constructor<>()
        .constructor<const std::string &, int32_t>()
        .property("uuid", &_at_unsubscribe_req::uuid)
        .DEF_ENCODE(_at_unsubscribe_req)
        // .function("encode", __encode_ws_binary_as_str<_at_unsubscribe_req>)
    ;

    enum_<_inner_account_edit_op>("InnerAccountEditOp")
        .value("AddSubAccount", _inner_account_edit_op::AddSubAccount)
        .value("DelSubAccount", _inner_account_edit_op::DelSubAccount)
        .value("AssignTrader", _inner_account_edit_op::AssignTrader)
        .value("AssignStrategy", _inner_account_edit_op::AssignStrategy)
        .value("ChangePassword", _inner_account_edit_op::ChangePassword)
        .value("ChangeCapital", _inner_account_edit_op::ChangeCapital)
        .value("ChangeBasketCapital", _inner_account_edit_op::ChangeBasketCapital)
        .value("UpdatePattern", _inner_account_edit_op::UpdatePattern)
        .value("Rename", _inner_account_edit_op::Rename)
    ;

    class_<_execution_pattern>("ExecutionPattern")
        .constructor<>()
        .DEF_PROPERTY2(ref_account, _execution_pattern, "refAccount")
        .DEF_PROPERTY2(limit_order_reach_prob, _execution_pattern, "limitOrderReachProb")
        .DEF_PROPERTY2(limit_price_update_interval, _execution_pattern, "limitPriceUpdateInterval")
        .DEF_PROPERTY2(limit_order_better_price_prob, _execution_pattern, "limitOrderBetterPriceProb")
    ;

    class_<_inner_account_edit_basket_position>("BasketPosition")
        .constructor<>()
        // .DEF_ENCODE(_inner_account_edit_basket_position)
        .DEF_PROPERTY2(market_, _inner_account_edit_basket_position, "market")
        .DEF_PROPERTY2(symbol_, _inner_account_edit_basket_position, "symbol")
        .DEF_PROPERTY2(direction_, _inner_account_edit_basket_position, "direction")
        .DEF_PROPERTY2(volume_, _inner_account_edit_basket_position, "volume")
    ;
    register_vector<_inner_account_edit_basket_position>("BasketPositionVector");
    register_map<std::string, std::vector<_inner_account_edit_basket_position>>("BasketPositionMap");

    value_object<_inner_account_edit>("InnerAccountEdit")
        .field("uuid", &_inner_account_edit::uuid)
        .field("operation", &_inner_account_edit::operation)
        .field("password", &_inner_account_edit::password)
        .field("traderUUID", &_inner_account_edit::trader_uuid)
        .field("subAccountUUID", &_inner_account_edit::sub_account_uuid)
        .field("capital", &_inner_account_edit::capital)
        .field("strategyUUID", &_inner_account_edit::strategy_uuid)
        .field("strategyAccountUUID", &_inner_account_edit::strategy_account_uuid)
        .field("subAccountName", &_inner_account_edit::sub_account_name)
        .field("basketPositionMap", &_inner_account_edit::basket_position_map)
        .field("executionPattern", &_inner_account_edit::execution_pattern)
    ;
    // class_<_inner_account_edit>("InnerA")

    class_<_at_account_edit_req, base<_base_request>>("ATAccountEditReq")
        .constructor<>()
        .constructor<const std::string&, int32_t>()
        .property("entity", &_at_account_edit_req::get_entity,  &_at_account_edit_req::set_entity)
        .function("encode", __encode_ws_binary_as_str<_at_account_edit_req>)
    ;

    class_<_at_account_add_req, base<_base_request>>("ATAccountAddReq")
        .constructor<>()
        .constructor<const std::string&, int32_t>()
        // .function("encode", __encode_ws_binary_as_str<_at_account_add_req>)
        .DEF_ENCODE(_at_account_add_req)
        .DEF_PROPERTY2(uuid, _at_account_add_req, "UUID")
        .DEF_PROPERTY2(broker_uuid, _at_account_add_req, "brokerUUID")
        .DEF_PROPERTY2(code, _at_account_add_req, "code")
        .DEF_PROPERTY2(name, _at_account_add_req, "name")
        .DEF_PROPERTY2(password, _at_account_add_req, "password")
        .DEF_PROPERTY2(account_type, _at_account_add_req, "accountType")
        .DEF_PROPERTY2(category, _at_account_add_req, "category")
        .DEF_PROPERTY2(fix_account, _at_account_add_req, "FIXAccount")
        .DEF_PROPERTY2(fix_password, _at_account_add_req, "FIXPassword")
        .DEF_PROPERTY2(initial_cash, _at_account_add_req, "initialCash")
    ;

    class_<_at_account_add_res, base<_base_response>>("ATAccountAddRes")
        .constructor<>()
        .constructor<int , 
                    const std::string& , 
                    const std::string& , 
                    const std::string& , 
                    _account_type >()
        // .function("decode", __decode_ws_binary_as_str<_at_account_add_res>)
        .DEF_DECODE(_at_account_add_res)
        .DEF_PROPERTY2(physical_uuid, _at_account_add_res, "physicalUUID")
        .DEF_PROPERTY2(virtual_uuid, _at_account_add_res, "virtualUUID")
        .DEF_PROPERTY2(basket_uuid, _at_account_add_res, "basketUUID")
        .DEF_PROPERTY2(account_type, _at_account_add_res, "accountType")
    ;
    class_<_at_account_del_req, base<_base_request>>("ATAccountDelReq")
        .constructor<>()
        .constructor<const std::string&, int32_t>()
        .DEF_ENCODE(_at_account_del_req)
        .DEF_PROPERTY(uuid, _at_account_del_req)
    ;

    class_<_at_modify_basket_req, base<_base_request>>("ATModifyBasketReq")
        .constructor<>()
        .constructor<const std::string&, int32_t>()
        .DEF_ENCODE(_at_modify_basket_req)
        .DEF_PROPERTY2(parent_uuid, _at_modify_basket_req, "parentUUID")
        .DEF_PROPERTY2(basket_uuid, _at_modify_basket_req, "basketUUID")
        .DEF_PROPERTY2(capital, _at_modify_basket_req, "capital")
        .DEF_PROPERTY2(leverage, _at_modify_basket_req, "leverage")
    ;
    enum_<_entrust_complex_price_type>("EntrustComplexPriceType")
        .value("ENTRUST_CPT_NONE", _entrust_complex_price_type::ENTRUST_CPT_NONE)
        .value("ENTRUST_CPT_CANCEL_RANGE", _entrust_complex_price_type::ENTRUST_CPT_CANCEL_RANGE)
        .value("ENTRUST_CPT_PL_STOP", _entrust_complex_price_type::ENTRUST_CPT_PL_STOP)
        .value("ENTRUST_CPT_AUTO", _entrust_complex_price_type::ENTRUST_CPT_AUTO)
    ;
    enum_<_entrust_complex_volume_type>("EntrustComplexVolumeType")
        .value("ENTRUST_CVT_NONE", _entrust_complex_volume_type::ENTRUST_CVT_NONE)
        .value("ENTRUST_CVT_LOT", _entrust_complex_volume_type::ENTRUST_CVT_LOT)
        .value("ENTRUST_CVT_LEVERAGE", _entrust_complex_volume_type::ENTRUST_CVT_LEVERAGE)
    ;
    enum_<_entrust_order_volume_type>("EntrustOrderVolumeType")
        .value("ENTRUST_VOLUME_SINGLE", _entrust_order_volume_type::ENTRUST_VOLUME_SINGLE)
        .value("ENTRUST_VOLUME_MULTIPLE", _entrust_order_volume_type::ENTRUST_VOLUME_MULTIPLE)
    ;
    enum_<_entrust_complex_cleanup_leverage_type>("EntrustCleanupLeverageType")
        .value("ENTRUST_CLEANUP_LEVERAGE_NONE", _entrust_complex_cleanup_leverage_type::ENTRUST_CLEANUP_LEVERAGE_NONE)
        .value("ENTRUST_CLEANUP_LEVERAGE_COMPLEX", _entrust_complex_cleanup_leverage_type::ENTRUST_CLEANUP_LEVERAGE_COMPLEX)
    ;
    enum_<_entrust_oc_type>("EntrustOCType")
        .value("ENTRUST_OC_OPEN", _entrust_oc_type::ENTRUST_OC_OPEN)
        .value("ENTRUST_OC_CLOSE", _entrust_oc_type::ENTRUST_OC_CLOSE)
        .value("ENTRUST_OC_TODAY_CLOSE", _entrust_oc_type::ENTRUST_OC_TODAY_CLOSE)
    ;
    enum_<_entrust_direction_type>("EntrustDirectionType")
        .value("ENTRUST_DIRECTION_BUY", _entrust_direction_type::ENTRUST_DIRECTION_BUY)
        .value("ENTRUST_DIRECTION_SELL", _entrust_direction_type::ENTRUST_DIRECTION_SELL)
        .value("ENTRUST_DIRECTION_CLEAR", _entrust_direction_type::ENTRUST_DIRECTION_CLEAR)
    ;

    enum_<_entrust_time_condition_type>("EntrustTimeConditionType")
        .value("ENTRUST_TC_IOC", _entrust_time_condition_type::ENTRUST_TC_IOC)
        .value("ENTRUST_TC_GFS", _entrust_time_condition_type::ENTRUST_TC_GFS)
        .value("ENTRUST_TC_GFD", _entrust_time_condition_type::ENTRUST_TC_GFD)
        .value("ENTRUST_TC_GTD", _entrust_time_condition_type::ENTRUST_TC_GTD)
        .value("ENTRUST_TC_GTC", _entrust_time_condition_type::ENTRUST_TC_GTC)
        .value("ENTRUST_TC_GFA", _entrust_time_condition_type::ENTRUST_TC_GFA)
        .value("ENTRUST_TC_GTT", _entrust_time_condition_type::ENTRUST_TC_GTT)
    ;
    enum_<_entrust_end_of_action>("EntrustEndOfAction")
        .value("ENTRUST_END_CANCEL", _entrust_end_of_action::ENTRUST_END_CANCEL)
        .value("ENTRUST_END_ROLLBACK", _entrust_end_of_action::ENTRUST_END_ROLLBACK)
    ;
    enum_<_entrust_order_mode>("EntrustOrderMode")
        .value("ENTRUST_ORDER_LIMIT", _entrust_order_mode::ENTRUST_ORDER_LIMIT)
        .value("ENTRUST_ORDER_MARKET", _entrust_order_mode::ENTRUST_ORDER_MARKET)
        .value("ENTRUST_ORDER_OPTIMAL", _entrust_order_mode::ENTRUST_ORDER_OPTIMAL)
        .value("ENTRUST_ORDER_MARKET_LOST", _entrust_order_mode::ENTRUST_ORDER_MARKET_LOST)
        .value("ENTRUST_ORDER_MARKET_PROFIT", _entrust_order_mode::ENTRUST_ORDER_MARKET_PROFIT)
        .value("ENTRUST_ORDER_LIMIT_LOST", _entrust_order_mode::ENTRUST_ORDER_LIMIT_LOST)
        .value("ENTRUST_ORDER_LIMIT_PROFIT", _entrust_order_mode::ENTRUST_ORDER_LIMIT_PROFIT)
        .value("ENTRUST_ORDER_COMPLEX", _entrust_order_mode::ENTRUST_ORDER_COMPLEX)
        .value("ENTRUST_ORDER_OPT_MARKET", _entrust_order_mode::ENTRUST_ORDER_OPT_MARKET)
    ;
    enum_<_entrust_order_status>("EntrustOrderStatus")
        .value("ENTRUST_OS_ALL_TRADED", _entrust_order_status::ENTRUST_OS_ALL_TRADED)
        .value("ENTRUST_OS_PART_TRADED", _entrust_order_status::ENTRUST_OS_PART_TRADED)
        .value("ENTRUST_OS_PART_TRADED_NOQUEUE", _entrust_order_status::ENTRUST_OS_PART_TRADED_NOQUEUE)
        .value("ENTRUST_OS_NOTRADE_QUEUE", _entrust_order_status::ENTRUST_OS_NOTRADE_QUEUE)
        .value("ENTRUST_OS_NOTRADE_NOQUEUE", _entrust_order_status::ENTRUST_OS_NOTRADE_NOQUEUE)
        .value("ENTRUST_OS_CANCELED", _entrust_order_status::ENTRUST_OS_CANCELED)
        .value("ENTRUST_OS_UNKNOWN", _entrust_order_status::ENTRUST_OS_UNKNOWN)
        .value("ENTRUST_OS_UNTOUCHED", _entrust_order_status::ENTRUST_OS_UNTOUCHED)
        .value("ENTRUST_OS_TOUCHED", _entrust_order_status::ENTRUST_OS_TOUCHED)
    ;
    enum_<_entrust_order_submit_status>("EntrustOrderSubmitStatus")
        .value("ENTRUST_OSS_UNKNOWN", _entrust_order_submit_status::ENTRUST_OSS_UNKNOWN)
        .value("ENTRUST_OSS_INSERT_SUBMITTED", _entrust_order_submit_status::ENTRUST_OSS_INSERT_SUBMITTED)
        .value("ENTRUST_OSS_CANCEL_SUBMITTED", _entrust_order_submit_status::ENTRUST_OSS_CANCEL_SUBMITTED)
        .value("ENTRUST_OSS_MODIFY_SUBMITTED", _entrust_order_submit_status::ENTRUST_OSS_MODIFY_SUBMITTED)
        .value("ENTRUST_OSS_ACCEPTED", _entrust_order_submit_status::ENTRUST_OSS_ACCEPTED)
        .value("ENTRUST_OSS_INSERT_REJECTED", _entrust_order_submit_status::ENTRUST_OSS_INSERT_REJECTED)
        .value("ENTRUST_OSS_CANCEL_REJECTED", _entrust_order_submit_status::ENTRUST_OSS_CANCEL_REJECTED)
        .value("ENTRUST_OSS_MODIFY_REJECTED", _entrust_order_submit_status::ENTRUST_OSS_MODIFY_REJECTED)
    ;
    enum_<_entrust_hedge_flag_type>("EntrustHedgeFlagType")
        .value("ENTRUST_HF_SPECULATION", _entrust_hedge_flag_type::ENTRUST_HF_SPECULATION)
        .value("ENTRUST_HF_ARBITRAGE", _entrust_hedge_flag_type::ENTRUST_HF_ARBITRAGE)
        .value("ENTRUST_HF_HEDGE", _entrust_hedge_flag_type::ENTRUST_HF_HEDGE)
        .value("ENTRUST_HF_MARKET_MAKER", _entrust_hedge_flag_type::ENTRUST_HF_MARKET_MAKER)
    ;
    enum_<_entrust_position_date>("EntrustPositionDate")
        .value("ENTRUST_PSD_TODAY", _entrust_position_date::ENTRUST_PSD_TODAY)
        .value("ENTRUST_PSD_HISTORIC", _entrust_position_date::ENTRUST_PSD_HISTORIC)
    ;
    enum_<_entrust_order_category>("EntrustOrderCategory")
        .value("ENTRUST_CATEGORY_REAL", _entrust_order_category::ENTRUST_CATEGORY_REAL)
        .value("ENTRUST_CATEGORY_LOGIC", _entrust_order_category::ENTRUST_CATEGORY_LOGIC)
    ;
    class_<_int_complex_price>("Int32ComplexPrice")
       .constructor<>()
       .DEF_PROPERTY2(lower_price, _int_complex_price, "lowerPrice") 
       .DEF_PROPERTY2(upper_price, _int_complex_price, "upperPrice") 
       .DEF_PROPERTY2(type, _int_complex_price, "type") 
    ;
    class_<_auto_price_context>("AutoPriceContext")
       .constructor<>()
       .DEF_PROPERTY2(order_type, _auto_price_context, "orderType") 
       .DEF_PROPERTY2(price_tick, _auto_price_context, "priceTick") 
       .DEF_PROPERTY2(price_percentage, _auto_price_context, "pricePercentage") 
       .DEF_PROPERTY2(resubmit_tick_condition, _auto_price_context, "resubmitTickCondition") 
       .DEF_PROPERTY2(resubmit_percentage_condition, _auto_price_context, "resubmitPercentageCondition") 
       .DEF_PROPERTY2(resubmit_time_condition, _auto_price_context, "resubmitTimeCondition") 
    ;
    class_<_int_complex_price_auto>("AutoInt32ComplexPrice")
       .constructor<>()
       .DEF_PROPERTY2(type, _int_complex_price_auto, "type") 
       .DEF_PROPERTY2(order_type, _int_complex_price_auto, "orderType") 
       .DEF_PROPERTY2(price_tick, _int_complex_price_auto, "priceTick") 
       .DEF_PROPERTY2(price_percentage, _int_complex_price_auto, "pricePercentage") 
       .DEF_PROPERTY2(resubmit_tick_condition, _int_complex_price_auto, "resubmitTickCondition") 
       .DEF_PROPERTY2(resubmit_percentage_condition, _int_complex_price_auto, "resubmitPercentageCondition") 
       .DEF_PROPERTY2(resubmit_time_condition, _int_complex_price_auto, "resubmitTimeCondition") 
    ;
    class_<_complex_volume_lot>("ComplexVolumeLot")
       .constructor<>()
       .DEF_PROPERTY2(volume_weight, _complex_volume_lot, "volumeWeight") 
       .DEF_PROPERTY2(volume_trigger, _complex_volume_lot, "volumeTrigger") 
       .DEF_PROPERTY2(volume_type, _complex_volume_lot, "volumeType") 
    ;
    class_<_complex_volume_leverage, base<_complex_volume_lot>>("ComplexVolumeLeverage")
       .constructor<>()
       .DEF_PROPERTY2(volume_precision, _complex_volume_leverage, "volumePrecision") 
       .DEF_PROPERTY2(leverage_inc_threshold_lot, _complex_volume_leverage, "leverageIncThresholdLot") 
       .DEF_PROPERTY2(leverage_dec_threshold_lot, _complex_volume_leverage, "leverageDecThresholdLot") 
       .DEF_PROPERTY2(leverage_inc_threshold_percentage, _complex_volume_leverage, "leverageIncThresholdPercentage") 
       .DEF_PROPERTY2(leverage_dec_threshold_percentage, _complex_volume_leverage, "leverageDecThresholdPercentage") 
    ;
    class_<_complex_clean_leverage_none>("BaseCleanLeverageProperties")
       .constructor<>()
       .DEF_PROPERTY2(type, _complex_clean_leverage_none, "type")
    ;
    class_<_complex_clean_leverage, base<_complex_clean_leverage_none>>("CleanLeverageProperties")
       .constructor<>()
       .DEF_PROPERTY2(volume_type, _complex_clean_leverage, "volumeType")
       .DEF_PROPERTY2(volume_weight, _complex_clean_leverage, "volumeWeight")
       .DEF_PROPERTY2(order_type, _auto_price_context, "orderType") 
       .DEF_PROPERTY2(price_tick, _auto_price_context, "priceTick") 
       .DEF_PROPERTY2(price_percentage, _auto_price_context, "pricePercentage") 
       .DEF_PROPERTY2(resubmit_tick_condition, _auto_price_context, "resubmitTickCondition") 
       .DEF_PROPERTY2(resubmit_percentage_condition, _auto_price_context, "resubmitPercentageCondition") 
       .DEF_PROPERTY2(resubmit_time_condition, _auto_price_context, "resubmitTimeCondition") 
    ;

    class_<_at_manual_trade_req, base<_base_request>>("ATManualTradeReq")
        .constructor<>()
        .constructor<const std::string&, int32_t>()
        .DEF_ENCODE(_at_manual_trade_req)
        .DEF_PROPERTY2(sub_account_id, _at_manual_trade_req, "subAccountID")
        .DEF_PROPERTY2(market, _at_manual_trade_req, "market")
        .DEF_PROPERTY2(code, _at_manual_trade_req, "code")
        .DEF_PROPERTY2(buy_sell, _at_manual_trade_req, "buySell")
        .DEF_PROPERTY2(open_close, _at_manual_trade_req, "openClose")
        .DEF_PROPERTY2(volume, _at_manual_trade_req, "volume")
        .DEF_PROPERTY2(price, _at_manual_trade_req, "price")
        .DEF_PROPERTY2(price_precision, _at_manual_trade_req, "pricePrecision")
        .DEF_PROPERTY2(order_type, _at_manual_trade_req, "orderType")
        .DEF_PROPERTY2(expire, _at_manual_trade_req, "expire")
        .DEF_PROPERTY2(parent_uuid, _at_manual_trade_req, "parentUUID")
        .DEF_PROPERTY2(complex_price_type, _at_manual_trade_req, "complexPriceType")
        .DEF_PROPERTY2(complex_price, _at_manual_trade_req, "complexPrice")
        .DEF_PROPERTY2(complex_price_auto, _at_manual_trade_req, "complexPriceAuto")
        .DEF_PROPERTY2(complex_volume_type, _at_manual_trade_req, "complexVolumeType")
        .DEF_PROPERTY2(complex_volume_lot, _at_manual_trade_req, "complexVolumeLot")
        .DEF_PROPERTY2(complex_volume_leverage, _at_manual_trade_req, "complexVolumeLeverage")
        .DEF_PROPERTY2(cleanup_volume_type, _at_manual_trade_req, "cleasnupVolumeType")
        .DEF_PROPERTY2(cleanup_volume_none, _at_manual_trade_req, "cleasnupVolumeNone")
        .DEF_PROPERTY2(cleanup_volume_leverage, _at_manual_trade_req, "cleasnupVolumeLeverage")
        .DEF_PROPERTY2(close_price_type, _at_manual_trade_req, "closePriceType")
        .DEF_PROPERTY2(close_price, _at_manual_trade_req, "closePrice")
    ;
    class_<_at_manual_trade_res, base<_base_response>>("ATManualTradeRes")
        .constructor<>()
        .DEF_DECODE(_at_manual_trade_res)
        .DEF_PROPERTY2(order_uuid, _at_manual_trade_res, "orderUUID")
    ;
    class_<_at_manual_trade_edit_req, base<_base_request>>("ATManualTradeEditReq")
        .constructor<>()
        .constructor<const std::string&, 
                    int32_t>()
        .DEF_ENCODE(_at_manual_trade_edit_req)
        .DEF_PROPERTY2(sub_account_id, _at_manual_trade_edit_req, "subAccountID")
        .DEF_PROPERTY2(volume, _at_manual_trade_edit_req, "volume")
        .DEF_PROPERTY2(order_uuid, _at_manual_trade_edit_req, "orderUUID")
        .DEF_PROPERTY2(phase, _at_manual_trade_edit_req, "phase")
    ;

    class_<_at_add_strategy_instance_req, base<_base_request>>("ATAddStrategyInstanceReq")
        .constructor<>()
        .constructor<const std::string&, 
                    int32_t,
                    int32_t,
                    int32_t,
                    std::vector<std::string>>()
        .DEF_ENCODE(_at_add_strategy_instance_req)
        .DEF_PROPERTY2(backtest_id, _at_add_strategy_instance_req, "basketID")
        .DEF_PROPERTY2(operator_id, _at_add_strategy_instance_req, "operatorID")
        .DEF_PROPERTY2(sub_accounts, _at_add_strategy_instance_req, "subAccounts")
    ;
    class_<_at_del_strategy_instance_req, base<_base_request>>("ATDelStrategyInstanceReq")
        .constructor<>()
        .constructor<const std::string&, 
                    int32_t,
                    const std::string&>()
        .DEF_ENCODE(_at_del_strategy_instance_req)
        .DEF_PROPERTY2(uuid, _at_del_strategy_instance_req, "UUID")
    ;
    class_<_at_edit_strategy_instance_req, base<_base_request>>("ATEditStrategyInstanceReq")
        .constructor<>()
        .constructor<const std::string&, 
                    int32_t,
                    const std::string&,
                    const std::string&,
                    int32_t,
                    std::vector<std::string>const&>()
        .DEF_ENCODE(_at_edit_strategy_instance_req)
        .DEF_PROPERTY2(uuid, _at_edit_strategy_instance_req, "UUID")
        .DEF_PROPERTY2(strategy_uuid, _at_edit_strategy_instance_req, "strategyUUID")
        .DEF_PROPERTY2(backtest_id, _at_edit_strategy_instance_req, "basketID")
        .DEF_PROPERTY2(sub_accounts, _at_edit_strategy_instance_req, "subAccounts")
    ;
    class_<_at_query_strategy_instance_req, base<_base_request>>("ATQueryStrategyInstanceReq")
        .constructor<>()
        .DEF_ENCODE(_at_query_strategy_instance_req)
        .DEF_PROPERTY2(uuid, _at_query_strategy_instance_req, "UUID")
        .DEF_PROPERTY2(strategy_uuid, _at_query_strategy_instance_req, "strategyUUID")
        .DEF_PROPERTY2(backtest_id, _at_query_strategy_instance_req, "backtestID")
        .DEF_PROPERTY2(strategy_status, _at_query_strategy_instance_req, "strategyStatus")
        .DEF_PROPERTY2(page, _at_query_strategy_instance_req, "page")
        .DEF_PROPERTY2(page_size, _at_query_strategy_instance_req, "pageSize")
    ;
    class_<_at_query_strategy_instance_log_req, base<_base_request>>("ATQueryStrategyInstanceLogReq")
        .constructor<>()
        .DEF_ENCODE(_at_query_strategy_instance_log_req)
        .DEF_PROPERTY2(uuid, _at_query_strategy_instance_log_req, "UUID")
    ;
    class_<_at_subscribe_order_res, base<_base_response>>("ATSubscribeOrderRes")
        .constructor<>()
        .DEF_DECODE(_at_subscribe_order_res)
        .DEF_PROPERTY2(uuid, _at_subscribe_order_res, "UUID")
        .DEF_PROPERTY2(markets, _at_subscribe_order_res, "markets")
        .DEF_PROPERTY2(symbols, _at_subscribe_order_res, "symbols")
        .DEF_PROPERTY2(granularities, _at_subscribe_order_res, "granularities")
    ;
    class_<_at_add_strategy_instance_res, base<_base_response>>("ATAddStrategyInstanceRes")
        .constructor<>()
        .DEF_DECODE(_at_add_strategy_instance_res)
        .DEF_PROPERTY2(uuid, _at_add_strategy_instance_res, "UUID")
    ;
    class_<_strategy_instance>("StrategyInstance")
        .constructor<>()
        .DEF_PROPERTY2(uuid, _strategy_instance, "UUID")
        .DEF_PROPERTY2(strategy_uuid, _strategy_instance, "strategyUUID")
        .DEF_PROPERTY2(backtest_id, _strategy_instance, "backtestID")
        .DEF_PROPERTY2(status, _strategy_instance, "status")
    ;
    register_vector<_strategy_instance>("StrategyInstanceVector");
    
    class_<_at_query_strategy_instance_res, base<_base_response>>("ATQueryStrategyInstanceRes")
        .constructor<>()
        .DEF_DECODE(_at_query_strategy_instance_res)
        .DEF_PROPERTY2(instances, _at_query_strategy_instance_res, "instances")
    ;    
    class_<_at_base_formula_req, base<_base_request>>("ATBaseFormulaReq")
        .constructor<>()
        .constructor<const std::string&, int32_t>()
        .DEF_ENCODE(_at_base_formula_req)
        .DEF_PROPERTY2(user_id_, _at_base_formula_req, "userID")
    ;
    class_<_at_reg_formula_req, base<_at_base_formula_req>>("ATRegFormulaReq")
        .constructor<>()
        .constructor<const std::string&, 
                    int32_t,
                    uint64_t,
                    uint32_t,
                    std::string
                    >()
        .DEF_ENCODE(_at_reg_formula_req)
        .DEF_PROPERTY2(id_, _at_reg_formula_req, "ID")
        .DEF_PROPERTY2(language_id_, _at_reg_formula_req, "languageID")
        .DEF_PROPERTY2(source_code_, _at_reg_formula_req, "sourceCode")
    ;
    class_<_at_reg_formula_res, base<_base_response>>("ATRegFormulaRes")
        .constructor<>()
        .DEF_DECODE(_at_reg_formula_res)
        .DEF_PROPERTY2(uuid, _at_reg_formula_res, "UUID")
    ;
    class_<_at_del_formula_req, base<_at_base_formula_req>>("ATDelFormulaReq")
        .constructor<>()
        .constructor<const std::string& , 
                    int32_t , 
                    const std::string &>()
        .DEF_ENCODE(_at_del_formula_req)
        .DEF_PROPERTY2(uuid_, _at_del_formula_req, "UUID")
    ;
    class_<_at_cal_formula_req, base<_at_base_formula_req>>("ATCalFormulaReq")
        .constructor<>()
        .constructor<const std::string& ,
                    int ,
                    const std::string& ,
                    const std::string& ,
                    const std::vector<std::string>& ,
                    Int32 ,
                    Uint64 ,
                    Uint64 ,
                    const std::string& ,
                    const std::string& ,
                    Int32 >()
        .DEF_ENCODE(_at_cal_formula_req)
        .DEF_PROPERTY2(uuid_, _at_cal_formula_req, "UUID")
        .DEF_PROPERTY2(market_, _at_cal_formula_req, "market")
        .DEF_PROPERTY2(codes_, _at_cal_formula_req, "codes")
        .DEF_PROPERTY2(granularity_, _at_cal_formula_req, "granularity")
        .DEF_PROPERTY2(begin_time_, _at_cal_formula_req, "beginTime")
        .DEF_PROPERTY2(end_time_, _at_cal_formula_req, "endTime")
        .DEF_PROPERTY2(is_real_time_, _at_cal_formula_req, "isRealTime")
        .DEF_PROPERTY2(benchmark_market_, _at_cal_formula_req, "benchmarkMarket")
        .DEF_PROPERTY2(benchmark_symbol_, _at_cal_formula_req, "benchmarkSymbol")
    ;

    enum_<_formula_chart_type>("FormulaChartType")
        .value("POLYLINE", _formula_chart_type::POLYLINE)
        .value("CANDLE_STICK", _formula_chart_type::CANDLE_STICK)
        .value("AREA", _formula_chart_type::AREA)
        .value("BAR", _formula_chart_type::BAR)
        .value("BINARY_BAR", _formula_chart_type::BINARY_BAR)
        .value("TEXT", _formula_chart_type::TEXT)
        .value("VERTLINE", _formula_chart_type::VERTLINE)
        .value("HLINE", _formula_chart_type::HLINE)
        .value("ICON", _formula_chart_type::ICON)
        .value("GBK", _formula_chart_type::GBK)
        .value("GBKLAST", _formula_chart_type::GBKLAST)
        .value("FILLRGN", _formula_chart_type::FILLRGN)
        .value("PARTLINE", _formula_chart_type::PARTLINE)
        .value("_RGB", _formula_chart_type::_RGB)
        .value("STRIP", _formula_chart_type::STRIP)
        .value("UNKNOWN", _formula_chart_type::UNKNOWN)
    ;
    enum_<_formula_variable_type>("FormulaVariableType")
        .value("INTEGER",_formula_variable_type::tInteger)
        .value("DOUBLE",_formula_variable_type::tDouble)
        .value("BOOLEAN",_formula_variable_type::tBoolean)
        .value("STRING",_formula_variable_type::tString)
        .value("UNKNOWN",_formula_variable_type::tUnknown)
        .value("DEFINITION",_formula_variable_type::tDefinition)
        .value("CHART",_formula_variable_type::tChart)
    ;
    register_vector<_formula_variable_type>("FormulaVariableTypeVector");

    class_<_formula_chart>("FormulaChart")
        .constructor<>()
        .function("doubleVectorAt", &_formula_chart::get<double_t>)
        .function("int32VectorAt", &_formula_chart::get<int32_t>)
        .function("stringVectorAt", &_formula_chart::get<std::string>)
        .function("booleanVectorAt", &_formula_chart::getbool)
        .DEF_PROPERTY2(type_, _formula_chart, "type")
        .DEF_PROPERTY2(name_, _formula_chart, "name")
        .DEF_PROPERTY2(function_name_, _formula_chart, "functionName")
        .DEF_PROPERTY2(variable_types_, _formula_chart, "variableTypes")
        .DEF_PROPERTY2(properties_, _formula_chart, "properties")
    ;
    register_vector<uint8_t>("Uint8Vector");
    register_vector<_formula_chart>("FormulaChartVector");
    // register_vector<bool>("BooleanVector");
    class_<_at_cal_formula_res, base<_base_response>>("ATCalFormulaRes")
        .constructor<>()
        .DEF_DECODE(_at_cal_formula_res)
        .DEF_PROPERTY2(uuid, _at_cal_formula_res, "UUID")
        .DEF_PROPERTY2(charts_, _at_cal_formula_res, "charts")
        .DEF_PROPERTY2(doodles_, _at_cal_formula_res, "doodles")
        .DEF_PROPERTY2(time_tags_, _at_cal_formula_res, "timeTags")
        // .DEF_PROPERTY2(formula_res, _at_cal_formula_res, "formulaRes")

    ;    
    class_<_at_cal_formula_rt_res, base<_base_response>>("ATCalFormulaRTRes")
        .constructor<>()
        .DEF_DECODE(_at_cal_formula_rt_res)
        .DEF_PROPERTY2(uuid_, _at_cal_formula_rt_res, "UUID")
        .DEF_PROPERTY2(market_, _at_cal_formula_rt_res, "market")
        .DEF_PROPERTY2(codes_, _at_cal_formula_rt_res, "codes")
        .DEF_PROPERTY2(granularity_, _at_cal_formula_rt_res, "granularity")
        .DEF_PROPERTY2(time_tags_, _at_cal_formula_rt_res, "timeTags")
        .DEF_PROPERTY2(charts_, _at_cal_formula_rt_res, "charts")
        .DEF_PROPERTY2(doodles_, _at_cal_formula_rt_res, "doodles")
        // .DEF_PROPERTY2(formula_res, _at_cal_formula_res, "formulaRes")

    ;    

    register_map<std::string, std::string>("LibraryMap");

    class_<_at_reg_libraries_req, base<_at_base_formula_req>>("ATRegLibrariesReq")
        .constructor<>()
        .constructor<const std::string & , 
                    int , 
                    std::map<std::string, std::string> >()
        .DEF_ENCODE(_at_reg_libraries_req)
        .DEF_PROPERTY2(libraries_, _at_reg_libraries_req, "libraries")
    ;
    class_<_reg_libraries_detail>("RegLibrariesDetail")
        .constructor<>()
        .DEF_PROPERTY2(name, _reg_libraries_detail, "name")
        .DEF_PROPERTY2(error_code, _reg_libraries_detail, "errorCode")
        .DEF_PROPERTY2(message, _reg_libraries_detail, "message")
    ;
    register_vector<_reg_libraries_detail>("RegLibDetailVector");

    class_<_at_reg_libraries_res, base<_base_response>>("ATRegLibrariesRes")
        .constructor<>()
        .DEF_DECODE(_at_reg_libraries_res)
        .DEF_PROPERTY2(details, _at_reg_libraries_res, "details")
    ;    
    class_<_at_subscribe_sv_res, base<_base_response>>("ATSubscribeSVRes")
        .constructor<>()
        .smart_ptr<boost::shared_ptr<_at_subscribe_sv_res>>("ATSubscribeSVRes")
        .function("values", &_get_sub_sv_values)
        .function("setCompressor", &_set_compressor<_at_subscribe_sv_res>)
        .DEF_DECODE(_at_subscribe_sv_res)
        .DEF_PROPERTY2(fields, _at_subscribe_sv_res, "fields")
    ;

    enum_<_market_state>("MarketState")
        .value("Open", _market_state::Open)
        .value("Close", _market_state::Close)
        .value("TradeDayBegin", _market_state::TradeDayBegin)
        .value("TradeDayEnd", _market_state::TradeDayEnd)
        .value("Tick", _market_state::Tick)
    ;
    class_<_market_status_res>("MarketStatusRes")
        .constructor<>()
        .DEF_PROPERTY2(code, _market_status_res, "code")
        .DEF_PROPERTY2(trade_day, _market_status_res, "tradeDay")
        .DEF_PROPERTY2(state, _market_status_res, "state")
        .DEF_PROPERTY2(status, _market_status_res, "status")
        .DEF_PROPERTY2(time_tag, _market_status_res, "timeTag")
    ;    
    class_<_ta_market_status_notification, base<_base_response>>("TAMarketStatusNotification")
        .constructor<>()
        .DEF_DECODE(_ta_market_status_notification)
        .DEF_PROPERTY2(entity, _ta_market_status_notification, "entity")
    ;
    class_<_progress_res, base<_base_response>>("ProgressRes")
        .constructor<>()
        .smart_ptr<boost::shared_ptr<_progress_res>>("ProgressRes")
        .DEF_DECODE(_progress_res)
        .DEF_PROPERTY2(rate, _progress_res, "rate")
    ;
    class_<_log_res, base<_base_response>>("LogRes")
        .constructor<>()
        .smart_ptr<boost::shared_ptr<_log_res>>("LogRes")
        .DEF_DECODE(_log_res)
        .DEF_PROPERTY2(log, _log_res, "log")
    ;

    enum_<_trade_otc_op_category>("TradeOTCOpCategory")
        .value("MovePosition", _trade_otc_op_category::MovePosition)
        .value("AddTransaction", _trade_otc_op_category::AddTransaction)
    ;

    class_<_trade_otc_op>("TradeOTCOp")
        .constructor<>()
        .DEF_PROPERTY2(operation, _trade_otc_op, "operation")
        .DEF_PROPERTY2(source_account_type, _trade_otc_op, "sourceAccountType")
        .DEF_PROPERTY2(source_account_uuid, _trade_otc_op, "sourceAccountUUID")
        .DEF_PROPERTY2(dest_account_type, _trade_otc_op, "destAccountType")
        .DEF_PROPERTY2(dest_account_uuid, _trade_otc_op, "destAccountUUID")
        .DEF_PROPERTY2(market, _trade_otc_op, "market")
        .DEF_PROPERTY2(symbol, _trade_otc_op, "symbol")
        .DEF_PROPERTY2(buy_sell, _trade_otc_op, "buySell")
        .DEF_PROPERTY2(open_close, _trade_otc_op, "openClose")
        .DEF_PROPERTY2(volume, _trade_otc_op, "volume")
        .DEF_PROPERTY2(price, _trade_otc_op, "price")
        .DEF_PROPERTY2(price_precision, _trade_otc_op, "pricePrecision")
        .DEF_PROPERTY2(fee, _trade_otc_op, "fee")
    ;

    class_<_at_otc_operation_req, base<_base_request>>("ATOTCOperationReq")
        .constructor<>()
        .DEF_PROPERTY2(entity, _at_otc_operation_req, "entity")
    ;

    class_<_at_account_change_capital_req, base<_base_request>>("ATAccountChangeCapitalReq")
        .constructor<>()
        .DEF_PROPERTY2(capital, _at_account_change_capital_req, "capital")
        .DEF_PROPERTY2(uuid, _at_account_change_capital_req, "UUID")
        .DEF_ENCODE(_at_account_change_capital_req)
    ;

    enum_<_query_col>("MonitorQueryCol")
        .value("HOSTID", _query_col::HOSTID)
        .value("PID", _query_col::PID)
        .value("CMD", _query_col::CMD)
        .value("CPU", _query_col::CPU)
        .value("THREADS", _query_col::THREADS)
        .value("MEM", _query_col::MEM)
        .value("MEMP", _query_col::MEMP)
        .value("WORKER_NO", _query_col::WORKER_NO)
        .value("PROFILE", _query_col::PROFILE)
        .value("TIME", _query_col::TIME)
        .value("IO_READ_RATE", _query_col::IO_READ_RATE)
        .value("IO_WRITE_RATE", _query_col::IO_WRITE_RATE)
        .value("HOST", _query_col::HOST)
        .value("SOURCE_CODE", _query_col::SOURCE_CODE)
    ;

    class_<_process_info>("MonitorProcessInfo")
        .constructor<>()
        .DEF_PROPERTY2(pid, _process_info, "pid")
        .DEF_PROPERTY2(cmd, _process_info, "cmd")
        .DEF_PROPERTY2(cpu, _process_info, "cpu")
        .DEF_PROPERTY2(threads, _process_info, "threads")
        .DEF_PROPERTY2(mem, _process_info, "mem")
        .DEF_PROPERTY2(memp, _process_info, "memp")
        .DEF_PROPERTY2(time, _process_info, "time")
        .DEF_PROPERTY2(io_read_rate, _process_info, "ioReadRate")
        .DEF_PROPERTY2(io_write_rate, _process_info, "ioWriteRate")
        .DEF_PROPERTY2(last_io_read, _process_info, "lastIORead")
        .DEF_PROPERTY2(last_io_write, _process_info, "lastIOWrite")
        .DEF_PROPERTY2(last_time, _process_info, "lastTime")
        .DEF_PROPERTY2(last_io_read_rate, _process_info, "lastIOReadRate")
        .DEF_PROPERTY2(last_io_write_rate, _process_info, "lastIOWriteRate")
        // .DEF_DECODE(_process_info)
    ;

    class_<_python3_calculator, base<_process_info>>("MonitorPython3Calculator")
        .constructor<>()
        .DEF_PROPERTY2(host_id, _python3_calculator, "hostID")
        .DEF_PROPERTY2(host, _python3_calculator, "host")
        .DEF_PROPERTY2(source_code, _python3_calculator, "sourceCode")
        .DEF_PROPERTY2(session_id, _python3_calculator, "sessionID")
        .DEF_PROPERTY2(mod_name, _python3_calculator, "modName")
        .DEF_PROPERTY2(cwd, _python3_calculator, "cwd")
        .DEF_PROPERTY2(work_no, _python3_calculator, "workerNo")
        .DEF_PROPERTY2(profile, _python3_calculator, "profile")
        .DEF_DECODE_COMMON(_python3_calculator)
    ;

    class_<_at_query_backtest_procs_req, base<_base_request>>("ATQueryBacktestProcsReq")
        .constructor<>()
        .DEF_PROPERTY2(session_id, _at_query_backtest_procs_req, "sessionID")
        .DEF_PROPERTY2(cols, _at_query_backtest_procs_req, "cols")
        .DEF_ENCODE(_at_query_backtest_procs_req)
    ;
    register_vector<_python3_calculator>("Python3CalculatorVector");

    class_<_at_query_backtest_procs_res, base<_base_response>>("ATQueryBacktestProcsRes")
        .constructor<>()
        .DEF_PROPERTY2(procs, _at_query_backtest_procs_res, "procs")
        .DEF_DECODE(_at_query_backtest_procs_res)
    ;

    class_<_at_query_backtest_proc_log_req, base<_base_request>>("ATQueryBacktestProcLogReq")
        .constructor<>()
        .DEF_PROPERTY2(session_id, _at_query_backtest_proc_log_req, "sessionID")
        .DEF_PROPERTY2(worker_no, _at_query_backtest_proc_log_req, "workerNo")
        .DEF_PROPERTY2(log_name, _at_query_backtest_proc_log_req, "logName")
        .DEF_PROPERTY2(lines, _at_query_backtest_proc_log_req, "lines")
        .DEF_PROPERTY2(forever, _at_query_backtest_proc_log_req, "forever")
        .DEF_PROPERTY2(host_id, _at_query_backtest_proc_log_req, "hostID")
        .DEF_ENCODE(_at_query_backtest_proc_log_req)
    ;
    
    class_<_at_query_backtest_proc_log_res, base<_base_response>>("ATQueryBacktestProcLogRes")
        .constructor<>()
        .DEF_PROPERTY2(lines, _at_query_backtest_proc_log_res, "lines")
        .DEF_DECODE(_at_query_backtest_proc_log_res)
    ;
    class_<_at_query_backtest_proc_control_req, base<_base_request>>("ATQueryBacktestProcControlReq")
        .constructor<>()
        .DEF_PROPERTY2(session_id, _at_query_backtest_proc_control_req, "sessionID")
        .DEF_PROPERTY2(worker_no, _at_query_backtest_proc_control_req, "workerNo")
        .DEF_PROPERTY2(operation, _at_query_backtest_proc_control_req, "operation")
        .DEF_ENCODE(_at_query_backtest_proc_control_req)
    ;
    enum_<_account_limit_context>("AccountLimitContext")
        .value("PhysicalAccount", _account_limit_context::PhysicalAccount)
        .value("SubAccount", _account_limit_context::SubAccount)
        .value("Basket", _account_limit_context::Basket)
        .value("Trader", _account_limit_context::Trader)
        .value("Strategy", _account_limit_context::Strategy)
    ;

    enum_<_account_limit_code_type>("AccountLimitCodeType")
        .value("Commodity", _account_limit_code_type::Commodity)
        .value("Contract", _account_limit_code_type::Contract)
    ;

    enum_<_account_limit_access>("AccountLimitAccess")
        .value("EXPOSURE_VOL", _account_limit_access::EXPOSURE_VOL)
        .value("EXPOSURE_VAL", _account_limit_access::EXPOSURE_VAL)
        .value("INTRADAY_TRADE_VOL", _account_limit_access::INTRADAY_TRADE_VOL)
        .value("ENDOFDAY_POSITION", _account_limit_access::ENDOFDAY_POSITION)
        .value("SINGLE_ORDER_VOL", _account_limit_access::SINGLE_ORDER_VOL)
        .value("ORDER_PRICE_REL_OFFSET", _account_limit_access::ORDER_PRICE_REL_OFFSET)
        .value("ORDER_TYPES", _account_limit_access::ORDER_TYPES)
        .value("REL_FLOATING_PNL", _account_limit_access::REL_FLOATING_PNL)
        .value("REL_TOTAL_PNL", _account_limit_access::REL_TOTAL_PNL)
        .value("ABS_FLOATING_PNL", _account_limit_access::ABS_FLOATING_PNL)
        .value("ABS_TOTAL_PNL", _account_limit_access::ABS_TOTAL_PNL)
        .value("INTRADAY_CANCEL_TIMES", _account_limit_access::INTRADAY_CANCEL_TIMES)
        .value("TRADABLE", _account_limit_access::TRADABLE)
    ;

    enum_<_account_limit_breach_action_id>("AccountLimitBreachActionID")
        .value("None", _account_limit_breach_action_id::None)
        .value("Freeze", _account_limit_breach_action_id::Freeze)
        .value("Clear", _account_limit_breach_action_id::Clear)
        .value("ClearNetExposure", _account_limit_breach_action_id::ClearNetExposure)
        .value("Reject", _account_limit_breach_action_id::Reject)
    ;
    enum_<_account_limit_state>("AccountLimitState")
        .value("Normal", _account_limit_state::Normal)
        .value("Fail", _account_limit_state::Fail)
        .value("Nearly", _account_limit_state::Nearly)
    ;

    enum_<_account_limit_status>("AccountLimitStatus")
        .value("Active", _account_limit_status::Active)
        .value("InActive", _account_limit_status::InActive)
    ;
    enum_<_account_limit_account_status>("AccountLimitAccountStatus")
        .value("Working", _account_limit_account_status::Working)
        .value("Freezed", _account_limit_account_status::Freezed)
    ;
    enum_<_account_limit_skip_type>("AccountLimitSkipType")
        .value("Entity", _account_limit_skip_type::Entity)
        .value("Breach", _account_limit_skip_type::Breach)
    ;
    enum_<_account_limit_breach_action_period_type>("AccountLimitBreachActionPeriodType")
        .value("TimePeriod", _account_limit_breach_action_period_type::TimePeriod)
        .value("TradeDay", _account_limit_breach_action_period_type::TradeDay)
    ;

    class_<_account_limit_breach_action>("BreachAction")
        .constructor<>()
        .DEF_PROPERTY2(action_id, _account_limit_breach_action, "actionID")
        .DEF_PROPERTY2(type, _account_limit_breach_action, "type")
        .DEF_PROPERTY2(for_how_long, _account_limit_breach_action, "forHowLong")
    ;
    class_<_account_limit_trade_account_limit>("TradeAccountLimit")
        .constructor<>()
        .DEF_PROPERTY2(id, _account_limit_trade_account_limit, "ID")
        .DEF_PROPERTY2(access_id, _account_limit_trade_account_limit, "accessID")
        .DEF_PROPERTY2(market, _account_limit_trade_account_limit, "market")
        .DEF_PROPERTY2(code, _account_limit_trade_account_limit, "code")
        .DEF_PROPERTY2(code_type, _account_limit_trade_account_limit, "codeType")
        .DEF_PROPERTY2(enum_value, _account_limit_trade_account_limit, "enumValue")
        .DEF_PROPERTY2(scale, _account_limit_trade_account_limit, "scale")
        .DEF_PROPERTY2(lower_bound, _account_limit_trade_account_limit, "lowerBound")
        .DEF_PROPERTY2(upper_bound, _account_limit_trade_account_limit, "upperBound")
        .DEF_PROPERTY2(lower_bound_breach_action, _account_limit_trade_account_limit, "lowerBoundBreachAction")
        .DEF_PROPERTY2(upper_bound_breach_action, _account_limit_trade_account_limit, "upperBoundBreachAction")
    ;
    class_<_at_add_limits_req, base<_base_request>>("ATAddLimitsReq")
        .constructor<>()
        .DEF_PROPERTY2(context, _at_add_limits_req, "context")
        .DEF_PROPERTY2(entity_uuid, _at_add_limits_req, "entityUUID")
        .DEF_PROPERTY2(limit, _at_add_limits_req, "limit")
        .DEF_ENCODE(_at_add_limits_req)
    ;
    class_<_at_del_limits_req, base<_base_request>>("ATDelLimitsReq")
        .constructor<>()
        .DEF_PROPERTY2(entity_uuid, _at_del_limits_req, "entityUUID")
        .DEF_PROPERTY2(context, _at_del_limits_req, "context")
        .DEF_PROPERTY2(id, _at_del_limits_req, "ID")
        .DEF_ENCODE(_at_del_limits_req)
    ;
    class_<_at_skip_breach_req, base<_base_request>>("ATSkipBreachReq")
        .constructor<>()
        .DEF_PROPERTY2(context, _at_skip_breach_req, "context")
        .DEF_PROPERTY2(entity_uuid, _at_skip_breach_req, "entityUUID")
        .DEF_PROPERTY2(limit_id, _at_skip_breach_req, "limitID")
        .DEF_PROPERTY2(type, _at_skip_breach_req, "type")
        .DEF_ENCODE(_at_skip_breach_req)
    ;
    class_<_index_data_struct_share_opt>("BacktestShareOption")
        .constructor<>()
        .DEF_PROPERTY2(all, _index_data_struct_share_opt, "all")
        .DEF_PROPERTY2(user_ids, _index_data_struct_share_opt, "userIDs")
    ;

    class_<_at_share_backtest_req, base<_at_query_backtest_req>>("ATShareBacktestReq")
        .constructor<>()
        .DEF_PROPERTY2(share, _at_share_backtest_req, "option")
        .DEF_ENCODE(_at_share_backtest_req)
        .DEF_DECODE(_at_share_backtest_req)
    ;
}
