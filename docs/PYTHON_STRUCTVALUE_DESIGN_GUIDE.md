# StructValue Design Guide: Wolverine Time Series Data Framework

## Overview

StructValue is the core data structure in the Wolverine financial time series system, designed to represent a single frame of time series data in a highly efficient, typed, and serializable format. It serves as the fundamental building block for all financial data processing, indicator calculations, and trading strategy implementations.

## Architecture Philosophy

Wolverine operates on a **satellite-planet model** where:
- **Global namespace** acts as the "planet" - central data repository
- **Private namespaces** act as "satellites" - individual strategy instances
- Data flows from global to private for processing and calculation
- Computed results can be saved back to global for sharing

## StructValue Key Design

### 6-Dimensional Key Structure

Every StructValue is uniquely identified by a 6-dimensional key:

```python
Key = (namespace, meta_name, granularity, market, stock_code, time_tag)
```

#### Key Components

1. **`namespace`** (int): Data scope identifier
   - `pc.namespace_global` (0): Shared global data
   - `pc.namespace_private` (1): Instance-specific data

2. **`meta_name`** (str): Indicator/strategy class name
   - Unique identifier for the data structure type
   - Examples: "SampleQuote", "MACD", "RSI", "MyStrategy"

3. **`granularity`** (int): Time frame in seconds
   - 60: 1-minute bars
   - 300: 5-minute bars  
   - 900: 15-minute bars
   - 3600: 1-hour bars
   - 86400: Daily bars

4. **`market`** (bytes): Market identifier
   - "SHFE": Shanghai Futures Exchange
   - "DCE": Dalian Commodity Exchange
   - "CZCE": Zhengzhou Commodity Exchange

5. **`stock_code`** (bytes): Instrument identifier
   - "au2412": Gold December 2024 contract
   - "i2412": Iron ore December 2024 contract

6. **`time_tag`** (int64): UTC timestamp in milliseconds
   - Unix timestamp × 1000
   - Example: 1640995200000 = 2022-01-01 00:00:00 UTC

### StructValue Revision System

**CRITICAL**: Each StructValue has a `revision` property in its header that enables schema evolution and versioned field definitions.

#### Revision Architecture

1. **Meta Definitions with Multiple Revisions**
   - Each meta (data structure type) can have one or many revisions
   - Each revision can have different field definitions
   - Meta name remains constant across all revisions within a namespace
   - System records all revisions received from server schema

```python
# Example: SampleQuote meta with multiple revisions
sample_quote_revisions = {
    0: {  # Original revision - basic OHLC
        'fields': [('open', pc.data_type_double), ('close', pc.data_type_double), 
                   ('high', pc.data_type_double), ('low', pc.data_type_double)],
        'field_count': 4
    },
    1: {  # Updated revision - added volume and turnover
        'fields': [('open', pc.data_type_double), ('close', pc.data_type_double),
                   ('high', pc.data_type_double), ('low', pc.data_type_double),
                   ('volume', pc.data_type_int_64), ('turnover', pc.data_type_double)],
        'field_count': 6
    }
}
```

2. **Revision Properties and Usage**
   - **StructValue header**: Contains `revision` property indicating data structure version
   - **Schema storage**: Server schema contains all known revisions for each meta
   - **sv_object targeting**: Can specify desired revision or use `0xFFFFFFFF` for latest
   - **Query specification**: All queries and real-time subscriptions must specify revision

```python
# Accessing StructValue revision
sv = struct_value_from_server
print(f"Revision: {sv.get_revision()}")    # e.g., 1
print(f"MetaID: {sv.get_meta_id()}")       # e.g., 1 (SampleQuote)
print(f"Namespace: {sv.get_namespace()}")  # e.g., 0 (global)

# sv_object with specific revision
class MyIndicator(sv_object):
    def __init__(self):
        super().__init__()
        self.revision = 1           # Use specific revision
        # self.revision = 0xFFFFFFFF  # Use latest available revision
        self.meta_name = "MyIndicator"

# Query with revision specification
subscription_req = pc.ATSubscribeReq()
subscription_req.set_revision(1)        # Must specify revision
subscription_req.set_namespace(pc.namespace_global)
subscription_req.set_meta_name(b"SampleQuote")
subscription_req.set_market(b"SHFE")
subscription_req.set_stock_code(b"au2412")
```

3. **Schema Revision Management in Client**

```python
def _load_index_serializer(self, body: bytes):
    """Load schema definitions with revision support."""
    
    # 1. Load schema
    schema = pc.IndexSchema()
    schema.load(body)
    
    # 2. Extract metadata with revision support
    metas: pc.IndexMetaVector = schema.metas()
    
    # 3. Organize by namespace, name, and revision
    self.schema_by_revision = {}  # namespace -> name -> revision -> meta
    self.schema_by_id = {}        # namespace -> metaID -> meta (latest revision)
    
    for meta in metas:
        _meta: pc.IndexMeta = meta
        namespace = _meta.get_namespace()
        meta_id = _meta.get_id()
        meta_name = _meta.get_name().decode('utf-8').split("::")[-1]
        revision = _meta.get_revision()
        
        # Store by namespace and ID (latest revision wins)
        if namespace not in self.schema_by_id:
            self.schema_by_id[namespace] = {}
        self.schema_by_id[namespace][meta_id] = meta
        
        # Store by namespace, name, and revision
        if namespace not in self.schema_by_revision:
            self.schema_by_revision[namespace] = {}
        if meta_name not in self.schema_by_revision[namespace]:
            self.schema_by_revision[namespace][meta_name] = {}
        self.schema_by_revision[namespace][meta_name][revision] = meta
        
        print(f"Loaded: {meta_name} revision {revision} (ID: {meta_id})")

# Access specific revision
def get_meta_revision(self, namespace, meta_name, revision):
    """Get specific revision of a meta."""
    if revision == 0xFFFFFFFF:
        # Get latest revision
        revisions = self.schema_by_revision[namespace][meta_name]
        latest_revision = max(revisions.keys())
        return revisions[latest_revision]
    else:
        return self.schema_by_revision[namespace][meta_name][revision]
```

