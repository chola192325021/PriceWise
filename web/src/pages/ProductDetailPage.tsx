import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { Product, ProductListResponse, SingleProductResponse, ChronosForecast, PriceForecastResponse, Platform, ComparisonSummary, MatchStatus } from '../types';

const ChronosForecastCard: React.FC<{ forecastData: ChronosForecast | null; loading: boolean }> = ({ forecastData, loading }) => {
  if (loading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mb-6 flex items-center justify-center">
        <Loader2 className="animate-spin w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Calculating Chronos Time-Series Forecast...</span>
      </div>
    );
  }

  if (!forecastData || forecastData.forecast.length === 0) {
    return null;
  }

  const lastPoint = forecastData.forecast[forecastData.forecast.length - 1];

  const getTrendBadge = () => {
    if (forecastData.trend === 'likely_decrease') {
      return (
        <span className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-bold border border-green-200 dark:border-green-900/60 flex items-center">
          <TrendingDown className="w-3.5 h-3.5 mr-1" /> Likely Decrease
        </span>
      );
    }
    if (forecastData.trend === 'likely_increase') {
      return (
        <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 dark:border-amber-900/60 flex items-center">
          <TrendingUp className="w-3.5 h-3.5 mr-1" /> Likely Increase
        </span>
      );
    }
    return (
      <span className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 dark:border-blue-900/60 flex items-center">
        <Info className="w-3.5 h-3.5 mr-1" /> Likely Stable
      </span>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-700 shadow-xl mb-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-1">
            Amazon Chronos Time-Series AI
          </div>
          <h3 className="text-lg font-black flex items-center">
            14-Day Price Forecast Estimate
          </h3>
        </div>
        {getTrendBadge()}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-400">Current</span>
          <span className="text-lg font-bold text-white">₹{forecastData.currentPrice.toLocaleString()}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-400">14-Day Predicted</span>
          <span className="text-lg font-black text-blue-400">₹{lastPoint.predictedPrice.toLocaleString()}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase font-bold text-slate-400">Est. Band (Quantiles)</span>
          <span className="text-xs font-bold text-slate-300">
            ₹{lastPoint.lowerBound.toLocaleString()} - ₹{lastPoint.upperBound.toLocaleString()}
          </span>
        </div>
      </div>

      {forecastData.warning && (
        <div className="text-xs text-amber-300 bg-amber-950/50 p-2.5 rounded-lg border border-amber-800/50 mb-3 flex items-center">
          <Info className="w-4 h-4 mr-1.5 flex-shrink-0" />
          {forecastData.warning}
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-700/80">
        <span>Model: {forecastData.model}</span>
        <span>Confidence: {forecastData.confidence.toUpperCase()}</span>
        <span className="italic">Estimate Only • Not Guaranteed</span>
      </div>
    </div>
  );
};
import { useAuth } from '../context/AuthContext';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  ArrowLeft, Heart, Bell, ExternalLink, ShieldCheck,
  Info, TrendingDown, TrendingUp, AlertCircle, Loader2, RefreshCw
} from 'lucide-react';

const PredictionCard: React.FC<{ prediction: Product['aiPrediction'] }> = ({ prediction }) => {
  const getStatusColor = () => {
    switch (prediction.status) {
      case 'CONFIDENT_FORECAST': return 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-900/60 text-green-700 dark:text-green-300';
      case 'ESTIMATE': return 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900/60 text-blue-700 dark:text-blue-300';
      case 'EARLY_ESTIMATE': return 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-300';
      case 'TRACKING_STARTED': return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
      default: return 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300';
    }
  };

  const getStatusLabel = () => {
    switch (prediction.status) {
      case 'CONFIDENT_FORECAST': return prediction.recommendation === 'BUY_NOW' ? 'Buy Now' : prediction.recommendation === 'WAIT' ? 'Wait' : 'Monitor';
      case 'ESTIMATE': return 'Limited history · Medium confidence';
      case 'EARLY_ESTIMATE': return 'Early estimate · Low confidence';
      case 'TRACKING_STARTED': return 'Tracking price history';
      default: return prediction.status;
    }
  };

  const getTrendIcon = () => {
    if (prediction.trend === 'drop') return <TrendingDown className="w-5 h-5 mr-2" />;
    if (prediction.trend === 'rise') return <TrendingUp className="w-5 h-5 mr-2" />;
    return <Info className="w-5 h-5 mr-2" />;
  };

  if (prediction.status === 'TRACKING_STARTED') {
    return (
      <div className={`p-6 rounded-2xl border-2 ${getStatusColor()} mb-6`}>
        <div className="flex items-center font-bold text-lg mb-2">
          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          {getStatusLabel()}
        </div>
        <p className="text-sm opacity-90">Prediction unavailable yet. We need more data points to generate an AI forecast.</p>
        <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-60">
          <span>{prediction.message}</span>
          <span>Status: {prediction.status}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-2xl border-2 ${getStatusColor()} mb-6`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center font-bold text-xl mb-1">
            {getTrendIcon()}
            {getStatusLabel()}
          </div>
          <div className="text-sm font-medium opacity-80">{prediction.reason}</div>
        </div>
        <div className="bg-white/60 dark:bg-slate-900/60 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
          {prediction.confidenceLabel} Confidence ({prediction.confidence}%)
        </div>
      </div>

      <p className="text-sm mb-4 text-slate-700 dark:text-slate-300 font-medium italic">"{prediction.message}"</p>

      {prediction.expectedPrice && (
        <div className="bg-white/40 dark:bg-slate-900/40 p-4 rounded-xl flex justify-between items-center">
          <span className="text-sm font-bold uppercase tracking-wider opacity-70">Target Price</span>
          <span className="text-2xl font-black">₹{prediction.expectedPrice.toLocaleString()}</span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider opacity-60">
        <span>History: {prediction.historyDays} Days Recorded</span>
        <span>Status: {prediction.status}</span>
      </div>
    </div>
  );
};

/**
 * Shows a color-coded inline badge for a platform's match status.
 */
const MatchStatusBadge: React.FC<{ platform: Platform; referenceTitle: string }> = ({ platform, referenceTitle }) => {
  if (!platform.matchStatus || platform.matchStatus === 'reference') {
    return <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Reference listing</span>;
  }

  const configs: Record<MatchStatus, { label: string; className: string }> = {
    exact_match: {
      label: '✓ Exact match',
      className: 'bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
    },
    variant_match: {
      label: '⚠ Similar variant',
      className: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
    },
    unit_price_only: {
      label: '↔ Different quantity',
      className: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800'
    },
    no_match: {
      label: '✕ No exact match',
      className: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
    },
    reference: {
      label: 'Reference',
      className: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
    }
  };

  const cfg = configs[platform.matchStatus];
  if (!cfg) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.className}`}>
        {cfg.label}
      </span>
      {platform.differingAttributes && platform.differingAttributes.length > 0 && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
          Differs: {platform.differingAttributes.map(a => a.replace(/([A-Z])/g, ' $1').trim()).join(', ')}
        </div>
      )}
      {platform.unitLabel && platform.unitPriceB !== undefined && platform.unitPriceB !== null && (
        <div className="text-[10px] text-slate-500 dark:text-slate-400">
          Unit price: ₹{platform.unitPriceB.toLocaleString()} {platform.unitLabel}
        </div>
      )}
    </div>
  );
};

