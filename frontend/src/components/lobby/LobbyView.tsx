import React, { useState } from 'react';
import { Users, Crown, Copy, Check, Shield, Sparkles, Clock, ArrowRight, Play, UserPlus } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';
import { GameVariant } from '../../types';
import { sound } from '../../utils/audio';

const AVATARS = ['🦁', '🦊', '🐯', '🐺', '🦅', '🐼', '👑', '🚀', '💎', '🎯', '⚡', '☕'];

interface LobbyViewProps {
  lobbyState: any | null;
  onJoinRoom: (roomCode: string, name: string, avatar: string, passcode?: string, team?: 'A' | 'B') => void;
  onCreateRoom: (name: string, avatar: string, options: any) => void;
  onStartGame: () => void;
  myPlayerId: string;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  lobbyState,
  onJoinRoom,
  onCreateRoom,
  onStartGame,
  myPlayerId
}) => {
  const { t, language } = useTranslation();

  const [activeTab, setActiveTab] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [name, setName] = useState<string>(() => localStorage.getItem('skru_player_name') || 'سريع');
  const [avatar, setAvatar] = useState<string>(() => localStorage.getItem('skru_player_avatar') || '🦁');
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [teamSelection, setTeamSelection] = useState<'A' | 'B'>('A');

  // Create room options
  const [variant, setVariant] = useState<GameVariant>('CLASSIC');
  const [pointsCap, setPointsCap] = useState<number>(100);
  const [turnTimer, setTurnTimer] = useState<number>(20);
  const [maxPlayers, setMaxPlayers] = useState<number>(4);
  const [copied, setCopied] = useState<boolean>(false);

  const saveProfile = () => {
    localStorage.setItem('skru_player_name', name);
    localStorage.setItem('skru_player_avatar', avatar);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    saveProfile();
    sound.playCardFlip();
    onJoinRoom(roomCodeInput.toUpperCase().trim(), name.trim() || 'Player', avatar, passcodeInput, teamSelection);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile();
    sound.playCardFlip();
    onCreateRoom(name.trim() || 'Player', avatar, {
      variant,
      pointsCap,
      turnTimer,
      maxPlayers,
      passcode: passcodeInput
    });
  };

  const copyRoomLink = () => {
    if (!lobbyState?.roomCode) return;
    sound.playMatchSuccess();
    const url = `${window.location.origin}${window.location.pathname}?room=${lobbyState.roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // If in an active waiting room lobby
  if (lobbyState && lobbyState.status === 'LOBBY') {
    const isHost = lobbyState.hostId === myPlayerId;
    const is2v2 = lobbyState.options?.variant === 'SAHEB_SA7BO';

    return (
      <div className="w-full max-w-2xl mx-auto p-4 flex flex-col gap-5">
        {/* Room Header Card */}
        <div className="glass-panel p-6 text-center flex flex-col items-center relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500" />
          
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
            {t('lobby.room_code')}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-4xl sm:text-5xl font-black text-amber-400 tracking-wider font-mono">
              {lobbyState.roomCode}
            </span>
            <button
              onClick={copyRoomLink}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10"
              title={t('common.copy')}
            >
              {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
              {t(`lobby.variant_${lobbyState.options?.variant.toLowerCase().split('_')[0]}`)}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
              {lobbyState.options?.pointsCap} {t('game.score')}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
              {lobbyState.options?.turnTimer > 0 ? `${lobbyState.options.turnTimer}s` : t('lobby.unlimited')}
            </span>
          </div>
        </div>

        {/* Players Roster */}
        <div className="glass-panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-base flex items-center gap-2 text-white">
              <Users size={18} className="text-emerald-400" />
              <span>{language === 'ar' ? 'قائمة اللاعبين' : 'Connected Players'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                {lobbyState.players?.length || 0} / {lobbyState.options?.maxPlayers || 4}
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lobbyState.players?.map((p: any) => (
              <div 
                key={p.id}
                className="flex items-center justify-between p-3 rounded-xl bg-black/20 dark:bg-black/40 border border-white/5"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl p-1 rounded-lg bg-white/5 border border-white/10">
                    {p.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-white flex items-center gap-1.5">
                      <span>{p.name}</span>
                      {p.isHost && <Crown size={14} className="text-amber-400 fill-amber-400" />}
                      {p.id === myPlayerId && (
                        <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1.5 py-0.2 rounded font-normal">
                          {language === 'ar' ? 'أنت' : 'You'}
                        </span>
                      )}
                    </div>
                    {is2v2 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.team === 'A' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {p.team === 'A' ? t('lobby.team_a') : t('lobby.team_b')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${p.connected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-500'}`} />
                </div>
              </div>
            ))}
          </div>

          {/* Action button: Start match or Waiting status */}
          <div className="mt-6 pt-4 border-t border-white/5 flex flex-col items-center">
            {isHost ? (
              <button
                onClick={() => { sound.playSkruDeclaration(); onStartGame(); }}
                disabled={lobbyState.players?.length < 2}
                className={`w-full py-3.5 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all shadow-lg ${
                  lobbyState.players?.length >= 2
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-900/40 hover:brightness-110 active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play size={18} className="fill-current" />
                <span>{t('lobby.start_game')}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold animate-pulse">
                <Clock size={16} />
                <span>{t('lobby.waiting_players')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Lobby tab switcher: Join or Create Room
  return (
    <div className="w-full max-w-lg mx-auto p-4 flex flex-col gap-5">
      {/* Profile Setup: Avatar & Name */}
      <div className="glass-panel p-5">
        <label className="text-xs font-bold text-slate-400 mb-2 block">
          {t('lobby.select_avatar')}
        </label>
        <div className="flex flex-wrap gap-2 mb-4 justify-center sm:justify-start">
          {AVATARS.map(av => (
            <button
              key={av}
              type="button"
              onClick={() => { sound.playCardFlip(); setAvatar(av); }}
              className={`text-2xl p-2 rounded-xl transition-all ${
                avatar === av 
                  ? 'bg-emerald-500/30 border-2 border-emerald-400 scale-110 shadow-md' 
                  : 'bg-white/5 hover:bg-white/10 border border-white/5'
              }`}
            >
              {av}
            </button>
          ))}
        </div>

        <label className="text-xs font-bold text-slate-400 mb-1.5 block">
          {t('lobby.your_name')}
        </label>
        <input
          type="text"
          value={name}
          maxLength={18}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('lobby.your_name')}
          className="w-full px-4 py-2.5 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-white font-bold placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition-all text-sm"
        />
      </div>

      {/* Mode Tabs: Join Room vs Create Room */}
      <div className="flex p-1 rounded-xl bg-black/20 dark:bg-black/40 border border-white/5">
        <button
          onClick={() => { sound.playCardSlide(); setActiveTab('JOIN'); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'JOIN'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserPlus size={16} />
          {t('lobby.join_room')}
        </button>

        <button
          onClick={() => { sound.playCardSlide(); setActiveTab('CREATE'); }}
          className={`flex-1 py-2.5 rounded-lg text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'CREATE'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles size={16} />
          {t('lobby.create_room')}
        </button>
      </div>

      {/* Tab 1: JOIN ROOM */}
      {activeTab === 'JOIN' && (
        <form onSubmit={handleJoin} className="glass-panel p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">
              {t('lobby.room_code')} (e.g. SKRU-9X2)
            </label>
            <input
              type="text"
              required
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="SKRU-XXX"
              className="w-full px-4 py-3 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-amber-400 font-mono font-black text-xl tracking-wider text-center focus:outline-none focus:border-amber-400 transition-all uppercase placeholder-slate-600"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">
              {t('lobby.passcode')}
            </label>
            <input
              type="password"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              placeholder="••••"
              className="w-full px-4 py-2.5 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-white font-mono text-center tracking-widest focus:outline-none focus:border-emerald-400 transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-base shadow-lg shadow-emerald-900/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>{t('lobby.join_room')}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      )}

      {/* Tab 2: CREATE ROOM */}
      {activeTab === 'CREATE' && (
        <form onSubmit={handleCreate} className="glass-panel p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">
              {t('lobby.variant')}
            </label>
            <select
              value={variant}
              onChange={(e) => setVariant(e.target.value as GameVariant)}
              className="w-full px-4 py-2.5 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-white font-bold focus:outline-none focus:border-emerald-400 transition-all text-sm"
            >
              <option value="CLASSIC" className="bg-slate-900 text-white">{t('lobby.variant_classic')}</option>
              <option value="SAHEB_SA7BO" className="bg-slate-900 text-white">{t('lobby.variant_saheb')}</option>
              <option value="DELUXE" className="bg-slate-900 text-white">{t('lobby.variant_deluxe')}</option>
              <option value="FRENCH_DECK" className="bg-slate-900 text-white">{t('lobby.variant_french')}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                {t('lobby.points_cap')}
              </label>
              <select
                value={pointsCap}
                onChange={(e) => setPointsCap(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-white font-bold text-sm"
              >
                <option value={50} className="bg-slate-900">50 {t('game.score')}</option>
                <option value={100} className="bg-slate-900">100 {t('game.score')}</option>
                <option value={150} className="bg-slate-900">150 {t('game.score')}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                {t('lobby.turn_timer')}
              </label>
              <select
                value={turnTimer}
                onChange={(e) => setTurnTimer(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-white font-bold text-sm"
              >
                <option value={15} className="bg-slate-900">15s</option>
                <option value={20} className="bg-slate-900">20s</option>
                <option value={30} className="bg-slate-900">30s</option>
                <option value={0} className="bg-slate-900">{t('lobby.unlimited')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                {language === 'ar' ? 'أقصى عدد لاعبين' : 'Max Players'}
              </label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-white font-bold text-sm"
              >
                <option value={2} className="bg-slate-900">2 Players</option>
                <option value={3} className="bg-slate-900">3 Players</option>
                <option value={4} className="bg-slate-900">4 Players</option>
                <option value={6} className="bg-slate-900">6 Players</option>
                <option value={8} className="bg-slate-900">8 Players</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 mb-1.5 block">
                {t('lobby.passcode')}
              </label>
              <input
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                placeholder="Optional PIN"
                className="w-full px-3 py-2 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-white text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-amber-500 text-white font-black text-base shadow-lg shadow-emerald-900/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <span>{t('lobby.create_room')}</span>
            <Sparkles size={18} />
          </button>
        </form>
      )}
    </div>
  );
};
