// ============================================================================
//  גיבורים — מחלקות ורשימת גיבורים
// ============================================================================

export const HERO_CLASSES = {
  knight: {
    name: 'אביר', nameF: 'אבירה', faction: 'castle', type: 'might',
    start: { attack: 2, defense: 2, power: 1, knowledge: 1 },
    probs: { attack: 35, defense: 45, power: 10, knowledge: 10 },
    skillWeights: { leadership: 8, offense: 7, armorer: 7, archery: 6, logistics: 6, luck: 4, scouting: 3, pathfinding: 3, estates: 4, wisdom: 3, learning: 3, intelligence: 1, sorcery: 1 },
  },
  cleric: {
    name: 'כוהן', nameF: 'כוהנת', faction: 'castle', type: 'magic',
    start: { attack: 1, defense: 0, power: 2, knowledge: 2 },
    probs: { attack: 20, defense: 15, power: 30, knowledge: 35 },
    skillWeights: { wisdom: 8, sorcery: 7, intelligence: 7, leadership: 5, luck: 5, learning: 5, logistics: 4, scouting: 3, estates: 3, offense: 2, armorer: 2, archery: 2, pathfinding: 3 },
  },
  deathKnight: {
    name: 'אביר מוות', nameF: 'אבירת מוות', faction: 'necropolis', type: 'might',
    start: { attack: 1, defense: 2, power: 2, knowledge: 1 },
    probs: { attack: 30, defense: 25, power: 20, knowledge: 25 },
    skillWeights: { necromancy: 6, offense: 7, armorer: 7, archery: 4, logistics: 5, wisdom: 4, scouting: 3, pathfinding: 4, sorcery: 3, intelligence: 3, estates: 3, learning: 3, luck: 1 },
  },
  necromancer: {
    name: 'נקרומנסר', nameF: 'נקרומנסרית', faction: 'necropolis', type: 'magic',
    start: { attack: 1, defense: 0, power: 2, knowledge: 2 },
    probs: { attack: 15, defense: 15, power: 35, knowledge: 35 },
    skillWeights: { necromancy: 6, wisdom: 8, sorcery: 7, intelligence: 7, learning: 4, logistics: 4, scouting: 3, pathfinding: 3, estates: 3, offense: 2, armorer: 2, archery: 1, luck: 1 },
  },
};

