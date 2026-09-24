import React, { useState } from 'react';
import { Users, Crown, Copy, Check, Shield, Sparkles, Clock, ArrowRight, Play, UserPlus, Flame, Bot, Radio, Wifi, WifiOff } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';
import { GameVariant } from '../../types';
import { sound } from '../../utils/audio';
import { type DebugInfo, normalizeRoomCode } from '../../socket/networkEngine';

const AVATARS = ['🦁', '🦊', '🐯', '🐺', '🦅', '🐼', '👑', '🚀', '💎', '🎯', '⚡', '☕'];

interface LobbyViewProps {
  lobbyState: any | null;
  onJoinRoom: (roomCode: string, name: string, avatar: string, passcode?: string, team?: 'A' | 'B') => void;
  onCreateRoom: (name: string, avatar: string, options: any) => void;
  onStartGame: () => void;
  onAddBot?: () => void;
  onLeaveRoom?: () => void;
  isConnected?: boolean;
  myPlayerId: string;
  isJoiningRoom?: boolean;
  joinError?: string | null;
  onClearJoinError?: () => void;
  networkDebug?: DebugInfo | null;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  lobbyState,
  onJoinRoom,
  onCreateRoom,
  onStartGame,
  onAddBot,
  onLeaveRoom,
  isConnected = false,
  myPlayerId,
  isJoiningRoom = false,
  joinError = null,
  onClearJoinError,
  networkDebug
}) => {
  const { t, language } = useTranslation();

  const [activeTab, setActiveTab] = useState<'JOIN' | 'CREATE'>('JOIN');
  const [name, setName] = useState<string>(() => localStorage.getItem('skru_player_name') || 'الفرعون');
  const [avatar, setAvatar] = useState<string>(() => localStorage.getItem('skru_player_avatar') || '🦁');
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [teamSelection, setTeamSelection] = useState<'A' | 'B'>('A');

  // Auto-fill from ?room= URL parameter if present
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        const clean = normalizeRoomCode(roomParam);
        setRoomCodeInput(clean);
        setActiveTab('JOIN');
      }
    }
  }, []);

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

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = normalizeRoomCode(roomCodeInput);
    if (!cleanCode) return;
    saveProfile();
    sound.playCardFlip();
    onJoinRoom(cleanCode, name.trim() || 'Player', avatar, passcodeInput, teamSelection);
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
      <div className="w-full max-w-2xl mx-auto p-3 sm:p-4 pb-28 sm:pb-32 flex flex-col gap-4 sm:gap-5">
        {/* Room Header Card */}
        <div className="glass-panel p-4 sm:p-6 text-center flex flex-col items-center relative overflow-hidden border-2 border-amber-400/30 shadow-2xl">
          <span className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1">
            {t('lobby.room_code')}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-5xl font-black text-amber-400 tracking-wider font-mono drop-shadow">
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
              {lobbyState.players.length} / {lobbyState.options?.maxPlayers} {language === 'ar' ? 'لاعبين' : 'Players'}
            </span>
            <span className="px-3 py-1 rounded-full bg-black/40 border border-white/10">
              {lobbyState.options?.targetScore || lobbyState.options?.pointsCap} {language === 'ar' ? 'نقطة' : 'pts'}
            </span>
          </div>
        </div>

        {/* Network Status Indicator (visible in lobby waiting room) */}
        {networkDebug && (
          <div className={`flex items-center justify-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full mx-auto ${
            networkDebug.status === 'READY' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
            networkDebug.status === 'CONNECTED' || networkDebug.status === 'SUBSCRIBING' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
            networkDebug.status === 'ERROR' || networkDebug.status === 'DISCONNECTED' ? 'bg-red-500/15 text-red-400 border border-red-500/30' :
            'bg-slate-500/15 text-slate-400 border border-slate-500/30'
          }`}>
            {networkDebug.status === 'READY' ? <Wifi size={12} /> : networkDebug.status === 'ERROR' ? <WifiOff size={12} /> : <Radio size={12} className="animate-pulse" />}
            <span>{networkDebug.status} {networkDebug.status === 'READY' ? '✓' : ''}</span>
            {networkDebug.messagesReceived > 0 && <span>| ↓{networkDebug.messagesReceived} ↑{networkDebug.messagesSent}</span>}
          </div>
        )}

        {/* Players Roster in Lobby */}
        <div className="glass-panel p-6 flex flex-col gap-4 border border-white/10 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-black text-lg text-white flex items-center gap-2">
              <Users size={20} className="text-emerald-400" />
              <span>{t('lobby.connected_players')}</span>
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {lobbyState.players.length} {language === 'ar' ? 'جاهزون' : 'Ready'}
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
                        {isMe && <span className="text-[10px] text-amber-400">({language === 'ar' ? 'أنت' : 'You'})</span>}
                      </div>
                      {is2v2 && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                          p.team === 'A' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                          {language === 'ar' ? 'فريق' : 'Team'} {p.team}
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
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-col gap-2.5">
            {isHost && lobbyState.players.length < (lobbyState.options?.maxPlayers || 4) && (
              <button
                type="button"
                onClick={() => { sound.playCardFlip(); onAddBot?.(); }}
                className="py-3 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-extrabold text-xs border border-amber-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 shadow"
              >
                <Bot size={16} />
                <span>{language === 'ar' ? 'إضافة لاعب بوت ذكي 🤖' : 'Add AI Bot Player 🤖'}</span>
              </button>
            )}

            {isHost ? (
              <button
                onClick={onStartGame}
                disabled={lobbyState.players.length < 2}
                className={`btn-primary py-4 text-base font-black w-full shadow-2xl ${
                  lobbyState.players.length < 2 ? 'opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <Play size={20} />
                <span>{t('lobby.start_game')} ({lobbyState.players.length} {language === 'ar' ? 'لاعبين' : 'Players'})</span>
              </button>
            ) : (
              <div className="text-center py-3 text-sm font-bold text-amber-300 animate-pulse">
                ⏳ {t('lobby.waiting_for_host')}
              </div>
            )}

            {onLeaveRoom && (
              <button
                type="button"
                onClick={() => { sound.playCardSlide(); onLeaveRoom(); }}
                className="py-1.5 text-xs text-slate-400 hover:text-red-400 font-bold transition-colors text-center"
              >
                {language === 'ar' ? 'مغادرة الغرفة والعودة' : 'Leave Room & Return'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Lobby Home Screen (Join / Create Tabs)
  return (
    <div className="w-full max-w-xl mx-auto p-3 sm:p-4 pb-28 sm:pb-32 flex flex-col gap-3.5 sm:gap-4 relative">
      {/* Network Debug Status */}
      {networkDebug && networkDebug.status !== 'IDLE' && (
        <div className={`flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-xl ${
          networkDebug.status === 'READY' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          networkDebug.status === 'ERROR' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
          'bg-blue-500/10 text-blue-400 border border-blue-500/20'
        }`}>
          {networkDebug.status === 'READY' ? <Wifi size={11} /> : networkDebug.status === 'ERROR' ? <WifiOff size={11} /> : <Radio size={11} className="animate-pulse" />}
          <span className="opacity-80">{networkDebug.status}</span>
          {networkDebug.error && <span className="text-red-300 truncate max-w-[200px]">| {networkDebug.error}</span>}
        </div>
      )}
      {/* Active Connecting Modal Overlay */}
      {isJoiningRoom && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel p-8 max-w-sm w-full flex flex-col items-center text-center gap-4 border-2 border-amber-400 shadow-2xl animate-scaleIn">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <span className="w-16 h-16 rounded-full border-4 border-amber-400/20 border-t-amber-400 animate-spin absolute" />
              <Radio size={28} className="text-amber-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white mb-1">
                {language === 'ar' ? 'جاري الاتصال بالغرفة...' : 'Connecting to Room...'}
              </h3>
              <p className="text-xs text-slate-300 font-bold">
                {language === 'ar' 
                  ? 'جاري البحث عن المضيف ومزامنة اللاعبين عبر شبكة السحابة المباشرة...' 
                  : 'Searching for host and synchronizing players over live cloud...'}
              </p>
            </div>
            <span className="px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 font-mono text-sm font-black">
              {roomCodeInput || 'SKRU'}
            </span>

            {onClearJoinError && (
              <button
                type="button"
                onClick={() => {
                  sound.playCardSlide();
                  onClearJoinError();
                }}
                className="mt-2 text-xs text-slate-400 hover:text-white underline font-bold"
              >
                {language === 'ar' ? 'إلغاء البحث والعودة' : 'Cancel & Return'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Join Error Banner */}
      {joinError && (
        <div className="p-4 rounded-2xl bg-red-950/90 border-2 border-red-500/60 shadow-2xl flex flex-col gap-3 text-white animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-black text-red-300 flex items-center gap-2 mb-0.5">
                <span>⚠️</span>
                <span>{language === 'ar' ? 'تعذر الانضمام للغرفة' : 'Unable to Join Room'}</span>
              </div>
              <p className="text-xs text-red-200 leading-relaxed">
                {joinError === 'HOST_NOT_FOUND' 
                  ? (language === 'ar' 
                      ? 'لم يتم العثور على المضيف بهذا الرمز. تأكد أن المضيف قد أنشأ الغرفة بنفس الكود (5 أحرف).' 
                      : 'Room host not found for this code. Make sure the host has created the room with this exact 5-character code.')
                  : (language === 'ar'
                      ? 'حدث خطأ في شبكة الاتصال. يرجى المحاولة مجدداً.'
                      : 'Network error occurred. Please try again.')}
              </p>
            </div>
            {onClearJoinError && (
              <button
                onClick={onClearJoinError}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex-shrink-0"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-red-500/20">
            <button
              type="button"
              onClick={() => {
                saveProfile();
                sound.playCardFlip();
                onCreateRoom(name.trim() || 'Player', avatar, {
                  variant: 'CLASSIC',
                  pointsCap: 100,
                  turnTimer: 20,
                  maxPlayers: 4,
                  roomCode: roomCodeInput
                });
              }}
              className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-xs flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
            >
              <Crown size={14} />
              <span>
                {language === 'ar' 
                  ? `إنشاء الغرفة بالرمز (${roomCodeInput || 'الجديد'}) واستضافة أصدقائك 👑` 
                  : `Create Room (${roomCodeInput || 'New'}) as Host 👑`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleJoin()}
              className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
            >
              <span>🔄</span>
              <span>{language === 'ar' ? 'إعادة المحاولة' : 'Try Again'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Network Connection Indicator */}
      <div className="glass-panel px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between border-white/10 shadow-md">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-black text-white flex items-center gap-1.5">
            <Radio size={14} className="text-emerald-400" />
            <span>
              {language === 'ar' 
                ? 'شبكة الغرف السحابية متصلة (Cloud Live)' 
                : 'Cloud Rooms Live (MQTT/WSS)'}
            </span>
          </span>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
          {language === 'ar' ? 'ربط عالمي لجميع الشبكات' : 'Global Network Sync'}
        </span>
      </div>

      {/* Profile Card (Name & Avatar Picker) */}
      <div className="glass-panel p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 border border-white/10 shadow-2xl">
        <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
          {language === 'ar' ? 'ملف اللاعب' : 'Player Profile'}
        </span>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 p-0.5 shadow-lg shadow-amber-500/20 flex-shrink-0">
            <div className="w-full h-full rounded-2xl bg-[#082216] flex items-center justify-center text-2xl sm:text-3xl">
              {avatar}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-xs font-bold text-slate-300 block mb-1">
              {t('lobby.your_name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={language === 'ar' ? 'اسمك في اللعبة...' : 'Your player name...'}
              maxLength={14}
              className="input-field py-2 sm:py-3 text-sm font-bold"
            />
          </div>
        </div>

        {/* Avatar Selection Grid */}
        <div>
          <span className="text-xs font-bold text-slate-400 block mb-1.5">
            {t('lobby.choose_avatar')}
          </span>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {AVATARS.map(av => (
              <button
                key={av}
                type="button"
                onClick={() => { sound.playCardFlip(); setAvatar(av); }}
                className={`w-full aspect-square rounded-xl flex items-center justify-center text-lg sm:text-xl transition-all ${
                  avatar === av 
                    ? 'bg-amber-500/30 border-2 border-amber-400 scale-105 shadow-lg' 
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
              {t('lobby.room_code')} ({language === 'ar' ? 'مثال: 7X9K2' : 'e.g. 7X9K2'})
            </label>
            <input
              type="text"
              value={roomCodeInput}
              onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="7X9K2"
              maxLength={10}
              className="input-field font-mono text-center text-2xl tracking-widest text-amber-400 font-black"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">
              {t('lobby.room_passcode')} ({language === 'ar' ? 'اختياري' : 'Optional'})
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

          <div className="pt-2 border-t border-white/10 flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                sound.playCardSlide();
                setActiveTab('CREATE');
              }}
              className="text-xs font-bold text-amber-300 hover:text-amber-200 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-white/5 transition-all"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>{language === 'ar' ? 'أو أنشئ غرفتك الخاصة الآن وادعُ أصدقاءك' : 'Or Create Your Own Room & Invite Friends'}</span>
            </button>
          </div>
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
                { id: 'CLASSIC', labelAr: 'كلاسيك 68 كارت', labelEn: 'Classic (68 Cards)' },
                { id: 'SAHEB_SA7BO', labelAr: 'صاحب صاحبه (2v2)', labelEn: 'Saheb Sa7bo (2v2)' },
                { id: 'DELUXE', labelAr: 'ديلوكس بلس', labelEn: 'Deluxe (+25 & Freeze)' },
                { id: 'FRENCH_DECK', labelAr: 'كوتشينة عادية (52)', labelEn: 'French Deck (52 Cards)' }
              ].map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { 
                    sound.playCardFlip(); 
                    setVariant(v.id as any);
                    if (v.id === 'SAHEB_SA7BO') setMaxPlayers(4);
                  }}
                  className={`p-3 rounded-xl text-xs font-black border transition-all text-center ${
                    variant === v.id 
                      ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md scale-102' 
                      : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {language === 'ar' ? v.labelAr : v.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                {language === 'ar' ? 'الحد الأقصى للاعبين' : 'Max Players'}
              </label>
              <select
                value={maxPlayers}
                onChange={e => setMaxPlayers(parseInt(e.target.value, 10))}
                className="input-field"
                disabled={variant === 'SAHEB_SA7BO'}
              >
                <option value={2}>2 {language === 'ar' ? 'لاعبين' : 'Players'}</option>
                <option value={3}>3 {language === 'ar' ? 'لاعبين' : 'Players'}</option>
                <option value={4}>4 {language === 'ar' ? 'لاعبين (موصى به)' : 'Players (Recommended)'}</option>
                <option value={6}>6 {language === 'ar' ? 'لاعبين' : 'Players'}</option>
                <option value={8}>8 {language === 'ar' ? 'لاعبين' : 'Players'}</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">
                {language === 'ar' ? 'حد نقاط الخسارة' : 'Points Cap (Game Over)'}
              </label>
              <select
                value={pointsCap}
                onChange={e => setPointsCap(parseInt(e.target.value, 10))}
                className="input-field"
              >
                <option value={50}>50 {language === 'ar' ? 'نقطة (مباراة سريعة)' : 'pts (Quick Match)'}</option>
                <option value={100}>100 {language === 'ar' ? 'نقطة (قياسي)' : 'pts (Standard)'}</option>
                <option value={150}>150 {language === 'ar' ? 'نقطة (طويلة)' : 'pts (Long Match)'}</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn-gold py-3.5 text-base font-black shadow-xl mt-2">
            <Sparkles size={18} />
            <span>{language === 'ar' ? 'إنشاء الغرفة الآن' : 'Create Room Now'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
