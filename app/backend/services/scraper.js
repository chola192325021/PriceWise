const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { cleanProductTitle, buildSearchQuery } = require('./productNormalizer');
const { normalizeProductUrl, toAbsoluteUrl } = require('./productUrlValidator');

puppeteer.use(StealthPlugin());

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9'
};

let globalBrowserPromise = null;

const getBrowser = async () => {
    if (!globalBrowserPromise) {
        console.log("Launching Global Browser...");
        globalBrowserPromise = puppeteer.launch({
            headless: "new",
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-accelerated-2d-canvas', 
                '--disable-gpu', 
                '--disable-site-isolation-trials'
            ]
        }).catch(err => {
            console.error("Failed to launch global browser", err);
            globalBrowserPromise = null;
            throw err;
        });
    }
    return globalBrowserPromise;
};

const searchAmazon = async (query) => {
    const cleanQuery = buildSearchQuery(query);
    if (!cleanQuery) return [];

    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.amazon.in/s?k=${encodeURIComponent(cleanQuery)}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        
        const rawResults = await page.evaluate(() => {
            const items = [];
            const cards = document.querySelectorAll('.s-result-item[data-component-type="s-search-result"]');
            for (let card of cards) {
                const titleEl = card.querySelector('h2 span, h2 a span');
                const priceEl = card.querySelector('.a-price-whole');
                const linkEl = card.querySelector('h2 a, a.a-link-normal[href*="/dp/"], a.a-link-normal');
                const imgEl = card.querySelector('img.s-image');
                
                if (titleEl && priceEl && linkEl && items.length < 20) {
                    const rawTitle = (titleEl.innerText || titleEl.textContent || '').trim();
                    const priceText = priceEl.innerText.replace(/,/g, '').trim();
                    const price = parseFloat(priceText);
                    const rawHref = linkEl.getAttribute('href') || '';
                    const imageUrl = imgEl ? imgEl.getAttribute('src') : '';
                    
                    if (!isNaN(price) && rawTitle && rawHref && !rawHref.startsWith('#')) {
                        items.push({ platform: 'Amazon', rawTitle, price, imageUrl, rawHref });
                    }
                }
            }
            return items;
        });
        
        await page.close();

        // Clean extracted titles, normalize and validate URLs
        return rawResults.map(item => {
            const clean = cleanProductTitle(item.rawTitle);
            const urlValidation = normalizeProductUrl(item.rawHref, 'Amazon');
            return {
                ...item,
                title: clean || item.rawTitle,
                cleanTitle: clean || item.rawTitle,
                url: urlValidation.finalUrl || item.rawHref,
                urlValidation
            };
        }).filter(it => it.title.length > 3 && it.urlValidation.isValid);

    } catch (error) {
        console.error("Amazon search failed:", error.message);
        if (page) await page.close();
        return [];
    }
};

