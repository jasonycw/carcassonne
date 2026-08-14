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
import {
  filterRiverPlacements,
  getValidRiverPlacements,
  rotateRiverDirections,
  isValidRiverPlacement,
  isRiverComplete,
  OPPOSITE,
} from './RiverPlacement.js';
import {
  getCapturableMeeples as getTowerCapturableMeeples,
  checkAndExchangePrisoners,
  buyBackPrisoner,
  returnMeepleToSupply,
} from './TowerExtensions.js';
import { ALL_TILES as TILE_DATA } from './TileData.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAYER_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'];
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

  const riverTiles = buildRiverPile(expansions, tileData);
  const riverSource = tileData.find((tile) => tile.id === 'the-river/I.s');
  const riverEnabled = expansions.includes('the-river') && Boolean(riverSource) && riverTiles.length > 0;

  return {
    name: generateGameName(),
    expansions,
    finished: false,
    messages: [],
    players,
    unusedTiles: buildTilePile(expansions, tileData),
    riverTiles,
    riverSource: riverEnabled ? { ...riverSource } : null,
    riverPhase: riverEnabled,
    riverTailIndex: null,
    riverOpenDirection: null,
    placedTiles: [],
    activeTile: null,          // { tile, validPlacements } — set during drawTile()
    currentPlayerIndex: 0,
    step: 'draw',             // 'draw' | 'place' | 'meeple' | 'tower' | 'capture' | 'done'
    pendingCapture: null,     // { tileIndex, capturableMeeples: [...] }
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
  const filtered = allTileData.filter((t) => {
    const expansion = t.id.split('/')[0];
    return expansion !== 'the-river' && expansions.includes(expansion);
  });
  for (const tile of filtered) {
    const count = tile.startingTile ? tile.count - 1 : tile.count;
    for (let i = 0; i < count; i++) {
      pile.push({ ...tile }); // shallow copy so counts aren't mutated
    }
  }
  return pile;
}

