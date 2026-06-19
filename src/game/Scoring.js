// Scoring.js - Pure JS scoring algorithms for Carcassonne
// Ported from app/models/gamestate.js
// No Mongoose dependencies - works with plain JS objects

/**
 * Cardinal directions for roads and cities
 */
const DIRECTIONS = ['N', 'E', 'S', 'W'];

/**
 * Secondary-intercardinal directions for farms
 * Direction mapping:
 *   NW NNW N NNE NE
 *   WNW         ENE
 *   W      *      E
 *   WSW         ESE
 *   SW SSW S SSE SE
 */
const FARM_DIRECTIONS = ['NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW', 'NNW'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get the rotated directions for a feature based on the tile's rotation.
 * Farm directions use a ×2 rotation multiplier (8 positions vs 4 for cities/roads).
 *
 * @param {string[]} directions - The unrotated direction strings from the tile definition
 * @param {number} rotation - Number of 90° clockwise rotations (0-3)
 * @param {boolean} isFarm - Whether these are farm directions
 * @returns {string[]} Rotated directions
 */
export function getRotatedDirections(directions, rotation, isFarm) {
  const dirs = isFarm ? FARM_DIRECTIONS : DIRECTIONS;
  const mult = isFarm ? 2 : 1;
  return directions.map(d => dirs[(dirs.indexOf(d) + rotation * mult) % dirs.length]);
}

/**
 * Generate a unique key for a placed tile based on its grid position.
 * Used instead of object reference to avoid JS object-to-string key issues.
 */
function getTileKey(tile) {
  return `${tile.x},${tile.y}`;
}

/**
 * Map meeple type string to the player's flag property name.
 * e.g. 'large' → 'hasLargeMeeple', 'builder' → 'hasBuilderMeeple'
 */
function getMeepleFlagFromType(meepleType) {
  return 'has' + meepleType.charAt(0).toUpperCase() + meepleType.slice(1) + 'Meeple';
}

/**
 * Find which feature on a tile connects via a given rotated direction.
 *
 * The direction is in "placed" (rotated) space — e.g. 'N' means the tile's
 * north edge after rotation. This function un-rotates it back to the tile's
 * local coordinate system to match the feature definitions in the tile data.
 *
 * @param {Object} placedTile - The placed tile object
 * @param {string} type - Feature type: 'city', 'road', 'farm', or 'cloister'
 * @param {string} direction - Rotated direction string
 * @returns {number} Index into the tile's features array of the given type
 * @throws When no matching feature is found
 */
function getFeatureIndex(placedTile, type, direction) {
  const pluralType = type === 'city' ? 'cities' : type + 's';

  if (type === 'city' || type === 'road') {
    // Un-rotate the direction back to tile-local coordinates
    const unrotatedDirection =
      DIRECTIONS[((DIRECTIONS.indexOf(direction) - placedTile.rotation) % 4 + 4) % 4];
    for (let i = 0; i < placedTile.tile[pluralType].length; i++) {
      if (placedTile.tile[pluralType][i].directions.indexOf(unrotatedDirection) !== -1) {
        return i;
      }
    }
  } else if (type === 'farm') {
    // Farm direction space has 8 positions → rotation * 2
    const unrotatedDirection =
      FARM_DIRECTIONS[((FARM_DIRECTIONS.indexOf(direction) - placedTile.rotation * 2) % 8 + 8) % 8];
    for (let k = 0; k < placedTile.tile[pluralType].length; k++) {
      if (placedTile.tile[pluralType][k].directions.indexOf(unrotatedDirection) !== -1) {
        return k;
      }
    }
  } else if (type === 'cloister') {
    return 1;
  }

  throw new Error(
    "couldn't find feature index for: " + placedTile.x + ',' + placedTile.y +
    ' ' + type + ':' + direction
  );
}

// ---------------------------------------------------------------------------
// Feature Traversal & Scoring
// ---------------------------------------------------------------------------

/**
 * Core recursive function that traverses a feature across multiple tiles.
 *
 * For CLOISTER: counts tiles within 1-tile Manhattan distance.
 * For ROAD/CITY: walks the connected graph of tiles, accumulating points.
 * For FARM: evaluates adjacent COMPLETE cities, deduplicating via checked.cities.
 *
 * @param {Object} currentTile - The placed tile currently being examined
 * @param {number} featureIndex - Index into the tile's features array for the given type
 * @param {string} featureType - 'city', 'road', 'farm', or 'cloister'
 * @param {Object} gameState - Full game state { placedTiles, players, ... }
 * @param {Object} [checked] - Internal tracker for visited tiles/features (prevents infinite recursion)
 * @returns {Object} { points, complete, tilesWithMeeples, goods, visitedFeatures?, cathedral?, inn? }
 */
export function getFeatureInfo(currentTile, featureIndex, featureType, gameState, checked) {
  // -----------------------------------------------------------------------
  // CLOISTER
  // -----------------------------------------------------------------------
  if (featureType === 'cloister') {
    const results = {
      points: 0,
      complete: false,
      tilesWithMeeples: [],
      goods: [],
    };

    // Count all placed tiles within Chebyshev distance ≤ 1 from this tile
    for (let i = 0; i < gameState.placedTiles.length; i++) {
      const tile = gameState.placedTiles[i];
      if (tile.x <= currentTile.x + 1 && tile.x >= currentTile.x - 1 &&
          tile.y <= currentTile.y + 1 && tile.y >= currentTile.y - 1) {
        results.points++;
      }
    }

    // Cloister point total ranges from 1 (the tile itself) to 9 (fully surrounded)
    results.complete = results.points === 9;

    // Find if anyone has a meeple on this cloister
    for (let i = 0; i < currentTile.meeples.length; i++) {
      if (currentTile.meeples[i].placement.locationType === 'cloister') {
        results.tilesWithMeeples.push({
          placedTile: currentTile,
          meepleIndex: i,
        });
        break;
      }
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // ROAD / CITY / FARM
  // -----------------------------------------------------------------------
  if (featureType === 'road' || featureType === 'city' || featureType === 'farm') {
    // checked is an object that tracks:
    //   - { "x,y": { tile, features: [index, ...] } }  — visited tiles/features
    //   - .cities: { "x,y": { tile, features: [...] } } — farm city dedup
    let initialCall = false;
    if (!checked) {
      checked = {};
      if (featureType === 'farm') {
        checked.cities = {};
      }
      initialCall = true;
    }

    const results = {
      complete: true,
      points: 0,
      tilesWithMeeples: [],
      goods: [],
    };

    const tileKey = getTileKey(currentTile);

    // If this exact tile+feature was already visited, skip it (no double counting)
    if (checked[tileKey] && checked[tileKey].features.indexOf(featureIndex) !== -1) {
      return results;
    }

    // Record this tile+feature in the visited set
    if (checked[tileKey]) {
      checked[tileKey].features.push(featureIndex);
    } else {
      checked[tileKey] = {
        tile: currentTile,
        features: [featureIndex],
      };

      // Award base points for this tile (only on first encounter)
      if (featureType === 'city') {
        // doublePoints may be a boolean (all city indices) or a specific index
        results.points = (currentTile.tile.doublePoints === true ||
          currentTile.tile.doublePoints === featureIndex) ? 2 : 1;
      } else if (featureType === 'road') {
        results.points = 1;
      }
    }

    // -----------------------------------------------------------------------
    // FARM: score adjacent COMPLETE cities (3 points each, 4 with pig)
    // -----------------------------------------------------------------------
    if (featureType === 'farm') {
      const farm = currentTile.tile.farms[featureIndex];
      if (farm && farm.adjacentCityIndices) {
        for (let k = 0; k < farm.adjacentCityIndices.length; k++) {
          const cityIndex = farm.adjacentCityIndices[k];

          // Check city completeness via a fresh getFeatureInfo call
          // NOTE: checked is deliberately NOT passed — each city is evaluated
          // independently to avoid corrupting the farm's checked state
          const info = getFeatureInfo(currentTile, cityIndex, 'city', gameState);

          if (info.complete) {
            let unseen = true;

            // Deduplicate: ensure we haven't counted this city already via
            // another farm tile. checked.cities tracks which tile+feature
            // combinations have been counted.
            if (info.visitedFeatures) {
              for (let f = 0; f < info.visitedFeatures.length; f++) {
                const visitedKey = getTileKey(info.visitedFeatures[f].tile);

                if (checked.cities[visitedKey]) {
                  for (let g = 0; g < info.visitedFeatures[f].features.length; g++) {
                    const visitedIndex = info.visitedFeatures[f].features[g];
                    if (checked.cities[visitedKey].features.indexOf(visitedIndex) !== -1) {
                      unseen = false;
                    } else {
                      checked.cities[visitedKey].features.push(visitedIndex);
                    }
                  }
                } else {
                  checked.cities[visitedKey] = {
                    tile: info.visitedFeatures[f].tile,
                    features: info.visitedFeatures[f].features,
                  };
                }
              }
            }

            if (unseen) {
              results.points += 3; // pig meeple adds +1 later in checkAndFinalizeFeature
            }
          }
        }
      }
    }

    // -----------------------------------------------------------------------
    // Record any meeples standing on this feature at this tile
    // -----------------------------------------------------------------------
    for (let i = 0; i < currentTile.meeples.length; i++) {
      const meeple = currentTile.meeples[i];
      if (meeple.placement.locationType === featureType &&
          meeple.placement.index === featureIndex) {
        results.tilesWithMeeples.push({
          placedTile: currentTile,
          meepleIndex: i,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Get the feature definition and check for goods / inn / cathedral
    // -----------------------------------------------------------------------
    const pluralType = featureType === 'city' ? 'cities' : featureType + 's';
    const currentFeature = currentTile.tile[pluralType][featureIndex];

    // Trade goods (T&B expansion)
    if (featureType === 'city' && currentFeature && currentFeature.goods) {
      results.goods.push(currentFeature.goods);
    }

    // Cathedral (I&C expansion) — placed on the tile, not per-city-feature
    if (featureType === 'city' && currentTile.tile.cathedral) {
      results.cathedral = true;
    }

    // Inn (I&C expansion) — placed on a specific road segment
    if (featureType === 'road' && currentFeature && currentFeature.inn) {
      results.inn = true;
    }

    // -----------------------------------------------------------------------
    // Traverse all directions this feature extends toward
    // -----------------------------------------------------------------------
    const dirs = featureType === 'farm' ? FARM_DIRECTIONS : DIRECTIONS;
    const mult = featureType === 'farm' ? 2 : 1;

    for (let j = 0; j < currentFeature.directions.length; j++) {
      const direction = currentFeature.directions[j];

      // Apply tile rotation to get the actual world-direction this edge faces
      const rotatedDirection =
        dirs[(dirs.indexOf(direction) + currentTile.rotation * mult) % dirs.length];

      // Determine which adjacent tile is in this direction
      let connectedTile, flippedDirection;

      if (rotatedDirection.charAt(0) === 'N') {
        connectedTile = gameState.placedTiles[currentTile.northTileIndex];
        // Flip N↔S since we're now viewing from the neighbor's perspective
        flippedDirection = rotatedDirection.replace(/N/g, 'S');
      } else if (rotatedDirection.charAt(0) === 'E') {
        connectedTile = gameState.placedTiles[currentTile.eastTileIndex];
        flippedDirection = rotatedDirection.replace(/E/g, 'W');
      } else if (rotatedDirection.charAt(0) === 'S') {
        connectedTile = gameState.placedTiles[currentTile.southTileIndex];
        flippedDirection = rotatedDirection.replace(/S/g, 'N');
      } else if (rotatedDirection.charAt(0) === 'W') {
        connectedTile = gameState.placedTiles[currentTile.westTileIndex];
        flippedDirection = rotatedDirection.replace(/W/g, 'E');
      }

      if (!connectedTile) {
        // Edge of the board → feature is NOT complete
        results.complete = false;
      } else {
        // Find the matching feature on the neighbor and recurse
        const connectedIndex = getFeatureIndex(connectedTile, featureType, flippedDirection);
        const neighborResults = getFeatureInfo(
          connectedTile, connectedIndex, featureType, gameState, checked
        );

        // Merge neighbor's results into ours
        results.goods = results.goods.concat(neighborResults.goods);
        results.cathedral = results.cathedral || neighborResults.cathedral;
        results.inn = results.inn || neighborResults.inn;
        results.complete = results.complete && neighborResults.complete;
        results.points += neighborResults.points;

        // Collect any meeples found on the neighbor's part of this feature
        for (let z = 0; z < neighborResults.tilesWithMeeples.length; z++) {
          results.tilesWithMeeples.push(neighborResults.tilesWithMeeples[z]);
        }
      }
    }

    // -----------------------------------------------------------------------
    // On the initial (top-level) call, compile the list of all visited
    // tile+feature pairs for use by farm city-dedup logic.
    // -----------------------------------------------------------------------
    if (initialCall) {
      results.visitedFeatures = [];
      for (const key in checked) {
        if (key !== 'cities') {
          results.visitedFeatures.push({
            tile: checked[key].tile,
            features: checked[key].features,
          });
        }
      }
    }

    return results;
  }

  // Fallback (should never be reached with valid input)
  return {
    points: 0,
    complete: false,
    tilesWithMeeples: [],
    goods: [],
  };
}

// ---------------------------------------------------------------------------
// Feature Completion Check & Scoring
// ---------------------------------------------------------------------------

/**
 * Check if a feature is complete (or the game is over) and score it.
 *
 * Determines majority ownership, calculates points (including multipliers for
 * inns, cathedrals, and completed cities/roads), returns used meeples to the
 * player's supply, assigns trade goods to the active player, and records
 * scoring messages.
 *
 * @param {Object} placedTile - The placed tile where the feature originates
 * @param {number} featureIndex - Index of the feature on the tile
 * @param {string} featureType - 'city', 'road', 'farm', or 'cloister'
 * @param {boolean} gameOver - true during end-game scoring (meeples marked 'scored' instead of removed)
 * @param {Object} gameState - Full game state { placedTiles, players, ... }
 */
export function checkAndFinalizeFeature(placedTile, featureIndex, featureType, gameOver, gameState) {
  // Validate feature type
  if (!((placedTile.tile.cloister && featureType === 'cloister') ||
        featureType === 'road' ||
        featureType === 'city' ||
        featureType === 'farm')) {
    return;
  }

  const featureInfo = getFeatureInfo(placedTile, featureIndex, featureType, gameState);

  // Only score if the feature is complete (or game is over) and has meeples on it
  if (!((featureInfo.complete || gameOver) && featureInfo.tilesWithMeeples.length > 0)) {
    return;
  }

  // -------------------------------------------------------------------------
  // Determine majority ownership (normal=1, large=2)
  // -------------------------------------------------------------------------
  const meepleCount = {};       // playerIndex → count (normal=1, large=2)
  const playersWithMeeples = [];
  const playersWithPigMeeple = [];
  let maxNumberOfMeeples = 1;

  for (let i = 0; i < featureInfo.tilesWithMeeples.length; i++) {
    const entry = featureInfo.tilesWithMeeples[i];
    const meeple = entry.placedTile.meeples[entry.meepleIndex];
    const playerIndex = meeple.playerIndex;
    const meepleType = meeple.meepleType;

    // --- Removal / scoring flag --------------------------------------------
    if (gameOver) {
      meeple.scored = true;
    } else {
      // Remove meeple from the tile
      entry.placedTile.meeples.splice(entry.meepleIndex, 1);

      // Return meeple to the player's supply
      if (meepleType === 'normal') {
        gameState.players[playerIndex].remainingMeeples += 1;
      } else if (meepleType !== 'pig') {
        // Large meeples, builder, and other special types use the flag system
        gameState.players[playerIndex][getMeepleFlagFromType(meepleType)] = true;
      }
      // Note: builder has flag restored (player can reuse it). Only pig stays on the board
      // until end-game (pig is not returned during mid-game scoring).
    }

    // --- Track pig meeples (farm scoring bonus) ----------------------------
    if (featureType === 'farm' && meepleType === 'pig') {
      if (playersWithPigMeeple.indexOf(playerIndex) === -1) {
        playersWithPigMeeple.push(playerIndex);
      }
    }

    // --- Count meeples for majority ----------------------------------------
    if (playersWithMeeples.indexOf(playerIndex) === -1) {
      playersWithMeeples.push(playerIndex);
      meepleCount[playerIndex] = 0;
    }

    if (meepleType === 'normal') {
      meepleCount[playerIndex]++;
    } else if (meepleType === 'large') {
      meepleCount[playerIndex] += 2;
    } else if (meepleType === 'builder' || meepleType === 'pig') {
      // Builders and pigs don't count toward majority
    }

    if (meepleCount[playerIndex] > maxNumberOfMeeples) {
      maxNumberOfMeeples = meepleCount[playerIndex];
    }
  }

  // -------------------------------------------------------------------------
  // Calculate scored points with multipliers
  // -------------------------------------------------------------------------
  let scoredPoints = featureInfo.points;

  // Incomplete road with inn OR incomplete city with cathedral → 0 points
  if (!featureInfo.complete && (featureInfo.cathedral || featureInfo.inn)) {
    scoredPoints *= 0;
  }

  // Complete city with cathedral → triple points
  if (featureInfo.complete && featureInfo.cathedral) {
    scoredPoints *= 3;
  }

  // Complete city (no cathedral) → double points
  if (featureInfo.complete && featureType === 'city' && !featureInfo.cathedral) {
    scoredPoints *= 2;
  }

  // Complete road with inn → double points
  if (featureInfo.complete && featureInfo.inn) {
    scoredPoints *= 2;
  }

  // -------------------------------------------------------------------------
  // Award points to majority players
  // -------------------------------------------------------------------------
  const scoringPlayers = [];
  const scoringPlayersWithPig = [];

  for (let k = 0; k < gameState.players.length; k++) {
    if (meepleCount[k] && meepleCount[k] === maxNumberOfMeeples) {
      if (featureType === 'farm' && playersWithPigMeeple.indexOf(k) !== -1) {
        // Pig meeple: 4 points per city instead of 3
        gameState.players[k].points += scoredPoints * 4 / 3;
        scoringPlayersWithPig.push(gameState.players[k]);
      } else {
        gameState.players[k].points += scoredPoints;
        scoringPlayers.push(gameState.players[k]);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Record scoring event for per-category breakdown
  // -------------------------------------------------------------------------
  if (scoringPlayers.length > 0 || scoringPlayersWithPig.length > 0) {
    if (!gameState.featureScores) {
      gameState.featureScores = [];
    }

    const playerAwards = [];
    for (let s = 0; s < scoringPlayers.length; s++) {
      playerAwards.push({
        playerIndex: gameState.players.indexOf(scoringPlayers[s]),
        points: Math.floor(scoredPoints),
      });
    }
    for (let s = 0; s < scoringPlayersWithPig.length; s++) {
      playerAwards.push({
        playerIndex: gameState.players.indexOf(scoringPlayersWithPig[s]),
        points: Math.floor(scoredPoints * 4 / 3),
      });
    }

    gameState.featureScores.push({
      type: featureType,
      players: playerAwards,
      count: 1,
      complete: featureInfo.complete,
    });
  }

  // -------------------------------------------------------------------------
  // Create chat log messages
  // -------------------------------------------------------------------------
  if (scoringPlayers.length > 0 && scoredPoints > 0) {
    let message = scoringPlayers.map(p => {
      const name = p.user ? p.user.username : 'Player ' + gameState.players.indexOf(p);
      return name + ' (' + p.points + ')';
    }).join(' and ');

    message += ' scored ' + Math.floor(scoredPoints) +
      ' for ' + (featureType === 'farm' ? 'a ' : gameOver ? 'an uncomplete ' : 'a completed ') + featureType;

    if (featureInfo.cathedral) {
      message += ' with a cathedral';
    } else if (featureInfo.inn) {
      message += ' with an inn';
    }

    gameState.messages.push({ username: null, message });
  }

  if (scoringPlayersWithPig.length > 0) {
    const pigPoints = scoredPoints * 4 / 3;
    const message = scoringPlayersWithPig.map(p => {
      const name = p.user ? p.user.username : 'Player ' + gameState.players.indexOf(p);
      return name + ' (' + p.points + ')';
    }).join(' and ') + ' scored ' + Math.floor(pigPoints) + ' for a farm with a pig';

    gameState.messages.push({ username: null, message });
  }

  // -------------------------------------------------------------------------
  // Award trade goods (T&B expansion) — goes to the active player who
  // completed the city, not necessarily the majority owner
  // -------------------------------------------------------------------------
  if (featureInfo.complete && featureType === 'city' && featureInfo.goods.length > 0) {
    let activePlayer;
    for (let i = 0; i < gameState.players.length; i++) {
      if (gameState.players[i].active) {
        activePlayer = gameState.players[i];
        break;
      }
    }

    if (activePlayer) {
      // Add goods tokens to active player's inventory
      for (let j = 0; j < featureInfo.goods.length; j++) {
        activePlayer.goods[featureInfo.goods[j]]++;
      }

      // Build the "picked up" message
      const groupedGoods = {};
      featureInfo.goods.forEach(item => {
        groupedGoods[item] = (groupedGoods[item] || 0) + 1;
      });

      let goodsMessage = '';
      for (const good in groupedGoods) {
        if (goodsMessage !== '') goodsMessage += ' and ';
        goodsMessage += groupedGoods[good] + ' ' + good;
      }

      const playerName = activePlayer.user
        ? activePlayer.user.username
        : 'Player ' + gameState.players.indexOf(activePlayer);
      goodsMessage = playerName + ' picked up ' + goodsMessage;

      gameState.messages.push({ username: null, message: goodsMessage });
    }
  }
}

// ---------------------------------------------------------------------------
// End-Game Scoring
// ---------------------------------------------------------------------------

/**
 * End-game scoring: scores all incomplete features, awards T&B goods majority
 * bonus (if applicable), and marks the game as finished.
 *
 * @param {Object} gameState - Full game state { placedTiles, players, expansions, ... }
 */
export function completeGame(gameState) {
  // -------------------------------------------------------------------------
  // Score all unscored normal/large meeples on incomplete features
  // -------------------------------------------------------------------------
  for (let i = 0; i < gameState.placedTiles.length; i++) {
    const tile = gameState.placedTiles[i];
    for (let k = 0; k < tile.meeples.length; k++) {
      const meeple = tile.meeples[k];
      if (!meeple.scored &&
          (meeple.meepleType === 'normal' || meeple.meepleType === 'large')) {
        checkAndFinalizeFeature(
          tile,
          meeple.placement.index,
          meeple.placement.locationType,
          true, // gameOver = true → mark scored instead of removing
          gameState
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // T&B expansion: goods majority (most fabric/wine/wheat → +10 points)
  // -------------------------------------------------------------------------
  if (gameState.expansions && gameState.expansions.indexOf('traders-and-builders') !== -1) {
    const maxGoods = { fabric: 0, wine: 0, wheat: 0 };

    // Find the maximum of each goods type
    for (let j = 0; j < gameState.players.length; j++) {
      maxGoods.fabric = Math.max(gameState.players[j].goods.fabric, maxGoods.fabric);
      maxGoods.wine = Math.max(gameState.players[j].goods.wine, maxGoods.wine);
      maxGoods.wheat = Math.max(gameState.players[j].goods.wheat, maxGoods.wheat);
    }

    let fabricMessage = '';
    let wineMessage = '';
    let wheatMessage = '';

    // Award 10 points to each player who holds the max of each type
    for (let l = 0; l < gameState.players.length; l++) {
      const player = gameState.players[l];
      const playerName = player.user ? player.user.username : 'Player ' + l;

      if (player.goods.fabric === maxGoods.fabric && maxGoods.fabric > 0) {
        player.points += 10;
        if (fabricMessage !== '') fabricMessage += ' and ';
        fabricMessage += playerName + ' (' + player.points + ')';
      }
      if (player.goods.wine === maxGoods.wine && maxGoods.wine > 0) {
        player.points += 10;
        if (wineMessage !== '') wineMessage += ' and ';
        wineMessage += playerName + ' (' + player.points + ')';
      }
      if (player.goods.wheat === maxGoods.wheat && maxGoods.wheat > 0) {
        player.points += 10;
        if (wheatMessage !== '') wheatMessage += ' and ';
        wheatMessage += playerName + ' (' + player.points + ')';
      }
    }

    // Record goods majority scoring events for breakdown
    if (!gameState.featureScores) gameState.featureScores = [];
    const goodsTypes = ['fabric', 'wine', 'wheat'];
    for (const good of goodsTypes) {
      const maxVal = maxGoods[good];
      if (maxVal > 0) {
        const awardPlayers = [];
        for (let l = 0; l < gameState.players.length; l++) {
          if (gameState.players[l].goods[good] === maxVal) {
            awardPlayers.push({ playerIndex: l, points: 10 });
          }
        }
        if (awardPlayers.length > 0) {
          gameState.featureScores.push({
            type: 'goods',
            subtype: good,
            players: awardPlayers,
            count: 1,
            complete: true,
          });
        }
      }
    }

    if (fabricMessage !== '') {
      fabricMessage += ' scored 10 points for having the most fabric tokens';
      gameState.messages.push({ username: null, message: fabricMessage });
    }
    if (wineMessage !== '') {
      wineMessage += ' scored 10 points for having the most wine tokens';
      gameState.messages.push({ username: null, message: wineMessage });
    }
    if (wheatMessage !== '') {
      wheatMessage += ' scored 10 points for having the most wheat tokens';
      gameState.messages.push({ username: null, message: wheatMessage });
    }
  }

  // Mark the game as finished
  gameState.finished = true;
}

// ---------------------------------------------------------------------------
// Detailed Scores (per-category breakdown)
// ---------------------------------------------------------------------------

/**
 * Aggregate featureScores records into a per-player, per-category summary.
 * Sorts players by total score descending (highest first).
 *
 * @param {Object} gameState - Full game state
 * @returns {Object} { players: [{ playerIndex, totalScore, categories }] }
 */
export function getDetailedScores(gameState) {
  const featureScores = gameState.featureScores || [];

  // Initialise per-player result objects
  const result = gameState.players.map((player, idx) => ({
    playerIndex: idx,
    totalScore: player.points,
    categories: {},
  }));

  // Aggregate each recorded scoring event
  for (const event of featureScores) {
    const type = event.type;
    for (const award of event.players) {
      if (!result[award.playerIndex]) continue;
      const cat = result[award.playerIndex].categories;
      if (!cat[type]) {
        cat[type] = { score: 0, count: 0 };
      }
      cat[type].score += award.points;
      cat[type].count += event.count || 1;
    }
  }

  // Sort by total score descending (highest first)
  result.sort((a, b) => b.totalScore - a.totalScore);

  return { players: result };
}
