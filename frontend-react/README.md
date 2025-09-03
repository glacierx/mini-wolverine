# Mini Wolverine React Frontend

Modern React.js frontend for the Mini Wolverine financial data demo application.

## Features

- ⚛️ **React 18** with hooks and functional components
- 💅 **Styled Components** for component-level styling
- 🌐 **Context API** for state management
- 📊 **Recharts** for data visualization (ready to integrate)
- 🐳 **Docker** support for development and production
- 🔄 **Hot Reload** for development
- 📱 **Responsive Design** with mobile support

## Quick Start

### Development Mode (Docker)

```bash
# Start React development server with hot reload
docker-compose --profile development up

# Access the application
open http://localhost:3000
```

### Production Mode (Docker)

```bash
# Build and start production version
docker-compose --profile production up

# Access the application  
open http://localhost:8080
```

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Architecture

### Component Structure

```
src/
├── components/          # React components
│   ├── Header.js       # Application header
│   ├── ConnectionControls.js  # WebSocket connection UI
│   ├── StatusSection.js       # System status display
│   ├── TabSection.js          # Tabbed content area
│   ├── ActionsSection.js      # Action buttons and controls
│   └── Footer.js              # Application footer
├── contexts/            # React contexts for state management
│   ├── WasmContext.js          # WASM module management
│   ├── WebSocketContext.js    # WebSocket connection state
│   └── DataContext.js          # Data management and logging
├── App.js              # Main application component
├── App.css             # Application-specific styles
├── index.js            # React entry point
└── index.css           # Global styles and CSS variables
```

### State Management

The application uses React Context API with useReducer for state management:

- **WasmContext**: Manages WASM module loading, initialization, and availability
- **WebSocketContext**: Handles WebSocket connections, message sending, and statistics
- **DataContext**: Manages application data, logs, historical data, and export functions

### Styling

- **CSS Variables**: Consistent theming using CSS custom properties
- **Styled Components**: Component-level styling with JavaScript
- **Responsive Design**: Mobile-first approach with CSS Grid and Flexbox
- **Theme Colors**: Professional color scheme matching the original design

## Development Workflow

### Adding New Components

1. Create component in `src/components/`
2. Use styled-components for styling
3. Access context data via hooks
4. Add to parent component

Example:
```jsx
import React from 'react';
import styled from 'styled-components';
import { useData } from '../contexts/DataContext';

const Container = styled.div`
  padding: 20px;
  background: var(--card-background);
  border-radius: var(--border-radius);
`;

function MyComponent() {
  const { logs, actions } = useData();
  
  return (
    <Container>
      <h3>My Component</h3>
      <p>Log count: {logs.length}</p>
    </Container>
  );
}

export default MyComponent;
```

### State Management Patterns

#### Using Context Data
```jsx
function MyComponent() {
  const { isConnected, stats } = useWebSocket();
  const { module, isReady } = useWasm();
  const { logs, actions } = useData();
  
  // Component logic here
}
```

#### Updating State
```jsx
function MyComponent() {
  const { actions } = useData();
  
  const handleAction = () => {
    actions.addLog('info', 'Action performed', { data: 'example' });
  };
}
```

### Adding New Features

1. **Define State**: Add to appropriate context
2. **Create Actions**: Add reducer actions and action creators
3. **Build UI**: Create components using styled-components
4. **Test Integration**: Verify with Docker development setup

## Docker Configuration

### Development Setup
- **Hot Reload**: File watching enabled with polling
- **Port 3000**: React development server
- **Volume Mounts**: Live code editing
- **Environment Variables**: Development-specific config

### Production Setup
- **Multi-stage Build**: Optimized production build
- **Nginx Serving**: Static file serving with compression
- **Security Headers**: SharedArrayBuffer support headers
- **Port 8080**: Production application

## Environment Variables

### Development
```bash
REACT_APP_WS_URL=ws://localhost:3009/ws/
CHOKIDAR_USEPOLLING=true
NODE_ENV=development
```

### Production
```bash
NODE_ENV=production
REACT_APP_WS_URL=wss://your-production-ws-server/
```

## Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## Browser Requirements

- **WebAssembly Support**: Required for WASM module
- **WebSocket Support**: Required for real-time data
- **SharedArrayBuffer**: Enhanced performance (optional)
- **Modern Browsers**: Chrome 88+, Firefox 85+, Safari 14+

## Integration Points

### WASM Module Integration
The application is designed to integrate with the Caitlyn WASM module:

```jsx
// Context provides WASM module access
const { module, isReady } = useWasm();

// Use module when ready
if (isReady && module) {
  const pkg = new module.NetPackage();
  // Process data...
}
```

### WebSocket Communication
Real-time data communication via WebSocket:

```jsx
// Send messages
const { actions } = useWebSocket();
actions.sendMessage(JSON.stringify({ cmd: 'request_data' }));

// Receive messages handled automatically in context
```

### Historical Data
Historical data fetching and visualization:

```jsx
// Access historical data
const { historicalData, actions } = useData();

// Add new historical dataset  
actions.addHistoricalData('key', { data: [...], metadata: {...} });
```

## Debugging

### Available Debug Tools
```javascript
// Browser console debug helpers
window.debug = {
  wasm: () => console.log(wasmState),
  websocket: () => console.log(wsState),  
  data: () => console.log(dataState)
};
```

### Common Issues

1. **WASM Loading**: Check browser WebAssembly support
2. **WebSocket Connection**: Verify server URL and CORS headers
3. **Hot Reload**: Ensure polling is enabled for Docker
4. **SharedArrayBuffer**: Check security headers in production

## Contributing

1. Follow React component patterns
2. Use styled-components for styling
3. Maintain responsive design
4. Add proper error handling
5. Update documentation

## Next Steps

- Implement real WASM module integration
- Add comprehensive historical data visualization
- Integrate charting libraries (Recharts/D3.js)
- Add unit and integration tests
- Enhance error handling and user feedback