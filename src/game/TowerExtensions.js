/**
 * Helpers for The Tower (official 2nd Edition rules).
 *
 * The Tower adds a floor-placement action, a tower-closing meeple action,
 * capture along straight orthogonal lines, prisoner exchange, and 3-point
 * ransom buyback. Tower floors have no maximum height.
 */

function returnMeepleToSupply(player, meepleType = 'normal') {
  if (meepleType === 'normal') {
    player.remainingMeeples += 1;
    return;
  }
  const flags = {
    large: 'hasLargeMeeple',
    builder: 'hasBuilderMeeple',
    pig: 'hasPigMeeple',
    abbot: 'hasAbbotMeeple',
    mayor: 'hasMayorMeeple',
    wagon: 'hasWagonMeeple',
  };
  const flag = flags[meepleType];
  if (flag) player[flag] = true;
  else player.remainingMeeples += 1;
}

/**
 * Return all meeples a newly placed floor can capture.
 *
 * The tower's own tile is included. Each floor adds one tile of reach in all
 * four cardinal directions; empty spaces and other towers do not block reach.
 * The rules allow capturing your own meeple, but not builders, pigs, or a
 * meeple already placed on a tower.
 */
export function getCapturableMeeples(gamestate, towerTileIndex) {
  const towerTile = gamestate.placedTiles[towerTileIndex];
  if (!towerTile?.tower || towerTile.tower.height <= 0) return [];

  const range = towerTile.tower.height;
  const capturable = [];
  const eligible = (meeple) => !['builder', 'pig', 'shepherd', 'tower'].includes(meeple.meepleType);

  for (let i = 0; i < gamestate.placedTiles.length; i += 1) {
    const target = gamestate.placedTiles[i];
    const dx = Math.abs(target.x - towerTile.x);
    const dy = Math.abs(target.y - towerTile.y);
    const inRange = (dx === 0 && dy <= range) || (dy === 0 && dx <= range);
    if (!inRange) continue;

    for (let mIdx = 0; mIdx < (target.meeples || []).length; mIdx += 1) {
      const meeple = target.meeples[mIdx];
      if (!eligible(meeple)) continue;
      capturable.push({
        tileIndex: i,
        meepleIndex: mIdx,
        playerIndex: meeple.playerIndex,
        meepleType: meeple.meepleType || 'normal',
      });
    }
  }

  return capturable;
}

/** Immediately return one prisoner from each side when players hold each other's figures. */
export function checkAndExchangePrisoners(gamestate) {
  const players = gamestate.players || [];
  let changed = true;

  while (changed) {
    changed = false;
    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        const first = players[i];
        const second = players[j];
        const firstIndex = (first.capturedMeeples || []).findIndex((p) => p.playerIndex === j);
        const secondIndex = (second.capturedMeeples || []).findIndex((p) => p.playerIndex === i);
        if (firstIndex === -1 || secondIndex === -1) continue;

        const firstPrisoner = first.capturedMeeples.splice(firstIndex, 1)[0];
        const secondPrisoner = second.capturedMeeples.splice(secondIndex, 1)[0];
        returnMeepleToSupply(second, firstPrisoner.meepleType);
        returnMeepleToSupply(first, secondPrisoner.meepleType);
        gamestate.messages.push({
          text: `Prisoners exchanged between ${first.user.username} and ${second.user.username}.`,
          timestamp: Date.now(),
        });
        changed = true;
        break;
      }
      if (changed) break;
    }
  }
}

/**
 * Buy back one of the active player's captured meeples for exactly 3 points.
 */
export function buyBackPrisoner(gamestate, capturerPlayerIndex, prisonerIndex) {
  const ownerIndex = gamestate.currentPlayerIndex;
  const owner = gamestate.players[ownerIndex];
  const capturer = gamestate.players[capturerPlayerIndex];
  const prisoner = capturer?.capturedMeeples?.[prisonerIndex];

  if (!capturer || !prisoner) return { success: false, message: 'Captured meeple not found' };
  if (prisoner.playerIndex !== ownerIndex) return { success: false, message: 'You do not own this prisoner' };
  if (owner.points < 3) return { success: false, message: 'Not enough points (requires 3 points)' };

  owner.points -= 3;
  capturer.points += 3;
  capturer.capturedMeeples.splice(prisonerIndex, 1);
  returnMeepleToSupply(owner, prisoner.meepleType);
  gamestate.messages.push({
    text: `${owner.user.username} bought back a captured meeple from ${capturer.user.username} for 3 points.`,
    timestamp: Date.now(),
  });
  return { success: true };
}

export { returnMeepleToSupply };
