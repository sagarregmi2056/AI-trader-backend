const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const { Connection } = require('@solana/web3.js');
const config = require('./config');
const TokenService = require('./services/TokenService');
const TokenDataService = require('./services/TokenDataService');
const WebSocketManager = require('./services/WebSocketManager');
const TwitterMonitoringService = require('./services/TwitterMonitoringService');
const securityMiddleware = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const ResponseHandler = require('./utils/responseHandler');
const TwitterAnalysisService = require('./services/TwitterAnalysisService');
const DatabaseService = require('./services/DatabaseService');
const Token = require('./models/Token');
const swaggerUi = require('swagger-ui-express');
const swaggerDocs = require('./docs/swagger');
const { AppError, errorTypes } = require('./utils/ErrorHandler');
const rateLimit = require('express-rate-limit');
const tokenRoutes = require('./routes/tokens');
const http = require('http');
const settingsController = require('./controllers/settingsController');
const healthRoutes = require('./routes/health');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Configure CORS
app.use(cors({
    origin: 'https://ai-solana-trader.vercel.app/',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(securityMiddleware);

// Initialize services
const tokenService = new TokenDataService();
const twitterAnalysisService = new TwitterAnalysisService();
const wsManager = new WebSocketManager();
const twitterMonitoringService = new TwitterMonitoringService();

// Initialize WebSocket server
wsManager.initialize(server);

// REST API endpoints
app.get('/api/health', (req, res) => {
    ResponseHandler.success(res, { status: 'healthy', mode: 'development' });
});

app.get('/api/tokens/:address', async (req, res) => {
    try {
        const token = await tokenService.getTokenData(req.params.address);
        if (!token) {
            throw new AppError('Token not found', 404);
        }
        ResponseHandler.success(res, token);
    } catch (error) {
        ResponseHandler.error(res, error);
    }
});

app.get('/api/token-analysis/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { contract } = req.query;
        const tokenData = await tokenService.getTokenMetadata(contract);
        const socialAnalysis = await twitterAnalysisService.analyzeTokenLegitimacy(symbol, contract);
        
        const analysis = {
            token: tokenData,
            social: socialAnalysis,
            overall: {
                riskScore: (tokenData.riskScore + socialAnalysis.riskScore) / 2,
                warnings: [...tokenData.warnings, ...socialAnalysis.warnings],
                lastUpdated: new Date().toISOString()
            }
        };

        ResponseHandler.success(res, analysis);
    } catch (error) {
        ResponseHandler.error(res, error);
    }
});

// Token routes
app.use('/api/tokens', tokenRoutes);
app.use('/api/health', healthRoutes);

// Add Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Enhanced error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (err instanceof AppError) {
        return ResponseHandler.error(res, err);
    }
    ResponseHandler.error(res, new AppError('Internal Server Error', 500));
});

// Add rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        status: 'fail',
        errorCode: errorTypes.API_RATE_LIMIT.code,
        message: 'Too many requests, please try again later'
    }
});

app.use('/api/', apiLimiter);

// Create router for settings
const settingsRouter = express.Router();
settingsRouter.get('/', settingsController.getSettings.bind(settingsController));
settingsRouter.post('/', settingsController.updateSettings.bind(settingsController));
app.use('/api/settings', settingsRouter);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
    console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
    console.log('='.repeat(50));
});

// Handle cleanup on server shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Cleaning up...');
    wsManager.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    wsManager.close();
    server.close(() => {
        process.exit(1);
    });
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled Rejection:', error);
});

module.exports = server;
