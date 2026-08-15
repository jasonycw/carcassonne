/**
 * Helpers for The River (New Edition / C2 River I).
 *
 * The River is a one-ended stack: the source is placed first, the remaining
 * river tiles are placed in order, and the lake is the final tile. A river
 * tile must extend the current open end; it may not create a second branch or
 * reconnect to an earlier river segment.
 */

const CARDINALS = ['N', 'E', 'S', 'W'];
const OPPOSITE = { N: 'S', E: 'W', S: 'N', W: 'E' };
const DELTA = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export function rotateRiverDirections(tileDef, rotation = 0) {
  if (!tileDef?.river?.directions) return [];
  return tileDef.river.directions.map((direction) => {
    const index = CARDINALS.indexOf(direction);
    return CARDINALS[(index + rotation) % CARDINALS.length];
  });
}

export function getRiverNeighborPosition(x, y, direction) {
  return {
    x: x + DELTA[direction].x,
    y: y + DELTA[direction].y,
  };
}

function hasPlacedTileAt(placedTiles, x, y) {
  return placedTiles.some((tile) => tile.x === x && tile.y === y);
}

function getTileAt(placedTiles, x, y) {
  return placedTiles.find((tile) => tile.x === x && tile.y === y);
}

/**
 * Return every legal (x, y, rotation) for the next river tile.
 *
 * @param {object} tileDef candidate river tile
 * @param {object[]} placedTiles placed tiles
 * @param {number} tailIndex index of the current river tail
 * @returns {Array<{x:number,y:number,rotation:number}>}
 */
export function getValidRiverPlacements(tileDef, placedTiles, tailIndex, openDirection) {
  if (!tileDef?.river || tailIndex == null) return [];
  const tail = placedTiles[tailIndex];
  if (!tail?.tile?.river || !openDirection) return [];
  const candidates = [];
  const tailDirections = [openDirection];

  // The game stores the one currently open endpoint explicitly. This is
  // important: River I is a single chain, not a branching river network.
  for (const tailDirection of tailDirections) {
    const position = getRiverNeighborPosition(tail.x, tail.y, tailDirection);
    if (hasPlacedTileAt(placedTiles, position.x, position.y)) continue;

    const requiredEntry = OPPOSITE[tailDirection];
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const candidateDirections = rotateRiverDirections(tileDef, rotation);
      if (!candidateDirections.includes(requiredEntry)) continue;

      // A candidate may not create a second connection to a previously placed
      // tile. This prevents loops and the immediate U-turn patterns described
      // in the official River clarification.
      const otherDirections = candidateDirections.filter((d) => d !== requiredEntry);
      const createsLoopOrBranch = otherDirections.some((direction) => {
        const neighbor = getRiverNeighborPosition(position.x, position.y, direction);
        const existing = getTileAt(placedTiles, neighbor.x, neighbor.y);
        return Boolean(existing?.tile?.river);
      });
      if (createsLoopOrBranch) continue;

      // Official River flow rule: once the Source is placed, the chain must move
      // continuously downstream. A candidate cannot fold back toward the Source,
      // return toward an earlier segment, or create a U-turn.
      const sourceTile = placedTiles.find((pt) => pt.tile?.river?.isSource) || placedTiles[0];
      if (sourceTile && sourceTile.tile?.river?.isSource) {
        const sourceVector = {
          x: position.x - sourceTile.x,
          y: position.y - sourceTile.y,
        };

        // 1. Downstream vector constraint: Reject any outgoing edge whose vector
        // points back toward the Source.
        const pointsUpstream = otherDirections.some((direction) => {
          const vector = DELTA[direction];
          return (vector.x * sourceVector.x) + (vector.y * sourceVector.y) < 0;
        });
        if (pointsUpstream) continue;

        // 2. Distance constraint: The candidate position itself must not move
        // closer to the Source (Manhattan distance).
        const currentDist = Math.abs(tail.x - sourceTile.x) + Math.abs(tail.y - sourceTile.y);
        const nextDist = Math.abs(position.x - sourceTile.x) + Math.abs(position.y - sourceTile.y);
        if (nextDist < currentDist && !tileDef.river.isLake) continue;

        // 3. Immediate U-turn constraint: Prohibit two consecutive bends in the
        // same direction (clockwise or counter-clockwise).
        const tailDirections = rotateRiverDirections(tail.tile, tail.rotation);
        const isTailBend = tailDirections.length === 2 && tailDirections[0] !== OPPOSITE[tailDirections[1]];
        const isCandidateBend = candidateDirections.length === 2 && candidateDirections[0] !== OPPOSITE[candidateDirections[1]];

        if (isTailBend && isCandidateBend) {
          const getTurn = (from, to) => {
            const fIdx = CARDINALS.indexOf(from);
            const tIdx = CARDINALS.indexOf(to);
            return (tIdx - fIdx + 4) % 4;
          };

          // Find how the river entered the tail tile
          const prevTile = placedTiles[tailIndex - 1];
          if (prevTile) {
            const tailExit = tailDirection;
            const tailEntry = OPPOSITE[CARDINALS.find(d => 
              getRiverNeighborPosition(prevTile.x, prevTile.y, d).x === tail.x &&
              getRiverNeighborPosition(prevTile.x, prevTile.y, d).y === tail.y
            ) || 'N'];
            
            const candEntry = requiredEntry;
            const candExit = otherDirections[0];

            const tailTurn = getTurn(tailEntry, tailExit);
            const candTurn = getTurn(candEntry, candExit);

            // If both are 90-degree turns (1=CW, 3=CCW) in the same direction, reject.
            if (tailTurn === candTurn && (tailTurn === 1 || tailTurn === 3)) {
              continue;
            }
          }
        }
      }

      // The lake must close the river, so it is only valid as the final tile.
      candidates.push({ x: position.x, y: position.y, rotation, tailDirection });
    }
  }

  return candidates;
}

/**
 * Filter ordinary TilePlacement results down to the official River endpoint.
 * Keeping the normal result shape means meeple options on cities, roads,
 * fields, and cloisters continue to be generated by the existing placement
 * engine.
 */
function isMatchingPlacement(x, y, rotation, candidates) {
  return candidates.some(
    (c) => c.x === x && c.y === y && c.rotation === rotation,
  );
}

export function filterRiverPlacements(validPlacements, riverPlacements) {
  return validPlacements.filter((placement) => 
    placement.rotations.some((rot) => isMatchingPlacement(placement.x, placement.y, rot.rotation, riverPlacements))
  ).map((placement) => ({
    ...placement,
    rotations: placement.rotations.filter((rot) => 
      isMatchingPlacement(placement.x, placement.y, rot.rotation, riverPlacements)
    ),
  }));
}

export function isValidRiverPlacement(tileDef, placedTiles, tailIndex, openDirection, x, y, rotation) {
  return getValidRiverPlacements(tileDef, placedTiles, tailIndex, openDirection).some(
    (candidate) => candidate.x === x && candidate.y === y && candidate.rotation === rotation,
  );
}

export function isRiverComplete(tileDef) {
  return Boolean(tileDef?.river?.isLake);
}

export { CARDINALS, OPPOSITE };
