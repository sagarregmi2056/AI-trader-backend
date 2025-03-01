const express = require('express');
const router = express.Router();
const TokenDataService = require('../services/TokenDataService');
const ResponseHandler = require('../utils/responseHandler');

// Create instance of TokenDataService
const tokenService = new TokenDataService();

// Add rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30 // limit each IP to 30 requests per minute
});

router.use(limiter);

// Get trending tokens
router.get('/trending', async (req, res) => {
    try {
        console.log('Fetching trending tokens...');
        const tokens = await tokenService.getTrendingTokens();
        
        // Add more detailed logging
        console.log(`Found ${tokens.length} trending tokens`);
        
        return res.json({
            success: true,
            data: tokens
        });
    } catch (error) {
        console.error('Error in trending tokens route:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch trending tokens'
        });
    }
});

router.get('/:address', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`Fetching token data for ${address}`);
        
        const tokenData = await tokenService.getTokenData(address);
        
        if (!tokenData) {
            return ResponseHandler.error(res, { message: 'Token not found' }, 404);
        }

        return ResponseHandler.success(res, tokenData, 'Token data fetched successfully');
    } catch (error) {
        console.error('Error in token data route:', error);
        return ResponseHandler.error(res, error);
    }
});

// Regular analysis endpoint
router.get('/:address/analysis', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`Processing analysis request for token: ${address}`);

        const analysis = await tokenService.getTokenAnalysis(address);
        if (!analysis) {
            console.log('No analysis available for token:', address);
            return ResponseHandler.error(res, { message: 'Analysis not available' }, 404);
        }

        console.log('Analysis data:', analysis);
        return ResponseHandler.success(res, analysis);
    } catch (error) {
        console.error('Error in analysis route:', error);
        return ResponseHandler.error(res, error);
    }
});

// AI analysis endpoint
router.get('/:address/ai-analysis', async (req, res) => {
    try {
        const { address } = req.params;
        console.log(`Processing AI analysis request for token: ${address}`);

        const analysis = await tokenService.getAIAnalysis(address);
        if (!analysis) {
            console.log('No AI analysis available for token:', address);
            return ResponseHandler.error(res, { message: 'AI Analysis not available' }, 404);
        }

        console.log('AI Analysis data:', analysis);
        return ResponseHandler.success(res, analysis);
    } catch (error) {
        console.error('Error in AI analysis route:', error);
        return ResponseHandler.error(res, error);
    }
});

module.exports = router; 