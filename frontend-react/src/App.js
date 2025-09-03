import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Header from './components/Header';
import ConnectionControls from './components/ConnectionControls';
import StatusSection from './components/StatusSection';
import TabSection from './components/TabSection';
import ActionsSection from './components/ActionsSection';
import Footer from './components/Footer';
import { BackendWebSocketProvider } from './contexts/BackendWebSocketContext';
import { DataProvider } from './contexts/DataContext';
import './App.css';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize application
        console.log('🚀 Mini Wolverine React App initializing...');
        
        // Check for basic browser capabilities
        const capabilities = {
          webSocket: typeof WebSocket !== 'undefined'
        };

        console.log('Browser capabilities:', capabilities);

        if (!capabilities.webSocket) {
          throw new Error('WebSocket not supported in this browser');
        }

        setIsInitialized(true);
        console.log('✅ Mini Wolverine React App initialized successfully');
        
      } catch (error) {
        console.error('❌ Failed to initialize Mini Wolverine:', error);
        setInitError(error.message);
      }
    };

    initializeApp();
  }, []);

  if (initError) {
    return (
      <Container>
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          color: 'var(--error-color)',
          background: '#fdf2f2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--border-radius)',
          margin: '20px'
        }}>
          <h2>Initialization Error</h2>
          <p>{initError}</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      </Container>
    );
  }

  if (!isInitialized) {
    return (
      <Container>
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          color: 'var(--text-muted)'
        }}>
          <h2>🐺 Mini Wolverine</h2>
          <p>Loading application...</p>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--border-color)',
            borderTop: '4px solid var(--secondary-color)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '20px auto'
          }}></div>
        </div>
      </Container>
    );
  }

  return (
    <DataProvider>
      <BackendWebSocketProvider>
        <Container>
          <Header />
          <MainContent>
            <ConnectionControls />
            <StatusSection />
            <TabSection />
            <ActionsSection />
          </MainContent>
          <Footer />
        </Container>
      </BackendWebSocketProvider>
    </DataProvider>
  );
}

export default App;