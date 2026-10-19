import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserPreferences, VirtualAccount } from '@globaltrade/shared';
import { ApiClient } from '../lib/apiClient';

interface AuthContextType {
  user: UserProfile | null;
  preferences: UserPreferences | null;
  account: VirtualAccount | null;
  accounts: VirtualAccount[];
  isLoading: boolean;
  loginAsDemo: () => Promise<void>;
  logout: () => void;
  refreshAccount: () => Promise<void>;
  switchAccount: (accountId: string) => Promise<void>;
  createAccount: (countryCode: string, currency: string, initialBalance: number, name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [account, setAccount] = useState<VirtualAccount | null>(null);
  const [accounts, setAccounts] = useState<VirtualAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrentUser = async () => {
    try {
      const data = await ApiClient.get<{
        user: UserProfile;
        preferences: UserPreferences;
        account: VirtualAccount;
      }>('/auth/me');

      setUser(data.user);
      setPreferences(data.preferences);
      setAccount(data.account);

      const accRes = await ApiClient.get<{ accounts: VirtualAccount[]; activeAccountId: string }>('/auth/accounts');
      setAccounts(accRes.accounts);
    } catch (err) {
      console.warn('Failed to load user session:', err);
      // Fallback guest state
      setUser(null);
      setAccount(null);
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If no token exists, set demo token initially
    if (!localStorage.getItem('gt_auth_token')) {
      localStorage.setItem('gt_auth_token', 'mock_token_demo_trader_1');
    }
    fetchCurrentUser();
  }, []);

  const loginAsDemo = async () => {
    setIsLoading(true);
    localStorage.setItem('gt_auth_token', 'mock_token_demo_trader_1');
    await fetchCurrentUser();
  };

  const logout = () => {
    localStorage.removeItem('gt_auth_token');
    setUser(null);
    setAccount(null);
  };

  const refreshAccount = async () => {
    try {
      const data = await ApiClient.get<{
        user: UserProfile;
        preferences: UserPreferences;
        account: VirtualAccount;
      }>('/auth/me');
      setAccount(data.account);
    } catch {
      // safe fallback
    }
  };

  const switchAccount = async (accountId: string) => {
    try {
      const res = await ApiClient.post<{ success: boolean; account: VirtualAccount }>('/auth/accounts/switch', { accountId });
      setAccount(res.account);
      await fetchCurrentUser();
    } catch (err) {
      console.error('Failed to switch virtual account:', err);
    }
  };

  const createAccount = async (countryCode: string, currency: string, initialBalance: number, name: string) => {
    try {
      await ApiClient.post('/auth/accounts/create', { countryCode, baseCurrency: currency, initialBalance, name });
      await fetchCurrentUser();
    } catch (err) {
      console.error('Failed to create virtual account:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      preferences,
      account,
      accounts,
      isLoading,
      loginAsDemo,
      logout,
      refreshAccount,
      switchAccount,
      createAccount
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
