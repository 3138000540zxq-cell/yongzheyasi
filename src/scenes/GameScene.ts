import Phaser from 'phaser';
import { MONSTERS } from '../data/monsters';
import { buildPlayerStats } from '../systems/progression';
import { loadSave } from '../systems/saveSystem';
import type { BattleResult, MonsterDefinition } from '../types/game';

const PLAYER_SPEED = 170;
const PLAYER_START = { x: 120, y: 120 };
type ArcadeOverlapObject =
  | Phaser.Types.Physics.Arcade.GameObjectWithBody
  | Phaser.Physics.Arcade.Body
  | Phaser.Physics.Arcade.StaticBody
  | Phaser.Tilemaps.Tile;

export class GameScene extends Phaser.Scene {
  private player?: Phaser.Physics.Arcade.Sprite;
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private monsters?: Phaser.Physics.Arcade.StaticGroup;
  private uiText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private isBattling = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.createPlaceholderTextures();
    this.physics.world.setBounds(0, 0, 960, 640);
    this.drawMap();

    this.player = this.physics.add
      .sprite(PLAYER_START.x, PLAYER_START.y, 'player')
      .setCollideWorldBounds(true);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setSize(28, 28);

    this.cursors = this.input.keyboard?.createCursorKeys();
    this.wasd = this.input.keyboard?.addKeys('W,A,S,D') as Record<
      'W' | 'A' | 'S' | 'D',
      Phaser.Input.Keyboard.Key
    >;

    this.monsters = this.physics.add.staticGroup();
    this.spawnMonsters();

    this.physics.add.overlap(
      this.player,
      this.monsters,
      this.handleMonsterOverlap,
      undefined,
      this
    );

