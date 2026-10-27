/**
 * Market Hours, Exchange Sessions & Official Government Holidays Engine
 * 
 * Provides real-time calculation for:
 * 1. Indian Equities (NSE / BSE): Mon-Fri 09:15 - 15:30 IST (UTC+5:30)
 * 2. US Equities (NASDAQ / NYSE): Mon-Fri 09:30 - 16:00 ET (America/New_York)
 * 
 * Tracks:
 * - Real-time Live Clocks (seconds precision)
 * - Official Daily Market Open & Close Times
 * - Real-Time Closing & Opening Countdowns (exact hours, minutes, seconds)
 * - Official Government / Trading Holidays (NSE & US)
 * - Automatic Skip of Holidays & Weekends for Next Active Session
 */

// Official National Stock Exchange of India (NSE / BSE) Trading Holidays
export const NSE_HOLIDAYS = {
  // 2025
  '2025-01-26': 'Republic Day',
  '2025-02-26': 'Mahashivratri',
  '2025-03-14': 'Holi',
  '2025-03-31': 'Id-Ul-Fitr (Ramzan Id)',
  '2025-04-06': 'Ram Navami',
  '2025-04-10': 'Mahavir Jayanti',
  '2025-04-14': 'Dr. B.R. Ambedkar Jayanti',
  '2025-04-18': 'Good Friday',
  '2025-05-01': 'Maharashtra Day',
  '2025-06-07': 'Bakri Id / Eid ul-Adha',
  '2025-07-06': 'Muharram',
  '2025-08-15': 'Independence Day',
  '2025-08-27': 'Ganesh Chaturthi',
  '2025-10-02': 'Mahatma Gandhi Jayanti / Dussehra',
  '2025-10-21': 'Diwali Balipratipada',
  '2025-11-05': 'Guru Nanak Jayanti',
  '2025-12-25': 'Christmas',

  // 2026 (Official Indian Government & Stock Exchange Gazette)
  '2026-01-26': 'Republic Day',
  '2026-02-17': 'Mahashivratri',
  '2026-03-03': 'Holi',
  '2026-03-20': 'Id-Ul-Fitr (Ramzan Id)',
  '2026-03-27': 'Ram Navami',
  '2026-03-31': 'Mahavir Jayanti',
  '2026-04-03': 'Good Friday',
  '2026-04-14': 'Dr. B.R. Ambedkar Jayanti',
  '2026-05-01': 'Maharashtra Day / Labour Day',
  '2026-05-27': 'Bakri Id / Eid ul-Adha',
  '2026-06-26': 'Muharram',
  '2026-08-15': 'Independence Day',
  '2026-08-28': 'Milad-un-Nabi (Eid-e-Milad)',
  '2026-10-02': 'Mahatma Gandhi Jayanti',
  '2026-10-20': 'Dussehra (Vijayadashami)',
  '2026-11-08': 'Diwali (Laxmi Pujan)*',
  '2026-11-10': 'Diwali Balipratipada',
  '2026-11-24': 'Guru Nanak Jayanti',
  '2026-12-25': 'Christmas',

  // 2027
  '2027-01-26': 'Republic Day',
  '2027-03-08': 'Mahashivratri',
  '2027-03-23': 'Holi',
  '2027-03-26': 'Good Friday',
  '2027-04-14': 'Dr. B.R. Ambedkar Jayanti',
  '2027-05-01': 'Maharashtra Day',
  '2027-08-15': 'Independence Day',
  '2027-10-02': 'Mahatma Gandhi Jayanti',
  '2027-10-09': 'Dussehra',
  '2027-10-29': 'Diwali Balipratipada',
  '2027-12-25': 'Christmas',
};

