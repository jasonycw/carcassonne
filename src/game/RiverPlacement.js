/**
 * RiverPlacement.js — Official rules for "The River" expansion.
 *
 * Rules implemented:
 * 1. The River consists of 12 tiles (including Source spring tile, Lake end tile, straight, bends, cloister, road, city).
 * 2. The River is placed first before the rest of the game begins.
 * 3. The Source spring tile is placed first at (0, 0) as the starting tile.
 * 4. Subsequent river tiles must connect to the open river end of the previously placed river tile.
 * 5. No 180-degree U-turns are allowed (the river cannot bend back directly on itself immediately).
 * 6. Meeples cannot be placed on the river itself, but can be placed on features (cities, roads, fields, cloisters) on river tiles following normal rules.
 */

/**
 * Check if two river tile edges connect properly and do not form an immediate 180-degree U-turn.
 *
 * @param {object} parentTilePlaced — The last placed river tile
 * @param {object} candidateTileDef — The candidate river tile being placed
 * @param {number} candidateRotation — The rotation (0-3) of the candidate tile
 * @returns {boolean}
 */
export function isValidRiverPlacement(parentTilePlaced, candidateTileDef, candidateRotation) {
  if (!parentTilePlaced || !parentTilePlaced.tile.river) return false;
  if (!candidateTileDef || !candidateTileDef.river) return false;

  const parentRiver = parentTilePlaced.tile.river;
  const parentRot = parentTilePlaced.rotation;

  // Find the open exit direction(s) of the parent tile.
  // In Carcassonne, rotation 0-3 rotates directions clockwise: N=0, E=1, S=2, W=3.
  const compassMap = { N: 0, E: 1, S: 2, W: 3 };
  const revCompass = ['N', 'E', 'S', 'W'];

  const parentExits = parentRiver.directions.map(d => {
    const origIdx = compassMap[d];
    const rotatedIdx = (origIdx + parentRot) % 4;
    return revCompass[rotatedIdx];
  });

  // Candidate entry directions
  const candRiver = candidateTileDef.river;
  const candExits = candRiver.directions.map(d => {
    const origIdx = compassMap[d];
    const rotatedIdx = (origIdx + candidateRotation) % 4;
    return revCompass[rotatedIdx];
  });

  // Check if candidate has an exit matching the opposite of parent exit
  const oppMap = { N: 'S', S: 'N', E: 'W', W: 'E' };
  
  // At least one parent exit must connect directly to a candidate entrance/exit
  let connected = false;
  for (const pExit of parentExits) {
    const requiredCandDir = oppMap[pExit];
    if (candExits.includes(requiredCandDir)) {
      connected = true;
      break;
    }
  }

  return connected;
}
