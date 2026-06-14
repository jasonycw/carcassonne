/**
 * MeeplePlacements.js — Meeple placement UI for Carcassonne.
 *
 * Provides controls for the player to choose a meeple type (normal,
 * large meeple, builder, pig) before placing it on a tile feature.
 *
 * Integrates with GameBoard's meeple placement mode and ActiveTile's
 * positioning.
 *
 * @module MeeplePlacements
 */

import {
  setMeeplePlacementMode,
  meeplePlacementMode,
} from '../rendering/GameBoard.js';

/**
 * Build the meeple selection HTML and attach callbacks.
 *
 * @param {HTMLElement} container  Element to hold the meeple buttons
 * @param {object}      player     Current player object (has hasLargeMeeple, hasBuilderMeeple, etc.)
 * @param {function}    onSelect   Called with meepleType string when player selects one
 */
export function initMeepleSelector(container, player, onSelect) {
  if (!container) return;
  // Hide selector entirely when the player has no meeples left.
  if (player.remainingMeeples <= 0) {
    container.innerHTML = '';
    return;
  }

  const types = [{ type: 'normal', label: 'Meeple', available: player.remainingMeeples > 0 }];

  if (player.hasLargeMeeple) {
    types.push({ type: 'large', label: 'Large', available: true });
  }
  if (player.hasBuilderMeeple) {
    types.push({ type: 'builder', label: 'Builder', available: true });
  }
  if (player.hasPigMeeple) {
    types.push({ type: 'pig', label: 'Pig', available: true });
  }

  const buttons = types.map((t) => `
    <button class="meeple-select-btn" data-type="${t.type}"
      style="
        padding:6px 14px; border-radius:6px; border:1px solid #4fc3f7;
        background:#16213e; color:${t.available ? '#4fc3f7' : '#666'};
        cursor:${t.available ? 'pointer' : 'not-allowed'};
        font-size:0.82rem; opacity:1;
      "
      ${t.available ? '' : 'disabled'}
    >${t.label}</button>
  `).join('');

  container.innerHTML = `
    <div style="display:flex; gap:6px; align-items:center;">
      <span style="font-size:0.8rem; opacity:0.6;">Meeple:</span>
      ${buttons}
    </div>
  `;

  container.querySelectorAll('.meeple-select-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      if (type === 'normal' && player.remainingMeeples <= 0) return;
      setMeeplePlacementMode(type);
      if (onSelect) onSelect(type);
    });
  });
}

/**
 * Show a meeple placement prompt overlay after a tile is placed.
 * Returns a promise that resolves with the chosen meeple type and
 * feature, or null if the player skips.
 *
 * @param {HTMLElement} container
 * @param {object}      activeTile     The placed tile
 * @param {object}      player
 * @param {object[]}    validPlacements  Valid meeple positions from ActiveTile
 * @returns {Promise<{meepleType: string, locationType: string, index: number}|null>}
 */
export function promptMeeplePlacement(container, activeTile, player, validPlacements) {
  return new Promise((resolve) => {
    // Show skip option immediately.
    const skipTimeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 10000); // Auto-skip after 10s

    const cleanup = () => {
      clearTimeout(skipTimeout);
      container.innerHTML = '';
    };

    container.innerHTML = `
      <div style="
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        background:rgba(26,26,46,0.95); border:1px solid #4fc3f7;
        border-radius:12px; padding:20px; z-index:30;
        min-width:200px; text-align:center;
      ">
        <p style="margin:0 0 12px 0; font-size:0.9rem;">Place a meeple?</p>
        <div id="meeple-options" style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;"></div>
        <button id="meeple-skip" style="
          margin-top:12px; padding:6px 20px; border-radius:6px;
          border:1px solid #e57373; background:transparent;
          color:#e57373; cursor:pointer; font-size:0.82rem;
        ">Skip</button>
      </div>
    `;

    const optionsContainer = container.querySelector('#meeple-options');
    initMeepleSelector(optionsContainer, player, (meepleType) => {
      cleanup();
      // Use the first valid placement as default.
      const vp = validPlacements && validPlacements[0];
      if (vp) {
        resolve({ meepleType, locationType: vp.locationType, index: vp.index });
      } else {
        resolve(null);
      }
    });

    container.querySelector('#meeple-skip').addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
  });
}
