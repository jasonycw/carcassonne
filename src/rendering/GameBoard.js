/**
 * GameBoard.js — D3 v7 SVG game board renderer for Carcassonne.
 *
 * Extracted from the original game.ejs client-side JavaScript and ported from
 * D3 v3 syntax to D3 v7 ES modules.  Handles the placed-tile layer (images,
 * meeples, turn markers), the valid-placement overlay, and the fixed-position
 * scoreboard.  The floating active tile and its meeple-placement UI live in
 * the sibling module ActiveTile.js.
 *
 * All board items are drawn inside an SVG <g> group that receives the D3 zoom
 * transform (pan + zoom).  The scoreboard is placed outside this group so it
 * stays fixed on screen.
 *
 * Major D3 v3 → v7 changes applied here:
 *   d3.behavior.zoom()     → d3.zoom()
 *   d3.event.translate     → event.transform.x / .y
 *   d3.event.scale         → event.transform.k
 *   .attr({key: val})      → .attr('key', val) (chained)
 *   'xlink:href'           → 'href'
 */

import * as d3 from 'd3';
import { img } from '../utils/AssetPaths.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TILE_SIZE = 100;

export const PLAYER_COLORS = [
  '#e74c3c', // red
  '#3498db', // blue
  '#2ecc71', // green
  '#f39c12', // orange
  '#9b59b6', // purple
  '#1abc9c', // teal
];

/** Map a player array index to a stable CSS colour. */
export function getPlayerColor(index) {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
}

// ---------------------------------------------------------------------------
// Module-level (private) state
// ---------------------------------------------------------------------------

/** D3 selection of the root <svg> element. */
let svgSelection = null;

/** D3 zoom behaviour instance – exported so callers can interact with it. */
export let zoomBehavior = null;

// ── SVG group layers ───────────────────────────────────────────────────────

/** Group that receives the zoom/pan transform (contains all board items). */
let zoomGroup = null;
/** Group outside the zoom transform (scoreboard, fixed UI). */
let uiGroup = null;

let placedTileImagesGroup = null;  // tile image <image> elements
let placedTilePiecesGroup = null;  // per-tile <g> for meeples / towers
let turnMarkerGroup = null;        // coloured border rects
let validPlacementsGroup = null;   // green placement squares
let activeTileGroup = null;        // container for the floating active tile
let activeTileTransGroup = null;   // inner translation group
let activeTileRotGroup = null;     // inner rotation group
let meeplePlacementsGroup = null;  // meeple outlines inside the active tile
let scoreArea = null;              // scoreboard group (inside uiGroup)

// ── Rendering state ────────────────────────────────────────────────────────

let TILE_SIZE = DEFAULT_TILE_SIZE;
let svgWidth = 0;
let svgHeight = 0;

// Last known gamestate so we can quickly re-draw on resize.
let lastGamestate = null;
let lastPlayerId = null;
let lastCallbacks = null;

/** Meeple-placement mode – managed by ActiveTile.js but shared via state. */
export let meeplePlacementMode = 'normal';

