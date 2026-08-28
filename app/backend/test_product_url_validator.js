/**
 * Unit Tests for PriceWise Product URL Validator & Canonical Normalizer
 */

const assert = require('assert');
const {
    decodeHtmlEntities,
    toAbsoluteUrl,
    normalizeProductUrl,
    detectSoft404,
    validateProductUrl
} = require('./services/productUrlValidator');
const matcher = require('./services/matcher');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failedTests++;
    }
}

async function asyncTest(name, fn) {
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failedTests++;
    }
}

console.log('\n--- 1. HTML Entity Decoding Tests ---');

test('Decodes &amp; to & in URLs', () => {
    const input = 'https://www.amazon.in/dp/B0863TXGM3?tag=foo&amp;ref=bar';
    const output = decodeHtmlEntities(input);
    assert.strictEqual(output, 'https://www.amazon.in/dp/B0863TXGM3?tag=foo&ref=bar');
});

test('Decodes numeric and quote entities', () => {
    const input = 'https://www.flipkart.com/item&#47;p&#47;itm123?q=&quot;phone&quot;';
    const output = decodeHtmlEntities(input);
    assert.strictEqual(output, 'https://www.flipkart.com/item/p/itm123?q="phone"');
});

console.log('\n--- 2. Relative to Absolute URL Conversion Tests ---');

test('Converts leading slash relative URL to absolute Amazon URL', () => {
    const res = toAbsoluteUrl('/dp/B0863TXGM3', 'https://www.amazon.in');
    assert.strictEqual(res, 'https://www.amazon.in/dp/B0863TXGM3');
});

test('Converts non-leading slash relative URL to absolute Flipkart URL', () => {
    const res = toAbsoluteUrl('product-name/p/itm12345', 'https://www.flipkart.com');
    assert.strictEqual(res, 'https://www.flipkart.com/product-name/p/itm12345');
});

test('Rejects javascript: and data: pseudo-protocols', () => {
    assert.strictEqual(toAbsoluteUrl('javascript:alert(1)', 'https://www.amazon.in'), null);
    assert.strictEqual(toAbsoluteUrl('data:text/html,test', 'https://www.amazon.in'), null);
    assert.strictEqual(toAbsoluteUrl('#reviews', 'https://www.amazon.in'), null);
});

test('Fixes duplicate domain concatenation', () => {
    const dup = 'https://www.amazon.inhttps://www.amazon.in/dp/B0863TXGM3';
    const res = toAbsoluteUrl(dup, 'https://www.amazon.in');
    assert.strictEqual(res, 'https://www.amazon.in/dp/B0863TXGM3');
});

console.log('\n--- 3. Canonical URL Normalization & Source Allowlist Tests ---');

test('Amazon: Extracts canonical /dp/{ASIN} URL from path', () => {
    const norm = normalizeProductUrl('https://www.amazon.in/Sony-WH-1000XM5-Wireless-Headphones/dp/B09XS7JWHH?ref=sr_1_1&tag=affiliate', 'Amazon');
    assert.strictEqual(norm.isValid, true);
    assert.strictEqual(norm.status, 'valid');
    assert.strictEqual(norm.productId, 'B09XS7JWHH');
    assert.strictEqual(norm.canonicalUrl, 'https://www.amazon.in/dp/B09XS7JWHH');
});

test('Amazon: Extracts canonical ASIN from sponsored redirect URL', () => {
    const sponsored = 'https://www.amazon.in/sspa/click?ie=UTF8&url=%2FSony-Headphones%2Fdp%2FB09XS7JWHH%2Fref%3Dsr_1_1';
    const norm = normalizeProductUrl(sponsored, 'Amazon');
    assert.strictEqual(norm.isValid, true);
    assert.strictEqual(norm.productId, 'B09XS7JWHH');
    assert.strictEqual(norm.canonicalUrl, 'https://www.amazon.in/dp/B09XS7JWHH');
});

test('Amazon: Rejects search results page as product URL', () => {
    const norm = normalizeProductUrl('https://www.amazon.in/s?k=iphone+15', 'Amazon');
    assert.strictEqual(norm.isValid, false);
    assert.strictEqual(norm.status, 'invalid_url');
});

test('Flipkart: Preserves clean /p/itm... product path', () => {
    const norm = normalizeProductUrl('https://www.flipkart.com/apple-iphone-15-blue-128-gb/p/itmbf14ef54f645e?pid=MOBGTAGPYYWZTKGF&lid=LST123&marketplace=FLIPKART', 'Flipkart');
    assert.strictEqual(norm.isValid, true);
    assert.strictEqual(norm.status, 'valid');
    assert.strictEqual(norm.productId, 'itmbf14ef54f645e');
    assert.strictEqual(norm.canonicalUrl, 'https://www.flipkart.com/apple-iphone-15-blue-128-gb/p/itmbf14ef54f645e?pid=MOBGTAGPYYWZTKGF');
});

test('Flipkart: Rejects search page as product URL', () => {
    const norm = normalizeProductUrl('https://www.flipkart.com/search?q=iphone', 'Flipkart');
    assert.strictEqual(norm.isValid, false);
    assert.strictEqual(norm.status, 'invalid_url');
});

