export type SkillKey = 'vocabulary' | 'grammar' | 'reading';
export type BattleActionKey = 'basic' | 'skill' | 'heavy' | 'ultimate';

export interface Question {
  id: string;
  skill: SkillKey;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface MonsterDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  maxHp: number;
  rewardExp: number;
  rewardGold: number;
  color: number;
}

export interface BattleActionDefinition {
  key: BattleActionKey;
  name: string;
  questionCount: number;
  mpCost: number;
  unlockLevel: number;
  damageMultiplier: number;
  description: string;
}

export interface SaveData {
  level: number;
  exp: number;
  gold: number;
  defeatedMonsterIds: string[];
}

export interface PlayerStats {
  level: number;
  exp: number;
  expToNextLevel: number;
  gold: number;
  hp: number;
  maxHp: number;
  attack: number;
  vocabulary: number;
  grammar: number;
  reading: number;
}

export interface BattleResult {
  monsterId: string;
  monsterName: string;
  monsterDefeated: boolean;
  playerFainted: boolean;
  rewardExp?: number;
  rewardGold?: number;
  levelsGained?: number;
}
