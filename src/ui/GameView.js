/**
 * GameView.js — Main game screen.
 *
 * Integrates:
 *   - GameBoard.js (D3 SVG board rendering)
 *   - ActiveTile.js (floating tile + meeple placement)
 *   - GameLogic.js (game state machine)
 *   - PeerManager (P2P sync)
 *
 * @module GameView
 */

import * as d3 from 'd3';
import {
  initializeBoard, draw, clearBoard, getActiveTileGroups,
  setMeeplePlacementMode, meeplePlacementMode,
} from '../rendering/GameBoard.js';
import {
  renderActiveTile, resetActiveTile, updateMeeplePlacements,
  setSelectedPlacement, getCurrentRotation,
  onTilePlaced, onMeeplePlaced, onRotationChanged,
} from '../rendering/ActiveTile.js';
import { placeTile, drawTile } from '../game/GameLogic.js';
import { ALL_TILES as TILE_DATA } from '../game/TileData.js';
import { MessageType } from '../network/Protocol.js';

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

const GAME_HTML = `
<div id="game-container" style="
  position: absolute; inset: 0;
  background: #111; display: flex; flex-direction: column;
">
  <!-- Top bar -->
  <div id="game-top-bar" style="
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 12px; background: #1a1a2e; color: #eee;
    font-family: 'Segoe UI', sans-serif; font-size: 0.85rem;
    border-bottom: 1px solid #333; z-index: 10;
  ">
    <span id="game-title">Carcassonne</span>
    <span id="game-turn-indicator" style="opacity:0.7;"></span>
    <button id="game-menu-btn" style="
      background: none; border: 1px solid #555; color: #eee;
      padding: 4px 12px; border-radius: 4px; cursor: pointer;
    ">Menu</button>
  </div>

  <!-- Game board area -->
  <div id="game-board-area" style="flex:1; position: relative; overflow: hidden;">
    <svg id="game-svg" style="width:100%; height:100%;"></svg>

    <!-- Floating HUD buttons -->
    <div id="game-hud" style="
      position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
      display: none; gap: 8px; z-index: 20;
    ">
      <button class="hud-btn" id="hud-rotate-left" style="
        padding: 8px 16px; border-radius: 8px; border: 1px solid #4fc3f7;
        background: #16213e; color: #4fc3f7; cursor: pointer;
      ">↺ Rotate</button>
      <button class="hud-btn" id="hud-rotate-right" style="
        padding: 8px 16px; border-radius: 8px; border: 1px solid #4fc3f7;
        background: #16213e; color: #4fc3f7; cursor: pointer;
      ">Rotate ↻</button>
      <button class="hud-btn" id="hud-confirm" style="
        padding: 8px 16px; border-radius: 8px; border: none;
        background: #66bb6a; color: #111; font-weight: bold; cursor: pointer;
      ">Place Tile</button>
      <button class="hud-btn" id="hud-skip" style="
        padding: 8px 16px; border-radius: 8px; border: 1px solid #e57373;
        background: transparent; color: #e57373; cursor: pointer;
      ">Skip</button>
    </div>

    <!-- Chat panel (toggle) -->
    <div id="game-chat" style="
      position: absolute; bottom: 70px; right: 12px; width: 260px;
      background: rgba(26,26,46,0.92); border-radius: 8px;
      border: 1px solid #333; color: #ddd; font-size: 0.8rem;
      font-family: 'Segoe UI', sans-serif; display: none;
    ">
      <div id="chat-messages" style="height: 150px; overflow-y: auto; padding: 8px;"></div>
      <div style="display: flex; border-top: 1px solid #333;">
        <input id="chat-input" type="text" placeholder="Chat..."
          style="flex:1; padding: 6px 8px; border: none; background: transparent; color: #eee;" />
        <button id="chat-send" style="
          padding: 6px 12px; border: none; background: #4fc3f7; color: #111; cursor: pointer;
        ">Send</button>
      </div>
    </div>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// GameView
// ---------------------------------------------------------------------------

export class GameView {
  /**
   * @param {object}   config
   * @param {boolean}  config.isHost
   * @param {boolean}  config.isLocalGame
   * @param {object}   [config.peerManager]   P2P manager (null for local games)
   * @param {object}   config.localState       Game state (for host/local)
   * @param {number}   config.playerIndex      Viewing player's index
   * @param {Array}    config.localPlayers     Player list
   */
  constructor(config) {
    this.config = config;
    this.isHost = config.isHost;
    this.isLocalGame = config.isLocalGame;
    this.peerManager = config.peerManager || null;
    this.gamestate = config.localState || null;
    this.playerIndex = config.playerIndex;
    this.dom = null;
    this._callbacks = {};
    this._pendingPlacement = null;
    this._currentTileImage = null;
  }

  mount(container) {
    container.innerHTML = GAME_HTML;
    this.dom = {
      container,
      svg: container.querySelector('#game-svg'),
      turnIndicator: container.querySelector('#game-turn-indicator'),
      menuBtn: container.querySelector('#game-menu-btn'),
      hud: container.querySelector('#game-hud'),
      rotateLeft: container.querySelector('#hud-rotate-left'),
      rotateRight: container.querySelector('#hud-rotate-right'),
      confirm: container.querySelector('#hud-confirm'),
      skip: container.querySelector('#hud-skip'),
      chat: container.querySelector('#game-chat'),
      chatMessages: container.querySelector('#chat-messages'),
      chatInput: container.querySelector('#chat-input'),
      chatSend: container.querySelector('#chat-send'),
    };

    this._bindEvents();

    // Initialise D3 board.
    initializeBoard(this.dom.svg);

    // Set up ActiveTile callbacks.
    onTilePlaced((x, y, rotation, meeple) => {
      this._handleTilePlacement(x, y, rotation, meeple);
    });

    onMeeplePlaced((meepleData) => {
      if (this.gamestate.activeTile) {
        const at = this.gamestate.activeTile;
        const result = placeTile(this.gamestate, null, null, null, meepleData);
        // The actual tile placement with meeple.
        // meeple is handled inside placeTile directly via the move validation
      }
    });

    onRotationChanged((rotation) => {
      const hud = this.dom.hud;
      if (hud) {
        // Rotation is tracked internally by ActiveTile.
      }
    });

    // Draw initial board state.
    if (this.gamestate) {
      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();
    }

    // Set up P2P listeners.
    if (this.peerManager && !this.isLocalGame) {
      this._setupPeerListeners();
    }
  }

  destroy() {
    clearBoard();
    if (this.dom) {
      this.dom.container.innerHTML = '';
    }
  }

  _bindEvents() {
    if (!this.dom) return;

    this.dom.rotateLeft.addEventListener('click', () => {
      // Simulate scroll-wheel rotation left.
      const wheelEvent = new WheelEvent('wheel', { deltaY: -1 });
      const atGroups = getActiveTileGroups();
      if (atGroups && atGroups.activeTileGroup) {
        atGroups.activeTileGroup.node().dispatchEvent(wheelEvent);
      }
    });

    this.dom.rotateRight.addEventListener('click', () => {
      const wheelEvent = new WheelEvent('wheel', { deltaY: 1 });
      const atGroups = getActiveTileGroups();
      if (atGroups && atGroups.activeTileGroup) {
        atGroups.activeTileGroup.node().dispatchEvent(wheelEvent);
      }
    });

    this.dom.confirm.addEventListener('click', () => {
      this._confirmPlacement();
    });

    this.dom.skip.addEventListener('click', () => {
      if (this.gamestate && this.gamestate.activeTile) {
        // Discard tile and skip.
        this.gamestate.activeTile = null;
        this._syncState();
        resetActiveTile(this.dom.svg, true);
        this.dom.hud.style.display = 'none';
        drawTile(this.gamestate);
        this._renderBoard();
        this._showActiveTileIfNeeded();
      }
    });

    this.dom.menuBtn.addEventListener('click', () => {
      this.dom.chat.style.display =
        this.dom.chat.style.display === 'none' ? 'block' : 'none';
    });

    this.dom.chatSend.addEventListener('click', () => {
      this._sendChat();
    });
    this.dom.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._sendChat();
    });
  }

  // ── Board rendering ──────────────────────────────────────────────────

  _renderBoard() {
    const isActive = this.gamestate.players[this.playerIndex]?.active;
    draw(this.gamestate, `player-${this.playerIndex}`, {
      onPlacementClick: (x, y, rotation) => {
        if (!isActive) return;
        this._pendingPlacement = { x, y, rotation };
        this._showActiveTileAt(x, y, rotation);
      },
      onZoom: (transform) => {
        // ActiveTile repositioning handled by transform.
      },
    });
  }

  _updateTurnIndicator() {
    const p = this.gamestate.players[this.gamestate.currentPlayerIndex];
    if (this.dom && this.dom.turnIndicator) {
      this.dom.turnIndicator.textContent = p
        ? `${p.user.username}'s turn`
        : '';
    }
  }

  _showActiveTileIfNeeded() {
    const at = this.gamestate.activeTile;
    const isActive = this.gamestate.players[this.playerIndex]?.active;
    if (at && at.tile && at.validPlacements && isActive) {
      if (this.dom) this.dom.hud.style.display = 'flex';
      renderActiveTile(at.tile, at.validPlacements, null, this.dom.svg);
    }
  }

  _showActiveTileAt(x, y, rotation) {
    const at = this.gamestate.activeTile;
    if (!at || !at.tile) return;

    // Find the matching placement.
    const placement = at.validPlacements.find((p) => p.x === x && p.y === y);
    if (placement) {
      setSelectedPlacement(placement);
    }

    if (this.dom) this.dom.hud.style.display = 'flex';
  }

  // ── Tile placement (local) ───────────────────────────────────────────

  _handleTilePlacement(x, y, rotation, meeple) {
    const result = placeTile(this.gamestate, x, y, rotation, meeple);

    if (result.success) {
      resetActiveTile(this.dom.svg, false);
      if (this.dom) this.dom.hud.style.display = 'none';

      // Re-render and check for next tile.
      this._renderBoard();
      this._updateTurnIndicator();

      // Show the new active tile.
      this._showActiveTileIfNeeded();

      // Check game over.
      if (this.gamestate.finished) {
        this._showGameOver();
      }

      // Sync to P2P clients.
      this._syncState();
    }
  }

  _confirmPlacement() {
    // Use the pending placement from a highlight click, or the current
    // rotation / position from ActiveTile.
    const pp = this._pendingPlacement;
    if (pp) {
      const rot = getCurrentRotation();
      this._handleTilePlacement(pp.x, pp.y, rot, null);
      this._pendingPlacement = null;
    }
  }

  // ── P2P sync ─────────────────────────────────────────────────────────

  _setupPeerListeners() {
    if (!this.peerManager) return;

    if (this.isHost) {
      // Host: listen for client move requests.
      this.peerManager.on('message', (message) => {
        if (message.type === MessageType.PLACE_TILE && this.isHost) {
          const { x, y, rotation, meeple } = message.payload;
          const result = placeTile(this.gamestate, x, y, rotation, meeple);
          if (result.success) {
            this._renderBoard();
            this._updateTurnIndicator();
            this._syncState();
          }
          this.peerManager.send(
            this.peerManager.connections[0],
            { type: MessageType.MOVE_RESULT, payload: result },
          );
        }
      });
    } else {
      // Client: listen for state syncs from host.
      this.peerManager.on('msg:game_state_sync', (payload) => {
        this._applyRemoteState(payload.state);
      });

      this.peerManager.on('msg:game_over', (payload) => {
        this._applyRemoteState(payload.state);
        this._showGameOver();
      });
    }
  }

  _syncState() {
    if (this.isHost && this.peerManager && !this.isLocalGame) {
      this.peerManager.broadcastState(this.gamestate);
    }
  }

  _applyRemoteState(sanitized) {
    // Apply sanitized state to local gamestate.
    // This is a simplified merge — full state replace for clients.
    if (!this.gamestate) return;

    this.gamestate.players = sanitized.players;
    this.gamestate.currentPlayerIndex = sanitized.currentPlayerIndex;
    this.gamestate.step = sanitized.step;
    this.gamestate.finished = sanitized.finished;
    this.gamestate.messages = sanitized.messages || [];

    // Map placed tiles back (tileId → tile object).
    this.gamestate.placedTiles = (sanitized.placedTiles || []).map((pt) => {
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
          scored: m.scored,
        })),
        tower: pt.towerHeight != null ? { height: pt.towerHeight } : undefined,
        features: { cities: [], roads: [], farms: [], cloister: null },
        northTileIndex: undefined,
        southTileIndex: undefined,
        eastTileIndex: undefined,
        westTileIndex: undefined,
      };
    });

    // Rebuild adjacency indices.
    for (let i = 0; i < this.gamestate.placedTiles.length; i++) {
      const pt = this.gamestate.placedTiles[i];
      for (let j = 0; j < this.gamestate.placedTiles.length; j++) {
        if (i === j) continue;
        const ot = this.gamestate.placedTiles[j];
        if (ot.x === pt.x && ot.y === pt.y - 1) { pt.northTileIndex = j; }
        if (ot.x === pt.x && ot.y === pt.y + 1) { pt.southTileIndex = j; }
        if (ot.y === pt.y && ot.x === pt.x - 1) { pt.westTileIndex = j; }
        if (ot.y === pt.y && ot.x === pt.x + 1) { pt.eastTileIndex = j; }
      }
    }

    // Rebuild active tile.
    if (sanitized.activeTile) {
      const tileDef = TILE_DATA.find((t) => t.id === sanitized.activeTile.tileId) || {};
      this.gamestate.activeTile = {
        tile: tileDef,
        validPlacements: sanitized.activeTile.validPlacements || [],
      };
    } else {
      this.gamestate.activeTile = null;
    }

    this._renderBoard();
    this._updateTurnIndicator();

    // Show active tile if it's our turn.
    if (this.gamestate.players[this.playerIndex]?.active) {
      this._showActiveTileIfNeeded();
    } else {
      resetActiveTile(this.dom.svg, false);
      if (this.dom) this.dom.hud.style.display = 'none';
    }
  }

  // ── Chat ─────────────────────────────────────────────────────────────

  _sendChat() {
    const text = this.dom.chatInput.value.trim();
    if (!text) return;
    const username = this.config.localPlayers?.[this.playerIndex]?.user?.username || 'Player';
    this._addChatMessage(username, text);
    this.dom.chatInput.value = '';

    if (this.peerManager && !this.isLocalGame) {
      if (this.isHost) {
        this.peerManager.broadcast({
          type: MessageType.CHAT_MESSAGE,
          payload: { username, message: text, timestamp: Date.now() },
        });
      } else {
        this.peerManager.sendChat(text);
      }
    }
  }

  _addChatMessage(username, text) {
    const el = document.createElement('div');
    el.innerHTML = `<strong>${username}:</strong> ${text}`;
    el.style.margin = '2px 0';
    this.dom.chatMessages.appendChild(el);
    this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight;
  }

  // ── Game over ────────────────────────────────────────────────────────

  _showGameOver() {
    setTimeout(() => {
      const winner = this.gamestate.players.reduce((best, p) =>
        p.points > best.points ? p : best,
      );
      alert(`Game Over!\n\n${winner.user.username} wins with ${winner.points} points!`);
    }, 500);
  }
}
