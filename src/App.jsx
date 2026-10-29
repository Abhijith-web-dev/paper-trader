import React, { Component, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TradingToolsProvider } from './context/TradingToolsContext';
import { Toaster } from 'sonner';
import Navbar from './components/Navbar';
import MonetagAdManager from './components/MonetagAdManager';
import { ExternalLink } from 'lucide-react';
import { lazyWithRetry } from './lib/lazyWithRetry';

// Code-split pages wrapped with auto-recovering chunk loader for deployment resilience
const HomePage = lazyWithRetry(() => import('./pages/HomePage'), 'HomePage');
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'), 'LoginPage');
const SignupPage = lazyWithRetry(() => import('./pages/SignupPage'), 'SignupPage');
const OnboardingPage = lazyWithRetry(() => import('./pages/OnboardingPage'), 'OnboardingPage');
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'), 'DashboardPage');
const StockDetailPage = lazyWithRetry(() => import('./pages/StockDetailPage'), 'StockDetailPage');
const JournalPage = lazyWithRetry(() => import('./pages/JournalPage'), 'JournalPage');
const ScreenerPage = lazyWithRetry(() => import('./pages/ScreenerPage'), 'ScreenerPage');
const TransactionsPage = lazyWithRetry(() => import('./pages/TransactionsPage'), 'TransactionsPage');
const BacktestPage = lazyWithRetry(() => import('./pages/BacktestPage'), 'BacktestPage');
const DisclaimerPage = lazyWithRetry(() => import('./pages/DisclaimerPage'), 'DisclaimerPage');
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'), 'PrivacyPage');
const TermsPage = lazyWithRetry(() => import('./pages/TermsPage'), 'TermsPage');
const GuidePage = lazyWithRetry(() => import('./pages/GuidePage'), 'GuidePage');
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'), 'NotFoundPage');

// Ultra-lightweight broadsheet skeleton loader
const PageLoader = () => (
  <div className="min-h-[50vh] flex items-center justify-center p-8 font-mono text-xs text-[#111111]">
    <div className="flex items-center gap-2 px-3 py-1.5 border border-[#111111] bg-white shadow-xs">
      <span className="w-2 h-2 bg-[#111111] animate-ping" />
      <span className="font-bold uppercase tracking-wider">DISPATCHING MARKET DATA...</span>
    </div>
  </div>
);

// Resilient Error Boundary to eliminate blank white screens permanently
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App ErrorBoundary caught rendering exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center p-4 font-mono text-xs text-[#111111]">
          <div className="newspaper-photo-plate p-6 max-w-lg w-full bg-white border-2 border-[#111111] space-y-4 text-center">
            <h2 className="font-headline uppercase font-black text-2xl text-red-900">
              Exchange Dispatch Notice
            </h2>
            <p className="font-news text-sm text-[#111111]/80">
              A rendering exception occurred while loading this stock terminal. All portfolio holdings and ledger balances remain secure in local memory.
            </p>
            <div className="p-3 bg-red-50 border border-red-800 text-red-950 text-left text-[11px] overflow-auto max-h-28 break-words font-mono">
              {this.state.error?.message || 'Display exception caught'}
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#111111] text-[#F6F4EE] font-bold text-xs hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Reload Terminal
              </button>
              <button
                onClick={() => {
                  try {
                    sessionStorage.clear();
                    Object.keys(localStorage).forEach((k) => {
                      if (k.startsWith('chart_') || k.startsWith('candles_') || k.startsWith('omnifeed_')) {
                        localStorage.removeItem(k);
                      }
                    });
                  } catch {}
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/dashboard';
                }}
                className="px-4 py-2 bg-[#FAF8F3] border-2 border-amber-900 text-amber-950 font-bold text-xs hover:bg-amber-100 transition-colors cursor-pointer"
              >
                Safe Reset & Recover
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/dashboard';
                }}
                className="px-4 py-2 bg-white border-2 border-[#111111] text-[#111111] font-bold text-xs hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route wrapper with mandatory onboarding check
function ProtectedRoute({ children }) {
  const { currentUser, userProfile, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center font-mono text-xs text-stone-500">
        <span className="w-4 h-4 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mr-2" />
        Reading Paper Ledger...
      </div>
    );
  }
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Home Route: Logged-in users cannot visit Front Page and are sent directly to /dashboard
function PublicOnlyHomeRoute() {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }
  return <HomePage />;
}

