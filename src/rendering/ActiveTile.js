/**
 * ActiveTile.js — Floating active tile and meeple-placement UI for Carcassonne.
 *
 * Matches the original game.ejs behavior:
 *   - Floating tile starts in the corner with no rotation indicator
 *   - Clicking a valid board placement moves the tile there + shows rotation
 *     indicator (only if >1 valid rotation), shows Confirm button
 *   - Clicking Confirm hides rotation indicator, shows meeple outlines
 *   - Clicking a meeple outline places a meeple, shows Send Move button
 *   - Rotation indicator shows as a semi-transparent icon overlay
 *
 * @module ActiveTile
 */

import {
  getActiveTileGroups,
  getSvgSelection,
  getBoardMetrics,
  meeplePlacementMode as sharedMeepleMode,
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

// Track if a transition is in progress so we can cancel on zoom
let _transitioning = false;
// Resolve function for the pending moveToBoardPosition animation promise,
// so updateBoardPosition can resolve it when interrupting the transition.
let _pendingAnimationResolve = null;

let onTilePlacedCallback = null;
let onMeeplePlacedCallback = null;
let onRotationChangedCallback = null;

// Original game stores the valid meeple placements for the current rotation
let _validMeepleForRotation = [];

// Player state snapshot for meeple availability checks
let _playerState = null;

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
  return type === 'large' ? MEEMPLE_SPECIAL_SIZE : MEEMPLE_NORMAL_SIZE;
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
  _playerState = playerState;

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

  // Tile image — click to cycle rotation (matching original game.ejs behavior).
  activeTileRotGroup.append('image')
    .attr('class', 'active-tile-image')
    .attr('x', -TILE_SIZE / 2)
    .attr('y', -TILE_SIZE / 2)
    .attr('width', TILE_SIZE)
    .attr('height', TILE_SIZE)
    .attr('href', img(tileData.imageURL))
    .attr('opacity', 0.85)
    .attr('cursor', 'pointer')
    .style('pointer-events', 'all')
    .on('click', (event) => {
      event.stopPropagation();
      // Only rotate if a board placement is selected (pinned).
      if (!selectedMove || !selectedMove.placement) return;
      const placement = selectedMove.placement;
      const validRots = placement.rotations || [];
      if (validRots.length === 0) return;

      // Find the index of the current rotation in the valid rotations list.
      const currentIdx = validRots.findIndex((r) => r.rotation === currentRotation);
      const nextIdx = (currentIdx + 1) % validRots.length;
      const newRotation = validRots[nextIdx].rotation;

      // Update internal state.
      currentRotation = newRotation;
      selectedMove.rotationIndex = nextIdx;

      // Clear any previously placed meeple (rotation invalidates meeple positions).
      selectedMove.meeple = null;
      groups.meeplePlacementsGroup.selectAll('image.placed-meeple').remove();
      // Re-show all outlines that may have been hidden when a meeple was placed.
      groups.meeplePlacementsGroup.selectAll('image.meeple-outline').attr('visibility', null);

      // Update rotation transform.
      const metrics = getBoardMetrics();
      const scale = _isPinned ? metrics.transform.k : 1;
      groups.activeTileRotGroup
        .transition()
        .duration(200)
        .attr('transform', `rotate(${currentRotation * 90}) scale(${scale})`);

      // Rotation indicator visibility is managed by _updateRotationIndicator()
      // (persistent show/hide based on rotation count). Refresh state.
      _updateRotationIndicator();

      // Re-filter outlines for the new rotation.
      _applyOutlineFilter(groups.meeplePlacementsGroup);

      if (onRotationChangedCallback) {
        onRotationChangedCallback(currentRotation);
      }
    });

  // ── Meeple placements group ──────────────────────────────────────────
  // Ensure meeple placements render ON TOP of the tile image by
  // re-appending the container to the end of activeTileRotGroup.
  activeTileRotGroup.node().appendChild(meeplePlacementsGroup.node());

  // Clear meeplePlacementsGroup content.
  // Use display: none (not visibility: hidden) so SVG elements are completely
  // removed from the rendering tree and cannot intercept pointer events
  // on the tile image or board below (Bug 3).
  meeplePlacementsGroup
    .attr('display', 'none')
    .style('pointer-events', 'none')
    .selectAll('*').remove();

  // Create meeple-outline images for each valid meeple position on the
  // tile — matching original game behavior (all possible positions).
  // Outlines are initially hidden; they show only after Place Tile is confirmed.
  const allValidMeeples = collectValidMeeples(tileData, placements);
  // Store valid meeple data as a module-level var so outline click can access
  _validMeepleForRotation = [];

  meeplePlacementsGroup.selectAll('g.outline-group')
    .data(allValidMeeples)
    .enter()
    .append('g')
    .attr('class', 'outline-group')
    .style('pointer-events', 'none')
    .attr('transform', (d) =>
      `translate(${(d.offset.x - 0.5) * TILE_SIZE},${(d.offset.y - 0.5) * TILE_SIZE})`
    )
    .each(function (d) {
      const g = d3.select(this);
      // Outline image — use current meeple type size
      // Bug 17/18: Use meeple-type-specific outline (builder, pig) instead of generic standing/lying
      const outlineSize = meepleSize(currentMeepleType);
      g.append('image')
        .attr('class', 'meeple-outline')
        .attr('width', outlineSize)
        .attr('height', outlineSize)
        .attr('x', -outlineSize / 2)
        .attr('y', -outlineSize / 2)
        .attr('href', () => {
          const mt = currentMeepleType;
          if (mt === 'builder') return img('/images/meeples/outline_builder.png');
          if (mt === 'pig') return img('/images/meeples/outline_pig.png');
          const suffix = d.locationType === 'farm' ? 'lying' : 'standing';
          return img(`/images/meeples/outline_${suffix}.png`);
        })
        .attr('visibility', 'hidden')
        .attr('cursor', 'pointer')
        .style('pointer-events', 'none');
      // Placed meeple image (hidden until placed)
      // Bug 16: Size dynamically based on currentMeepleType so large meeples show larger
      const placedSize = meepleSize(currentMeepleType);
      g.append('image')
        .attr('class', 'placed-meeple')
        .attr('width', placedSize)
        .attr('height', placedSize)
        .attr('x', -placedSize / 2)
        .attr('y', -placedSize / 2)
        .attr('visibility', 'hidden')
        .style('pointer-events', 'none');
    });

  // Attach click handler to the outline-group (matches original: click outline
  // to place, click placed meeple to remove)
  meeplePlacementsGroup.selectAll('g.outline-group')
    .on('click', function (event, d) {
      event.stopPropagation();

      // Validate: check if this location is valid for the current rotation
      if (!selectedMove || !selectedMove.placement) return;
      const rotationEntry = selectedMove.placement.rotations[selectedMove.rotationIndex];
      const validMeeples = rotationEntry ? rotationEntry.meeples : [];
      const mType = currentMeepleType === 'large' ? 'normal' : currentMeepleType;
      const isValid = validMeeples.some(
        (m) => m.meepleType === mType && m.locationType === d.locationType && m.index === d.index
      );
      if (!isValid) return;

      const group = d3.select(this);
      const placedMeepleEl = group.select('image.placed-meeple');
      const outlineEl = group.select('image.meeple-outline');
      const isAlreadyPlaced = placedMeepleEl.attr('visibility') !== 'hidden';

      if (isAlreadyPlaced) {
        // Toggle off — remove meeple
        placedMeepleEl.attr('visibility', 'hidden');
        outlineEl.attr('visibility', null);
        if (selectedMove) selectedMove.meeple = null;
      } else {
        // Hide ALL placed meeples first (only one at a time)
        meeplePlacementsGroup.selectAll('g.outline-group image.placed-meeple')
          .attr('visibility', 'hidden');
        // Bug 4: Re-apply the valid-position filter BEFORE showing outlines
        // so only valid positions become visible (not ALL outlines).
        meeplePlacementsGroup.selectAll('g.outline-group image.meeple-outline')
          .attr('visibility', null);
        _applyOutlineFilter(meeplePlacementsGroup);

        // Place this meeple
        const colorIdent = playerState ? (playerState.color || 'blue') : 'blue';
        // Bug 17/18: Use meeple-type-specific suffix for builder/pig instead of location-based
        const placedSuffix = meepleImageSuffix(currentMeepleType, d.locationType);
        // Bug 16: Ensure placed meeple uses correct size for current meeple type
        const placedSize = meepleSize(currentMeepleType);
        placedMeepleEl
          .attr('width', placedSize)
          .attr('height', placedSize)
          .attr('x', -placedSize / 2)
          .attr('y', -placedSize / 2)
          .attr('href', img(`/images/meeples/${colorIdent}_${placedSuffix}.png`))
          .attr('visibility', null);
        outlineEl.attr('visibility', 'hidden');

        selectedMove.meeple = {
          locationType: d.locationType,
          index: d.index,
          meepleType: currentMeepleType,
        };
      }
      // Remove any tower selection if present
      delete selectedMove.tower;

      if (onMeeplePlacedCallback) {
        onMeeplePlacedCallback(selectedMove.meeple);
      }
    });
}

