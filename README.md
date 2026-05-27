# IELTS Quest

A Phaser + TypeScript + Vite MVP for an IELTS-learning 2D RPG.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

## Project Structure

```text
src/
  data/
    monsters.ts
    questions.json
  scenes/
    BattleScene.ts
    GameScene.ts
  systems/
    battleSystem.ts
    progression.ts
    saveSystem.ts
  types/
    game.ts
  main.ts
  style.css
```

Progress is saved in `localStorage` under `ielts-quest-save-v1`.
