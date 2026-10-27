import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { signin, signup, signInWithGoogle, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, go directly to dashboard
  useEffect(() => {
    if (currentUser) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      setLoading(true);
      await signin(email, password);
      toast.success('Signed in successfully!', {
        description: 'Welcome back to your paper trading ledger.',
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Failed to sign in.';
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        msg = 'Invalid email or password. Please check your credentials.';
      }
      setError(msg);
      toast.error('Sign In Failed', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      setGoogleLoading(true);
      const user = await signInWithGoogle();
      toast.success('Google Authentication Successful!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Failed to authenticate with Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // Instant Demo Account Login for testing
  const handleQuickDemo = async () => {
    try {
      setLoading(true);
      setError('');
      await signup({
        fullName: 'Demo Trader',
        email: 'trader@papertrading.demo',
        password: 'PaperTrading2026!',
        targetCurrency: 'INR',
        defaultMarket: 'NSE',
        tradingStyle: 'Day & Swing Trader',
      });
      toast.success('Instant Demo Account Activated!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      try {
        await signin('trader@papertrading.demo', 'PaperTrading2026!');
        toast.success('Signed into Demo Account!');
        navigate('/dashboard', { replace: true });
      } catch (loginErr) {
        setError(loginErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-110px)] bg-[#F6F4EE] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 text-[#111111]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Paper Trading Logo"
            className="inline-block w-14 h-14 object-contain border-2 border-[#111111] bg-white p-1 shadow-xs mb-3"
          />
          <h2 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
            SIGN IN TO PAPER LEDGER
          </h2>
          <p className="mt-1 text-xs text-[#111111]/70 font-mono uppercase tracking-wider">
            ACCESS VIRTUAL HOLDINGS & LIVE SIMULATION
          </p>
        </div>

        <div className="mt-6 newspaper-photo-plate bg-white p-6 sm:p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border-2 border-red-800 text-red-900 text-xs flex items-center gap-2 font-bold font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-800" />
              <span>{error}</span>
            </div>
          )}

          {/* Sign In with Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-2.5 px-4 bg-white hover:bg-[#FAF8F3] text-[#111111] font-mono font-bold text-xs sm:text-sm border-2 border-[#111111] shadow-xs flex items-center justify-center gap-3 transition-all cursor-pointer mb-5 min-h-[44px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? 'Connecting to Google...' : 'Sign in with Google'}</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#111111]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono font-bold">
              <span className="bg-white px-2 text-[#111111]/60">Or continue with credentials</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#111111]/50">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="trader@domain.com"
                  className="block w-full pl-9 pr-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono placeholder-[#111111]/40 outline-none transition-colors min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="login-password" className="text-xs font-bold text-[#111111] uppercase tracking-wider font-mono">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#111111]/50">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono placeholder-[#111111]/40 outline-none transition-colors min-h-[44px]"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] font-mono font-bold text-xs uppercase tracking-wider border-2 border-[#111111] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Verifying Credentials...
                  </span>
                ) : (
                  <>
                    <span>Authenticate & Enter Desk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Demo Option */}
          <div className="mt-4 pt-4 border-t border-[#D8D2C4]">
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={loading}
              className="w-full py-2.5 px-3 bg-[#FAF8F3] hover:bg-[#EFECE3] border border-[#111111] text-[#111111] text-xs font-mono font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[40px]"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Instant 1-Click Demo Account</span>
            </button>
          </div>

          <div className="mt-6 text-center text-xs font-news text-[#111111]/80">
            Need an account?{' '}
            <Link to="/signup" className="font-bold text-[#111111] underline hover:text-stone-700">
              Open a Paper Trading Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
