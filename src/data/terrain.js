// ============================================================================
//  סוגי שטח
// ============================================================================

export const TERRAINS = {
  grass: { name: 'דשא', cost: 100, color: [0.36, 0.6, 0.22], color2: [0.45, 0.68, 0.27], obstacles: ['oak', 'pine'], mountains: 'mountain', decor: ['grassTuft', 'flowers', 'bush', 'rock'], battle: 'grass' },
  dirt: { name: 'עפר', cost: 100, color: [0.52, 0.4, 0.25], color2: [0.6, 0.47, 0.3], obstacles: ['oak', 'deadTree'], mountains: 'mountain', decor: ['rock', 'bush', 'grassTuft'], battle: 'dirt' },
  sand: { name: 'חול', cost: 150, color: [0.85, 0.74, 0.45], color2: [0.9, 0.8, 0.52], obstacles: ['palm', 'cactus'], mountains: 'desertRock', decor: ['cactus', 'rock', 'bones'], battle: 'sand' },
  snow: { name: 'שלג', cost: 150, color: [0.88, 0.92, 0.96], color2: [0.8, 0.86, 0.94], obstacles: ['snowPine'], mountains: 'snowMountain', decor: ['iceRock', 'snowPine'], battle: 'snow' },
  swamp: { name: 'ביצה', cost: 175, color: [0.27, 0.36, 0.22], color2: [0.33, 0.42, 0.25], obstacles: ['willow', 'deadTree'], mountains: 'mountain', decor: ['reeds', 'mushroom', 'grassTuft'], battle: 'swamp' },
  rough: { name: 'טרשים', cost: 125, color: [0.55, 0.48, 0.36], color2: [0.62, 0.55, 0.42], obstacles: ['deadTree', 'pine'], mountains: 'mountain', decor: ['rock', 'rock', 'grassTuft'], battle: 'rough' },
  ash: { name: 'אדמה מקוללת', cost: 100, color: [0.3, 0.27, 0.3], color2: [0.36, 0.32, 0.35], obstacles: ['deadTree', 'deadTree'], mountains: 'darkMountain', decor: ['bones', 'darkRock', 'mushroom'], battle: 'ash' },
  water: { name: 'מים', cost: Infinity, color: [0.16, 0.36, 0.55], color2: [0.16, 0.36, 0.55], obstacles: [], decor: [], battle: 'grass' },
};

export const ROAD_COST = 65;

export const DECORATION_KINDS = [
  'pine', 'oak', 'deadTree', 'palm', 'cactus', 'snowPine', 'willow',
  'mountain', 'snowMountain', 'desertRock', 'darkMountain',
  'rock', 'darkRock', 'iceRock', 'bush', 'flowers', 'grassTuft', 'reeds', 'mushroom', 'bones',
];
