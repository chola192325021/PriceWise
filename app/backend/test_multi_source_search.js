const assert = require('assert');
const { classifyQuery, getEligibleSources } = require('./services/sourceSelector');

function runClassifierTests() {
    console.log("Running Source Selector & Query Classifier Tests...");

    // 1. General Queries
    assert.strictEqual(classifyQuery('coffee mug'), 'General');
    assert.strictEqual(classifyQuery('wooden table'), 'General');
    assert.deepStrictEqual(getEligibleSources({ query: 'coffee mug' }), ['Amazon', 'Flipkart']);

    // 2. Electronics Queries
    assert.strictEqual(classifyQuery('wireless earbuds'), 'Electronics');
    assert.deepStrictEqual(getEligibleSources({ query: 'wireless earbuds' }), ['Amazon', 'Flipkart', 'Croma']);

    // 3. Fashion Queries
    assert.strictEqual(classifyQuery('casual shirt'), 'Fashion');
    assert.strictEqual(classifyQuery('blue jeans for men'), 'Fashion');
    assert.strictEqual(classifyQuery('silk saree'), 'Fashion');
    assert.strictEqual(classifyQuery('running shoes'), 'Fashion');
    assert.strictEqual(classifyQuery('handbag'), 'Fashion');
    assert.deepStrictEqual(
        getEligibleSources({ query: 'casual shirt' }),
        ['Amazon', 'Flipkart', 'AJIO', 'Myntra', 'Meesho']
    );

    // 4. Category Overrides
    assert.deepStrictEqual(
        getEligibleSources({ query: 'something', category: 'Fashion' }),
        ['Amazon', 'Flipkart', 'AJIO', 'Myntra', 'Meesho']
    );
    assert.deepStrictEqual(
        getEligibleSources({ query: 'something', category: 'Electronics' }),
        ['Amazon', 'Flipkart', 'Croma']
    );

    // 5. Explicit Source Filter
    assert.deepStrictEqual(
        getEligibleSources({ query: 'casual shirt', selectedSource: 'AJIO' }),
        ['AJIO']
    );
    assert.deepStrictEqual(
        getEligibleSources({ query: 'phone', selectedSource: 'Myntra' }),
        ['Myntra']
    );

    console.log("All Source Selector Unit Tests Passed Successfully!");
}

runClassifierTests();