// Official US Federal & NYSE / NASDAQ Stock Market Holidays
export const US_HOLIDAYS = {
  // 2025
  '2025-01-01': "New Year's Day",
  '2025-01-20': 'Martin Luther King, Jr. Day',
  '2025-02-17': "Washington's Birthday (Presidents' Day)",
  '2025-04-18': 'Good Friday',
  '2025-05-26': 'Memorial Day',
  '2025-06-19': 'Juneteenth National Independence Day',
  '2025-07-04': 'Independence Day',
  '2025-09-01': 'Labor Day',
  '2025-11-27': 'Thanksgiving Day',
  '2025-12-25': 'Christmas Day',

  // 2026
  '2026-01-01': "New Year's Day",
  '2026-01-19': 'Martin Luther King, Jr. Day',
  '2026-02-16': "Washington's Birthday (Presidents' Day)",
  '2026-04-03': 'Good Friday',
  '2026-05-25': 'Memorial Day',
  '2026-06-19': 'Juneteenth National Independence Day',
  '2026-07-03': 'Independence Day (Observed)',
  '2026-09-07': 'Labor Day',
  '2026-11-26': 'Thanksgiving Day',
  '2026-12-25': 'Christmas Day',

  // 2027
  '2027-01-01': "New Year's Day",
  '2027-01-18': 'Martin Luther King, Jr. Day',
  '2027-02-15': "Washington's Birthday (Presidents' Day)",
  '2027-03-26': 'Good Friday',
  '2027-05-31': 'Memorial Day',
  '2027-06-18': 'Juneteenth (Observed)',
  '2027-07-05': 'Independence Day (Observed)',
  '2027-09-06': 'Labor Day',
  '2027-11-25': 'Thanksgiving Day',
  '2027-12-24': 'Christmas Day (Observed)',
};

/**
 * Get current date/time components for a specific timezone
 */
export function getExchangeDate(timeZone) {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(now);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hours = parseInt(map.hour, 10) === 24 ? 0 : parseInt(map.hour, 10);
  const minutes = parseInt(map.minute, 10);
  const seconds = parseInt(map.second, 10);

  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0 = Sun, 6 = Sat

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    dateKey,
    dayOfWeek,
    decimalHour: hours + minutes / 60 + seconds / 3600,
    rawDate: new Date(year, month - 1, day, hours, minutes, seconds),
  };
}

/**
 * Calculate Indian Stock Exchange (NSE / BSE) Status
 * Hours: Monday to Friday, 09:15 AM to 03:30 PM IST (UTC+5:30)
 */
