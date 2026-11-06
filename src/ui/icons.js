// ============================================================================
//  ספריית סמלים וקטוריים (SVG) — משאבים, תכונות, כישורים, לחשים, פעולות וחפצים
// ============================================================================

import { ARTIFACTS, RARITY_COLORS } from '../data/artifacts.js';

const ICON_PATHS = {
  // ---- משאבים ----
  gold: `
    <defs>
      <radialGradient id="ig_gold" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stop-color="#fff6b0"/>
        <stop offset="45%" stop-color="#ffd23f"/>
        <stop offset="100%" stop-color="#b87a08"/>
      </radialGradient>
    </defs>
    <ellipse cx="32" cy="48" rx="22" ry="9" fill="#5c3802" opacity="0.45"/>
    <g stroke="#2a1802" stroke-width="2.2" stroke-linejoin="round">
      <ellipse cx="22" cy="44" rx="12" ry="6" fill="#d99816"/>
      <ellipse cx="22" cy="40" rx="12" ry="6" fill="url(#ig_gold)"/>
      <ellipse cx="42" cy="45" rx="12" ry="6" fill="#c78810"/>
      <ellipse cx="42" cy="41" rx="12" ry="6" fill="url(#ig_gold)"/>
      <ellipse cx="32" cy="37" rx="13" ry="6.5" fill="#d99816"/>
      <ellipse cx="32" cy="32" rx="13" ry="6.5" fill="url(#ig_gold)"/>
      <circle cx="32" cy="22" r="12" fill="url(#ig_gold)"/>
      <circle cx="32" cy="22" r="8.5" fill="none" stroke="#b37205" stroke-width="1.5"/>
      <path d="M32 16 L34 20 L38 20.5 L35 23.5 L36 27.5 L32 25.5 L28 27.5 L29 23.5 L26 20.5 L30 20 Z" fill="#fff3a1" stroke="#9e6204" stroke-width="1"/>
    </g>
    <path d="M16 14 L18 10 L20 14 L24 16 L20 18 L18 22 L16 18 L12 16 Z" fill="#fffbe0"/>
    <path d="M47 18 L48.5 15 L50 18 L53 19.5 L50 21 L48.5 24 L47 21 L44 19.5 Z" fill="#fffbe0"/>
  `,

  wood: `
    <g stroke="#241306" stroke-width="2.2" stroke-linejoin="round">
      <path d="M12 38 L44 38 C49 38 52 43 52 47 C52 51 49 54 44 54 L12 54 Z" fill="#7a4921"/>
      <ellipse cx="12" cy="46" rx="6" ry="8" fill="#d9a66c"/>
      <ellipse cx="12" cy="46" rx="3" ry="4.5" fill="none" stroke="#8c5828" stroke-width="1.4"/>
      <path d="M20 34 L52 34 C56 34 59 38 59 42 C59 46 56 50 52 50 L20 50 Z" fill="#8f5729"/>
      <ellipse cx="20" cy="42" rx="6" ry="8" fill="#e5b880"/>
      <ellipse cx="20" cy="42" rx="3" ry="4.5" fill="none" stroke="#8c5828" stroke-width="1.4"/>
      <path d="M15 22 L47 22 C52 22 55 26 55 30 C55 34 52 38 47 38 L15 38 Z" fill="#a86832"/>
      <path d="M24 26 L48 26 M28 32 L44 32" stroke="#5c3414" stroke-width="1.8" stroke-linecap="round"/>
      <ellipse cx="15" cy="30" rx="6" ry="8" fill="#f0c993"/>
      <circle cx="15" cy="30" r="2.2" fill="#8c5828"/>
      <path d="M36 14 C39 10 46 11 45 17 C44 21 38 22 35 22 C35 18 34 16 36 14 Z" fill="#52b848" stroke="#183b14" stroke-width="1.8"/>
    </g>
  `,

  ore: `
    <g stroke="#1c1f26" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="8,48 16,24 30,18 46,22 56,46 42,54 18,54" fill="#5c6370"/>
      <polygon points="16,24 30,18 34,34 18,40" fill="#8f97a6"/>
      <polygon points="30,18 46,22 44,36 34,34" fill="#737b8a"/>
      <polygon points="18,40 34,34 42,54 18,54" fill="#494f59"/>
      <polygon points="34,34 44,36 56,46 42,54" fill="#3a3f47"/>
      <polygon points="22,26 28,23 30,30 23,32" fill="#d8dee9" stroke-width="1.4"/>
      <polygon points="37,27 43,29 41,35 35,33" fill="#ffd15c" stroke="#594008" stroke-width="1.4"/>
      <polygon points="24,42 31,39 33,46 25,48" fill="#ffd15c" stroke="#594008" stroke-width="1.4"/>
    </g>
  `,

  mercury: `
    <defs>
      <linearGradient id="ig_merc" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="50%" stop-color="#b8cde0"/>
        <stop offset="100%" stop-color="#607890"/>
      </linearGradient>
    </defs>
    <g stroke="#1a2430" stroke-width="2.2" stroke-linejoin="round">
      <path d="M25 10 L39 10 L39 16 L36 18 L36 25 C46 28 51 36 50 45 C49 52 42 56 32 56 C22 56 15 52 14 45 C13 36 18 28 28 25 L28 18 L25 16 Z" fill="#32465c" opacity="0.45"/>
      <path d="M17 41 C22 38 27 43 32 40 C37 37 42 40 47 39 C48 48 43 53 32 53 C21 53 16 48 17 41 Z" fill="url(#ig_merc)"/>
      <path d="M25 10 L39 10 L39 15 L36 17 L36 25 C46 28 51 36 50 45 C49 52 42 56 32 56 C22 56 15 52 14 45 C13 36 18 28 28 25 L28 17 L25 15 Z" fill="none" stroke="#9ec3e6" stroke-width="2.2"/>
      <rect x="27" y="6" width="10" height="5" rx="2" fill="#a86428"/>
      <circle cx="25" cy="46" r="3" fill="#ffffff" stroke="none"/>
      <circle cx="37" cy="34" r="2.2" fill="#e6f2ff" stroke="none"/>
      <path d="M21 31 C19 35 19 41 21 46" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none"/>
    </g>
  `,

  sulfur: `
    <g stroke="#2b2104" stroke-width="2.2" stroke-linejoin="round">
      <ellipse cx="32" cy="50" rx="24" ry="7" fill="#6b5308" opacity="0.5"/>
      <polygon points="10,48 22,26 32,20 44,24 54,48 40,53 20,53" fill="#d4b219"/>
      <polygon points="22,26 32,20 36,36 20,44" fill="#ffe84a"/>
      <polygon points="32,20 44,24 46,42 36,36" fill="#e8c825"/>
      <polygon points="20,44 36,36 40,53 20,53" fill="#b8960f"/>
      <polygon points="14,49 20,35 28,49" fill="#fff380"/>
      <polygon points="40,49 46,34 53,48" fill="#f5d936"/>
      <path d="M24 16 C22 12 26 9 25 5 M34 14 C32 10 37 7 35 3 M42 18 C40 14 44 11 43 8" stroke="#d9cf8a" stroke-width="2" stroke-linecap="round" fill="none"/>
    </g>
  `,

  crystal: `
    <defs>
      <linearGradient id="ig_crys" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ff9ea6"/>
        <stop offset="45%" stop-color="#e82c3f"/>
        <stop offset="100%" stop-color="#7a0916"/>
      </linearGradient>
    </defs>
    <g stroke="#2b040a" stroke-width="2" stroke-linejoin="round">
      <polygon points="16,52 10,32 18,22 26,30 24,52" fill="#bd192c"/>
      <polygon points="40,52 42,28 50,20 56,30 48,52" fill="#a11222"/>
      <polygon points="24,54 22,18 32,8 42,18 40,54" fill="url(#ig_crys)"/>
      <polygon points="22,18 32,8 32,54 24,54" fill="#ff6b7b" opacity="0.55" stroke="none"/>
      <polygon points="28,14 32,10 32,26 26,22" fill="#ffdbe0" stroke="none"/>
      <path d="M12 52 L52 52" stroke="#4a0810" stroke-width="3" stroke-linecap="round"/>
    </g>
    <circle cx="20" cy="14" r="2" fill="#fff"/>
    <circle cx="48" cy="14" r="1.8" fill="#fff"/>
  `,

  gems: `
    <g stroke="#0e2618" stroke-width="2" stroke-linejoin="round">
      <polygon points="18,16 32,10 46,16 52,30 32,54 12,30" fill="#1ca855"/>
      <polygon points="22,20 32,15 42,20 46,30 32,47 18,30" fill="#46e885"/>
      <polygon points="18,16 32,10 32,15 22,20" fill="#9effc2"/>
      <polygon points="12,30 18,16 22,20 18,30" fill="#68f09d"/>
      <polygon points="46,16 52,30 46,30 42,20" fill="#178744"/>
      <polygon points="18,30 32,47 32,54 12,30" fill="#158f46"/>
      <polygon points="46,30 52,30 32,54 32,47" fill="#0d612e"/>
      <polygon points="25,22 32,18 39,22 35,30 28,30" fill="#c4ffda" stroke="none"/>
    </g>
    <path d="M48 10 L50 6 L52 10 L56 12 L52 14 L50 18 L48 14 L44 12 Z" fill="#ffffff"/>
  `,

  // ---- תכונות ראשיות ומשניות ----
  attack: `
    <g stroke="#1f1209" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="32" cy="32" r="25" fill="#5e1914" stroke="#d49b35" stroke-width="2.5"/>
      <path d="M48 12 L52 16 L26 42 L20 44 L22 38 Z" fill="#e6eef7"/>
      <path d="M50 14 L23 41" stroke="#8aa0b8" stroke-width="1.5"/>
      <path d="M16 34 L28 46" stroke="#d49b35" stroke-width="4.5"/>
      <path d="M13 47 L20 40 L24 44 L17 51 Z" fill="#8c4b1f"/>
      <circle cx="14" cy="49" r="3.5" fill="#ffd24a"/>
      <path d="M16 12 L12 16 L38 42 L44 44 L42 38 Z" fill="#cfdbe8" opacity="0.9"/>
      <path d="M48 34 L36 46" stroke="#d49b35" stroke-width="4.5"/>
      <circle cx="50" cy="49" r="3.5" fill="#ffd24a"/>
    </g>
  `,

  defense: `
    <defs>
      <linearGradient id="ig_def" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8ab8ff"/>
        <stop offset="50%" stop-color="#2b5cb8"/>
        <stop offset="100%" stop-color="#142b5e"/>
      </linearGradient>
    </defs>
    <g stroke="#17120a" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 6 L54 14 L54 31 C54 45 43 54 32 58 C21 54 10 45 10 31 L10 14 Z" fill="#f0bd46"/>
      <path d="M32 11 L49 17.5 L49 31 C49 42 40 49.5 32 53 C24 49.5 15 42 15 31 L15 17.5 Z" fill="url(#ig_def)"/>
      <path d="M32 11 L32 53 M15 30 L49 30" stroke="#f0bd46" stroke-width="3.5"/>
      <circle cx="32" cy="30" r="6" fill="#ffd86b" stroke="#5c3d06" stroke-width="1.8"/>
    </g>
  `,

  power: `
    <defs>
      <radialGradient id="ig_pow" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stop-color="#fff7b8"/>
        <stop offset="45%" stop-color="#ff7724"/>
        <stop offset="85%" stop-color="#b8143a"/>
        <stop offset="100%" stop-color="#4a0628"/>
      </radialGradient>
    </defs>
    <g stroke="#1f0914" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 6 C38 16 52 22 50 37 C49 49 41 57 32 57 C23 57 15 49 14 37 C12 24 23 19 26 11 C27 17 31 18 32 6 Z" fill="url(#ig_pow)"/>
      <path d="M32 20 C36 27 42 31 41 40 C40 47 36 52 32 52 C28 52 24 47 23 40 C22 33 28 28 32 20 Z" fill="#ffd447" stroke="none"/>
      <circle cx="32" cy="41" r="6.5" fill="#ffffff" stroke="#a63e08" stroke-width="1.5"/>
    </g>
  `,

  knowledge: `
    <g stroke="#1c1308" stroke-width="2.2" stroke-linejoin="round">
      <path d="M8 18 C16 15 26 17 32 22 C38 17 48 15 56 18 L56 48 C48 45 38 47 32 52 C26 47 16 45 8 48 Z" fill="#8c261f"/>
      <path d="M11 15 C18 12 27 14 32 19 C37 14 46 12 53 15 L53 44 C46 41 37 43 32 48 C27 43 18 41 11 44 Z" fill="#f7ebd2"/>
      <line x1="32" y1="19" x2="32" y2="48" stroke="#6e5233" stroke-width="2.2"/>
      <path d="M16 23 L27 25 M16 30 L27 32 M16 37 L25 38" stroke="#5e4326" stroke-width="2" stroke-linecap="round"/>
      <polygon points="43,21 45,26 50,26 46,29 47.5,34 43,31 38.5,34 40,29 36,26 41,26" fill="#4aa8ff" stroke="#184778" stroke-width="1.3"/>
      <path d="M29 46 L29 56 L32 53 L35 56 L35 46 Z" fill="#f0b938"/>
    </g>
  `,

  morale: `
    <g stroke="#241506" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 6 C26 14 14 14 10 8 C8 20 14 28 24 31 L20 50 L27 47 L32 56 L37 47 L44 50 L40 31 C50 28 56 20 54 8 C50 14 38 14 32 6 Z" fill="#f5bd33"/>
      <circle cx="32" cy="24" r="10" fill="#ffe885"/>
      <path d="M25 22 L32 14 L39 22 L35 22 L35 30 L29 30 L29 22 Z" fill="#d92b2b" stroke="#5c0c0c" stroke-width="1.5"/>
    </g>
  `,

  luck: `
    <g stroke="#142911" stroke-width="2.2" stroke-linejoin="round">
      <path d="M18 14 C10 22 10 42 20 50 C27 55 37 55 44 50 C54 42 54 22 46 14 L40 18 C46 25 46 39 39 44 C35 47 29 47 25 44 C18 39 18 25 24 18 Z" fill="#f2bc33" stroke="#382405"/>
      <circle cx="32" cy="21" r="6.5" fill="#32bf54"/>
      <circle cx="24" cy="29" r="6.5" fill="#32bf54"/>
      <circle cx="40" cy="29" r="6.5" fill="#32bf54"/>
      <circle cx="32" cy="37" r="6.5" fill="#28a346"/>
      <path d="M32 37 L35 47" stroke="#1e7532" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="32" cy="29" r="3" fill="#8cff9e" stroke="none"/>
    </g>
  `,

  mana: `
    <defs>
      <radialGradient id="ig_mana" cx="38%" cy="32%" r="65%">
        <stop offset="0%" stop-color="#c4f5ff"/>
        <stop offset="45%" stop-color="#3399ff"/>
        <stop offset="100%" stop-color="#142b7a"/>
      </radialGradient>
    </defs>
    <g stroke="#0c1838" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 7 C32 7 50 27 50 40 C50 50 42 57 32 57 C22 57 14 50 14 40 C14 27 32 7 32 7 Z" fill="url(#ig_mana)"/>
      <path d="M24 32 C21 38 23 45 28 49" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8"/>
      <polygon points="32,18 34,24 40,26 34,28 32,34 30,28 24,26 30,24" fill="#ffffff" stroke="none"/>
    </g>
  `,

  movement: `
    <g stroke="#1f1307" stroke-width="2.2" stroke-linejoin="round">
      <path d="M18 14 L34 14 L32 36 L48 40 C53 41 55 46 53 50 L14 50 L14 36 Z" fill="#9c5a25"/>
      <path d="M16 12 L36 12 L35 20 L15 20 Z" fill="#d99b38"/>
      <rect x="13" y="48" width="40" height="5" rx="2" fill="#4a2a10"/>
      <path d="M34 24 C42 22 48 16 54 10 C50 20 45 26 38 29 C44 29 49 26 54 22 C49 30 42 34 33 34 Z" fill="#fff0b8" stroke="#523907" stroke-width="1.6"/>
    </g>
  `,

  xp: `
    <g stroke="#291a04" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="24" fill="#3a2459" stroke="#d49b35" stroke-width="2.5"/>
      <polygon points="32,8 38,23 54,24 42,35 46,51 32,42 18,51 22,35 10,24 26,23" fill="#ffd23f"/>
      <polygon points="32,14 36,25 47,26 38,33 41,44 32,38 23,44 26,33 17,26 28,25" fill="#fff3a6" stroke="none"/>
    </g>
  `,

  hp: `
    <defs>
      <radialGradient id="ig_hp" cx="35%" cy="30%" r="65%">
        <stop offset="0%" stop-color="#ff99a8"/>
        <stop offset="50%" stop-color="#e61938"/>
        <stop offset="100%" stop-color="#6e0516"/>
      </radialGradient>
    </defs>
    <g stroke="#29040b" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 54 C32 54 10 40 10 23 C10 14 17 9 24 9 C28 9 31 12 32 15 C33 12 36 9 40 9 C47 9 54 14 54 23 C54 40 32 54 32 54 Z" fill="url(#ig_hp)"/>
      <path d="M18 20 C18 16 21 14 24 14" stroke="#ffd6dc" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    </g>
  `,

  speed: `
    <g stroke="#142130" stroke-width="2.2" stroke-linejoin="round">
      <path d="M10 46 C22 44 36 36 46 22 C40 24 34 24 28 22 C38 18 48 12 54 6 C54 18 48 32 36 42 C42 41 48 39 52 35 C44 46 28 52 10 46 Z" fill="#70d6ff"/>
      <path d="M8 28 L26 28 M4 36 L20 36 M12 20 L28 20" stroke="#ffe478" stroke-width="3" stroke-linecap="round"/>
    </g>
  `,

  damage: `
    <g stroke="#290804" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="32,6 39,20 55,14 46,29 58,40 42,43 45,58 32,47 19,58 22,43 6,40 18,29 9,14 25,20" fill="#ff5926"/>
      <polygon points="32,15 36,24 46,21 41,30 49,37 38,39 40,48 32,41 24,48 26,39 15,37 23,30 18,21 28,24" fill="#ffe047" stroke="none"/>
    </g>
  `,

  shots: `
    <g stroke="#1f1308" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <path d="M16 10 C38 16 44 36 22 54" fill="none" stroke="#a66329" stroke-width="4"/>
      <line x1="16" y1="10" x2="22" y2="54" stroke="#e6dcc8" stroke-width="1.8"/>
      <line x1="10" y1="32" x2="52" y2="32" stroke="#d9a66c" stroke-width="3"/>
      <polygon points="56,32 44,26 47,32 44,38" fill="#d8e2ed"/>
      <polygon points="8,32 15,27 18,27 13,32 18,37 15,37" fill="#e83b3b"/>
    </g>
  `,

  // ---- כישורים משניים (SKILLS) ----
  logistics: `
    <g stroke="#1f1408" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="24" fill="#d9b882" stroke="#8c5a24" stroke-width="3"/>
      <path d="M14 42 C22 34 26 38 34 28 C40 20 46 22 50 16" fill="none" stroke="#7a4618" stroke-width="4" stroke-dasharray="5 3" stroke-linecap="round"/>
      <polygon points="32,10 36,26 52,32 36,36 32,52 28,36 12,32 28,26" fill="#f0b63a"/>
      <circle cx="32" cy="32" r="5" fill="#d92b2b"/>
    </g>
  `,

  offense: `
    <g stroke="#240b08" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="24" fill="#7a1616" stroke="#e0a838" stroke-width="2.5"/>
      <path d="M18 46 L42 22 M32 12 L52 12 L52 32 Z" fill="#f2f6fa"/>
      <path d="M46 10 L54 18 L24 48 L16 48 L16 40 Z" fill="#e1eaf2"/>
      <path d="M14 36 L28 50" stroke="#f0b63a" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M10 50 L18 42 L22 46 L14 54 Z" fill="#703814"/>
      <path d="M22 18 L28 12 M14 28 L22 20" stroke="#ffcf4a" stroke-width="2.5" stroke-linecap="round"/>
    </g>
  `,

  archery: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="28" cy="34" r="20" fill="#f5ebd6" stroke="#8c5420" stroke-width="2.5"/>
      <circle cx="28" cy="34" r="13" fill="#3078d6" stroke="none"/>
      <circle cx="28" cy="34" r="7" fill="#e62e2e" stroke="none"/>
      <circle cx="28" cy="34" r="2.8" fill="#ffd83b" stroke="none"/>
      <line x1="28" y1="34" x2="54" y2="10" stroke="#754216" stroke-width="3.2" stroke-linecap="round"/>
      <polygon points="26,36 33,25 32,31 38,31" fill="#ccd6e0"/>
      <polygon points="54,10 47,12 44,17 51,15 49,21 56,14" fill="#32bf54"/>
    </g>
  `,

  armorer: `
    <g stroke="#171b24" stroke-width="2.2" stroke-linejoin="round">
      <path d="M16 14 L24 10 L32 15 L40 10 L48 14 L54 24 L46 30 L45 52 L19 52 L18 30 L10 24 Z" fill="#9aa8b8"/>
      <path d="M24 10 L32 15 L32 52 L19 52 L18 30 L10 24 L16 14 Z" fill="#c7d4e2" stroke="none"/>
      <path d="M16 14 L24 10 L32 15 L40 10 L48 14 L54 24 L46 30 L45 52 L19 52 L18 30 L10 24 Z" fill="none"/>
      <path d="M20 26 L32 32 L44 26 M20 38 L32 44 L44 38" stroke="#f0b63a" stroke-width="2.5" fill="none"/>
      <polygon points="32,19 36,25 32,31 28,25" fill="#f0b63a"/>
    </g>
  `,

  wisdom: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="24" r="15" fill="#7030a0" stroke="#ffd24a" stroke-width="2.2"/>
      <path d="M26 16 C32 12 38 16 34 22 C31 26 32 29 32 31" stroke="#fff3a8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <circle cx="32" cy="35" r="1.8" fill="#fff3a8" stroke="none"/>
      <path d="M12 42 C20 39 27 41 32 45 C37 41 44 39 52 42 L52 54 C44 51 37 53 32 56 C27 53 20 51 12 54 Z" fill="#f5e6c4"/>
    </g>
  `,

  leadership: `
    <g stroke="#241506" stroke-width="2.2" stroke-linejoin="round">
      <line x1="16" y1="8" x2="16" y2="56" stroke="#8c541e" stroke-width="4" stroke-linecap="round"/>
      <circle cx="16" cy="8" r="3.5" fill="#ffd24a"/>
      <path d="M18 12 L54 16 L46 28 L54 40 L18 38 Z" fill="#d92626"/>
      <path d="M18 12 L54 16 L51 20 L18 17 Z" fill="#f2bd38"/>
      <path d="M18 34 L51 36 L54 40 L18 38 Z" fill="#f2bd38"/>
      <polygon points="33,19 35,24 40,24 36,27 37.5,32 33,29 28.5,32 30,27 26,24 31,24" fill="#ffe875" stroke="#5e3a04" stroke-width="1.2"/>
    </g>
  `,

  scouting: `
    <g stroke="#1b1409" stroke-width="2.2" stroke-linejoin="round">
      <path d="M8 32 C16 18 24 14 32 14 C40 14 48 18 56 32 C48 46 40 50 32 50 C24 50 16 46 8 32 Z" fill="#f5ebd6"/>
      <circle cx="32" cy="32" r="11" fill="#3288e6"/>
      <circle cx="32" cy="32" r="5" fill="#121824"/>
      <circle cx="28" cy="28" r="2.8" fill="#ffffff" stroke="none"/>
      <path d="M8 32 C16 18 24 14 32 14 C40 14 48 18 56 32" fill="none" stroke="#d99b26" stroke-width="3.2"/>
    </g>
  `,

  pathfinding: `
    <g stroke="#172411" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="6,48 22,22 36,48" fill="#6b7a62"/>
      <polygon points="24,48 40,16 58,48" fill="#4f6346"/>
      <polygon points="35,26 40,16 45,26 42,24 40,27 38,24" fill="#f0f7f4" stroke="none"/>
      <path d="M8 52 C22 52 24 42 34 40 C42 38 46 32 52 30" fill="none" stroke="#f0c246" stroke-width="4" stroke-linecap="round"/>
      <polygon points="16,48 22,34 28,48" fill="#288a3c"/>
    </g>
  `,

  sorcery: `
    <g stroke="#1e0b2b" stroke-width="2.2" stroke-linejoin="round">
      <path d="M12 52 L38 26" stroke="#7a4218" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="42" cy="22" r="9" fill="#c852ff"/>
      <circle cx="42" cy="22" r="5" fill="#f5d6ff" stroke="none"/>
      <path d="M42 6 L42 10 M58 22 L54 22 M53 11 L50 14 M31 11 L34 14 M53 33 L50 30" stroke="#ffd84a" stroke-width="2.5" stroke-linecap="round"/>
      <polygon points="20,16 22,21 27,23 22,25 20,30 18,25 13,23 18,21" fill="#70e8ff" stroke="none"/>
    </g>
  `,

  intelligence: `
    <g stroke="#0e1c36" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="30" r="18" fill="#2c75e6"/>
      <path d="M22 24 C24 16 40 16 42 24 C45 28 42 36 36 37 L28 37 C22 36 19 28 22 24 Z" fill="#8cf0ff"/>
      <path d="M32 18 L32 37 M25 25 L32 28 L39 25 M26 32 L32 34 L38 32" stroke="#164996" stroke-width="1.8" fill="none"/>
      <path d="M22 46 L42 46 L38 54 L26 54 Z" fill="#f0b938"/>
    </g>
  `,

  estates: `
    <g stroke="#261706" stroke-width="2.2" stroke-linejoin="round">
      <path d="M12 28 L12 52 L52 52 L52 28 L42 28 L42 20 L36 20 L36 28 L28 28 L28 20 L22 20 L22 28 Z" fill="#c9b492"/>
      <polygon points="10,28 20,14 30,28" fill="#b82c2c"/>
      <polygon points="34,28 44,14 54,28" fill="#b82c2c"/>
      <path d="M27 52 L27 38 C27 34 37 34 37 38 L37 52 Z" fill="#633a16"/>
      <circle cx="46" cy="46" r="8" fill="#ffd23f"/>
      <circle cx="38" cy="49" r="7" fill="#f0b624"/>
    </g>
  `,

  learning: `
    <g stroke="#241508" stroke-width="2.2" stroke-linejoin="round">
      <path d="M14 14 C14 10 20 10 22 14 L48 14 C52 14 52 20 48 20 L48 46 C52 46 52 52 48 52 L20 52 C15 52 14 48 14 44 Z" fill="#f5e1b8"/>
      <path d="M24 24 L42 24 M24 32 L40 32 M24 40 L36 40" stroke="#7a542e" stroke-width="2" stroke-linecap="round"/>
      <path d="M40 44 C46 34 52 22 56 10 C46 14 38 24 36 36 Z" fill="#42b8ff"/>
      <line x1="34" y1="46" x2="54" y2="12" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
    </g>
  `,

  necromancy: `
    <g stroke="#0e1f12" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="24" fill="#1a1228" stroke="#47e675" stroke-width="2"/>
      <path d="M18 30 C18 18 24 12 32 12 C40 12 46 18 46 30 C46 36 43 40 40 42 L40 50 L24 50 L24 42 C21 40 18 36 18 30 Z" fill="#e2e8dc"/>
      <circle cx="26" cy="28" r="4.5" fill="#32ff6a"/>
      <circle cx="38" cy="28" r="4.5" fill="#32ff6a"/>
      <polygon points="32,33 29,39 35,39" fill="#202922"/>
      <line x1="28" y1="44" x2="28" y2="50" stroke="#202922" stroke-width="2"/>
      <line x1="32" y1="44" x2="32" y2="50" stroke="#202922" stroke-width="2"/>
      <line x1="36" y1="44" x2="36" y2="50" stroke="#202922" stroke-width="2"/>
    </g>
  `,

  // ---- פעולות ממשק (UI Actions) ----
  endTurn: `
    <g stroke="#241608" stroke-width="2.2" stroke-linejoin="round">
      <rect x="14" y="8" width="36" height="6" rx="2" fill="#d99b32"/>
      <rect x="14" y="50" width="36" height="6" rx="2" fill="#d99b32"/>
      <path d="M18 14 C18 24 27 29 30 32 C27 35 18 40 18 50 L46 50 C46 40 37 35 34 32 C37 29 46 24 46 14 Z" fill="#bfe8ff" opacity="0.85"/>
      <path d="M23 20 L41 20 C39 25 35 28 32 30 C29 28 25 25 23 20 Z" fill="#f0b63a" stroke="none"/>
      <path d="M21 48 C23 42 29 39 32 36 C35 39 41 42 43 48 Z" fill="#f0b63a" stroke="none"/>
      <line x1="16" y1="14" x2="16" y2="50" stroke="#8c5618" stroke-width="2.5"/>
      <line x1="48" y1="14" x2="48" y2="50" stroke="#8c5618" stroke-width="2.5"/>
    </g>
  `,

  nextHero: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <path d="M12 48 C14 38 20 34 28 34 C36 34 42 38 44 48 Z" fill="#3275d6"/>
      <circle cx="28" cy="22" r="9" fill="#f2c894"/>
      <path d="M19 20 L28 11 L37 20 Z" fill="#d99b32"/>
      <polygon points="38,24 56,34 38,44 42,34" fill="#ffd23f"/>
    </g>
  `,

  spellbook: `
    <g stroke="#1f0d29" stroke-width="2.2" stroke-linejoin="round">
      <rect x="12" y="8" width="40" height="48" rx="4" fill="#6b1d8c"/>
      <rect x="16" y="8" width="36" height="48" rx="3" fill="#8626b0"/>
      <rect x="12" y="8" width="6" height="48" rx="2" fill="#f0b63a"/>
      <polygon points="34,17 37,26 46,26 39,32 42,41 34,35 26,41 29,32 22,26 31,26" fill="#ffd84a"/>
      <circle cx="34" cy="30" r="3.5" fill="#70f0ff" stroke="none"/>
    </g>
  `,

  hero: `
    <g stroke="#1c1309" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 6 C40 6 46 12 46 20 L46 28 L32 32 L18 28 L18 20 C18 12 24 6 32 6 Z" fill="#ff3b3b"/>
      <path d="M18 22 C18 13 24 10 32 10 C40 10 46 13 46 22 L46 46 L32 54 L18 46 Z" fill="#c8d4e0"/>
      <path d="M22 30 L32 34 L42 30 L42 36 L32 40 L22 36 Z" fill="#1a222e"/>
      <line x1="32" y1="12" x2="32" y2="52" stroke="#f0b63a" stroke-width="3"/>
    </g>
  `,

  town: `
    <g stroke="#1c1309" stroke-width="2.2" stroke-linejoin="round">
      <rect x="10" y="28" width="12" height="26" fill="#b8aa96"/>
      <rect x="42" y="28" width="12" height="26" fill="#b8aa96"/>
      <rect x="20" y="22" width="24" height="32" fill="#d9ccb8"/>
      <polygon points="8,28 16,14 24,28" fill="#c92a2a"/>
      <polygon points="40,28 48,14 56,28" fill="#c92a2a"/>
      <polygon points="18,22 32,8 46,22" fill="#3066be"/>
      <path d="M26 54 L26 40 C26 35 38 35 38 40 L38 54 Z" fill="#593515"/>
      <line x1="32" y1="8" x2="32" y2="3" stroke="#f0b63a" stroke-width="2"/>
    </g>
  `,

  menu: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <rect x="10" y="14" width="44" height="8" rx="4" fill="#f0b63a"/>
      <rect x="10" y="28" width="44" height="8" rx="4" fill="#f0b63a"/>
      <rect x="10" y="42" width="44" height="8" rx="4" fill="#f0b63a"/>
    </g>
  `,

  save: `
    <g stroke="#17140e" stroke-width="2.2" stroke-linejoin="round">
      <path d="M12 10 L44 10 L52 18 L52 54 L12 54 Z" fill="#2e5cb8"/>
      <rect x="20" y="10" width="22" height="16" rx="2" fill="#d8e2ed"/>
      <rect x="18" y="34" width="28" height="20" rx="2" fill="#f5e8c8"/>
      <rect x="34" y="13" width="5" height="10" fill="#2e5cb8"/>
    </g>
  `,

  load: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <path d="M8 20 L24 20 L28 25 L54 25 L50 52 L12 52 Z" fill="#d99426"/>
      <path d="M12 28 L56 28 L50 52 L12 52 Z" fill="#f2bd42"/>
      <path d="M32 8 L44 20 L36 20 L36 32 L28 32 L28 20 L20 20 Z" fill="#5ce67e"/>
    </g>
  `,

  sound: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <polygon points="10,24 22,24 34,12 34,52 22,40 10,40" fill="#f0b63a"/>
      <path d="M41 22 C46 27 46 37 41 42" fill="none" stroke="#70d6ff" stroke-width="3.2"/>
      <path d="M47 15 C55 24 55 40 47 49" fill="none" stroke="#70d6ff" stroke-width="3.2"/>
    </g>
  `,

  soundOff: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <polygon points="10,24 22,24 34,12 34,52 22,40 10,40" fill="#8c8275"/>
      <line x1="40" y1="22" x2="54" y2="38" stroke="#ff4242" stroke-width="4"/>
      <line x1="54" y1="22" x2="40" y2="38" stroke="#ff4242" stroke-width="4"/>
    </g>
  `,

  sleep: `
    <g stroke="#12182b" stroke-width="2.2" stroke-linejoin="round">
      <path d="M36 10 C22 12 14 26 18 40 C22 52 36 56 48 48 C36 50 26 40 28 26 C29 18 33 13 36 10 Z" fill="#ffd859"/>
      <path d="M38 16 L48 16 L38 26 L48 26" fill="none" stroke="#9ecfff" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M46 28 L54 28 L46 36 L54 36" fill="none" stroke="#9ecfff" stroke-width="2.2" stroke-linecap="round"/>
    </g>
  `,

  wake: `
    <g stroke="#291704" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="32" cy="32" r="13" fill="#ffd23f"/>
      <path d="M32 6 L32 13 M32 51 L32 58 M6 32 L13 32 M51 32 L58 32 M14 14 L19 19 M45 45 L50 50 M50 14 L45 19 M19 45 L14 50" stroke="#ff9d26" stroke-width="3.5"/>
    </g>
  `,

  close: `
    <g stroke="#290707" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="32" cy="32" r="24" fill="#b81d1d" stroke="#f0b63a"/>
      <line x1="21" y1="21" x2="43" y2="43" stroke="#fff2d6" stroke-width="5"/>
      <line x1="43" y1="21" x2="21" y2="43" stroke="#fff2d6" stroke-width="5"/>
    </g>
  `,

  build: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <line x1="14" y1="50" x2="42" y2="22" stroke="#8c5420" stroke-width="5" stroke-linecap="round"/>
      <path d="M30 12 L52 24 L46 32 L26 18 Z" fill="#a8b5c4"/>
      <rect x="10" y="44" width="20" height="10" rx="1" fill="#d97236"/>
      <rect x="28" y="44" width="20" height="10" rx="1" fill="#c45c22"/>
    </g>
  `,

  recruit: `
    <g stroke="#1c1308" stroke-width="2.2" stroke-linejoin="round">
      <path d="M18 22 C18 13 24 9 32 9 C40 9 46 13 46 22 L46 42 L32 50 L18 42 Z" fill="#b8c7d9"/>
      <path d="M23 27 L32 31 L41 27 L41 33 L32 37 L23 33 Z" fill="#1b222c"/>
      <circle cx="48" cy="46" r="10" fill="#2eb84b"/>
      <path d="M48 41 L48 51 M43 46 L53 46" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    </g>
  `,

  market: `
    <g stroke="#211407" stroke-width="2.2" stroke-linejoin="round">
      <line x1="32" y1="10" x2="32" y2="52" stroke="#d99b26" stroke-width="3.5"/>
      <rect x="20" y="50" width="24" height="6" rx="2" fill="#b87d14"/>
      <line x1="12" y1="20" x2="52" y2="20" stroke="#f0bd42" stroke-width="3"/>
      <path d="M12 20 L6 36 L18 36 Z M52 20 L46 36 L58 36 Z" fill="none" stroke="#8c5a1b" stroke-width="1.8"/>
      <path d="M5 36 C5 42 19 42 19 36 Z M45 36 C45 42 59 42 59 36 Z" fill="#ffd24a"/>
    </g>
  `,

  tavern: `
    <g stroke="#1f1206" stroke-width="2.2" stroke-linejoin="round">
      <path d="M38 24 L50 24 C54 24 54 44 50 44 L38 44" fill="none" stroke="#d99b26" stroke-width="4.5"/>
      <rect x="14" y="18" width="26" height="34" rx="3" fill="#a66224"/>
      <rect x="14" y="24" width="26" height="5" fill="#d99b26"/>
      <rect x="14" y="41" width="26" height="5" fill="#d99b26"/>
      <path d="M12 18 C12 12 18 10 22 13 C25 9 32 9 35 13 C40 11 44 15 42 20 C42 23 36 24 34 21 L14 20 Z" fill="#fff7e6"/>
    </g>
  `,

  fort: `
    <g stroke="#1a1612" stroke-width="2.2" stroke-linejoin="round">
      <path d="M12 14 L20 14 L20 22 L28 22 L28 14 L36 14 L36 22 L44 22 L44 14 L52 14 L52 54 L12 54 Z" fill="#9ea6b2"/>
      <path d="M24 54 L24 38 C24 32 40 32 40 38 L40 54 Z" fill="#4a321a"/>
      <line x1="29" y1="35" x2="29" y2="54" stroke="#261a0e" stroke-width="2"/>
      <line x1="35" y1="35" x2="35" y2="54" stroke="#261a0e" stroke-width="2"/>
    </g>
  `,

  flee: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <line x1="16" y1="10" x2="22" y2="54" stroke="#8c5420" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M18 12 C28 10 36 16 48 14 C44 22 46 28 50 34 C38 36 30 30 20 34 Z" fill="#f2f5f8"/>
      <path d="M8 42 L26 42 M12 49 L32 49" stroke="#70d6ff" stroke-width="2.5" stroke-linecap="round"/>
    </g>
  `,

  wait: `
    <g stroke="#1c140a" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="22" fill="#f5e6c8" stroke="#d99b26" stroke-width="3.5"/>
      <polyline points="32,16 32,32 44,38" fill="none" stroke="#2b1d0e" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="32" cy="32" r="3" fill="#d92b2b"/>
    </g>
  `,

  defend: `
    <g stroke="#141a24" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 8 L52 16 L52 32 C52 45 42 53 32 57 C22 53 12 45 12 32 L12 16 Z" fill="#3a75c4"/>
      <path d="M32 14 L46 20 L46 31 C46 41 39 47 32 50 C25 47 18 41 18 31 L18 20 Z" fill="#70b5ff"/>
      <path d="M24 31 L30 37 L41 25" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
    </g>
  `,

  auto: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="23" fill="#2b3648" stroke="#f0b63a" stroke-width="2.5"/>
      <path d="M20 44 L44 20 M44 44 L20 20" stroke="#e6eef7" stroke-width="4" stroke-linecap="round"/>
      <polygon points="32,10 36,24 28,24" fill="#ffd23f"/>
    </g>
  `,

  info: `
    <g stroke="#121c2b" stroke-width="2.2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="23" fill="#2968c8" stroke="#f0b63a" stroke-width="2.5"/>
      <circle cx="32" cy="19" r="3.5" fill="#ffffff" stroke="none"/>
      <rect x="28.5" y="26" width="7" height="20" rx="3" fill="#ffffff" stroke="none"/>
    </g>
  `,

  kingdom: `
    <g stroke="#241506" stroke-width="2.2" stroke-linejoin="round">
      <path d="M10 44 L14 20 L24 30 L32 14 L40 30 L50 20 L54 44 Z" fill="#ffd23f"/>
      <rect x="10" y="44" width="44" height="7" rx="2" fill="#d99816"/>
      <circle cx="32" cy="36" r="3.5" fill="#e62e2e"/>
      <circle cx="20" cy="37" r="2.8" fill="#2e88e6"/>
      <circle cx="44" cy="37" r="2.8" fill="#2eb84b"/>
    </g>
  `,

  quest: `
    <g stroke="#241506" stroke-width="2.2" stroke-linejoin="round">
      <rect x="14" y="10" width="36" height="44" rx="4" fill="#f5e3bc"/>
      <rect x="28" y="17" width="8" height="17" rx="3" fill="#d92626"/>
      <circle cx="32" cy="42" r="4" fill="#d92626"/>
    </g>
  `,

  dig: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <line x1="16" y1="14" x2="38" y2="36" stroke="#8c5420" stroke-width="4.5"/>
      <path d="M12 18 L20 10" stroke="#d99b26" stroke-width="4"/>
      <path d="M34 40 L44 30 L52 38 C55 44 52 51 46 48 L34 40 Z" fill="#b8c4d0"/>
    </g>
  `,

  calendar: `
    <g stroke="#241506" stroke-width="2.2" stroke-linejoin="round">
      <rect x="10" y="14" width="44" height="40" rx="4" fill="#f5e6c8"/>
      <path d="M10 24 L54 24 L54 18 C54 15 52 14 49 14 L15 14 C12 14 10 15 10 18 Z" fill="#c92a2a"/>
      <circle cx="32" cy="39" r="9" fill="#ffd23f"/>
    </g>
  `,

  mageGuild: `
    <g stroke="#1c0d26" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="20,54 24,24 40,24 44,54" fill="#5e3a78"/>
      <polygon points="18,24 32,8 46,24" fill="#9c42f5"/>
      <circle cx="32" cy="18" r="5" fill="#70f0ff"/>
      <path d="M28 54 L28 40 C28 36 36 36 36 40 L36 54 Z" fill="#ffd24a"/>
    </g>
  `,

  upgrade: `
    <g stroke="#1b1408" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="32,8 52,28 40,28 40,42 24,42 24,28 12,28" fill="#ffd23f"/>
      <polygon points="32,26 48,42 38,42 38,56 26,56 26,42 16,42" fill="#42d96b"/>
    </g>
  `,

  dismiss: `
    <g stroke="#260808" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="32" cy="32" r="22" fill="#8c1d1d"/>
      <line x1="20" y1="20" x2="44" y2="44" stroke="#ffd24a" stroke-width="4.5"/>
      <line x1="44" y1="20" x2="20" y2="44" stroke="#ffd24a" stroke-width="4.5"/>
    </g>
  `,

  split: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 52 L32 34 L16 20 L22 20 L12 12 L12 24 L16 20 M32 34 L48 20 L42 20 L52 12 L52 24 L48 20" fill="#ffd23f" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="32" cy="50" r="5" fill="#70d6ff"/>
    </g>
  `,

  swap: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="10,22 24,12 24,18 52,18 52,26 24,26 24,32" fill="#70d6ff"/>
      <polygon points="54,42 40,32 40,38 12,38 12,46 40,46 40,52" fill="#ffd23f"/>
    </g>
  `,

  // ---- לחשים (SPELLS) ----
  magicArrow: `
    <g stroke="#1f0933" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#231038" stroke="#b48cff" stroke-width="2"/>
      <line x1="12" y1="52" x2="48" y2="16" stroke="#e5c4ff" stroke-width="4" stroke-linecap="round"/>
      <polygon points="54,10 38,16 44,20 48,26" fill="#70f2ff" stroke="#ffffff" stroke-width="1.2"/>
      <polygon points="10,54 18,42 22,46" fill="#d480ff"/>
      <circle cx="28" cy="22" r="2.5" fill="#fff" stroke="none"/>
      <circle cx="42" cy="38" r="2" fill="#70f2ff" stroke="none"/>
    </g>
  `,

  cure: `
    <g stroke="#0c2918" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#0f3320" stroke="#7dffb0" stroke-width="2"/>
      <path d="M26 14 L38 14 L38 26 L50 26 L50 38 L38 38 L38 50 L26 50 L26 38 L14 38 L14 26 L26 26 Z" fill="#52ff9a"/>
      <circle cx="32" cy="32" r="6" fill="#ffffff" stroke="none"/>
    </g>
  `,

  bless: `
    <g stroke="#291d06" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#332409" stroke="#ffe27a" stroke-width="2"/>
      <polygon points="32,8 37,24 54,24 40,34 45,50 32,40 19,50 24,34 10,24 27,24" fill="#ffe27a"/>
      <circle cx="32" cy="31" r="7" fill="#ffffff" stroke="none"/>
    </g>
  `,

  curse: `
    <g stroke="#1a062e" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#1b092e" stroke="#8c3cff" stroke-width="2"/>
      <path d="M20 26 C20 16 44 16 44 26 C44 33 39 36 39 44 L25 44 C25 36 20 33 20 26 Z" fill="#b47aff"/>
      <circle cx="27" cy="27" r="3.5" fill="#1b092e"/>
      <circle cx="37" cy="27" r="3.5" fill="#1b092e"/>
      <path d="M16 48 L48 16" stroke="#ff3860" stroke-width="3.5" stroke-linecap="round"/>
    </g>
  `,

  stoneSkin: `
    <g stroke="#211b12" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#2e261b" stroke="#c9b48a" stroke-width="2"/>
      <path d="M32 10 L50 17 L48 36 C46 45 39 51 32 54 C25 51 18 45 16 36 L14 17 Z" fill="#b8a37a"/>
      <path d="M22 18 L32 28 L44 22 M20 36 L32 34 L44 40 M32 28 L30 48" stroke="#524632" stroke-width="2.2" fill="none"/>
    </g>
  `,

  haste: `
    <g stroke="#09252e" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#0d2b36" stroke="#9ef0ff" stroke-width="2"/>
      <path d="M14 40 C26 38 38 30 48 14 C48 26 42 38 30 46 C38 45 45 42 50 38 C42 49 26 52 14 40 Z" fill="#9ef0ff"/>
      <polygon points="28,12 18,28 28,28 22,44 40,24 30,24" fill="#ffe46b"/>
    </g>
  `,

  slow: `
    <g stroke="#0d1533" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#101a3d" stroke="#5a7cff" stroke-width="2"/>
      <circle cx="32" cy="26" r="10" fill="none" stroke="#8aa2ff" stroke-width="3.5"/>
      <polygon points="20,48 25,28 39,28 44,48" fill="#5a7cff"/>
      <path d="M26 36 L38 36" stroke="#d4e0ff" stroke-width="2.5"/>
    </g>
  `,

  bloodlust: `
    <g stroke="#2b0606" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#360909" stroke="#ff5a4a" stroke-width="2"/>
      <path d="M32 10 C42 22 48 31 48 40 C48 49 41 54 32 54 C23 54 16 49 16 40 C16 31 22 22 32 10 Z" fill="#ff2e2e"/>
      <path d="M24 34 L30 38 M40 34 L34 38" stroke="#fff275" stroke-width="3" stroke-linecap="round"/>
    </g>
  `,

  lightningBolt: `
    <g stroke="#0a1e2e" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#0f2538" stroke="#bfe6ff" stroke-width="2"/>
      <polygon points="36,6 16,34 30,34 24,58 48,28 34,28" fill="#e6f7ff" stroke="#3898ff" stroke-width="2"/>
    </g>
  `,

  blind: `
    <g stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#1f1f24" stroke="#888" stroke-width="2"/>
      <path d="M12 32 C20 20 44 20 52 32 C44 44 20 44 12 32 Z" fill="#555"/>
      <line x1="14" y1="16" x2="50" y2="48" stroke="#ff4242" stroke-width="4" stroke-linecap="round"/>
      <line x1="50" y1="16" x2="14" y2="48" stroke="#ff4242" stroke-width="4" stroke-linecap="round"/>
    </g>
  `,

  weakness: `
    <g stroke="#1c2610" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#1f2b12" stroke="#88aa55" stroke-width="2"/>
      <path d="M16 46 L28 34 L26 28 L32 30 L30 36" fill="#a8b89a"/>
      <path d="M36 24 L48 12 L52 16 L40 28 Z" fill="#a8b89a"/>
      <polygon points="32,54 22,40 28,40 28,28 36,28 36,40 42,40" fill="#99cc44"/>
    </g>
  `,

  fireball: `
    <g stroke="#2b0d04" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#331106" stroke="#ff7a2a" stroke-width="2"/>
      <path d="M54 10 C42 12 24 18 16 28 C10 35 12 46 20 50 C28 54 39 50 45 42 C52 32 52 20 54 10 Z" fill="#ff5e14"/>
      <circle cx="27" cy="37" r="11" fill="#ffe047" stroke="none"/>
      <circle cx="25" cy="39" r="6" fill="#ffffff" stroke="none"/>
    </g>
  `,

  frostRing: `
    <g stroke="#0b2236" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#0e2940" stroke="#9ad8ff" stroke-width="2"/>
      <circle cx="32" cy="32" r="14" fill="none" stroke="#bfeaff" stroke-width="6"/>
      <path d="M32 10 L32 18 M32 46 L32 54 M10 32 L18 32 M46 32 L54 32 M16 16 L22 22 M42 42 L48 48 M48 16 L42 22 M22 42 L16 48" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    </g>
  `,

  prayer: `
    <g stroke="#292208" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#33290a" stroke="#fff3b0" stroke-width="2"/>
      <circle cx="32" cy="24" r="14" fill="none" stroke="#ffe878" stroke-width="3"/>
      <path d="M22 48 C20 36 12 28 12 18 C18 20 24 26 26 34 Z" fill="#fff9d6"/>
      <path d="M42 48 C44 36 52 28 52 18 C46 20 40 26 38 34 Z" fill="#fff9d6"/>
    </g>
  `,

  meteorShower: `
    <g stroke="#2b0c04" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#2e0d05" stroke="#ff5a1f" stroke-width="2"/>
      <path d="M30 8 L14 24 M48 12 L26 34 M54 28 L34 48" stroke="#ff9d2e" stroke-width="5" stroke-linecap="round"/>
      <circle cx="14" cy="24" r="5" fill="#ffe252"/>
      <circle cx="26" cy="34" r="6" fill="#ffe252"/>
      <circle cx="34" cy="48" r="5.5" fill="#ffe252"/>
    </g>
  `,

  chainLightning: `
    <g stroke="#0a1f30" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#0d2438" stroke="#d4f0ff" stroke-width="2"/>
      <polyline points="12,18 28,14 20,32 44,26 32,48 52,44" fill="none" stroke="#70d6ff" stroke-width="5" stroke-linecap="round"/>
      <polyline points="12,18 28,14 20,32 44,26 32,48 52,44" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    </g>
  `,

  resurrection: `
    <g stroke="#292306" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#302808" stroke="#fff6a0" stroke-width="2"/>
      <ellipse cx="32" cy="22" rx="9" ry="7" fill="none" stroke="#ffe052" stroke-width="3.5"/>
      <path d="M22 29 L42 29 M32 29 L32 52" stroke="#ffe052" stroke-width="4" stroke-linecap="round"/>
      <path d="M12 28 C16 18 22 18 24 26 M52 28 C48 18 42 18 40 26" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    </g>
  `,

  armageddon: `
    <g stroke="#2b0505" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#330606" stroke="#ff3a1a" stroke-width="2"/>
      <circle cx="32" cy="34" r="14" fill="#ff2a14"/>
      <path d="M16 34 L48 34 M32 20 L32 48 M20 26 L44 42 M44 26 L20 42" stroke="#ffe647" stroke-width="2.2"/>
      <path d="M20 14 L26 24 M32 8 L32 20 M44 14 L38 24" stroke="#ff9c2a" stroke-width="3" stroke-linecap="round"/>
    </g>
  `,

  implosion: `
    <g stroke="#1c082e" stroke-width="2" stroke-linejoin="round">
      <circle cx="32" cy="32" r="25" fill="#180726" stroke="#c070ff" stroke-width="2"/>
      <circle cx="32" cy="32" r="16" fill="none" stroke="#9d42ff" stroke-width="2.5" stroke-dasharray="5 3"/>
      <circle cx="32" cy="32" r="8" fill="#12021c" stroke="#e6b8ff" stroke-width="2"/>
      <path d="M12 12 L23 23 M52 12 L41 23 M12 52 L23 41 M52 52 L41 41" stroke="#e6b8ff" stroke-width="3" stroke-linecap="round"/>
    </g>
  `,
};

// ============================================================================
//  איורי חפצים (24 ארטיפקטים)
// ============================================================================
const ARTIFACT_SHAPES = {
  swordOfValor: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="48,12 52,16 26,42 20,44 22,38" fill="#dfe8f2"/>
      <line x1="49" y1="15" x2="24" y2="40" stroke="#ffffff" stroke-width="1.5"/>
      <path d="M15 33 L29 47" stroke="#d99b26" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M12 48 L19 41 L23 45 L16 52 Z" fill="#7a3e14"/>
      <circle cx="13" cy="51" r="3.5" fill="#ffd23f"/>
    </g>
  `,
  davidsSling: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <path d="M16 14 C12 28 16 44 28 48 C40 52 50 40 46 26" fill="none" stroke="#9c5e28" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="30" cy="46" rx="11" ry="6" fill="#784214"/>
      <circle cx="30" cy="42" r="7" fill="#9ea8b8"/>
      <polygon points="30,36 32,40 36,40 33,43 34,47 30,45 26,47 27,43 24,40 28,40" fill="#70d6ff" stroke="none"/>
    </g>
  `,
  giantAxe: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <line x1="14" y1="52" x2="48" y2="12" stroke="#7a4216" stroke-width="5" stroke-linecap="round"/>
      <path d="M26 14 C16 16 12 26 18 34 L34 24 Z" fill="#c7d4e2"/>
      <path d="M48 26 C52 34 44 44 34 40 L40 22 Z" fill="#9fb0c2"/>
      <circle cx="37" cy="25" r="3.5" fill="#ffd23f"/>
    </g>
  `,
  titanBlade: `
    <g stroke="#141c29" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="50,10 54,14 28,44 18,46 20,36" fill="#70e8ff"/>
      <polyline points="48,14 38,22 42,26 30,34 34,38 24,42" fill="none" stroke="#ffffff" stroke-width="2"/>
      <path d="M13 31 L33 51" stroke="#ffd23f" stroke-width="5" stroke-linecap="round"/>
      <circle cx="14" cy="50" r="4.5" fill="#ff3860"/>
    </g>
  `,
  lionShield: `
    <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 10 L50 16 L48 34 C46 44 39 51 32 54 C25 51 18 44 16 34 L14 16 Z" fill="#295cb8" stroke="#f0b63a" stroke-width="3"/>
      <circle cx="32" cy="30" r="10" fill="#d98c1e"/>
      <circle cx="32" cy="30" r="6.5" fill="#ffd24a"/>
      <circle cx="30" cy="28" r="1.2" fill="#241506" stroke="none"/>
      <circle cx="34" cy="28" r="1.2" fill="#241506" stroke="none"/>
    </g>
  `,
  dragonShield: `
    <g stroke="#1f0808" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 9 L51 16 L49 35 C47 45 40 52 32 55 C24 52 17 45 15 35 L13 16 Z" fill="#a81919" stroke="#f0b63a" stroke-width="2.8"/>
      <path d="M20 24 Q26 30 32 24 Q38 30 44 24 M20 33 Q26 39 32 33 Q38 39 44 33 M24 42 Q32 48 40 42" fill="none" stroke="#ff9d2e" stroke-width="2.5"/>
    </g>
  `,
  helmOfCourage: `
    <g stroke="#171b24" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 8 C40 8 46 12 46 18 L32 22 L18 18 C18 12 24 8 32 8 Z" fill="#d92626"/>
      <path d="M18 24 C18 15 24 12 32 12 C40 12 46 15 46 24 L46 48 L36 52 L36 36 L28 36 L28 52 L18 48 Z" fill="#b8c7d9"/>
      <path d="M21 28 L30 31 M43 28 L34 31" stroke="#1a222c" stroke-width="3" stroke-linecap="round"/>
    </g>
  `,
  crownOfWisdom: `
    <g stroke="#241506" stroke-width="2.2" stroke-linejoin="round">
      <path d="M12 42 L15 22 L24 30 L32 16 L40 30 L49 22 L52 42 Z" fill="#ffd23f"/>
      <rect x="12" y="42" width="40" height="6" rx="2" fill="#d99816"/>
      <polygon points="32,24 36,32 32,38 28,32" fill="#2e88ff"/>
    </g>
  `,
  kingsCrown: `
    <g stroke="#241204" stroke-width="2.2" stroke-linejoin="round">
      <path d="M14 40 C14 24 24 18 32 18 C40 18 50 24 50 40 Z" fill="#b8192b"/>
      <path d="M10 42 L13 20 L23 30 L32 12 L41 30 L51 20 L54 42 Z" fill="#ffd84a"/>
      <rect x="10" y="42" width="44" height="7" rx="2" fill="#e09f1f"/>
      <circle cx="32" cy="35" r="4" fill="#ff2647"/>
      <circle cx="20" cy="36" r="3" fill="#2ec4ff"/>
      <circle cx="44" cy="36" r="3" fill="#38e66b"/>
    </g>
  `,
  scaleMail: `
    <g stroke="#17211b" stroke-width="2.2" stroke-linejoin="round">
      <path d="M16 14 L25 11 L32 16 L39 11 L48 14 L54 24 L46 30 L45 52 L19 52 L18 30 L10 24 Z" fill="#4f8f6f"/>
      <path d="M22 23 Q27 28 32 23 Q37 28 42 23 M22 32 Q27 37 32 32 Q37 37 42 32 M22 41 Q27 46 32 41 Q37 46 42 41" fill="none" stroke="#a8e6c5" stroke-width="2.2"/>
    </g>
  `,
  wizardCoat: `
    <g stroke="#180d2b" stroke-width="2.2" stroke-linejoin="round">
      <path d="M18 14 L26 11 L32 18 L38 11 L46 14 L54 26 L46 31 L48 52 L16 52 L18 31 L10 26 Z" fill="#46227a"/>
      <line x1="32" y1="18" x2="32" y2="52" stroke="#ffd23f" stroke-width="3"/>
      <circle cx="24" cy="28" r="2" fill="#ffe878" stroke="none"/>
      <circle cx="40" cy="34" r="2.2" fill="#ffe878" stroke="none"/>
      <circle cx="25" cy="42" r="1.8" fill="#ffe878" stroke="none"/>
    </g>
  `,
  luckAmulet: `
    <g stroke="#141f2b" stroke-width="2.2" stroke-linejoin="round">
      <path d="M22 10 Q32 20 42 10" fill="none" stroke="#b8c7d9" stroke-width="2.5"/>
      <path d="M20 26 C20 20 24 20 24 26 L24 18 C24 14 29 14 29 18 L29 15 C29 11 35 11 35 15 L35 18 C35 14 40 14 40 18 L40 26 C40 20 44 20 44 26 C44 40 38 50 32 52 C26 50 20 40 20 26 Z" fill="#d8e4f0"/>
      <circle cx="32" cy="34" r="6" fill="#2986cc"/>
      <circle cx="32" cy="34" r="2.5" fill="#111" stroke="none"/>
    </g>
  `,
  courageNecklace: `
    <g stroke="#241506" stroke-width="2.2" stroke-linejoin="round">
      <ellipse cx="32" cy="24" rx="16" ry="12" fill="none" stroke="#ffd23f" stroke-width="3.5" stroke-dasharray="4 2"/>
      <polygon points="32,30 42,40 32,52 22,40" fill="#ff3b3b" stroke="#ffd23f" stroke-width="2.5"/>
    </g>
  `,
  powerPendant: `
    <g stroke="#0e1c36" stroke-width="2.2" stroke-linejoin="round">
      <path d="M18 12 Q32 28 46 12" fill="none" stroke="#d9a6ff" stroke-width="2.8"/>
      <polygon points="32,20 44,34 32,52 20,34" fill="#2680ff" stroke="#ffd24a" stroke-width="2.5"/>
      <polygon points="32,26 38,34 32,44 26,34" fill="#9ef0ff" stroke="none"/>
    </g>
  `,
  vitalityRing: `
    <g stroke="#241206" stroke-width="2.2" stroke-linejoin="round">
      <ellipse cx="32" cy="36" rx="15" ry="12" fill="none" stroke="#ffd23f" stroke-width="5"/>
      <polygon points="24,22 32,14 40,22 36,28 28,28" fill="#ff2647" stroke="#ffd23f" stroke-width="2"/>
    </g>
  `,
  magicRing: `
    <g stroke="#101f33" stroke-width="2.2" stroke-linejoin="round">
      <ellipse cx="32" cy="36" rx="15" ry="12" fill="none" stroke="#b8d4f2" stroke-width="5"/>
      <circle cx="32" cy="21" r="7" fill="#a64dff" stroke="#d8e8ff" stroke-width="2"/>
      <circle cx="30" cy="19" r="2.2" fill="#fff" stroke="none"/>
    </g>
  `,
  bootsOfSpeed: `
    <g stroke="#241008" stroke-width="2.2" stroke-linejoin="round">
      <path d="M20 16 L34 16 L32 36 L48 40 C52 41 53 46 51 50 L16 50 L16 36 Z" fill="#c92626"/>
      <path d="M32 24 C42 22 48 16 54 10 C50 20 45 26 36 30 Z" fill="#ffd23f"/>
    </g>
  `,
  travelerBoots: `
    <g stroke="#1f1307" stroke-width="2.2" stroke-linejoin="round">
      <path d="M20 16 L34 16 L32 36 L48 40 C52 41 53 46 51 50 L16 50 L16 36 Z" fill="#8c5420"/>
      <line x1="22" y1="22" x2="32" y2="22" stroke="#e6c48a" stroke-width="2.5"/>
      <line x1="21" y1="28" x2="31" y2="28" stroke="#e6c48a" stroke-width="2.5"/>
    </g>
  `,
  princeCape: `
    <g stroke="#240c0c" stroke-width="2.2" stroke-linejoin="round">
      <path d="M20 14 L44 14 L52 50 C40 54 24 54 12 50 Z" fill="#b8192b"/>
      <path d="M18 14 C26 20 38 20 46 14 L44 22 C36 26 28 26 20 22 Z" fill="#ffd23f"/>
    </g>
  `,
  shadowCloak: `
    <g stroke="#0e091a" stroke-width="2.2" stroke-linejoin="round">
      <path d="M32 10 C42 10 46 18 46 24 L52 50 C40 54 24 54 12 50 L18 24 C18 18 22 10 32 10 Z" fill="#2a1b42"/>
      <circle cx="32" cy="24" r="3.5" fill="#c470ff"/>
    </g>
  `,
  shofar: `
    <g stroke="#211408" stroke-width="2.2" stroke-linejoin="round">
      <path d="M12 42 C18 48 34 48 42 36 C48 27 46 18 52 12 L44 10 C38 18 40 26 34 32 C28 38 18 38 14 36 Z" fill="#e6c896"/>
      <line x1="25" y1="36" x2="28" y2="44" stroke="#ffd23f" stroke-width="3"/>
      <line x1="36" y1="29" x2="43" y2="34" stroke="#ffd23f" stroke-width="3"/>
    </g>
  `,
  fireTome: `
    <g stroke="#260c06" stroke-width="2.2" stroke-linejoin="round">
      <rect x="14" y="12" width="36" height="42" rx="3" fill="#8c1919"/>
      <path d="M32 18 C36 24 42 28 40 36 C39 42 35 45 32 45 C29 45 25 42 24 36 C22 28 28 24 32 18 Z" fill="#ff9d26"/>
    </g>
  `,
  goldSack: `
    <g stroke="#241506" stroke-width="2.2" stroke-linejoin="round">
      <path d="M24 14 L40 14 L36 22 C46 26 50 36 48 46 C46 52 38 54 32 54 C26 54 18 52 16 46 C14 36 18 26 28 22 Z" fill="#9c5e28"/>
      <ellipse cx="32" cy="20" rx="9" ry="4" fill="#ffd23f"/>
      <circle cx="32" cy="38" r="8" fill="#ffd23f"/>
    </g>
  `,
  spyglass: `
    <g stroke="#1c1308" stroke-width="2.2" stroke-linejoin="round">
      <polygon points="12,46 16,50 30,36 24,30" fill="#b87d14"/>
      <polygon points="24,30 30,36 44,24 36,16" fill="#d99b26"/>
      <polygon points="36,16 44,24 52,18 42,8" fill="#f0bd42"/>
      <ellipse cx="47" cy="13" rx="4" ry="7" transform="rotate(-45 47 13)" fill="#70e8ff"/>
    </g>
  `,
};

