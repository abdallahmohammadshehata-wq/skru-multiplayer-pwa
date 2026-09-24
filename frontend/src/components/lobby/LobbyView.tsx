import React, { useState } from 'react';
import { Users, Crown, Copy, Check, Shield, Sparkles, Clock, ArrowRight, Play, UserPlus, Flame } from 'lucide-react';
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
  const [name, setName] = useState<string>(() => localStorage.getItem('skru_player_name') || 'الفرعون');
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
        <div className="glass-panel p-6 text-center flex flex-col items-center relative overflow-hidden border-2 border-amber-400/30 shadow-2xl">
          <span className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">
            {t('lobby.room_code')}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-4xl sm:text-5xl font-black text-amber-400 tracking-wider font-mono drop-shadow">
              {lobbyState.roomCode}
            </span>
            <button
              onClick={copyRoomLink}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all border border-white/15 active:scale-95 shadow"
              title={t('common.copy')}
            >
              {copied ? <Check size={20} className="text-emerald-400" /> : <Copy size={20} />}
            </button>
          </div>

          <div className="flex items-center gap-3 mt-4 text-xs font-extrabold text-slate-300">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {lobbyState.options?.variant}
            </span>
            <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10">
              {lobbyState.players.length} / {lobbyState.options?.maxPlayers} {t('lobby.players_count')}
            </span>
            <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10">
              {lobbyState.options?.targetScore || lobbyState.options?.pointsCap} نقطة
            </span>
          </div>
        </div>

        {/* Players Roster in Lobby */}
        <div className="glass-panel p-6 flex flex-col gap-4 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-black text-lg text-white flex items-center gap-2">
              <Users size={20} className="text-emerald-400" />
              <span>{t('lobby.connected_players')}</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {lobbyState.players.length} جاهزون
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lobbyState.players.map((p: any) => {
              const isPlayerHost = p.id === lobbyState.hostId;
              const isMe = p.id === myPlayerId;
              return (
                <div 
                  key={p.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                    isMe 
                      ? 'bg-amber-500/15 border-amber-400/50 shadow-md' 
                      : 'bg-black/30 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-1 bg-white/5 rounded-xl">{p.avatar}</span>
                    <div>
                      <div className="font-black text-white text-sm flex items-center gap-1.5">
                        <span>{p.name}</span>
                        {isMe && <span className="text-[10px] text-amber-400">(أنت)</span>}
                      </div>
                      {is2v2 && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          p.team === 'A' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                          فريق {p.team}
                        </span>
                      )}
                    </div>
                  </div>

                  {isPlayerHost && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black border border-amber-400/30">
                      <Crown size={14} />
                      <span>{t('lobby.host')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Start Game Action Bar */}
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2">
            {isHost ? (
              <button
                onClick={onStartGame}
                disabled={lobbyState.players.length < 2}
                className={`btn-primary py-4 text-base font-black w-full shadow-2xl ${
                  lobbyState.players.length < 2 ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Play size={20} />
                <span>{t('lobby.start_game')}</span>
              </button>
            ) : (
              <div className="text-center py-3 text-sm font-bold text-amber-300 animate-pulse">
                ⏳ {t('lobby.waiting_for_host')}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Lobby Home Screen (Join / Create Tabs)
  return (
    <div className="w-full max-w-xl mx-auto p-4 flex flex-col gap-5">
      {/* Profile Card (Name & Avatar Picker) */}
      <div className="glass-panel p-5 sm:p-6 flex flex-col gap-4 border border-white/10 shadow-2xl">
        <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
          {language === 'ar' ? 'ملف اللاعب' : 'Player Profile'}
        </span>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 flex-shrink-0">
            <div className="w-full h-full rounded-2xl bg-[#082216] flex items-center justify-center text-3xl">
              {avatar}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              {t('lobby.your_name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="اسمك في اللعبة..."
              maxLength={14}
              className="input-field"
            />
          </div>
        </div>

        {/* Avatar Selection Carousel */}
        <div>
          <span className="text-xs font-bold text-slate-400 block mb-2">
            {t('lobby.choose_avatar')}
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {AVATARS.map(av => (
              <button
                key={av}
                type="button"
                onClick={() => { sound.playCardFlip(); setAvatar(av); }}
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-all ${
                  avatar === av 
                    ? 'bg-amber-500/30 border-2 border-amber-400 scale-110 shadow-lg' 
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                {av}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Segmented Control Tabs (Join vs Create) */}
      <div className="p-1 rounded-2xl bg-black/40 border border-white/10 flex items-center gap-1 shadow-lg">
        <button
          onClick={() => { sound.playCardSlide(); setActiveTab('JOIN'); }}
          className={`flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'JOIN' 
              ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <UserPlus size={16} />
          <span>{t('lobby.join_room')}</span>
        </button>

        <button
          onClick={() => { sound.playCardSlide(); setActiveTab('CREATE'); }}
          className={`flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
            activeTab === 'CREATE' 
              ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles size={16} />
          <span>{t('lobby.create_room')}</span>
        </button>
      </div>

      {/* JOIN ROOM TAB */}
      {activeTab === 'JOIN' && (
        <form onSubmit={handleJoin} className="glass-panel p-6 flex flex-col gap-4 border border-white/10 shadow-2xl">
          <div>
            <label className="text-xs font-black text-amber-400 uppercase tracking-widest block mb-1">
              {t('lobby.room_code')} (مثال: SKRU-9X2)
            </label>
            <input
              type="text"
              value={roomCodeInput}
              onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="SKRU-..."
              maxLength={10}
              className="input-field font-mono text-center text-2xl tracking-widest text-amber-400 font-black"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">
              {t('lobby.room_passcode')} (اختياري)
            </label>
            <input
              type="password"
              value={passcodeInput}
              onChange={e => setPasscodeInput(e.target.value)}
              placeholder="PIN..."
              className="input-field text-center font-mono"
            />
          </div>

          <button type="submit" className="btn-primary py-3.5 text-base font-black shadow-xl mt-2">
            <span>{t('lobby.enter_room')}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      )}

      {/* CREATE ROOM TAB */}
      {activeTab === 'CREATE' && (
        <form onSubmit={handleCreate} className="glass-panel p-6 flex flex-col gap-4 border border-white/10 shadow-2xl">
          <div>
            <label className="text-xs font-black text-amber-400 uppercase tracking-widest block mb-2">
              {t('lobby.game_variant')}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'CLASSIC', label: 'كلاسيك 68 كارت' },
                { id: 'SAHEB_SA7BO', label: 'صاحب صاحبه (2v2)' },
                { id: 'DELUXE', label: 'ديلوكس بلس' },
                { id: 'FRENCH_DECK', label: 'كوتشينة عادية' }
              ].map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { sound.playCardFlip(); setVariant(v.id as any); }}
                  className={`p-3 rounded-xl text-xs font-black border transition-all text-center ${
                    variant === v.id 
                      ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md scale-102' 
                      : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                الحد الأقصى للاعبين
              </label>
              <select
                value={maxPlayers}
                onChange={e => setMaxPlayers(parseInt(e.target.value, 10))}
                className="input-field"
              >
                <option value={2}>2 لاعبين</option>
                <option value={3}>3 لاعبين</option>
                <option value={4}>4 لاعبين</option>
                <option value={6}>6 لاعبين</option>
                <option value={8}>8 لاعبين</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                حد نقاط الخسارة
              </label>
              <select
                value={pointsCap}
                onChange={e => setPointsCap(parseInt(e.target.value, 10))}
                className="input-field"
              >
                <option value={50}>50 نقطة (مباراة سريعة)</option>
                <option value={100}>100 نقطة (قياسي)</option>
                <option value={150}>150 نقطة (طويلة)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-gold py-3.5 text-base font-black shadow-xl mt-2">
            <Sparkles size={18} />
            <span>إنشاء الغرفة الآن</span>
          </button>
        </form>
      )}
    </div>
  );
};
