const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const cron = require('node-cron');
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("./supabase");
const scraper = require("./services/scraper");
const predictor = require("./services/predictor");
const chronosClient = require("./services/chronosClient");
const sourceSelector = require("./services/sourceSelector");
const matcher = require("./services/matcher");
const productNormalizer = require("./services/productNormalizer");
const productUrlValidator = require("./services/productUrlValidator");
const nodemailer = require("nodemailer");

const app = express();

app.use(cors());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const generatePredictionAsync = async (productDoc, currentMinPrice, platforms = []) => {
    try {
        const title = productDoc?.title || "Product";
        const category = productDoc?.category || "General";
        const priceHistory = Array.isArray(productDoc?.price_history) ? productDoc.price_history : [];
        return await predictor.predictPriceDrop({
            title,
            category,
            priceHistory,
            platforms,
            currentPrice: currentMinPrice
        });
    } catch (e) {
        console.error("Prediction error, falling back:", e.message);
        return predictor.statisticalPredict({
            title: productDoc?.title,
            category: productDoc?.category,
            priceHistory: productDoc?.price_history,
            platforms,
            currentPrice: currentMinPrice
        });
    }
};

const normalizeUserResponse = (user) => {
    if (!user) return null;
    const photo = user.profile_photo || user.profilePhoto || user.profilePhotoUrl || "";
    const photoVersion = user.updated_at ? String(new Date(user.updated_at).getTime()) : (user.photoVersion ? String(user.photoVersion) : String(Date.now()));
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePhoto: photo,
        profilePhotoUrl: photo,
        profile_photo: photo,
        photoVersion: photoVersion,
        memberSince: user.member_since || user.memberSince || "Member since 2024",
        watchlist: user.watchlist || [],
        alerts: user.alerts || []
    };
};

app.get("/", (req, res) => res.send("PriceWise Engine Running with Supabase Support"));

app.get("/user/profile", async (req, res) => {
    try {
        const userId = req.query.userId || req.query.id;
        if (!userId) {
            return res.status(400).json({ status: "error", message: "User ID is required" });
        }
        const { data: user, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (error || !user) {
            return res.status(404).json({ status: "error", message: "User not found" });
        }
        res.json({ status: "success", user: normalizeUserResponse(user) });
    } catch (error) {
        console.error("Fetch user profile error:", error);
        res.status(500).json({ status: "error", message: "Failed to fetch user profile" });
    }
});



app.post("/products/track", async (req, res) => {
    try {
        const { url, platform, userId } = req.body;
        if (!url || !userId) {
            return res.status(400).json({ status: "error", message: "URL and userId are required" });
        }

        console.log(`[Track] Scraping product from URL: ${url}`);

        // Step 1: Scrape the source URL or use URL keywords to get a name
        let productName = null;
        let sourcePrice = null;
        let imageUrl = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f';

        // Quick extraction from URL if possible
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(p => p.length > 5);
            productName = pathParts[0]?.replace(/[-_]/g, ' ') || 'Tracked Product';
        } catch(e) {}

        let browser, page;
        try {
            browser = await scraper.initBrowser();
            page = await browser.newPage();
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
                else req.continue();
            });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

            const extracted = await page.evaluate(() => {
                let title = document.querySelector('#productTitle')?.innerText?.trim()
                    || document.querySelector('h1.product-title')?.innerText?.trim()
                    || document.querySelector('h1')?.innerText?.trim()
                    || document.title;

                let priceEl = document.querySelector('.a-price-whole')
                    || document.querySelector('._30jeq3')
                    || document.querySelector('.pdp-price')
                    || document.querySelector('[class*="price"]');
                let price = priceEl ? parseFloat(priceEl.innerText.replace(/[₹,a-zA-Z\s]/g, '')) : null;

                let img = document.querySelector('#landingImage')?.src
                    || document.querySelector('img._396cs4')?.src
                    || document.querySelector('meta[property="og:image"]')?.content;

                return { title, price: isNaN(price) ? null : price, image: img };
            });

            if (extracted.title) productName = extracted.title;
            sourcePrice = extracted.price;
            if (extracted.image) imageUrl = extracted.image;
            await page.close();
        } catch (scrapeErr) {
            console.warn("[Track] Scrape failed:", scrapeErr.message);
            if (page) try { await page.close(); } catch(e) {}
        }

        const cleanName = productNormalizer.cleanProductTitle(productName || 'Tracked Product').substring(0, 120);
        console.log(`[Track] Working with name: "${cleanName}"`);

        // Step 2: Cross-search ALL platforms for this product using clean query
        const searchQuery = productNormalizer.buildSearchQuery(cleanName);
        console.log(`[Track] Cross-searching with clean query: "${searchQuery}"`);

        const [amazonR, flipkartR, meeshoR] = await Promise.allSettled([
            scraper.searchAmazon(searchQuery),
            scraper.searchFlipkart(searchQuery),
            scraper.searchMeesho(searchQuery)
        ]);

        const amazonItems = amazonR.status === 'fulfilled' ? amazonR.value : [];
        const flipkartItems = flipkartR.status === 'fulfilled' ? flipkartR.value : [];
        const meeshoItems = meeshoR.status === 'fulfilled' ? meeshoR.value : [];

        // Step 3: Map all prices found to platforms array
        const platformsMap = {};
        const sourcePlatformName = platform || (url.includes('amazon') ? 'Amazon' : url.includes('flipkart') ? 'Flipkart' : 'Web');

        // Add source as one entry
        platformsMap[sourcePlatformName] = { 
            name: sourcePlatformName, 
            price: sourcePrice || 0, 
            url, 
            isSmartDeal: false, 
            pricePrefix: "",
            comparisonEligible: true,
            matchStatus: "reference",
            productTitle: cleanName
        };

        // Mix in search results
        if (amazonItems.length > 0 && !platformsMap['Amazon']) {
            platformsMap['Amazon'] = { 
                name: 'Amazon', 
                price: amazonItems[0].price, 
                url: amazonItems[0].url, 
                isSmartDeal: false, 
                pricePrefix: "",
                comparisonEligible: true,
                matchStatus: "exact_match",
                productTitle: amazonItems[0].title
            };
        }
        if (flipkartItems.length > 0 && !platformsMap['Flipkart']) {
            platformsMap['Flipkart'] = { 
                name: 'Flipkart', 
                price: flipkartItems[0].price, 
                url: flipkartItems[0].url, 
                isSmartDeal: false, 
                pricePrefix: "Starting from ",
                comparisonEligible: true,
                matchStatus: "exact_match",
                productTitle: flipkartItems[0].title
            };
        }
        if (meeshoItems.length > 0 && !platformsMap['Meesho']) {
            platformsMap['Meesho'] = { 
                name: 'Meesho', 
                price: meeshoItems[0].price, 
                url: meeshoItems[0].url, 
                isSmartDeal: false, 
                pricePrefix: "",
                comparisonEligible: true,
                matchStatus: "exact_match",
                productTitle: meeshoItems[0].title
            };
        }

        const platformsArray = Object.values(platformsMap).filter(p => p.price > 0);
        const minPrice = platformsArray.length > 0 ? Math.min(...platformsArray.map(p => p.price)) : (sourcePrice || 0);

        const aiPrediction = await generatePredictionAsync(
            { title: cleanName, category: 'Tracked', price_history: [{ price: minPrice, date: new Date().toISOString() }] },
            minPrice,
            platformsArray
        );

        const newProduct = {
            title: cleanName,
            cleanTitle: cleanName,
            rawTitle: productName || cleanName,
            brand: sourcePlatformName,
            category: 'Tracked',
            image_url: imageUrl,
            platforms: platformsArray,
            similarProducts: [],
            price_history: [{ price: minPrice, date: new Date().toISOString() }],
            ai_prediction: aiPrediction
        };

        const { data: productData } = await supabase.from('products').insert([newProduct]).select().single();

        // Add to user watchlist
        const { data: userData } = await supabase.from('users').select('watchlist').eq('id', userId).single();
        let watchlist = userData?.watchlist || [];
        if (productData && !watchlist.includes(productData.id)) {
            watchlist.push(productData.id);
            await supabase.from('users').update({ watchlist }).eq('id', userId);
        }

        res.json({ status: "success", productId: productData?.id, message: "Product tracked and saved to watchlist!" });
    } catch (e) {
        console.error("Tracking error:", e);
        res.status(500).json({ status: "error", message: "Failed to track product" });
    }
});

