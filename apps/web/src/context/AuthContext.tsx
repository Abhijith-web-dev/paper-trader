import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile, UserPreferences, VirtualAccount } from '@globaltrade/shared';
import { ApiClient } from '../lib/apiClient';

interface AuthContextType {
  user: UserProfile | null;
  preferences: UserPreferences | null;
  account: VirtualAccount | null;
  isLoading: boolean;
  loginAsDemo: () => Promise<void>;
  logout: () => void;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [account, setAccount] = useState<VirtualAccount | null>(null);
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
    } catch (err) {
      console.warn('Failed to load user session:', err);
      // Fallback guest state
      setUser(null);
      setAccount(null);
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

  return (
    <AuthContext.Provider value={{
      user,
      preferences,
      account,
      isLoading,
      loginAsDemo,
      logout,
      refreshAccount
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
