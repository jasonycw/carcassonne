/**
 * FeatureTracker - Plain JS feature tracking for Carcassonne game tiles.
 *
 * Ported from the original Mongoose feature models (featureCity, featureRoad,
 * featureFarm, featureCloister) to lightweight factory functions returning
 * plain objects that serialize cleanly in game state.
 *
 * Feature objects are stored on each placedTile under:
 *   placedTile.features = { cities: [...], roads: [...], farms: [...], cloister: null }
 *
 * @module FeatureTracker
 */

// ---------------------------------------------------------------------------
// Type Definitions (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FeatureBase
 * @property {'city'|'road'|'farm'|'cloister'} type - Discriminant for easy identification.
 * @property {number} points - Raw point value (tile count / base points before multipliers).
 * @property {Array<{placedTileIndex: number, meepleIndex: number}>} tilesWithMeeples
 *     References to meeples placed on this feature. placedTileIndex indexes into
 *     the gamestate's placedTiles array; meepleIndex indexes into that tile's meeples array.
 * @property {boolean} complete - Whether the feature is closed/completed.
 */

/**
 * @typedef {FeatureBase & {
 *   goods: Array<{fabric: number, wine: number, wheat: number}>,
 *   cathedral: boolean
 * }} CityFeature
 */

/**
 * @typedef {FeatureBase & {
 *   inn: boolean
 * }} RoadFeature
 */

/**
 * @typedef {FeatureBase} FarmFeature
 * Farms are always "complete" for adjacency purposes.
 */

/**
 * @typedef {FeatureBase} CloisterFeature
 */

/**
 * @typedef {CityFeature | RoadFeature | FarmFeature | CloisterFeature} Feature
 */

/**
 * @typedef {Object} MajorityEntry
 * @property {number} playerIndex
 * @property {number} count - Number of meeple-equivalents (normal=1, large=2).
 */

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

/**
 * Create a new city feature object.
 * @returns {CityFeature}
 */
export function createCityFeature() {
  return {
    type: 'city',
    points: 0,
    tilesWithMeeples: [],
    complete: false,
    goods: [],
    cathedral: false,
  };
}

/**
 * Create a new road feature object.
 * @returns {RoadFeature}
 */
export function createRoadFeature() {
  return {
    type: 'road',
    points: 0,
    tilesWithMeeples: [],
    complete: false,
    inn: false,
  };
}

/**
 * Create a new farm feature object.
 * Farms are initialized as `complete: true` since they are always
 * considered "complete" for adjacency purposes.
 * @returns {FarmFeature}
 */
export function createFarmFeature() {
  return {
    type: 'farm',
    points: 0,
    tilesWithMeeples: [],
    complete: true,
  };
}

/**
 * Create a new cloister feature object.
 * @returns {CloisterFeature}
 */
export function createCloisterFeature() {
  return {
    type: 'cloister',
    points: 0,
    tilesWithMeeples: [],
    complete: false,
  };
}

// ---------------------------------------------------------------------------
// Feature Management Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a feature is complete.
 * @param {Feature} feature
 * @returns {boolean}
 */
export function isFeatureComplete(feature) {
  return feature.complete;
}

/**
 * Record a meeple placement on a feature.
 * @param {Feature} feature
 * @param {number} placedTileIndex - Index into the gamestate's placedTiles array.
 * @param {number} meepleIndex - Index into the tile's meeples array.
 */
export function addMeepleToFeature(feature, placedTileIndex, meepleIndex) {
  feature.tilesWithMeeples.push({ placedTileIndex, meepleIndex });
}

/**
 * Get the raw point value of a feature (before majority ownership).
 *
 * The returned value is the base point count (number of tiles / adjacent
 * cities for farms). Multipliers for cathedrals, inns, or city doubling
 * are applied separately during scoring by the game logic.
 *
 * @param {Feature} feature
 * @param {number} [_playerCount] - Unused; reserved for future scaling rules.
 * @returns {number}
 */
