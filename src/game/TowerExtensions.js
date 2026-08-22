/**
 * Helpers for The Tower (official 2nd Edition rules).
 *
 * The Tower adds a floor-placement action, a tower-closing meeple action,
 * capture along straight orthogonal lines, and prisoner exchange.
 * Official C3.1 Rule: Towers have a maximum height of 5 floors.
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

  // Official C3.1: Max height 5.
  const range = Math.min(towerTile.tower.height, 5);
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
export function checkAndExchangePrisoners(gamestate, preferredSelections = {}) {
  const players = gamestate.players || [];
  let changed = true;

  while (changed) {
    changed = false;
    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        const first = players[i];
        const second = players[j];
        // Official rules: exchange occurs immediately. If multiple figures are held,
        // the player whose turn it is chooses (for their own) or the owner chooses.
        // Implementation: favor large meeples as they are more valuable, or use preference.
        const findBest = (list, holderIdx, ownerIdx) => {
          const pref = preferredSelections[holderIdx];
          if (pref !== undefined) {
            const idx = list.findIndex((p, index) => p.playerIndex === ownerIdx && (p.meepleType === pref || index === pref));
            if (idx !== -1) return idx;
          }
          const largeIdx = list.findIndex(p => p.playerIndex === ownerIdx && p.meepleType === 'large');
          return largeIdx !== -1 ? largeIdx : list.findIndex(p => p.playerIndex === ownerIdx);
        };
        const firstIndex = findBest(first.capturedMeeples || [], i, j);
        const secondIndex = findBest(second.capturedMeeples || [], j, i);
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
 * Official Rule: If two players hold each other's figure, they are exchanged immediately.
 * Otherwise, a player may pay 3 points to buy back one of their figures.
 */
export function buyBackPrisoner(gamestate, holderIndex, meepleIndex) {
  const holder = gamestate.players[holderIndex];
  const prisoner = holder.capturedMeeples[meepleIndex];
  const owner = gamestate.players[prisoner.playerIndex];

  if (owner.points < 3) {
    return { success: false, message: 'Not enough points for ransom.' };
  }

  // Official Rule: Only one buyback per turn.
  if (owner.buyBackCount > 0) {
    return { success: false, message: 'Already bought back a prisoner this turn.' };
  }

  owner.points -= 3;
  holder.points += 3;
  owner.buyBackCount = (owner.buyBackCount || 0) + 1;
  holder.capturedMeeples.splice(meepleIndex, 1);
  returnMeepleToSupply(owner, prisoner.meepleType);

  if (!gamestate.featureScores) {
    gamestate.featureScores = [];
  }
  gamestate.featureScores.push({
    type: 'tower',
    complete: true,
    count: 1,
    players: [
      { playerIndex: prisoner.playerIndex, points: -3 },
      { playerIndex: holderIndex, points: 3 }
    ]
  });

  gamestate.messages.push({
    text: `${owner.user.username} paid 3 points ransom to ${holder.user.username} for their ${prisoner.meepleType} meeple.`,
    timestamp: Date.now(),
  });

  return { success: true };
}

export function canAddTowerFloor(towerTile) {
  return (towerTile?.tower?.height || 0) < 5;
}

export { returnMeepleToSupply };
