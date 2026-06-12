/**
 * GameLogic.js — Core game state machine for Carcassonne.
 *
 * Orchestrates the game loop using the three sub-modules:
 *   - TilePlacement.js   (placement validation)
 *   - FeatureTracker.js  (feature object factories / helpers)
 *   - Scoring.js         (recursive feature analysis, scoring)
 *
 * Game flow:
 *   1. initializeNewGame()  → creates state, places starting tile, draws first tile
 *   2. drawTile()           → picks random unused tile, calculates valid placements
 *   3. placeTile()          → validates + places tile, links neighbors, checks scoring
 *   4. placeMeeple()        → places a meeple on a placed tile
 *   5. endTurn()            → advances to next player (or same if builder), draws next tile
 *   6. completeGame()       → end-game scoring
 *
 * @module GameLogic
 */

import calculateValidPlacements, { getRotatedEdges, getRotatedFeatureDirections } from './TilePlacement.js';
import {
  createCityFeature, createRoadFeature, createFarmFeature, createCloisterFeature,
  isFeatureComplete, addMeepleToFeature, removeMeeplesFromFeature,
  mergeFeatures, hasPlayerMeeple, determineMajority,
} from './FeatureTracker.js';
import { getFeatureInfo, checkAndFinalizeFeature, completeGame as scoringCompleteGame } from './Scoring.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAYER_COLORS = ['red', 'blue', 'green', 'purple', 'orange', 'teal'];
const DEFAULT_MEEPLE_COUNT = 7;

// ---------------------------------------------------------------------------
// Game state factory
// ---------------------------------------------------------------------------

/**
 * Create a fresh game state.
 *
 * @param {string[]} expansions   Array of expansion names, e.g. ['base-game']
 * @param {number}   playerCount  Number of human/ai players (1-6)
 * @param {Array}    tileData     All tile definitions from TileData.js
 * @returns {object}
 */
export function createGameState(expansions, playerCount, tileData) {
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({
      user: { username: `Player ${i + 1}`, _id: `player-${i}` },
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      points: 0,
      remainingMeeples: DEFAULT_MEEPLE_COUNT,
      active: i === 0,
      hasLargeMeeple: expansions.includes('inns-and-cathedrals'),
      hasPigMeeple: expansions.includes('traders-and-builders'),
      hasBuilderMeeple: expansions.includes('traders-and-builders'),
      goods: expansions.includes('traders-and-builders') ? { fabric: 0, wine: 0, wheat: 0 } : undefined,
      towers: expansions.includes('the-tower') ? getTowerCount(playerCount, i) : 0,
      capturedMeeples: [],
      acknowledgedGameEnd: false,
    });
  }

  return {
    name: generateGameName(),
    expansions,
    finished: false,
    messages: [],
    players,
    unusedTiles: buildTilePile(expansions, tileData),
    placedTiles: [],
    activeTile: null,          // { tile, validPlacements } — set during drawTile()
    currentPlayerIndex: 0,
    step: 'draw',             // 'draw' | 'place' | 'meeple' | 'tower' | 'done'
    lastModified: new Date(),
  };
}

/** Generate a random game name (adjective-noun style). */
function generateGameName() {
  const adjs = ['Misty', 'Quiet', 'Lost', 'Silly', 'Calm', 'Rapid', 'Happy', 'Mad'];
  const nouns = ['Prairie', 'Forest', 'Ridge', 'Hollow', 'Brook', 'Thicket', 'Glen', 'Peak'];
  return adjs[Math.floor(Math.random() * adjs.length)] +
         nouns[Math.floor(Math.random() * nouns.length)];
}

/** Compute tower piece count per player based on player count. */
function getTowerCount(playerCount, playerIndex) {
  if (playerCount === 1) return 30;
  const pool = [0, 10, 9, 7, 6, 5]; // index by playerCount
  return pool[playerCount] || 5;
}

/**
 * Build the unused-tile pile: for each tile, push it `count` times
 * (skip one copy of the starting tile).
 */
