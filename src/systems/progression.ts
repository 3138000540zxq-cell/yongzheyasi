import type { PlayerStats, SaveData } from '../types/game';

export function getExpToNextLevel(level: number): number {
  return 60 + (level - 1) * 35;
}

export function buildPlayerStats(saveData: SaveData): PlayerStats {
  const levelBonus = saveData.level - 1;

  return {
    level: saveData.level,
    exp: saveData.exp,
    expToNextLevel: getExpToNextLevel(saveData.level),
    gold: saveData.gold,
    hp: 100 + levelBonus * 18,
    maxHp: 100 + levelBonus * 18,
    attack: 12 + levelBonus * 4,
    vocabulary: 8 + levelBonus * 3,
    grammar: 8 + levelBonus * 3,
    reading: 8 + levelBonus * 3
  };
}

export function applyRewards(
  saveData: SaveData,
  rewardExp: number,
  rewardGold: number
): { saveData: SaveData; levelsGained: number } {
  let nextLevel = saveData.level;
  let nextExp = saveData.exp + rewardExp;
  let levelsGained = 0;

  while (nextExp >= getExpToNextLevel(nextLevel)) {
    nextExp -= getExpToNextLevel(nextLevel);
    nextLevel += 1;
    levelsGained += 1;
  }

  return {
    saveData: {
      ...saveData,
      level: nextLevel,
      exp: nextExp,
      gold: saveData.gold + rewardGold
    },
    levelsGained
  };
}
