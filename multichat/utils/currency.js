/**
 * Currency detection, exchange rates, and conversion utility for YouTube Super Chats and donations.
 * Pure client/server compatible with zero external dependencies.
 */

export const CURRENCY_PREFIX_MAP = [
  { prefix: 'US$', code: 'USD' },
  { prefix: 'CA$', code: 'CAD' },
  { prefix: 'C$', code: 'CAD' },
  { prefix: 'AU$', code: 'AUD' },
  { prefix: 'A$', code: 'AUD' },
  { prefix: 'NZ$', code: 'NZD' },
  { prefix: 'NT$', code: 'TWD' },
  { prefix: 'HK$', code: 'HKD' },
  { prefix: 'R$', code: 'BRL' },
  { prefix: 'S$', code: 'SGD' },
  { prefix: '₹', code: 'INR' },
  { prefix: 'Rs', code: 'INR' },
  { prefix: '$', code: 'USD' },
  { prefix: '€', code: 'EUR' },
  { prefix: '£', code: 'GBP' },
  { prefix: '¥', code: 'JPY' },
  { prefix: '₩', code: 'KRW' },
  { prefix: '₱', code: 'PHP' },
  { prefix: 'zł', code: 'PLN' },
  { prefix: '₽', code: 'RUB' },
  { prefix: '₺', code: 'TRY' },
  { prefix: '฿', code: 'THB' },
  { prefix: '₫', code: 'VND' },
  { prefix: 'kr', code: 'SEK' }
];

export const SYMBOL_TO_CODE = {
  '₹': 'INR',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  'C$': 'CAD',
  'A$': 'AUD',
  '¥': 'JPY',
  'R$': 'BRL',
  '₱': 'PHP',
  '₩': 'KRW',
  'S$': 'SGD',
  'NZ$': 'NZD',
  'INR': 'INR',
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
  'CAD': 'CAD',
  'AUD': 'AUD',
  'JPY': 'JPY',
  'BRL': 'BRL',
  'PHP': 'PHP',
  'KRW': 'KRW',
  'SGD': 'SGD',
  'NZD': 'NZD'
};

// Baseline exchange rates relative to 1 USD
export const DEFAULT_EXCHANGE_RATES = {
  USD: 1,
  INR: 87.5,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.38,
  AUD: 1.54,
  JPY: 153.0,
  BRL: 5.75,
  PHP: 58.5,
  KRW: 1390.0,
  SGD: 1.34,
  NZD: 1.68,
  MXN: 20.2,
  TWD: 32.5,
  HKD: 7.78,
  SEK: 10.6,
  NOK: 10.8,
  DKK: 6.88,
  CHF: 0.88,
  PLN: 3.96,
  RUB: 97.0,
  TRY: 34.5,
  ZAR: 18.2,
  IDR: 15800.0,
  MYR: 4.45,
  THB: 34.8,
  AED: 3.67,
  SAR: 3.75
};

let currentRates = { ...DEFAULT_EXCHANGE_RATES };
let hasInitialized = false;

/**
 * Normalizes any currency symbol or code to an ISO code (e.g. '₹' -> 'INR').
 */
export function getCurrencyCode(symbolOrCode) {
  if (!symbolOrCode || typeof symbolOrCode !== 'string') return 'INR';
  const clean = symbolOrCode.trim();
  if (SYMBOL_TO_CODE[clean]) return SYMBOL_TO_CODE[clean];
  const upper = clean.toUpperCase();
  if (DEFAULT_EXCHANGE_RATES[upper]) return upper;
  for (const item of CURRENCY_PREFIX_MAP) {
    if (clean.includes(item.prefix)) return item.code;
  }
  return 'INR';
}

/**
 * Parses raw donation string (e.g. "$5.00", "US$10", "₹100", "5,00 €")
 * and extracts currency code and numeric value.
 */
export function parseCurrencyAndAmount(str) {
  if (!str || typeof str !== 'string') return { code: 'INR', value: 0 };
  const s = str.trim();
  let code = null;

  for (const item of CURRENCY_PREFIX_MAP) {
    if (s.includes(item.prefix)) {
      code = item.code;
      break;
    }
  }

  if (!code) {
    const letters = s.match(/[A-Za-z]{3}/);
    if (letters) {
      const matchCode = letters[0].toUpperCase();
      if (currentRates[matchCode]) code = matchCode;
    }
  }

  if (!code) code = 'INR';

  // Extract clean number: handle commas and decimals
  let numStr = s.replace(/[^0-9.,]/g, '').trim();
  if (numStr.includes(',') && numStr.includes('.')) {
    if (numStr.indexOf(',') < numStr.indexOf('.')) {
      numStr = numStr.replace(/,/g, '');
    } else {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    }
  } else if (numStr.includes(',')) {
    const parts = numStr.split(',');
    if (parts.length === 2 && parts[1].length === 2) {
      numStr = parts[0] + '.' + parts[1];
    } else {
      numStr = numStr.replace(/,/g, '');
    }
  }

  const val = parseFloat(numStr);
  return { code, value: isNaN(val) ? 0 : val };
}

/**
 * Converts a numeric value from source currency to target currency.
 */
export function convertAmount(value, fromCodeOrSymbol, toCodeOrSymbol) {
  if (!value || isNaN(value)) return 0;
  const fromCode = getCurrencyCode(fromCodeOrSymbol);
  const toCode = getCurrencyCode(toCodeOrSymbol);

  if (fromCode === toCode) return value;

  const fromRate = currentRates[fromCode] || DEFAULT_EXCHANGE_RATES[fromCode] || 1;
  const toRate = currentRates[toCode] || DEFAULT_EXCHANGE_RATES[toCode] || 1;

  // Convert to USD first (base), then to target
  const valueInUSD = value / fromRate;
  const converted = valueInUSD * toRate;

  return Math.round(converted * 100) / 100;
}

/**
 * Converts a raw donation string into the target currency value.
 */
export function convertDonationToTargetCurrency(amountStr, targetCurrencySymbolOrCode) {
  const { code, value } = parseCurrencyAndAmount(amountStr);
  return convertAmount(value, code, targetCurrencySymbolOrCode);
}

/**
 * Initializes and fetches live exchange rates from public API in background.
 */
export async function initExchangeRates() {
  if (hasInitialized) return;
  hasInitialized = true;

  // Try loading cached rates from localStorage in browser
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cached = window.localStorage.getItem('multichat_exchange_rates');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.timestamp && Date.now() - parsed.timestamp < 12 * 60 * 60 * 1000 && parsed.rates) {
          currentRates = { ...DEFAULT_EXCHANGE_RATES, ...parsed.rates };
        }
      }
    } catch (_) {}
  }

  // Fetch latest rates in background
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data.result === 'success' && data.rates) {
        currentRates = { ...DEFAULT_EXCHANGE_RATES, ...data.rates };
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem('multichat_exchange_rates', JSON.stringify({
              timestamp: Date.now(),
              rates: data.rates
            }));
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    // Graceful fallback to default baseline rates
  }
}

// Auto-trigger background rate initialization in browser environment
if (typeof window !== 'undefined') {
  initExchangeRates().catch(() => {});
}
