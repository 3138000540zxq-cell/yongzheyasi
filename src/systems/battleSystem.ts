import Phaser from 'phaser';
import questionsJson from '../data/questions.json';
import type {
  BattleActionDefinition,
  MonsterDefinition,
  PlayerStats,
  Question,
  SkillKey
} from '../types/game';

const QUESTIONS = questionsJson as Question[];
export const MAX_BATTLE_MP = 100;

export const BATTLE_ACTIONS: BattleActionDefinition[] = [
  {
    key: 'basic',
    name: 'Basic Attack',
    questionCount: 2,
    mpCost: 0,
    unlockLevel: 1,
    damageMultiplier: 1,
    description: 'Gain MP from correct answers'
  },
  {
    key: 'skill',
    name: 'Skill Strike',
    questionCount: 4,
    mpCost: 30,
    unlockLevel: 1,
    damageMultiplier: 1.2,
    description: 'Medium attack'
  },
  {
    key: 'heavy',
    name: 'Focus Burst',
    questionCount: 6,
    mpCost: 60,
    unlockLevel: 3,
    damageMultiplier: 1.4,
    description: 'Unlocked at level 3'
  },
  {
    key: 'ultimate',
    name: 'Ultimate',
    questionCount: 8,
    mpCost: 100,
    unlockLevel: 5,
    damageMultiplier: 1.6,
    description: 'Unlocked at level 5'
  }
];

export function getRandomQuestion(askedQuestionIds: Set<string>): Question {
  const unansweredQuestions = QUESTIONS.filter((question) => !askedQuestionIds.has(question.id));
  const pool = unansweredQuestions.length > 0 ? unansweredQuestions : QUESTIONS;
  const selectedQuestion = Phaser.Math.RND.pick(pool);

  askedQuestionIds.add(selectedQuestion.id);
  return selectedQuestion;
}

export function calculateCorrectAnswerDamage(
  playerStats: PlayerStats,
  skill: SkillKey,
  damageMultiplier: number
): number {
  const baseDamage = (playerStats.attack + playerStats[skill]) * 0.4;

  return Math.max(1, Math.floor(baseDamage * damageMultiplier));
}

export function calculateBasicAttackMpGain(correctAnswers: number, questionCount: number): number {
  if (correctAnswers <= 0) {
    return 0;
  }

  return correctAnswers === questionCount ? 25 : correctAnswers * 10;
}

export function calculateMonsterAttackDamage(
  monster: MonsterDefinition,
  playerStats: PlayerStats
): number {
  return Math.max(10, Math.floor(monster.maxHp * 0.16) + playerStats.level * 2);
}