// Onboarding Route wrapper: only accessible when logged in but NOT yet onboarded
function OnboardingRoute({ children }) {
  const { currentUser, userProfile, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (userProfile && userProfile.profile?.isOnboarded === true) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TradingToolsProvider>
          <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F6F4EE] flex flex-col font-sans text-[#111111] selection:bg-[#111111] selection:text-[#F6F4EE]">
            <Toaster 
              position="top-right" 
              toastOptions={{
                style: {
                  background: '#FFFFFF',
                  color: '#111111',
                  border: '2px solid #111111',
                  borderRadius: '0px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                },
              }}
            />
            <Navbar />
            <ErrorBoundary>
              <main className="flex-1">
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<PublicOnlyHomeRoute />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route 
                      path="/onboarding" 
                      element={
                        <OnboardingRoute>
                          <OnboardingPage />
                        </OnboardingRoute>
                      } 
                    />
                    <Route 
                      path="/dashboard" 
                      element={
                        <ProtectedRoute>
                          <DashboardPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/journal" 
                      element={
                        <ProtectedRoute>
                          <JournalPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/screener" 
                      element={
                        <ProtectedRoute>
                          <ScreenerPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/transactions" 
                      element={
                        <ProtectedRoute>
                          <TransactionsPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/stock/:symbol" 
                      element={
                        <ProtectedRoute>
                          <StockDetailPage />
                        </ProtectedRoute>
                      } 
                    />
                    <Route 
                      path="/backtest" 
                      element={
                        <ProtectedRoute>
                          <BacktestPage />
                        </ProtectedRoute>
                      } 
                    />
                    {/* Public Legal, Educational & Information Routes */}
                    <Route path="/disclaimer" element={<DisclaimerPage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/terms" element={<TermsPage />} />
                    <Route path="/guide" element={<GuidePage />} />
                    <Route path="/academy" element={<GuidePage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </Suspense>
              </main>
            </ErrorBoundary>
            
            {/* Monetag Ads Monetization: In-Page Push & Vignette Interstitial Manager */}
            <MonetagAdManager />
            
            {/* Authentic Vintage Broadsheet Footer */}
            <footer className="border-t-4 border-double border-[#111111] bg-[#F6F4EE] py-6 px-4 text-center text-xs font-mono text-[#111111]">
              <div className="max-w-7xl mx-auto space-y-3.5">
                <div className="flex flex-wrap justify-center items-center gap-3 text-[11px] font-bold uppercase tracking-wider">
                  <span>PAPER TRADING</span>
                  <span>•</span>
                  <span>ESTABLISHED 2026</span>
                  <span>•</span>
                  <span>BOMBAY (NSE) & NEW YORK (NASDAQ)</span>
                  <span>•</span>
                  <span>100% VIRTUAL CAPITAL</span>
                </div>

                {/* Direct Legal & Educational Navigation Links */}
                <div className="flex flex-wrap justify-center items-center gap-4 text-[11px] font-bold">
                  <Link to="/guide" className="hover:underline flex items-center gap-1">
                    <span>Trader's Guide & Academy</span>
                  </Link>
                  <span className="text-neutral-400">|</span>
                  <Link to="/disclaimer" className="hover:underline flex items-center gap-1 text-amber-900">
                    <span>Virtual Risk Disclaimer</span>
                  </Link>
                  <span className="text-neutral-400">|</span>
                  <Link to="/privacy" className="hover:underline">
                    Privacy Policy
                  </Link>
                  <span className="text-neutral-400">|</span>
                  <Link to="/terms" className="hover:underline">
                    Terms of Use
                  </Link>
                </div>

                {/* Developer Credit & Portfolio Attribution */}
                <div className="pt-2 border-t border-[#D8D2C4] max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-2 text-[11px] text-[#111111]/80">
                  <span>Site Engineered & Produced by</span>
                  <a
                    href="https://abhijith-dev-io.web.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-[#111111] underline hover:text-emerald-800 transition-colors inline-flex items-center gap-1"
                  >
                    <span>Abhijith S</span>
                    <ExternalLink className="w-3 h-3 text-neutral-500" />
                  </a>
                  <span className="text-neutral-400">•</span>
                  <span>Portfolio:</span>
                  <a
                    href="https://abhijith-dev-io.web.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline hover:text-emerald-800 transition-colors"
                  >
                    abhijith-dev-io.web.app
                  </a>
                </div>

                <p className="text-[10px] text-[#111111]/60 uppercase tracking-widest max-w-3xl mx-auto leading-relaxed pt-1">
                  ALL TRADING IS SIMULATED FOR EDUCATIONAL HYPOTHESIS TESTING • STRICTLY NON-BROKERED • ZERO REAL MONEY REQUIRED OR AT RISK • LOCAL-FIRST INDEXEDDB ARCHITECTURE
                </p>
              </div>
            </footer>
          </div>
        </TradingToolsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
