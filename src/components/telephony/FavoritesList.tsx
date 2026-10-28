'use client';

import React, { useState } from 'react';
import { Star, Phone, Trash2, Plus, UserPlus } from 'lucide-react';
import { COUNTRIES } from '../../lib/telephony/phoneUtils';

interface Favorite {
  id: string;
  name: string;
  phoneNumber: string;
  countryCode: string;
  dialCode: string;
}

interface FavoritesListProps {
  favorites: Favorite[];
  onDialNumber: (num: string, countryCode: string) => void;
  onRemoveFavorite: (id: string) => void;
  onAddCustomFavorite: (name: string, phone: string, countryCode: string) => void;
}

export const FavoritesList: React.FC<FavoritesListProps> = ({
  favorites,
  onDialNumber,
  onRemoveFavorite,
  onAddCustomFavorite,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCountry, setNewCountry] = useState('IN');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;
    onAddCustomFavorite(newName, newPhone, newCountry);
    setNewName('');
    setNewPhone('');
    setShowAddForm(false);
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
        <span>Favorite Contacts</span>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAdd} className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 animate-fade-in text-xs">
          <h4 className="font-semibold text-white">Save Quick-Dial Contact</h4>
          <input
            type="text"
            required
            placeholder="Contact Name (e.g. Home, Office, Alice)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex gap-2">
            <select
              value={newCountry}
              onChange={(e) => setNewCountry(e.target.value)}
              className="px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.dialCode}
                </option>
              ))}
            </select>
            <input
              type="tel"
              required
              placeholder="Phone number"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold shadow-md shadow-emerald-500/20"
            >
              Save Contact
            </button>
          </div>
        </form>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {favorites.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            <Star className="h-8 w-8 mx-auto mb-2 opacity-30 text-amber-400" />
            No favorite contacts saved yet. Star a recent call or click &quot;Add&quot;!
          </div>
        ) : (
          favorites.map((fav) => {
            const country = COUNTRIES.find((x) => x.code === fav.countryCode) || COUNTRIES[0];

            return (
              <div
                key={fav.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-lg">
                    {country.flag}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white">{fav.name}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                      <span>{fav.phoneNumber}</span>
                      <span>•</span>
                      <span>{country.name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onRemoveFavorite(fav.id)}
                    title="Remove Favorite"
                    className="p-2 rounded-full text-slate-600 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => onDialNumber(fav.phoneNumber, fav.countryCode)}
                    title="Quick Call"
                    className="flex items-center justify-center h-9 w-9 rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-400 transition-all active:scale-95"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
