// ============================================================================
//  מבני העיר — עץ בנייה לכל פלג
// ============================================================================

// Shared (non-dwelling) buildings. Names may be overridden per faction.
const COMMON = {
  hall1: { name: 'היכל הכפר', cost: { gold: 0 }, requires: [], income: 500, desc: 'מכניס 500 זהב ביום.', group: 'hall' },
  hall2: { name: 'היכל העירייה', cost: { gold: 2500 }, requires: ['hall1'], income: 1000, replaces: 'hall1', desc: 'מכניס 1000 זהב ביום.', group: 'hall' },
  hall3: { name: 'בית המועצה', cost: { gold: 5000 }, requires: ['hall2', 'marketplace', 'mage1', 'blacksmith'], income: 2000, replaces: 'hall2', desc: 'מכניס 2000 זהב ביום.', group: 'hall' },
  hall4: { name: 'הקפיטול', cost: { gold: 10000 }, requires: ['hall3', 'castle'], income: 4000, replaces: 'hall3', desc: 'מכניס 4000 זהב ביום. מושב השלטון של הממלכה.', group: 'hall' },
  fort: { name: 'מצודה', cost: { gold: 5000, wood: 20, ore: 20 }, requires: [], desc: 'חומות מגן לעיר. נדרשת למבני מגורים.', group: 'fort' },
  citadel: { name: 'מבצר', cost: { gold: 2500, ore: 5 }, requires: ['fort'], replaces: 'fort', desc: '+50% לגידול היצורים. מגדל חיצים מגן על העיר במצור.', group: 'fort' },
  castle: { name: 'טירה', cost: { gold: 5000, wood: 10, ore: 10 }, requires: ['citadel'], replaces: 'citadel', desc: '+100% לגידול היצורים. שני מגדלי חיצים.', group: 'fort' },
  tavern: { name: 'טברנה', cost: { gold: 500, wood: 5 }, requires: [], desc: 'כאן ניתן לגייס גיבורים חדשים ולשמוע שמועות.', group: 'tavern' },
  marketplace: { name: 'שוק', cost: { gold: 500, wood: 5 }, requires: [], desc: 'מאפשר סחר במשאבים. ככל שיש לך יותר שווקים — כך השערים טובים יותר.', group: 'market' },
  silo: { name: 'מחסן משאבים', cost: { gold: 5000, ore: 5 }, requires: ['marketplace'], desc: 'מוסיף עץ אחד ועפרה אחת בכל יום.', group: 'market', resIncome: { wood: 1, ore: 1 } },
  blacksmith: { name: 'נפחייה', cost: { gold: 1000, wood: 5 }, requires: [], desc: 'מספקת נשק ושריון. נדרשת לשדרוג יחידות.', group: 'smith' },
  mage1: { name: 'גילדת הקוסמים (דרגה א\')', cost: { gold: 2000, wood: 5, ore: 5 }, requires: [], desc: 'מלמדת לחשים מדרגה 1 לגיבורים המבקרים.', group: 'mage', mageLevel: 1 },
  mage2: { name: 'גילדת הקוסמים (דרגה ב\')', cost: { gold: 1000, wood: 5, ore: 5, crystal: 4, gems: 4, mercury: 4, sulfur: 4 }, requires: ['mage1'], replaces: 'mage1', desc: 'מלמדת לחשים מדרגה 2.', group: 'mage', mageLevel: 2 },
  mage3: { name: 'גילדת הקוסמים (דרגה ג\')', cost: { gold: 1000, wood: 5, ore: 5, crystal: 6, gems: 6, mercury: 6, sulfur: 6 }, requires: ['mage2'], replaces: 'mage2', desc: 'מלמדת לחשים מדרגה 3.', group: 'mage', mageLevel: 3 },
  mage4: { name: 'גילדת הקוסמים (דרגה ד\')', cost: { gold: 1000, wood: 5, ore: 5, crystal: 8, gems: 8, mercury: 8, sulfur: 8 }, requires: ['mage3'], replaces: 'mage3', desc: 'מלמדת לחשים מדרגה 4 — העוצמתיים ביותר.', group: 'mage', mageLevel: 4 },
};

