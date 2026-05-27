import Phaser from 'phaser';
import {
  calculateCorrectAnswerDamage,
  calculateWrongAnswerDamage,
  getRandomQuestion
} from '../systems/battleSystem';
import { applyRewards, buildPlayerStats } from '../systems/progression';
import { loadSave, markMonsterDefeated, saveGame } from '../systems/saveSystem';
import type { BattleResult, MonsterDefinition, PlayerStats, Question } from '../types/game';

interface BattleSceneData {
  monster: MonsterDefinition;
}

interface OptionButton {
  background: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class BattleScene extends Phaser.Scene {
  private monster!: MonsterDefinition;
  private playerStats!: PlayerStats;
  private playerHp = 0;
  private monsterHp = 0;
  private askedQuestionIds = new Set<string>();
  private currentQuestion?: Question;
  private awaitingAnswer = false;
  private finished = false;

  private titleText?: Phaser.GameObjects.Text;
  private statsText?: Phaser.GameObjects.Text;
  private questionText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private optionButtons: OptionButton[] = [];

  constructor() {
    super('BattleScene');
  }

  init(data: BattleSceneData): void {
    this.monster = data.monster;
  }

  create(): void {
    const saveData = loadSave();

    this.playerStats = buildPlayerStats(saveData);
    this.playerHp = this.playerStats.maxHp;
    this.monsterHp = this.monster.maxHp;

    this.add.rectangle(0, 0, 960, 640, 0x101923).setOrigin(0);
    this.add.rectangle(480, 320, 880, 560, 0x162536).setStrokeStyle(3, 0xf6bd60);

    this.titleText = this.add.text(60, 50, `Battle: ${this.monster.name}`, {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      color: '#ffffff'
    });

    this.statsText = this.add.text(60, 94, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '17px',
      color: '#f6f4d2'
    });

    this.questionText = this.add.text(60, 152, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '24px',
      color: '#ffffff',
      wordWrap: { width: 840 },
      lineSpacing: 6
    });

    this.feedbackText = this.add.text(60, 545, '', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#f6f4d2',
      wordWrap: { width: 840 }
    });

    this.createOptionButtons();
    this.showNextQuestion();

    this.input.keyboard?.on('keydown', this.handleKeyboardAnswer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyboardAnswer, this);
    });
  }

  private createOptionButtons(): void {
    for (let index = 0; index < 4; index += 1) {
      const y = 268 + index * 64;
      const background = this.add
        .rectangle(480, y, 840, 48, 0x243b4a)
        .setStrokeStyle(2, 0x4d908e)
        .setInteractive({ useHandCursor: true });

      const label = this.add.text(86, y - 15, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        wordWrap: { width: 780 }
      });

      background.on('pointerdown', () => this.answerQuestion(index));
      label.setInteractive({ useHandCursor: true });
      label.on('pointerdown', () => this.answerQuestion(index));

      this.optionButtons.push({ background, label });
    }
  }

  private showNextQuestion(): void {
    this.currentQuestion = getRandomQuestion(this.askedQuestionIds);
    this.awaitingAnswer = true;
    this.feedbackText?.setText('Choose the best answer.');
    this.updateStatsText();

    this.questionText?.setText(this.currentQuestion.prompt);

    this.currentQuestion.options.forEach((option, index) => {
      const button = this.optionButtons[index];

      button.background.setFillStyle(0x243b4a);
      button.background.setStrokeStyle(2, 0x4d908e);
      button.label.setColor('#ffffff');
      button.label.setText(`${index + 1}. ${option}`);
      button.background.setVisible(true);
      button.label.setVisible(true);
    });
  }

  private answerQuestion(optionIndex: number): void {
    if (!this.awaitingAnswer || !this.currentQuestion || this.finished) {
      return;
    }

    this.awaitingAnswer = false;
    const isCorrect = optionIndex === this.currentQuestion.answerIndex;
    this.highlightAnswer(optionIndex);

    if (isCorrect) {
      this.resolveCorrectAnswer();
      return;
    }

    this.resolveWrongAnswer();
  }

  private resolveCorrectAnswer(): void {
    if (!this.currentQuestion) {
      return;
    }

    const damage = calculateCorrectAnswerDamage(this.playerStats, this.currentQuestion.skill);
    this.monsterHp = Math.max(0, this.monsterHp - damage);

    if (this.monsterHp === 0) {
      const defeatedSave = markMonsterDefeated(loadSave(), this.monster.id);
      const rewardResult = applyRewards(
        defeatedSave,
        this.monster.rewardExp,
        this.monster.rewardGold
      );

      saveGame(rewardResult.saveData);
      this.finished = true;
      this.updateStatsText();
      this.feedbackText?.setText(
        `Correct. ${this.currentQuestion.explanation} ${this.monster.name} takes ${damage} damage and is defeated.`
      );

      this.finishBattle({
        monsterId: this.monster.id,
        monsterName: this.monster.name,
        monsterDefeated: true,
        playerFainted: false,
        rewardExp: this.monster.rewardExp,
        rewardGold: this.monster.rewardGold,
        levelsGained: rewardResult.levelsGained
      });
      return;
    }

    this.updateStatsText();
    this.feedbackText?.setText(
      `Correct. ${this.currentQuestion.explanation} ${this.monster.name} takes ${damage} damage.`
    );
    this.time.delayedCall(1100, () => this.showNextQuestion());
  }

  private resolveWrongAnswer(): void {
    if (!this.currentQuestion) {
      return;
    }

    const damage = calculateWrongAnswerDamage(this.monster, this.playerStats);
    this.playerHp = Math.max(0, this.playerHp - damage);
    this.updateStatsText();

    if (this.playerHp === 0) {
      this.finished = true;
      this.feedbackText?.setText(
        `Wrong. ${this.currentQuestion.explanation} You lose ${damage} HP and retreat.`
      );

      this.finishBattle({
        monsterId: this.monster.id,
        monsterName: this.monster.name,
        monsterDefeated: false,
        playerFainted: true
      });
      return;
    }

    this.feedbackText?.setText(
      `Wrong. ${this.currentQuestion.explanation} You lose ${damage} HP.`
    );
    this.time.delayedCall(1100, () => this.showNextQuestion());
  }

  private highlightAnswer(selectedIndex: number): void {
    if (!this.currentQuestion) {
      return;
    }

    this.optionButtons.forEach((button, index) => {
      if (index === this.currentQuestion?.answerIndex) {
        button.background.setFillStyle(0x2d6a4f);
        button.background.setStrokeStyle(2, 0x95d5b2);
        return;
      }

      if (index === selectedIndex) {
        button.background.setFillStyle(0x8a2d3b);
        button.background.setStrokeStyle(2, 0xff9b9b);
      }
    });
  }

  private updateStatsText(): void {
    this.statsText?.setText(
      `Hero HP ${this.playerHp}/${this.playerStats.maxHp}  |  ${this.monster.name} HP ${this.monsterHp}/${this.monster.maxHp}  |  Skill: VOC ${this.playerStats.vocabulary} GRAM ${this.playerStats.grammar} READ ${this.playerStats.reading}`
    );
  }

  private handleKeyboardAnswer(event: KeyboardEvent): void {
    if (!['1', '2', '3', '4'].includes(event.key)) {
      return;
    }

    this.answerQuestion(Number(event.key) - 1);
  }

  private finishBattle(result: BattleResult): void {
    this.time.delayedCall(1500, () => {
      this.scene.resume('GameScene');
      this.game.events.emit('battle-complete', result);
      this.scene.stop();
    });
  }
}
