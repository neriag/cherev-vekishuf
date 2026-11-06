// ============================================================================
//  לחשים
// ============================================================================
//  target: 'enemy' | 'ally' | 'any' | 'area' (hex + neighbours) | 'ring' (neighbours only) | 'all' | 'allEnemies'
//  kind:   'damage' | 'buff' | 'debuff' | 'heal' | 'resurrect'
//  vfx:    visual effect id used by the battle view

export const SPELLS = {
  magicArrow: {
    name: 'חץ קסם', level: 1, mana: 5, target: 'enemy', kind: 'damage', vfx: 'arrow', color: '#b48cff',
    dmg: (sp) => 10 + 10 * sp, desc: (sp) => `חץ אנרגיה קסומה הגורם ${10 + 10 * sp} נזק.`,
  },
  cure: {
    name: 'ריפוי', level: 1, mana: 6, target: 'ally', kind: 'heal', vfx: 'heal', color: '#7dffb0',
    heal: (sp) => 10 + 5 * sp, desc: (sp) => `מרפא ${10 + 5 * sp} נקודות חיים ומסיר השפעות שליליות.`,
  },
  bless: {
    name: 'ברכה', level: 1, mana: 5, target: 'ally', kind: 'buff', vfx: 'buff', color: '#ffe27a',
    effect: 'bless', desc: () => 'היחידה גורמת תמיד נזק מרבי.',
  },
  curse: {
    name: 'קללה', level: 1, mana: 6, target: 'enemy', kind: 'debuff', vfx: 'debuff', color: '#8c3cff',
    effect: 'curse', desc: () => 'היחידה גורמת תמיד נזק מזערי.',
  },
  stoneSkin: {
    name: 'עור אבן', level: 1, mana: 5, target: 'ally', kind: 'buff', vfx: 'buff', color: '#c9b48a',
    effect: 'stoneSkin', desc: () => '+3 הגנה ליחידה.',
  },
  haste: {
    name: 'זריזות', level: 1, mana: 6, target: 'ally', kind: 'buff', vfx: 'buff', color: '#9ef0ff',
    effect: 'haste', desc: () => '+3 מהירות ליחידה.',
  },
  slow: {
    name: 'האטה', level: 1, mana: 6, target: 'enemy', kind: 'debuff', vfx: 'debuff', color: '#5a7cff',
    effect: 'slow', desc: () => 'מהירות היחידה יורדת ב-40%.',
  },
  bloodlust: {
    name: 'צמא דם', level: 1, mana: 5, target: 'ally', kind: 'buff', vfx: 'buff', color: '#ff5a4a',
    effect: 'bloodlust', desc: () => '+3 התקפה בקרב צמוד.',
  },
  lightningBolt: {
    name: 'ברק', level: 2, mana: 10, target: 'enemy', kind: 'damage', vfx: 'lightning', color: '#bfe6ff',
    dmg: (sp) => 10 + 25 * sp, desc: (sp) => `ברק מן השמיים הגורם ${10 + 25 * sp} נזק.`,
  },
  blind: {
    name: 'עיוורון', level: 2, mana: 10, target: 'enemy', kind: 'debuff', vfx: 'debuff', color: '#444',
    effect: 'blind', mind: true, desc: () => 'היחידה אינה פועלת עד שתותקף.',
  },
  weakness: {
    name: 'חולשה', level: 2, mana: 8, target: 'enemy', kind: 'debuff', vfx: 'debuff', color: '#88aa55',
    effect: 'weakness', desc: () => '-3 התקפה ליחידת האויב.',
  },
  fireball: {
    name: 'כדור אש', level: 3, mana: 15, target: 'area', kind: 'damage', vfx: 'fireball', color: '#ff7a2a',
    dmg: (sp) => 15 + 10 * sp, desc: (sp) => `כדור אש מתפוצץ הגורם ${15 + 10 * sp} נזק למטרה ולכל הסובבים אותה.`,
  },
  frostRing: {
    name: 'טבעת כפור', level: 3, mana: 12, target: 'ring', kind: 'damage', vfx: 'frost', color: '#9ad8ff',
    dmg: (sp) => 15 + 10 * sp, desc: (sp) => `טבעת קרח הגורמת ${15 + 10 * sp} נזק לכל המשבצות סביב המטרה (לא למרכז).`,
  },
  prayer: {
    name: 'תפילה', level: 3, mana: 16, target: 'ally', kind: 'buff', vfx: 'buff', color: '#fff3b0',
    effect: 'prayer', desc: () => '+2 התקפה, הגנה ומהירות ליחידה.',
  },
  meteorShower: {
    name: 'גשם מטאורים', level: 4, mana: 16, target: 'area', kind: 'damage', vfx: 'meteor', color: '#ff5a1f',
    dmg: (sp) => 25 + 25 * sp, desc: (sp) => `סלעים בוערים נופלים מהשמיים: ${25 + 25 * sp} נזק לאזור.`,
  },
  chainLightning: {
    name: 'שרשרת ברקים', level: 4, mana: 24, target: 'enemy', kind: 'damage', vfx: 'chain', color: '#d4f0ff',
    dmg: (sp) => 25 + 40 * sp, desc: (sp) => `ברק הקופץ בין 4 יחידות: ${25 + 40 * sp} נזק לראשונה, וחצי בכל קפיצה.`,
  },
  resurrection: {
    name: 'תחייה', level: 4, mana: 20, target: 'ally', kind: 'resurrect', vfx: 'heal', color: '#fff6a0',
    heal: (sp) => 40 + 20 * sp, desc: (sp) => `מקים לתחייה יצורים שנפלו בשווי ${40 + 20 * sp} נקודות חיים.`,
  },
  armageddon: {
    name: 'יום הדין', level: 4, mana: 24, target: 'all', kind: 'damage', vfx: 'armageddon', color: '#ff3a1a',
    dmg: (sp) => 30 + 50 * sp, desc: (sp) => `אש מן השמיים פוגעת בכל היחידות בשדה: ${30 + 50 * sp} נזק.`,
  },
  implosion: {
    name: 'קריסה', level: 4, mana: 30, target: 'enemy', kind: 'damage', vfx: 'implosion', color: '#c070ff',
    dmg: (sp) => 100 + 75 * sp, desc: (sp) => `מועך את היחידה מבפנים: ${100 + 75 * sp} נזק.`,
  },
};

for (const [id, s] of Object.entries(SPELLS)) s.id = id;

export const SPELL_LEVEL_NAMES = ['', 'דרגה 1', 'דרגה 2', 'דרגה 3', 'דרגה 4'];

export const EFFECT_NAMES = {
  bless: 'ברכה', curse: 'קללה', stoneSkin: 'עור אבן', haste: 'זריזות', slow: 'האטה', bloodlust: 'צמא דם',
  blind: 'עיוורון', weakness: 'חולשה', prayer: 'תפילה', disease: 'מחלה', defending: 'בהגנה',
};

export function spellsOfLevel(level) {
  return Object.values(SPELLS).filter((s) => s.level === level).map((s) => s.id);
}

export function spellDuration(sp) {
  return Math.max(2, sp);
}
