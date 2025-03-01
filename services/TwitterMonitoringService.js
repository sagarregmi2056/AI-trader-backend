const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

class TwitterMonitoringService {
    constructor() {
        this.browser = null;
        this.monitoringInterval = null;
        this.initBrowser();
    }

    async initBrowser() {
        this.browser = await puppeteer.launch({
            headless: "new",
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',
                '--disable-gpu'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
        });
    }

    async monitorContractAddressMentions(contractAddress) {
        let page = null;
        try {
            await this.initBrowser();
            page = await this.browser.newPage();
            
            await page.goto(`https://nitter.net/search?f=tweets&q=${encodeURIComponent(contractAddress)}`);
            await page.waitForSelector('.timeline-item', { timeout: 5000 });

            const html = await page.content();
            const $ = cheerio.load(html);
            
            const mentions = [];
            $('.timeline-item').each((i, elem) => {
                mentions.push({
                    username: $(elem).find('.username').text().trim(),
                    text: $(elem).find('.tweet-content').text().trim(),
                    timestamp: $(elem).find('.tweet-date').attr('title'),
                    isVerified: $(elem).find('.icon-ok').length > 0,
                    stats: {
                        replies: $(elem).find('.icon-comment').parent().text().trim(),
                        retweets: $(elem).find('.icon-retweet').parent().text().trim(),
                        likes: $(elem).find('.icon-heart').parent().text().trim()
                    }
                });
            });

            return this.analyzeTokenMentions(mentions);

        } catch (error) {
            console.error('Error monitoring mentions:', error);
            throw new Error('Failed to monitor mentions');
        } finally {
            if (page) await page.close();
        }
    }

    async analyzeTokenMentions(mentions) {
        try {
            const analysis = {
                totalMentions: mentions.length,
                verifiedMentions: mentions.filter(m => m.isVerified).length,
                sentiment: this.analyzeSentiment(mentions),
                riskScore: 0,
                warnings: [],
                recentMentions: mentions.slice(0, 10),
                lastUpdated: new Date().toISOString()
            };

            // Calculate risk score
            analysis.riskScore = this.calculateRiskScore(analysis);
            analysis.warnings = this.generateWarnings(analysis);

            return analysis;
        } catch (error) {
            console.error('Analysis error:', error);
            throw new Error('Failed to analyze mentions');
        }
    }

    analyzeSentiment(mentions) {
        const sentimentWords = {
            positive: ['bullish', 'moon', 'gem', 'buy', 'great', 'good', 'amazing', 'legit'],
            negative: ['scam', 'rug', 'fake', 'bad', 'avoid', 'suspicious', 'ponzi']
        };

        let sentiment = {
            positive: 0,
            negative: 0,
            neutral: 0
        };

        mentions.forEach(mention => {
            const text = mention.text.toLowerCase();
            let posCount = 0;
            let negCount = 0;

            sentimentWords.positive.forEach(word => {
                if (text.includes(word)) posCount++;
            });

            sentimentWords.negative.forEach(word => {
                if (text.includes(word)) negCount++;
            });

            if (posCount > negCount) sentiment.positive++;
            else if (negCount > posCount) sentiment.negative++;
            else sentiment.neutral++;
        });

        return sentiment;
    }

    calculateRiskScore(analysis) {
        let score = 50; // Base score

        // Adjust based on verified mentions
        if (analysis.verifiedMentions > 5) score -= 10;
        if (analysis.verifiedMentions === 0) score += 20;

        // Adjust based on sentiment
        const sentimentRatio = analysis.sentiment.positive / 
            (analysis.sentiment.negative || 1);
        if (sentimentRatio < 0.5) score += 30;
        if (sentimentRatio > 2) score -= 10;

        return Math.min(100, Math.max(0, score));
    }

    generateWarnings(analysis) {
        const warnings = [];

        if (analysis.totalMentions < 5) {
            warnings.push('Low social media presence');
        }
        if (analysis.verifiedMentions === 0) {
            warnings.push('No verified mentions found');
        }
        if (analysis.sentiment.negative > analysis.sentiment.positive) {
            warnings.push('Negative sentiment detected');
        }

        return warnings;
    }

    async startContinuousMonitoring() {
        try {
            await this.initBrowser();
            console.log('Started Twitter monitoring service');
            
            this.monitoringInterval = setInterval(async () => {
                try {
                    // Your monitoring logic here
                    console.log('Monitoring Twitter mentions...');
                } catch (error) {
                    console.error('Monitoring interval error:', error);
                }
            }, 5 * 60 * 1000);

        } catch (error) {
            console.error('Error starting monitoring:', error);
            throw new Error('Failed to start monitoring');
        }
    }

    async stopMonitoring() {
        try {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
            }
            if (this.browser) {
                await this.browser.close();
            }
            console.log('Stopped Twitter monitoring service');
        } catch (error) {
            console.error('Error stopping monitoring:', error);
        }
    }
}

module.exports = TwitterMonitoringService; 