class AppError extends Error {
    constructor(message, statusCode, errorCode) {
        super(message);
        this.statusCode = statusCode;
        this.errorCode = errorCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

const errorTypes = {
    VALIDATION_ERROR: {
        code: 'E001',
        status: 400,
        message: 'Validation error'
    },
    TOKEN_NOT_FOUND: {
        code: 'E002',
        status: 404,
        message: 'Token not found'
    },
    API_RATE_LIMIT: {
        code: 'E003',
        status: 429,
        message: 'API rate limit exceeded'
    },
    TWITTER_API_ERROR: {
        code: 'E004',
        status: 503,
        message: 'Twitter API error'
    },
    DATABASE_ERROR: {
        code: 'E005',
        status: 500,
        message: 'Database operation failed'
    }
};

module.exports = {
    AppError,
    errorTypes
}; 