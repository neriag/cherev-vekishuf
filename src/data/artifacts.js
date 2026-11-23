// ============================================================================
//  חפצים (ארטיפקטים)
// ============================================================================

export const ARTIFACT_SLOTS = {
  head: 'ראש', neck: 'צוואר', torso: 'גוף', weapon: 'נשק', shield: 'מגן',
  ring: 'טבעת', feet: 'רגליים', cape: 'גלימה', misc: 'שונות',
};

// rarity: minor | major | relic
export const ARTIFACTS = {
  swordOfValor: { name: 'חרב העוז', slot: 'weapon', rarity: 'minor', bonus: { attack: 2 }, desc: 'להב פשוט אך חד, שנפח בידי נפח הכפר.' },
  davidsSling: { name: 'קלע דוד', slot: 'weapon', rarity: 'major', bonus: { attack: 3, luck: 1 }, desc: 'קלע פשוט, אך מי שאוחז בו אינו ירא מענקים.' },
  giantAxe: { name: 'גרזן הענקים', slot: 'weapon', rarity: 'major', bonus: { attack: 4 }, desc: 'כבד כל כך, שרק גיבור אמיתי מסוגל להניפו.' },
  titanBlade: { name: 'להב הטיטאנים', slot: 'weapon', rarity: 'relic', bonus: { attack: 6, power: 2 }, desc: 'חושל בברק בראש ההר הגבוה בעולם.' },
  lionShield: { name: 'מגן האריה', slot: 'shield', rarity: 'minor', bonus: { defense: 2 }, desc: 'על פניו חרוט אריה שואג.' },
  dragonShield: { name: 'מגן קשקשי הדרקון', slot: 'shield', rarity: 'major', bonus: { defense: 4 }, desc: 'קשקשים שאף להבה אינה חודרת.' },
  helmOfCourage: { name: 'קסדת האומץ', slot: 'head', rarity: 'minor', bonus: { attack: 1, defense: 1 }, desc: 'קסדה שחבשו שלושה דורות של לוחמים.' },
  crownOfWisdom: { name: 'כתר החוכמה', slot: 'head', rarity: 'major', bonus: { knowledge: 3 }, desc: 'נאמר שהיה שייך למלך החכם מכל האדם.' },
  kingsCrown: { name: 'כתר המלכים', slot: 'head', rarity: 'relic', bonus: { attack: 3, defense: 3, power: 3, knowledge: 3 }, desc: 'כתר אגדי. כל הממלכות כורעות בפני נושאו.' },
  scaleMail: { name: 'שריון קשקשים', slot: 'torso', rarity: 'minor', bonus: { defense: 3 }, desc: 'שריון קל וגמיש.' },
  wizardCoat: { name: 'מעיל המכשף', slot: 'torso', rarity: 'major', bonus: { power: 2, knowledge: 2 }, desc: 'רקום בכוכבים שזזים בלילות.' },
  luckAmulet: { name: 'קמע המזל', slot: 'neck', rarity: 'minor', bonus: { luck: 1 }, desc: 'חמסה כסופה השומרת מעין הרע.' },
  courageNecklace: { name: 'ענק האומץ', slot: 'neck', rarity: 'minor', bonus: { morale: 1 }, desc: 'שרשרת זהב המחזקת את רוח הלוחמים.' },
  powerPendant: { name: 'תליון העוצמה', slot: 'neck', rarity: 'major', bonus: { power: 3 }, desc: 'אבן ספיר בוערת באור פנימי.' },
  vitalityRing: { name: 'טבעת החיוניות', slot: 'ring', rarity: 'major', bonus: { attack: 1, defense: 1, power: 1, knowledge: 1 }, desc: 'מחזקת גוף ונפש כאחד.' },
  magicRing: { name: 'טבעת הקסם', slot: 'ring', rarity: 'minor', bonus: { knowledge: 2 }, desc: 'טבעת פשוטה המזמזמת בשקט.' },
  bootsOfSpeed: { name: 'מגפי המהירות', slot: 'feet', rarity: 'major', bonus: { mp: 400 }, desc: '+400 נקודות תנועה ביום.' },
  travelerBoots: { name: 'סנדלי הנודד', slot: 'feet', rarity: 'minor', bonus: { mp: 200 }, desc: '+200 נקודות תנועה ביום.' },
  princeCape: { name: 'גלימת הנסיכים', slot: 'cape', rarity: 'minor', bonus: { morale: 1, defense: 1 }, desc: 'ארגמן ורקמת זהב.' },
  shadowCloak: { name: 'גלימת הצללים', slot: 'cape', rarity: 'major', bonus: { luck: 1, power: 2 }, desc: 'נושאה נע כצל בין הצללים.' },
  shofar: { name: 'שופר הניצחון', slot: 'misc', rarity: 'major', bonus: { morale: 2 }, desc: 'תקיעה אחת — וחומות נופלות ולבבות מתחזקים.' },
  fireTome: { name: 'ספר האש העתיק', slot: 'misc', rarity: 'major', bonus: { power: 3 }, desc: 'דפיו חמים למגע.' },
  goldSack: { name: 'שק הזהב האינסופי', slot: 'misc', rarity: 'relic', bonus: { goldPerDay: 750 }, desc: 'אין לו תחתית. +750 זהב ביום.' },
  spyglass: { name: 'משקפת הצופה', slot: 'misc', rarity: 'minor', bonus: { vision: 2 }, desc: '+2 לרדיוס הראייה של הגיבור.' },
};

for (const [id, a] of Object.entries(ARTIFACTS)) a.id = id;

export const RARITY_NAMES = { minor: 'פשוט', major: 'נדיר', relic: 'שריד אגדי' };
export const RARITY_COLORS = { minor: '#9ec7ff', major: '#d9a6ff', relic: '#ffcf4a' };

export function artifactBonusText(a) {
  const b = a.bonus, parts = [];
  if (b.attack) parts.push(`+${b.attack} התקפה`);
  if (b.defense) parts.push(`+${b.defense} הגנה`);
  if (b.power) parts.push(`+${b.power} כוח קסם`);
  if (b.knowledge) parts.push(`+${b.knowledge} ידע`);
  if (b.morale) parts.push(`+${b.morale} מורל`);
  if (b.luck) parts.push(`+${b.luck} מזל`);
  if (b.mp) parts.push(`+${b.mp} תנועה`);
  if (b.goldPerDay) parts.push(`+${b.goldPerDay} זהב ליום`);
  if (b.vision) parts.push(`+${b.vision} ראייה`);
  return parts.join(', ');
}