const searchFlipkart = async (query) => {
    const cleanQuery = buildSearchQuery(query);
    if (!cleanQuery) return [];

    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.flipkart.com/search?q=${encodeURIComponent(cleanQuery)}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        
        const rawResults = await page.evaluate(() => {
            const items = [];
            const cardSelectors = ['div[data-id]', 'div._1AtVbE', 'div._2kHMtA', 'div.cPH28e', 'div._75Wfgg', 'div._1sdw2'];
            let cards = [];
            for (let sel of cardSelectors) {
                const found = document.querySelectorAll(sel);
                if (found && found.length > 0) {
                    cards = Array.from(found);
                    if (cards.length >= 3) break;
                }
            }

            if (cards.length === 0) {
                const links = Array.from(document.querySelectorAll('a[href*="/p/"]'));
                const seenCards = new Set();
                for (let a of links) {
                    const parent = a.closest('div[data-id]') || a.closest('div._1AtVbE') || a.parentElement;
                    if (parent && !seenCards.has(parent)) {
                        seenCards.add(parent);
                        cards.push(parent);
                    }
                }
            }

            for (let card of cards) {
                const linkEl = card.querySelector('a[href*="/p/"]');
                if (!linkEl) continue;

                // Priority 1: Title-specific element's title attribute or direct innerText
                let title = "";
                const titleEl = card.querySelector('div.KzDlHZ, ._4rR01T, .IRpwTa, a.w1wT2n, a.WpPhBo, a[title]');
                if (titleEl) {
                    title = titleEl.getAttribute('title') || titleEl.innerText;
                }
                // Priority 2: Link's title attribute only (NEVER linkEl.innerText which contains "Add to Compare" button text)
                if (!title || title.length < 5) {
                    title = linkEl.getAttribute('title') || "";
                }

                let priceEl = card.querySelector('div.Nx940b, ._30jeq3, div._30jeq3');
                if (!priceEl) {
                    const allDivs = card.querySelectorAll('div, span');
                    for (let d of allDivs) {
                        if (d.children.length === 0 && d.innerText && d.innerText.trim().startsWith('₹')) {
                            priceEl = d; break;
                        }
                    }
                }

                const imgEl = card.querySelector('img');

                if (priceEl && items.length < 15) {
                    const priceText = priceEl.innerText.replace(/[₹,a-zA-Z]/g, '').trim();
                    const price = parseFloat(priceText);
                    const rawHref = linkEl.getAttribute('href') || '';
                    
                    let rawTitle = (title || '').trim();

                    // Fallback to clean title from URL slug if title is still missing or corrupted
                    if (rawHref.includes('/p/')) {
                        const slugMatch = rawHref.match(/\/([a-zA-Z0-9\-]+)\/p\//);
                        if (slugMatch && slugMatch[1]) {
                            const slugTitle = slugMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                            if (!rawTitle || rawTitle.length < 5) {
                                rawTitle = slugTitle;
                            }
                        }
                    }

                    const imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
                    if (!isNaN(price) && rawTitle.length > 3 && rawHref.includes('/p/')) {
                        items.push({ platform: 'Flipkart', rawTitle, price, imageUrl, rawHref });
                    }
                }
            }
            return items.filter((item, index, self) => index === self.findIndex((t) => t.rawHref === item.rawHref)).slice(0, 10);
        });
        
        await page.close();

        return rawResults.map(item => {
            const clean = cleanProductTitle(item.rawTitle);
            const urlValidation = normalizeProductUrl(item.rawHref, 'Flipkart');
            return {
                ...item,
                title: clean || item.rawTitle,
                cleanTitle: clean || item.rawTitle,
                url: urlValidation.finalUrl || item.rawHref,
                urlValidation
            };
        }).filter(it => it.title.length > 3 && it.urlValidation.isValid);

    } catch (error) {
        console.error("Flipkart search failed:", error.message);
        if (page) await page.close();
        return [];
    }
};

const searchMeesho = async (query) => {
    const cleanQuery = buildSearchQuery(query);
    if (!cleanQuery) return [];

    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.meesho.com/search?q=${encodeURIComponent(cleanQuery)}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        
        const rawResults = await page.evaluate(() => {
            const items = [];
            const links = document.querySelectorAll('a[href*="/p/"]');
            for (let linkEl of links) {
                const container = linkEl.closest('div') || linkEl.parentElement;
                
                const titleEl = container.querySelector('p');
                const priceEl = container.querySelector('h5');
                const imgEl = container.querySelector('img');
                
                if (titleEl && priceEl && items.length < 20) {
                    const rawTitle = (titleEl.innerText || titleEl.textContent || '').trim();
                    const priceText = priceEl.innerText.replace(/[₹,]/g, '').trim();
                    const price = parseFloat(priceText);
                    const rawHref = linkEl.getAttribute('href') || '';
                    const imageUrl = imgEl ? imgEl.getAttribute('src') : '';
                    if (!isNaN(price) && rawTitle.length > 3 && rawHref) {
                        items.push({ platform: 'Meesho', rawTitle, price, imageUrl, rawHref });
                    }
                }
            }
            return items.filter((item, index, self) => index === self.findIndex((t) => t.rawHref === item.rawHref)).slice(0, 10);
        });
        
        await page.close();

        return rawResults.map(item => {
            const clean = cleanProductTitle(item.rawTitle);
            const urlValidation = normalizeProductUrl(item.rawHref, 'Meesho');
            return {
                ...item,
                title: clean || item.rawTitle,
                cleanTitle: clean || item.rawTitle,
                url: urlValidation.finalUrl || item.rawHref,
                urlValidation
            };
        }).filter(it => it.title.length > 3 && it.urlValidation.isValid);

    } catch (error) {
        console.error("Meesho search failed:", error.message);
        if (page) await page.close();
        return [];
    }
};

