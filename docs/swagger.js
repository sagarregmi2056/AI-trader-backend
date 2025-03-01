const swaggerJsDoc = require('swagger-jsdoc');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Token Analysis API',
            version: '1.0.0',
            description: 'API for token analysis and social media monitoring'
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server'
            }
        ]
    },
    apis: ['./routes/*.js', './docs/swagger/*.yaml']
};

module.exports = swaggerJsDoc(swaggerOptions); 