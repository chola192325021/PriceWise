import { describe, it, expect } from 'vitest';

describe('Template Literal Interpolation & URL Construction Tests', () => {
  it('constructs search API URLs with proper URL encoding for special characters, spaces, and ampersands', () => {
    const buildSearchUrl = (query: string) => {
      return query ? `/products/search-live?query=${encodeURIComponent(query)}` : '/products';
    };

    expect(buildSearchUrl('iPhone 15')).toBe('/products/search-live?query=iPhone%2015');
    expect(buildSearchUrl('Nike & Adidas')).toBe('/products/search-live?query=Nike%20%26%20Adidas');
    expect(buildSearchUrl('Headphones/Earbuds')).toBe('/products/search-live?query=Headphones%2FEarbuds');
    expect(buildSearchUrl('Special #1 @ 50%')).toBe('/products/search-live?query=Special%20%231%20%40%2050%25');
    expect(buildSearchUrl('')).toBe('/products');
    
    // Ensure search URL never contains un-evaluated literal expressions
    const url = buildSearchUrl('Sony');
    expect(url).not.toContain('${query}');
    expect(url).not.toContain('%24%7Bquery%7D');
  });

  it('constructs product detail navigation paths with evaluated product IDs', () => {
    const buildProductPath = (product: { _id: string }) => {
      return `/product/${product._id}`;
    };

    const mockProduct = { _id: 'prod_998877' };
    const path = buildProductPath(mockProduct);

    expect(path).toBe('/product/prod_998877');
    expect(path).not.toContain('${product._id}');
    expect(path).not.toContain('${product.id}');
  });

  it('evaluates conditional CSS class expressions cleanly without stringifying condition text', () => {
    const getBadgeClass = (trend: 'drop' | 'stable') => {
      return `flex items-center text-xs font-bold ${
        trend === 'drop' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
      }`;
    };

    const dropClass = getBadgeClass('drop');
    const stableClass = getBadgeClass('stable');

    expect(dropClass).toContain('text-green-600');
    expect(dropClass).not.toContain('${');
    expect(stableClass).toContain('text-amber-600');
    expect(stableClass).not.toContain('${');
  });

  it('formats header welcome messages dynamically without literal string placeholders', () => {
    const formatWelcome = (user?: { name: string }, query?: string) => {
      return query ? `Search results for "${query}"` : `Hello, ${user?.name || 'Shopper'}!`;
    };

    expect(formatWelcome({ name: 'Alex' }, '')).toBe('Hello, Alex!');
    expect(formatWelcome(undefined, '')).toBe('Hello, Shopper!');
    expect(formatWelcome({ name: 'Alex' }, 'Laptop')).toBe('Search results for "Laptop"');
  });
});
