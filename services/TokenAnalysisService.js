const { Connection, PublicKey } = require('@solana/web3.js');
const { OpenAI } = require('openai');
const config = require('../config');
const DatabaseService = require('./DatabaseService');
require('dotenv').config();

class TokenAnalysisService {
    constructor() {
        this.connection = new Connection(config.SOLANA_RPC_URL);
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.requestCount = 0;
        this.lastReset = Date.now();
        this.RPM_LIMIT = 50;
    }

    async analyzeToken(token) {
        try {
            console.log(`\n📊 Analyzing token: ${token.symbol}`);

            // Basic risk analysis
            const basicAnalysis = this.performBasicAnalysis(token);

            // Check rate limits before AI analysis
            if (await this.canMakeRequest()) {
                try {
                    // AI Analysis using OpenAI
                    const aiAnalysis = await this.performAIAnalysis(token);
                    
                    // Combine analyses
                    const combinedAnalysis = {
                        isRisky: basicAnalysis.isRisky || aiAnalysis.isRisky,
                        riskScore: Math.max(basicAnalysis.riskScore, aiAnalysis.riskScore),
                        warnings: [...new Set([...basicAnalysis.warnings, ...aiAnalysis.warnings])],
                        positiveSignals: [...new Set([...basicAnalysis.positiveSignals, ...aiAnalysis.positiveSignals])],
                        aiSentiment: aiAnalysis.sentiment,
                        tradingRecommendation: aiAnalysis.recommendation,
                        lastUpdated: new Date().toISOString()
                    };

                    console.log('\n=== Analysis Results ===');
                    console.log(`🎯 Risk Score: ${combinedAnalysis.riskScore}`);
                    console.log(`✨ Positive Signals: ${combinedAnalysis.positiveSignals.join(', ')}`);
                    console.log(`⚠️ Warnings: ${combinedAnalysis.warnings.join(', ')}`);
                    console.log(`📈 Trading Recommendation: ${combinedAnalysis.tradingRecommendation}`);
                    console.log(`🌍 Market Sentiment: ${combinedAnalysis.aiSentiment}`);
                    console.log('========================\n');

                    return combinedAnalysis;

                } catch (error) {
                    console.error('❌ AI Analysis Error:', error.message);
                    return {
                        ...basicAnalysis,
                        lastUpdated: new Date().toISOString()
                    };
                }
            } else {
                console.log(`⚠️ Rate limit reached, using basic analysis for ${token.symbol}`);
                return {
                    ...basicAnalysis,
                    lastUpdated: new Date().toISOString()
                };
            }

        } catch (error) {
            console.error(`❌ Error analyzing token ${token.symbol}:`, error);
            return this.getDefaultAnalysis();
        }
    }

    async performAIAnalysis(token) {
        try {
            const prompt = `
                Analyze this cryptocurrency token as a professional trader:
                
                Token Details:
                - Name: ${token.name} (${token.symbol})
                - Current Price: $${token.price}
                - 24h Price Change: ${token.priceChange24h}%
                - 24h Volume: $${token.volume24h.toLocaleString()}
                - Liquidity: $${token.liquidity.toLocaleString()}
                
                Please provide a detailed analysis in this exact format:

                Risk Assessment:
                [High/Medium/Low] risk because [specific reasons]

                Key Strengths:
                - [strength 1]
                - [strength 2]
                - [strength 3]

                Warning Signs:
                - [warning 1]
                - [warning 2]
                - [warning 3]

                Trading Recommendation:
                [BUY/SELL/HOLD] because [specific reason]

                Market Sentiment:
                [Bullish/Bearish/Neutral] because [specific reason]
            `;

            const completion = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional cryptocurrency analyst providing detailed token analysis. Focus on market metrics, trading patterns, and risk assessment. Be specific and actionable in your recommendations."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            const analysis = this.parseAIResponse(completion.choices[0].message.content);
            
            // Add token metrics to analysis
            analysis.tokenMetrics = {
                price: token.price,
                volume24h: token.volume24h,
                liquidity: token.liquidity,
                priceChange24h: token.priceChange24h
            };

            return analysis;

        } catch (error) {
            console.error('Error in AI analysis:', error);
            throw error;
        }
    }

