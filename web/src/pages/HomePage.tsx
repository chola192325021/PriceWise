import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import apiClient from '../api/client';
import { Product, ProductListResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import searchStore from '../utils/searchStore';
import {
  TrendingUp,
  ArrowDown,
  Search,
  Loader2,
  Sparkles,
  Plus,
  Zap,
  Laptop,
  Shirt,
  Home as HomeIcon,
  X,
  RefreshCw
} from 'lucide-react';

const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const displayTitle = product.cleanTitle || product.title;
  const exactPlatforms = (product.platforms || []).filter(p => (p.status || p.matchStatus) === 'exact_match' && p.price > 0);
  const cheapestPlatform = exactPlatforms.find((p) => p.isSmartDeal) || exactPlatforms[0] || (product.platforms || [])[0];
  const displayPrice = product.bestExactPrice ? product.bestExactPrice.price : (cheapestPlatform?.price || 0);
  const similarCount = product.similarProducts?.length || 0;

  return (
    <Link
      to={`/product/${product._id}`}
      onClick={() => searchStore.saveScroll(window.scrollY)}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col group border border-slate-100 dark:border-slate-700/70"
    >
      <div className="relative h-48 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center p-4">
        <img
          src={product.imageUrl}
          alt={displayTitle}
          className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
        />
        {exactPlatforms.length > 0 && (
          <div className="absolute top-2 left-2 bg-green-600 dark:bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
            Exact Match
          </div>
        )}
        {similarCount > 0 && (
          <div className="absolute top-2 right-2 bg-slate-800/80 backdrop-blur-sm text-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
            +{similarCount} similar
          </div>
        )}
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="text-xs text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide font-medium">{product.brand}</div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2 line-clamp-2 leading-tight h-10">{displayTitle}</h3>

        <div className="mt-auto pt-4 flex items-baseline justify-between">
          <div>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">₹{displayPrice.toLocaleString()}</span>
            {exactPlatforms.length > 1 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Lowest among {exactPlatforms.length} exact stores</span>
            )}
          </div>

          <div
            className={`flex items-center text-xs font-bold ${
              product.aiPrediction.trend === 'drop' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {product.aiPrediction.trend === 'drop' ? (
              <>
                <ArrowDown className="w-3 h-3 mr-0.5" /> Drop Expected
              </>
            ) : (
              <>
                <TrendingUp className="w-3 h-3 mr-0.5" /> Stable
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

const WiseAnalysisBanner: React.FC = () => (
  <div className="bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl p-5 mb-6 flex items-start space-x-4">
    <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
      <Sparkles className="w-5 h-5" />
    </div>
    <div>
      <h3 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm">Wise Market Analysis</h3>
      <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1 leading-relaxed">
        Electronics and Home Decor are seeing a significant 24-hour correction. 12 deals identified as 'All-Time Lows'
        across Amazon and Flipkart.
      </p>
    </div>
  </div>
);

const CategoryRow: React.FC<{
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}> = ({ selectedCategory, onSelectCategory }) => {
  const categories = [
    { label: 'All', value: 'All', icon: Zap },
    { label: 'Tech', value: 'Electronics', icon: Laptop },
    { label: 'Fashion', value: 'Fashion', icon: Shirt },
    { label: 'Home', value: 'General', icon: HomeIcon }
  ];

  return (
    <div className="flex items-center space-x-3 mb-6 overflow-x-auto pb-2">
      {categories.map((cat) => {
        const IconComponent = cat.icon;
        const isSelected = selectedCategory === cat.value;
        return (
          <button
            key={cat.value}
            onClick={() => onSelectCategory(cat.value)}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all flex-shrink-0 ${
              isSelected
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            <IconComponent className="w-4 h-4" />
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};

const HomePage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const rawQuery = searchParams.get('search');
  const query = rawQuery ? rawQuery.trim() : '';

  const [products, setProducts] = useState<Product[]>(() => {
    if (query) {
      const cached = searchStore.getCachedResults(query);
      if (cached && cached.length > 0) return cached;
    }
    const state = searchStore.getState();
    if (!query && state.results.length > 0 && !state.submittedQuery) {
      return state.results;
    }
    return [];
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (query) {
      const cached = searchStore.getCachedResults(query);
      return !cached;
    }
    const state = searchStore.getState();
    return !(state.results.length > 0 && !state.submittedQuery);
  });

  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const activeSearchQueryRef = useRef<string | null>(query || null);

  // Track product modal state
  const [showTrackModal, setShowTrackModal] = useState(false);
  const [trackUrl, setTrackUrl] = useState('');
  const [trackPlatform, setTrackPlatform] = useState<'Amazon' | 'Flipkart'>('Amazon');
  const [tracking, setTracking] = useState(false);
  const [trackMsg, setTrackMsg] = useState('');

  const fetchProducts = useCallback(async (cause: 'USER_SUBMIT' | 'USER_REFRESH' | 'USER_RETRY' = 'USER_SUBMIT') => {
    setLoading(true);
    setError('');
    const cacheHit = Boolean(query && searchStore.getCachedResults(query) && cause !== 'USER_REFRESH');
    searchStore.logSearchEvent(cause, query, cacheHit);

    try {
      const categoryParam = selectedCategory !== 'All' ? `&category=${encodeURIComponent(selectedCategory)}` : '';
      const endpoint = query ? `/products/search-live?query=${encodeURIComponent(query)}${categoryParam}` : '/products';
      const response = await apiClient.get<ProductListResponse>(endpoint);
      if (response.data.status === 'success') {
        const data = response.data.data || [];
        setProducts(data);
        if (query) {
          searchStore.setCachedResults(query, data);
          searchStore.setState({
            submittedQuery: query,
            results: data,
            hasSearched: true,
            lastSuccessfulQuery: query,
            isLoading: false,
            error: null
          });
        } else {
          searchStore.setState({
            submittedQuery: null,
            results: data,
            hasSearched: false,
            isLoading: false,
            error: null
          });
        }
      }
    } catch (err) {
      setError('Failed to load products. Please try again later.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory]);

  useEffect(() => {
    if (query) {
      const cached = searchStore.getCachedResults(query);
      if (cached) {
        setProducts(cached);
        setLoading(false);
        const savedScroll = searchStore.getSavedScroll();
        if (savedScroll > 0) {
          setTimeout(() => {
            window.scrollTo({ top: savedScroll, behavior: 'instant' });
          }, 30);
        }
        return;
      }
      activeSearchQueryRef.current = query;
      fetchProducts('USER_SUBMIT');
    } else {
      activeSearchQueryRef.current = '';
      const state = searchStore.getState();
      if (state.results.length > 0 && !state.submittedQuery && selectedCategory === 'All') {
        setProducts(state.results);
        setLoading(false);
        const savedScroll = searchStore.getSavedScroll();
        if (savedScroll > 0) {
          setTimeout(() => {
            window.scrollTo({ top: savedScroll, behavior: 'instant' });
          }, 30);
        }
      } else {
        fetchProducts('USER_SUBMIT');
      }
    }
  }, [query, selectedCategory, fetchProducts]);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackUrl.trim()) return;

    setTracking(true);
    setTrackMsg('');
    try {
      const response = await apiClient.post('/products/track', {
        url: trackUrl.trim(),
        platform: trackPlatform,
        userId: user?.id || '6a0546da31788710d8753894'
      });

      if (response.data?.status === 'success' || response.data?.productId) {
        setTrackMsg('Product successfully queued for live tracking!');
        setTrackUrl('');
        setTimeout(() => {
          setShowTrackModal(false);
          setTrackMsg('');
          fetchProducts('USER_REFRESH');
        }, 1500);
      } else {
        setTrackMsg('Track request sent. Live data updating.');
      }
    } catch (err: any) {
      setTrackMsg(err.response?.data?.message || 'Failed to track product. Please check the URL.');
    } finally {
      setTracking(false);
    }
  };

  const filteredProducts =
    selectedCategory === 'All'
      ? products
      : products.filter((p) => p.category?.toLowerCase() === selectedCategory.toLowerCase());

  return (
    <div className="relative">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {query ? `Search results for "${query}"` : `Hello, ${user?.name || 'Shopper'}!`}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              {query ? 'Real-time multi-source comparison (Amazon, Flipkart, Meesho, AJIO, Myntra)' : 'Real-time price comparisons and AI drop predictions.'}
            </p>
            {query && !loading && (
              <button
                onClick={() => fetchProducts('USER_REFRESH')}
                title="Refresh live prices"
                className="inline-flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowTrackModal(true)}
          className="inline-flex items-center justify-center bg-blue-600 dark:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold shadow-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-all text-sm"
        >
          <Plus className="w-5 h-5 mr-2" /> Track New Product
        </button>
      </div>

      {!query && <WiseAnalysisBanner />}

      {!query && <CategoryRow selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {query ? 'Searching live across Amazon, Flipkart, Meesho, AJIO, Myntra...' : 'Analyzing market prices...'}
          </p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-8 text-center">
          <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          <button onClick={() => fetchProducts('USER_RETRY')} className="mt-4 text-blue-600 dark:text-blue-400 font-bold hover:underline">
            Try Again
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-slate-400 dark:text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">No products found</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Try selecting another category or searching for a specific product.</p>
          {query && (
            <button
              onClick={() => fetchProducts('USER_REFRESH')}
              className="mt-4 inline-flex items-center px-4 py-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold rounded-xl text-sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh Search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}

      {/* Track Product Modal */}
      {showTrackModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setShowTrackModal(false)}
              className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">Track New Product</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Paste product link from Amazon or Flipkart to scrape live data and start tracking prices.
            </p>

            {trackMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-bold ${
                  trackMsg.includes('successfully')
                    ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300'
                    : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                }`}
              >
                {trackMsg}
              </div>
            )}

            <form onSubmit={handleTrackSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Product Web URL
                </label>
                <input
                  type="url"
                  required
                  value={trackUrl}
                  onChange={(e) => setTrackUrl(e.target.value)}
                  placeholder="https://www.amazon.in/dp/..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Platform</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="platform"
                      value="Amazon"
                      checked={trackPlatform === 'Amazon'}
                      onChange={() => setTrackPlatform('Amazon')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Amazon</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="platform"
                      value="Flipkart"
                      checked={trackPlatform === 'Flipkart'}
                      onChange={() => setTrackPlatform('Flipkart')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>Flipkart</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setShowTrackModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tracking}
                  className="flex-1 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm flex items-center justify-center"
                >
                  {tracking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
