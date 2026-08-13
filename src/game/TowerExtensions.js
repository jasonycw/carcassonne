/**
 * TowerExtensions.js — Official rules for "The Tower" expansion.
 *
 * Rules implemented:
 * 1. Tower Foundation & Floors: Players receive tower floors based on player count.
 *    On their turn (after placing a tile without placing a meeple), a player may:
 *    - Place a tower floor on an uncompleted tower foundation on any placed tile.
 *    - Place a tower floor on any open tower on the board.
 *    - Place one of their own meeples on an open tower to close it permanently.
 * 2. Capturing Meeples: Placing a tower floor allows capturing an opponent's meeple
 *    (or your own meeple) within range.
 *    - Range = tower height (Level 1 = 1 tile away in N/S/E/W straight lines; Level 2 = 2 tiles; Level 3 = 3 tiles, etc.).
 *    - Capturing your own meeple returns it to your supply.
 *    - Capturing an opponent meeple places it in your prisoner pool in front of you.
 * 3. Exchanging Prisoners: Whenever you and another player hold each other's prisoners,
 *    they are immediately exchanged and returned to their respective owners.
 * 4. Ransom / Buyback: During your turn, you may buy back one of your captured meeples
 *    from an opponent by paying them 3 points (reducing your score by 3 and increasing theirs by 3).
 *    Cannot buy back if score would drop below 0. Bought-back meeple can be reused immediately.
 */

/**
 * Calculate capturable meeples for a given tower tile index.
 *
 * @param {object} gamestate
 * @param {number} towerTileIndex
 * @returns {Array<{ tileIndex: number, meepleIndex: number, playerIndex: number, meepleType: string }>}
 */
export function getCapturableMeeples(gamestate, towerTileIndex) {
  const towerTile = gamestate.placedTiles[towerTileIndex];
  if (!towerTile || !towerTile.tower || towerTile.tower.height <= 0) return [];

  const range = towerTile.tower.height;
  const capturable = [];

  for (let i = 0; i < gamestate.placedTiles.length; i++) {
    const pt = gamestate.placedTiles[i];
    // Must be in a straight line N/S/E/W (not diagonal) within range.
    const dx = Math.abs(pt.x - towerTile.x);
    const dy = Math.abs(pt.y - towerTile.y);
    const inRange = (dx === 0 && dy > 0 && dy <= range)
                 || (dy === 0 && dx > 0 && dx <= range);
    if (!inRange) continue;

    // Check all meeples on target tile
    if (pt.meeples && pt.meeples.length > 0) {
      for (let mIdx = 0; mIdx < pt.meeples.length; mIdx++) {
        const m = pt.meeples[mIdx];
        // Cannot capture figures on towers, barns, wagons, shepherd, etc. if protected
        if (m.meepleType === 'pig' || m.meepleType === 'builder' || m.meepleType === 'shepherd') continue;
        capturable.push({
          tileIndex: i,
          meepleIndex: mIdx,
          playerIndex: m.playerIndex,
          meepleType: m.meepleType || 'normal',
        });
      }
    }
  }

  return capturable;
}

/**
 * Check and execute automatic prisoner exchange between players.
 * If Player A holds a prisoner of Player B and Player B holds a prisoner of Player A,
 * both prisoners are immediately returned to their owners.
 *
 * @param {object} gamestate
 */
export function checkAndExchangePrisoners(gamestate) {
  const players = gamestate.players;
  let exchanged = true;

  while (exchanged) {
    exchanged = false;
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];

        // Find if p1 holds a prisoner belonging to p2
        const p1HoldsP2 = p1.capturedMeeples ? p1.capturedMeeples.findIndex(m => m.playerIndex === j) : -1;
        // Find if p2 holds a prisoner belonging to p1
        const p2HoldsP1 = p2.capturedMeeples ? p2.capturedMeeples.findIndex(m => m.playerIndex === i) : -1;

        if (p1HoldsP2 !== -1 && p2HoldsP1 !== -1) {
          // Exchange! Remove from capturers and return to owners' supply.
          const prisonerFromP2 = p1.capturedMeeples.splice(p1HoldsP2, 1)[0];
          const prisonerFromP1 = p2.capturedMeeples.splice(p2HoldsP1, 1)[0];

          p2.remainingMeeples += (prisonerFromP2.meepleType === 'large' ? 1 : 1);
          p1.remainingMeeples += (prisonerFromP1.meepleType === 'large' ? 1 : 1);

          gamestate.messages.push({
            text: `Automatic prisoner exchange between ${p1.user.username} and ${p2.user.username}! Meeples returned to supply.`,
            timestamp: Date.now(),
          });
          exchanged = true;
          break;
        }
      }
      if (exchanged) break;
    }
  }
}

/**
 * Buy back (ransom) a captured meeple by paying 3 points to the player who captured it.
 *
 * @param {object} gamestate
 * @param {number} capturerPlayerIndex
 * @param {number} prisonerIndex
 * @returns {{ success: boolean, message?: string }}
 */
export function buyBackPrisoner(gamestate, capturerPlayerIndex, prisonerIndex) {
  const activePlayerIndex = gamestate.currentPlayerIndex;
  const activePlayer = gamestate.players[activePlayerIndex];
  const capturer = gamestate.players[capturerPlayerIndex];

  if (!capturer || !capturer.capturedMeeples || !capturer.capturedMeeples[prisonerIndex]) {
    return { success: false, message: 'Captured meeple not found' };
  }

  const prisoner = capturer.capturedMeeples[prisonerIndex];
  if (prisoner.playerIndex !== activePlayerIndex) {
    return { success: false, message: 'You do not own this prisoner' };
  }

  if (activePlayer.points < 3) {
    return { success: false, message: 'Not enough points (requires 3 points)' };
  }

  // Transfer 3 points
  activePlayer.points -= 3;
  capturer.points += 3;

  // Remove prisoner and return to active player's supply
  capturer.capturedMeeples.splice(prisonerIndex, 1);
  activePlayer.remainingMeeples += 1;

  gamestate.messages.push({
    text: `${activePlayer.user.username} bought back a captured meeple from ${capturer.user.username} for 3 points.`,
    timestamp: Date.now(),
  });

  return { success: true };
}
