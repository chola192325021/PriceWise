import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../context/AuthContext';
import PasswordField from '../components/PasswordField';
import LoginPage from '../pages/LoginPage';
import SignupPage from '../pages/SignupPage';
import HomePage from '../pages/HomePage';
import Navbar from '../components/Navbar';
import searchStore from '../utils/searchStore';
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn().mockImplementation((url: string) => {
      if (url.includes('/user/profile')) {
        return Promise.resolve({
          data: {
            status: 'success',
            user: {
              id: 'user_123',
              name: 'Updated Name',
              email: 'updated@example.com',
              profilePhoto: 'https://example.com/new-photo.jpg',
              profilePhotoUrl: 'https://example.com/new-photo.jpg',
              photoVersion: '123456789',
              watchlist: [],
              alerts: []
            }
          }
        });
      }
      if (url.includes('/products/search-live')) {
        return Promise.resolve({
          data: {
            status: 'success',
            data: [
              {
                _id: 'prod_1',
                title: 'iPhone 15 Blue',
                brand: 'Apple',
                imageUrl: 'https://example.com/iphone.jpg',
                platforms: [
                  { name: 'Amazon', price: 69999, url: 'https://amazon.in/dp/123', isSmartDeal: true, matchStatus: 'exact_match' }
                ],
                aiPrediction: { trend: 'drop', expectedPrice: 65000, recommendation: 'Wait 3 days', confidence: 90 }
              }
            ]
          }
        });
      }
      return Promise.resolve({
        data: {
          status: 'success',
          data: []
        }
      });
    }),
    post: vi.fn().mockResolvedValue({ data: { status: 'success' } }),
    put: vi.fn().mockResolvedValue({ data: { status: 'success' } })
  }
}));

const mockUser = {
  id: 'user_123',
  name: 'Test User',
  email: 'test@example.com',
  profilePhoto: 'https://example.com/photo.jpg',
  profilePhotoUrl: 'https://example.com/photo.jpg',
  photoVersion: '1000',
  alerts: [],
  watchlist: [],
  memberSince: 'Member since 2024'
};

const renderWithProviders = (ui: React.ReactElement, initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
};

