require('dotenv').config();

const config = {
    environment: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    PORT: process.env.PORT || 3000,
    WS_PORT: process.env.WS_PORT || 8080,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/token-tracker',
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    SOLSCAN_API_KEY: process.env.SOLSCAN_API_KEY,
    // Add other config variables
};

module.exports = config; 