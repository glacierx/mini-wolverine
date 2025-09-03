# Mini Wolverine Configuration System

## Overview

Mini Wolverine now uses a dynamic configuration system where **all hardcoded tokens and URLs have been removed**. The backend supports a **global configuration model** where any frontend connection can change the Caitlyn server configuration for all clients.

## Configuration Methods

### 1. Frontend-Driven Configuration

The frontend can configure the backend's global Caitlyn server connection through the user interface. Any configuration change affects all connected clients globally.

**Storage Priority:**
1. User input in the UI (stored in localStorage)
2. Environment variables (`REACT_APP_WS_URL`, `REACT_APP_WS_TOKEN`)
3. No fallback (requires explicit configuration)

### 2. Command-Line Configuration for Scripts

Test scripts now require explicit configuration via command-line arguments:

```bash
# Examples test script
node test.js --url wss://116.wolverine-box.com/tm --token your_token_here

# Usage help
node test.js --help
```

### 3. Environment Variables

Set environment variables for default configuration:

```bash
# Frontend environment variables
REACT_APP_WS_URL=wss://your-server.com/tm
REACT_APP_WS_TOKEN=your_token_here

# Backend environment variables (for container networking)
CAITLYN_WS_URL=wss://your-server.com/tm
CAITLYN_TOKEN=your_token_here
```

## Global Backend Configuration

### Single Server Model

The backend supports connecting to **only one Caitlyn server at a time** with **one token**. This is a global configuration that affects all frontend connections.

### Configuration Change Behavior

When any frontend client changes the server URL or token:

1. **Automatic Reset**: Backend detects configuration changes
2. **Connection Shutdown**: All existing connections are gracefully closed
3. **Pool Reinitialization**: New connection pool is created with new credentials
4. **Data Reset**: All cached universe data and seeds are cleared
5. **Reconnection**: All clients reconnect to the new server configuration

### Backend API for Configuration

```javascript
// Change global backend configuration
ws.send(JSON.stringify({
    type: 'connect',
    url: 'wss://new-server.com/tm',
    token: 'new_token_here'
}));
```

## Configuration Files

### Example Configuration

```javascript
// examples/config.example.js
export const CAITLYN_CONFIG = {
    url: "wss://116.wolverine-box.com/tm",
    token: "your_token_here"
};
```

### Test Configuration

```javascript
// examples/test-config.js
export const TEST_CONFIG = {
    url: "wss://116.wolverine-box.com/tm",
    token: "your_token_here"
};
```

## Implementation Details

### Backend Changes

1. **Removed Hardcoded Values**: All hardcoded tokens/URLs eliminated
2. **Global State Management**: Added `currentUrl` and `globalToken` tracking
3. **Configuration Reset Method**: `resetConfiguration()` for clean state changes
4. **Validation**: URL and token are required parameters
5. **Configuration Change Detection**: Automatic detection and handling of changes

### Frontend Changes

1. **Removed Hardcoded Fallbacks**: No more hardcoded server credentials
2. **Storage Integration**: Uses localStorage for persistent configuration
3. **Environment Variables**: Supports REACT_APP_* environment variables
4. **No-Config Handling**: Graceful handling when credentials are not configured

### Script Changes

1. **Argument Parsing**: All test scripts require explicit --url and --token parameters
2. **Usage Help**: Clear error messages and usage examples
3. **Configuration Validation**: Scripts fail fast if credentials are missing

## Security Considerations

1. **No Hardcoded Secrets**: All sensitive tokens removed from source code
2. **Environment Variable Support**: Secure configuration through environment
3. **User-Controlled**: Credentials managed through secure user input
4. **Global Backend State**: Single point of credential management

## Migration Guide

### For Development

1. **Copy Configuration Template**:
   ```bash
   cp examples/config.example.js examples/config.js
   # Edit with your credentials
   ```

2. **Set Environment Variables**:
   ```bash
   export REACT_APP_WS_URL="wss://your-server.com/tm"
   export REACT_APP_WS_TOKEN="your_token_here"
   ```

3. **Use Command-Line Arguments**:
   ```bash
   node test.js --url wss://your-server.com/tm --token your_token
   ```

### For Production

1. **Environment Configuration**: Set environment variables in deployment
2. **User Interface**: Use frontend UI to configure server credentials
3. **No Hardcoded Values**: Ensure no hardcoded credentials in production builds

## Usage Examples

### Test Script with Arguments

```bash
cd examples
node test.js \
  --url wss://116.wolverine-box.com/tm \
  --token 
```

### Frontend Configuration

1. Open the Mini Wolverine frontend at http://localhost:3000
2. Navigate to connection settings
3. Enter Caitlyn server URL and authentication token
4. Configuration is applied globally to all connected clients

### Docker Environment Variables

```yaml
# docker-compose.yml
environment:
  - REACT_APP_WS_URL=wss://your-server.com/tm
  - REACT_APP_WS_TOKEN=your_token_here
```

## Benefits

1. **Security**: No hardcoded credentials in source code
2. **Flexibility**: Easy switching between different Caitlyn servers
3. **Global Control**: Any frontend can reconfigure the backend
4. **Development Friendly**: Clear configuration requirements and examples
5. **Production Ready**: Environment variable support for deployment

---

**⚠️ Important**: All hardcoded credentials have been removed. Explicit configuration is now required for all connections.