import React, { useState } from 'react';
import { CardView } from '../tabletop/CardView';
import { useTranslation } from '../../i18n/I18nContext';
import { BookOpen, Sparkles, HelpCircle, ShieldAlert, Award, Flame } from 'lucide-react';
import { CardAction } from '../../types';

interface RuleCardItem {
  value: number;
  action: CardAction;
  labelAr: string;
  labelEn: string;
  color: 'emerald' | 'gold' | 'crimson' | 'indigo' | 'purple' | 'amber';
  descAr: string;
  descEn: string;
}

const ENCYCLOPEDIA_CARDS: RuleCardItem[] = [
  {
    value: 7,
    action: 'PEEK_OWN',
    labelAr: '7 - خد فكرة',
    labelEn: '7 - Peek Own',
    color: 'purple',
    descAr: 'يسمح لك بالنظر سراً إلى كارت واحد من أوراقك المقلوبة لمدة 4 ثوانٍ لحفظه.',
    descEn: 'Allows you to secretly peek at one of your own face-down cards for 4 seconds.'
  },
  {
    value: 9,
    action: 'PEEK_OTHER',
    labelAr: '9 - بصرة',
    labelEn: '9 - Peek Other',
    color: 'amber',
    descAr: 'يسمح لك بالنظر سراً إلى كارت واحد من أوراق أي خصم لمعرفة نقاطه.',
    descEn: 'Allows you to secretly peek at one face-down card belonging to any opponent.'
  },
  {
    value: 11,
    action: 'SWAP',
    labelAr: 'هات وخد',
    labelEn: 'Blind Swap',
    color: 'indigo',
    descAr: 'تبديل إجباري بين كارت من عندك وكارت من عند أي لاعب آخر دون النظر إليهما (عِمياني).',
    descEn: 'Forces a blind swap between one of your cards and an opponent card without looking.'
  },
  {
    value: 12,
    action: 'PEEK_AND_SWAP',
    labelAr: 'خد وهات بصرة',
    labelEn: 'Peek & Swap',
    color: 'purple',
    descAr: 'انظر إلى كارت الخصم أولاً، ثم قرر بحرية ما إذا كنت ترغب في تبديله مع أحد كروتك أم لا!',
    descEn: 'Inspect an opponent card first, then decide whether you want to swap it with yours!'
  },
  {
    value: 12,
    action: 'PEEK_ALL',
    labelAr: 'كعب داير',
    labelEn: 'Peek All',
    color: 'gold',
    descAr: 'أقوى كارت استطلاع! يتيح لك رؤية كارت واحد من كل لاعب على الطاولة بالإضافة لأوراقك!',
    descEn: 'Ultimate intel card! Lets you peek at one card from every single player at the table.'
  },
  {
    value: -1,
    action: 'NONE',
    labelAr: '-1 سكرو أحمر',
    labelEn: '-1 Red Skru',
    color: 'crimson',
    descAr: 'أفضل كارت في اللعبة! يخصم نقطة من مجموعك النهائي بدلاً من الإضافة.',
    descEn: 'The best card in the game! Subtracts 1 point from your hand total.'
  },
  {
    value: 0,
    action: 'NONE',
    labelAr: '0 صفر ذهبي',
    labelEn: '0 Golden Zero',
    color: 'gold',
    descAr: 'كارت ممتاز يضيف 0 نقطة إلى مجموعك، مما يسهل فوزك بالجولة.',
    descEn: 'Excellent card adding 0 points to your hand, securing a low sum.'
  },
  {
    value: 20,
    action: 'NONE',
    labelAr: '+20 غرامة سكرو',
    labelEn: '+20 Penalty Card',
    color: 'crimson',
    descAr: 'كارت كارثي يضيف 20 نقطة! تخلص منه فوراً بالسحب أو التبديل أو التشابه!',
    descEn: 'Disastrous +20 points card! Discard or swap it away immediately!'
  },
  {
    value: 10,
    action: 'FREEZE',
    labelAr: 'تجميد دور (ديلوكس)',
    labelEn: 'Freeze Turn',
    color: 'indigo',
    descAr: 'يجمد أي خصم بحيث يتم تخطي دوره القادم بالكامل دون لعب.',
    descEn: 'Freezes an opponent, skipping their entire upcoming turn.'
  },
  {
    value: 25,
    action: 'BOMB',
    labelAr: 'قنبلة +25 (ديلوكس)',
    labelEn: 'Bomb +25',
    color: 'crimson',
    descAr: 'كارت العقوبة الكبرى بقيمة 25 نقطة في إصدار الأكشن بلس.',
    descEn: 'High penalty +25 card introduced in the Action Plus deluxe edition.'
  }
];

