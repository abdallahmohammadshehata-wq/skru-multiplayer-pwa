import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Trophy, RotateCcw, Calculator, Flame, Check } from 'lucide-react';
import { useTranslation } from '../../i18n/I18nContext';
import { sound } from '../../utils/audio';

const AVATARS = ['🦁', '🦊', '🐯', '🐺', '🦅', '🐼', '👑', '🚀', '💎'];

interface ScorekeeperPlayer {
  id: string;
  name: string;
  avatar: string;
  roundScores: number[];
  totalScore: number;
}

export const Scorekeeper: React.FC = () => {
  const { t, language } = useTranslation();

  const [players, setPlayers] = useState<ScorekeeperPlayer[]>(() => {
    const saved = localStorage.getItem('skru_scorekeeper_players');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: '1', name: 'أحمد', avatar: '🦁', roundScores: [], totalScore: 0 },
      { id: '2', name: 'محمد', avatar: '🦊', roundScores: [], totalScore: 0 },
      { id: '3', name: 'عمر', avatar: '🐯', roundScores: [], totalScore: 0 }
    ];
  });

  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [currentRoundInputs, setCurrentRoundInputs] = useState<Record<string, string>>({});
  const [skruCallerId, setSkruCallerId] = useState<string>('NONE');

  useEffect(() => {
    localStorage.setItem('skru_scorekeeper_players', JSON.stringify(players));
  }, [players]);

  const addPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim() || players.length >= 8) return;
    sound.playCardFlip();
    const newP: ScorekeeperPlayer = {
      id: Math.random().toString(36).substring(2, 8),
      name: newPlayerName.trim(),
      avatar: AVATARS[players.length % AVATARS.length],
      roundScores: [],
      totalScore: 0
    };
    setPlayers([...players, newP]);
    setNewPlayerName('');
  };

  const removePlayer = (id: string) => {
    if (players.length <= 2) return;
    sound.playCardSlide();
    setPlayers(players.filter(p => p.id !== id));
  };

  const handleScoreChange = (playerId: string, value: string) => {
    setCurrentRoundInputs(prev => ({ ...prev, [playerId]: value }));
  };

  const submitRound = (e: React.FormEvent) => {
    e.preventDefault();
    sound.playMatchSuccess();

    // Parse all hand scores
    const parsedSums: Record<string, number> = {};
    for (const p of players) {
      const val = parseInt(currentRoundInputs[p.id] || '0', 10);
      parsedSums[p.id] = isNaN(val) ? 0 : val;
    }

    // Determine min sum
    const minVal = Math.min(...Object.values(parsedSums));

    // Calculate applied round scores with Skru penalties
    const updated = players.map(p => {
      const handSum = parsedSums[p.id];
      let finalRoundScore = handSum;

      if (skruCallerId === p.id) {
        // Did caller win?
        const othersTiedOrLower = Object.entries(parsedSums).filter(
          ([id, sum]) => id !== p.id && sum <= handSum
        );

        if (othersTiedOrLower.length === 0) {
          // Success! Caller gets 0 points
          finalRoundScore = 0;
        } else {
          // Failed call! Penalty: Double score (or sum + 30)
          finalRoundScore = Math.max(handSum * 2, handSum + 30);
        }
      }

      return {
        ...p,
        roundScores: [...p.roundScores, finalRoundScore],
        totalScore: p.totalScore + finalRoundScore
      };
    });

    setPlayers(updated);
    setCurrentRoundInputs({});
    setSkruCallerId('NONE');
  };

  const resetGame = () => {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من تصفير نتائج المباراة؟' : 'Reset all match scores?')) return;
    sound.playCardSlide();
    setPlayers(players.map(p => ({ ...p, roundScores: [], totalScore: 0 })));
    setCurrentRoundInputs({});
    setSkruCallerId('NONE');
  };

  const roundCount = Math.max(...players.map(p => p.roundScores.length), 0);

  return (
    <div className="w-full max-w-3xl mx-auto p-4 pb-28 flex flex-col gap-6">
      {/* Header */}
      <div className="glass-panel p-6 text-center flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500" />
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="text-emerald-400" size={24} />
          <h2 className="text-2xl font-black text-white">{t('scorekeeper.title')}</h2>
        </div>
        <p className="text-xs text-slate-400 max-w-md">
          {t('scorekeeper.subtitle')}
        </p>
      </div>

      {/* Leaderboard Podium */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-sm text-white flex items-center gap-2">
            <Trophy className="text-amber-400" size={18} />
            <span>{t('scorekeeper.total_scores')}</span>
          </h3>
          <button
            onClick={resetGame}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-400 hover:text-white transition-all border border-white/5"
          >
            <RotateCcw size={14} />
            <span>{t('scorekeeper.reset_scores')}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[...players].sort((a, b) => a.totalScore - b.totalScore).map((p, idx) => (
            <div 
              key={p.id}
              className={`p-3 rounded-xl flex items-center justify-between border ${
                idx === 0 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-black/20 border-white/5'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                  idx === 0 ? 'bg-amber-400 text-black' : 'bg-white/10 text-slate-300'
                }`}>
                  #{idx + 1}
                </span>
                <span className="text-2xl">{p.avatar}</span>
                <span className="font-bold text-sm text-white">{p.name}</span>
              </div>
              <span className="font-black text-lg text-emerald-400">{p.totalScore}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Round Score Entry Form */}
      <form onSubmit={submitRound} className="glass-panel p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="font-extrabold text-base text-white">
            {t('scorekeeper.round_number', { num: roundCount + 1 })}
          </h3>
          <span className="text-xs text-amber-300 font-bold bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30">
            {t('scorekeeper.double_penalty_note')}
          </span>
        </div>

        {/* Who called Skru selector */}
        <div>
          <label className="text-xs font-bold text-slate-400 mb-1.5 flex items-center gap-1.5">
            <Flame size={15} className="text-red-400" />
            <span>{t('scorekeeper.who_called_skru')}</span>
          </label>
          <select
            value={skruCallerId}
            onChange={(e) => setSkruCallerId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-black/20 dark:bg-black/40 border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
          >
            <option value="NONE" className="bg-slate-900">{t('scorekeeper.no_caller')}</option>
            {players.map(p => (
              <option key={p.id} value={p.id} className="bg-slate-900">
                {p.avatar} {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Individual score inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          {players.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-xl">{p.avatar}</span>
                <span className="font-bold text-sm text-white">{p.name}</span>
                {skruCallerId === p.id && (
                  <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-black">
                    SKRU
                  </span>
                )}
              </div>
              <input
                type="number"
                required
                min="-10"
                max="100"
                value={currentRoundInputs[p.id] ?? ''}
                onChange={(e) => handleScoreChange(p.id, e.target.value)}
                placeholder="0"
                className="w-20 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-black text-center text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-black text-sm shadow-lg shadow-emerald-900/30 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Check size={18} />
          <span>{t('scorekeeper.calculate_round')}</span>
        </button>
      </form>

      {/* Add New Player Bar */}
      {players.length < 8 && (
        <form onSubmit={addPlayer} className="glass-panel p-4 flex items-center gap-3">
          <input
            type="text"
            maxLength={14}
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder={t('scorekeeper.add_player')}
            className="flex-1 px-4 py-2 rounded-xl bg-black/20 border border-white/10 text-white text-sm focus:outline-none focus:border-emerald-400"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-1.5 shadow"
          >
            <Plus size={16} />
            <span>{t('scorekeeper.add_player')}</span>
          </button>
        </form>
      )}
    </div>
  );
};