test('Cross-source rejection: Amazon listing cannot have Flipkart host', () => {
    const norm = normalizeProductUrl('https://www.flipkart.com/item/p/itm123', 'Amazon');
    assert.strictEqual(norm.isValid, false);
    assert.strictEqual(norm.status, 'wrong_source');
});

test('Localhost / internal IP is rejected', () => {
    const norm = normalizeProductUrl('http://localhost:5000/product/123', 'Amazon');
    assert.strictEqual(norm.isValid, false);
    assert.strictEqual(norm.status, 'invalid_url');
});

test('Null or empty URL is rejected', () => {
    const norm = normalizeProductUrl('', 'Amazon');
    assert.strictEqual(norm.isValid, false);
    assert.strictEqual(norm.status, 'invalid_url');
});

console.log('\n--- 4. Soft-404 Detection Tests ---');

test('Detects HTTP 404 and 410 as dead links', () => {
    const res404 = detectSoft404('', 404);
    assert.strictEqual(res404.isSoft404, true);
    const res410 = detectSoft404('', 410);
    assert.strictEqual(res410.isSoft404, true);
});

test('Detects "Page Not Found" text in HTML body with 200 OK', () => {
    const html = '<html><body><h1>404 - Page Not Found</h1><p>Sorry, we couldn\'t find that page.</p></body></html>';
    const res = detectSoft404(html, 200);
    assert.strictEqual(res.isSoft404, true);
});

test('Detects Amazon dog page error message', () => {
    const amazonDog = '<div>Looking for something? We\'re sorry. The Web address you entered is not a functioning page on our site.</div>';
    const res = detectSoft404(amazonDog, 200);
    assert.strictEqual(res.isSoft404, true);
});

test('Passes valid product page HTML', () => {
    const validHtml = '<html><head><title>Apple iPhone 15</title></head><body><h1>Apple iPhone 15 128GB</h1><span>₹69,990</span></body></html>';
    const res = detectSoft404(validHtml, 200);
    assert.strictEqual(res.isSoft404, false);
});

console.log('\n--- 5. Candidate Selection Fallback on Dead/Invalid URLs ---');

test('selectBestPlatformResult falls back to next best candidate if top match has dead/invalid URL', () => {
    const queryProd = matcher.normalizeProduct({
        platform: 'Amazon',
        title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones - Black',
        price: 28990,
        url: 'https://www.amazon.in/dp/B09XS7JWHH'
    });

    const candidates = [
        // Candidate 1: Exact match title, but INVALID / DEAD URL (e.g. search page or wrong host)
        matcher.normalizeProduct({
            platform: 'Flipkart',
            title: 'Sony WH-1000XM5 Bluetooth Headset (Black)',
            price: 26990,
            url: 'https://www.amazon.in/s?k=sony+wh1000xm5' // Wrong source / search page!
        }, 'Flipkart'),

        // Candidate 2: Exact match title with VALID Flipkart product page URL
        matcher.normalizeProduct({
            platform: 'Flipkart',
            title: 'Sony WH-1000XM5 Bluetooth Headset (Black)',
            price: 27490,
            url: 'https://www.flipkart.com/sony-wh-1000xm5-bluetooth-headset/p/itm53cf7e4aa040d'
        }, 'Flipkart')
    ];

    const result = matcher.selectBestPlatformResult(queryProd, candidates, 'Flipkart');

    // Candidate 1 must have been rejected because of invalid URL, candidate 2 must be chosen!
    assert.strictEqual(result.status, 'exact_match');
    assert.strictEqual(result.product.price, 27490);
    assert.strictEqual(result.product.url, 'https://www.flipkart.com/sony-wh-1000xm5-bluetooth-headset/p/itm53cf7e4aa040d');
    assert.strictEqual(result.urlValidation.isValid, true);
});

test('selectBestPlatformResult returns no_match with all_candidates_invalid when all candidates have broken URLs', () => {
    const queryProd = matcher.normalizeProduct({
        platform: 'Amazon',
        title: 'Apple iPhone 15 128GB Black',
        price: 69990,
        url: 'https://www.amazon.in/dp/B0CHX1W1XZ'
    });

    const brokenCandidates = [
        matcher.normalizeProduct({
            platform: 'Flipkart',
            title: 'Apple iPhone 15 (Black, 128 GB)',
            price: 65990,
            url: 'javascript:void(0)' // Invalid URL
        }, 'Flipkart'),
        matcher.normalizeProduct({
            platform: 'Flipkart',
            title: 'Apple iPhone 15 (Black, 128 GB)',
            price: 66990,
            url: 'http://localhost/item' // Invalid internal URL
        }, 'Flipkart')
    ];

    const result = matcher.selectBestPlatformResult(queryProd, brokenCandidates, 'Flipkart');

    assert.strictEqual(result.status, 'no_match');
    assert.strictEqual(result.product, null);
    assert.strictEqual(result.urlValidation.status, 'all_candidates_invalid');
});

console.log('\n=========================================');
console.log(`Summary: ${passedTests} passed, ${failedTests} failed.`);
console.log('=========================================\n');

if (failedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
