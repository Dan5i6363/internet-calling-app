const COUNTRIES = [
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', format: '98765 43210', minLen: 10, maxLen: 10 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', format: '(555) 012-3456', minLen: 10, maxLen: 10 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', format: '7911 123456', minLen: 10, maxLen: 11 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', format: '50 123 4567', minLen: 9, maxLen: 9 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', format: '(555) 012-3456', minLen: 10, maxLen: 10 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', format: '412 345 678', minLen: 9, maxLen: 9 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', format: '8123 4567', minLen: 8, maxLen: 8 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', format: '151 12345678', minLen: 10, maxLen: 11 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', format: '6 12 34 56 78', minLen: 9, maxLen: 9 },
  { code: 'JP', name: 'Japan', dialCode: '+81', flag: '🇯🇵', format: '90 1234 5678', minLen: 10, maxLen: 10 },
  { code: 'SA', name: 'Saudi Arabia', dialCode: '+966', flag: '🇸🇦', format: '50 123 4567', minLen: 9, maxLen: 9 },
  { code: 'MY', name: 'Malaysia', dialCode: '+60', flag: '🇲🇾', format: '12-345 6789', minLen: 9, maxLen: 10 },
  { code: 'NZ', name: 'New Zealand', dialCode: '+64', flag: '🇳🇿', format: '21 123 4567', minLen: 8, maxLen: 10 },
  { code: 'ZA', name: 'South Africa', dialCode: '+27', flag: '🇿🇦', format: '82 123 4567', minLen: 9, maxLen: 9 },
  { code: 'BR', name: 'Brazil', dialCode: '+55', flag: '🇧🇷', format: '11 91234-5678', minLen: 10, maxLen: 11 },
];

function validateAndFormatNumber(input, selectedCountry = COUNTRIES[0]) {
  const cleanInput = (input || '').trim();
  if (!cleanInput) {
    return {
      isValid: false,
      e164: '',
      rawDigits: '',
      dialCode: selectedCountry.dialCode,
      nationalNumber: '',
      country: selectedCountry,
      errorMessage: 'Phone number is required',
    };
  }

  if (cleanInput.startsWith('+')) {
    const digitsOnly = cleanInput.replace(/\D/g, '');
    for (const country of COUNTRIES) {
      const codeDigits = country.dialCode.replace('+', '');
      if (digitsOnly.startsWith(codeDigits)) {
        const nationalPart = digitsOnly.substring(codeDigits.length);
        const isValid = nationalPart.length >= country.minLen && nationalPart.length <= country.maxLen;
        return {
          isValid,
          e164: `+${digitsOnly}`,
          rawDigits: digitsOnly,
          dialCode: country.dialCode,
          nationalNumber: nationalPart,
          country,
          errorMessage: isValid ? undefined : `Must be ${country.minLen} digits for ${country.name}`,
        };
      }
    }

    const isValid = digitsOnly.length >= 7 && digitsOnly.length <= 15;
    return {
      isValid,
      e164: `+${digitsOnly}`,
      rawDigits: digitsOnly,
      dialCode: '+',
      nationalNumber: digitsOnly,
      country: selectedCountry,
      errorMessage: isValid ? undefined : 'Invalid international number length (7-15 digits)',
    };
  }

  const digits = cleanInput.replace(/\D/g, '');
  const isValid = digits.length >= selectedCountry.minLen && digits.length <= selectedCountry.maxLen;
  const e164 = `${selectedCountry.dialCode}${digits}`;

  return {
    isValid,
    e164,
    rawDigits: digits,
    dialCode: selectedCountry.dialCode,
    nationalNumber: digits,
    country: selectedCountry,
    errorMessage: isValid ? undefined : `Phone number must be ${selectedCountry.minLen} digits for ${selectedCountry.name}`,
  };
}