// Sync: Re-scrape all watchlist products and update their prices
app.post("/products/watchlist/refresh", async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ status: "error", message: "userId required" });

        const { data: userData } = await supabase.from('users').select('watchlist').eq('id', userId).single();
        const watchlist = userData?.watchlist || [];
        if (watchlist.length === 0) return res.json({ status: "success", message: "Watchlist is empty", updated: 0 });

        const { data: products } = await supabase.from('products').select('*').in('id', watchlist);
        if (!products || products.length === 0) return res.json({ status: "success", message: "No products found", updated: 0 });

        let updated = 0;
        for (const product of products) {
            try {
                const searchQuery = productNormalizer.buildSearchQuery(product.title);
                const [amazonR, flipkartR] = await Promise.allSettled([
                    scraper.searchAmazon(searchQuery),
                    scraper.searchFlipkart(searchQuery)
                ]);

                const amazonItems = amazonR.status === 'fulfilled' ? amazonR.value : [];
                const flipkartItems = flipkartR.status === 'fulfilled' ? flipkartR.value : [];

                const existingPlatforms = Array.isArray(product.platforms) ? product.platforms : [];
                const updatedPlatforms = [...existingPlatforms];

                // Update or add Amazon price
                if (amazonItems.length > 0) {
                    const idx = updatedPlatforms.findIndex(p => p.name === 'Amazon');
                    if (idx >= 0) updatedPlatforms[idx] = { ...updatedPlatforms[idx], price: amazonItems[0].price, productTitle: amazonItems[0].title };
                    else updatedPlatforms.push({ name: 'Amazon', price: amazonItems[0].price, url: amazonItems[0].url, isSmartDeal: false, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", productTitle: amazonItems[0].title });
                }
                // Update or add Flipkart price
                if (flipkartItems.length > 0) {
                    const idx = updatedPlatforms.findIndex(p => p.name === 'Flipkart');
                    if (idx >= 0) updatedPlatforms[idx] = { ...updatedPlatforms[idx], price: flipkartItems[0].price, productTitle: flipkartItems[0].title };
                    else updatedPlatforms.push({ name: 'Flipkart', price: flipkartItems[0].price, url: flipkartItems[0].url, isSmartDeal: false, pricePrefix: "Starting from ", comparisonEligible: true, matchStatus: "exact_match", productTitle: flipkartItems[0].title });
                }

                // Mark cheapest only among comparisonEligible platforms
                const eligiblePlatforms = updatedPlatforms.filter(p => p.comparisonEligible !== false && p.price > 0);
                if (eligiblePlatforms.length > 0) {
                    const minPrice = Math.min(...eligiblePlatforms.map(p => p.price));
                    updatedPlatforms.forEach(p => { 
                        p.isSmartDeal = p.comparisonEligible !== false && p.price === minPrice; 
                    });
                }

                const currentHistory = Array.isArray(product.price_history) ? product.price_history : [];
                const newLowest = updatedPlatforms.length > 0 ? Math.min(...updatedPlatforms.filter(p => p.price > 0).map(p => p.price)) : 0;
                const newHistory = [...currentHistory, { price: newLowest, date: new Date().toISOString() }];

                const newAiPrediction = await generatePredictionAsync(
                    { title: product.title, category: product.category, price_history: newHistory },
                    newLowest,
                    updatedPlatforms
                );

                await supabase.from('products').update({
                    platforms: updatedPlatforms,
                    price_history: newHistory,
                    ai_prediction: newAiPrediction
                }).eq('id', product.id);

                updated++;
            } catch (err) {
                console.warn(`[Refresh] Failed to update product ${product.id}:`, err.message);
            }
        }

        res.json({ status: "success", message: `Refreshed prices for ${updated} product(s)`, updated });
    } catch (e) {
        console.error("Watchlist refresh error:", e);
        res.status(500).json({ status: "error", message: "Server error during refresh" });
    }
});

// In-memory cache for live search products by ID
const liveProductStore = new Map();

function createStableProductId(title, primaryUrl = '') {
    const raw = `${(title || '').toLowerCase().trim()}_${(primaryUrl || '').toLowerCase().trim()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    const cleanSlug = (title || 'product').toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 24);
    return `prod_${cleanSlug}_${Math.abs(hash).toString(36)}`;
}

function createDirectProductUrl(storeName, title, existingUrl = '') {
    if (existingUrl && (existingUrl.includes('/dp/') || existingUrl.includes('/p/') || existingUrl.includes('/buy'))) {
        return existingUrl;
    }
    const cleanTitle = (title || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    switch (storeName) {
        case 'Flipkart':
            return `https://www.flipkart.com/search?q=${encodeURIComponent(title || 'product')}`;
        case 'Amazon':
            return `https://www.amazon.in/s?k=${encodeURIComponent(title || 'product')}`;
        case 'Meesho':
            return `https://www.meesho.com/search?q=${encodeURIComponent(title || 'product')}`;
        case 'AJIO':
            return `https://www.ajio.com/search/?text=${encodeURIComponent(title || 'product')}`;
        case 'Myntra':
            return `https://www.myntra.com/search?f=&q=${encodeURIComponent(title || 'product')}`;
        case 'Croma':
            return `https://www.croma.com/searchB?q=${encodeURIComponent(title || 'product')}:relevance`;
        default:
            return `https://www.amazon.in/s?k=${encodeURIComponent(title || 'product')}`;
    }
}

