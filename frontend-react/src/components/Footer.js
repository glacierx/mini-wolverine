import React from 'react';
import styled from 'styled-components';

const FooterContainer = styled.footer`
  margin-top: 40px;
  padding: 20px;
  text-align: center;
  background: var(--card-background);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  box-shadow: var(--shadow);
`;

const Copyright = styled.p`
  margin: 0 0 10px 0;
  color: var(--text-muted);
  font-size: 14px;
`;

const DebugInfo = styled.div`
  display: flex;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-muted);
`;

const DebugItem = styled.small`
  display: flex;
  align-items: center;
  gap: 5px;
`;

function Footer() {
  const buildVersion = 'react-backend-1.0.0';

  return (
    <FooterContainer>
      <Copyright>
        &copy; 2024 Mini Wolverine Demo - Powered by React.js & Node.js Backend
      </Copyright>
      <DebugInfo>
        <DebugItem>
          Build: <span style={{ fontWeight: 'bold' }}>{buildVersion}</span>
        </DebugItem>
        <DebugItem>
          Architecture: <span style={{ fontWeight: 'bold' }}>Frontend + Backend</span>
        </DebugItem>
      </DebugInfo>
    </FooterContainer>
  );
}

export default Footer;