4. **Field Access with Revision Awareness**

```python
def extract_with_revision(self, sv: pc.StructValue):
    """Extract data with revision-specific field definitions."""
    
    namespace = sv.get_namespace()
    meta_id = sv.get_meta_id()
    revision = sv.get_revision()
    
    # Get revision-specific metadata
    if namespace in self.schema_by_id and meta_id in self.schema_by_id[namespace]:
        meta = self.schema_by_id[namespace][meta_id]
        meta_name = meta.get_name().decode('utf-8').split("::")[-1]
        
        # Get specific revision meta if different from loaded
        if revision in self.schema_by_revision[namespace][meta_name]:
            revision_meta = self.schema_by_revision[namespace][meta_name][revision]
        else:
            print(f"Warning: Revision {revision} not found for {meta_name}, using latest")
            revision_meta = meta
        
        # Extract fields based on revision-specific definitions
        fields = revision_meta.get_fields()
        data = {}
        
        for i, field in enumerate(fields):
            field_name = field.get_name().decode('utf-8')
            field_type = field.get_type()
            
            if field_type == pc.data_type_double:
                data[field_name] = sv.get_double(i)
            elif field_type == pc.data_type_int:
                data[field_name] = sv.get_int(i)
            elif field_type == pc.data_type_int_64:
                data[field_name] = sv.get_int_64(i)
            elif field_type == pc.data_type_string:
                data[field_name] = sv.get_string(i)
            # ... handle other types
        
        return data
    
    raise ValueError(f"Unknown meta: namespace={namespace}, id={meta_id}")
```

### Field Type System

StructValue supports a rich type system for financial data:

```python
# Scalar Types
pc.data_type_int        # 32-bit integer
pc.data_type_double     # 64-bit floating point
pc.data_type_string     # UTF-8 string
pc.data_type_int_64     # 64-bit integer

# Vector Types  
pc.data_type_vint       # Vector of 32-bit integers
pc.data_type_vdouble    # Vector of 64-bit floating points
pc.data_type_vstring    # Vector of UTF-8 strings
pc.data_type_vint_64    # Vector of 64-bit integers
```

## Implementation Architecture

### Core Classes

#### 1. sv_object: Base StructValue Wrapper

The `sv_object` class provides a Python-friendly interface to StructValue:

```python
class sv_object(object):
    """Base class for all StructValue-based objects."""
    
    def __init__(self):
        # Core identification
        self.namespace: int = pc.namespace_private
        self.meta_id: int = 0
        self.meta_name: str = ''
        self.revision: int = 0          # CRITICAL: Revision number
        self.market: bytes = b''
        self.code: bytes = b''
        self.timetag: int = None
        self.granularity: int = None
        
        # Field definitions
        self.fields: list = []        # [(name, type), ...]
        self.fields_set: set = set()  # Fast lookup
        
        # Core StructValue instance
        self.sv: pc.StructValue = pc.StructValue()
        
        # Metadata and configuration
        self.meta: pc.IndexMeta = None
        self.overwrite: bool = True
        self.persistent: bool = True
```

#### 2. Field Definition and Type Mapping

Fields are defined through metadata and mapped to Python types:

```python
def index_meta_to_fields_def(meta: pc.IndexMeta):
    """Convert C++ IndexMeta to Python field definitions."""
    _fields = []
    fields: pc.FieldVector = meta.get_fields()
    
    for field in fields:
        k: pc.Field = field
        name: str = k.get_name().decode('utf-8')
        _type: int = k.get_type()
        _fields.append((name, _type))
    
    return _fields

# Example field definition:
[
    ('open', pc.data_type_double),
    ('close', pc.data_type_double), 
    ('high', pc.data_type_double),
    ('low', pc.data_type_double),
    ('volume', pc.data_type_int_64),
    ('signals', pc.data_type_vint),
    ('prices', pc.data_type_vdouble)
]
```

### Serialization and Deserialization

#### to_sv(): Python to StructValue

```python
def to_sv(self) -> pc.StructValue:
    """Serialize Python object to StructValue."""
    sv = self.sv
    
    # Set header information including revision
    sv.set_meta_id(self.meta_id)
    sv.set_revision(self.revision)      # CRITICAL: Include revision in header
    sv.set_market(self.market)
    sv.set_stock_code(self.code)
    sv.set_granularity(self.granularity)
    sv.set_time_tag(self.timetag)
    sv.set_namespace(self.namespace)
    
    # Set field values by type
    for i, (name, _type) in enumerate(self.fields):
        attr = self.get_sv_attr(name)
        
        if _type == pc.data_type_int:
            sv.set_int(i, int(attr))
        elif _type == pc.data_type_double:
            sv.set_double(i, float(attr))
        elif _type == pc.data_type_string:
            sv.set_string(i, attr)
        elif _type == pc.data_type_int_64:
            sv.set_int_64(i, attr)
        elif _type == pc.data_type_vint:
            sv.set_int_32_vector(i, list(attr))
        elif _type == pc.data_type_vdouble:
            sv.set_double_vector(i, list(attr))
        elif _type == pc.data_type_vstring:
            sv.set_string_vector(i, list(attr))
        elif _type == pc.data_type_vint_64:
            sv.set_int_64_vector(i, list(attr))
    
    return sv
```

#### from_sv(): StructValue to Python