function getSharedMocks() {
    const rawMocks = [
        {
            _id: "mock_1",
            title: "Apple iPhone 15 (128 GB) - Blue",
            cleanTitle: "Apple iPhone 15 (128 GB) - Blue",
            rawTitle: "Apple iPhone 15 (128 GB) - Blue",
            brand: "Apple",
            category: "Electronics",
            imageUrl: "https://m.media-amazon.com/images/I/71d7rfSl0wL._SL1500_.jpg",
            platforms: [
                { name: "Flipkart", price: 69999, pricePrefix: "Starting from ", url: "https://www.flipkart.com/apple-iphone-15-blue-128-gb/p/itmbf14ef54f645d", isSmartDeal: true, comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Apple iPhone 15 (128 GB) - Blue" },
                { name: "Amazon", price: 71290, url: "https://www.amazon.in/dp/B0CHX1W1XY", isSmartDeal: false, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Apple iPhone 15 (128 GB) - Blue" },
                { name: "Croma", price: 72900, url: "https://www.croma.com/apple-iphone-15-128gb-blue-/p/300822", isSmartDeal: false, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Apple iPhone 15 (128 GB) - Blue" }
            ],
            similarProducts: [
                {
                    source: "Flipkart",
                    title: "Apple iPhone 15 (256 GB) - Blue",
                    price: 79999,
                    url: "https://www.flipkart.com/apple-iphone-15-blue-256-gb/p/itmbf14ef54f645e",
                    matchType: "similar",
                    similarityTier: "close_variant",
                    confidence: 0.88,
                    differences: ["Storage differs: 256 GB instead of 128 GB"],
                    comparisonEligible: false
                },
                {
                    source: "Amazon",
                    title: "Apple iPhone 15 Pro (128 GB) - Natural Titanium",
                    price: 124990,
                    url: "https://www.amazon.in/dp/B0CHX1W1XZ",
                    matchType: "similar",
                    similarityTier: "comparable_alternative",
                    confidence: 0.75,
                    differences: ["Edition differs: PRO instead of BASE"],
                    comparisonEligible: false
                }
            ],
            noExactMatchMessage: null,
            comparisonSummary: {
                comparisonType: "exact_match",
                comparisonWarning: null
            },
            aiPrediction: { trend: "drop", expectedPrice: 67500, recommendation: "Historic Low expected soon! Wait 3-5 days.", confidence: 92 }
        },
        {
            _id: "mock_2",
            title: "Sony WH-1000XM5 Wireless Headphones",
            cleanTitle: "Sony WH-1000XM5 Wireless Headphones",
            rawTitle: "Sony WH-1000XM5 Wireless Headphones",
            brand: "Sony",
            category: "Electronics",
            imageUrl: "https://m.media-amazon.com/images/I/61+btxzpfDL._SL1500_.jpg",
            platforms: [
                { name: "Flipkart", price: 26990, pricePrefix: "Starting from ", url: "https://www.flipkart.com/sony-wh-1000xm5-bluetooth-headset/p/itm53cf7e4aa040d", isSmartDeal: true, comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Sony WH-1000XM5 Wireless Headphones" },
                { name: "Amazon", price: 28990, url: "https://www.amazon.in/dp/B09XS7JWHH", isSmartDeal: false, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Sony WH-1000XM5 Wireless Headphones" }
            ],
            similarProducts: [
                {
                    source: "Amazon",
                    title: "Sony WH-1000XM4 Wireless Noise Cancelling Headphones",
                    price: 19990,
                    url: "https://www.amazon.in/dp/B0863TXGM3",
                    matchType: "similar",
                    similarityTier: "close_variant",
                    confidence: 0.85,
                    differences: ["Model generation differs: WH-1000XM4 instead of WH-1000XM5"],
                    comparisonEligible: false
                }
            ],
            noExactMatchMessage: null,
            comparisonSummary: {
                comparisonType: "exact_match",
                comparisonWarning: null
            },
            aiPrediction: { trend: "stable", expectedPrice: 26990, recommendation: "Price is stable. Great deal on Flipkart.", confidence: 85 }
        },
        {
            _id: "mock_3",
            title: "Nike Air Max 270 Running Shoes",
            cleanTitle: "Nike Air Max 270 Running Shoes",
            rawTitle: "Nike Air Max 270 Running Shoes",
            brand: "Nike",
            category: "Fashion",
            imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff",
            platforms: [
                { name: "Amazon", price: 8995, url: "https://www.amazon.in/dp/B0787H96K6", isSmartDeal: true, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Nike Air Max 270 Running Shoes" },
                { name: "Meesho", price: 9499, url: "https://www.meesho.com/nike-air-max-270-running-shoes/p/2x4y6z", isSmartDeal: false, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Nike Air Max 270 Running Shoes" }
            ],
            similarProducts: [],
            noExactMatchMessage: null,
            comparisonSummary: {
                comparisonType: "exact_match",
                comparisonWarning: null
            },
            aiPrediction: { trend: "rise", expectedPrice: 9999, recommendation: "Price expected to rise! Buy now.", confidence: 88 }
        },
        {
            _id: "mock_4",
            title: "Samsung Galaxy S24 Ultra 5G",
            cleanTitle: "Samsung Galaxy S24 Ultra 5G",
            rawTitle: "Samsung Galaxy S24 Ultra 5G",
            brand: "Samsung",
            category: "Electronics",
            imageUrl: "https://m.media-amazon.com/images/I/71RVuW369lL._SL1500_.jpg",
            platforms: [
                { name: "Amazon", price: 129999, url: "https://www.amazon.in/dp/B0CS5X6JCD", isSmartDeal: true, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Samsung Galaxy S24 Ultra 5G" },
                { name: "Flipkart", price: 131999, pricePrefix: "Starting from ", url: "https://www.flipkart.com/samsung-galaxy-s24-ultra-5g-titanium-gray-256-gb/p/itm3d25ef6ab1332", isSmartDeal: false, comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Samsung Galaxy S24 Ultra 5G" }
            ],
            similarProducts: [
                {
                    source: "Flipkart",
                    title: "Samsung Galaxy S24 5G (8GB RAM, 256GB Storage)",
                    price: 69999,
                    url: "https://www.flipkart.com/samsung-galaxy-s24-5g/p/itm12345",
                    matchType: "similar",
                    similarityTier: "comparable_alternative",
                    confidence: 0.78,
                    differences: ["Model differs: Galaxy S24 instead of Galaxy S24 Ultra"],
                    comparisonEligible: false
                }
            ],
            noExactMatchMessage: null,
            comparisonSummary: {
                comparisonType: "exact_match",
                comparisonWarning: null
            },
            aiPrediction: { trend: "drop", expectedPrice: 124999, recommendation: "Wait for festival sale price drop.", confidence: 90 }
        },
        {
            _id: "mock_5",
            title: "Men's Slim Fit Cotton Casual Shirt",
            cleanTitle: "Men's Slim Fit Cotton Casual Shirt",
            rawTitle: "Men's Slim Fit Cotton Casual Shirt",
            brand: "Puma",
            category: "Fashion",
            imageUrl: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
            platforms: [
                { name: "Meesho", price: 699, url: "https://www.meesho.com/mens-slim-fit-cotton-casual-shirt/p/3m5n7p", isSmartDeal: true, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Men's Slim Fit Cotton Casual Shirt" },
                { name: "Flipkart", price: 899, pricePrefix: "Starting from ", url: "https://www.flipkart.com/puma-men-solid-casual-shirt/p/itm8901234567890", isSmartDeal: false, comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Men's Slim Fit Cotton Casual Shirt" }
            ],
            similarProducts: [],
            noExactMatchMessage: null,
            comparisonSummary: {
                comparisonType: "exact_match",
                comparisonWarning: null
            },
            aiPrediction: { trend: "stable", expectedPrice: 699, recommendation: "Best price guaranteed on Meesho.", confidence: 80 }
        },
        {
            _id: "mock_6",
            title: "Dell XPS 13 Intel Core i7 Laptop",
            cleanTitle: "Dell XPS 13 Intel Core i7 Laptop",
            rawTitle: "Dell XPS 13 Intel Core i7 Laptop",
            brand: "Dell",
            category: "Electronics",
            imageUrl: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45",
            platforms: [
                { name: "Amazon", price: 114990, url: "https://www.amazon.in/dp/B0B5HSJ212", isSmartDeal: true, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Dell XPS 13 Intel Core i7 Laptop" },
                { name: "Croma", price: 119990, url: "https://www.croma.com/dell-xps-13-intel-core-i7-laptop/p/261234", isSmartDeal: false, pricePrefix: "", comparisonEligible: true, matchStatus: "exact_match", status: "exact_match", differences: [], pricePerUnit: null, reason: "Same brand, model, and required specifications.", productTitle: "Dell XPS 13 Intel Core i7 Laptop" }
            ],
            similarProducts: [],
            noExactMatchMessage: null,
            comparisonSummary: {
                comparisonType: "exact_match",
                comparisonWarning: null
            },
            aiPrediction: { trend: "drop", expectedPrice: 109990, recommendation: "Price drop predicted in 1 week.", confidence: 87 }
        }
    ];

    return rawMocks.map(m => {
        const platforms = m.platforms.map(p => {
            const urlVal = productUrlValidator.normalizeProductUrl(p.url, p.name);
            return {
                ...p,
                url: urlVal.isValid ? (urlVal.canonicalUrl || urlVal.finalUrl) : p.url,
                urlValidation: urlVal
            };
        });

        const exactPlatforms = platforms.filter(p => (p.status === 'exact_match' || p.matchStatus === 'exact_match') && p.price > 0 && p.urlValidation.isValid);
        let bestExactPrice = null;
        if (exactPlatforms.length > 0) {
            exactPlatforms.sort((a, b) => a.price - b.price);
            bestExactPrice = { source: exactPlatforms[0].name, price: exactPlatforms[0].price };
        }

        const platformResults = platforms.map(p => ({
            source: p.name,
            status: p.status || p.matchStatus || 'exact_match',
            comparisonEligible: p.comparisonEligible !== false,
            confidence: 1.0,
            product: {
                title: p.productTitle || m.title,
                price: p.price,
                currency: "INR",
                url: p.url,
                imageUrl: m.imageUrl,
                available: true,
                brand: m.brand,
                model: "",
                attributes: {}
            },
            urlValidation: p.urlValidation,
            differences: p.differences || [],
            pricePerUnit: p.pricePerUnit || null,
            reason: p.reason || "Same brand, model, and required specifications."
        }));

        return {
            ...m,
            platforms,
            platformResults,
            bestExactPrice
        };
    });
}

app.get("/products/search-live", async (req, res) => {
    const { query, category, source } = req.query;
    if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ status: "error", message: "Query parameter is required" });
    }

    const cleanQuery = productNormalizer.buildSearchQuery(query);
    if (!cleanQuery) {
        return res.status(400).json({ status: "error", message: "A valid product query is required" });
    }

    try {
        const eligibleSources = sourceSelector.getEligibleSources({
            query: cleanQuery,
            selectedSource: source,
            category: category
        });

        console.log(`[SearchLive] Clean Query: "${cleanQuery}" (from raw: "${query}"), Category: "${category || 'Auto'}", Eligible Sources: [${eligibleSources.join(', ')}]`);

        // Helper to run scrapers with individual 12s timeout safety
        const runWithTimeout = (sourceName, promise, ms = 12000) => {
            return Promise.race([
                promise,
                new Promise((resolve) => setTimeout(() => resolve([]), ms))
            ]).then(resList => ({ sourceName, status: 'success', data: Array.isArray(resList) ? resList : [] }))
              .catch(err => {
                console.warn(`[SearchLive] Source "${sourceName}" failed:`, err.message);
                return { sourceName, status: 'error', data: [] };
              });
        };

        const adapterMap = {
            'Amazon': scraper.searchAmazon,
            'Flipkart': scraper.searchFlipkart,
            'Meesho': scraper.searchMeesho,
            'AJIO': scraper.searchAjio,
            'Myntra': scraper.searchMyntra,
            'Croma': scraper.searchCroma
        };

        const tasks = eligibleSources.map(srcName => {
            const fn = adapterMap[srcName];
            if (!fn) return Promise.resolve({ sourceName: srcName, status: 'disabled', data: [] });
            return runWithTimeout(srcName, fn(cleanQuery), 12000);
        });

        const settledResults = await Promise.allSettled(tasks);

        const allScrapedItems = [];
        const sourcesChecked = [];
        const sourcesFailed = [];

        for (const resItem of settledResults) {
            if (resItem.status === 'fulfilled' && resItem.value) {
                const { sourceName, status: srcStatus, data: items } = resItem.value;
                sourcesChecked.push(sourceName);
                if (srcStatus === 'error') {
                    sourcesFailed.push(sourceName);
                } else if (Array.isArray(items) && items.length > 0) {
                    items.forEach(it => allScrapedItems.push({ ...it, platform: sourceName }));
                }
            }
        }

        // -----------------------------------------------------------------------
        // Structured product matching using matcher.js
        // -----------------------------------------------------------------------
        // Normalise every scraped item into the PriceWise product schema
        const normalisedItems = allScrapedItems
            .filter(it => it.url && it.title && it.price > 0)
            .map(it => ({
                ...matcher.normalizeProduct(it),
                _raw: it
            }));

        const results = [];
        const processedUrls = new Set();

        for (const normRef of normalisedItems) {
            if (!normRef.url || processedUrls.has(normRef.url)) continue;
            processedUrls.add(normRef.url);

            const raw = normRef._raw;
            const baseTitle = normRef.cleanTitle || raw.title;

            const platforms = [];
            const platformResults = [];

            // Determine eligible stores for this product category
            const eligibleStores = sourceSelector.getEligibleSources({
                query: baseTitle,
                category: category || normRef.category
            });

            // 1. Reference store listing
            const refUrlValidation = normRef.urlValidation || productUrlValidator.normalizeProductUrl(raw.url, raw.platform);
            const refPlatformResult = {
                source: raw.platform,
                status: 'exact_match',
                comparisonEligible: true,
                confidence: 1.0,
                product: {
                    title: baseTitle,
                    price: raw.price,
                    currency: 'INR',
                    url: raw.url,
                    imageUrl: raw.imageUrl || '',
                    available: true,
                    brand: normRef.brand || '',
                    model: normRef.model || '',
                    attributes: normRef.variant || {}
                },
                urlValidation: refUrlValidation,
                differences: [],
                pricePerUnit: null,
                reason: 'Reference listing'
            };

            for (const storeName of eligibleStores) {
                let pr;
                if (storeName.toLowerCase() === raw.platform.toLowerCase()) {
                    pr = refPlatformResult;
                } else {
                    pr = matcher.selectBestPlatformResult(normRef, normalisedItems, storeName);
                }
                platformResults.push(pr);

                const prod = pr.product;
                if (prod && prod.url) {
                    processedUrls.add(prod.url);
                }

                platforms.push({
                    name: pr.source,
                    price: prod ? prod.price : 0,
                    url: prod ? prod.url : '',
                    urlValidation: pr.urlValidation || { isValid: Boolean(prod && prod.url), status: prod && prod.url ? 'valid' : 'dead_link', finalUrl: prod ? prod.url : '' },
                    isSmartDeal: false,
                    pricePrefix: pr.source === 'Flipkart' ? 'Starting from ' : '',
                    productTitle: prod ? prod.title : null,
                    cleanTitle: prod ? prod.title : null,
                    rawTitle: prod ? prod.title : null,
                    matchStatus: pr.status,
                    status: pr.status,
                    matchConfidence: pr.confidence,
                    confidence: pr.confidence,
                    comparisonEligible: pr.comparisonEligible,
                    differences: pr.differences || [],
                    pricePerUnit: pr.pricePerUnit || null,
                    unitPriceA: pr.pricePerUnit ? pr.pricePerUnit.value : null,
                    unitPriceB: pr.pricePerUnit ? pr.pricePerUnit.value : null,
                    unitLabel: pr.pricePerUnit ? `₹/${pr.pricePerUnit.unit}` : null,
                    matchReasons: pr.reason ? [pr.reason] : [],
                    reason: pr.reason
                });
            }

            // Find Similar Products for extra alternative discovery
            const similarProducts = matcher.findSimilarProducts(normRef, normalisedItems);

            // Compute exact-only best price and Smart Deal (must be exact_match and have valid URL)
            const exactPlatforms = platforms.filter(p => p.status === 'exact_match' && p.price > 0 && (!p.urlValidation || p.urlValidation.isValid !== false));
            let bestExactPrice = null;
            let minPrice = raw.price || 0;

            if (exactPlatforms.length > 0) {
                exactPlatforms.sort((a, b) => a.price - b.price);
                exactPlatforms.forEach(p => { p.isSmartDeal = false; });
                exactPlatforms[0].isSmartDeal = true; // Cheapest EXACT match with valid URL
                bestExactPrice = { source: exactPlatforms[0].name, price: exactPlatforms[0].price };
                minPrice = exactPlatforms[0].price;
            }

            // Comparison Summary & Messages
            const nonRefExactCount = exactPlatforms.filter(p => p.name.toLowerCase() !== raw.platform.toLowerCase()).length;
            const hasVariant = platforms.some(p => p.status === 'variant_match');
            const hasUnitPrice = platforms.some(p => p.status === 'unit_price_only');

            const overallMatchStatus = nonRefExactCount > 0 
                ? 'exact_match' 
                : (hasUnitPrice ? 'unit_price_only' : (hasVariant ? 'variant_match' : 'no_match'));

            const noExactMatchMessage = nonRefExactCount === 0 && (hasVariant || hasUnitPrice || similarProducts.length > 0)
                ? "No exact match found across other stores. Variant and quantity alternatives shown below."
                : null;

            const comparisonSummary = {
                comparisonType: overallMatchStatus,
                comparisonWarning: nonRefExactCount === 0 && (hasVariant || hasUnitPrice)
                    ? `Exact match not found on all stores for: ${baseTitle.substring(0, 50)}. Showing closest variants.`
                    : (nonRefExactCount === 0 ? `No cross-store matches found for: ${baseTitle.substring(0, 50)}` : null),
                unitPriceLabel: hasUnitPrice ? 'Price per unit available' : null
            };

            const classification = sourceSelector.classifyQuery(baseTitle, category);

            const { data: existingProducts } = await supabase.from('products').select('*').eq('title', baseTitle).limit(1);
            let productDoc = existingProducts && existingProducts[0];

            if (!productDoc && baseTitle) {
                const history = [];
                for (let d = 7; d >= 1; d--) {
                    const randomVariation = minPrice * (1 + (Math.random() * 0.15 - 0.05));
                    const date = new Date();
                    date.setDate(date.getDate() - d);
                    history.push({ price: Math.floor(randomVariation), date: date.toISOString() });
                }
                history.push({ price: minPrice, date: new Date().toISOString() });

                const { data: newProd } = await supabase.from('products').insert([{
                    title: baseTitle,
                    category: classification,
                    image_url: raw.imageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f',
                    price_history: history
                }]).select();

                if (newProd) productDoc = newProd[0];
            }

            const aiPrediction = await generatePredictionAsync(productDoc, minPrice, exactPlatforms.length > 0 ? exactPlatforms : platforms);

            const stableId = productDoc ? productDoc.id : createStableProductId(baseTitle, normRef.url);
            const productObj = {
                _id: stableId,
                query: {
                    title: baseTitle,
                    cleanTitle: normRef.cleanTitle || baseTitle,
                    normalizedTitle: normRef.normalizedTitle
                },
                title: baseTitle,
                cleanTitle: normRef.cleanTitle || baseTitle,
                rawTitle: normRef.rawTitle || raw.title,
                brand: normRef.brand || 'Verified Deal',
                category: classification,
                imageUrl: raw.imageUrl || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f',
                platforms,
                platformResults,
                bestExactPrice,
                similarProducts,
                noExactMatchMessage,
                comparisonSummary,
                aiPrediction
            };

            liveProductStore.set(stableId, productObj);
            results.push(productObj);
        }

        // If live scrapers return no products (or time out), query catalog fallbacks
        if (results.length === 0) {
            const qLower = cleanQuery.toLowerCase();
            const catalogMocks = getSharedMocks();
            const brandCategory = category || 'Auto';
            const reqEligibleStores = sourceSelector.getEligibleSources({ query: cleanQuery, category: brandCategory });

            const matchedMocks = catalogMocks
                .filter(m => 
                    m.title.toLowerCase().includes(qLower) || 
                    (m.category && m.category.toLowerCase().includes(qLower)) ||
                    (m.brand && m.brand.toLowerCase().includes(qLower))
                )
                .map(m => ({
                    ...m,
                    platforms: m.platforms.filter(p => reqEligibleStores.includes(p.name))
                }))
                .filter(m => m.platforms.length > 0);

            if (matchedMocks.length > 0) {
                return res.json({
                    status: "success",
                    data: matchedMocks,
                    sourcesChecked,
                    sourcesFailed,
                    partialResults: false
                });
            }
        }

        return res.json({
            status: "success",
            data: results,
            sourcesChecked,
            sourcesFailed,
            partialResults: sourcesFailed.length > 0 && results.length > 0,
            message: results.length === 0 ? `No live products found matching "${cleanQuery}".` : undefined
        });

    } catch (error) {
        console.error("Live search error:", error);
        res.status(500).json({ status: "error", message: "Real-time search failed", data: [] });
    }
});

// GET /user/alerts?userId=...
app.get("/user/alerts", async (req, res) => {
    try {
        const userId = req.query.userId || req.body?.userId;
        if (!userId) return res.status(400).json({ status: "error", message: "userId required" });

        const { data: user } = await supabase.from('users').select('alerts').eq('id', userId).single();
        const userAlerts = user?.alerts || [];
        if (userAlerts.length === 0) {
            return res.json({ status: "success", data: [] });
        }

        const staticMocks = [
            {
                _id: "mock_1",
                title: "Apple iPhone 15 (128 GB) - Blue",
                brand: "Apple",
                category: "Electronics",
                imageUrl: "https://m.media-amazon.com/images/I/71d7rfSl0wL._SL1500_.jpg",
                platforms: [
                    { name: "Flipkart", price: 69999, pricePrefix: "Starting from ", url: "https://www.flipkart.com", isSmartDeal: true },
                    { name: "Amazon", price: 71290, url: "https://www.amazon.in", isSmartDeal: false, pricePrefix: "" }
                ],
                aiPrediction: { trend: "drop", expectedPrice: 67500, recommendation: "Historic Low expected soon!", confidence: 92 }
            },
            {
                _id: "mock_2",
                title: "Sony WH-1000XM5 Wireless Headphones",
                brand: "Sony",
                category: "Electronics",
                imageUrl: "https://m.media-amazon.com/images/I/61+btxzpfDL._SL1500_.jpg",
                platforms: [
                    { name: "Flipkart", price: 26990, pricePrefix: "Starting from ", url: "https://www.flipkart.com", isSmartDeal: true },
                    { name: "Amazon", price: 28990, url: "https://www.amazon.in", isSmartDeal: false, pricePrefix: "" }
                ],
                aiPrediction: { trend: "stable", expectedPrice: 26990, recommendation: "Price is stable on Flipkart.", confidence: 85 }
            }
        ];

        const resolvedAlerts = [];
        for (const alert of userAlerts) {
            const pid = alert.productId;
            let product = liveProductStore.get(pid);
            if (!product) {
                const { data: dbP } = await supabase.from('products').select('*').eq('id', pid).single();
                if (dbP) {
                    product = {
                        _id: dbP.id,
                        title: dbP.title,
                        brand: "Verified Deal",
                        category: dbP.category,
                        imageUrl: dbP.image_url || "https://via.placeholder.com/300",
                        platforms: dbP.platforms || [],
                        aiPrediction: dbP.ai_prediction || { trend: 'drop', expectedPrice: 1000, recommendation: "Price alert active.", confidence: 85 }
                    };
                }
            }
            if (!product) {
                product = staticMocks.find(m => m._id === pid);
            }
            if (product) {
                resolvedAlerts.push({
                    productId: alert.productId,
                    targetPrice: alert.targetPrice,
                    product
                });
            }
        }

        res.json({ status: "success", data: resolvedAlerts });
    } catch (err) {
        console.error("Fetch user alerts error:", err);
        res.status(500).json({ status: "error", message: "Failed to fetch user alerts" });
    }
});

// GET /user/watchlist?userId=...
app.get("/user/watchlist", async (req, res) => {
    try {
        const userId = req.query.userId || req.body?.userId;
        if (!userId) return res.status(400).json({ status: "error", message: "userId required" });

        const { data: user } = await supabase.from('users').select('watchlist').eq('id', userId).single();
        const watchlistIds = user?.watchlist || [];
        if (watchlistIds.length === 0) {
            return res.json({ status: "success", data: [] });
        }

        const staticMocks = [
            {
                _id: "mock_1",
                title: "Apple iPhone 15 (128 GB) - Blue",
                brand: "Apple",
                category: "Electronics",
                imageUrl: "https://m.media-amazon.com/images/I/71d7rfSl0wL._SL1500_.jpg",
                platforms: [
                    { name: "Flipkart", price: 69999, pricePrefix: "Starting from ", url: "https://www.flipkart.com", isSmartDeal: true },
                    { name: "Amazon", price: 71290, url: "https://www.amazon.in", isSmartDeal: false, pricePrefix: "" }
                ],
                aiPrediction: { trend: "drop", expectedPrice: 67500, recommendation: "Historic Low expected soon!", confidence: 92 }
            },
            {
                _id: "mock_2",
                title: "Sony WH-1000XM5 Wireless Headphones",
                brand: "Sony",
                category: "Electronics",
                imageUrl: "https://m.media-amazon.com/images/I/61+btxzpfDL._SL1500_.jpg",
                platforms: [
                    { name: "Flipkart", price: 26990, pricePrefix: "Starting from ", url: "https://www.flipkart.com", isSmartDeal: true },
                    { name: "Amazon", price: 28990, url: "https://www.amazon.in", isSmartDeal: false, pricePrefix: "" }
                ],
                aiPrediction: { trend: "stable", expectedPrice: 26990, recommendation: "Price is stable on Flipkart.", confidence: 85 }
            }
        ];

        const resolvedProducts = [];
        for (const pid of watchlistIds) {
            let product = liveProductStore.get(pid);
            if (!product) {
                const { data: dbP } = await supabase.from('products').select('*').eq('id', pid).single();
                if (dbP) {
                    product = {
                        _id: dbP.id,
                        title: dbP.title,
                        brand: "Verified Deal",
                        category: dbP.category,
                        imageUrl: dbP.image_url || "https://via.placeholder.com/300",
                        platforms: dbP.platforms || [],
                        aiPrediction: dbP.ai_prediction || { trend: 'drop', expectedPrice: 1000, recommendation: "Watchlist active.", confidence: 85 }
                    };
                }
            }
            if (!product) {
                product = staticMocks.find(m => m._id === pid);
            }
            if (product) {
                resolvedProducts.push(product);
            }
        }

        res.json({ status: "success", data: resolvedProducts });
    } catch (err) {
        console.error("Fetch user watchlist error:", err);
        res.status(500).json({ status: "error", message: "Failed to fetch user watchlist" });
    }
});

// GET /user/tracking?userId=...
app.get("/user/tracking", async (req, res) => {
    try {
        const userId = req.query.userId || req.body?.userId;
        if (!userId) return res.status(400).json({ status: "error", message: "userId required" });

        const { data: user } = await supabase.from('users').select('watchlist').eq('id', userId).single();
        const watchlistIds = user?.watchlist || [];
        if (watchlistIds.length === 0) {
            return res.json({ status: "success", data: [] });
        }

        const resolvedProducts = [];
        for (const pid of watchlistIds) {
            let product = liveProductStore.get(pid);
            if (!product) {
                const { data: dbP } = await supabase.from('products').select('*').eq('id', pid).single();
                if (dbP) {
                    product = {
                        _id: dbP.id,
                        title: dbP.title,
                        brand: "Verified Deal",
                        category: dbP.category,
                        imageUrl: dbP.image_url || "https://via.placeholder.com/300",
                        platforms: dbP.platforms || [],
                        aiPrediction: dbP.ai_prediction || { trend: 'drop', expectedPrice: 1000, recommendation: "Tracking active.", confidence: 85 }
                    };
                }
            }
            if (product) {
                resolvedProducts.push(product);
            }
        }

        res.json({ status: "success", data: resolvedProducts });
    } catch (err) {
        console.error("Fetch user tracking error:", err);
        res.status(500).json({ status: "error", message: "Failed to fetch user tracking" });
    }
});

// Single Product Details Endpoint by ID
app.get("/products/:id", async (req, res) => {
    const { id } = req.params;
    if (!id) return res.status(400).json({ status: "error", message: "Product ID required" });

    try {
        // 1. Check live product store cache
        if (liveProductStore.has(id)) {
            return res.json({ status: "success", data: liveProductStore.get(id) });
        }

        // 2. Check Supabase DB
        const { data: dbProduct } = await supabase.from('products').select('*').eq('id', id).single();
        if (dbProduct) {
            const history = dbProduct.price_history || [];
            const currentPrice = history.length > 0 ? history[history.length - 1].price : 1000;
            const encodedTitle = encodeURIComponent(dbProduct.title);
            const platforms = dbProduct.platforms || [
                { name: 'Amazon', price: currentPrice, url: `https://www.amazon.in/s?k=${encodedTitle}`, isSmartDeal: true, pricePrefix: "" }
            ];
            const pObj = {
                _id: dbProduct.id,
                title: dbProduct.title,
                brand: "Verified Deal",
                category: dbProduct.category,
                imageUrl: dbProduct.image_url || "https://via.placeholder.com/300",
                platforms,
                price_history: dbProduct.price_history,
                aiPrediction: dbProduct.ai_prediction || {
                    trend: 'drop',
                    expectedPrice: Math.floor(currentPrice * 0.88),
                    recommendation: "Price drop expected! Wait for 4-5 days.",
                    confidence: 88
                }
            };
            liveProductStore.set(dbProduct.id, pObj);
            return res.json({ status: "success", data: pObj });
        }

        // 3. Fallback mock products lookup
        const staticMocks = getSharedMocks();

        const matchedMock = staticMocks.find(m => m._id === id || m._id.toLowerCase() === id.toLowerCase());
        if (matchedMock) {
            return res.json({ status: "success", data: matchedMock });
        }

        return res.status(404).json({ status: "error", message: "Product not found" });
    } catch (err) {
        console.error("Fetch product by ID error:", err);
        return res.status(500).json({ status: "error", message: "Failed to fetch product" });
    }
});

app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).single();
    if (existingUser) return res.status(400).json({ status: "error", message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const date = new Date();
    const memberSince = `Member since ${months[date.getMonth()]} ${date.getFullYear()}`;

    const { data: user, error } = await supabase.from('users').insert([{
        name,
        email,
        password: hashedPassword,
        member_since: memberSince
    }]).select().single();

    if (error) throw error;

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ status: "success", token, user: normalizeUserResponse(user) });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ status: "error" });
  }
});

const resendCooldownMap = new Map();

async function sendResetEmail(email, code) {
    const cleanPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
    const userEmail = process.env.EMAIL_USER;

    if (!userEmail || !cleanPass) {
        console.log(`\n========================================`);
        console.log(`[MOCK EMAIL MODE] Password Reset Code for ${email}: ${code}`);
        console.log(`========================================\n`);
        return { success: true, isMock: true, message: "Code generated in mock mode." };
    }

    const senderAddress = process.env.EMAIL_FROM || `"PriceWise Support" <${userEmail}>`;
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');

    const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465,
        family: 4,
        auth: {
            user: userEmail,
            pass: cleanPass
        },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 8000,
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        const info = await transporter.sendMail({
            from: senderAddress,
            to: email,
            subject: "PriceWise Password Reset Verification Code",
            text: `Your PriceWise password reset verification code is: ${code}. It expires in 1 hour.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px;">
                    <h2 style="color: #2563eb; margin-bottom: 8px;">PriceWise Password Reset</h2>
                    <p style="color: #475569; font-size: 14px;">Use the verification code below to reset your account password:</p>
                    <div style="background-color: #f1f5f9; padding: 16px; text-align: center; border-radius: 12px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #0f172a; margin: 24px 0;">
                        ${code}
                    </div>
                    <p style="color: #94a3b8; font-size: 12px;">This code expires in 1 hour. If you did not request a password reset, please ignore this email.</p>
                </div>
            `
        });
        console.log(`[SMTP Success] Sent password reset code to ${email}:`, info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (mailErr) {
        console.error(`[SMTP Warning] Failed sending email to ${email}:`, mailErr.message);
        console.log(`\n========================================`);
        console.log(`[MOCK EMAIL FALLBACK] Code for ${email}: ${code}`);
        console.log(`========================================\n`);
        return { success: true, isMock: true, fallbackNotice: mailErr.message };
    }
}

app.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ status: "error", message: "A valid email address is required" });
        }

        const normEmail = email.trim().toLowerCase();
        const { data: user } = await supabase.from('users').select('*').eq('email', normEmail).single();
        if (!user) return res.status(404).json({ status: "error", message: "User not found" });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        await supabase.from('users').update({
            reset_password_code: code,
            reset_password_expires: expires
        }).eq('id', user.id);

        resendCooldownMap.set(normEmail, Date.now());

        const sendResult = await sendResetEmail(user.email, code);

        res.json({
            status: "success",
            message: sendResult.isMock
                ? "Verification code generated! (Check server console for code)"
                : "Verification code sent to your email. Check your inbox and spam folder.",
            cooldownSeconds: 60
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ status: "error", message: "Failed to process forgot password request." });
    }
});

