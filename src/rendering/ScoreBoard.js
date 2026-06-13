/**
 * ScoreBoard.js — Score UI for Carcassonne.
 *
 * Renders a player scoreboard with colour swatches, current scores,
 * meeple counts, special meeple indicators, goods tokens, tower
 * pieces, active player indicator, and game-over overlay.
 *
 * Mounts into a given container element and updates on state change.
 *
 * @module ScoreBoard
 */

import { getPlayerColor } from './GameBoard.js';
import { img } from '../utils/AssetPaths.js';

/**
 * Create or update the scoreboard DOM inside the given container.
 *
 * @param {HTMLElement} container  Element to render into
 * @param {object}      gamestate  Current game state
 * @param {number}      currentPlayerIndex  Index of the active player
 * @param {boolean}     [gameOver]  Whether the game has ended
 */
export function renderScoreboard(container, gamestate, currentPlayerIndex, gameOver) {
  if (!container || !gamestate || !gamestate.players) return;

  const players = gamestate.players;
  const expansions = gamestate.expansions || [];
  const hasTraders = expansions.indexOf('traders-and-builders') !== -1;
  const hasTower = expansions.indexOf('the-tower') !== -1;

  // Remaining tiles count.
  const tilesRemaining = gamestate.unusedTiles ? gamestate.unusedTiles.length : 0;
  const tilesPlaced = gamestate.placedTiles ? gamestate.placedTiles.length : 1; // starting tile always placed
  const totalTiles = tilesRemaining + tilesPlaced;

  let html = '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">';

  // Remaining tiles indicator (matches original game placement).
  html += `<div style="
    padding:4px 10px; border-radius:6px; background:rgba(255,255,255,0.05);
    font-size:0.82rem; color:#aaa;
  ">
    Tiles: <span style="font-weight:bold;color:#fff;">${tilesRemaining}</span>
    <span style="opacity:0.5;font-size:0.75rem;">/ ${totalTiles}</span>
  </div>`;

  players.forEach((player, i) => {
    const color = player.color || getPlayerColor(i);
    const isActive = i === currentPlayerIndex && !gameOver;
    const colorHex = getColorHex(color);

    html += `
      <div class="sb-player ${isActive ? 'sb-active' : ''}" style="
        display:flex; align-items:center; gap:4px; padding:4px 10px;
        border-radius:6px; background:${isActive ? 'rgba(255,255,255,0.12)' : 'transparent'};
        border:${isActive ? `2px solid ${colorHex}` : '2px solid transparent'};
        transition: all 0.2s; font-size:0.82rem;
      ">
        <span style="
          display:inline-block; width:12px; height:12px; border-radius:50%;
          background:${colorHex}; flex-shrink:0;
        "></span>
        <span style="font-weight:${isActive ? 'bold' : 'normal'};">
          ${escapeHtml(player.user?.username || `Player ${i + 1}`)}
        </span>
        <span style="margin-left:2px; font-weight:bold; color:${colorHex};">
          ${player.points}
        </span>
        <span style="opacity:0.5; font-size:0.75rem; display:inline-flex; align-items:center; gap:2px;">
          <img src="${img(`/images/meeples/${color}_standing.png`)}"
               style="width:12px;height:12px;vertical-align:middle;"
               alt="meeples" />
          ${player.remainingMeeples != null ? player.remainingMeeples : '?'}
        </span>`;

    // ── Special meeple icons ────────────────────────────────────────
    if (player.hasLargeMeeple) {
      html += meepleIcon(color, 'large');
    }
    if (player.hasBuilderMeeple) {
      html += meepleIcon(color, 'builder');
    }
    if (player.hasPigMeeple) {
      html += meepleIcon(color, 'pig');
    }

    // ── Goods tokens (Traders & Builders) ───────────────────────────
    if (hasTraders && player.goods) {
      const g = player.goods;
      if (g.fabric > 0) html += tokenIcon('/images/tokens/fabric_token.png', `${g.fabric}`);
      if (g.wheat > 0) html += tokenIcon('/images/tokens/wheat_token.png', `${g.wheat}`);
      if (g.wine > 0) html += tokenIcon('/images/tokens/wine_token.png', `${g.wine}`);
    }

    // ── Tower pieces (The Tower) ────────────────────────────────────
    if (hasTower && player.towers > 0) {
      html += tokenIcon('/images/meeples/tower.png', `${player.towers}`);
    }

    html += `</div>`;
  });

  html += '</div>';

  // Game-over overlay
  if (gameOver) {
    const winner = players.reduce((best, p) =>
      p.points > best.points ? p : best,
    );
    html += `
      <div style="
        margin-top:6px; padding:6px 12px; border-radius:6px;
        background:#2e7d32; color:#fff; font-size:0.85rem; font-weight:bold;
      ">
        🏆 ${escapeHtml(winner.user?.username || 'Player')} wins with ${winner.points} points!
      </div>
    `;
  }

  container.innerHTML = html;
}

/** Render a small meeple icon for special meeples (large, builder, pig). */
function meepleIcon(colorName, type) {
  const src = img(`/images/meeples/${colorName}_${type}.png`);
  return `<img src="${src}" style="width:20px;height:20px;border-radius:2px;" title="${type}" />`;
}

/** Render a small icon with a count label. */
function tokenIcon(path, label) {
  const src = img(path);
  return `<img src="${src}" style="width:16px;height:16px;border-radius:2px;" /><span style="font-size:0.7rem;opacity:0.7;margin-right:2px;">${label}</span>`;
}

/**
 * Get a CSS hex colour string from the internal colour name.
 * @param {string} color  Internal colour name: 'red', 'blue', 'green', etc.
 * @returns {string}  CSS hex colour
 */
function getColorHex(color) {
  const map = {
    red: '#e74c3c',
    blue: '#3498db',
    green: '#2ecc71',
    yellow: '#f39c12',
    purple: '#9b59b6',
    gray: '#1abc9c',
  };
  return map[color] || '#888';
}

/** Minimal HTML-escape to prevent XSS from player names. */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
