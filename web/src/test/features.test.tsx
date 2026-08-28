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

    // Should show Exact Matches section header
    expect(screen.getByText(/Exact Matches \(2\)/i)).toBeDefined();

    // Should show Similar Products section with difference note
    expect(screen.getByText(/Similar Products \(1\)/i)).toBeDefined();
    expect(screen.getByText(/Storage differs: 128GB instead of 256GB/i)).toBeDefined();
    expect(screen.getByText(/Similar Variant/i)).toBeDefined();
  });
});