export const RulesEncyclopedia: React.FC = () => {
  const { t, language } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ACTIONS' | 'NUMBERS'>('ALL');

  const filteredCards = ENCYCLOPEDIA_CARDS.filter(c => {
    if (activeFilter === 'ACTIONS') return c.action !== 'NONE';
    if (activeFilter === 'NUMBERS') return c.action === 'NONE';
    return true;
  });

  return (
    <div className="w-full max-w-4xl mx-auto p-4 pb-28 flex flex-col gap-6">
      {/* Header */}
      <div className="glass-panel p-6 text-center flex flex-col items-center relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500" />
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="text-emerald-400" size={24} />
          <h2 className="text-2xl font-black text-white">{t('rules.title')}</h2>
        </div>
        <p className="text-xs text-slate-400 max-w-md">
          {t('rules.subtitle')}
        </p>
      </div>

      {/* Golden Rules Callout */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 flex flex-col gap-1.5 border-emerald-500/30">
          <span className="font-extrabold text-xs text-emerald-400 flex items-center gap-1.5">
            <Award size={16} />
            <span>{language === 'ar' ? 'هدف اللعبة الأساسي' : 'Core Objective'}</span>
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            {t('rules.core_goal')}
          </p>
        </div>

        <div className="glass-panel p-4 flex flex-col gap-1.5 border-amber-500/30">
          <span className="font-extrabold text-xs text-amber-400 flex items-center gap-1.5">
            <Sparkles size={16} />
            <span>{language === 'ar' ? 'حفظ الكروت المبدئي' : 'Initial Peek'}</span>
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            {t('rules.peek_rules')}
          </p>
        </div>

        <div className="glass-panel p-4 flex flex-col gap-1.5 border-red-500/30">
          <span className="font-extrabold text-xs text-red-400 flex items-center gap-1.5">
            <Flame size={16} />
            <span>{language === 'ar' ? 'عقوبة سكرو الذهبية' : 'Skru Penalty Math'}</span>
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            {t('rules.skru_penalty')}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setActiveFilter('ALL')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeFilter === 'ALL' 
              ? 'bg-emerald-600 text-white shadow' 
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          {language === 'ar' ? 'جميع الكروت' : 'All Cards'}
        </button>

        <button
          onClick={() => setActiveFilter('ACTIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeFilter === 'ACTIONS' 
              ? 'bg-emerald-600 text-white shadow' 
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          {language === 'ar' ? 'كروت الأكشن والقوة' : 'Action Cards'}
        </button>

        <button
          onClick={() => setActiveFilter('NUMBERS')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
            activeFilter === 'NUMBERS' 
              ? 'bg-emerald-600 text-white shadow' 
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          {language === 'ar' ? 'الأرقام والغرامات' : 'Numbers & Penalties'}
        </button>
      </div>

      {/* Interactive Visual Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCards.map((item, idx) => (
          <div 
            key={idx}
            className="glass-panel p-4 flex items-center gap-4 hover:border-emerald-500/40 transition-all"
          >
            <div className="flex-shrink-0">
              <CardView
                id={`encyclopedia_${idx}`}
                value={item.value}
                action={item.action}
                labelAr={item.labelAr}
                labelEn={item.labelEn}
                color={item.color}
                isFaceUp={true}
                canInteract={false}
                lang={language}
              />
            </div>
            <div className="flex flex-col gap-1">
              <h4 className="font-black text-sm text-white flex items-center gap-2">
                <span>{language === 'ar' ? item.labelAr : item.labelEn}</span>
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {language === 'ar' ? item.descAr : item.descEn}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
