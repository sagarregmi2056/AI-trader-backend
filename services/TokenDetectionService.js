const { Connection, PublicKey } = require('@solana/web3.js');
const WebSocket = require('ws');
const axios = require('axios');
const config = require('../config');
const TokenPriceService = require('./TokenPriceService');

class TokenDetectionService {
  constructor() {
    // Ensure RPC URL is valid
    const rpcUrl = config.solanaRpc || 'https://api.mainnet-beta.solana.com';
    if (!rpcUrl.startsWith('http')) {
      console.error('Invalid RPC URL, using default mainnet');
      this.connection = new Connection('https://api.mainnet-beta.solana.com');
    } else {
      this.connection = new Connection(rpcUrl);
    }
    
    this.tokenPriceService = new TokenPriceService();
    this.dexes = ['raydium', 'orca'];
    this.subscribers = new Set();
    this.isDevMode = true;
  }

  startMonitoring() {
    console.log('Starting token monitoring service in development mode...');
    
    if (this.isDevMode) {
      this.simulateTokenDetection();
      return;
    }
  }

  simulateTokenDetection() {
    const mockTokens = [
      {
        address: 'DummyToken1',
        name: 'PEPE',
        price: '0.000001',
        liquidity: '500K SOL',
        risk: 'low',
        confidence: 92
      },
      {
        address: 'DummyToken2',
        name: 'DOGE',
        price: '0.00002',
        liquidity: '1.2M SOL',
        risk: 'medium',
        confidence: 78
      }
    ];

    setInterval(() => {
      const mockToken = mockTokens[Math.floor(Math.random() * mockTokens.length)];
      this.notifySubscribers({
        type: 'newToken',
        data: {
          ...mockToken,
          timestamp: new Date().toISOString(),
          warning: 'Development Mode - Do Not Trade'
        }
      });
    }, 10000);
  }

  async monitorRaydium() {
    const ws = new WebSocket('wss://api.raydium.io/v2/ws');
    
    ws.on('open', () => {
      ws.send(JSON.stringify({
        method: 'subscribe',
        topic: 'pools',
      }));
    });

    ws.on('message', async (data) => {
      const poolData = JSON.parse(data);
      if (poolData.type === 'newPool') {
        const tokenAnalysis = await this.analyzeToken(poolData.tokenAddress);
        this.notifySubscribers({ dex: 'raydium', poolData, analysis: tokenAnalysis });
      }
    });
  }

  async monitorOrca() {
    // Similar implementation for Orca
  }

  async analyzeToken(tokenAddress) {
    if (this.isDevMode) {
      return {
        risk: 'medium',
        confidence: 85,
        warning: 'Development Mode - Analysis is simulated'
      };
    }
    // Real token analysis would go here
  }

  async getTokenData(tokenAddress) {
    try {
      const [priceData, tokenInfo] = await Promise.all([
        this.tokenPriceService.getTokenPrice(tokenAddress),
        this.tokenPriceService.getTokenInfo(tokenAddress)
      ]);

      // Get recent trades from Jupiter API
      const recentTrades = await axios.get(
        `https://price.jup.ag/v4/trades?id=${tokenAddress}&limit=10`
      );

      return {
        price: priceData?.price || 0,
        supply: tokenInfo?.supply || 0,
        volume24h: this.calculateVolume(recentTrades.data.data),
        liquidity: await this.getLiquidity(tokenAddress),
        confidence: priceData?.confidence || 0
      };
    } catch (error) {
      console.error('Error fetching token data:', error);
      return null;
    }
  }

  async getLiquidity(tokenAddress) {
    try {
      // Get liquidity from Jupiter's pools API
      const response = await axios.get(
        `https://price.jup.ag/v4/pools?ids=${tokenAddress}`
      );
      
      let totalLiquidity = 0;
      if (response.data.data[tokenAddress]) {
        totalLiquidity = response.data.data[tokenAddress].reduce((acc, pool) => 
          acc + (pool.liquidity || 0), 0);
      }

      return totalLiquidity;
    } catch (error) {
      console.error('Error fetching liquidity:', error);
      return 0;
    }
  }

  calculateVolume(trades) {
    return trades.reduce((acc, trade) => acc + (trade.amount * trade.price), 0);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers(data) {
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in subscriber callback:', error);
      }
    });
  }
}

module.exports = TokenDetectionService; 