```python
def from_sv(self, sv: pc.StructValue):
    """Deserialize StructValue to Python object."""
    
    # Validate compatibility including revision
    if (self.meta_id != sv.get_meta_id() or
        self.market != sv.get_market() or
        self.code != sv.get_stock_code() or
        self.namespace != sv.get_namespace() or
        self.granularity != sv.get_granularity()):
        raise Exception("Incompatible struct value")
    
    # Extract revision and timestamp
    self.revision = sv.get_revision()   # CRITICAL: Extract revision from header
    self.timetag = sv.get_time_tag()
    
    # Extract field values by type
    for i, (name, _type) in enumerate(self.fields):
        if _type == pc.data_type_int:
            self.set_sv_attr(name, sv.get_int(i))
        elif _type == pc.data_type_double:
            self.set_sv_attr(name, sv.get_double(i))
        elif _type == pc.data_type_string:
            self.set_sv_attr(name, sv.get_string(i))
        elif _type == pc.data_type_int_64:
            self.set_sv_attr(name, sv.get_int_64(i))
        elif _type == pc.data_type_vint:
            self.set_sv_attr(name, list(sv.get_int_32_vector(i)))
        elif _type == pc.data_type_vdouble:
            self.set_sv_attr(name, list(sv.get_double_vector(i)))
        elif _type == pc.data_type_vstring:
            self.set_sv_attr(name, list(sv.get_string_vector(i)))
        elif _type == pc.data_type_vint_64:
            self.set_sv_attr(name, list(sv.get_int_64_vector(i)))
```

## Time Series Data Patterns

### 1. Price Data (SampleQuote)

Standard OHLCV price data structure:

```python
class SampleQuote(sv_object):
    """Standard market price data."""
    
    def __init__(self):
        super().__init__()
        self.meta_name = "SampleQuote"
        
        # Price fields
        self.open: float = 0.0      # Opening price
        self.close: float = 0.0     # Closing price  
        self.high: float = 0.0      # Highest price
        self.low: float = 0.0       # Lowest price
        self.volume: int = 0        # Trading volume
        self.turnover: float = 0.0    # Trading amount

# Field definition:
[
    ('open', pc.data_type_double),
    ('close', pc.data_type_double),
    ('high', pc.data_type_double), 
    ('low', pc.data_type_double),
    ('volume', pc.data_type_int_64),
    ('turnover', pc.data_type_double)
]
```

### 2. Technical Indicators

Single-value indicators with historical state:

```python
class MACD(sv_object):
    """MACD technical indicator."""
    
    def __init__(self):
        super().__init__()
        self.meta_name = "MACD"
        
        # MACD values
        self.macd: float = 0.0      # MACD line
        self.signal: float = 0.0    # Signal line
        self.histogram: float = 0.0 # Histogram
        
        # Parameters
        self.fast_period: int = 12
        self.slow_period: int = 26
        self.signal_period: int = 9

# Field definition:
[
    ('macd', pc.data_type_double),
    ('signal', pc.data_type_double),
    ('histogram', pc.data_type_double),
    ('fast_period', pc.data_type_int),
    ('slow_period', pc.data_type_int),
    ('signal_period', pc.data_type_int)
]
```

### 3. Multi-Asset Strategies

Vector-based data for portfolio strategies:

```python
class PortfolioStrategy(sv_object):
    """Multi-asset portfolio strategy."""
    
    def __init__(self, num_assets=10):
        super().__init__()
        self.meta_name = "PortfolioStrategy"
        
        # Portfolio metrics
        self.pv: float = 0.0                    # Portfolio value
        self.nv: float = 1.0                    # Net value
        
        # Per-asset arrays
        self.signals: List[int] = [0] * num_assets       # Buy/sell signals
        self.weights: List[float] = [0.0] * num_assets   # Portfolio weights
        self.returns: List[float] = [0.0] * num_assets   # Asset returns
        self.prices: List[float] = [0.0] * num_assets    # Current prices
        
        # Asset identifiers
        self.markets: List[str] = [""] * num_assets      # Market names
        self.codes: List[str] = [""] * num_assets        # Asset codes

# Field definition:
[
    ('pv', pc.data_type_double),
    ('nv', pc.data_type_double),
    ('signals', pc.data_type_vint),
    ('weights', pc.data_type_vdouble),
    ('returns', pc.data_type_vdouble),
    ('prices', pc.data_type_vdouble),
    ('markets', pc.data_type_vstring),
    ('codes', pc.data_type_vstring)
]
```

## Data Flow Patterns

### 1. Global to Private Data Flow

```python
# 1. Subscribe to global data
def on_bar(self, _bar: pc.StructValue):
    """Process incoming global data."""
    ns = _bar.get_namespace()
    meta_id = _bar.get_meta_id()
    
    # Check if this is price data
    if ns == pc.namespace_global and meta_id == 1:
        # Process SampleQuote price data
        price_data = self.extract_price_data(_bar)
        result = self.calculate_indicator(price_data)
        
        # Save result to private namespace
        return self.to_sv()

# 2. Extract specific fields
def extract_price_data(self, _bar: pc.StructValue):
    """Extract OHLC data from price bar."""
    return {
        'open': _bar.get_double(0),
        'close': _bar.get_double(1), 
        'high': _bar.get_double(2),
        'low': _bar.get_double(3),
        'volume': _bar.get_int_64(4),
        'timestamp': _bar.get_time_tag()
    }
```

### 2. Cross-Strategy Data Sharing

