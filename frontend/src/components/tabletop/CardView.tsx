import React from 'react';
import { Eye, RefreshCw, Sparkles, Snowflake, Bomb, ArrowLeftRight, Skull, ShieldAlert } from 'lucide-react';
import { CardAction } from '../../types';

export interface CardProps {
  id: string;
  value?: number;
  action?: CardAction;
  labelAr?: string;
  labelEn?: string;
  color?: string;
  isFaceUp: boolean;
  isSelected?: boolean;
  isPeeked?: boolean;
  canInteract?: boolean;
  onClick?: () => void;
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
  lang?: 'ar' | 'en';
}

export const CardView: React.FC<CardProps> = ({
  value,
  action = 'NONE',
  labelAr,
  labelEn,
  color = 'emerald',
  isFaceUp,
  isSelected = false,
  isPeeked = false,
  canInteract = true,
  onClick,
  onLongPressStart,
  onLongPressEnd,
  lang = 'ar'
}) => {
  const isRevealed = isFaceUp || isPeeked;

  const renderActionIcon = (size: number = 18) => {
    switch (action) {
      case 'PEEK_OWN':
        return <Eye size={size} className="text-purple-400" />;
      case 'PEEK_OTHER':
        return <Eye size={size} className="text-amber-400" />;
      case 'SWAP':
        return <ArrowLeftRight size={size} className="text-indigo-400" />;
      case 'PEEK_AND_SWAP':
        return <RefreshCw size={size} className="text-pink-400" />;
      case 'PEEK_ALL':
        return <Sparkles size={size} className="text-amber-300" />;
      case 'FREEZE':
        return <Snowflake size={size} className="text-cyan-400" />;
      case 'BOMB':
        return <Bomb size={size} className="text-red-500" />;
      default:
        if (value === -1) return <Sparkles size={size} className="text-red-400" />;
        if (value && value >= 20) return <Skull size={size} className="text-red-500" />;
        return null;
    }
  };

  const getColorTheme = () => {
    switch (color) {
      case 'crimson':
        return { border: '#EF4444', text: '#F87171', bg: 'rgba(239, 68, 68, 0.12)' };
      case 'gold':
        return { border: '#F59E0B', text: '#FBBF24', bg: 'rgba(245, 158, 11, 0.12)' };
      case 'purple':
        return { border: '#A855F7', text: '#C084FC', bg: 'rgba(168, 85, 247, 0.12)' };
      case 'indigo':
        return { border: '#6366F1', text: '#818CF8', bg: 'rgba(99, 102, 241, 0.12)' };
      case 'amber':
        return { border: '#F97316', text: '#FB923C', bg: 'rgba(249, 115, 22, 0.12)' };
      default:
        return { border: '#10B981', text: '#34D399', bg: 'rgba(16, 185, 129, 0.12)' };
    }
  };

  const theme = getColorTheme();

  return (
    <div
      className="card-perspective-wrapper"
      onClick={canInteract ? onClick : undefined}
      onTouchStart={onLongPressStart}
      onTouchEnd={onLongPressEnd}
      onMouseDown={onLongPressStart}
      onMouseUp={onLongPressEnd}
    >
      <div 
        className={`card-3d ${isRevealed ? 'flipped' : ''} ${isSelected ? 'active-selection' : ''}`}
        style={{
          boxShadow: isSelected 
            ? '0 0 24px rgba(245, 158, 11, 0.8), 0 0 0 2px #F59E0B' 
            : undefined
        }}
      >
        {/* CARD BACK (Luxury Casino Felt & Gold Foil Emblem) */}
        <div className="card-face card-back">
          <div className="card-back-pattern" />
          
          {/* Ornate corner flourishes */}
          <span className="absolute top-1.5 left-2 text-[10px] text-amber-400/60 font-serif">♠</span>
          <span className="absolute top-1.5 right-2 text-[10px] text-amber-400/60 font-serif">♣</span>
          <span className="absolute bottom-1.5 left-2 text-[10px] text-amber-400/60 font-serif">♦</span>
          <span className="absolute bottom-1.5 right-2 text-[10px] text-amber-400/60 font-serif">♥</span>

          <div className="text-center z-10 flex flex-col items-center">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 p-0.5 shadow-md mb-1 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-[#063322] flex items-center justify-center text-amber-300 font-black text-sm">
                ♠
              </div>
            </div>
            <span className="text-sm sm:text-base font-black tracking-widest text-amber-300 drop-shadow">
              SKRU
            </span>
            <span className="text-[11px] font-black text-emerald-300 opacity-95">
              سكرو
            </span>
          </div>
        </div>

        {/* CARD FRONT (Crystal Clear Typography & Action Icons) */}
        <div 
          className="card-face card-front"
          style={{ 
            borderColor: theme.border,
            background: isRevealed ? undefined : undefined
          }}
        >
          {/* Top Corner Index */}
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col items-center">
              <span 
                className="text-sm sm:text-base font-black leading-none drop-shadow-sm font-mono"
                style={{ color: theme.text }}
              >
                {value !== undefined ? (value < 0 ? `${value}` : value) : '?'}
              </span>
            </div>
            <div>{renderActionIcon(14)}</div>
          </div>

          {/* Center Card Content */}
          <div 
            className="flex flex-col items-center justify-center my-auto text-center w-full rounded-xl py-1.5"
            style={{ background: theme.bg }}
          >
            <span 
              className="text-3xl sm:text-4xl font-black tracking-tight drop-shadow font-mono"
              style={{ color: theme.text }}
            >
              {value !== undefined ? value : '?'}
            </span>

            {/* Action Label Pill */}
            {action !== 'NONE' && (
              <span 
                className="text-[10px] font-extrabold mt-1 text-white bg-black/60 px-2 py-0.5 rounded-full border border-white/20 tracking-tight"
              >
                {lang === 'ar' ? labelAr : labelEn}
              </span>
            )}
          </div>

          {/* Bottom Inverted Corner Index */}
          <div className="flex items-center justify-between w-full rotate-180">
            <div className="flex flex-col items-center">
              <span 
                className="text-sm sm:text-base font-black leading-none font-mono"
                style={{ color: theme.text }}
              >
                {value !== undefined ? (value < 0 ? `${value}` : value) : '?'}
              </span>
            </div>
            <div>{renderActionIcon(14)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
