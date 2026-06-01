const axios = require('axios');
const cheerio = require('cheerio');

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
};

const searchAmazon = async (query) => {
    try {
        const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, { headers: HEADERS });
        const $ = cheerio.load(data);
        const results = [];

        $('.s-result-item[data-component-type="s-search-result"]').slice(0, 20).each((i, el) => {
            const title = $(el).find('h2 span').text().trim();
            const priceText = $(el).find('.a-price-whole').first().text().replace(/,/g, '');
            const imageUrl = $(el).find('img.s-image').attr('src');
            const link = "https://www.amazon.in" + $(el).find('a.a-link-normal').attr('href');

            if (title && priceText) {
                results.push({
                    platform: 'Amazon',
                    title,
                    price: parseFloat(priceText),
                    imageUrl,
                    url: link
                });
            }
        });
        return results;
    } catch (error) {
        console.error("Amazon search failed:", error.message);
        return [];
    }
};

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const searchFlipkart = async (query) => {
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: "new", 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--disable-gpu', '--window-size=1920x1080'] 
        });
        const page = await browser.newPage();
        
        // Speed up scraping and avoid timeouts by blocking heavy assets
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.flipkart.com/search?q=${encodeURIComponent(query)}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        
        const results = await page.evaluate(() => {
            const items = [];
            const links = document.querySelectorAll('a[href*="/p/"]');
            for (let linkEl of links) {
                const container = linkEl.closest('div[class]') || linkEl.parentElement;
                
                // Flipkart uses various classes for title, or sometimes it's directly in the link's title attribute
                let title = linkEl.getAttribute('title') || linkEl.innerText;
                if (!title || title.length < 5) {
                    const titleEl = container.querySelector('div.KzDlHZ, ._4rR01T, .IRpwTa');
                    if (titleEl) title = titleEl.innerText;
                }
                
                // Find price
                let priceEl = container.querySelector('div.Nx940b, ._30jeq3');
                if (!priceEl) {
                    // Fallback to text matching if classes change
                    const allDivs = container.querySelectorAll('div');
                    for (let d of allDivs) {
                        if (d.innerText && d.innerText.startsWith('₹')) {
                            priceEl = d; break;
                        }
                    }
                }
                
                const imgEl = container.querySelector('img');
                
                if (title && priceEl && items.length < 20) {
                    const priceText = priceEl.innerText.replace(/[₹,a-zA-Z]/g, '').trim();
                    const price = parseFloat(priceText);
                    const link = "https://www.flipkart.com" + linkEl.getAttribute('href');
                    const imageUrl = imgEl ? imgEl.getAttribute('src') : '';
                    if (!isNaN(price) && title.length > 5) {
                        items.push({ platform: 'Flipkart', title, price, imageUrl, url: link });
                    }
                }
            }
            // Deduplicate by URL
            return items.filter((item, index, self) => index === self.findIndex((t) => t.url === item.url)).slice(0, 10);
        });
        
        await browser.close();
        return results;
    } catch (error) {
        console.error("Flipkart search failed:", error.message);
        if (browser) await browser.close();
        return [];
    }
};

