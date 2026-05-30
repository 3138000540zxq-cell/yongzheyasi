import Phaser from 'phaser';
import { MONSTERS } from '../data/monsters';
import { buildPlayerStats } from '../systems/progression';
import { loadSave } from '../systems/saveSystem';
import type { BattleResult, MonsterDefinition } from '../types/game';
import {
  CHARACTER_PANEL_CLOSE_EVENT,
  CHARACTER_PANEL_TOGGLE_EVENT
} from './CharacterScene';

const PLAYER_SPEED = 170;
const PLAYER_START = { x: 120, y: 120 };
const MAP_WIDTH = 960;
const MAP_HEIGHT = 640;
const MAP_BACKGROUND_TEXTURE_KEY = 'forest-ruins-background';
const MAP_BACKGROUND_PATH = '/assets/backgrounds/references/background-forest-ruins.png';
const HUD_STATUS_PANEL_TEXTURE_KEY = 'hud-status-panel';
const HUD_STATUS_PANEL_PATH = '/assets/ui/hud/hud-status-panel.png';
const HUD_MESSAGE_BANNER_TEXTURE_KEY = 'hud-message-banner';
const HUD_MESSAGE_BANNER_PATH = '/assets/ui/hud/hud-message-banner.png';
const TITLE_FONT = 'Georgia, Cambria, "Times New Roman", serif';
const UI_FONT = '"Trebuchet MS", Verdana, system-ui, sans-serif';
type PlayerDirection = 'down' | 'left' | 'right' | 'up';
const PLAYER_WALK_TEXTURE_KEY = 'player-walk';
const PLAYER_WALK_SHEET_PATH = '/assets/player/player-walk-sheet-stabilized.png';
const PLAYER_WALK_FRAME_SIZE = 362;
const PLAYER_WALK_SPRITE_SCALE = 0.15;
const PLAYER_WALK_FRAME_RATE = 8;
const PLAYER_WALK_FRAMES: Record<PlayerDirection, number[]> = {
  down: [0, 1, 2],
  left: [3, 4, 5],
  right: [6, 7, 8],
  up: [9, 10, 11]
};
const PLAYER_IDLE_FRAMES: Record<PlayerDirection, number> = {
  down: 0,
  left: 3,
  right: 6,
  up: 9
};
const KENNEY_ROGUELIKE_TEXTURE_KEY = 'kenney-roguelike-characters';
const KENNEY_ROGUELIKE_SHEET_PATH =
  '/assets/vendor/kenney/roguelike-characters/Spritesheet/roguelikeChar_transparent.png';
