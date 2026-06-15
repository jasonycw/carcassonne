/**
 * GameClient.js — Client-side P2P game client for Carcassonne.
 *
 * Wraps ClientPeerManager to listen for state updates from the host,
 * reconstruct the full game state from the sanitized projection, and
 * emit events for the GameView UI.
 *
 * Also provides convenience methods for sending moves to the host.
 *
 * @module GameClient
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { ALL_TILES as TILE_DATA } from '../game/TileData.js';
import { saveGame } from './StateSync.js';

export class GameClient extends EventEmitter {
  /**
   * @param {object} clientPeerManager  ClientPeerManager instance
   * @param {object} gamestate          Local mutable game state (updated in place on sync)
   */
  constructor(clientPeerManager, gamestate) {
    super();
    this.clientPeerManager = clientPeerManager;
    this.gamestate = gamestate;
    this._init();
  }

  /** Set up listeners for state syncs and game events from the host. */
  _init() {
    this.clientPeerManager.on('msg:game_state_sync', (payload) => {
      console.log('[GameClient] Received game_state_sync', {
        tileCount: payload.state?.placedTiles?.length,
        currentPlayer: payload.state?.currentPlayerIndex,
        step: payload.state?.step,
        activeTile: payload.state?.activeTile?.tileId,
      });
      this._applyRemoteState(payload.state);
    });

    this.clientPeerManager.on('msg:game_over', (payload) => {
      console.log('[GameClient] Received game_over');
      // _applyRemoteState emits 'game-over' when it detects finished=true,
      // so no separate emit needed here.
      this._applyRemoteState(payload.state || payload);
    });

    this.clientPeerManager.on('msg:chat_message', (payload) => {
      this.emit('chat-message', payload);
    });

    this.clientPeerManager.on('msg:move_result', (payload) => {
      if (!payload.success) {
        this.emit('move-rejected', payload);
      }
    });
  }

  // ── Move sending ────────────────────────────────────────────────────

  /** Send a PLACE_TILE move to the host. */
  placeTile(x, y, rotation, meeple) {
    this.clientPeerManager.placeTile(x, y, rotation, meeple);
  }

  /** Send a PLACE_MEEPLE move to the host. */
  placeMeeple(tileIndex, locationType, index, meepleType) {
    this.clientPeerManager.placeMeeple(tileIndex, locationType, index, meepleType);
  }

  /** Send SKIP_MEEPLE to the host. */
  skipMeeple() {
    this.clientPeerManager.skipMeeple();
  }

  /** Send SKIP_TURN to the host. */
  skipTurn() {
    this.clientPeerManager.skipTurn();
  }

  /** Send a chat message to the host. */
  sendChat(text) {
    this.clientPeerManager.sendChat(text);
  }

  // ── State reconstruction ────────────────────────────────────────────

  /**
   * Apply a sanitized state from the host to the local gamestate.
   * Reconstructs full tile objects, rebuilds adjacency indices, and
   * emits 'state-update' when done.
   *
   * @param {object} sanitized  Sanitized state from HostPeerManager._sanitizeState()
   */
  _applyRemoteState(sanitized) {
    if (!this.gamestate || !sanitized) return;

    const gs = this.gamestate;
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'];

    // Reconstruct players with proper nested format (user.username / user._id)
    // because GameView expects p.user.username and p.user._id for rendering.
    gs.name = sanitized.name || gs.name;
    gs.expansions = sanitized.expansions || gs.expansions || ['base-game'];
    gs.players = (sanitized.players || []).map((p, i) => ({
      user: {
        username: p.username || `Player ${i}`,
        _id: `client-player-${i}`,
      },
      color: p.color || colors[i % colors.length],
      points: p.points || 0,
      remainingMeeples: p.remainingMeeples != null ? p.remainingMeeples : 7,
      active: p.active || false,
      hasLargeMeeple: p.hasLargeMeeple != null ? p.hasLargeMeeple : (gs.expansions).includes('inns-and-cathedrals'),
      hasBuilderMeeple: p.hasBuilderMeeple != null ? p.hasBuilderMeeple : (gs.expansions).includes('traders-and-builders'),
      hasPigMeeple: p.hasPigMeeple != null ? p.hasPigMeeple : (gs.expansions).includes('traders-and-builders'),
      goods: p.goods || {},
      towers: p.towers || 0,
      capturedMeeples: [],
      acknowledgedGameEnd: false,
    }));
    gs.currentPlayerIndex = sanitized.currentPlayerIndex;
    gs.step = sanitized.step;
    gs.finished = sanitized.finished;
    gs.messages = sanitized.messages || [];

    // Update unused tile count for display (actual tiles stay on host).
    const count = sanitized.unusedTilesCount != null ? sanitized.unusedTilesCount : 0;
    gs.unusedTiles = new Array(count).fill(null);

    // Reconstruct placed tiles from tile ID projection
    gs.placedTiles = (sanitized.placedTiles || []).map((pt) => {
      const tileDef = TILE_DATA.find((t) => t.id === pt.tileId) || {};
      return {
        tile: tileDef,
        rotation: pt.rotation,
        x: pt.x,
        y: pt.y,
        playerIndex: pt.playerIndex,
        meeples: (pt.meeples || []).map((m) => ({
          playerIndex: m.playerIndex,
          placement: m.placement,
          meepleType: m.meepleType,
          scored: m.scored !== false,
        })),
        tower: pt.towerHeight != null ? { height: pt.towerHeight } : undefined,
        features: { cities: [], roads: [], farms: [], cloister: null },
        northTileIndex: undefined,
        southTileIndex: undefined,
        eastTileIndex: undefined,
        westTileIndex: undefined,
      };
    });

    // Rebuild adjacency indices
    for (let i = 0; i < gs.placedTiles.length; i++) {
      const pt = gs.placedTiles[i];
      for (let j = 0; j < gs.placedTiles.length; j++) {
        if (i === j) continue;
        const ot = gs.placedTiles[j];
        if (ot.x === pt.x && ot.y === pt.y - 1) pt.northTileIndex = j;
        if (ot.x === pt.x && ot.y === pt.y + 1) pt.southTileIndex = j;
        if (ot.y === pt.y && ot.x === pt.x - 1) pt.westTileIndex = j;
        if (ot.y === pt.y && ot.x === pt.x + 1) pt.eastTileIndex = j;
      }
    }

    // Rebuild active tile
    if (sanitized.activeTile && sanitized.activeTile.tileId) {
      const tileDef = TILE_DATA.find((t) => t.id === sanitized.activeTile.tileId) || {};
      gs.activeTile = {
        tile: tileDef,
        validPlacements: sanitized.activeTile.validPlacements || [],
      };
    } else {
      gs.activeTile = null;
    }

    // Persist synced state for crash recovery (Bug 24).
    saveGame(gs);

    this.emit('state-update', gs);

    // Detect game-over from finished flag so clients show the summary.
    if (gs.finished) {
      this.emit('game-over', gs);
    }
  }

  /** Clean up. */
  destroy() {
    this.removeAllListeners();
  }
}