function evaluateEligibility(targetCountryCode = 'IN') {
  const enableReal = process.env.ENABLE_REAL_PSTN_CALLS === 'true';
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER &&
    !process.env.TWILIO_ACCOUNT_SID.includes('placeholder')
  );
  const isIndia = targetCountryCode === 'IN';
  const blockers = [];

  blockers.push('Budget: Initial product budget is ₹0. Telecom carriers charge ~₹0.80 to ₹3.50/min for outbound PSTN termination to Indian mobiles.');

  if (isIndia) {
    blockers.push('DoT Regulation: Under the Indian Telecommunications Act 2023 & DoT OSP guidelines, IP-to-PSTN toll bypass is prohibited without an authorized Unified License (UL) gateway.');
    blockers.push('TRAI DLT Requirement: Commercial or bulk calling to Indian numbers requires Principal Entity registration on telecom DLT portals with verified headers.');
  }

  if (!hasTwilio) {
    blockers.push('Provider Credentials: No active production telephony provider credentials configured in environment variables.');
  } else {
    blockers.push('Trial Limitation: Telephony API trial accounts restrict outbound calls exclusively to pre-verified numbers, preventing arbitrary mobile dialing.');
  }

  if (enableReal && hasTwilio && !isIndia) {
    return {
      eligibleForRealCalls: true,
      activeProvider: 'twilio',
      isSimulated: false,
      costPerMinuteINR: 2.50,
      budgetRemainingINR: 0,
      regulatoryNotice: 'Active Live Telephony Route (International PSTN)',
      blockers: [],
    };
  }

  return {
    eligibleForRealCalls: false,
    activeProvider: 'mock',
    isSimulated: true,
    costPerMinuteINR: 0,
    budgetRemainingINR: 0,
    regulatoryNotice: isIndia
      ? 'Simulated Mode Active (₹0 Budget): Free arbitrary dialing to Indian mobile numbers is legally & commercially restricted without licensed telecom interconnection.'
      : 'Simulated Mode Active: Real telephony is disabled. Operating in high-fidelity mock mode for demonstration and testing.',
    blockers,
  };
}

class MockTelephonyProvider {
  constructor() {
    this.name = 'MockTelephonyEngine (₹0 Demo)';
    this.isSimulated = true;
    this.sessions = new Map();
  }

  async initiateCall(req) {
    const callId = 'mock_call_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    if (req.simulateFailure || (req.targetNumber && req.targetNumber.endsWith('00000'))) {
      const failedSession = {
        callId,
        targetNumber: req.targetNumber,
        countryCode: req.countryCode,
        providerName: this.name,
        isSimulated: true,
        state: 'unavailable',
        startedAt: Date.now(),
        endedAt: Date.now(),
        durationSeconds: 0,
        endReason: 'Simulated: Destination subscriber is busy or unavailable',
      };
      this.sessions.set(callId, failedSession);
      return failedSession;
    }

    const session = {
      callId,
      targetNumber: req.targetNumber,
      countryCode: req.countryCode,
      providerName: this.name,
      isSimulated: true,
      state: 'connecting',
      startedAt: Date.now(),
      durationSeconds: 0,
    };

    this.sessions.set(callId, session);

    // Realistic state progression:
    // 1.2s -> ringing
    setTimeout(() => {
      const s = this.sessions.get(callId);
      if (s && s.state === 'connecting') {
        s.state = 'ringing';
      }
    }, 1200);

    // 4.5s -> unavailable (NEVER connected, because no real telephone connection exists at ₹0)
    setTimeout(() => {
      const s = this.sessions.get(callId);
      if (s && s.state === 'ringing') {
        s.state = 'unavailable';
        s.endedAt = Date.now();
        s.durationSeconds = 0;
        s.endReason =
          'Real phone call blocked: ₹0 budget cannot place outbound calls to mobile networks. Outbound PSTN disabled under Indian DoT regulations.';
      }
    }, 4500);

    return session;
  }

  async terminateCall(callId) {
    const session = this.sessions.get(callId);
    if (!session) {
      return { success: false, durationSeconds: 0 };
    }

    const now = Date.now();
    session.endedAt = now;
    session.state = 'ended';
    session.durationSeconds = 0;
    session.endReason = 'Call ended by caller';

    return { success: true, durationSeconds: 0 };
  }

  async getCallStatus(callId) {
    const session = this.sessions.get(callId);
    if (!session) return null;
    return session;
  }
}

const mockTelephonyProvider = new MockTelephonyProvider();

module.exports = {
  COUNTRIES,
  validateAndFormatNumber,
  evaluateEligibility,
  mockTelephonyProvider,
};
