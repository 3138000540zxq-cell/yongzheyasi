import type { SaveData } from '../types/game';

const STORAGE_KEY = 'ielts-quest-save-v1';

export const DEFAULT_SAVE: SaveData = {
  level: 1,
  exp: 0,
  gold: 0,
  defeatedMonsterIds: []
};

export function loadSave(): SaveData {
  const rawSave = window.localStorage.getItem(STORAGE_KEY);

  if (!rawSave) {
    return { ...DEFAULT_SAVE };
  }

  try {
    const parsed = JSON.parse(rawSave) as Partial<SaveData>;

    return {
      level: sanitizePositiveInteger(parsed.level, DEFAULT_SAVE.level),
      exp: sanitizeNonNegativeInteger(parsed.exp, DEFAULT_SAVE.exp),
      gold: sanitizeNonNegativeInteger(parsed.gold, DEFAULT_SAVE.gold),
      defeatedMonsterIds: Array.from(
        new Set(
          Array.isArray(parsed.defeatedMonsterIds)
            ? parsed.defeatedMonsterIds.filter((id): id is string => typeof id === 'string')
            : []
        )
      )
    };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function saveGame(saveData: SaveData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
}

export function markMonsterDefeated(saveData: SaveData, monsterId: string): SaveData {
  if (saveData.defeatedMonsterIds.includes(monsterId)) {
    return saveData;
  }

  return {
    ...saveData,
    defeatedMonsterIds: [...saveData.defeatedMonsterIds, monsterId]
  };
}

function sanitizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function sanitizeNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback;
}
