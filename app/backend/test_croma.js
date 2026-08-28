const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function testCroma() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const query = "laptop";
    const url = `https://www.croma.com/searchB?q=${encodeURIComponent(query)}:relevance`;

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    try {
        console.log(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Try to wait for products to load
        try { await page.waitForSelector('.product-item, .product-card, ul.product-list li', { timeout: 10000 }); } catch(e) {}
        
        const items = await page.evaluate(() => {
            const results = [];
            // Croma often uses <li> with class .product-item or div.product-card
            const cards = document.querySelectorAll('.product-item, .product-card, li.product-list-item');
            cards.forEach(card => {
                const titleEl = card.querySelector('h3') || card.querySelector('a');
                const priceEl = card.querySelector('.amount') || card.querySelector('.new-price');
                const linkEl = card.querySelector('a');
                if (titleEl && priceEl && linkEl && results.length < 5) {
                    results.push({
                        title: titleEl.innerText.trim(),
                        price: priceEl.innerText.trim(),
                        url: linkEl.href
                    });
                }
            });
            return results;
        });
        console.log("Croma Results:", items);
        
        // Also log raw HTML snippet to inspect structure if empty
        if (items.length === 0) {
            const html = await page.content();
            console.log("HTML SNIPPET:", html.substring(0, 1000));
            // Let's dump the text of the body to see what we got
            const text = await page.evaluate(() => document.body.innerText.substring(0, 500));
            console.log("BODY TEXT:", text);
        }

    } catch (e) {
        console.error("Error:", e);
    }
    await browser.close();
}

testCroma();
