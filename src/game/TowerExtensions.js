/**
 * TowerExtensions.js — Additional Tower expansion features
 * 
 * Implements prisoner exchange and ransom buyback mechanics
 * according to official The Tower rules.
 */

/**
 * Exchange prisoners between two players.
 * 
 * Official rule: Whenever two players have each other's meeples,
 * they exchange them immediately.
 * 
 * @param {object} gamestate
 * @param {number} playerIndex1 - First player index
 * @param {number} playerIndex2 - Second player index
 * @returns {{ success: boolean, message?: string }}
 */
export function exchangePrisoners(gamestate, playerIndex1, playerIndex2) {
  const player1 = gamestate.players[playerIndex1];
  const player2 = gamestate.players[playerIndex2];

  if (!player1 || !player2) {
    return { success: false, message: 'Invalid player indices' };
  }

  // Find meeples each player has captured from the other
  const player1HasFromPlayer2 = player1.capturedMeeples.find(m => m.playerIndex === playerIndex2);
  const player2HasFromPlayer1 = player2.capturedMeeples.find(m => m.playerIndex === playerIndex1);

  if (!player1HasFromPlayer2 || !player2HasFromPlayer1) {
    return { success: false, message: 'Players do not have each other\'s meeples' };
  }

  // Remove from captured lists
  player1.capturedMeeples = player1.capturedMeeples.filter(m => m.playerIndex !== playerIndex2);
  player2.capturedMeeples = player2.capturedMeeples.filter(m => m.playerIndex !== playerIndex1);

  // Return meeples to owners
  returnMeepleToOwner(player2, player1HasFromPlayer2);
  returnMeepleToOwner(player1, player2HasFromPlayer1);

  return { success: true, message: 'Prisoners exchanged' };
}

/**
 * Buy back a captured meeple for 3 points.
 * 
 * Official rule: During your turn, you may pay 3 points to buy back
 * one of your captured meeples from the player who captured it.
 * 
 * @param {object} gamestate
 * @param {number} buyerIndex - Player buying back their meeple
 * @param {number} captorIndex - Player holding the meeple
 * @param {number} meepleIndex - Index of meeple in captor's capturedMeeples
 * @returns {{ success: boolean, message?: string }}
 */
export function buybackMeeple(gamestate, buyerIndex, captorIndex, meepleIndex) {
  const buyer = gamestate.players[buyerIndex];
  const captor = gamestate.players[captorIndex];

  if (!buyer || !captor) {
    return { success: false, message: 'Invalid player indices' };
  }

  if (buyer.points < 3) {
    return { success: false, message: 'Insufficient points to buy back (need 3)' };
  }

  const capturedMeeple = captor.capturedMeeples[meepleIndex];
  if (!capturedMeeple || capturedMeeple.playerIndex !== buyerIndex) {
    return { success: false, message: 'Meeple not found or does not belong to buyer' };
  }

  // Transfer points: buyer loses 3, captor gains 3
  buyer.points -= 3;
  captor.points += 3;

  // Remove from captor's captured list and return to buyer
  captor.capturedMeeples.splice(meepleIndex, 1);
  returnMeepleToOwner(buyer, capturedMeeple);

  return { success: true, message: 'Meeple bought back for 3 points' };
}

/**
 * Check if automatic prisoner exchange should occur.
 * 
 * This is called after any capture to see if both players now have
 * each other's meeples, triggering an automatic exchange.
 * 
 * @param {object} gamestate
 * @param {number} captorIndex - The player who just captured
 * @param {number} capturedFromIndex - The player whose meeple was captured
 * @returns {{ success: boolean, exchanged: boolean }}
 */
export function checkAndExecuteAutomaticExchange(gamestate, captorIndex, capturedFromIndex) {
  const captor = gamestate.players[captorIndex];
  const capturedFrom = gamestate.players[capturedFromIndex];

  if (!captor || !capturedFrom) {
    return { success: false, exchanged: false };
  }

  // Check if captor has meeple from capturedFrom
  const captorHasMeeple = captor.capturedMeeples.some(m => m.playerIndex === capturedFromIndex);
  
  // Check if capturedFrom has meeple from captor
  const capturedFromHasMeeple = capturedFrom.capturedMeeples.some(m => m.playerIndex === captorIndex);

  if (captorHasMeeple && capturedFromHasMeeple) {
    // Automatic exchange
    const result = exchangePrisoners(gamestate, captorIndex, capturedFromIndex);
    return { success: result.success, exchanged: true };
  }

  return { success: true, exchanged: false };
}

/**
 * Helper: Return a meeple to a player's supply.
 * 
 * @param {object} player - The player receiving the meeple
 * @param {object} meeple - The meeple object { meepleType, ... }
 */
function returnMeepleToOwner(player, meeple) {
  if (meeple.meepleType === 'normal') {
    player.remainingMeeples += 1;
  } else if (meeple.meepleType === 'large') {
    player.hasLargeMeeple = true;
  } else if (meeple.meepleType === 'pig') {
    player.hasPigMeeple = true;
  } else if (meeple.meepleType === 'builder') {
    player.hasBuilderMeeple = true;
  }
}

/**
 * Get all capturable meeples from a tower, including own meeples.
 * 
 * Official rule: When capturing a meeple, you can capture from any player,
 * including yourself (which just returns it to your supply).
 * 
 * @param {object} gamestate
 * @param {number} towerTileIndex
 * @param {boolean} [includeOwn=false] - Whether to include own meeples
 * @returns {Array}
 */
export function getCapturableMeeplesWithOwn(gamestate, towerTileIndex, includeOwn = false) {
  const towerTile = gamestate.placedTiles[towerTileIndex];
  if (!towerTile || !towerTile.tower || towerTile.tower.height <= 0) return [];

  const range = Math.min(towerTile.tower.height, 3);
  const activeIdx = gamestate.currentPlayerIndex;
  const capturable = [];

  for (let i = 0; i < gamestate.placedTiles.length; i++) {
    const pt = gamestate.placedTiles[i];
    const dx = Math.abs(pt.x - towerTile.x);
    const dy = Math.abs(pt.y - towerTile.y);
    const inRange = (dx === 0 && dy > 0 && dy <= range)
                 || (dy === 0 && dx > 0 && dx <= range);
    if (!inRange) continue;

    for (let m = 0; m < pt.meeples.length; m++) {
      const meeple = pt.meeples[m];
      const isOwn = meeple.playerIndex === activeIdx;
      
      if (!isOwn || includeOwn) {
        if (!meeple.scored) {
          capturable.push({
            tileIndex: i,
            meepleIndex: m,
            playerIndex: meeple.playerIndex,
            meepleType: meeple.meepleType,
          });
        }
      }
    }
  }

  return capturable;
}
