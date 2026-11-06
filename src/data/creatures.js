// ============================================================================
//  יצורים — נתוני כל היצורים במשחק
//  ערכים בהשראת HoMM3: התקפה, הגנה, נזק, נקודות חיים, מהירות, גידול שבועי, מחיר
// ============================================================================

export const FACTIONS = {
  castle: {
    id: 'castle',
    name: 'המבצר',
    adjective: 'מבצרי',
    desc: 'ממלכת אור של אבירים, קשתים ומלאכים. צבא ממושמע, אמיץ ומאוזן.',
    color: '#3b6fd8',
    townNames: ['מגדל עוז', 'חומת אור', 'אבן הראשה', 'שער השחר'],
    native: 'grass',
  },
  necropolis: {
    id: 'necropolis',
    name: 'הנקרופוליס',
    adjective: 'נקרופוליסי',
    desc: 'עיר המתים. נקרומנסרים מקימים את חללי הקרב לחיים כשלדים נאמנים.',
    color: '#7a3bb0',
    townNames: ['עמק הבכא', 'צלמוות', 'שערי שאול', 'גיא החושך'],
    native: 'ash',
  },
  neutral: { id: 'neutral', name: 'נייטרלי', adjective: 'נייטרלי' },
};

// abilities:
//  flying, shots (number => shooter), doubleAttack, noRetaliation, retaliations (n), unlimitedRetaliation,
//  undead, regenerate, lifeDrain, jousting, noMeleePenalty, cloudShot (lich), breath, magicResist (0..1),
//  deathBlow, mindImmune, fearAura (-1 morale to enemies), resurrectOnce, hates: [ids], doubleShot
export const CREATURES = {
  // ------------------------------------------------------------------ המבצר
  pikeman: {
    faction: 'castle', tier: 1, upgradeTo: 'halberdier',
    name: 'חניתאי', plural: 'חניתאים',
    attack: 4, defense: 5, minDmg: 1, maxDmg: 3, hp: 10, speed: 4, growth: 14,
    cost: { gold: 60 }, value: 80, abilities: { antiCavalry: true },
    desc: 'חיילי רגלים חמושים בחניתות ארוכות. חסינים לבונוס הדהירה של פרשים.',
  },
  halberdier: {
    faction: 'castle', tier: 1, upgraded: true, base: 'pikeman',
    name: 'רומחאי', plural: 'רומחאים',
    attack: 6, defense: 5, minDmg: 2, maxDmg: 3, hp: 10, speed: 5, growth: 14,
    cost: { gold: 75 }, value: 115, abilities: { antiCavalry: true },
    desc: 'לוחמי רומח מנוסים, חמושים בהלברד כבד. חסינים לבונוס הדהירה.',
  },
  archer: {
    faction: 'castle', tier: 2, upgradeTo: 'marksman',
    name: 'קשת', plural: 'קשתים',
    attack: 6, defense: 3, minDmg: 2, maxDmg: 3, hp: 10, speed: 4, growth: 9,
    cost: { gold: 100 }, value: 126, abilities: { shots: 12 },
    desc: 'יורים בחצים מכל מרחק. חלשים בקרב פנים אל פנים.',
  },
  marksman: {
    faction: 'castle', tier: 2, upgraded: true, base: 'archer',
    name: 'צלף', plural: 'צלפים',
    attack: 6, defense: 3, minDmg: 2, maxDmg: 3, hp: 10, speed: 6, growth: 9,
    cost: { gold: 150 }, value: 184, abilities: { shots: 24, doubleShot: true },
    desc: 'קשתים מובחרים היורים פעמיים בכל תור.',
  },
  griffin: {
    faction: 'castle', tier: 3, upgradeTo: 'royalGriffin',
    name: 'גריפון', plural: 'גריפונים',
    attack: 8, defense: 8, minDmg: 3, maxDmg: 6, hp: 25, speed: 6, growth: 7,
    cost: { gold: 200 }, value: 351, abilities: { flying: true, retaliations: 2 },
    desc: 'יצור כנף אצילי. מגיב פעמיים בכל סבב קרב.',
  },
  royalGriffin: {
    faction: 'castle', tier: 3, upgraded: true, base: 'griffin',
    name: 'גריפון מלכותי', plural: 'גריפונים מלכותיים',
    attack: 9, defense: 9, minDmg: 3, maxDmg: 6, hp: 25, speed: 9, growth: 7,
    cost: { gold: 240 }, value: 448, abilities: { flying: true, unlimitedRetaliation: true },
    desc: 'גריפונים מלכותיים מגיבים לכל מתקפה, ללא הגבלה.',
  },
  swordsman: {
    faction: 'castle', tier: 4, upgradeTo: 'crusader',
    name: 'סייף', plural: 'סייפים',
    attack: 10, defense: 12, minDmg: 6, maxDmg: 9, hp: 35, speed: 5, growth: 4,
    cost: { gold: 300 }, value: 445, abilities: {},
    desc: 'לוחמים משוריינים, עמוד השדרה של צבא המבצר.',
  },
  crusader: {
    faction: 'castle', tier: 4, upgraded: true, base: 'swordsman',
    name: 'אביר חרב', plural: 'אבירי חרב',
    attack: 12, defense: 12, minDmg: 7, maxDmg: 10, hp: 35, speed: 6, growth: 4,
    cost: { gold: 400 }, value: 588, abilities: { doubleAttack: true },
    desc: 'מכים פעמיים בכל מתקפה.',
  },
  monk: {
    faction: 'castle', tier: 5, upgradeTo: 'zealot',
    name: 'נזיר', plural: 'נזירים',
    attack: 12, defense: 7, minDmg: 10, maxDmg: 12, hp: 30, speed: 5, growth: 3,
    cost: { gold: 400 }, value: 485, abilities: { shots: 12 },
    desc: 'מטילים כדורי אור קדוש על אויביהם.',
  },
  zealot: {
    faction: 'castle', tier: 5, upgraded: true, base: 'monk',
    name: 'קנאי', plural: 'קנאים',
    attack: 12, defense: 10, minDmg: 10, maxDmg: 12, hp: 30, speed: 7, growth: 3,
    cost: { gold: 450 }, value: 750, abilities: { shots: 24, noMeleePenalty: true },
    desc: 'אינם סובלים מעונש קרב פנים אל פנים.',
  },
  cavalier: {
    faction: 'castle', tier: 6, upgradeTo: 'champion',
    name: 'פרש', plural: 'פרשים',
    attack: 15, defense: 15, minDmg: 15, maxDmg: 25, hp: 100, speed: 7, growth: 2,
    cost: { gold: 1000 }, value: 1946, abilities: { jousting: true },
    desc: 'דהירה: +5% נזק על כל משבצת שנעו לפני המתקפה.',
  },
  champion: {
    faction: 'castle', tier: 6, upgraded: true, base: 'cavalier',
    name: 'אלוף', plural: 'אלופים',
    attack: 16, defense: 16, minDmg: 20, maxDmg: 25, hp: 100, speed: 9, growth: 2,
    cost: { gold: 1200 }, value: 2100, abilities: { jousting: true },
    desc: 'אבירי העילית על סוסי מלחמה. דהירה: +5% נזק לכל משבצת.',
  },
  angel: {
    faction: 'castle', tier: 7, upgradeTo: 'archangel',
    name: 'מלאך', plural: 'מלאכים',
    attack: 20, defense: 20, minDmg: 50, maxDmg: 50, hp: 200, speed: 12, growth: 1,
    cost: { gold: 3000, crystal: 1 }, value: 5019,
    abilities: { flying: true, hates: ['boneDragon', 'ghostDragon', 'dreadKnight', 'blackKnight'], moraleBonus: 1 },
    desc: 'שליחי שמיים. +50% נזק נגד אבירי אופל ודרקונים מתים. +1 מורל לצבא.',
  },
  archangel: {
    faction: 'castle', tier: 7, upgraded: true, base: 'angel',
    name: 'מלאך עליון', plural: 'מלאכים עליונים',
    attack: 30, defense: 30, minDmg: 50, maxDmg: 50, hp: 250, speed: 18, growth: 1,
    cost: { gold: 5000, crystal: 3 }, value: 8776,
    abilities: { flying: true, hates: ['boneDragon', 'ghostDragon', 'dreadKnight', 'blackKnight'], moraleBonus: 1, resurrectOnce: true },
    desc: 'פעם בקרב יכולים להחיות יחידה ידידותית שנפלה.',
  },

  // ------------------------------------------------------------------ הנקרופוליס
  skeleton: {
    faction: 'necropolis', tier: 1, upgradeTo: 'skeletonWarrior',
    name: 'שלד', plural: 'שלדים',
    attack: 5, defense: 4, minDmg: 1, maxDmg: 3, hp: 6, speed: 4, growth: 12,
    cost: { gold: 60 }, value: 60, abilities: { undead: true },
    desc: 'מתים שקמו לתחייה. אל-מתים: חסינים ללחשי מוח, אינם מושפעים ממורל.',
  },
  skeletonWarrior: {
    faction: 'necropolis', tier: 1, upgraded: true, base: 'skeleton',
    name: 'לוחם שלד', plural: 'לוחמי שלד',
    attack: 6, defense: 6, minDmg: 1, maxDmg: 3, hp: 6, speed: 5, growth: 12,
    cost: { gold: 70 }, value: 85, abilities: { undead: true },
    desc: 'שלדים חמושים במגן וחרב. אל-מתים.',
  },
  walkingDead: {
    faction: 'necropolis', tier: 2, upgradeTo: 'zombie',
    name: 'מת מהלך', plural: 'מתים מהלכים',
    attack: 5, defense: 5, minDmg: 2, maxDmg: 3, hp: 15, speed: 3, growth: 8,
    cost: { gold: 100 }, value: 98, abilities: { undead: true },
    desc: 'גוויות איטיות ועקשניות. אל-מתים.',
  },
  zombie: {
    faction: 'necropolis', tier: 2, upgraded: true, base: 'walkingDead',
    name: 'זומבי', plural: 'זומבים',
    attack: 5, defense: 5, minDmg: 2, maxDmg: 3, hp: 20, speed: 4, growth: 8,
    cost: { gold: 125 }, value: 128, abilities: { undead: true, diseaseHit: true },
    desc: 'נשיכתם מחלישה את האויב (-2 התקפה והגנה). אל-מתים.',
  },
  wight: {
    faction: 'necropolis', tier: 3, upgradeTo: 'wraith',
    name: 'רוח רפאים', plural: 'רוחות רפאים',
    attack: 7, defense: 7, minDmg: 3, maxDmg: 5, hp: 18, speed: 5, growth: 7,
    cost: { gold: 200 }, value: 252, abilities: { undead: true, flying: true, regenerate: true },
    desc: 'מעופפות ומתחדשות בתחילת כל תור. אל-מתים.',
  },
  wraith: {
    faction: 'necropolis', tier: 3, upgraded: true, base: 'wight',
    name: 'שד אופל', plural: 'שדי אופל',
    attack: 7, defense: 7, minDmg: 3, maxDmg: 5, hp: 18, speed: 7, growth: 7,
    cost: { gold: 230 }, value: 315, abilities: { undead: true, flying: true, regenerate: true, manaDrain: true },
    desc: 'מתחדשים בכל תור ושואבים מאנה מגיבור האויב. אל-מתים.',
  },
  vampire: {
    faction: 'necropolis', tier: 4, upgradeTo: 'vampireLord',
    name: 'ערפד', plural: 'ערפדים',
    attack: 10, defense: 9, minDmg: 5, maxDmg: 8, hp: 30, speed: 6, growth: 4,
    cost: { gold: 360 }, value: 555, abilities: { undead: true, flying: true, noRetaliation: true },
    desc: 'אויביהם אינם מגיבים למתקפתם. אל-מתים.',
  },
  vampireLord: {
    faction: 'necropolis', tier: 4, upgraded: true, base: 'vampire',
    name: 'אדון ערפדים', plural: 'אדוני ערפדים',
    attack: 10, defense: 10, minDmg: 5, maxDmg: 8, hp: 40, speed: 9, growth: 4,
    cost: { gold: 500 }, value: 783, abilities: { undead: true, flying: true, noRetaliation: true, lifeDrain: true },
    desc: 'ללא תגובת אויב. מוצצי חיים: מרפאים ומקימים חברים שנפלו מהנזק שגרמו.',
  },
  lich: {
    faction: 'necropolis', tier: 5, upgradeTo: 'powerLich',
    name: "ליץ'", plural: "ליצ'ים",
    attack: 13, defense: 10, minDmg: 11, maxDmg: 13, hp: 30, speed: 6, growth: 3,
    cost: { gold: 550 }, value: 848, abilities: { undead: true, shots: 12, cloudShot: true },
    desc: 'ענן מוות: היריה פוגעת גם ביצורים חיים הסמוכים למטרה. אל-מתים.',
  },
  powerLich: {
    faction: 'necropolis', tier: 5, upgraded: true, base: 'lich',
    name: "ליץ' עוצמה", plural: "ליצ'י עוצמה",
    attack: 13, defense: 10, minDmg: 11, maxDmg: 15, hp: 40, speed: 7, growth: 3,
    cost: { gold: 600 }, value: 1079, abilities: { undead: true, shots: 24, cloudShot: true },
    desc: 'ענן מוות חזק יותר. אל-מתים.',
  },
  blackKnight: {
    faction: 'necropolis', tier: 6, upgradeTo: 'dreadKnight',
    name: 'אביר שחור', plural: 'אבירים שחורים',
    attack: 16, defense: 16, minDmg: 15, maxDmg: 30, hp: 120, speed: 7, growth: 2,
    cost: { gold: 1200 }, value: 2087, abilities: { undead: true, curseHit: true },
    desc: 'מכתם מקלל את האויב (נזק מינימלי). אל-מתים.',
  },
  dreadKnight: {
    faction: 'necropolis', tier: 6, upgraded: true, base: 'blackKnight',
    name: 'אביר אימה', plural: 'אבירי אימה',
    attack: 18, defense: 18, minDmg: 15, maxDmg: 30, hp: 120, speed: 9, growth: 2,
    cost: { gold: 1500 }, value: 2382, abilities: { undead: true, curseHit: true, deathBlow: true },
    desc: 'מכת מוות: 20% סיכוי לנזק כפול. מקללים. אל-מתים.',
  },
  boneDragon: {
    faction: 'necropolis', tier: 7, upgradeTo: 'ghostDragon',
    name: 'דרקון עצמות', plural: 'דרקוני עצמות',
    attack: 17, defense: 15, minDmg: 25, maxDmg: 50, hp: 150, speed: 9, growth: 1,
    cost: { gold: 1800 }, value: 3388, abilities: { undead: true, flying: true, fearAura: true },
    desc: 'מטיל אימה: -1 מורל לצבא האויב. אל-מתים.',
  },
  ghostDragon: {
    faction: 'necropolis', tier: 7, upgraded: true, base: 'boneDragon',
    name: 'דרקון רפאים', plural: 'דרקוני רפאים',
    attack: 19, defense: 17, minDmg: 25, maxDmg: 50, hp: 200, speed: 14, growth: 1,
    cost: { gold: 3000, mercury: 1 }, value: 4696, abilities: { undead: true, flying: true, fearAura: true, agingHit: true },
    desc: 'מגעו מזקין: 20% סיכוי לחצות את נקודות החיים של האויב. אל-מתים.',
  },

  // ------------------------------------------------------------------ נייטרליים
  goblin: {
    faction: 'neutral', tier: 1,
    name: 'גובלין', plural: 'גובלינים',
    attack: 4, defense: 2, minDmg: 1, maxDmg: 2, hp: 5, speed: 5, growth: 15,
    cost: { gold: 40 }, value: 60, abilities: {},
    desc: 'יצורים קטנים, ערמומיים וחמדנים.',
  },
  wolf: {
    faction: 'neutral', tier: 2,
    name: 'זאב', plural: 'זאבים',
    attack: 7, defense: 4, minDmg: 2, maxDmg: 4, hp: 12, speed: 8, growth: 9,
    cost: { gold: 100 }, value: 140, abilities: {},
    desc: 'טורפים מהירים הצדים בלהקות.',
  },
  orc: {
    faction: 'neutral', tier: 3,
    name: 'אורק', plural: 'אורקים',
    attack: 8, defense: 4, minDmg: 2, maxDmg: 5, hp: 15, speed: 5, growth: 7,
    cost: { gold: 150 }, value: 192, abilities: { shots: 12 },
    desc: 'לוחמים פראיים המטילים גרזנים.',
  },
  stoneGolem: {
    faction: 'neutral', tier: 3,
    name: 'גולם אבן', plural: 'גולמי אבן',
    attack: 7, defense: 10, minDmg: 4, maxDmg: 5, hp: 30, speed: 3, growth: 6,
    cost: { gold: 150 }, value: 250, abilities: { magicResist: 0.5, mindImmune: true },
    desc: 'נוצר מאבן ומשם הקודש. חסין 50% לנזק מלחשים, חסין ללחשי מוח.',
  },
  troll: {
    faction: 'neutral', tier: 5,
    name: 'טרול', plural: 'טרולים',
    attack: 14, defense: 7, minDmg: 10, maxDmg: 15, hp: 40, speed: 7, growth: 3,
    cost: { gold: 500 }, value: 1024, abilities: { regenerate: true },
    desc: 'ענקים גסים המתחדשים מכל פצע.',
  },
  cyclops: {
    faction: 'neutral', tier: 6,
    name: 'קיקלופ', plural: 'קיקלופים',
    attack: 15, defense: 12, minDmg: 16, maxDmg: 20, hp: 70, speed: 6, growth: 2,
    cost: { gold: 750 }, value: 1266, abilities: { shots: 16 },
    desc: 'ענקים חד-עיניים המטילים סלעים.',
  },
  greenDragon: {
    faction: 'neutral', tier: 7,
    name: 'דרקון ירוק', plural: 'דרקונים ירוקים',
    attack: 18, defense: 18, minDmg: 40, maxDmg: 50, hp: 180, speed: 10, growth: 1,
    cost: { gold: 2400, crystal: 1 }, value: 4872, abilities: { flying: true, breath: true, magicResist: 0.3 },
    desc: 'נשיפת אש פוגעת גם ביצור שמאחורי המטרה. עמיד 30% ללחשים.',
  },
};

