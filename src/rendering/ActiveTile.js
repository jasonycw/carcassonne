/**
 * ActiveTile.js — Floating active tile and meeple-placement UI for Carcassonne.
 *
 * The active tile is the tile a player has drawn and is currently placing on
 * the board.  This module handles:
 *   - Rendering the floating tile image (with rotation)
 *   - Providing rotation controls (scroll-wheel / click)
 *   - Showing valid-meeple-placement outlines on the tile
 *   - Confirming a tile placement and meeple placement
 *
 * It depends on GameBoard.js for the SVG groups (activeTileGroup,
 * activeTileTransGroup, activeTileRotGroup, meeplePlacementsGroup) and the
 * zoom / svg references.
 */

import {
  getActiveTileGroups,
  getSvgSelection,
  getBoardMetrics,
  meeplePlacementMode,
  setMeeplePlacementMode,
} from './GameBoard.js';
import * as d3 from 'd3';
import { img } from '../utils/AssetPaths.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 100;
const TRANSITION_DURATION = 750;
const MEEMPLE_NORMAL_SIZE = TILE_SIZE / 4;
const MEEMPLE_SPECIAL_SIZE = TILE_SIZE * 3 / 8;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let activeTileData = null;          // reference to the current tile's definition
let validPlacements = [];           // valid (x, y, rotations) array
let currentRotation = 0;            // 0-3
let selectedMove = null;            // { placement, rotationIndex, meeple, ... }
let currentMeepleType = 'normal';

// Zoom tracking: when tile is "pinned" to a board position we update its
// screen position on every zoom/pan so it stays aligned with the board.
let _isPinned = false;
let _pinnedGridX = 0;
let _pinnedGridY = 0;

