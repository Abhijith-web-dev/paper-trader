/**
 * Adsterra Multi-Format Monetization Configuration
 * 
 * Active Ad Units generated for paper-trader-001.web.app (Placement ID: 6161748):
 * 1. Popunder (Highest CPM): https://abscloud.org/1/d558b6a9096b6007a50019663f7969c3
 * 2. Social Bar (In-page push): https://bauval.org/14/fe7abb4b849d2618628b74d2fbb658ec
 * 3. 468x60 Banner: https://bauval.org/22/265129238f893cd98f180d1efd562793 (Key: 265129238f893cd98f180d1efd562793)
 * 4. 160x300 Banner: https://bauval.org/22/7455539cbc9dcb173e38b9cf1e0c507a (Key: 7455539cbc9dcb173e38b9cf1e0c507a)
 * 5. 160x600 Skyscraper: https://bauval.org/22/f9c8e2952509d006ff06cf9f92ebd8a1 (Key: f9c8e2952509d006ff06cf9f92ebd8a1)
 * 6. Native Banner Container: https://bauval.org/21/888259038f64ffcff3fbd3c3c0ab4f09
 */

export const ADSTERRA_CONFIG = {
  scriptHost: 'bauval.org',
  defaultPlacementId: '6161748',
  defaultHashKey: '265129238f893cd98f180d1efd562793',

  // Configured ad formats
  formats: {
    banner: {
      enabled: true,
      placementId: '6161748',
      hashKey: '265129238f893cd98f180d1efd562793',
      format: 'iframe',
      desktop: { width: 468, height: 60 },
      mobile: { width: 320, height: 50 },
      scriptUrl: 'https://bauval.org/22/265129238f893cd98f180d1efd562793',
      label: 'SPONSORED FINANCIAL DISPATCH',
      sublabel: 'Official Adsterra Network Partner'
    },
    popunder: {
      enabled: false, // Permanently disabled across whole screen: zero click-to-open screen ads
      key: null,
      scriptUrl: null,
      protectTradingAreas: true
    },
    socialBar: {
      enabled: false, // Disabled: prevents adult dating and sensitive push notifications
      key: null,
      scriptUrl: null
    },
    native: {
      enabled: true,
      containerId: 'container-888259038f64ffcff3fbd3c3c0ab4f09',
      scriptUrl: 'https://bauval.org/21/888259038f64ffcff3fbd3c3c0ab4f09'
    },
    // Selective tool-triggered ad: strictly restricted to 4 specific components
    selectiveToolAd: {
      enabled: true,
      cooldownMs: 300000, // 5 minutes cooldown per tool
      globalCooldownMs: 180000, // 3 minutes cooldown globally across session
      allowedFeatures: ['backtest', 'vault', 'risk-calculator', 'transactions'],
      dispatchUrl: '/sponsor-dispatch.html',
      popunderKey: 'd558b6a9096b6007a50019663f7969c3',
      directLinkUrl: null // Optional direct link override
    }
  },

  // Registered zones and cryptographic hash keys
  zones: {
    '6161748': {
      placementId: '6161748',
      hashKey: '265129238f893cd98f180d1efd562793',
      format: 'iframe',
      desktop: { width: 468, height: 60 },
      mobile: { width: 320, height: 50 },
      scriptUrl: 'https://bauval.org/22/265129238f893cd98f180d1efd562793',
      label: 'SPONSORED FINANCIAL DISPATCH',
      sublabel: 'Official Adsterra Network Partner'
    },
    '265129238f893cd98f180d1efd562793': {
      placementId: '6161748',
      hashKey: '265129238f893cd98f180d1efd562793',
      format: 'iframe',
      desktop: { width: 468, height: 60 },
      mobile: { width: 320, height: 50 },
      scriptUrl: 'https://bauval.org/22/265129238f893cd98f180d1efd562793',
      label: 'SPONSORED FINANCIAL DISPATCH',
      sublabel: 'Official Adsterra Network Partner'
    },
    '7455539cbc9dcb173e38b9cf1e0c507a': {
      placementId: '6161748',
      hashKey: '7455539cbc9dcb173e38b9cf1e0c507a',
      format: 'iframe',
      desktop: { width: 160, height: 300 },
      mobile: { width: 160, height: 300 },
      scriptUrl: 'https://bauval.org/22/7455539cbc9dcb173e38b9cf1e0c507a',
      label: 'SPONSORED FINANCIAL DISPATCH',
      sublabel: 'Official Adsterra Network Partner'
    },
    'f9c8e2952509d006ff06cf9f92ebd8a1': {
      placementId: '6161748',
      hashKey: 'f9c8e2952509d006ff06cf9f92ebd8a1',
      format: 'iframe',
      desktop: { width: 160, height: 600 },
      mobile: { width: 160, height: 600 },
      scriptUrl: 'https://bauval.org/22/f9c8e2952509d006ff06cf9f92ebd8a1',
      label: 'SPONSORED FINANCIAL DISPATCH',
      sublabel: 'Official Adsterra Network Partner'
    }
  }
};

/**
 * Resolves placement ID or direct hash key into executable Adsterra banner options.
 */