function buildTilePile(expansions, allTileData) {
  const pile = [];
  const filtered = allTileData.filter((t) => expansions.includes(t.id.split('/')[0]));
  for (const tile of filtered) {
    const count = tile.startingTile ? tile.count - 1 : tile.count;
    for (let i = 0; i < count; i++) {
      pile.push({ ...tile }); // shallow copy so counts aren't mutated
    }
  }
  return pile;
}

// ---------------------------------------------------------------------------
// initializeNewGame
// ---------------------------------------------------------------------------

/**
 * Fully initialise a new game: place the starting tile, create initial
 * feature objects, and draw the first tile.
 *
 * Mutates the gamestate in place.
 *
 * @param {object} gamestate
 * @param {object} [startingTile]  The tile to place at (0,0).  If omitted,
 *   finds one with `startingTile: true`.
 * @returns {object} The updated gamestate.
 */
export function initializeNewGame(gamestate, startingTile) {
  // 1. Find or use the starting tile.
  const startTile = startingTile || gamestate.unusedTiles.find((t) => t.startingTile);
  if (!startTile) {
    throw new Error('No starting tile found in the tile pile');
  }

  // Remove the starting tile from the unused pile (but it was already excluded
  // by buildTilePile, so grab a ref from the tile data).
  const startDef = { ...startTile };

  // 2. Create the starting placed tile at (0,0).
  const startPlaced = createPlacedTile(startDef, 0, 0, 0, -1);
  gamestate.placedTiles.push(startPlaced);

  // 3. Create initial feature objects for the starting tile.
  initializeFeatures(startPlaced, gamestate);

  // 4. Draw first tile to begin the game.
  drawTile(gamestate);

  return gamestate;
}

// ---------------------------------------------------------------------------
// drawTile
// ---------------------------------------------------------------------------

/**
 * Draw the next tile from the unused pile and calculate valid placements.
 *
 * Mutates gamestate.activeTile and gamestate.unusedTiles.
 * Sets gamestate.step = 'place'.
 *
 * @param {object} gamestate
 */
export function drawTile(gamestate) {
  if (gamestate.unusedTiles.length === 0) {
    // No more tiles — end the game.
    completeGame(gamestate);
    return;
  }

  // Pick a random tile from the unused pile.
  const idx = Math.floor(Math.random() * gamestate.unusedTiles.length);
  const drawnTile = gamestate.unusedTiles.splice(idx, 1)[0];

  // Calculate valid placements.
  const validPlacements = calculateValidPlacements(
    drawnTile,
    gamestate.placedTiles,
    gamestate.players,
    gamestate.expansions,
  );

  // If the drawn tile has no valid placements, auto-advance to next player
  // (skip turn — the tile is lost from the pile just as in the original game).
  if (validPlacements.length === 0) {
    // Find the next active player and try drawing again.
    advanceToNextPlayer(gamestate);
    return drawTile(gamestate);
  }

  gamestate.activeTile = {
    tile: drawnTile,
    validPlacements,
  };

  gamestate.step = 'place';
  return gamestate;
}

// ---------------------------------------------------------------------------
// placeTile
// ---------------------------------------------------------------------------

/**
 * Place a tile on the board at the given position with the given rotation,
 * placed by the active player.
 *
 * Validates the move against activeTile.validPlacements, creates the tile
 * entry with adjacency links, initialises features, merges connected
 * features, checks for completed features (cities, roads, cloisters),
 * handles builder activation, and draws the next tile.
 *
 * @param {object}  gamestate
 * @param {number}  x
 * @param {number}  y
 * @param {number}  rotation  0-3
 * @param {object}  [meeple]  { locationType, index, meepleType }
 * @returns {{ success: boolean, message?: string }}
 */