```python
# Strategy A publishes signals to global
class StrategyA(sv_object):
    def on_bar(self, _bar):
        # Calculate signals
        signal = self.calculate_signal(_bar)
        
        # Publish to global namespace
        self.namespace = pc.namespace_global
        self.signal_value = signal
        return self.to_sv()

# Strategy B consumes signals from Strategy A  
class StrategyB(sv_object):
    def on_bar(self, _bar):
        ns = _bar.get_namespace()
        meta_name = self.get_meta_name(_bar)
        
        # Check for Strategy A signals
        if ns == pc.namespace_global and meta_name == "StrategyA":
            strategy_a_signal = _bar.get_double(0)
            return self.process_external_signal(strategy_a_signal)
```

### 3. State Persistence and Recovery

```python
class PersistentIndicator(sv_object):
    """Indicator with persistent state."""
    
    def __init__(self):
        super().__init__()
        self.persistent = True  # Enable state persistence
        
        # State variables stored in StructValue
        self.ema_short: float = 0.0
        self.ema_long: float = 0.0
        self.bar_count: int = 0
        self.last_signal: int = 0
    
    def on_rebuild(self, _bar: pc.StructValue):
        """Restore state from persisted data."""
        if not self.overwrite:
            # Load complete state
            self.from_sv(_bar)
        elif not self.rebuilding_started:
            # Initialize from first saved state
            self.from_sv(_bar)
            self.rebuilding_started = True
        return None
    
    def on_bar(self, _bar: pc.StructValue):
        """Process new data with persistent state."""
        if self.is_price_data(_bar):
            # Use persistent state for calculation
            close_price = _bar.get_double(1)
            
            # Update EMAs using previous values
            alpha_short = 2.0 / (12 + 1)
            alpha_long = 2.0 / (26 + 1)
            
            if self.bar_count == 0:
                self.ema_short = close_price
                self.ema_long = close_price
            else:
                self.ema_short = alpha_short * close_price + (1 - alpha_short) * self.ema_short
                self.ema_long = alpha_long * close_price + (1 - alpha_long) * self.ema_long
            
            # Generate signal
            if self.ema_short > self.ema_long:
                self.last_signal = 1
            elif self.ema_short < self.ema_long:
                self.last_signal = -1
            
            self.bar_count += 1
            
            # Return updated state
            return self.to_sv()
```

## Advanced Features

### 1. Field Import Control

Control which fields are imported from external sources:

```python
def set_global_imports(self, imports):
    """Configure which fields to import."""
    
    # imports structure:
    # {
    #     'global': {
    #         'SampleQuote': ['open', 'close', 'high', 'low'],
    #         'MyIndicator': ['signal', 'confidence']
    #     },
    #     'private': {
    #         'MyStrategy': ['pv', 'nv', 'signals']
    #     }
    # }
    
    ns_name = 'private' if self.namespace == pc.namespace_private else 'global'
    
    if ns_name in imports and self.meta_name in imports[ns_name]:
        allowed_fields = set(imports[ns_name][self.meta_name])
        
        # Create field index filter
        self.valid_field_index = set()
        for i, (field_name, field_type) in enumerate(self.fields):
            if field_name in allowed_fields:
                self.valid_field_index.add(i)
```

### 2. JSON Field Support

Support for complex nested data structures:

```python
class ComplexIndicator(sv_object):
    """Indicator with JSON fields for complex data."""
    
    def __init__(self):
        super().__init__()
        
        # Regular fields
        self.signal: int = 0
        
        # JSON field (stored as string, parsed on demand)
        self.config: str = '{"param1": 1.0, "param2": [1,2,3]}'
        self.json_fields_ = ['config']  # Mark as JSON field
    
    def get_config(self):
        """Get parsed JSON configuration."""
        return self._load_json_field('config')
    
    def set_config(self, config_dict):
        """Set JSON configuration."""
        self.config = json.dumps(config_dict)
        self.config_ = None  # Clear cache
```

### 3. Time Series Helper Class

Enhanced time series functionality:

```python
class time_series(object):
    """Helper class for time series calculations."""
    
    def __init__(self):
        self.open: array = array('d')       # Array of doubles
        self.close: array = array('d')
        self.high: array = array('d')
        self.low: array = array('d')
        self.timetags: array = array('q')   # Array of int64
        self.capacity: int = 1000           # Maximum length
    
    def update_price(self, o, c, h, l, tm):
        """Update with new OHLC data."""
        self.update_tm(tm)
        self.open[-1] = o
        self.close[-1] = c
        self.high[-1] = h
        self.low[-1] = l
    
    def ema(self, current_value: float, field_name: str, time_window: float) -> float:
        """Calculate exponential moving average."""
        return self.sma(current_value, field_name, time_window, 2.0)
    
    def atr(self, field_name: str, time_window: float) -> float:
        """Calculate Average True Range."""
        tr_val = self.tr()
        return self.rma(tr_val, field_name, time_window)
    
    def shrink(self, capacity=None):
        """Limit array size to prevent memory growth."""
        if capacity is None:
            capacity = self.capacity
            
        for prop in self.__dir__():
            val = getattr(self, prop)
            if isinstance(val, array) and len(val) > capacity:
                setattr(self, prop, val[-capacity:])
```

## Performance Considerations

### 1. Memory Management

```python
# Efficient array usage
self.prices = array('d')  # Use array instead of list for numerical data
self.signals = array('i') # Use appropriate types

# Memory bounds
def shrink(self, max_size=1000):
    """Prevent unbounded memory growth."""
    if len(self.prices) > max_size:
        self.prices = self.prices[-max_size:]
```

### 2. Field Access Optimization

```python
# Cache field lookups
class OptimizedIndicator(sv_object):
    def __init__(self):
        super().__init__()
        self._field_cache = {}  # Cache field positions
    
    def get_field_fast(self, sv, field_name):
        """Fast field access using cached positions."""
        if field_name not in self._field_cache:
            for i, (name, _type) in enumerate(self.fields):
                if name == field_name:
                    self._field_cache[field_name] = (i, _type)
                    break
        
        pos, _type = self._field_cache[field_name]
        
        if _type == pc.data_type_double:
            return sv.get_double(pos)
        elif _type == pc.data_type_int:
            return sv.get_int(pos)
        # ... other types
```