let onTilePlacedCallback = null;
let onMeeplePlacedCallback = null;
let onRotationChangedCallback = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map meeple type to image suffix (same logic as GameBoard's internal fn). */
function meepleImageSuffix(meepleType, location) {
  if (meepleType === 'pig' || meepleType === 'builder' || meepleType === 'tower') {
    return meepleType;
  }
  return location === 'farm' ? 'lying' : 'standing';
}

/** Map CSS colour names used in the sprite filenames. */
const COLOR_NAME_MAP = {
  '#e74c3c': 'red',
  '#3498db': 'blue',
  '#2ecc71': 'green',
  '#f39c12': 'yellow',
  '#9b59b6': 'purple',
  '#1abc9c': 'gray',
};

function resolveColorName(hexOrName) {
  return COLOR_NAME_MAP[hexOrName] || hexOrName || 'blue';
}

/** Build full meeple image path. */
function meepleImagePath(colorIdent, meepleType, location) {
  const suffix = meepleImageSuffix(meepleType, location);
  const colorName = typeof colorIdent === 'number'
    ? resolveColorName('#3498db') // fallback for numeric indices
    : resolveColorName(colorIdent);
  return img(`/images/meeples/${colorName}_${suffix}.png`);
}

/** Resolve meeple offset from tile feature data. */
function resolveMeepleOffset(placement, tile) {
  if (placement.locationType === 'cloister') {
    return { x: 0.5, y: 0.5 };
  }
  const key = placement.locationType === 'city' ? 'cities' : placement.locationType + 's';
  const features = tile[key];
  if (features && features[placement.index] && features[placement.index].meepleOffset) {
    return features[placement.index].meepleOffset;
  }
  return { x: 0.5, y: 0.5 };
}

/** Compute meeple render size based on type. */
function meepleSize(type) {
  return type !== 'normal' ? MEEMPLE_SPECIAL_SIZE : MEEMPLE_NORMAL_SIZE;
}

// ---------------------------------------------------------------------------
// renderActiveTile
// ---------------------------------------------------------------------------

/**
 * Render the floating active tile at the top-right corner of the game area.
 * Attaches rotation controls (scroll-wheel, click to confirm placement).
 *
 * @param {object}   tileData        Tile definition from TileData.js
 * @param {Array}    validPlacements Valid (x, y, rotations) array
 * @param {object}   playerState     Current player state (for meeple info)
 * @param {SVGSVGElement} svgElement The SVG element (for coordinate mapping)
 */
export function renderActiveTile(tileData, placements, playerState, svgElement) {
  activeTileData = tileData;
  validPlacements = placements || [];
  selectedMove = null;

  const groups = getActiveTileGroups();
  if (!groups || !groups.activeTileGroup) return;

  const {
    activeTileGroup,
    activeTileTransGroup,
    activeTileRotGroup,
    meeplePlacementsGroup,
  } = groups;

  // Show the active tile group.
  activeTileGroup.attr('visibility', null);

  // Position at top-right of the viewport (outside zoom group — simple px coords).
  const svgEl = svgElement || (getSvgSelection() ? getSvgSelection().node() : null);
  const cornerX = svgEl ? svgEl.getBoundingClientRect().width - TILE_SIZE - 10 : 800 - TILE_SIZE - 10;
  const cornerY = 5;

  activeTileTransGroup
    .attr('transform', `translate(${cornerX + TILE_SIZE / 2},${cornerY + TILE_SIZE / 2})`);

  // Rotation group starts at 0.
  currentRotation = 0;
  activeTileRotGroup.attr('transform', 'rotate(0)');

  // Clear and rebuild the active tile contents.
  activeTileRotGroup.selectAll('image.active-tile-image').remove();
  activeTileRotGroup.selectAll('g.active-tile-controls').remove();

  // Tile image.
  activeTileRotGroup.append('image')
    .attr('class', 'active-tile-image')
    .attr('x', -TILE_SIZE / 2)
    .attr('y', -TILE_SIZE / 2)
    .attr('width', TILE_SIZE)
    .attr('height', TILE_SIZE)
    .attr('href', img(tileData.imageURL))
    .attr('opacity', 0.85);

  // Rotation indicator (hidden by default, shown when rotation changes).
  const rotIndicator = activeTileRotGroup.select('.active-tile-rotation-indicator');
  if (!rotIndicator.empty()) {
    rotIndicator.attr('visibility', null).attr('opacity', 0);
  }

  // ── Meeple placements group ──────────────────────────────────────────
  // Hide until a valid placement is selected.
  meeplePlacementsGroup
    .attr('visibility', 'hidden')
    .selectAll('*').remove();

  // Create meeple-outline images for each valid meeple position on the
  // tile.  These are initially hidden; updateMeeplePlacements() shows them.
  const allValidMeeples = collectValidMeeples(tileData, placements);
  meeplePlacementsGroup.selectAll('image.meeple-outline')
    .data(allValidMeeples)
    .enter()
    .append('image')
    .attr('class', 'meeple-outline')
    .attr('width', MEEMPLE_NORMAL_SIZE)
    .attr('height', MEEMPLE_NORMAL_SIZE)
    .attr('x', (d) => d.offset.x * TILE_SIZE - TILE_SIZE / 2 - MEEMPLE_NORMAL_SIZE / 2)
    .attr('y', (d) => d.offset.y * TILE_SIZE - TILE_SIZE / 2 - MEEMPLE_NORMAL_SIZE / 2)
    .attr('href', (d) => {
      const suffix = d.locationType === 'farm' ? 'lying' : 'standing';
      return img(`/images/meeples/outline_${suffix}.png`);
    })
    .attr('visibility', 'hidden')
    .attr('cursor', 'pointer')
    .on('click', function (event, d) {
      event.stopPropagation();
      // Confirm meeple placement.
      if (!selectedMove) {
        selectedMove = { placement: null, rotationIndex: null, meeple: null };
      }
      selectedMove.meeple = {
        locationType: d.locationType,
        index: d.index,
        meepleType: currentMeepleType === 'large' ? 'normal' : currentMeepleType,
      };
      // Hide the outline, show a placed meeple.
      d3.select(this).attr('visibility', 'hidden');
      updatePlacedMeeple(d, playerState);
      if (onMeeplePlacedCallback) {
        onMeeplePlacedCallback(selectedMove.meeple);
      }
    });

  // Placed-meeple group (initially empty).
  meeplePlacementsGroup.selectAll('image.placed-meeple').remove();

  // ── Controls group ───────────────────────────────────────────────────
  // Provide left/right rotation buttons via clickable overlays.
  const controls = activeTileRotGroup.append('g')
    .attr('class', 'active-tile-controls');

  // Left rotation button.
  controls.append('rect')
    .attr('class', 'rot-left')
    .attr('x', -TILE_SIZE / 2 - 8)
    .attr('y', -TILE_SIZE / 2)
    .attr('width', 8)
    .attr('height', TILE_SIZE)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('click', (event) => {
      event.stopPropagation();
      rotateActiveTile(-1);
    });

  // Right rotation button.
  controls.append('rect')
    .attr('class', 'rot-right')
    .attr('x', TILE_SIZE / 2)
    .attr('y', -TILE_SIZE / 2)
    .attr('width', 8)
    .attr('height', TILE_SIZE)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('click', (event) => {
      event.stopPropagation();
      rotateActiveTile(1);
    });

}

// ---------------------------------------------------------------------------
// rotateActiveTile  (internal)
// ---------------------------------------------------------------------------

function rotateActiveTile(direction) {
  const groups = getActiveTileGroups();
  if (!groups) return;

  currentRotation = (currentRotation + direction + 4) % 4;
  groups.activeTileRotGroup
    .transition()
    .duration(200)
    .attr('transform', `rotate(${currentRotation * 90})`);

  // Flash the rotation indicator.
  const indicator = groups.activeTileRotGroup.select('.active-tile-rotation-indicator');
  if (!indicator.empty()) {
    indicator.attr('opacity', 1)
      .transition()
      .duration(800)
      .attr('opacity', 0);
  }

  // Clear meeple placement but keep the selected placement.
  if (selectedMove) {
    selectedMove.meeple = null;
  }
  groups.meeplePlacementsGroup.selectAll('image.placed-meeple').attr('visibility', 'hidden');
  // Show outlines for the new rotation.
  if (selectedMove && selectedMove.placement) {
    updateMeeplePlacementsInternal();
  }

  if (onRotationChangedCallback) {
    onRotationChangedCallback(currentRotation);
  }
}

// ---------------------------------------------------------------------------
// collectValidMeeples  (internal)
// ---------------------------------------------------------------------------

/**
 * Collect all possible meeple positions from the tile data itself
 * (roads, cities, farms, cloister), matching the original game behavior.
 * All outlines are shown regardless of rotation — server validates.
 */
function collectValidMeeples(tileData, placements) {
  const result = [];
  if (!tileData) return result;

  // Roads
  (tileData.roads || []).forEach((road, idx) => {
    result.push({
      locationType: 'road',
      index: idx,
      offset: road.meepleOffset || { x: 0.5, y: 0.5 },
      meepleType: 'normal',
    });
  });

  // Cities
  (tileData.cities || []).forEach((city, idx) => {
    result.push({
      locationType: 'city',
      index: idx,
      offset: city.meepleOffset || { x: 0.5, y: 0.5 },
      meepleType: 'normal',
    });
  });

  // Farms
  (tileData.farms || []).forEach((farm, idx) => {
    result.push({
      locationType: 'farm',
      index: idx,
      offset: farm.meepleOffset || { x: 0.5, y: 0.5 },
      meepleType: 'normal',
    });
  });

  // Cloister
  if (tileData.cloister) {
    result.push({
      locationType: 'cloister',
      index: 0,
      offset: tileData.cloister.meepleOffset || { x: 0.5, y: 0.5 },
      meepleType: 'normal',
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// moveToBoardPosition
// ---------------------------------------------------------------------------

/**
 * Animate the active tile from the corner to a board grid position.
 * Calculates screen-space coordinates from grid coords using the current
 * D3 zoom transform.
 *
 * @param {number} gridX   Tile grid X coordinate
 * @param {number} gridY   Tile grid Y coordinate
 * @param {number} rotation  Target rotation (0-3)
 * @returns {Promise<void>} Resolves when the animation finishes.
 */
export function moveToBoardPosition(gridX, gridY, rotation) {
  const groups = getActiveTileGroups();
  if (!groups) return Promise.resolve();

  const metrics = getBoardMetrics();
  const boardX = metrics.svgWidth / 2 + gridX * TILE_SIZE;
  const boardY = metrics.svgHeight / 2 + gridY * TILE_SIZE;
  const t = metrics.transform;
  const screenX = t.applyX(boardX);
  const screenY = t.applyY(boardY);

  // Save pinned state for zoom tracking.
  _isPinned = true;
  _pinnedGridX = gridX;
  _pinnedGridY = gridY;

  // Ensure the tile group is visible.
  groups.activeTileGroup.attr('visibility', null);

  return new Promise((resolve) => {
    groups.activeTileTransGroup
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('transform', `translate(${screenX + TILE_SIZE / 2},${screenY + TILE_SIZE / 2})`)
      .on('end', resolve);
  });
}

// ---------------------------------------------------------------------------
// updateBoardPosition
// ---------------------------------------------------------------------------

/**
 * Recalculate the active tile's screen position from its pinned board grid
 * coordinates.  Called on every zoom/pan event so the tile stays aligned
 * with the board even though it lives outside the zoom group.
 */
export function updateBoardPosition() {
  if (!_isPinned) return;
  const groups = getActiveTileGroups();
  if (!groups) return;

  const metrics = getBoardMetrics();
  const boardX = metrics.svgWidth / 2 + _pinnedGridX * TILE_SIZE;
  const boardY = metrics.svgHeight / 2 + _pinnedGridY * TILE_SIZE;
  const t = metrics.transform;
  const screenX = t.applyX(boardX);
  const screenY = t.applyY(boardY);

  groups.activeTileTransGroup
    .attr('transform', `translate(${screenX + TILE_SIZE / 2},${screenY + TILE_SIZE / 2})`);
}

// ---------------------------------------------------------------------------
// resetActiveTile
// ---------------------------------------------------------------------------

/**
 * Remove the active tile from the board and clear meeple placement UI.
 *
 * @param {SVGSVGElement} svgElement Ignored; the SVG reference is obtained
 *   internally via the shared module state.
 * @param {boolean}       animated   Whether to animate the removal.
 */
export function resetActiveTile(svgElement, animated = false) {
  const groups = getActiveTileGroups();
  if (!groups) return;

  _isPinned = false;

  // Use getBoardMetrics for dimensions instead of DOM queries.
  const metrics = getBoardMetrics();
  const cornerX = metrics.svgWidth - TILE_SIZE - 10;
  const cornerY = 5;

  // Hide meeple placements.
  groups.meeplePlacementsGroup
    .attr('visibility', 'hidden')
    .selectAll('image').attr('visibility', 'hidden');

  if (animated) {
    // Animate back to corner, then hide.
    groups.activeTileTransGroup
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('transform', `translate(${cornerX + TILE_SIZE / 2},${cornerY + TILE_SIZE / 2})`)
      .on('end', () => {
        groups.activeTileGroup.attr('visibility', 'hidden');
        groups.activeTileRotGroup.attr('transform', 'rotate(0)');
      });
    groups.activeTileRotGroup.select('.active-tile-rotation-indicator')
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('opacity', 0);
  } else {
    groups.activeTileGroup.attr('visibility', 'hidden');
    groups.activeTileTransGroup
      .attr('transform', `translate(${cornerX + TILE_SIZE / 2},${cornerY + TILE_SIZE / 2})`);
    groups.activeTileRotGroup.attr('transform', 'rotate(0)');
  }

  selectedMove = null;
  activeTileData = null;
  validPlacements = [];

  // Restore normal meeple mode.
  setMeeplePlacementMode('normal');
}

// ---------------------------------------------------------------------------
// updateMeeplePlacements
// ---------------------------------------------------------------------------

/**
 * Show/hide meeple outlines and placed-meeple images based on the currently
 * selected placement and the active meeple type / mode.
 *
 * @param {Array}  validMeeplesIn  Array of { locationType, index, meepleType }
 *   for the selected tile placement + rotation.  If omitted, derives from the
 *   internal selectedMove.
 * @param {string} meepleTypeIn    Current meeple type ('normal', 'large',
 *   'builder', 'pig').  If omitted, uses the module-level currentMeepleType.
 * @param {SVGSVGElement} svgElement Ignored.
 */
export function updateMeeplePlacements(validMeeplesIn, meepleTypeIn, svgElement) {
  if (meepleTypeIn !== undefined) {
    currentMeepleType = meepleTypeIn;
  }
  updateMeeplePlacementsInternal(validMeeplesIn);
}

function updateMeeplePlacementsInternal() {
  const groups = getActiveTileGroups();
  if (!groups) return;

  const meepleGroup = groups.meeplePlacementsGroup;

  // If no placement is selected, keep meeple group hidden.
  if (!selectedMove || !selectedMove.placement) {
    meepleGroup.attr('visibility', 'hidden');
    return;
  }

  // Show ALL meeple outlines (matching original game — don't filter by rotation).
  meepleGroup.selectAll('image.meeple-outline')
    .attr('visibility', null);

  // Update placed-meeple visibility.
  meepleGroup.selectAll('image.placed-meeple')
    .attr('visibility', (d) => {
      if (
        selectedMove.meeple &&
        selectedMove.meeple.locationType === d.locationType &&
        selectedMove.meeple.index === d.index
      ) {
        return null;
      }
      return 'hidden';
    });

  // Show the meeple group.
  meepleGroup.attr('visibility', null);
}

// ---------------------------------------------------------------------------
// updatePlacedMeeple  (internal)
// ---------------------------------------------------------------------------

/** Render a "placed" meeple image on the active tile (before confirm). */
function updatePlacedMeeple(data, playerState) {
  const groups = getActiveTileGroups();
  if (!groups) return;

  const meepleGroup = groups.meeplePlacementsGroup;
  const colorIdent = playerState ? playerState.color || 'blue' : 'blue';
  const type = currentMeepleType === 'large' ? 'normal' : currentMeepleType;
  const size = meepleSize(type);
  const path = meepleImagePath(colorIdent, type, data.locationType);

  // Remove any existing placed meeple for this location.
  meepleGroup.selectAll('image.placed-meeple')
    .filter((d) => d.locationType === data.locationType && d.index === data.index)
    .remove();

  meepleGroup.append('image')
    .attr('class', 'placed-meeple')
    .attr('width', size)
    .attr('height', size)
    .attr('x', data.offset.x * TILE_SIZE - TILE_SIZE / 2 - size / 2)
    .attr('y', data.offset.y * TILE_SIZE - TILE_SIZE / 2 - size / 2)
    .attr('href', path)
    .attr('visibility', null)
    .attr('pointer-events', 'none');
}



// ---------------------------------------------------------------------------
// Accessors / setters
// ---------------------------------------------------------------------------

/** Get the current selected move data (placement, meeple, etc.). */
export function getSelectedMove() {
  return selectedMove;
}

/** Set the selected move from an external source (e.g. valid-placement click). */
export function setSelectedPlacement(placement) {
  if (!selectedMove) {
    selectedMove = { placement: null, rotationIndex: null, meeple: null };
  }
  selectedMove.placement = placement;
  // Find the rotation index that matches currentRotation.
  if (placement && placement.rotations) {
    const idx = placement.rotations.findIndex((r) => r.rotation === currentRotation);
    selectedMove.rotationIndex = idx >= 0 ? idx : 0;
  }
  updateMeeplePlacementsInternal();
}

/** Get the current rotation. */
export function getCurrentRotation() {
  return currentRotation;
}

/** Force-set rotation (e.g. when restoring game state). */
export function setCurrentRotation(rotation) {
  currentRotation = rotation % 4;
  const groups = getActiveTileGroups();
  if (groups) {
    groups.activeTileRotGroup.attr('transform', `rotate(${currentRotation * 90})`);
  }
}

// ---------------------------------------------------------------------------
// Callback registration
// ---------------------------------------------------------------------------

/**
 * Register callback invoked when the tile placement is confirmed.
 * Receives (x, y, rotation, meepleOrNull).
 */
export function onTilePlaced(callback) {
  onTilePlacedCallback = callback;
}

/**
 * Register callback invoked when a meeple placement is chosen.
 * Receives ({ locationType, index, meepleType }).
 */
export function onMeeplePlaced(callback) {
  onMeeplePlacedCallback = callback;
}

/**
 * Register callback invoked when the tile rotation changes.
 * Receives (rotation: 0-3).
 */
export function onRotationChanged(callback) {
  onRotationChangedCallback = callback;
}
