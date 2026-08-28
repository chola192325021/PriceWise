const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function testReliance() {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const query = "laptop";
    const url = `https://www.reliancedigital.in/search?q=${encodeURIComponent(query)}:relevance`;

    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) req.abort();
        else req.continue();
    });

    try {
        console.log(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const items = await page.evaluate(() => {
            const results = [];
            const cards = document.querySelectorAll('.sp'); // Guessing class name
            cards.forEach(card => {
                const titleEl = card.querySelector('.sp__name') || card.querySelector('p');
                const priceEl = card.querySelector('.TextWeb__Text-sc-1cyx778-0') || card.querySelector('span'); // Guessing
                const linkEl = card.closest('a') || card.querySelector('a');
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
        console.log("Reliance Results:", items);
        
        if (items.length === 0) {
            const text = await page.evaluate(() => document.body.innerText.substring(0, 1000));
            console.log("BODY TEXT:", text);
            // Dump links to see if products are there
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => a.href + " || " + a.innerText);
            });
            console.log("LINKS:", links);
        }

    } catch (e) {
        console.error("Error:", e);
    }
    await browser.close();
}

testReliance();
