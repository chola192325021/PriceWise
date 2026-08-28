import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { Product, UserAlertsResponse } from '../types';
import { Bell, Trash2, ArrowRight, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AlertProductPair {
  product: Product;
  targetPrice: number;
}

const AlertsPage: React.FC = () => {
  const { user, removePriceAlert } = useAuth();
  const [alertPairs, setAlertPairs] = useState<AlertProductPair[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertProducts = async () => {
      if (!user) {
        setAlertPairs([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await apiClient.get<UserAlertsResponse>(`/user/alerts?userId=${user.id}`);
        if (response.data.status === 'success' && response.data.data) {
          setAlertPairs(response.data.data);
        } else {
          setAlertPairs([]);
        }
      } catch (err) {
        console.error('Error fetching alert products:', err);
        setAlertPairs([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertProducts();
  }, [user]);

  const handleRemove = async (productId: string) => {
    await removePriceAlert(productId);
    setAlertPairs((prev) => prev.filter((item) => item.product._id !== productId && (item.product as any).id !== productId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Price Alerts</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Get notified automatically when product prices hit your target.</p>
      </div>

      {alertPairs.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
            <Bell className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">No price alerts set</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 mb-8">
            Set price target alerts on any product detail page to monitor prices.
          </p>
          <Link
            to="/"
            className="inline-flex items-center bg-blue-600 dark:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Browse Products <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {alertPairs.map(({ product, targetPrice }) => {
            const cheapestPlatform = product.platforms.find((p) => p.isSmartDeal) || product.platforms[0];
            const isTargetMet = cheapestPlatform && cheapestPlatform.price <= targetPrice;

            return (
              <div
                key={product._id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:shadow-md transition-all"
              >
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  <Link
                    to={`/product/${product._id}`}
                    className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-xl p-2 flex-shrink-0 flex items-center justify-center border border-slate-100 dark:border-slate-700"
                  >
                    <img src={product.imageUrl} alt={product.title} className="max-h-full max-w-full object-contain" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">{product.brand}</span>
                    <Link
                      to={`/product/${product._id}`}
                      className="block font-bold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {product.title}
                    </Link>

                    <div className="flex items-center space-x-3 mt-2">
                      <span className="text-sm text-slate-500 dark:text-slate-400">Current:</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">₹{cheapestPlatform?.price.toLocaleString()}</span>

                      <span className="text-slate-300 dark:text-slate-700">|</span>

                      <span className="text-sm text-slate-500 dark:text-slate-400">Target:</span>
                      <span className="font-black text-green-600 dark:text-green-400">₹{targetPrice.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 dark:border-slate-700">
                  {isTargetMet ? (
                    <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center border border-green-200 dark:border-green-900/60">
                      <TrendingDown className="w-3.5 h-3.5 mr-1" /> Target Reached!
                    </span>
                  ) : (
                    <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center border border-blue-200 dark:border-blue-900/60">
                      <TrendingUp className="w-3.5 h-3.5 mr-1" /> Monitoring
                    </span>
                  )}

                  <button
                    onClick={() => handleRemove(product._id)}
                    className="p-3 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors"
                    title="Remove Alert"
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

export default AlertsPage;
