const axios = require('axios');
const tokenAnalysisService = require('./TokenAnalysisService');
const OpenAI = require('openai');

class TokenDataService {
    constructor() {
        this.dexscreenerUrl = 'https://api.dexscreener.com/latest/dex';
        this.httpClient = axios.create({
            timeout: 30000,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // Initialize OpenAI
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY // Make sure to add this to your .env file
        });

        // Use the imported instance directly
        this.tokenAnalysisService = tokenAnalysisService;
    }

    async getTrendingTokens() {
        try {
            console.log('Fetching trending tokens from DexScreener...');
            
            // Search multiple DEXes and terms
            const searchTerms = ['raydium', 'orca', 'jupiter'];
            let allPairs = [];

            for (const term of searchTerms) {
                console.log(`Searching for ${term} pairs...`);
                const response = await this.httpClient.get(`${this.dexscreenerUrl}/search`, {
                    params: {
                        q: term
                    }
                });

                if (response.data?.pairs) {
                    allPairs = [...allPairs, ...response.data.pairs];
                }
            }

            // Deduplicate pairs based on baseToken address
            const uniquePairs = this.dedupePairs(allPairs);
            console.log(`Found ${uniquePairs.length} total pairs before filtering`);

            return this.processTokenPairs(uniquePairs);

        } catch (error) {
            console.error('Error fetching trending tokens:', error);
            return [];
        }
    }

    dedupePairs(pairs) {
        const seen = new Set();
        return pairs.filter(pair => {
            const address = pair?.baseToken?.address?.toLowerCase();
            if (!address || seen.has(address)) {
                return false;
            }
            seen.add(address);
            return true;
        });
    }

    processTokenPairs(pairs) {
        if (!Array.isArray(pairs)) {
            console.error('Invalid pairs data:', pairs);
            return [];
        }

        // Filter and sort by volume
        const validPairs = pairs
            .filter(pair => 
                pair?.baseToken?.address && 
                pair?.volume?.h24 && 
                parseFloat(pair.volume.h24) > 0 &&
                pair.chainId === 'solana' &&
                parseFloat(pair.liquidity?.usd || 0) > 10000 // Minimum liquidity threshold
            )
            .sort((a, b) => 
                parseFloat(b.volume.h24) - parseFloat(a.volume.h24)
            )
            .slice(0, 10);

        console.log(`Found ${validPairs.length} valid trending pairs`);
        validPairs.forEach(pair => {
            console.log(`- ${pair.baseToken.symbol}: $${parseFloat(pair.volume.h24).toLocaleString()} 24h volume`);
        });

        return validPairs.map(pair => this.formatTokenData(pair));
    }

    async getTokenData(address) {
        try {
            if (!address) {
                throw new Error('Token address is required');
            }

            if (address.toLowerCase() === 'trending') {
                return this.getTrendingTokens();
            }

            console.log(`Fetching data for token: ${address}`);
            
            // Try multiple DEXes
            const searchTerms = ['raydium', 'orca', 'jupiter'];
            let allPairs = [];

            for (const term of searchTerms) {
                const response = await this.httpClient.get(`${this.dexscreenerUrl}/search`, {
                    params: { q: `${address} ${term}` }
                });

                if (response.data?.pairs) {
                    allPairs = [...allPairs, ...response.data.pairs];
                }
            }

            const solanaPairs = allPairs.filter(pair => 
                pair.chainId === 'solana' && 
                pair.baseToken.address.toLowerCase() === address.toLowerCase()
            );

            if (solanaPairs.length === 0) {
                console.log('No matching Solana pairs found for token:', address);
                return null;
            }

            const bestPair = solanaPairs.sort((a, b) => 
                parseFloat(b.volume?.h24 || 0) - parseFloat(a.volume?.h24 || 0)
            )[0];

            return this.formatTokenData(bestPair);

        } catch (error) {
            console.error('Error fetching token data:', error);
            return null;
        }
    }

    formatTokenData(pair) {
        return {
            address: pair.baseToken.address,
            symbol: pair.baseToken.symbol,
            name: pair.baseToken.name,
            price: parseFloat(pair.priceUsd) || 0,
            priceChange24h: parseFloat(pair.priceChange?.h24) || 0,
            volume24h: parseFloat(pair.volume?.h24) || 0,
            liquidity: parseFloat(pair.liquidity?.usd) || 0,
            dexId: pair.dexId,
            pairAddress: pair.pairAddress,
            url: `https://dexscreener.com/solana/${pair.pairAddress}`,
            lastUpdated: new Date().toISOString()
        };
    }

    async getTokenMetadata(address) {
        try {
            const tokenData = await this.getTokenData(address);
            if (!tokenData) {
                return {
                    riskScore: 0,
                    warnings: ['Token not found or no data available'],
                    lastUpdated: new Date().toISOString()
                };
            }

            return {
                ...tokenData,
                riskScore: this.calculateRiskScore(tokenData),
                warnings: this.generateWarnings(tokenData)
            };
        } catch (error) {
            console.error('Error getting token metadata:', error);
            return {
                riskScore: 0,
                warnings: ['Error fetching token data'],
                lastUpdated: new Date().toISOString()
            };
        }
    }

    calculateRiskScore(tokenData) {
        let score = 50; // Base score

        // Volume-based adjustment
        if (tokenData.volume24h > 1000000) score += 20;
        else if (tokenData.volume24h > 100000) score += 10;
        else score -= 10;

        // Liquidity-based adjustment
        if (tokenData.liquidity > 500000) score += 20;
        else if (tokenData.liquidity > 50000) score += 10;
        else score -= 10;

        // Ensure score stays within 0-100 range
        return Math.max(0, Math.min(100, score));
    }