export function getNSEMarketStatus() {
  const ex = getExchangeDate('Asia/Kolkata');
  const isWeekend = ex.dayOfWeek === 0 || ex.dayOfWeek === 6;
  const holidayName = NSE_HOLIDAYS[ex.dateKey] || null;
  const isHoliday = Boolean(holidayName);

  const openHour = 9.25; // 09:15 AM
  const closeHour = 15.5; // 03:30 PM
  const isOpenTime = ex.decimalHour >= openHour && ex.decimalHour < closeHour;
  const isOpen = !isWeekend && !isHoliday && isOpenTime;

  // Real-time Closing & Opening Countdowns
  let msUntilNext = 0;
  let nextEventDesc = '';
  let closingCountdown = null;

  if (isOpen) {
    const hoursRemaining = closeHour - ex.decimalHour;
    msUntilNext = Math.max(0, Math.floor(hoursRemaining * 3600000));
    closingCountdown = formatDetailedDuration(msUntilNext);
    nextEventDesc = `Closes in ${closingCountdown} (at 03:30 PM IST)`;
  } else {
    // Determine next active trading day
    let checkDate = new Date(ex.year, ex.month - 1, ex.day);
    // If today is trading day but before 9:15 AM, it opens today!
    if (!isWeekend && !isHoliday && ex.decimalHour < openHour) {
      const hoursUntil = openHour - ex.decimalHour;
      msUntilNext = Math.max(0, Math.floor(hoursUntil * 3600000));
      nextEventDesc = `Opens today at 09:15 AM IST (in ${formatDetailedDuration(msUntilNext)})`;
    } else {
      // Advance day by day until finding an open weekday that is NOT a holiday
      let daysChecked = 0;
      while (daysChecked < 14) {
        checkDate.setDate(checkDate.getDate() + 1);
        daysChecked++;
        const dow = checkDate.getDay();
        if (dow === 0 || dow === 6) continue;
        const key = formatDateKey(checkDate);
        if (NSE_HOLIDAYS[key]) continue;
        break; // Found active session!
      }

      const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      // Calculate total hours until next open at 09:15 AM
      const hoursUntil = (daysChecked * 24) + (openHour - ex.decimalHour);
      msUntilNext = Math.max(0, Math.floor(hoursUntil * 3600000));

      if (isHoliday) {
        nextEventDesc = `Closed for ${holidayName} • Next Session Opens ${dayName} at 09:15 AM IST (in ${formatDetailedDuration(msUntilNext)})`;
      } else if (isWeekend) {
        nextEventDesc = `Weekend Closed • Next Session Opens Monday at 09:15 AM IST (in ${formatDetailedDuration(msUntilNext)})`;
      } else {
        nextEventDesc = `Closed at 03:30 PM • Opens Tomorrow (${dayName}) at 09:15 AM IST (in ${formatDetailedDuration(msUntilNext)})`;
      }
    }
  }

  const istClock = `${String(ex.hours).padStart(2, '0')}:${String(ex.minutes).padStart(2, '0')}:${String(ex.seconds).padStart(2, '0')} IST`;

  return {
    market: 'NSE',
    marketName: 'National Stock Exchange (India)',
    currency: 'INR',
    symbol: '₹',
    isOpen,
    isHoliday,
    holidayName,
    isWeekend,
    statusText: isOpen 
      ? 'MARKET OPEN (TRADING ACTIVE)' 
      : isHoliday 
        ? `GOVERNMENT HOLIDAY (${holidayName})` 
        : isWeekend 
          ? 'WEEKEND CLOSED' 
          : 'SESSION CLOSED',
    badgeText: isOpen ? 'LIVE' : isHoliday ? 'HOLIDAY' : 'CLOSED',
    exchangeTime: istClock,
    openTimeStr: '09:15 AM IST',
    closeTimeStr: '03:30 PM IST',
    schedule: 'Mon–Fri 09:15 – 15:30 IST',
    closingCountdown,
    nextEventDesc,
    msUntilNext,
    upcomingHolidays: getUpcomingHolidays('NSE', ex.dateKey, 4),
  };
}

/**
 * Calculate US Stock Exchange (NASDAQ / NYSE) Status
 * Hours: Monday to Friday, 09:30 AM to 04:00 PM Eastern Time (ET)
 */
