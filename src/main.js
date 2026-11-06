// ============================================================================
//  נקודת הכניסה הראשית — חרב וכישוף: גיבורי הממלכה
// ============================================================================





import { engine } from './render/engine.js';
import { AdventureView } from './render/adventureView.js';
import { generateGame } from './map/generator.js';
import { serialize, deserialize } from './core/state.js';
import { Game } from './game/game.js';
import { UI, SAVE_KEY } from './ui/ui.js';

const canvasContainer = document.getElementById('canvas-container');
const worldOverlay = document.getElementById('world-overlay');
const uiRoot = document.getElementById('ui-root');

engine.init(canvasContainer);
const ui = new UI(uiRoot, worldOverlay);

let currentGame = null;
let currentAdvView = null;

function mountState(state) {
  if (currentAdvView) currentAdvView.dispose();
  const advView = new AdventureView(state, worldOverlay);
  const game = new Game(state, ui, advView);
  currentGame = game;
  currentAdvView = advView;
  engine.setView(advView);
  ui.attachGame(game, advView);
  window.__game = game;
  window.__ui = ui;
  window.__advView = advView;
  window.__engine = engine;
}

ui.onStartNewGame = (opts) => {
  const state = generateGame(opts);
  mountState(state);
};

ui.onSaveGame = () => {
  if (!currentGame) return;
  try {
    localStorage.setItem(SAVE_KEY, serialize(currentGame.state));
  } catch (e) {
    console.warn('Save failed:', e);
  }
};

ui.onLoadGame = () => {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const state = deserialize(raw);
    mountState(state);
    ui.toast('המשחק השמור נטען בהצלחה!');
  } catch (e) {
    console.error('Load failed:', e);
    ui.toast('טעינת השמירה נכשלה.');
  }
};

// Build a background preview map behind the main menu so the 3D scene is immediately alive and gorgeous
const bgState = generateGame({
  seed: 2026,
  size: 36,
  difficulty: 'normal',
  players: [
    { faction: 'castle', human: true, heroId: 'gideon' },
    { faction: 'necropolis', human: false },
  ],
});
mountState(bgState);
ui.openMainMenu(true);
