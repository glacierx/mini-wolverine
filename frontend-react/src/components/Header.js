import React from 'react';
import styled from 'styled-components';

const HeaderContainer = styled.header`
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  color: white;
  padding: 30px;
  border-radius: var(--border-radius);
  margin-bottom: 30px;
  text-align: center;
`;

const Title = styled.h1`
  margin: 0 0 10px 0;
  font-size: 2.5rem;
  font-weight: 700;
`;

const Subtitle = styled.p`
  margin: 0 0 15px 0;
  font-size: 1.1rem;
  opacity: 0.9;
`;

const ConnectionStatus = styled.div`
  display: inline-block;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
`;

function Header() {
  return (
    <HeaderContainer>
      <Title>🐺 Mini Wolverine</Title>
      <Subtitle>Financial Data Demo using React.js & Node.js Backend</Subtitle>
      <ConnectionStatus id="connection-status">
        System Ready - Click Connect to start
      </ConnectionStatus>
    </HeaderContainer>
  );
}

export default Header;