export function getUSMarketStatus() {
  const ex = getExchangeDate('America/New_York');
  const isWeekend = ex.dayOfWeek === 0 || ex.dayOfWeek === 6;
  const holidayName = US_HOLIDAYS[ex.dateKey] || null;
  const isHoliday = Boolean(holidayName);

  const openHour = 9.5; // 09:30 AM ET
  const closeHour = 16.0; // 04:00 PM ET
  const isOpenTime = ex.decimalHour >= openHour && ex.decimalHour < closeHour;
  const isOpen = !isWeekend && !isHoliday && isOpenTime;

  let msUntilNext = 0;
  let nextEventDesc = '';
  let closingCountdown = null;

  if (isOpen) {
    const hoursRemaining = closeHour - ex.decimalHour;
    msUntilNext = Math.max(0, Math.floor(hoursRemaining * 3600000));
    closingCountdown = formatDetailedDuration(msUntilNext);
    nextEventDesc = `Closes in ${closingCountdown} (at 04:00 PM ET)`;
  } else {
    let checkDate = new Date(ex.year, ex.month - 1, ex.day);
    if (!isWeekend && !isHoliday && ex.decimalHour < openHour) {
      const hoursUntil = openHour - ex.decimalHour;
      msUntilNext = Math.max(0, Math.floor(hoursUntil * 3600000));
      nextEventDesc = `Opens today at 09:30 AM ET (in ${formatDetailedDuration(msUntilNext)})`;
    } else {
      let daysChecked = 0;
      while (daysChecked < 14) {
        checkDate.setDate(checkDate.getDate() + 1);
        daysChecked++;
        const dow = checkDate.getDay();
        if (dow === 0 || dow === 6) continue;
        const key = formatDateKey(checkDate);
        if (US_HOLIDAYS[key]) continue;
        break;
      }

      const dayName = checkDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const hoursUntil = (daysChecked * 24) + (openHour - ex.decimalHour);
      msUntilNext = Math.max(0, Math.floor(hoursUntil * 3600000));

      if (isHoliday) {
        nextEventDesc = `Closed for ${holidayName} • Next Session Opens ${dayName} at 09:30 AM ET (in ${formatDetailedDuration(msUntilNext)})`;
      } else if (isWeekend) {
        nextEventDesc = `Weekend Closed • Next Session Opens Monday at 09:30 AM ET (in ${formatDetailedDuration(msUntilNext)})`;
      } else {
        nextEventDesc = `Closed at 04:00 PM • Opens Tomorrow (${dayName}) at 09:30 AM ET (in ${formatDetailedDuration(msUntilNext)})`;
      }
    }
  }

  const nyClock = `${String(ex.hours).padStart(2, '0')}:${String(ex.minutes).padStart(2, '0')}:${String(ex.seconds).padStart(2, '0')} ET`;

  return {
    market: 'US',
    marketName: 'New York Stock Exchange / NASDAQ',
    currency: 'USD',
    symbol: '$',
    isOpen,
    isHoliday,
    holidayName,
    isWeekend,
    statusText: isOpen 
      ? 'MARKET OPEN (TRADING ACTIVE)' 
      : isHoliday 
        ? `US FEDERAL HOLIDAY (${holidayName})` 
        : isWeekend 
          ? 'WEEKEND CLOSED' 
          : 'SESSION CLOSED',
    badgeText: isOpen ? 'LIVE' : isHoliday ? 'HOLIDAY' : 'CLOSED',
    exchangeTime: nyClock,
    openTimeStr: '09:30 AM ET',
    closeTimeStr: '04:00 PM ET',
    schedule: 'Mon–Fri 09:30 – 16:00 ET (19:00 – 01:30 IST)',
    closingCountdown,
    nextEventDesc,
    msUntilNext,
    upcomingHolidays: getUpcomingHolidays('US', ex.dateKey, 4),
  };
}

/**
 * Check if a symbol or market is currently open for trading
 */
export function isMarketOpenForSymbol(symbolOrMarket) {
  try {
    const override = localStorage.getItem('paper_trading_sandbox_after_hours');
    if (override === 'true') {
      return {
        isOpen: true,
        isSandboxOverride: true,
        reason: 'Practice Sandbox Active (After-Hours Bypass)',
        marketStatus: null,
      };
    }
  } catch {}

  const isIndia = String(symbolOrMarket).endsWith('.NS') || symbolOrMarket === 'NSE' || symbolOrMarket === 'INR';
  const status = isIndia ? getNSEMarketStatus() : getUSMarketStatus();

  return {
    isOpen: status.isOpen,
    isHoliday: status.isHoliday,
    holidayName: status.holidayName,
    isSandboxOverride: false,
    reason: status.isOpen 
      ? 'Exchange Trading Session Active' 
      : status.isHoliday
        ? `Official Government / Trading Holiday: ${status.holidayName}`
        : `${status.statusText} • ${status.nextEventDesc}`,
    marketStatus: status,
  };
}

/**
 * Format YYYY-MM-DD
 */
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format milliseconds into human string: "2h 14m 30s" or "45m 12s"
 */
function formatDetailedDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

/**
 * Get the next upcoming official trading holidays
 */
export function getUpcomingHolidays(market = 'NSE', fromDateKey, limit = 5) {
  const holidays = market === 'NSE' ? NSE_HOLIDAYS : US_HOLIDAYS;
  const fromKey = fromDateKey || new Date().toISOString().slice(0, 10);

  return Object.entries(holidays)
    .filter(([dateKey]) => dateKey >= fromKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([dateKey, name]) => {
      const [year, month, day] = dateKey.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      return {
        dateKey,
        name,
        formattedDate: dayName,
        isToday: dateKey === fromKey,
      };
    });
}
