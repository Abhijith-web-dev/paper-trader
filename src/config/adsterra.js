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
      enabled: false, // Permanently disabled: zero click-to-open ads / popunders
      key: null,
      scriptUrl: null,
      protectTradingAreas: true
    },
    socialBar: {
      enabled: true,
      key: 'fe7abb4b849d2618628b74d2fbb658ec',
      scriptUrl: 'https://bauval.org/14/fe7abb4b849d2618628b74d2fbb658ec'
    },
    native: {
      enabled: true,
      containerId: 'container-888259038f64ffcff3fbd3c3c0ab4f09',
      scriptUrl: 'https://bauval.org/21/888259038f64ffcff3fbd3c3c0ab4f09'
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