/**
 * Banner shown above the platform list summarising overall comparison safety.
 */
const ComparisonSummaryBanner: React.FC<{ summary: ComparisonSummary | undefined }> = ({ summary }) => {
  if (!summary || summary.comparisonType === 'exact_match') {
    return summary ? (
      <div className="flex items-center text-xs font-bold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-xl px-3 py-2 mb-4">
        <ShieldCheck className="w-4 h-4 mr-2 flex-shrink-0" />
        Exact match confirmed across all stores
      </div>
    ) : null;
  }

  if (summary.comparisonType === 'variant_match') {
    return (
      <div className="flex items-start text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 mb-4">
        <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
        <div>
          <div>Similar variant — not an identical product</div>
          {summary.comparisonWarning && (
            <div className="font-normal opacity-90 mt-0.5">{summary.comparisonWarning}</div>
          )}
        </div>
      </div>
    );
  }

  if (summary.comparisonType === 'unit_price_only') {
    return (
      <div className="flex items-start text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-xl px-3 py-2 mb-4">
        <Info className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
        <div>
          <div>Comparable product — different pack/quantity</div>
          {summary.comparisonWarning && (
            <div className="font-normal opacity-90 mt-0.5">{summary.comparisonWarning}</div>
          )}
          {summary.unitPriceLabel && (
            <div className="font-normal opacity-80 mt-0.5">Prices shown per unit ({summary.unitPriceLabel})</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 mb-4">
      <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
      <div>
        <div>No exact match found on other stores</div>
        {summary.comparisonWarning && (
          <div className="font-normal opacity-80 mt-0.5">{summary.comparisonWarning}</div>
        )}
      </div>
    </div>
  );
};

const ProductDetailPage: React.FC = () => {
  const { id } = useParams();
  const { user, theme, addToWatchlist, removeFromWatchlist, setPriceAlert } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [chronosForecast, setChronosForecast] = useState<ChronosForecast | null>(null);
  const [chronosLoading, setChronosLoading] = useState(false);

  const [showAlertInput, setShowAlertInput] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [alertSuccess, setAlertSuccess] = useState(false);

  const isDarkTheme =
    theme === 'dark' ||
    (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const fetchProduct = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      let found: Product | null = null;

      // 1. Query direct product endpoint by ID
      try {
        const singleRes = await apiClient.get<SingleProductResponse>(`/products/${encodeURIComponent(id)}`);
        if (singleRes.data && singleRes.data.status === 'success' && singleRes.data.data) {
          found = singleRes.data.data;
        }
      } catch (err) {
        console.warn(`Direct product lookup by ID ${id} failed, trying fallback list...`);
      }

      // 2. Fallback check main product list if direct ID endpoint failed
      if (!found) {
        const response = await apiClient.get<ProductListResponse>('/products');
        found = response.data.data.find(
          p => p._id === id || (p as any).id === id || p._id.toLowerCase() === id.toLowerCase()
        ) || null;
      }

      if (found) {
        setProduct(found);
        const productId = found._id || (found as any).id;
        setIsInWatchlist(user?.watchlist?.includes(productId) || false);

        const existingAlert = user?.alerts?.find(a => a.productId === productId);
        if (existingAlert) {
          setTargetPrice(existingAlert.targetPrice.toString());
        }

        // Fetch Chronos Forecast asynchronously
        setChronosLoading(true);
        try {
          const forecastRes = await apiClient.get<PriceForecastResponse>(`/products/${productId}/price-forecast`);
          if (forecastRes.data && forecastRes.data.status === 'success') {
            setChronosForecast(forecastRes.data.data);
          }
        } catch (fcErr) {
          console.warn('Chronos forecast fetch error:', fcErr);
        } finally {
          setChronosLoading(false);
        }
      } else {
        setProduct(null);
      }
    } catch (err) {
      console.error("Error fetching product details:", err);
      setErrorMsg("Unable to load product details due to a network connection issue.");
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const toggleWatchlist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const targetId = product?._id || (product as any)?.id || id;
    if (targetId) {
      if (isInWatchlist) {
        await removeFromWatchlist(targetId);
      } else {
        await addToWatchlist(targetId);
      }
      setIsInWatchlist(!isInWatchlist);
    }
  };

  const [isSettingAlert, setIsSettingAlert] = useState(false);

  const handleSetAlert = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const targetId = product?._id || (product as any)?.id || id;
    if (!targetPrice || isNaN(parseFloat(targetPrice)) || !targetId || isSettingAlert) return;

    setIsSettingAlert(true);
    try {
      await setPriceAlert(targetId, parseFloat(targetPrice));
      setAlertSuccess(true);
      setTimeout(() => setAlertSuccess(false), 3000);
      setShowAlertInput(false);
    } catch (err) {
      console.error('Failed to set price alert:', err);
    } finally {
      setIsSettingAlert(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-500 dark:text-slate-400">
        <Loader2 className="animate-spin w-12 h-12 text-blue-600 dark:text-blue-400 mb-4" />
        <p className="font-bold text-sm">Loading product details...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <div className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 p-6 rounded-3xl border-2 border-red-100 dark:border-red-900/60 mb-6">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-2">Connection Error</h2>
          <p className="text-sm font-medium mb-6">{errorMsg}</p>
          <button
            onClick={fetchProduct}
            className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center mx-auto hover:bg-red-700 transition-colors shadow-md"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
          <AlertCircle className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3" />
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">Product Not Found</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
            The product you requested could not be located in our verified deal index.
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            Browse All Products
          </button>
        </div>
      </div>
    );
  }

  const historyData = product.price_history?.map(h => ({
    date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    price: h.price
  })) || [];

  const cheapestPlatform = product.platforms.find(p => p.isSmartDeal) || product.platforms[0];

  return (
    <div className="max-w-6xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-6 transition-colors font-bold text-sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to results
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left: Images and Basic Info */}
        <div>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700/70 flex items-center justify-center mb-6 aspect-square">
            <img src={product.imageUrl} alt={product.title} className="max-h-full max-w-full object-contain" />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <button
                onClick={toggleWatchlist}
                className={`flex-1 flex items-center justify-center py-4 rounded-2xl font-bold transition-all ${
                  isInWatchlist
                    ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 border-2 border-red-200 dark:border-red-900/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Heart className={`w-5 h-5 mr-2 ${isInWatchlist ? 'fill-current' : ''}`} />
                {isInWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              </button>
              <button
                onClick={() => setShowAlertInput(!showAlertInput)}
                className={`flex-1 flex items-center justify-center py-4 rounded-2xl font-bold transition-all ${
                  showAlertInput
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border-2 border-blue-200 dark:border-blue-900/60'
                }`}
              >
                <Bell className="w-5 h-5 mr-2" />
                {alertSuccess ? 'Alert Set!' : 'Set Alert'}
              </button>
            </div>

            {showAlertInput && (
              <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/60 animate-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">Notify me when price drops below:</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-blue-400 font-bold">₹</span>
                    <input
                      type="number"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="Enter target price"
                      className="w-full pl-8 pr-4 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl border-2 border-blue-200 dark:border-blue-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleSetAlert}
                    disabled={isSettingAlert}
                    className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[80px]"
                  >
                    {isSettingAlert ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Pricing and Predictions */}
        <div>
          <div className="mb-8">
            <div className="text-sm text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest mb-2">{product.brand} • {product.category}</div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 leading-tight mb-4">{product.title}</h1>

            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-black text-slate-900 dark:text-slate-100">₹{cheapestPlatform?.price.toLocaleString()}</span>
              {cheapestPlatform?.pricePrefix && <span className="text-slate-500 dark:text-slate-400 font-medium">{cheapestPlatform.pricePrefix}</span>}
              <div className="bg-green-100 dark:bg-green-950/60 text-green-700 dark:text-green-300 px-3 py-1 rounded-full text-xs font-bold border border-green-200 dark:border-green-900/60">
                Lowest Price
              </div>
            </div>
          </div>

          <PredictionCard prediction={product.aiPrediction} />

          <ChronosForecastCard forecastData={chronosForecast} loading={chronosLoading} />

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700/70 mb-8">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center">
              Available Offers
              <ShieldCheck className="w-4 h-4 ml-2 text-green-500" />
            </h3>

            {/* Comparison quality banner */}
            <ComparisonSummaryBanner summary={product.comparisonSummary} />

            <div className="space-y-4">
              {product.platforms.map((platform, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border ${
                    platform.isSmartDeal
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 ring-1 ring-blue-500'
                      : 'border-slate-100 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center mr-4 font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                        {platform.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{platform.name}</div>
                        {/* Show the actual listing title if it differs */}
                        {platform.productTitle && platform.productTitle !== product.title && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 line-clamp-2 max-w-[220px]" title={platform.productTitle}>
                            Listed as: {platform.productTitle.substring(0, 70)}{platform.productTitle.length > 70 ? '…' : ''}
                          </div>
                        )}
                        <MatchStatusBadge platform={platform} referenceTitle={product.title} />
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4 ml-2 flex-shrink-0">
                      <div>
                        <div className="font-black text-slate-900 dark:text-slate-100">₹{platform.price.toLocaleString()}</div>
                        {platform.matchStatus === 'unit_price_only' && platform.unitPriceB && platform.unitLabel && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            ₹{platform.unitPriceB.toLocaleString()} {platform.unitLabel}
                          </div>
                        )}
                      </div>
                      <a
                        href={platform.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                        title={`View on ${platform.name}`}
                      >
                        <ExternalLink className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* History Chart */}
      <div className="mt-12 bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-700/70">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-8">Price History</h3>
        {historyData.length > 0 ? (
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkTheme ? '#334155' : '#f0f0f0'} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: isDarkTheme ? '#94a3b8' : '#9ca3af', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: isDarkTheme ? '#94a3b8' : '#9ca3af', fontSize: 12}} dx={-10} tickFormatter={(value) => `₹${value}`} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: isDarkTheme ? '1px solid #475569' : 'none',
                    backgroundColor: isDarkTheme ? '#1e293b' : '#ffffff',
                    color: isDarkTheme ? '#f8fafc' : '#0f172a',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)'
                  }}
                  formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Price']}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke={isDarkTheme ? '#3b82f6' : '#2563eb'}
                  strokeWidth={4}
                  dot={{r: 6, fill: isDarkTheme ? '#3b82f6' : '#2563eb', strokeWidth: 2, stroke: '#fff'}}
                  activeDot={{r: 8, strokeWidth: 0}}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
            <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
            <p>Insufficient history data to display chart</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;
