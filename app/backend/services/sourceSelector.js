/**
 * Source Selector & Query Classifier for PriceWise Multi-Source Search
 */

const FASHION_KEYWORDS = [
    'clothing', 'clothes', 'apparel', 'dress', 'dresses', 'shirt', 'shirts', 'tshirt', 'tshirts', 't-shirt', 't-shirts',
    'jeans', 'pant', 'pants', 'trouser', 'trousers', 'saree', 'sarees', 'kurta', 'kurtas', 'kurti', 'kurtis',
    'ethnic', 'suit', 'suits', 'lehenga', 'top', 'tops', 'blouse', 'skirt', 'footwear', 'shoe', 'shoes',
    'sneaker', 'sneakers', 'sandal', 'sandals', 'heel', 'heels', 'boot', 'boots', 'flipflop', 'flipflops',
    'slipper', 'slippers', 'sportswear', 'activewear', 'joggers', 'trackpant', 'tracksuit', 'hoodie', 'hoodies',
    'jacket', 'jackets', 'coat', 'coats', 'sweater', 'sweaters', 'innerwear', 'bra', 'briefs', 'boxers', 'socks',
    'bag', 'bags', 'handbag', 'handbags', 'backpack', 'backpacks', 'wallet', 'wallets', 'belt', 'belts',
    'sunglasses', 'goggles', 'jewellery', 'jewelry', 'ring', 'necklace', 'earring', 'perfume', 'deodorant',
    'makeup', 'beauty', 'fashion', 'puma', 'nike', 'adidas', 'zara', 'hm', 'levi', 'levis', 'woodland',
    'bata', 'uspa', 'wrangler', 'allen solly', 'peter england', 'van heusen'
];

const ELECTRONICS_KEYWORDS = [
    'mobile', 'mobiles', 'phone', 'phones', 'smartphone', 'smartphones', 'laptop', 'laptops', 'macbook',
    'tablet', 'tablets', 'ipad', 'camera', 'cameras', 'headphone', 'headphones', 'headset', 'headsets',
    'earbud', 'earbuds', 'earphone', 'earphones', 'airpods', 'speaker', 'speakers', 'bluetooth', 'tv', 'tvs',
    'television', 'televisions', 'monitor', 'monitors', 'gaming', 'console', 'playstation', 'xbox', 'nintendo',
    'computer', 'pc', 'gpu', 'cpu', 'keyboard', 'mouse', 'appliance', 'appliances', 'refrigerator', 'fridge',
    'washing', 'microwave', 'oven', 'ac', 'cooler', 'geyser', 'purifier', 'vacuum', 'trimmer', 'shaver',
    'smartwatch', 'smartwatches', 'powerbank', 'charger', 'cable', 'dell', 'apple', 'samsung', 'sony',
    'croma', 'reliance', 'hp', 'lenovo', 'asus', 'acer', 'realme', 'oneplus', 'xiaomi', 'redmi', 'vivo',
    'oppo', 'boat', 'noise', 'boult'
];

const ELECTRONICS_SOURCES = ['Amazon', 'Flipkart', 'Croma'];
const FASHION_SOURCES = ['Amazon', 'Flipkart', 'AJIO', 'Myntra', 'Meesho'];
const SHARED_GENERAL_SOURCES = ['Amazon', 'Flipkart'];

/**
 * Classifies query string or category into 'Fashion', 'Electronics', or 'General'.
 */
function classifyQuery(query = '', category = '') {
    const catLower = (category || '').toLowerCase().trim();
    if (catLower === 'fashion') return 'Fashion';
    if (catLower === 'electronics' || catLower === 'tech') return 'Electronics';

    const normQuery = (query || '').toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!normQuery) return 'General';

    const words = normQuery.split(' ');

    let fashionScore = 0;
    let electronicsScore = 0;

    for (const w of words) {
        if (FASHION_KEYWORDS.includes(w)) fashionScore += 2;
        if (ELECTRONICS_KEYWORDS.includes(w)) electronicsScore += 2;
    }

    FASHION_KEYWORDS.forEach(kw => {
        if (normQuery.includes(kw)) fashionScore += 1;
    });

    ELECTRONICS_KEYWORDS.forEach(kw => {
        if (normQuery.includes(kw)) electronicsScore += 1;
    });

    if (electronicsScore > fashionScore) return 'Electronics';
    if (fashionScore > electronicsScore) return 'Fashion';

    return 'General';
}

/**
 * Returns eligible sources based strictly on category rules:
 * - Electronics: Amazon, Flipkart, Croma (NO fashion or Reliance sources)
 * - Fashion: Amazon, Flipkart, AJIO, Myntra, Meesho
 * - General/Ambiguous: Amazon, Flipkart (Core shared sources)
 */
function getEligibleSources({ query = '', selectedSource = null, category = null } = {}) {
    const validSources = ['Amazon', 'Flipkart', 'Meesho', 'AJIO', 'Myntra', 'Croma'];

    if (selectedSource && typeof selectedSource === 'string' && selectedSource.trim() !== '') {
        const srcTrim = selectedSource.trim();
        const matched = validSources.find(s => s.toLowerCase() === srcTrim.toLowerCase());
        if (matched) return [matched];
    }

    const classification = classifyQuery(query, category);

    if (classification === 'Electronics') {
        return ELECTRONICS_SOURCES;
    }

    if (classification === 'Fashion') {
        return FASHION_SOURCES;
    }

    return SHARED_GENERAL_SOURCES;
}

module.exports = {
    classifyQuery,
    getEligibleSources,
    ELECTRONICS_SOURCES,
    FASHION_SOURCES,
    SHARED_GENERAL_SOURCES,
    FASHION_KEYWORDS,
    ELECTRONICS_KEYWORDS
};
