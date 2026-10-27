import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  Globe2,
  AlertCircle 
} from 'lucide-react';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const { currentUser, userProfile, geoData, completeOnboarding } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('India');
  const [tradingStyle, setTradingStyle] = useState('Day & Swing Trading');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.displayName || userProfile?.profile?.fullName || '');
      const defaultUser = (currentUser.displayName || currentUser.email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      setUsername(`@${defaultUser}`);
    }

    if (geoData) {
      setCity(geoData.city || '');
      setCountry(geoData.countryName || 'India');
    }
  }, [currentUser, geoData, userProfile]);

  // If already onboarded, send to dashboard
  useEffect(() => {
    if (userProfile?.profile?.isOnboarded === true) {
      navigate('/dashboard');
    }
  }, [userProfile, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!agreed) {
      setError('Please acknowledge that this is a risk-free virtual paper trading simulation.');
      return;
    }

    try {
      setLoading(true);
      await completeOnboarding({
        fullName,
        username,
        phone,
        city,
        country,
        tradingStyle,
      });

      toast.success('Account Details Complete!', {
        description: 'Your paper trading wallets and market access are now active.',
      });
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to complete account registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-110px)] bg-[#F6F4EE] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 text-[#111111]">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        {/* Paper Gazette Seal */}
        <div className="text-center">
          <img
            src="/logo.png"
            alt="Paper Trading Logo"
            className="inline-block w-14 h-14 object-contain border-2 border-[#111111] bg-white p-1 shadow-xs mb-3"
          />
          <h2 className="font-headline uppercase font-black text-3xl sm:text-4xl text-[#111111] tracking-tight">
            COMPLETE TRADER PROFILE
          </h2>
          <p className="mt-1 text-xs text-[#111111]/70 font-mono uppercase tracking-wider">
            MANDATORY ACCOUNT VERIFICATION • UNLOCK VIRTUAL TRADING
          </p>
        </div>

        {/* Paper Onboarding Card */}
        <div className="mt-6 newspaper-photo-plate bg-white p-6 sm:p-8">
          <div className="mb-5 pb-3 border-b-2 border-[#111111] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <span className="text-xs font-mono font-bold text-[#111111]">
                Authenticated: {currentUser?.email}
              </span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#111111] text-[#F6F4EE] font-bold uppercase">
              Step 2 of 2
            </span>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border-2 border-red-800 text-red-900 text-xs flex items-center gap-2 font-bold font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-800" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="onboarding-name" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Full Legal / Trader Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#111111]/50">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="onboarding-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Arjun Sharma"
                  className="block w-full pl-9 pr-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono outline-none min-h-[44px]"
                />
              </div>
            </div>

            {/* Username Handle */}
            <div>
              <label htmlFor="onboarding-username" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Trader Handle / Desk Username
              </label>
              <input
                id="onboarding-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@arjun_trader"
                className="block w-full px-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono outline-none min-h-[44px]"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label htmlFor="onboarding-phone" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Mobile / Phone Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#111111]/50">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="onboarding-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="block w-full pl-9 pr-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono outline-none min-h-[44px]"
                />
              </div>
            </div>

            {/* Location (City & Country) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="onboarding-city" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                  City
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#111111]/50">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    id="onboarding-city"
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Mumbai / New York"
                    className="block w-full pl-9 pr-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono outline-none min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="onboarding-country" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                  Country
                </label>
                <input
                  id="onboarding-country"
                  type="text"
                  required
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="India"
                  className="block w-full px-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono outline-none min-h-[44px]"
                />
              </div>
            </div>

            {/* Trading Style Focus */}
            <div>
              <label htmlFor="onboarding-style" className="block text-xs font-bold text-[#111111] uppercase tracking-wider mb-1 font-mono">
                Primary Trading Experience / Focus
              </label>
              <select
                id="onboarding-style"
                value={tradingStyle}
                onChange={(e) => setTradingStyle(e.target.value)}
                className="block w-full px-3 py-2 bg-[#FAF8F3] border-2 border-[#111111] focus:bg-white text-[#111111] text-xs font-mono outline-none cursor-pointer min-h-[44px]"
              >
                <option value="Beginner Learning Market Fundamentals">Beginner: Learning Market Fundamentals</option>
                <option value="Day & Swing Trading Practice">Day & Swing Trading Practice</option>
                <option value="Options & Derivatives Practice">Options & Derivatives Practice</option>
                <option value="Long-term Equity & Portfolio Building">Long-term Equity & Portfolio Building</option>
              </select>
            </div>

            {/* Risk & Simulation Agreement */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="Acknowledge paper trading simulation charter"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-black cursor-pointer"
                />
                <span className="text-xs text-[#111111]/80 leading-relaxed font-news">
                  I acknowledge that Paper Trading is a 100% risk-free virtual simulator. All trades are executed with virtual cash (₹10,00,000 INR & $100,000 USD) for learning purposes.
                </span>
              </label>
            </div>

            {/* Submit & Unlock Trading */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-[#111111] hover:bg-stone-800 text-[#F6F4EE] font-mono font-bold text-xs uppercase tracking-wider border-2 border-[#111111] shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[44px]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Details & Initializing Wallets...
                  </span>
                ) : (
                  <>
                    <span>Complete Details & Unlock Trading</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
