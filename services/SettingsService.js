const fs = require('fs').promises;
const path = require('path');

class SettingsService {
    constructor() {
        this.settingsPath = path.join(__dirname, '../data/settings.json');
        this.settings = {
            maxInvestmentPerTrade: 1,
            takeProfitPercentage: 50,
            stopLossPercentage: 20,
            enableAITrading: true,
            minimumLiquidity: 10,
            skipSuspiciousTokens: true,
            onlyVerifiedDEX: true
        };
        this.loadSettings();
    }

    async loadSettings() {
        try {
            const data = await fs.readFile(this.settingsPath, 'utf8');
            this.settings = JSON.parse(data);
            console.log('Settings loaded:', this.settings);
        } catch (error) {
            console.log('No settings file found, using defaults');
            await this.saveSettings(this.settings);
        }
    }

    async saveSettings(newSettings) {
        try {
            // Validate settings
            if (!this.validateSettings(newSettings)) {
                throw new Error('Invalid settings');
            }

            // Update settings
            this.settings = {
                ...this.settings,
                ...newSettings
            };

            // Ensure data directory exists
            const dataDir = path.dirname(this.settingsPath);
            await fs.mkdir(dataDir, { recursive: true });

            // Save to file
            await fs.writeFile(
                this.settingsPath,
                JSON.stringify(this.settings, null, 2),
                'utf8'
            );

            console.log('Settings saved:', this.settings);
            return this.settings;
        } catch (error) {
            console.error('Error saving settings:', error);
            throw error;
        }
    }

    validateSettings(settings) {
        const requiredFields = [
            'maxInvestmentPerTrade',
            'takeProfitPercentage',
            'stopLossPercentage',
            'enableAITrading',
            'minimumLiquidity',
            'skipSuspiciousTokens',
            'onlyVerifiedDEX'
        ];

        // Check all required fields exist
        for (const field of requiredFields) {
            if (settings[field] === undefined) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }

        // Validate numeric fields
        if (settings.maxInvestmentPerTrade <= 0 ||
            settings.takeProfitPercentage <= 0 ||
            settings.stopLossPercentage <= 0 ||
            settings.minimumLiquidity <= 0) {
            console.error('Numeric values must be greater than 0');
            return false;
        }

        return true;
    }

    getSettings() {
        return this.settings;
    }
}

module.exports = new SettingsService(); 