export function placeTile(gamestate, x, y, rotation, meeple) {
  const activePlayer = getActivePlayer(gamestate);
  const activeIdx = gamestate.currentPlayerIndex;
  const at = gamestate.activeTile;

  if (!at || !at.tile) {
    return { success: false, message: 'No active tile to place' };
  }

  // ── Validate placement ──────────────────────────────────────────────
  const placementEntry = at.validPlacements.find((p) => p.x === x && p.y === y);
  if (!placementEntry) {
    return { success: false, message: 'Invalid tile placement position' };
  }

  const rotEntry = placementEntry.rotations.find((r) => r.rotation === rotation);
  if (!rotEntry) {
    return { success: false, message: 'Invalid tile rotation' };
  }

  // Validate meeple placement if provided.
  if (meeple) {
    const meepleTypeCheck = meeple.meepleType === 'large' ? 'normal' : meeple.meepleType;
    const meepleValid = rotEntry.meeples.some(
      (m) => m.meepleType === meepleTypeCheck &&
             m.locationType === meeple.locationType &&
             m.index === meeple.index,
    );
    if (!meepleValid) {
      return { success: false, message: 'Invalid meeple placement' };
    }

    // Check the player has the required meeple available.
    if (meeple.meepleType === 'normal' && activePlayer.remainingMeeples <= 0) {
      return { success: false, message: 'No remaining meeples' };
    }
    if (meeple.meepleType !== 'normal') {
      const flag = getMeepleFlag(meeple.meepleType);
      if (!activePlayer[flag]) {
        return { success: false, message: `No ${meeple.meepleType} meeple available` };
      }
    }
  }

  // ── Consume meeple ──────────────────────────────────────────────────
  if (meeple) {
    if (meeple.meepleType === 'normal') {
      activePlayer.remainingMeeples -= 1;
    } else {
      activePlayer[getMeepleFlag(meeple.meepleType)] = false;
    }
  }

  // ── Create the new placed-tile entry ─────────────────────────────────
  const newTileIdx = gamestate.placedTiles.length;
  const newTile = createPlacedTile(at.tile, x, y, rotation, activeIdx);

  // Set up tower if applicable.
  if (newTile.tile.tower && newTile.tile.tower.offset && newTile.tile.tower.offset.x != null) {
    newTile.tower = { height: 0, completed: false };
  }

  // Attach meeple to the tile.
  if (meeple) {
    newTile.meeples.push({
      playerIndex: activeIdx,
      placement: { locationType: meeple.locationType, index: meeple.index },
      meepleType: meeple.meepleType,
      scored: false,
    });
  }

  // ── Link adjacency indices ──────────────────────────────────────────
  for (let i = 0; i < gamestate.placedTiles.length; i++) {
    const pt = gamestate.placedTiles[i];
    if (pt.x === x) {
      if (pt.y === y - 1) {
        newTile.northTileIndex = i;
        pt.southTileIndex = newTileIdx;
      } else if (pt.y === y + 1) {
        newTile.southTileIndex = i;
        pt.northTileIndex = newTileIdx;
      }
    } else if (pt.y === y) {
      if (pt.x === x - 1) {
        newTile.westTileIndex = i;
        pt.eastTileIndex = newTileIdx;
      } else if (pt.x === x + 1) {
        newTile.eastTileIndex = i;
        pt.westTileIndex = newTileIdx;
      }
    }
  }

  gamestate.placedTiles.push(newTile);

  // ── Initialize features for the new tile ────────────────────────────
  initializeFeatures(newTile, gamestate);

  // ── Merge features with adjacent tiles ──────────────────────────────
  mergeAdjacentFeatures(newTile, gamestate);

  // ── Check for completed features ────────────────────────────────────
  let builderActivated = false;

  // Check cities.
  for (let i = 0; i < newTile.tile.cities.length; i++) {
    if (!meeple || meeple.meepleType !== 'builder') {
      const fi = getFeatureInfo(newTile, i, 'city', gamestate);
      for (const entry of fi.tilesWithMeeples) {
        const m = entry.placedTile.meeples[entry.meepleIndex];
        if (m.meepleType === 'builder' && m.playerIndex === activeIdx) {
          builderActivated = true;
          break;
        }
      }
    }
    checkAndFinalizeFeature(newTile, i, 'city', false, gamestate);
  }

  // Check roads.
  for (let k = 0; k < newTile.tile.roads.length; k++) {
    if (!meeple || meeple.meepleType !== 'builder') {
      const fi = getFeatureInfo(newTile, k, 'road', gamestate);
      for (const entry of fi.tilesWithMeeples) {
        const m = entry.placedTile.meeples[entry.meepleIndex];
        if (m.meepleType === 'builder' && m.playerIndex === activeIdx) {
          builderActivated = true;
          break;
        }
      }
    }
    checkAndFinalizeFeature(newTile, k, 'road', false, gamestate);
  }

  // Check cloisters (this tile + all adjacent tiles within range).
  checkCloisters(newTile, gamestate);

  // ── Clear active tile ───────────────────────────────────────────────
  gamestate.activeTile = null;
  gamestate.step = 'draw';

  // ── Advance to next player or keep same if builder activated ────────
  // Builder activation: the active player gets an extra turn IF they haven't
  // already had one (the previous tile was placed by a different player).
  const prevTile = gamestate.placedTiles.length >= 2
    ? gamestate.placedTiles[gamestate.placedTiles.length - 2]
    : null;

  if (!builderActivated || (prevTile && prevTile.playerIndex === activeIdx)) {
    advanceToNextPlayer(gamestate);
  }

  // ── Draw next tile ──────────────────────────────────────────────────
  drawTile(gamestate);

  return { success: true };
}