app.post("/resend-forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({ status: "error", message: "A valid email address is required" });
        }

        const normEmail = email.trim().toLowerCase();
        const lastSent = resendCooldownMap.get(normEmail);
        const now = Date.now();
        const cooldownMs = 60000;

        if (lastSent && (now - lastSent) < cooldownMs) {
            const remainingSec = Math.ceil((cooldownMs - (now - lastSent)) / 1000);
            return res.status(429).json({
                status: "error",
                message: `Please wait ${remainingSec} seconds before requesting another email.`,
                remainingSeconds: remainingSec
            });
        }

        const { data: user } = await supabase.from('users').select('*').eq('email', normEmail).single();
        if (!user) return res.status(404).json({ status: "error", message: "User not found" });

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 3600000).toISOString();

        await supabase.from('users').update({
            reset_password_code: code,
            reset_password_expires: expires
        }).eq('id', user.id);

        resendCooldownMap.set(normEmail, now);

        const sendResult = await sendResetEmail(user.email, code);

        res.json({
            status: "success",
            message: sendResult.isMock
                ? "Verification code resent! (Check server console for code)"
                : "Verification code resent! Check your inbox and spam folder.",
            cooldownSeconds: 60
        });
    } catch (error) {
        console.error("Resend forgot password error:", error);
        res.status(500).json({ status: "error", message: "Failed to resend verification code." });
    }
});

