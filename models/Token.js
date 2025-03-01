const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
    symbol: String,
    name: String,
    contractAddress: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deployerAddress: String,
    verifiedBy: [{
        platform: String, // 'twitter', 'github', etc.
        username: String,
        profileUrl: String,
        verifiedAt: Date,
        followerCount: Number,
        isHighProfile: Boolean
    }],
    analysis: {
        riskScore: Number,
        warnings: [String],
        lastAnalyzed: Date
    },
    socialMetrics: {
        twitterMentions: Number,
        sentimentScore: Number,
        verifiedMentions: [{
            username: String,
            tweet: String,
            postedAt: Date,
            followerCount: Number
        }]
    },
    tradingMetrics: {
        price: Number,
        volume24h: Number,
        liquidity: Number,
        holders: Number,
        lastUpdated: Date
    },
    twitterMetrics: {
        totalMentions: Number,
        highProfileMentions: Number,
        verifiedMentions: Number,
        recentMentions: [{
            username: String,
            tweetId: String,
            tweetText: String,
            postedAt: Date,
            followerCount: Number,
            isVerified: Boolean,
            isHighProfile: Boolean
        }],
        lastUpdated: Date
    },
    priceMetrics: {
        currentPrice: Number,
        ath: Number,
        athDate: Date,
        atl: Number,
        atlDate: Date,
        priceHistory: [{
            price: Number,
            timestamp: Date
        }]
    },
    riskMetrics: {
        rugPullRisk: Number,
        honeypotRisk: Number,
        contractRisk: Number,
        socialRisk: Number,
        overallRisk: Number,
        lastUpdated: Date
    },
    alerts: [{
        type: String, // 'high_profile_mention', 'price_change', 'risk_change'
        message: String,
        timestamp: Date,
        data: mongoose.Schema.Types.Mixed
    }]
});

module.exports = mongoose.model('Token', TokenSchema); 