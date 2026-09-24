import React, { useState, useEffect } from 'react';
import { CardView } from './CardView';
import { LocalGameSession } from '../../engine/localGameEngine';
import { sound } from '../../utils/audio';
import { triggerHaptic } from '../../utils/haptics';
import { useTranslation } from '../../i18n/I18nContext';
import { Sparkles, Flame, RotateCcw, Bot, Eye, Users } from 'lucide-react';
import confetti from 'canvas-confetti';

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
  const [isHoldingPeek, setIsHoldingPeek] = useState<boolean>(false);
  const [opponentBotCount, setOpponentBotCount] = useState<number>(2);

  const forceUpdate = () => setTick(prev => prev + 1);

  const humanPlayer = session.players[0];
  const isHumanTurn = session.currentTurnIndex === 0;

  useEffect(() => {
    if (session.isGameOver) {
      sound.playVictoryFanfare();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
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

    setSession(new LocalGameSession(configs));
    setSelectedOwnCardIdx(null);
  };

  const handleCardClick = (idx: number) => {
    if (session.isRoundOver) return;
    sound.playCardFlip();
    triggerHaptic('light');

    if (session.drawnCard && isHumanTurn) {
      session.swap(idx);
      setSelectedOwnCardIdx(null);
      forceUpdate();
      return;
    }

    setSelectedOwnCardIdx(selectedOwnCardIdx === idx ? null : idx);
  };

  const handleDraw = (from: 'DRAW_PILE' | 'DISCARD_PILE') => {
    if (!isHumanTurn || session.drawnCard || session.isRoundOver) return;
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

  const handleSkru = () => {
    if (!isHumanTurn || session.skruCallerIndex !== null) return;
    sound.playSkruDeclaration();
    triggerHaptic('skru');
    session.callSkru();
    forceUpdate();
  };

  const handleSlap = () => {
    if (selectedOwnCardIdx === null) return;
    triggerHaptic('medium');
    const res = session.matchSlap(0, selectedOwnCardIdx);
    if (res.isMatch) sound.playMatchSuccess();
    else sound.playWrongBuzz();
    setSelectedOwnCardIdx(null);
    forceUpdate();
  };

  const handleNextRound = () => {
    sound.playSkruDeclaration();
    session.roundNumber += 1;
    session.startRound();
    setSelectedOwnCardIdx(null);
    forceUpdate();
  };

  return (
    <div className="tabletop-container relative flex flex-col justify-between p-2 sm:p-4">
      {/* Top Bar: Bot Controls & Opponents Arc */}
      <div className="w-full flex flex-col gap-2 z-20">
        {/* Banner notification */}
        {session.logs.length > 0 && (
          <div className="mx-auto px-4 py-1.5 rounded-full bg-black/40 border border-white/10 text-xs font-bold text-amber-300 shadow backdrop-blur-md max-w-md text-center">
            {language === 'ar' ? session.logs[session.logs.length - 1].ar : session.logs[session.logs.length - 1].en}
          </div>
        )}

        {/* Bot Opponents Header Arc */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-1">
          {session.players.slice(1).map((bot, bIdx) => {
            const isTurn = session.currentTurnIndex === bIdx + 1;
            return (
              <div 
                key={bot.id}
                className={`glass-panel p-2.5 flex flex-col items-center transition-all ${
                  isTurn ? 'border-amber-400 shadow-lg scale-105' : 'opacity-85'
                }`}
                style={{
                  boxShadow: isTurn ? '0 0 20px rgba(245, 158, 11, 0.4)' : undefined,
                  borderColor: isTurn ? '#F59E0B' : undefined
                }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-xl">{bot.avatar}</span>
                  <span className="text-xs font-black text-white">{bot.name}</span>
                  {bot.hasCalledSkru && (
                    <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-black tracking-wider animate-pulse">
                      SKRU!
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1.5 scale-75 origin-top">
                  {bot.hand.map((c) => (
                    <CardView
                      key={c.id}
                      id={c.id}
                      value={c.value}
                      action={c.action}
                      labelAr={c.labelAr}
                      labelEn={c.labelEn}
                      color={c.color as any}
                      isFaceUp={session.isRoundOver}
                      canInteract={false}
                      lang={language}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center Table: Draw Pile & Discard Pile on Casino Felt */}
      <div className="my-auto flex flex-col items-center justify-center gap-4 z-10 py-2">
        <div className="flex items-center justify-center gap-8 sm:gap-14">
          {/* Draw Pile */}
          <div 
            onClick={() => handleDraw('DRAW_PILE')}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              isHumanTurn && !session.drawnCard ? 'hover:scale-105 active:scale-95' : 'opacity-85'
            }`}
          >
            <div className="card-slot flex items-center justify-center relative">
              <div className="card-3d">
                <div className="card-face card-back flex flex-col items-center justify-center">
                  <span className="text-sm font-black text-amber-300">
                    {session.drawPile.length}
                  </span>
                  <span className="text-[10px] font-bold text-amber-200/80">كارت</span>
                </div>
              </div>
            </div>
            <span className="text-xs font-black mt-2 text-slate-200">{t('game.draw_deck')}</span>
          </div>

          {/* Discard Pile */}
          <div 
            onClick={() => handleDraw('DISCARD_PILE')}
            className={`flex flex-col items-center cursor-pointer transition-all ${
              isHumanTurn && !session.drawnCard ? 'hover:scale-105 active:scale-95' : ''
            }`}
          >
            <div className="card-slot flex items-center justify-center">
              {session.discardPile.length > 0 ? (
                <CardView
                  id={session.discardPile[session.discardPile.length - 1].id}
                  value={session.discardPile[session.discardPile.length - 1].value}
                  action={session.discardPile[session.discardPile.length - 1].action}
                  labelAr={session.discardPile[session.discardPile.length - 1].labelAr}
                  labelEn={session.discardPile[session.discardPile.length - 1].labelEn}
                  color={session.discardPile[session.discardPile.length - 1].color as any}
                  isFaceUp={true}
                  canInteract={false}
                  lang={language}
                />
              ) : (
                <span className="text-xs font-bold text-slate-500">{t('game.discard_pile')}</span>
              )}
            </div>
            <span className="text-xs font-black mt-2 text-slate-200">{t('game.discard_pile')}</span>
          </div>
        </div>

        {/* Drawn Card Overlay Banner */}
        {session.drawnCard && isHumanTurn && (
          <div className="glass-panel p-3.5 flex items-center gap-4 animate-scaleIn border-amber-400 shadow-2xl">
            <span className="text-xs font-bold text-amber-300">الكارت المسحوب:</span>
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
            <div className="flex flex-col gap-2">
              <span className="text-[11px] text-slate-200 font-semibold max-w-[180px]">
                اضغط على كارت في يدك لتبديله، أو ارمه:
              </span>
              <button
                onClick={handleDiscard}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs shadow-lg transition-transform active:scale-95"
              >
                {t('game.discard_card')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Area: Human Player Hand (2x2 Grid with Luxury Card Slots) */}
      <div className="w-full px-4 pb-4 flex flex-col items-center gap-3 z-20">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-black text-amber-300">أنت (بطل الطاولة)</span>
          {isHumanTurn && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold animate-pulse">
              دورك للعب الآن 🎲
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-5 p-3 sm:p-4 rounded-3xl glass-panel shadow-2xl">
          {humanPlayer.hand.map((c, idx) => (
            <div key={c.id} className="relative flex flex-col items-center">
              <span className="absolute -top-2 left-2 z-20 w-5 h-5 rounded-full bg-black/60 border border-amber-400/40 text-[10px] font-black text-amber-300 flex items-center justify-center pointer-events-none">
                {idx + 1}
              </span>
              <div className="card-slot">
                <CardView
                  id={c.id}
                  value={c.value}
                  action={c.action}
                  labelAr={c.labelAr}
                  labelEn={c.labelEn}
                  color={c.color as any}
                  isFaceUp={c.isFaceUp || session.isRoundOver || isHoldingPeek}
                  isSelected={selectedOwnCardIdx === idx}
                  onClick={() => handleCardClick(idx)}
                  lang={language}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-lg">
          {/* Secret Peek Hold Button */}
          <button
            onMouseDown={() => setIsHoldingPeek(true)}
            onMouseUp={() => setIsHoldingPeek(false)}
            onTouchStart={() => setIsHoldingPeek(true)}
            onTouchEnd={() => setIsHoldingPeek(false)}
            className="flex-1 min-w-[110px] py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all select-none"
          >
            <Eye size={16} />
            <span>{t('game.hold_to_peek')}</span>
          </button>

          {/* Match Slap */}
          <button
            onClick={handleSlap}
            disabled={selectedOwnCardIdx === null}
            className={`flex-1 min-w-[90px] py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow ${
              selectedOwnCardIdx !== null 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white active:scale-95' 
                : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <Sparkles size={16} />
            <span>{t('game.match_slap')}</span>
          </button>

          {/* Call Skru */}
          <button
            onClick={handleSkru}
            disabled={!isHumanTurn || session.drawnCard !== null || session.skruCallerIndex !== null}
            className={`flex-1 min-w-[100px] py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg ${
              isHumanTurn && !session.drawnCard && session.skruCallerIndex === null
                ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white active:scale-95 shadow-red-900/40 animate-pulse'
                : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
            }`}
          >
            <Flame size={16} />
            <span>{t('game.call_skru')}</span>
          </button>

          {/* Reset / New Bot Match */}
          <button
            onClick={() => resetMatch()}
            className="p-2.5 rounded-xl bg-white/10 text-white border border-white/10 hover:bg-white/20 transition-all"
            title="Reset Game"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Round Concluded Modal */}
      {session.isRoundOver && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-panel p-6 max-w-sm w-full flex flex-col items-center text-center gap-4 border-emerald-400">
            <h3 className="text-xl font-black text-amber-400">
              {session.isGameOver ? '🏆 انتهت المباراة ضد الذكاء الاصطناعي!' : `🏁 نهاية الجولة ${session.roundNumber}!`}
            </h3>
            <div className="w-full flex flex-col gap-2">
              {[...session.players].sort((a, b) => a.totalScore - b.totalScore).map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-black/30 border border-white/10">
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
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm shadow-lg hover:brightness-110 active:scale-95"
            >
              {session.isGameOver ? t('game.play_again') : t('game.next_round')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