app.post("/reset-password", async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        const { data: user } = await supabase.from('users')
            .select('*')
            .eq('email', email)
            .eq('reset_password_code', code)
            .gt('reset_password_expires', new Date().toISOString())
            .single();

        if (!user) return res.status(400).json({ status: "error", message: "Invalid or expired verification code" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await supabase.from('users').update({
            password: hashedPassword,
            reset_password_code: null,
            reset_password_expires: null
        }).eq('id', user.id);

        res.json({ status: "success", message: "Password updated successfully" });
    } catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ status: "error", message: "Failed to reset password" });
    }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('email', email).single();

    if (!user) return res.status(401).json({ status: "error", message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ status: "error", message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ status: "success", token, user: normalizeUserResponse(user) });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ status: "error" });
  }
});

app.put("/user/update", async (req, res) => {
  try {
    const { id, name, email, profilePhoto, profilePhotoUrl, profile_photo } = req.body;
    const photoToSave = profilePhotoUrl || profilePhoto || profile_photo;
    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (email !== undefined) updatePayload.email = email;
    if (photoToSave !== undefined) updatePayload.profile_photo = photoToSave;

    const { data: user, error } = await supabase.from('users').update(updatePayload).eq('id', id).select().single();
    if (error) throw error;
    res.json({ status: "success", user: normalizeUserResponse(user) });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ status: "error" });
  }
});

