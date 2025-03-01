const TokenDataService = require('../services/TokenDataService');

async function testConnection() {
    const tokenService = new TokenDataService();
    
    try {
        // Test trending tokens
        console.log('\nFetching trending tokens:');
        const trendingTokens = await tokenService.getTrendingTokens();
        console.log('Top 5 Trending Tokens:');
        console.log(JSON.stringify(trendingTokens.slice(0, 5), null, 2));

        // Test detailed analysis for BONK
        const bonkAddress = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
        console.log('\nFetching detailed analysis for BONK:');
        const tokenAnalysis = await tokenService.getTokenAnalysis(bonkAddress);
        console.log(JSON.stringify(tokenAnalysis, null, 2));

        // Test token pairs
        console.log('\nFetching token pairs for BONK:');
        const tokenPairs = await tokenService.getTokenPairs(bonkAddress);
        console.log('Top 3 pairs:');
        console.log(JSON.stringify(tokenPairs.slice(0, 3), null, 2));

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testConnection(); 