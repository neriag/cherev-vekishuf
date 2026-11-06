// ============================================================================
//  ממשק המשתמש המלא בעברית (RTL): מפת הרפתקאות, עיר, קרב, גיבור, דיאלוגים
// ============================================================================
import { CREATURES, FACTIONS, FACTION_LINEUP, creatureName, stackSizeWord, stackSizeRange, abilityList } from '../data/creatures.js';
import { getBuildings, BUILD_CHAINS } from '../data/buildings.js';
import { RESOURCES, RESOURCE_INFO, MINES, OBJECT_TYPES, objectDisplayName } from '../data/objects.js';
import { SKILLS, SKILL_LEVELS } from '../data/skills.js';
import { ARTIFACTS, ARTIFACT_SLOTS, RARITY_NAMES, RARITY_COLORS, artifactBonusText } from '../data/artifacts.js';
import { HERO_ROSTER, HERO_CLASSES, PRIMARY_NAMES, xpForLevel } from '../data/heroes.js';
import { SPELLS, SPELL_LEVEL_NAMES, EFFECT_NAMES } from '../data/spells.js';
import { TERRAINS } from '../data/terrain.js';
import {
  DIFFICULTIES, HERO_COST, MAX_HEROES, dateText, playerIncome, playerHeroes, playerTowns,
  heroStat, heroMaxMana, heroMaxMP, heroMorale, heroLuck, heroTitle, g,
  buildStatus, doBuild, recruitOptions, upgradeCost, canUpgradeInTown, hasBuilt, townIncome, townMageLevel,
  equipFromBackpack, unequip, armyAdd, armyCanAdd, armyTotal, armyStacks, maxAffordable, canAfford, pay, idx,
} from '../core/state.js';
import { marketCount, tradeQuote, doTrade } from '../core/market.js';
import { computeReach, planPath } from '../map/pathfinding.js';
import { MAP_SIZES } from '../map/generator.js';
import { decideAction, decideSpell, decideSpecial, performAction } from '../battle/battleAI.js';
import { engine, wait } from '../render/engine.js';
import { BattleView } from '../render/battleView.js';
import { TownView } from '../render/townView.js';
import { getCreaturePortrait } from '../render/portraits.js';
import { icon, artifactIcon } from './icons.js';
import { heroPortrait } from './heroPortraits.js';
import { audio } from '../audio/audio.js';

const SAVE_KEY = 'cherev-vekishuf-save-v1';

export class UI {
  constructor(root, overlay) {
    this.root = root;
    this.overlay = overlay;
    this.game = null;
    this.advView = null;
    this.activeScreen = 'menu'; // 'menu' | 'adventure' | 'town' | 'battle'
    this.selectedHeroId = null;
    this.currentPlan = null;
    this.currentPlanTile = null;
    this.selectedArmySlot = null;
    this.modalStack = [];
    this.buildDOM();
    this.bindGlobalKeys();
  }

  sfx(name, opts) { audio.play(name, opts); }

