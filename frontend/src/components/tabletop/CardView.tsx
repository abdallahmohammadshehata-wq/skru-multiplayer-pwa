import React from 'react';
import { Eye, RefreshCw, EyeOff, Sparkles, Snowflake, Bomb, ShieldAlert, ArrowLeftRight } from 'lucide-react';
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

  const renderActionIcon = () => {
    switch (action) {
      case 'PEEK_OWN':
        return <Eye size={18} className="text-purple-400" />;
      case 'PEEK_OTHER':
        return <Eye size={18} className="text-amber-400" />;
      case 'SWAP':
        return <ArrowLeftRight size={18} className="text-indigo-400" />;
      case 'PEEK_AND_SWAP':
        return <RefreshCw size={18} className="text-pink-400" />;
      case 'PEEK_ALL':
        return <Sparkles size={18} className="text-yellow-400" />;
      case 'FREEZE':
        return <Snowflake size={18} className="text-cyan-400" />;
      case 'BOMB':
        return <Bomb size={18} className="text-red-500" />;
      case 'WILD':
        return <Sparkles size={18} className="text-amber-300" />;
      default:
        return null;
    }
  };

  const getBorderColor = () => {
    switch (color) {
      case 'crimson': return '#EF4444';
      case 'gold': return '#F59E0B';
      case 'purple': return '#A855F7';
      case 'indigo': return '#6366F1';
      case 'amber': return '#F97316';
      default: return '#10B981';
    }
  };

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
        style={{ borderColor: isSelected ? '#F59E0B' : undefined }}
      >
        {/* CARD BACK */}
        <div className="card-face card-back">
          <div className="card-back-pattern" />
          <div className="text-center z-10">
            <span className="text-xl font-extrabold tracking-wider text-amber-300 drop-shadow">
              SKRU
            </span>
            <div className="text-xs font-bold text-emerald-300 opacity-90 mt-0.5">
              سكرو
            </div>
          </div>
        </div>

        {/* CARD FRONT */}
        <div 
          className="card-face card-front"
          style={{ borderColor: getBorderColor() }}
        >
          {/* Top header corner */}
          <div className="flex items-center justify-between w-full">
            <span 
              className="text-base font-black leading-none"
              style={{ color: getBorderColor() }}
            >
              {value !== undefined ? (value < 0 ? `${value}` : value) : '?'}
            </span>
            <div>{renderActionIcon()}</div>
          </div>

          {/* Center value / action badge */}
          <div className="flex flex-col items-center justify-center my-auto text-center px-1">
            <span 
              className="text-2xl sm:text-3xl font-black tracking-tight"
              style={{ color: getBorderColor() }}
            >
              {value !== undefined ? value : '?'}
            </span>
            {action !== 'NONE' && (
              <span className="text-[10px] font-bold mt-1 text-slate-300 dark:text-slate-300 bg-black/40 px-1.5 py-0.5 rounded-full line-clamp-1 max-w-[70px]">
                {lang === 'ar' ? labelAr : labelEn}
              </span>
            )}
          </div>

          {/* Bottom inverse corner */}
          <div className="flex items-center justify-between w-full rotate-180">
            <span 
              className="text-base font-black leading-none"
              style={{ color: getBorderColor() }}
            >
              {value !== undefined ? (value < 0 ? `${value}` : value) : '?'}
            </span>
            <div>{renderActionIcon()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