    this.uiText = this.add
      .text(16, 14, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#f6f4d2',
        lineSpacing: 4
      })
      .setDepth(20);

    this.statusText = this.add
      .text(16, 582, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#102536',
        padding: { x: 10, y: 6 }
      })
      .setDepth(20);

    this.refreshUi();
    this.setStatusFromSave();

    this.game.events.on('battle-complete', this.handleBattleComplete, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('battle-complete', this.handleBattleComplete, this);
    });
  }

  update(): void {
    if (!this.player) {
      return;
    }

    if (this.isBattling) {
      this.player.setVelocity(0);
      return;
    }

    const moveLeft = Boolean(this.cursors?.left.isDown || this.wasd?.A.isDown);
    const moveRight = Boolean(this.cursors?.right.isDown || this.wasd?.D.isDown);
    const moveUp = Boolean(this.cursors?.up.isDown || this.wasd?.W.isDown);
    const moveDown = Boolean(this.cursors?.down.isDown || this.wasd?.S.isDown);

    const velocityX = Number(moveRight) - Number(moveLeft);
    const velocityY = Number(moveDown) - Number(moveUp);

    if (velocityX === 0 && velocityY === 0) {
      this.player.setVelocity(0);
      return;
    }

    this.player.setVelocity(velocityX, velocityY);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.velocity.normalize().scale(PLAYER_SPEED);
  }

  private createPlaceholderTextures(): void {
    const graphics = this.add.graphics();

    if (!this.textures.exists('player')) {
      graphics.fillStyle(0x43aa8b);
      graphics.fillRect(0, 0, 32, 32);
      graphics.lineStyle(3, 0xf6f4d2);
      graphics.strokeRect(1, 1, 30, 30);
      graphics.generateTexture('player', 32, 32);
      graphics.clear();
    }

    for (const monster of MONSTERS) {
      const textureKey = `monster-${monster.id}`;

      if (!this.textures.exists(textureKey)) {
        graphics.fillStyle(monster.color);
        graphics.fillRect(0, 0, 34, 34);
        graphics.lineStyle(3, 0x1d1d1d);
        graphics.strokeRect(1, 1, 32, 32);
        graphics.generateTexture(textureKey, 34, 34);
        graphics.clear();
      }
    }

    graphics.destroy();
  }

  private drawMap(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x24593b);
    graphics.fillRect(0, 0, 960, 640);

    graphics.fillStyle(0x2f6f49);
    graphics.fillRect(70, 70, 340, 180);
    graphics.fillRect(570, 310, 250, 200);

    graphics.fillStyle(0x2f4858);
    graphics.fillRect(0, 258, 960, 42);
    graphics.fillRect(410, 0, 42, 640);

    graphics.fillStyle(0x4d908e);
    graphics.fillRect(50, 500, 220, 80);

    graphics.lineStyle(1, 0x89b77f, 0.25);
    for (let x = 0; x <= 960; x += 32) {
      graphics.lineBetween(x, 0, x, 640);
    }
    for (let y = 0; y <= 640; y += 32) {
      graphics.lineBetween(0, y, 960, y);
    }
  }

  private spawnMonsters(): void {
    const saveData = loadSave();
    const defeatedMonsterIds = new Set(saveData.defeatedMonsterIds);

    for (const monster of MONSTERS) {
      if (defeatedMonsterIds.has(monster.id)) {
        continue;
      }

      const monsterSprite = this.monsters?.create(
        monster.x,
        monster.y,
        `monster-${monster.id}`
      ) as Phaser.Physics.Arcade.Sprite | undefined;

      monsterSprite?.setData('monster', monster);
      monsterSprite?.setImmovable(true);
      const monsterBody = monsterSprite?.body as Phaser.Physics.Arcade.StaticBody | undefined;
      monsterBody?.setSize(34, 34);
      monsterSprite?.refreshBody();
    }
  }

  private handleMonsterOverlap(_playerObject: ArcadeOverlapObject, monsterObject: ArcadeOverlapObject): void {
    const monsterSprite = this.getSpriteFromOverlapObject(monsterObject);

    if (this.isBattling || !monsterSprite) {
      return;
    }

    const monster = monsterSprite.getData('monster') as MonsterDefinition | undefined;

    if (!monster) {
      return;
    }

    this.isBattling = true;
    this.player?.setVelocity(0);
    this.statusText?.setText(`${monster.name} blocks your path.`);
    this.scene.pause();
    this.scene.launch('BattleScene', { monster });
  }

  private getSpriteFromOverlapObject(
    overlapObject: ArcadeOverlapObject
  ): Phaser.GameObjects.Sprite | undefined {
    if (overlapObject instanceof Phaser.GameObjects.Sprite) {
      return overlapObject;
    }

    if (
      overlapObject instanceof Phaser.Physics.Arcade.Body ||
      overlapObject instanceof Phaser.Physics.Arcade.StaticBody
    ) {
      return overlapObject.gameObject instanceof Phaser.GameObjects.Sprite
        ? overlapObject.gameObject
        : undefined;
    }

    return undefined;
  }

  private handleBattleComplete(result: BattleResult): void {
    this.isBattling = false;

    if (result.monsterDefeated) {
      this.removeMonster(result.monsterId);
      const levelText =
        result.levelsGained && result.levelsGained > 0
          ? ` Level +${result.levelsGained}.`
          : '';
      this.statusText?.setText(
        `${result.monsterName} defeated. +${result.rewardExp} EXP, +${result.rewardGold} gold.${levelText}`
      );
    } else if (result.playerFainted) {
      this.player?.setPosition(PLAYER_START.x, PLAYER_START.y);
      this.statusText?.setText(`You retreated from ${result.monsterName} and returned to camp.`);
    }

    this.refreshUi();
    this.setStatusFromSave(false);
  }

  private removeMonster(monsterId: string): void {
    this.monsters?.children.each((monsterObject) => {
      const monsterSprite = monsterObject as Phaser.Physics.Arcade.Sprite;
      const monster = monsterSprite.getData('monster') as MonsterDefinition | undefined;

      if (monster?.id === monsterId) {
        monsterSprite.destroy();
      }

      return true;
    });
  }

  private refreshUi(): void {
    const saveData = loadSave();
    const stats = buildPlayerStats(saveData);

    this.uiText?.setText([
      `IELTS Quest`,
      `Lv ${stats.level}  HP ${stats.hp}/${stats.maxHp}  EXP ${stats.exp}/${stats.expToNextLevel}  Gold ${stats.gold}`,
      `ATK ${stats.attack}  VOC ${stats.vocabulary}  GRAM ${stats.grammar}  READ ${stats.reading}`,
      `Defeated ${saveData.defeatedMonsterIds.length}/${MONSTERS.length}`
    ]);
  }

  private setStatusFromSave(onlyWhenEmpty = true): void {
    if (onlyWhenEmpty && this.statusText?.text) {
      return;
    }

    const saveData = loadSave();
    const remainingMonsters = MONSTERS.length - saveData.defeatedMonsterIds.length;

    this.statusText?.setText(
      remainingMonsters > 0
        ? `${remainingMonsters} monsters remain on the study map.`
        : 'All monsters defeated. Your first IELTS route is clear.'
    );
  }
}
