/**
 * PriceWise Product Matching — Deterministic Test Suite
 *
 * Run: node test_product_matching.js
 *
 * Uses only the built-in `matcher.js` service — no external test runner needed.
 * All inputs are fixed fixture data so tests are fully deterministic.
 */

'use strict';

const matcher = require('./services/matcher');
const { matchProducts, normalizeProduct, classifyCategory } = matcher;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
    if (actual === expected) {
        console.log(`  ✓  ${description}`);
        passed++;
    } else {
        console.error(`  ✗  ${description}`);
        console.error(`     Expected: ${JSON.stringify(expected)}`);
        console.error(`     Actual:   ${JSON.stringify(actual)}`);
        failed++;
    }
}

function assertNot(description, actual, excluded) {
    if (actual !== excluded) {
        console.log(`  ✓  ${description}`);
        passed++;
    } else {
        console.error(`  ✗  ${description}  (should NOT be ${JSON.stringify(excluded)})`);
        failed++;
    }
}

function section(title) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('─'.repeat(60));
}

/**
 * Quick helper: create a minimal raw scrape item and normalise it.
 */
function mkItem(platform, title, price = 1000, url = '') {
    return normalizeProduct({ platform, title, price, url: url || `https://example.com/${Math.random()}`, imageUrl: '' });
}

function match(a, b) {
    return matchProducts(a, b);
}

// ===========================================================================
// SECTION 1 — normalizeProduct() utility functions
// ===========================================================================
section('1. Extraction utilities');

const storage256 = mkItem('Amazon', 'Samsung Galaxy S24 256GB 8GB RAM 5G Phantom Black');
assert('Extract storage 256 GB', storage256.variant.storageGb, 256);
assert('Extract RAM 8 GB', storage256.variant.ramGb, 8);
assert('Extract connectivity 5G', storage256.variant.connectivity, '5g');
assert('Extract brand Samsung', storage256.brand, 'samsung');
assert('Extract color black', storage256.variant.color, 'black');

const ltr1 = mkItem('Flipkart', 'Dove Intense Repair Shampoo 1 Litre');
assert('Extract capacity 1000 ml from litre', ltr1.variant.capacityMl, 1000);
assert('Extract brand Dove', ltr1.brand, 'dove');
assert('Extract product form shampoo', ltr1.variant.productForm, 'shampoo');

const kg2 = mkItem('Amazon', 'Surf Excel Matic Liquid Detergent 2 KG');
assert('Extract weight 2000 g from 2 KG', kg2.variant.weightG, 2000);
assert('Extract brand Surf Excel', kg2.brand, 'surf excel');

const pack2 = mkItem('Flipkart', 'Dove Soap Bar Pack of 2 x 100g');
assert('Extract pack count 2', pack2.variant.packCount, 2);

