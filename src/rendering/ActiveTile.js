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
  zoomBehavior,
  meeplePlacementMode,
  setMeeplePlacementMode,
  getBoardTransform,
} from './GameBoard.js';

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

/** Build full meeple image path. */
function meepleImagePath(playerIndex, meepleType, location) {
  const suffix = meepleImageSuffix(meepleType, location);
  return `/images/meeples/player_${playerIndex}_${suffix}.png`;
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

  // Position at top-right (in board coordinates, accounting for zoom).
  const transform = getBoardTransform();
  const svgEl = svgElement || (getSvgSelection() ? getSvgSelection().node() : null);
  let cornerX = 0;
  let cornerY = 0;
  if (svgEl) {
    const rect = svgEl.getBoundingClientRect();
    // Transform screen coords to board coords using inverse zoom.
    cornerX = (rect.width - TILE_SIZE - 10) / transform.k - transform.x / transform.k;
    cornerY = 5 / transform.k - transform.y / transform.k;
  }

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
    .attr('href', tileData.imageURL)
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
    .attr('href', '/images/meeples/outline_regular.png')
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

  // Confirm-placement overlay (click the tile to place).
  controls.append('rect')
    .attr('class', 'confirm-overlay')
    .attr('x', -TILE_SIZE / 2)
    .attr('y', -TILE_SIZE / 2)
    .attr('width', TILE_SIZE)
    .attr('height', TILE_SIZE)
    .attr('fill', 'transparent')
    .attr('cursor', 'pointer')
    .on('click', (event) => {
      event.stopPropagation();
      confirmPlacement(playerState);
    });

  // Confirm/send buttons (initially hidden).
  controls.append('rect')
    .attr('class', 'confirm-button')
    .attr('id', 'confirm-button')
    .attr('x', -TILE_SIZE / 2)
    .attr('y', -TILE_SIZE / 2)
    .attr('width', TILE_SIZE)
    .attr('height', TILE_SIZE)
    .attr('fill', 'rgba(0, 200, 0, 0.3)')
    .attr('rx', 5)
    .attr('ry', 5)
    .attr('visibility', 'hidden')
    .attr('opacity', 0)
    .attr('cursor', 'pointer')
    .on('click', (event) => {
      event.stopPropagation();
      confirmPlacement(playerState);
    });

  controls.append('text')
    .attr('class', 'confirm-button-text')
    .attr('x', 0)
    .attr('y', 4)
    .attr('text-anchor', 'middle')
    .attr('font-size', 12)
    .attr('fill', 'white')
    .attr('font-weight', 'bold')
    .attr('visibility', 'hidden')
    .attr('opacity', 0)
    .attr('pointer-events', 'none')
    .text('✓');

  // Scroll-wheel rotation.
  activeTileGroup.on('wheel.active-tile', (event) => {
    event.preventDefault();
    if (event.deltaY > 0) {
      rotateActiveTile(1);
    } else {
      rotateActiveTile(-1);
    }
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

  // Clear any existing meeple selection.
  selectedMove = null;
  groups.meeplePlacementsGroup.selectAll('image.placed-meeple').attr('visibility', 'hidden');
  // Show outlines for the new rotation if there's a selected placement.
  if (selectedMove && selectedMove.placement) {
    updateMeeplePlacementsInternal();
  }

  if (onRotationChangedCallback) {
    onRotationChangedCallback(currentRotation);
  }
}

// ---------------------------------------------------------------------------
// confirmPlacement  (internal)
// ---------------------------------------------------------------------------

function confirmPlacement(playerState) {
  if (!onTilePlacedCallback || !activeTileData) return;

  // The active tile is currently floating.  We need to know where to place it.
  // If selectedMove.placement is set, we already have a (x, y) from clicking
  // a valid-placement highlight; otherwise we use a heuristic or prompt.
  if (selectedMove && selectedMove.placement) {
    onTilePlacedCallback(
      selectedMove.placement.x,
      selectedMove.placement.y,
      currentRotation,
      selectedMove.meeple || null
    );
  } else {
    // No placement selected yet – bring the confirm button to prompt.
    const groups = getActiveTileGroups();
    if (!groups) return;
    const confirmBtn = groups.activeTileRotGroup.select('.confirm-button');
    const confirmText = groups.activeTileRotGroup.select('.confirm-button-text');
    confirmBtn.attr('visibility', null);
    confirmText.attr('visibility', null);
    confirmBtn.transition().duration(300).attr('opacity', 1);
    confirmText.transition().duration(300).attr('opacity', 1);
  }
}

// ---------------------------------------------------------------------------
// collectValidMeeples  (internal)
// ---------------------------------------------------------------------------

/**
 * Collect all possible meeple placements across all rotations from the
 * validPlacements data, deduplicated by (locationType, index).
 */
function collectValidMeeples(tileData, placements) {
  const seen = new Set();
  const result = [];
  if (!tileData) return result;

  const tile = tileData; // bare tile definition

  (placements || []).forEach((placement) => {
    (placement.rotations || []).forEach((rot) => {
      (rot.meeples || []).forEach((m) => {
        const key = `${m.locationType}:${m.index}`;
        if (!seen.has(key)) {
          seen.add(key);
          const offset = resolveMeepleOffset(
            { locationType: m.locationType, index: m.index },
            tile
          );
          result.push({
            locationType: m.locationType,
            index: m.index,
            offset,
            meepleType: m.meepleType,
          });
        }
      });
    });
  });

  return result;
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

  const transform = getBoardTransform();
  const svgEl = svgElement || (getSvgSelection() ? getSvgSelection().node() : null);
  let cornerX = 0;
  let cornerY = 0;
  if (svgEl) {
    const rect = svgEl.getBoundingClientRect();
    cornerX = (rect.width - TILE_SIZE - 10) / transform.k - transform.x / transform.k;
    cornerY = 5 / transform.k - transform.y / transform.k;
  }

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
    groups.activeTileRotGroup.selectAll('#confirm-button, .confirm-button')
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('opacity', 0);
  } else {
    groups.activeTileGroup.attr('visibility', 'hidden');
    groups.activeTileTransGroup
      .attr('transform', `translate(${cornerX + TILE_SIZE / 2},${cornerY + TILE_SIZE / 2})`);
    groups.activeTileRotGroup.attr('transform', 'rotate(0)');
    groups.activeTileRotGroup.selectAll('#confirm-button, .confirm-button')
      .attr('opacity', 0)
      .attr('visibility', 'hidden');
  }

  // Remove scroll-wheel handler.
  groups.activeTileGroup.on('wheel.active-tile', null);

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

function updateMeeplePlacementsInternal(validMeeplesIn) {
  const groups = getActiveTileGroups();
  if (!groups) return;

  const meepleGroup = groups.meeplePlacementsGroup;
  if (!selectedMove) {
    meepleGroup.attr('visibility', 'hidden');
    return;
  }

  // Determine which meeples are valid for this rotation.
  const rotationEntry = selectedMove.placement
    ? (selectedMove.placement.rotations || []).find(
        (r) => r.rotation === currentRotation
      )
    : null;
  const validMeeples = validMeeplesIn || (rotationEntry ? rotationEntry.meeples : []);
  const activeType = currentMeepleType === 'large' ? 'normal' : currentMeepleType;

  // Update outline visibility.
  meepleGroup.selectAll('image.meeple-outline')
    .attr('visibility', (d) => {
      const found = (validMeeples || []).some(
        (m) =>
          (m.meepleType === activeType) &&
          m.locationType === d.locationType &&
          m.index === d.index
      );
      return found ? null : 'hidden';
    });

  // Update placed-meeple visibility and image.
  meepleGroup.selectAll('image.placed-meeple')
    .attr('visibility', (d) => {
      if (
        selectedMove.meeple &&
        selectedMove.meeple.locationType === d.locationType &&
        selectedMove.meeple.index === d.index
      ) {
        return null; // visible
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
  const pIdx = playerState ? playerState.index || 0 : 0;
  const type = currentMeepleType === 'large' ? 'normal' : currentMeepleType;
  const size = meepleSize(type);
  const path = meepleImagePath(pIdx, type, data.locationType);

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
    .attr('visibility', null);
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
