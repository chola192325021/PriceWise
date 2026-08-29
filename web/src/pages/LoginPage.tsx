import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, AlertCircle, ShoppingCart, KeyRound, X, Loader2, CheckCircle2 } from 'lucide-react';
import PasswordField from '../components/PasswordField';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStatusMsg, setResetStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);
  const { login, sendPasswordResetCode, resendPasswordResetCode, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const fromLocation = (location.state as any)?.from?.pathname || '/';

  React.useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(fromLocation, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetStatusMsg(null);
    const res = await sendPasswordResetCode(resetEmail.trim());
    setResetLoading(false);
    if (res.success) {
      setResetStatusMsg({ type: 'success', text: res.message });
      setForgotStep(2);
      setResendCooldown(60);
    } else {
      setResetStatusMsg({ type: 'error', text: res.message });
    }
  };

  const handleResendResetCode = async () => {
    if (resendCooldown > 0 || !resetEmail.trim() || resetLoading) return;
    setResetLoading(true);
    setResetStatusMsg(null);
    const res = await resendPasswordResetCode(resetEmail.trim());
    setResetLoading(false);
    if (res.success) {
      setResetStatusMsg({ type: 'success', text: res.message });
      setResendCooldown(res.remainingSeconds || 60);
    } else {
      setResetStatusMsg({ type: 'error', text: res.message });
      if (res.remainingSeconds) {
        setResendCooldown(res.remainingSeconds);
      }
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCode.trim() || !newPassword.trim()) return;
    setResetLoading(true);
    setResetStatusMsg(null);
    const res = await resetPassword(resetEmail.trim(), resetCode.trim(), newPassword.trim());
    setResetLoading(false);
    if (res.success) {
      setResetStatusMsg({ type: 'success', text: 'Password reset successfully! You can now log in.' });
      setTimeout(() => {
        setShowForgotModal(false);
        setForgotStep(1);
        setResetStatusMsg(null);
      }, 2000);
    } else {
      setResetStatusMsg({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700/70 overflow-hidden p-8 transition-colors">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 dark:bg-blue-500 rounded-2xl flex items-center justify-center mb-4 shadow-md">
            <ShoppingCart className="text-white w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100">Welcome Back</h1>
          <p className="text-slate-500 dark:text-slate-400 text-center mt-2 text-sm">
            Sign in to track your favorite products and get price alerts.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 p-4 rounded-r-xl flex items-start">
            <AlertCircle className="text-red-500 w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Mail className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 w-5 h-5" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setShowForgotModal(true);
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <PasswordField
              id="login-password"
              name="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 dark:bg-blue-500 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all disabled:opacity-70 text-sm shadow-md"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          Don't have an account?{' '}
          <Link to="/signup" className="text-blue-600 dark:text-blue-400 font-bold hover:underline">
            Sign up here
          </Link>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative border border-slate-100 dark:border-slate-700">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotStep(1);
                setResetStatusMsg(null);
              }}
              className="absolute top-4 right-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 bg-blue-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4">
              <KeyRound className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-1">
              {forgotStep === 1 ? 'Reset Password' : 'Enter Verification Code'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              {forgotStep === 1
                ? 'Enter your registered email address to receive a 6-digit verification code.'
                : 'Enter the 6-digit verification code sent to your email and your new password.'}
            </p>

            {resetStatusMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-center ${
                  resetStatusMsg.type === 'success'
                    ? 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-900/60'
                    : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/60'
                }`}
              >
                {resetStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mr-2 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                )}
                {resetStatusMsg.text}
              </div>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleSendResetCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Registered Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <Mail className="absolute left-3 top-3.5 text-slate-400 dark:text-slate-500 w-5 h-5" />
                  </div>
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm flex items-center justify-center"
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="6-digit code"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono font-bold tracking-widest text-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    New Password
                  </label>
                  <PasswordField
                    id="reset-new-password"
                    name="newPassword"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex justify-between items-center text-xs px-1">
                  <span className="text-slate-500 dark:text-slate-400">Didn't receive the email?</span>
                  <button
                    type="button"
                    onClick={handleResendResetCode}
                    disabled={resendCooldown > 0 || resetLoading}
                    className="font-bold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Email'}
                  </button>
                </div>

                <div className="pt-2 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setForgotStep(1)}
                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="flex-1 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 text-sm flex items-center justify-center"
                  >
                    {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
