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
 * @param {Set<number>} [connectedPlayers]  Set of player indices with active P2P connections
 */
export function renderScoreboard(container, gamestate, currentPlayerIndex, gameOver, connectedPlayers) {
  if (!container || !gamestate || !gamestate.players) return;

  const players = gamestate.players;
  const expansions = gamestate.expansions || [];
  const hasTraders = expansions.indexOf('traders-and-builders') !== -1;
  const hasTower = expansions.indexOf('the-tower') !== -1;

  // Remaining tiles count.
  const tilesRemaining = gamestate.unusedTiles ? gamestate.unusedTiles.length : 0;
  const tilesPlaced = gamestate.placedTiles ? gamestate.placedTiles.length : 1; // starting tile always placed
  const totalTiles = tilesRemaining + tilesPlaced;

  // Vertical layout matching original game.ejs scoreboard.
  // Each player row: color dot + name + score + meeple icons + specials.
  let html = '<div style="display:flex; flex-direction:column; gap:2px; min-width:180px;">';

  // Remaining tiles indicator (matches original game placement).
  html += `<div style="
    padding:3px 8px; border-radius:4px; background:rgba(255,255,255,0.05);
    font-size:0.78rem; color:#aaa; margin-bottom:4px;
  ">
    Tiles: <span style="font-weight:bold;color:#fff;">${tilesRemaining}</span>
    <span style="opacity:0.5;font-size:0.7rem;">/ ${totalTiles}</span>
  </div>`;

  players.forEach((player, i) => {
    const color = player.color || getPlayerColor(i);
    const isActive = i === currentPlayerIndex && !gameOver;
    const colorHex = getColorHex(color);
    // Connection status: green dot when connected (in connectedPlayers set),
    // red when disconnected.  The caller is responsible for including ALL
    // relevant player indices (including host) in the connectedPlayers Set.
    const isConnected = connectedPlayers && connectedPlayers.has(i);
    const connColor = isConnected ? '#4caf50' : '#e57373';

    html += `
      <div class="sb-player ${isActive ? 'sb-active' : ''}" style="
        display:flex; align-items:center; gap:6px; padding:3px 8px;
        border-radius:4px; 
        background:${isActive ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.2)'};
        border-left:${isActive ? `3px solid ${colorHex}` : '3px solid transparent'};
        transition: all 0.2s; font-size:0.82rem;
      ">
        <span style="
          display:inline-block; width:10px; height:10px; border-radius:50%;
          background:${colorHex}; flex-shrink:0;
        "></span>
        <span title="${i === 0 ? 'Host' : (isConnected ? 'Connected' : 'Disconnected')}" style="
          display:inline-block; width:8px; height:8px; border-radius:50%;
          background:${connColor}; flex-shrink:0;
        "></span>
        <span style="font-weight:${isActive ? 'bold' : 'normal'}; flex-shrink:0; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${escapeHtml(player.user?.username || `Player ${i + 1}`)}
        </span>
        <span style="margin-left:auto; font-weight:bold; color:${colorHex}; flex-shrink:0;">
          ${player.points}
        </span>
        <span style="opacity:0.7; font-size:0.7rem; display:inline-flex; align-items:center; gap:1px; flex-wrap:nowrap; margin-left:4px;">
          ${renderMeepleIcons(color, player.remainingMeeples)}
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

  container.innerHTML = html;
}

/**
 * Render individual small meeple icons for the player's remaining meeples.
 * Shows up to 8 icons; if more remain, shows "+N" overflow label.
 * @param {string} colorName  Internal colour name (e.g. 'red', 'blue')
 * @param {number|null} count  Number of remaining meeples
 * @returns {string} HTML string
 */
function renderMeepleIcons(colorName, count) {
  if (count == null) return '<span style="opacity:0.5;">?</span>';
  const maxShow = 7;
  const show = Math.min(count, maxShow);
  const src = img(`/images/meeples/${colorName}_standing.png`);
  let html = '';
  for (let i = 0; i < show; i++) {
    html += `<img src="${src}" style="width:10px;height:10px;" alt="meeple" />`;
  }
  if (count > maxShow) {
    html += `<span style="font-size:0.6rem;opacity:0.6;margin-left:1px;">+${count - maxShow}</span>`;
  }
  return html;
}

/** Render a small meeple icon for special meeples (large, builder, pig). */
function meepleIcon(colorName, type) {
  // Large meeples reuse the standing/lying images (rendered at larger size on board),
  // but in the scoreboard we show a small icon with 'large' label
  const suffix = type === 'large' ? 'standing' : type;
  const src = img(`/images/meeples/${colorName}_${suffix}.png`);
  const size = type === 'large' ? 24 : 20;
  return `<img src="${src}" style="width:${size}px;height:${size}px;border-radius:2px;" title="${type}" />`;
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
export function getColorHex(color) {
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
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
