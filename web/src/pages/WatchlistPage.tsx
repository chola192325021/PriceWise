import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { Product, ProductListResponse } from '../types';
import { Heart, Trash2, ExternalLink, TrendingDown, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

const WatchlistPage: React.FC = () => {
  const { user, removeFromWatchlist, refreshWatchlist } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWatchlist = useCallback(async () => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.get<ProductListResponse>(`/user/watchlist?userId=${user.id}`);
      if (response.data.status === 'success' && response.data.data) {
        setProducts(response.data.data);
      } else {
        setProducts([]);
      }
    } catch (err) {
      console.error(err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await refreshWatchlist();
    await fetchWatchlist();
    setRefreshing(false);
  };

  const removeProduct = async (productId: string) => {
    if (!user) return;
    await removeFromWatchlist(productId);
    setProducts((prev) => prev.filter((p) => p._id !== productId && (p as any).id !== productId));
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-blue-600 dark:text-blue-400">
        <Loader2 className="animate-spin w-10 h-10" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Your Watchlist</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Monitoring live prices for {products.length} products.</p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center space-x-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 px-4 py-2.5 rounded-xl font-bold hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors disabled:opacity-50"
          title="Refresh Prices via Scraper"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Prices'}</span>
        </button>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <Heart className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Watchlist is empty</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 mb-8">Start adding products to track their prices live.</p>
          <Link
            to="/"
            className="bg-blue-600 dark:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product) => {
            const cheapest = product.platforms.find((p) => p.isSmartDeal) || product.platforms[0];
            return (
              <div
                key={product._id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700/70 flex items-center hover:shadow-md transition-all group"
              >
                <Link to={`/product/${product._id}`} className="w-24 h-24 flex-shrink-0 bg-slate-50 dark:bg-slate-900 rounded-xl p-2 mr-6 border border-slate-100 dark:border-slate-700">
                  <img src={product.imageUrl} alt={product.title} className="w-full h-full object-contain" />
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    to={`/product/${product._id}`}
                    className="block font-bold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    {product.title}
                  </Link>
                  <div className="flex items-center mt-1 space-x-4">
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">₹{cheapest?.price.toLocaleString()}</span>
                    <div
                      className={`flex items-center text-xs font-bold ${
                        product.aiPrediction.trend === 'drop' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {product.aiPrediction.trend === 'drop' ? (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      )}
                      {product.aiPrediction.trend === 'drop' ? 'Price Drop Likely' : 'Stable'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <a
                    href={cheapest?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                    title="Visit Store"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                  <button
                    onClick={() => removeProduct(product._id)}
                    className="p-3 bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
