import { Card, CardAction, GameVariant } from '../models/types.js';

let cardIdCounter = 1;
function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}_${cardIdCounter++}`;
}

export function createDeck(variant: GameVariant): Card[] {
  const cards: Card[] = [];

  if (variant === 'FRENCH_DECK') {
    // 52-card standard French deck mapping
    // Red Kings (-1)
    cards.push(
      { id: genId('k_red'), value: -1, action: 'NONE', labelAr: 'شايب أحمر', labelEn: 'Red King', color: 'crimson', isFaceUp: false },
      { id: genId('k_red'), value: -1, action: 'NONE', labelAr: 'شايب أحمر', labelEn: 'Red King', color: 'crimson', isFaceUp: false }
    );
    // Black Kings (13)
    cards.push(
      { id: genId('k_blk'), value: 13, action: 'NONE', labelAr: 'شايب أسود', labelEn: 'Black King', color: 'indigo', isFaceUp: false },
      { id: genId('k_blk'), value: 13, action: 'NONE', labelAr: 'شايب أسود', labelEn: 'Black King', color: 'indigo', isFaceUp: false }
    );
    // Aces (1)
    for (let i = 0; i < 4; i++) {
      cards.push({ id: genId('ace'), value: 1, action: 'NONE', labelAr: 'إيس (1)', labelEn: 'Ace (1)', color: 'gold', isFaceUp: false });
    }
    // 2 to 6
    for (let val = 2; val <= 6; val++) {
      for (let i = 0; i < 4; i++) {
        cards.push({ id: genId(`num_${val}`), value: val, action: 'NONE', labelAr: `${val}`, labelEn: `${val}`, color: 'emerald', isFaceUp: false });
      }
    }
    // 7 & 8: Peek Own (خد فكرة)
    for (let val of [7, 8]) {
      for (let i = 0; i < 4; i++) {
        cards.push({ id: genId(`peek_own_${val}`), value: val, action: 'PEEK_OWN', labelAr: `${val} - خد فكرة`, labelEn: `${val} - Peek Own`, color: 'purple', isFaceUp: false });
      }
    }
    // 9 & 10: Peek Other (بصرة)
    for (let val of [9, 10]) {
      for (let i = 0; i < 4; i++) {
        cards.push({ id: genId(`peek_other_${val}`), value: val, action: 'PEEK_OTHER', labelAr: `${val} - بصرة`, labelEn: `${val} - Peek Other`, color: 'amber', isFaceUp: false });
      }
    }
    // Jacks (11): Swap (هات وخد)
    for (let i = 0; i < 4; i++) {
      cards.push({ id: genId('jack'), value: 11, action: 'SWAP', labelAr: 'ولد (11) - هات وخد', labelEn: 'Jack (11) - Swap', color: 'crimson', isFaceUp: false });
    }
    // Queens (12): Peek & Swap (خد وهات بصرة)
    for (let i = 0; i < 4; i++) {
      cards.push({ id: genId('queen'), value: 12, action: 'PEEK_AND_SWAP', labelAr: 'بنت (12) - خد وهات بصرة', labelEn: 'Queen (12) - Peek & Swap', color: 'indigo', isFaceUp: false });
    }
    return shuffle(cards);
  }

  // Classic Egyptian 68-Card Deck & Saheb Sa7bo & Deluxe
  // -1 Cards: 4
  for (let i = 0; i < 4; i++) {
    cards.push({ id: genId('neg_1'), value: -1, action: 'NONE', labelAr: '-1 سكرو', labelEn: '-1 Skru', color: 'crimson', isFaceUp: false });
  }

  // 0 Cards: 4
  for (let i = 0; i < 4; i++) {
    cards.push({ id: genId('zero'), value: 0, action: 'NONE', labelAr: '0 صفر', labelEn: '0 Zero', color: 'gold', isFaceUp: false });
  }

  // 1 through 6: 4 each (24 cards)
  for (let val = 1; val <= 6; val++) {
    for (let i = 0; i < 4; i++) {
      cards.push({ id: genId(`num_${val}`), value: val, action: 'NONE', labelAr: `${val}`, labelEn: `${val}`, color: 'emerald', isFaceUp: false });
    }
  }

  // 7 & 8: Peek Own (خد فكرة) - 8 cards
  for (let val of [7, 8]) {
    for (let i = 0; i < 4; i++) {
      cards.push({ id: genId(`peek_own_${val}`), value: val, action: 'PEEK_OWN', labelAr: `${val} (خد فكرة)`, labelEn: `${val} (Peek Own)`, color: 'purple', isFaceUp: false });
    }
  }

  // 9 & 10: Peek Other (بصرة) - 8 cards
  for (let val of [9, 10]) {
    for (let i = 0; i < 4; i++) {
      cards.push({ id: genId(`peek_other_${val}`), value: val, action: 'PEEK_OTHER', labelAr: `${val} (بصرة)`, labelEn: `${val} (Peek Other)`, color: 'amber', isFaceUp: false });
    }
  }

  // Action Cards:
  // Swap (هات وخد / خد وهات): 6 cards (11 pts)
  for (let i = 0; i < 6; i++) {
    cards.push({ id: genId('swap'), value: 11, action: 'SWAP', labelAr: 'هات وخد', labelEn: 'Swap', color: 'indigo', isFaceUp: false });
  }

  // Peek & Swap (خد وهات بصرة): 4 cards (12 pts)
  for (let i = 0; i < 4; i++) {
    cards.push({ id: genId('peek_swap'), value: 12, action: 'PEEK_AND_SWAP', labelAr: 'خد وهات بصرة', labelEn: 'Peek & Swap', color: 'purple', isFaceUp: false });
  }

  // Peek All (كعب داير): 4 cards (12 pts)
  for (let i = 0; i < 4; i++) {
    cards.push({ id: genId('peek_all'), value: 12, action: 'PEEK_ALL', labelAr: 'كعب داير', labelEn: 'Peek All', color: 'gold', isFaceUp: false });
  }

  // High Penalty Cards (+20): 6 cards
  for (let i = 0; i < 6; i++) {
    cards.push({ id: genId('penalty_20'), value: 20, action: 'NONE', labelAr: '+20 غرامة', labelEn: '+20 Penalty', color: 'crimson', isFaceUp: false });
  }

  if (variant === 'DELUXE') {
    // Add Deluxe action cards:
    // Freeze: 2 cards (10 pts)
    cards.push(
      { id: genId('freeze'), value: 10, action: 'FREEZE', labelAr: 'تجميد دور', labelEn: 'Freeze Turn', color: 'indigo', isFaceUp: false },
      { id: genId('freeze'), value: 10, action: 'FREEZE', labelAr: 'تجميد دور', labelEn: 'Freeze Turn', color: 'indigo', isFaceUp: false }
    );
    // Bomb: 2 cards (+25 pts)
    cards.push(
      { id: genId('bomb'), value: 25, action: 'BOMB', labelAr: 'قنبلة +25', labelEn: 'Bomb +25', color: 'crimson', isFaceUp: false },
      { id: genId('bomb'), value: 25, action: 'BOMB', labelAr: 'قنبلة +25', labelEn: 'Bomb +25', color: 'crimson', isFaceUp: false }
    );
    // Wild: 2 cards (0 pts)
    cards.push(
      { id: genId('wild'), value: 0, action: 'WILD', labelAr: 'على كيفك (جوكر)', labelEn: 'Wild Joker', color: 'gold', isFaceUp: false },
      { id: genId('wild'), value: 0, action: 'WILD', labelAr: 'على كيفك (جوكر)', labelEn: 'Wild Joker', color: 'gold', isFaceUp: false }
    );
  }

  return shuffle(cards);
}

export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