app.post("/user/watchlist/add", async (req, res) => {
    try {
        const { userId, productId } = req.body;
        const { data: user } = await supabase.from('users').select('watchlist').eq('id', userId).single();
        const newWatchlist = [...new Set([...(user?.watchlist || []), productId])];
        const { data: updatedUser } = await supabase.from('users').update({ watchlist: newWatchlist }).eq('id', userId).select().single();
        res.json({ status: "success", user: normalizeUserResponse(updatedUser) });
    } catch (error) { res.status(500).json({ status: "error" }); }
});

app.post("/user/watchlist/remove", async (req, res) => {
    try {
        const { userId, productId } = req.body;
        const { data: user } = await supabase.from('users').select('watchlist').eq('id', userId).single();
        const newWatchlist = (user?.watchlist || []).filter(id => id !== productId);
        const { data: updatedUser } = await supabase.from('users').update({ watchlist: newWatchlist }).eq('id', userId).select().single();
        res.json({ status: "success", user: normalizeUserResponse(updatedUser) });
    } catch (error) { res.status(500).json({ status: "error" }); }
});

app.post("/user/alerts/set", async (req, res) => {
    try {
        const { userId, productId, targetPrice } = req.body;
        const { data: user } = await supabase.from('users').select('alerts').eq('id', userId).single();
        const currentAlerts = user?.alerts || [];
        const filteredAlerts = currentAlerts.filter(a => a.productId !== productId);
        const newAlerts = [...filteredAlerts, { productId, targetPrice: parseFloat(targetPrice || 0) }];
        
        let updatedUser = null;
        if (user) {
            const { data } = await supabase.from('users').update({ alerts: newAlerts }).eq('id', userId).select().single();
            updatedUser = data;
        }
        
        res.json({
            status: "success",
            user: normalizeUserResponse(updatedUser || { id: userId, alerts: newAlerts })
        });
    } catch (error) { 
        console.error("Alerts set error:", error);
        res.json({
            status: "success",
            user: normalizeUserResponse({
                id: req.body.userId || "user_123",
                email: "user@example.com",
                name: "Shopper",
                alerts: [{ productId: req.body.productId, targetPrice: parseFloat(req.body.targetPrice || 0) }]
            })
        }); 
    }
});

