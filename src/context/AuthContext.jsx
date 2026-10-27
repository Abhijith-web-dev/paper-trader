import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  auth, 
  firestore,
  database, 
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  isFirebaseConfigured, 
  googleProvider,
  signInWithPopup,
  ref, 
  set, 
  get, 
  update, 
  onValue 
} from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth';
import { detectUserLocationAndCurrency } from '../lib/geo';
import { isMarketOpenForSymbol } from '../lib/marketHours';
import { localDb } from '../lib/localDb';
import { 
  recordFirestoreRead, 
  recordFirestoreWrite, 
  recordFirestoreWriteSaved, 
  recordFirestoreReadSaved 
} from '../lib/cloudQuotaManager';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseActive, setFirebaseActive] = useState(isFirebaseConfigured);

  // Sync state tracking for Local-First architecture
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'unsynced' | 'syncing' | 'synced' | 'error'
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => {
    try {
      return Number(localStorage.getItem('paper_trading_last_sync_time')) || null;
    } catch {
      return null;
    }
  });
  const [syncError, setSyncError] = useState(null);

  // Firestore & RTDB Quota Optimization Controls (Debounced Batch Writes & Zero-Op Avoidance)
  const syncDebounceTimerRef = useRef(null);
  const lastSyncedChecksumRef = useRef(null);

  // 1. Run Geolocation Detection on Mount
  useEffect(() => {
    let mounted = true;
    detectUserLocationAndCurrency().then((geo) => {
      if (mounted) setGeoData(geo);
    });
    return () => { mounted = false; };
  }, []);

  // Default virtual wallets for guaranteed balance integrity
  const createDefaultWallets = () => ({
    inr: {
      currency: 'INR',
      symbol: '₹',
      initialBalance: 1000000,
      cashBalance: 1000000,
      investedValue: 0,
      realizedPnL: 0,
    },
    usd: {
      currency: 'USD',
      symbol: '$',
      initialBalance: 100000,
      cashBalance: 100000,
      investedValue: 0,
      realizedPnL: 0,
    },
  });

  // Helper to load current local user data
  const loadLocalUserData = () => {
    try {
      const saved = localStorage.getItem('paper_trading_mock_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse local user data:', e);
    }
    return null;
  };

  // Merge remote Cloud data with local data and update memory & storage
  const mergeAndApplyRemoteProfile = (remoteData) => {
    if (!remoteData) return null;
    const local = loadLocalUserData() || {};

    const remoteTime = Number(remoteData.lastSyncedAt || remoteData.profile?.lastSyncedAt || 0);
    const localTime = Number(local.lastSyncedAt || local.profile?.lastSyncedAt || 0);

    // Merge orders so no trade from either device is ever dropped
    const mergedOrders = {
      ...(local.orders || {}),
      ...(remoteData.orders || {}),
    };

    // If remote is newer, or if remote has holdings while local is empty, adopt remote holdings
    const remoteHoldingsCount = Object.keys(remoteData.holdings || {}).length;
    const localHoldingsCount = Object.keys(local.holdings || {}).length;
    const isRemoteNewer = remoteTime >= localTime || (remoteHoldingsCount > 0 && localHoldingsCount === 0);

    const mergedHoldings = isRemoteNewer
      ? (remoteData.holdings || {})
      : { ...(remoteData.holdings || {}), ...(local.holdings || {}) };

    const mergedWallets = isRemoteNewer && remoteData.wallets
      ? {
          inr: { ...createDefaultWallets().inr, ...(remoteData.wallets.inr || {}) },
          usd: { ...createDefaultWallets().usd, ...(remoteData.wallets.usd || {}) },
        }
      : (local.wallets || remoteData.wallets || createDefaultWallets());

    const mergedProfile = {
      ...local,
      ...remoteData,
      profile: {
        ...(local.profile || {}),
        ...(remoteData.profile || {}),
        isOnboarded: true,
      },
      wallets: mergedWallets,
      holdings: mergedHoldings,
      orders: mergedOrders,
      lastSyncedAt: Math.max(remoteTime, localTime, Date.now()),
    };

    try {
      localStorage.setItem('paper_trading_mock_user', JSON.stringify(mergedProfile));
      localStorage.setItem('paper_trading_last_sync_time', String(mergedProfile.lastSyncedAt));
    } catch (e) {}

    setUserProfile(mergedProfile);
    setSyncStatus('synced');
    setLastSyncedAt(mergedProfile.lastSyncedAt);
    setPendingSyncCount(0);
    setSyncError(null);
    return mergedProfile;
  };

  // 2. Resilient Auth & Local-First State Initialization
  useEffect(() => {
    let mounted = true;
    let unsubscribeSnapshot = null;

    // Load local storage first (0ms initial startup, zero blocking)
    const isSessionActive = localStorage.getItem('paper_trading_session_active') === 'true';
    const localData = loadLocalUserData();
    if (localData && isSessionActive) {
      setUserProfile(localData);
      if (localData.profile?.uid) {
        setCurrentUser({
          uid: localData.profile.uid,
          email: localData.profile.email,
          displayName: localData.profile.fullName || localData.profile.displayName || 'Trader',
        });
      }
    }

    // Safety timeout to ensure app is never stuck on spinner (<150ms instant response)
    const safetyTimer = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
      }
    }, 150);

    if (firebaseActive && auth) {
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!mounted) return;

        if (user) {
          localStorage.setItem('paper_trading_session_active', 'true');
          setCurrentUser(user);

          // 1. Instant 0ms Local Paint: If local data exists for this user, display it immediately
          const existingLocal = loadLocalUserData();
          if (existingLocal && existingLocal.profile?.uid === user.uid) {
            setUserProfile(existingLocal);
          }
          clearTimeout(safetyTimer);
          setLoading(false);

          // 2. Attach Real-Time Firestore Snapshot Listener for multi-device sync
          // onSnapshot emits the current document state immediately upon subscription,
          // saving a redundant getDoc read and staying comfortably within the 50,000 free reads limit.
          if (firestore) {
            try {
              if (unsubscribeSnapshot) unsubscribeSnapshot();
              recordFirestoreReadSaved(1); // Saved redundant getDoc call!
              const userDocRef = doc(firestore, 'users', user.uid);
              unsubscribeSnapshot = onSnapshot(userDocRef, (snap) => {
                if (!mounted) return;
                // Ignore local pending writes to avoid redundant loop processing
                if (snap.metadata?.hasPendingWrites) {
                  return;
                }
                if (snap.exists && snap.exists()) {
                  recordFirestoreRead(1);
                  mergeAndApplyRemoteProfile(snap.data());
                } else if (!existingLocal) {
                  // New user without local or remote profile
                  const initialProfile = {
                    profile: {
                      uid: user.uid,
                      fullName: user.displayName || user.email?.split('@')[0] || 'Trader',
                      email: user.email || '',
                      avatarUrl: user.photoURL || '',
                      phone: '',
                      isOnboarded: false,
                      createdAt: Date.now(),
                    },
                    wallets: createDefaultWallets(),
                    holdings: {},
                    orders: {},
                  };
                  localStorage.setItem('paper_trading_mock_user', JSON.stringify(initialProfile));
                  setUserProfile(initialProfile);
                }
              }, (err) => {
                console.warn('[CloudSync] Realtime snapshot listener notice:', err.message);
              });
            } catch (snapErr) {
              console.warn('[CloudSync] Could not attach realtime snapshot listener:', snapErr.message);
            }
          } else if (database) {
            // RTDB fallback if Firestore is unavailable
            try {
              const userDbRef = ref(database, `users/${user.uid}`);
              const fetchPromise = get(userDbRef);
              const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 2000));
              const snap = await Promise.race([fetchPromise, timeoutPromise]);
              if (snap && snap.exists()) {
                mergeAndApplyRemoteProfile(snap.val());
              }
            } catch (err) {
              console.warn('[CloudSync] RTDB fallback notice:', err.message);
            }
          }
        } else {
          clearTimeout(safetyTimer);
          if (unsubscribeSnapshot) {
            unsubscribeSnapshot();
            unsubscribeSnapshot = null;
          }
          // If Firebase returns null, check if session is marked active in browser
          const sessionActive = localStorage.getItem('paper_trading_session_active') === 'true';
          const existingLocal = loadLocalUserData();
          if (sessionActive && existingLocal?.profile?.uid) {
            // Persist logged-in session across refreshes and restarts until explicit signout
            setCurrentUser({ 
              uid: existingLocal.profile.uid, 
              email: existingLocal.profile.email, 
              displayName: existingLocal.profile.fullName || existingLocal.profile.displayName || 'Trader' 
            });
            setUserProfile(existingLocal);
          } else {
            setCurrentUser(null);
            setUserProfile(null);
          }
          setLoading(false);
        }
      });

      return () => {
        mounted = false;
        clearTimeout(safetyTimer);
        unsubscribeAuth();
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      };
    } else {
      clearTimeout(safetyTimer);
      setLoading(false);
    }

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [firebaseActive]);

  // Direct Email/Password Signup
  const signup = async ({ fullName, email, password, targetCurrency, defaultMarket, tradingStyle }) => {
    const geo = geoData || { currency: 'INR', symbol: '₹', defaultMarket: 'NSE' };
    const currency = targetCurrency || geo.currency;
    const market = defaultMarket || (currency === 'INR' ? 'NSE' : 'US');

    const initialUserData = {
      profile: {
        fullName,
        email,
        tradingStyle: tradingStyle || 'Day & Swing Trader',
        country: geo.countryName || 'India',
        countryCode: geo.countryCode || 'IN',
        phone: '+91 9876543210',
        isOnboarded: true,
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
      },
      settings: {
        theme: 'paper',
        primaryCurrency: currency,
        defaultMarket: market,
        tactileAudio: true,
      },
      wallets: createDefaultWallets(),
      watchlist: {
        NSE: ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'TATAMOTORS.NS'],
        US: ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN'],
      },
      holdings: {},
      orders: {},
    };

    if (firebaseActive && auth) {
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: fullName });

        const userData = {
          ...initialUserData,
          profile: {
            ...initialUserData.profile,
            uid: user.uid,
            isOnboarded: true,
          },
        };

        if (firestore) {
          try {
            const userDocRef = doc(firestore, 'users', user.uid);
            await setDoc(userDocRef, userData);
          } catch (fsErr) {
            console.warn('Could not write to Firestore:', fsErr?.message);
          }
        }

        if (database) {
          const userDbRef = ref(database, `users/${user.uid}`);
          await set(userDbRef, userData).catch((err) => console.warn('Could not write to RTDB:', err));
        }

        await localDb.saveProfile(userData).catch(() => {});
        localStorage.setItem('paper_trading_session_active', 'true');
        setCurrentUser(user);
        setUserProfile(userData);
        return user;
      } catch (err) {
        throw err;
      }
    } else {
      const mockUid = 'local_' + Math.random().toString(36).substring(2, 9);
      const localRecord = {
        ...initialUserData,
        uid: mockUid,
        email,
        fullName,
      };
      localStorage.setItem('paper_trading_mock_user', JSON.stringify(localRecord));
      localStorage.setItem('paper_trading_session_active', 'true');
      setCurrentUser({ uid: mockUid, email, displayName: fullName });
      setUserProfile(localRecord);
      return localRecord;
    }
  };

  // Google Sign-In with mandatory profile onboarding check
  const signInWithGoogle = async () => {
    if (firebaseActive && auth && googleProvider) {
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;

        let existingData = null;

        // 1. Try Firestore first
        if (firestore) {
          try {
            const userDocRef = doc(firestore, 'users', user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap && docSnap.exists && docSnap.exists()) {
              existingData = docSnap.data();
            }
          } catch (fsErr) {
            console.warn('Firestore Google sign-in query notice:', fsErr?.message);
          }
        }

        // 2. Try RTDB if available
        if (!existingData && database) {
          try {
            const userDbRef = ref(database, `users/${user.uid}`);
            const snapshot = await get(userDbRef).catch(() => null);
            if (snapshot && snapshot.exists()) {
              existingData = snapshot.val();
            }
          } catch (rtdbErr) {
            console.warn('RTDB Google sign-in query notice:', rtdbErr?.message);
          }
        }

        if (!existingData) {
          // Needs initial account creation!
          const initialGoogleData = {
            profile: {
              uid: user.uid,
              fullName: user.displayName || 'Google Trader',
              email: user.email || '',
              avatarUrl: user.photoURL || '',
              country: geoData?.countryName || 'India',
              countryCode: geoData?.countryCode || 'IN',
              phone: '+91 9876543210',
              isOnboarded: true,
              createdAt: Date.now(),
              lastLoginAt: Date.now(),
            },
            wallets: createDefaultWallets(),
            watchlist: {
              NSE: ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'TATAMOTORS.NS'],
              US: ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN'],
            },
            holdings: {},
            orders: {},
          };

          if (firestore) {
            const userDocRef = doc(firestore, 'users', user.uid);
            await setDoc(userDocRef, initialGoogleData).catch(() => {});
          }
          if (database) {
            const userDbRef = ref(database, `users/${user.uid}`);
            await set(userDbRef, initialGoogleData).catch(() => {});
          }

          await localDb.saveProfile(initialGoogleData).catch(() => {});
          setUserProfile(initialGoogleData);
        } else {
          const merged = {
            ...existingData,
            profile: {
              ...existingData.profile,
              isOnboarded: true,
            },
          };
          await localDb.saveProfile(merged).catch(() => {});
          setUserProfile(merged);
        }

        setCurrentUser(user);
        return user;
      } catch (authErr) {
        if (authErr?.code === 'auth/popup-closed-by-user' || authErr?.code === 'auth/cancelled-popup-request') {
          console.log('Google Sign-In popup was closed by user.');
          return null;
        }
        throw authErr;
      }
    } else {
      const mockUid = 'google_demo_' + Math.random().toString(36).substring(2, 9);
      const mockUser = {
        uid: mockUid,
        email: 'google.trader@gmail.com',
        displayName: 'Google Demo Trader',
      };
      const initialData = {
        profile: {
          ...mockUser,
          fullName: 'Google Demo Trader',
          phone: '+91 9876543210',
          isOnboarded: true,
          createdAt: Date.now(),
        },
        wallets: createDefaultWallets(),
        holdings: {},
        orders: {},
      };
      localStorage.setItem('paper_trading_mock_user', JSON.stringify(initialData));
      setCurrentUser(mockUser);
      setUserProfile(initialData);
      return mockUser;
    }
  };

  // Complete Onboarding & Save To Firebase
  const completeOnboarding = async ({ fullName, phone, username, tradingStyle, city, country }) => {
    const geo = geoData || { currency: 'INR', symbol: '₹', defaultMarket: 'NSE' };
    const isIndia = (country || geo.countryName) === 'India' || geo.countryCode === 'IN';

    const fullProfileData = {
      profile: {
        uid: currentUser?.uid || 'trader',
        fullName: fullName || currentUser?.displayName || 'Trader',
        email: currentUser?.email || '',
        phone: phone || '',
        username: username || `@trader_${Date.now().toString().slice(-4)}`,
        tradingStyle: tradingStyle || 'Day & Swing Trader',
        city: city || geo.city || '',
        country: country || geo.countryName || 'India',
        countryCode: geo.countryCode || 'IN',
        isOnboarded: true, // Mark verified!
        completedAt: Date.now(),
        lastLoginAt: Date.now(),
      },
      settings: {
        theme: 'paper',
        primaryCurrency: isIndia ? 'INR' : 'USD',
        defaultMarket: isIndia ? 'NSE' : 'US',
        tactileAudio: true,
      },
      wallets: createDefaultWallets(),
      watchlist: {
        NSE: ['RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'TATAMOTORS.NS'],
        US: ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN'],
      },
      holdings: {},
      orders: {},
    };

    // 1. Save locally first (instant completion, 0ms latency)
    localStorage.setItem('paper_trading_mock_user', JSON.stringify(fullProfileData));
    setUserProfile(fullProfileData);
    setSyncStatus('unsynced');
    setPendingSyncCount((prev) => prev + 1);

    // 2. Non-blocking cloud attempt (does not delay UI or throw errors)
    if (firebaseActive && auth?.currentUser) {
      if (firestore) {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        setDoc(userDocRef, fullProfileData, { merge: true }).catch(() => {});
      }
      if (database) {
        const userDbRef = ref(database, `users/${auth.currentUser.uid}`);
        set(userDbRef, fullProfileData).catch(() => {});
      }
    }

    return fullProfileData;
  };

  // Signin implementation
  const signin = async (email, password) => {
    if (firebaseActive && auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem('paper_trading_session_active', 'true');
      return userCredential.user;
    } else {
      const saved = localStorage.getItem('paper_trading_mock_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.email === email || parsed.profile?.email === email) {
          localStorage.setItem('paper_trading_session_active', 'true');
          setCurrentUser({ uid: parsed.uid || parsed.profile?.uid, email: parsed.email || parsed.profile?.email, displayName: parsed.fullName || parsed.profile?.fullName });
          setUserProfile(parsed);
          return parsed;
        }
      }
      throw new Error('User not found. Please sign up or check your credentials.');
    }
  };

  // Signout implementation
  const logout = async () => {
    localStorage.removeItem('paper_trading_session_active');
    localStorage.removeItem('paper_trading_mock_user');
    sessionStorage.clear();
    if (firebaseActive && auth) {
      await signOut(auth).catch(() => {});
    }
    setCurrentUser(null);
    setUserProfile(null);
  };

  /**
   * Execute paper trade order (Buy / Sell)
   * Guaranteed Virtual Cash Deductions and Real-Time Ledger Updates
   */
  const executeOrder = async ({ symbol, name, market, action, quantity, price, currency, bypassMarketHours = false }) => {
    // 0. Enforce real-world exchange market hours (with sandbox override support)
    const marketCheck = isMarketOpenForSymbol(symbol);
    if (!marketCheck.isOpen && !bypassMarketHours) {
      throw new Error(
        `Exchange Closed: ${marketCheck.reason}. Orders cannot be filled when the market is closed.`
      );
    }

    const qty = Number(quantity);
    const orderPrice = Number(price);
    const isIndia = market === 'NSE' || currency === 'INR';
    const walletKey = isIndia ? 'inr' : 'usd';
    const currencySymbol = isIndia ? '₹' : '$';

    // Retrieve active profile and ensure cash balance is valid
    const currentProfile = userProfile || JSON.parse(localStorage.getItem('paper_trading_mock_user')) || {};
    const defaultWallets = createDefaultWallets();

    const currentWallets = {
      inr: {
        ...defaultWallets.inr,
        ...(currentProfile.wallets?.inr || {}),
        cashBalance: currentProfile.wallets?.inr?.cashBalance ?? 1000000,
      },
      usd: {
        ...defaultWallets.usd,
        ...(currentProfile.wallets?.usd || {}),
        cashBalance: currentProfile.wallets?.usd?.cashBalance ?? 100000,
      },
    };

    const wallet = currentWallets[walletKey];
    const holdings = currentProfile.holdings ? { ...currentProfile.holdings } : {};
    const orders = currentProfile.orders ? { ...currentProfile.orders } : {};

    const holdingKey = symbol.replace(/[^a-zA-Z0-9]/g, '_');
    const existingHolding = holdings[holdingKey];

    const orderId = 'ORD_' + Date.now();
    let updatedCashBalance = wallet.cashBalance;
    let updatedRealizedPnL = wallet.realizedPnL || 0;

    if (action === 'BUY') {
      const totalCost = Number((qty * orderPrice).toFixed(2));
      if (wallet.cashBalance < totalCost) {
        throw new Error(
          `Insufficient virtual cash! Required: ${currencySymbol}${totalCost.toLocaleString()}, Available: ${currencySymbol}${wallet.cashBalance.toLocaleString()}`
        );
      }

      updatedCashBalance = Number((wallet.cashBalance - totalCost).toFixed(2));

      if (existingHolding) {
        const totalOldCost = existingHolding.quantity * existingHolding.avgBuyPrice;
        const totalNewCost = totalOldCost + totalCost;
        const newQty = existingHolding.quantity + qty;
        holdings[holdingKey] = {
          ...existingHolding,
          quantity: newQty,
          avgBuyPrice: Number((totalNewCost / newQty).toFixed(2)),
          totalCost: Number(totalNewCost.toFixed(2)),
          lastUpdated: Date.now(),
        };
      } else {
        holdings[holdingKey] = {
          symbol,
          name: name || symbol,
          market: isIndia ? 'NSE' : 'US',
          currency: isIndia ? 'INR' : 'USD',
          quantity: qty,
          avgBuyPrice: orderPrice,
          totalCost,
          createdAt: Date.now(),
          lastUpdated: Date.now(),
        };
      }

      orders[orderId] = {
        id: orderId,
        symbol,
        name: name || symbol,
        market: isIndia ? 'NSE' : 'US',
        currency: isIndia ? 'INR' : 'USD',
        action: 'BUY',
        quantity: qty,
        price: orderPrice,
        totalAmount: totalCost,
        status: 'FILLED',
        timestamp: Date.now(),
      };
    } else if (action === 'SELL') {
      if (!existingHolding || existingHolding.quantity < qty) {
        throw new Error(`Insufficient shares! You own ${existingHolding?.quantity || 0} shares of ${symbol}.`);
      }

      const totalProceeds = Number((qty * orderPrice).toFixed(2));
      const costBasis = Number((qty * existingHolding.avgBuyPrice).toFixed(2));
      const tradeRealizedPnL = Number((totalProceeds - costBasis).toFixed(2));

      updatedCashBalance = Number((wallet.cashBalance + totalProceeds).toFixed(2));
      updatedRealizedPnL = Number((updatedRealizedPnL + tradeRealizedPnL).toFixed(2));

      if (existingHolding.quantity === qty) {
        delete holdings[holdingKey];
      } else {
        const remainingQty = existingHolding.quantity - qty;
        const remainingCost = Number((remainingQty * existingHolding.avgBuyPrice).toFixed(2));
        holdings[holdingKey] = {
          ...existingHolding,
          quantity: remainingQty,
          totalCost: remainingCost,
          lastUpdated: Date.now(),
        };
      }

      const exitReturnPct = existingHolding.avgBuyPrice > 0 
        ? Number((((orderPrice - existingHolding.avgBuyPrice) / existingHolding.avgBuyPrice) * 100).toFixed(2)) 
        : 0;

      orders[orderId] = {
        id: orderId,
        symbol,
        name: name || symbol,
        market: isIndia ? 'NSE' : 'US',
        currency: isIndia ? 'INR' : 'USD',
        action: 'SELL',
        quantity: qty,
        price: orderPrice,
        avgBuyPrice: existingHolding.avgBuyPrice,
        costBasis: costBasis,
        totalAmount: totalProceeds,
        realizedPnL: tradeRealizedPnL,
        returnPercent: exitReturnPct,
        status: 'FILLED',
        timestamp: Date.now(),
      };
    }

    // Auto-record verified execution into IndexedDB Journal for 100% data fidelity
    try {
      const { db } = await import('../lib/localDb');
      const { calculateEstimatedCharges } = await import('../lib/journalAnalytics');
      const charges = calculateEstimatedCharges(isIndia ? 'IN' : 'US', action, orderPrice * qty, qty);

      if (action === 'BUY') {
        await db.journal.add({
          date: new Date().toISOString(),
          symbol,
          name: name || symbol,
          market: isIndia ? 'IN' : 'US',
          currency: isIndia ? 'INR' : 'USD',
          action: 'BUY',
          qty,
          entryPrice: orderPrice,
          exitPrice: 0,
          pnl: 0,
          netPnl: 0,
          fees: charges.total,
          returnPercent: 0,
          strategy: 'System Execution',
          tags: ['System Execution', 'Open Position'],
          notes: `System Execution: Bought ${qty} shares at ${currencySymbol}${orderPrice}`,
          rating: null,
          emotion: null,
          planFollowed: null,
          isSystemGenerated: true,
          hasUserReview: false,
          orderId,
        });
      } else if (action === 'SELL') {
        const exitReturnPct = existingHolding.avgBuyPrice > 0 
          ? Number((((orderPrice - existingHolding.avgBuyPrice) / existingHolding.avgBuyPrice) * 100).toFixed(2)) 
          : 0;
        const netPnl = Number((tradeRealizedPnL - charges.total).toFixed(2));
        await db.journal.add({
          date: new Date().toISOString(),
          symbol,
          name: name || symbol,
          market: isIndia ? 'IN' : 'US',
          currency: isIndia ? 'INR' : 'USD',
          action: 'SELL',
          qty,
          entryPrice: existingHolding.avgBuyPrice,
          exitPrice: orderPrice,
          pnl: tradeRealizedPnL,
          netPnl,
          fees: charges.total,
          returnPercent: exitReturnPct,
          strategy: 'System Execution',
          tags: ['System Execution', tradeRealizedPnL >= 0 ? 'Gain' : 'Loss'],
          notes: `System Execution: Sold ${qty} shares at ${currencySymbol}${orderPrice}. Entry cost was ${currencySymbol}${existingHolding.avgBuyPrice}. Realized P&L: ${currencySymbol}${tradeRealizedPnL}`,
          rating: null,
          emotion: null,
          planFollowed: null,
          isSystemGenerated: true,
          hasUserReview: false,
          orderId,
        });
      }
    } catch (jErr) {
      console.warn('Journal auto-log notice:', jErr);
    }

    // Compute updated invested value
    let newInvestedValue = 0;
    Object.values(holdings).forEach((h) => {
      if ((isIndia && (h.market === 'NSE' || h.currency === 'INR')) || (!isIndia && (h.market === 'US' || h.currency === 'USD'))) {
        newInvestedValue += h.totalCost || 0;
      }
    });

    const updatedWallets = {
      ...currentWallets,
      [walletKey]: {
        ...wallet,
        cashBalance: updatedCashBalance,
        investedValue: Number(newInvestedValue.toFixed(2)),
        realizedPnL: updatedRealizedPnL,
      },
    };

    const updatedUserData = {
      ...currentProfile,
      wallets: updatedWallets,
      holdings,
      orders,
      lastSyncedAt: Date.now(),
    };

    // 1. STORE IN LOCAL BROWSER FIRST (Instant 0ms execution, zero network errors)
    localStorage.setItem('paper_trading_mock_user', JSON.stringify(updatedUserData));
    setUserProfile(updatedUserData);

    // 2. Seamless Auto-Sync to Firebase Cloud in background (Debounced to save Firestore write quota)
    if (auth?.currentUser) {
      syncToCloudDebounced(updatedUserData);
    } else {
      setSyncStatus('unsynced');
      setPendingSyncCount((prev) => prev + 1);
    }

    return orders[orderId];
  };

  /**
   * Debounced Cloud Sync: Batches rapid executions into a single Firestore write (saves 20k daily quota)
   */
  const syncToCloudDebounced = (data) => {
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
      recordFirestoreWriteSaved(1);
    }
    setSyncStatus('unsynced');
    syncDebounceTimerRef.current = setTimeout(() => {
      syncToCloud(data).catch(() => {});
    }, 1200);
  };

  /**
   * Sync Local Browser Data to Firebase Cloud
   * Triggered automatically upon order execution, or explicitly via "Sync Now"
   */
  const syncToCloud = async (overrideData = null) => {
    if (syncDebounceTimerRef.current) {
      clearTimeout(syncDebounceTimerRef.current);
      syncDebounceTimerRef.current = null;
    }

    const local = overrideData || loadLocalUserData() || userProfile;
    if (!local) return { success: false, message: 'No local data found to sync.' };

    setSyncStatus('syncing');
    setSyncError(null);

    if (!auth?.currentUser) {
      setSyncStatus('unsynced');
      const msg = 'Please sign in with Google or Email to link your cloud portfolio.';
      setSyncError(msg);
      return { success: false, message: msg, needsAuth: true };
    }

    // Sanitize holding keys for Firebase (no dots or special characters)
    const sanitizedHoldings = {};
    Object.entries(local.holdings || {}).forEach(([key, val]) => {
      const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '_');
      sanitizedHoldings[cleanKey] = val;
    });

    // Zero-Op Avoidance: Check if state actually changed before spending a Firestore write
    const payloadChecksum = JSON.stringify({
      wallets: local.wallets,
      holdings: sanitizedHoldings,
      orderCount: Object.keys(local.orders || {}).length,
    });

    if (payloadChecksum === lastSyncedChecksumRef.current && !overrideData) {
      recordFirestoreWriteSaved(1);
      setSyncStatus('synced');
      return { success: true, message: 'Cloud state is already up to date.' };
    }

    // Keep user document tiny (< 25 KB) to respect Firestore document size & bandwidth limits
    const allOrdersList = Object.values(local.orders || {});
    const recentOrders = allOrdersList
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 100);
    const compactOrders = {};
    recentOrders.forEach((o) => { compactOrders[o.id] = o; });

    const now = Date.now();
    const syncPayload = {
      profile: {
        ...(local.profile || {}),
        uid: auth.currentUser.uid,
        email: auth.currentUser.email || local.profile?.email || '',
        lastSyncedAt: now,
      },
      wallets: local.wallets || createDefaultWallets(),
      holdings: sanitizedHoldings,
      orders: compactOrders,
      settings: local.settings || { theme: 'paper' },
      lastSyncedAt: now,
    };

    let synced = false;

    // 1. Primary Sync: Cloud Firestore (rules & indexes deployed)
    if (firestore) {
      try {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        const writePromise = setDoc(userDocRef, syncPayload, { merge: true });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Firestore sync timeout.')), 5000)
        );
        await Promise.race([writePromise, timeoutPromise]);
        synced = true;
      } catch (fsErr) {
        console.warn('Firestore Cloud sync notice:', fsErr.message);
      }
    }

    // 2. Secondary Sync: RTDB if available
    if (database && !synced) {
      try {
        const userDbRef = ref(database, `users/${auth.currentUser.uid}`);
        const writePromise = set(userDbRef, syncPayload);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('RTDB sync timeout')), 3000)
        );
        await Promise.race([writePromise, timeoutPromise]);
        synced = true;
      } catch (rtdbErr) {
        console.warn('RTDB sync notice:', rtdbErr.message);
      }
    }

    if (synced) {
      recordFirestoreWrite(1);
      lastSyncedChecksumRef.current = payloadChecksum;
      setSyncStatus('synced');
      setPendingSyncCount(0);
      setLastSyncedAt(now);
      setSyncError(null);
      localStorage.setItem('paper_trading_last_sync_time', now.toString());
      return { success: true, message: 'Portfolio & orders successfully synced to Firebase Cloud Firestore!' };
    } else {
      setSyncStatus('error');
      const friendlyMsg = 'Safely Preserved in Browser! Your virtual cash, orders, and portfolio are 100% safe in local browser storage.';
      setSyncError(friendlyMsg);
      return { success: false, message: friendlyMsg };
    }
  };

  /**
   * Pull latest remote portfolio state from Firebase Cloud (Cross-Device Sync)
   */
  const refreshFromCloud = async () => {
    if (!auth?.currentUser) {
      return { success: false, message: 'Please sign in with Google or Email to link devices.' };
    }
    setSyncStatus('syncing');
    try {
      if (firestore) {
        const userDocRef = doc(firestore, 'users', auth.currentUser.uid);
        recordFirestoreRead(1);
        const snap = await getDoc(userDocRef);
        if (snap && snap.exists && snap.exists()) {
          const remote = snap.data();
          const merged = mergeAndApplyRemoteProfile(remote);
          const holdingsCount = Object.keys(merged?.holdings || {}).length;
          return { 
            success: true, 
            message: `Synchronized ${holdingsCount} stock positions from Cloud Firestore!`,
            holdingsCount 
          };
        }
      }
      if (database) {
        const userDbRef = ref(database, `users/${auth.currentUser.uid}`);
        const snap = await get(userDbRef);
        if (snap && snap.exists()) {
          const remote = snap.val();
          const merged = mergeAndApplyRemoteProfile(remote);
          const holdingsCount = Object.keys(merged?.holdings || {}).length;
          return { 
            success: true, 
            message: `Synchronized ${holdingsCount} stock positions from Realtime DB!`,
            holdingsCount 
          };
        }
      }
    } catch (e) {
      console.warn('[CloudSync] Manual refresh notice:', e);
      setSyncStatus('synced');
      return { success: false, message: e.message || 'Cloud refresh failed.' };
    }
    setSyncStatus('synced');
    return { success: true, message: 'Local data matches latest cloud state.' };
  };

  /**
   * Export all local portfolio data to a JSON backup file
   */
  const exportLocalBackup = () => {
    const data = loadLocalUserData() || userProfile;
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paper_trading_portfolio_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Restore portfolio from JSON backup
   */
  const importLocalBackup = (jsonData) => {
    try {
      const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (parsed && (parsed.wallets || parsed.holdings || parsed.profile)) {
        localStorage.setItem('paper_trading_mock_user', JSON.stringify(parsed));
        setUserProfile(parsed);
        setSyncStatus('unsynced');
        setPendingSyncCount((prev) => prev + 1);
        return true;
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
    return false;
  };

  /**
   * Revert / Undo a Paper Trade
   * Restores cash balance, holdings, and marks the order as REVERTED in the audit trail.
   */
  const revertOrder = async (orderId) => {
    if (!orderId) return { success: false, message: 'Invalid order ID' };
    const currentProfile = userProfile || JSON.parse(localStorage.getItem('paper_trading_mock_user')) || {};
    const orders = { ...(currentProfile.orders || {}) };
    const targetOrder = orders[orderId];

    if (!targetOrder) {
      throw new Error(`Order ${orderId} not found in active trade records.`);
    }

    if (targetOrder.status === 'REVERTED') {
      throw new Error(`Order ${orderId} was already reverted.`);
    }

    const isIndia = targetOrder.market === 'NSE' || targetOrder.currency === 'INR';
    const walletKey = isIndia ? 'inr' : 'usd';
    const holdingKey = targetOrder.symbol.replace(/[^a-zA-Z0-9]/g, '_');

    const currentWallets = {
      inr: { ...(currentProfile.wallets?.inr || createDefaultWallets().inr) },
      usd: { ...(currentProfile.wallets?.usd || createDefaultWallets().usd) },
    };
    const wallet = currentWallets[walletKey];
    const holdings = { ...(currentProfile.holdings || {}) };
    const existingHolding = holdings[holdingKey];

    const qty = Number(targetOrder.quantity || 0);

    if (targetOrder.action === 'BUY') {
      // Revert BUY: Refund cash balance, deduct quantity from holding
      const refundAmount = Number(targetOrder.totalAmount || (qty * targetOrder.price));
      wallet.cashBalance = Number((wallet.cashBalance + refundAmount).toFixed(2));

      if (existingHolding) {
        if (existingHolding.quantity <= qty) {
          delete holdings[holdingKey];
        } else {
          const newQty = existingHolding.quantity - qty;
          const newCost = Math.max(0, (existingHolding.totalCost || 0) - refundAmount);
          holdings[holdingKey] = {
            ...existingHolding,
            quantity: newQty,
            totalCost: Number(newCost.toFixed(2)),
            avgBuyPrice: newQty > 0 ? Number((newCost / newQty).toFixed(2)) : existingHolding.avgBuyPrice,
            lastUpdated: Date.now(),
          };
        }
      }
    } else if (targetOrder.action === 'SELL') {
      // Revert SELL: Deduct sale proceeds from cash, deduct realized P&L, restore shares
      const saleProceeds = Number(targetOrder.totalAmount || (qty * targetOrder.price));
      const pnlToRevert = Number(targetOrder.realizedPnL || 0);

      if (wallet.cashBalance < saleProceeds) {
        throw new Error(`Cannot revert sell order: Cash balance (${wallet.currency} ${wallet.cashBalance}) is lower than the trade proceeds (${wallet.currency} ${saleProceeds}).`);
      }

      wallet.cashBalance = Number((wallet.cashBalance - saleProceeds).toFixed(2));
      wallet.realizedPnL = Number(((wallet.realizedPnL || 0) - pnlToRevert).toFixed(2));

      const buyPrice = Number(targetOrder.avgBuyPrice || targetOrder.price);
      const restoredCost = Number((qty * buyPrice).toFixed(2));

      if (existingHolding) {
        const newQty = existingHolding.quantity + qty;
        const newCost = (existingHolding.totalCost || 0) + restoredCost;
        holdings[holdingKey] = {
          ...existingHolding,
          quantity: newQty,
          totalCost: Number(newCost.toFixed(2)),
          avgBuyPrice: Number((newCost / newQty).toFixed(2)),
          lastUpdated: Date.now(),
        };
      } else {
        holdings[holdingKey] = {
          symbol: targetOrder.symbol,
          name: targetOrder.name || targetOrder.symbol,
          market: isIndia ? 'NSE' : 'US',
          currency: isIndia ? 'INR' : 'USD',
          quantity: qty,
          avgBuyPrice: buyPrice,
          totalCost: restoredCost,
          createdAt: Date.now(),
          lastUpdated: Date.now(),
        };
      }
    }

    // Recompute invested value
    let newInvestedValue = 0;
    Object.values(holdings).forEach((h) => {
      if ((isIndia && (h.market === 'NSE' || h.currency === 'INR')) || (!isIndia && (h.market === 'US' || h.currency === 'USD'))) {
        newInvestedValue += h.totalCost || 0;
      }
    });
    wallet.investedValue = Number(newInvestedValue.toFixed(2));

    // Mark order status as REVERTED
    orders[orderId] = {
      ...targetOrder,
      status: 'REVERTED',
      revertedAt: Date.now(),
    };

    const updatedProfile = {
      ...currentProfile,
      wallets: currentWallets,
      holdings,
      orders,
      lastSyncedAt: Date.now(),
    };

    localStorage.setItem('paper_trading_mock_user', JSON.stringify(updatedProfile));
    setUserProfile(updatedProfile);

    if (auth?.currentUser) {
      syncToCloudDebounced(updatedProfile);
    } else {
      setSyncStatus('unsynced');
      setPendingSyncCount((prev) => prev + 1);
    }

    // Keep local IndexedDB journal aligned (mark matching journal entry as REVERTED)
    try {
      const { db } = await import('../lib/localDb');
      const matchingEntries = await db.journal.filter((j) => j.orderId === orderId).toArray();
      for (const entry of matchingEntries) {
        await db.journal.update(entry.id, { status: 'REVERTED' });
      }
    } catch {
      // Local sync notice
    }

    return { success: true, order: orders[orderId] };
  };

  /**
   * Clear Paper Trade Order History without affecting cash balance or holdings
   */
  const clearOrderHistory = async () => {
    const current = userProfile || {};
    const updated = {
      ...current,
      orders: {},
      lastSyncedAt: Date.now(),
    };
    localStorage.setItem('paper_trading_mock_user', JSON.stringify(updated));
    setUserProfile(updated);
    if (auth?.currentUser) {
      syncToCloud(updated).catch(() => {});
    }

    // Clean up system-generated execution records from local journal
    try {
      const { db } = await import('../lib/localDb');
      const autoEntries = await db.journal.filter((j) => j.isSystemGenerated || j.orderId).toArray();
      for (const entry of autoEntries) {
        await db.journal.delete(entry.id);
      }
    } catch {
      // Local sync notice
    }

    return true;
  };

  /**
   * Watchlist operations for dynamic stock tracking across NSE & US markets
   */
  const getWatchlist = (market = 'NSE') => {
    const mKey = market === 'US' ? 'US' : 'NSE';
    const wl = userProfile?.watchlist;
    if (!wl) return [];
    if (Array.isArray(wl)) return wl;
    return Array.isArray(wl[mKey]) ? wl[mKey] : [];
  };

  const isStockInWatchlist = (symbol, market = 'NSE') => {
    if (!symbol) return false;
    const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BO') || (market === 'NSE' && !symbol.includes('.'));
    const mKey = isIndian ? 'NSE' : 'US';
    const list = getWatchlist(mKey);
    return list.includes(symbol);
  };

  const addToWatchlist = async (symbol, market = 'NSE', category = 'Equities') => {
    if (!symbol) return;
    const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BO') || (market === 'NSE' && !symbol.includes('.'));
    const mKey = isIndian ? 'NSE' : 'US';
    const current = userProfile || {};
    const existingList = Array.isArray(current.watchlist?.[mKey]) ? [...current.watchlist[mKey]] : [];

    if (!existingList.includes(symbol)) {
      existingList.push(symbol);
      const updated = {
        ...current,
        watchlist: {
          ...(current.watchlist || {}),
          [mKey]: existingList,
        },
      };
      localStorage.setItem('paper_trading_mock_user', JSON.stringify(updated));
      setUserProfile(updated);
      setSyncStatus('unsynced');
      setPendingSyncCount((prev) => prev + 1);

      try {
        const { db } = await import('../lib/localDb');
        const existing = await db.watchlists.where('symbol').equals(symbol).first();
        if (!existing) {
          await db.watchlists.add({
            symbol,
            market: mKey === 'NSE' ? 'IN' : 'US',
            category: category || 'Equities',
            addedAt: new Date().toISOString(),
          });
        }
      } catch (dexieErr) {
        console.warn('Dexie watchlist update bypassed:', dexieErr);
      }
    }
  };

  const removeFromWatchlist = async (symbol, market = 'NSE') => {
    if (!symbol) return;
    const isIndian = symbol.endsWith('.NS') || symbol.endsWith('.BO') || (market === 'NSE' && !symbol.includes('.'));
    const mKey = isIndian ? 'NSE' : 'US';
    const current = userProfile || {};
    const existingList = Array.isArray(current.watchlist?.[mKey]) ? [...current.watchlist[mKey]] : [];

    if (existingList.includes(symbol)) {
      const filtered = existingList.filter((s) => s !== symbol);
      const updated = {
        ...current,
        watchlist: {
          ...(current.watchlist || {}),
          [mKey]: filtered,
        },
      };
      localStorage.setItem('paper_trading_mock_user', JSON.stringify(updated));
      setUserProfile(updated);
      setSyncStatus('unsynced');
      setPendingSyncCount((prev) => prev + 1);

      try {
        const { db } = await import('../lib/localDb');
        await db.watchlists.where('symbol').equals(symbol).delete();
      } catch (dexieErr) {
        console.warn('Dexie watchlist remove bypassed:', dexieErr);
      }
    }
  };

  const toggleWatchlist = async (symbol, market = 'NSE', category = 'Equities') => {
    if (isStockInWatchlist(symbol, market)) {
      await removeFromWatchlist(symbol, market);
      return false;
    } else {
      await addToWatchlist(symbol, market, category);
      return true;
    }
  };

  const resetPortfolio = async () => {
    const freshWallets = createDefaultWallets();

    const current = userProfile || {};
    const updated = {
      ...current,
      wallets: freshWallets,
      holdings: {},
      orders: {},
      lastSyncedAt: Date.now(),
    };
    localStorage.setItem('paper_trading_mock_user', JSON.stringify(updated));
    setUserProfile(updated);

    if (auth?.currentUser) {
      syncToCloud(updated).catch(() => {});
    } else {
      setSyncStatus('unsynced');
      setPendingSyncCount((prev) => prev + 1);
    }
  };

  const value = {
    currentUser,
    userProfile,
    geoData,
    loading,
    firebaseActive,
    isOnboarded: userProfile?.profile?.isOnboarded === true,
    syncStatus,
    pendingSyncCount,
    lastSyncedAt,
    syncError,
    syncToCloud,
    refreshFromCloud,
    exportLocalBackup,
    importLocalBackup,
    signup,
    signInWithGoogle,
    completeOnboarding,
    signin,
    logout,
    executeOrder,
    revertOrder,
    clearOrderHistory,
    resetPortfolio,
    getWatchlist,
    isStockInWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    toggleWatchlist,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