export function getFeaturePoints(feature, _playerCount) {
  return feature.points;
}

/**
 * Remove all meeple references from a feature (after scoring).
 * @param {Feature} feature
 */
export function removeMeeplesFromFeature(feature) {
  feature.tilesWithMeeples.length = 0;
}

/**
 * Merge a source feature into a target feature.
 *
 * This is used when a newly placed tile connects to an existing feature.
 * The target feature absorbs the source feature's data:
 *   - `tilesWithMeeples` are combined (deduplicated by placedTileIndex+meepleIndex)
 *   - `points` keeps the higher of the two values
 *   - `cathedral` / `inn` are OR'd together
 *   - `goods` arrays are concatenated
 *   - `complete` is AND'd (feature is only complete if BOTH were complete)
 *
 * @param {Feature} target - The feature to merge INTO (will be mutated).
 * @param {Feature} source - The feature being merged (left unchanged).
 */
export function mergeFeatures(target, source) {
  // Merge tilesWithMeeples — avoid duplicates by key
  const existingKeys = new Set(
    target.tilesWithMeeples.map(e => `${e.placedTileIndex}:${e.meepleIndex}`)
  );
  for (const entry of source.tilesWithMeeples) {
    const key = `${entry.placedTileIndex}:${entry.meepleIndex}`;
    if (!existingKeys.has(key)) {
      target.tilesWithMeeples.push(entry);
      existingKeys.add(key);
    }
  }

  // Keep the highest points
  if (source.points > target.points) {
    target.points = source.points;
  }

  // Complete only if both are complete
  target.complete = target.complete && source.complete;

  // City-specific: OR cathedral, concatenate goods
  if (target.type === 'city') {
    target.cathedral = target.cathedral || source.cathedral;
    if (source.goods && source.goods.length > 0) {
      target.goods = target.goods.concat(source.goods);
    }
  }

  // Road-specific: OR inn
  if (target.type === 'road') {
    target.inn = target.inn || source.inn;
  }
}

/**
 * Check whether a specific player has a meeple on this feature.
 *
 * @param {Feature} feature
 * @param {number} playerIndex - The player to check for.
 * @param {Array<{meeples: Array<{playerIndex: number}>}>} placedTiles
 *     The gamestate's placedTiles array.
 * @returns {boolean}
 */
export function hasPlayerMeeple(feature, playerIndex, placedTiles) {
  return feature.tilesWithMeeples.some(entry => {
    const tile = placedTiles[entry.placedTileIndex];
    if (!tile) return false;
    const meeple = tile.meeples[entry.meepleIndex];
    return meeple && meeple.playerIndex === playerIndex;
  });
}

// ---------------------------------------------------------------------------
// Majority Scoring
// ---------------------------------------------------------------------------

/**
 * Determine which player(s) have the majority of meeples on a feature.
 *
 * Counts normal meeples as 1 and large meeples (Inns & Cathedrals expansion)
 * as 2. Returns an array sorted by count descending.
 *
 * @param {Feature} feature
 * @param {Array<{meeples: Array<{playerIndex: number, meepleType: string}>}>} placedTiles
 *     The gamestate's placedTiles array.
 * @returns {MajorityEntry[]} Sorted by count descending.
 */
export function determineMajority(feature, placedTiles) {
  /** @type {Record<number, number>} */
  const counts = {};

  for (const entry of feature.tilesWithMeeples) {
    const tile = placedTiles[entry.placedTileIndex];
    if (!tile) continue;

    const meeple = tile.meeples[entry.meepleIndex];
    if (!meeple) continue;

    const pIdx = meeple.playerIndex;
    if (counts[pIdx] === undefined) {
      counts[pIdx] = 0;
    }
    // Normal meeple = 1, large meeple = 2
    counts[pIdx] += meeple.meepleType === 'large' ? 2 : 1;
  }

  return Object.entries(counts)
    .map(([playerIndex, count]) => ({
      playerIndex: Number(playerIndex),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}
