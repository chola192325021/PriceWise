import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import { UserAlertItem, UserAlertsResponse, Product } from '../types';
import { Bell, Trash2, ArrowRight, Loader2, TrendingDown, TrendingUp, CheckCircle, AlertTriangle, PauseCircle, PlayCircle, Clock, Edit2, Check, X, Sparkles, TestTube2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const DEFAULT_DEMO_PRODUCT: Product = {
  _id: 'mock-pricewise-alert-demo-v1',
  title: 'PriceWise Demo Wireless Headphones',
  brand: 'PriceWise Demo',
  category: 'Demo & Testing',
  imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
  platforms: [
    {
      name: 'PriceWise Demo Store',
      price: 1999,
      url: '',
      isSmartDeal: true,
      comparisonEligible: false,
      isMock: true
    }
  ],
  isMock: true,
  is_mock: true,
  mockType: 'target_price_alert_demo',
  aiPrediction: {
    status: 'success',
    trend: 'drop',
    expectedPrice: 1499,
    currentBestPrice: 1999,
    bestPlatform: 'PriceWise Demo Store',
    observedLowPrice: 1999,
    historyDays: 7,
    recommendation: 'WAIT',
    confidence: 100,
    confidenceLabel: 'High',
    message: 'Demo simulation ready.',
    reason: 'Price drop simulation armed.'
  }
};

const AlertsPage: React.FC = () => {
  const { user, removePriceAlert, setPriceAlert } = useAuth();
  const [alertItems, setAlertItems] = useState<UserAlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [editPriceVal, setEditPriceVal] = useState<string>('');
  const [demoProduct, setDemoProduct] = useState<Product>(DEFAULT_DEMO_PRODUCT);
  const [demoEnabled, setDemoEnabled] = useState(true);
  const [demoTargetInput, setDemoTargetInput] = useState('1500');
  const [isArmingDemo, setIsArmingDemo] = useState(false);

  const fetchAlertProducts = async () => {
    if (!user) {
      setAlertItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.get<UserAlertsResponse>(`/user/alerts?userId=${user.id}`);
      if (response.data.status === 'success' && response.data.data) {
        setAlertItems(response.data.data);
      } else {
        setAlertItems([]);
      }
    } catch (err) {
      console.error('Error fetching alert products:', err);
      setAlertItems([]);
    } finally {
      setLoading(false);
    }
  };

  const checkDemoStatus = async () => {
    try {
      const res = await apiClient.get('/api/demo/mock-product');
      if (res.data?.status === 'success') {
        setDemoEnabled(res.data.enabled !== false);
        if (res.data.data) setDemoProduct(res.data.data);
      }
    } catch (e) {
      // Keep default demoProduct
    }
  };

  useEffect(() => {
    checkDemoStatus();
  }, []);

  useEffect(() => {
    fetchAlertProducts();
  }, [user]);

  // If there's an active mock alert in MONITORING state, schedule a polling check after 10-12 seconds
  useEffect(() => {
    const hasActiveMockMonitoring = alertItems.some(
      a => (a.isMock || a.productId === 'mock-pricewise-alert-demo-v1') && a.isActive !== false && a.notificationStatus === 'MONITORING'
    );
    if (hasActiveMockMonitoring) {
      const timer = setTimeout(() => {
        fetchAlertProducts();
      }, 11000);
      return () => clearTimeout(timer);
    }
  }, [alertItems]);

  const handleRemove = async (productId: string) => {
    await removePriceAlert(productId);
    setAlertItems((prev) => prev.filter((item) => item.productId !== productId && item.product._id !== productId && (item.product as any).id !== productId));
  };

  const handleToggleActive = async (item: UserAlertItem) => {
    if (!user) return;
    const currentActive = item.isActive !== false;
    const newActive = !currentActive;

    try {
      await apiClient.post('/user/alerts/toggle', {
        userId: user.id,
        productId: item.productId,
        isActive: newActive
      });
      setAlertItems(prev => prev.map(a => {
        if (a.productId === item.productId) {
          return { ...a, isActive: newActive };
        }
        return a;
      }));
    } catch (err) {
      console.error('Error toggling alert status:', err);
    }
  };

  const handleSaveTargetPrice = async (item: UserAlertItem) => {
    const num = parseFloat(editPriceVal);
    if (isNaN(num) || num <= 0) return;

    try {
      await setPriceAlert(item.productId, num);
      setEditingAlertId(null);
      await fetchAlertProducts();
    } catch (err) {
      console.error('Error updating target price:', err);
    }
  };

  const handleArmDemoAlert = async () => {
    if (!demoProduct || !user) return;
    const target = parseFloat(demoTargetInput);
    if (isNaN(target) || target <= 0) return;

    try {
      setIsArmingDemo(true);
      await setPriceAlert(demoProduct._id || (demoProduct as any).id, target);
      await fetchAlertProducts();
    } catch (err) {
      console.error('Error arming demo alert:', err);
    } finally {
      setIsArmingDemo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
      </div>
    );
  }

  const hasMockAlert = alertItems.some(a => a.isMock || a.productId === 'mock-pricewise-alert-demo-v1');

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">Price Alerts</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Real-time target-price monitoring with instant in-app and email notifications when prices hit your goal.
        </p>
      </div>

      {/* Demo Test Alert Banner (When feature enabled) */}
      {demoEnabled && !hasMockAlert && demoProduct && (
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 rounded-3xl border border-purple-200 dark:border-purple-800/60 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-purple-600/20">
                <TestTube2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-200/70 dark:bg-purple-900/80 px-2 py-0.5 rounded-md">
                    MOCK PRODUCT
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Demo product — simulated price changes
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg mt-1">
                  {demoProduct.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  Current demo price: <span className="font-bold">₹1,999</span>. Test the alert pipeline — drops to 5% below your target in ~10s.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-purple-200 dark:border-purple-800 self-start md:self-auto">
              <div className="flex items-center space-x-1 pl-2">
                <span className="text-xs text-slate-400">Target ₹</span>
                <input
                  type="number"
                  value={demoTargetInput}
                  onChange={(e) => setDemoTargetInput(e.target.value)}
                  className="w-20 px-2 py-1 text-sm font-bold bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none"
                  placeholder="1500"
                />
              </div>
              <button
                onClick={handleArmDemoAlert}
                disabled={isArmingDemo}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center shadow-sm disabled:opacity-50"
              >
                {isArmingDemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                Arm 10s Demo Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {alertItems.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
            <Bell className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">No price alerts set</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 mb-8">
            Set price target alerts on any product detail page to monitor prices and receive notifications.
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
          {alertItems.map((item) => {
            const { product, targetPrice, isActive, notificationStatus, lastCheckedAt, lastNotifiedPrice } = item;
            const isMock = item.isMock || item.productId === 'mock-pricewise-alert-demo-v1' || product.isMock || (product as any).is_mock;
            const cheapestPlatform = product.platforms?.find((p) => p.isSmartDeal) || product.platforms?.[0];
            const currentPrice = cheapestPlatform?.price || 0;
            const isTargetMet = currentPrice > 0 && currentPrice <= targetPrice;
            const isPaused = isActive === false;
            const isSent = notificationStatus === 'SENT';
            const isFailed = notificationStatus === 'FAILED';
            const isEditing = editingAlertId === item.productId;

            return (
              <div
                key={item.id || item.productId}
                className={`bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border transition-all ${
                  isPaused
                    ? 'opacity-60 border-slate-200 dark:border-slate-800'
                    : isMock
                    ? 'border-purple-300 dark:border-purple-800/80 shadow-purple-50/50 dark:shadow-none'
                    : isSent
                    ? 'border-green-300 dark:border-green-800/80 shadow-green-50/50 dark:shadow-none'
                    : 'border-slate-100 dark:border-slate-700/70 hover:shadow-md'
                }`}
              >
                {/* Mock Banner if Mock Product */}
                {isMock && (
                  <div className="mb-3 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 rounded-xl border border-purple-200/80 dark:border-purple-900/60 flex items-center justify-between text-xs text-purple-800 dark:text-purple-300">
                    <span className="font-bold flex items-center">
                      <TestTube2 className="w-3.5 h-3.5 mr-1 text-purple-600 dark:text-purple-400" />
                      MOCK PRODUCT — Demo product — simulated price changes
                    </span>
                    {!isPaused && !isSent && (
                      <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 animate-pulse">
                        ⏳ Demo alert armed — simulated price drop in ~10s
                      </span>
                    )}
                    {isSent && (
                      <span className="text-[11px] font-bold text-green-600 dark:text-green-400">
                        🎯 Mock price drop evaluated & notified
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div
                      className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-xl p-2 flex-shrink-0 flex items-center justify-center border border-slate-100 dark:border-slate-700"
                    >
                      <img src={product.imageUrl} alt={product.title} className="max-h-full max-w-full object-contain" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${isMock ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                          {isMock ? 'PriceWise Demo' : (product.brand || 'Verified Deal')}
                        </span>
                        {cheapestPlatform && (
                          <span className="text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-medium">
                            {cheapestPlatform.name}
                          </span>
                        )}
                      </div>

                      <div className="block font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                        {product.title}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <div className="flex items-center space-x-1">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Current:</span>
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {currentPrice > 0 ? `₹${currentPrice.toLocaleString()}` : 'Checking...'}
                          </span>
                        </div>

                        <span className="text-slate-300 dark:text-slate-700">|</span>

                        <div className="flex items-center space-x-1">
                          <span className="text-sm text-slate-500 dark:text-slate-400">Target:</span>
                          {isEditing ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                value={editPriceVal}
                                onChange={(e) => setEditPriceVal(e.target.value)}
                                className="w-24 px-2 py-0.5 text-xs font-bold border rounded bg-white dark:bg-slate-900 border-blue-500 text-slate-900 dark:text-slate-100 focus:outline-none"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveTargetPrice(item)}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Save"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingAlertId(null)}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <span className="font-black text-green-600 dark:text-green-400">
                                ₹{targetPrice.toLocaleString()}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingAlertId(item.productId);
                                  setEditPriceVal(targetPrice.toString());
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                title="Edit target price"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status / Last Checked Info */}
                      <div className="flex items-center space-x-3 mt-2 text-xs text-slate-400">
                        {lastCheckedAt && (
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> Checked {new Date(lastCheckedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                        {lastNotifiedPrice && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            Notified at ₹{lastNotifiedPrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status Badge */}
                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-100 dark:border-slate-700">
                    {isPaused ? (
                      <span className="bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center border border-slate-200 dark:border-slate-700">
                        <PauseCircle className="w-3.5 h-3.5 mr-1" /> Paused
                      </span>
                    ) : isSent || isTargetMet ? (
                      <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center border border-green-200 dark:border-green-900/60">
                        <CheckCircle className="w-3.5 h-3.5 mr-1 text-green-600 dark:text-green-400" />
                        {isSent ? 'Target Reached (Notified)' : 'Target Reached!'}
                      </span>
                    ) : isFailed ? (
                      <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center border border-amber-200 dark:border-amber-900/60">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Delivery Failed
                      </span>
                    ) : (
                      <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center border border-blue-200 dark:border-blue-900/60">
                        <TrendingUp className="w-3.5 h-3.5 mr-1" /> Monitoring
                      </span>
                    )}

                    {/* Toggle Active Switch */}
                    <button
                      onClick={() => handleToggleActive(item)}
                      className={`p-2.5 rounded-xl border transition-colors ${
                        isPaused
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 border-slate-200 dark:border-slate-600'
                          : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 border-blue-200 dark:border-blue-900/60'
                      }`}
                      title={isPaused ? 'Resume monitoring' : 'Pause monitoring'}
                    >
                      {isPaused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                    </button>

                    {/* Remove Alert Button */}
                    <button
                      onClick={() => handleRemove(product._id || (product as any).id)}
                      className="p-2.5 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors border border-red-100 dark:border-red-900/40"
                      title="Remove Alert"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