const xm5 = mkItem('Amazon', 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black');
assert('Extract model number WH-1000XM5', xm5.modelNumber, 'WH1000XM5');
assert('Extract brand Sony', xm5.brand, 'sony');

// ===========================================================================
// SECTION 2 — Category classification
// ===========================================================================
section('2. Category classification');

assert('iPhone is electronics_phone', classifyCategory(mkItem('Amazon', 'Apple iPhone 15 128GB Blue')), 'electronics_phone');
assert('Galaxy is electronics_phone', classifyCategory(mkItem('Amazon', 'Samsung Galaxy S24 256GB')), 'electronics_phone');
assert('Sony WH headphones', classifyCategory(xm5), 'electronics_headphones');
assert('Dell XPS is electronics_laptop', classifyCategory(mkItem('Amazon', 'Dell XPS 13 Intel Core i7 Laptop')), 'electronics_laptop');
assert('Dove Shampoo is grocery_beauty', classifyCategory(mkItem('Amazon', 'Dove Shampoo 650ml')), 'grocery_beauty');
assert('Surf Excel is grocery_beauty', classifyCategory(mkItem('Amazon', 'Surf Excel 2 KG')), 'grocery_beauty');
assert('Nike Shoes is fashion', classifyCategory(mkItem('Amazon', 'Nike Air Max Running Shoes Size 9')), 'fashion');

// ===========================================================================
// SECTION 3 — Exact match cases (should return exact_match)
// ===========================================================================
section('3. Exact matches — expected: exact_match');

// 3a. Same phone, same storage, same RAM
const s24_amz = mkItem('Amazon',   'Samsung Galaxy S24 256GB 8GB RAM 5G Phantom Black', 79999);
const s24_fk  = mkItem('Flipkart', 'Samsung Galaxy S24 (8GB RAM, 256GB, 5G) Phantom Black', 78999);
const r3a = match(s24_amz, s24_fk);
assert('3a. Galaxy S24 256GB same storage/RAM → exact_match', r3a.matchStatus, 'exact_match');

// 3b. Same headphones model
const xm5_amz = mkItem('Amazon',   'Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black', 28990);
const xm5_fk  = mkItem('Flipkart', 'Sony WH-1000XM5 Industry Leading Noise Canceling Headphones', 26990);
const r3b = match(xm5_amz, xm5_fk);
assert('3b. Sony WH-1000XM5 → exact_match', r3b.matchStatus, 'exact_match');

// 3c. Same grocery product, same quantity, same pack
const dove650_amz = mkItem('Amazon',   'Dove Intense Repair Shampoo 650ml', 349);
const dove650_fk  = mkItem('Flipkart', 'Dove Intense Repair Shampoo 650 ml', 329);
const r3c = match(dove650_amz, dove650_fk);
assert('3c. Dove Shampoo 650ml same quantity → exact_match', r3c.matchStatus, 'exact_match');

// ===========================================================================
// ===========================================================================
// SECTION 4 — False positive prevention (must NOT be exact_match)
// ===========================================================================
section('4. False-positive prevention — must NOT be exact_match');

// 4a. Same phone, different storage → variant_match
const s24_128 = mkItem('Amazon',   'Samsung Galaxy S24 128GB 8GB RAM 5G', 69999);
const s24_256 = mkItem('Flipkart', 'Samsung Galaxy S24 256GB 8GB RAM 5G', 79999);
const r4a = match(s24_128, s24_256);
assert('4a. Galaxy S24 128 vs 256 GB → variant_match', r4a.matchStatus, 'variant_match');
assert('4a. comparisonEligible is false', r4a.comparisonEligible, false);
assert('4a. Differences mention storage', r4a.differences.some(r => r.toLowerCase().includes('storage')), true);

// 4b. Same phone family, different edition (S24 vs S24 Ultra)
const s24_base  = mkItem('Amazon',   'Samsung Galaxy S24 256GB 5G Phantom Black', 79999);
const s24_ultra = mkItem('Flipkart', 'Samsung Galaxy S24 Ultra 256GB 5G Titanium Gray', 134999);
const r4b = match(s24_base, s24_ultra);
assert('4b. Galaxy S24 vs S24 Ultra → variant_match', r4b.matchStatus, 'variant_match');
assertNot('4b. Galaxy S24 vs S24 Ultra → NOT exact_match', r4b.matchStatus, 'exact_match');

// 4c. iPhone 15 vs iPhone 15 Pro
const ip15      = mkItem('Amazon',   'Apple iPhone 15 128GB Blue', 69999);
const ip15_pro  = mkItem('Flipkart', 'Apple iPhone 15 Pro 128GB Black Titanium', 124999);
const r4c = match(ip15, ip15_pro);
assert('4c. iPhone 15 vs iPhone 15 Pro → variant_match', r4c.matchStatus, 'variant_match');
assertNot('4c. iPhone 15 vs iPhone 15 Pro → NOT exact_match', r4c.matchStatus, 'exact_match');

// 4d. Sony WH-1000XM5 vs WH-1000XM4 (different generation model number)
const xm5_ref = mkItem('Amazon',   'Sony WH-1000XM5 Wireless Headphones', 28990);
const xm4_ref = mkItem('Flipkart', 'Sony WH-1000XM4 Wireless Headphones', 19990);
const r4d = match(xm5_ref, xm4_ref);
assert('4d. WH-1000XM5 vs WH-1000XM4 → no_match', r4d.matchStatus, 'no_match');
assert('4d. Rejection mentions model number', r4d.rejectedAttributes.some(r => r.toLowerCase().includes('model number')), true);

// 4e. Dove Shampoo vs Dove Conditioner (different form in same group)
const dove_shampoo = mkItem('Amazon',   'Dove Intense Repair Shampoo 650ml', 349);
const dove_cond    = mkItem('Flipkart', 'Dove Intense Repair Conditioner 650ml', 349);
const r4e = match(dove_shampoo, dove_cond);
assert('4e. Dove Shampoo vs Conditioner → no_match', r4e.matchStatus, 'no_match');
assert('4e. Rejection mentions form mismatch', r4e.rejectedAttributes.some(r => r.toLowerCase().includes('form')), true);

// 4f. Surf Excel 1 kg vs 2 kg — different quantity → unit_price_only
const surf1 = mkItem('Amazon',   'Surf Excel Matic Liquid Detergent 1 KG', 225);
const surf2 = mkItem('Flipkart', 'Surf Excel Matic Liquid Detergent 2 KG', 430);
const r4f = match(surf1, surf2);
assert('4f. Surf Excel 1 KG vs 2 KG → unit_price_only', r4f.matchStatus, 'unit_price_only');
assert('4f. unitPriceB calculated', typeof r4f.unitPriceB === 'number', true);

// 4g. Single item vs pack of 2 — different pack count → unit_price_only
const soap1  = mkItem('Amazon',   'Dove Bar Soap 100g', 45);
const soap2  = mkItem('Flipkart', 'Dove Bar Soap Pack of 2 x 100g', 85);
const r4g = match(soap1, soap2);
assert('4g. Single item vs Pack of 2 → unit_price_only', r4g.matchStatus, 'unit_price_only');

// 4h. Nike Air Max size 9 vs size 8 → variant_match
const nike9 = mkItem('Amazon',   'Nike Air Max Running Shoes Size 9', 8999);
const nike8 = mkItem('Flipkart', 'Nike Air Max Running Shoes Size 8', 8999);
const r4h = match(nike9, nike8);
assert('4h. Nike Air Max size 9 vs size 8 → variant_match', r4h.matchStatus, 'variant_match');

// 4i. Different brands, similar model name → no_match
const samsung_s24 = mkItem('Amazon',   'Samsung Galaxy S24 256GB', 79999);
const xiaomi_s24  = mkItem('Flipkart', 'Xiaomi 14 Ultra 256GB', 99999);
const r4i = match(samsung_s24, xiaomi_s24);
assert('4i. Samsung vs Xiaomi → no_match (brand mismatch)', r4i.matchStatus, 'no_match');
assert('4i. Rejection mentions brand', r4i.rejectedAttributes.some(r => r.toLowerCase().includes('brand')), true);

// 4j. Different RAM (8GB vs 12GB same phone) → variant_match
const s24_8gb  = mkItem('Amazon',   'Samsung Galaxy S24 256GB 8GB RAM 5G', 79999);
const s24_12gb = mkItem('Flipkart', 'Samsung Galaxy S24 256GB 12GB RAM 5G', 84999);
const r4j = match(s24_8gb, s24_12gb);
assert('4j. Galaxy S24 8GB vs 12GB RAM → variant_match', r4j.matchStatus, 'variant_match');

// ===========================================================================
// SECTION 5 — Variant match cases
// ===========================================================================
section('5. Variant matches — expected: variant_match');

// 5a. Same phone, same storage/RAM, different color
const s24_black  = mkItem('Amazon',   'Samsung Galaxy S24 256GB 8GB RAM 5G Phantom Black', 79999);
const s24_violet = mkItem('Flipkart', 'Samsung Galaxy S24 256GB 8GB RAM 5G Cobalt Violet', 79999);
const r5a = match(s24_black, s24_violet);
assert('5a. Galaxy S24 same specs, color differs → variant_match', r5a.matchStatus, 'variant_match');
assert('5a. color in differingAttributes', r5a.differingAttributes.includes('color'), true);
assert('5a. comparisonEligible is false', r5a.comparisonEligible, false);

// ===========================================================================
// SECTION 6 — Unit-price-only cases
// ===========================================================================
section('6. Unit price comparison — expected: unit_price_only');

// 6a. Surf Excel 1L vs 2L same product line
const surf_1l = mkItem('Amazon',   'Surf Excel Matic Liquid Detergent 1 Litre', 210);
const surf_2l = mkItem('Flipkart', 'Surf Excel Matic Liquid Detergent 2 Litre', 400);
const r6a = match(surf_1l, surf_2l);
assert('6a. Surf Excel 1L vs 2L → unit_price_only', r6a.matchStatus, 'unit_price_only');
assert('6a. unitLabel is ₹/litre', r6a.unitLabel, '₹/litre');
assert('6a. unitPriceA is set', typeof r6a.unitPriceA === 'number', true);
assert('6a. unitPriceB is set', typeof r6a.unitPriceB === 'number', true);
assert('6a. pricePerUnit is set', r6a.pricePerUnit && r6a.pricePerUnit.unit === 'litre', true);
assert('6a. comparisonEligible is false', r6a.comparisonEligible, false);

// 6b. Dove Shampoo 650ml vs 340ml
const dove_650 = mkItem('Amazon', 'Dove Intense Repair Shampoo 650ml', 349);
const dove_340 = mkItem('Flipkart', 'Dove Intense Repair Shampoo 340ml', 199);
const r6b = match(dove_650, dove_340);
assert('6b. Dove 650ml vs 340ml → unit_price_only', r6b.matchStatus, 'unit_price_only');
assert('6b. pricePerUnit unit is litre', r6b.pricePerUnit?.unit, 'litre');

// ===========================================================================
// SECTION 7 — Hard rejections produce no_match with reasons
// ===========================================================================
section('7. Hard rejections produce correct reasons');

// 7a. Model number hard reject
const xm5_check = mkItem('Amazon',   'Sony WH-1000XM5 Headphones', 28990);
const xm4_check = mkItem('Flipkart', 'Sony WH-1000XM4 Headphones', 19990);
const r7a = match(xm5_check, xm4_check);
assert('7a. Model number rejection produces reason', r7a.reasons.some(r => r.toLowerCase().includes('model')), true);

// 7b. Form mismatch rejection
const shamp = mkItem('Amazon',   'Dove Shampoo 200ml', 120);
const cond  = mkItem('Flipkart', 'Dove Conditioner 200ml', 130);
const r7c = match(shamp, cond);
assert('7c. Form mismatch rejection produces reason', r7c.reasons.some(r => r.toLowerCase().includes('form')), true);
assert('7c. Form names in reason', r7c.reasons.some(r => r.includes('shampoo') || r.includes('conditioner')), true);

// ===========================================================================
// SECTION 8 — normalizeProduct produces clean schema
// ===========================================================================
section('8. normalizeProduct schema validation');

const testItem = normalizeProduct({
    platform: 'Amazon',
    title: 'Samsung Galaxy S24 (Phantom Black, 8GB RAM, 256 GB Storage) 5G',
    price: 79999,
    url: 'https://www.amazon.in/dp/B0CS5X6JCD',
    imageUrl: 'https://img.example.com/s24.jpg'
});

assert('8a. source set to amazon', testItem.source, 'amazon');
assert('8b. brand extracted', testItem.brand, 'samsung');
assert('8c. storageGb = 256', testItem.variant.storageGb, 256);
assert('8d. ramGb = 8', testItem.variant.ramGb, 8);
assert('8e. connectivity = 5g', testItem.variant.connectivity, '5g');
assert('8f. color = black', testItem.variant.color, 'black');
assert('8g. sourceProductId from ASIN', testItem.sourceProductId, 'B0CS5X6JCD');
assert('8h. normalizedTitle is lowercase', testItem.normalizedTitle === testItem.normalizedTitle.toLowerCase(), true);
assert('8i. price preserved', testItem.price, 79999);
assert('8j. _diagnostics present', typeof testItem._diagnostics, 'object');

// ===========================================================================
// SECTION 9 — findSimilarProducts tests
// ===========================================================================
section('9. findSimilarProducts — variant tiers & differences');

const refS24_256 = mkItem('Amazon', 'Samsung Galaxy S24 5G 8GB RAM 256GB', 69999);
const candS24_128 = mkItem('Flipkart', 'Samsung Galaxy S24 5G 8GB RAM 128GB', 62999);
const candS24_Ultra = mkItem('Amazon', 'Samsung Galaxy S24 Ultra 12GB RAM 256GB', 109999);
const candUnrelated = mkItem('Meesho', 'Men Casual Cotton Shirt Blue', 699);

const similarResults = matcher.findSimilarProducts(refS24_256, [candS24_128, candS24_Ultra, candUnrelated]);

assert('9a. Similar products returned', similarResults.length >= 2, true);

const s24_128_sim = similarResults.find(s => s.title.includes('128GB'));
assert('9b. S24 128GB is close_variant', s24_128_sim?.similarityTier, 'close_variant');
assert('9c. S24 128GB mentions storage difference', s24_128_sim?.differences.some(d => d.includes('Storage differs')), true);
assert('9d. S24 128GB comparisonEligible is false', s24_128_sim?.comparisonEligible, false);

const s24_ultra_sim = similarResults.find(s => s.title.includes('Ultra'));
assert('9e. S24 Ultra is comparable_alternative or close_variant', ['comparable_alternative', 'close_variant'].includes(s24_ultra_sim?.similarityTier), true);
assert('9f. S24 Ultra comparisonEligible is false', s24_ultra_sim?.comparisonEligible, false);

const unrelated_sim = similarResults.find(s => s.title.includes('Cotton Shirt'));
assert('9g. Unrelated item excluded from similar', unrelated_sim === undefined, true);

// ===========================================================================
// SECTION 10 — selectBestPlatformResult priority tests
// ===========================================================================
section('10. selectBestPlatformResult — candidate priority');

const refPhone = mkItem('Amazon', 'Samsung Galaxy S24 256GB 8GB RAM 5G', 79999);
const fkExact = mkItem('Flipkart', 'Samsung Galaxy S24 (8GB RAM, 256GB, 5G)', 77999);
const fkVariant = mkItem('Flipkart', 'Samsung Galaxy S24 (8GB RAM, 128GB, 5G)', 69999);

// 10a. Platform has both exact and variant → selects exact
const sel1 = matcher.selectBestPlatformResult(refPhone, [fkVariant, fkExact], 'Flipkart');
assert('10a. Prioritizes exact_match over variant', sel1.status, 'exact_match');
assert('10a. Exact price picked', sel1.product?.price, 77999);
assert('10a. comparisonEligible is true', sel1.comparisonEligible, true);

// 10b. Platform has only variant → selects variant_match
const sel2 = matcher.selectBestPlatformResult(refPhone, [fkVariant], 'Flipkart');
assert('10b. Selects variant_match when no exact match', sel2.status, 'variant_match');
assert('10b. Differences populated', sel2.differences.some(d => d.includes('Storage differs')), true);
assert('10b. comparisonEligible is false', sel2.comparisonEligible, false);

// 10c. Platform has only quantity match → selects unit_price_only
const refDetergent = mkItem('Amazon', 'Surf Excel Matic Liquid Detergent 2 KG', 430);
const fkDetergent1kg = mkItem('Flipkart', 'Surf Excel Matic Liquid Detergent 1 KG', 225);
const sel3 = matcher.selectBestPlatformResult(refDetergent, [fkDetergent1kg], 'Flipkart');
assert('10c. Selects unit_price_only for quantity difference', sel3.status, 'unit_price_only');
assert('10c. pricePerUnit is populated', sel3.pricePerUnit?.unit, 'kg');
assert('10c. comparisonEligible is false', sel3.comparisonEligible, false);

// 10d. Platform has no matching candidates → returns no_match
const sel4 = matcher.selectBestPlatformResult(refPhone, [candUnrelated], 'Flipkart');
assert('10d. Returns no_match when candidate unrelated', sel4.status, 'no_match');
assert('10d. Product is null for no_match', sel4.product, null);
assert('10d. Reason contains store name', sel4.reason.includes('Flipkart'), true);

// ===========================================================================
// RESULTS
// ===========================================================================
console.log(`\n${'═'.repeat(60)}`);
console.log(`  Test Results: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) {
    console.error('\n  ❌  Some tests FAILED. The matching rules need review.\n');
    process.exit(1);
} else {
    console.log('\n  ✅  All tests PASSED.\n');
    process.exit(0);
}