### 3. Batch Processing

```python
def process_batch(self, sv_list: List[pc.StructValue]):
    """Process multiple StructValues efficiently."""
    results = []
    
    # Pre-allocate result array
    batch_size = len(sv_list)
    results = [pc.StructValue() for _ in range(batch_size)]
    
    for i, sv in enumerate(sv_list):
        # Process individual StructValue
        result = self.process_single(sv)
        results[i] = result
    
    return results
```

## Best Practices

### 1. Field Design

```python
# ✅ Good: Clear, typed fields
class GoodIndicator(sv_object):
    def __init__(self):
        super().__init__()
        
        # Scalar values
        self.signal: int = 0                    # Clear integer signal
        self.confidence: float = 0.0            # Clear float confidence
        self.trend_strength: float = 0.0        # Descriptive name
        
        # Vector values for multi-asset
        self.asset_signals: List[int] = []      # Clear vector type
        self.asset_weights: List[float] = []    # Consistent naming
        
        # Metadata
        self.lookback_period: int = 20          # Configuration parameter
        self.last_update_time: int = 0          # Timestamp tracking

# ❌ Bad: Unclear, untyped fields  
class BadIndicator(sv_object):
    def __init__(self):
        super().__init__()
        
        self.val = None                         # Unclear type and purpose
        self.data = []                          # Generic name, unknown content
        self.x = 0.0                           # Meaningless name
        self.temp = {}                         # Wrong type (dict not supported)
```

### 2. State Management

```python
class StatefulIndicator(sv_object):
    """Best practices for state management."""
    
    def __init__(self):
        super().__init__()
        self.persistent = True
        
        # Initialize all fields with proper defaults
        self.ema_value: float = 0.0
        self.sample_count: int = 0
        self.is_initialized: bool = False
        
        # Configuration (not part of state)
        self.alpha: float = 0.1
    
    def on_bar(self, _bar):
        """Handle new data with proper state updates."""
        if self.is_price_data(_bar):
            price = _bar.get_double(1)  # Close price
            
            # Update state consistently
            if not self.is_initialized:
                self.ema_value = price
                self.is_initialized = True
            else:
                self.ema_value = self.alpha * price + (1 - self.alpha) * self.ema_value
            
            self.sample_count += 1
            
            # Always return updated state
            return self.to_sv()
        
        return None
```

### 3. Error Handling

```python
def robust_from_sv(self, sv: pc.StructValue):
    """Robust deserialization with error handling."""
    try:
        # Validate compatibility
        if not self._is_compatible(sv):
            raise ValueError(f"Incompatible StructValue: "
                           f"expected {self.meta_name}, got {sv.get_meta_id()}")
        
        # Update timestamp
        self.timetag = sv.get_time_tag()
        
        # Process each field with error handling
        for i, (name, _type) in enumerate(self.fields):
            try:
                if self._should_skip_field(i):
                    continue
                
                value = self._extract_field_value(sv, i, _type)
                self.set_sv_attr(name, value)
                
            except Exception as e:
                # Log field-specific errors but continue processing
                print(f"Warning: Failed to process field {name}: {e}")
                
    except Exception as e:
        # Log overall error
        print(f"Error in from_sv for {self.meta_name}: {e}")
        raise

def _is_compatible(self, sv: pc.StructValue) -> bool:
    """Check if StructValue is compatible."""
    return (self.market == sv.get_market() and
            self.code == sv.get_stock_code() and
            self.namespace == sv.get_namespace() and
            self.granularity == sv.get_granularity())
```

## Integration Examples

### 1. Price Data Processing

```python
class PriceProcessor(sv_object):
    """Process raw price data."""
    
    def __init__(self):
        super().__init__()
        self.meta_name = "PriceProcessor"
        
        # Output fields
        self.processed_close: float = 0.0
        self.volume_weighted_price: float = 0.0
        self.price_change_pct: float = 0.0
        
        # State
        self.prev_close: float = 0.0
    
    def on_bar(self, _bar: pc.StructValue) -> pc.StructValue:
        """Process SampleQuote data."""
        if (_bar.get_namespace() == pc.namespace_global and 
            _bar.get_meta_id() == 1):  # SampleQuote
            
            # Extract price data
            close = _bar.get_double(1)
            volume = _bar.get_int_64(4)
            amount = _bar.get_double(5)
            
            # Process
            self.processed_close = close
            self.volume_weighted_price = amount / volume if volume > 0 else close
            
            if self.prev_close > 0:
                self.price_change_pct = (close - self.prev_close) / self.prev_close
            
            self.prev_close = close
            
            # Update timestamp and return result
            self.timetag = _bar.get_time_tag()
            return self.to_sv()
        
        return None
```

### 2. Multi-Timeframe Analysis

