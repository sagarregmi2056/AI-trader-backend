const mongoose = require('mongoose');
const Token = require('../models/Token');

class DatabaseService {
    constructor() {
        this.connect();
    }

    async connect() {
        try {
            await mongoose.connect(process.env.MONGODB_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('Connected to MongoDB');
        } catch (error) {
            console.error('MongoDB connection error:', error);
        }
    }

    async trackTokenVerification(tokenData, verifierData) {
        try {
            const token = await Token.findOneAndUpdate(
                { contractAddress: tokenData.contractAddress },
                {
                    $push: {
                        verifiedBy: {
                            platform: verifierData.platform,
                            username: verifierData.username,
                            profileUrl: verifierData.profileUrl,
                            verifiedAt: new Date(),
                            followerCount: verifierData.followerCount,
                            isHighProfile: verifierData.followerCount > 100000
                        }
                    },
                    $set: {
                        updatedAt: new Date()
                    }
                },
                { upsert: true, new: true }
            );
            return token;
        } catch (error) {
            console.error('Error tracking token verification:', error);
            throw error;
        }
    }

    async updateTokenAnalysis(contractAddress, analysisData) {
        try {
            const token = await Token.findOneAndUpdate(
                { contractAddress },
                {
                    $set: {
                        analysis: {
                            ...analysisData,
                            lastAnalyzed: new Date()
                        },
                        updatedAt: new Date()
                    }
                },
                { new: true }
            );
            return token;
        } catch (error) {
            console.error('Error updating token analysis:', error);
            throw error;
        }
    }

    async getTokenHistory(contractAddress) {
        try {
            const token = await Token.findOne({ contractAddress });
            return token;
        } catch (error) {
            console.error('Error getting token history:', error);
            throw error;
        }
    }

    async getHighProfileVerifications(contractAddress) {
        try {
            const token = await Token.findOne({ contractAddress });
            return token?.verifiedBy.filter(v => v.isHighProfile) || [];
        } catch (error) {
            console.error('Error getting high profile verifications:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseService(); 