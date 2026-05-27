import Phaser from 'phaser';
import {
  BATTLE_ACTIONS,
  MAX_BATTLE_MP,
  calculateBasicAttackMpGain,
  calculateCorrectAnswerDamage,
  calculateMonsterAttackDamage,
  getRandomQuestion
} from '../systems/battleSystem';
import { applyRewards, buildPlayerStats } from '../systems/progression';
import { loadSave, markMonsterDefeated, saveGame } from '../systems/saveSystem';
import type {
  BattleActionDefinition,
  BattleResult,
  MonsterDefinition,
  PlayerStats,
  Question
} from '../types/game';

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
  private playerMp = 0;
  private monsterHp = 0;
  private askedQuestionIds = new Set<string>();
  private currentQuestion?: Question;
  private selectedAction?: BattleActionDefinition;
  private currentRoundQuestions: Question[] = [];
  private currentQuestionIndex = 0;
  private roundCorrectCount = 0;
  private pendingDamage = 0;
  private awaitingAction = false;
  private awaitingAnswer = false;
  private finished = false;

  private titleText?: Phaser.GameObjects.Text;
  private statsText?: Phaser.GameObjects.Text;
  private questionText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private actionButtons: OptionButton[] = [];
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
    this.playerMp = 0;
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
      fontSize: '16px',
      color: '#f6f4d2',
      wordWrap: { width: 840 }
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

    this.createActionButtons();
    this.createOptionButtons();
    this.showActionSelection();

    this.input.keyboard?.on('keydown', this.handleKeyboardAnswer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleKeyboardAnswer, this);
    });
  }

  private createActionButtons(): void {
    BATTLE_ACTIONS.forEach((_, index) => {
      const y = 248 + index * 64;
      const background = this.add
        .rectangle(480, y, 840, 50, 0x243b4a)
        .setStrokeStyle(2, 0x4d908e)
        .setInteractive({ useHandCursor: true });

      const label = this.add.text(86, y - 15, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        wordWrap: { width: 780 }
      });

      background.on('pointerdown', () => this.chooseBattleAction(index));
      label.setInteractive({ useHandCursor: true });
      label.on('pointerdown', () => this.chooseBattleAction(index));

      this.actionButtons.push({ background, label });
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

  private showActionSelection(): void {
    if (this.finished) {
      return;
    }

    this.awaitingAction = true;
    this.awaitingAnswer = false;
    this.selectedAction = undefined;
    this.currentQuestion = undefined;
    this.currentRoundQuestions = [];
    this.currentQuestionIndex = 0;
    this.roundCorrectCount = 0;
    this.pendingDamage = 0;

    this.questionText?.setText('Choose your attack.');
    this.feedbackText?.setText(
      'Basic Attack builds MP. Skills spend MP and settle damage after all answers.'
    );
    this.updateStatsText();
    this.renderActionButtons();
    this.setButtonsVisible(this.actionButtons, true);
    this.setButtonsVisible(this.optionButtons, false);
  }

  private renderActionButtons(): void {
    BATTLE_ACTIONS.forEach((action, index) => {
      const button = this.actionButtons[index];
      const unavailableReason = this.getBattleActionUnavailableReason(action);
      const isUnavailable = unavailableReason.length > 0;
      const statusText = isUnavailable ? unavailableReason : action.description;

      button.background.setFillStyle(isUnavailable ? 0x2b3138 : 0x243b4a);
      button.background.setStrokeStyle(2, isUnavailable ? 0x53606a : 0x4d908e);
      button.label.setColor(isUnavailable ? '#9aa7b1' : '#ffffff');
      button.label.setText(
        `${index + 1}. ${action.name} | ${action.questionCount} questions | Cost ${action.mpCost} MP | ${statusText}`
      );
    });
  }

  private chooseBattleAction(actionIndex: number): void {
    if (!this.awaitingAction || this.finished) {
      return;
    }

    const action = BATTLE_ACTIONS[actionIndex];

    if (!action) {
      return;
    }

    const unavailableReason = this.getBattleActionUnavailableReason(action);

    if (unavailableReason) {
      this.feedbackText?.setText(unavailableReason);
      return;
    }

    this.awaitingAction = false;
    this.startRound(action);
  }

  private getBattleActionUnavailableReason(action: BattleActionDefinition): string {
    if (this.playerStats.level < action.unlockLevel) {
      return `Unlocks at level ${action.unlockLevel}`;
    }

    if (this.playerMp < action.mpCost) {
      return `Need ${action.mpCost} MP`;
    }

    return '';
  }

  private startRound(action: BattleActionDefinition): void {
    this.selectedAction = action;
    this.playerMp = Math.max(0, this.playerMp - action.mpCost);
    this.currentRoundQuestions = Array.from({ length: action.questionCount }, () =>
      getRandomQuestion(this.askedQuestionIds)
    );
    this.currentQuestionIndex = 0;
    this.roundCorrectCount = 0;
    this.pendingDamage = 0;

    this.updateStatsText();
    this.setButtonsVisible(this.actionButtons, false);
    this.showCurrentRoundQuestion();
  }

  private showCurrentRoundQuestion(): void {
    if (!this.selectedAction) {
      this.showActionSelection();
      return;
    }

    const question = this.currentRoundQuestions[this.currentQuestionIndex];

    if (!question) {
      this.settleRound();
      return;
    }

    this.currentQuestion = question;
    this.awaitingAnswer = true;
    this.feedbackText?.setText(
      `${this.selectedAction.name}: answer ${this.currentQuestionIndex + 1}/${this.selectedAction.questionCount}.`
    );
    this.updateStatsText();

    this.questionText?.setText(question.prompt);

    question.options.forEach((option, index) => {
      const button = this.optionButtons[index];

      button.background.setFillStyle(0x243b4a);
      button.background.setStrokeStyle(2, 0x4d908e);
      button.label.setColor('#ffffff');
      button.label.setText(`${index + 1}. ${option}`);
    });

    this.setButtonsVisible(this.optionButtons, true);
  }

  private answerQuestion(optionIndex: number): void {
    if (!this.awaitingAnswer || !this.currentQuestion || !this.selectedAction || this.finished) {
      return;
    }

    this.awaitingAnswer = false;
    const isCorrect = optionIndex === this.currentQuestion.answerIndex;
    this.highlightAnswer(optionIndex);

    if (isCorrect) {
      const damage = calculateCorrectAnswerDamage(
        this.playerStats,
        this.currentQuestion.skill,
        this.selectedAction.damageMultiplier
      );

      this.roundCorrectCount += 1;
      this.pendingDamage += damage;
      this.feedbackText?.setText(
        `Correct. ${this.currentQuestion.explanation} ${damage} damage is ready.`
      );
    } else {
      this.feedbackText?.setText(
        `Wrong. ${this.currentQuestion.explanation} This question adds 0 damage.`
      );
    }

    this.time.delayedCall(1050, () => {
      if (this.finished) {
        return;
      }

      this.currentQuestionIndex += 1;
      this.showCurrentRoundQuestion();
    });
  }

  private settleRound(): void {
    if (!this.selectedAction) {
      this.showActionSelection();
      return;
    }

    const action = this.selectedAction;
    const damage = this.pendingDamage;
    const mpGain =
      action.key === 'basic'
        ? calculateBasicAttackMpGain(this.roundCorrectCount, action.questionCount)
        : 0;

    this.awaitingAnswer = false;
    this.currentQuestion = undefined;
    this.setButtonsVisible(this.optionButtons, false);

    this.monsterHp = Math.max(0, this.monsterHp - damage);
    this.playerMp = Math.min(MAX_BATTLE_MP, this.playerMp + mpGain);
    this.updateStatsText();

    if (this.monsterHp === 0) {
      const defeatedSave = markMonsterDefeated(loadSave(), this.monster.id);
      const rewardResult = applyRewards(
        defeatedSave,
        this.monster.rewardExp,
        this.monster.rewardGold
      );

      saveGame(rewardResult.saveData);
      this.finished = true;
      this.feedbackText?.setText(
        `${action.name} complete: ${this.roundCorrectCount}/${action.questionCount} correct, ${damage} damage. ${this.monster.name} is defeated.`
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

    const mpText = mpGain > 0 ? ` Gained ${mpGain} MP.` : '';
    const monsterDamage = calculateMonsterAttackDamage(this.monster, this.playerStats);

    this.playerHp = Math.max(0, this.playerHp - monsterDamage);
    this.updateStatsText();

    if (this.playerHp === 0) {
      this.finished = true;
      this.feedbackText?.setText(
        `${action.name} complete: ${this.roundCorrectCount}/${action.questionCount} correct, ${damage} damage.${mpText} ${this.monster.name} strikes back for ${monsterDamage} damage. You retreat.`
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
      `${action.name} complete: ${this.roundCorrectCount}/${action.questionCount} correct, ${damage} damage.${mpText} ${this.monster.name} strikes back for ${monsterDamage} damage.`
    );
    this.time.delayedCall(1450, () => this.showActionSelection());
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

  private setButtonsVisible(buttons: OptionButton[], visible: boolean): void {
    buttons.forEach((button) => {
      button.background.setVisible(visible);
      button.label.setVisible(visible);

      if (visible) {
        button.background.setInteractive({ useHandCursor: true });
        button.label.setInteractive({ useHandCursor: true });
        return;
      }

      button.background.disableInteractive();
      button.label.disableInteractive();
    });
  }

  private updateStatsText(): void {
    this.statsText?.setText(
      `Hero HP ${this.playerHp}/${this.playerStats.maxHp}  |  MP ${this.playerMp}/${MAX_BATTLE_MP}  |  ${this.monster.name} HP ${this.monsterHp}/${this.monster.maxHp}  |  Skill: VOC ${this.playerStats.vocabulary} GRAM ${this.playerStats.grammar} READ ${this.playerStats.reading}`
    );
  }

  private handleKeyboardAnswer(event: KeyboardEvent): void {
    if (!['1', '2', '3', '4'].includes(event.key)) {
      return;
    }

    const selectedIndex = Number(event.key) - 1;

    if (this.awaitingAction) {
      this.chooseBattleAction(selectedIndex);
      return;
    }

    this.answerQuestion(selectedIndex);
  }

  private finishBattle(result: BattleResult): void {
    this.time.delayedCall(1500, () => {
      this.scene.resume('GameScene');
      this.game.events.emit('battle-complete', result);
      this.scene.stop();
    });
  }
}
