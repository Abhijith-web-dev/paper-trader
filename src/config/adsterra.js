/**
 * Adsterra Monetization & Placement Configuration
 * 
 * Maps publisher placement IDs directly to their corresponding 32-character
 * cryptographic hash keys, as structured in the Adsterra publisher placements schema.
 */

export const ADSTERRA_CONFIG = {
  scriptHost: 'www.highperformanceformat.com',
  defaultPlacementId: '6161748',
  defaultHashKey: '0267c3fa8d2c31053771bd95208e1ce8',

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
 * 
 * @param {Object} options
 * @param {string} [options.placementId] - 7-digit numeric placement ID (e.g. '6161748')
 * @param {string} [options.adKey] - 32-character cryptographic hash key (e.g. '0267c3fa8d2c31053771bd95208e1ce8')
 * @param {boolean} [options.isMobile] - Screen layout indicator for responsive sizing
 * @returns {Object} Fully resolved ad rendering configuration
 */
export function resolveAdsterraPlacement({
  placementId = ADSTERRA_CONFIG.defaultPlacementId,
  adKey = null,
  isMobile = false
} = {}) {
  // If a 32-character key is explicitly provided, prioritize it
  let resolvedKey = adKey;
  let zone = ADSTERRA_CONFIG.zones[placementId];

  if (!resolvedKey && zone?.hashKey) {
    resolvedKey = zone.hashKey;
  }

  // Fallback to default hash key if unresolved
  if (!resolvedKey || typeof resolvedKey !== 'string' || resolvedKey.trim().length === 0) {
    resolvedKey = ADSTERRA_CONFIG.defaultHashKey;
  }

  // Clean whitespace
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