for (const [id, c] of Object.entries(CREATURES)) c.id = id;

export const FACTION_LINEUP = {
  castle: ['pikeman', 'archer', 'griffin', 'swordsman', 'monk', 'cavalier', 'angel'],
  necropolis: ['skeleton', 'walkingDead', 'wight', 'vampire', 'lich', 'blackKnight', 'boneDragon'],
};

export const NEUTRAL_POOL = ['goblin', 'wolf', 'orc', 'stoneGolem', 'troll', 'cyclops', 'greenDragon'];

/** Approximate size-word for a monster stack, as in HoMM3 ("כמה", "להקה"...) */
export function stackSizeWord(n) {
  if (n < 5) return 'מעטים';
  if (n < 10) return 'כמה';
  if (n < 20) return 'קבוצה של';
  if (n < 50) return 'הרבה';
  if (n < 100) return 'המון';
  if (n < 250) return 'עדר של';
  if (n < 500) return 'המוני';
  if (n < 1000) return 'צבא של';
  return 'לגיון של';
}

export function stackSizeRange(n) {
  const r = [[1, 4], [5, 9], [10, 19], [20, 49], [50, 99], [100, 249], [250, 499], [500, 999], [1000, '∞']];
  for (const [a, b] of r) if (b === '∞' || n <= b) return b === '∞' ? `${a}+` : `${a}-${b}`;
  return '';
}

