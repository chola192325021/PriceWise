import React, { createContext, useState, useEffect } from 'react';
import apiClient from '../api/client';
import { User, LoginResponse } from '../types';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  login: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  sendPasswordResetCode: (email: string) => Promise<{ success: boolean; message: string }>;
  resendPasswordResetCode: (email: string) => Promise<{ success: boolean; message: string; remainingSeconds?: number }>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  updateProfile: (name: string, email: string, profilePhoto: string) => Promise<void>;
  fetchUserProfile: (userId?: string) => Promise<void>;
  addToWatchlist: (productId: string) => Promise<void>;
  removeFromWatchlist: (productId: string) => Promise<void>;
  setPriceAlert: (productId: string, targetPrice: number) => Promise<void>;
  removePriceAlert: (productId: string) => Promise<void>;
  refreshWatchlist: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('pricewise_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('pricewise_token') || (localStorage.getItem('pricewise_user') ? 'mock_jwt_token' : null);
  });
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem('pricewise_theme') as ThemeMode) || 'system';
  });

  const applyTheme = (mode: ThemeMode) => {
    const isDark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem('pricewise_theme', mode);
    applyTheme(mode);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const savedToken = localStorage.getItem('pricewise_token');
    const savedUser = localStorage.getItem('pricewise_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        setUser(null);
      }
    } else {
      setToken(null);
      setUser(null);
    }
    setLoading(false);
  }, []);

  const saveUserData = (userObj: User, userToken?: string) => {
    setUser(userObj);
    localStorage.setItem('pricewise_user', JSON.stringify(userObj));
    if (userToken) {
      setToken(userToken);
      localStorage.setItem('pricewise_token', userToken);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>('/login', { email, password });
      if (response.data.status === 'success' && response.data.user) {
        const tokenVal = response.data.token || 'mock_jwt_token';
        saveUserData(response.data.user, tokenVal);
      } else {
        throw new Error(response.data.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>('/signup', { name, email, password });
      if (response.data.status === 'success' && response.data.user) {
        const tokenVal = response.data.token || 'mock_jwt_token';
        saveUserData(response.data.user, tokenVal);
      } else {
        throw new Error(response.data.message || 'Failed to create account.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('pricewise_token');
    localStorage.removeItem('pricewise_user');
  };

  const sendPasswordResetCode = async (email: string) => {
    try {
      const response = await apiClient.post('/forgot-password', { email });
      if (response.data.status === 'success') {
        return { success: true, message: response.data.message || 'Verification code sent to email' };
      }
      return { success: false, message: response.data.message || 'Failed to send code' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || err.message || 'Connection error' };
    }
  };

  const resendPasswordResetCode = async (email: string) => {
    try {
      const response = await apiClient.post('/resend-forgot-password', { email });
      if (response.data.status === 'success') {
        return { success: true, message: response.data.message || 'Verification code resent' };
      }
      return { success: false, message: response.data.message || 'Failed to resend code' };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to resend code';
      const remainingSeconds = err.response?.data?.remainingSeconds;
      return { success: false, message: msg, remainingSeconds };
    }
  };

  const resetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      const response = await apiClient.post('/reset-password', { email, code, newPassword });
      if (response.data.status === 'success') {
        return { success: true, message: 'Password updated successfully' };
      }
      return { success: false, message: response.data.message || 'Failed to reset password' };
    } catch (err: any) {
      return { success: false, message: err.response?.data?.message || err.message || 'Connection error' };
    }
  };

  const updateProfile = async (name: string, email: string, profilePhoto: string) => {
    if (!user) return;
    try {
      const response = await apiClient.put<LoginResponse>('/user/update', {
        id: user.id,
        name,
        email,
        profilePhoto
      });
      if (response.data?.user) {
        saveUserData(response.data.user);
      } else {
        const updatedUser = { ...user, name, email, profilePhoto };
        saveUserData(updatedUser);
      }
    } catch (err) {
      const updatedUser = { ...user, name, email, profilePhoto };
      saveUserData(updatedUser);
    }
  };

  const fetchUserProfile = async (userId?: string) => {
    const targetId = userId || user?.id;
    if (!targetId) return;
    try {
      const response = await apiClient.get<LoginResponse>(`/user/profile?userId=${targetId}`);
      if (response.data?.status === 'success' && response.data?.user) {
        saveUserData(response.data.user);
      }
    } catch (e) {
      console.error('Fetch profile error:', e);
    }
  };

  const addToWatchlist = async (productId: string) => {
    if (!user) return;
    try {
      const response = await apiClient.post<LoginResponse>('/user/watchlist/add', { userId: user.id, productId });
      if (response.data?.user) {
        saveUserData(response.data.user);
      } else {
        const currentList = user.watchlist || [];
        if (!currentList.includes(productId)) {
          saveUserData({ ...user, watchlist: [...currentList, productId] });
        }
      }
    } catch (err) {
      const currentList = user.watchlist || [];
      if (!currentList.includes(productId)) {
        saveUserData({ ...user, watchlist: [...currentList, productId] });
      }
    }
  };

  const removeFromWatchlist = async (productId: string) => {
    if (!user) return;
    try {
      const response = await apiClient.post<LoginResponse>('/user/watchlist/remove', { userId: user.id, productId });
      if (response.data?.user) {
        saveUserData(response.data.user);
      } else {
        saveUserData({ ...user, watchlist: (user.watchlist || []).filter(id => id !== productId) });
      }
    } catch (err) {
      saveUserData({ ...user, watchlist: (user.watchlist || []).filter(id => id !== productId) });
    }
  };

  const setPriceAlert = async (productId: string, targetPrice: number) => {
    if (!user) return;
    try {
      const response = await apiClient.post<LoginResponse>('/user/alerts/set', {
        userId: user.id,
        productId,
        targetPrice
      });
      if (response.data?.user) {
        saveUserData(response.data.user);
      } else {
        const currentAlerts = (user.alerts || []).filter(a => a.productId !== productId);
        saveUserData({ ...user, alerts: [...currentAlerts, { productId, targetPrice }] });
      }
    } catch (err) {
      const currentAlerts = (user.alerts || []).filter(a => a.productId !== productId);
      saveUserData({ ...user, alerts: [...currentAlerts, { productId, targetPrice }] });
    }
  };

  const removePriceAlert = async (productId: string) => {
    if (!user) return;
    try {
      const response = await apiClient.post<LoginResponse>('/user/alerts/remove', { userId: user.id, productId });
      if (response.data?.user) {
        saveUserData(response.data.user);
      } else {
        saveUserData({ ...user, alerts: (user.alerts || []).filter(a => a.productId !== productId) });
      }
    } catch (err) {
      saveUserData({ ...user, alerts: (user.alerts || []).filter(a => a.productId !== productId) });
    }
  };

  const refreshWatchlist = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const response = await apiClient.post('/products/watchlist/refresh', { userId: user.id });
      return response.data?.status === 'success' || true;
    } catch (err) {
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        theme,
        setTheme,
        login,
        signUp,
        logout,
        sendPasswordResetCode,
        resendPasswordResetCode,
        resetPassword,
        updateProfile,
        fetchUserProfile,
        addToWatchlist,
        removeFromWatchlist,
        setPriceAlert,
        removePriceAlert,
        refreshWatchlist
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from '../hooks/useAuth';