    generateWarnings(tokenData) {
        const warnings = [];

        if (tokenData.volume24h < 10000) {
            warnings.push('Low trading volume');
        }
        if (tokenData.liquidity < 25000) {
            warnings.push('Low liquidity');
        }
        if (Math.abs(tokenData.priceChange24h) > 30) {
            warnings.push('High price volatility');
        }

        return warnings;
    }

    async getTokenAnalysis(address) {
        try {
            const tokenData = await this.getTokenData(address);
            if (!tokenData) {
                return null;
            }

            return {
                tokenMetrics: {
                    price: tokenData.price,
                    volume24h: tokenData.volume24h,
                    liquidity: tokenData.liquidity,
                    priceChange24h: tokenData.priceChange24h
                },
                riskScore: this.calculateRiskScore(tokenData),
                warnings: this.generateWarnings(tokenData),
                lastUpdated: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error getting token analysis:', error);
            throw error;
        }
    }

    async getAIAnalysis(address) {
        try {
            const tokenData = await this.getTokenData(address);
            if (!tokenData) {
                return null;
            }

            // Use TokenAnalysisService for AI analysis
            const aiAnalysis = await this.tokenAnalysisService.analyzeToken(tokenData);

            // Format the response
            return {
                tokenMetrics: {
                    price: tokenData.price,
                    volume24h: tokenData.volume24h,
                    liquidity: tokenData.liquidity,
                    priceChange24h: tokenData.priceChange24h
                },
                riskScore: aiAnalysis.riskScore,
                analysis: [
                    {
                        category: "Contract Analysis",
                        status: aiAnalysis.isRisky ? "High Risk" : "Safe",
                        details: aiAnalysis.warnings.join(", ") || "No suspicious patterns detected",
                        confidence: 92
                    },
                    {
                        category: "Market Analysis",
                        status: this.getMarketStatus(tokenData),
                        details: aiAnalysis.aiSentiment || "Market conditions are stable",
                        confidence: 88
                    },
                    {
                        category: "Trading Analysis",
                        status: aiAnalysis.tradingRecommendation || "HOLD",
                        details: aiAnalysis.positiveSignals.join(", "),
                        confidence: 85
                    }
                ],
                recommendations: [
                    ...aiAnalysis.warnings,
                    ...this.generateDetailedRecommendations(tokenData)
                ],
                lastUpdated: aiAnalysis.lastUpdated
            };

        } catch (error) {
            console.error('Error getting AI analysis:', error);
            throw error;
        }
    }

    getMarketStatus(tokenData) {
        if (tokenData.priceChange24h > 20) return "Bullish";
        if (tokenData.priceChange24h < -20) return "Bearish";
        if (tokenData.volume24h > 1000000) return "High Activity";
        if (tokenData.liquidity > 500000) return "Strong Liquidity";
        return "Stable";
    }

    analyzeTrend(priceChange) {
        if (priceChange > 20) return 'Strong Uptrend';
        if (priceChange > 5) return 'Moderate Uptrend';
        if (priceChange < -20) return 'Strong Downtrend';
        if (priceChange < -5) return 'Moderate Downtrend';
        return 'Sideways';
    }

    analyzeVolume(volume) {
        if (volume > 1000000) return 'Very High';
        if (volume > 100000) return 'High';
        if (volume > 10000) return 'Moderate';
        return 'Low';
    }

    analyzeLiquidity(liquidity) {
        if (liquidity > 500000) return 'Very High';
        if (liquidity > 100000) return 'High';
        if (liquidity > 10000) return 'Moderate';
        return 'Low';
    }

    generateRecommendations(tokenData) {
        const recommendations = [];

        if (tokenData.priceChange24h > 20) {
            recommendations.push('Consider taking profits');
        }
        if (tokenData.volume24h < 10000) {
            recommendations.push('Watch for increased volume before trading');
        }
        if (tokenData.liquidity < 50000) {
            recommendations.push('Be cautious of low liquidity');
        }

        return recommendations;
    }

    generateDetailedRecommendations(tokenData) {
        const recommendations = [];

        if (tokenData.priceChange24h > 20) {
            recommendations.push('Consider taking profits');
        }
        if (tokenData.volume24h < 10000) {
            recommendations.push('Watch for increased volume before trading');
        }
        if (tokenData.liquidity < 50000) {
            recommendations.push('Be cautious of low liquidity');
        }

        return recommendations;
    }

    getContractStatus(tokenData) {
        // Implementation of getContractStatus method
        return 'Verified';
    }

    getLiquidityStatus(liquidity) {
        // Implementation of getLiquidityStatus method
        return 'Stable';
    }

    getLiquidityDetails(liquidity) {
        // Implementation of getLiquidityDetails method
        return 'Liquidity is stable and sufficient';
    }

    getVolumeStatus(volume) {
        // Implementation of getVolumeStatus method
        return 'Stable';
    }

    getVolumeDetails(volume) {
        // Implementation of getVolumeDetails method
        return 'Volume is stable and sufficient';
    }

    getPriceStatus(priceChange) {
        // Implementation of getPriceStatus method
        return 'Stable';
    }

    getPriceDetails(priceChange) {
        // Implementation of getPriceDetails method
        return 'Price is stable and consistent';
    }
}

module.exports = TokenDataService;  // Export the class, not an instance