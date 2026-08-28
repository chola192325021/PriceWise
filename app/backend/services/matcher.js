/**
 * PriceWise Product Entity Matcher
 *
 * Implements a structured, explainable product matching pipeline:
 *   1. normalizeProduct()     — extracts a canonical product schema from a raw scrape result
 *   2. classifyCategory()     — maps product to a matching-rule category
 *   3. matchProducts()        — scores two normalised products and returns a transparent result
 *   4. findSimilarProducts()  — identifies and ranks similar variant / alternative products
 *
 * Hard-rejection rules ensure that different storage, model generation, form, or
 * quantity are NEVER presented as an "exact match".
 *
 * Safe logging: no passwords, tokens, JWTs, API keys or .env values are ever logged here.
 */

'use strict';

const { cleanProductTitle, buildSearchQuery } = require('./productNormalizer');

// ---------------------------------------------------------------------------
// Marketing noise to strip from titles before normalisation
// ---------------------------------------------------------------------------
const MARKETING_PHRASES = [
    'best seller', 'bestseller', 'limited deal', 'free delivery', 'new launch',
    'with offers', 'special offer', 'great deal', 'top rated', 'trending',
    'hot deal', 'deal of the day', 'lightning deal', 'sponsored', 'ad',
    'amazon choice', 'amazon\'s choice', "amazon's choice", 'prime deal',
    'exclusive', 'new arrival', 'just launched', 'limited edition launch',
    'flash sale', 'clearance sale', 'buy now', 'shop now', 'add to compare',
    'add to cart', 'add to bag', 'add to wishlist', 'view details', 'view product'
];

// ---------------------------------------------------------------------------
// Brand canonical map  (alias → canonical)
// ---------------------------------------------------------------------------
const BRAND_CANONICAL = {
    'apple': 'apple', 'iphone': 'apple', 'ipad': 'apple', 'macbook': 'apple',
    'samsung': 'samsung', 'galaxy': 'samsung',
    'sony': 'sony',
    'oneplus': 'oneplus', '1+': 'oneplus',
    'xiaomi': 'xiaomi', 'redmi': 'xiaomi', 'poco': 'xiaomi',
    'realme': 'realme',
    'vivo': 'vivo',
    'oppo': 'oppo',
    'motorola': 'motorola', 'moto': 'motorola',
    'nothing phone': 'nothing',
    'lg': 'lg',
    'google': 'google', 'pixel': 'google',
    'nokia': 'nokia',
    'dell': 'dell', 'xps': 'dell', 'inspiron': 'dell',
    'hp': 'hp', 'hewlett': 'hp',
    'lenovo': 'lenovo', 'thinkpad': 'lenovo', 'ideapad': 'lenovo',
    'asus': 'asus', 'rog': 'asus', 'vivobook': 'asus', 'zenbook': 'asus',
    'acer': 'acer', 'nitro': 'acer',
    'msi': 'msi',
    'razer': 'razer',
    'bose': 'bose',
    'sennheiser': 'sennheiser',
    'boat': 'boat',
    'boult': 'boult',
    'jbl': 'jbl',
    'harman': 'harman',
    'skullcandy': 'skullcandy',
    'nike': 'nike',
    'adidas': 'adidas',
    'puma': 'puma',
    'reebok': 'reebok',
    'bata': 'bata',
    'woodland': 'woodland',
    'dove': 'dove',
    'loreal': "l'oreal", "l'oreal": "l'oreal", 'loreal paris': "l'oreal",
    'pantene': 'pantene',
    'head shoulders': 'head & shoulders', 'head&shoulders': 'head & shoulders',
    'clinic plus': 'clinic plus',
    'surf excel': 'surf excel', 'surfexcel': 'surf excel',
    'ariel': 'ariel',
    'tide': 'tide',
    'harpic': 'harpic',
    'dettol': 'dettol'
};

// ---------------------------------------------------------------------------
// Product form synonyms — must NOT be treated as the same product
// ---------------------------------------------------------------------------
const FORM_GROUPS = {
    hair_care: ['shampoo', 'conditioner', 'hair oil', 'hair serum', 'hair mask', 'hair gel', 'hair cream', 'dry shampoo'],
    skin_care: ['face wash', 'moisturizer', 'moisturiser', 'sunscreen', 'toner', 'serum', 'face cream', 'night cream', 'eye cream', 'lip balm', 'lotion', 'body lotion', 'body wash', 'shower gel', 'soap', 'face pack', 'face scrub'],
    detergent: ['detergent powder', 'detergent liquid', 'detergent bar', 'fabric softener', 'washing powder'],
    headphones: ['headphones', 'headset', 'earphones', 'earbuds', 'in-ear', 'over-ear', 'on-ear', 'tws'],
    storage: ['pen drive', 'usb drive', 'flash drive', 'memory card', 'sd card', 'ssd', 'hard disk', 'hdd', 'external hard disk'],
    footwear: ['shoes', 'sneakers', 'sandals', 'boots', 'loafers', 'slippers', 'heels', 'flats'],
    clothing: ['shirt', 't-shirt', 'jeans', 'trousers', 'shorts', 'jacket', 'sweater', 'hoodie', 'dress', 'skirt', 'kurta', 'saree', 'suit']
};

