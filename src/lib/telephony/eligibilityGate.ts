import { EligibilityResult, ITelephonyProvider } from './types';
import { mockTelephonyProvider } from './providers/mockProvider';
import { twilioVoiceProvider } from './providers/twilioProvider';
const { evaluateEligibility } = require('../../../server/telephonyUtils');

export class EligibilityGate {
  evaluateEligibility(targetCountryCode = 'IN'): EligibilityResult {
    return evaluateEligibility(targetCountryCode);
  }

  getActiveProvider(targetCountryCode: string): ITelephonyProvider {
    const result = this.evaluateEligibility(targetCountryCode);
    if (result.eligibleForRealCalls && twilioVoiceProvider.isConfigured()) {
      return twilioVoiceProvider;
    }
    return mockTelephonyProvider;
  }
}

export const eligibilityGate = new EligibilityGate();
