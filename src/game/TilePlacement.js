/**
 * TilePlacement.js
 *
 * Pure JS module that calculates all valid tile placements and valid meeple
 * placements for a drawn tile, given the current game state.
 *
 * Ported from gamestate.js drawTile() method (lines 196-828) with NO Mongoose
 * dependencies.
 *
 * @module TilePlacement
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CARDINAL_DIRECTIONS = ['N', 'E', 'S', 'W'];
export const FARM_DIRECTIONS = ['NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW', 'NNW'];

// ---------------------------------------------------------------------------
// Public helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Return the edge types of `tile` after applying `rotation` (0-3).
 * Each rotation is a 90° clockwise turn.
 *
 * @param   {object} tile     Tile object with northEdge, eastEdge, etc.
 * @param   {number} rotation 0-3
 * @returns {{ northEdge, eastEdge, southEdge, westEdge }}
 */
export function getRotatedEdges(tile, rotation) {
	switch (rotation) {
		case 0:
			return {
				northEdge: tile.northEdge,
				eastEdge: tile.eastEdge,
				southEdge: tile.southEdge,
				westEdge: tile.westEdge,
			};
		case 1:
			return {
				northEdge: tile.westEdge,
				eastEdge: tile.northEdge,
				southEdge: tile.eastEdge,
				westEdge: tile.southEdge,
			};
		case 2:
			return {
				northEdge: tile.southEdge,
				eastEdge: tile.westEdge,
				southEdge: tile.northEdge,
				westEdge: tile.eastEdge,
			};
		default:
			// rotation === 3
			return {
				northEdge: tile.eastEdge,
				eastEdge: tile.southEdge,
				southEdge: tile.westEdge,
				westEdge: tile.northEdge,
			};
	}
}

/**
 * Rotate an array of feature directions (e.g. ['N','E']) by `rotation` steps.
 *
 * For farms the rotation multiplier is 2 (farm directions use an 8-element
 * compass while cardinal features only use a 4-element one).
 *
 * @param   {string[]} directions  Original direction strings
 * @param   {number}   rotation    Number of 90° clockwise turns
 * @param   {boolean}  isFarm      Whether this is a farm feature
 * @returns {string[]}             Rotated directions
 */
