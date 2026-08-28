import { describe, it, expect } from 'vitest';
import { matchFaq, normalizeText, getAllCategories, FAQ_DATA } from '../utils/faqEngine';

describe('Deterministic FAQ Matching Engine Tests', () => {
  it('normalizes query text by converting to lowercase and stripping punctuation', () => {
    expect(normalizeText('  How DO I set a PRICE-DROP alert??? ')).toBe('how do i set a price drop alert');
  });

  it('matches exact FAQ questions with highest score and exact confidence', () => {
    const result = matchFaq('How do I create a price-drop alert?');
    expect(result.matched).toBe(true);
    expect(result.faqId).toBe('price-alerts');
    expect(result.confidence).toBe('exact');
    expect(result.answer).toContain('target price in Rupees');
  });

  it('matches alias phrases accurately', () => {
    const result = matchFaq('how can I get notified when price falls');
    expect(result.matched).toBe(true);
    expect(result.faqId).toBe('price-alerts');
  });

  it('matches keyword queries deterministicly', () => {
    const result = matchFaq('supported Indian stores amazon flipkart');
    expect(result.matched).toBe(true);
    expect(result.faqId).toBe('supported-stores');
  });

  it('returns safe fallback answer when query has no matching FAQ entries', () => {
    const result = matchFaq('xyz quantum physics theory 12345');
    expect(result.matched).toBe(false);
    expect(result.confidence).toBe('none');
    expect(result.answer).toContain('do not have a confirmed answer');
  });

  it('contains expected categories and non-empty questions', () => {
    const categories = getAllCategories();
    expect(categories.length).toBeGreaterThan(3);
    expect(categories).toContain('Price Alerts');
    expect(categories).toContain('Product Search');

    FAQ_DATA.forEach((faq) => {
      expect(faq.id).toBeTruthy();
      expect(faq.question).toBeTruthy();
      expect(faq.answer).toBeTruthy();
      expect(faq.keywords.length).toBeGreaterThan(0);
    });
  });
});
