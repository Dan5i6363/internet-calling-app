'use client';

import React, { useState } from 'react';
import { ShieldAlert, Info, X, CheckCircle2, ExternalLink } from 'lucide-react';
import { EligibilityResult } from '@/lib/telephony/types';

interface EligibilityBannerProps {
  eligibility: EligibilityResult | null;
}

export const EligibilityBanner: React.FC<EligibilityBannerProps> = ({ eligibility }) => {
  const [showModal, setShowModal] = useState(false);

  if (!eligibility) return null;

  return (
    <>
      <div className="w-full mb-3">
        <div
          onClick={() => setShowModal(true)}
          className={`cursor-pointer flex items-center justify-between p-2.5 rounded-2xl border text-xs transition-all ${
            eligibility.isSimulated
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {eligibility.isSimulated ? (
              <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            )}
            <span className="font-semibold truncate">
              {eligibility.isSimulated
                ? 'Simulated Mode (₹0 Budget Active)'
                : 'Live PSTN Outbound Active'}
            </span>
          </div>

          <span className="flex items-center gap-1 text-[11px] underline font-medium opacity-80 shrink-0">
            Details <Info className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* Transparency / Compliance Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in text-slate-100">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Telephony Route Transparency</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 my-4 text-xs text-slate-300 pr-1">
              <div>
                <h4 className="font-bold text-amber-400 mb-1">Why is this a simulation at ₹0?</h4>
                <p className="leading-relaxed text-slate-400">
                  Unlike internet app-to-app calls, dialing arbitrary telephone numbers requires
                  terminating audio packets into the physical telecom network (PSTN / PLMN). No
                  telecom provider in India or internationally terminates real calls to Indian mobile
                  numbers for free.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <h5 className="font-semibold text-white">DoT & TRAI Regulations (India):</h5>
                <ul className="list-disc list-inside space-y-1.5 text-slate-400">
                  <li>
                    <strong className="text-slate-300">Toll Bypass Laws:</strong> Routing internet voice traffic directly into the Indian PSTN without passing through a licensed Access Service Provider is illegal under the Telecommunications Act 2023.
                  </li>
                  <li>
                    <strong className="text-slate-300">TRAI DLT Portal:</strong> Commercial and automated calls require business KYC and approved headers registered on telecom DLT platforms.
                  </li>
                  <li>
                    <strong className="text-slate-300">Anti-Spoofing:</strong> Unverified Caller ID (CLI) injection is blocked by Indian telecom firewalls.
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-white mb-1">How to enable real telephone calling:</h4>
                <ol className="list-decimal list-inside space-y-1 text-slate-400">
                  <li>Obtain a verified Twilio, Plivo, or Exotel account with positive account balance.</li>
                  <li>Configure <code className="text-emerald-400 font-mono">TWILIO_ACCOUNT_SID</code>, <code className="text-emerald-400 font-mono">TWILIO_AUTH_TOKEN</code>, and <code className="text-emerald-400 font-mono">ENABLE_REAL_PSTN_CALLS=true</code> in your environment variables.</li>
                  <li>Ensure your destination number is either pre-verified (for trial accounts) or approved by carrier KYC.</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </>
  );
};
