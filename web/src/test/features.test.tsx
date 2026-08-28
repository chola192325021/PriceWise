import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import ChatbotPage from '../pages/ChatbotPage';
import AlertsPage from '../pages/AlertsPage';
import HomePage from '../pages/HomePage';
import ProfilePage from '../pages/ProfilePage';
import ProductDetailPage from '../pages/ProductDetailPage';
import LoginPage from '../pages/LoginPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios client to prevent actual network calls during unit tests
vi.mock('../api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ status: 200, data: { status: 'success', data: [] } }),
    post: vi.fn().mockResolvedValue({ status: 200, data: { status: 'success', message: 'Verification code sent to your email.' } }),
    put: vi.fn().mockResolvedValue({ status: 200, data: { status: 'success' } }),
  },
}));

const mockUser = {
  id: 'user_123',
  name: 'Test User',
  email: 'test@example.com',
  alerts: [],
  watchlist: [],
  memberSince: 'Member since 2024'
};

const renderWithMemoryRouter = (ui: React.ReactElement, initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
};

describe('PriceWise Web Feature & Theme Accessibility Tests', () => {
  beforeEach(() => {
    localStorage.setItem('pricewise_user', JSON.stringify(mockUser));
    localStorage.setItem('pricewise_token', 'mock_jwt_token');
  });

  it('renders FAQ Chatbot assistant with initial welcoming message', async () => {
    renderWithMemoryRouter(<ChatbotPage />);
    expect(screen.getByRole('heading', { name: /PriceWise Help Center & FAQ/i })).toBeDefined();
    expect(
      screen.getByText(/Welcome to the PriceWise Help Center & FAQ Assistant/i)
    ).toBeDefined();
    expect(screen.getByPlaceholderText(/Type your question/i)).toBeDefined();
  });

  it('renders Price Alerts dashboard page with empty or alert items', async () => {
    await act(async () => {
      renderWithMemoryRouter(<AlertsPage />);
    });
    expect(screen.getByRole('heading', { level: 1, name: /^Price Alerts$/i })).toBeDefined();
  });

  it('renders HomePage with Wise Market Analysis banner and category filter pills', async () => {
    await act(async () => {
      renderWithMemoryRouter(<HomePage />);
    });
    expect(screen.getByText(/Wise Market Analysis/i)).toBeDefined();
    expect(screen.getByText(/Track New Product/i)).toBeDefined();
  });

  it('renders ProfilePage with user details, linked accounts, and app settings', async () => {
    await act(async () => {
      renderWithMemoryRouter(<ProfilePage />);
    });
    expect(await screen.findByText(/Your Profile/i)).toBeDefined();
    expect(screen.getByText(/Linked Accounts/i)).toBeDefined();
    expect(screen.getByText(/Display Theme/i)).toBeDefined();
  });

  it('renders minimal branding header on public /login route without authenticated search/features', () => {
    localStorage.removeItem('pricewise_user');
    renderWithMemoryRouter(<Navbar />, ['/login']);
    expect(screen.getByText('PriceWise')).toBeDefined();
    expect(screen.queryByPlaceholderText('Search products...')).toBeNull();
    expect(screen.queryByText('AI Assistant')).toBeNull();
  });

  it('renders LoginPage with Forgot Password trigger', () => {
    renderWithMemoryRouter(<LoginPage />, ['/login']);
    expect(screen.getByText(/Welcome Back/i)).toBeDefined();
    expect(screen.getByText(/Forgot Password\?/i)).toBeDefined();
  });

  it('renders ProductDetailPage loading and handles non-existent product gracefully', async () => {
    renderWithMemoryRouter(<ProductDetailPage />, ['/product/test_prod_123']);
    expect(screen.getByText(/Loading product details\.\.\.|Product Not Found/i)).toBeDefined();
  });

  it('renders clean title and separate Similar Products section on ProductDetailPage', async () => {
    const mockDetailProduct = {
      _id: 'prod_clean_1',
      title: 'Add to Compare Samsung Galaxy S24 256GB',
      cleanTitle: 'Samsung Galaxy S24 256GB',
      brand: 'Samsung',
      category: 'Smartphones',
      imageUrl: 'https://example.com/s24.jpg',
      platforms: [
        {
          name: 'Amazon',
          price: 74999,
          url: 'https://amazon.in/s24',
          isSmartDeal: true,
          matchStatus: 'exact_match',
          comparisonEligible: true
        },
        {
          name: 'Flipkart',
          price: 75999,
          url: 'https://flipkart.com/s24',
          isSmartDeal: false,
          matchStatus: 'exact_match',
          comparisonEligible: true
        }
      ],
      similarProducts: [
        {
          source: 'Croma',
          title: 'Samsung Galaxy S24 128GB Onyx Black',
          price: 69999,
          url: 'https://croma.com/s24-128',
          matchType: 'similar',
          similarityTier: 'close_variant',
          confidence: 0.85,
          differences: ['Storage differs: 128GB instead of 256GB'],
          comparisonEligible: false
        }
      ],
      aiPrediction: {
        status: 'drop',
        trend: 'drop',
        expectedPrice: 72000,
        currentBestPrice: 74999,
        bestPlatform: 'Amazon',
        observedLowPrice: 74000,
        historyDays: 30,
        recommendation: 'WAIT',
        confidence: 0.9,
        confidenceLabel: 'High',
        message: 'Price expected to drop',
        reason: 'Past sales pattern'
      }
    };

    const apiClient = (await import('../api/client')).default;
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url.includes('/products/prod_clean_1') || url === '/products') {
        return {
          status: 200,
          data: { status: 'success', data: mockDetailProduct }
        } as any;
      }
      return { status: 200, data: { status: 'success', data: [] } } as any;
    });

    await act(async () => {
      renderWithMemoryRouter(
        <Routes>
          <Route path="/product/:id" element={<ProductDetailPage />} />
        </Routes>,
        ['/product/prod_clean_1']
      );
    });

    // Should display clean title without "Add to Compare"
    expect(await screen.findByRole('heading', { level: 1, name: 'Samsung Galaxy S24 256GB' })).toBeDefined();
    expect(screen.queryByText(/Add to Compare Samsung/i)).toBeNull();

    // Should show Store Comparisons section header with exact count
    expect(screen.getByText(/Store Comparisons \(2\)/i)).toBeDefined();

    // Should show Exact Match badge
    expect(screen.getAllByText(/Exact match/i).length).toBeGreaterThan(0);

    // Should show Similar Products section with difference note
    expect(screen.getByText(/Similar Products \(1\)/i)).toBeDefined();
    expect(screen.getByText(/Storage differs: 128GB instead of 256GB/i)).toBeDefined();
    expect(screen.getByText(/Similar Variant/i)).toBeDefined();
  });

  it('renders all 4 platform match status badge types correctly on ProductDetailPage', async () => {
    const mockMultiStatusProduct = {
      _id: 'prod_multi_1',
      title: 'Dove Intense Repair Shampoo 650ml',
      cleanTitle: 'Dove Intense Repair Shampoo 650ml',
      brand: 'Dove',
      category: 'Beauty',
      imageUrl: 'https://example.com/dove.jpg',
      bestExactPrice: { source: 'Amazon', price: 349 },
      platforms: [
        {
          name: 'Amazon',
          price: 349,
          url: 'https://amazon.in/dove650',
          isSmartDeal: true,
          status: 'exact_match',
          matchStatus: 'exact_match',
          comparisonEligible: true,
          differences: [],
          reason: 'Same brand, model, and required specifications.'
        },
        {
          name: 'Flipkart',
          price: 199,
          url: 'https://flipkart.com/dove340',
          isSmartDeal: false,
          status: 'unit_price_only',
          matchStatus: 'unit_price_only',
          comparisonEligible: false,
          pricePerUnit: { value: 58.53, unit: '100ml' },
          differences: ['Quantity differs: 340 ml instead of 650 ml'],
          reason: 'Different quantity — price per 100ml shown.'
        },
        {
          name: 'Croma',
          price: 399,
          url: 'https://croma.com/dove-cond',
          isSmartDeal: false,
          status: 'variant_match',
          matchStatus: 'variant_match',
          comparisonEligible: false,
          differences: ['Product form differs: Conditioner instead of Shampoo'],
          reason: 'Similar variant — Product form differs: Conditioner instead of Shampoo'
        },
        {
          name: 'Meesho',
          price: 0,
          url: 'https://meesho.com/search?q=dove',
          isSmartDeal: false,
          status: 'no_match',
          matchStatus: 'no_match',
          comparisonEligible: false,
          differences: [],
          reason: 'No exact match on Meesho.'
        }
      ],
      similarProducts: [],
      aiPrediction: {
        status: 'drop',
        trend: 'drop',
        expectedPrice: 320,
        currentBestPrice: 349,
        bestPlatform: 'Amazon',
        observedLowPrice: 320,
        historyDays: 14,
        recommendation: 'BUY_NOW',
        confidence: 0.85,
        confidenceLabel: 'High',
        message: 'Great price today',
        reason: 'Historical low'
      }
    };

    const apiClient = (await import('../api/client')).default;
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url.includes('/products/prod_multi_1') || url === '/products') {
        return {
          status: 200,
          data: { status: 'success', data: mockMultiStatusProduct }
        } as any;
      }
      return { status: 200, data: { status: 'success', data: [] } } as any;
    });

    await act(async () => {
      renderWithMemoryRouter(
        <Routes>
          <Route path="/product/:id" element={<ProductDetailPage />} />
        </Routes>,
        ['/product/prod_multi_1']
      );
    });

    // 🟢 Exact match badge
    expect(screen.getByText(/🟢 Exact match/i)).toBeDefined();

    // 🟠 Different quantity badge & unit price
    expect(screen.getByText(/🟠 Different quantity/i)).toBeDefined();
    expect(screen.getByText(/Unit price: ₹58.53 per 100ml/i)).toBeDefined();

    // 🟡 Similar variant badge & difference
    expect(screen.getByText(/🟡 Similar variant/i)).toBeDefined();
    expect(screen.getByText(/Product form differs: Conditioner instead of Shampoo/i)).toBeDefined();

    // 🔴 No match on Meesho
    expect(screen.getByText(/🔴 No exact match on Meesho/i)).toBeDefined();
    expect(screen.getByText(/No exact match on Meesho\./i)).toBeDefined();
  });
});
