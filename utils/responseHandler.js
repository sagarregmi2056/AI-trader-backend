class ResponseHandler {
    static success(res, data, message = 'Success') {
        return res.status(200).json({
            success: true,
            message,
            data
        });
    }

    static error(res, error, statusCode = 500) {
        return res.status(statusCode).json({
            success: false,
            message: error.message || 'Internal Server Error',
            error: error.stack
        });
    }
}

module.exports = ResponseHandler; 