export function setMeeplePlacementMode(mode) {
  meeplePlacementMode = mode || 'normal';
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Return the SVG image filename suffix for a meeple given its type and the
 * feature location it sits on (or will sit on).
 *
 * - normal / large  → 'standing' (city, road, cloister) or 'lying' (farm)
 * - pig / builder   → the type itself
 * - tower           → 'tower'
 */
function meepleImageSuffix(meepleType, location) {
  if (meepleType === 'pig' || meepleType === 'builder' || meepleType === 'tower') {
    return meepleType;
  }
  // normal or large
  return location === 'farm' ? 'lying' : 'standing';
}

/** Build the full image path for a meeple. */
function meepleImagePath(colorName, meepleType, location) {
  const suffix = meepleImageSuffix(meepleType, location);
  return img(`/images/meeples/${colorName}_${suffix}.png`);
}

/** Map hex color to the CSS colour name used in the sprite filenames. */
const HEX_TO_COLOR_NAME = {
  '#e74c3c': 'red',
  '#3498db': 'blue',
  '#2ecc71': 'green',
  '#f39c12': 'yellow',
  '#9b59b6': 'purple',
  '#1abc9c': 'gray',
};
function colorNameForPlayer(player) {
  return HEX_TO_COLOR_NAME[player.color] || player.color || 'blue';
}

/** Resolve the meepleOffset for a placed meeple from the tile's feature data. */
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

/** Compute meeple render size (px) based on meeple type. */
function meepleSize(meepleType) {
  return meepleType !== 'normal' ? TILE_SIZE * 3 / 8 : TILE_SIZE / 4;
}

// ---------------------------------------------------------------------------
// initializeBoard
// ---------------------------------------------------------------------------

/**
 * Set up the SVG element with D3 zoom/pan, create all layer groups and add
 * shared SVG <defs> (drop-shadow filter, meeple patterns, etc.).
 *
 * @param {SVGSVGElement} svgElement  The <svg> DOM node (not a selector string).
 * @param {object}        [options]
 * @param {number}        [options.tileSize=100]
 * @param {[number,number]} [options.scaleExtent=[0.25, 1]]
 * @param {[number,number]} [options.translateExtent]  Bounds for panning.
 */
export function initializeBoard(svgElement, options = {}) {
  svgSelection = d3.select(svgElement);

  // Capture SVG client dimensions.
  const rect = svgElement.getBoundingClientRect();
  svgWidth = rect.width || svgElement.clientWidth || 800;
  svgHeight = rect.height || svgElement.clientHeight || 600;

  if (options.tileSize !== undefined) {
    TILE_SIZE = options.tileSize;
  }

  // ── Ensure <defs> exists ──────────────────────────────────────────────
  let defs = svgSelection.select('defs');
  if (defs.empty()) {
    defs = svgSelection.append('defs');
  }

  // Drop-shadow filter for the valid-placement squares.
  defs.append('filter')
    .attr('id', 'placement-glow')
    .attr('x', '-20%')
    .attr('y', '-20%')
    .attr('width', '140%')
    .attr('height', '140%')
    .append('feDropShadow')
    .attr('dx', 0)
    .attr('dy', 0)
    .attr('stdDeviation', 4)
    .attr('flood-color', '#00cc44')
    .attr('flood-opacity', 0.6);

  // ── Zoom behaviour ────────────────────────────────────────────────────
  const scaleExtent = options.scaleExtent || [0.25, 1];
  zoomBehavior = d3.zoom()
    .scaleExtent(scaleExtent);

  if (options.translateExtent) {
    zoomBehavior.translateExtent(options.translateExtent);
  }

  zoomBehavior.on('zoom', (event) => {
    if (zoomGroup) {
      zoomGroup.attr('transform', event.transform);
    }
    // Notify ActiveTile to reposition if needed.
    if (lastCallbacks && lastCallbacks.onZoom) {
      lastCallbacks.onZoom(event.transform);
    }
  });

  // Attach zoom to the SVG; prevent double-click zoom.
  svgSelection.call(zoomBehavior);
  svgSelection.on('dblclick.zoom', null);

  // ── Create layer groups (order matters – drawn back-to-front) ────────
  zoomGroup = svgSelection.append('g').attr('class', 'zoom-group');
  uiGroup = svgSelection.append('g').attr('class', 'ui-group');

  // Board layers (inside zoomGroup).
  placedTileImagesGroup = zoomGroup.append('g').attr('class', 'placed-tile-images');
  placedTilePiecesGroup = zoomGroup.append('g').attr('class', 'placed-tile-pieces');
  turnMarkerGroup = zoomGroup.append('g').attr('class', 'turn-markers');
  validPlacementsGroup = zoomGroup.append('g').attr('class', 'valid-placements');

  // UI layers (outside zoomGroup, fixed on screen).
  scoreArea = uiGroup.append('g').attr('class', 'score-area');
  // Background rectangle placed behind the score content.
  scoreArea.append('rect')
    .attr('class', 'score-bg')
    .attr('rx', 15)
    .attr('ry', 15)
    .attr('x', -15)
    .attr('y', -15)
    .attr('fill', 'white')
    .attr('stroke', 'black')
    .attr('stroke-width', 2)
    .attr('opacity', 0.75)
    .attr('pointer-events', 'none');

  // Active-tile container (outside zoomGroup so it stays fixed on screen).
  activeTileGroup = uiGroup.append('g')
    .attr('class', 'active-tile')
    .attr('visibility', 'hidden');
  activeTileTransGroup = activeTileGroup.append('g')
    .attr('class', 'active-tile-translation')
    .attr('transform', `translate(${TILE_SIZE / 2},${TILE_SIZE / 2})`);
  activeTileRotGroup = activeTileTransGroup.append('g')
    .attr('class', 'active-tile-rotation');
  // Rotation indicator (hidden by default — only shown when tile is pinned
  // on board and the placement has more than 1 valid rotation).
  activeTileRotGroup.append('use')
    .attr('class', 'active-tile-rotation-indicator')
    .attr('href', '#svgicon-repeat-payment')
    .attr('x', -16)
    .attr('y', -16)
    .attr('transform', `scale(${TILE_SIZE / 32})`)
    .attr('fill', 'white')
    .attr('stroke', 'black')
    .attr('opacity', 0)
    .attr('pointer-events', 'none');
  // Meeple-placements sub-group (hidden by default).
  meeplePlacementsGroup = activeTileRotGroup.append('g')
    .attr('class', 'meeple-placements')
    .attr('visibility', 'hidden');
}

// ---------------------------------------------------------------------------
// draw
// ---------------------------------------------------------------------------

/**
 * Idempotent full-board render.  Uses D3 data-join (enter/update/exit) so
 * it is safe to call repeatedly with new gamestate snapshots.
 *
 * Rendering order (bottom → top):
 *   1. Placed-tile images (rotated per tile.rotation)
 *   2. Placed-tile pieces (meeples, towers)
 *   3. Turn markers (coloured borders)
 *   4. Valid-placement highlights (green squares)
 *   5. Scoreboard (player names, points, meeple pool)
 *
 * The floating active tile is NOT handled here – see ActiveTile.js.
 *
 * @param {object} gamestate   Full game-state object (see typedef in README).
 * @param {string} playerId    The viewing player's user _id.
 * @param {object} [callbacks] Event handlers.
 * @param {Function} [callbacks.onPlacementClick] (x, y, rotation) => void
 * @param {Function} [callbacks.onScoreboardClick] (playerIndex) => void
 * @param {Function} [callbacks.onZoom] (transform) => void
 */
export function draw(gamestate, playerId, callbacks = {}) {
  // ── Cache for resize re-draws ─────────────────────────────────────────
  lastGamestate = gamestate;
  lastPlayerId = playerId;
  lastCallbacks = callbacks;

  // ── Update dimensions ─────────────────────────────────────────────────
  if (svgSelection) {
    const el = svgSelection.node();
    if (el) {
      const rect = el.getBoundingClientRect();
      svgWidth = rect.width || svgWidth;
      svgHeight = rect.height || svgHeight;
    }
  }

  // Guard: bail if the SVG is invisible.
  if (svgWidth === 0 || svgHeight === 0) return;

  // ── Reorder players so the viewing player is first in the scoreboard ──
  const reorderedPlayers = reorderPlayersForView(gamestate.players, playerId);
  const viewerIsActive = reorderedPlayers.length > 0 && reorderedPlayers[0].active;

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Placed-tile images
  // ═══════════════════════════════════════════════════════════════════════
  const placedTiles = gamestate.placedTiles || [];

  placedTileImagesGroup.selectAll('image.placed-tile-image')
    .data(placedTiles, (d, i) => `${d.x}:${d.y}:${i}`)
    .join(
      (enter) => enter.append('image')
        .attr('class', 'placed-tile-image')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', TILE_SIZE)
        .attr('height', TILE_SIZE),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('transform', (d) => {
      const x = svgWidth / 2 + d.x * TILE_SIZE;
      const y = svgHeight / 2 + d.y * TILE_SIZE;
      // Rotate around the tile centre then translate.
      return `rotate(${90 * d.rotation},${x + TILE_SIZE / 2},${y + TILE_SIZE / 2}) translate(${x},${y})`;
    })
    .attr('href', (d) => img(d.tile.imageURL));

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Placed-tile pieces (meeples + towers)
  // ═══════════════════════════════════════════════════════════════════════
  let tileGroups = placedTilePiecesGroup.selectAll('g.placed-tile')
    .data(placedTiles, (d, i) => `${d.x}:${d.y}:${i}`);

  const tileGroupsEnter = tileGroups.enter().append('g')
    .attr('class', 'placed-tile');

  // Nested tower-pieces container.
  tileGroupsEnter.append('g')
    .attr('class', 'tower-pieces');

  tileGroups.exit().remove();

  tileGroups = tileGroups.merge(tileGroupsEnter);

  tileGroups
    .attr('transform', (d) => `translate(${svgWidth / 2 + d.x * TILE_SIZE},${svgHeight / 2 + d.y * TILE_SIZE})`);

  // ── Meeples on placed tiles ───────────────────────────────────────────
  tileGroups.selectAll('image.meeple')
    .data((d) => {
      const tile = d.tile;
      return (d.meeples || []).map((m) => {
        const offset = resolveMeepleOffset(m.placement, tile);
        const pIdx = m.playerIndex;
        const player = gamestate.players[pIdx] || {};
        const colorHex = player.color || getPlayerColor(pIdx);
        return {
          playerIndex: pIdx,
          colorHex,
          colorName: colorNameForPlayer({ color: colorHex }),
          rotation: d.rotation,
          location: m.placement.locationType,
          meepleType: m.meepleType,
          meepleOffset: offset,
        };
      });
    })
    .join(
      (enter) => enter.append('image')
        .attr('class', 'meeple'),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('width', (d) => meepleSize(d.meepleType))
    .attr('height', (d) => meepleSize(d.meepleType))
    .attr('x', (d) => d.meepleOffset.x * TILE_SIZE - meepleSize(d.meepleType) / 2)
    .attr('y', (d) => d.meepleOffset.y * TILE_SIZE - meepleSize(d.meepleType) / 2)
    .attr('href', (d) => meepleImagePath(d.colorName, d.meepleType, d.location))
    .attr('transform', (d) =>
      `rotate(${d.rotation * -90},${d.meepleOffset.x * TILE_SIZE},${d.meepleOffset.y * TILE_SIZE})`);

  // ── Tower pieces on placed tiles (The Tower expansion) ────────────────
  const towerVerticalSize = TILE_SIZE / 12;

  // Already-placed tower floors.
  tileGroups.select('g.tower-pieces').selectAll('image.tower')
    .data((d) => {
      if (!d.tower) return [];
      const arr = [];
      for (let i = 0; i < d.tower.height; i++) {
        arr.push({
          offset: d.tile.tower ? d.tile.tower.offset : { x: 0.5, y: 0.5 },
          tileRotation: d.rotation,
          towerHeight: i,
        });
      }
      return arr;
    })
    .join(
      (enter) => enter.append('image')
        .attr('class', 'tower')
        .attr('width', TILE_SIZE / 3)
        .attr('height', TILE_SIZE / 3)
        .attr('href', img('/images/meeples/tower.png')),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('x', (d) => d.offset.x * TILE_SIZE - TILE_SIZE / 6)
    .attr('y', (d) => d.offset.y * TILE_SIZE - TILE_SIZE / 6 - towerVerticalSize * d.towerHeight)
    .attr('transform', (d) =>
      `rotate(${d.tileRotation * -90},${d.offset.x * TILE_SIZE},${d.offset.y * TILE_SIZE})`);

  // Tower outlines (unplaced, clickable).
  tileGroups.selectAll('image.tower-outline')
    .data((d, i) => {
      if (!d.tile.tower || d.tower.completed) return [];
      return [{
        offset: d.tile.tower.offset,
        tileRotation: d.rotation,
        tileIndex: i,
        towerHeight: d.tower.height,
      }];
    })
    .join(
      (enter) => enter.append('image')
        .attr('class', 'tower-outline')
        .attr('width', TILE_SIZE / 3)
        .attr('height', TILE_SIZE / 3)
        .attr('href', img('/images/meeples/outline_tower.png'))
        .attr('visibility', 'hidden')
        .on('click', function (event, d) {
          // Notify via callback.
          if (callbacks.onTowerOutlineClick) {
            callbacks.onTowerOutlineClick(d.tileIndex);
          }
        }),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('x', (d) => d.offset.x * TILE_SIZE - TILE_SIZE / 6)
    .attr('y', (d) => d.offset.y * TILE_SIZE - TILE_SIZE / 6 - towerVerticalSize * d.towerHeight)
    .attr('transform', (d) =>
      `rotate(${d.tileRotation * -90},${d.offset.x * TILE_SIZE},${d.offset.y * TILE_SIZE})`);

  // Tower placements (overlaid on outline when selected).
  tileGroups.selectAll('image.placed-tower')
    .data((d, i) => {
      if (!d.tile.tower || d.tower.completed) return [];
      return [{
        offset: d.tile.tower.offset,
        tileRotation: d.rotation,
        tileIndex: i,
        towerHeight: d.tower.height,
      }];
    })
    .join(
      (enter) => enter.append('image')
        .attr('class', 'placed-tower')
        .attr('width', TILE_SIZE / 3)
        .attr('height', TILE_SIZE / 3)
        .attr('href', img('/images/meeples/tower.png')),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('x', (d) => d.offset.x * TILE_SIZE - TILE_SIZE / 6)
    .attr('y', (d) => d.offset.y * TILE_SIZE - TILE_SIZE / 6 - towerVerticalSize * d.towerHeight)
    .attr('transform', (d) =>
      `rotate(${d.tileRotation * -90},${d.offset.x * TILE_SIZE},${d.offset.y * TILE_SIZE})`)
    .attr('visibility', 'hidden');

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Turn markers (coloured border rects on each player's most recent tile)
  // ═══════════════════════════════════════════════════════════════════════
  const markers = buildTurnMarkers(placedTiles, gamestate.players || []);

  turnMarkerGroup.selectAll('rect.turn-marker')
    .data(markers)
    .join(
      (enter) => enter.append('rect')
        .attr('class', 'turn-marker')
        .attr('fill-opacity', 0)
        .attr('stroke-width', 4)
        .attr('stroke-linejoin', 'round')
        .attr('rx', 7)
        .attr('ry', 7)
        .attr('width', TILE_SIZE)
        .attr('height', TILE_SIZE)
        .attr('pointer-events', 'none'),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('x', (d) => svgWidth / 2 + d.x * TILE_SIZE)
    .attr('y', (d) => svgHeight / 2 + d.y * TILE_SIZE)
    .attr('stroke', (d) => d.color);

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Valid-placement highlights (placement_available.png, matching original UX)
  // ═══════════════════════════════════════════════════════════════════════
  const validPlacements = viewerIsActive && gamestate.activeTile
    ? (gamestate.activeTile.validPlacements || [])
    : [];

  validPlacementsGroup.selectAll('image.tile-placement')
    .data(validPlacements)
    .join(
      (enter) => enter.append('image')
        .attr('class', 'tile-placement')
        .attr('width', TILE_SIZE)
        .attr('height', TILE_SIZE)
        .attr('href', img('/images/ui/placement_available.png'))
        .attr('cursor', 'pointer')
        .on('click', function (event, d) {
          // Default to the first rotation; callers can override.
          const rotation = (d.rotations && d.rotations.length > 0)
            ? d.rotations[0].rotation : 0;
          if (callbacks.onPlacementClick) {
            callbacks.onPlacementClick(d.x, d.y, rotation);
          }
        }),
      (update) => update,
      (exit) => exit.remove()
    )
    .attr('x', (d) => svgWidth / 2 + d.x * TILE_SIZE)
    .attr('y', (d) => svgHeight / 2 + d.y * TILE_SIZE);

  // ═══════════════════════════════════════════════════════════════════════
  // 5. Scoreboard is rendered as HTML by ScoreBoard.js via GameView.
  // ═══════════════════════════════════════════════════════════════════════
}

// DRAW SCOREBOARD REMOVED — HTML ScoreBoard.js handles this now.
// The SVG scoreboard was causing duplicate rendering with the HTML scoreboard.
// All player display (names, points, meeples, tokens) is done by ScoreBoard.js.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Rotate the players array so the given user_id appears first.
 * If the user appears multiple times in the same game the active copy
 * takes priority.
 */
function reorderPlayersForView(players, userId) {
  if (!players || players.length === 0) return [];
  const copy = players.slice();
  let count = 0;
  const maxIter = copy.length;
  while (
    copy[0].user._id !== userId ||
    (!copy[0].active && count < maxIter)
  ) {
    count++;
    copy.push(copy.shift());
  }
  return copy;
}

/**
 * Build the turn-marker data array: one coloured rect per player for their
 * most recently placed tile.  Walk the placed-tile list backwards until
 * every player has been seen.
 */
function buildTurnMarkers(placedTiles, players) {
  const markers = [];
  const markedPlayers = [];
  for (let k = placedTiles.length - 1; k >= 0 && markedPlayers.length < players.length; k--) {
    const pt = placedTiles[k];
    if (markedPlayers.indexOf(pt.playerIndex) === -1) {
      markedPlayers.push(pt.playerIndex);
    }
    markers.push({
      x: pt.x,
      y: pt.y,
      color: players[pt.playerIndex] ? players[pt.playerIndex].color : '#888',
    });
  }
  return markers;
}

// ---------------------------------------------------------------------------
// clearBoard
// ---------------------------------------------------------------------------

/** Remove all rendered elements from the board groups. */
export function clearBoard() {
  if (placedTileImagesGroup) placedTileImagesGroup.selectAll('*').remove();
  if (placedTilePiecesGroup) placedTilePiecesGroup.selectAll('*').remove();
  if (turnMarkerGroup) turnMarkerGroup.selectAll('*').remove();
  if (validPlacementsGroup) validPlacementsGroup.selectAll('*').remove();
  if (activeTileGroup) {
    activeTileGroup.selectAll('*').remove();
    // Re-create the inner structure so ActiveTile can use it.
    activeTileTransGroup = activeTileGroup.append('g')
      .attr('class', 'active-tile-translation')
      .attr('transform', `translate(${TILE_SIZE / 2},${TILE_SIZE / 2})`);
    activeTileRotGroup = activeTileTransGroup.append('g')
      .attr('class', 'active-tile-rotation');
    activeTileRotGroup.append('use')
      .attr('class', 'active-tile-rotation-indicator')
      .attr('href', '#svgicon-repeat-payment')
      .attr('x', -16)
      .attr('y', -16)
      .attr('transform', `scale(${TILE_SIZE / 32})`)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('opacity', 0)
      .attr('pointer-events', 'none');
    meeplePlacementsGroup = activeTileRotGroup.append('g')
      .attr('class', 'meeple-placements')
      .attr('visibility', 'hidden');
  }
  // Scoreboard is now HTML (ScoreBoard.js) — no SVG cleanup needed.
  lastGamestate = null;
  lastPlayerId = null;
  lastCallbacks = null;
}

// ---------------------------------------------------------------------------
// gridToScreen / screenToGrid — coordinate transformation helpers
// ---------------------------------------------------------------------------

/**
 * Convert board grid coordinates (d.x, d.y) to on-screen pixel coordinates,
 * accounting for D3 zoom/pan transform.
 *
 * Board position origin is at (svgWidth/2, svgHeight/2), so a tile at grid
 * (0,0) renders at svgWidth/2, svgHeight/2 in the zoom-group coordinate
 * space.  This function applies the zoom transform to get screen px.
 *
 * @param {number} gridX  Tile grid X
 * @param {number} gridY  Tile grid Y
 * @returns {{ x: number, y: number }} Screen pixel coordinates
 */
export function gridToScreen(gridX, gridY) {
  const boardX = svgWidth / 2 + gridX * TILE_SIZE;
  const boardY = svgHeight / 2 + gridY * TILE_SIZE;
  if (!svgSelection) return { x: boardX, y: boardY };
  const t = d3.zoomTransform(svgSelection.node());
  return { x: t.applyX(boardX), y: t.applyY(boardY) };
}

/**
 * Return the current SVG dimensions, tile size, and zoom transform
 * so ActiveTile can compute screen positions.
 */
export function getBoardMetrics() {
  return {
    svgWidth,
    svgHeight,
    TILE_SIZE,
    transform: svgSelection ? d3.zoomTransform(svgSelection.node()) : d3.zoomIdentity,
  };
}

// ---------------------------------------------------------------------------
// setTileSize
// ---------------------------------------------------------------------------

/** Change the tile rendering size.  Requires a subsequent draw() call. */
export function setTileSize(size) {
  TILE_SIZE = size;
}

// ---------------------------------------------------------------------------
// getBoardTransform / setBoardTransform
// ---------------------------------------------------------------------------

/**
 * Return the current D3 zoom transform { x, y, k }.
 * Returns d3.zoomIdentity if no transform has been applied yet.
 */
export function getBoardTransform() {
  if (!svgSelection || !zoomBehavior) return d3.zoomIdentity;
  return d3.zoomTransform(svgSelection.node());
}

/**
 * Restore a previously saved zoom/pan transform.
 * @param {object} transform – an object with x, y, k properties (e.g. from
 *   getBoardTransform or d3.zoomIdentity.translate(x, y).scale(k)).
 */
export function setBoardTransform(transform) {
  if (!svgSelection || !zoomBehavior) return;
  svgSelection.call(zoomBehavior.transform, transform);
}

// ---------------------------------------------------------------------------
// Re-export internal groups for ActiveTile.js
// ---------------------------------------------------------------------------

/** @internal – used by ActiveTile.js to access the active-tile layer. */
export function getActiveTileGroups() {
  return {
    activeTileGroup,
    activeTileTransGroup,
    activeTileRotGroup,
    meeplePlacementsGroup,
  };
}

/** @internal – used by ActiveTile.js to access the SVG/zoom reference. */
export function getSvgSelection() {
  return svgSelection;
}
