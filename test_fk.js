const axios = require('axios');
const cheerio = require('cheerio');

const searchFlipkartAxios = async (query) => {
    try {
        const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        const $ = cheerio.load(data);
        const results = [];

        // Flipkart usually obfuscates their classes, but sometimes links work
        $('a[href*="/p/"]').slice(0, 10).each((i, el) => {
            const container = $(el).closest('div');
            let title = $(el).attr('title') || $(el).text();
            
            // Just look for the rupee symbol for price
            let priceText = '';
            container.find('div').each((_, div) => {
                const text = $(div).text();
                if (text.startsWith('₹')) {
                    priceText = text;
                    return false; // break
                }
            });

            if (title && title.length > 5 && priceText) {
                const price = parseFloat(priceText.replace(/[₹,]/g, '').trim());
                if (!isNaN(price)) {
                    results.push({
                        title: title.trim().substring(0, 50),
                        price
                    });
                }
            }
        });

        console.log("Flipkart results:", results.length > 0 ? results : "No results or blocked.");
    } catch (e) {
        console.error("Flipkart Axios Error:", e.message);
    }
};

searchFlipkartAxios('laptop');