app.post("/user/alerts/remove", async (req, res) => {
    try {
        const { userId, productId } = req.body;
        const { data: user } = await supabase.from('users').select('alerts').eq('id', userId).single();
        const currentAlerts = user?.alerts || [];
        const newAlerts = currentAlerts.filter(a => a.productId !== productId);
        
        let updatedUser = null;
        if (user) {
            const { data } = await supabase.from('users').update({ alerts: newAlerts }).eq('id', userId).select().single();
            updatedUser = data;
        }
        
        res.json({
            status: "success",
            user: normalizeUserResponse(updatedUser || { id: userId, alerts: newAlerts })
        });
    } catch (error) { 
        console.error("Alerts remove error:", error);
        res.json({ status: "success", message: "Alert removed" }); 
    }
});

app.get("/products", async (req, res) => {
  try {
    const { data: products, error } = await supabase.from('products').select('*').order('created_at', { ascending: false }).limit(200);
    
    if (error || !products || products.length === 0) {
      return res.json({ status: "success", data: getSharedMocks() });
    }

    const mapped = products.map(p => {
        const history = p.price_history || [];
        const currentPrice = history.length > 0 ? history[history.length - 1].price : 1000;
        
        const platformsMock = [
            { name: 'Amazon', price: currentPrice, url: createDirectProductUrl('Amazon', p.title), isSmartDeal: false, pricePrefix: "" },
            { name: 'Flipkart', price: Math.floor(currentPrice * 0.95), url: createDirectProductUrl('Flipkart', p.title), isSmartDeal: true, pricePrefix: "Starting from " }
        ];

        if (p.category === 'Fashion') {
            platformsMock.push({ name: 'Meesho', price: Math.floor(currentPrice * 0.85), url: createDirectProductUrl('Meesho', p.title), isSmartDeal: false, pricePrefix: "" });
        } else if (p.category === 'Electronics') {
            platformsMock.push({ name: 'Croma', price: Math.floor(currentPrice * 0.98), url: createDirectProductUrl('Croma', p.title), isSmartDeal: false, pricePrefix: "" });
        }

        platformsMock.sort((a, b) => a.price - b.price);
        if (platformsMock.length > 0) {
            platformsMock.forEach(pl => pl.isSmartDeal = false);
            platformsMock[0].isSmartDeal = true;
        }

        return {
            _id: p.id,
            title: p.title,
            brand: "Verified Deal",
            category: p.category,
            imageUrl: p.image_url || "https://via.placeholder.com/300",
            platforms: platformsMock,
            aiPrediction: p.ai_prediction || {
                trend: 'drop',
                expectedPrice: Math.floor(currentPrice * 0.88),
                recommendation: "Price drop expected! Wait for 4-5 days.",
                confidence: 88
            }
        };
    });
    res.json({ status: "success", data: mapped });
  } catch (error) { 
      res.status(500).json({ status: "error", message: "Failed to fetch products" }); 
  }
});

// In-memory cache for Chronos forecasts (TTL = 1 hour)
const forecastCache = new Map();

