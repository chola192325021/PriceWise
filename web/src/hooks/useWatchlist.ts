import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { Product, ProductListResponse } from '../types';
import { useRealtime } from './useRealtime';

export const useWatchlist = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWatchlist = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await apiClient.get<ProductListResponse>('/products');
      if (response.data.status === 'success') {
        const watchlistItems = response.data.data.filter(p => user.watchlist?.includes(p._id));
        setProducts(watchlistItems);
      }
    } catch (err) {
      setError('Failed to fetch watchlist');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Subscribe to changes in the users table for the current user to sync watchlist changes
  useRealtime(
    'users',
    (payload) => {
      if (payload.new && payload.new.id === user?.id) {
         fetchWatchlist();
      }
    },
    user ? `id=eq.${user.id}` : undefined
  );

  const addToWatchlist = async (productId: string) => {
    if (!user) return;
    try {
      await apiClient.post('/user/watchlist/add', { userId: user.id, productId });
      // The realtime subscription will trigger the refetch
    } catch (err) {
      setError('Failed to add to watchlist');
    }
  };

  const removeFromWatchlist = async (productId: string) => {
    if (!user) return;
    try {
      await apiClient.post('/user/watchlist/remove', { userId: user.id, productId });
      // The realtime subscription will trigger the refetch
    } catch (err) {
      setError('Failed to remove from watchlist');
    }
  };

  return { products, loading, error, addToWatchlist, removeFromWatchlist, refresh: fetchWatchlist };
};
