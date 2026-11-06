// ============================================================================
//  בקר המשחק — תורות, תנועה, אינטראקציות, קרבות, אירועים שבועיים
// ============================================================================
import { CREATURES, FACTION_LINEUP, creatureName, stackSizeWord } from '../data/creatures.js';
import { ARTIFACTS, artifactBonusText } from '../data/artifacts.js';
import { SKILLS, SKILL_LEVELS } from '../data/skills.js';
import { SPELLS } from '../data/spells.js';
import { MINES, RESOURCE_INFO, RESOURCES, objectDisplayName } from '../data/objects.js';
import { HERO_ROSTER, HERO_CLASSES, xpForLevel } from '../data/heroes.js';
import { TERRAINS } from '../data/terrain.js';
import {
  idx, inBounds, rebuildIndex, reveal, heroVision, heroMaxMP, heroMaxMana, gainXP, rollLevelUp, applyLevelUp,
  giveArtifact, learnSkill, canLearnSpell, maxSpellLevel, armyAdd, armyCanAdd, armyValue, heroStrength, addRes,
  playerIncome, playerHeroes, playerTowns, townGrowth, townMageLevel, townTowers, hasBuilt, createHero, emptyArmy,
  canAfford, pay, g, heroTitle, dateOf, MAX_HEROES, HERO_COST, skillValue, armyTotal, armyStacks,
} from '../core/state.js';
import { stepCost, tileInfo } from '../map/pathfinding.js';
import { refreshTavern } from '../map/generator.js';
import { Battle } from '../battle/battleLogic.js';
import { runAutoBattle } from '../battle/battleAI.js';
import { RNG, rand } from '../core/rng.js';