```python
class MultiTimeframeRSI(sv_object):
    """RSI indicator across multiple timeframes."""
    
    def __init__(self):
        super().__init__()
        self.meta_name = "MultiTimeframeRSI"
        
        # RSI values for different timeframes
        self.rsi_5m: float = 50.0
        self.rsi_15m: float = 50.0  
        self.rsi_1h: float = 50.0
        
        # State for each timeframe
        self.avg_gain_5m: float = 0.0
        self.avg_loss_5m: float = 0.0
        self.avg_gain_15m: float = 0.0
        self.avg_loss_15m: float = 0.0
        self.avg_gain_1h: float = 0.0
        self.avg_loss_1h: float = 0.0
        
        # Previous prices for change calculation
        self.prev_close_5m: float = 0.0
        self.prev_close_15m: float = 0.0
        self.prev_close_1h: float = 0.0
    
    def on_bar(self, _bar: pc.StructValue) -> pc.StructValue:
        """Process price data for different timeframes."""
        if (_bar.get_namespace() == pc.namespace_global and 
            _bar.get_meta_id() == 1):
            
            granularity = _bar.get_granularity()
            close = _bar.get_double(1)
            
            # Route to appropriate timeframe handler
            if granularity == 300:  # 5 minutes
                self._update_rsi_5m(close)
            elif granularity == 900:  # 15 minutes  
                self._update_rsi_15m(close)
            elif granularity == 3600:  # 1 hour
                self._update_rsi_1h(close)
            
            self.timetag = _bar.get_time_tag()
            return self.to_sv()
        
        return None
    
    def _update_rsi_5m(self, close: float):
        """Update 5-minute RSI."""
        if self.prev_close_5m > 0:
            change = close - self.prev_close_5m
            gain = max(change, 0)
            loss = max(-change, 0)
            
            # Exponential moving average of gains/losses
            alpha = 2.0 / (14 + 1)  # 14-period RSI
            self.avg_gain_5m = alpha * gain + (1 - alpha) * self.avg_gain_5m
            self.avg_loss_5m = alpha * loss + (1 - alpha) * self.avg_loss_5m
            
            # Calculate RSI
            if self.avg_loss_5m != 0:
                rs = self.avg_gain_5m / self.avg_loss_5m
                self.rsi_5m = 100 - (100 / (1 + rs))
        
        self.prev_close_5m = close
```

## Schema Management and Client Initialization

### IndexSchema and IndexSerializer

The Wolverine system uses `pc.IndexSchema` and `pc.IndexSerializer` to manage metadata definitions and enable efficient serialization/deserialization across the network.

#### Schema Loading Process

```python
def _load_index_serializer(self, body: bytes):
    """Load schema definitions from binary data."""
    
    # 1. Create and load schema
    schema = pc.IndexSchema()
    schema.load(body)
    
    # 2. Extract metadata definitions
    metas: pc.IndexMetaVector = schema.metas()
    self.index_data_map = schema.index_data_map()
    
    # 3. Organize metadata by namespace and ID
    for meta in metas:
        if meta.get_namespace() not in self.schema:
            self.schema[meta.get_namespace()] = {}
        self.schema[meta.get_namespace()][meta.get_id()] = meta
    
    # 4. Create serializer with schema
    self.compressor = pc.IndexSerializer()
    self.compressor.update_schema_from_binary(schema.save())
    
    # 5. Build metadata lookup tables
    self.metas = {}
    self.meta_names = {}
    
    for meta in metas:
        _meta: pc.IndexMeta = meta
        
        # Extract field information
        field_pos = {}
        field_names = []
        field_types = []
        
        meta_name: str = _meta.get_name().decode('utf-8').split("::")[-1]
        meta_id = _meta.get_id()
        
        fields: pc.FieldVector = _meta.get_fields()
        for field in fields:
            _field: pc.Field = field
            _fieldname = _field.get_name().decode('utf-8')
            field_pos[_fieldname] = _field.get_pos()
            field_names.append(_fieldname)
            field_types.append(_field.get_type())
        
        # Store metadata tuple: (meta, field_positions, field_names, field_types, clean_name, meta_id)
        _value = (_meta, field_pos, field_names, field_types, meta_name, meta_id)
        
        # Index by namespace and meta_id
        self.metas[(meta.get_namespace(), meta.get_id())] = _value
        
        # Index by namespace and name with revision support
        _revision = _meta.get_revision()
        _key = (meta.get_namespace(), meta_name)
        if _key not in self.meta_names:
            self.meta_names[_key] = {}
        self.meta_names[_key][_revision] = _value
```

#### Schema Structure Example

The schema contains definitions for all available data structures:

```python
# Schema organization:
self.schema = {
    pc.namespace_global: {
        1: SampleQuote_IndexMeta,      # OHLCV price data
        2: MarketStatus_IndexMeta,     # Market status
        # ... other global metas
    },
    pc.namespace_private: {
        101: MACD_IndexMeta,           # MACD indicator
        102: RSI_IndexMeta,            # RSI indicator  
        103: MyStrategy_IndexMeta,     # Custom strategy
        # ... other private metas
    }
}

# Name-based lookup with revision support:
self.meta_names = {
    (pc.namespace_global, "SampleQuote"): {0: meta_tuple},
    (pc.namespace_private, "MACD"): {0: meta_tuple, 1: meta_tuple},
    (pc.namespace_private, "MyStrategy"): {0: meta_tuple}
}
```

### Wolverine Client Connection Setup

#### Complete Connection Class

```python
import asyncio
import socket
import struct
import pycaitlyn as pc
import pycaitlynutils3 as cu3

class WolverineConnection(pc.TCPClient):
    """Complete Wolverine client connection with schema management."""
    
    def __init__(self, host, port, event_queue, **kwargs):
        super().__init__(**kwargs)
        
        # Connection parameters
        self.host = host
        self.port = port
        self.event_queue = event_queue
        self.write_queue = asyncio.Queue()
        
        # Connection state
        self.stream = None
        self.connected = False
        self.ready = False
        self.stopped = False
        
        # Network protocol state
        self.header = pc.NetHeader()
        self.network_state = self.NETWORK_STATE_RECV_HEADER
        self.buffer = b''
        self.msgsize = None
        
        # Schema and metadata management
        self.schema = {}                    # Schema by namespace/meta_id
        self.compressor = None             # IndexSerializer for compression
        self.metas = {}                    # Metadata lookup by (ns, id)
        self.meta_names = {}               # Metadata lookup by (ns, name)
        self.index_data_map = None         # Data mapping
        
        # Client identification
        self.seq = 0
        self.identity = bytes(cu3.random_str(), 'utf-8')
        self.client_category = pc.goldcompass_category_client
        self.server_to_server = True
        
        # Network states
        self.NETWORK_STATE_RECV_HEADER = 1
        self.NETWORK_STATE_RECV_CONTENT = 2
        
        # Connection events
        self.PYCAITLYN_CONN_CONNECTED = 0x00001000
        self.PYCAITLYN_CONN_DISCONNECTED = 0x00001001
        self.PYCAITLYN_DIRAC_CLIENT_READY = 0x00001002
```

