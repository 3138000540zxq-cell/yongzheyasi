import Phaser from 'phaser';
import questionsJson from '../data/questions.json';
import type { MonsterDefinition, PlayerStats, Question, SkillKey } from '../types/game';

const QUESTIONS = questionsJson as Question[];

export function getRandomQuestion(askedQuestionIds: Set<string>): Question {
  const unansweredQuestions = QUESTIONS.filter((question) => !askedQuestionIds.has(question.id));
  const pool = unansweredQuestions.length > 0 ? unansweredQuestions : QUESTIONS;
  const selectedQuestion = Phaser.Math.RND.pick(pool);

  askedQuestionIds.add(selectedQuestion.id);
  return selectedQuestion;
}

export function calculateCorrectAnswerDamage(playerStats: PlayerStats, skill: SkillKey): number {
  return playerStats.attack + Math.floor(playerStats[skill] * 1.5);
}

export function calculateWrongAnswerDamage(
  monster: MonsterDefinition,
  playerStats: PlayerStats
): number {
  return Math.max(10, Math.floor(monster.maxHp * 0.16) + playerStats.level * 2);
}