export function resolveAdsterraPlacement({
  placementId = ADSTERRA_CONFIG.defaultPlacementId,
  adKey = null,
  isMobile = false
} = {}) {
  let resolvedKey = adKey;
  let zone = ADSTERRA_CONFIG.zones[placementId] || (adKey ? ADSTERRA_CONFIG.zones[adKey] : null);

  if (!resolvedKey && zone?.hashKey) {
    resolvedKey = zone.hashKey;
  }

  if (!resolvedKey || typeof resolvedKey !== 'string' || resolvedKey.trim().length === 0) {
    resolvedKey = ADSTERRA_CONFIG.defaultHashKey;
  }

  resolvedKey = resolvedKey.trim();

  // If a specific zone exists with designated dimensions, use them
  if (ADSTERRA_CONFIG.zones[resolvedKey]) {
    zone = ADSTERRA_CONFIG.zones[resolvedKey];
  }

  const width = isMobile ? (zone?.mobile?.width || 320) : (zone?.desktop?.width || 468);
  const height = isMobile ? (zone?.mobile?.height || 50) : (zone?.desktop?.height || 60);
  const format = zone?.format || 'iframe';
  const label = zone?.label || 'SPONSORED FINANCIAL DISPATCH';
  const sublabel = zone?.sublabel || 'Official Adsterra Network Partner';
  const scriptUrl = zone?.scriptUrl || `https://bauval.org/22/${resolvedKey}`;

  return {
    placementId,
    hashKey: resolvedKey,
    width,
    height,
    format,
    label,
    sublabel,
    scriptUrl
  };
}

/**
 * Updates an ad format configuration dynamically
 */
export function configureAdFormat(formatName, options = {}) {
  if (ADSTERRA_CONFIG.formats[formatName]) {
    ADSTERRA_CONFIG.formats[formatName] = {
      ...ADSTERRA_CONFIG.formats[formatName],
      ...options
    };
  }
}

/**
 * The ONLY 4 components permitted to trigger sponsored click-to-open ads.
 * Every other button, chart, and page on the site is strictly shielded.
 */
export const ALLOWED_TOOL_FEATURES = Object.freeze([
  'backtest',
  'vault',
  'risk-calculator',
  'transactions'
]);

/**
 * Strict 18+ Adult & Erotic Content Keyword Filter
 * Rejects any ad landing page containing adult, dating, erotic, gambling, or non-mainstream terms.
 */
export const ADULT_KEYWORD_BLOCKLIST = Object.freeze([
  'adult',
  'erotic',
  'porn',
  'xxx',
  'sex',
  'dating',
  'webcam',
  'camgirl',
  'strip',
  'escort',
  'hookup',
  'nude',
  'naked',
  'milf',
  'hentai',
  'fetish',
  'sensual',
  'nsfw',
  'gambling',
  'casino',
  'betting',
  'bet365',
  '1xbet',
  'slots',
  'poker',
  'roulette',
  'vape',
  'cbd',
  'tobacco',
  'weed',
  'cigar'
]);

/**
 * Validates whether a URL violates strict 18+ non-adult safety requirements.
 */
export function isAdultContentUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return ADULT_KEYWORD_BLOCKLIST.some((keyword) => lower.includes(keyword));
}

/**
 * Triggers a sponsored click-to-open ad ONLY for the 4 designated features.
 * 
 * Invariants:
 * 1. featureKey MUST be one of: 'backtest', 'vault', 'risk-calculator', 'transactions'.
 * 2. All other actions (Buy, Sell, Charts, Search, Watchlist, etc.) return false and do nothing.
 * 3. Enforces anti-spam cooldown (5 mins per tool, 3 mins globally) to protect user experience.
 * 4. Strictly validates URLs against adult/erotic keywords.
 * 5. Uses 'noopener,noreferrer' and removes opener to prevent host window tampering.
 * 
 * @param {string} featureKey - The component requesting a sponsored action
 * @param {object} options - Options including bypassCooldown (useful for unit tests)
 * @returns {boolean} Whether the ad was triggered
 */
export function triggerSelectiveToolAd(featureKey, { bypassCooldown = false } = {}) {
  // 1. Strict Whitelist Check
  if (!ALLOWED_TOOL_FEATURES.includes(featureKey)) {
    return false;
  }

  const config = ADSTERRA_CONFIG.formats.selectiveToolAd;
  if (!config || !config.enabled) {
    return false;
  }

  // 2. Cooldown & Anti-Spam Gate
  const now = Date.now();
  const storageKey = `pt_ad_tool_last_${featureKey}`;
  const globalStorageKey = 'pt_ad_tool_last_global';

  if (!bypassCooldown && typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const lastToolTime = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
      const lastGlobalTime = parseInt(sessionStorage.getItem(globalStorageKey) || '0', 10);

      if (lastToolTime > 0 && (now - lastToolTime < config.cooldownMs)) {
        return false;
      }
      if (lastGlobalTime > 0 && (now - lastGlobalTime < config.globalCooldownMs)) {
        return false;
      }
    } catch (_) {
      // Graceful handling of restricted sessionStorage
    }
  }

  // 3. Resolve and Verify Destination URL
  let targetUrl = config.directLinkUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADSTERRA_DIRECT_LINK);

  if (targetUrl) {
    if (isAdultContentUrl(targetUrl)) {
      console.warn('[Adsterra Safety] Blocked adult ad destination URL:', targetUrl);
      return false;
    }
  } else {
    // Fall back to the isolated, same-origin sponsor dispatch gateway
    targetUrl = `${config.dispatchUrl}?feature=${encodeURIComponent(featureKey)}&placement=${encodeURIComponent(ADSTERRA_CONFIG.defaultPlacementId)}`;
  }

  // 4. Open in isolated secure tab
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
      if (win) {
        try {
          win.opener = null;
        } catch (_) {}
      }

      // Record timestamps
      if (window.sessionStorage) {
        try {
          sessionStorage.setItem(storageKey, now.toString());
          sessionStorage.setItem(globalStorageKey, now.toString());
        } catch (_) {}
      }

      return true;
    } catch (err) {
      console.warn('[Adsterra] Selective tool ad open error:', err);
      return false;
    }
  }

  // In non-browser (e.g. test environments), return true if permitted
  return true;
}