const DWELLINGS = {
  castle: {
    dw1: { name: 'בית המשמר', cost: { gold: 500, ore: 10 }, requires: ['fort'] },
    dw1u: { name: 'בית משמר משודרג', cost: { gold: 1000, ore: 5 }, requires: ['dw1', 'blacksmith'] },
    dw2: { name: 'מגדל הקשתים', cost: { gold: 1000, wood: 5, ore: 5 }, requires: ['dw1'] },
    dw2u: { name: 'מגדל קשתים משודרג', cost: { gold: 1000, wood: 5, ore: 5 }, requires: ['dw2', 'blacksmith'] },
    dw3: { name: 'מגדל הגריפונים', cost: { gold: 1000, ore: 5 }, requires: ['dw1'] },
    dw3u: { name: 'מגדל גריפונים משודרג', cost: { gold: 1000, ore: 5 }, requires: ['dw3'] },
    dw4: { name: 'קסרקטין', cost: { gold: 2000, ore: 5 }, requires: ['dw1', 'blacksmith'] },
    dw4u: { name: 'קסרקטין משודרג', cost: { gold: 2000, ore: 5, crystal: 5 }, requires: ['dw4'] },
    dw5: { name: 'מנזר', cost: { gold: 3000, wood: 5, ore: 5, crystal: 2, gems: 2, mercury: 2, sulfur: 2 }, requires: ['dw4', 'mage1'] },
    dw5u: { name: 'מנזר משודרג', cost: { gold: 1000, wood: 5, ore: 5, crystal: 2, gems: 2, mercury: 2, sulfur: 2 }, requires: ['dw5'] },
    dw6: { name: 'מגרש האימונים', cost: { gold: 5000, wood: 20 }, requires: ['dw4'] },
    dw6u: { name: 'מגרש אימונים משודרג', cost: { gold: 3000, wood: 10 }, requires: ['dw6'] },
    dw7: { name: 'שער התהילה', cost: { gold: 20000, crystal: 10, gems: 10, mercury: 10, sulfur: 10 }, requires: ['dw5'] },
    dw7u: { name: 'שער התהילה הנשגב', cost: { gold: 20000, crystal: 10, gems: 10, mercury: 10, sulfur: 10 }, requires: ['dw7', 'mage2'] },
    special: { name: 'אורוות', cost: { gold: 2000, wood: 10 }, requires: ['dw6'], desc: 'גיבורים המבקרים בעיר מקבלים 500 נקודות תנועה נוספות פעם בשבוע.' },
  },
  necropolis: {
    dw1: { name: 'מקדש מקולל', cost: { gold: 400, wood: 5, ore: 5 }, requires: ['fort'] },
    dw1u: { name: 'מקדש מקולל משודרג', cost: { gold: 1000, wood: 5, ore: 5 }, requires: ['dw1', 'blacksmith'] },
    dw2: { name: 'בית קברות', cost: { gold: 1000, ore: 5 }, requires: ['dw1'] },
    dw2u: { name: 'בית קברות משודרג', cost: { gold: 1000, wood: 5 }, requires: ['dw2'] },
    dw3: { name: 'קבר הנשמות', cost: { gold: 1500, wood: 5, ore: 5 }, requires: ['dw1'] },
    dw3u: { name: 'קבר נשמות משודרג', cost: { gold: 1500, wood: 5, ore: 5, mercury: 5 }, requires: ['dw3'] },
    dw4: { name: 'אחוזת האופל', cost: { gold: 2000, wood: 10 }, requires: ['dw3', 'blacksmith'] },
    dw4u: { name: 'אחוזת אופל משודרגת', cost: { gold: 2000, wood: 5, crystal: 10, gems: 10 }, requires: ['dw4'] },
    dw5: { name: 'מאוזוליאום', cost: { gold: 2000, wood: 10, ore: 10, sulfur: 10 }, requires: ['dw2', 'mage1'] },
    dw5u: { name: 'מאוזוליאום משודרג', cost: { gold: 2000, wood: 5, ore: 5, sulfur: 5 }, requires: ['dw5'] },
    dw6: { name: 'היכל החושך', cost: { gold: 6000, wood: 10, ore: 10 }, requires: ['dw4'] },
    dw6u: { name: 'היכל חושך משודרג', cost: { gold: 3000, wood: 5, ore: 10, crystal: 5, gems: 5, mercury: 5, sulfur: 5 }, requires: ['dw6'] },
    dw7: { name: 'כוך הדרקונים', cost: { gold: 10000, wood: 5, ore: 5, mercury: 5, crystal: 5, gems: 5, sulfur: 5 }, requires: ['dw5', 'dw6'] },
    dw7u: { name: 'כוך דרקונים משודרג', cost: { gold: 15000, wood: 5, ore: 5, mercury: 20 }, requires: ['dw7', 'mage2'] },
    special: { name: 'מגבר הנשמות', cost: { gold: 1000, ore: 5 }, requires: ['mage1'], desc: '+10% לכישורי הנקרומנסיה של כל גיבורי הנקרופוליס שלך.' },
  },
};

