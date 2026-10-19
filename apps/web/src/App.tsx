import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';

// Pages
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { MarketsPage } from './pages/MarketsPage';
import { InstrumentDetailPage } from './pages/InstrumentDetailPage';
import { ForexPage } from './pages/ForexPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { OrdersPage } from './pages/OrdersPage';
import { WatchlistsPage } from './pages/WatchlistsPage';
import { AlertsPage } from './pages/AlertsPage';
import { BacktestPage } from './pages/BacktestPage';
import { LearnPage } from './pages/LearnPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { MarketCoveragePage } from './pages/MarketCoveragePage';
import { JournalPage } from './pages/JournalPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
      retry: 1
    }
  }
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={<LandingPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="markets" element={<MarketsPage />} />
              <Route path="markets/coverage" element={<MarketCoveragePage />} />
              <Route path="markets/:exchange" element={<MarketsPage />} />
              <Route path="instrument/:symbol" element={<InstrumentDetailPage />} />
              <Route path="forex" element={<ForexPage />} />
              <Route path="portfolio" element={<PortfolioPage />} />
              <Route path="portfolio/holdings" element={<PortfolioPage />} />
              <Route path="journal" element={<JournalPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="trade-history" element={<OrdersPage />} />
              <Route path="watchlists" element={<WatchlistsPage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="backtesting" element={<BacktestPage />} />
              <Route path="strategies" element={<BacktestPage />} />
              <Route path="learn" element={<LearnPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="admin" element={<AdminPage />} />
              <Route path="login" element={<LoginPage />} />
              <Route path="register" element={<LoginPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