// ---------------------------------------------------------------------------
// Colour normalisation map — preserves meaningful colour names
// ---------------------------------------------------------------------------
const COLOUR_MAP = {
    'midnight black': 'black', 'phantom black': 'black', 'titanium black': 'black',
    'jet black': 'black', 'matte black': 'black', 'obsidian': 'black',
    'starlight': 'silver', 'silver': 'silver', 'titanium gray': 'gray', 'graphite': 'gray',
    'space gray': 'gray', 'space grey': 'gray', 'ash grey': 'gray', 'grey': 'gray',
    'gold': 'gold', 'champagne gold': 'gold', 'rose gold': 'rose gold', 'blush gold': 'rose gold',
    'blue': 'blue', 'ice blue': 'blue', 'sky blue': 'blue', 'ocean blue': 'blue',
    'navy blue': 'navy blue', 'midnight blue': 'navy blue',
    'white': 'white', 'pearl white': 'white', 'cloud white': 'white',
    'green': 'green', 'mint green': 'green', 'sage green': 'green', 'forest green': 'dark green',
    'purple': 'purple', 'lavender': 'lavender', 'violet': 'violet',
    'red': 'red', 'crimson': 'red',
    'orange': 'orange', 'coral': 'orange',
    'pink': 'pink', 'rose': 'pink',
    'amber yellow': 'yellow'
};

// ---------------------------------------------------------------------------
// Category-specific critical attributes
// ---------------------------------------------------------------------------
const CATEGORY_CRITICAL_ATTRS = {
    electronics_phone:   ['brand', 'model', 'storageGb', 'ramGb', 'connectivity'],
    electronics_laptop:  ['brand', 'model', 'storageGb', 'ramGb'],
    electronics_tv:      ['brand', 'model', 'size'],
    electronics_headphones: ['brand', 'model'],
    electronics_generic: ['brand', 'model'],
    grocery_beauty:      ['brand', 'productType', 'capacityMl', 'weightG', 'quantity', 'packCount'],
    fashion:             ['brand', 'productType', 'size', 'gender'],
    books:               ['brand', 'model', 'edition'],
    general:             ['brand', 'productType']
};

// ===========================================================================
// SECTION 1 — Text utilities
// ===========================================================================

/**
 * Strips marketing noise and normalises whitespace.
 */
function cleanTitle(title) {
    if (!title) return '';
    let t = cleanProductTitle(title).toLowerCase().trim();

    // Remove marketing phrases
    for (const phrase of MARKETING_PHRASES) {
        t = t.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), ' ');
    }

    // Normalise separators and punctuation (but NOT inside model numbers)
    t = t.replace(/[|–—•·]/g, ' ')
         .replace(/\s*[,;:]\s*/g, ' ')
         .replace(/\s+/g, ' ')
         .trim();

    return t;
}

/**
 * Extracts brand from title using the canonical map.
 * Returns lowercase canonical brand or null.
 * Longest alias wins — prevents short aliases shadowing long brand names.
 */
