/**
 * Geolocation & Currency Auto-Detector
 * Accurately determines country, currency (INR vs USD), and target market
 * using high-speed IP lookup with instant browser timezone/locale fallback.
 */

export async function detectUserLocationAndCurrency() {
  // 1. Instant fallback via browser timezone & locale
  const fallback = getBrowserFallback();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout for ultra-fast load

    // Use a lightweight public Geo IP API
    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const countryCode = (data.country_code || '').toUpperCase();
      const countryName = data.country_name || fallback.countryName;
      const isIndia = countryCode === 'IN';

      return {
        countryCode: countryCode || fallback.countryCode,
        countryName,
        city: data.city || '',
        currency: isIndia ? 'INR' : 'USD',
        symbol: isIndia ? '₹' : '$',
        defaultMarket: isIndia ? 'NSE' : 'US',
        starterCapital: isIndia ? 1000000 : 100000,
        formattedCapital: isIndia ? '₹10,00,000' : '$100,000',
        isIndia,
        detectionSource: 'ip',
      };
    }
  } catch {
    // Silently fall back to browser locale detection if network or adblocker blocks IP lookup
  }

  return fallback;
}

function getBrowserFallback() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const language = (navigator.language || navigator.userLanguage || '').toLowerCase();

  const isIndia =
    timeZone.includes('Calcutta') ||
    timeZone.includes('Kolkata') ||
    timeZone.includes('Indian') ||
    language.includes('-in') ||
    language === 'hi';

  return {
    countryCode: isIndia ? 'IN' : 'US',
    countryName: isIndia ? 'India' : 'United States',
    city: '',
    currency: isIndia ? 'INR' : 'USD',
    symbol: isIndia ? '₹' : '$',
    defaultMarket: isIndia ? 'NSE' : 'US',
    starterCapital: isIndia ? 1000000 : 100000,
    formattedCapital: isIndia ? '₹10,00,000' : '$100,000',
    isIndia,
    detectionSource: 'timezone_locale',
  };
}