export function creatureName(id, count) {
  const c = CREATURES[id];
  return count === 1 ? c.name : c.plural;
}

export function abilityList(c) {
  const a = c.abilities || {};
  const out = [];
  if (a.flying) out.push('מעופף');
  if (a.shots) out.push(`יורה (${a.shots} יריות)`);
  if (a.doubleShot) out.push('יריה כפולה');
  if (a.doubleAttack) out.push('מתקפה כפולה');
  if (a.noRetaliation) out.push('ללא תגובת אויב');
  if (a.retaliations) out.push(`מגיב ${a.retaliations} פעמים`);
  if (a.unlimitedRetaliation) out.push('תגובה בלתי מוגבלת');
  if (a.undead) out.push('אל-מת');
  if (a.regenerate) out.push('התחדשות');
  if (a.lifeDrain) out.push('מציצת חיים');
  if (a.jousting) out.push('דהירה');
  if (a.antiCavalry) out.push('חסין לדהירה');
  if (a.noMeleePenalty) out.push('ללא עונש קרב צמוד');
  if (a.cloudShot) out.push('ענן מוות');
  if (a.breath) out.push('נשיפת אש');
  if (a.magicResist) out.push(`עמידות לקסם ${Math.round(a.magicResist * 100)}%`);
  if (a.mindImmune) out.push('חסין ללחשי מוח');
  if (a.deathBlow) out.push('מכת מוות');
  if (a.curseHit) out.push('מכה מקללת');
  if (a.diseaseHit) out.push('מחלה');
  if (a.agingHit) out.push('הזדקנות');
  if (a.fearAura) out.push('מטיל אימה');
  if (a.manaDrain) out.push('שאיבת מאנה');
  if (a.resurrectOnce) out.push('תחייה');
  if (a.hates) out.push('שנאה לאופל');
  if (a.moraleBonus) out.push('+1 מורל');
  return out;
}