// ---------------------------------------------------------------------------
// placeMeeple (standalone, for use after tile placement)
// ---------------------------------------------------------------------------

/**
 * Place a meeple on a specific tile/feature.  Used when a player wants to
 * place a meeple in a separate step from tile placement.
 */
export function placeMeeple(gamestate, tileIndex, locationType, featureIndex, meepleType) {
  const tile = gamestate.placedTiles[tileIndex];
  if (!tile) return { success: false, message: 'Tile not found' };

  const playerIdx = gamestate.currentPlayerIndex;
  const player = gamestate.players[playerIdx];

  if (meepleType === 'normal' && player.remainingMeeples <= 0) {
    return { success: false, message: 'No remaining meeples' };
  }
  if (meepleType !== 'normal') {
    const flag = getMeepleFlag(meepleType);
    if (!player[flag]) return { success: false, message: `No ${meepleType} meeple available` };
  }

  if (meepleType === 'normal') {
    player.remainingMeeples -= 1;
  } else {
    player[getMeepleFlag(meepleType)] = false;
  }

  tile.meeples.push({
    playerIndex: playerIdx,
    placement: { locationType, index: featureIndex },
    meepleType,
    scored: false,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// skipMeeple / skipTurn
// ---------------------------------------------------------------------------

/** Skip meeple placement and end the turn. */
export function skipMeeple(gamestate) {
  gamestate.step = 'draw';
  advanceToNextPlayer(gamestate);
  drawTile(gamestate);
}

/** Skip the current turn entirely (hot-seat / solo convenience). */
export function skipTurn(gamestate) {
  advanceToNextPlayer(gamestate);
  drawTile(gamestate);
}

// ---------------------------------------------------------------------------
// completeGame  (end-game scoring)
// ---------------------------------------------------------------------------

/**
 * End-game scoring: score all unscored normal/large meeples, then score
 * goods majority (T&B expansion), then mark game as finished.
 */
export function completeGame(gamestate) {
  scoringCompleteGame(gamestate);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getActivePlayer(gamestate) {
  return gamestate.players[gamestate.currentPlayerIndex];
}

function advanceToNextPlayer(gamestate) {
  const current = gamestate.currentPlayerIndex;
  gamestate.players[current].active = false;
  const next = (current + 1) % gamestate.players.length;
  gamestate.players[next].active = true;
  gamestate.currentPlayerIndex = next;
}

function getMeepleFlag(meepleType) {
  return 'has' + meepleType.charAt(0).toUpperCase() + meepleType.slice(1) + 'Meeple';
}

/**
 * Create a plain placed-tile entry (without features/meeples/tower).
 * Adjacency indices are set later during placement.
 */
function createPlacedTile(tileDef, x, y, rotation, playerIndex) {
  return {
    tile: { ...tileDef },
    rotation,
    x,
    y,
    playerIndex,
    northTileIndex: undefined,
    southTileIndex: undefined,
    eastTileIndex: undefined,
    westTileIndex: undefined,
    meeples: [],
    features: { cities: [], roads: [], farms: [], cloister: null },
    tower: undefined,
  };
}

/**
 * Create initial feature objects for a newly placed tile, storing them
 * on the tile's features object.
 */
function initializeFeatures(placedTile, gamestate) {
  const t = placedTile.tile;

  placedTile.features.cities = (t.cities || []).map(() => createCityFeature());
  placedTile.features.roads = (t.roads || []).map(() => createRoadFeature());
  placedTile.features.farms = (t.farms || []).map(() => createFarmFeature());
  placedTile.features.cloister = t.cloister ? createCloisterFeature() : null;
}

/**
 * Merge features on the newly placed tile with adjacent tile features
 * where edges connect.  This ensures all connected tiles share feature
 * object references for meeple tracking.
 */
function mergeAdjacentFeatures(newTile, gamestate) {
  const idx = gamestate.placedTiles.indexOf(newTile);

  // Helper: merge a single feature between two tiles.
  function mergeConnected(type, plural, newFeatureIndex, adjTile, adjFeatureIndex) {
    const adjFeature = adjTile.features[plural][adjFeatureIndex];
    const newFeature = newTile.features[plural][newFeatureIndex];
    if (adjFeature && newFeature) {
      newTile.features[plural][newFeatureIndex] = mergeFeatures(adjFeature, newFeature);
      // The merge result is the adjFeature, now shared by both tiles.
    }
  }

  // Function to check if a direction connects two features.
  function getConnectedFeatureIndex(adjacentTile, type, directionFromSource) {
    const isFarm = type === 'farm';
    const dirs = isFarm ? ['NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW', 'NNW'] : ['N', 'E', 'S', 'W'];
    const pluralType = type === 'city' ? 'cities' : type + 's';
    const mult = isFarm ? 2 : 1;

    const unrotatedDir = dirs[((dirs.indexOf(directionFromSource) - adjacentTile.rotation * mult) % dirs.length + dirs.length) % dirs.length];

    for (let i = 0; i < (adjacentTile.tile[pluralType] || []).length; i++) {
      if (adjacentTile.tile[pluralType][i].directions.indexOf(unrotatedDir) !== -1) {
        return i;
      }
    }
    return -1;
  }

  // Check all 4 directions.
  const dirs = ['N', 'E', 'S', 'W'];
  const oppositeDirs = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const neighborIndices = {
    N: newTile.northTileIndex,
    E: newTile.eastTileIndex,
    S: newTile.southTileIndex,
    W: newTile.westTileIndex,
  };

  for (const dir of dirs) {
    const adjIdx = neighborIndices[dir];
    if (adjIdx === undefined) continue;

    const adjTile = gamestate.placedTiles[adjIdx];
    const oppDir = oppositeDirs[dir];

    // Merge cities.
    for (let i = 0; i < (newTile.tile.cities || []).length; i++) {
      const rotatedDirs = getRotatedFeatureDirections(newTile.tile.cities[i].directions, newTile.rotation, false);
      if (rotatedDirs.includes(dir) || rotatedDirs.some((d) => d.includes(dir[0]))) {
        const adjFeatIdx = getConnectedFeatureIndex(adjTile, 'city', oppDir);
        if (adjFeatIdx >= 0) {
          mergeConnected('city', 'cities', i, adjTile, adjFeatIdx);
        }
      }
    }

    // Merge roads.
    for (let i = 0; i < (newTile.tile.roads || []).length; i++) {
      const rotatedDirs = getRotatedFeatureDirections(newTile.tile.roads[i].directions, newTile.rotation, false);
      if (rotatedDirs.includes(dir)) {
        const adjFeatIdx = getConnectedFeatureIndex(adjTile, 'road', oppDir);
        if (adjFeatIdx >= 0) {
          mergeConnected('road', 'roads', i, adjTile, adjFeatIdx);
        }
      }
    }

    // Merge farms.
    for (let i = 0; i < (newTile.tile.farms || []).length; i++) {
      const rotatedDirs = getRotatedFeatureDirections(newTile.tile.farms[i].directions, newTile.rotation, true);
      // Farm directions match: NNW↔SSW, NNE↔SSE, ENE↔WSW, ESE↔WNW
      const farmDirMap = {
        N: ['NNW', 'NNE'], S: ['SSW', 'SSE'],
        E: ['ENE', 'ESE'], W: ['WNW', 'WSW'],
      };
      const matchingFarmDirs = farmDirMap[dir] || [];
      const hasMatch = matchingFarmDirs.some((fd) => rotatedDirs.includes(fd));
      if (hasMatch) {
        // For farm merging we check each matching sub-direction.
        for (const fd of matchingFarmDirs) {
          if (rotatedDirs.includes(fd)) {
            const oppFarmDir = fd.replace(/N/g, 'X').replace(/S/g, 'N').replace(/X/g, 'S')
                                 .replace(/E/g, 'X').replace(/W/g, 'E').replace(/X/g, 'W');
            const adjFeatIdx = getConnectedFeatureIndex(adjTile, 'farm', oppFarmDir);
            if (adjFeatIdx >= 0) {
              mergeConnected('farm', 'farms', i, adjTile, adjFeatIdx);
            }
          }
        }
      }
    }
  }
}

/**
 * Check cloister completion for the newly placed tile and all adjacent tiles.
 */
function checkCloisters(newTile, gamestate) {
  const idx = gamestate.placedTiles.indexOf(newTile);

  // Collect all tiles within range.
  const tilesToCheck = [newTile];

  const neighbors = [
    newTile.northTileIndex, newTile.southTileIndex,
    newTile.eastTileIndex, newTile.westTileIndex,
  ];
  for (const nIdx of neighbors) {
    if (nIdx !== undefined) {
      const nTile = gamestate.placedTiles[nIdx];
      tilesToCheck.push(nTile);
      // Also check diagonal neighbors.
      if (nTile.northTileIndex !== undefined && nIdx === newTile.northTileIndex) {
        // Already capturing north; check NW and NE
      }
      if (nTile.westTileIndex !== undefined) {
        const nw = gamestate.placedTiles[nTile.westTileIndex];
        if (Math.abs(nw.x - newTile.x) <= 1 && Math.abs(nw.y - newTile.y) <= 1) {
          tilesToCheck.push(nw);
        }
      }
      if (nTile.eastTileIndex !== undefined) {
        const ne = gamestate.placedTiles[nTile.eastTileIndex];
        if (Math.abs(ne.x - newTile.x) <= 1 && Math.abs(ne.y - newTile.y) <= 1) {
          tilesToCheck.push(ne);
        }
      }
    }
  }

  // Deduplicate by identity.
  const seen = new Set();
  for (const tile of tilesToCheck) {
    const key = `${tile.x},${tile.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (tile.tile.cloister) {
      checkAndFinalizeFeature(tile, 0, 'cloister', false, gamestate);
    }
  }
}

// ---------------------------------------------------------------------------
// Utility / query helpers
// ---------------------------------------------------------------------------

/** Check whether the game has been completed. */
export function isGameFinished(gamestate) {
  return gamestate.finished;
}

/** Get a summary representation for network transmission. */
export function getGameSummary(gamestate) {
  return {
    name: gamestate.name,
    expansions: gamestate.expansions,
    finished: gamestate.finished,
    players: gamestate.players.map((p) => ({
      username: p.user.username,
      color: p.color,
      points: p.points,
      remainingMeeples: p.remainingMeeples,
      active: p.active,
      goods: p.goods,
    })),
    placedTiles: gamestate.placedTiles.map((pt) => ({
      tileId: pt.tile.id,
      rotation: pt.rotation,
      x: pt.x,
      y: pt.y,
      playerIndex: pt.playerIndex,
      meeples: pt.meeples.map((m) => ({
        playerIndex: m.playerIndex,
        placement: m.placement,
        meepleType: m.meepleType,
        scored: m.scored,
      })),
      towerHeight: pt.tower ? pt.tower.height : undefined,
    })),
    currentPlayerIndex: gamestate.currentPlayerIndex,
    activeTile: gamestate.activeTile
      ? {
          tileId: gamestate.activeTile.tile.id,
          validPlacements: gamestate.activeTile.validPlacements,
        }
      : null,
    step: gamestate.step,
    messages: gamestate.messages,
  };
}
