/**
 * PriceWise Product Title Normalizer & Search Query Builder
 * 
 * Central utility to:
 * 1. Clean UI artifacts (e.g. "Add to Compare", "Buy Now", "Sponsored") from scraped product titles.
 * 2. Build concise, attribute-focused search queries for external retailer sources.
 * 3. Preserve raw titles for audit/debugging while exposing cleanTitle for matching/display.
 */

'use strict';

const UI_NOISE_PATTERNS = [
    /\badd\s+to\s+compare\b/gi,
    /\bcompare\b/gi,
    /\badd\s+to\s+(cart|bag|wishlist)\b/gi,
    /\badd\s+to\s+wish\s*list\b/gi,
    /\bbuy\s+now\b/gi,
    /\bview\s+(product|details)\b/gi,
    /\bsponsored\b/gi,
    /\bbest\s*seller\b/gi,
    /\blimited\s+time\s+deal\b/gi,
    /\bdeal\s+of\s+the\s+day\b/gi,
    /\blightning\s+deal\b/gi,
    /\bamazon('s)?\s+choice\b/gi,
    /\bprime\s+deal\b/gi,
    /\bfree\s+delivery\b/gi,
    /\bshop\s+now\b/gi,
    /\bselect\s+options?\b/gi,
    /\bnotify\s+me\b/gi,
    /\bnew\s+launch\b/gi,
    /\bjust\s+launched\b/gi,
    /\bwith\s+offers\b/gi,
    /\bspecial\s+offer\b/gi,
    /\bgreat\s+deal\b/gi,
    /\btop\s+rated\b/gi,
    /\btrending\b/gi,
    /\bhot\s+deal\b/gi,
    /\bflash\s+sale\b/gi,
    /\bclearance\s+sale\b/gi,
    /\bexclusive\b/gi
];

/**
 * Decodes standard HTML entities commonly found in scraped product titles.
 */
function decodeHtmlEntities(text) {
    if (!text) return '';
    return text
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;|&#x27;/gi, "'")
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

/**
 * Cleans a raw product title by removing UI noise, button labels, and marketing junk
 * while strictly preserving:
 * - Brand
 * - Product model & model numbers (e.g. S24, WH-1000XM5)
 * - Storage & RAM (e.g. 256GB, 8GB RAM)
 * - Weight / Capacity (e.g. 650 ml, 2 kg, 1L)
 * - Pack counts & sizes (e.g. Pack of 2, Size 9, UK 8)
 * - Variants (e.g. Amber Yellow, 5G)
 *
 * @param {string} rawTitle - The uncleaned scraped or user-provided title
 * @returns {string} Cleaned product title
 */
function cleanProductTitle(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return '';

    let title = decodeHtmlEntities(rawTitle.trim());

    // Apply UI noise removal
    for (const pattern of UI_NOISE_PATTERNS) {
        title = title.replace(pattern, ' ');
    }

    // Normalise stray separators (e.g., "|", "•", "–", "—") but keep hyphens in model numbers (e.g. WH-1000XM5)
    title = title
        .replace(/[|•·]/g, ' ')
        .replace(/(?<=\s)[–—](?=\s)/g, ' ')
        .replace(/\s*[,;:]\s*/g, ', ')
        .replace(/,\s*,+/g, ',')
        .replace(/\s+/g, ' ')
        .trim();

    // Clean leading/trailing punctuation & separators
    title = title
        .replace(/^[,;:\-\s|/]+/, '')
        .replace(/[,;:\-\s|/]+$/, '')
        .trim();

    // Remove duplicate consecutive words (e.g. "Samsung Samsung Galaxy" -> "Samsung Galaxy")
    const words = title.split(' ');
    const dedupedWords = [];
    for (let i = 0; i < words.length; i++) {
        if (i === 0 || words[i].toLowerCase() !== words[i - 1].toLowerCase()) {
            dedupedWords.push(words[i]);
        }
    }
    title = dedupedWords.join(' ').trim();

    // If cleaning made the title excessively short or empty, fall back safely
    if (title.length < 3) {
        return rawTitle.trim();
    }

    return title;
}

/**
 * Builds a clean, focused search query from verified product attributes or a raw title.
 * Excludes UI noise, price info, retailer names, and promotional tags.
 *
 * @param {string|Object} input - Either a product title string or an attributes object
 * @returns {string} Clean search query suitable for sending to external sources
 */
function buildSearchQuery(input) {
    if (!input) return '';

    if (typeof input === 'object') {
        const parts = [];
        if (input.brand) parts.push(input.brand);
        if (input.model) parts.push(input.model);
        if (input.edition) parts.push(input.edition);
        if (input.connectivity) parts.push(input.connectivity);
        if (input.ramGb) parts.push(`${input.ramGb}GB RAM`);
        if (input.storageGb) parts.push(`${input.storageGb}GB`);
        if (input.capacityMl) parts.push(`${input.capacityMl}ml`);
        if (input.weightG) parts.push(input.weightG >= 1000 ? `${input.weightG / 1000}kg` : `${input.weightG}g`);
        if (input.packCount && input.packCount > 1) parts.push(`Pack of ${input.packCount}`);
        if (input.size) parts.push(`Size ${input.size}`);

        const constructed = parts.join(' ').trim();
        if (constructed.length >= 3) {
            return cleanProductTitle(constructed);
        }
    }

    const rawStr = typeof input === 'string' ? input : (input.title || input.rawTitle || '');
    let clean = cleanProductTitle(rawStr);

    // Strip trailing specification pipes or long descriptions after hyphens/pipes
    clean = clean.replace(/[|–—].*$/, '').trim();

    // Limit length for search stability
    if (clean.length > 80) {
        clean = clean.substring(0, 80).trim();
    }

    return clean;
}

module.exports = {
    cleanProductTitle,
    buildSearchQuery,
    decodeHtmlEntities,
    UI_NOISE_PATTERNS
};
