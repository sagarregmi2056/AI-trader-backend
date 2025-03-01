const SettingsService = require('../services/SettingsService');

class SettingsController {
    async getSettings(req, res) {
        try {
            const settings = SettingsService.getSettings();
            res.json(settings);
        } catch (error) {
            console.error('Error getting settings:', error);
            res.status(500).json({ error: 'Failed to get settings' });
        }
    }

    async updateSettings(req, res) {
        try {
            const newSettings = req.body;
            const updatedSettings = await SettingsService.saveSettings(newSettings);
            res.json(updatedSettings);
        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(500).json({ error: 'Failed to update settings' });
        }
    }
}

module.exports = new SettingsController(); 