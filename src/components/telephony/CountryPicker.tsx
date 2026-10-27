'use client';

import React, { useState } from 'react';
import { COUNTRIES, CountryInfo } from '@/lib/telephony/phoneUtils';
import { ChevronDown, Search, X } from 'lucide-react';

interface CountryPickerProps {
  selectedCountry: CountryInfo;
  onSelectCountry: (c: CountryInfo) => void;
}

export const CountryPicker: React.FC<CountryPickerProps> = ({
  selectedCountry,
  onSelectCountry,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-100 text-sm font-semibold transition-colors shrink-0"
        aria-label="Select Country Code"
      >
        <span className="text-lg leading-none">{selectedCountry.flag}</span>
        <span className="text-xs font-mono text-slate-300">{selectedCountry.dialCode}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Select Country Code</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative my-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search country or code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Country List */}
            <div className="overflow-y-auto space-y-1 flex-1 pr-1">
              {filtered.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => {
                    onSelectCountry(country);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                    country.code === selectedCountry.code
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'hover:bg-slate-800/60 text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{country.flag}</span>
                    <span className="text-xs font-medium">{country.name}</span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 font-semibold">
                    {country.dialCode}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
