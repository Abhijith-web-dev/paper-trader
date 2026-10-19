import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { TrendingUp, ShieldCheck, ArrowRight, Lock, Mail, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginAsDemo } = useAuth();
  const navigate = useNavigate();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDemoSignIn = async () => {
    setLoading(true);
    await loginAsDemo();
    navigate('/dashboard');
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md p-8 md:p-10 rounded-3xl bg-[#0B0F14] border border-[#1B222D] shadow-2xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-3xl bg-[#CCFF00] flex items-center justify-center text-black font-extrabold mx-auto shadow-lg shadow-[#CCFF00]/20">
            <TrendingUp className="w-7 h-7 text-black stroke-[3]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            {isRegister ? 'Create Simulator Account' : 'Sign in to GlobalTrade'}
          </h1>
          <p className="text-xs text-slate-400">
            Educational trading simulator with real live market data
          </p>
        </div>

        {/* 1-Click Instant Demo Access (Recommended) */}
        <button
          onClick={handleDemoSignIn}
          disabled={loading}
          className="w-full py-4 px-5 rounded-full bg-[#CCFF00] hover:bg-[#D4FF33] text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#CCFF00]/15"
        >
          <Sparkles className="w-4 h-4 fill-black" />
          <span>Launch Instant Demo ($100k Virtual Cash)</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#1B222D] w-full"></div>
          <span className="bg-[#0B0F14] px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
            Or Firebase Auth
          </span>
          <div className="border-t border-[#1B222D] w-full"></div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-slate-400 font-bold">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl pl-11 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-400 font-bold">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#10151C] border border-[#1B222D] rounded-2xl pl-11 pr-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-[#CCFF00]"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-full bg-[#10151C] hover:border-[#CCFF00] hover:text-[#CCFF00] text-white font-extrabold text-xs transition-colors border border-[#1B222D]"
          >
            {isRegister ? 'Register Account' : 'Sign In'}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-xs text-[#CCFF00] hover:underline font-bold"
          >
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        {/* Disclaimer */}
        <div className="pt-2 text-center text-[10px] text-slate-500 flex items-center justify-center gap-1.5 font-bold">
          <ShieldCheck className="w-4 h-4 text-[#CCFF00]" />
          <span>Educational Simulator • Virtual Funds Only</span>
        </div>
      </div>
    </div>
  );
};