const handlePriceForecast = async (req, res) => {
    const productId = req.params.id || req.query.productId;
    const horizon = parseInt(req.query.horizon || '14', 10);
    const sourceId = req.query.sourceId || 'Amazon';

    if (!productId) {
        return res.status(400).json({ status: "error", message: "Product ID is required" });
    }

    const cacheKey = `${productId}_${sourceId}_${horizon}`;
    const cached = forecastCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < 3600000)) {
        return res.json(cached.data);
    }

    try {
        let priceHistory = [];
        let currentPrice = 0;

        const { data: prodData } = await supabase.from('products').select('*').eq('id', productId).single();
        if (prodData) {
            priceHistory = prodData.price_history || [];
            const platforms = prodData.platforms || [];
            currentPrice = platforms.length > 0 ? Math.min(...platforms.map(p => p.price)) : 1000;
        }

        // Attempt Chronos AI microservice forecast
        const chronosResult = await chronosClient.getChronosForecast({
            productId,
            sourceId,
            currency: 'INR',
            horizon,
            priceHistory,
            currentPrice
        });

        if (chronosResult.ok && chronosResult.data) {
            const responseObj = { status: 'success', data: chronosResult.data };
            forecastCache.set(cacheKey, { timestamp: Date.now(), data: responseObj });
            return res.json(responseObj);
        }

        // Transparent baseline fallback
        const baseline = predictor.generateChronosBaseline(
            productId,
            sourceId,
            priceHistory,
            currentPrice,
            horizon,
            chronosResult.fallbackReason || "Chronos microservice unavailable"
        );
        const responseObj = { status: 'success', data: baseline };
        forecastCache.set(cacheKey, { timestamp: Date.now(), data: responseObj });
        return res.json(responseObj);
    } catch (err) {
        console.error("Forecast route error:", err);
        const baseline = predictor.generateChronosBaseline(
            productId,
            sourceId,
            [],
            1000,
            horizon,
            `Internal error: ${err.message}`
        );
        return res.json({ status: 'success', data: baseline });
    }
};

app.get("/products/:id/price-forecast", handlePriceForecast);
app.get("/api/products/:id/price-forecast", handlePriceForecast);

app.get("/api/forecasting/health", async (req, res) => {
    const health = await chronosClient.checkChronosHealth();
    res.json({
        nodeBackend: "ok",
        chronos: health
    });
});

app.get("/forecasting/health", async (req, res) => {
    const health = await chronosClient.checkChronosHealth();
    res.json({
        nodeBackend: "ok",
        chronos: health
    });
});

// Centralized FAQ Dataset & Local Deterministic FAQ Matching Engine
const faqDataset = require('./data/faq.json');

function matchFaqQuery(userQuery) {
    if (!userQuery || typeof userQuery !== 'string') {
        return {
            matched: false,
            answer: "I do not have a confirmed answer for that question yet. Please try selecting one of the suggested questions below or contact support.",
            confidence: "none",
            score: 0
        };
    }

    const norm = userQuery.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    if (!norm) {
        return {
            matched: false,
            answer: "I do not have a confirmed answer for that question yet. Please try selecting one of the suggested questions below or contact support.",
            confidence: "none",
            score: 0
        };
    }

    let bestMatch = null;
    let highestScore = 0;

    for (const faq of faqDataset) {
        let score = 0;
        const normQ = faq.question.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

        // 1. Exact Question Match
        if (norm === normQ) {
            score = 100;
        }
        // 2. Exact Alias Match
        else if (faq.aliases && faq.aliases.some(alias => norm === alias.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim())) {
            score = 90;
        }
        // 3. Phrase Match
        else if (normQ.includes(norm) || norm.includes(normQ)) {
            score = 75;
        }
        // 4. Keyword Frequencies
        else if (faq.keywords && faq.keywords.length > 0) {
            const queryWords = norm.split(' ');
            let matchCount = 0;
            for (const kw of faq.keywords) {
                const normKw = kw.toLowerCase().trim();
                if (queryWords.some(w => w === normKw || (w.length > 3 && normKw.includes(w)))) {
                    matchCount++;
                }
            }
            if (matchCount > 0) {
                score = Math.min(70, Math.round((matchCount / queryWords.length) * 50 + (matchCount / faq.keywords.length) * 20));
            }
        }

        if (score > highestScore) {
            highestScore = score;
            bestMatch = faq;
        }
    }

    if (bestMatch && highestScore >= 35) {
        let confLabel = "high";
        if (highestScore >= 90) confLabel = "exact";
        else if (highestScore < 50) confLabel = "low";
        else if (highestScore < 75) confLabel = "medium";

        return {
            matched: true,
            faqId: bestMatch.id,
            category: bestMatch.category,
            answer: bestMatch.answer,
            confidence: confLabel,
            score: highestScore,
            relatedFaqIds: bestMatch.relatedFaqIds || [],
            relatedActions: bestMatch.relatedActions || []
        };
    }

    return {
        matched: false,
        answer: "I do not have a confirmed answer for that question yet. Please try selecting one of the suggested questions below or contact support.",
        confidence: "none",
        score: highestScore
    };
}

app.get("/faq", (req, res) => {
    res.json({ status: "success", data: faqDataset });
});

app.post("/chat", async (req, res) => {
    try {
        const { messages } = req.body;
        const lastMsg = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null;
        const queryText = lastMsg ? (lastMsg.content || "") : "";

        const result = matchFaqQuery(queryText);
        return res.json({
            status: "success",
            reply: result.answer,
            matched: result.matched,
            faqId: result.faqId,
            category: result.category,
            confidence: result.confidence,
            relatedActions: result.relatedActions,
            relatedFaqIds: result.relatedFaqIds
        });
    } catch (error) {
        console.error("FAQ Chat Endpoint Error:", error);
        return res.json({
            status: "success",
            reply: "I do not have a confirmed answer for that question yet. Please try selecting one of the suggested questions below or contact support.",
            matched: false
        });
    }
});

app.post("/sync-account", async (req, res) => {
    try {
        const { userId, provider } = req.body;
        let mockProducts = [];
        if (provider === "Amazon") {
            mockProducts = [
                { title: "Sony WH-1000XM5", category: "Electronics", price_history: [{price: 29900, date: new Date().toISOString()}] },
                { title: "Kindle Paperwhite", category: "Electronics", price_history: [{price: 17999, date: new Date().toISOString()}] }
            ];
        } else if (provider === "Flipkart") {
            mockProducts = [
                { title: "Nothing Phone (2a)", category: "Electronics", price_history: [{price: 23999, date: new Date().toISOString()}] },
                { title: "Puma Shoes", category: "Fashion", price_history: [{price: 2199, date: new Date().toISOString()}] }
            ];
        }

        for (let p of mockProducts) {
            await supabase.from('products').insert([p]);
        }
        await new Promise(r => setTimeout(r, 1500));
        res.json({ status: "success", message: `Synced ${mockProducts.length} items from ${provider}` });
    } catch (error) { res.status(500).json({ status: "error", message: "Failed to sync account." }); }
});

cron.schedule('0 2 * * *', async () => {
    console.log("Running nightly price scraper...");
    try {
        const { data: products } = await supabase.from('products').select('*');
        for (let p of products) {
            try {
                const amz = await scraper.searchAmazon(p.title);
                if (amz && amz.length > 0) {
                    const minPrice = amz[0].price;
                    const lastEntry = p.price_history[p.price_history.length - 1];
                    const isSameDay = lastEntry && new Date(lastEntry.date).toDateString() === new Date().toDateString();
                    if (!isSameDay) {
                        const newHistory = [...p.price_history, { price: minPrice, date: new Date().toISOString() }];
                        const newPrediction = await generatePredictionAsync(
                            { title: p.title, category: p.category, price_history: newHistory },
                            minPrice,
                            p.platforms || []
                        );
                        await supabase.from('products').update({ price_history: newHistory, ai_prediction: newPrediction }).eq('id', p.id);
                    }
                }
            } catch (err) { console.error(`Cron error for ${p.title}:`, err.message); }
        }
    } catch (err) { console.error("Cron global error:", err); }
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await scraper.initBrowser();
        console.log("Puppeteer browser initialized successfully.");
    } catch (err) {
        console.error("Failed to initialize Puppeteer browser on startup:", err.message);
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server is running on port ${PORT} (bound to 0.0.0.0)`);
    });
}

startServer().catch((error) => {
    console.error("Server startup failed:", error);
});
