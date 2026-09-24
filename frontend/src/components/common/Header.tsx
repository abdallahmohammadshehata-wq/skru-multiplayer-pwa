import React from 'react';
import { Sun, Moon, Monitor, Volume2, VolumeX, Globe, Layers, Users, Bot, Calculator, BookOpen } from 'lucide-react';
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
  const { language, setLanguage, t, isRtl } = useTranslation();
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

  return (
    <header className="w-full glass-panel px-4 py-3 flex items-center justify-between sticky top-0 z-50 rounded-b-2xl border-t-0 border-x-0">
      {/* Brand logo & title */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelectMode('ONLINE')}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-amber-500 flex items-center justify-center font-black text-white shadow-md shadow-emerald-900/30 text-lg">
          S
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight leading-none text-emerald-400 dark:text-emerald-400">
            {t('app_name')}
          </h1>
          <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">
            SKRU Online & Companion
          </span>
        </div>
      </div>

      {/* Mode navigation pills */}
      <nav className="hidden md:flex items-center gap-1 bg-black/20 dark:bg-black/40 p-1 rounded-full border border-white/5">
        <button
          onClick={() => { sound.playCardSlide(); onSelectMode('ONLINE'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            currentMode === 'ONLINE' 
              ? 'bg-emerald-600 text-white shadow' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users size={14} />
          {language === 'ar' ? 'أونلاين' : 'Online'}
        </button>

        <button
          onClick={() => { sound.playCardSlide(); onSelectMode('SOLO'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            currentMode === 'SOLO' 
              ? 'bg-emerald-600 text-white shadow' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bot size={14} />
          {language === 'ar' ? 'ضد الذكاء الاصطناعي' : 'Solo vs AI'}
        </button>

        <button
          onClick={() => { sound.playCardSlide(); onSelectMode('SCOREKEEPER'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            currentMode === 'SCOREKEEPER' 
              ? 'bg-emerald-600 text-white shadow' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calculator size={14} />
          {language === 'ar' ? 'حاسبة الورق' : 'Scorekeeper'}
        </button>

        <button
          onClick={() => { sound.playCardSlide(); onSelectMode('RULES'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            currentMode === 'RULES' 
              ? 'bg-emerald-600 text-white shadow' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen size={14} />
          {language === 'ar' ? 'القوانين' : 'Rules'}
        </button>
      </nav>

      {/* Control utilities (Theme, Language, Sound, Room Leave) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {roomCode && onLeaveRoom && (
          <button
            onClick={onLeaveRoom}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all mr-1"
          >
            {roomCode} ✕
          </button>
        )}

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          aria-label="Toggle Sound"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-white/5"
        >
          {soundMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Language switcher */}
        <button
          onClick={toggleLang}
          aria-label="Toggle Language"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-white/5 text-xs font-extrabold"
        >
          <Globe size={14} />
          <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
        </button>

        {/* 3-way Theme cycle: Dark -> Light -> Auto */}
        <button
          onClick={cycleTheme}
          aria-label="Toggle Theme"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all border border-white/5 text-xs font-bold"
          title={`Current: ${theme.toUpperCase()} (${resolvedTheme})`}
        >
          {theme === 'dark' && <Moon size={15} className="text-amber-400" />}
          {theme === 'light' && <Sun size={15} className="text-amber-500" />}
          {theme === 'auto' && <Monitor size={15} className="text-emerald-400" />}
          <span className="hidden sm:inline capitalize">{t(`common.${theme}`)}</span>
        </button>
      </div>
    </header>
  );
};
