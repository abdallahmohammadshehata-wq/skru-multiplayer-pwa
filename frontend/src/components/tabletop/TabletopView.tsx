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
  Volume2,
  X,
  HelpCircle,
  Trophy
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
  onClearPeekReveal?: () => void;
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
  onSendEmoji,
  onClearPeekReveal
}) => {
  const { t, language } = useTranslation();

  const [selectedOwnCardIdx, setSelectedOwnCardIdx] = useState<number | null>(null);
  const [selectedTargetPlayerId, setSelectedTargetPlayerId] = useState<string | null>(null);
  const [selectedTargetCardIdx, setSelectedTargetCardIdx] = useState<number | null>(null);
  const [initialPeekTimer, setInitialPeekTimer] = useState<number>(6);

  const [activeSheet, setActiveSheet] = useState<'NONE' | 'SCOREBOARD' | 'CHAT'>('NONE');
  const [chatInput, setChatInput] = useState<string>('');

  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  const isMyTurn = gameState.currentTurnPlayerId === myPlayerId;
  const opponents = gameState.players.filter(p => p.id !== myPlayerId);
  const isActionPending = gameState.status === 'ACTION_PENDING' && gameState.pendingActionSummary?.initiatorId === myPlayerId;
  const isRoundOver = gameState.status === 'ROUND_OVER' || gameState.status === 'GAME_OVER';

  // Ephemeral peek auto-dismiss safety timer
  useEffect(() => {
    if (peekReveal) {
      const duration = peekReveal.durationMs || (peekReveal.peekData?.requireSwapChoice ? 10000 : 4000);
      const timer = setTimeout(() => {
        onClearPeekReveal?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [peekReveal, onClearPeekReveal]);

  // Initial memory peek countdown at the start of each round (Official Skru rule)
  useEffect(() => {
    setInitialPeekTimer(6);
    const interval = setInterval(() => {
      setInitialPeekTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState.roundNumber]);

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
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 }
      });
    }
  }, [gameState.status]);

  const handleOwnCardClick = (idx: number) => {
    sound.playCardFlip();
    triggerHaptic('light');

    if (isActionPending && (gameState.pendingActionSummary?.type === 'PEEK_OWN' || gameState.pendingActionSummary?.type === 'PEEK_ALL')) {
      onExecuteAction({ ownCardIndex: idx });
      return;
    }

    if (gameState.hasDrawnCard && isMyTurn) {
      // Swap drawn card with this selected card
      onSwapCard(idx);
      setSelectedOwnCardIdx(null);
      return;
    }

    // Toggle selection for match slap or swap target
    setSelectedOwnCardIdx(prev => prev === idx ? null : idx);
  };

  const handleOpponentCardClick = (oppId: string, cardIdx: number) => {
    if (!isActionPending) return;
    sound.playCardFlip();
    triggerHaptic('light');

    const actionType = gameState.pendingActionSummary?.type;
    if (actionType === 'PEEK_OTHER') {
      onExecuteAction({ targetPlayerId: oppId, targetCardIndex: cardIdx });
    } else if (actionType === 'SWAP') {
      if (selectedOwnCardIdx === null) {
        setSelectedTargetPlayerId(oppId);
        setSelectedTargetCardIdx(cardIdx);
      } else {
        onExecuteAction({
          myCardIndex: selectedOwnCardIdx,
          targetPlayerId: oppId,
          targetCardIndex: cardIdx
        });
        setSelectedOwnCardIdx(null);
        setSelectedTargetPlayerId(null);
        setSelectedTargetCardIdx(null);
      }
    } else if (actionType === 'PEEK_AND_SWAP') {
      setSelectedTargetPlayerId(oppId);
      setSelectedTargetCardIdx(cardIdx);
      onExecuteAction({ targetPlayerId: oppId, targetCardIndex: cardIdx });
    } else if (actionType === 'FREEZE' || actionType === 'BOMB') {
      onExecuteAction({ targetPlayerId: oppId });
    }
  };

  const handleSlap = () => {
    if (selectedOwnCardIdx === null || !gameState.topDiscard) return;
    sound.playCardSlide();
    triggerHaptic('heavy');
    onMatchSlap(selectedOwnCardIdx);
    setSelectedOwnCardIdx(null);
  };

  const handleSkipAction = () => {
    sound.playCardSlide();
    onExecuteAction({ skip: true });
  };

  const handleSkru = () => {
    sound.playSkruShout();
    triggerHaptic('heavy');
    onCallSkru();
  };

  const submitChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !onSendChat) return;
    onSendChat(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="casino-table w-full min-h-[100dvh] flex flex-col justify-between pb-3 sm:pb-6 px-2 sm:px-4 pt-2 sm:pt-3 relative overflow-x-hidden">
      {/* Floating Reaction Emojis Overlay */}
      {emojiReactions.map(er => (
        <div 
          key={er.id} 
          className="reaction-bubble"
          style={{
            left: `${20 + Math.random() * 60}%`,
            bottom: '30%'
          }}
        >
          {er.emoji}
        </div>
      ))}

      {/* TOP SECTION: Opponents Arc & Status Announcements */}
      <div className="w-full flex flex-col items-center gap-1.5 sm:gap-2.5 z-20">
        {/* Banner notification / last action log */}
        {gameState.lastActionLog && (
          <div className="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-black/60 border border-amber-400/30 text-[11px] sm:text-xs font-black text-amber-300 shadow-lg backdrop-blur-md max-w-lg text-center truncate">
            {language === 'ar' ? gameState.lastActionLog.ar : gameState.lastActionLog.en}
          </div>
        )}

        {/* Initial peek timer warning banner */}
        {gameState.status === 'INITIAL_PEEK' && (
          <div className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500 text-black font-black text-xs sm:text-sm shadow-xl animate-pulse text-center border-2 border-white/40">
            👀 {t('game.initial_peek_banner')} ({gameState.initialPeekSecondsRemaining}s)
          </div>
        )}

        {/* Skru Alert Banner */}
        {gameState.skruCallerId && (
          <div className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-2xl bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white font-black text-xs sm:text-sm shadow-2xl animate-bounce text-center border-2 border-red-300">
            ⚡ {t('game.call_skru')} ({gameState.finalTurnsRemaining} {language === 'ar' ? 'أدوار متبقية' : 'turns remaining'})
          </div>
        )}

        {/* Action Pending Guidance Banner */}
        {isActionPending && (
          <div className="w-full max-w-md p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-900/90 border-2 border-purple-400 shadow-2xl backdrop-blur-md flex items-center justify-between gap-2 animate-scaleIn">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-lg sm:text-xl flex-shrink-0">✨</span>
              <div className="flex flex-col text-right truncate">
                <span className="text-[11px] sm:text-xs font-black text-amber-300 truncate">
                  {gameState.pendingActionSummary?.type === 'PEEK_OWN' && t('game.action_peek_own_guide')}
                  {gameState.pendingActionSummary?.type === 'PEEK_OTHER' && t('game.action_peek_other_guide')}
                  {gameState.pendingActionSummary?.type === 'SWAP' && (selectedOwnCardIdx === null ? t('game.action_swap_guide_1') : t('game.action_swap_guide_2'))}
                  {gameState.pendingActionSummary?.type === 'PEEK_AND_SWAP' && t('game.action_peek_swap_guide')}
                  {gameState.pendingActionSummary?.type === 'PEEK_ALL' && (language === 'ar' ? '✨ كعب داير: اضغط على أي كارت من يدك لكشف كروت الطاولة!' : '✨ Peek All: Tap a hand card to reveal table cards!')}
                  {gameState.pendingActionSummary?.type === 'FREEZE' && (language === 'ar' ? '❄️ اضغط على أي خصم لتجميده!' : '❄️ Tap an opponent to freeze!')}
                  {gameState.pendingActionSummary?.type === 'BOMB' && (language === 'ar' ? '💣 اضغط على أي خصم لرمي القنبلة عليه!' : '💣 Tap an opponent to bomb!')}
                </span>
              </div>
            </div>
            <button
              onClick={handleSkipAction}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition-all active:scale-95 whitespace-nowrap flex-shrink-0"
            >
              {t('game.action_skip')}
            </button>
          </div>
        )}

        {/* Opponents Hands (Perimeter Arc) */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-3 mt-0.5 sm:mt-1 w-full max-w-4xl">
          {opponents.map(opp => {
            const isTurn = gameState.currentTurnPlayerId === opp.id;
            const isTargetable = isActionPending && (
              gameState.pendingActionSummary?.type === 'PEEK_OTHER' ||
              gameState.pendingActionSummary?.type === 'PEEK_AND_SWAP' ||
              (gameState.pendingActionSummary?.type === 'SWAP' && selectedOwnCardIdx !== null) ||
              gameState.pendingActionSummary?.type === 'FREEZE' ||
              gameState.pendingActionSummary?.type === 'BOMB'
            );

            return (
              <div 
                key={opp.id}
                className={`flex flex-col items-center p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all ${
                  isTurn 
                    ? 'bg-amber-500/25 border-2 border-amber-400 shadow-xl shadow-amber-500/20 scale-102' 
                    : 'bg-black/35 border border-white/10'
                } ${isTargetable ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-black/50 cursor-pointer animate-pulse' : ''}`}
              >
                {/* Opponent Badge */}
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-base sm:text-xl">{opp.avatar}</span>
                  <span className="text-[11px] sm:text-xs font-black text-white max-w-[80px] sm:max-w-[100px] truncate">{opp.name}</span>
                  {opp.hasCalledSkru && (
                    <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded-full font-black animate-pulse">
                      SKRU
                    </span>
                  )}
                  {opp.isFrozen && <span className="text-xs">❄️</span>}
                </div>

                {/* Opponent Mini Cards Grid */}
                <div className="grid grid-cols-2 gap-1 scale-75 sm:scale-85 md:scale-100 origin-top">
                  {opp.hand.map((c, idx) => (
                    <CardView
                      key={c.id || idx}
                      id={c.id}
                      value={c.value}
                      action={c.action}
                      labelAr={c.labelAr}
                      labelEn={c.labelEn}
                      color={c.color as any}
                      isFaceUp={c.isFaceUp || isRoundOver}
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

      {/* CENTER TABLE: Turn Indicator, Draw Pile & Discard Pile */}
      <div className="flex flex-col items-center justify-center gap-2 sm:gap-3 my-1 sm:my-3 z-10 w-full max-w-lg mx-auto">
        {/* Turn Countdown & Player Status */}
        <div className="flex flex-col items-center gap-1 w-full max-w-[260px] sm:max-w-xs px-2">
          <div className="flex items-center justify-between w-full text-xs font-black">
            <span className={isMyTurn ? 'text-amber-400 animate-pulse text-xs sm:text-sm' : 'text-slate-300 text-xs'}>
              {isMyTurn ? `✨ ${t('game.your_turn')} ✨` : t('game.turn_of', { name: gameState.players.find(p => p.id === gameState.currentTurnPlayerId)?.name || '' })}
            </span>
            {gameState.turnTimer > 0 && (
              <span className={`font-mono text-xs sm:text-sm font-black px-2 py-0.2 rounded-full bg-black/40 border border-white/10 ${gameState.turnSecondsRemaining <= 5 ? 'text-red-400 animate-ping' : 'text-amber-300'}`}>
                {gameState.turnSecondsRemaining}s
              </span>
            )}
          </div>
          {gameState.turnTimer > 0 && (
            <div className="turn-timer-bar">
              <div 
                className="turn-timer-progress" 
                style={{ 
                  width: `${Math.min(100, Math.max(0, (gameState.turnSecondsRemaining / gameState.turnTimer) * 100))}%` 
                }} 
              />
            </div>
          )}
        </div>

        {/* The Card Decks (Draw Pile vs Discard Pile) */}
        <div className="flex items-center justify-center gap-5 sm:gap-12 my-0.5">
          {/* DRAW PILE */}
          <div 
            onClick={() => {
              if (isMyTurn && !gameState.hasDrawnCard && !isActionPending) {
                sound.playCardFlip();
                triggerHaptic('medium');
                onDrawCard('DRAW_PILE');
              }
            }}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              isMyTurn && !gameState.hasDrawnCard && !isActionPending
                ? 'hover:scale-105 active:scale-95 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                : 'opacity-90'
            }`}
          >
            <div className="relative">
              {/* Stack depth visual illusion */}
              <div className="absolute inset-0 bg-[#022C22] rounded-xl translate-x-1.5 translate-y-1.5 opacity-70 shadow-lg" />
              <div className="absolute inset-0 bg-[#044E3B] rounded-xl translate-x-0.5 translate-y-0.5 opacity-80" />
              <div className="card-3d">
                <div className="card-face card-back flex flex-col items-center justify-center">
                  <Layers size={22} className="text-amber-300 mb-0.5 sm:mb-1" />
                  <span className="text-xs sm:text-sm font-black text-amber-200 font-mono">
                    {gameState.drawPileCount}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-[11px] sm:text-xs font-black mt-1 text-slate-200">
              {t('game.draw_deck')}
            </span>
          </div>

          {/* DISCARD PILE */}
          <div 
            onClick={() => {
              if (selectedOwnCardIdx !== null) {
                handleSlap();
                return;
              }
              if (isMyTurn && !gameState.hasDrawnCard && !isActionPending && gameState.topDiscard) {
                sound.playCardFlip();
                triggerHaptic('medium');
                onDrawCard('DISCARD_PILE');
              }
            }}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              (isMyTurn && !gameState.hasDrawnCard && !isActionPending && gameState.topDiscard) || selectedOwnCardIdx !== null
                ? 'hover:scale-105 active:scale-95 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]' 
                : ''
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
              <div className="card-slot">
                <span className="text-xs font-bold text-slate-400">{language === 'ar' ? 'فارغ' : 'Empty'}</span>
              </div>
            )}
            <span className="text-[11px] sm:text-xs font-black mt-1 text-slate-200">
              {t('game.discard_pile')}
            </span>
          </div>
        </div>

        {/* DRAWN CARD MODAL / NOTIFICATION */}
        {gameState.drawnCardForCurrentPlayer && isMyTurn && (
          <div className="glass-panel p-2.5 sm:p-3.5 flex items-center gap-3 sm:gap-4 border-2 border-amber-400 shadow-2xl animate-scaleIn w-full max-w-xs sm:max-w-sm">
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
            <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0">
              <span className="text-[11px] sm:text-xs font-black text-amber-300">
                {language === 'ar' ? 'اختر كارت لتبديله، أو ارمه لتفعيل قدرته:' : 'Tap hand card to swap, or discard:'}
              </span>
              <button
                onClick={() => { sound.playCardSlide(); onDiscardCard(true); }}
                className="py-1.5 sm:py-2 px-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs shadow-lg transition-transform active:scale-95"
              >
                {t('game.discard_card')}
              </button>
            </div>
          </div>
        )}

        {/* EPHEMERAL PEEK REVEAL MODAL */}
        {peekReveal && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                onClearPeekReveal?.();
              }
            }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"
          >
            <div className={`glass-panel p-5 ${peekReveal.peekData?.allRevealedCards ? 'max-w-lg' : 'max-w-sm'} w-full flex flex-col items-center text-center gap-4 border-2 border-purple-400 shadow-2xl relative`}>
              <button
                onClick={() => onClearPeekReveal?.()}
                className="absolute top-3 left-3 sm:left-auto sm:right-3 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all"
                title={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>

              <h3 className="font-black text-lg text-purple-300 flex items-center gap-2">
                <Eye size={22} />
                <span>
                  {peekReveal.peekData?.allRevealedCards 
                    ? (language === 'ar' ? 'كعب داير (كروت جميع اللاعبين)' : 'Peek All (Table Cards)') 
                    : (language === 'ar' ? 'كشف الكارت السري' : 'Secret Card Revealed')}
                </span>
              </h3>

              {peekReveal.peekData?.allRevealedCards ? (
                <div className="flex flex-col gap-3 w-full">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-h-[55vh] overflow-y-auto p-1">
                    {peekReveal.peekData.allRevealedCards.map((item: any, i: number) => (
                      <div key={i} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-black/45 border border-white/15 shadow">
                        <div className="flex items-center gap-1 text-[11px] font-black text-amber-300">
                          <span>{item.avatar || '👤'}</span>
                          <span className="truncate max-w-[80px]">{item.isOwn ? (language === 'ar' ? 'كارتك' : 'Your Card') : item.playerName}</span>
                        </div>
                        <CardView
                          id={item.card.id}
                          value={item.card.value}
                          action={item.card.action}
                          labelAr={item.card.labelAr}
                          labelEn={item.card.labelEn}
                          color={item.card.color}
                          isFaceUp={true}
                          canInteract={false}
                          lang={language}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => onClearPeekReveal?.()}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>{language === 'ar' ? 'فهمت كروت الطاولة (إغلاق) ✓' : 'Got Table Cards (Close) ✓'}</span>
                  </button>
                </div>
              ) : peekReveal.peekData?.card ? (
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
              ) : null}

              {!peekReveal.peekData?.allRevealedCards && (
                peekReveal.peekData?.requireSwapChoice ? (
                  <div className="flex flex-col gap-2 w-full mt-2">
                    <span className="text-xs font-bold text-amber-200">
                      {selectedOwnCardIdx !== null 
                        ? (language === 'ar' ? `كارتك المحدد: #${selectedOwnCardIdx + 1}` : `Selected Card: #${selectedOwnCardIdx + 1}`) 
                        : (language === 'ar' ? 'اختر كارت من يدك بالأسفل لتبديله معه:' : 'Select one of your hand cards below to swap:')}
                    </span>
                    <div className="flex gap-2 w-full mt-1">
                      <button
                        onClick={() => {
                          if (selectedOwnCardIdx !== null) {
                            onExecuteAction({
                              chooseSwap: true,
                              ownCardIndex: selectedOwnCardIdx,
                              targetPlayerId: selectedTargetPlayerId,
                              targetCardIndex: selectedTargetCardIdx
                            });
                            onClearPeekReveal?.();
                            setSelectedOwnCardIdx(null);
                          }
                        }}
                        disabled={selectedOwnCardIdx === null}
                        className="flex-1 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs disabled:opacity-40 shadow transition-all active:scale-95"
                      >
                        {language === 'ar' ? 'تبديل الكارت الآن' : 'Swap Card Now'}
                      </button>
                      <button
                        onClick={() => {
                          onExecuteAction({ chooseSwap: false, skip: true });
                          onClearPeekReveal?.();
                          setSelectedOwnCardIdx(null);
                        }}
                        className="flex-1 py-2 sm:py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs shadow transition-all active:scale-95"
                      >
                        {language === 'ar' ? 'احتفظ بكروتك' : 'Keep Your Card'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 w-full mt-1">
                    <button
                      onClick={() => onClearPeekReveal?.()}
                      className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span>{language === 'ar' ? 'فهمت الكارت (إغلاق) ✓' : 'Got it (Close) ✓'}</span>
                    </button>
                    <span className="text-[10px] sm:text-[11px] text-slate-400">
                      {language === 'ar' ? 'سيتم إخفاء الكارت تلقائياً أيضاً خلال ثوانٍ' : 'Card will also auto-hide in a few seconds'}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM THUMB ZONE: Player's Hand (2x2 Grid) & Tactical Controls */}
      <div className="w-full flex flex-col items-center gap-2 sm:gap-3 z-20 max-w-md mx-auto">
        {myPlayer && (
          <div className="flex flex-col items-center gap-1 w-full">
            <span className="text-[11px] sm:text-xs font-black text-amber-300 drop-shadow">
              {language === 'ar' ? 'أوراقك (اضغط لتحديد الكارت):' : 'Your Hand (Tap to select):'}
            </span>
            
            {/* 2x2 Dedicated Card Table Recesses */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3.5 p-2 sm:p-3 rounded-2xl bg-black/45 border-2 border-emerald-500/30 backdrop-blur-lg shadow-2xl">
              {myPlayer.hand.map((card, idx) => {
                const isBottomTwoInitial = initialPeekTimer > 0 && (idx === 2 || idx === 3);
                const isCardFaceUp = card.isFaceUp || isRoundOver || isBottomTwoInitial;
                const isTargetableForAction = isActionPending && (gameState.pendingActionSummary?.type === 'PEEK_OWN' || gameState.pendingActionSummary?.type === 'PEEK_ALL');

                return (
                  <div key={card.id || idx} className="relative flex flex-col items-center">
                    <CardView
                      id={card.id}
                      value={card.value}
                      action={card.action}
                      labelAr={card.labelAr}
                      labelEn={card.labelEn}
                      color={card.color as any}
                      isFaceUp={isCardFaceUp}
                      isSelected={selectedOwnCardIdx === idx}
                      onClick={() => handleOwnCardClick(idx)}
                      lang={language}
                    />
                    <span className={`absolute -top-1.5 -left-1.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full font-black text-[9px] sm:text-[10px] flex items-center justify-center border ${
                      isBottomTwoInitial 
                        ? 'bg-amber-400 text-black border-amber-300 animate-bounce' 
                        : 'bg-black/80 border-white/20 text-white'
                    } ${isTargetableForAction ? 'ring-2 ring-purple-400' : ''}`}>
                      {idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tactical Actions (Slap, Skru!, Chat, Scores) */}
        <div className="w-full max-w-sm sm:max-w-md mx-auto flex items-stretch justify-center gap-1.5 sm:gap-2 px-1 sm:px-2">
          {/* Match Slap button */}
          <button
            onClick={handleSlap}
            disabled={selectedOwnCardIdx === null || !gameState.topDiscard}
            className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1 transition-all shadow-lg ${
              selectedOwnCardIdx !== null && gameState.topDiscard
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white active:scale-95 shadow-blue-900/40 hover:brightness-110 border-2 border-blue-300 animate-pulse' 
                : 'bg-black/30 text-slate-500 border border-white/10 cursor-not-allowed'
            }`}
          >
            <Sparkles size={15} className="flex-shrink-0" />
            <span className="truncate">
              {selectedOwnCardIdx !== null && gameState.topDiscard 
                ? (language === 'ar' ? `تشابه (${gameState.topDiscard.value})` : `Match (${gameState.topDiscard.value})`) 
                : t('game.match_slap')}
            </span>
          </button>

          {/* Call Skru! Button */}
          <button
            onClick={handleSkru}
            disabled={!isMyTurn || gameState.hasDrawnCard || gameState.skruCallerId !== null || isActionPending}
            className={`btn-skru flex-1 min-w-0 py-2.5 px-2 rounded-xl sm:rounded-2xl flex items-center justify-center gap-1 text-xs sm:text-sm ${
              (!isMyTurn || gameState.hasDrawnCard || gameState.skruCallerId !== null || isActionPending)
                ? 'opacity-40 cursor-not-allowed filter grayscale'
                : ''
            }`}
          >
            <Flame size={16} className="flex-shrink-0" />
            <span className="truncate">{t('game.call_skru')}</span>
          </button>

          {/* Scoreboard Drawer Button */}
          <button
            onClick={() => setActiveSheet(activeSheet === 'SCOREBOARD' ? 'NONE' : 'SCOREBOARD')}
            className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 flex items-center justify-center rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/15 active:scale-95 transition-all shadow"
            title={language === 'ar' ? 'النتائج' : 'Scoreboard'}
          >
            <Award size={18} className="text-amber-400" />
          </button>

          {/* Social Chat Button */}
          <button
            onClick={() => setActiveSheet(activeSheet === 'CHAT' ? 'NONE' : 'CHAT')}
            className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 flex items-center justify-center rounded-xl sm:rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/15 active:scale-95 transition-all shadow relative"
            title={language === 'ar' ? 'الدردشة والتفاعلات' : 'Chat & Reactions'}
          >
            <MessageSquare size={18} className="text-emerald-400" />
            {chatMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            )}
          </button>
        </div>

        {/* Match Slap Helper Hint */}
        <span className="text-[10px] sm:text-[11px] text-slate-400 text-center max-w-xs px-2 truncate">
          {language === 'ar' 
            ? '💡 للتشابه: اضغط على كارتك أولاً ثم اضغط تشابه للتخلص منه.' 
            : '💡 Match Slap: Tap your hand card first then tap Match!'}
        </span>

        {/* Quick Emoji Reaction Bar */}
        {onSendEmoji && (
          <div className="flex items-center justify-center gap-1.5 p-1 sm:p-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
            {['😂', '😱', '🤫', '💣', '👑', '🔥'].map(emoji => (
              <button
                key={emoji}
                onClick={() => { sound.playCardFlip(); onSendEmoji(emoji); }}
                className="text-base sm:text-lg p-1 sm:p-1.5 hover:scale-125 active:scale-90 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SCOREBOARD DRAWER */}
      {activeSheet === 'SCOREBOARD' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Trophy size={20} className="text-amber-400" />
                <h3 className="font-black text-lg text-white">
                  {language === 'ar' ? 'لوحة نتائج الجولات' : 'Match Scoreboard'}
                </h3>
              </div>
              <button onClick={() => setActiveSheet('NONE')} className="p-1 rounded-lg bg-white/10 text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {gameState.players.map(p => (
                <div key={p.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{p.avatar}</span>
                    <div>
                      <div className="font-black text-white text-sm">{p.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {language === 'ar' ? 'الجولات:' : 'Rounds:'} {p.roundScores.join(' - ') || '0'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-amber-400 font-mono">
                      {p.totalScore}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'نقطة' : 'pts'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CHAT DRAWER */}
      {activeSheet === 'CHAT' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-5 flex flex-col gap-3 max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} className="text-emerald-400" />
                <h3 className="font-black text-lg text-white">
                  {language === 'ar' ? 'دردشة الغرفة' : 'Room Chat'}
                </h3>
              </div>
              <button onClick={() => setActiveSheet('NONE')} className="p-1 rounded-lg bg-white/10 text-white">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px] flex flex-col gap-2 p-2 rounded-xl bg-black/30 border border-white/5">
              {chatMessages.length === 0 ? (
                <span className="text-xs text-slate-500 m-auto">{language === 'ar' ? 'لا توجد رسائل بعد...' : 'No messages yet...'}</span>
              ) : (
                chatMessages.map((m, idx) => (
                  <div key={idx} className="text-xs p-2 rounded-lg bg-white/10">
                    <span className="font-bold text-amber-400">{m.senderName}: </span>
                    <span className="text-white">{m.text}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={submitChat} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder={language === 'ar' ? 'اكتب رسالتك...' : 'Type a message...'}
                className="input-field py-2 text-xs flex-1"
              />
              <button type="submit" className="p-2.5 rounded-xl bg-emerald-600 text-white font-bold">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ROUND OVER / GAME OVER MODAL */}
      {isRoundOver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-lg flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="glass-panel w-full max-w-md p-6 flex flex-col items-center text-center gap-4 border-2 border-amber-400 shadow-2xl">
            <Trophy size={48} className="text-amber-400 animate-bounce" />
            <h2 className="text-2xl font-black text-amber-400">
              {gameState.status === 'GAME_OVER' 
                ? (language === 'ar' ? 'انتهت اللعبة! الفائز كُرم!' : 'Game Over! Champion Crowned!')
                : (language === 'ar' ? 'انتهت الجولة!' : 'Round Over!')}
            </h2>

            <div className="w-full flex flex-col gap-2 my-2">
              {gameState.players.map(p => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/10 border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{p.avatar}</span>
                    <span className="font-bold text-white text-sm">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-amber-300 font-mono">
                      +{p.roundScores[p.roundScores.length - 1] ?? 0}
                    </span>
                    <span className="text-xs text-slate-400 block font-mono">
                      ({language === 'ar' ? 'إجمالي' : 'Total'}: {p.totalScore})
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {onStartNextRound && gameState.status !== 'GAME_OVER' && (
              <button
                onClick={onStartNextRound}
                className="btn-gold w-full py-3 text-sm font-black shadow-xl"
              >
                {language === 'ar' ? 'بدء الجولة التالية' : 'Start Next Round'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
