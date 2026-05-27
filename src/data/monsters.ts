import type { MonsterDefinition } from '../types/game';

export const MONSTERS: MonsterDefinition[] = [
  {
    id: 'word-imp',
    name: 'Vocabulary Imp',
    x: 680,
    y: 150,
    maxHp: 42,
    rewardExp: 30,
    rewardGold: 12,
    color: 0xef6f6c
  },
  {
    id: 'grammar-golem',
    name: 'Grammar Golem',
    x: 480,
    y: 470,
    maxHp: 58,
    rewardExp: 42,
    rewardGold: 18,
    color: 0xf6bd60
  },
  {
    id: 'reading-wraith',
    name: 'Reading Wraith',
    x: 820,
    y: 420,
    maxHp: 72,
    rewardExp: 55,
    rewardGold: 25,
    color: 0x9b5de5
  }
];