#### Connection Initialization Process

```python
async def initialize_wolverine_client(host, port, event_queue):
    """Complete initialization sequence for Wolverine client."""
    
    # 1. Create connection
    conn = WolverineConnection(host, port, event_queue)
    
    # 2. Start TCP connection
    await conn.start()
    
    # 3. Wait for schema to be loaded
    while not conn.is_ready():
        await asyncio.sleep(0.1)
    
    return conn

async def start(self):
    """Start the connection and initialize background tasks."""
    
    # 1. Establish TCP connection
    self.write_queue = asyncio.Queue()
    self.stopped = False
    self.stream = await self.connect(self.host, self.port, socket.AF_INET)
    self.connected = True
    self.buffer = b''
    
    # 2. Send connection event
    self.send_event((self.PYCAITLYN_CONN_CONNECTED,))
    
    # 3. Declare client identity
    self._on_connected()
    
    # 4. Start background tasks
    self.tasks = [
        asyncio.create_task(self.read_loop()),
        asyncio.create_task(self.write_loop()),
        asyncio.create_task(self.keepalive_loop())
    ]

def _on_connected(self):
    """Handle successful connection."""
    self.declare_myself()

def declare_myself(self):
    """Declare client category and identity to server."""
    req = pc.GoldCompassCategory()
    req.set_category(self.client_category)
    req.set_identify(self.identity)
    self.send_req(pc.net_cmd_gold_route_prote_clientid, req, self)
```

#### Message Processing and Schema Loading

```python
async def on_message(self, header: pc.NetHeader, body: bytes):
    """Process incoming messages from server."""
    cmd = header.get_cmd()
    
    if cmd == pc.net_cmd_gold_route_keepalive:
        # Handle keepalive - no action needed
        pass
    elif cmd == pc.net_cmd_gold_route_datadef:
        # Schema definition received - critical initialization step
        self._load_index_serializer(body)
        self.ready = True  # Client is now ready for data
        self.send_event((self.PYCAITLYN_DIRAC_CLIENT_READY,))
    else:
        # Handle other message types
        self.debug(f'Received: {cu3.cmd_name(cmd)}')
        # Process based on command type...

async def keepalive_loop(self):
    """Send periodic keepalive messages."""
    while not self.stopped:
        await asyncio.sleep(3)
        keepalive = pc.Keepalive()
        keepalive.set_utc_now(cu3.now_in_utc() // 1000)
        self.send_req(pc.net_cmd_gold_route_keepalive, keepalive, self)
```

#### Data Decoding with Schema

```python
def decode_sv(self, struct_value: pc.StructValue):
    """Decode StructValue using loaded schema."""
    namespace = struct_value.get_namespace()
    meta_id = struct_value.get_meta_id()
    
    # Get metadata from schema
    if namespace not in self.schema or meta_id not in self.schema[namespace]:
        raise ValueError(f"Unknown meta: namespace={namespace}, id={meta_id}")
    
    index_meta = self.schema[namespace][meta_id]
    return cu3.decode_sv(struct_value, index_meta)

def decode_binary(self, cmd: int, body: bytes):
    """Decode binary message using compressor."""
    return cu3.decode_binary(cmd, body, self.compressor)
```

### Client Usage Example

#### Complete Setup and Usage

```python
import asyncio
import pycaitlyn as pc

async def main():
    """Complete example of Wolverine client setup and usage."""
    
    # 1. Create event queue for client events
    event_queue = asyncio.Queue()
    
    # 2. Initialize connection
    host = "10.70.80.5"
    port = 8001
    conn = await initialize_wolverine_client(host, port, event_queue)
    
    # 3. Wait for ready state
    print("Waiting for client to be ready...")
    while not conn.is_ready():
        await asyncio.sleep(0.1)
    print("Client ready!")
    
    # 4. Print available schemas
    print("Available schemas:")
    for (namespace, meta_id), meta_info in conn.metas.items():
        meta, field_pos, field_names, field_types, meta_name, _ = meta_info
        ns_name = "global" if namespace == pc.namespace_global else "private"
        print(f"  {ns_name}::{meta_name} (ID: {meta_id})")
        print(f"    Fields: {field_names}")
    
    # 5. Set up data subscription (example)
    await subscribe_to_data(conn)
    
    # 6. Process events
    await process_events(conn, event_queue)

async def subscribe_to_data(conn):
    """Subscribe to specific data feeds."""
    # Subscribe to SampleQuote for specific instruments
    req = pc.ATSubscribeReq()
    req.set_namespace(pc.namespace_global)
    req.set_meta_id(1)  # SampleQuote
    req.set_revision(1) # CRITICAL: Must specify revision for subscription
    req.set_market(b"SHFE")
    req.set_stock_code(b"au2412")
    req.set_granularity(900)  # 15-minute
    
    conn.send_req(pc.cmd_at_subscribe, req)
    
    # Or subscribe to latest revision
    req_latest = pc.ATSubscribeReq()
    req_latest.set_namespace(pc.namespace_global)
    req_latest.set_meta_id(1)
    req_latest.set_revision(0xFFFFFFFF)  # Latest available revision
    req_latest.set_market(b"SHFE")
    req_latest.set_stock_code(b"ag2412")
    req_latest.set_granularity(300)
    
    conn.send_req(pc.cmd_at_subscribe, req_latest)

async def process_events(conn, event_queue):
    """Process incoming events and data."""
    
    async def event_handler():
        while True:
            try:
                event, sender = await event_queue.get()
                event_type = event[0]
                
                if event_type == conn.PYCAITLYN_CONN_CONNECTED:
                    print("Connected to Wolverine server")
                elif event_type == conn.PYCAITLYN_CONN_DISCONNECTED:
                    print("Disconnected from Wolverine server")
                    break
                elif event_type == conn.PYCAITLYN_DIRAC_CLIENT_READY:
                    print("Client ready for data processing")
                
            except Exception as e:
                print(f"Event processing error: {e}")
    
    async def data_handler():
        # Handle incoming StructValue data
        while conn.is_connected():
            # This would be implemented based on your specific data handling needs
            await asyncio.sleep(1)
    
    # Run both handlers concurrently
    await asyncio.gather(
        event_handler(),
        data_handler(),
        conn.join()  # Wait for connection tasks
    )

# Run the client
if __name__ == "__main__":
    asyncio.run(main())
```