// gender: 'm' | 'f'
export const HERO_ROSTER = [
  // ---- המבצר: אבירים
  { id: 'gideon', name: 'גדעון', gender: 'm', cls: 'knight', skills: [['leadership', 1], ['archery', 1]], bio: 'שופט ולוחם, ניצח צבא שלם עם שלוש מאות איש, כדים ולפידים.', army: ['pikeman', 'pikeman', 'archer'] },
  { id: 'yoav', name: 'יואב', gender: 'm', cls: 'knight', skills: [['offense', 1], ['leadership', 1]], bio: 'שר הצבא הנאמן והאכזרי. אינו מכיר בתבוסה.', army: ['pikeman', 'pikeman', 'pikeman'] },
  { id: 'shimshon', name: 'שמשון', gender: 'm', cls: 'knight', skills: [['offense', 2]], bio: 'חזק כעשרה גברים. אל תשאלו אותו על התספורת שלו.', army: ['pikeman', 'archer'] },
  { id: 'yael', name: 'יעל', gender: 'f', cls: 'knight', skills: [['armorer', 1], ['luck', 1]], bio: 'ערמומית ואמיצה. יודעת שלפעמים יתד אחת מכריעה מלחמה.', army: ['pikeman', 'archer', 'archer'] },
  { id: 'benayahu', name: 'בניהו', gender: 'm', cls: 'knight', skills: [['armorer', 1], ['logistics', 1]], bio: 'ירד אל הבור ביום השלג והכה את הארי. מפקד משמר המלך.', army: ['pikeman', 'pikeman', 'archer'] },
  // ---- המבצר: כוהנים
  { id: 'devora', name: 'דבורה', gender: 'f', cls: 'cleric', skills: [['wisdom', 1], ['leadership', 1]], bio: 'נביאה ושופטת. יושבת תחת התומר ומנהיגה עם בחוכמה.', army: ['pikeman', 'archer'], spell: 'bless' },
  { id: 'avigail', name: 'אביגיל', gender: 'f', cls: 'cleric', skills: [['wisdom', 1], ['intelligence', 1]], bio: 'נבונה ויפת תואר. מילותיה מרגיעות מלכים ועוצרות מלחמות.', army: ['pikeman', 'pikeman'], spell: 'cure' },
  { id: 'shmuel', name: 'שמואל', gender: 'm', cls: 'cleric', skills: [['wisdom', 1], ['sorcery', 1]], bio: 'רואה ונביא. משח מלכים — ויודע גם להסיר אותם.', army: ['pikeman', 'archer'], spell: 'magicArrow' },
  { id: 'elisha', name: 'אלישע', gender: 'm', cls: 'cleric', skills: [['wisdom', 1], ['learning', 1]], bio: 'קיבל פי שניים מרוח רבו. מרפא חולים ומטהר מים.', army: ['pikeman', 'pikeman', 'archer'], spell: 'stoneSkin' },
  // ---- הנקרופוליס: אבירי מוות
  { id: 'belial', name: 'בליעל', gender: 'm', cls: 'deathKnight', skills: [['necromancy', 1], ['offense', 1]], bio: 'שר החושך. כל מה שנוגע בו — נובל.', army: ['skeleton', 'skeleton', 'walkingDead'] },
  { id: 'azazel', name: 'עזאזל', gender: 'm', cls: 'deathKnight', skills: [['necromancy', 1], ['armorer', 1]], bio: 'גורש אל המדבר, ומאז הוא מחכה לנקמה.', army: ['skeleton', 'walkingDead', 'walkingDead'] },
  { id: 'ashmedai', name: 'אשמדאי', gender: 'm', cls: 'deathKnight', skills: [['necromancy', 1], ['logistics', 1]], bio: 'מלך השדים. פעם כבר גנב כתר — והוא מתכנן לעשות זאת שוב.', army: ['skeleton', 'skeleton', 'skeleton'] },
  // ---- הנקרופוליס: נקרומנסרים
  { id: 'lilith', name: 'לילית', gender: 'f', cls: 'necromancer', skills: [['necromancy', 1], ['wisdom', 1]], bio: 'מלכת הלילה. שמה נלחש בפחד בכל כפר.', army: ['skeleton', 'walkingDead'], spell: 'curse' },
  { id: 'agrat', name: 'אגרת', gender: 'f', cls: 'necromancer', skills: [['necromancy', 1], ['sorcery', 1]], bio: 'רוכבת על עגלת הצללים בלילות רביעי ושבת.', army: ['skeleton', 'skeleton'], spell: 'magicArrow' },
  { id: 'samael', name: 'סמאל', gender: 'm', cls: 'necromancer', skills: [['necromancy', 1], ['intelligence', 1]], bio: 'מלאך המוות בכבודו ובעצמו. כמעט.', army: ['skeleton', 'walkingDead', 'skeleton'], spell: 'slow' },
  { id: 'naama', name: 'נעמה', gender: 'f', cls: 'necromancer', skills: [['necromancy', 1], ['learning', 1]], bio: 'יפה ומסוכנת. שירתה מעירה את המתים.', army: ['skeleton', 'skeleton', 'walkingDead'], spell: 'haste' },
];

export const XP_LEVELS = [0, 1000, 2000, 3200, 4600, 6200, 8000, 10000, 12200, 14700, 17500, 20600, 24320, 28784, 34140, 40567, 48279, 57533, 68637, 81961, 97949, 117134, 140156, 167782, 200933];

export function xpForLevel(level) {
  if (level - 1 < XP_LEVELS.length) return XP_LEVELS[level - 1];
  return Math.round(XP_LEVELS[XP_LEVELS.length - 1] * Math.pow(1.2, level - XP_LEVELS.length));
}

export const PRIMARY_NAMES = { attack: 'התקפה', defense: 'הגנה', power: 'כוח קסם', knowledge: 'ידע' };
