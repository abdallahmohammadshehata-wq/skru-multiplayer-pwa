import React from 'react';
import { Sun, Moon, Monitor, Volume2, VolumeX, Globe, Users, Bot, Calculator, BookOpen, LogOut } from 'lucide-react';
import { useTheme } from '../../theme/ThemeContext';
import { useTranslation } from '../../i18n/I18nContext';
import { sound } from '../../utils/audio';

export type AppMode = 'ONLINE' | 'SOLO' | 'SCOREKEEPER' | 'RULES';

interface HeaderProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  roomCode?: string;
  onLeaveRoom?: () => void;
  isInGame?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onSelectMode,
  roomCode,
  onLeaveRoom,
  isInGame = false
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const [soundMuted, setSoundMuted] = React.useState(!sound.enabled);
  const [showMobileMenu, setShowMobileMenu] = React.useState(false);

  const toggleSound = () => {
    sound.enabled = !sound.enabled;
    setSoundMuted(!sound.enabled);
    if (sound.enabled) sound.playCardFlip();
  };

  const cycleTheme = () => {
    sound.playCardSlide();
    if (theme === 'dark') setTheme('light');
    else if (theme === 'light') setTheme('auto');
    else setTheme('dark');
  };

  const toggleLang = () => {
    sound.playCardFlip();
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const navItems: Array<{ mode: AppMode; labelAr: string; labelEn: string; icon: any }> = [
    { mode: 'ONLINE', labelAr: 'أونلاين', labelEn: 'Online', icon: Users },
    { mode: 'SOLO', labelAr: 'ضد الذكاء', labelEn: 'Solo vs AI', icon: Bot },
    { mode: 'SCOREKEEPER', labelAr: 'حاسبة الورق', labelEn: 'Scorekeeper', icon: Calculator },
    { mode: 'RULES', labelAr: 'القوانين', labelEn: 'Rules', icon: BookOpen },
  ];

  return (
    <>
      {/* TOP DESKTOP & MOBILE HEADER */}
      <header className="w-full glass-panel px-2.5 sm:px-6 py-2 sm:py-3 flex items-center justify-between sticky top-0 z-50 rounded-b-2xl border-t-0 border-x-0 shadow-lg">
        {/* Brand logo & title */}
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={() => {
            if (isInGame && onLeaveRoom) {
              if (window.confirm(language === 'ar' ? 'هل تريد الخروج من المباراة الحالية؟' : 'Leave current match?')) {
                onLeaveRoom();
              }
            } else {
              onSelectMode('ONLINE');
            }
          }}
        >
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-emerald-600 via-amber-500 to-emerald-500 flex items-center justify-center font-black text-white shadow-lg shadow-amber-500/20 text-lg sm:text-xl border border-white/20 group-hover:scale-105 transition-transform flex-shrink-0">
            ♠
          </div>
          <div>
            <div className="flex items-center gap-1">
              <h1 className="text-base sm:text-2xl font-black tracking-tight leading-none text-amber-400 drop-shadow-sm truncate max-w-[110px] sm:max-w-none">
                {t('app_name')}
              </h1>
              <span className="text-[9px] sm:text-[10px] font-black px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 hidden sm:inline">
              {language === 'ar' ? 'لعبة الورق المصرية' : 'Egyptian Card Game'}
            </span>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-black/30 p-1.5 rounded-full border border-white/10 backdrop-blur-md">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentMode === item.mode;
            return (
              <button
                key={item.mode}
                onClick={() => { sound.playCardSlide(); onSelectMode(item.mode); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-900/40 scale-105' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={15} />
                <span>{language === 'ar' ? item.labelAr : item.labelEn}</span>
              </button>
            );
          })}
        </nav>

        {/* Header Right Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {isInGame && (
            <button
              onClick={() => {
                if (onLeaveRoom) {
                  onLeaveRoom();
                } else {
                  onSelectMode('ONLINE');
                }
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-black rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 active:scale-95 transition-all shadow"
              title="خروج"
            >
              <LogOut size={13} />
              <span>{language === 'ar' ? 'خروج' : 'Exit'}</span>
            </button>
          )}

          {roomCode && !isInGame && onLeaveRoom && (
            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-black rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 active:scale-95 transition-all shadow"
              title="خروج من الغرفة"
            >
              <LogOut size={13} />
              <span>{roomCode}</span>
            </button>
          )}

          {/* Sound toggle */}
          <button
            onClick={toggleSound}
            aria-label="Toggle Sound"
            className="p-1.5 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-white/10 active:scale-95"
            title={soundMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {soundMuted ? <VolumeX size={16} className="text-red-400" /> : <Volume2 size={16} className="text-emerald-400" />}
          </button>

          {/* Language toggle */}
          <button
            onClick={toggleLang}
            aria-label="Toggle Language"
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 transition-all border border-white/10 text-xs font-black active:scale-95"
          >
            <Globe size={14} className="text-amber-400" />
            <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* Theme switcher */}
          <button
            onClick={cycleTheme}
            aria-label="Toggle Theme"
            className="flex items-center gap-1 p-1.5 sm:px-3 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 transition-all border border-white/10 text-xs font-black active:scale-95"
            title={`Mode: ${theme.toUpperCase()} (${resolvedTheme})`}
          >
            {theme === 'dark' && <Moon size={15} className="text-amber-400" />}
            {theme === 'light' && <Sun size={15} className="text-amber-500" />}
            {theme === 'auto' && <Monitor size={15} className="text-emerald-400" />}
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION DOCK - Only shown when NOT inside active gameplay */}
      {!isInGame && (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-panel px-2 py-2 flex items-center justify-around border-b-0 border-x-0 rounded-t-2xl shadow-2xl backdrop-blur-xl pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentMode === item.mode;
            return (
              <button
                key={item.mode}
                onClick={() => { sound.playCardSlide(); onSelectMode(item.mode); }}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-all ${
                  isActive 
                    ? 'text-amber-400 font-black scale-105' 
                    : 'text-slate-400 font-semibold hover:text-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-amber-400/20 shadow-sm' : ''}`}>
                  <Icon size={18} />
                </div>
                <span className="text-[11px] leading-tight">
                  {language === 'ar' ? item.labelAr : item.labelEn}
                </span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
};