// ---------------------------------------------------------------------------
// rotateActiveTile  (internal)
// ---------------------------------------------------------------------------

function rotateActiveTile(direction) {
  const groups = getActiveTileGroups();
  if (!groups) return;

  // Get valid rotations from the selected placement.
  const placement = selectedMove ? selectedMove.placement : null;
  let validRots = null;
  if (placement && placement.rotations && placement.rotations.length > 0) {
    validRots = placement.rotations.map((r) => r.rotation);
  }

  if (validRots && validRots.length > 0) {
    // Cycle through valid rotations only.
    const currentIdx = validRots.indexOf(currentRotation);
    const nextIdx = (currentIdx + direction + validRots.length) % validRots.length;
    currentRotation = validRots[nextIdx];
    if (selectedMove) {
      selectedMove.rotationIndex = nextIdx;
    }
  } else {
    // Fallback: cycle through all 4 rotations.
    currentRotation = (currentRotation + direction + 4) % 4;
  }

  // Update rotation transform, preserving zoom scale when pinned.
  const metrics = getBoardMetrics();
  const scale = _isPinned ? metrics.transform.k : 1;
  groups.activeTileRotGroup
    .transition()
    .duration(200)
    .attr('transform', `rotate(${currentRotation * 90}) scale(${scale})`);

  // Rotation indicator visibility is managed by _updateRotationIndicator()
  // (persistent show/hide based on rotation count). Refresh state.
  _updateRotationIndicator();

  // Clear meeple placement but keep the selected placement.
  if (selectedMove) {
    selectedMove.meeple = null;
  }
  groups.meeplePlacementsGroup.selectAll('image.placed-meeple').attr('visibility', 'hidden');
  // Re-show all outlines that may have been hidden when a meeple was placed
  // (rotation may change which features are accessible).
  groups.meeplePlacementsGroup.selectAll('image.meeple-outline').attr('visibility', null);
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

  // Sync the module-level rotation variable so setSelectedPlacement and
  // the on('end') callback see the correct value.  Do NOT call
  // setCurrentRotation() before this — let the transition animate it.
  currentRotation = rotation % 4;

  const metrics = getBoardMetrics();
  // Use the TILE CENTER coordinate, not the corner, to correctly account
  // for the zoom transform.  The active tile rotation group's (0,0) is the
  // tile center, so we transform the center point to screen-space.
  const centerX = metrics.svgWidth / 2 + gridX * TILE_SIZE + TILE_SIZE / 2;
  const centerY = metrics.svgHeight / 2 + gridY * TILE_SIZE + TILE_SIZE / 2;
  const t = metrics.transform;
  const screenCenterX = t.applyX(centerX);
  const screenCenterY = t.applyY(centerY);

  // Save pinned state for zoom tracking.
  _isPinned = true;
  _pinnedGridX = gridX;
  _pinnedGridY = gridY;

  // Ensure the tile group is visible.
  groups.activeTileGroup.attr('visibility', null);

  // Scale the active tile to match the board zoom level.
  const scale = t.k;

  // Mark that a transition is in progress so updateBoardPosition can cancel it
  // on zoom/pan during the animation.
  _transitioning = true;

  _pendingAnimationResolve = null;
  return new Promise((resolve) => {
    _pendingAnimationResolve = resolve;
    groups.activeTileTransGroup
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('transform', `translate(${screenCenterX},${screenCenterY})`);

    groups.activeTileRotGroup
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('transform', `rotate(${rotation * 90}) scale(${scale})`)
      .on('end', () => {
        _transitioning = false;
        _pendingAnimationResolve = null;
        resolve();
      });

    // Safety timeout: if the transition is interrupted (e.g., zoom/pan),
    // ensure the promise still resolves so callers don't hang forever.
    setTimeout(() => {
      if (_pendingAnimationResolve) {
        _pendingAnimationResolve();
        _pendingAnimationResolve = null;
        _transitioning = false;
      }
    }, TRANSITION_DURATION * 3);
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
  // Use tile CENTER coordinate to correctly account for zoom transform
  const centerX = metrics.svgWidth / 2 + _pinnedGridX * TILE_SIZE + TILE_SIZE / 2;
  const centerY = metrics.svgHeight / 2 + _pinnedGridY * TILE_SIZE + TILE_SIZE / 2;
  const t = metrics.transform;
  const screenCenterX = t.applyX(centerX);
  const screenCenterY = t.applyY(centerY);

  // If a D3 transition is in progress, interrupt it and immediately snap
  // the tile to the correct position so it tracks the board in real time
  // without lagging behind during rapid zoom/pan gestures.
  if (_transitioning) {
    groups.activeTileTransGroup.interrupt();
    groups.activeTileRotGroup.interrupt();
    groups.activeTileTransGroup
      .attr('transform', `translate(${screenCenterX},${screenCenterY})`);
    groups.activeTileRotGroup
      .attr('transform', `rotate(${currentRotation * 90}) scale(${t.k})`);
    // Resolve the pending animation promise so it doesn't hang.
    if (_pendingAnimationResolve) {
      _pendingAnimationResolve();
      _pendingAnimationResolve = null;
    }
    return;
  }

  groups.activeTileTransGroup
    .attr('transform', `translate(${screenCenterX},${screenCenterY})`);

  // Update scale to match current zoom level.
  groups.activeTileRotGroup
    .attr('transform', `rotate(${currentRotation * 90}) scale(${t.k})`);
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
  _transitioning = false;

  // Use getBoardMetrics for dimensions instead of DOM queries.
  const metrics = getBoardMetrics();
  const cornerX = metrics.svgWidth - TILE_SIZE - 10;
  const cornerY = 5;

  // Hide meeple placements and prevent click interception.
  groups.meeplePlacementsGroup
    .attr('display', 'none')
    .attr('visibility', 'hidden')
    .style('pointer-events', 'none')
    .selectAll('image').attr('visibility', 'hidden');

  if (animated) {
    // Animate back to corner, then hide.
    groups.activeTileTransGroup
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('transform', `translate(${cornerX + TILE_SIZE / 2},${cornerY + TILE_SIZE / 2})`);

    groups.activeTileRotGroup
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('transform', 'rotate(0) scale(1)')
      .on('end', () => {
        groups.activeTileGroup.attr('visibility', 'hidden');
        groups.activeTileRotGroup.attr('transform', 'rotate(0)');
      });

    groups.activeTileRotGroup.select('.active-tile-rotation-indicator')
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('opacity', 0);
    groups.activeTileRotGroup.select('.active-tile-rotation-indicator-bg')
      .transition()
      .duration(TRANSITION_DURATION)
      .attr('opacity', 0);
  } else {
    groups.activeTileGroup.attr('visibility', 'hidden');
    groups.activeTileTransGroup
      .attr('transform', `translate(${cornerX + TILE_SIZE / 2},${cornerY + TILE_SIZE / 2})`);
    groups.activeTileRotGroup.attr('transform', 'rotate(0) scale(1)');
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

  // Bug 4/7: Update outline sizes AND href to match the current meeple type.
  const groups = getActiveTileGroups();
  if (groups) {
    const size = meepleSize(currentMeepleType);
    const mt = currentMeepleType;
    groups.meeplePlacementsGroup.selectAll('image.meeple-outline')
      .attr('width', size)
      .attr('height', size)
      .attr('href', (d) => {
        if (mt === 'builder') return img('/images/meeples/outline_builder.png');
        if (mt === 'pig') return img('/images/meeples/outline_pig.png');
        const suffix = d.locationType === 'farm' ? 'lying' : 'standing';
        return img(`/images/meeples/outline_${suffix}.png`);
      });

    // Bug 4: Re-filter outline visibility based on the new meeple type.
    // (Harmless when the group is still hidden pre-confirm; group visibility
    //  takes precedence over individual visibility in SVG.)
    _applyOutlineFilter(groups.meeplePlacementsGroup);
  }

  updateMeeplePlacementsInternal(validMeeplesIn);
}

function updateMeeplePlacementsInternal() {
  const groups = getActiveTileGroups();
  if (!groups) return;

  const meepleGroup = groups.meeplePlacementsGroup;

  // If no placement is selected, keep meeple group hidden.
  if (!selectedMove || !selectedMove.placement) {
    meepleGroup.attr('display', 'none');
    return;
  }

  // Update placed-meeple visibility only (outlines controlled by show/hide).
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
}

/**
 * Show meeple outlines on the confirmed tile, enabling meeple selection.
 * Called after the player clicks "Place Tile" (confirm step).
 *
 * Bug 3: Only show outlines for meeple positions valid for the current rotation.
 * Bug 10: Hide outlines if the player has no remaining meeples.
 */
export function showMeeplePlacements() {
  const groups = getActiveTileGroups();
  if (!groups) return;
  const meepleGroup = groups.meeplePlacementsGroup;
  if (!selectedMove || !selectedMove.placement) return;

  // Get valid meeple positions for this rotation.
  const rotationEntry = selectedMove.placement.rotations[selectedMove.rotationIndex];
  const validMeeples = rotationEntry ? rotationEntry.meeples : [];
  let mType = currentMeepleType; if (mType === 'large') mType = 'normal';
  // Bug 20: Check availability of the specific meeple type, not just normal meeples.
  // Large meeples are tracked by hasLargeMeeple (not remainingMeeples which is only for normal).
  const hasMeeples = _playerState && (function() {
    if (currentMeepleType === 'normal') return (_playerState.remainingMeeples || 0) > 0;
    if (currentMeepleType === 'large') return !!_playerState.hasLargeMeeple;
    if (currentMeepleType === 'builder') return !!_playerState.hasBuilderMeeple;
    if (currentMeepleType === 'pig') return !!_playerState.hasPigMeeple;
    return false;
  })();

  // Show the meeple group and allow pointer events for meeple selection.
  // Bug 3: Must clear BOTH display AND visibility — visibility:hidden is set
  // in initializeBoard() / clearBoard() and persists even after display is restored.
  meepleGroup.attr('display', null);
  meepleGroup.attr('visibility', null);
  meepleGroup.style('pointer-events', null);
  meepleGroup.selectAll('g.outline-group').style('pointer-events', null);
  meepleGroup.selectAll('image.meeple-outline').style('pointer-events', null);

  // Rotation indicator is no longer needed — meeple outlines are shown.
  hideRotationIndicator();

  // Bug 3/4: Filter outlines to only show positions valid for this rotation
  // and current meeple type.
  _applyOutlineFilter(meepleGroup);

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
}

/**
 * Hide meeple outlines (e.g. when cancelling or before confirm step).
 * Also sets pointer-events: none on the group to prevent hidden SVG
 * elements from intercepting clicks on the board below.
 */
export function hideMeeplePlacements() {
  const groups = getActiveTileGroups();
  if (!groups) return;
  const meepleGroup = groups.meeplePlacementsGroup;
  meepleGroup.attr('display', 'none');
  meepleGroup.attr('visibility', 'hidden');
  meepleGroup.style('pointer-events', 'none');
}

// ---------------------------------------------------------------------------
// updatePlacedMeeple  (internal)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// _applyOutlineFilter  (internal helper)
// ---------------------------------------------------------------------------

/**
 * Filter meeple-outline element visibility to show only positions that are
 * valid for the current rotation AND the current meeple type AND available.
 *
 * Called from showMeeplePlacements(), updateMeeplePlacements(), and the
 * outline-group click handler to keep outlines consistently filtered after
 * any state change.
 */
function _applyOutlineFilter(meepleGroup) {
  if (!selectedMove || !selectedMove.placement || selectedMove.rotationIndex == null) return;
  const rotationEntry = selectedMove.placement.rotations[selectedMove.rotationIndex];
  const validMeeples = rotationEntry ? rotationEntry.meeples : [];
  let mType = currentMeepleType; if (mType === 'large') mType = 'normal';
  const hasMeeples = _playerState && (function() {
    if (currentMeepleType === 'normal') return (_playerState.remainingMeeples || 0) > 0;
    if (currentMeepleType === 'large') return !!_playerState.hasLargeMeeple;
    if (currentMeepleType === 'builder') return !!_playerState.hasBuilderMeeple;
    if (currentMeepleType === 'pig') return !!_playerState.hasPigMeeple;
    return false;
  })();
  meepleGroup.selectAll('image.meeple-outline')
    .attr('visibility', (d) => {
      if (!hasMeeples) return 'hidden';
      const isValid = validMeeples.some(
        (m) => m.meepleType === mType && m.locationType === d.locationType && m.index === d.index
      );
      return isValid ? null : 'hidden';
    });
}

/** Render a "placed" meeple image on the active tile (before confirm). */
function updatePlacedMeeple(data, playerState) {
  const groups = getActiveTileGroups();
  if (!groups) return;

  const meepleGroup = groups.meeplePlacementsGroup;
  const colorIdent = playerState ? playerState.color || 'blue' : 'blue';
  const type = currentMeepleType;
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
    .style('pointer-events', 'none');
}



// ---------------------------------------------------------------------------
// hideRotationIndicator
// ---------------------------------------------------------------------------

/**
 * Immediately hide the rotation indicator overlay on the active tile.
 */
function hideRotationIndicator() {
  const groups = getActiveTileGroups();
  if (!groups) return;
  const indicator = groups.activeTileRotGroup.select('use.active-tile-rotation-indicator');
  if (!indicator.empty()) {
    indicator.interrupt();
    indicator.attr('opacity', 0);
  }
  const bg = groups.activeTileRotGroup.select('circle.active-tile-rotation-indicator-bg');
  if (!bg.empty()) {
    bg.interrupt();
    bg.attr('opacity', 0);
  }
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
  // Do NOT show meeple outlines here — they show only after the player clicks
  // "Place Tile" (confirm).  The outlines are already created in renderActiveTile
  // and will be shown by showMeeplePlacements().

  // Show rotation indicator if >1 valid rotations (Bug 3/5: persistent visibility).
  _updateRotationIndicator();
}

/** Get the current rotation. */
export function getCurrentRotation() {
  return currentRotation;
}

/**
 * Show or hide the rotation indicator based on how many valid rotations the
 * current placement has.  Hidden when ≤ 1 (rotation not available or trivial).
 */
function _updateRotationIndicator() {
  const groups = getActiveTileGroups();
  if (!groups) return;
  const indicator = groups.activeTileRotGroup.select('use.active-tile-rotation-indicator');
  const bg = groups.activeTileRotGroup.select('circle.active-tile-rotation-indicator-bg');
  if (indicator.empty()) return;
  const hasMultipleRotations =
    selectedMove &&
    selectedMove.placement &&
    selectedMove.placement.rotations &&
    selectedMove.placement.rotations.length > 1;
  const opacity = hasMultipleRotations ? 1 : 0;
  indicator.interrupt();
  indicator.attr('opacity', opacity);
  if (!bg.empty()) {
    bg.interrupt();
    bg.attr('opacity', opacity);
  }
}

/** Force-set rotation (e.g. when restoring game state). */
export function setCurrentRotation(rotation) {
  currentRotation = rotation % 4;
  const groups = getActiveTileGroups();
  if (groups) {
    const metrics = getBoardMetrics();
    const scale = _isPinned ? metrics.transform.k : 1;
    groups.activeTileRotGroup.attr('transform', `rotate(${currentRotation * 90}) scale(${scale})`);
  }
}

/**
 * Set ONLY the rotation state variable without updating the DOM transform.
 * Used before moveToBoardPosition() so the D3 transition has meaningful
 * start → end values (Bug 1: premature rotation indicator).
 */
export function setRotationState(rotation) {
  currentRotation = rotation % 4;
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