describe('End-to-End Acceptance Tests: Search, Navigation, Profile Photo & Password Toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('pricewise_user', JSON.stringify(mockUser));
    localStorage.setItem('pricewise_token', 'mock_jwt_token');
  });

  describe('PHASE 6: Accessible Password Show/Hide Toggle', () => {
    it('PasswordField renders with password masked by default and toggles visibility via accessible button', () => {
      const handleChange = vi.fn();
      render(
        <PasswordField
          id="test-password"
          name="password"
          value="SuperSecret123!"
          onChange={handleChange}
          placeholder="Enter password"
        />
      );

      const input = screen.getByPlaceholderText('Enter password') as HTMLInputElement;
      expect(input.type).toBe('password');
      expect(input.value).toBe('SuperSecret123!');

      const toggleButton = screen.getByRole('button', { name: /Show password/i });
      expect(toggleButton).toBeDefined();
      expect(toggleButton.getAttribute('type')).toBe('button');
      expect(toggleButton.getAttribute('aria-pressed')).toBe('false');

      // Click to show password
      fireEvent.click(toggleButton);
      expect(input.type).toBe('text');
      expect(toggleButton.getAttribute('aria-label')).toBe('Hide password');
      expect(toggleButton.getAttribute('aria-pressed')).toBe('true');

      // Click to hide password again
      fireEvent.click(toggleButton);
      expect(input.type).toBe('password');
      expect(toggleButton.getAttribute('aria-label')).toBe('Show password');
      expect(toggleButton.getAttribute('aria-pressed')).toBe('false');
    });

    it('LoginPage integrates accessible PasswordField for login password', () => {
      renderWithProviders(<LoginPage />);
      const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
      expect(passwordInput).toBeDefined();
      expect(passwordInput.type).toBe('password');

      const toggleButton = screen.getByRole('button', { name: /Show password/i });
      expect(toggleButton).toBeDefined();
      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');
    });

    it('SignupPage integrates accessible PasswordField for signup password', () => {
      renderWithProviders(<SignupPage />);
      const passwordInput = screen.getByPlaceholderText('Min. 8 characters') as HTMLInputElement;
      expect(passwordInput).toBeDefined();
      expect(passwordInput.type).toBe('password');

      const toggleButton = screen.getByRole('button', { name: /Show password/i });
      expect(toggleButton).toBeDefined();
      fireEvent.click(toggleButton);
      expect(passwordInput.type).toBe('text');
    });
  });

  describe('PHASE 3: Web Search Submit Only (Zero calls on keystroke)', () => {
    it('Typing in Navbar search input triggers zero API calls', async () => {
      renderWithProviders(<Navbar />);
      const searchInput = screen.getByPlaceholderText('Search products...');

      // Type character by character
      fireEvent.change(searchInput, { target: { value: 'i' } });
      fireEvent.change(searchInput, { target: { value: 'iP' } });
      fireEvent.change(searchInput, { target: { value: 'iPh' } });
      fireEvent.change(searchInput, { target: { value: 'iPhone' } });

      // No live search API call should have been triggered while typing
      expect(apiClient.get).not.toHaveBeenCalledWith(expect.stringContaining('/products/search-live'));
    });
  });

  describe('PHASE 4: Web Search Results Preservation on Navigation', () => {
    it('searchStore stores and restores cached results with scroll position', () => {
      const testProducts = [
        {
          _id: 'prod_test',
          title: 'Test Laptop',
          brand: 'Dell',
          imageUrl: 'https://example.com/laptop.jpg',
          platforms: [],
          aiPrediction: { trend: 'stable', expectedPrice: 50000, recommendation: 'Good deal', confidence: 85 }
        }
      ];

      searchStore.setCachedResults('laptop', testProducts as any);
      const cached = searchStore.getCachedResults('laptop');
      expect(cached).toHaveLength(1);
      expect(cached?.[0].title).toBe('Test Laptop');

      searchStore.saveScroll(350);
      expect(searchStore.getSavedScroll()).toBe(350);
    });

    it('HomePage restores cached search results immediately without re-fetching on back navigation', async () => {
      const testQuery = 'iphone';
      searchStore.setCachedResults(testQuery, [
        {
          _id: 'cached_iphone',
          title: 'Cached Apple iPhone 15',
          brand: 'Apple',
          imageUrl: 'https://example.com/iphone.jpg',
          platforms: [
            { name: 'Amazon', price: 69999, url: 'https://amazon.in/dp/123', isSmartDeal: true, matchStatus: 'exact_match' }
          ],
          aiPrediction: { trend: 'drop', expectedPrice: 65000, recommendation: 'Wait', confidence: 92 }
        } as any
      ]);

      await act(async () => {
        renderWithProviders(<HomePage />, [`/?search=${testQuery}`]);
      });

      // Product is displayed from cache
      expect(screen.getByText('Cached Apple iPhone 15')).toBeDefined();
    });
  });

  describe('PHASE 5: Profile Photo Shared Sync', () => {
    it('AuthContext fetchUserProfile calls GET /user/profile and updates user profile data', async () => {
      let authContextValues: any;
      const TestComponent = () => {
        const auth = useAuth();
        authContextValues = auth;
        return <div>User: {auth.user?.name}</div>;
      };

      await act(async () => {
        renderWithProviders(<TestComponent />);
      });

      await act(async () => {
        await authContextValues.fetchUserProfile('user_123');
      });

      expect(apiClient.get).toHaveBeenCalledWith('/user/profile?userId=user_123');
      expect(authContextValues.user.profilePhotoUrl).toBe('https://example.com/new-photo.jpg');
      expect(authContextValues.user.photoVersion).toBe('123456789');
    });
  });
});
