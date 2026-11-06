// ============================================================================
//  שוק — שערי חליפין בין משאבים
// ============================================================================
import { playerTowns, hasBuilt } from './state.js';

export const BASE_VALUE = { gold: 1, wood: 250, ore: 250, mercury: 500, sulfur: 500, crystal: 500, gems: 500 };

export function marketCount(state, pid) {
  return playerTowns(state, pid).filter((t) => hasBuilt(t, 'marketplace')).length;
}

/** How many units of `to` you get for 1 unit of `from` (may be fractional < 1 meaning you need several). */
export function rate(state, pid, from, to) {
  const m = Math.max(1, marketCount(state, pid));
  const sellMult = Math.min(0.85, 0.4 + 0.08 * (m - 1));
  const buyMult = Math.max(1.2, 2.0 - 0.15 * (m - 1));
  const sellValue = BASE_VALUE[from] * (from === 'gold' ? 1 : sellMult);
  const buyValue = BASE_VALUE[to] * (to === 'gold' ? 1 : buyMult);
  return sellValue / buyValue;
}

/** For UI: describe "X from per 1 to" or "1 from → Y to". */
export function tradeQuote(state, pid, from, to) {
  const r = rate(state, pid, from, to);
  if (r >= 1) return { give: 1, get: Math.floor(r) };
  return { give: Math.ceil(1 / r), get: 1 };
}

export function doTrade(state, pid, from, to, units) {
  const p = state.players[pid];
  const q = tradeQuote(state, pid, from, to);
  const lots = Math.floor(units / q.give);
  if (lots <= 0 || p.resources[from] < lots * q.give) return 0;
  p.resources[from] -= lots * q.give;
  p.resources[to] += lots * q.get;
  return lots * q.get;
}