const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export class Game {
  constructor(state, ui, view) {
    this.state = state;
    this.ui = ui;       // dialogs & screens
    this.view = view;   // adventure-map renderer
    this.busy = false;
    this.rng = new RNG(state.seed * 7 + state.day);
  }

  get human() { return this.state.players.find((p) => p.human); }
  isHuman(pid) { return pid != null && this.state.players[pid]?.human; }
  hero(id) { return this.state.heroes[id]; }
  obj(id) { return this.state.objects[id]; }
  playerOf(hero) { return this.state.players[hero.owner]; }

  // ===================================================================== turn flow
  async endTurn() {
    if (this.busy || this.state.gameOver) return;
    this.busy = true;
    try {
      const s = this.state;
      const humanId = this.human.id;
      for (const p of s.players) {
        if (p.human || !p.alive) continue;
        s.currentPlayer = p.id;
        this.ui.setAITurn?.(p);
        const { runAITurn } = await import('./ai.js');
        await runAITurn(this, p.id);
        this.checkElimination();
        if (s.gameOver) return;
      }
      s.currentPlayer = humanId;
      this.ui.setAITurn?.(null);
      await this.newDay();
    } finally {
      this.busy = false;
    }
  }

  async newDay() {
    const s = this.state;
    s.day++;
    const { day, week } = dateOf(s.day);
    const newWeek = day === 1;
    for (const p of s.players) {
      if (!p.alive) continue;
      addRes(p.resources, playerIncome(s, p.id));
      if (playerTowns(s, p.id).length === 0) p.daysWithoutTown++; else p.daysWithoutTown = 0;
    }
    for (const h of Object.values(s.heroes)) {
      if (!h.alive) continue;
      h.mp = heroMaxMP(h);
      const town = this.townAt(h.x, h.y);
      if (town && town.owner === h.owner && townMageLevel(town) > 0) h.mana = Math.max(h.mana, heroMaxMana(h));
      else h.mana = Math.min(heroMaxMana(h), h.mana + 1 + Math.floor(heroMaxMana(h) / 20));
    }
    for (const o of Object.values(s.objects)) if (o.type === 'town') o.builtToday = false;

    let weekMsg = null;
    if (newWeek) {
      // week of creature
      const pool = [...FACTION_LINEUP.castle.slice(0, 5), ...FACTION_LINEUP.necropolis.slice(0, 5), 'wolf', 'goblin', 'orc'];
      s.weekCreature = this.rng.pick(pool);
      for (const o of Object.values(s.objects)) {
        if (o.type === 'town') {
          for (let t = 1; t <= 7; t++) o.available[t] += townGrowth(o, t, s.weekCreature);
          o.stablesVisited = {};
        } else if (o.type === 'monster') {
          o.count = Math.ceil(o.count * 1.08);
        } else if (o.type === 'dwelling') {
          o.available += CREATURES[o.creature].growth;
        }
      }
      for (const p of s.players) refreshTavern(s, p.id, this.rng);
      const c = CREATURES[s.weekCreature];
      weekMsg = { creature: c, week };
    }
    this.checkElimination();
    if (s.gameOver) return;
    this.view?.refreshAll?.();
    this.ui.onNewDay?.(newWeek, weekMsg);
  }

  checkElimination() {
    const s = this.state;
    for (const p of s.players) {
      if (!p.alive) continue;
      const heroes = playerHeroes(s, p.id).length, towns = playerTowns(s, p.id).length;
      if ((heroes === 0 && towns === 0) || p.daysWithoutTown >= 7) {
        p.alive = false;
        for (const h of playerHeroes(s, p.id)) this.killHero(h);
        for (const o of Object.values(s.objects)) if (o.owner === p.id && o.type !== 'town') o.owner = null;
        this.view?.refreshAll?.();
        if (!p.human) this.ui.toast?.(`השחקן ${p.name} הובס והודח מהמשחק!`);
      }
    }
    const human = this.human;
    if (!human.alive) { s.gameOver = 'lose'; this.ui.gameOver?.('lose'); return; }
    if (s.players.filter((p) => p.alive && !p.human).length === 0) { s.gameOver = 'win'; this.ui.gameOver?.('win'); }
  }

  // ===================================================================== helpers
  townAt(x, y) {
    const id = this.state.objAt[idx(this.state, x, y)];
    const o = id && this.obj(id);
    return o && o.type === 'town' && o.entrance.x === x && o.entrance.y === y ? o : null;
  }
  visibleToHuman(x, y) {
    const h = this.human;
    return !!h.explored[idx(this.state, x, y)];
  }
  revealForHero(hero) {
    const changed = reveal(this.state, hero.owner, hero.x, hero.y, heroVision(hero));
    if (changed && this.isHuman(hero.owner)) this.view?.updateFog?.();
  }
  placeHero(hero, x, y) {
    const s = this.state;
    if (hero.x >= 0 && s.heroAt[idx(s, hero.x, hero.y)] === hero.id) s.heroAt[idx(s, hero.x, hero.y)] = null;
    hero.x = x; hero.y = y;
    s.heroAt[idx(s, x, y)] = hero.id;
  }
  killHero(hero, winnerHero = null) {
    const s = this.state;
    if (winnerHero) {
      for (const slot in hero.equipped) giveArtifact(winnerHero, hero.equipped[slot]);
      for (const a of hero.backpack) giveArtifact(winnerHero, a);
    }
    hero.equipped = {}; hero.backpack = [];
    hero.alive = false;
    if (s.heroAt[idx(s, hero.x, hero.y)] === hero.id) s.heroAt[idx(s, hero.x, hero.y)] = null;
    this.view?.removeHero?.(hero.id);
  }
  removeObject(id) {
    const s = this.state;
    const o = s.objects[id];
    if (!o) return;
    delete s.objects[id];
    rebuildIndex(s);
    this.view?.removeObject?.(id);
  }
  say(hero, data) {
    // show a dialog only to the human player
    if (this.isHuman(hero.owner)) return this.ui.message(data);
    return Promise.resolve();
  }
  freeAdjacent(x, y) {
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (!inBounds(this.state, nx, ny)) continue;
      const info = tileInfo(this.state, nx, ny, { id: '__none' });
      if (info.kind === 'free') return { x: nx, y: ny };
    }
    return null;
  }

  // ===================================================================== movement
  /**
   * Execute a planned path. Returns when the hero stops.
   * plan: { steps:[{x,y}], interact }
   */
  async moveHero(hero, plan, opts = {}) {
    const s = this.state;
    if (!plan) return;
    const human = this.isHuman(hero.owner);
    const animate = human || opts.animate;
    this.view?.onHeroMoveStart?.(hero);
    let stoppedEarly = false;
    for (let i = 0; i < plan.steps.length; i++) {
      const st = plan.steps[i];
      const cost = stepCost(s, hero, hero.x, hero.y, st.x, st.y);
      if (hero.mp < cost) { stoppedEarly = true; break; }
      // re-check tile is still free (AI heroes may have moved)
      const info = tileInfo(s, st.x, st.y, hero);
      if (info.kind !== 'free' && info.kind !== 'guarded' && info.kind !== 'townEntrance') { stoppedEarly = true; break; }
      hero.mp -= cost;
      const from = { x: hero.x, y: hero.y };
      this.placeHero(hero, st.x, st.y);
      if (from.x !== st.x) hero.facing = st.x > from.x ? 1 : -1;
      this.revealForHero(hero);
      const visible = animate || this.visibleToHuman(st.x, st.y) || this.visibleToHuman(from.x, from.y);
      if (visible) await this.view?.animateHeroStep?.(hero, from, st, { fast: !human });
      else this.view?.snapHero?.(hero);
      if (this.state.gameOver) return;
      // guarded tile → fight
      if (info.kind === 'guarded') {
        const m = this.obj(info.id);
        if (m) { await this.fightMonster(hero, m); stoppedEarly = true; break; }
      }
      if (info.kind === 'townEntrance') {
        await this.enterTown(hero, this.obj(info.id));
        stoppedEarly = true;
        break;
      }
    }
    this.view?.onHeroMoveEnd?.(hero);
    if (!stoppedEarly && plan.interact && hero.alive) {
      const it = plan.interact;
      if (it.kind === 'town' && it.inPlace) { await this.enterTown(hero, this.obj(it.id)); return; }
      if (it.kind === 'object' || it.kind === 'hero') {
        const cost = stepCost(s, hero, hero.x, hero.y, it.x, it.y);
        if (hero.mp < cost) return;
        if (it.x !== hero.x) hero.facing = it.x > hero.x ? 1 : -1;
        this.view?.faceHero?.(hero);
        hero.mp -= cost;
        if (it.kind === 'object') await this.visitObject(hero, this.obj(it.id));
        else await this.meetHero(hero, this.hero(it.id));
      }
    }
  }

  // ===================================================================== object visits
  async visitObject(hero, o) {
    if (!o || !hero.alive) return;
    const s = this.state;
    const human = this.isHuman(hero.owner);
    const player = this.playerOf(hero);
    const sfx = (n) => { if (human) this.ui.sfx?.(n); };
    const name = objectDisplayName(o);
    switch (o.type) {
      case 'resource': {
        player.resources[o.resource] += o.amount;
        sfx(o.resource === 'gold' ? 'gold' : 'pickup');
        if (human) this.view?.floatText?.(o.x, o.y, `+${o.amount} ${RESOURCE_INFO[o.resource].name}`, RESOURCE_INFO[o.resource].color, o.resource);
        this.removeObject(o.id);
        break;
      }
      case 'campfire': {
        player.resources.gold += o.gold;
        player.resources[o.resource] += o.amount;
        sfx('pickup');
        await this.say(hero, {
          title: 'מדורה', text: `${hero.name} ${g(hero, 'מצא', 'מצאה')} ליד הגחלים הלוחשות משאבים שהשאירו נוודים.`,
          icons: [{ icon: 'gold', label: `${o.gold}` }, { icon: o.resource, label: `${o.amount}` }],
        });
        this.removeObject(o.id);
        break;
      }
      case 'chest': {
        sfx('chest');
        let choice = 0;
        const xp = o.gold - 500;
        if (human) {
          choice = await this.ui.choice({
            title: 'תיבת אוצר',
            text: `לאחר חיפוש קצר ${g(hero, 'מצא', 'מצאה')} ${hero.name} תיבת אוצר ישנה. האם לשמור את הזהב, או לחלק אותו לאיכרים בתמורה לניסיון?`,
            options: [{ icon: 'gold', label: `${o.gold} זהב` }, { icon: 'xp', label: `${xp} ניסיון` }],
          });
        } else choice = hero.level < 4 && player.resources.gold > 8000 ? 1 : 0;
        if (choice === 0) { player.resources.gold += o.gold; sfx('gold'); }
        this.removeObject(o.id);
        if (choice === 1) await this.giveXP(hero, xp);
        break;
      }
      case 'artifact': {
        const a = ARTIFACTS[o.artifact];
        giveArtifact(hero, o.artifact);
        sfx('pickup');
        this.removeObject(o.id);
        await this.say(hero, {
          title: a.name, text: `${hero.name} ${g(hero, 'מצא', 'מצאה')} חפץ: <b>${a.name}</b>.<br><i>${a.desc}</i><br>${artifactBonusText(a)}`,
          artifact: o.artifact,
        });
        break;
      }
      case 'monster': await this.fightMonster(hero, o); break;
      case 'mine': {
        if (o.owner === hero.owner) {
          await this.say(hero, { title: name, text: `${name} כבר בבעלותך. ${MINES[o.resource].desc}`, icons: [{ icon: o.resource, label: `+${MINES[o.resource].income} ליום` }] });
          break;
        }
        o.owner = hero.owner;
        this.view?.setObjectOwner?.(o.id);
        sfx('flag');
        await this.say(hero, { title: name, text: `${hero.name} ${g(hero, 'השתלט', 'השתלטה')} על ${name}! ${MINES[o.resource].desc}`, icons: [{ icon: o.resource, label: `+${MINES[o.resource].income} ליום` }] });
        break;
      }
      case 'dwelling': {
        if (o.owner !== hero.owner) { o.owner = hero.owner; this.view?.setObjectOwner?.(o.id); sfx('flag'); }
        const c = CREATURES[o.creature];
        if (human) await this.ui.recruitDwelling(o, hero);
        else this.aiRecruitDwelling(hero, o);
        void c;
        break;
      }
      case 'windmill': case 'waterwheel': {
        const wk = Math.floor((s.day - 1) / 7);
        if (o.lastWeek === wk) { await this.say(hero, { title: name, text: 'כבר ביקרת כאן השבוע. חזור בשבוע הבא.' }); break; }
        o.lastWeek = wk;
        if (o.type === 'windmill') {
          const res = this.rng.pick(['mercury', 'sulfur', 'crystal', 'gems']);
          const n = this.rng.int(3, 6);
          player.resources[res] += n;
          sfx('pickup');
          await this.say(hero, { title: name, text: 'הטוחן מברך אותך ומעניק לך משאבים נדירים שאסף.', icons: [{ icon: res, label: `${n}` }] });
        } else {
          player.resources.gold += 1000;
          sfx('gold');
          await this.say(hero, { title: name, text: 'גלגל המים מסתובב בשקט. הטוחן משלם לך את חלקך.', icons: [{ icon: 'gold', label: '1000' }] });
        }
        break;
      }
      case 'well': {
        if (hero.visited[o.id] === s.day || hero.mana >= heroMaxMana(hero)) { await this.say(hero, { title: name, text: 'שתית מן הבאר, אך דבר לא השתנה.' }); break; }
        hero.visited[o.id] = s.day;
        hero.mana = heroMaxMana(hero);
        sfx('heal');
        await this.say(hero, { title: name, text: 'מימיה הצוננים של הבאר מחזירים את כל נקודות הקסם.', icons: [{ icon: 'mana', label: `${hero.mana}` }] });
        break;
      }
      case 'shrine': {
        const sp = SPELLS[o.spell];
        if (hero.spells.includes(o.spell)) { await this.say(hero, { title: name, text: `הכוהן מבקש ללמדך את "${sp.name}", אך את הלחש הזה כבר ידעת.` }); break; }
        if (!canLearnSpell(hero, o.spell)) { await this.say(hero, { title: name, text: `הכוהן מבקש ללמדך את "${sp.name}", אך נדרשת לשם כך חוכמה רבה יותר.`, icons: [{ icon: 'wisdom', label: 'חוכמה' }] }); break; }
        hero.spells.push(o.spell);
        sfx('spell');
        await this.say(hero, { title: name, text: `הכוהן הזקן לימד את ${hero.name} את הלחש "${sp.name}".<br><i>${sp.desc(1)}</i>`, icons: [{ icon: o.spell, label: sp.name }] });
        break;
      }
      case 'learningStone': {
        if (hero.visited[o.id]) { await this.say(hero, { title: name, text: 'כבר קראת את הכתובות שעל האבן.' }); break; }
        hero.visited[o.id] = true;
        await this.say(hero, { title: name, text: 'הכתובות העתיקות שעל האבן מעשירות את דעתך.', icons: [{ icon: 'xp', label: '1000' }] });
        await this.giveXP(hero, 1000);
        break;
      }
      case 'marlettoTower': case 'mercenaryCamp': case 'starAxis': case 'gardenOfRevelation': {
        const stat = { marlettoTower: 'defense', mercenaryCamp: 'attack', starAxis: 'power', gardenOfRevelation: 'knowledge' }[o.type];
        const label = { attack: 'התקפה', defense: 'הגנה', power: 'כוח קסם', knowledge: 'ידע' }[stat];
        if (hero.visited[o.id]) { await this.say(hero, { title: name, text: `${hero.name} כבר ${g(hero, 'ביקר', 'ביקרה')} כאן.` }); break; }
        hero.visited[o.id] = true;
        hero[stat]++;
        if (stat === 'knowledge') hero.mana = Math.min(heroMaxMana(hero), hero.mana + 10);
        sfx('buff');
        await this.say(hero, { title: name, text: `${{ marlettoTower: 'אימון עם שומרי המגדל', mercenaryCamp: 'תרגילי הקרב של שכירי החרב', starAxis: 'התבוננות בכוכבים', gardenOfRevelation: 'שלוות הגן' }[o.type]} ${g(hero, 'מעניקה לך', 'מעניקה לך')} +1 ${label}.`, icons: [{ icon: stat, label: `+1 ${label}` }] });
        break;
      }
      case 'witchHut': {
        const sk = SKILLS[o.skill];
        if (hero.visited[o.id]) { await this.say(hero, { title: name, text: 'המכשפה מצחקקת: "כבר לימדתי אותך כל מה שאני יודעת!"' }); break; }
        const has = hero.skills.find((k) => k.id === o.skill);
        if (has) { await this.say(hero, { title: name, text: `המכשפה רצתה ללמד אותך ${sk.name}, אך כישור זה כבר מוכר לך.` }); hero.visited[o.id] = true; break; }
        if (!learnSkill(hero, o.skill)) { await this.say(hero, { title: name, text: 'אין לך מקום לכישורים נוספים.' }); break; }
        hero.visited[o.id] = true;
        sfx('levelup');
        await this.say(hero, { title: name, text: `המכשפה לימדה את ${hero.name} את הכישור <b>${sk.name} (${SKILL_LEVELS[1]})</b>.<br><i>${sk.desc[1]}</i>`, icons: [{ icon: o.skill, label: sk.name }] });
        break;
      }
      case 'treeOfKnowledge': {
        if (hero.visited[o.id]) { await this.say(hero, { title: name, text: 'כבר טעמת מפרי עץ הדעת.' }); break; }
        hero.visited[o.id] = true;
        const need = xpForLevel(hero.level + 1) - hero.xp;
        await this.say(hero, { title: name, text: `${hero.name} ${g(hero, 'טועם', 'טועמת')} מפרי עץ הדעת — ועיניו נפקחות. דרגה נוספת!`, icons: [{ icon: 'xp', label: '+1 דרגה' }] });
        hero.xp += need;
        await this.checkLevelUp(hero);
        break;
      }
      case 'stables': {
        const wk = Math.floor((s.day - 1) / 7);
        if (hero.visited[o.id] === wk) { await this.say(hero, { title: name, text: 'הסוסים עדיין נחים מהביקור הקודם.' }); break; }
        hero.visited[o.id] = wk;
        hero.mp += 500;
        sfx('step');
        await this.say(hero, { title: name, text: 'סוסים רעננים ממתינים לך! +500 נקודות תנועה.', icons: [{ icon: 'movement', label: '+500' }] });
        break;
      }
      case 'fountain': {
        if (hero.visited[o.id]) { await this.say(hero, { title: name, text: 'כבר זרקת מטבע למזרקה.' }); break; }
        hero.visited[o.id] = true;
        hero.tempLuck = 2;
        sfx('buff');
        await this.say(hero, { title: name, text: 'זרקת מטבע למזרקה ושמעת צחוק עדין. +2 מזל בקרב הבא.', icons: [{ icon: 'luck', label: '+2' }] });
        break;
      }
      case 'temple': {
        if (hero.visited[o.id]) { await this.say(hero, { title: name, text: 'כבר התפללת במקדש.' }); break; }
        hero.visited[o.id] = true;
        hero.tempMorale = 2;
        sfx('buff');
        await this.say(hero, { title: name, text: 'התפילה במקדש מחזקת את לב הלוחמים. +2 מורל בקרב הבא.', icons: [{ icon: 'morale', label: '+2' }] });
        break;
      }
      case 'lookout': {
        reveal(s, hero.owner, o.x, o.y, 14);
        if (human) this.view?.updateFog?.();
        await this.say(hero, { title: name, text: 'מראש המגדל נגלה אליך שטח רחב של הממלכה.' });
        break;
      }
      case 'sign': await this.say(hero, { title: 'שלט', text: `<i>"${o.text}"</i>` }); break;
      case 'prison': {
        if (playerHeroes(s, hero.owner).length >= MAX_HEROES) { await this.say(hero, { title: name, text: 'יש לך יותר מדי גיבורים כדי לשחרר את האסיר.' }); break; }
        const pos = this.freeAdjacent(o.x, o.y);
        const r = HERO_ROSTER.find((x) => x.id === o.heroRoster);
        this.removeObject(o.id);
        const nh = createHero(s, o.heroRoster, hero.owner, (pos || o).x, (pos || o).y, { army: false });
        nh.army[0] = { type: FACTION_LINEUP[HERO_CLASSES[r.cls].faction][0], count: 5 };
        for (let L = 1; L < o.level; L++) { nh.xp = xpForLevel(L + 1); applyLevelUp(nh, rollLevelUp(nh, this.rng), 0); }
        nh.mp = 0;
        rebuildIndex(s);
        this.revealForHero(nh);
        this.view?.addHero?.(nh);
        sfx('levelup');
        await this.say(hero, { title: name, text: `${hero.name} ${g(hero, 'שחרר', 'שחררה')} את ${nh.name}, ${heroTitle(nh)} בדרגה ${nh.level}, ${g(nh, 'שמצטרף', 'שמצטרפת')} אליך בהכרת תודה!`, hero: nh });
        this.ui.refresh?.();
        break;
      }
      case 'teleport': {
        const target = this.obj(o.target);
        const pos = target && this.freeAdjacent(target.x, target.y);
        if (!pos) { await this.say(hero, { title: name, text: 'השער מהבהב, אך הצד השני חסום.' }); break; }
        sfx('teleport');
        this.placeHero(hero, pos.x, pos.y);
        this.view?.snapHero?.(hero, true);
        this.revealForHero(hero);
        if (human) this.view?.centerOn?.(pos.x, pos.y);
        break;
      }
      case 'pandora': await this.openPandora(hero, o); break;
      case 'crypt': await this.exploreCrypt(hero, o); break;
      default: break;
    }
    this.ui.refresh?.();
  }

  async openPandora(hero, o) {
    const human = this.isHuman(hero.owner);
    const player = this.playerOf(hero);
    if (human) {
      const ok = await this.ui.confirm({ title: 'תיבת פנדורה', text: 'לפניך תיבה עתיקה ומעוטרת. מבפנים בוקע אור מוזר. לפתוח אותה?' });
      if (!ok) return;
    }
    const c = o.content;
    if (c.kind === 'battle') {
      if (human) await this.ui.message({ title: 'תיבת פנדורה', text: 'מתוך התיבה פורצים יצורים זועמים!' });
      const army = emptyArmy(); army[0] = { type: c.creature, count: Math.ceil(c.count / 2) }; army[1] = { type: c.creature, count: Math.floor(c.count / 2) };
      const res = await this.fight(hero, { army, owner: null, name: 'יצורי פנדורה' }, 'pandora');
      if (!res.attackerWon) return;
      player.resources.gold += c.gold;
      this.removeObject(o.id);
      await this.say(hero, { title: 'תיבת פנדורה', text: 'בתחתית התיבה מחכה אוצר!', icons: [{ icon: 'gold', label: `${c.gold}` }] });
      return;
    }
    this.removeObject(o.id);
    switch (c.kind) {
      case 'gold': player.resources.gold += c.gold; await this.say(hero, { title: 'תיבת פנדורה', text: 'התיבה מלאה זהב!', icons: [{ icon: 'gold', label: `${c.gold}` }] }); break;
      case 'xp': await this.say(hero, { title: 'תיבת פנדורה', text: 'אור מסנוור פורץ מהתיבה ומעניק לך חוכמה.', icons: [{ icon: 'xp', label: `${c.xp}` }] }); await this.giveXP(hero, c.xp); break;
      case 'resources': addRes(player.resources, c.res); await this.say(hero, { title: 'תיבת פנדורה', text: 'בתיבה משאבים רבים!', icons: Object.entries(c.res).map(([k, v]) => ({ icon: k, label: `${v}` })) }); break;
      case 'creatures': {
        if (armyAdd(hero.army, c.creature, c.count)) await this.say(hero, { title: 'תיבת פנדורה', text: `${c.count} ${creatureName(c.creature, c.count)} יוצאים מהתיבה ומצטרפים לצבאך!`, creature: c.creature });
        else await this.say(hero, { title: 'תיבת פנדורה', text: 'יצורים יצאו מהתיבה, אך לא היה להם מקום בצבאך והם הלכו לדרכם.' });
        break;
      }
      case 'spell': {
        if (canLearnSpell(hero, c.spell)) { hero.spells.push(c.spell); await this.say(hero, { title: 'תיבת פנדורה', text: `בתיבה מגילה עתיקה. למדת את הלחש "${SPELLS[c.spell].name}"!`, icons: [{ icon: c.spell, label: SPELLS[c.spell].name }] }); }
        else await this.say(hero, { title: 'תיבת פנדורה', text: 'בתיבה מגילה עתיקה, אך אינך מצליח לפענח אותה.' });
        break;
      }
    }
  }

  async exploreCrypt(hero, o) {
    const human = this.isHuman(hero.owner);
    if (o.looted) { await this.say(hero, { title: 'קריפטה', text: 'הקריפטה ריקה. רק עכבישים ואבק נותרו.' }); return; }
    if (human) {
      const ok = await this.ui.confirm({ title: 'קריפטה', text: 'קבר עתיק ואפל. מבפנים נשמעות לחישות. אל-מתים רבים שומרים על אוצר. להיכנס?' });
      if (!ok) return;
    }
    const army = emptyArmy();
    o.guards.forEach(([t, n], i) => { army[i] = { type: t, count: n }; });
    const res = await this.fight(hero, { army, owner: null, name: 'שומרי הקריפטה' }, 'crypt');
    if (!res.attackerWon) {
      // update remaining guards
      o.guards = army.filter(Boolean).map((st) => [st.type, st.count]);
      return;
    }
    o.looted = true;
    const player = this.playerOf(hero);
    player.resources.gold += o.reward.gold;
    giveArtifact(hero, o.reward.artifact);
    this.view?.setObjectOwner?.(o.id);
    await this.say(hero, { title: 'קריפטה', text: `בין הארונות מצאת ${o.reward.gold} זהב ואת החפץ <b>${ARTIFACTS[o.reward.artifact].name}</b>.`, artifact: o.reward.artifact });
  }

  aiRecruitDwelling(hero, o) {
    const c = CREATURES[o.creature];
    const player = this.playerOf(hero);
    const n = Math.min(o.available, Math.floor(player.resources.gold / c.cost.gold));
    if (n > 0 && armyCanAdd(hero.army, o.creature) && player.resources.gold - n * c.cost.gold > 2000) {
      armyAdd(hero.army, o.creature, n);
      player.resources.gold -= n * c.cost.gold;
      o.available -= n;
    }
  }

  // ===================================================================== monsters
  async fightMonster(hero, m) {
    const human = this.isHuman(hero.owner);
    const c = CREATURES[m.creature];
    const strength = heroStrength(hero);
    const mval = m.count * c.value;
    // compliant monsters may offer to join
    if (m.disposition === 'compliant' && strength > mval * 1.8 && armyCanAdd(hero.army, m.creature)) {
      const cost = m.count * c.cost.gold;
      const player = this.playerOf(hero);
      let accept = false;
      if (human) {
        if (player.resources.gold >= cost) {
          accept = await this.ui.confirm({ title: `${c.plural}`, text: `ה${c.plural} מתרשמים מצבאך ומציעים להצטרף אליך תמורת ${cost} זהב. לקבל את הצעתם?`, creature: m.creature, count: m.count });
        }
      } else accept = player.resources.gold > cost + 3000;
      if (accept) {
        player.resources.gold -= cost;
        armyAdd(hero.army, m.creature, m.count);
        this.removeObject(m.id);
        this.ui.refresh?.();
        return;
      }
    }
    // weak monsters flee from a mighty army
    if (m.disposition !== 'savage' && strength > mval * 5) {
      let pursue = true;
      if (human) pursue = await this.ui.confirm({ title: c.plural, text: `ה${c.plural} נבהלים מעוצמת צבאך ומנסים לברוח. לרדוף אחריהם?`, creature: m.creature, count: m.count, yes: 'לרדוף', no: 'לתת להם לברוח' });
      else pursue = false;
      if (!pursue) { this.removeObject(m.id); return; }
    }
    const army = emptyArmy();
    // split monsters into several stacks like HoMM3
    const stacks = Math.max(1, Math.min(m.count, m.count > 30 ? 5 : m.count > 10 ? 4 : m.count > 3 ? 3 : m.count));
    let left = m.count;
    for (let i = 0; i < stacks; i++) {
      const n = i === stacks - 1 ? left : Math.floor(m.count / stacks);
      army[i] = { type: m.creature, count: n }; left -= n;
    }
    const res = await this.fight(hero, { army, owner: null, name: `${stackSizeWord(m.count)} ${c.plural}` }, 'monster', m);
    if (res.attackerWon) this.removeObject(m.id);
    else { m.count = armyTotal(army); if (m.count <= 0) this.removeObject(m.id); }
    this.view?.refreshObject?.(m.id);
  }

  // ===================================================================== heroes meeting / towns
  async meetHero(hero, other) {
    if (!other || !other.alive) return;
    if (other.owner === hero.owner) {
      if (this.isHuman(hero.owner)) await this.ui.heroMeet(hero, other);
      return;
    }
    // enemy hero: battle. if the defender stands in a town, attack the town instead
    const town = this.townAt(other.x, other.y);
    if (town) { await this.attackTown(hero, town); return; }
    const res = await this.fight(hero, { hero: other, army: other.army, owner: other.owner }, 'hero');
    void res;
  }

  async enterTown(hero, town) {
    if (!town) return;
    if (town.owner === hero.owner) {
      this.visitOwnTown(hero, town);
      if (this.isHuman(hero.owner)) await this.ui.openTown(town, hero);
      return;
    }
    await this.attackTown(hero, town);
  }

  visitOwnTown(hero, town) {
    // learn guild spells
    const learned = [];
    const lvl = townMageLevel(town);
    for (let L = 1; L <= lvl; L++) for (const sp of town.guild[L]) if (canLearnSpell(hero, sp)) { hero.spells.push(sp); learned.push(sp); }
    if (lvl > 0) hero.mana = Math.max(hero.mana, heroMaxMana(hero));
    // stables
    if (hasBuilt(town, 'special') && town.faction === 'castle' && !town.stablesVisited[hero.id]) {
      town.stablesVisited[hero.id] = true;
      hero.mp += 500;
    }
    if (learned.length && this.isHuman(hero.owner)) this.ui.toast?.(`${hero.name} ${g(hero, 'למד', 'למדה')} ${learned.length} לחשים חדשים בגילדת הקוסמים.`);
    return learned;
  }

  async attackTown(hero, town) {
    const s = this.state;
    const defenderHeroId = s.heroAt[idx(s, town.entrance.x, town.entrance.y)];
    const defHero = defenderHeroId && defenderHeroId !== hero.id ? this.hero(defenderHeroId) : null;
    if (defHero && defHero.owner !== hero.owner) {
      const r = await this.fight(hero, { hero: defHero, army: defHero.army, owner: defHero.owner, town }, 'town');
      if (!r.attackerWon || !hero.alive) return;
    }
    if (armyTotal(town.garrison) > 0) {
      const r = await this.fight(hero, { hero: null, army: town.garrison, owner: town.owner, town, name: `חיל המצב של ${town.name}` }, 'town');
      if (!r.attackerWon || !hero.alive) return;
    }
    // capture
    const prevOwner = town.owner;
    town.owner = hero.owner;
    town.garrison = emptyArmy();
    this.placeHero(hero, town.entrance.x, town.entrance.y);
    this.view?.snapHero?.(hero);
    this.view?.setObjectOwner?.(town.id);
    this.revealForHero(hero);
    reveal(s, hero.owner, town.x, town.y, 8);
    if (this.isHuman(hero.owner)) this.view?.updateFog?.();
    this.ui.sfx?.('flag');
    if (this.isHuman(hero.owner)) await this.ui.message({ title: 'העיר נכבשה!', text: `${hero.name} ${g(hero, 'כבש', 'כבשה')} את העיר <b>${town.name}</b>! הדגל שלך מתנופף מעל החומות.`, town: town.faction });
    else if (this.isHuman(prevOwner)) await this.ui.message({ title: 'אבדה עיר!', text: `העיר <b>${town.name}</b> נפלה בידי ${hero.name}! יש לך 7 ימים לכבוש עיר כלשהי לפני שתובס.`, town: town.faction });
    this.checkElimination();
    this.ui.refresh?.();
  }

  // ===================================================================== battle
  /**
   * attacker: hero; defender: { hero?, army, owner, town?, name }
   * Returns { attackerWon, battle }
   */
  async fight(hero, defender, kind, monsterObj = null) {
    const s = this.state;
    const terrainKey = s.map.terrain[idx(s, hero.x, hero.y)];
    const terrain = TERRAINS[terrainKey]?.battle || 'grass';
    const humanInvolved = this.isHuman(hero.owner) || this.isHuman(defender.owner);
    const towers = defender.town ? townTowers(defender.town) : 0;
    const setup = {
      terrain, towers, towerBonus: defender.town ? defender.town.built.filter((b) => b.startsWith('dw')).length * 2 : 0,
      kind,
      sides: [
        { hero, army: hero.army, owner: hero.owner, ai: !this.isHuman(hero.owner), name: hero.name },
        { hero: defender.hero || null, army: defender.army, owner: defender.owner, ai: !this.isHuman(defender.owner), name: defender.hero ? defender.hero.name : (defender.name || 'יצורים') },
      ],
      town: defender.town || null,
    };
    let battle;
    if (humanInvolved) {
      battle = new Battle(setup);
      await this.ui.battle(battle, setup);
    } else {
      battle = new Battle(setup);
      runAutoBattle(battle);
    }
    const result = battle.result || { winner: 1 };
    const summary = battle.applyResults();
    const attackerWon = result.winner === 0;
    const winnerHero = attackerWon ? hero : defender.hero;
    const loserHero = attackerWon ? defender.hero : hero;
    // reset temp bonuses
    hero.tempMorale = 0; hero.tempLuck = 0;
    if (defender.hero) { defender.hero.tempMorale = 0; defender.hero.tempLuck = 0; }

    // necromancy
    let raised = 0;
    if (winnerHero && winnerHero.alive && skillLevel(winnerHero, 'necromancy') > 0) {
      const enemySide = attackerWon ? 1 : 0;
      let pct = skillValue(winnerHero, 'necromancy');
      if (playerTowns(s, winnerHero.owner).some((t) => t.faction === 'necropolis' && hasBuilt(t, 'special'))) pct += 0.1;
      let hpSum = 0;
      for (const [type, n] of Object.entries(summary[enemySide].lost)) if (!CREATURES[type].abilities.undead) hpSum += n * Math.min(CREATURES[type].hp, 30);
      raised = Math.floor(hpSum * pct / 6);
      if (raised > 0 && !armyAdd(winnerHero.army, 'skeleton', raised)) {
        if (!armyAdd(winnerHero.army, 'skeletonWarrior', raised)) raised = 0;
      }
    }

    // XP
    const xpWin = summary[attackerWon ? 0 : 1].killedHp + (loserHero ? 500 : 0);
    if (loserHero) {
      if (result.fled === (attackerWon ? 1 : 0) && loserHero) {
        loserHero.fled = true;
      }
      this.killHero(loserHero, winnerHero);
    }
    if (humanInvolved) this.ui.refresh?.();
    if (raised > 0 && this.isHuman(winnerHero.owner)) {
      await this.ui.message({ title: 'נקרומנסיה', text: `${winnerHero.name} ${g(winnerHero, 'הקים', 'הקימה')} ${raised} שלדים מבין חללי הקרב.`, creature: 'skeleton' });
    }
    if (winnerHero && winnerHero.alive) await this.giveXP(winnerHero, xpWin);
    this.checkElimination();
    this.view?.refreshAll?.();
    return { attackerWon, battle, summary };
  }

  // ===================================================================== xp / levels
  async giveXP(hero, amount) {
    if (!hero.alive || amount <= 0) return;
    gainXP(hero, amount);
    await this.checkLevelUp(hero);
  }
  async checkLevelUp(hero) {
    while (hero.xp >= xpForLevel(hero.level + 1)) {
      const roll = rollLevelUp(hero, this.rng);
      let choice = 0;
      if (this.isHuman(hero.owner)) {
        this.ui.sfx?.('levelup');
        choice = await this.ui.levelUp(hero, roll);
      } else {
        const w = HERO_CLASSES[hero.cls].skillWeights;
        choice = roll.options.length > 1 && (w[roll.options[1].id] || 0) > (w[roll.options[0].id] || 0) ? 1 : 0;
      }
      applyLevelUp(hero, roll, choice);
      hero.mana = Math.min(hero.mana + 0, heroMaxMana(hero));
    }
    this.ui.refresh?.();
  }

  // ===================================================================== tavern
  hireHero(pid, town, rosterId) {
    const s = this.state;
    const p = s.players[pid];
    if (p.resources.gold < HERO_COST) return null;
    if (playerHeroes(s, pid).length >= MAX_HEROES) return null;
    const ex = town.entrance;
    if (s.heroAt[idx(s, ex.x, ex.y)]) return null;
    p.resources.gold -= HERO_COST;
    p.tavern = p.tavern.filter((r) => r !== rosterId);
    const h = createHero(s, rosterId, pid, ex.x, ex.y, { rng: this.rng });
    s.heroAt[idx(s, ex.x, ex.y)] = h.id;
    s.usedHeroes = [...(s.usedHeroes || []), rosterId];
    refreshTavern(s, pid, this.rng);
    this.revealForHero(h);
    this.view?.addHero?.(h);
    this.visitOwnTown(h, town);
    return h;
  }
}

function skillLevel(hero, id) {
  const s = hero.skills.find((k) => k.id === id);
  return s ? s.level : 0;
}

export { RESOURCES, armyValue, armyStacks, canAfford, pay, rand };
