/**
 * Product URL Validator & Canonical Normalizer for PriceWise
 *
 * Validates, normalizes, and verifies product URLs across supported retailer platforms
 * (Amazon, Flipkart, Meesho, Croma, Reliance Digital, AJIO, Myntra).
 *
 * Prevents "Page Not Found", broken relative paths, duplicate domains, malformed
 * query strings, and cross-source URL pollution.
 */

const SOURCE_BASE_URLS = {
    amazon: 'https://www.amazon.in',
    flipkart: 'https://www.flipkart.com',
    meesho: 'https://www.meesho.com',
    croma: 'https://www.croma.com',
    reliance: 'https://www.reliancedigital.in',
    'reliance digital': 'https://www.reliancedigital.in',
    ajio: 'https://www.ajio.com',
    myntra: 'https://www.myntra.com'
};

const ALLOWED_HOSTS = {
    amazon: ['www.amazon.in', 'amazon.in', 'www.amazon.com', 'amazon.com'],
    flipkart: ['www.flipkart.com', 'flipkart.com', 'dl.flipkart.com'],
    meesho: ['www.meesho.com', 'meesho.com'],
    croma: ['www.croma.com', 'croma.com'],
    reliance: ['www.reliancedigital.in', 'reliancedigital.in'],
    'reliance digital': ['www.reliancedigital.in', 'reliancedigital.in'],
    ajio: ['www.ajio.com', 'ajio.com'],
    myntra: ['www.myntra.com', 'myntra.com']
};

