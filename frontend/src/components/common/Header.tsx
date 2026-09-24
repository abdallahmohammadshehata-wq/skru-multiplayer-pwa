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
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onSelectMode,
  roomCode,
  onLeaveRoom
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();
  const [soundMuted, setSoundMuted] = React.useState(!sound.enabled);

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
      <header className="w-full glass-panel px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between sticky top-0 z-50 rounded-b-2xl border-t-0 border-x-0 shadow-lg">
        {/* Brand logo & title */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer group" 
          onClick={() => onSelectMode('ONLINE')}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-amber-500 to-emerald-500 flex items-center justify-center font-black text-white shadow-lg shadow-amber-500/20 text-xl border border-white/20 group-hover:scale-105 transition-transform">
            ♠
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-none text-amber-400 drop-shadow-sm">
                {t('app_name')}
              </h1>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
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
        <div className="flex items-center gap-1.5 sm:gap-2">
          {roomCode && onLeaveRoom && (
            <button
              onClick={onLeaveRoom}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 active:scale-95 transition-all shadow"
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
            className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-white/10 active:scale-95"
            title={soundMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {soundMuted ? <VolumeX size={17} className="text-red-400" /> : <Volume2 size={17} className="text-emerald-400" />}
          </button>

          {/* Language toggle */}
          <button
            onClick={toggleLang}
            aria-label="Toggle Language"
            className="flex items-center gap-1 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 transition-all border border-white/10 text-xs font-black active:scale-95"
          >
            <Globe size={15} className="text-amber-400" />
            <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
          </button>

          {/* Theme switcher */}
          <button
            onClick={cycleTheme}
            aria-label="Toggle Theme"
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 transition-all border border-white/10 text-xs font-black active:scale-95"
            title={`Mode: ${theme.toUpperCase()} (${resolvedTheme})`}
          >
            {theme === 'dark' && <Moon size={16} className="text-amber-400" />}
            {theme === 'light' && <Sun size={16} className="text-amber-500" />}
            {theme === 'auto' && <Monitor size={16} className="text-emerald-400" />}
            <span className="hidden sm:inline capitalize">{t(`common.${theme}`)}</span>
          </button>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION DOCK (Native App Ergonomics) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass-panel px-2 py-2 flex items-center justify-around border-b-0 border-x-0 rounded-t-2xl shadow-2xl backdrop-blur-xl">
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
    </>
  );
};
