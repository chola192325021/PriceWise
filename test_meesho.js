const axios = require('axios');
const cheerio = require('cheerio');

const testMeesho = async (query) => {
    try {
        const url = `https://www.meesho.com/search?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const results = [];
        
        $('a[href*="/p/"]').slice(0, 5).each((i, el) => {
            const container = $(el).closest('div');
            const title = container.find('p').first().text();
            const priceText = container.find('h5').first().text();
            console.log(title, priceText);
        });
    } catch (e) {
        console.error("Meesho Error:", e.message);
    }
};

testMeesho('shirt');