export function getRotatedFeatureDirections(directions, rotation, isFarm) {
	const pool = isFarm ? FARM_DIRECTIONS : CARDINAL_DIRECTIONS;
	const mult = isFarm ? 2 : 1;
	return directions.map(function (dir) {
		return pool[(pool.indexOf(dir) + rotation * mult) % pool.length];
	});
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Produce a string that is the same length but with the first character
 * flipped (N↔S, E↔W) – used to translate a direction from one tile's
 * perspective to the adjacent tile's perspective.
 *
 * e.g. flipBase('NNE') → 'SSE'
 */
function flipBase(dir) {
	const first = dir.charAt(0);
	const rest = dir.slice(1);
	const flipped =
		first === 'N' ? 'S' :
		first === 'S' ? 'N' :
		first === 'E' ? 'W' :
		first === 'W' ? 'E' :
		first;
	return flipped + rest;
}

/**
 * Look up an adjacent tile by coordinates and direction.
 *
 * @param   {object[]} placedTiles
 * @param   {number}   x          Current tile x
 * @param   {number}   y          Current tile y
 * @param   {string}   direction  'N','E','S','W' or longer farm direction
 * @returns {object|null}         The adjacent tile or null
 */
function getAdjacentTile(placedTiles, x, y, direction) {
	const bd = direction.charAt(0);
	const tx = bd === 'E' ? x + 1 : bd === 'W' ? x - 1 : x;
	const ty = bd === 'S' ? y + 1 : bd === 'N' ? y - 1 : y;
	for (let i = 0; i < placedTiles.length; i++) {
		const t = placedTiles[i];
		if (t.x === tx && t.y === ty) {
			return t;
		}
	}
	return null;
}

/**
 * Find the index of a feature on a tile by matching a rotated direction.
 *
 * Ported from getFeatureIndex() in gamestate.js (lines 1620-1651).
 *
 * @param   {object} tile              Placed tile object
 * @param   {string} type              'city', 'road', 'farm', or 'cloister'
 * @param   {string} rotatedDirection  Direction as seen on the rotated tile
 * @returns {number}                   Feature index, or -1 if not found
 */
function getFeatureIndex(tile, type, rotatedDirection) {
	if (type === 'cloister') {
		return 1;
	}

	const pluralType = type === 'city' ? 'cities' : type + 's';
	let directions;
	let unrotatedDirection;

	if (type === 'city' || type === 'road') {
		directions = CARDINAL_DIRECTIONS;
		unrotatedDirection = directions[((directions.indexOf(rotatedDirection) - tile.rotation) % 4 + 4) % 4];
	} else if (type === 'farm') {
		directions = FARM_DIRECTIONS;
		unrotatedDirection = directions[((directions.indexOf(rotatedDirection) - tile.rotation * 2) % 8 + 8) % 8];
	}

	const features = tile.tile[pluralType];
	for (let i = 0; i < features.length; i++) {
		if (features[i].directions.indexOf(unrotatedDirection) !== -1) {
			return i;
		}
	}
	return -1;
}

/**
 * Recursively collect all meeples on a connected feature (city, road, farm).
 *
 * Simplified version of getFeatureInfo() from gamestate.js – only returns
 * `tilesWithMeeples` (no points/completeness calculation).
 *
 * @param   {object}   tile           Starting placed tile
 * @param   {number}   featureIndex   Feature index on that tile
 * @param   {string}   featureType    'city', 'road', or 'farm'
 * @param   {object[]} placedTiles    All placed tiles
 * @param   {object}   [checked]      Internal recursion tracker
 * @returns {{ tilesWithMeeples: Array }}
 */
function getFeatureMeeples(tile, featureIndex, featureType, placedTiles, checked) {
	const results = { tilesWithMeeples: [] };
	const tracker = checked || {};

	const pluralType = featureType === 'city' ? 'cities' : featureType + 's';
	const directions = featureType === 'farm' ? FARM_DIRECTIONS : CARDINAL_DIRECTIONS;
	const mult = featureType === 'farm' ? 2 : 1;

	// Prevent infinite recursion
	const checkKey = tile.x + ',' + tile.y + '-' + featureIndex + '-' + featureType;
	if (tracker[checkKey]) {
		return results;
	}
	tracker[checkKey] = true;

	// Collect meeples on this tile that match this feature
	for (let m = 0; m < tile.meeples.length; m++) {
		const mp = tile.meeples[m];
		if (mp.placement.locationType === featureType && mp.placement.index === featureIndex) {
			results.tilesWithMeeples.push({
				placedTile: tile,
				meepleIndex: m
			});
		}
	}

	// Traverse each direction the feature extends in
	const currentFeature = tile.tile[pluralType][featureIndex];
	if (!currentFeature || !currentFeature.directions) {
		return results;
	}

	for (let d = 0; d < currentFeature.directions.length; d++) {
		const dir = currentFeature.directions[d];
		const rotatedDir = directions[(directions.indexOf(dir) + tile.rotation * mult) % directions.length];
		const adjacentTile = getAdjacentTile(placedTiles, tile.x, tile.y, rotatedDir);

		if (adjacentTile) {
			const flippedDir = flipBase(rotatedDir);
			const adjIndex = getFeatureIndex(adjacentTile, featureType, flippedDir);
			if (adjIndex !== -1) {
				const sub = getFeatureMeeples(adjacentTile, adjIndex, featureType, placedTiles, tracker);
				for (let s = 0; s < sub.tilesWithMeeples.length; s++) {
					results.tilesWithMeeples.push(sub.tilesWithMeeples[s]);
				}
			}
		}
	}

	return results;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Calculate all valid placements for a tile, including meeple placements.
 *
 * @param   {object}   activeTileData  The tile being placed (from TileData.js)
 * @param   {object[]} placedTiles     Array of already-placed tiles
 * @param   {object[]} players         Array of player objects
 * @param   {string[]} expansions      Array of expansion identifiers
 * @returns {Array}                    Valid placements grouped by (x, y)
 */
export default function calculateValidPlacements(activeTileData, placedTiles, players, expansions) {
	// -----------------------------------------------------------------------
	// 1. Compute rotated edges for every placed tile
	// -----------------------------------------------------------------------
	const rotatedTiles = placedTiles.map(function (placedTile) {
		return getRotatedEdges(placedTile.tile, placedTile.rotation);
	});

	// -----------------------------------------------------------------------
	// 2. Find every potential (x, y, rotation) by matching edges
	// -----------------------------------------------------------------------
	const potentialPlacements = [];

	for (let i = 0; i < placedTiles.length; i++) {
		const placedTile = placedTiles[i];
		const rTile = rotatedTiles[i];

		// --- North face open ---
		if (placedTile.northTileIndex === undefined) {
			if (rTile.northEdge === activeTileData.northEdge) {
				potentialPlacements.push({
					x: placedTile.x,
					y: placedTile.y - 1,
					rotation: 2,
					sourceIndex: i,
					directionToSource: 'S',
					directionFromSource: 'N'
				});
			}
			if (rTile.northEdge === activeTileData.eastEdge) {
				potentialPlacements.push({
					x: placedTile.x,
					y: placedTile.y - 1,
					rotation: 1,
					sourceIndex: i,
					directionToSource: 'S',
					directionFromSource: 'N'
				});
			}
			if (rTile.northEdge === activeTileData.southEdge) {
				potentialPlacements.push({
					x: placedTile.x,
					y: placedTile.y - 1,
					rotation: 0,
					sourceIndex: i,
					directionToSource: 'S',
					directionFromSource: 'N'
				});
			}
			if (rTile.northEdge === activeTileData.westEdge) {
				potentialPlacements.push({
					x: placedTile.x,
					y: placedTile.y - 1,
					rotation: 3,
					sourceIndex: i,
					directionToSource: 'S',
					directionFromSource: 'N'
				});
			}
		}

		// --- East face open ---
		if (placedTile.eastTileIndex === undefined) {
			if (rTile.eastEdge === activeTileData.northEdge) {
				potentialPlacements.push({
					x: placedTile.x + 1,
					y: placedTile.y,
					rotation: 3,
					sourceIndex: i,
					directionToSource: 'W',
					directionFromSource: 'E'
				});
			}
			if (rTile.eastEdge === activeTileData.eastEdge) {
				potentialPlacements.push({
					x: placedTile.x + 1,
					y: placedTile.y,
					rotation: 2,
					sourceIndex: i,
					directionToSource: 'W',
					directionFromSource: 'E'
				});
			}
			if (rTile.eastEdge === activeTileData.southEdge) {
				potentialPlacements.push({
					x: placedTile.x + 1,
					y: placedTile.y,
					rotation: 1,
					sourceIndex: i,
					directionToSource: 'W',
					directionFromSource: 'E'
				});
			}
			if (rTile.eastEdge === activeTileData.westEdge) {
				potentialPlacements.push({
					x: placedTile.x + 1,
					y: placedTile.y,
					rotation: 0,
					sourceIndex: i,
					directionToSource: 'W',
					directionFromSource: 'E'
				});
			}
		}

		// --- South face open ---
		if (placedTile.southTileIndex === undefined) {
			if (rTile.southEdge === activeTileData.northEdge) {
				potentialPlacements.push({
					x: placedTile.x,
					y: placedTile.y + 1,
					rotation: 0,
					sourceIndex: i,
					directionToSource: 'N',
					directionFromSource: 'S'
				});
			}
			if (rTile.southEdge === activeTileData.eastEdge) {
				potentialPlacements.push({
					x: placedTile.x,
					y: placedTile.y + 1,
					rotation: 3,
					sourceIndex: i,
					directionToSource: 'N',
					directionFromSource: 'S'
				});
			}
			if (rTile.southEdge === activeTileData.southEdge) {
				potentialPlacements.push({
					x: placedTile.x,
					y: placedTile.y + 1,
					rotation: 2,
					sourceIndex: i,
					directionToSource: 'N',
					directionFromSource: 'S'
				});
			}
			if (rTile.southEdge === activeTileData.westEdge) {
				potentialPlacements.push({
					x: placedTile.x,
					y: placedTile.y + 1,
					rotation: 1,
					sourceIndex: i,
					directionToSource: 'N',
					directionFromSource: 'S'
				});
			}
		}

		// --- West face open ---
		if (placedTile.westTileIndex === undefined) {
			if (rTile.westEdge === activeTileData.northEdge) {
				potentialPlacements.push({
					x: placedTile.x - 1,
					y: placedTile.y,
					rotation: 1,
					sourceIndex: i,
					directionToSource: 'E',
					directionFromSource: 'W'
				});
			}
			if (rTile.westEdge === activeTileData.eastEdge) {
				potentialPlacements.push({
					x: placedTile.x - 1,
					y: placedTile.y,
					rotation: 0,
					sourceIndex: i,
					directionToSource: 'E',
					directionFromSource: 'W'
				});
			}
			if (rTile.westEdge === activeTileData.southEdge) {
				potentialPlacements.push({
					x: placedTile.x - 1,
					y: placedTile.y,
					rotation: 3,
					sourceIndex: i,
					directionToSource: 'E',
					directionFromSource: 'W'
				});
			}
			if (rTile.westEdge === activeTileData.westEdge) {
				potentialPlacements.push({
					x: placedTile.x - 1,
					y: placedTile.y,
					rotation: 2,
					sourceIndex: i,
					directionToSource: 'E',
					directionFromSource: 'W'
				});
			}
		}
	}

	// -----------------------------------------------------------------------
	// 3. Rotate the active tile's edges for each candidate placement
	// -----------------------------------------------------------------------
	const rotatedPlacements = potentialPlacements.map(function (placement) {
		const edges = getRotatedEdges(activeTileData, placement.rotation);
		return {
			northEdge: edges.northEdge,
			eastEdge: edges.eastEdge,
			southEdge: edges.southEdge,
			westEdge: edges.westEdge
		};
	});

	// -----------------------------------------------------------------------
	// 4. Remove placements that conflict with any already-placed tile
	// -----------------------------------------------------------------------
	const invalidIndices = [];
	for (let k = 0; k < placedTiles.length; k++) {
		const ct = placedTiles[k];
		const rt = rotatedTiles[k];
		for (let j = 0; j < potentialPlacements.length; j++) {
			const p = potentialPlacements[j];
			const rp = rotatedPlacements[j];
			if (
				(ct.x === p.x && ct.y - 1 === p.y && rt.northEdge !== rp.southEdge) ||
				(ct.x === p.x && ct.y + 1 === p.y && rt.southEdge !== rp.northEdge) ||
				(ct.y === p.y && ct.x - 1 === p.x && rt.westEdge !== rp.eastEdge) ||
				(ct.y === p.y && ct.x + 1 === p.x && rt.eastEdge !== rp.westEdge)
			) {
				invalidIndices.push(j);
			}
		}
	}

	const filteredPlacements = potentialPlacements.filter(function (_, idx) {
		return invalidIndices.indexOf(idx) === -1;
	});

	// Early exit – no valid tile placements
	if (filteredPlacements.length === 0) {
		return [];
	}

	// -----------------------------------------------------------------------
	// 5. Calculate valid meeple placements for each valid tile placement
	// -----------------------------------------------------------------------
	for (let idx = 0; idx < filteredPlacements.length; idx++) {
		const currentPlacement = filteredPlacements[idx];
		const adjacentTile = placedTiles[currentPlacement.sourceIndex];
		currentPlacement.meeples = [];

		// ----- 5a. Cities -----
		for (let ci = 0; ci < activeTileData.cities.length; ci++) {
			let cityValid = true;

			const rotatedCityDirs = activeTileData.cities[ci].directions.map(function (dir) {
				return CARDINAL_DIRECTIONS[(CARDINAL_DIRECTIONS.indexOf(dir) + currentPlacement.rotation) % 4];
			});

			if (rotatedCityDirs.indexOf(currentPlacement.directionToSource) !== -1) {
				const adjIndex = getFeatureIndex(adjacentTile, 'city', currentPlacement.directionFromSource);
				if (adjIndex !== -1) {
					const featureInfo = getFeatureMeeples(adjacentTile, adjIndex, 'city', placedTiles);
					cityValid = featureInfo.tilesWithMeeples.length === 0;

					for (let mi = 0; mi < featureInfo.tilesWithMeeples.length; mi++) {
						const mInfo = featureInfo.tilesWithMeeples[mi];
						const playerIdx = mInfo.placedTile.meeples[mInfo.meepleIndex].playerIndex;
						if (players[playerIdx] && players[playerIdx].active) {
							currentPlacement.meeples.push({
								meepleType: 'builder',
								locationType: 'city',
								index: ci
							});
							break;
						}
					}
				}
			}

			if (cityValid) {
				currentPlacement.meeples.push({
					meepleType: 'normal',
					locationType: 'city',
					index: ci
				});
			}
		}

		// ----- 5b. Roads -----
		for (let ri = 0; ri < activeTileData.roads.length; ri++) {
			let roadValid = true;

			const rotatedRoadDirs = activeTileData.roads[ri].directions.map(function (dir) {
				return CARDINAL_DIRECTIONS[(CARDINAL_DIRECTIONS.indexOf(dir) + currentPlacement.rotation) % 4];
			});

			if (rotatedRoadDirs.indexOf(currentPlacement.directionToSource) !== -1) {
				const roadAdjIndex = getFeatureIndex(adjacentTile, 'road', currentPlacement.directionFromSource);
				if (roadAdjIndex !== -1) {
					const roadFeatureInfo = getFeatureMeeples(adjacentTile, roadAdjIndex, 'road', placedTiles);
					roadValid = roadFeatureInfo.tilesWithMeeples.length === 0;

					for (let mi2 = 0; mi2 < roadFeatureInfo.tilesWithMeeples.length; mi2++) {
						const rmInfo = roadFeatureInfo.tilesWithMeeples[mi2];
						const rPlayerIdx = rmInfo.placedTile.meeples[rmInfo.meepleIndex].playerIndex;
						if (players[rPlayerIdx] && players[rPlayerIdx].active) {
							currentPlacement.meeples.push({
								meepleType: 'builder',
								locationType: 'road',
								index: ri
							});
							break;
						}
					}
				}
			}

			if (roadValid) {
				currentPlacement.meeples.push({
					meepleType: 'normal',
					locationType: 'road',
					index: ri
				});
			}
		}

		// ----- 5c. Farms -----
		for (let fi = 0; fi < activeTileData.farms.length; fi++) {
			let farmValid = true;

			const rotatedFarmDirs = activeTileData.farms[fi].directions.map(function (dir) {
				return FARM_DIRECTIONS[(FARM_DIRECTIONS.indexOf(dir) + currentPlacement.rotation * 2) % 8];
			});

			// N → check NNW (connects to adjacent SSW) and NNE (connects to SSE)
			if (currentPlacement.directionToSource === 'N') {
				if (rotatedFarmDirs.indexOf('NNW') !== -1) {
					const adjSSWIndex = getFeatureIndex(adjacentTile, 'farm', 'SSW');
					if (adjSSWIndex !== -1) {
						const ffNNW = getFeatureMeeples(adjacentTile, adjSSWIndex, 'farm', placedTiles);
						for (let mNNW = 0; mNNW < ffNNW.tilesWithMeeples.length; mNNW++) {
							const mepNNW = ffNNW.tilesWithMeeples[mNNW];
							const pNNW = mepNNW.placedTile.meeples[mepNNW.meepleIndex].playerIndex;
							if (players[pNNW] && players[pNNW].active) {
								currentPlacement.meeples.push({
									meepleType: 'pig',
									locationType: 'farm',
									index: fi
								});
								break;
							}
						}
						farmValid = farmValid && ffNNW.tilesWithMeeples.length === 0;
					}
				}
				if (rotatedFarmDirs.indexOf('NNE') !== -1) {
					const adjSSEIndex = getFeatureIndex(adjacentTile, 'farm', 'SSE');
					if (adjSSEIndex !== -1) {
						const ffNNE = getFeatureMeeples(adjacentTile, adjSSEIndex, 'farm', placedTiles);
						for (let mNNE = 0; mNNE < ffNNE.tilesWithMeeples.length; mNNE++) {
							const mepNNE = ffNNE.tilesWithMeeples[mNNE];
							const pNNE = mepNNE.placedTile.meeples[mepNNE.meepleIndex].playerIndex;
							if (players[pNNE] && players[pNNE].active) {
								currentPlacement.meeples.push({
									meepleType: 'pig',
									locationType: 'farm',
									index: fi
								});
								break;
							}
						}
						farmValid = farmValid && ffNNE.tilesWithMeeples.length === 0;
					}
				}

			} else if (currentPlacement.directionToSource === 'E') {
				if (rotatedFarmDirs.indexOf('ENE') !== -1) {
					const adjWNWIndex = getFeatureIndex(adjacentTile, 'farm', 'WNW');
					if (adjWNWIndex !== -1) {
						const ffENE = getFeatureMeeples(adjacentTile, adjWNWIndex, 'farm', placedTiles);
						for (let mENE = 0; mENE < ffENE.tilesWithMeeples.length; mENE++) {
							const mepENE = ffENE.tilesWithMeeples[mENE];
							const pENE = mepENE.placedTile.meeples[mepENE.meepleIndex].playerIndex;
							if (players[pENE] && players[pENE].active) {
								currentPlacement.meeples.push({
									meepleType: 'pig',
									locationType: 'farm',
									index: fi
								});
								break;
							}
						}
						farmValid = farmValid && ffENE.tilesWithMeeples.length === 0;
					}
				}
				if (rotatedFarmDirs.indexOf('ESE') !== -1) {
					const adjWSWIndex = getFeatureIndex(adjacentTile, 'farm', 'WSW');
					if (adjWSWIndex !== -1) {
						const ffESE = getFeatureMeeples(adjacentTile, adjWSWIndex, 'farm', placedTiles);
						for (let mESE = 0; mESE < ffESE.tilesWithMeeples.length; mESE++) {
							const mepESE = ffESE.tilesWithMeeples[mESE];
							const pESE = mepESE.placedTile.meeples[mepESE.meepleIndex].playerIndex;
							if (players[pESE] && players[pESE].active) {
								currentPlacement.meeples.push({
									meepleType: 'pig',
									locationType: 'farm',
									index: fi
								});
								break;
							}
						}
						farmValid = farmValid && ffESE.tilesWithMeeples.length === 0;
					}
				}

			} else if (currentPlacement.directionToSource === 'S') {
				if (rotatedFarmDirs.indexOf('SSW') !== -1) {
					const adjNNWIndex = getFeatureIndex(adjacentTile, 'farm', 'NNW');
					if (adjNNWIndex !== -1) {
						const ffSSW = getFeatureMeeples(adjacentTile, adjNNWIndex, 'farm', placedTiles);
						for (let mSSW = 0; mSSW < ffSSW.tilesWithMeeples.length; mSSW++) {
							const mepSSW = ffSSW.tilesWithMeeples[mSSW];
							const pSSW = mepSSW.placedTile.meeples[mepSSW.meepleIndex].playerIndex;
							if (players[pSSW] && players[pSSW].active) {
								currentPlacement.meeples.push({
									meepleType: 'pig',
									locationType: 'farm',
									index: fi
								});
								break;
							}
						}
						farmValid = farmValid && ffSSW.tilesWithMeeples.length === 0;
					}
				}
				if (rotatedFarmDirs.indexOf('SSE') !== -1) {
					const adjNNEIndex = getFeatureIndex(adjacentTile, 'farm', 'NNE');
					if (adjNNEIndex !== -1) {
						const ffSSE = getFeatureMeeples(adjacentTile, adjNNEIndex, 'farm', placedTiles);
						for (let mSSE = 0; mSSE < ffSSE.tilesWithMeeples.length; mSSE++) {
							const mepSSE = ffSSE.tilesWithMeeples[mSSE];
							const pSSE = mepSSE.placedTile.meeples[mepSSE.meepleIndex].playerIndex;
							if (players[pSSE] && players[pSSE].active) {
								currentPlacement.meeples.push({
									meepleType: 'pig',
									locationType: 'farm',
									index: fi
								});
								break;
							}
						}
						farmValid = farmValid && ffSSE.tilesWithMeeples.length === 0;
					}
				}

			} else if (currentPlacement.directionToSource === 'W') {
				if (rotatedFarmDirs.indexOf('WNW') !== -1) {
					const adjENEIndex = getFeatureIndex(adjacentTile, 'farm', 'ENE');
					if (adjENEIndex !== -1) {
						const ffWNW = getFeatureMeeples(adjacentTile, adjENEIndex, 'farm', placedTiles);
						for (let mWNW = 0; mWNW < ffWNW.tilesWithMeeples.length; mWNW++) {
							const mepWNW = ffWNW.tilesWithMeeples[mWNW];
							const pWNW = mepWNW.placedTile.meeples[mepWNW.meepleIndex].playerIndex;
							if (players[pWNW] && players[pWNW].active) {
								currentPlacement.meeples.push({
									meepleType: 'pig',
									locationType: 'farm',
									index: fi
								});
								break;
							}
						}
						farmValid = farmValid && ffWNW.tilesWithMeeples.length === 0;
					}
				}
				if (rotatedFarmDirs.indexOf('WSW') !== -1) {
					const adjESEIndex = getFeatureIndex(adjacentTile, 'farm', 'ESE');
					if (adjESEIndex !== -1) {
						const ffWSW = getFeatureMeeples(adjacentTile, adjESEIndex, 'farm', placedTiles);
						for (let mWSW = 0; mWSW < ffWSW.tilesWithMeeples.length; mWSW++) {
							const mepWSW = ffWSW.tilesWithMeeples[mWSW];
							const pWSW = mepWSW.placedTile.meeples[mepWSW.meepleIndex].playerIndex;
							if (players[pWSW] && players[pWSW].active) {
								currentPlacement.meeples.push({
									meepleType: 'pig',
									locationType: 'farm',
									index: fi
								});
								break;
							}
						}
						farmValid = farmValid && ffWSW.tilesWithMeeples.length === 0;
					}
				}
			}

			if (farmValid) {
				currentPlacement.meeples.push({
					meepleType: 'normal',
					locationType: 'farm',
					index: fi
				});
			}
		}

		// ----- 5d. Cloister -----
		if (activeTileData.cloister) {
			currentPlacement.meeples.push({
				meepleType: 'normal',
				locationType: 'cloister',
				index: 0
			});
		}
	}

	// -----------------------------------------------------------------------
	// 6. Deduplicate placements by (x, y) – merge rotations and meeple lists
	// -----------------------------------------------------------------------
	const groupedPlacements = {};
	for (let itemIdx = 0; itemIdx < filteredPlacements.length; itemIdx++) {
		const item = filteredPlacements[itemIdx];
		const key = item.x + ',' + item.y;
		if (groupedPlacements[key]) {
			let matched = false;
			for (let g = 0; g < groupedPlacements[key].rotations.length; g++) {
				const curRot = groupedPlacements[key].rotations[g];
				if (curRot.rotation === item.rotation) {
					matched = true;

					// Non-normal meeples (builder, pig) are additive
					for (let nj = 0; nj < item.meeples.length; nj++) {
						const newM = item.meeples[nj];
						if (newM.meepleType !== 'normal') {
							let dup = false;
							for (let ek = 0; ek < curRot.meeples.length; ek++) {
								const exM = curRot.meeples[ek];
								if (exM.meepleType === newM.meepleType &&
									exM.locationType === newM.locationType &&
									exM.index === newM.index) {
									dup = true;
									break;
								}
							}
							if (!dup) {
								curRot.meeples.push(newM);
							}
						}
					}

					// Normal meeple placements must be valid in ALL entries
					curRot.meeples = curRot.meeples.filter(function (meeple) {
						if (meeple.meepleType === 'normal') {
							for (let nf = 0; nf < item.meeples.length; nf++) {
								if (item.meeples[nf].meepleType === meeple.meepleType &&
									item.meeples[nf].locationType === meeple.locationType &&
									item.meeples[nf].index === meeple.index) {
									return true;
								}
							}
							return false;
						}
						return true;
					});

					break;
				}
			}
			if (!matched) {
				groupedPlacements[key].rotations.push({
					rotation: item.rotation,
					meeples: item.meeples
				});
			}
		} else {
			groupedPlacements[key] = {
				x: item.x,
				y: item.y,
				rotations: [{
					rotation: item.rotation,
					meeples: item.meeples
				}]
			};
		}
	}

	// Convert grouped object to array
	const result = [];
	for (const gkey in groupedPlacements) {
		if (Object.prototype.hasOwnProperty.call(groupedPlacements, gkey)) {
			result.push(groupedPlacements[gkey]);
		}
	}

	return result;
}
