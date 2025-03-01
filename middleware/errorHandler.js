const { AppError, errorTypes } = require('../utils/ErrorHandler');

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Log error for debugging
    console.error('Stack:', err.stack);
    console.error('Path:', req.path);
    console.error('Body:', req.body);
    console.error('Query:', req.query);

    // Handle specific error types
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: err.status,
            errorCode: err.errorCode,
            message: err.message,
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            status: 'fail',
            errorCode: errorTypes.VALIDATION_ERROR.code,
            message: err.message,
            errors: Object.values(err.errors).map(e => e.message)
        });
    }

    // Handle Mongoose duplicate key errors
    if (err.name === 'MongoError' && err.code === 11000) {
        return res.status(400).json({
            status: 'fail',
            errorCode: 'E006',
            message: 'Duplicate key error',
            field: Object.keys(err.keyValue)[0]
        });
    }

    // Handle Puppeteer errors
    if (err.name === 'PuppeteerError') {
        return res.status(503).json({
            status: 'error',
            errorCode: 'E007',
            message: 'Scraping service temporarily unavailable'
        });
    }

    // Handle network errors
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        return res.status(503).json({
            status: 'error',
            errorCode: 'E008',
            message: 'Network service unavailable'
        });
    }

    // Default error
    return res.status(500).json({
        status: 'error',
        errorCode: 'E999',
        message: process.env.NODE_ENV === 'development' 
            ? err.message 
            : 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            path: req.path,
            method: req.method
        })
    });
};

module.exports = errorHandler; 