const KENNEY_MONSTER_FRAME = 162;
const KENNEY_SPRITE_SCALE = 2;
const MONSTER_SPAWN_ATTEMPTS = 80;
const MONSTER_MIN_DISTANCE_FROM_PLAYER = 170;
const MONSTER_MIN_DISTANCE_FROM_MONSTERS = 150;
type SystemShortcutAction = 'character' | 'locked';
interface SystemShortcut {
  key: string;
  label: string;
  action: SystemShortcutAction;
}
interface SpawnArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface SpawnPoint {
  x: number;
  y: number;
}
const SYSTEM_SHORTCUTS: SystemShortcut[] = [
  { key: 'C', label: 'Character', action: 'character' },
  { key: 'E', label: 'Gear', action: 'locked' },
  { key: 'B', label: 'Bag', action: 'locked' },
  { key: 'Q', label: 'Quest', action: 'locked' },
  { key: 'M', label: 'Map', action: 'locked' }
];
const MONSTER_SPAWN_AREAS: SpawnArea[] = [
  { x: 300, y: 88, width: 520, height: 150 },
  { x: 560, y: 250, width: 300, height: 150 },
  { x: 220, y: 350, width: 320, height: 125 },
  { x: 680, y: 330, width: 150, height: 85 },
  { x: 110, y: 265, width: 200, height: 155 }
];
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
  private isCharacterPanelOpen = false;
  private lastCharacterPanelToggleAt = -1000;
  private lastPlayerDirection: PlayerDirection = 'down';

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.image(MAP_BACKGROUND_TEXTURE_KEY, MAP_BACKGROUND_PATH);
    this.load.image(HUD_STATUS_PANEL_TEXTURE_KEY, HUD_STATUS_PANEL_PATH);
    this.load.image(HUD_MESSAGE_BANNER_TEXTURE_KEY, HUD_MESSAGE_BANNER_PATH);

    this.load.spritesheet(PLAYER_WALK_TEXTURE_KEY, PLAYER_WALK_SHEET_PATH, {
      frameWidth: PLAYER_WALK_FRAME_SIZE,
      frameHeight: PLAYER_WALK_FRAME_SIZE
    });

    this.load.spritesheet(KENNEY_ROGUELIKE_TEXTURE_KEY, KENNEY_ROGUELIKE_SHEET_PATH, {
      frameWidth: 16,
      frameHeight: 16,
      spacing: 1
    });
  }

  create(): void {
    this.createPlaceholderTextures();
    this.createPlayerAnimations();
    this.physics.world.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);
    this.drawMap();

    this.player = this.physics.add
      .sprite(PLAYER_START.x, PLAYER_START.y, PLAYER_WALK_TEXTURE_KEY, PLAYER_IDLE_FRAMES.down)
      .setScale(PLAYER_WALK_SPRITE_SCALE)
      .setDepth(3)
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

    this.drawUiPanels();

    this.uiText = this.add
      .text(34, 26, '', {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: '#f6f4d2',
        stroke: '#07151e',
        strokeThickness: 2,
        lineSpacing: 3
      })
      .setDepth(20);

    this.statusText = this.add
      .text(606, 558, '', {
        fontFamily: UI_FONT,
        fontSize: '14px',
        color: '#f6f4d2',
        stroke: '#07151e',
        strokeThickness: 2,
        wordWrap: { width: 300 },
        lineSpacing: 4
      })
      .setDepth(22);

    this.refreshUi();
    this.setStatusFromSave();

    this.input.keyboard?.on('keydown', this.handleSystemShortcutKeyDown, this);
    this.game.events.on('battle-complete', this.handleBattleComplete, this);
    this.game.events.on(CHARACTER_PANEL_TOGGLE_EVENT, this.toggleCharacterPanel, this);
    this.game.events.on(CHARACTER_PANEL_CLOSE_EVENT, this.closeCharacterPanel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', this.handleSystemShortcutKeyDown, this);
      this.game.events.off('battle-complete', this.handleBattleComplete, this);
      this.game.events.off(CHARACTER_PANEL_TOGGLE_EVENT, this.toggleCharacterPanel, this);
      this.game.events.off(CHARACTER_PANEL_CLOSE_EVENT, this.closeCharacterPanel, this);
      this.closeCharacterPanel();
    });
  }

  update(): void {
    if (!this.player) {
      return;
    }

    if (this.isBattling) {
      this.player.setVelocity(0);
      this.stopPlayerAnimation();
      return;
    }

    if (this.isCharacterPanelOpen) {
      this.player.setVelocity(0);
      this.stopPlayerAnimation();
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
      this.stopPlayerAnimation();
      return;
    }

    this.lastPlayerDirection = this.getPlayerDirection(velocityX, velocityY);
    this.player.play(`player-walk-${this.lastPlayerDirection}`, true);
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
    this.add
      .image(0, 0, MAP_BACKGROUND_TEXTURE_KEY)
      .setOrigin(0)
      .setDisplaySize(MAP_WIDTH, MAP_HEIGHT);
  }

  private createPlayerAnimations(): void {
    for (const direction of Object.keys(PLAYER_WALK_FRAMES) as PlayerDirection[]) {
      const animationKey = `player-walk-${direction}`;

      if (this.anims.exists(animationKey)) {
        continue;
      }

      this.anims.create({
        key: animationKey,
        frames: this.anims.generateFrameNumbers(PLAYER_WALK_TEXTURE_KEY, {
          frames: PLAYER_WALK_FRAMES[direction]
        }),
        frameRate: PLAYER_WALK_FRAME_RATE,
        repeat: -1
      });
    }
  }

  private getPlayerDirection(velocityX: number, velocityY: number): PlayerDirection {
    if (velocityY > 0) {
      return 'down';
    }

    if (velocityY < 0) {
      return 'up';
    }

    return velocityX < 0 ? 'left' : 'right';
  }

  private stopPlayerAnimation(): void {
    this.player?.stop();
    this.player?.setFrame(PLAYER_IDLE_FRAMES[this.lastPlayerDirection]);
  }

  private drawGrassBase(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x214f35);
    graphics.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    for (let y = 0; y < MAP_HEIGHT; y += 32) {
      for (let x = 0; x < MAP_WIDTH; x += 32) {
        const pattern = (x * 13 + y * 7) % 5;
        const color = pattern === 0 ? 0x28613e : pattern === 1 ? 0x1d4631 : 0x23573a;
        const alpha = pattern === 2 ? 0.16 : 0.28;

        graphics.fillStyle(color, alpha);
        graphics.fillRect(x, y, 32, 32);
      }
    }

    for (let y = 18; y < MAP_HEIGHT; y += 46) {
      for (let x = 24; x < MAP_WIDTH; x += 58) {
        if ((x + y) % 4 === 0) {
          this.drawGrassClump(graphics, x, y, 0x3a7a49);
        } else if ((x * 3 + y) % 5 === 0) {
          this.drawGrassClump(graphics, x, y, 0x8bbf63);
        }
      }
    }
  }

  private drawDirtPaths(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x5b4b35, 0.35);
    graphics.fillRoundedRect(-18, 252, MAP_WIDTH + 36, 58, 18);
    graphics.fillRoundedRect(398, -18, 62, MAP_HEIGHT + 36, 18);

    graphics.fillStyle(0xb28657);
    graphics.fillRoundedRect(-16, 260, MAP_WIDTH + 32, 42, 14);
    graphics.fillRoundedRect(408, -16, 42, MAP_HEIGHT + 32, 14);

    graphics.fillStyle(0xc89b68, 0.35);
    graphics.fillRoundedRect(-16, 260, MAP_WIDTH + 32, 8, 6);
    graphics.fillRoundedRect(408, -16, 8, MAP_HEIGHT + 32, 6);

    graphics.fillStyle(0x8b6845, 0.55);
    graphics.fillEllipse(429, 282, 78, 70);

    const pebbles = [
      [108, 280],
      [246, 292],
      [374, 270],
      [437, 88],
      [426, 206],
      [444, 362],
      [432, 536],
      [594, 279],
      [755, 292],
      [888, 270]
    ];

    graphics.fillStyle(0x6d5d45, 0.65);
    for (const [x, y] of pebbles) {
      graphics.fillEllipse(x, y, 5, 3);
    }
  }

  private drawPond(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x6b7c52, 0.9);
    graphics.fillEllipse(158, 540, 250, 112);

    graphics.fillStyle(0x4d908e);
    graphics.fillEllipse(158, 540, 220, 86);
    graphics.fillStyle(0x61b7a6, 0.3);
    graphics.fillEllipse(116, 522, 84, 18);
    graphics.fillEllipse(202, 558, 92, 14);

    graphics.lineStyle(2, 0x9bcf91, 0.45);
    graphics.strokeEllipse(158, 540, 236, 100);
  }

  private drawCamp(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(0x7b7048, 0.45);
    graphics.fillEllipse(132, 132, 210, 142);
    graphics.fillStyle(0x9b8659, 0.42);
    graphics.fillEllipse(132, 132, 172, 108);

    this.drawLog(graphics, 62, 83, 34, 9);
    this.drawLog(graphics, 216, 158, 42, 9);
    this.drawCrate(graphics, 68, 176);

    graphics.fillStyle(0x5d3a24);
    graphics.fillRect(180, 166, 34, 6);
    graphics.fillRect(194, 152, 6, 34);
    graphics.fillStyle(0xf6bd60);
    graphics.fillTriangle(197, 146, 184, 172, 210, 172);
    graphics.fillStyle(0xef6f6c);
    graphics.fillTriangle(197, 153, 190, 171, 205, 171);

    graphics.fillStyle(0xdbc073, 0.85);
    graphics.fillTriangle(92, 68, 126, 122, 58, 122);
    graphics.fillStyle(0x6b4d34);
    graphics.fillRect(90, 83, 5, 39);
    graphics.fillRect(123, 83, 5, 39);
  }

  private drawSoftGrid(graphics: Phaser.GameObjects.Graphics): void {
    graphics.lineStyle(1, 0x89b77f, 0.08);
    for (let x = 0; x <= MAP_WIDTH; x += 64) {
      graphics.lineBetween(x, 0, x, MAP_HEIGHT);
    }
    for (let y = 0; y <= MAP_HEIGHT; y += 64) {
      graphics.lineBetween(0, y, MAP_WIDTH, y);
    }
  }

  private drawUiPanels(): void {
    this.add.image(8, 8, HUD_STATUS_PANEL_TEXTURE_KEY).setOrigin(0).setDepth(19);
    this.add.image(8, 532, HUD_MESSAGE_BANNER_TEXTURE_KEY).setOrigin(0).setDepth(19);
    this.drawSystemShortcutBar();
  }

  private drawSystemShortcutBar(): void {
    const startX = 70;
    const buttonY = 581;
    const buttonWidth = 102;
    const buttonHeight = 44;
    const gap = 8;

    SYSTEM_SHORTCUTS.forEach((shortcut, index) => {
      const x = startX + index * (buttonWidth + gap);
      const isPrimary = shortcut.action === 'character';
      const background = this.add
        .rectangle(x, buttonY, buttonWidth, buttonHeight, 0x09241f, isPrimary ? 0.86 : 0.68)
        .setStrokeStyle(1, isPrimary ? 0xd4b05d : 0x6f7c66, isPrimary ? 0.95 : 0.6)
        .setDepth(20)
        .setInteractive({ useHandCursor: true });

      this.add
        .rectangle(x - 33, buttonY, 24, 24, isPrimary ? 0xd4b05d : 0x2f4c40, 0.92)
        .setStrokeStyle(1, 0x07151e, 0.8)
        .setDepth(21);
      this.add
        .text(x - 33, buttonY - 1, shortcut.key, {
          fontFamily: TITLE_FONT,
          fontSize: '15px',
          color: isPrimary ? '#07151e' : '#f6f4d2'
        })
        .setOrigin(0.5)
        .setDepth(22);
      this.add
        .text(x - 16, buttonY - 9, shortcut.label, {
          fontFamily: UI_FONT,
          fontSize: '13px',
          color: isPrimary ? '#fff2bb' : '#c9d0b3',
          stroke: '#07151e',
          strokeThickness: 1
        })
        .setDepth(22);

      background.on('pointerdown', () => this.activateSystemShortcut(shortcut));
    });

    this.add
      .rectangle(758, buttonY, 326, 48, 0x071916, 0.54)
      .setStrokeStyle(1, 0x557260, 0.45)
      .setDepth(20);
    this.add
      .text(606, 541, 'Status', {
        fontFamily: TITLE_FONT,
        fontSize: '13px',
        color: '#d8bd71',
        stroke: '#07151e',
        strokeThickness: 1
      })
      .setDepth(22);
  }

  private drawGrassClump(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    color: number
  ): void {
    graphics.fillStyle(color, 0.55);
    graphics.fillTriangle(x, y + 8, x + 4, y, x + 8, y + 8);
    graphics.fillTriangle(x + 6, y + 8, x + 11, y + 2, x + 16, y + 8);
    graphics.fillTriangle(x + 13, y + 8, x + 18, y + 1, x + 23, y + 8);
  }

  private drawLog(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    graphics.fillStyle(0x6b4d34);
    graphics.fillRoundedRect(x, y, width, height, 4);
    graphics.fillStyle(0xc58f5d);
    graphics.fillEllipse(x + 3, y + height / 2, 6, height);
    graphics.fillEllipse(x + width - 3, y + height / 2, 6, height);
  }

  private drawCrate(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.fillStyle(0x9f6b3f);
    graphics.fillRect(x, y, 24, 22);
    graphics.lineStyle(2, 0x5d3a24, 0.8);
    graphics.strokeRect(x, y, 24, 22);
    graphics.lineBetween(x, y, x + 24, y + 22);
    graphics.lineBetween(x + 24, y, x, y + 22);
  }

  private spawnMonsters(): void {
    const saveData = loadSave();
    const defeatedMonsterIds = new Set(saveData.defeatedMonsterIds);
    const occupiedPositions: SpawnPoint[] = [];

    for (const monster of MONSTERS) {
      if (defeatedMonsterIds.has(monster.id)) {
        continue;
      }

      const spawnPoint = this.getRandomMonsterSpawnPoint(monster, occupiedPositions);
      occupiedPositions.push(spawnPoint);
      const shadow = this.add
        .ellipse(spawnPoint.x, spawnPoint.y + 14, 30, 12, 0x071916, 0.34)
        .setDepth(1);

      const monsterSprite = this.monsters?.create(
        spawnPoint.x,
        spawnPoint.y,
        KENNEY_ROGUELIKE_TEXTURE_KEY,
        KENNEY_MONSTER_FRAME
      ) as Phaser.Physics.Arcade.Sprite | undefined;

      monsterSprite?.setScale(KENNEY_SPRITE_SCALE);
      monsterSprite?.setDepth(3);
      monsterSprite?.setData('monster', monster);
      monsterSprite?.setData('shadow', shadow);
      monsterSprite?.setImmovable(true);
      const monsterBody = monsterSprite?.body as Phaser.Physics.Arcade.StaticBody | undefined;
      monsterBody?.setSize(28, 28);
      monsterSprite?.refreshBody();
    }
  }

  private getRandomMonsterSpawnPoint(
    monster: MonsterDefinition,
    occupiedPositions: SpawnPoint[]
  ): SpawnPoint {
    for (let attempt = 0; attempt < MONSTER_SPAWN_ATTEMPTS; attempt += 1) {
      const area = Phaser.Utils.Array.GetRandom(MONSTER_SPAWN_AREAS);
      const point = {
        x: Phaser.Math.Between(area.x, area.x + area.width),
        y: Phaser.Math.Between(area.y, area.y + area.height)
      };

      if (this.isMonsterSpawnPointSafe(point, occupiedPositions)) {
        return point;
      }
    }

    const fallbackPoint = { x: monster.x, y: monster.y };

    if (this.isMonsterSpawnPointSafe(fallbackPoint, occupiedPositions)) {
      return fallbackPoint;
    }

    return {
      x: MONSTER_SPAWN_AREAS[0].x + MONSTER_SPAWN_AREAS[0].width / 2,
      y: MONSTER_SPAWN_AREAS[0].y + MONSTER_SPAWN_AREAS[0].height / 2
    };
  }

  private isMonsterSpawnPointSafe(point: SpawnPoint, occupiedPositions: SpawnPoint[]): boolean {
    if (point.x < 48 || point.x > MAP_WIDTH - 48 || point.y < 72 || point.y > 500) {
      return false;
    }

    const distanceFromPlayer = Phaser.Math.Distance.Between(
      point.x,
      point.y,
      PLAYER_START.x,
      PLAYER_START.y
    );

    if (distanceFromPlayer < MONSTER_MIN_DISTANCE_FROM_PLAYER) {
      return false;
    }

    return occupiedPositions.every(
      (occupiedPoint) =>
        Phaser.Math.Distance.Between(point.x, point.y, occupiedPoint.x, occupiedPoint.y) >=
        MONSTER_MIN_DISTANCE_FROM_MONSTERS
    );
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

  private handleSystemShortcutKeyDown(event: KeyboardEvent): void {
    const key = event.key.toUpperCase();
    const shortcut = SYSTEM_SHORTCUTS.find((item) => item.key === key);

    if (!shortcut) {
      return;
    }

    this.activateSystemShortcut(shortcut);
  }

  private activateSystemShortcut(shortcut: SystemShortcut): void {
    if (shortcut.action === 'character') {
      this.toggleCharacterPanel();
      return;
    }

    this.showLockedSystem(shortcut.label);
  }

  private showLockedSystem(label: string): void {
    this.statusText?.setText(`${label} system is not open yet.`);
  }

  private toggleCharacterPanel(): void {
    const now = this.time.now;

    if (now - this.lastCharacterPanelToggleAt < 120) {
      return;
    }

    this.lastCharacterPanelToggleAt = now;

    if (this.isCharacterPanelOpen) {
      this.closeCharacterPanel();
      return;
    }

    this.openCharacterPanel();
  }

  private openCharacterPanel(): void {
    if (this.isBattling || this.isCharacterPanelOpen) {
      return;
    }

    this.isCharacterPanelOpen = true;
    this.player?.setVelocity(0);
    this.stopPlayerAnimation();
    this.scene.launch('CharacterScene');
  }

  private closeCharacterPanel(): void {
    if (this.scene.isActive('CharacterScene')) {
      this.scene.stop('CharacterScene');
    }

    this.isCharacterPanelOpen = false;
  }

  private removeMonster(monsterId: string): void {
    this.monsters?.children.each((monsterObject) => {
      const monsterSprite = monsterObject as Phaser.Physics.Arcade.Sprite;
      const monster = monsterSprite.getData('monster') as MonsterDefinition | undefined;

      if (monster?.id === monsterId) {
        const shadow = monsterSprite.getData('shadow') as Phaser.GameObjects.GameObject | undefined;
        shadow?.destroy();
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
