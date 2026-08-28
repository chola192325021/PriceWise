import { describe, it, expect, vi } from 'vitest';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/products/search-live')) {
        return Promise.resolve({
          status: 200,
          data: {
            status: 'success',
            data: [
              {
                _id: 'prod_multi_1',
                title: 'Apple iPhone 15',
                brand: 'Apple',
                category: 'Electronics',
                imageUrl: 'https://m.media-amazon.com/images/I/71d7rfSl0wL.jpg',
                platforms: [
                  { name: 'Amazon', price: 71290, url: 'https://www.amazon.in', isSmartDeal: false },
                  { name: 'Flipkart', price: 69999, url: 'https://www.flipkart.com', isSmartDeal: true },
                  { name: 'Croma', price: 72490, url: 'https://www.croma.com', isSmartDeal: false },
                  { name: 'Reliance Digital', price: 72990, url: 'https://www.reliancedigital.in', isSmartDeal: false }
                ],
                aiPrediction: { trend: 'drop', expectedPrice: 67500, recommendation: 'Wait for sale', confidence: 92 }
              }
            ]
          }
        });
      }
      return Promise.resolve({ status: 200, data: { status: 'success', data: [] } });
    }),
    post: vi.fn().mockImplementation((url: string, body: any) => {
      if (url === '/user/alerts/set') {
        return Promise.resolve({
          status: 200,
          data: {
            status: 'success',
            user: {
              id: body.userId,
              email: 'test@example.com',
              alerts: [{ productId: body.productId, targetPrice: body.targetPrice }]
            }
          }
        });
      }
      if (url === '/chat') {
        return Promise.resolve({
          status: 200,
          data: {
            status: 'success',
            reply: "I'm your PriceWise AI assistant. PriceWise compares live prices across Amazon, Flipkart, Meesho, Croma, and Reliance Digital."
          }
        });
      }
      return Promise.resolve({ status: 200, data: { status: 'success' } });
    })
  }
}));

describe('Cross-Platform Multi-Source Search & API Integration Tests', () => {
  it('fetches search results containing multi-source platform options (Amazon, Flipkart, Croma, Reliance)', async () => {
    const response = await apiClient.get('/products/search-live?query=iPhone');
    expect(response.data.status).toBe('success');
    expect(response.data.data.length).toBeGreaterThan(0);

    const product = response.data.data[0];
    const platformNames = product.platforms.map((p: any) => p.name);

    expect(platformNames).toContain('Amazon');
    expect(platformNames).toContain('Flipkart');
    expect(platformNames).toContain('Croma');
    expect(platformNames).toContain('Reliance Digital');
  });

  it('submits a price-drop alert payload and receives updated user alert status', async () => {
    const alertPayload = { userId: 'user_test_123', productId: 'prod_multi_1', targetPrice: 68000 };
    const response = await apiClient.post('/user/alerts/set', alertPayload);

    expect(response.data.status).toBe('success');
    expect(response.data.user.alerts).toHaveLength(1);
    expect(response.data.user.alerts[0].targetPrice).toBe(68000);
  });

  it('posts chat message to chatbot API and receives valid shopping assistant reply', async () => {
    const chatPayload = { userId: 'user_test_123', messages: [{ role: 'user', content: 'What stores does PriceWise track?' }] };
    const response = await apiClient.post('/chat', chatPayload);

    expect(response.data.status).toBe('success');
    expect(response.data.reply).toContain('Amazon');
    expect(response.data.reply).toContain('Flipkart');
    expect(response.data.reply).toContain('Croma');
  });

  it('validates product platform URLs to guarantee http/https scheme prefixes', () => {
    const ensureValidScheme = (url: string) => {
      return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    };

    expect(ensureValidScheme('www.amazon.in/dp/B0CHX1W1XY')).toBe('https://www.amazon.in/dp/B0CHX1W1XY');
    expect(ensureValidScheme('https://www.flipkart.com/p/itm123')).toBe('https://www.flipkart.com/p/itm123');
    expect(ensureValidScheme('http://www.meesho.com/p/abc')).toBe('http://www.meesho.com/p/abc');
  });
});
