import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Search, Heart, User, ShoppingCart, Menu, X, Bot, Bell } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setSearchValue(searchParams.get('search') || '');
  }, [searchParams]);

  const isPublicAuthRoute = ['/login', '/signup'].includes(location.pathname);
  const isAuthenticated = user !== null && !isPublicAuthRoute;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/?search=${encodeURIComponent(searchValue.trim())}`);
      setIsMenuOpen(false);
    }
  };

  const alertCount = user?.alerts?.length || 0;
  const watchlistCount = user?.watchlist?.length || 0;

  // Unauthenticated / Auth Pages Header (Minimal branding and login/signup links only)
  if (!isAuthenticated) {
    return (
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center">
                <ShoppingCart className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold text-slate-900 dark:text-slate-100">PriceWise</span>
            </Link>

            <div className="flex items-center space-x-4">
              {location.pathname === '/signup' ? (
                <Link
                  to="/login"
                  className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-4 py-2 rounded-xl transition-colors"
                >
                  Log In
                </Link>
              ) : (
                <Link
                  to="/signup"
                  className="bg-blue-600 dark:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                >
                  Sign Up
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Authenticated Top Navigation Header
  return (
    <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2" onClick={() => setIsMenuOpen(false)}>
            <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center">
              <ShoppingCart className="text-white w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">PriceWise</span>
          </Link>

          {/* Desktop Search */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="text"
                placeholder="Search products..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 w-5 h-5" />
            </div>
          </form>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/chatbot" className="flex flex-col items-center text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Bot className="w-6 h-6" />
              <span className="text-xs mt-1 font-medium">AI Assistant</span>
            </Link>

            <Link to="/alerts" className="relative flex flex-col items-center text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Bell className="w-6 h-6" />
              {alertCount > 0 && (
                <span className="absolute -top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {alertCount}
                </span>
              )}
              <span className="text-xs mt-1 font-medium">Alerts</span>
            </Link>

            <Link to="/watchlist" className="relative flex flex-col items-center text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              <Heart className="w-6 h-6" />
              {watchlistCount > 0 && (
                <span className="absolute -top-1 right-2 bg-blue-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {watchlistCount}
                </span>
              )}
              <span className="text-xs mt-1 font-medium">Watchlist</span>
            </Link>

            <div className="flex items-center space-x-4">
              <Link to="/profile" className="flex flex-col items-center text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                <User className="w-6 h-6" />
                <span className="text-xs mt-1 font-medium">Profile</span>
              </Link>
              <div className="flex items-center space-x-3 ml-2 border-l border-slate-200 dark:border-slate-700 pl-4">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.name}</span>
                  <button
                    onClick={logout}
                    className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider hover:underline"
                  >
                    Logout
                  </button>
                </div>
                {user.profilePhoto || user.profilePhotoUrl || user.profile_photo ? (
                  <img src={user.profilePhoto || user.profilePhotoUrl || user.profile_photo} alt={user.name} className="w-10 h-10 rounded-full object-cover border-2 border-blue-50 dark:border-slate-700" />
                ) : (
                  <div className="w-10 h-10 bg-blue-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-black">
                    {user.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-slate-600 dark:text-slate-300"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2">
            <form onSubmit={handleSearch} className="mt-4 mb-4">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 w-5 h-5" />
              </div>
            </form>
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/chatbot"
                className="flex items-center justify-center p-3 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold"
                onClick={() => setIsMenuOpen(false)}
              >
                <Bot className="w-5 h-5 mr-2" />
                AI Chatbot
              </Link>
              <Link
                to="/alerts"
                className="flex items-center justify-center p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-xl font-bold"
                onClick={() => setIsMenuOpen(false)}
              >
                <Bell className="w-5 h-5 mr-2" />
                Alerts ({alertCount})
              </Link>
              <Link
                to="/watchlist"
                className="flex items-center justify-center p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl"
                onClick={() => setIsMenuOpen(false)}
              >
                <Heart className="w-5 h-5 mr-2" />
                Watchlist ({watchlistCount})
              </Link>
              <Link
                to="/profile"
                className="flex items-center justify-center p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl"
                onClick={() => setIsMenuOpen(false)}
              >
                <User className="w-5 h-5 mr-2" />
                Profile
              </Link>
            </div>
            <button
              onClick={() => { logout(); setIsMenuOpen(false); }}
              className="w-full mt-4 p-3 text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