function extractBrand(title) {
    if (!title) return null;
    const t = title.toLowerCase();

    // Sort all aliases by length descending so longer, more-specific aliases win
    const sorted = Object.keys(BRAND_CANONICAL).sort((a, b) => b.length - a.length);
    for (const alias of sorted) {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?:^|[\\s,([])${escaped}(?:$|[\\s,)\\]])`, 'i');
        if (regex.test(t) || t.startsWith(alias) || t.endsWith(alias) || t.includes(` ${alias} `)) {
            return BRAND_CANONICAL[alias];
        }
    }
    return null;
}

/**
 * Extracts model number patterns like SM-G991B, WH-1000XM5, SM-S921B etc.
 */
function extractModelNumber(title) {
    if (!title) return null;
    const patterns = [
        /\b([A-Z]{1,4}-[A-Z0-9]{4,})\b/i,       // SM-G991B, WH-1000XM5
        /\b([A-Z]{2,4}\d{3,}[A-Z0-9]*)\b/i,       // SM921, XM5
        /\bASIN:?\s*([A-Z0-9]{10})\b/i             // ASIN
    ];
    for (const p of patterns) {
        const m = title.match(p);
        if (m) return m[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    return null;
}

/**
 * Normalises a model string so WH-1000XM5, WH1000XM5, WH 1000 XM5 → wh1000xm5
 */
function normaliseModelString(model) {
    if (!model) return '';
    return model.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Extracts storage in GB (handles TB too).
 */
function extractStorage(text) {
    if (!text) return null;
    const tbMatch = text.match(/\b(\d+(?:\.\d+)?)\s*tb\b/i);
    if (tbMatch) return Math.round(parseFloat(tbMatch[1]) * 1024);

    // Prefer explicit storage context first
    const storageCtxMatch = text.match(/\b(\d+(?:\.\d+)?)\s*gb\s*(?:internal|storage|rom|ssd|emmc|ufs|inbuilt|built-in)\b/i)
                         || text.match(/\b(?:internal|storage|rom|ssd|emmc|ufs)\s*:\s*(\d+(?:\.\d+)?)\s*gb\b/i);
    if (storageCtxMatch) return parseFloat(storageCtxMatch[1]);

    // Spec list — take the largest non-RAM GB
    const allGbMatches = [...text.matchAll(/\b(\d+(?:\.\d+)?)\s*gb\b/gi)];
    if (allGbMatches.length === 0) return null;

    const nonRamMatches = allGbMatches.filter(m => {
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12).toLowerCase();
        return !after.match(/^\s*(?:ram|lpddr|ddr)/);
    });

    if (nonRamMatches.length === 0) return null;

    const values = nonRamMatches.map(m => parseFloat(m[1]));
    const largest = Math.max(...values);

    const commonRamSizes = new Set([1, 2, 3, 4, 6, 8, 10, 12, 16]);
    if (commonRamSizes.has(largest) && nonRamMatches.length === 1) return null;

    return largest;
}

/**
 * Extracts RAM in GB.
 */
function extractRam(text) {
    if (!text) return null;
    const ramMatch = text.match(/\b(\d+(?:\.\d+)?)\s*gb\s*(?:lpddr\d*|ddr\d*|ram)\b/i)
                  || text.match(/\b(?:lpddr\d*|ddr\d*)\s*(\d+(?:\.\d+)?)\s*gb\b/i)
                  || text.match(/\b(\d+(?:\.\d+)?)\s*gb\s+ram\b/i)
                  || text.match(/\bram\s*:\s*(\d+(?:\.\d+)?)\s*gb\b/i);
    if (ramMatch) return parseFloat(ramMatch[1]);
    return null;
}

/**
 * Extracts capacity in millilitres.
 */
function extractCapacityMl(text) {
    if (!text) return null;
    const litreMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(?:litre|liter|l\b)/i);
    if (litreMatch) return parseFloat(litreMatch[1]) * 1000;
    const mlMatch = text.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
    if (mlMatch) return parseFloat(mlMatch[1]);
    return null;
}

/**
 * Extracts weight in grams.
 */
function extractWeightG(text) {
    if (!text) return null;
    const kgMatch = text.match(/\b(\d+(?:\.\d+)?)\s*kg\b/i);
    if (kgMatch) return parseFloat(kgMatch[1]) * 1000;
    const gMatch = text.match(/\b(\d+(?:\.\d+)?)\s*g\b(?!\s*b)/i);
    if (gMatch) return parseFloat(gMatch[1]);
    return null;
}

/**
 * Extracts item count / pack count.
 */
function extractPackInfo(text) {
    if (!text) return { packCount: 1, quantity: 1 };

    const packMatch = text.match(/\bpack\s+of\s+(\d+)\b/i)
                   || text.match(/\b(\d+)\s*[- ]?\s*pack\b/i)
                   || text.match(/\bset\s+of\s+(\d+)\b/i)
                   || text.match(/\bcombo\s+of\s+(\d+)\b/i)
                   || text.match(/\b(\d+)\s*x\s*\d+/i);
    const packCount = packMatch ? parseInt(packMatch[1], 10) : 1;

    return { packCount, quantity: packCount };
}

/**
 * Extracts connectivity: "5g", "4g", "lte", "wifi", "bluetooth"
 */
function extractConnectivity(text) {
    if (!text) return null;
    if (/\b5g\b/i.test(text)) return '5g';
    if (/\b4g\b|\blte\b/i.test(text)) return '4g';
    if (/\bwifi\b|\bwi-fi\b/i.test(text)) return 'wifi';
    return null;
}

/**
 * Normalises a colour string using the colour map.
 */
function extractColor(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    const sorted = Object.keys(COLOUR_MAP).sort((a, b) => b.length - a.length);
    for (const phrase of sorted) {
        if (t.includes(phrase)) return COLOUR_MAP[phrase];
    }
    return null;
}

/**
 * Extracts size (clothing / footwear)
 */
function extractSize(text) {
    if (!text) return null;
    const sizeMatch = text.match(/\bsize\s+([a-z0-9]+)\b/i)
                   || text.match(/\buk\s+(\d+)\b/i)
                   || text.match(/\b(xs|s|m|l|xl|xxl|xxxl)\b/i)
                   || text.match(/\b(\d{2})\s*(?:eu|uk|us)?\s*size\b/i);
    if (sizeMatch) return sizeMatch[1].toLowerCase();
    return null;
}

/**
 * Extracts gender signals
 */
function extractGender(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    if (/\b(?:men|mens|male)\b/.test(t)) return 'men';
    if (/\b(?:women|womens|female|ladies)\b/.test(t)) return 'women';
    if (/\bboys?\b/.test(t)) return 'boys';
    if (/\bgirls?\b/.test(t)) return 'girls';
    if (/\bunisex\b/.test(t)) return 'unisex';
    return null;
}

/**
 * Extracts product form from FORM_GROUPS.
 */
function extractProductForm(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    for (const [group, forms] of Object.entries(FORM_GROUPS)) {
        for (const form of forms) {
            if (t.includes(form)) return { group, form };
        }
    }
    return null;
}

/**
 * Extracts phone-specific model identifiers
 */
function extractPhoneEdition(text) {
    if (!text) return null;
    const t = text.toLowerCase();

    const iphoneEditions = [
        'pro max', 'pro', 'plus', 'mini',
        'ultra', 'fe', 'edge', 'fold', 'flip',
        'e', 'a', 'f', 's', 'x'
    ];
    const iphoneMatch = t.match(/iphone\s+\d+\s*([a-z\s]+)/);
    if (iphoneMatch) {
        for (const ed of iphoneEditions) {
            if (iphoneMatch[1].trim().startsWith(ed)) return ed.replace(/\s+/g, '_');
        }
    }

    const galaxyMatch = t.match(/galaxy\s+[szamf]\d+\s*([a-z+\s]*)/);
    if (galaxyMatch && galaxyMatch[1].trim()) {
        const ed = galaxyMatch[1].trim().replace(/[^a-z+]/g, '');
        if (['ultra', 'plus', '+', 'fe', 'edge', 'fold', 'flip', 'lite'].includes(ed)) return ed;
    }

    return null;
}

/**
 * Extracts the core model name token(s)
 */
function extractModel(title, brand) {
    if (!title) return null;
    let t = cleanTitle(title);

    if (brand) {
        t = t.replace(new RegExp(`\\b${brand}\\b`, 'gi'), '').trim();
    }

    const sonyMatch = t.match(/\b(wh|wf|xm|mdr|ath)-?[\w]+\b/i);
    if (sonyMatch) return normaliseModelString(sonyMatch[0]);

    const iphoneMatch = t.match(/iphone\s*(\d+(?:\s+(?:pro\s+max|pro|plus|mini))?)/i);
    if (iphoneMatch) return normaliseModelString(iphoneMatch[0]);

    const galaxyMatch = t.match(/galaxy\s+[a-z]\d+\s*(?:\+|ultra|fe|plus|fold|flip|edge|lite)?/i);
    if (galaxyMatch) return normaliseModelString(galaxyMatch[0]);

    const macMatch = t.match(/macbook\s+(?:pro|air|mini)?(?:\s+\d+)?/i);
    if (macMatch) return normaliseModelString(macMatch[0]);

    const laptopMatch = t.match(/\b(xps|inspiron|pavilion|envy|spectre|ideapad|thinkpad|zenbook|vivobook|nitro|aspire|swift|predator|rog\s+\w+)\s*\d*/i);
    if (laptopMatch) return normaliseModelString(laptopMatch[0]);

    const words = t.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 1);
    return words.slice(0, 3).join('');
}

/**
 * Computes token overlap ratio between two strings.
 */
function tokenSimilarity(a, b) {
    if (!a || !b) return 0;
    const setA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 1));
    const setB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 1));
    if (setA.size === 0 || setB.size === 0) return 0;
    let common = 0;
    for (const w of setA) { if (setB.has(w)) common++; }
    return common / Math.max(setA.size, setB.size);
}

// ===========================================================================
// SECTION 2 — Product normalisation
// ===========================================================================

/**
 * Converts a raw scraped item into the structured PriceWise product schema.
 *
 * @param {Object} rawItem  Raw scrape result: { platform, title, price, url, imageUrl, rawTitle }
 * @returns {Object} Normalised product schema
 */
function normalizeProduct(rawItem) {
    if (!rawItem) return null;

    const rawTitle = rawItem.rawTitle || rawItem.title || '';
    const cleanTitleStr = cleanProductTitle(rawTitle);
    const normalizedTitle = cleanTitle(cleanTitleStr);
    const brand = extractBrand(cleanTitleStr);
    const modelNumber = extractModelNumber(cleanTitleStr);
    const model = extractModel(cleanTitleStr, brand);
    const form = extractProductForm(normalizedTitle);
    const packInfo = extractPackInfo(normalizedTitle);

    const variant = {
        storageGb: extractStorage(normalizedTitle),
        ramGb: extractRam(normalizedTitle),
        color: extractColor(normalizedTitle),
        size: extractSize(normalizedTitle),
        capacityMl: extractCapacityMl(normalizedTitle),
        weightG: extractWeightG(normalizedTitle),
        quantity: packInfo.quantity,
        packCount: packInfo.packCount,
        connectivity: extractConnectivity(normalizedTitle),
        edition: extractPhoneEdition(normalizedTitle),
        gender: extractGender(normalizedTitle),
        productForm: form ? form.form : null,
        productFormGroup: form ? form.group : null,
        other: {}
    };

    let sourceProductId = null;
    try {
        const urlStr = rawItem.url || '';
        const asinMatch = urlStr.match(/\/dp\/([A-Z0-9]{10})/i)
                       || urlStr.match(/\/gp\/product\/([A-Z0-9]{10})/i);
        if (asinMatch) sourceProductId = asinMatch[1].toUpperCase();

        if (!sourceProductId) {
            const fkMatch = urlStr.match(/\/p\/(itm[a-z0-9]+)/i);
            if (fkMatch) sourceProductId = fkMatch[1];
        }
    } catch (_) {}

    const extractedCount = [
        brand, modelNumber, model,
        variant.storageGb, variant.ramGb, variant.capacityMl,
        variant.weightG, variant.size
    ].filter(v => v !== null && v !== undefined).length;

    const extractedConfidence = Math.min(1.0, extractedCount / 5);

    return {
        source: (rawItem.platform || 'unknown').toLowerCase(),
        sourceProductId,
        url: rawItem.url || '',
        rawTitle,
        title: cleanTitleStr || rawTitle,
        cleanTitle: cleanTitleStr || rawTitle,
        normalizedTitle,
        brand,
        model,
        modelNumber: modelNumber ? modelNumber.toUpperCase() : null,
        variant,
        price: rawItem.price || 0,
        currency: 'INR',
        availability: true,
        imageUrl: rawItem.imageUrl || '',
        extractedConfidence,

        _diagnostics: {
            rawTitle,
            cleanTitle: cleanTitleStr,
            normalizedTitle,
            brand,
            model,
            modelNumber,
            storageGb: variant.storageGb,
            ramGb: variant.ramGb,
            capacityMl: variant.capacityMl,
            weightG: variant.weightG,
            packCount: variant.packCount,
            color: variant.color,
            size: variant.size,
            connectivity: variant.connectivity,
            edition: variant.edition,
            productForm: variant.productForm,
            extractedConfidence
        }
    };
}

// ===========================================================================
// SECTION 3 — Category classification
// ===========================================================================

const PHONE_BRANDS = ['apple', 'samsung', 'oneplus', 'xiaomi', 'realme', 'vivo', 'oppo', 'motorola', 'nothing', 'google', 'nokia'];
const PHONE_KEYWORDS = ['iphone', 'galaxy', 'pixel', 'poco', 'redmi', 'smartphone', 'mobile phone', '5g phone'];
const LAPTOP_KEYWORDS = ['laptop', 'macbook', 'notebook', 'ultrabook', 'chromebook', 'xps', 'thinkpad', 'ideapad', 'zenbook', 'vivobook'];
const TV_KEYWORDS = ['tv', 'television', 'smart tv', 'qled', 'oled', 'led tv', '4k tv', '8k tv'];
const HEADPHONES_KEYWORDS = ['headphone', 'headset', 'earphone', 'earbud', 'tws', 'airpod', 'wh-', 'wf-', 'soundcore'];
const GROCERY_BEAUTY_KEYWORDS = ['shampoo', 'conditioner', 'lotion', 'moisturiser', 'moisturizer', 'face wash', 'body wash', 'soap',
    'detergent', 'fabric', 'washing', 'dish', 'cleaner', 'floor', 'surface', 'sanitizer', 'handwash',
    'ml', 'litre', 'liter', 'kg', 'grams', 'toothpaste', 'deodorant', 'perfume', 'sunscreen', 'serum'];
const FASHION_KEYWORDS = ['shirt', 't-shirt', 'jeans', 'trouser', 'dress', 'shoe', 'sneaker', 'sandal', 'boot', 'saree', 'kurta', 'kurti', 'jacket'];
const BOOK_KEYWORDS = ['book', 'novel', 'paperback', 'hardcover', 'ebook', 'isbn', 'edition'];

function classifyCategory(product) {
    if (!product) return 'general';
    const t = (product.normalizedTitle || '').toLowerCase();
    const brand = product.brand || '';

    if (PHONE_KEYWORDS.some(kw => t.includes(kw))) return 'electronics_phone';
    if (PHONE_BRANDS.includes(brand) && /\b\d+\b/.test(t)) return 'electronics_phone';
    if (LAPTOP_KEYWORDS.some(kw => t.includes(kw))) return 'electronics_laptop';
    if (TV_KEYWORDS.some(kw => t.includes(kw))) return 'electronics_tv';
    if (HEADPHONES_KEYWORDS.some(kw => t.includes(kw))) return 'electronics_headphones';
    if (BOOK_KEYWORDS.some(kw => t.includes(kw))) return 'books';
    if (GROCERY_BEAUTY_KEYWORDS.some(kw => t.includes(kw))) return 'grocery_beauty';
    if (FASHION_KEYWORDS.some(kw => t.includes(kw))) return 'fashion';

    return 'general';
}

// ===========================================================================
// SECTION 4 — Hard rejection rules
// ===========================================================================

function applyHardRejections(a, b, category) {
    // Rule 1: Different canonical brand
    if (a.brand && b.brand && a.brand !== b.brand) {
        return { reason: `Rejected: Brand mismatch — ${a.brand} ≠ ${b.brand}` };
    }

    // Rule 2: Different product form/type
    if (a.variant.productFormGroup && b.variant.productFormGroup) {
        if (a.variant.productForm && b.variant.productForm &&
            a.variant.productFormGroup === b.variant.productFormGroup &&
            a.variant.productForm !== b.variant.productForm) {
            return { reason: `Rejected: Product form mismatch — ${a.variant.productForm} ≠ ${b.variant.productForm}` };
        }
    }

    // Rule 3: Different model number
    if (a.modelNumber && b.modelNumber) {
        const normA = normaliseModelString(a.modelNumber);
        const normB = normaliseModelString(b.modelNumber);
        if (normA !== normB) {
            return { reason: `Rejected: Model number mismatch — ${a.modelNumber} ≠ ${b.modelNumber}` };
        }
    }

    // Rule 4: Contradictory storage
    if (a.variant.storageGb !== null && b.variant.storageGb !== null) {
        if (a.variant.storageGb !== b.variant.storageGb) {
            return { reason: `Rejected: Storage mismatch — ${a.variant.storageGb} GB ≠ ${b.variant.storageGb} GB` };
        }
    }

    // Rule 5: Contradictory RAM
    if (a.variant.ramGb !== null && b.variant.ramGb !== null) {
        if (a.variant.ramGb !== b.variant.ramGb) {
            return { reason: `Rejected: RAM mismatch — ${a.variant.ramGb} GB ≠ ${b.variant.ramGb} GB` };
        }
    }

    // Rule 6: Contradictory phone edition
    if (a.variant.edition !== null && b.variant.edition !== null) {
        if (a.variant.edition !== b.variant.edition) {
            return { reason: `Rejected: Phone edition mismatch — ${a.variant.edition} ≠ ${b.variant.edition}` };
        }
    }
    if ((a.variant.edition !== null) !== (b.variant.edition !== null)) {
        const edA = a.variant.edition || 'base';
        const edB = b.variant.edition || 'base';
        if (edA !== edB) {
            return { reason: `Rejected: Phone edition mismatch — ${edA} ≠ ${edB}` };
        }
    }

    // Rule 7: Contradictory capacity
    if (category === 'grocery_beauty' && a.variant.capacityMl !== null && b.variant.capacityMl !== null) {
        const diff = Math.abs(a.variant.capacityMl - b.variant.capacityMl);
        const smaller = Math.min(a.variant.capacityMl, b.variant.capacityMl);
        const ratio = diff / smaller;
        if (diff > 10 && ratio < 0.1) {
            return { reason: `Rejected: Capacity mismatch — ${a.variant.capacityMl} ml ≠ ${b.variant.capacityMl} ml` };
        }
    }

    // Rule 8: Contradictory weight
    if (category === 'grocery_beauty' && a.variant.weightG !== null && b.variant.weightG !== null) {
        const diff = Math.abs(a.variant.weightG - b.variant.weightG);
        const smaller = Math.min(a.variant.weightG, b.variant.weightG);
        const ratio = diff / smaller;
        if (diff > 10 && ratio < 0.1) {
            return { reason: `Rejected: Weight mismatch — ${a.variant.weightG} g ≠ ${b.variant.weightG} g` };
        }
    }

    return null;
}

// ===========================================================================
// SECTION 5 — Weighted scoring
// ===========================================================================

const WEIGHTS = {
    modelNumber:    0.22,
    model:          0.28,
    brand:          0.15,
    productType:    0.10,
    criticalVariant: 0.15,
    titleSimilarity: 0.10
};

function matchProducts(a, b) {
    if (!a || !b) {
        return {
            matchStatus: 'no_match',
            confidence: 0,
            matchedAttributes: [],
            differingAttributes: [],
            rejectedAttributes: [],
            reasons: ['Rejected: One or both products could not be normalised']
        };
    }

    const category = classifyCategory(a);
    const matchedAttributes = [];
    const differingAttributes = [];
    const rejectedAttributes = [];
    const reasons = [];

    // ---- Hard rejections first ----
    const hardReject = applyHardRejections(a, b, category);
    if (hardReject) {
        return {
            matchStatus: 'no_match',
            confidence: 0,
            matchedAttributes,
            differingAttributes,
            rejectedAttributes: [hardReject.reason],
            reasons: [hardReject.reason]
        };
    }

    // ---- Positive scoring ----
    let score = 0;

    const bothHaveModelNumber = a.modelNumber && b.modelNumber;
    const modelNumberWeight = bothHaveModelNumber ? WEIGHTS.modelNumber : 0;
    const modelWeight = bothHaveModelNumber ? WEIGHTS.model : WEIGHTS.model + WEIGHTS.modelNumber;

    if (bothHaveModelNumber) {
        const normA = normaliseModelString(a.modelNumber);
        const normB = normaliseModelString(b.modelNumber);
        if (normA === normB) {
            score += modelNumberWeight;
            matchedAttributes.push('modelNumber');
            reasons.push(`Model number matches: ${a.modelNumber}`);
        }
    }

    if (a.model && b.model) {
        const normA = normaliseModelString(a.model);
        const normB = normaliseModelString(b.model);
        if (normA === normB) {
            score += modelWeight;
            matchedAttributes.push('model');
            reasons.push(`Model matches: ${a.model}`);
        } else if (normA.includes(normB) || normB.includes(normA)) {
            score += modelWeight * 0.5;
            reasons.push(`Model partially matches: ${a.model} ~ ${b.model}`);
        } else {
            differingAttributes.push('model');
            reasons.push(`Model differs: ${a.model} vs ${b.model}`);
        }
    }

    if (a.brand && b.brand && a.brand === b.brand) {
        score += WEIGHTS.brand;
        matchedAttributes.push('brand');
        reasons.push(`Brand matches: ${a.brand}`);
    } else if (!a.brand || !b.brand) {
        score += WEIGHTS.brand * 0.5;
    }

    if (a.variant.productForm && b.variant.productForm && a.variant.productForm === b.variant.productForm) {
        score += WEIGHTS.productType;
        matchedAttributes.push('productType');
        reasons.push(`Product type matches: ${a.variant.productForm}`);
    } else if (!a.variant.productForm || !b.variant.productForm) {
        score += WEIGHTS.productType * 0.5;
    }

    let variantScore = 0;
    let variantChecked = 0;

    const checkVariant = (key, labelA, labelB, unitLabel) => {
        if (labelA !== null && labelB !== null) {
            variantChecked++;
            if (labelA === labelB) {
                variantScore++;
                matchedAttributes.push(key);
                reasons.push(`${key} matches: ${labelA}${unitLabel || ''}`);
            } else {
                differingAttributes.push(key);
                reasons.push(`${key} differs: ${labelA}${unitLabel || ''} vs ${labelB}${unitLabel || ''}`);
            }
        }
    };

    checkVariant('storageGb', a.variant.storageGb, b.variant.storageGb, ' GB');
    checkVariant('ramGb', a.variant.ramGb, b.variant.ramGb, ' GB RAM');
    checkVariant('connectivity', a.variant.connectivity, b.variant.connectivity, '');
    checkVariant('packCount', a.variant.packCount > 1 ? a.variant.packCount : null,
                              b.variant.packCount > 1 ? b.variant.packCount : null, ' pack');
    checkVariant('capacityMl', a.variant.capacityMl, b.variant.capacityMl, ' ml');
    checkVariant('weightG', a.variant.weightG, b.variant.weightG, ' g');
    checkVariant('size', a.variant.size, b.variant.size, '');

    if (variantChecked > 0) {
        score += WEIGHTS.criticalVariant * (variantScore / variantChecked);
    } else {
        score += WEIGHTS.criticalVariant * 0.5;
    }

    const titleSim = tokenSimilarity(a.normalizedTitle, b.normalizedTitle);
    score += WEIGHTS.titleSimilarity * titleSim;
    if (titleSim >= 0.7) {
        reasons.push(`Title similarity: ${Math.round(titleSim * 100)}%`);
    }

    const colorDiffers = a.variant.color && b.variant.color && a.variant.color !== b.variant.color;
    if (colorDiffers) {
        differingAttributes.push('color');
        reasons.push(`Colour differs: ${a.variant.color} vs ${b.variant.color}`);
    } else if (a.variant.color && b.variant.color && a.variant.color === b.variant.color) {
        matchedAttributes.push('color');
        reasons.push(`Colour matches: ${a.variant.color}`);
    }

    const sameBrand = a.brand && b.brand && a.brand === b.brand;
    const sameForm = a.variant.productForm && b.variant.productForm
        && a.variant.productForm === b.variant.productForm;
    const sameModelLine = a.model && b.model && normaliseModelString(a.model) === normaliseModelString(b.model);
    const sameProductLine = sameBrand && (sameForm || sameModelLine);

    const capacityDiffers = a.variant.capacityMl !== null && b.variant.capacityMl !== null &&
                            Math.abs(a.variant.capacityMl - b.variant.capacityMl) > 10;
    const weightDiffers = a.variant.weightG !== null && b.variant.weightG !== null &&
                          Math.abs(a.variant.weightG - b.variant.weightG) > 10;
    const packDiffers = a.variant.packCount !== b.variant.packCount &&
                        (a.variant.packCount > 1 || b.variant.packCount > 1);
    const quantityDiffers = capacityDiffers || weightDiffers || packDiffers;

    if (sameProductLine && quantityDiffers) {
        let unitPriceA = null, unitPriceB = null, unitLabel = null;
        if (a.variant.capacityMl && b.variant.capacityMl && a.price && b.price) {
            unitPriceA = Math.round(a.price / (a.variant.capacityMl / 1000) * 100) / 100;
            unitPriceB = Math.round(b.price / (b.variant.capacityMl / 1000) * 100) / 100;
            unitLabel = '₹/litre';
        } else if (a.variant.weightG && b.variant.weightG && a.price && b.price) {
            unitPriceA = Math.round(a.price / (a.variant.weightG / 1000) * 100) / 100;
            unitPriceB = Math.round(b.price / (b.variant.weightG / 1000) * 100) / 100;
            unitLabel = '₹/kg';
        } else if (a.price && b.price) {
            unitPriceA = Math.round(a.price / a.variant.packCount * 100) / 100;
            unitPriceB = Math.round(b.price / b.variant.packCount * 100) / 100;
            unitLabel = '₹/item';
        }
        return {
            matchStatus: 'unit_price_only',
            confidence: Math.round(score * 100) / 100,
            matchedAttributes,
            differingAttributes,
            rejectedAttributes,
            reasons: [...reasons, 'Comparable product line, different quantity'],
            unitPriceA,
            unitPriceB,
            unitLabel
        };
    }

    const onlyColorDiffers = differingAttributes.length === 1 && differingAttributes[0] === 'color';
    const noConflicts = differingAttributes.length === 0 || onlyColorDiffers;

    let matchStatus;
    if (score >= 0.88 && noConflicts && !colorDiffers) {
        matchStatus = 'exact_match';
    } else if (score >= 0.80 && onlyColorDiffers) {
        matchStatus = 'variant_match';
    } else if (score >= 0.78 && noConflicts) {
        matchStatus = 'exact_match';
    } else if (score >= 0.68) {
        matchStatus = 'variant_match';
    } else {
        matchStatus = 'no_match';
        reasons.push(`Rejected: Insufficient similarity (score ${Math.round(score * 100)}%)`);
    }

    return {
        matchStatus,
        confidence: Math.round(score * 100) / 100,
        matchedAttributes,
        differingAttributes,
        rejectedAttributes,
        reasons
    };
}

/**
 * Finds, classifies, and ranks similar product alternatives for a reference product.
 * Returns distinct similar items (never exact matches) with human-readable differences.
 *
 * @param {Object} refProduct - Normalized reference product schema
 * @param {Array<Object>} candidateProducts - List of normalized candidate products
 * @returns {Array<Object>} Ranked similar products
 */
function findSimilarProducts(refProduct, candidateProducts = []) {
    if (!refProduct || !Array.isArray(candidateProducts)) return [];

    const similarList = [];

    for (const cand of candidateProducts) {
        if (!cand || cand.url === refProduct.url) continue;

        const matchResult = matchProducts(refProduct, cand);

        // Exact matches belong in exact platforms, not similar products
        if (matchResult.matchStatus === 'exact_match') continue;

        const differences = [];
        let similarityTier = 'related_product';
        let isRelevant = false;

        const sameBrand = refProduct.brand && cand.brand && refProduct.brand === cand.brand;
        const normRefModel = normaliseModelString(refProduct.model);
        const normCandModel = normaliseModelString(cand.model);
        const sameModel = normRefModel && normCandModel && normRefModel === normCandModel;
        const partialModel = normRefModel && normCandModel && (normRefModel.includes(normCandModel) || normCandModel.includes(normRefModel));

        // Detect specific differences
        if (refProduct.variant.storageGb !== null && cand.variant.storageGb !== null &&
            refProduct.variant.storageGb !== cand.variant.storageGb) {
            differences.push(`Storage differs: ${cand.variant.storageGb}GB instead of ${refProduct.variant.storageGb}GB`);
        }

        if (refProduct.variant.ramGb !== null && cand.variant.ramGb !== null &&
            refProduct.variant.ramGb !== cand.variant.ramGb) {
            differences.push(`RAM differs: ${cand.variant.ramGb}GB instead of ${refProduct.variant.ramGb}GB`);
        }

        if (refProduct.variant.edition !== null && cand.variant.edition !== null &&
            refProduct.variant.edition !== cand.variant.edition) {
            differences.push(`Edition differs: ${cand.variant.edition} instead of ${refProduct.variant.edition}`);
        }

        if (refProduct.variant.capacityMl !== null && cand.variant.capacityMl !== null &&
            Math.abs(refProduct.variant.capacityMl - cand.variant.capacityMl) > 10) {
            differences.push(`Capacity differs: ${cand.variant.capacityMl}ml instead of ${refProduct.variant.capacityMl}ml`);
        }

        if (refProduct.variant.weightG !== null && cand.variant.weightG !== null &&
            Math.abs(refProduct.variant.weightG - cand.variant.weightG) > 10) {
            differences.push(`Weight differs: ${cand.variant.weightG}g instead of ${refProduct.variant.weightG}g`);
        }

        if (refProduct.variant.color && cand.variant.color &&
            refProduct.variant.color !== cand.variant.color) {
            differences.push(`Colour differs: ${cand.variant.color} instead of ${refProduct.variant.color}`);
        }

        if (refProduct.variant.packCount && cand.variant.packCount &&
            refProduct.variant.packCount !== cand.variant.packCount) {
            differences.push(`Pack size differs: Pack of ${cand.variant.packCount} instead of Pack of ${refProduct.variant.packCount}`);
        }

        if (!sameModel && partialModel) {
            differences.push(`Different model line: ${cand.model || 'Alternative'} instead of ${refProduct.model || 'Reference'}`);
        } else if (!sameBrand && cand.brand) {
            differences.push(`Different brand: ${cand.brand.toUpperCase()} instead of ${refProduct.brand ? refProduct.brand.toUpperCase() : ''}`);
        }

        // Determine similarity tier
        if (sameBrand && (sameModel || matchResult.matchStatus === 'variant_match' || matchResult.matchStatus === 'unit_price_only')) {
            similarityTier = 'close_variant';
            isRelevant = true;
        } else if (sameBrand || (classifyCategory(refProduct) === classifyCategory(cand) && matchResult.confidence >= 0.40)) {
            similarityTier = 'comparable_alternative';
            isRelevant = true;
        } else if (matchResult.confidence >= 0.35) {
            similarityTier = 'related_product';
            isRelevant = true;
        }

        if (isRelevant) {
            const rawPlatform = cand._raw ? cand._raw.platform : (cand.source || 'Online Store');
            const cleanTitleDisplay = cand.cleanTitle || cand.title || 'Similar Product';

            similarList.push({
                source: rawPlatform,
                title: cleanTitleDisplay,
                price: cand.price,
                url: cand.url,
                imageUrl: cand.imageUrl || '',
                matchType: 'similar',
                similarityTier,
                confidence: Math.max(0.4, matchResult.confidence),
                differences: differences.length > 0 ? differences : ['Alternative model in similar category'],
                comparisonEligible: false
            });
        }
    }

    // Sort by similarity tier precedence and confidence
    const tierPriority = { close_variant: 3, comparable_alternative: 2, related_product: 1 };
    similarList.sort((a, b) => {
        const pDiff = (tierPriority[b.similarityTier] || 0) - (tierPriority[a.similarityTier] || 0);
        if (pDiff !== 0) return pDiff;
        return b.confidence - a.confidence;
    });

    return similarList.slice(0, 10);
}

/**
 * Logs diagnostics for a normalised product safely (no credentials).
 */
function logDiagnostics(normalised, matchResult) {
    if (!normalised) return;
    const d = normalised._diagnostics || {};
    console.log('[Matcher] Diagnostics:', JSON.stringify({
        source: normalised.source,
        originalTitle: (d.rawTitle || '').substring(0, 80),
        cleanTitle: (d.cleanTitle || '').substring(0, 80),
        normalizedTitle: (d.normalizedTitle || '').substring(0, 80),
        brand: d.brand,
        model: d.model,
        modelNumber: d.modelNumber,
        storageGb: d.storageGb,
        ramGb: d.ramGb,
        capacityMl: d.capacityMl,
        weightG: d.weightG,
        packCount: d.packCount,
        color: d.color,
        size: d.size,
        connectivity: d.connectivity,
        edition: d.edition,
        productForm: d.productForm,
        extractedConfidence: d.extractedConfidence,
        matchStatus: matchResult ? matchResult.matchStatus : null,
        matchConfidence: matchResult ? matchResult.confidence : null,
        rejectedReasons: matchResult ? matchResult.rejectedAttributes : []
    }));
}

module.exports = {
    normalizeProduct,
    classifyCategory,
    matchProducts,
    findSimilarProducts,
    logDiagnostics,
    cleanTitle,
    extractBrand,
    extractStorage,
    extractRam,
    extractCapacityMl,
    extractWeightG,
    extractPackInfo,
    extractColor,
    extractSize,
    extractPhoneEdition,
    extractModel,
    extractModelNumber,
    normaliseModelString
};
