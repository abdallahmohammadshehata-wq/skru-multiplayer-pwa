import React, { useState, useEffect } from 'react';
import { CardView } from './CardView';
import { LocalGameSession } from '../../engine/localGameEngine';
import { sound } from '../../utils/audio';
import { triggerHaptic } from '../../utils/haptics';
import { useTranslation } from '../../i18n/I18nContext';
import { Sparkles, Flame, RotateCcw, Bot, Eye, Users, ArrowLeftRight, RefreshCw, X, ShieldAlert, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card } from '../../types';

export const SoloTabletopView: React.FC = () => {
  const { t, language } = useTranslation();

  const [session, setSession] = useState<LocalGameSession>(() => {
    return new LocalGameSession([
      { name: 'أنت (البطل)', avatar: '🦁', isAi: false },
      { name: 'الذكي (بوت)', avatar: '🦊', isAi: true },
      { name: 'المخادع (بوت)', avatar: '🐯', isAi: true }
    ]);
  });

  const [tick, setTick] = useState<number>(0);
  const [selectedOwnCardIdx, setSelectedOwnCardIdx] = useState<number | null>(null);
  const [opponentBotCount, setOpponentBotCount] = useState<number>(2);
  const [initialPeekTimer, setInitialPeekTimer] = useState<number>(6);
  const [turnSecondsRemaining, setTurnSecondsRemaining] = useState<number>(20);
  const [ephemeralPeek, setEphemeralPeek] = useState<{
    card?: Card;
    allRevealedCards?: Array<{ playerName: string; avatar?: string; card: Card; isOwn: boolean }>;
    title: string;
    requireSwapChoice?: boolean;
  } | null>(null);
  const [slapToast, setSlapToast] = useState<{ isMatch: boolean; messageAr: string; messageEn: string } | null>(null);

  const forceUpdate = () => setTick(prev => prev + 1);

  const humanPlayer = session.players[0];
  const isHumanTurn = session.currentTurnIndex === 0;
  const isPendingAction = session.pendingAction !== null && session.pendingAction.playerIndex === 0;
  const topDiscard = session.discardPile.length > 0 ? session.discardPile[session.discardPile.length - 1] : null;

  // Sync state changes from engine
  useEffect(() => {
    session.onStateChange = () => {
      forceUpdate();
    };
    return () => {
      session.onStateChange = undefined;
    };
  }, [session]);

  // Turn countdown timer for human player turn in Solo Mode
  useEffect(() => {
    setTurnSecondsRemaining(20);
  }, [session.currentTurnIndex, session.roundNumber]);

  useEffect(() => {
    if (!isHumanTurn || session.isRoundOver || session.isGameOver) return;

    const timer = setInterval(() => {
      setTurnSecondsRemaining(prev => {
        if (prev <= 1) {
          // Auto advance turn on timeout
          if (session.drawnCard) {
            session.discard();
          } else if (session.pendingAction) {
            session.skipAction();
          } else {
            session.draw('DRAW_PILE');
            session.discard();
          }
          forceUpdate();
          return 20;
        }

        if (prev <= 6) {
          sound.playTimerTick();
          triggerHaptic('light');
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isHumanTurn, session]);

  // Initial memory peek countdown at round start (Official Skru Rule)
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
  }, [session.roundNumber]);

  // Game over celebration
  useEffect(() => {
    if (session.isGameOver) {
      sound.playVictoryFanfare();
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  }, [session.isGameOver]);

  const resetMatch = (bots: number = opponentBotCount) => {
    sound.playCardSlide();
    const configs = [{ name: language === 'ar' ? 'أنت (البطل)' : 'You (Champion)', avatar: '🦁', isAi: false }];
    const botNamesAr = ['الذكي (بوت)', 'المخادع (بوت)', 'الصقر (بوت)'];
    const botNamesEn = ['Smart Bot', 'Bluff Bot', 'Eagle Bot'];
    const botAvatars = ['🦊', '🐯', '🦅'];

    for (let i = 0; i < bots; i++) {
      configs.push({
        name: language === 'ar' ? botNamesAr[i] : botNamesEn[i],
        avatar: botAvatars[i],
        isAi: true
      });
    }

    const newSess = new LocalGameSession(configs);
    setSession(newSess);
    setSelectedOwnCardIdx(null);
    setEphemeralPeek(null);
    setSlapToast(null);
  };

  const handleOwnCardClick = (idx: number) => {
    if (session.isRoundOver) return;
    sound.playCardFlip();
    triggerHaptic('light');

    // 1. If executing special action PEEK_OWN (7/8) or PEEK_ALL (كعب داير)
    if (isPendingAction && (session.pendingAction?.type === 'PEEK_OWN' || session.pendingAction?.type === 'PEEK_ALL')) {
      const res = session.executeAction({ ownCardIndex: idx });
      if (res.allRevealedCards) {
        setEphemeralPeek({
          allRevealedCards: res.allRevealedCards,
          title: language === 'ar' ? 'كعب داير (كروت جميع اللاعبين)' : 'Peek All (Table Cards)'
        });
        setTimeout(() => setEphemeralPeek(null), 7000);
      } else if (res.revealedCard) {
        setEphemeralPeek({
          card: res.revealedCard,
          title: language === 'ar' ? `كارتك رقم #${idx + 1}` : `Your Hand Card #${idx + 1}`
        });
        setTimeout(() => setEphemeralPeek(null), 3500);
      }
      setSelectedOwnCardIdx(null);
      forceUpdate();
      return;
    }

    // 2. If drawn card is active and it's human turn -> swap with hand card
    if (session.drawnCard && isHumanTurn) {
      session.swap(idx);
      setSelectedOwnCardIdx(null);
      forceUpdate();
      return;
    }

    // 3. Normal selection for match slap or swap target
    setSelectedOwnCardIdx(prev => prev === idx ? null : idx);
  };

  const handleOpponentCardClick = (botIdx: number, cardIdx: number) => {
    if (session.isRoundOver || !isPendingAction) return;
    sound.playCardFlip();
    triggerHaptic('light');

    const action = session.pendingAction?.type;
    const targetPlayerIndex = botIdx + 1;
    const botName = session.players[targetPlayerIndex]?.name || 'الخصم';

    if (action === 'PEEK_OTHER') {
      const res = session.executeAction({ targetPlayerIndex, targetCardIndex: cardIdx });
      if (res.revealedCard) {
        setEphemeralPeek({
          card: res.revealedCard,
          title: language === 'ar' ? `كارت ${botName} (#${cardIdx + 1})` : `${botName}'s Card (#${cardIdx + 1})`
        });
        setTimeout(() => setEphemeralPeek(null), 3500);
      }
      forceUpdate();
    } else if (action === 'SWAP') {
      if (selectedOwnCardIdx === null) {
        // Must select own card first
        triggerHaptic('heavy');
        return;
      }
      session.executeAction({
        myCardIndex: selectedOwnCardIdx,
        targetPlayerIndex,
        targetCardIndex: cardIdx
      });
      setSelectedOwnCardIdx(null);
      forceUpdate();
    } else if (action === 'PEEK_AND_SWAP') {
      if (session.pendingAction?.stage === 'SELECT_TARGET') {
        const res = session.executeAction({ targetPlayerIndex, targetCardIndex: cardIdx });
        if (res.revealedCard) {
          setEphemeralPeek({
            card: res.revealedCard,
            title: language === 'ar' ? `كارت ${botName} (#${cardIdx + 1})` : `${botName}'s Card (#${cardIdx + 1})`,
            requireSwapChoice: true
          });
        }
        forceUpdate();
      }
    } else if (action === 'FREEZE' || action === 'BOMB') {
      session.executeAction({ targetPlayerIndex });
      forceUpdate();
    }
  };

  const handleDraw = (from: 'DRAW_PILE' | 'DISCARD_PILE') => {
    if (!isHumanTurn || session.drawnCard || session.isRoundOver || isPendingAction) return;

    // If user clicked discard pile while having a hand card selected, treat it as Match Slap!
    if (from === 'DISCARD_PILE' && selectedOwnCardIdx !== null) {
      handleSlap();
      return;
    }

    sound.playCardFlip();
    triggerHaptic('medium');
    session.draw(from);
    forceUpdate();
  };

  const handleDiscard = () => {
    if (!isHumanTurn || !session.drawnCard) return;
    sound.playCardSlide();
    session.discard();
    forceUpdate();
  };

  const handleSkipAction = () => {
    sound.playCardSlide();
    session.skipAction();
    forceUpdate();
  };

  const handleSkru = () => {
    if (!isHumanTurn || session.drawnCard !== null || session.skruCallerIndex !== null || isPendingAction) return;
    sound.playSkruDeclaration();
    triggerHaptic('skru');
    session.callSkru();
    forceUpdate();
  };

  const handleSlap = () => {
    if (selectedOwnCardIdx === null || session.discardPile.length === 0) return;
    triggerHaptic('medium');
    const res = session.matchSlap(0, selectedOwnCardIdx);
    if (res.isMatch) {
      sound.playMatchSuccess();
      setSlapToast({
        isMatch: true,
        messageAr: `🎉 تشابه ناجح! الكارت (${res.cardValue}) مطابق للأرض وتخلصت منه بنجاح!`,
        messageEn: `🎉 Correct match! Dropped card (${res.cardValue}) matching table!`
      });
    } else {
      sound.playWrongBuzz();
      setSlapToast({
        isMatch: false,
        messageAr: `⚠️ تشابه خاطئ! كارتك (${res.cardValue}) لا يطابق الأرض (${res.topValue}) — كارت غرامة!`,
        messageEn: `⚠️ Wrong match! Your card (${res.cardValue}) does not match table (${res.topValue}) — penalty card!`
      });
    }
    setTimeout(() => setSlapToast(null), 3000);
    setSelectedOwnCardIdx(null);
    forceUpdate();
  };

  const handleNextRound = () => {
    sound.playSkruDeclaration();
    session.roundNumber += 1;
    session.startRound();
    setSelectedOwnCardIdx(null);
    setEphemeralPeek(null);
    setSlapToast(null);
    forceUpdate();
  };

  return (
    <div className="tabletop-container casino-table w-full min-h-[100dvh] flex flex-col justify-between pb-3 sm:pb-6 px-2 sm:px-4 pt-2 sm:pt-3 relative overflow-x-hidden">
      {/* Top Bar: Bot Controls & Opponents Arc */}
      <div className="w-full flex flex-col gap-1.5 sm:gap-2 z-20">
        {/* Banner notification */}
        {session.logs.length > 0 && (
          <div className="mx-auto px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-black/50 border border-amber-400/30 text-[11px] sm:text-xs font-bold text-amber-300 shadow backdrop-blur-md max-w-md text-center truncate">
            {language === 'ar' ? session.logs[session.logs.length - 1].ar : session.logs[session.logs.length - 1].en}
          </div>
        )}

        {/* Initial memory peek countdown banner (6s round start) */}
        {initialPeekTimer > 0 && (
          <div className="mx-auto px-4 sm:px-6 py-1.5 sm:py-2 rounded-2xl bg-gradient-to-r from-amber-500 via-emerald-500 to-amber-500 text-black font-black text-xs sm:text-sm shadow-xl animate-pulse text-center border-2 border-white/40">
            👀 {t('game.initial_peek_banner')} ({initialPeekTimer}s)
          </div>
        )}

        {/* Skru Alert Banner */}
        {session.skruCallerIndex !== null && (
          <div className="mx-auto px-4 sm:px-6 py-1.5 sm:py-2 rounded-2xl bg-gradient-to-r from-red-600 via-amber-600 to-red-600 text-white font-black text-xs sm:text-sm shadow-2xl animate-bounce text-center border-2 border-red-300">
            ⚡ {session.players[session.skruCallerIndex].name} {language === 'ar' ? 'أعلن سكرو! باقي دور أخير للجميع' : 'called SKRU! Final turns!'}
          </div>
        )}

        {/* Action Pending Guidance Banner */}
        {isPendingAction && (
          <div className="mx-auto w-full max-w-md p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-purple-900/90 border-2 border-purple-400 shadow-2xl backdrop-blur-md flex items-center justify-between gap-2 animate-scaleIn">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-lg sm:text-xl flex-shrink-0">✨</span>
              <div className="flex flex-col text-right truncate">
                <span className="text-[11px] sm:text-xs font-black text-amber-300 truncate">
                  {session.pendingAction?.type === 'PEEK_OWN' && t('game.action_peek_own_guide')}
                  {session.pendingAction?.type === 'PEEK_OTHER' && t('game.action_peek_other_guide')}
                  {session.pendingAction?.type === 'SWAP' && (selectedOwnCardIdx === null ? t('game.action_swap_guide_1') : t('game.action_swap_guide_2'))}
                  {session.pendingAction?.type === 'PEEK_AND_SWAP' && t('game.action_peek_swap_guide')}
                  {session.pendingAction?.type === 'FREEZE' && (language === 'ar' ? '❄️ اضغط على أي خصم لتجميده!' : '❄️ Tap any opponent to freeze them!')}
                  {session.pendingAction?.type === 'BOMB' && (language === 'ar' ? '💣 اضغط على أي خصم لرمي القنبلة عليه!' : '💣 Tap any opponent to bomb them!')}
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

        {/* Bot Opponents Header Arc */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-4 mt-0.5 sm:mt-1">
          {session.players.slice(1).map((bot, bIdx) => {
            const isTurn = session.currentTurnIndex === bIdx + 1;
            const isTargetable = isPendingAction && (
              session.pendingAction?.type === 'PEEK_OTHER' ||
              session.pendingAction?.type === 'PEEK_AND_SWAP' ||
              (session.pendingAction?.type === 'SWAP' && selectedOwnCardIdx !== null) ||
              session.pendingAction?.type === 'FREEZE' ||
              session.pendingAction?.type === 'BOMB'
            );

            return (
              <div 
                key={bot.id}
                className={`glass-panel p-1.5 sm:p-2.5 flex flex-col items-center rounded-xl sm:rounded-2xl transition-all ${
                  isTurn ? 'border-amber-400 shadow-lg scale-102' : 'opacity-85'
                } ${isTargetable ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-black/50 cursor-pointer animate-pulse' : ''}`}
                style={{
                  boxShadow: isTurn ? '0 0 20px rgba(245, 158, 11, 0.4)' : undefined,
                  borderColor: isTurn ? '#F59E0B' : undefined
                }}
              >
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-base sm:text-xl">{bot.avatar}</span>
                  <span className="text-[11px] sm:text-xs font-black text-white max-w-[80px] sm:max-w-[100px] truncate">{bot.name}</span>
                  {bot.hasCalledSkru && (
                    <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-black tracking-wider animate-pulse">
                      SKRU!
                    </span>
                  )}
                  {bot.isFrozen && <span className="text-xs">❄️</span>}
                </div>
                <div className="grid grid-cols-2 gap-1 scale-75 sm:scale-85 md:scale-100 origin-top">
                  {bot.hand.map((c, cIdx) => (
                    <CardView
                      key={c.id}
                      id={c.id}
                      value={c.value}
                      action={c.action}
                      labelAr={c.labelAr}
                      labelEn={c.labelEn}
                      color={c.color as any}
                      isFaceUp={session.isRoundOver}
                      canInteract={isTargetable}
                      onClick={() => handleOpponentCardClick(bIdx, cIdx)}
                      lang={language}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match Slap Toast Feedback Overlay */}
      {slapToast && (
        <div className="fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 animate-scaleIn px-4 sm:px-5 py-2 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-2 border-2 max-w-xs sm:max-w-sm text-center font-black text-xs sm:text-sm"
          style={{
            background: slapToast.isMatch ? 'rgba(5, 150, 105, 0.95)' : 'rgba(220, 38, 38, 0.95)',
            borderColor: slapToast.isMatch ? '#34D399' : '#F87171',
            color: '#FFFFFF'
          }}
        >
          {slapToast.isMatch ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{language === 'ar' ? slapToast.messageAr : slapToast.messageEn}</span>
        </div>
      )}

      {/* Center Table: Turn Countdown, Draw Pile & Discard Pile on Casino Felt */}
      <div className="my-auto flex flex-col items-center justify-center gap-2 sm:gap-3 z-10 py-1 sm:py-2">
        {/* Turn Countdown & Player Status */}
        <div className="flex flex-col items-center gap-1 w-full max-w-[260px] sm:max-w-xs px-2">
          <div className="flex items-center justify-between w-full text-xs font-black">
            <span className={isHumanTurn ? 'text-amber-400 animate-pulse text-xs sm:text-sm' : 'text-slate-300 text-xs'}>
              {isHumanTurn ? `✨ ${t('game.your_turn')} ✨` : t('game.turn_of', { name: session.players[session.currentTurnIndex]?.name || '' })}
            </span>
            <span className={`font-mono text-xs sm:text-sm font-black px-2 py-0.2 rounded-full bg-black/40 border border-white/10 ${turnSecondsRemaining <= 5 && isHumanTurn ? 'text-red-400 animate-ping' : 'text-amber-300'}`}>
              {turnSecondsRemaining}s
            </span>
          </div>
          <div className="turn-timer-bar">
            <div 
              className="turn-timer-progress" 
              style={{ 
                width: `${Math.min(100, Math.max(0, (turnSecondsRemaining / 20) * 100))}%` 
              }} 
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-5 sm:gap-12">
          {/* Draw Pile */}
          <div 
            onClick={() => handleDraw('DRAW_PILE')}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              isHumanTurn && !session.drawnCard && !isPendingAction ? 'hover:scale-105 active:scale-95 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'opacity-85'
            }`}
          >
            <div className="card-slot flex items-center justify-center relative">
              <div className="card-3d">
                <div className="card-face card-back flex flex-col items-center justify-center">
                  <Layers size={22} className="text-amber-300 mb-0.5 sm:mb-1" />
                  <span className="text-xs sm:text-sm font-black text-amber-300 font-mono">
                    {session.drawPile.length}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-amber-200/80">{language === 'ar' ? 'كارت' : 'Cards'}</span>
                </div>
              </div>
            </div>
            <span className="text-[11px] sm:text-xs font-black mt-1 text-slate-200">{t('game.draw_deck')}</span>
          </div>

          {/* Discard Pile */}
          <div 
            onClick={() => handleDraw('DISCARD_PILE')}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              (isHumanTurn && !session.drawnCard && !isPendingAction) || selectedOwnCardIdx !== null
                ? 'hover:scale-105 active:scale-95 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]' 
                : ''
            }`}
          >
            <div className="card-slot flex items-center justify-center">
              {topDiscard ? (
                <CardView
                  id={topDiscard.id}
                  value={topDiscard.value}
                  action={topDiscard.action}
                  labelAr={topDiscard.labelAr}
                  labelEn={topDiscard.labelEn}
                  color={topDiscard.color as any}
                  isFaceUp={true}
                  canInteract={false}
                  lang={language}
                />
              ) : (
                <span className="text-xs font-bold text-slate-500">{t('game.discard_pile')}</span>
              )}
            </div>
            <span className="text-[11px] sm:text-xs font-black mt-1 text-slate-200">{t('game.discard_pile')}</span>
          </div>
        </div>

        {/* Drawn Card Overlay Banner */}
        {session.drawnCard && isHumanTurn && (
          <div className="glass-panel p-2.5 sm:p-3.5 flex items-center gap-3 sm:gap-4 animate-scaleIn border-2 border-amber-400 shadow-2xl w-full max-w-xs sm:max-w-sm">
            <CardView
              id={session.drawnCard.id}
              value={session.drawnCard.value}
              action={session.drawnCard.action}
              labelAr={session.drawnCard.labelAr}
              labelEn={session.drawnCard.labelEn}
              color={session.drawnCard.color as any}
              isFaceUp={true}
              canInteract={false}
              lang={language}
            />
            <div className="flex flex-col gap-1.5 sm:gap-2 flex-1 min-w-0">
              <span className="text-[11px] sm:text-xs font-black text-amber-300">
                {language === 'ar' ? 'اختر كارت لتبديله، أو ارمه لتفعيل قدرته:' : 'Tap hand card to swap, or discard:'}
              </span>
              <button
                onClick={handleDiscard}
                className="py-1.5 sm:py-2 px-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs shadow-lg transition-transform active:scale-95"
              >
                {t('game.discard_card')}
              </button>
            </div>
          </div>
        )}

        {/* EPHEMERAL PEEK REVEAL MODAL */}
        {ephemeralPeek && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEphemeralPeek(null);
                setSelectedOwnCardIdx(null);
                forceUpdate();
              }
            }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"
          >
            <div className={`glass-panel p-5 ${ephemeralPeek.allRevealedCards ? 'max-w-lg' : 'max-w-sm'} w-full flex flex-col items-center text-center gap-4 border-2 border-purple-400 shadow-2xl relative`}>
              <button
                onClick={() => {
                  setEphemeralPeek(null);
                  setSelectedOwnCardIdx(null);
                  forceUpdate();
                }}
                className="absolute top-3 left-3 sm:left-auto sm:right-3 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all"
                title={language === 'ar' ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>

              <h3 className="font-black text-base text-purple-300 flex items-center gap-2">
                <Eye size={20} />
                <span>{ephemeralPeek.title}</span>
              </h3>

              {ephemeralPeek.allRevealedCards ? (
                <div className="flex flex-col gap-3 w-full">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-h-[55vh] overflow-y-auto p-1">
                    {ephemeralPeek.allRevealedCards.map((item, i) => (
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
                          color={item.card.color as any}
                          isFaceUp={true}
                          canInteract={false}
                          lang={language}
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setEphemeralPeek(null);
                      setSelectedOwnCardIdx(null);
                      forceUpdate();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-black text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>{language === 'ar' ? 'فهمت كروت الطاولة (إغلاق) ✓' : 'Got Table Cards (Close) ✓'}</span>
                  </button>
                </div>
              ) : ephemeralPeek.card ? (
                <CardView
                  id={ephemeralPeek.card.id}
                  value={ephemeralPeek.card.value}
                  action={ephemeralPeek.card.action}
                  labelAr={ephemeralPeek.card.labelAr}
                  labelEn={ephemeralPeek.card.labelEn}
                  color={ephemeralPeek.card.color as any}
                  isFaceUp={true}
                  canInteract={false}
                  lang={language}
                />
              ) : null}

              {!ephemeralPeek.allRevealedCards && (
                ephemeralPeek.requireSwapChoice ? (
                  <div className="flex flex-col gap-2 w-full mt-2">
                    <span className="text-xs font-bold text-amber-200">
                      {language === 'ar' ? 'اختر الكارت الذي تريد تبديله من يدك:' : 'Choose a card from your hand to swap:'}
                    </span>
                    <div className="grid grid-cols-4 gap-1.5 w-full my-1">
                      {humanPlayer.hand.map((c, hIdx) => {
                        const isSelected = selectedOwnCardIdx === hIdx;
                        const knownVal = humanPlayer.knownCards[hIdx];
                        return (
                          <button
                            key={hIdx}
                            type="button"
                            onClick={() => {
                              setSelectedOwnCardIdx(hIdx);
                              forceUpdate();
                            }}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all ${
                              isSelected 
                                ? 'bg-amber-500/30 border-amber-400 scale-105 shadow-lg shadow-amber-500/40 text-amber-300' 
                                : 'bg-black/50 border-white/20 hover:border-white/40 text-slate-300'
                            }`}
                          >
                            <span className="text-xs font-black">#{hIdx + 1}</span>
                            <span className="text-[10px] text-slate-400 truncate max-w-full">
                              {knownVal !== null ? `(${knownVal})` : '❓'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2 w-full mt-1">
                      <button
                        onClick={() => {
                          if (selectedOwnCardIdx !== null) {
                            session.executeAction({
                              chooseSwap: true,
                              myCardIndex: selectedOwnCardIdx,
                              targetPlayerIndex: session.pendingAction?.targetPlayerIndex
                            });
                            setEphemeralPeek(null);
                            setSelectedOwnCardIdx(null);
                            forceUpdate();
                          }
                        }}
                        disabled={selectedOwnCardIdx === null}
                        className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all shadow ${
                          selectedOwnCardIdx !== null
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:brightness-110 active:scale-95 animate-pulse'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/10'
                        }`}
                      >
                        {selectedOwnCardIdx !== null 
                          ? (language === 'ar' ? `تبديل مع كارت #${selectedOwnCardIdx + 1}` : `Swap with #${selectedOwnCardIdx + 1}`)
                          : (language === 'ar' ? 'حدد كارت لتبديله' : 'Select Card to Swap')}
                      </button>
                      <button
                        onClick={() => {
                          session.executeAction({ chooseSwap: false });
                          setEphemeralPeek(null);
                          setSelectedOwnCardIdx(null);
                          forceUpdate();
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-black text-xs shadow transition-all active:scale-95"
                      >
                        {language === 'ar' ? 'احتفظ بكروتك' : 'Keep Your Cards'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 w-full mt-1">
                    <button
                      onClick={() => {
                        setEphemeralPeek(null);
                        setSelectedOwnCardIdx(null);
                        forceUpdate();
                      }}
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

      {/* Bottom Area: Human Player Hand (2x2 Grid with Luxury Card Slots) */}
      <div className="w-full flex flex-col items-center gap-2 sm:gap-3 z-20 max-w-md mx-auto">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] sm:text-xs font-black text-amber-300">{language === 'ar' ? 'أنت (بطل الطاولة)' : 'You (Champion)'}</span>
          {isHumanTurn && !session.isRoundOver && (
            <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.2 rounded-full font-bold animate-pulse">
              {language === 'ar' ? 'دورك للعب الآن 🎲' : 'Your Turn 🎲'}
            </span>
          )}
        </div>

        {/* 2x2 Hand Grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3.5 p-2 sm:p-3 rounded-2xl bg-black/45 border-2 border-emerald-500/30 backdrop-blur-lg shadow-2xl">
          {humanPlayer.hand.map((c, idx) => {
            const isBottomTwoInitial = initialPeekTimer > 0 && idx >= 2;
            const isCardFaceUp = c.isFaceUp || session.isRoundOver || isBottomTwoInitial;
            const isTargetableForAction = isPendingAction && (session.pendingAction?.type === 'PEEK_OWN' || session.pendingAction?.type === 'PEEK_ALL');

            return (
              <div key={c.id || idx} className="relative flex flex-col items-center">
                <span className={`absolute -top-1.5 -left-1.5 z-20 w-4 h-4 sm:w-5 sm:h-5 rounded-full border text-[9px] sm:text-[10px] font-black flex items-center justify-center pointer-events-none ${
                  isBottomTwoInitial 
                    ? 'bg-amber-400 text-black border-amber-300 animate-bounce' 
                    : 'bg-black/80 border-white/20 text-white'
                }`}>
                  {idx + 1}
                </span>
                <div className={`card-slot ${isTargetableForAction ? 'ring-2 ring-purple-400 animate-pulse' : ''}`}>
                  <CardView
                    id={c.id}
                    value={c.value}
                    action={c.action}
                    labelAr={c.labelAr}
                    labelEn={c.labelEn}
                    color={c.color as any}
                    isFaceUp={isCardFaceUp}
                    isSelected={selectedOwnCardIdx === idx}
                    onClick={() => handleOwnCardClick(idx)}
                    lang={language}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls Bar: Match Slap, Call Skru!, Reset */}
        <div className="w-full max-w-sm sm:max-w-md mx-auto flex items-stretch justify-center gap-1.5 sm:gap-2 px-1 sm:px-2">
          {/* Match Slap Button */}
          <button
            onClick={handleSlap}
            disabled={selectedOwnCardIdx === null || session.discardPile.length === 0}
            className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-1 transition-all shadow-lg ${
              selectedOwnCardIdx !== null && session.discardPile.length > 0
                ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white active:scale-95 shadow-blue-900/40 hover:brightness-110 border-2 border-blue-300 animate-pulse' 
                : 'bg-black/30 text-slate-500 border border-white/10 cursor-not-allowed'
            }`}
          >
            <Sparkles size={15} className="flex-shrink-0" />
            <span className="truncate">
              {selectedOwnCardIdx !== null && topDiscard 
                ? (language === 'ar' ? `تشابه (${topDiscard.value})` : `Match (${topDiscard.value})`) 
                : t('game.match_slap')}
            </span>
          </button>

          {/* Call Skru! Button */}
          <button
            onClick={handleSkru}
            disabled={!isHumanTurn || session.drawnCard !== null || session.skruCallerIndex !== null || isPendingAction}
            className={`btn-skru flex-1 min-w-0 py-2.5 px-2 rounded-xl sm:rounded-2xl flex items-center justify-center gap-1 text-xs sm:text-sm ${
              (!isHumanTurn || session.drawnCard !== null || session.skruCallerIndex !== null || isPendingAction)
                ? 'opacity-40 cursor-not-allowed filter grayscale'
                : ''
            }`}
          >
            <Flame size={16} className="flex-shrink-0" />
            <span className="truncate">{t('game.call_skru')}</span>
          </button>

          {/* Reset / New Bot Match */}
          <button
            onClick={() => resetMatch()}
            className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 flex items-center justify-center rounded-xl sm:rounded-2xl bg-white/10 text-white border border-white/10 hover:bg-white/20 active:scale-95 transition-all shadow"
            title="Reset Game"
          >
            <RotateCcw size={18} />
          </button>
        </div>

        {/* Match Slap Helper Hint */}
        <span className="text-[10px] sm:text-[11px] text-slate-400 text-center max-w-xs px-2 truncate">
          {language === 'ar' 
            ? '💡 للتشابه: اضغط على كارتك أولاً ثم اضغط تشابه للتخلص منه.' 
            : '💡 Match Slap: Tap your hand card first then tap Match!'}
        </span>
      </div>

      {/* Round Concluded Modal */}
      {session.isRoundOver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="glass-panel p-6 max-w-sm w-full flex flex-col items-center text-center gap-4 border-2 border-emerald-400 shadow-2xl">
            <h3 className="text-xl font-black text-amber-400">
              {session.isGameOver ? '🏆 انتهت المباراة ضد الذكاء الاصطناعي!' : `🏁 نهاية الجولة ${session.roundNumber}!`}
            </h3>
            <div className="w-full flex flex-col gap-2">
              {[...session.players].sort((a, b) => a.totalScore - b.totalScore).map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-amber-400 text-sm">#{idx + 1}</span>
                    <span className="text-lg">{p.avatar}</span>
                    <span className="font-bold text-xs text-white">{p.name}</span>
                  </div>
                  <span className="font-black text-sm text-emerald-400">{p.totalScore} {t('game.score')}</span>
                </div>
              ))}
            </div>

            <button
              onClick={handleNextRound}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              {session.isGameOver ? t('game.play_again') : t('game.next_round')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
