const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeGoogle(domain, query) {
    const q = `site:${domain} ${query}`;
    try {
        const { data } = await axios.get('https://www.google.com/search?q=' + encodeURIComponent(q), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });
        
        const $ = cheerio.load(data);
        const results = [];
        
        $('.tF2Cxc').each((i, el) => {
            const url = $(el).find('.yuRUbf a').attr('href');
            const title = $(el).find('.yuRUbf h3').text();
            let price = $(el).find('.a8xnE').text() || $(el).find('.fG8Fp').text();
            price = price.replace(/[^0-9]/g, '');
            if (url && title && price && url.includes(domain)) {
                results.push({ url, title, price: parseFloat(price) });
            }
        });
        console.log(`Results for ${domain}:`, results);
        return results;
    } catch (e) {
        console.error("Error scraping Google:", e.message);
        return [];
    }
}

scrapeGoogle('croma.com', 'laptop');
scrapeGoogle('reliancedigital.in', 'laptop');
