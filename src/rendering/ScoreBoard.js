/**
 * ScoreBoard.js — D3-based score UI for Carcassonne.
 *
 * Renders a player scoreboard with colour swatches, current scores,
 * meeple counts, active player indicator, and game-over overlay.
 *
 * Mounts into a given container element and updates on state change.
 *
 * @module ScoreBoard
 */

import { getPlayerColor } from './GameBoard.js';

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

  let html = '<div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">';

  players.forEach((player, i) => {
    const color = player.color || getPlayerColor(i);
    const isActive = i === currentPlayerIndex && !gameOver;
    const activeClass = isActive ? 'sb-active' : '';
    const colorHex = getColorHex(color);

    html += `
      <div class="sb-player ${activeClass}" style="
        display:flex; align-items:center; gap:6px; padding:4px 10px;
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
        <span style="margin-left:4px; font-weight:bold; color:${colorHex};">
          ${player.points}
        </span>
        <span style="opacity:0.5; font-size:0.75rem;">
          (${player.remainingMeeples != null ? player.remainingMeeples : '?'})
        </span>
      </div>
    `;
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
    orange: '#f39c12',
    purple: '#9b59b6',
    teal: '#1abc9c',
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