const FALLBACK_ICON = `
  <g stroke="#1c1208" stroke-width="2.2" stroke-linejoin="round">
    <circle cx="32" cy="32" r="22" fill="#3a284d" stroke="#f0b63a" stroke-width="2.5"/>
    <polygon points="32,12 37,26 52,26 40,35 44,49 32,40 20,49 24,35 12,26 27,26" fill="#ffd23f"/>
  </g>
`;

export function icon(name, size = 24, extraClass = '') {
  const cls = extraClass ? `ico ${extraClass}` : 'ico';
  const body = ICON_PATHS[name] || ARTIFACT_SHAPES[name] || FALLBACK_ICON;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="${cls}">${body}</svg>`;
}

export function artifactIcon(artifactId, size = 48) {
  const art = ARTIFACTS[artifactId];
  const rarity = art ? art.rarity : 'minor';
  const borderColor = RARITY_COLORS[rarity] || '#9ec7ff';
  const bgInner = rarity === 'relic' ? '#3b2808' : rarity === 'major' ? '#261438' : '#142236';
  const shape = ARTIFACT_SHAPES[artifactId] || FALLBACK_ICON;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" class="ico artifact-ico rarity-${rarity}">
    <rect x="3" y="3" width="58" height="58" rx="9" fill="${bgInner}" stroke="${borderColor}" stroke-width="3"/>
    <rect x="6" y="6" width="52" height="52" rx="6" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="1.2"/>
    ${shape}
  </svg>`;
}