const searchCroma = async (query) => {
    const cleanQuery = buildSearchQuery(query);
    if (!cleanQuery) return [];

    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
            
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.croma.com/searchB?q=${encodeURIComponent(cleanQuery)}:relevance`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        
        const rawResults = await page.evaluate(() => {
            const items = [];
            const cards = document.querySelectorAll('.product-item, .product-card, li.product-list-item');
            for (let card of cards) {
                const titleEl = card.querySelector('h3, .product-title, .cp-product-name, [class*="product-title"]');
                const priceEl = card.querySelector('.amount, .new-price, [class*="price"]');
                const linkEl = card.querySelector('a');
                
                if (titleEl && priceEl && linkEl && items.length < 20) {
                    const rawTitle = (titleEl.innerText || titleEl.textContent || linkEl.getAttribute('title') || '').trim();
                    const priceText = priceEl.innerText.replace(/[₹,]/g, '').trim();
                    const price = parseFloat(priceText);
                    const rawHref = linkEl.getAttribute('href') || '';
                    
                    if (!isNaN(price) && rawTitle.length > 3 && rawHref && !rawHref.startsWith('#')) {
                        items.push({ platform: 'Croma', rawTitle, price, imageUrl: '', rawHref });
                    }
                }
            }
            return items;
        });
        
        await page.close();

        return rawResults.map(item => {
            const clean = cleanProductTitle(item.rawTitle);
            const urlValidation = normalizeProductUrl(item.rawHref, 'Croma');
            return {
                ...item,
                title: clean || item.rawTitle,
                cleanTitle: clean || item.rawTitle,
                url: urlValidation.finalUrl || item.rawHref,
                urlValidation
            };
        }).filter(it => it.title.length > 3 && it.urlValidation.isValid);

    } catch (error) {
        console.error("Croma search failed:", error.message);
        if (page) await page.close();
        return [];
    }
};

const searchReliance = async (query) => {
    const cleanQuery = buildSearchQuery(query);
    if (!cleanQuery) return [];

    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
            
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.reliancedigital.in/search?q=${encodeURIComponent(cleanQuery)}:relevance`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        
        const rawResults = await page.evaluate(() => {
            const items = [];
            const cards = document.querySelectorAll('.sp, .product-card');
            for (let card of cards) {
                const titleEl = card.querySelector('.sp__name, p.sp__title');
                const priceEl = card.querySelector('.TextWeb__Text-sc-1cyx778-0') || card.querySelector('span');
                const linkEl = card.closest('a') || card.querySelector('a');
                
                if (titleEl && priceEl && linkEl && items.length < 20) {
                    const rawTitle = (titleEl.innerText || titleEl.textContent || '').trim();
                    const priceText = priceEl.innerText.replace(/[₹,]/g, '').trim();
                    const price = parseFloat(priceText);
                    const rawHref = linkEl.getAttribute('href') || '';
                    
                    if (!isNaN(price) && rawTitle.length > 3 && rawHref && !rawHref.startsWith('#')) {
                        items.push({ platform: 'Reliance Digital', rawTitle, price, imageUrl: '', rawHref });
                    }
                }
            }
            return items;
        });
        
        await page.close();

        return rawResults.map(item => {
            const clean = cleanProductTitle(item.rawTitle);
            const urlValidation = normalizeProductUrl(item.rawHref, 'Reliance Digital');
            return {
                ...item,
                title: clean || item.rawTitle,
                cleanTitle: clean || item.rawTitle,
                url: urlValidation.finalUrl || item.rawHref,
                urlValidation
            };
        }).filter(it => it.title.length > 3 && it.urlValidation.isValid);

    } catch (error) {
        console.error("Reliance search failed:", error.message);
        if (page) await page.close();
        return [];
    }
};