const FACTION_NAME_OVERRIDES = {
  necropolis: {
    hall1: 'אולם הקהל המת', tavern: 'מסבאת הקברנים', marketplace: 'שוק הצללים', blacksmith: 'נפחיית העצמות',
  },
};

import { FACTION_LINEUP, CREATURES } from './creatures.js';

export function getBuildings(faction) {
  const out = {};
  for (const [id, b] of Object.entries(COMMON)) {
    out[id] = { ...b, id, name: FACTION_NAME_OVERRIDES[faction]?.[id] || b.name };
  }
  const lineup = FACTION_LINEUP[faction];
  for (const [id, b] of Object.entries(DWELLINGS[faction])) {
    const entry = { ...b, id, group: 'dwelling' };
    const m = id.match(/^dw(\d)(u?)$/);
    if (m) {
      const tier = +m[1];
      const base = lineup[tier - 1];
      entry.tier = tier;
      entry.upgradeBuilding = !!m[2];
      entry.creature = m[2] ? CREATURES[base].upgradeTo : base;
      if (m[2]) entry.replaces = `dw${tier}`;
      const c = CREATURES[entry.creature];
      entry.desc = m[2]
        ? `מאפשר גיוס ${c.plural} ושדרוג ${CREATURES[base].plural}.`
        : `מאפשר גיוס ${c.plural}. גידול שבועי: ${c.growth}.`;
    } else if (id === 'special') {
      entry.group = 'special';
    }
    out[id] = entry;
  }
  return out;
}

export const BUILD_ORDER = [
  'hall1', 'hall2', 'hall3', 'hall4',
  'fort', 'citadel', 'castle',
  'tavern', 'marketplace', 'silo', 'blacksmith',
  'mage1', 'mage2', 'mage3', 'mage4', 'special',
  'dw1', 'dw1u', 'dw2', 'dw2u', 'dw3', 'dw3u', 'dw4', 'dw4u', 'dw5', 'dw5u', 'dw6', 'dw6u', 'dw7', 'dw7u',
];

/** Display chains: the build screen shows one card per chain (current next step). */
export const BUILD_CHAINS = [
  ['hall1', 'hall2', 'hall3', 'hall4'],
  ['fort', 'citadel', 'castle'],
  ['tavern'], ['blacksmith'], ['marketplace'], ['silo'],
  ['mage1', 'mage2', 'mage3', 'mage4'],
  ['special'],
  ['dw1', 'dw1u'], ['dw2', 'dw2u'], ['dw3', 'dw3u'], ['dw4', 'dw4u'],
  ['dw5', 'dw5u'], ['dw6', 'dw6u'], ['dw7', 'dw7u'],
];

export const STARTING_BUILDINGS = ['hall1', 'fort', 'tavern', 'dw1'];
