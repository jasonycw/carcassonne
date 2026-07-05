/**
 * RiverPlacement.js — River-specific tile placement validation
 * 
 * The River expansion requires special placement rules:
 * - River tiles must continue the river (edges must match)
 * - No immediate U-turns (180° bends) are forbidden
 * - River cannot loop back on itself
 * - River tiles are placed before normal tiles
 */

import { getRotatedEdges } from './TilePlacement.js';

// Re-export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isValidRiverPlacement };
}

/**
 * Check if a river tile placement is valid according to official rules.
 * 
 * @param {object} tile - The river tile to place
 * @param {number} rotation - Rotation (0-3)
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {object[]} placedTiles - Already-placed tiles
 * @returns {boolean} True if placement is valid
 */
export function isValidRiverPlacement(tile, rotation, x, y, placedTiles) {
  const rotatedEdges = getRotatedEdges(tile, rotation);
  
  // Check all 4 directions for adjacent tiles
  const adjacentTiles = {
    N: findAdjacentTile(placedTiles, x, y - 1),
    S: findAdjacentTile(placedTiles, x, y + 1),
    E: findAdjacentTile(placedTiles, x + 1, y),
    W: findAdjacentTile(placedTiles, x - 1, y),
  };

  // Must have at least one adjacent tile (except for the source)
  const hasAdjacent = Object.values(adjacentTiles).some(t => t !== null);
  if (!hasAdjacent && placedTiles.length > 0) {
    return false;
  }

  // Check edge matching with adjacent tiles
  const directions = ['N', 'S', 'E', 'W'];
  const opposites = { N: 'S', S: 'N', E: 'W', W: 'E' };

  for (const dir of directions) {
    const adjTile = adjacentTiles[dir];
    if (!adjTile) continue;

    const adjRotatedEdges = getRotatedEdges(adjTile.tile, adjTile.rotation);
    const myEdge = rotatedEdges[dir + 'Edge'];
    const adjEdge = adjRotatedEdges[opposites[dir] + 'Edge'];

    // River edges must match river edges, field must match field, etc.
    if (myEdge !== adjEdge) {
      return false;
    }
  }

  // Check for U-turns (immediate 180° bends)
  if (!isValidRiverTurn(tile, rotation, placedTiles, x, y)) {
    return false;
  }

  return true;
}

/**
 * Check if the river turn is valid (no immediate U-turns).
 * 
 * A U-turn is when:
 * 1. Current tile is a bend (river on 2 perpendicular edges)
 * 2. Previous tile is also a bend
 * 3. Both bends turn in the same direction (creating a 180° reversal)
 * 
 * @param {object} tile - The river tile being placed
 * @param {number} rotation - Rotation (0-3)
 * @param {object[]} placedTiles - Already-placed tiles
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {boolean} True if turn is valid
 */
function isValidRiverTurn(tile, rotation, placedTiles, x, y) {
  const rotatedEdges = getRotatedEdges(tile, rotation);
  
  // Get river directions on this tile
  const riverDirections = getRotatedRiverDirections(tile, rotation);
  if (riverDirections.length !== 2) {
    // Straight tiles and endpoints are always valid
    return true;
  }

  // This is a bend tile; check if it creates a U-turn
  const [dir1, dir2] = riverDirections;
  
  // Find which adjacent tile the river connects to
  const directions = ['N', 'S', 'E', 'W'];
  const opposites = { N: 'S', S: 'N', E: 'W', W: 'E' };

  for (const dir of directions) {
    if (!riverDirections.includes(dir)) continue;

    const adjTile = findAdjacentTile(placedTiles, 
      x + (dir === 'E' ? 1 : dir === 'W' ? -1 : 0),
      y + (dir === 'S' ? 1 : dir === 'N' ? -1 : 0)
    );

    if (!adjTile) continue;

    // Check if adjacent tile is also a bend
    const adjRiverDirs = getRotatedRiverDirections(adjTile.tile, adjTile.rotation);
    if (adjRiverDirs.length !== 2) continue;

    // Check for U-turn: if the previous bend goes in opposite direction
    const oppDir = opposites[dir];
    if (!adjRiverDirs.includes(oppDir)) continue;

    // Adjacent tile has river in opposite direction; check if this creates a U-turn
    // A U-turn occurs if both bends turn the same way
    const adjBendDirs = adjRiverDirs.filter(d => d !== oppDir);
    const myBendDirs = riverDirections.filter(d => d !== dir);

    if (adjBendDirs.length === 1 && myBendDirs.length === 1) {
      // Both are simple bends; check if they turn the same way
      const adjBend = adjBendDirs[0];
      const myBend = myBendDirs[0];

      // Check if they form a U-turn (same rotational direction)
      if (isUTurn(oppDir, adjBend, dir, myBend)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Determine if two consecutive bends form a U-turn.
 * 
 * @param {string} prevExit - Direction river exits previous tile
 * @param {string} prevBend - Direction previous bend turns
 * @param {string} currEntry - Direction river enters current tile
 * @param {string} currBend - Direction current bend turns
 * @returns {boolean} True if this is a U-turn
 */
function isUTurn(prevExit, prevBend, currEntry, currBend) {
  // prevExit and currEntry are opposite (e.g., S and N)
  // If prevBend and currBend are the same, it's a U-turn
  return prevBend === currBend;
}

/**
 * Get the river directions for a tile after rotation.
 * 
 * @param {object} tile - Tile definition
 * @param {number} rotation - Rotation (0-3)
 * @returns {string[]} Array of cardinal directions where river flows
 */
function getRotatedRiverDirections(tile, rotation) {
  if (!tile.river || !tile.river.directions) {
    return [];
  }

  const directions = ['N', 'E', 'S', 'W'];
  return tile.river.directions.map(dir => {
    const idx = directions.indexOf(dir);
    return directions[(idx + rotation) % 4];
  });
}

/**
 * Find a tile at the given coordinates.
 * 
 * @param {object[]} placedTiles - Array of placed tiles
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {object|null} The placed tile or null
 */
function findAdjacentTile(placedTiles, x, y) {
  for (const tile of placedTiles) {
    if (tile.x === x && tile.y === y) {
      return tile;
    }
  }
  return null;
}
