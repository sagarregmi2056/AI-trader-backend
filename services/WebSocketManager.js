const WebSocket = require('ws');
const TokenDataService = require('./TokenDataService');

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Set();
        this.tokenService = new TokenDataService();
        this.updateInterval = null;
        this.lastUpdate = null;
        this.updateThreshold = 30000; // 30 seconds between updates
    }

    initialize(server) {
        try {
            this.wss = new WebSocket.Server({ server });
            console.log('WebSocket Server initialized');

            this.wss.on('connection', (ws) => {
                console.log('New client connected');
                this.clients.add(ws);

                // Send initial data
                this.sendInitialData(ws);

                ws.on('error', (error) => {
                    console.error('WebSocket client error:', error);
                    this.clients.delete(ws);
                });

                ws.on('close', () => {
                    console.log('Client disconnected');
                    this.clients.delete(ws);
                });
            });

            // Start periodic updates
            this.startPeriodicUpdates();

        } catch (error) {
            console.error('Error initializing WebSocket server:', error);
        }
    }

    async sendInitialData(ws) {
        try {
            // If we have recent data, use it instead of fetching new data
            if (this.lastUpdate && Date.now() - this.lastUpdate.timestamp < this.updateThreshold) {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'token_update',
                        data: this.lastUpdate.data
                    }));
                }
                return;
            }

            const tokens = await this.tokenService.getTrendingTokens();
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'token_update',
                    data: tokens
                }));
            }
        } catch (error) {
            console.error('Error sending initial data:', error);
        }
    }

    startPeriodicUpdates() {
        // Clear any existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Set up new interval for updates
        this.updateInterval = setInterval(async () => {
            try {
                // Check if enough time has passed since last update
                if (this.lastUpdate && Date.now() - this.lastUpdate.timestamp < this.updateThreshold) {
                    return;
                }

                const tokens = await this.tokenService.getTrendingTokens();
                this.lastUpdate = {
                    timestamp: Date.now(),
                    data: tokens
                };
                this.broadcastUpdate(tokens);
            } catch (error) {
                console.error('Error in periodic update:', error);
            }
        }, this.updateThreshold);
    }

    broadcastUpdate(data) {
        const message = JSON.stringify({
            type: 'token_update',
            data: data
        });

        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                } catch (error) {
                    console.error('Error sending to client:', error);
                    this.clients.delete(client);
                }
            }
        });
    }

    close() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        this.clients.forEach(client => {
            try {
                client.close();
            } catch (error) {
                console.error('Error closing client connection:', error);
            }
        });

        this.clients.clear();

        if (this.wss) {
            this.wss.close(() => {
                console.log('WebSocket server closed');
            });
        }
    }
}

// Export the class
module.exports = WebSocketManager;