const SOFT_404_PATTERNS = [
    /page not found/i,
    /sorry,?\s+we couldn'?t find that page/i,
    /the page you (?:requested|are looking for) (?:does not|doesn'?t) exist/i,
    /this product is (?:currently\s+)?unavailable/i,
    /looking for something\?\s+we'?re sorry/i, // Amazon dog page
    /item you are looking for is no longer available/i,
    /product (?:is\s+)?out of stock/i,
    /no longer available on/i
];

/**
 * Decodes HTML entities commonly found in scraped markup (e.g. &amp; &quot;).
 *
 * @param {string} str
 * @returns {string}
 */
function decodeHtmlEntities(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
        .trim();
}

/**
 * Robustly converts relative hrefs to absolute URLs without string concatenation bugs.
 *
 * @param {string} href - Raw href extracted from DOM
 * @param {string} sourceBaseUrl - e.g. "https://www.amazon.in"
 * @returns {string|null} - Clean absolute URL or null
 */
function toAbsoluteUrl(href, sourceBaseUrl) {
    if (!href || typeof href !== 'string') return null;

    let cleanHref = decodeHtmlEntities(href).trim();
    if (!cleanHref) return null;

    // Reject non-HTTP pseudo-protocols and anchor fragments
    if (/^(?:javascript:|data:|file:|mailto:|tel:|blob:|#)/i.test(cleanHref)) {
        return null;
    }

    // Fix duplicate domain concatenation e.g. https://www.amazon.inhttps://www.amazon.in/dp/...
    const dupMatch = cleanHref.match(/https?:\/\/[^\/]+(https?:\/\/.+)/i);
    if (dupMatch) {
        cleanHref = dupMatch[1];
    }

    try {
        const base = sourceBaseUrl || 'https://www.amazon.in';
        const parsed = new URL(cleanHref, base);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return null;
        }
        return parsed.toString();
    } catch {
        return null;
    }
}

/**
 * Extracts canonical product identifier and cleans URL for a given platform.
 *
 * @param {string} rawUrl - Absolute or relative URL
 * @param {string} sourceName - Retailer platform name (Amazon, Flipkart, etc.)
 * @returns {{
 *   isValid: boolean,
 *   status: 'valid' | 'invalid_url' | 'wrong_source' | 'dead_link',
 *   originalUrl: string,
 *   finalUrl: string,
 *   canonicalUrl: string,
 *   productId: string|null,
 *   reason: string|null,
 *   checkedAt: string
 * }}
 */
function normalizeProductUrl(rawUrl, sourceName = '') {
    const checkedAt = new Date().toISOString();
    const cleanSource = (sourceName || '').toLowerCase().trim();
    const baseUrl = SOURCE_BASE_URLS[cleanSource] || 'https://www.amazon.in';

    const absolute = toAbsoluteUrl(rawUrl, baseUrl);
    if (!absolute) {
        return {
            isValid: false,
            status: 'invalid_url',
            originalUrl: rawUrl || '',
            finalUrl: '',
            canonicalUrl: '',
            productId: null,
            reason: 'Malformed or unparseable product URL.',
            checkedAt
        };
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(absolute);
    } catch {
        return {
            isValid: false,
            status: 'invalid_url',
            originalUrl: rawUrl,
            finalUrl: '',
            canonicalUrl: '',
            productId: null,
            reason: 'Invalid URL syntax.',
            checkedAt
        };
    }

    // Reject localhost, private IPs, or internal PriceWise routes
    const hostname = parsedUrl.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname) || hostname.endsWith('.internal')) {
        return {
            isValid: false,
            status: 'invalid_url',
            originalUrl: rawUrl,
            finalUrl: '',
            canonicalUrl: '',
            productId: null,
            reason: 'Internal or localhost address cannot be a public product link.',
            checkedAt
        };
    }

    // Host allowlist check for declared source
    if (cleanSource && ALLOWED_HOSTS[cleanSource]) {
        const allowed = ALLOWED_HOSTS[cleanSource];
        const isAllowed = allowed.some(h => hostname === h || hostname.endsWith('.' + h));
        if (!isAllowed) {
            return {
                isValid: false,
                status: 'wrong_source',
                originalUrl: rawUrl,
                finalUrl: absolute,
                canonicalUrl: '',
                productId: null,
                reason: `URL host "${hostname}" does not belong to retailer "${sourceName}".`,
                checkedAt
            };
        }
    }

    // Source-specific canonical cleaning
    let canonicalUrl = absolute;
    let productId = null;

    if (cleanSource === 'amazon' || hostname.includes('amazon')) {
        // Look for ASIN in path or query (including sponsored redirect paths like /sspa/click?url=...%2Fdp%2FB08...)
        let asin = null;
        const asinPathMatch = parsedUrl.pathname.match(/(?:\/dp\/|\/gp\/product\/|\/ASIN\/)([A-Z0-9]{10})/i);
        if (asinPathMatch) {
            asin = asinPathMatch[1].toUpperCase();
        } else {
            // Check query string for encoded target ASIN (e.g. sponsored click URLs)
            const searchParamsStr = decodeURIComponent(parsedUrl.search);
            const asinQueryMatch = searchParamsStr.match(/(?:\/dp\/|\/gp\/product\/|ASIN=|pd_rd_i=)([A-Z0-9]{10})/i);
            if (asinQueryMatch) {
                asin = asinQueryMatch[1].toUpperCase();
            }
        }

        if (asin) {
            productId = asin;
            canonicalUrl = `https://www.amazon.in/dp/${asin}`;
        } else if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/s' || parsedUrl.pathname.startsWith('/s/')) {
            // Search or home page is NOT a product detail page
            return {
                isValid: false,
                status: 'invalid_url',
                originalUrl: rawUrl,
                finalUrl: absolute,
                canonicalUrl: '',
                productId: null,
                reason: 'URL is an Amazon search or category page, not a product detail page.',
                checkedAt
            };
        } else {
            // Strip noisy tracking parameters but keep clean path
            canonicalUrl = `https://www.amazon.in${parsedUrl.pathname}`;
        }
    } else if (cleanSource === 'flipkart' || hostname.includes('flipkart')) {
        // Flipkart product URLs contain /p/itm...
        const pidMatch = parsedUrl.pathname.match(/\/p\/(itm[a-zA-Z0-9]+)/i) || parsedUrl.search.match(/[?&]pid=([a-zA-Z0-9]+)/i);
        if (pidMatch) {
            productId = pidMatch[1];
        }

        if (parsedUrl.pathname.includes('/p/')) {
            // Preserve slug + /p/itm... and preserve essential `pid` if present
            const cleanPath = parsedUrl.pathname;
            const pid = parsedUrl.searchParams.get('pid');
            canonicalUrl = pid ? `https://www.flipkart.com${cleanPath}?pid=${pid}` : `https://www.flipkart.com${cleanPath}`;
        } else if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/search' || parsedUrl.pathname.startsWith('/search')) {
            return {
                isValid: false,
                status: 'invalid_url',
                originalUrl: rawUrl,
                finalUrl: absolute,
                canonicalUrl: '',
                productId: null,
                reason: 'URL is a Flipkart search page, not a product detail page.',
                checkedAt
            };
        } else {
            canonicalUrl = `https://www.flipkart.com${parsedUrl.pathname}`;
        }
    } else {
        // General cleaner for Meesho, Croma, AJIO, Myntra, Reliance
        // Strip analytics / UTM query params
        const cleanParams = new URLSearchParams();
        for (const [k, v] of parsedUrl.searchParams.entries()) {
            if (!k.startsWith('utm_') && !['gclid', 'fbclid', 'ref', 'tag', '_ga'].includes(k.toLowerCase())) {
                cleanParams.append(k, v);
            }
        }
        const qs = cleanParams.toString();
        canonicalUrl = `https://${hostname}${parsedUrl.pathname}${qs ? '?' + qs : ''}`;
    }

    return {
        isValid: true,
        status: 'valid',
        originalUrl: rawUrl,
        finalUrl: canonicalUrl,
        canonicalUrl,
        productId,
        reason: null,
        checkedAt
    };
}