  buildDOM() {
    this.root.innerHTML = `
      <div id="hud-adventure" class="hud-layer hidden">
        <header id="top-bar" class="top-bar"></header>
        <aside id="side-panel" class="side-panel">
          <div class="minimap-box panel-frame">
            <div class="panel-title">מפת הממלכה</div>
            <canvas id="minimap" width="196" height="196"></canvas>
          </div>
          <div class="lists-row">
            <div class="list-col panel-frame">
              <div class="panel-title">גיבורים</div>
              <div id="hero-list" class="scroll-list"></div>
            </div>
            <div class="list-col panel-frame">
              <div class="panel-title">ערים</div>
              <div id="town-list" class="scroll-list"></div>
            </div>
          </div>
          <div id="inspector" class="inspector panel-frame"></div>
          <div id="cmd-bar" class="cmd-bar panel-frame"></div>
        </aside>
        <footer id="status-bar" class="status-bar">
          <span id="status-text">בחר גיבור והקש על המפה כדי לנוע ולחקור את הממלכה.</span>
          <span id="ai-turn-badge" class="ai-turn-badge hidden"></span>
        </footer>
      </div>
      <div id="screen-layer" class="screen-layer"></div>
      <div id="modal-layer" class="modal-layer"></div>
      <div id="context-popup" class="context-popup hidden"></div>
      <div id="toast-box" class="toast-box"></div>
    `;
    this.hudAdv = this.root.querySelector('#hud-adventure');
    this.topBar = this.root.querySelector('#top-bar');
    this.heroListEl = this.root.querySelector('#hero-list');
    this.townListEl = this.root.querySelector('#town-list');
    this.inspectorEl = this.root.querySelector('#inspector');
    this.cmdBarEl = this.root.querySelector('#cmd-bar');
    this.statusTextEl = this.root.querySelector('#status-text');
    this.aiTurnBadge = this.root.querySelector('#ai-turn-badge');
    this.screenLayer = this.root.querySelector('#screen-layer');
    this.modalLayer = this.root.querySelector('#modal-layer');
    this.contextPopup = this.root.querySelector('#context-popup');
    this.toastBox = this.root.querySelector('#toast-box');
    this.minimapCanvas = this.root.querySelector('#minimap');
    this.setupMinimapEvents();

    window.addEventListener('pointerdown', (e) => {
      audio.init();
      if (!this.contextPopup.classList.contains('hidden') && !e.target.closest('#context-popup')) {
        this.contextPopup.classList.add('hidden');
      }
    }, { capture: true });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ===================================================================== attach game & adventure input
  attachGame(game, advView) {
    this.game = game;
    this.advView = advView;
    advView.iconFn = icon;
    advView.handlers.onStep = () => {
      audio.play('step', { volume: 0.4 });
      this.refresh();
    };
    this.activeScreen = 'adventure';
    this.screenLayer.innerHTML = '';
    this.hudAdv.classList.remove('hidden');
    audio.setMusic('adventure');

    const heroes = playerHeroes(game.state, game.human.id);
    if (heroes.length) {
      this.selectHero(heroes[0].id, true);
    } else {
      const towns = playerTowns(game.state, game.human.id);
      if (towns.length) advView.centerOn(towns[0].x, towns[0].y, true);
    }
    this.setupAdventurePointer();
    this.refresh();
  }

  setupAdventurePointer() {
    if (this._advCleanup) this._advCleanup();
    let downPos = null, dragging = false, camStart = null;
    const gl = engine.renderer.domElement;

    const onMove = (e) => {
      if (this.activeScreen !== 'adventure' || this.modalLayer.children.length) return;
      if (downPos) {
        const dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
        if (Math.hypot(dx, dy) > 6) dragging = true;
        if (dragging && camStart) {
          const factor = this.advView.dist * 0.0022;
          this.advView.camTarget.x = camStart.x - dx * factor;
          this.advView.camTarget.z = camStart.z - dy * factor;
          this.advView.clampTarget();
          return;
        }
      }
      if (e.target !== gl) {
        this.advView.setHover(null);
        return;
      }
      const tile = this.advView.screenToTile(e.clientX, e.clientY);
      this.advView.setHover(tile);
      this.updateHoverStatus(tile);
    };

    const onDown = (e) => {
      if (this.activeScreen !== 'adventure' || this.modalLayer.children.length || e.target !== gl) return;
      if (e.button === 2) {
        const tile = this.advView.screenToTile(e.clientX, e.clientY);
        if (tile) this.showTileContext(tile.x, tile.y, e.clientX, e.clientY);
        return;
      }
      if (e.button === 0) {
        downPos = { x: e.clientX, y: e.clientY };
        dragging = false;
        camStart = this.advView.camTarget.clone();
      }
    };

    const onUp = (e) => {
      if (this.activeScreen !== 'adventure' || e.button !== 0 || !downPos) return;
      const wasDrag = dragging;
      downPos = null; dragging = false;
      if (wasDrag || e.target !== gl || this.modalLayer.children.length || this.game.busy) return;
      const tile = this.advView.screenToTile(e.clientX, e.clientY);
      if (tile) this.onTileClick(tile.x, tile.y);
    };

    const onWheel = (e) => {
      if (this.activeScreen !== 'adventure' || this.modalLayer.children.length || e.target !== gl) return;
      this.advView.zoom(e.deltaY);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    this._advCleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('wheel', onWheel);
    };
  }

  bindGlobalKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (this.modalStack.length) {
          const top = this.modalStack[this.modalStack.length - 1];
          top.cancel?.();
          return;
        }
        if (this.activeScreen === 'town') {
          this.closeTown?.();
          return;
        }
      }
      if (this.activeScreen !== 'adventure' || this.modalStack.length || !this.game || this.game.busy) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') this.advView.pan(0, -1.2);
      else if (k === 's' || e.key === 'ArrowDown') this.advView.pan(0, 1.2);
      else if (k === 'a' || e.key === 'ArrowLeft') this.advView.pan(-1.2, 0);
      else if (k === 'd' || e.key === 'ArrowRight') this.advView.pan(1.2, 0);
      else if (k === 'h' || k === 'י') this.cycleHero();
      else if (k === 'm' || k === 'צ' || e.key === ' ') {
        if (this.currentPlan && this.selectedHero) this.executeCurrentPlan();
        else if (k === 'e' || k === 'ק') this.promptEndTurn();
      } else if (k === 'e' || k === 'ק') this.promptEndTurn();
      else if (k === 'c' || k === 'ב') {
        if (this.selectedHero) this.openSpellbook(this.selectedHero, false);
      } else if (k === 'k' || k === 'ל') {
        this.openKingdomOverview();
      } else if (e.key === 'Enter') {
        if (this.selectedHero) {
          const town = this.game.townAt(this.selectedHero.x, this.selectedHero.y);
          if (town && town.owner === this.game.human.id) this.openTown(town, this.selectedHero);
          else this.openHeroScreen(this.selectedHero);
        }
      }
    });
  }

  get selectedHero() {
    if (!this.game || !this.selectedHeroId) return null;
    const h = this.game.hero(this.selectedHeroId);
    return h && h.alive && h.owner === this.game.human.id ? h : null;
  }

  selectHero(id, center = false) {
    this.selectedHeroId = id;
    this.selectedArmySlot = null;
    this.currentPlan = null;
    this.currentPlanTile = null;
    this.advView?.selectHero(id);
    this.advView?.clearPath();
    const h = this.selectedHero;
    if (h && center) this.advView?.centerOn(h.x, h.y);
    this.refresh();
  }

  cycleHero() {
    const heroes = playerHeroes(this.game.state, this.game.human.id);
    if (!heroes.length) return;
    const idxNow = heroes.findIndex((h) => h.id === this.selectedHeroId);
    for (let i = 1; i <= heroes.length; i++) {
      const cand = heroes[(idxNow + i) % heroes.length];
      if (!cand.sleeping && cand.mp >= 65) {
        audio.play('click');
        this.selectHero(cand.id, true);
        return;
      }
    }
    const next = heroes[(idxNow + 1) % heroes.length];
    audio.play('click');
    this.selectHero(next.id, true);
  }

  async onTileClick(x, y) {
    const s = this.game.state;
    const humanId = this.game.human.id;
    const i = idx(s, x, y);

    // Clicking own town directly when no hero is selected or clicking town roof
    const objId = s.objAt[i];
    const obj = objId ? s.objects[objId] : null;
    const heroOnTile = s.heroAt[i] ? s.heroes[s.heroAt[i]] : null;

    const sel = this.selectedHero;
    if (!sel) {
      if (heroOnTile && heroOnTile.owner === humanId) {
        audio.play('click');
        this.selectHero(heroOnTile.id, true);
      } else if (obj && obj.type === 'town' && obj.owner === humanId) {
        audio.play('click');
        await this.openTown(obj, heroOnTile);
      }
      return;
    }

    // Clicking the currently selected hero -> open town if standing on town gate, else open Hero Screen
    if (sel.x === x && sel.y === y) {
      audio.play('click');
      const town = this.game.townAt(x, y);
      if (town && town.owner === humanId) await this.openTown(town, sel);
      else await this.openHeroScreen(sel);
      return;
    }

    // Second click on the same destination tile -> execute movement!
    if (this.currentPlan && this.currentPlanTile && this.currentPlanTile.x === x && this.currentPlanTile.y === y) {
      await this.executeCurrentPlan();
      return;
    }

    // Plan path to (x,y)
    const reach = computeReach(s, sel, 12);
    const plan = planPath(s, sel, x, y, reach);
    if (!plan) {
      // If clicked another own hero or own town that is unreachable, select/open it
      if (heroOnTile && heroOnTile.owner === humanId) {
        audio.play('click');
        this.selectHero(heroOnTile.id, true);
        return;
      }
      if (obj && obj.type === 'town' && obj.owner === humanId) {
        audio.play('click');
        await this.openTown(obj, null);
        return;
      }
      audio.play('error');
      this.toast('לא ניתן להגיע למשבצת זו.');
      return;
    }

    audio.play('click');
    this.currentPlan = plan;
    this.currentPlanTile = { x, y };
    this.advView.showPath(plan, sel);
    this.updateHoverStatus({ x, y });
    this.renderCmdBar();
  }

  async executeCurrentPlan() {
    const sel = this.selectedHero;
    if (!sel || !this.currentPlan || this.game.busy) return;
    if (sel.mp < 65 && !(this.currentPlan.interact && this.currentPlan.interact.inPlace)) {
      audio.play('error');
      this.toast(`${sel.name} ${g(sel, 'עייף', 'עייפה')} — אין מספיק נקודות תנועה היום.`);
      return;
    }
    sel.sleeping = false;
    const plan = this.currentPlan;
    this.currentPlan = null;
    this.currentPlanTile = null;
    this.game.busy = true;
    try {
      await this.game.moveHero(sel, plan, { animate: true });
    } finally {
      this.game.busy = false;
    }
    this.advView.clearPath();
    this.refresh();
  }

  updateHoverStatus(tile) {
    if (!tile || !this.game) return;
    const s = this.game.state;
    const { x, y } = tile;
    if (!this.game.visibleToHuman(x, y)) {
      this.statusTextEl.textContent = `שטח לא ממופה (${x}, ${y}) — שלח גיבור לחשוף את הערפל.`;
      return;
    }
    const i = idx(s, x, y);
    const tName = TERRAINS[s.map.terrain[i]]?.name || '';
    const road = s.map.road[i] ? ' (דרך סלולה)' : '';
    const hId = s.heroAt[i];
    const oId = s.objAt[i];
    let desc = `${tName}${road} [${x},${y}]`;
    if (hId) {
      const h = s.heroes[hId];
      desc = `הגיבור ${h.name} (${heroTitle(h)} דרגה ${h.level}, השחקן ${s.players[h.owner].name})`;
    } else if (oId) {
      const o = s.objects[oId];
      if (o.type === 'town') {
        const own = o.owner != null ? s.players[o.owner].name : 'נייטרלי';
        desc = `העיר ${o.name} (${FACTIONS[o.faction].name} — ${own})`;
      } else if (o.type === 'monster') {
        const c = CREATURES[o.creature];
        desc = `${stackSizeWord(o.count)} ${c.plural} (${stackSizeRange(o.count)})`;
      } else if (o.type === 'mine') {
        const own = o.owner != null ? s.players[o.owner].name : 'לא תפוס';
        desc = `${MINES[o.resource].name} (${own})`;
      } else {
        desc = objectDisplayName(o);
        if ( this.selectedHero && this.selectedHero.visited[o.id] ) desc += ' (בוקר)';
      }
    }
    if (this.currentPlan && this.currentPlanTile && this.currentPlanTile.x === x && this.currentPlanTile.y === y) {
      const last = this.currentPlan.interact || this.currentPlan.steps[this.currentPlan.steps.length - 1];
      const turns = last ? last.turn : 0;
      desc += turns === 0 ? ' — הקש שוב לתנועה מיידית!' : ` — מרחק: ${turns + 1} ימים (הקש שוב לתחילת מסע)`;
    }
    this.statusTextEl.textContent = desc;
  }

  showTileContext(x, y, clientX, clientY) {
    const s = this.game.state;
    if (!this.game.visibleToHuman(x, y)) return;
    const i = idx(s, x, y);
    const h = s.heroAt[i] ? s.heroes[s.heroAt[i]] : null;
    const o = s.objAt[i] ? s.objects[s.objAt[i]] : null;
    let html = '';
    if (h) {
      const stacks = h.army.filter(Boolean).map((st) => `<div class="ctx-tag">${creatureName(st.type, 2)}: ${stackSizeRange(st.count)}</div>`).join('');
      html = `
        <div class="ctx-title">${h.name} — ${heroTitle(h)} (דרגה ${h.level})</div>
        <div class="ctx-sub">השחקן ${s.players[h.owner].name}</div>
        <div class="ctx-stats">
          <span>${icon('attack', 16)} ${heroStat(h, 'attack')}</span>
          <span>${icon('defense', 16)} ${heroStat(h, 'defense')}</span>
          <span>${icon('power', 16)} ${heroStat(h, 'power')}</span>
          <span>${icon('knowledge', 16)} ${heroStat(h, 'knowledge')}</span>
        </div>
        <div class="ctx-tags">${stacks}</div>
      `;
    } else if (o) {
      if (o.type === 'monster') {
        const c = CREATURES[o.creature];
        html = `
          <div class="ctx-title">${stackSizeWord(o.count)} ${c.plural} (${stackSizeRange(o.count)})</div>
          <div class="ctx-sub">דרגה ${c.tier} • ${FACTIONS[c.faction].name}</div>
          <div class="ctx-stats">
            <span>התקפה: ${c.attack}</span><span>הגנה: ${c.defense}</span>
            <span>נזק: ${c.minDmg}–${c.maxDmg}</span><span>נק"פ: ${c.hp}</span><span>מהירות: ${c.speed}</span>
          </div>
          <div class="ctx-desc">${c.desc}</div>
        `;
      } else if (o.type === 'town') {
        const own = o.owner != null ? s.players[o.owner].name : 'נייטרלי';
        html = `
          <div class="ctx-title">${o.name} (${FACTIONS[o.faction].name})</div>
          <div class="ctx-sub">בעלים: ${own}</div>
          <div class="ctx-desc">מבנים: ${o.built.length} • הכנסה: ${townIncome(o).gold} זהב ליום</div>
        `;
      } else {
        const meta = OBJECT_TYPES[o.type];
        html = `
          <div class="ctx-title">${objectDisplayName(o)}</div>
          <div class="ctx-desc">${o.type === 'mine' ? MINES[o.resource].desc : (meta?.desc || '')}</div>
        `;
      }
    } else {
      const t = TERRAINS[s.map.terrain[i]];
      html = `<div class="ctx-title">שטח: ${t.name}</div><div class="ctx-desc">עלות תנועה בסיסית: ${s.map.road[i] ? '65 (דרך)' : t.cost}</div>`;
    }
    this.contextPopup.innerHTML = html;
    this.contextPopup.classList.remove('hidden');
    const px = Math.min(window.innerWidth - 260, Math.max(12, clientX));
    const py = Math.min(window.innerHeight - 180, Math.max(12, clientY));
    this.contextPopup.style.left = `${px}px`;
    this.contextPopup.style.top = `${py}px`;
  }

  // ===================================================================== refresh HUD
  refresh() {
    if (!this.game) return;
    if (this.selectedHeroId && !this.selectedHero) {
      const heroes = playerHeroes(this.game.state, this.game.human.id);
      this.selectedHeroId = heroes[0]?.id || null;
      this.advView?.selectHero(this.selectedHeroId);
    }
    this.renderTopBar();
    this.renderHeroList();
    this.renderTownList();
    this.renderInspector();
    this.renderCmdBar();
    this.drawMinimap();
  }

  renderTopBar() {
    const s = this.game.state;
    const p = this.game.human;
    const inc = playerIncome(s, p.id);
    const resItems = RESOURCES.map((r) => {
      const info = RESOURCE_INFO[r];
      const delta = inc[r] ? `<small class="res-inc">+${inc[r]}</small>` : '';
      return `<div class="res-pill" title="${info.name} (הכנסה יומית: +${inc[r] || 0})">
        ${icon(r, 20)}
        <span class="res-val">${p.resources[r]}</span>
        ${delta}
      </div>`;
    }).join('');
    const muted = audio.isMuted();
    this.topBar.innerHTML = `
      <div class="res-strip">${resItems}</div>
      <div class="top-right">
        <div class="date-badge" title="לוח השנה של הממלכה">${icon('calendar', 18)} <span>${dateText(s.day)}</span></div>
        <button class="icon-btn" id="btn-top-kingdom" title="סקירת הממלכה (K)">${icon('kingdom', 20)}</button>
        <button class="icon-btn" id="btn-top-save" title="שמירה וטעינה">${icon('save', 20)}</button>
        <button class="icon-btn" id="btn-top-sound" title="השתק / הפעל שמע">${icon(muted ? 'soundOff' : 'sound', 20)}</button>
        <button class="icon-btn" id="btn-top-help" title="מדריך המשחק">${icon('info', 20)}</button>
        <button class="icon-btn" id="btn-top-menu" title="תפריט ראשי">${icon('menu', 20)}</button>
      </div>
    `;
    this.topBar.querySelector('#btn-top-kingdom').onclick = () => { this.sfx('click'); this.openKingdomOverview(); };
    this.topBar.querySelector('#btn-top-save').onclick = () => { this.sfx('click'); this.openSaveLoadModal(); };
    this.topBar.querySelector('#btn-top-sound').onclick = () => {
      audio.setMuted(!audio.isMuted());
      this.renderTopBar();
    };
    this.topBar.querySelector('#btn-top-help').onclick = () => { this.sfx('click'); this.openHelpModal(); };
    this.topBar.querySelector('#btn-top-menu').onclick = () => { this.sfx('click'); this.openMainMenu(true); };
  }

  renderHeroList() {
    const heroes = playerHeroes(this.game.state, this.game.human.id);
    if (!heroes.length) {
      this.heroListEl.innerHTML = `<div class="empty-note">אין גיבורים פעילים. גייס גיבור בטברנה בעיר!</div>`;
      return;
    }
    this.heroListEl.innerHTML = heroes.map((h) => {
      const sel = h.id === this.selectedHeroId;
      const mpPct = Math.min(100, Math.round((h.mp / heroMaxMP(h)) * 100));
      const manaPct = Math.min(100, Math.round((h.mana / Math.max(1, heroMaxMana(h))) * 100));
      return `
        <div class="list-item hero-row ${sel ? 'selected' : ''}" data-id="${h.id}">
          <img class="mini-port" src="${heroPortrait(h, 64)}" alt="${h.name}">
          <div class="row-info">
            <div class="row-name">${h.name}</div>
            <div class="bars">
              <div class="bar mp" title="נקודות תנועה: ${h.mp}/${heroMaxMP(h)}"><span style="width:${mpPct}%"></span></div>
              <div class="bar mana" title="מאנה: ${h.mana}/${heroMaxMana(h)}"><span style="width:${manaPct}%"></span></div>
            </div>
          </div>
          <button class="sleep-btn ${h.sleeping ? 'on' : ''}" data-sleep="${h.id}" title="${h.sleeping ? 'הער גיבור' : 'השכב לישון (דלג בסיום תור)'}">
            ${icon('sleep', 15)}
          </button>
        </div>
      `;
    }).join('');
    this.heroListEl.querySelectorAll('.hero-row').forEach((el) => {
      el.onclick = (e) => {
        if (e.target.closest('[data-sleep]')) return;
        const id = el.dataset.id;
        this.sfx('click');
        if (this.selectedHeroId === id) this.openHeroScreen(this.game.hero(id));
        else this.selectHero(id, true);
      };
    });
    this.heroListEl.querySelectorAll('[data-sleep]').forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const h = this.game.hero(btn.dataset.sleep);
        if (h) { h.sleeping = !h.sleeping; this.sfx('click'); this.refresh(); }
      };
    });
  }

  renderTownList() {
    const towns = playerTowns(this.game.state, this.game.human.id);
    if (!towns.length) {
      this.townListEl.innerHTML = `<div class="empty-note">אין ערים בבעלותך! כבוש עיר תוך ${7 - this.game.human.daysWithoutTown} ימים.</div>`;
      return;
    }
    this.townListEl.innerHTML = towns.map((t) => `
      <div class="list-item town-row" data-id="${t.id}">
        <div class="town-crest ${t.faction}">${icon('town', 24)}</div>
        <div class="row-info">
          <div class="row-name">${t.name}</div>
          <div class="row-sub">${FACTIONS[t.faction].name} • +${townIncome(t).gold}</div>
        </div>
        <span class="build-dot ${t.builtToday ? 'done' : 'ready'}" title="${t.builtToday ? 'כבר נבנה מבנה היום' : 'ניתן לבנות היום'}">
          ${t.builtToday ? '✓' : '⚒'}
        </span>
      </div>
    `).join('');
    this.townListEl.querySelectorAll('.town-row').forEach((el) => {
      el.onclick = () => {
        const t = this.game.obj(el.dataset.id);
        if (!t) return;
        this.sfx('click');
        const dist = Math.hypot(this.advView.camTarget.x - (t.x + 0.5), this.advView.camTarget.z - (t.y + 0.5));
        if (dist < 3.5) {
          const hId = this.game.state.heroAt[idx(this.game.state, t.entrance.x, t.entrance.y)];
          this.openTown(t, hId ? this.game.hero(hId) : null);
        } else {
          this.advView.centerOn(t.x, t.y);
        }
      };
      el.ondblclick = () => {
        const t = this.game.obj(el.dataset.id);
        if (!t) return;
        const hId = this.game.state.heroAt[idx(this.game.state, t.entrance.x, t.entrance.y)];
        this.openTown(t, hId ? this.game.hero(hId) : null);
      };
    });
  }

  renderInspector() {
    const h = this.selectedHero;
    if (!h) {
      this.inspectorEl.innerHTML = `<div class="empty-note">בחר גיבור מהרשימה כדי לראות את צבאו ותכונותיו.</div>`;
      return;
    }
    const slots = h.army.map((st, i) => {
      const sel = this.selectedArmySlot === i;
      if (!st) return `<div class="army-slot empty ${sel ? 'selected' : ''}" data-slot="${i}"></div>`;
      return `
        <div class="army-slot ${sel ? 'selected' : ''}" data-slot="${i}" title="${creatureName(st.type, st.count)} (${st.count}) — הקש לבחירה/פיצול, קליק ימני לפרטים">
          <img src="${getCreaturePortrait(st.type)}" alt="${st.type}">
          <span class="slot-cnt">${st.count}</span>
        </div>
      `;
    }).join('');
    this.inspectorEl.innerHTML = `
      <div class="insp-head" id="insp-hero-open" title="הקש לפתיחת מסך הגיבור המלא">
        <img class="insp-port" src="${heroPortrait(h, 84)}" alt="${h.name}">
        <div class="insp-meta">
          <div class="insp-name">${h.name} <small>דרגה ${h.level} ${heroTitle(h)}</small></div>
          <div class="insp-stats">
            <span title="התקפה">${icon('attack', 15)} ${heroStat(h, 'attack')}</span>
            <span title="הגנה">${icon('defense', 15)} ${heroStat(h, 'defense')}</span>
            <span title="כוח קסם">${icon('power', 15)} ${heroStat(h, 'power')}</span>
            <span title="ידע">${icon('knowledge', 15)} ${heroStat(h, 'knowledge')}</span>
            <span title="מורל">${icon('morale', 15)} ${heroMorale(h)}</span>
            <span title="מזל">${icon('luck', 15)} ${heroLuck(h)}</span>
          </div>
          <div class="insp-mp">תנועה: <b>${h.mp}</b>/${heroMaxMP(h)} • מאנה: <b>${h.mana}</b>/${heroMaxMana(h)}</div>
        </div>
      </div>
      <div class="army-strip">${slots}</div>
    `;
    this.inspectorEl.querySelector('#insp-hero-open').onclick = () => {
      this.sfx('click');
      this.openHeroScreen(h);
    };
    this.inspectorEl.querySelectorAll('.army-slot').forEach((el) => {
      const slot = +el.dataset.slot;
      el.onclick = () => this.onInspectorArmyClick(h, slot);
      el.oncontextmenu = (e) => {
        e.preventDefault();
        if (h.army[slot]) this.openCreatureModal(h.army[slot].type, h.army[slot].count, { hero: h, slot });
      };
    });
  }

  onInspectorArmyClick(h, slot) {
    this.sfx('click');
    if (this.selectedArmySlot == null) {
      if (h.army[slot]) this.selectedArmySlot = slot;
    } else if (this.selectedArmySlot === slot) {
      if (h.army[slot]) this.openCreatureModal(h.army[slot].type, h.army[slot].count, { hero: h, slot });
      this.selectedArmySlot = null;
    } else {
      const a = h.army[this.selectedArmySlot], b = h.army[slot];
      if (a && b && a.type === b.type) {
        b.count += a.count;
        h.army[this.selectedArmySlot] = null;
      } else {
        h.army[this.selectedArmySlot] = b;
        h.army[slot] = a;
      }
      this.selectedArmySlot = null;
    }
    this.renderInspector();
  }

  renderCmdBar() {
    const h = this.selectedHero;
    const town = h && this.game.townAt(h.x, h.y);
    const canMove = !!(this.currentPlan && h && h.mp >= 65);
    this.cmdBarEl.innerHTML = `
      <button class="cmd-btn ${canMove ? 'accent' : ''}" id="cmd-move" ${!this.currentPlan ? 'disabled' : ''} title="צעד במסלול שנבחר (M / רווח)">
        ${icon('movement', 20)} <span>תנועה</span>
      </button>
      ${town && town.owner === this.game.human.id ? `
        <button class="cmd-btn gold" id="cmd-enter-town" title="היכנס לעיר ${town.name} (Enter)">
          ${icon('town', 20)} <span>היכנס לעיר</span>
        </button>
      ` : `
        <button class="cmd-btn" id="cmd-hero" ${!h ? 'disabled' : ''} title="מסך הגיבור וציוד (Enter)">
          ${icon('hero', 20)} <span>גיבור</span>
        </button>
      `}
      <button class="cmd-btn" id="cmd-spells" ${!h ? 'disabled' : ''} title="ספר לחשים (C)">
        ${icon('spellbook', 20)} <span>לחשים</span>
      </button>
      <button class="cmd-btn" id="cmd-next" title="עבור לגיבור הבא (H)">
        ${icon('nextHero', 20)} <span>גיבור הבא</span>
      </button>
      <button class="cmd-btn end-turn" id="cmd-end" title="סיים את היום והעבר את התור (E)">
        ${icon('endTurn', 20)} <span>סיום תור</span>
      </button>
    `;
    const moveBtn = this.cmdBarEl.querySelector('#cmd-move');
    if (moveBtn) moveBtn.onclick = () => this.executeCurrentPlan();
    const enterTownBtn = this.cmdBarEl.querySelector('#cmd-enter-town');
    if (enterTownBtn) enterTownBtn.onclick = () => { this.sfx('click'); this.openTown(town, h); };
    const heroBtn = this.cmdBarEl.querySelector('#cmd-hero');
    if (heroBtn) heroBtn.onclick = () => { this.sfx('click'); if (h) this.openHeroScreen(h); };
    const spellsBtn = this.cmdBarEl.querySelector('#cmd-spells');
    if (spellsBtn) spellsBtn.onclick = () => { this.sfx('click'); if (h) this.openSpellbook(h, false); };
    this.cmdBarEl.querySelector('#cmd-next').onclick = () => this.cycleHero();
    this.cmdBarEl.querySelector('#cmd-end').onclick = () => this.promptEndTurn();
  }

  async promptEndTurn() {
    if (this.game.busy) return;
    const activeHeroes = playerHeroes(this.game.state, this.game.human.id).filter((h) => !h.sleeping && h.mp >= 100);
    if (activeHeroes.length > 0) {
      const ok = await this.confirm({
        title: 'סיום תור',
        text: `ל-${activeHeroes.map((h) => h.name).join(', ')} נותרו עדיין נקודות תנועה היום. האם לסיים את התור בכל זאת?`,
        yes: 'סיים תור',
        no: 'חזור למפה',
      });
      if (!ok) return;
    }
    this.sfx('turn');
    this.advView?.clearPath();
    this.currentPlan = null;
    await this.game.endTurn();
    this.refresh();
  }

  setAITurn(player) {
    if (player) {
      this.aiTurnBadge.textContent = `תור השחקן ${player.name}...`;
      this.aiTurnBadge.style.borderColor = player.colorHex;
      this.aiTurnBadge.classList.remove('hidden');
    } else {
      this.aiTurnBadge.classList.add('hidden');
    }
  }

  onNewDay(newWeek, weekMsg) {
    if (newWeek && weekMsg) {
      audio.play('newWeek');
      this.message({
        title: `שבוע חדש! (שבוע ${weekMsg.week})`,
        text: `האסטרולוגים מכריזים על <b>שבוע ה${weekMsg.creature.plural}</b>!<br>כל מגורי היצורים בערים התמלאו ביצורים חדשים לגיוס (+5 גידול נוסף ל${weekMsg.creature.plural}).`,
        creature: weekMsg.creature.id,
      });
    } else {
      audio.play('newDay');
      this.toast(`בוקר טוב! ${dateText(this.game.state.day)}`);
    }
    this.refresh();
  }

  // ===================================================================== minimap
  setupMinimapEvents() {
    let down = false;
    const jump = (e) => {
      if (!this.game || !this.advView) return;
      const rect = this.minimapCanvas.getBoundingClientRect();
      const u = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const v = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      this.advView.centerOn(u * this.game.state.map.w, v * this.game.state.map.h);
      this.drawMinimap();
    };
    this.minimapCanvas.addEventListener('pointerdown', (e) => { down = true; jump(e); });
    window.addEventListener('pointermove', (e) => { if (down) jump(e); });
    window.addEventListener('pointerup', () => { down = false; });
  }

  drawMinimap() {
    if (!this.game || !this.minimapCanvas) return;
    const s = this.game.state;
    const { w, h, terrain, obstacle, road } = s.map;
    const exp = this.game.human.explored;
    const c = this.minimapCanvas;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const img = ctx.createImageData(W, H);

    for (let py = 0; py < H; py++) {
      const ty = Math.min(h - 1, Math.floor((py / H) * h));
      for (let px = 0; px < W; px++) {
        const tx = Math.min(w - 1, Math.floor((px / W) * w));
        const ti = ty * w + tx;
        const pi = (py * W + px) * 4;
        if (!exp[ti]) {
          img.data[pi] = 10; img.data[pi + 1] = 12; img.data[pi + 2] = 20; img.data[pi + 3] = 255;
          continue;
        }
        const T = TERRAINS[terrain[ti]] || TERRAINS.grass;
        let r = T.color[0] * 255, g2 = T.color[1] * 255, b = T.color[2] * 255;
        if (road[ti]) { r = 165; g2 = 140; b = 100; }
        else if (obstacle[ti] === 'mountain') { r *= 0.65; g2 *= 0.65; b *= 0.65; }
        else if (obstacle[ti] === 'tree') { r *= 0.78; g2 *= 0.85; b *= 0.75; }
        img.data[pi] = r; img.data[pi + 1] = g2; img.data[pi + 2] = b; img.data[pi + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Objects & heroes
    const sx = W / w, sy = H / h;
    for (const o of Object.values(s.objects)) {
      if (!exp[o.y * w + o.x]) continue;
      if (o.type === 'town') {
        ctx.fillStyle = o.owner != null ? s.players[o.owner].colorHex : '#ddd';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.fillRect(o.x * sx - 4, o.y * sy - 4, 8, 8);
        ctx.strokeRect(o.x * sx - 4, o.y * sy - 4, 8, 8);
      } else if (o.type === 'mine') {
        ctx.fillStyle = o.owner != null ? s.players[o.owner].colorHex : '#aaa';
        ctx.fillRect(o.x * sx - 2, o.y * sy - 2, 4, 4);
      }
    }
    for (const hr of Object.values(s.heroes)) {
      if (!hr.alive || !exp[hr.y * w + hr.x]) continue;
      ctx.fillStyle = s.players[hr.owner].colorHex;
      ctx.strokeStyle = hr.id === this.selectedHeroId ? '#fff' : '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc((hr.x + 0.5) * sx, (hr.y + 0.5) * sy, hr.id === this.selectedHeroId ? 4.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Camera viewport box
    if (this.advView) {
      const cx = this.advView.target.x * sx, cy = this.advView.target.z * sy;
      const rw = (this.advView.dist * 0.9) * sx, rh = (this.advView.dist * 0.65) * sy;
      ctx.strokeStyle = '#ffe588';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
    }
  }

  // ===================================================================== generic modals
  toast(text) {
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.innerHTML = text;
    this.toastBox.appendChild(el);
    setTimeout(() => el.classList.add('fade'), 2600);
    setTimeout(() => el.remove(), 3100);
  }

  pushModal(html, onMount, { width = '500px', closable = true } = {}) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML = `<div class="modal-card ornate-box" style="max-width:${width}">${html}</div>`;
      this.modalLayer.appendChild(wrap);
      audio.play('dialog');
      const close = (val) => {
        const idxM = this.modalStack.indexOf(entry);
        if (idxM >= 0) this.modalStack.splice(idxM, 1);
        wrap.remove();
        resolve(val);
      };
      const entry = { wrap, close, cancel: () => { if (closable) close(null); } };
      this.modalStack.push(entry);
      onMount?.(wrap, close);
    });
  }

  message(data = {}) {
    let media = '';
    if (data.creature) {
      media += `<div class="msg-media"><img class="port-frame" src="${getCreaturePortrait(data.creature)}" alt=""></div>`;
    }
    if (data.hero) {
      media += `<div class="msg-media"><img class="port-frame" src="${heroPortrait(data.hero, 96)}" alt=""></div>`;
    }
    if (data.artifact) {
      media += `<div class="msg-media">${artifactIcon(data.artifact, 72)}</div>`;
    }
    if (data.icons?.length) {
      media += `<div class="msg-icons">${data.icons.map((ic) => `<div class="msg-ico-pill">${icon(ic.icon, 28)}<span>${ic.label}</span></div>`).join('')}</div>`;
    }
    return this.pushModal(`
      <div class="modal-title">${data.title || 'הודעה'}</div>
      <div class="modal-body">${data.text || ''}</div>
      ${media}
      <div class="modal-actions">
        <button class="btn-gold" data-ok>אישור</button>
      </div>
    `, (wrap, close) => {
      wrap.querySelector('[data-ok]').onclick = () => { this.sfx('click'); close(true); };
    });
  }

  confirm(data = {}) {
    const media = data.creature ? `<div class="msg-media"><img class="port-frame" src="${getCreaturePortrait(data.creature)}" alt=""><span class="cnt-badge">${data.count || ''}</span></div>` : '';
    return this.pushModal(`
      <div class="modal-title">${data.title || 'אישור'}</div>
      <div class="modal-body">${data.text || ''}</div>
      ${media}
      <div class="modal-actions">
        <button class="btn-gold" data-yes>${data.yes || 'אישור'}</button>
        <button class="btn-silver" data-no>${data.no || 'ביטול'}</button>
      </div>
    `, (wrap, close) => {
      wrap.querySelector('[data-yes]').onclick = () => { this.sfx('click'); close(true); };
      wrap.querySelector('[data-no]').onclick = () => { this.sfx('click'); close(false); };
    });
  }

  choice(data = {}) {
    const opts = (data.options || []).map((o, i) => `
      <button class="choice-card" data-idx="${i}">
        ${icon(o.icon, 36)}
        <div class="choice-lbl">${o.label}</div>
      </button>
    `).join('');
    return this.pushModal(`
      <div class="modal-title">${data.title || 'בחירה'}</div>
      <div class="modal-body">${data.text || ''}</div>
      <div class="choice-row">${opts}</div>
    `, (wrap, close) => {
      wrap.querySelectorAll('.choice-card').forEach((btn) => {
        btn.onclick = () => { this.sfx('click'); close(+btn.dataset.idx); };
      });
    }, { closable: false });
  }

  levelUp(hero, roll) {
    const pName = PRIMARY_NAMES[roll.primary];
    const opts = roll.options.map((o, i) => {
      const sk = SKILLS[o.id];
      return `
        <button class="choice-card skill-choice" data-idx="${i}">
          ${icon(o.id, 38)}
          <div class="choice-lbl">${sk.name} (${SKILL_LEVELS[o.level]})</div>
          <div class="choice-desc">${sk.desc[o.level]}</div>
        </button>
      `;
    }).join('');
    return this.pushModal(`
      <div class="modal-title">${hero.name} ${g(hero, 'עלה', 'עלתה')} לדרגה ${hero.level + 1}!</div>
      <div class="levelup-head">
        <img class="port-frame" src="${heroPortrait(hero, 92)}" alt="${hero.name}">
        <div>
          <div class="lvl-sub">${heroTitle(hero)} בדרגה ${hero.level + 1}</div>
          <div class="lvl-prim">${icon(roll.primary, 22)} +1 ${pName}</div>
        </div>
      </div>
      <div class="modal-body">${opts ? 'בחר כישור משני לפיתוח:' : 'כל הכישורים המשניים ברמה מרבית!'}</div>
      <div class="choice-row">${opts || `<button class="btn-gold" data-idx="0">המשך</button>`}</div>
    `, (wrap, close) => {
      wrap.querySelectorAll('[data-idx]').forEach((btn) => {
        btn.onclick = () => { this.sfx('click'); close(+btn.dataset.idx); };
      });
    }, { closable: false, width: '540px' });
  }

  // ===================================================================== creature inspect / split / upgrade / dismiss
  openCreatureModal(type, count, ctx = {}) {
    const c = CREATURES[type];
    const abilities = abilityList(c);
    const hero = ctx.hero;
    const town = ctx.town || (hero ? this.game.townAt(hero.x, hero.y) : null);
    const army = ctx.army || hero?.army;
    const slot = ctx.slot;
    const canUpgrade = town && town.owner === this.game.human.id && canUpgradeInTown(town, type) && army && slot != null;
    const upgCost = canUpgrade ? upgradeCost(type, count) : null;
    const canAffordUpg = canUpgrade && canAfford(this.game.human.resources, upgCost);
    const canSplit = army && slot != null && count > 1 && army.some((s) => !s);
    const canDismiss = army && slot != null && (hero ? armyStacks(army) > 1 || armyTotal(army) > count : true);

    return this.pushModal(`
      <div class="modal-title">${creatureName(type, count)} (${count})</div>
      <div class="creature-modal-grid">
        <div class="cm-port">
          <img class="port-frame lg" src="${getCreaturePortrait(type)}" alt="${c.name}">
          <div class="cm-tier">דרגה ${c.tier} • ${FACTIONS[c.faction].name}</div>
        </div>
        <div class="cm-stats">
          <div class="stat-line"><span>${icon('attack', 16)} התקפה</span><b>${c.attack}</b></div>
          <div class="stat-line"><span>${icon('defense', 16)} הגנה</span><b>${c.defense}</b></div>
          <div class="stat-line"><span>${icon('damage', 16)} נזק</span><b>${c.minDmg}–${c.maxDmg}</b></div>
          <div class="stat-line"><span>${icon('hp', 16)} נקודות חיים</span><b>${c.hp}</b></div>
          <div class="stat-line"><span>${icon('speed', 16)} מהירות</span><b>${c.speed}</b></div>
          ${c.abilities.shots ? `<div class="stat-line"><span>${icon('shots', 16)} יריות</span><b>${c.abilities.shots}</b></div>` : ''}
        </div>
      </div>
      ${abilities.length ? `<div class="cm-abilities">${abilities.map((a) => `<span class="ab-chip">${a}</span>`).join('')}</div>` : ''}
      <div class="cm-desc">${c.desc}</div>
      ${canSplit ? `
        <div class="split-box">
          <label>פיצול קבוצה: העבר <b id="split-val">${Math.floor(count / 2)}</b> ליחידה נפרדת</label>
          <input type="range" id="split-range" min="1" max="${count - 1}" value="${Math.floor(count / 2)}">
          <button class="btn-silver sm" id="btn-do-split">${icon('split', 16)} פצל קבוצה</button>
        </div>
      ` : ''}
      <div class="modal-actions">
        ${canUpgrade ? `
          <button class="btn-gold" id="btn-do-upgrade" ${!canAffordUpg ? 'disabled' : ''} title="שדרג ל-${CREATURES[c.upgradeTo].plural}">
            ${icon('upgrade', 18)} שדרג ל${CREATURES[c.upgradeTo].plural} (${upgCost.gold || 0} זהב)
          </button>
        ` : ''}
        ${canDismiss ? `<button class="btn-danger" id="btn-do-dismiss">${icon('dismiss', 18)} שחרר יחידה</button>` : ''}
        <button class="btn-silver" data-close>סגור</button>
      </div>
    `, (wrap, close) => {
      wrap.querySelector('[data-close]').onclick = () => { this.sfx('click'); close(); };
      const range = wrap.querySelector('#split-range');
      if (range) {
        range.oninput = () => { wrap.querySelector('#split-val').textContent = range.value; };
        wrap.querySelector('#btn-do-split').onclick = () => {
          const n = +range.value;
          const free = army.findIndex((s) => !s);
          if (free >= 0 && n > 0 && n < count) {
            army[slot].count -= n;
            army[free] = { type, count: n };
            this.sfx('click');
            close('changed');
            this.refresh();
          }
        };
      }
      const upgBtn = wrap.querySelector('#btn-do-upgrade');
      if (upgBtn) {
        upgBtn.onclick = () => {
          pay(this.game.human.resources, upgCost);
          army[slot].type = c.upgradeTo;
          this.sfx('recruit');
          close('changed');
          this.refresh();
        };
      }
      const disBtn = wrap.querySelector('#btn-do-dismiss');
      if (disBtn) {
        disBtn.onclick = async () => {
          army[slot] = null;
          this.sfx('click');
          close('changed');
          this.refresh();
        };
      }
    }, { width: '520px' });
  }

  // ===================================================================== recruit dwelling on map
  recruitDwelling(dwelling, hero) {
    const type = dwelling.creature;
    const c = CREATURES[type];
    const res = this.game.human.resources;
    const maxCan = Math.min(dwelling.available, maxAffordable(res, c.cost));
    return this.pushModal(`
      <div class="modal-title">${OBJECT_TYPES.dwelling.name} — גיוס ${c.plural}</div>
      <div class="recruit-row">
        <img class="port-frame lg" src="${getCreaturePortrait(type)}" alt="${c.name}">
        <div class="recruit-info">
          <div>זמינים לגיוס: <b>${dwelling.available}</b></div>
          <div>מחיר ליחידה: <b>${c.cost.gold} זהב</b></div>
          <div class="cm-desc">${c.desc}</div>
          <input type="range" id="rec-slider" min="0" max="${maxCan}" value="${maxCan}">
          <div class="rec-summary">כמות: <b id="rec-cnt">${maxCan}</b> • סה"כ: <b id="rec-cost">${maxCan * c.cost.gold}</b> זהב</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-gold" id="btn-rec-buy" ${maxCan <= 0 ? 'disabled' : ''}>גייס</button>
        <button class="btn-silver" data-close>סגור</button>
      </div>
    `, (wrap, close) => {
      const slider = wrap.querySelector('#rec-slider');
      const cntEl = wrap.querySelector('#rec-cnt');
      const costEl = wrap.querySelector('#rec-cost');
      slider.oninput = () => {
        cntEl.textContent = slider.value;
        costEl.textContent = +slider.value * c.cost.gold;
      };
      wrap.querySelector('#btn-rec-buy').onclick = () => {
        const n = +slider.value;
        if (n > 0 && armyAdd(hero.army, type, n)) {
          pay(res, c.cost, n);
          dwelling.available -= n;
          this.sfx('recruit');
        } else if (n > 0) {
          this.toast('אין מקום פנוי בצבא הגיבור!');
        }
        close();
      };
      wrap.querySelector('[data-close]').onclick = () => close();
    });
  }

  // ===================================================================== spellbook
  openSpellbook(hero, inBattle = false, battle = null, side = 0) {
    const power = heroStat(hero, 'power');
    const spells = hero.spells.map((id) => SPELLS[id]).sort((a, b) => a.level - b.level);
    const cards = spells.length ? spells.map((sp) => {
      const canCast = !inBattle || (battle.canCast(side) && hero.mana >= sp.mana);
      return `
        <div class="spell-card ${inBattle ? (canCast ? 'castable' : 'disabled') : ''}" data-spell="${sp.id}">
          <div class="sp-ico">${icon(sp.id, 42)}</div>
          <div class="sp-info">
            <div class="sp-name">${sp.name} <small>(${SPELL_LEVEL_NAMES[sp.level]})</small></div>
            <div class="sp-cost">${icon('mana', 14)} ${sp.mana} מאנה</div>
            <div class="sp-desc">${sp.desc(power)}</div>
          </div>
        </div>
      `;
    }).join('') : `<div class="empty-note">ספר הלחשים של ${hero.name} ריק. בקר בגילדת קוסמים בעיר או במקדשי קסם במפה כדי ללמוד לחשים!</div>`;

    return this.pushModal(`
      <div class="modal-title">${icon('spellbook', 24)} ספר הלחשים של ${hero.name}</div>
      <div class="spellbook-meta">
        <span>${icon('power', 18)} כוח קסם: <b>${power}</b></span>
        <span>${icon('mana', 18)} מאנה: <b>${hero.mana}</b>/${heroMaxMana(hero)}</span>
      </div>
      <div class="spellbook-grid">${cards}</div>
      <div class="modal-actions">
        <button class="btn-silver" data-close>סגור</button>
      </div>
    `, (wrap, close) => {
      wrap.querySelector('[data-close]').onclick = () => { this.sfx('click'); close(null); };
      if (inBattle) {
        wrap.querySelectorAll('.spell-card.castable').forEach((el) => {
          el.onclick = () => { this.sfx('click'); close(el.dataset.spell); };
        });
      }
    }, { width: '680px' });
  }

  // ===================================================================== Hero Screen & Hero Meet
  openHeroScreen(hero) {
    return this.pushModal('', (wrap, close) => {
      let selSlot = null;
      const render = () => {
        const xpNext = xpForLevel(hero.level + 1);
        const xpPrev = xpForLevel(hero.level);
        const xpPct = Math.min(100, Math.round(((hero.xp - xpPrev) / Math.max(1, xpNext - xpPrev)) * 100));
        const skillsHtml = hero.skills.map((s) => {
          const sk = SKILLS[s.id];
          return `
            <div class="skill-badge" title="${sk.desc[s.level]}">
              ${icon(s.id, 30)}
              <div>
                <div class="sk-name">${sk.name}</div>
                <div class="sk-lvl">${SKILL_LEVELS[s.level]}</div>
              </div>
            </div>
          `;
        }).join('');

        const equipHtml = Object.entries(ARTIFACT_SLOTS).map(([slot, label]) => {
          const artId = hero.equipped[slot];
          const art = artId ? ARTIFACTS[artId] : null;
          return `
            <div class="eq-slot ${art ? 'filled' : ''}" data-eq="${slot}" title="${art ? `${art.name}: ${artifactBonusText(art)} (הקש להסרה)` : `משבצת ציוד: ${label}`}">
              ${art ? artifactIcon(artId, 44) : `<span class="eq-lbl">${label}</span>`}
            </div>
          `;
        }).join('');

        const bagHtml = hero.backpack.length ? hero.backpack.map((artId, idxB) => {
          const art = ARTIFACTS[artId];
          return `
            <div class="bag-item" data-bag="${idxB}" title="${art.name} (${RARITY_NAMES[art.rarity]}): ${artifactBonusText(art)} — הקש לצייד">
              ${artifactIcon(artId, 40)}
              <div class="bag-info">
                <b style="color:${RARITY_COLORS[art.rarity]}">${art.name}</b>
                <small>${artifactBonusText(art)}</small>
              </div>
            </div>
          `;
        }).join('') : `<div class="empty-note">התרמיל ריק.</div>`;

        const armyHtml = hero.army.map((st, i) => `
          <div class="army-slot lg ${selSlot === i ? 'selected' : ''} ${!st ? 'empty' : ''}" data-slot="${i}">
            ${st ? `<img src="${getCreaturePortrait(st.type)}" alt=""><span class="slot-cnt">${st.count}</span><div class="slot-name">${creatureName(st.type, st.count)}</div>` : ''}
          </div>
        `).join('');

        wrap.querySelector('.modal-card').innerHTML = `
          <div class="modal-title">${hero.name} — ${heroTitle(hero)} בדרגה ${hero.level}</div>
          <div class="hero-screen-grid">
            <div class="hs-col">
              <div class="hs-bio-card">
                <img class="port-frame lg" src="${heroPortrait(hero, 112)}" alt="${hero.name}">
                <div>
                  <p class="hs-bio">${hero.bio}</p>
                  <div class="xp-bar-wrap" title="ניסיון: ${hero.xp} / ${xpNext}">
                    <div class="xp-bar"><span style="width:${xpPct}%"></span></div>
                    <small>ניסיון: ${hero.xp} / ${xpNext}</small>
                  </div>
                </div>
              </div>
              <div class="hs-prim-grid">
                <div class="prim-box">${icon('attack', 24)}<div><span>התקפה</span><b>${heroStat(hero, 'attack')}</b></div></div>
                <div class="prim-box">${icon('defense', 24)}<div><span>הגנה</span><b>${heroStat(hero, 'defense')}</b></div></div>
                <div class="prim-box">${icon('power', 24)}<div><span>כוח קסם</span><b>${heroStat(hero, 'power')}</b></div></div>
                <div class="prim-box">${icon('knowledge', 24)}<div><span>ידע</span><b>${heroStat(hero, 'knowledge')}</b></div></div>
                <div class="prim-box">${icon('morale', 24)}<div><span>מורל</span><b>${heroMorale(hero)}</b></div></div>
                <div class="prim-box">${icon('luck', 24)}<div><span>מזל</span><b>${heroLuck(hero)}</b></div></div>
              </div>
              <div class="sub-title">כישורים משניים (${hero.skills.length}/8)</div>
              <div class="skills-grid">${skillsHtml}</div>
            </div>
            <div class="hs-col">
              <div class="sub-title">ציוד וחפצים קסומים</div>
              <div class="eq-grid">${equipHtml}</div>
              <div class="sub-title">תרמיל (${hero.backpack.length})</div>
              <div class="bag-list">${bagHtml}</div>
            </div>
          </div>
          <div class="sub-title">צבא הגיבור (הקש לבחירה, החלפה, או פתיחת פרטי יחידה)</div>
          <div class="army-strip lg">${armyHtml}</div>
          <div class="modal-actions">
            <button class="btn-silver" id="hs-spells">${icon('spellbook', 18)} ספר לחשים (${hero.spells.length})</button>
            <button class="btn-gold" data-close>סגור</button>
          </div>
        `;

        wrap.querySelector('[data-close]').onclick = () => { this.sfx('click'); close(); this.refresh(); };
        wrap.querySelector('#hs-spells').onclick = () => { this.sfx('click'); this.openSpellbook(hero, false); };
        wrap.querySelectorAll('[data-eq]').forEach((el) => {
          el.onclick = () => {
            const sl = el.dataset.eq;
            if (hero.equipped[sl]) { unequip(hero, sl); this.sfx('click'); render(); }
          };
        });
        wrap.querySelectorAll('[data-bag]').forEach((el) => {
          el.onclick = () => {
            equipFromBackpack(hero, +el.dataset.bag);
            this.sfx('pickup');
            render();
          };
        });
        wrap.querySelectorAll('[data-slot]').forEach((el) => {
          const i = +el.dataset.slot;
          el.onclick = async () => {
            this.sfx('click');
            if (selSlot == null) {
              if (hero.army[i]) selSlot = i;
              render();
            } else if (selSlot === i) {
              const st = hero.army[i];
              selSlot = null;
              if (st) await this.openCreatureModal(st.type, st.count, { hero, slot: i });
              render();
            } else {
              const a = hero.army[selSlot], b = hero.army[i];
              if (a && b && a.type === b.type) { b.count += a.count; hero.army[selSlot] = null; }
              else { hero.army[selSlot] = b; hero.army[i] = a; }
              selSlot = null;
              render();
            }
          };
        });
      };
      render();
    }, { width: '780px' });
  }

  heroMeet(h1, h2) {
    return this.pushModal('', (wrap, close) => {
      let sel = null; // { hero, slot }
      const render = () => {
        const sideHtml = (h, keyH) => `
          <div class="meet-col">
            <div class="meet-head">
              <img class="port-frame" src="${heroPortrait(h, 80)}" alt="">
              <div>
                <div class="row-name">${h.name} (דרגה ${h.level})</div>
                <div class="insp-stats">
                  <span>${icon('attack', 14)} ${heroStat(h, 'attack')}</span>
                  <span>${icon('defense', 14)} ${heroStat(h, 'defense')}</span>
                  <span>${icon('power', 14)} ${heroStat(h, 'power')}</span>
                  <span>${icon('knowledge', 14)} ${heroStat(h, 'knowledge')}</span>
                </div>
              </div>
            </div>
            <div class="army-strip">
              ${h.army.map((st, i) => `
                <div class="army-slot ${sel && sel.keyH === keyH && sel.slot === i ? 'selected' : ''} ${!st ? 'empty' : ''}" data-h="${keyH}" data-slot="${i}">
                  ${st ? `<img src="${getCreaturePortrait(st.type)}" alt=""><span class="slot-cnt">${st.count}</span>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
        wrap.querySelector('.modal-card').innerHTML = `
          <div class="modal-title">מפגש גיבורים: ${h1.name} ו-${h2.name}</div>
          <div class="modal-body">הקש על יחידות צבא כדי להעביר או לאחד אותן בין הגיבורים:</div>
          <div class="meet-grid">
            ${sideHtml(h1, 'a')}
            ${sideHtml(h2, 'b')}
          </div>
          <div class="modal-actions">
            <button class="btn-gold" data-close>סיום מפגש</button>
          </div>
        `;
        wrap.querySelector('[data-close]').onclick = () => { this.sfx('click'); close(); this.refresh(); };
        wrap.querySelectorAll('[data-slot]').forEach((el) => {
          el.onclick = () => {
            const keyH = el.dataset.h, slot = +el.dataset.slot;
            const targetH = keyH === 'a' ? h1 : h2;
            if (!sel) {
              if (targetH.army[slot]) { sel = { keyH, slot }; this.sfx('click'); render(); }
              return;
            }
            const srcH = sel.keyH === 'a' ? h1 : h2;
            if (srcH === targetH && sel.slot === slot) { sel = null; render(); return; }
            // prevent leaving a hero with 0 stacks
            if (srcH !== targetH && !targetH.army[slot] && armyStacks(srcH.army) <= 1) {
              this.toast('גיבור חייב להחזיק לפחות יחידת צבא אחת!');
              sel = null; render(); return;
            }
            const a = srcH.army[sel.slot], b = targetH.army[slot];
            if (a && b && a.type === b.type) {
              if (srcH !== targetH && armyStacks(srcH.army) <= 1) {
                const moveCnt = a.count - 1;
                if (moveCnt > 0) { b.count += moveCnt; a.count = 1; }
              } else {
                b.count += a.count; srcH.army[sel.slot] = null;
              }
            } else {
              srcH.army[sel.slot] = b; targetH.army[slot] = a;
            }
            sel = null;
            this.sfx('click');
            render();
          };
        });
      };
      render();
    }, { width: '700px' });
  }

  // ===================================================================== 3D Town Screen
  openTown(town, visitingHero = null) {
    return new Promise((resolve) => {
      const prevScreen = this.activeScreen;
      this.activeScreen = 'town';
      this.hudAdv.classList.add('hidden');
      audio.setMusic('town');

      let selArmy = null; // { src: 'garrison'|'hero', slot: number }

      const townView = new TownView(town, this.overlay, {
        onBuildingClick: (bId) => this.handleTownBuildingClick(town, bId, townView, renderUI),
      });
      engine.setView(townView);

      const closeTown = () => {
        this.closeTown = null;
        townView.dispose();
        this.screenLayer.innerHTML = '';
        this.activeScreen = prevScreen;
        this.hudAdv.classList.remove('hidden');
        engine.setView(this.advView);
        audio.setMusic('adventure');
        this.refresh();
        resolve();
      };
      this.closeTown = closeTown;

      const renderUI = () => {
        const s = this.game.state;
        const p = this.game.human;
        const vHeroId = s.heroAt[idx(s, town.entrance.x, town.entrance.y)];
        const vHero = vHeroId ? s.heroes[vHeroId] : null;
        const inc = townIncome(town);
        const resBar = RESOURCES.map((r) => `<div class="res-pill sm">${icon(r, 17)}<span>${p.resources[r]}</span></div>`).join('');

        const renderSlots = (army, src) => army.map((st, i) => {
          const isSel = selArmy && selArmy.src === src && selArmy.slot === i;
          return `
            <div class="army-slot ${isSel ? 'selected' : ''} ${!st ? 'empty' : ''}" data-src="${src}" data-slot="${i}">
              ${st ? `<img src="${getCreaturePortrait(st.type)}" alt=""><span class="slot-cnt">${st.count}</span>` : ''}
            </div>
          `;
        }).join('');

        this.screenLayer.innerHTML = `
          <div class="town-ui">
            <div class="town-top-bar">
              <div class="town-title-box">
                <span class="town-name">${town.name}</span>
                <span class="town-sub">${FACTIONS[town.faction].name} • הכנסה: +${inc.gold} זהב ליום</span>
              </div>
              <div class="res-strip">${resBar}</div>
              <button class="btn-gold sm" id="btn-town-exit">${icon('close', 16)} יציאה למפה (Esc)</button>
            </div>

            <div class="town-bottom-bar ornate-box">
              <div class="town-actions-col">
                <button class="town-act-btn ${town.builtToday ? '' : 'highlight'}" id="tbtn-build">
                  ${icon('build', 22)} <span>מועצת העיר — בנייה ${town.builtToday ? '(נבנה היום)' : ''}</span>
                </button>
                <button class="town-act-btn" id="tbtn-recruit">
                  ${icon('recruit', 22)} <span>גיוס יצורים במצודה</span>
                </button>
                <button class="town-act-btn" id="tbtn-tavern" ${!hasBuilt(town, 'tavern') ? 'disabled' : ''}>
                  ${icon('tavern', 22)} <span>טברנה — גיוס גיבורים</span>
                </button>
                <button class="town-act-btn" id="tbtn-mage" ${townMageLevel(town) === 0 ? 'disabled' : ''}>
                  ${icon('mageGuild', 22)} <span>גילדת הקוסמים (דרגה ${townMageLevel(town)})</span>
                </button>
                <button class="town-act-btn" id="tbtn-market" ${!hasBuilt(town, 'marketplace') ? 'disabled' : ''}>
                  ${icon('market', 22)} <span>שוק המשאבים</span>
                </button>
              </div>

              <div class="town-armies-col">
                <div class="town-army-row">
                  <div class="army-owner-box">
                    <div class="town-crest lg ${town.faction}">${icon('fort', 28)}</div>
                    <div><b>חיל המצב</b><small>הגנת העיר</small></div>
                  </div>
                  <div class="army-strip">${renderSlots(town.garrison, 'garrison')}</div>
                </div>
                <div class="town-army-row">
                  ${vHero ? `
                    <div class="army-owner-box clickable" id="town-open-vhero" title="הקש לפתיחת מסך הגיבור">
                      <img class="mini-port lg" src="${heroPortrait(vHero, 64)}" alt="">
                      <div><b>${vHero.name}</b><small>${heroTitle(vHero)} דרגה ${vHero.level}</small></div>
                    </div>
                    <div class="army-strip">${renderSlots(vHero.army, 'hero')}</div>
                  ` : `
                    <div class="empty-note">אין גיבור בשערי העיר. גייס גיבור בטברנה או הכנס גיבור לעיר כדי להעביר אליו יחידות.</div>
                  `}
                </div>
              </div>
            </div>
          </div>
        `;

        this.screenLayer.querySelector('#btn-town-exit').onclick = () => { this.sfx('click'); closeTown(); };
        this.screenLayer.querySelector('#tbtn-build').onclick = () => { this.sfx('click'); this.openTownBuildModal(town, townView, renderUI); };
        this.screenLayer.querySelector('#tbtn-recruit').onclick = () => { this.sfx('click'); this.openTownRecruitModal(town, null, renderUI); };
        this.screenLayer.querySelector('#tbtn-tavern').onclick = () => { this.sfx('click'); this.openTownTavernModal(town, renderUI); };
        this.screenLayer.querySelector('#tbtn-mage').onclick = () => { this.sfx('click'); this.openTownMageModal(town); };
        this.screenLayer.querySelector('#tbtn-market').onclick = () => { this.sfx('click'); this.openMarketModal(renderUI); };
        const vhBox = this.screenLayer.querySelector('#town-open-vhero');
        if (vhBox && vHero) vhBox.onclick = async () => { this.sfx('click'); await this.openHeroScreen(vHero); renderUI(); };

        this.screenLayer.querySelectorAll('.town-armies-col .army-slot').forEach((el) => {
          const src = el.dataset.src, slot = +el.dataset.slot;
          const getArmy = (k) => (k === 'garrison' ? town.garrison : vHero.army);
          el.onclick = async () => {
            this.sfx('click');
            const targetArmy = getArmy(src);
            if (!selArmy) {
              if (targetArmy[slot]) { selArmy = { src, slot }; renderUI(); }
              return;
            }
            const srcArmy = getArmy(selArmy.src);
            if (selArmy.src === src && selArmy.slot === slot) {
              const st = targetArmy[slot];
              selArmy = null;
              if (st) await this.openCreatureModal(st.type, st.count, { town, army: targetArmy, slot, hero: src === 'hero' ? vHero : null });
              renderUI();
              return;
            }
            // Prevent leaving visiting hero with 0 units
            if (selArmy.src === 'hero' && src === 'garrison' && !targetArmy[slot] && armyStacks(vHero.army) <= 1) {
              this.toast('גיבור חייב להחזיק לפחות יחידה אחת!');
              selArmy = null; renderUI(); return;
            }
            const a = srcArmy[selArmy.slot], b = targetArmy[slot];
            if (a && b && a.type === b.type) {
              if (selArmy.src === 'hero' && src === 'garrison' && armyStacks(vHero.army) <= 1) {
                const move = a.count - 1;
                if (move > 0) { b.count += move; a.count = 1; }
              } else {
                b.count += a.count; srcArmy[selArmy.slot] = null;
              }
            } else {
              srcArmy[selArmy.slot] = b; targetArmy[slot] = a;
            }
            selArmy = null;
            renderUI();
          };
        });
      };

      renderUI();
    });
  }

  handleTownBuildingClick(town, bId, townView, renderUI) {
    this.sfx('click');
    if (bId.startsWith('hall') || bId === 'blacksmith' || bId === 'special') {
      this.openTownBuildModal(town, townView, renderUI);
    } else if (bId === 'fort' || bId === 'citadel' || bId === 'castle') {
      this.openTownRecruitModal(town, null, renderUI);
    } else if (bId === 'tavern') {
      this.openTownTavernModal(town, renderUI);
    } else if (bId === 'marketplace' || bId === 'silo') {
      this.openMarketModal(renderUI);
    } else if (bId.startsWith('mage')) {
      this.openTownMageModal(town);
    } else {
      const m = bId.match(/^dw(\d)/);
      if (m) this.openTownRecruitModal(town, +m[1], renderUI);
    }
  }

  openTownBuildModal(town, townView, onDone) {
    const B = getBuildings(town.faction);
    const res = this.game.human.resources;
    const cards = BUILD_CHAINS.map((chain) => {
      const nextId = chain.find((id) => !hasBuilt(town, id));
      const curId = nextId || chain[chain.length - 1];
      const b = B[curId];
      const st = nextId ? buildStatus(town, res, nextId) : 'built';
      const costStr = Object.entries(b.cost).filter(([, v]) => v > 0).map(([k, v]) => `<span class="cost-chip">${icon(k, 14)} ${v}</span>`).join(' ');
      const reqStr = b.requires.filter((r) => !hasBuilt(town, r)).map((r) => B[r]?.name || r).join(', ');
      const stLabel = {
        built: 'נבנה ✓',
        ok: 'בנה עכשיו',
        noMoney: 'חסרים משאבים',
        locked: `דורש: ${reqStr}`,
        today: 'נבנה מבנה היום',
      }[st];
      return `
        <div class="build-card status-${st}" data-build="${nextId || ''}">
          <div class="bc-head">
            <b>${b.name}</b>
            <span class="bc-tag">${stLabel}</span>
          </div>
          <div class="bc-desc">${b.desc || ''}</div>
          ${nextId ? `<div class="bc-cost">${costStr || 'חינם'}</div>` : ''}
        </div>
      `;
    }).join('');

    return this.pushModal(`
      <div class="modal-title">${icon('build', 24)} מועצת העיר ${town.name} — בניית מבנים</div>
      <div class="build-grid">${cards}</div>
      <div class="modal-actions">
        <button class="btn-silver" data-close>סגור</button>
      </div>
    `, (wrap, close) => {
      wrap.querySelector('[data-close]').onclick = () => close();
      wrap.querySelectorAll('.build-card.status-ok').forEach((card) => {
        card.onclick = async () => {
          const id = card.dataset.build;
          if (!id) return;
          doBuild(this.game.state, town, id);
          this.sfx('build');
          // Teach spells if mage guild built and hero is at gate
          const s = this.game.state;
          const vhId = s.heroAt[idx(s, town.entrance.x, town.entrance.y)];
          if (vhId) this.game.visitOwnTown(s.heroes[vhId], town);
          close();
          onDone?.();
          await townView?.animateConstructed(id);
        };
      });
    }, { width: '820px' });
  }

  openTownRecruitModal(town, filterTier = null, onDone) {
    return this.pushModal('', (wrap, close) => {
      const render = () => {
        const s = this.game.state;
        const res = this.game.human.resources;
        const vhId = s.heroAt[idx(s, town.entrance.x, town.entrance.y)];
        const vHero = vhId ? s.heroes[vhId] : null;
        const targetArmy = vHero && vHero.owner === town.owner && armyStacks(town.garrison) === 0 ? vHero.army : town.garrison;

        const tiers = filterTier ? [filterTier] : [1, 2, 3, 4, 5, 6, 7];
        const rows = tiers.map((t) => {
          const opts = recruitOptions(town, t);
          if (!opts.length) return '';
          const type = opts[opts.length - 1];
          const c = CREATURES[type];
          const avail = town.available[t] || 0;
          const maxBuy = Math.min(avail, maxAffordable(res, c.cost));
          return `
            <div class="town-rec-card" data-tier="${t}" data-type="${type}">
              <img class="port-frame" src="${getCreaturePortrait(type)}" alt="${c.name}">
              <div class="trc-info">
                <div class="trc-name">${c.plural} <small>(דרגה ${t})</small></div>
                <div class="trc-stats">התקפה ${c.attack} • הגנה ${c.defense} • נזק ${c.minDmg}–${c.maxDmg} • נק"פ ${c.hp} • מהירות ${c.speed}</div>
                <div class="trc-avail">זמינים: <b>${avail}</b> • עלות ליחידה: ${c.cost.gold} זהב${c.cost.crystal ? ` + ${c.cost.crystal} קריסטל` : ''}${c.cost.mercury ? ` + ${c.cost.mercury} כספית` : ''}</div>
              </div>
              <div class="trc-buy">
                <input type="range" class="trc-range" min="0" max="${maxBuy}" value="${maxBuy}">
                <button class="btn-gold sm trc-btn" ${maxBuy <= 0 ? 'disabled' : ''}>גייס <span class="trc-cnt">${maxBuy}</span></button>
              </div>
            </div>
          `;
        }).filter(Boolean).join('');

        wrap.querySelector('.modal-card').innerHTML = `
          <div class="modal-title">${icon('recruit', 24)} גיוס יצורים ב-${town.name}</div>
          <div class="town-rec-list">${rows || '<div class="empty-note">לא נבנו עדיין מבני מגורים ליצורים אלו.</div>'}</div>
          <div class="modal-actions">
            ${filterTier ? `<button class="btn-silver" id="btn-show-all-tiers">הצג את כל היצורים בעיר</button>` : ''}
            <button class="btn-silver" data-close>סגור</button>
          </div>
        `;

        wrap.querySelector('[data-close]').onclick = () => { close(); onDone?.(); };
        const showAll = wrap.querySelector('#btn-show-all-tiers');
        if (showAll) showAll.onclick = () => { filterTier = null; render(); };

        wrap.querySelectorAll('.town-rec-card').forEach((card) => {
          const tier = +card.dataset.tier;
          const type = card.dataset.type;
          const range = card.querySelector('.trc-range');
          const cntSpan = card.querySelector('.trc-cnt');
          const btn = card.querySelector('.trc-btn');
          range.oninput = () => { cntSpan.textContent = range.value; };
          btn.onclick = () => {
            const n = +range.value;
            if (n <= 0) return;
            const c = CREATURES[type];
            if (!armyAdd(targetArmy, type, n)) {
              if (!vHero || !armyAdd(vHero.army, type, n)) {
                this.toast('אין משבצת פנויה בחיל המצב או אצל הגיבור!');
                return;
              }
            }
            pay(res, c.cost, n);
            town.available[tier] -= n;
            this.sfx('recruit');
            render();
            onDone?.();
          };
        });
      };
      render();
    }, { width: '720px' });
  }

  openTownTavernModal(town, onDone) {
    const s = this.game.state;
    const p = this.game.human;
    const gateBlocked = !!s.heroAt[idx(s, town.entrance.x, town.entrance.y)];
    const tooMany = playerHeroes(s, p.id).length >= MAX_HEROES;
    const canHire = !gateBlocked && !tooMany && p.resources.gold >= HERO_COST;

    const cards = p.tavern.map((rid) => {
      const r = HERO_ROSTER.find((x) => x.id === rid);
      const cls = HERO_CLASSES[r.cls];
      const fakeHero = { id: r.id, name: r.name, gender: r.gender, cls: r.cls, portraitSeed: (HERO_ROSTER.indexOf(r) + 1) * 7919 };
      return `
        <div class="tavern-card">
          <img class="port-frame lg" src="${heroPortrait(fakeHero, 96)}" alt="${r.name}">
          <div class="tav-info">
            <div class="row-name">${r.name} — ${r.gender === 'f' ? cls.nameF : cls.name}</div>
            <div class="hs-bio">${r.bio}</div>
            <button class="btn-gold sm" data-hire="${r.id}" ${!canHire ? 'disabled' : ''}>
              גייס גיבור (${HERO_COST} זהב)
            </button>
          </div>
        </div>
      `;
    }).join('');

    const note = gateBlocked ? 'שער העיר תפוס בידי גיבור אחר — הזז אותו או הכנס אותו לעיר.' : tooMany ? 'הגעת למספר הגיבורים המרבי!' : '';

    return this.pushModal(`
      <div class="modal-title">${icon('tavern', 24)} טברנת ${town.name}</div>
      <div class="modal-body">שמועה במסבאה: <i>"אומרים שבאמצע הממלכה שוכנים דרקונים השומרים על שרידים עתיקים..."</i></div>
      ${note ? `<div class="warn-note">${note}</div>` : ''}
      <div class="tavern-grid">${cards}</div>
      <div class="modal-actions">
        <button class="btn-silver" data-close>סגור</button>
      </div>
    `, (wrap, close) => {
      wrap.querySelector('[data-close]').onclick = () => close();
      wrap.querySelectorAll('[data-hire]').forEach((btn) => {
        btn.onclick = () => {
          const h = this.game.hireHero(p.id, town, btn.dataset.hire);
          if (h) {
            this.sfx('recruit');
            this.selectedHeroId = h.id;
            close();
            onDone?.();
          }
        };
      });
    }, { width: '660px' });
  }

  openTownMageModal(town) {
    const maxL = townMageLevel(town);
    let html = '';
    for (let lvl = maxL; lvl >= 1; lvl--) {
      const spHtml = (town.guild[lvl] || []).map((id) => {
        const sp = SPELLS[id];
        return `
          <div class="spell-card">
            <div class="sp-ico">${icon(sp.id, 38)}</div>
            <div class="sp-info">
              <div class="sp-name">${sp.name}</div>
              <div class="sp-cost">${icon('mana', 14)} ${sp.mana} מאנה</div>
              <div class="sp-desc">${sp.desc(2)}</div>
            </div>
          </div>
        `;
      }).join('');
      html += `<div class="sub-title">קומה ${lvl} (${SPELL_LEVEL_NAMES[lvl]})</div><div class="spellbook-grid">${spHtml}</div>`;
    }
    return this.pushModal(`
      <div class="modal-title">${icon('mageGuild', 24)} גילדת הקוסמים של ${town.name}</div>
      <div class="modal-body">כל גיבור המבקר בעיר לומד אוטומטית את הלחשים שבגילדה (בהתאם לרמת החוכמה שלו).</div>
      ${html}
      <div class="modal-actions"><button class="btn-silver" data-close>סגור</button></div>
    `, (wrap, close) => { wrap.querySelector('[data-close]').onclick = () => close(); }, { width: '680px' });
  }

  openMarketModal(onDone) {
    return this.pushModal('', (wrap, close) => {
      let from = 'gold', to = 'wood';
      const s = this.game.state;
      const pid = this.game.human.id;
      const res = this.game.human.resources;
      const render = () => {
        if (from === to) to = from === 'gold' ? 'wood' : 'gold';
        const q = tradeQuote(s, pid, from, to);
        const maxLots = Math.floor(res[from] / q.give);
        wrap.querySelector('.modal-card').innerHTML = `
          <div class="modal-title">${icon('market', 24)} שוק המשאבים (${marketCount(s, pid)} שווקים בבעלותך)</div>
          <div class="market-grid">
            <div class="mkt-col">
              <div class="sub-title">מכירת משאב (ברשותך)</div>
              <div class="mkt-res-list">
                ${RESOURCES.map((r) => `
                  <button class="mkt-res-btn ${from === r ? 'selected' : ''}" data-from="${r}">
                    ${icon(r, 22)} <span>${RESOURCE_INFO[r].name}</span> <b>${res[r]}</b>
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="mkt-col">
              <div class="sub-title">קניית משאב (מבוקש)</div>
              <div class="mkt-res-list">
                ${RESOURCES.map((r) => `
                  <button class="mkt-res-btn ${to === r ? 'selected' : ''}" data-to="${r}" ${r === from ? 'disabled' : ''}>
                    ${icon(r, 22)} <span>${RESOURCE_INFO[r].name}</span> <b>${res[r]}</b>
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="mkt-trade-box">
            <div>שער חליפין: תמורת <b>${q.give} ${RESOURCE_INFO[from].name}</b> תקבל <b>${q.get} ${RESOURCE_INFO[to].name}</b></div>
            <input type="range" id="mkt-lots" min="0" max="${maxLots}" value="${Math.min(1, maxLots)}">
            <div id="mkt-summary">תן: <b>${Math.min(1, maxLots) * q.give}</b> ${RESOURCE_INFO[from].name} ⟵ קבל: <b>${Math.min(1, maxLots) * q.get}</b> ${RESOURCE_INFO[to].name}</div>
          </div>
          <div class="modal-actions">
            <button class="btn-gold" id="btn-do-trade" ${maxLots <= 0 ? 'disabled' : ''}>בצע עסקה</button>
            <button class="btn-silver" data-close>סגור</button>
          </div>
        `;
        wrap.querySelector('[data-close]').onclick = () => { close(); onDone?.(); };
        wrap.querySelectorAll('[data-from]').forEach((b) => { b.onclick = () => { from = b.dataset.from; this.sfx('click'); render(); }; });
        wrap.querySelectorAll('[data-to]').forEach((b) => { b.onclick = () => { to = b.dataset.to; this.sfx('click'); render(); }; });
        const slider = wrap.querySelector('#mkt-lots');
        const sumEl = wrap.querySelector('#mkt-summary');
        slider.oninput = () => {
          const lots = +slider.value;
          sumEl.innerHTML = `תן: <b>${lots * q.give}</b> ${RESOURCE_INFO[from].name} ⟵ קבל: <b>${lots * q.get}</b> ${RESOURCE_INFO[to].name}`;
        };
        wrap.querySelector('#btn-do-trade').onclick = () => {
          const lots = +slider.value;
          if (lots > 0) {
            doTrade(s, pid, from, to, lots * q.give);
            this.sfx('gold');
            render();
            onDone?.();
          }
        };
      };
      render();
    }, { width: '680px' });
  }

  // ===================================================================== Kingdom Overview / Save-Load / Help
  openKingdomOverview() {
    const s = this.game.state;
    const p = this.game.human;
    const inc = playerIncome(s, p.id);
    const towns = playerTowns(s, p.id);
    const heroes = playerHeroes(s, p.id);
    const mines = {};
    for (const r of RESOURCES) mines[r] = 0;
    for (const o of Object.values(s.objects)) if (o.type === 'mine' && o.owner === p.id) mines[o.resource]++;

    return this.pushModal(`
      <div class="modal-title">${icon('kingdom', 24)} סקירת הממלכה (${dateText(s.day)})</div>
      <div class="sub-title">הכנסה יומית ומכרות בשליטתך</div>
      <div class="ko-res-grid">
        ${RESOURCES.map((r) => `
          <div class="ko-res-card">
            ${icon(r, 26)}
            <div><b>${RESOURCE_INFO[r].name}: ${p.resources[r]}</b><small>+${inc[r] || 0} ליום (${mines[r]} מכרות)</small></div>
          </div>
        `).join('')}
      </div>
      <div class="sub-title">ערים בבעלותך (${towns.length})</div>
      <div class="ko-list">${towns.map((t) => `<div class="ko-row"><b>${t.name}</b> (${FACTIONS[t.faction].name}) — +${townIncome(t).gold} זהב ליום • ${t.built.length} מבנים</div>`).join('')}</div>
      <div class="sub-title">גיבורים בשירותך (${heroes.length}/${MAX_HEROES})</div>
      <div class="ko-list">${heroes.map((h) => `<div class="ko-row"><b>${h.name}</b> (${heroTitle(h)} דרגה ${h.level}) — תנועה ${h.mp}/${heroMaxMP(h)}, מאנה ${h.mana}/${heroMaxMana(h)}</div>`).join('')}</div>
      <div class="modal-actions"><button class="btn-gold" data-close>סגור</button></div>
    `, (wrap, close) => { wrap.querySelector('[data-close]').onclick = () => close(); }, { width: '660px' });
  }

  openSaveLoadModal() {
    const hasSave = !!localStorage.getItem(SAVE_KEY);
    return this.pushModal(`
      <div class="modal-title">${icon('save', 24)} שמירה וטעינת משחק</div>
      <div class="modal-body">ניתן לשמור את מצב הממלכה בדפדפן ולהמשיך בכל עת.</div>
      <div class="modal-actions">
        <button class="btn-gold" id="btn-save-now">${icon('save', 18)} שמור משחק כעת</button>
        <button class="btn-silver" id="btn-load-now" ${!hasSave ? 'disabled' : ''}>${icon('load', 18)} טען שמירה אחרונה</button>
        <button class="btn-silver" data-close>סגור</button>
      </div>
    `, (wrap, close) => {
      wrap.querySelector('[data-close]').onclick = () => close();
      wrap.querySelector('#btn-save-now').onclick = () => {
        this.onSaveGame?.();
        this.sfx('pickup');
        this.toast('המשחק נשמר בהצלחה!');
        close();
      };
      wrap.querySelector('#btn-load-now').onclick = () => {
        this.sfx('click');
        close();
        this.onLoadGame?.();
      };
    });
  }

  openHelpModal() {
    return this.pushModal(`
      <div class="modal-title">${icon('info', 24)} מדריך המשחק — חרב וכישוף: גיבורי הממלכה</div>
      <div class="help-body">
        <p><b>מטרת המשחק:</b> הובל את גיבוריך לחקור את הממלכה, לאסוף משאבים וחפצים קסומים, לבנות את עריך ולהביס את כל היריבים על ידי כיבוש עריהם והכנעת גיבוריהם.</p>
        <ul>
          <li><b>תנועה במפה:</b> בחר גיבור והקש על יעד במפה לתכנון מסלול (חיצים ירוקים = יגיע היום; חיצים אדומים = יגיע בתורות הבאים). הקש פעם שנייה על היעד או לחץ <code>רווח</code>/<code>M</code> כדי לנוע.</li>
          <li><b>ערים ובנייה:</b> ניתן לבנות מבנה אחד בכל עיר בכל יום. <b>היכל העירייה/הקפיטול</b> מגדילים את הכנסת הזהב היומית; <b>מצודה/טירה</b> מגדילות את קצב הגידול השבועי של היצורים; <b>מבני מגורים</b> מאפשרים לגייס יחידות חדשות.</li>
          <li><b>שבוע חדש:</b> בכל 7 ימים (יום 1 של השבוע) כל מבני המגורים בערים מתמלאים ביצורים חדשים לגיוס!</li>
          <li><b>קרבות טקטיים:</b> בקרב על שדה המשושים, היחידות פועלות לפי מהירותן. השתמש בחוכמה ב<b>יורים</b>, <b>מעופפים</b>, <b>המתנה (W)</b>, <b>הגנה (D)</b> ו<b>ספר הלחשים</b> של הגיבור.</li>
          <li><b>קיצורי מקלדת:</b> <code>WASD</code>/חיצים להזזת מצלמה, גלגלת לזום, <code>H</code> לגיבור הבא, <code>M</code>/<code>רווח</code> לתנועה, <code>E</code> לסיום תור, <code>C</code> לספר לחשים, <code>K</code> לסקירת הממלכה, קליק ימני למידע מהיר.</li>
        </ul>
      </div>
      <div class="modal-actions"><button class="btn-gold" data-close>הבנתי — לניצחון!</button></div>
    `, (wrap, close) => { wrap.querySelector('[data-close]').onclick = () => close(); }, { width: '680px' });
  }

  // ===================================================================== Battle Screen
  battle(battle, setup) {
    return new Promise((resolve) => {
      const prevScreen = this.activeScreen;
      this.activeScreen = 'battle';
      this.hudAdv.classList.add('hidden');
      audio.setMusic('battle');

      let autoCombat = false;
      let logLines = ['הקרב החל!'];

      const addLog = (msg) => {
        if (!msg) return;
        logLines.push(msg);
        if (logLines.length > 30) logLines.shift();
        const logEl = this.screenLayer.querySelector('#battle-log-line');
        if (logEl) logEl.textContent = msg;
      };

      const bView = new BattleView(battle, setup, this.overlay, {
        onLog: addLog,
        onPreview: (txt) => {
          const prevEl = this.screenLayer.querySelector('#battle-preview-line');
          if (prevEl) prevEl.textContent = txt || logLines[logLines.length - 1] || '';
        },
        onTurnChange: () => renderBattleHUD(),
        onQueueUpdate: () => renderBattleHUD(),
        onCancelMode: () => renderBattleHUD(),
        onInspectUnit: (u) => this.openCreatureModal(u.type, u.count),
        onHexClick: async (x, y, attackFrom) => {
          if (bView.playing || battle.result) return;
          const active = battle.active;
          if (!active || battle.sides[active.side].ai) return;

          // Spell targeting
          if (bView.spellMode) {
            const spId = bView.spellMode;
            if (!battle.spellTargetValid(active.side, spId, x, y)) {
              audio.play('error');
              return;
            }
            bView.spellMode = null;
            const evs = battle.castSpell(active.side, spId, x, y);
            await bView.playEvents(evs);
            if (battle.result) { finishBattle(); return; }
            renderBattleHUD();
            return;
          }

          // Archangel resurrect targeting
          if (bView.resurrectMode) {
            const t = battle.corpseAt(x, y) || battle.unitAt(x, y);
            if (t && t.side === active.side && (t.dead || t.count < t.initialCount) && !battle.def(t).abilities.undead) {
              bView.resurrectMode = false;
              const evs = battle.doResurrect(active, t);
              await bView.playEvents(evs);
              await stepTurnLoop();
            } else audio.play('error');
            return;
          }

          const target = battle.unitAt(x, y);
          if (target && target.side !== active.side) {
            if (battle.canShoot(active)) {
              const evs = battle.doShoot(active, target);
              await bView.playEvents(evs);
              await stepTurnLoop();
              return;
            }
            const hexes = battle.attackHexes(active, target);
            if (hexes.length) {
              const from = attackFrom || hexes[0];
              const evs = battle.doAttack(active, target, from.x, from.y);
              await bView.playEvents(evs);
              await stepTurnLoop();
              return;
            }
          } else if (!target && battle.reachable(active).has(y * 15 + x)) {
            const evs = battle.doMove(active, x, y);
            await bView.playEvents(evs);
            await stepTurnLoop();
          }
        },
      });
      engine.setView(bView);

      const renderBattleHUD = () => {
        if (this.activeScreen !== 'battle') return;
        const active = battle.active;
        const humanTurn = active && !battle.sides[active.side].ai && !battle.result && !bView.playing;
        const s0 = battle.sides[0], s1 = battle.sides[1];
        const qUnits = [active, ...battle.queue, ...battle.waitQueue].filter((u) => u && !u.dead).slice(0, 11);

        const canRes = humanTurn && battle.def(active).abilities.resurrectOnce && !active.resurrectUsed &&
          battle.units.some((u) => u.side === active.side && (u.dead || u.count < u.initialCount) && !battle.def(u).abilities.undead);

        this.screenLayer.innerHTML = `
          <div class="battle-ui">
            <div class="battle-top-bar">
              <div class="b-side-card side-0">
                ${s0.hero ? `<img class="mini-port" src="${heroPortrait(s0.hero, 56)}" alt="">` : ''}
                <div>
                  <div class="b-side-name">${s0.name || 'תוקף'}</div>
                  ${s0.hero ? `<div class="b-side-sub">${icon('mana', 13)} ${s0.hero.mana}/${heroMaxMana(s0.hero)} מאנה</div>` : ''}
                </div>
              </div>
              <div class="b-round-badge">סבב ${battle.round || 1}</div>
              <div class="b-side-card side-1">
                <div>
                  <div class="b-side-name">${s1.name || 'מגן'}</div>
                  ${s1.hero ? `<div class="b-side-sub">${icon('mana', 13)} ${s1.hero.mana}/${heroMaxMana(s1.hero)} מאנה</div>` : ''}
                </div>
                ${s1.hero ? `<img class="mini-port" src="${heroPortrait(s1.hero, 56)}" alt="">` : ''}
              </div>
            </div>

            <div class="battle-bottom-bar ornate-box">
              <div class="b-queue-strip">
                ${qUnits.map((u, i) => `
                  <div class="bq-item side-${u.side} ${i === 0 ? 'now' : ''}" title="${battle.name(u)} (${u.count})">
                    <img src="${getCreaturePortrait(u.type)}" alt="">
                    <span>${u.count}</span>
                  </div>
                `).join('')}
              </div>
              <div class="b-log-row">
                <div id="battle-preview-line" class="b-preview-line">${bView.spellMode ? `בחר משבצת להטלת "${SPELLS[bView.spellMode].name}" (קליק ימני לביטול)` : (logLines[logLines.length - 1] || '')}</div>
              </div>
              <div class="b-controls-row">
                <button class="cmd-btn" id="bbtn-spell" ${!humanTurn || !battle.canCast(active.side) ? 'disabled' : ''}>
                  ${icon('spellbook', 18)} <span>הטל לחש</span>
                </button>
                <button class="cmd-btn" id="bbtn-wait" ${!humanTurn || active.waited ? 'disabled' : ''}>
                  ${icon('wait', 18)} <span>המתנה (W)</span>
                </button>
                <button class="cmd-btn" id="bbtn-defend" ${!humanTurn ? 'disabled' : ''}>
                  ${icon('defend', 18)} <span>הגנה (D)</span>
                </button>
                ${canRes ? `<button class="cmd-btn gold" id="bbtn-res">${icon('resurrection', 18)} <span>החייאה</span></button>` : ''}
                <button class="cmd-btn ${autoCombat ? 'accent' : ''}" id="bbtn-auto">
                  ${icon('auto', 18)} <span>${autoCombat ? 'עצור אוטומטי' : 'קרב אוטומטי'}</span>
                </button>
                <button class="cmd-btn" id="bbtn-speed">
                  ${icon('speed', 18)} <span>מהירות ${bView.speedMult > 1 ? '×2' : '×1'}</span>
                </button>
                <button class="cmd-btn danger" id="bbtn-flee" ${!humanTurn ? 'disabled' : ''}>
                  ${icon('flee', 18)} <span>נסיגה</span>
                </button>
              </div>
            </div>
          </div>
        `;

        this.screenLayer.querySelector('#bbtn-spell').onclick = async () => {
          if (!humanTurn) return;
          this.sfx('click');
          const hero = battle.sides[active.side].hero;
          const spId = await this.openSpellbook(hero, true, battle, active.side);
          if (!spId) return;
          const sp = SPELLS[spId];
          if (sp.target === 'all') {
            const evs = battle.castSpell(active.side, spId, 0, 0);
            await bView.playEvents(evs);
            if (battle.result) { finishBattle(); return; }
          } else {
            bView.spellMode = spId;
            bView.refreshHighlights();
          }
          renderBattleHUD();
        };
        this.screenLayer.querySelector('#bbtn-wait').onclick = async () => {
          if (!humanTurn) return;
          const evs = battle.doWait(active);
          await bView.playEvents(evs);
          await stepTurnLoop();
        };
        this.screenLayer.querySelector('#bbtn-defend').onclick = async () => {
          if (!humanTurn) return;
          const evs = battle.doDefend(active);
          await bView.playEvents(evs);
          await stepTurnLoop();
        };
        const resBtn = this.screenLayer.querySelector('#bbtn-res');
        if (resBtn) {
          resBtn.onclick = () => {
            bView.resurrectMode = !bView.resurrectMode;
            bView.refreshHighlights();
            renderBattleHUD();
          };
        }
        this.screenLayer.querySelector('#bbtn-auto').onclick = async () => {
          autoCombat = !autoCombat;
          renderBattleHUD();
          if (autoCombat && !bView.playing) await stepTurnLoop();
        };
        this.screenLayer.querySelector('#bbtn-speed').onclick = () => {
          bView.speedMult = bView.speedMult > 1 ? 1 : 1.9;
          renderBattleHUD();
        };
        this.screenLayer.querySelector('#bbtn-flee').onclick = async () => {
          if (!humanTurn) return;
          const ok = await this.confirm({
            title: 'נסיגה משדה הקרב',
            text: 'האם אתה בטוח שברצונך לסגת? נסיגה משמעותה תבוסה בקרב ואובדן הצבא של הגיבור!',
            yes: 'נסוג מהקרב',
            no: 'המשך להילחם',
          });
          if (!ok) return;
          const evs = battle.flee(active.side);
          await bView.playEvents(evs);
          finishBattle();
        };
      };

      const stepTurnLoop = async () => {
        while (!battle.result) {
          const startEvs = battle.beginTurn();
          await bView.playEvents(startEvs);
          if (battle.result) break;
          const u = battle.active;
          if (!u || u.dead) continue;
          const isAI = battle.sides[u.side].ai || autoCombat;
          renderBattleHUD();
          if (!isAI) return; // wait for player input
          await wait(140 / bView.speedMult);
          const sp = decideSpell(battle, u.side);
          if (sp) {
            const spEvs = battle.castSpell(u.side, sp.spell, sp.x, sp.y);
            await bView.playEvents(spEvs);
            if (battle.result) break;
          }
          const act = decideSpecial(battle, u) || decideAction(battle, u);
          const actEvs = performAction(battle, u, act);
          await bView.playEvents(actEvs);
        }
        if (battle.result) await finishBattle();
      };

      const finishBattle = async () => {
        const humanSide = battle.sides[0].ai ? 1 : 0;
        const won = battle.result.winner === humanSide;
        audio.setMusic(won ? 'victory' : 'defeat');
        audio.play(won ? 'victory' : 'defeat');

        // Compute casualties preview
        const lostHtml = (sideIdx) => {
          const items = [];
          for (const u of battle.units.filter((x) => x.side === sideIdx)) {
            const lost = u.initialCount - (u.dead ? 0 : u.count);
            if (lost > 0) items.push(`<div class="cas-chip"><img src="${getCreaturePortrait(u.type)}" alt=""><span>-${lost}</span></div>`);
          }
          return items.length ? items.join('') : '<span class="no-loss">ללא אבדות!</span>';
        };

        await this.pushModal(`
          <div class="modal-title ${won ? 'win-title' : 'lose-title'}">${won ? 'ניצחון מפואר!' : 'תבוסה בקרב'}</div>
          <div class="modal-body">${won ? 'כוחותיך הכריעו את האויב בשדה הקרב!' : 'צבאך הוכרע בשדה הקרב.'}</div>
          <div class="cas-section">
            <div><b>אבדות ${battle.sides[0].name}:</b><div class="cas-row">${lostHtml(0)}</div></div>
            <div><b>אבדות ${battle.sides[1].name}:</b><div class="cas-row">${lostHtml(1)}</div></div>
          </div>
          <div class="modal-actions"><button class="btn-gold" data-ok>המשך</button></div>
        `, (wrap, close) => {
          wrap.querySelector('[data-ok]').onclick = () => { this.sfx('click'); close(); };
        }, { closable: false, width: '560px' });

        bView.dispose();
        this.screenLayer.innerHTML = '';
        this.activeScreen = prevScreen;
        this.hudAdv.classList.remove('hidden');
        engine.setView(this.advView);
        audio.setMusic('adventure');
        resolve(battle.result);
      };

      renderBattleHUD();
      stepTurnLoop();
    });
  }

  // ===================================================================== Game Over & Main Menu
  async gameOver(outcome) {
    const won = outcome === 'win';
    audio.setMusic(won ? 'victory' : 'defeat');
    await this.pushModal(`
      <div class="modal-title ${won ? 'win-title' : 'lose-title'}">${won ? 'ניצחון מוחלט! הממלכה מאוחדת תחת דגלך!' : 'ממלכתך נפלה'}</div>
      <div class="modal-body">
        ${won
          ? `לאחר ${this.game.state.day} ימים של קרבות, כישוף ואסטרטגיה — כל אויביך הוכרעו והממלכה כולה מריעה לשמך!`
          : 'איבדת את כל עריך וגיבוריך. ההיסטוריה תזכור את גבורתך — נסה שוב במערכה חדשה!'}
      </div>
      <div class="modal-actions">
        <button class="btn-gold" id="btn-go-menu">חזרה לתפריט הראשי</button>
      </div>
    `, (wrap, close) => {
      wrap.querySelector('#btn-go-menu').onclick = () => { close(); this.openMainMenu(false); };
    }, { closable: false });
  }

  openMainMenu(canResume = false) {
    this.activeScreen = 'menu';
    this.hudAdv.classList.add('hidden');
    audio.setMusic('menu');
    const hasSave = !!localStorage.getItem(SAVE_KEY);

    let cfg = {
      faction: 'castle',
      heroId: 'gideon',
      size: 'medium',
      opponents: 1,
      difficulty: 'normal',
    };

    const renderMenu = () => {
      const factionHeroes = HERO_ROSTER.filter((r) => HERO_CLASSES[r.cls].faction === cfg.faction);
      if (!factionHeroes.some((r) => r.id === cfg.heroId)) cfg.heroId = factionHeroes[0].id;
      const selRoster = HERO_ROSTER.find((r) => r.id === cfg.heroId);
      const cls = HERO_CLASSES[selRoster.cls];
      const fakeHero = { id: selRoster.id, name: selRoster.name, gender: selRoster.gender, cls: selRoster.cls, portraitSeed: (HERO_ROSTER.indexOf(selRoster) + 1) * 7919 };

      this.screenLayer.innerHTML = `
        <div class="main-menu-screen">
          <div class="menu-card ornate-box">
            <div class="brand-header">
              <div class="brand-crown">${icon('kingdom', 44)}</div>
              <h1 class="brand-title">חרב וכישוף</h1>
              <div class="brand-subtitle">גיבורי הממלכה — משחק אסטרטגיה בתורות בתלת-ממד</div>
            </div>

            <div class="setup-grid">
              <div class="setup-col">
                <div class="sub-title">בחר פלג ממלכה</div>
                <div class="faction-pick-row">
                  ${['castle', 'necropolis'].map((f) => `
                    <button class="faction-btn ${cfg.faction === f ? 'selected' : ''}" data-fac="${f}">
                      <div class="town-crest lg ${f}">${icon('town', 28)}</div>
                      <div>
                        <b>${FACTIONS[f].name}</b>
                        <small>${FACTIONS[f].desc}</small>
                      </div>
                    </button>
                  `).join('')}
                </div>

                <div class="sub-title">גודל מפה, יריבים ורמת קושי</div>
                <div class="pills-group">
                  <span>גודל מפה:</span>
                  ${Object.entries(MAP_SIZES).map(([k, v]) => `
                    <button class="pill-btn ${cfg.size === k ? 'selected' : ''}" data-size="${k}">${v.name} (${v.size}×${v.size})</button>
                  `).join('')}
                </div>
                <div class="pills-group">
                  <span>מספר יריבים:</span>
                  ${[1, 2, 3].map((n) => `
                    <button class="pill-btn ${cfg.opponents === n ? 'selected' : ''}" data-opp="${n}">${n === 1 ? 'יריב אחד' : `${n} יריבים`}</button>
                  `).join('')}
                </div>
                <div class="pills-group">
                  <span>רמת קושי:</span>
                  ${Object.entries(DIFFICULTIES).map(([k, v]) => `
                    <button class="pill-btn ${cfg.difficulty === k ? 'selected' : ''}" data-diff="${k}">${v.name}</button>
                  `).join('')}
                </div>
              </div>

              <div class="setup-col">
                <div class="sub-title">בחר גיבור פותח</div>
                <div class="hero-pick-strip">
                  ${factionHeroes.map((r) => {
                    const fh = { id: r.id, name: r.name, gender: r.gender, cls: r.cls, portraitSeed: (HERO_ROSTER.indexOf(r) + 1) * 7919 };
                    return `
                      <button class="hero-pick-btn ${cfg.heroId === r.id ? 'selected' : ''}" data-hero="${r.id}" title="${r.name}">
                        <img src="${heroPortrait(fh, 64)}" alt="${r.name}">
                        <span>${r.name}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
                <div class="hero-preview-box">
                  <img class="port-frame lg" src="${heroPortrait(fakeHero, 96)}" alt="">
                  <div>
                    <div class="row-name">${selRoster.name} — ${selRoster.gender === 'f' ? cls.nameF : cls.name}</div>
                    <p class="hs-bio">${selRoster.bio}</p>
                    <div class=" row-sub">כישורים: ${selRoster.skills.map(([sid, l]) => `${SKILLS[sid].name} (${SKILL_LEVELS[l]})`).join(', ')}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="menu-footer-actions">
              <button class="btn-gold lg" id="btn-start-new">${icon('attack', 22)} התחל מערכה חדשה</button>
              ${canResume ? `<button class="btn-silver lg" id="btn-resume-game">חזור למשחק הפעיל</button>` : ''}
              ${hasSave ? `<button class="btn-silver lg" id="btn-load-saved">${icon('load', 20)} טען משחק שמור</button>` : ''}
              <button class="btn-silver" id="btn-menu-help">${icon('info', 18)} איך משחקים?</button>
            </div>
          </div>
        </div>
      `;

      this.screenLayer.querySelectorAll('[data-fac]').forEach((b) => {
        b.onclick = () => { cfg.faction = b.dataset.fac; this.sfx('click'); renderMenu(); };
      });
      this.screenLayer.querySelectorAll('[data-size]').forEach((b) => {
        b.onclick = () => { cfg.size = b.dataset.size; this.sfx('click'); renderMenu(); };
      });
      this.screenLayer.querySelectorAll('[data-opp]').forEach((b) => {
        b.onclick = () => { cfg.opponents = +b.dataset.opp; this.sfx('click'); renderMenu(); };
      });
      this.screenLayer.querySelectorAll('[data-diff]').forEach((b) => {
        b.onclick = () => { cfg.difficulty = b.dataset.diff; this.sfx('click'); renderMenu(); };
      });
      this.screenLayer.querySelectorAll('[data-hero]').forEach((b) => {
        b.onclick = () => { cfg.heroId = b.dataset.hero; this.sfx('click'); renderMenu(); };
      });

      this.screenLayer.querySelector('#btn-start-new').onclick = () => {
        this.sfx('recruit');
        const players = [{ faction: cfg.faction, human: true, heroId: cfg.heroId }];
        const oppFactions = [cfg.faction === 'castle' ? 'necropolis' : 'castle', 'castle', 'necropolis'];
        for (let i = 0; i < cfg.opponents; i++) players.push({ faction: oppFactions[i % oppFactions.length], human: false });
        this.onStartNewGame?.({
          seed: (Date.now() & 0x7fffffff) || 12345,
          size: MAP_SIZES[cfg.size].size,
          difficulty: cfg.difficulty,
          players,
        });
      };

      const resBtn = this.screenLayer.querySelector('#btn-resume-game');
      if (resBtn) {
        resBtn.onclick = () => {
          this.sfx('click');
          this.screenLayer.innerHTML = '';
          this.activeScreen = 'adventure';
          this.hudAdv.classList.remove('hidden');
          audio.setMusic('adventure');
        };
      }
      const loadBtn = this.screenLayer.querySelector('#btn-load-saved');
      if (loadBtn) {
        loadBtn.onclick = () => { this.sfx('click'); this.onLoadGame?.(); };
      }
      this.screenLayer.querySelector('#btn-menu-help').onclick = () => { this.sfx('click'); this.openHelpModal(); };
    };

    renderMenu();
  }
}

export { SAVE_KEY };
