const { cleanProductTitle, buildSearchQuery } = require('./productNormalizer');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

function runTests() {
    console.log('Running productNormalizer tests...');

    // Test 1: Remove "Add to Compare"
    const t1 = cleanProductTitle('Add to Compare iPhone 15 128GB');
    console.log('Test 1:', t1);
    assert(t1 === 'iPhone 15 128GB', `Expected "iPhone 15 128GB", got "${t1}"`);

    // Test 2: Remove "Buy Now" and leading pipe
    const t2 = cleanProductTitle('Buy Now | Dove Shampoo 650 ml');
    console.log('Test 2:', t2);
    assert(t2 === 'Dove Shampoo 650 ml', `Expected "Dove Shampoo 650 ml", got "${t2}"`);

    // Test 3: Remove "Sponsored"
    const t3 = cleanProductTitle('Sponsored Samsung Galaxy S24 Ultra 12GB 256GB');
    console.log('Test 3:', t3);
    assert(t3 === 'Samsung Galaxy S24 Ultra 12GB 256GB', `Expected "Samsung Galaxy S24 Ultra 12GB 256GB", got "${t3}"`);

    // Test 4: Remove "Add to Cart" and keep units/pack counts
    const t4 = cleanProductTitle('Add to Cart Surf Excel 2 kg Pack of 2');
    console.log('Test 4:', t4);
    assert(t4 === 'Surf Excel 2 kg Pack of 2', `Expected "Surf Excel 2 kg Pack of 2", got "${t4}"`);

    // Test 5: Clean titles remain unchanged
    const t5 = cleanProductTitle('Samsung Galaxy S24 5G (Amber Yellow, 8GB RAM, 256GB Storage)');
    console.log('Test 5:', t5);
    assert(t5 === 'Samsung Galaxy S24 5G (Amber Yellow, 8GB RAM, 256GB Storage)', `Expected exact clean title, got "${t5}"`);

    // Test 6: Model numbers with hyphens preserved (e.g. WH-1000XM5)
    const t6 = cleanProductTitle('Sony WH-1000XM5 Wireless Headphones Best Seller');
    console.log('Test 6:', t6);
    assert(t6 === 'Sony WH-1000XM5 Wireless Headphones', `Expected "Sony WH-1000XM5 Wireless Headphones", got "${t6}"`);

    // Test 7: buildSearchQuery from attributes object
    const q1 = buildSearchQuery({
        brand: 'Samsung',
        model: 'Galaxy S24',
        edition: '5G',
        ramGb: 8,
        storageGb: 256
    });
    console.log('Query from object:', q1);
    assert(q1.includes('Samsung Galaxy S24 5G 8GB RAM 256GB'), `Expected query containing Samsung Galaxy S24 5G 8GB RAM 256GB, got "${q1}"`);

    // Test 8: buildSearchQuery removes UI noise if string passed
    const q2 = buildSearchQuery('Add to Compare Samsung Galaxy S24 5G 8GB RAM 256GB');
    console.log('Query from noisy string:', q2);
    assert(!q2.toLowerCase().includes('compare'), `Query must not contain "compare": "${q2}"`);
    assert(q2 === 'Samsung Galaxy S24 5G 8GB RAM 256GB', `Expected clean query, got "${q2}"`);

    console.log('All productNormalizer tests PASSED successfully!');
}

runTests();