/** Build the River stack with the lake forced to the bottom. */
function buildRiverPile(expansions, allTileData) {
  if (!expansions.includes('the-river')) return [];
  const riverTiles = allTileData.filter((tile) => tile.id.startsWith('the-river/'));
  const lake = riverTiles.find((tile) => tile.river?.isLake);
  const nonTerminal = riverTiles.filter((tile) => !tile.startingTile && !tile.river?.isLake);
  const shuffled = [];
  for (const tile of nonTerminal) {
    for (let i = 0; i < (tile.count || 1); i += 1) shuffled.push({ ...tile });
  }
  // Fisher-Yates shuffle keeps the lake deterministically last while all other
  // River tiles are randomised, exactly as the rulebook instructs.
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (lake) shuffled.push({ ...lake });
  return shuffled;
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
  // The River source replaces the normal starting tile.
  const startTile = gamestate.riverPhase
    ? gamestate.riverSource
    : (startingTile || gamestate.unusedTiles.find((t) => t.startingTile));
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

  if (gamestate.riverPhase) {
    gamestate.riverTailIndex = 0;
    gamestate.riverOpenDirection = rotateRiverDirections(startDef, 0)[0];
  }

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
  while (true) {
    const usingRiver = Boolean(gamestate.riverPhase);

    if (usingRiver && gamestate.riverTiles.length === 0) {
      gamestate.riverPhase = false;
      gamestate.riverTailIndex = null;
      gamestate.riverOpenDirection = null;
      // Ensure unusedTiles is fully populated if it was empty
      if ((!gamestate.unusedTiles || gamestate.unusedTiles.length === 0) && gamestate.expansions) {
        gamestate.unusedTiles = buildTilePile(gamestate.expansions, TILE_DATA, false);
      }
      continue; // Iteratively draw from base pile
    }

  if (!usingRiver && gamestate.unusedTiles.length === 0) {
    // No more tiles — end the game.
    completeGame(gamestate);
    return;
  }

  const pile = usingRiver ? gamestate.riverTiles : gamestate.unusedTiles;
  const idx = usingRiver ? 0 : Math.floor(Math.random() * pile.length);
  const drawnTile = pile.splice(idx, 1)[0];

  // Calculate ordinary feature-compatible placements first, then constrain
  // River tiles to the one legal open river endpoint.
  let validPlacements = calculateValidPlacements(
    drawnTile,
    gamestate.placedTiles,
    gamestate.players,
    gamestate.expansions,
  );
  if (usingRiver) {
    const riverPlacements = getValidRiverPlacements(
      drawnTile,
      gamestate.placedTiles,
      gamestate.riverTailIndex,
      gamestate.riverOpenDirection,
    );
    // During the River phase, the tile placement is strictly governed by the river chain.
    // We construct valid placements directly from riverPlacements so that non-river
    // board edges do not incorrectly block valid river extensions or allow non-river spots.
    validPlacements = riverPlacements.map((rp) => {
      // Build a standard placement structure with rotations and meeple options
      const tempPlaced = createPlacedTile(drawnTile, rp.x, rp.y, rp.rotation, -1);
      // Generate meeple options for this position/rotation
      const meepleOptions = [];
      for (let i = 0; i < tempPlaced.tile.cities.length; i++) {
        meepleOptions.push({ featureType: 'city', featureIndex: i });
      }
      for (let i = 0; i < tempPlaced.tile.roads.length; i++) {
        meepleOptions.push({ featureType: 'road', featureIndex: i });
      }
      for (let i = 0; i < tempPlaced.tile.farms.length; i++) {
        meepleOptions.push({ featureType: 'farm', featureIndex: i });
      }
      if (tempPlaced.tile.cloisters && tempPlaced.tile.cloisters.length > 0) {
        meepleOptions.push({ featureType: 'cloister', featureIndex: 0 });
      }
      return {
        x: rp.x,
        y: rp.y,
        rotations: [
          {
            rotation: rp.rotation,
            meeples: meepleOptions,
          },
        ],
      };
    });
  }

  if (validPlacements.length === 0) {
    if (gamestate.messages) {
      gamestate.messages.push({
        type: 'system',
        text: `Tile ${drawnTile.id} had no valid placements and was removed from the game.`,
      });
    }
    continue;
  }

  gamestate.activeTile = {
    tile: drawnTile,
    validPlacements,
    isRiver: usingRiver,
  };
  gamestate.step = 'place';
  return gamestate;
  }
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

  if (at.isRiver && !isValidRiverPlacement(
    at.tile,
    gamestate.placedTiles,
    gamestate.riverTailIndex,
    gamestate.riverOpenDirection,
    x,
    y,
    rotation,
  )) {
    return { success: false, message: 'River tile must extend the open river end without an immediate U-turn' };
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
  // Large meeples are allowed wherever normal meeples can go — they count as
  // two meeples for majority but don't change the placement rules.
  // Builders and pigs have their own entries in rotEntry.meeples (generated
  // by TilePlacement.js) when the adjacent feature contains the active
  // player's special meeple from a previous turn.
  if (meeple) {
    const meepleValid = rotEntry.meeples.some(
      (m) => (m.meepleType === meeple.meepleType || (meeple.meepleType === 'large' && m.meepleType === 'normal')) &&
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

  if (at.isRiver) {
    const rotatedRiver = rotateRiverDirections(at.tile, rotation);
    if (isRiverComplete(at.tile)) {
      gamestate.riverPhase = false;
      gamestate.riverTailIndex = null;
      gamestate.riverOpenDirection = null;
    } else {
      const entryDirection = OPPOSITE[gamestate.riverOpenDirection];
      gamestate.riverTailIndex = newTileIdx;
      gamestate.riverOpenDirection = rotatedRiver.find((direction) => direction !== entryDirection);
    }
  }

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

  // ── Determine next step ────────────────────────────────────────────
  // After placing a tile, the player may:
  //   a) Place a meeple (already handled above — meeple was attached)
  //   b) Place a tower piece (if no meeple placed and tile has tower base)
  //   c) End turn (advance to next player)
  //
  // The Tower expansion: if the player did NOT place a meeple and the
  // placed tile has a tower base, offer the tower step. On a builder
  // activation the extra turn is suppressed here — skipTowerStep /
  // placeTowerPiece handle the advance when the tower step finishes.

  const canUseTowerActions = !meeple
    && gamestate.expansions.indexOf('the-tower') !== -1
    && (activePlayer.towers > 0 || activePlayer.remainingMeeples > 0);

  // ── Clear active tile ───────────────────────────────────────────────
  gamestate.activeTile = null;

  if (canUseTowerActions) {
    // Officially, the Tower action may target any foundation or open tower on
    // the board, or close an open tower with one of the active player's meeples.
    gamestate.step = 'tower';
    return { success: true };
  }

  // ── End turn normally ───────────────────────────────────────────────
  _endTurn(gamestate, builderActivated, activeIdx);
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

  // Builder can only be placed on ROAD features.
  if (meepleType === 'builder' && locationType !== 'road') {
    return { success: false, message: 'Builder can only be placed on a road' };
  }
  // Pig can only be placed on FARM/field features.
  if (meepleType === 'pig' && locationType !== 'farm') {
    return { success: false, message: 'Pig can only be placed on a farm' };
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

// ---------------------------------------------------------------------------
// Tower expansion (The Tower)
// ---------------------------------------------------------------------------

/**
 * Place a tower piece on a tile that has a tower base.
 *
 * Consumes 1 tower piece from the player's supply, increases the tower
 * height by 1, and triggers the capture step if the tower height (1-3)
 * reaches a meeple on an opponent's tile within range.
 *
 * @param {object} gamestate
 * @param {number} tileIndex  Index of the tile in gamestate.placedTiles
 * @returns {{ success: boolean, message?: string }}
 */
export function placeTowerPiece(gamestate, tileIndex) {
  const player = getActivePlayer(gamestate);
  const tile = gamestate.placedTiles[tileIndex];

  if (gamestate.step !== 'tower') return { success: false, message: 'Not the tower step' };
  if (!tile) return { success: false, message: 'Tile not found' };
  if (player.towers <= 0) return { success: false, message: 'No tower pieces remaining' };
  if (tile.tower?.completed) return { success: false, message: 'Tower is already closed' };
  if (!tile.tower && !tile.tile.tower?.offset) {
    return { success: false, message: 'This tile is not a tower foundation or open tower' };
  }

  // A floor may be placed on any uncompleted foundation or any open tower.
  if (!tile.tower) tile.tower = { height: 0, completed: false };
  player.towers -= 1;
  tile.tower.height += 1;

  const capturable = getTowerCapturableMeeples(gamestate, tileIndex);
  if (capturable.length > 0) {
    gamestate.step = 'capture';
    gamestate.pendingCapture = { tileIndex, capturableMeeples: capturable };
  } else {
    _endTurnAfterTower(gamestate);
  }
  return { success: true };
}

/** Capture a selected meeple after a tower floor was placed. */
export function captureMeeple(gamestate, capturedTileIndex, capturedMeepleIndex) {
  const capture = gamestate.pendingCapture;
  if (!capture || gamestate.step !== 'capture') {
    return { success: false, message: 'No pending capture' };
  }
  const valid = capture.capturableMeeples.some(
    (entry) => entry.tileIndex === capturedTileIndex && entry.meepleIndex === capturedMeepleIndex,
  );
  if (!valid) return { success: false, message: 'Invalid capture target' };

  const tile = gamestate.placedTiles[capturedTileIndex];
  const meeple = tile.meeples[capturedMeepleIndex];
  const owner = gamestate.players[meeple.playerIndex];
  const capturer = getActivePlayer(gamestate);
  tile.meeples.splice(capturedMeepleIndex, 1);
  const originalType = meeple.originalMeepleType || meeple.meepleType || 'normal';

  if (meeple.playerIndex === gamestate.currentPlayerIndex) {
    returnMeepleToSupply(owner, originalType);
  } else {
    capturer.capturedMeeples.push({ playerIndex: meeple.playerIndex, meepleType: originalType });
  }

  checkAndExchangePrisoners(gamestate);
  gamestate.pendingCapture = null;
  _endTurnAfterTower(gamestate);
  return { success: true };
}

/** Close an open tower with one normal or large meeple. */
export function placeMeepleOnTower(gamestate, tileIndex, meepleType = 'normal') {
  const player = getActivePlayer(gamestate);
  const tile = gamestate.placedTiles[tileIndex];
  if (gamestate.step !== 'tower') return { success: false, message: 'Not the tower step' };
  if (!tile?.tower || tile.tower.completed) return { success: false, message: 'Tower is not open' };

  if (meepleType === 'normal') {
    if (player.remainingMeeples <= 0) return { success: false, message: 'No remaining meeples' };
    player.remainingMeeples -= 1;
  } else if (meepleType === 'large') {
    if (!player.hasLargeMeeple) return { success: false, message: 'No large meeple available' };
    player.hasLargeMeeple = false;
  } else {
    return { success: false, message: 'Only normal or large meeples may close a tower' };
  }

  tile.meeples.push({
    playerIndex: gamestate.currentPlayerIndex,
    placement: { locationType: 'tower', index: 0 },
    meepleType: 'tower',
    originalMeepleType: meepleType,
    scored: false,
  });
  tile.tower.completed = true;
  _endTurnAfterTower(gamestate);
  return { success: true };
}

/** Buy back one captured meeple during the active player's turn. */
export function buyBackCapturedMeeple(gamestate, capturerPlayerIndex, prisonerIndex) {
  if (!gamestate.expansions.includes('the-tower')) {
    return { success: false, message: 'The Tower expansion is not enabled' };
  }
  return buyBackPrisoner(gamestate, capturerPlayerIndex, prisonerIndex);
}

/**
 * Skip the tower step (no tower piece placed) and end the turn normally.
 */
export function skipTowerStep(gamestate) {
  if (gamestate.step !== 'tower') {
    return { success: false, message: 'Not the tower step' };
  }
  _endTurnAfterTower(gamestate);
  return { success: true };
}

/**
 * Skip the capture step (decline to capture) and end the turn.
 */
export function skipCapture(gamestate) {
  if (gamestate.step !== 'capture') {
    return { success: false, message: 'Not the capture step' };
  }
  gamestate.pendingCapture = null;
  _endTurnAfterTower(gamestate);
  return { success: true };
}

/**
 * End the turn after the tower step (with or without having placed a tower piece).
 */
function _endTurnAfterTower(gamestate) {
  const builderActivated = false;
  const activeIdx = gamestate.currentPlayerIndex;
  _endTurn(gamestate, builderActivated, activeIdx);
}

/**
 * Internal — advance to the next player and draw a tile.
 * Extracted so both the normal path and the tower-step path can re-use it.
 */
function _endTurn(gamestate, builderActivated, activeIdx) {
  gamestate.step = 'draw';

  // Advance to next player or keep same if builder activated.
  const prevTile = gamestate.placedTiles.length >= 2
    ? gamestate.placedTiles[gamestate.placedTiles.length - 2]
    : null;

  if (!builderActivated || (prevTile && prevTile.playerIndex === activeIdx)) {
    advanceToNextPlayer(gamestate);
  }

  drawTile(gamestate);
}

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
      towers: p.towers,
      hasLargeMeeple: p.hasLargeMeeple,
      hasBuilderMeeple: p.hasBuilderMeeple,
      hasPigMeeple: p.hasPigMeeple,
      capturedMeeples: (p.capturedMeeples || []).map((prisoner) => ({
        playerIndex: prisoner.playerIndex,
        meepleType: prisoner.meepleType,
      })),
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
        originalMeepleType: m.originalMeepleType,
        scored: m.scored,
      })),
      towerHeight: pt.tower ? pt.tower.height : undefined,
      towerCompleted: pt.tower ? pt.tower.completed : undefined,
    })),
    currentPlayerIndex: gamestate.currentPlayerIndex,
    activeTile: gamestate.activeTile
      ? {
          tileId: gamestate.activeTile.tile.id,
          isRiver: Boolean(gamestate.activeTile.isRiver),
          validPlacements: gamestate.activeTile.validPlacements,
        }
      : null,
    riverTilesCount: (gamestate.riverTiles || []).length,
    riverPhase: Boolean(gamestate.riverPhase),
    riverTailIndex: gamestate.riverTailIndex,
    riverOpenDirection: gamestate.riverOpenDirection,
    step: gamestate.step,
    pendingCapture: gamestate.pendingCapture
      ? {
          tileIndex: gamestate.pendingCapture.tileIndex,
          capturableMeeples: gamestate.pendingCapture.capturableMeeples,
        }
      : null,
    messages: gamestate.messages,
  };
}
