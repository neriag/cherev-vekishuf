// ============================================================================
//  נקודת הכניסה הראשית — חרב וכישוף: גיבורי הממלכה
// ============================================================================
import '@fontsource/suez-one';
import '@fontsource/frank-ruhl-libre/400.css';
import '@fontsource/frank-ruhl-libre/700.css';
import './styles/main.css';

import { engine } from './render/engine.js';
import { AdventureView } from './render/adventureView.js';
import { generateGame } from './map/generator.js';
import { serialize, deserialize } from './core/state.js';
import { Game } from './game/game.js';
import { UI, SAVE_KEY, AUTO_SAVE_KEY } from './ui/ui.js';

const canvasContainer = document.getElementById('canvas-container');
const worldOverlay = document.getElementById('world-overlay');
const uiRoot = document.getElementById('ui-root');

try {
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

  ui.onAutoSave = () => {
    if (!currentGame) return;
    try {
      localStorage.setItem(AUTO_SAVE_KEY, serialize(currentGame.state));
    } catch (e) {
      console.warn('Auto-save failed:', e);
    }
  };

  ui.onLoadGame = (key = SAVE_KEY) => {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const state = deserialize(raw);
      mountState(state);
      ui.toast(key === AUTO_SAVE_KEY ? 'השמירה האוטומטית נטענה בהצלחה!' : 'המשחק השמור נטען בהצלחה!');
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
} catch (err) {
  console.error('Startup error:', err);
  if (uiRoot) {
    uiRoot.style.pointerEvents = 'auto';
    uiRoot.innerHTML = `<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:#100d09;color:#f5ebd4;font-family:sans-serif;direction:rtl;text-align:center;">
      <div style="max-width:440px;padding:20px;border:2px solid #d8a944;border-radius:8px;background:#1c150e;">
        <h2 style="color:#ffd970;margin:0 0 10px;">שגיאה בטעינת המשחק</h2>
        <p style="margin:0 0 12px;line-height:1.5;">הדפדפן לא הצליח לאתחל את מנוע התלת-ממד (WebGL). נסה לרענן את הדף או לפתוח ב־Chrome / Safari מעודכן.</p>
        <code style="display:block;font-size:12px;color:#ff9b8a;word-break:break-word;direction:ltr;">${String(err?.message || err)}</code>
      </div>
    </div>`;
  }
}