    parseAIResponse(response) {
        try {
            const sections = response.split('\n\n').filter(section => section.trim());
            
            const analysis = {
                isRisky: false,
                riskScore: 50,
                warnings: [],
                positiveSignals: [],
                sentiment: 'Neutral',
                recommendation: 'HOLD',
                analysis: []
            };

            sections.forEach(section => {
                const [title, ...content] = section.split('\n');
                const contentText = content.join(' ').trim();

                if (title.includes('Risk Assessment')) {
                    analysis.isRisky = contentText.toLowerCase().includes('high');
                    analysis.riskScore = contentText.toLowerCase().includes('high') ? 80 :
                                       contentText.toLowerCase().includes('medium') ? 50 : 20;
                    
                    analysis.analysis.push({
                        category: 'Risk Analysis',
                        status: contentText.split(' ')[0],
                        details: contentText.split('because')[1]?.trim() || contentText,
                        confidence: 92
                    });
                }
                else if (title.includes('Key Strengths')) {
                    const strengths = content.map(str => str.replace('-', '').trim())
                                          .filter(str => str.length > 0);
                    analysis.positiveSignals = strengths;
                    
                    analysis.analysis.push({
                        category: 'Strengths Analysis',
                        status: 'Positive',
                        details: strengths.join(', '),
                        confidence: 88
                    });
                }
                else if (title.includes('Warning Signs')) {
                    const warnings = content.map(str => str.replace('-', '').trim())
                                         .filter(str => str.length > 0);
                    analysis.warnings = warnings;
                    
                    analysis.analysis.push({
                        category: 'Risk Indicators',
                        status: warnings.length > 0 ? 'Caution' : 'Safe',
                        details: warnings.join(', ') || 'No significant warnings',
                        confidence: 85
                    });
                }
                else if (title.includes('Trading Recommendation')) {
                    const rec = contentText.split('because');
                    analysis.recommendation = rec[0].trim().toUpperCase();
                    
                    analysis.analysis.push({
                        category: 'Trading Analysis',
                        status: rec[0].trim().toUpperCase(),
                        details: rec[1]?.trim() || 'Based on current metrics',
                        confidence: 90
                    });
                }
                else if (title.includes('Market Sentiment')) {
                    const sent = contentText.split('because');
                    analysis.sentiment = sent[0].trim();
                    
                    analysis.analysis.push({
                        category: 'Market Sentiment',
                        status: sent[0].trim(),
                        details: sent[1]?.trim() || 'Based on market indicators',
                        confidence: 87
                    });
                }
            });

            return analysis;

        } catch (error) {
            console.error('Error parsing AI response:', error);
            return this.getDefaultAnalysis();
        }
    }

    performBasicAnalysis(token) {
        const analysis = {
            isRisky: false,
            riskScore: 0,
            warnings: [],
            positiveSignals: []
        };

        // Liquidity Check
        if (token.liquidity < 10000) {
            analysis.warnings.push('Low liquidity');
            analysis.riskScore += 20;
        } else {
            analysis.positiveSignals.push('Good liquidity');
        }

        // Price Movement Check
        if (Math.abs(token.priceChange24h) > 50) {
            analysis.warnings.push('Extreme price volatility');
            analysis.riskScore += 15;
        } else if (token.priceChange24h > 0) {
            analysis.positiveSignals.push('Positive price trend');
        }

        // Volume Check
        if (token.volume24h < 5000) {
            analysis.warnings.push('Low trading volume');
            analysis.riskScore += 10;
        } else {
            analysis.positiveSignals.push('Healthy trading volume');
        }

        analysis.isRisky = analysis.riskScore > 30;
        return analysis;
    }

    getDefaultAnalysis() {
        return {
            isRisky: false,
            riskScore: 50,
            warnings: ['Analysis currently unavailable'],
            positiveSignals: ['Basic metrics are within normal range'],
            sentiment: 'Neutral',
            recommendation: 'HOLD',
            lastUpdated: new Date().toISOString()
        };
    }

    async canMakeRequest() {
        const now = Date.now();
        const oneMinute = 60000;

        if (now - this.lastReset >= oneMinute) {
            this.requestCount = 0;
            this.lastReset = now;
        }

        if (this.requestCount >= this.RPM_LIMIT) {
            return false;
        }

        this.requestCount++;
        return true;
    }

    async getHolderDistribution(tokenAddress) {
        try {
            // Implement holder distribution analysis
            return {
                topHolderPercentage: 0,
                totalHolders: 0
            };
        } catch (error) {
            console.error('Error getting holder distribution:', error);
            return null;
        }
    }

    async getContractInfo(tokenAddress) {
        try {
            // Implement contract verification check
            return {
                isVerified: false,
                creator: '',
                creationDate: null
            };
        } catch (error) {
            console.error('Error getting contract info:', error);
            return null;
        }
    }

    async analyzeSocialSentiment(symbol) {
        try {
            // Implement social sentiment analysis
            return {
                negativeSentiment: 0,
                positiveSentiment: 0,
                totalMentions: 0
            };
        } catch (error) {
            console.error('Error analyzing social sentiment:', error);
            return null;
        }
    }
}

module.exports = new TokenAnalysisService(); 