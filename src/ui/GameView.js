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

import {
  initializeBoard, draw, clearBoard, getActiveTileGroups,
} from '../rendering/GameBoard.js';
import {
  renderActiveTile, resetActiveTile,
  setSelectedPlacement, getCurrentRotation,
  onTilePlaced, onRotationChanged,
} from '../rendering/ActiveTile.js';
import { placeTile, drawTile } from '../game/GameLogic.js';
import { GameHost } from '../network/GameHost.js';
import { GameClient } from '../network/GameClient.js';
import { removeGame } from '../network/StateSync.js';

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
        // Meeple is handled inside placeTile directly via the move validation
      }
    });

    onRotationChanged(() => {
      // Rotation is tracked internally by ActiveTile.
    });

    // Draw initial board state.
    if (this.gamestate) {
      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();
    }

    // Wire up P2P orchestration layer.
    this.gameHost = null;
    this.gameClient = null;

    if (this.peerManager && !this.isLocalGame) {
      if (this.isHost) {
        this.gameHost = new GameHost(this.peerManager, this.gamestate);
        this.gameHost.on('state-changed', () => {
          this._renderBoard();
          this._updateTurnIndicator();
          this._showActiveTileIfNeeded();
        });
        this.gameHost.on('game-over', () => {
          this._showGameOver();
        });
        this.gameHost.on('chat-message', (payload) => {
          this._addChatMessage(payload.username, payload.message);
        });
      } else {
        this.gameClient = new GameClient(this.peerManager, this.gamestate);
        this.gameClient.on('state-update', () => {
          this._renderBoard();
          this._updateTurnIndicator();
          this._showActiveTileIfNeeded();
        });
        this.gameClient.on('game-over', () => {
          this._showGameOver();
        });
        this.gameClient.on('chat-message', (payload) => {
          this._addChatMessage(payload.username, payload.message);
        });
      }
    }
  }

  destroy() {
    if (this.gameHost) {
      this.gameHost.destroy();
      this.gameHost = null;
    }
    if (this.gameClient) {
      this.gameClient.destroy();
      this.gameClient = null;
    }
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
        if (this.gameClient) {
          // P2P client: send skip-turn to host.
          this.gameClient.skipTurn();
          resetActiveTile(this.dom.svg, true);
          this.dom.hud.style.display = 'none';
          return;
        }

        // Host or solo: discard tile and skip locally.
        this.gamestate.activeTile = null;
        resetActiveTile(this.dom.svg, true);
        this.dom.hud.style.display = 'none';
        drawTile(this.gamestate);
        this._renderBoard();
        this._showActiveTileIfNeeded();

        // Broadcast state to peers.
        if (this.gameHost) {
          this.gameHost.broadcastState();
        }
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

  // ── Tile placement ──────────────────────────────────────────────────

  _handleTilePlacement(x, y, rotation, meeple) {
    if (this.gameClient) {
      // P2P client: send move to host (host validates + broadcasts back)
      this.gameClient.placeTile(x, y, rotation, meeple);
      // Show a brief "waiting for host" state
      if (this.dom) this.dom.hud.style.display = 'none';
      resetActiveTile(this.dom.svg, true);
      return;
    }

    // Host or solo mode: validate locally.
    const result = placeTile(this.gamestate, x, y, rotation, meeple);

    if (result.success) {
      resetActiveTile(this.dom.svg, false);
      if (this.dom) this.dom.hud.style.display = 'none';

      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();

      if (this.gamestate.finished) {
        this._showGameOver();
      }

      // Broadcast state to connected peers (if P2P host).
      if (this.gameHost) {
        this.gameHost.broadcastState();
      }
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

  // ── P2P sync (delegated to GameHost / GameClient) ──────────────────────

  // ── Chat ─────────────────────────────────────────────────────────────

  _sendChat() {
    const text = this.dom.chatInput.value.trim();
    if (!text) return;
    const username = this.config.localPlayers?.[this.playerIndex]?.user?.username || 'Player';
    this._addChatMessage(username, text);
    this.dom.chatInput.value = '';

    if (this.gameHost) {
      this.gameHost.broadcastChat(username, text);
    } else if (this.gameClient) {
      this.gameClient.sendChat(text);
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
    // Clear saved state — game is done.
    removeGame();

    setTimeout(() => {
      const winner = this.gamestate.players.reduce((best, p) =>
        p.points > best.points ? p : best,
      );
      alert(`Game Over!\n\n${winner.user.username} wins with ${winner.points} points!`);
    }, 500);
  }
}
