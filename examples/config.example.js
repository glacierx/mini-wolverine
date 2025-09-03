/**
 * Configuration example for Mini Wolverine
 * Copy this file and modify with your actual credentials
 */

export const CAITLYN_CONFIG = {
    // Caitlyn WebSocket server URL
    url: "wss://116.wolverine-box.com/tm",
    
    // Authentication token for the server
    token: "your_token_here"
};

// Alternative configuration for different environments
export const DEV_CONFIG = {
    url: "wss://dev-server.example.com/tm",
    token: "dev_token_here"
};

export const PROD_CONFIG = {
    url: "wss://prod-server.example.com/tm", 
    token: "prod_token_here"
};