const searchMeesho = async (query) => {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        
        // Speed up scraping and avoid timeouts by blocking heavy assets
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.meesho.com/search?q=${encodeURIComponent(query)}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        
        const results = await page.evaluate(() => {
            const items = [];
            const links = document.querySelectorAll('a[href*="/p/"]');
            for (let linkEl of links) {
                // Find the closest container
                const container = linkEl.closest('div') || linkEl.parentElement;
                
                const titleEl = container.querySelector('p'); // Meesho usually uses p tags for titles
                const priceEl = container.querySelector('h5'); // Meesho uses h5 for prices
                const imgEl = container.querySelector('img');
                
                if (titleEl && priceEl && items.length < 20) {
                    const title = titleEl.innerText;
                    const priceText = priceEl.innerText.replace(/[₹,]/g, '').trim();
                    const price = parseFloat(priceText);
                    const link = "https://www.meesho.com" + linkEl.getAttribute('href');
                    const imageUrl = imgEl ? imgEl.getAttribute('src') : '';
                    if (!isNaN(price) && title.length > 3) {
                        items.push({ platform: 'Meesho', title, price, imageUrl, url: link });
                    }
                }
            }
            // Deduplicate by URL
            return items.filter((item, index, self) => index === self.findIndex((t) => t.url === item.url)).slice(0, 10);
        });
        
        await browser.close();
        return results;
    } catch (error) {
        console.error("Meesho search failed:", error.message);
        if (browser) await browser.close();
        return [];
    }
};
    const searchCroma = async (query) => {
        let browser;
        try {
            browser = await puppeteer.launch({ 
                headless: "new", 
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--disable-gpu', '--window-size=1920x1080'] 
            });
            const page = await browser.newPage();
            
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
                else req.continue();
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            const url = `https://www.croma.com/searchB?q=${encodeURIComponent(query)}:relevance`;
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
            
            const results = await page.evaluate(() => {
                const items = [];
                const cards = document.querySelectorAll('.product-item, .product-card, li.product-list-item');
                for (let card of cards) {
                    const titleEl = card.querySelector('h3') || card.querySelector('a');
                    const priceEl = card.querySelector('.amount') || card.querySelector('.new-price');
                    const linkEl = card.querySelector('a');
                    
                    if (titleEl && priceEl && items.length < 20) {
                        const title = titleEl.innerText;
                        const priceText = priceEl.innerText.replace(/[₹,]/g, '').trim();
                        const price = parseFloat(priceText);
                        const link = linkEl.getAttribute('href');
                        const fullLink = link.startsWith('http') ? link : "https://www.croma.com" + link;
                        
                        if (!isNaN(price) && title.length > 5) {
                            items.push({ platform: 'Croma', title, price, imageUrl: '', url: fullLink });
                        }
                    }
                }
                return items;
            });
            
            await browser.close();
            return results;
        } catch (error) {
            console.error("Croma search failed:", error.message);
            if (browser) await browser.close();
            return [];
        }
    };

    const searchReliance = async (query) => {
        let browser;
        try {
            browser = await puppeteer.launch({ 
                headless: "new", 
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-accelerated-2d-canvas', '--disable-gpu', '--window-size=1920x1080'] 
            });
            const page = await browser.newPage();
            
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
                else req.continue();
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            const url = `https://www.reliancedigital.in/search?q=${encodeURIComponent(query)}:relevance`;
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
            
            const results = await page.evaluate(() => {
                const items = [];
                const cards = document.querySelectorAll('.sp, .product-card');
                for (let card of cards) {
                    const titleEl = card.querySelector('.sp__name') || card.querySelector('p');
                    const priceEl = card.querySelector('.TextWeb__Text-sc-1cyx778-0') || card.querySelector('span');
                    const linkEl = card.closest('a') || card.querySelector('a');
                    
                    if (titleEl && priceEl && linkEl && items.length < 20) {
                        const title = titleEl.innerText;
                        const priceText = priceEl.innerText.replace(/[₹,]/g, '').trim();
                        const price = parseFloat(priceText);
                        const link = linkEl.getAttribute('href');
                        const fullLink = link.startsWith('http') ? link : "https://www.reliancedigital.in" + link;
                        
                        if (!isNaN(price) && title.length > 5) {
                            items.push({ platform: 'Reliance Digital', title, price, imageUrl: '', url: fullLink });
                        }
                    }
                }
                return items;
            });
            
            await browser.close();
            return results;
        } catch (error) {
            console.error("Reliance search failed:", error.message);
            if (browser) await browser.close();
            return [];
        }
    };

module.exports = { searchAmazon, searchFlipkart, searchMeesho, searchCroma, searchReliance };