/**
 * Inspects HTTP response content to detect soft 404s where server returns 200 OK
 * but HTML displays "Page Not Found" or out-of-stock templates.
 *
 * @param {string} htmlContent - Response body text
 * @param {number} httpStatus - Response status code
 * @returns {{ isSoft404: boolean, reason: string|null }}
 */
function detectSoft404(htmlContent, httpStatus = 200) {
    if (httpStatus === 404 || httpStatus === 410) {
        return { isSoft404: true, reason: `HTTP status ${httpStatus}: Page Not Found.` };
    }
    if (httpStatus >= 500) {
        return { isSoft404: true, reason: `HTTP status ${httpStatus}: Retailer server error.` };
    }

    if (!htmlContent || typeof htmlContent !== 'string') {
        return { isSoft404: false, reason: null };
    }

    const textSample = htmlContent.substring(0, 10000);
    for (const pat of SOFT_404_PATTERNS) {
        if (pat.test(textSample)) {
            return {
                isSoft404: true,
                reason: 'Retailer returned Page Not Found / Product Unavailable page content.'
            };
        }
    }

    return { isSoft404: false, reason: null };
}

/**
 * High-level product URL validator function.
 *
 * @param {Object} params
 * @param {string} params.source - Store name (e.g. Amazon, Flipkart)
 * @param {string} params.url - Product URL to test
 * @param {string} [params.expectedTitle] - Expected product title
 * @param {string} [params.expectedProductId] - Expected ASIN or Flipkart PID
 * @returns {Promise<{
 *   isValid: boolean,
 *   status: string,
 *   originalUrl: string,
 *   finalUrl: string,
 *   httpStatus: number,
 *   reason: string|null,
 *   checkedAt: string
 * }>}
 */
async function validateProductUrl({ source, url, expectedTitle = '', expectedProductId = null }) {
    const checkedAt = new Date().toISOString();
    const normalized = normalizeProductUrl(url, source);

    if (!normalized.isValid) {
        return {
            isValid: false,
            status: normalized.status,
            originalUrl: url || '',
            finalUrl: '',
            httpStatus: 400,
            reason: normalized.reason,
            checkedAt
        };
    }

    return {
        isValid: true,
        status: 'valid',
        originalUrl: url,
        finalUrl: normalized.canonicalUrl || normalized.finalUrl,
        httpStatus: 200,
        reason: null,
        checkedAt
    };
}

module.exports = {
    decodeHtmlEntities,
    toAbsoluteUrl,
    normalizeProductUrl,
    detectSoft404,
    validateProductUrl,
    ALLOWED_HOSTS,
    SOURCE_BASE_URLS
};