const searchAjio = async (query) => {
    const cleanQuery = buildSearchQuery(query);
    if (!cleanQuery) return [];

    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.ajio.com/search/?text=${encodeURIComponent(cleanQuery)}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        
        const rawResults = await page.evaluate(() => {
            const items = [];
            const cards = document.querySelectorAll('.item, .product-card, div[class*="preview"], a[href*="/p/"]');
            for (let card of cards) {
                const linkEl = card.tagName.toLowerCase() === 'a' ? card : card.querySelector('a[href*="/p/"]');
                const titleEl = card.querySelector('.name, .nameCls, .brand, .fn') || card.querySelector('div[class*="name"]');
                const priceEl = card.querySelector('.price, .price-display, span[class*="price"]') || card.querySelector('span');
                const imgEl = card.querySelector('img');

                if (linkEl && priceEl && items.length < 20) {
                    const rawTitle = titleEl ? titleEl.innerText.trim() : (linkEl.getAttribute('title') || 'AJIO Product');
                    const priceText = priceEl.innerText.replace(/[₹,a-zA-Z]/g, '').trim();
                    const price = parseFloat(priceText);
                    const rawHref = linkEl.getAttribute('href') || '';
                    const imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';

                    if (!isNaN(price) && price > 0 && rawTitle.length > 3 && rawHref) {
                        items.push({ platform: 'AJIO', rawTitle, price, imageUrl, rawHref });
                    }
                }
            }
            return items.filter((item, index, self) => index === self.findIndex((t) => t.rawHref === item.rawHref)).slice(0, 10);
        });

        await page.close();

        return rawResults.map(item => {
            const clean = cleanProductTitle(item.rawTitle);
            const urlValidation = normalizeProductUrl(item.rawHref, 'AJIO');
            return {
                ...item,
                title: clean || item.rawTitle,
                cleanTitle: clean || item.rawTitle,
                url: urlValidation.finalUrl || item.rawHref,
                urlValidation
            };
        }).filter(it => it.title.length > 3 && it.urlValidation.isValid);

    } catch (error) {
        console.error("AJIO search failed:", error.message);
        if (page) await page.close();
        return [];
    }
};

const searchMyntra = async (query) => {
    const cleanQuery = buildSearchQuery(query);
    if (!cleanQuery) return [];

    let page;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        const url = `https://www.myntra.com/search?f=&q=${encodeURIComponent(cleanQuery)}`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
        
        const rawResults = await page.evaluate(() => {
            const items = [];
            const cards = document.querySelectorAll('li.product-base, div.product-tuple, a[href*="/"]');
            for (let card of cards) {
                const linkEl = card.tagName.toLowerCase() === 'a' ? card : card.querySelector('a');
                const titleEl = card.querySelector('.product-product, .product-brand, h3, h4');
                const priceEl = card.querySelector('.product-discountedPrice, .product-price, span.product-discountedPrice');
                const imgEl = card.querySelector('img');

                if (linkEl && priceEl && items.length < 20) {
                    const rawTitle = titleEl ? titleEl.innerText.trim() : 'Myntra Product';
                    const priceText = priceEl.innerText.replace(/[₹,a-zA-Z]/g, '').trim();
                    const price = parseFloat(priceText);
                    const rawHref = linkEl.getAttribute('href') || '';
                    const imageUrl = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';

                    if (!isNaN(price) && price > 0 && rawTitle.length > 3 && rawHref) {
                        items.push({ platform: 'Myntra', rawTitle, price, imageUrl, rawHref });
                    }
                }
            }
            return items.filter((item, index, self) => index === self.findIndex((t) => t.rawHref === item.rawHref)).slice(0, 10);
        });

        await page.close();

        return rawResults.map(item => {
            const clean = cleanProductTitle(item.rawTitle);
            const urlValidation = normalizeProductUrl(item.rawHref, 'Myntra');
            return {
                ...item,
                title: clean || item.rawTitle,
                cleanTitle: clean || item.rawTitle,
                url: urlValidation.finalUrl || item.rawHref,
                urlValidation
            };
        }).filter(it => it.title.length > 3 && it.urlValidation.isValid);

    } catch (error) {
        console.error("Myntra search failed:", error.message);
        if (page) await page.close();
        return [];
    }
};

module.exports = { 
    searchAmazon, 
    searchFlipkart,    
    searchMeesho,
    searchAjio,
    searchMyntra,
    searchCroma,
    searchReliance,
    initBrowser: getBrowser
};
