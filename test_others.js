const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5'
};

const testCroma = async (query) => {
    try {
        const url = `https://www.croma.com/searchB?q=${encodeURIComponent(query)}:relevance`;
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);
        console.log("Croma HTML length:", data.length);
        const results = [];
        $('.product-item, .product-card, li.product-list-item').each((i, el) => {
            const title = $(el).find('h3, a').text().trim();
            const price = $(el).find('.amount, .new-price').text().trim();
            if (title && price) results.push({title: title.substring(0,30), price});
        });
        console.log("Croma:", results.slice(0,3));
    } catch (e) { console.error("Croma Error:", e.message); }
};

const testReliance = async (query) => {
    try {
        const url = `https://www.reliancedigital.in/search?q=${encodeURIComponent(query)}:relevance`;
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);
        console.log("Reliance HTML length:", data.length);
        const results = [];
        $('.sp, .product-card').each((i, el) => {
            const title = $(el).find('.sp__name, p').text().trim();
            const price = $(el).find('.TextWeb__Text-sc-1cyx778-0, span').text().trim();
            if (title && price) results.push({title: title.substring(0,30), price});
        });
        console.log("Reliance:", results.slice(0,3));
    } catch (e) { console.error("Reliance Error:", e.message); }
};

async function run() {
    await testCroma("laptop");
    await testReliance("laptop");
}
run();
