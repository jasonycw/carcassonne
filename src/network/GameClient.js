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
      this._applyRemoteState(payload.state);
    });

    this.clientPeerManager.on('msg:game_over', (payload) => {
      this._applyRemoteState(payload.state || payload);
      this.emit('game-over');
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

    // Simple scalar/array fields
    gs.players = sanitized.players;
    gs.currentPlayerIndex = sanitized.currentPlayerIndex;
    gs.step = sanitized.step;
    gs.finished = sanitized.finished;
    gs.messages = sanitized.messages || [];

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

    this.emit('state-update', gs);
  }

  /** Clean up. */
  destroy() {
    this.removeAllListeners();
  }
}
