import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Globe2, 
  ArrowRight, 
  Lock, 
  Mail, 
  User, 
  AlertCircle,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

export default function SignupPage() {
  const { signup, signInWithGoogle, geoData, currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tradingStyle, setTradingStyle] = useState('Day & Swing Trading');
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

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      await signup({
        fullName,
        email,
        password,
        targetCurrency: geoData?.currency || 'INR',
        defaultMarket: geoData?.defaultMarket || 'NSE',
        tradingStyle,
      });
      toast.success('Paper Trading Account Created!', {
        description: `Welcome ${fullName}. Both Indian & Foreign virtual accounts are ready!`,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Failed to create account.';
      if (msg.includes('email-already-in-use')) {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (msg.includes('invalid-email')) {
        msg = 'Please enter a valid email address.';
      }
      setError(msg);
      toast.error('Signup Failed', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');
    try {
      setGoogleLoading(true);
      await signInWithGoogle();
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

  return (
    <div className="min-h-[calc(100vh-110px)] bg-[#F6F4EE] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 text-[#111111]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Paper Gazette Seal */}
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Paper Trading Logo"
            className="inline-block w-14 h-14 object-contain border-2 border-[#111111] bg-white p-1 shadow-xs mb-3"
          />
          <h2 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
            OPEN PAPER LEDGER
          </h2>
          <p className="mt-1 text-xs text-[#111111]/70 font-mono uppercase tracking-wider">
            FREE VIRTUAL PORTFOLIO • DUAL MARKET ACCESS
          </p>
        </div>

        {/* Dynamic Location / Currency Detection Banner */}
        <div className="mt-6 newspaper-photo-plate bg-[#FAF8F3] p-4">
          <div className="flex items-start gap-2.5">
            <Globe2 className="w-4 h-4 text-emerald-800 mt-0.5 shrink-0" />
            <div className="text-xs font-mono">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[#111111] uppercase">
                  Detected Location:
                </span>
                <span className="px-1.5 py-0.5 bg-white border border-[#111111] font-bold text-[#111111]">
                  {geoData ? `${geoData.countryName} (${geoData.countryCode})` : 'Detecting your region...'}
                </span>
              </div>
              <p className="mt-1.5 text-[#111111]/80 font-news leading-relaxed">
                Home currency auto-set to{' '}
                <strong className="text-[#111111] font-mono font-bold">
                  {geoData?.currency === 'INR' ? '₹ INR (Indian Rupee)' : '$ USD (US Dollar)'}
                </strong>
                . All international markets & currencies are open to everyone worldwide.
              </p>
            </div>
          </div>
        </div>

        {/* Paper Registration Card */}
        <div className="mt-4 newspaper-photo-plate bg-white p-6 sm:p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border-2 border-red-800 text-red-900 text-xs flex items-center gap-2 font-bold font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-800" />
              <span>{error}</span>
            </div>
          )}

          {/* Sign Up with Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
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
            <span>{googleLoading ? 'Connecting to Google...' : 'Sign up with Google'}</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#111111]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono font-bold">
              <span className="bg-white px-2 text-[#111111]/60">Or register with credentials</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="signup-name" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Full Name / Trader Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#111111]/50">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Arjun Sharma or Sarah Miller"
                  className="block w-full pl-9 pr-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono placeholder-[#111111]/40 outline-none transition-colors min-h-[44px]"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="signup-email" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#111111]/50">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="block w-full pl-9 pr-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono placeholder-[#111111]/40 outline-none transition-colors min-h-[44px]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="signup-password" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#111111]/50">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono placeholder-[#111111]/40 outline-none transition-colors min-h-[44px]"
                />
              </div>
              <p className="mt-1 text-[10px] text-[#111111]/60 font-mono">Minimum 6 characters. Encrypted via Firebase Auth.</p>
            </div>

            {/* Trading Style */}
            <div>
              <label htmlFor="signup-style" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Learning Goal / Trading Focus
              </label>
              <select
                id="signup-style"
                value={tradingStyle}
                onChange={(e) => setTradingStyle(e.target.value)}
                className="block w-full px-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] font-mono text-xs outline-none cursor-pointer min-h-[44px]"
              >
                <option value="Beginner Learning Market Fundamentals">Beginner: Learning Market Fundamentals</option>
                <option value="Day & Swing Trading Practice">Day & Swing Trading Practice</option>
                <option value="Long-term Equity & Portfolio Building">Long-term Equity & Portfolio Building</option>
                <option value="Options & Multi-market Speculation">Options & Multi-market Speculation</option>
              </select>
            </div>

            {/* Included Virtual Capital Perks (Both Markets Unlocked) */}
            <div className="p-3.5 bg-[#FAF8F3] border-2 border-[#111111] space-y-2">
              <div className="text-[11px] font-mono font-bold uppercase text-[#111111] tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Instant Risk-Free Capital Allocated:</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white border border-[#111111]">
                  <div className="text-[10px] text-[#111111]/70 font-mono uppercase">Indian Stocks (NSE)</div>
                  <div className="font-mono font-bold text-emerald-900 text-sm">₹10,00,000 INR</div>
                </div>
                <div className="p-2 bg-white border border-[#111111]">
                  <div className="text-[10px] text-[#111111]/70 font-mono uppercase">US Stocks (NASDAQ)</div>
                  <div className="font-mono font-bold text-sky-900 text-sm">$100,000 USD</div>
                </div>
              </div>
              <p className="text-[10px] text-[#111111]/70 italic pt-1 font-news">
                Zero real money at stake. Build your skills, test theories, and master the markets before investing real capital.
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] font-mono font-bold text-xs uppercase tracking-wider border-2 border-[#111111] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Opening Ledger...
                  </span>
                ) : (
                  <>
                    <span>Create Free Ledger Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-[#D8D2C4] text-center text-xs font-news text-[#111111]/80">
            Already have a paper trading account?{' '}
            <Link to="/login" className="font-bold text-[#111111] underline hover:text-stone-700">
              Sign In Here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
