// ============================================================================
//  אובייקטים על מפת ההרפתקאות
// ============================================================================

export const RESOURCES = ['gold', 'wood', 'ore', 'mercury', 'sulfur', 'crystal', 'gems'];

export const RESOURCE_INFO = {
  gold: { name: 'זהב', color: '#f4c542' },
  wood: { name: 'עץ', color: '#9a6b3c' },
  ore: { name: 'עפרה', color: '#8a8f99' },
  mercury: { name: 'כספית', color: '#c9d4e0' },
  sulfur: { name: 'גופרית', color: '#e8d23a' },
  crystal: { name: 'קריסטל', color: '#e0424a' },
  gems: { name: 'אבני חן', color: '#3fc46a' },
};

// Approximate gold value of each resource unit (for AI evaluation & marketplace)
export const RESOURCE_VALUE = { gold: 1, wood: 100, ore: 100, mercury: 250, sulfur: 250, crystal: 250, gems: 250 };

export const MINES = {
  wood: { name: 'מנסרה', income: 2, desc: 'מפיקה 2 יחידות עץ ביום לבעליה.' },
  ore: { name: 'מכרה עפרה', income: 2, desc: 'מפיק 2 יחידות עפרה ביום לבעליו.' },
  gold: { name: 'מכרה זהב', income: 1000, desc: 'מפיק 1000 זהב ביום לבעליו.' },
  mercury: { name: 'מעבדת האלכימאי', income: 1, desc: 'מפיקה כספית אחת ביום.' },
  sulfur: { name: 'דיונת הגופרית', income: 1, desc: 'מפיקה גופרית אחת ביום.' },
  crystal: { name: 'מערת הקריסטל', income: 1, desc: 'מפיקה קריסטל אחד ביום.' },
  gems: { name: 'בריכת אבני החן', income: 1, desc: 'מפיקה אבן חן אחת ביום.' },
};

/**
 * Map object kinds. Every object occupies one tile (except towns: 3x3 with an entrance tile).
 * Interaction: hero walks to an adjacent tile and "bumps" the object (towns: hero enters the entrance tile).
 *   once:   object disappears after visit
 *   perHero: each hero may benefit once
 *   daily/weekly: may be revisited
 */
export const OBJECT_TYPES = {
  town: { name: 'עיר', kind: 'town' },
  hero: { name: 'גיבור', kind: 'hero' },
  resource: { name: 'משאב', kind: 'pickup' },
  chest: { name: 'תיבת אוצר', kind: 'pickup', desc: 'תיבה מלאה זהב. אולי עדיף לחלק אותו לאיכרים תמורת ניסיון?' },
  campfire: { name: 'מדורה', kind: 'pickup', desc: 'שרידי מחנה נטוש. ליד הגחלים מונחים משאבים.' },
  artifact: { name: 'חפץ', kind: 'pickup' },
  monster: { name: 'יצורים', kind: 'monster' },
  mine: { name: 'מכרה', kind: 'flaggable' },
  dwelling: { name: 'מאורה', kind: 'flaggable' },
  windmill: { name: 'טחנת רוח', kind: 'weekly', desc: 'הטוחן נותן לך משאבים נדירים פעם בשבוע.' },
  waterwheel: { name: 'גלגל מים', kind: 'weekly', desc: 'הטוחן משלם 1000 זהב פעם בשבוע.' },
  well: { name: 'באר', kind: 'daily', desc: 'מימיה הצוננים מחזירים את כל נקודות הקסם.' },
  shrine: { name: 'מקדש הקסם', kind: 'perHero', desc: 'כוהן זקן מלמד לחש.' },
  learningStone: { name: 'אבן הלמידה', kind: 'perHero', desc: 'הכתובות העתיקות מעניקות 1000 נקודות ניסיון.' },
  marlettoTower: { name: 'מגדל המשמר', kind: 'perHero', desc: 'אימון עם שומרי המגדל מעניק +1 הגנה.' },
  mercenaryCamp: { name: 'מחנה שכירי החרב', kind: 'perHero', desc: 'שכירי החרב מלמדים תרגילי קרב: +1 התקפה.' },
  starAxis: { name: 'ציר הכוכבים', kind: 'perHero', desc: 'התבוננות בכוכבים מעניקה +1 כוח קסם.' },
  gardenOfRevelation: { name: 'גן ההתגלות', kind: 'perHero', desc: 'שלוות הגן מעניקה +1 ידע.' },
  witchHut: { name: 'בקתת המכשפה', kind: 'perHero', desc: 'המכשפה מלמדת כישור משני.' },
  treeOfKnowledge: { name: 'עץ הדעת', kind: 'perHero', desc: 'פרי העץ מעניק דרגה נוספת לגיבור.' },
  stables: { name: 'אורוות', kind: 'weekly', desc: 'סוסים רעננים: +500 נקודות תנועה.' },
  fountain: { name: 'מזרקת המזל', kind: 'perHero', desc: 'מטבע שנזרק למזרקה מביא מזל בקרב הבא.' },
  temple: { name: 'מקדש העוז', kind: 'perHero', desc: 'תפילה במקדש מעניקה +2 מורל בקרב הבא.' },
  lookout: { name: 'מגדל תצפית', kind: 'once', desc: 'מראש המגדל נגלה שטח רחב.' },
  pandora: { name: 'תיבת פנדורה', kind: 'once', desc: 'מי יודע מה מסתתר בפנים...' },
  crypt: { name: 'קריפטה', kind: 'once', desc: 'קבר עתיק השמור בידי אל-מתים. בפנים — אוצרות.' },
  sign: { name: 'שלט', kind: 'info' },
  prison: { name: 'כלא', kind: 'once', desc: 'בתוך הכלא כלוא גיבור. שחרר אותו והוא יצטרף אליך.' },
  teleport: { name: 'שער קסום', kind: 'teleport', desc: 'שער מנצנץ המוביל למקום רחוק.' },
};

export const SIGN_TEXTS = [
  'זהירות! זאבים רעבים בהמשך הדרך. — האגודה להגנת הנוסעים',
  'כאן נח המלך אורן הראשון. או שאולי זה היה סוס. אף אחד לא זוכר.',
  'מי שהולך בדרך המלך — אינו טועה. מי שהולך ביער — טועה, ואולי גם נאכל.',
  'אל תאכילו את הגריפונים. ברצינות.',
  'המכרה הקרוב: 3 פרסאות. הטברנה הקרובה: קרובה מדי.',
  'החיים קצרים. השלדים — ארוכים.',
  'נקרומנסרים — הדרך חזרה לשם. אנחנו לא רוצים אתכם פה.',
  'פה קבור הגיבור שלא הקשיב לשלט הקודם.',
  'מי שמעז — מנצח. מי שמחשב — מנצח פעמיים.',
  'ברוכים הבאים לעמק השקט. אנא לא להעיר את הדרקון.',
];

export const PANDORA_KINDS = ['gold', 'xp', 'creatures', 'spell', 'battle', 'resources'];

export function objectDisplayName(obj) {
  if (!obj) return '';
  const t = OBJECT_TYPES[obj.type];
  if (obj.type === 'mine') return MINES[obj.resource].name;
  if (obj.type === 'resource') return RESOURCE_INFO[obj.resource].name;
  return t ? t.name : obj.type;
}
