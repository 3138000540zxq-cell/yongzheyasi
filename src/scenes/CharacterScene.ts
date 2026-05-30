import Phaser from 'phaser';
import { MONSTERS } from '../data/monsters';
import { buildPlayerStats } from '../systems/progression';
import { loadSave } from '../systems/saveSystem';

export const CHARACTER_PANEL_CLOSE_EVENT = 'character-panel-close-request';
export const CHARACTER_PANEL_TOGGLE_EVENT = 'character-panel-toggle-request';

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 640;
const CHARACTER_PANEL_TEXTURE_KEY = 'character-status-panel';
const CHARACTER_PANEL_PATH = '/assets/character-ui/character-status-panel.png';
const PLAYER_WALK_TEXTURE_KEY = 'player-walk';
const PLAYER_WALK_SHEET_PATH = '/assets/player/player-walk-sheet.png';
const PLAYER_WALK_FRAME_SIZE = 362;
const TITLE_FONT = 'Georgia, Cambria, "Times New Roman", serif';
const UI_FONT = '"Trebuchet MS", Verdana, system-ui, sans-serif';

interface PanelBounds {
  left: number;
  top: number;
  scale: number;
}

interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CharacterScene extends Phaser.Scene {
  constructor() {
    super('CharacterScene');
  }

  preload(): void {
    if (!this.textures.exists(CHARACTER_PANEL_TEXTURE_KEY)) {
      this.load.image(CHARACTER_PANEL_TEXTURE_KEY, CHARACTER_PANEL_PATH);
    }

    if (!this.textures.exists(PLAYER_WALK_TEXTURE_KEY)) {
      this.load.spritesheet(PLAYER_WALK_TEXTURE_KEY, PLAYER_WALK_SHEET_PATH, {
        frameWidth: PLAYER_WALK_FRAME_SIZE,
        frameHeight: PLAYER_WALK_FRAME_SIZE
      });
    }
  }

  create(): void {
    const saveData = loadSave();
    const stats = buildPlayerStats(saveData);

    this.add
      .rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT, 0x04110f, 0.66)
      .setOrigin(0)
      .setInteractive();

    const panel = this.add.image(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CHARACTER_PANEL_TEXTURE_KEY);
    const panelScale = Math.min(900 / panel.width, 600 / panel.height);
    panel.setScale(panelScale).setDepth(1);

    const bounds: PanelBounds = {
      left: panel.x - (panel.width * panelScale) / 2,
      top: panel.y - (panel.height * panelScale) / 2,
      scale: panelScale
    };

    this.drawPortrait(bounds);
    this.drawTopStats(bounds, stats);
    this.drawAttributeRows(bounds, stats, saveData.defeatedMonsterIds.length);
    this.drawEquipmentPlaceholders(bounds);
    this.drawBottomNote(bounds, MONSTERS.length - saveData.defeatedMonsterIds.length);
    this.drawCloseButton(bounds);

    this.input.keyboard?.on('keydown-C', this.requestToggle, this);
    this.input.keyboard?.on('keydown-ESC', this.requestClose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-C', this.requestToggle, this);
      this.input.keyboard?.off('keydown-ESC', this.requestClose, this);
    });
  }

  private drawPortrait(bounds: PanelBounds): void {
    const center = this.toScreen(bounds, 225, 188);

    this.add.circle(center.x, center.y, 72, 0x071b18, 0.5).setDepth(2);
    this.add
      .sprite(center.x, center.y + 14, PLAYER_WALK_TEXTURE_KEY, 0)
      .setScale(0.27)
      .setDepth(3);
  }

  private drawTopStats(bounds: PanelBounds, stats: ReturnType<typeof buildPlayerStats>): void {
    this.addPanelTextInRect(bounds, { x: 475, y: 128, width: 500, height: 48 }, 'IELTS Adventurer', {
      fontFamily: TITLE_FONT,
      fontSize: '18px',
      color: '#f8e8aa',
      align: 'center'
    });

    this.addProgressBar(bounds, 520, 246, 155, 18, stats.hp / stats.maxHp, 0xc63f33);
    this.addProgressBar(
      bounds,
      812,
      246,
      155,
      18,
      stats.expToNextLevel > 0 ? stats.exp / stats.expToNextLevel : 1,
      0xd0a146
    );

    this.addPanelTextInRect(bounds, { x: 480, y: 230, width: 52, height: 46 }, 'HP', {
      ...this.smallTextStyle(),
      align: 'center'
    });
    this.addPanelTextInRect(bounds, { x: 585, y: 230, width: 90, height: 46 }, `${stats.hp}/${stats.maxHp}`, {
      ...this.smallTextStyle(),
      align: 'right'
    });
    this.addPanelTextInRect(bounds, { x: 770, y: 230, width: 62, height: 46 }, 'EXP', {
      ...this.smallTextStyle(),
      align: 'center'
    });
    this.addPanelTextInRect(
      bounds,
      { x: 875, y: 230, width: 90, height: 46 },
      `${stats.exp}/${stats.expToNextLevel}`,
      {
        ...this.smallTextStyle(),
        align: 'right'
      }
    );
    this.addPanelTextInRect(bounds, { x: 1110, y: 230, width: 76, height: 46 }, 'Gold', {
      ...this.smallTextStyle(),
      align: 'center'
    });
    this.addPanelTextInRect(bounds, { x: 1200, y: 230, width: 70, height: 46 }, `${stats.gold}`, {
      ...this.smallTextStyle(),
      align: 'right'
    });
  }

  private drawAttributeRows(
    bounds: PanelBounds,
    stats: ReturnType<typeof buildPlayerStats>,
    defeatedMonsters: number
  ): void {
    const rows: Array<[string, string]> = [
      ['Attack', `${stats.attack}`],
      ['Vocabulary', `${stats.vocabulary}`],
      ['Grammar', `${stats.grammar}`],
      ['Reading', `${stats.reading}`],
      ['Monsters', `${defeatedMonsters}/${MONSTERS.length}`],
      ['Next Level', `${Math.max(0, stats.expToNextLevel - stats.exp)} EXP`]
    ];

    rows.forEach(([label, value], index) => {
      const sourceY = 368 + index * 73;

      this.addPanelTextInRect(bounds, { x: 545, y: sourceY, width: 265, height: 42 }, label, {
        fontSize: '16px',
        color: '#ddc883'
      });
      this.addPanelTextInRect(bounds, { x: 895, y: sourceY, width: 90, height: 42 }, value, {
        fontSize: '16px',
        color: '#fff2bb',
        align: 'right'
      });
    });
  }

  private drawEquipmentPlaceholders(bounds: PanelBounds): void {
    const slots: Array<[string, SourceRect]> = [
      ['Weapon', { x: 130, y: 494, width: 86, height: 30 }],
      ['Shield', { x: 280, y: 494, width: 86, height: 30 }],
      ['Head', { x: 130, y: 638, width: 86, height: 30 }],
      ['Armor', { x: 280, y: 638, width: 86, height: 30 }],
      ['Hands', { x: 130, y: 781, width: 86, height: 30 }],
      ['Boots', { x: 280, y: 781, width: 86, height: 30 }]
    ];

    this.addPanelTextInRect(bounds, { x: 140, y: 380, width: 220, height: 40 }, 'Equipment', {
      fontFamily: TITLE_FONT,
      fontSize: '17px',
      color: '#f8e8aa',
      align: 'center'
    });

    for (const [label, rect] of slots) {
      this.addPanelTextInRect(bounds, rect, label, {
        fontSize: '10px',
        color: '#8c9d85',
        align: 'center'
      });
    }
  }

  private drawBottomNote(bounds: PanelBounds, remainingMonsters: number): void {
    const routeText =
      remainingMonsters === 1
        ? '1 monster remains on the route.'
        : `${remainingMonsters} monsters remain on the route.`;

    this.addPanelTextInRect(bounds, { x: 325, y: 900, width: 230, height: 34 }, 'Profile Notes', {
      fontFamily: TITLE_FONT,
      fontSize: '15px',
      color: '#f8e8aa'
    });
    this.addPanelTextInRect(
      bounds,
      { x: 325, y: 958, width: 720, height: 44 },
      remainingMonsters > 0
        ? `${routeText} Gear: starter kit.`
        : 'The forest route is clear. Gear: empty starter kit.',
      {
        fontSize: '13px',
        color: '#9cae8b',
        wordWrap: { width: 720 * bounds.scale }
      }
    );
  }

  private drawCloseButton(bounds: PanelBounds): void {
    const position = this.toScreen(bounds, 1364, 76);
    const button = this.add
      .circle(position.x, position.y, 16, 0x0a3029, 0.92)
      .setStrokeStyle(2, 0xd3ad58)
      .setDepth(4)
      .setInteractive({ useHandCursor: true });

    this.add
      .text(position.x, position.y - 1, 'X', {
        fontFamily: UI_FONT,
        fontSize: '16px',
        color: '#f8e8aa'
      })
      .setOrigin(0.5)
      .setDepth(5);

    button.on('pointerdown', this.requestClose, this);
  }

  private addProgressBar(
    bounds: PanelBounds,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    percent: number,
    color: number
  ): void {
    const position = this.toScreen(bounds, sourceX, sourceY);
    const width = sourceWidth * bounds.scale;
    const height = sourceHeight * bounds.scale;
    const radius = Math.max(3, height / 2);
    const fillWidth = Math.max(4, width * Phaser.Math.Clamp(percent, 0, 1));
    const graphics = this.add.graphics().setDepth(2);

    graphics.fillStyle(0x071916, 0.82);
    graphics.fillRoundedRect(position.x, position.y, width, height, radius);
    graphics.fillStyle(color, 0.96);
    graphics.fillRoundedRect(position.x, position.y, fillWidth, height, radius);
  }

  private addPanelText(
    bounds: PanelBounds,
    sourceX: number,
    sourceY: number,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const position = this.toScreen(bounds, sourceX, sourceY);

    return this.add
      .text(position.x, position.y, text, {
        fontFamily: UI_FONT,
        stroke: '#081512',
        strokeThickness: 2,
        ...style
      })
      .setDepth(3);
  }

  private addPanelTextInRect(
    bounds: PanelBounds,
    rect: SourceRect,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ): Phaser.GameObjects.Text {
    const position = this.toScreen(bounds, rect.x, rect.y);
    const width = rect.width * bounds.scale;
    const height = rect.height * bounds.scale;
    const align = style.align ?? 'left';
    const x =
      align === 'center'
        ? position.x + width / 2
        : align === 'right'
          ? position.x + width
          : position.x;

    const label = this.add
      .text(x, position.y + height / 2, text, {
        fontFamily: UI_FONT,
        stroke: '#081512',
        strokeThickness: 2,
        wordWrap: { width },
        ...style
      })
      .setDepth(3)
      .setOrigin(align === 'center' ? 0.5 : align === 'right' ? 1 : 0, 0.5);

    return label;
  }

  private smallTextStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontSize: '12px',
      color: '#fff2bb'
    };
  }

  private toScreen(bounds: PanelBounds, sourceX: number, sourceY: number): { x: number; y: number } {
    return {
      x: bounds.left + sourceX * bounds.scale,
      y: bounds.top + sourceY * bounds.scale
    };
  }

  private requestToggle(): void {
    this.game.events.emit(CHARACTER_PANEL_TOGGLE_EVENT);
  }

  private requestClose(): void {
    this.game.events.emit(CHARACTER_PANEL_CLOSE_EVENT);
  }
}
