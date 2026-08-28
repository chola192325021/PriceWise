const { searchAmazon, searchFlipkart, searchMeesho, searchCroma, searchReliance } = require('./services/scraper');

async function testAll() {
    console.log("Testing Amazon...");
    const amazon = await searchAmazon("shirts");
    console.log("Amazon:", amazon.length);

    console.log("Testing Flipkart...");
    const fk = await searchFlipkart("shirts");
    console.log("Flipkart:", fk.length);

    console.log("Testing Meesho...");
    const meesho = await searchMeesho("shirts");
    console.log("Meesho:", meesho.length);

    console.log("Testing Croma...");
    const croma = await searchCroma("shirts");
    console.log("Croma:", croma.length);

    console.log("Testing Reliance...");
    const rel = await searchReliance("shirts");
    console.log("Reliance:", rel.length);
    
    process.exit(0);
}

testAll();
