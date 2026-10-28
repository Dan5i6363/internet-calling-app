'use client';

import React, { useRef } from 'react';
import { dtmfAudio } from '../../lib/telephony/dtmfAudio';
import { Delete } from 'lucide-react';

interface KeypadProps {
  onDigitPress: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

const KEYS = [
  { digit: '1', letters: '' },
  { digit: '2', letters: 'ABC' },
  { digit: '3', letters: 'DEF' },
  { digit: '4', letters: 'GHI' },
  { digit: '5', letters: 'JKL' },
  { digit: '6', letters: 'MNO' },
  { digit: '7', letters: 'PQRS' },
  { digit: '8', letters: 'TUV' },
  { digit: '9', letters: 'WXYZ' },
  { digit: '*', letters: '' },
  { digit: '0', letters: '+' },
  { digit: '#', letters: '' },
];

export const Keypad: React.FC<KeypadProps> = ({
  onDigitPress,
  onBackspace,
  onClear,
}) => {
  const zeroPressTimer = useRef<any>(null);

  const handlePress = (digit: string) => {
    dtmfAudio?.playTone(digit);
    onDigitPress(digit);
  };

  const handleZeroTouchStart = () => {
    zeroPressTimer.current = setTimeout(() => {
      dtmfAudio?.playTone('0');
      onDigitPress('+');
      zeroPressTimer.current = null;
    }, 600);
  };

  const handleZeroTouchEnd = () => {
    if (zeroPressTimer.current) {
      clearTimeout(zeroPressTimer.current);
      zeroPressTimer.current = null;
      handlePress('0');
    }
  };

  return (
    <div className="w-full max-w-[280px] mx-auto grid grid-cols-3 gap-y-3.5 gap-x-6 select-none">
      {KEYS.map((k) => {
        if (k.digit === '0') {
          return (
            <button
              key={k.digit}
              type="button"
              onMouseDown={handleZeroTouchStart}
              onMouseUp={handleZeroTouchEnd}
              onTouchStart={handleZeroTouchStart}
              onTouchEnd={handleZeroTouchEnd}
              className="flex flex-col items-center justify-center h-16 w-16 rounded-full bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 active:scale-95 active:bg-slate-700 transition-all shadow-md mx-auto"
            >
              <span className="text-2xl font-semibold leading-none">{k.digit}</span>
              <span className="text-[10px] text-slate-400 font-bold tracking-widest mt-0.5">
                {k.letters}
              </span>
            </button>
          );
        }

        return (
          <button
            key={k.digit}
            type="button"
            onClick={() => handlePress(k.digit)}
            className="flex flex-col items-center justify-center h-16 w-16 rounded-full bg-slate-900 border border-slate-800 text-slate-100 hover:bg-slate-800 active:scale-95 active:bg-slate-700 transition-all shadow-md mx-auto"
          >
            <span className="text-2xl font-semibold leading-none">{k.digit}</span>
            {k.letters && (
              <span className="text-[9px] text-slate-400 font-bold tracking-widest mt-0.5">
                {k.letters}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
