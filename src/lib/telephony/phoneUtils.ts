export interface CountryInfo {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  format: string;
  minLen: number;
  maxLen: number;
}

export interface PhoneValidationResult {
  isValid: boolean;
  e164: string;
  rawDigits: string;
  dialCode: string;
  nationalNumber: string;
  country: CountryInfo;
  errorMessage?: string;
}

const rawUtils = require('../../../server/telephonyUtils');

export const COUNTRIES: CountryInfo[] = rawUtils.COUNTRIES;

export const validateAndFormatNumber: (
  input: string,
  selectedCountry?: CountryInfo
) => PhoneValidationResult = rawUtils.validateAndFormatNumber;

export function formatDisplayNumber(digits: string, country: CountryInfo): string {
  if (!digits) return '';
  if (country.code === 'IN' && digits.length === 10) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if ((country.code === 'US' || country.code === 'CA') && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return digits;
}
