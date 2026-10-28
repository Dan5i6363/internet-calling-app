'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Phone, Delete, Star, Clock, Grid, AlertCircle, Info, Radio } from 'lucide-react';
import { COUNTRIES, CountryInfo, validateAndFormatNumber, formatDisplayNumber } from '../../lib/telephony/phoneUtils';
import { CountryPicker } from './CountryPicker';
import { Keypad } from './Keypad';
import { EligibilityBanner } from './EligibilityBanner';
import { ActiveCallScreen } from './ActiveCallScreen';
import { CallHistoryList } from './CallHistoryList';
import { FavoritesList } from './FavoritesList';
import { CallProgressState, EligibilityResult } from '../../lib/telephony/types';

export const PhoneDialerApp: React.FC<{ onSwitchToAppCall?: () => void }> = ({
  onSwitchToAppCall,
}) => {
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(COUNTRIES[0]); // Default India +91
  const [rawDigits, setRawDigits] = useState<string>('');
  const [subTab, setSubTab] = useState<'dialer' | 'recents' | 'favorites'>('dialer');

  // Eligibility and Route data
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null);

  // Active call state
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callState, setCallState] = useState<CallProgressState>('idle');
  const [isCalling, setIsCalling] = useState(false);
  const [targetNumberE164, setTargetNumberE164] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // History & Favorites
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<any[]>([]);

  const pollIntervalRef = useRef<any>(null);

  // 1. Fetch eligibility & history on mount
  useEffect(() => {
    fetchEligibility(selectedCountry.code);
    loadRecentCalls();
    loadFavorites();
  }, [selectedCountry.code]);

  const fetchEligibility = async (countryCode: string) => {
    try {
      const res = await fetch(`/api/telephony/eligibility?country=${countryCode}`);
      if (res.ok) {
        const data = await res.json();
        setEligibility(data);
      }
    } catch (e) {
      console.warn('Eligibility fetch failed:', e);
    }
  };

  const loadRecentCalls = async () => {
    try {
      const res = await fetch('/api/telephony/recents');
      if (res.ok) {
        const data = await res.json();
        setRecentCalls(data.calls || []);
      }
    } catch (e) {}
  };

  const loadFavorites = async () => {
    try {
      const res = await fetch('/api/telephony/favorites');
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (e) {}
  };

  // Dialpad handlers
  const handleDigitPress = (digit: string) => {
    setErrorMsg('');
    setRawDigits((prev) => (prev.length < 15 ? prev + digit : prev));
  };

  const handleBackspace = () => {
    setErrorMsg('');
    setRawDigits((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setErrorMsg('');
    setRawDigits('');
  };

  // Validation
  const validation = validateAndFormatNumber(rawDigits, selectedCountry);

  // Call placement
  const handleInitiateCall = async (overrideNumber?: string, overrideCountryCode?: string) => {
    setErrorMsg('');
    const countryToUse = overrideCountryCode
      ? COUNTRIES.find((c) => c.code === overrideCountryCode) || selectedCountry
      : selectedCountry;

    const numberToUse = overrideNumber || rawDigits;
    const val = validateAndFormatNumber(numberToUse, countryToUse);

    if (!val.isValid) {
      setErrorMsg(val.errorMessage || 'Please enter a valid phone number');
      return;
    }

    setIsCalling(true);
    setCallState('validating');
    setTargetNumberE164(val.e164);

    try {
      const res = await fetch('/api/telephony/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: val.e164,
          countryCode: countryToUse.code,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate telephony call');
      }

      setActiveCallId(data.session.callId);
      setCallState(data.session.state);

      // Start status polling
      startPolling(data.session.callId, countryToUse.code);
    } catch (err: any) {
      setErrorMsg(err.message || 'Call failed');
      setCallState('idle');
      setIsCalling(false);
    }
  };

  const startPolling = (callId: string, countryCode: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/telephony/status?callId=${callId}&countryCode=${countryCode}`);
        if (res.ok) {
          const data = await res.json();
          setCallState(data.session.state);

          if (data.session.state === 'ended' || data.session.state === 'failed') {
            stopPolling();
            setTimeout(() => {
              setCallState('idle');
              setIsCalling(false);
              setActiveCallId(null);
              loadRecentCalls();
            }, 1800);
          }
        }
      } catch (e) {
        // Continue polling
      }
    }, 1500);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const handleEndCall = async () => {
    stopPolling();
    if (activeCallId) {
      try {
        await fetch('/api/telephony/hangup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: activeCallId,
            countryCode: selectedCountry.code,
          }),
        });
      } catch (e) {}
    }

    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setIsCalling(false);
      setActiveCallId(null);
      loadRecentCalls();
    }, 800);
  };

  const handleAddFavorite = async (number: string, countryCode: string) => {
    try {
      const res = await fetch('/api/telephony/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Contact ${number.slice(-4)}`,
          phoneNumber: number,
          countryCode,
        }),
      });
      if (res.ok) loadFavorites();
    } catch (e) {}
  };

  const handleRemoveFavorite = async (id: string) => {
    try {
      const res = await fetch(`/api/telephony/favorites?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) loadFavorites();
    } catch (e) {}
  };

  const handleAddCustomFavorite = async (name: string, phone: string, countryCode: string) => {
    try {
      const res = await fetch('/api/telephony/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phoneNumber: phone, countryCode }),
      });
      if (res.ok) loadFavorites();
    } catch (e) {}
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Route & Compliance Transparency Banner */}
      <EligibilityBanner eligibility={eligibility} />

      {/* App-to-App Call Callout */}
      {onSwitchToAppCall && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-400 shrink-0 animate-pulse" />
            <div>
              <p className="font-semibold text-emerald-300">Want free two-way audio calling?</p>
              <p className="text-[11px] text-emerald-400/80">Real peer-to-peer WebRTC calls with other users cost ₹0.</p>
            </div>
          </div>
          <button
            onClick={onSwitchToAppCall}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-colors shrink-0"
          >
            App Call
          </button>
        </div>
      )}

      {/* Mode Sub-navigation */}
      <div className="flex items-center justify-center p-1 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold">
        <button
          onClick={() => setSubTab('dialer')}
          className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'dialer'
              ? 'bg-emerald-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="h-3.5 w-3.5" />
          <span>Keypad</span>
        </button>

        <button
          onClick={() => setSubTab('recents')}
          className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'recents'
              ? 'bg-emerald-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Recent Calls</span>
        </button>

        <button
          onClick={() => setSubTab('favorites')}
          className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            subTab === 'favorites'
              ? 'bg-emerald-500 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Star className="h-3.5 w-3.5" />
          <span>Favorites</span>
        </button>
      </div>

      {/* Sub-tab Views */}
      {subTab === 'dialer' && (
        <div className="flex-1 flex flex-col justify-between">
          {/* Phone Number Display & Country Selector */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <CountryPicker
                selectedCountry={selectedCountry}
                onSelectCountry={setSelectedCountry}
              />

              <div className="relative flex-1">
                <input
                  type="tel"
                  placeholder={selectedCountry.format}
                  value={rawDigits}
                  onChange={(e) => {
                    setErrorMsg('');
                    setRawDigits(e.target.value.replace(/[^\d+*#]/g, ''));
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-2xl text-lg font-mono font-bold tracking-wider text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
                {rawDigits && (
                  <button
                    onClick={handleBackspace}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                  >
                    <Delete className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Error or validation feedback */}
            {errorMsg ? (
              <div className="flex items-center gap-1.5 text-rose-400 text-xs px-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            ) : rawDigits ? (
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
                <span>E.164: {validation.e164 || 'Formatting...'}</span>
                {validation.isValid && (
                  <span className="text-emerald-400 font-semibold">Valid Number</span>
                )}
              </div>
            ) : null}
          </div>

          {/* Keypad */}
          <div className="my-auto py-2">
            <Keypad
              onDigitPress={handleDigitPress}
              onBackspace={handleBackspace}
              onClear={handleClear}
            />
          </div>

          {/* Call Button */}
          <div className="pb-2 flex flex-col items-center">
            <button
              disabled={isCalling || !rawDigits}
              onClick={() => handleInitiateCall()}
              className="flex items-center justify-center gap-2 h-16 w-16 md:h-18 md:w-18 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-xl shadow-emerald-500/25 active:scale-90 transition-all disabled:opacity-40 disabled:scale-100 disabled:shadow-none"
              aria-label={
                eligibility?.isSimulated
                  ? 'Simulated Dialer Test (Outbound PSTN Disabled)'
                  : 'Initiate Real Telephony Call'
              }
            >
              <Phone className="h-7 w-7" />
            </button>
            <span className="text-[10px] text-slate-500 mt-2 font-medium tracking-wide">
              {eligibility?.isSimulated
                ? 'Simulated Dial Test • Real Outbound Disabled (₹0)'
                : 'Carrier Interconnect Active'}
            </span>
          </div>
        </div>
      )}

      {subTab === 'recents' && (
        <CallHistoryList
          calls={recentCalls}
          onDialNumber={(num, cCode) => {
            setSubTab('dialer');
            const country = COUNTRIES.find((c) => c.code === cCode) || selectedCountry;
            setSelectedCountry(country);
            setRawDigits(num.replace(country.dialCode, ''));
            handleInitiateCall(num, cCode);
          }}
          onAddFavorite={handleAddFavorite}
        />
      )}

      {subTab === 'favorites' && (
        <FavoritesList
          favorites={favorites}
          onDialNumber={(num, cCode) => {
            setSubTab('dialer');
            const country = COUNTRIES.find((c) => c.code === cCode) || selectedCountry;
            setSelectedCountry(country);
            setRawDigits(num.replace(country.dialCode, ''));
            handleInitiateCall(num, cCode);
          }}
          onRemoveFavorite={handleRemoveFavorite}
          onAddCustomFavorite={handleAddCustomFavorite}
        />
      )}

      {/* Active Call Overlay */}
      {callState !== 'idle' && (
        <ActiveCallScreen
          targetNumber={targetNumberE164}
          countryFlag={selectedCountry.flag}
          countryName={selectedCountry.name}
          callState={callState}
          isSimulated={Boolean(eligibility?.isSimulated)}
          onEndCall={handleEndCall}
        />
      )}
    </div>
  );
};