#### Configuration-Based Setup

```python
class WolverineConfig:
    """Configuration for Wolverine client."""
    
    def __init__(self):
        self.host = "10.70.80.5"
        self.port = 8001
        self.token = "your-auth-token-here"
        self.client_category = pc.goldcompass_category_client
        
        # Subscription configuration
        self.subscriptions = [
            {
                "namespace": pc.namespace_global,
                "meta_name": "SampleQuote",
                "market": "SHFE",
                "instruments": ["au2412", "ag2412"],
                "granularities": [300, 900]  # 5min, 15min
            }
        ]

async def setup_wolverine_client(config: WolverineConfig):
    """Set up Wolverine client with configuration."""
    
    event_queue = asyncio.Queue()
    conn = WolverineConnection(config.host, config.port, event_queue)
    
    # Start connection
    await conn.start()
    
    # Wait for ready
    while not conn.is_ready():
        await asyncio.sleep(0.1)
    
    # Set up subscriptions
    for sub in config.subscriptions:
        await setup_subscription(conn, sub)
    
    return conn, event_queue

async def setup_subscription(conn, sub_config):
    """Set up data subscription based on configuration."""
    
    # Find meta_id by name
    namespace = sub_config["namespace"]
    meta_name = sub_config["meta_name"]
    
    if (namespace, meta_name) not in conn.meta_names:
        raise ValueError(f"Unknown meta: {meta_name}")
    
    # Get latest revision
    revisions = conn.meta_names[(namespace, meta_name)]
    latest_revision = max(revisions.keys())
    meta_info = revisions[latest_revision]
    meta_id = meta_info[5]
    
    # Create subscriptions for each instrument/granularity combination
    for instrument in sub_config["instruments"]:
        for granularity in sub_config["granularities"]:
            req = pc.ATSubscribeReq()
            req.set_namespace(namespace)
            req.set_meta_id(meta_id)
            req.set_market(sub_config["market"].encode('utf-8'))
            req.set_stock_code(instrument.encode('utf-8'))
            req.set_granularity(granularity)
            
            conn.send_req(pc.cmd_at_subscribe, req)
            
            print(f"Subscribed: {meta_name} {sub_config['market']}/{instrument} {granularity}s")
```

### Schema Validation and Error Handling

```python
class SchemaValidator:
    """Validate schema compatibility and handle versioning."""
    
    def __init__(self, conn):
        self.conn = conn
    
    def validate_meta_compatibility(self, namespace, meta_name, expected_fields):
        """Validate that a meta contains expected fields."""
        
        if (namespace, meta_name) not in self.conn.meta_names:
            raise ValueError(f"Meta not found: {meta_name}")
        
        # Get latest revision
        revisions = self.conn.meta_names[(namespace, meta_name)]
        latest_revision = max(revisions.keys())
        meta_info = revisions[latest_revision]
        
        meta, field_pos, field_names, field_types, clean_name, meta_id = meta_info
        
        # Check for required fields
        missing_fields = set(expected_fields) - set(field_names)
        if missing_fields:
            raise ValueError(f"Missing fields in {meta_name}: {missing_fields}")
        
        return meta_info
    
    def get_field_type(self, namespace, meta_name, field_name):
        """Get the type of a specific field."""
        
        meta_info = self.validate_meta_compatibility(namespace, meta_name, [field_name])
        meta, field_pos, field_names, field_types, clean_name, meta_id = meta_info
        
        field_index = field_names.index(field_name)
        return field_types[field_index]
```

## Summary

StructValue provides a robust, efficient, and type-safe foundation for financial time series processing in the Wolverine system. Key benefits:

1. **Unified Data Model**: Single structure for all time series data
2. **Type Safety**: Strong typing prevents runtime errors  
3. **Efficient Serialization**: Fast conversion between C++ and Python
4. **Memory Management**: Bounded memory usage with configurable limits
5. **Cross-Language Support**: Seamless interop between C++ and Python
6. **Persistence**: Automatic state saving and restoration
7. **Scalability**: Handles both single-asset and portfolio-level data
8. **Schema Management**: Dynamic schema loading and validation
9. **Network Protocol**: Complete client-server communication framework

The schema management system enables dynamic discovery and validation of available data structures, while the client connection framework provides robust network communication with automatic reconnection and keepalive mechanisms.

By following the patterns and best practices outlined in this guide, developers can build robust, efficient, and maintainable financial indicators and trading strategies that integrate seamlessly with the Wolverine ecosystem.