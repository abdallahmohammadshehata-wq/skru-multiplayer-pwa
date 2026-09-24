import React, { useState, useEffect } from 'react';
import { CardView } from './CardView';
import { SanitizedGameState, SanitizedPlayer, Card } from '../../types';
import { sound } from '../../utils/audio';
import { triggerHaptic } from '../../utils/haptics';
import { useTranslation } from '../../i18n/I18nContext';
import { 
  Sparkles, 
  Flame, 
  Clock, 
  MessageSquare, 
  Award, 
  Eye, 
  ArrowLeftRight, 
  Layers,
  Send,
  Volume2
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TabletopViewProps {
  gameState: SanitizedGameState;
  myPlayerId: string;
  peekReveal: any | null;
  chatMessages: Array<{ senderName: string; text: string; timestamp: number }>;
  emojiReactions: Array<{ id: string; emoji: string; senderName: string }>;
  onDrawCard: (from: 'DRAW_PILE' | 'DISCARD_PILE') => void;
  onSwapCard: (handIndex: number) => void;
  onDiscardCard: (triggerAction?: boolean) => void;
  onExecuteAction: (payload: any) => void;
  onMatchSlap: (handIndex: number) => void;
  onCallSkru: () => void;
  onStartNextRound?: () => void;
  onSendChat?: (text: string) => void;
  onSendEmoji?: (emoji: string) => void;
}

export const TabletopView: React.FC<TabletopViewProps> = ({
  gameState,
  myPlayerId,
  peekReveal,
  chatMessages,
  emojiReactions,
  onDrawCard,
  onSwapCard,
  onDiscardCard,
  onExecuteAction,
  onMatchSlap,
  onCallSkru,
  onStartNextRound,
  onSendChat,
  onSendEmoji
}) => {
  const { t, language } = useTranslation();

  const [selectedOwnCardIdx, setSelectedOwnCardIdx] = useState<number | null>(null);
  const [selectedTargetPlayerId, setSelectedTargetPlayerId] = useState<string | null>(null);
  const [selectedTargetCardIdx, setSelectedTargetCardIdx] = useState<number | null>(null);

  const [activeSheet, setActiveSheet] = useState<'NONE' | 'SCOREBOARD' | 'CHAT'>('NONE');
  const [chatInput, setChatInput] = useState<string>('');

  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const opponents = gameState.players.filter(p => p.id !== myPlayerId);
  const isActionPending = gameState.status === 'ACTION_PENDING' && gameState.pendingActionSummary?.initiatorId === myPlayerId;
  const isRoundOver = gameState.status === 'ROUND_OVER' || gameState.status === 'GAME_OVER';

  // Sound & Haptic tick during last 5 seconds of turn
  useEffect(() => {
    if (isMyTurn && gameState.turnSecondsRemaining <= 5 && gameState.turnSecondsRemaining > 0) {
      sound.playTimerTick();
      triggerHaptic('light');
    }
  }, [gameState.turnSecondsRemaining, isMyTurn]);

  // Victory celebration confetti on game over
  useEffect(() => {
    if (gameState.status === 'GAME_OVER') {
      sound.playVictoryFanfare();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    }
  }, [gameState.status]);

  const handleOwnCardClick = (idx: number) => {
    sound.playCardFlip();
    triggerHaptic('light');

    if (isActionPending && gameState.pendingActionSummary?.type === 'PEEK_OWN') {
      onExecuteAction({ ownCardIndex: idx });
      return;
    }

    if (gameState.hasDrawnCard && isMyTurn) {
      // Swap drawn card with this selected card
      onSwapCard(idx);
      setSelectedOwnCardIdx(null);
      return;
    }

    // Toggle card selection
    setSelectedOwnCardIdx(selectedOwnCardIdx === idx ? null : idx);
  };

  const handleOpponentCardClick = (oppId: string, cardIdx: number) => {
    sound.playCardFlip();
    triggerHaptic('light');

    if (isActionPending) {
      setSelectedTargetPlayerId(oppId);
      setSelectedTargetCardIdx(cardIdx);

      const type = gameState.pendingActionSummary?.type;
      if (type === 'PEEK_OTHER') {
        onExecuteAction({ targetPlayerId: oppId, targetCardIndex: cardIdx });
      } else if (type === 'SWAP' && selectedOwnCardIdx !== null) {
        onExecuteAction({ targetPlayerId: oppId, targetCardIndex: cardIdx, ownCardIndex: selectedOwnCardIdx });
        setSelectedOwnCardIdx(null);
      } else if (type === 'PEEK_AND_SWAP') {
        onExecuteAction({ targetPlayerId: oppId, targetCardIndex: cardIdx });
      }
    }
  };

  const handleSkru = () => {
    sound.playSkruDeclaration();
    triggerHaptic('skru');
    onCallSkru();
  };

  const handleSlap = () => {
    if (selectedOwnCardIdx === null) return;
    triggerHaptic('medium');
    onMatchSlap(selectedOwnCardIdx);
    setSelectedOwnCardIdx(null);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !onSendChat) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="tabletop-container relative flex flex-col justify-between">
      {/* Floating Reaction Emojis Overlay */}
      {emojiReactions.map(er => (
        <div 
          key={er.id} 
          className="reaction-bubble"
          style={{
            left: `${20 + Math.random() * 60}%`,
            bottom: '25%'
          }}
        >
          {er.emoji}
        </div>
      ))}

      {/* TOP BAR: Opponents & Round Status Banner */}
      <div className="w-full px-4 pt-3 flex flex-col gap-2 z-20">
        {/* Banner notification / last action log */}
        {gameState.lastActionLog && (
          <div className="mx-auto px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-xs font-bold text-amber-300 shadow backdrop-blur-md max-w-md text-center">
            {language === 'ar' ? gameState.lastActionLog.ar : gameState.lastActionLog.en}
          </div>
        )}

        {/* Initial peek timer warning banner */}
        {gameState.status === 'INITIAL_PEEK' && (
          <div className="mx-auto px-6 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-emerald-500 text-black font-black text-sm shadow-lg animate-bounce text-center">
            👀 {t('game.initial_peek_banner')} ({gameState.initialPeekSecondsRemaining}s)
          </div>
        )}

        {/* Skru Alert Banner */}
        {gameState.skruCallerId && (
          <div className="mx-auto px-6 py-2 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-sm shadow-xl animate-pulse text-center">
            ⚡ {t('game.call_skru')} ({gameState.finalTurnsRemaining} {language === 'ar' ? 'أدوار متبقية' : 'turns remaining'})
          </div>
        )}

        {/* Opponents Hands (Perimeter Arc) */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-1">
          {opponents.map(opp => {
            const isTurn = gameState.currentTurnPlayerId === opp.id;
            return (
              <div 
                key={opp.id}
                className={`flex flex-col items-center p-2 rounded-2xl transition-all ${
                  isTurn 
                    ? 'bg-amber-500/20 border-2 border-amber-400 shadow-lg scale-105' 
                    : 'bg-black/20 border border-white/5'
                }`}
              >
                {/* Opponent Badge */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xl">{opp.avatar}</span>
                  <span className="text-xs font-black text-white max-w-[80px] truncate">{opp.name}</span>
                  {opp.hasCalledSkru && <span className="text-xs bg-red-500 text-white px-1 rounded font-black">SKRU</span>}
                  {opp.isFrozen && <span className="text-xs">❄️</span>}
                </div>

                {/* Opponent Mini Cards Grid */}
                <div className="grid grid-cols-2 gap-1.5 scale-75 origin-top">
                  {opp.hand.map((c, idx) => (
                    <CardView
                      key={c.id || idx}
                      id={c.id}
                      value={c.value}
                      action={c.action}
                      labelAr={c.labelAr}
                      labelEn={c.labelEn}
                      color={c.color as any}
                      isFaceUp={c.isFaceUp}
                      isSelected={selectedTargetPlayerId === opp.id && selectedTargetCardIdx === idx}
                      canInteract={isActionPending}
                      onClick={() => handleOpponentCardClick(opp.id, idx)}
                      lang={language}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTER TABLE: Draw Pile & Discard Pile + Turn Timer */}
      <div className="my-auto flex flex-col items-center justify-center gap-4 z-10 px-4">
        {/* Turn indicator & countdown */}
        <div className="flex flex-col items-center gap-1 w-full max-w-xs">
          <div className="flex items-center justify-between w-full text-xs font-extrabold px-1">
            <span className={isMyTurn ? 'text-amber-400 animate-pulse' : 'text-slate-400'}>
              {isMyTurn ? t('game.your_turn') : t('game.turn_of', { name: gameState.players.find(p => p.id === gameState.currentTurnPlayerId)?.name || '' })}
            </span>
            {gameState.turnTimer > 0 && (
              <span className={`font-mono text-sm font-black ${gameState.turnSecondsRemaining <= 5 ? 'text-red-400 animate-ping' : 'text-slate-300'}`}>
                {gameState.turnSecondsRemaining}s
              </span>
            )}
          </div>
          {gameState.turnTimer > 0 && (
            <div className="turn-timer-bar">
              <div 
                className="turn-timer-progress" 
                style={{ 
                  width: `${(gameState.turnSecondsRemaining / gameState.turnTimer) * 100}%`,
                  backgroundColor: gameState.turnSecondsRemaining <= 5 ? '#EF4444' : undefined
                }} 
              />
            </div>
          )}
        </div>

        {/* Center Piles */}
        <div className="flex items-center justify-center gap-6 sm:gap-10">
          {/* DRAW PILE */}
          <div 
            onClick={() => {
              if (isMyTurn && !gameState.hasDrawnCard) {
                sound.playCardFlip();
                triggerHaptic('medium');
                onDrawCard('DRAW_PILE');
              }
            }}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              isMyTurn && !gameState.hasDrawnCard ? 'hover:scale-105 active:scale-95' : 'opacity-85'
            }`}
          >
            <div className="relative">
              {/* Stacked depth cards */}
              <div className="absolute inset-0 bg-emerald-950 rounded-2xl translate-x-1.5 translate-y-1.5 opacity-60 shadow" />
              <div className="card-3d">
                <div className="card-face card-back flex flex-col items-center justify-center">
                  <Layers size={22} className="text-amber-300 mb-1" />
                  <span className="text-xs font-black text-amber-200">
                    {gameState.drawPileCount}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xs font-black mt-2 text-slate-300">
              {t('game.draw_deck')}
            </span>
          </div>

          {/* DISCARD PILE */}
          <div 
            onClick={() => {
              if (isMyTurn && !gameState.hasDrawnCard && gameState.topDiscard) {
                sound.playCardFlip();
                triggerHaptic('medium');
                onDrawCard('DISCARD_PILE');
              }
            }}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              isMyTurn && !gameState.hasDrawnCard ? 'hover:scale-105 active:scale-95' : ''
            }`}
          >
            {gameState.topDiscard ? (
              <CardView
                id={gameState.topDiscard.id}
                value={gameState.topDiscard.value}
                action={gameState.topDiscard.action}
                labelAr={gameState.topDiscard.labelAr}
                labelEn={gameState.topDiscard.labelEn}
                color={gameState.topDiscard.color as any}
                isFaceUp={true}
                canInteract={false}
                lang={language}
              />
            ) : (
              <div className="card-3d border-2 border-dashed border-white/20 rounded-2xl flex items-center justify-center text-xs font-bold text-slate-500">
                {t('game.discard_pile')}
              </div>
            )}
            <span className="text-xs font-black mt-2 text-slate-300">
              {t('game.discard_pile')}
            </span>
          </div>
        </div>

        {/* DRAWN CARD FLOAT (if current player drew a card) */}
        {gameState.drawnCardForCurrentPlayer && isMyTurn && (
          <div className="glass-panel p-3 flex items-center gap-4 animate-scaleIn border-amber-400/40">
            <span className="text-xs font-bold text-amber-300">الكارت المسحوب:</span>
            <CardView
              id={gameState.drawnCardForCurrentPlayer.id}
              value={gameState.drawnCardForCurrentPlayer.value}
              action={gameState.drawnCardForCurrentPlayer.action}
              labelAr={gameState.drawnCardForCurrentPlayer.labelAr}
              labelEn={gameState.drawnCardForCurrentPlayer.labelEn}
              color={gameState.drawnCardForCurrentPlayer.color as any}
              isFaceUp={true}
              canInteract={false}
              lang={language}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-slate-300 font-semibold">
                اضغط على كارت في يدك لتبديله، أو ارمه:
              </span>
              <button
                onClick={() => { sound.playCardSlide(); onDiscardCard(true); }}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow"
              >
                {t('game.discard_card')}
              </button>
            </div>
          </div>
        )}

        {/* EPHEMERAL PEEK REVEAL MODAL */}
        {peekReveal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="glass-panel p-6 max-w-sm w-full flex flex-col items-center text-center gap-4 border-amber-400">
              <h3 className="font-black text-lg text-amber-400 flex items-center gap-2">
                <Eye size={20} />
                <span>كشف الكارت (خد فكرة / بصرة)</span>
              </h3>
              {peekReveal.peekData?.card && (
                <CardView
                  id={peekReveal.peekData.card.id}
                  value={peekReveal.peekData.card.value}
                  action={peekReveal.peekData.card.action}
                  labelAr={peekReveal.peekData.card.labelAr}
                  labelEn={peekReveal.peekData.card.labelEn}
                  color={peekReveal.peekData.card.color}
                  isFaceUp={true}
                  canInteract={false}
                  lang={language}
                />
              )}
              {peekReveal.peekData?.requireSwapChoice && (
                <div className="flex gap-2 w-full mt-2">
                  <button
                    onClick={() => {
                      if (selectedOwnCardIdx !== null) {
                        onExecuteAction({ chooseSwap: true, ownCardIndex: selectedOwnCardIdx });
                      }
                    }}
                    disabled={selectedOwnCardIdx === null}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs disabled:opacity-40"
                  >
                    تبديل الكارت الآن
                  </button>
                  <button
                    onClick={() => onExecuteAction({ chooseSwap: false })}
                    className="flex-1 py-2 rounded-xl bg-slate-700 text-white font-black text-xs"
                  >
                    احتفظ بكروتك
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM THUMB ZONE: Player's Hand & Dynamic Control Bar */}
      <div className="w-full px-4 pb-4 flex flex-col items-center gap-3 z-20">
        {/* Active Hand (2x2 Grid at thumb reach) */}
        {myPlayer && (
          <div className="flex flex-col items-center gap-2">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 p-3 rounded-2xl bg-black/30 border border-white/10 backdrop-blur-md shadow-2xl">
              {myPlayer.hand.map((card, idx) => (
                <CardView
                  key={card.id || idx}
                  id={card.id}
                  value={card.value}
                  action={card.action}
                  labelAr={card.labelAr}
                  labelEn={card.labelEn}
                  color={card.color as any}
                  isFaceUp={card.isFaceUp}
                  isSelected={selectedOwnCardIdx === idx}
                  onClick={() => handleOwnCardClick(idx)}
                  lang={language}
                />
              ))}
            </div>
          </div>
        )}

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-lg">
          {/* Match Slap button */}
          <button
            onClick={handleSlap}
            disabled={selectedOwnCardIdx === null}
            className={`flex-1 min-w-[100px] py-3 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition-all shadow-md ${
              selectedOwnCardIdx !== null 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white active:scale-95 shadow-blue-900/40 hover:brightness-110' 
                : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <Sparkles size={16} />
            <span>{t('game.match_slap')}</span>
          </button>

          {/* Call Skru! Button */}
          <button
            onClick={handleSkru}
            disabled={!isMyTurn || gameState.hasDrawnCard || gameState.skruCallerId !== null}
            className={`flex-1 min-w-[120px] py-3 rounded-xl font-black text-sm flex items-center justify-center gap-1.5 transition-all shadow-lg ${
              isMyTurn && !gameState.hasDrawnCard && gameState.skruCallerId === null
                ? 'bg-gradient-to-r from-red-600 via-amber-500 to-red-600 text-white active:scale-95 shadow-red-900/50 hover:brightness-110 animate-pulse'
                : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <Flame size={18} />
            <span>{t('game.call_skru')}</span>
          </button>

          {/* Quick Reaction Emojis Drawer Toggle */}
          <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-xl border border-white/5">
            {['😂', '😱', '🤫', '💣', '👑'].map(em => (
              <button
                key={em}
                onClick={() => {
                  sound.playCardFlip();
                  if (onSendEmoji) onSendEmoji(em);
                }}
                className="text-lg p-1.5 hover:scale-125 transition-transform"
              >
                {em}
              </button>
            ))}
          </div>

          {/* Scoreboard Drawer Button */}
          <button
            onClick={() => { sound.playCardSlide(); setActiveSheet('SCOREBOARD'); }}
            className="p-3 rounded-xl bg-white/10 text-white border border-white/10 hover:bg-white/20 transition-all"
            title="Scoreboard"
          >
            <Award size={18} />
          </button>
        </div>
      </div>

      {/* ROUND OVER / GAME OVER MODAL */}
      {isRoundOver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-md w-full flex flex-col items-center text-center gap-4 border-emerald-400">
            <h2 className="text-2xl font-black text-amber-400">
              {gameState.status === 'GAME_OVER' ? '🏆 انتهت المباراة!' : `🏁 انتهت الجولة ${gameState.roundNumber}!`}
            </h2>

            {/* Standings table */}
            <div className="w-full flex flex-col gap-2 my-2">
              {[...gameState.players]
                .sort((a, b) => a.totalScore - b.totalScore)
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-amber-400 w-5">#{idx + 1}</span>
                      <span className="text-lg">{p.avatar}</span>
                      <span className="font-bold text-sm text-white">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        الجولة: {p.roundScores[p.roundScores.length - 1] ?? 0}
                      </span>
                      <span className="text-base font-black text-emerald-400">
                        {p.totalScore} {t('game.score')}
                      </span>
                    </div>
                  </div>
                ))}
            </div>

            {/* Next Round Button */}
            {onStartNextRound && gameState.status !== 'GAME_OVER' && (
              <button
                onClick={() => { sound.playSkruDeclaration(); onStartNextRound(); }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-base shadow-lg shadow-emerald-900/40 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {t('game.next_round')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* SCOREBOARD DRAWER */}
      {activeSheet === 'SCOREBOARD' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end" onClick={() => setActiveSheet('NONE')}>
          <div 
            className="w-full max-w-sm h-full glass-panel p-5 flex flex-col gap-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Award size={18} className="text-amber-400" />
                <span>{language === 'ar' ? 'جدول النقاط والترتيب' : 'Match Standings'}</span>
              </h3>
              <button onClick={() => setActiveSheet('NONE')} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {[...gameState.players].sort((a, b) => a.totalScore - b.totalScore).map((p, idx) => (
                <div key={p.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-black text-amber-400">#{idx + 1}</span>
                    <span className="text-xl">{p.avatar}</span>
                    <span className="font-bold text-sm text-white">{p.name}</span>
                  </div>
                  <span className="font-black text-emerald-400 text-base">{p.totalScore}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
