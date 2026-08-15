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

function getSourceFlowDirection(sourceTile) {
  return rotateRiverDirections(sourceTile.tile, sourceTile.rotation || 0)[0];
}

function getDownstreamProjection(position, sourceTile, sourceFlowDirection) {
  const axis = DELTA[sourceFlowDirection];
  return ((position.x - sourceTile.x) * axis.x) + ((position.y - sourceTile.y) * axis.y);
}

/**
 * The single-ended River variant must never reverse its source-to-lake flow.
 * We model downstream as the projection on the Source's original flow axis.
 * Sideways movement is allowed, but the projection may never decrease and no
 * outgoing edge may point toward the Source. This catches a reverse bend even
 * when one or more straight tiles lie between the two bends.
 */
function isGloballyDownstream(placedTiles, tailIndex, sourceTile, tail, candidatePosition, candidateDirections, requiredEntry) {
  const sourceFlowDirection = getSourceFlowDirection(sourceTile);
  if (!sourceFlowDirection) return true;

  const outgoingDirections = candidateDirections.filter(d => d !== requiredEntry);
  const tailProjection = getDownstreamProjection(tail, sourceTile, sourceFlowDirection);
  const candidateProjection = getDownstreamProjection(candidatePosition, sourceTile, sourceFlowDirection);
  
  // Rule: River must always move downstream (projection cannot decrease)
  if (candidateProjection < tailProjection) return false;

  const axis = DELTA[sourceFlowDirection];
  
  // Rule: No outgoing edge may point back toward the source
  if (outgoingDirections.some((direction) => {
    const vector = DELTA[direction];
    return (vector.x * axis.x) + (vector.y * axis.y) < 0;
  })) {
    return false;
  }

  // Rule: Prohibit two consecutive bends in the same direction (immediate or with straights).
  // Implementation: Find the last bend in the river. If the candidate is also a bend,
  // ensure it does not turn in the same direction as the last one.
  const getTurn = (from, to) => {
    const fIdx = CARDINALS.indexOf(from);
    const tIdx = CARDINALS.indexOf(to);
    // from is the entry direction (where river enters the tile)
    // to is the exit direction (where river leaves the tile)
    // CARDINALS: ['N', 'E', 'S', 'W'] (indices 0, 1, 2, 3)
    // N (0) -> E (1) is CW (1 step)
    // N (0) -> W (3) is CCW (3 steps)
    // entry 'N' (0) means the river is coming FROM the north, entering at the TOP edge.
    // exit 'E' (1) means the river is going TO the east, leaving at the RIGHT edge.
    // In our coordinate system (N=0, E=1, S=2, W=3):
    // If entry is N (0) and exit is E (1), it's a CW turn.
    // If entry is N (0) and exit is W (3), it's a CCW turn.
    // If entry is N (0) and exit is S (2), it's a Straight.
    
    // entry 'N' (0) means the river is coming FROM the north, entering at the TOP edge.
    // The river is effectively moving TOWARD the south when it enters.
    // So the travel direction is OPPOSITE[from].
    const travelDir = OPPOSITE[from];
    const travelIdx = CARDINALS.indexOf(travelDir);
    
    // The turn is (exitIdx - travelIdx + 4) % 4
    // 0 = Straight
    // 1 = CW turn
    // 2 = Reverse (not possible)
    // 3 = CCW turn
    // Relative turn:
    // entry 'N' means travelDir is 'S' (2).
    // exit 'E' (1) -> turn = (1 - 2 + 4) % 4 = 3.
    // exit 'W' (3) -> turn = (3 - 2 + 4) % 4 = 1.
    // CW is 1, CCW is 3.
    return (tIdx - travelIdx + 4) % 4;
  };

  const isBend = (dirs) => dirs.length === 2 && dirs[0] !== OPPOSITE[dirs[1]];
  
  if (isBend(candidateDirections)) {
    const candTurn = getTurn(requiredEntry, outgoingDirections[0]);
    
    // Trace back to find the last bend
    let lastBendTurn = null;
    for (let i = tailIndex; i >= 0; i--) {
      const pt = placedTiles[i];
      if (!pt?.tile?.river) continue;
      
      const ptDirs = rotateRiverDirections(pt.tile, pt.rotation);
      if (isBend(ptDirs)) {
        // Find entry for this historical tile
        // It must be connected to some tile placed before it.
        const prev = placedTiles.find(p => {
          if (p === pt || !p.tile?.river) return false;
          if (placedTiles.indexOf(p) >= i) return false;
          const pDirs = rotateRiverDirections(p.tile, p.rotation);
          return pDirs.some(d => {
            const neighbor = getRiverNeighborPosition(p.x, p.y, d);
            return neighbor.x === pt.x && neighbor.y === pt.y;
          });
        });
        
        if (!prev) continue;
        
        const exitDirFromPrev = CARDINALS.find(d => {
          const neighbor = getRiverNeighborPosition(prev.x, prev.y, d);
          return neighbor.x === pt.x && neighbor.y === pt.y;
        });
        const entry = OPPOSITE[exitDirFromPrev];
        const exit = ptDirs.find(d => d !== entry);
        
        if (entry && exit) {
          lastBendTurn = getTurn(entry, exit);
          break;
        }
      }
    }

    if (lastBendTurn === candTurn && (candTurn === 1 || candTurn === 3)) {
      return false;
    }
  }

  return true;
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

      // Official River flow rule plus this project's single-ended invariant:
      // once the Source is placed, the chain must move continuously downstream.
      // A candidate cannot fold back toward the Source, return toward an earlier
      // segment, or create a loop. The global projection check is deliberately
      // independent of the immediately previous tile, so a reverse bend after
      // any number of straight tiles is rejected as well.
      const sourceTile = placedTiles.find((pt) => pt.tile?.river?.isSource) || placedTiles[0];
      if (sourceTile && sourceTile.tile?.river?.isSource) {
        if (!isGloballyDownstream(
          placedTiles,
          tailIndex,
          sourceTile,
          tail,
          position,
          candidateDirections,
          requiredEntry,
        )) continue;
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
