/**
 * Adsterra Multi-Format Monetization Configuration
 * 
 * Supports high-CPM hybrid monetization formats recommended by Adsterra:
 * 1. Banner (Broadsheet Photo-Plate): 728x90 desktop / 320x50 mobile
 * 2. Popunder (Highest CPM): Background tab launch with strict trading UX protection
 * 3. Social Bar: Interactive in-page notification / floating bar
 */

export const ADSTERRA_CONFIG = {
  scriptHost: 'www.highperformanceformat.com',
  defaultPlacementId: '6161748',
  defaultHashKey: '0267c3fa8d2c31053771bd95208e1ce8',

  // Configured ad formats
  formats: {
    banner: {
      enabled: true,
      placementId: '6161748',
      hashKey: '0267c3fa8d2c31053771bd95208e1ce8',
      format: 'iframe',
      desktop: { width: 728, height: 90 },
      mobile: { width: 320, height: 50 },
      label: 'SPONSORED FINANCIAL DISPATCH',
      sublabel: 'Official Adsterra Network Partner'
    },
    popunder: {
      enabled: false, // Activated once user generates the Popunder script/key in Adsterra
      placementId: null,
      hashKey: null,
      scriptUrl: null,
      maxFrequencyPerHour: 1, // Rate-limit to preserve user experience
      protectTradingAreas: true
    },
    socialBar: {
      enabled: false, // Activated once user generates the Social Bar script/key in Adsterra
      placementId: null,
      hashKey: null,
      scriptUrl: null,
      position: 'bottom-right'
    }
  },

  // Registered zones and cryptographic hash keys
  zones: {
    '6161748': {
      placementId: '6161748',
      hashKey: '0267c3fa8d2c31053771bd95208e1ce8',
      format: 'iframe',
      desktop: { width: 728, height: 90 },
      mobile: { width: 320, height: 50 },
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
  let zone = ADSTERRA_CONFIG.zones[placementId];

  if (!resolvedKey && zone?.hashKey) {
    resolvedKey = zone.hashKey;
  }

  if (!resolvedKey || typeof resolvedKey !== 'string' || resolvedKey.trim().length === 0) {
    resolvedKey = ADSTERRA_CONFIG.defaultHashKey;
  }

  resolvedKey = resolvedKey.trim();

  const width = isMobile ? (zone?.mobile?.width || 320) : (zone?.desktop?.width || 728);
  const height = isMobile ? (zone?.mobile?.height || 50) : (zone?.desktop?.height || 90);
  const format = zone?.format || 'iframe';
  const label = zone?.label || 'SPONSORED FINANCIAL DISPATCH';
  const sublabel = zone?.sublabel || 'Official Adsterra Network Partner';
  const scriptUrl = `//${ADSTERRA_CONFIG.scriptHost}/${resolvedKey}/invoke.js`;

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
