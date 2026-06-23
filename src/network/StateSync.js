/**
 * StateSync.js — localStorage persistence for game state recovery.
 *
 * Saves the full game state to localStorage so that the host (or solo
 * player) can recover from a browser refresh or accidental close.
 *
 * Only the authoritative host saves state. Clients rely on host broadcasts.
 *
 * @module StateSync
 */

const STORAGE_KEY = 'carcassonne_game_state';
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Save the current game state to localStorage.
 *
 * @param {object} gamestate  Full game state (from GameLogic)
 * @returns {boolean}  True if saved successfully
 */
export function saveGame(gamestate) {
  if (!gamestate) return false;
  try {
    const entry = {
      savedAt: Date.now(),
      state: gamestate,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
    return true;
  } catch (err) {
    console.error('[StateSync] Failed to save game:', err);
    return false;
  }
}

/**
 * Load the saved game state from localStorage.
 *
 * @param {number} [ttlMs]  Time-to-live in ms (default: 24h)
 * @returns {object|null}  The saved gamestate, or null if none / expired
 */
export function loadGame(ttlMs = DEFAULT_TTL_MS) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (!entry || !entry.state) return null;

    // Check TTL.
    if (Date.now() - entry.savedAt > ttlMs) {
      removeGame();
      return null;
    }

    const state = entry.state;

    // Reconstruct Date fields.
    state.lastModified = state.lastModified ? new Date(state.lastModified) : new Date();

    return state;
  } catch (err) {
    console.error('[StateSync] Failed to load game:', err);
    return null;
  }
}

/**
 * Check if a recoverable game exists (non-expired).
 *
 * @param {number} [ttlMs]
 * @returns {boolean}
 */
export function hasRecoverableGame(ttlMs = DEFAULT_TTL_MS) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    const entry = JSON.parse(raw);
    if (!entry) return false;

    if (Date.now() - entry.savedAt > ttlMs) {
      removeGame();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get metadata about the saved game (for display).
 *
 * @returns {{ savedAt: number, players: number, name: string } | null}
 */
export function getSavedGameInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (!entry || !entry.state) return null;

    return {
      savedAt: entry.savedAt,
      players: entry.state.players ? entry.state.players.length : 0,
      name: entry.state.name || 'Unknown game',
    };
  } catch {
    return null;
  }
}

/**
 * Remove the saved game from localStorage.
 */
export function removeGame() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(P2P_KEY); // Clean up P2P metadata too (Issue 5).
  } catch (err) {
    console.error('[StateSync] Failed to remove game:', err);
  }
}

// ---------------------------------------------------------------------------
// P2P reconnection metadata
// ---------------------------------------------------------------------------

const P2P_KEY = 'carcassonne_p2p';

/**
 * Save P2P connection metadata so the client can reconnect after a page refresh.
 * @param {{ room: string, playerIndex: number }} info
 */
export function saveP2pInfo(info) {
  try {
    localStorage.setItem(P2P_KEY, JSON.stringify(info));
  } catch (err) {
    console.error('[StateSync] Failed to save P2P info:', err);
  }
}

/**
 * Load saved P2P metadata (room code + player index).
 * @returns {{ room: string, playerIndex: number } | null}
 */
export function loadP2pInfo() {
  try {
    const raw = localStorage.getItem(P2P_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Remove saved P2P metadata.
 */
export function removeP2pInfo() {
  try {
    localStorage.removeItem(P2P_KEY);
  } catch (err) {
    console.error('[StateSync] Failed to remove P2P info:', err);
  }
}
