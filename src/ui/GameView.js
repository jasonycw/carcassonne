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
  setSelectedPlacement, getCurrentRotation, getSelectedMove,
  onTilePlaced, onRotationChanged,
} from '../rendering/ActiveTile.js';
import { placeTile } from '../game/GameLogic.js';
import { GameHost } from '../network/GameHost.js';
import { GameClient } from '../network/GameClient.js';
import { saveGame, removeGame } from '../network/StateSync.js';
import { renderScoreboard } from '../rendering/ScoreBoard.js';
import { ChatPanel } from './ChatPanel.js';
import { SettingsPanelUI, initSettings } from './SettingsPanel.js';

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
    </div>

    <!-- Scoreboard (rendered by ScoreBoard.js) -->
    <div id="game-scoreboard" style="
      position: absolute; top: 40px; left: 12px; right: 12px; z-index: 15;
      pointer-events: none;
    "></div>
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
    this.chatPanel = null;
    this.settingsPanel = null;
    this.gameHost = null;
    this.gameClient = null;
  }

  mount(container) {
    container.innerHTML = GAME_HTML;
    this.dom = {
      container,
      svg: container.querySelector('#game-svg'),
      turnIndicator: container.querySelector('#game-turn-indicator'),
      menuBtn: container.querySelector('#game-menu-btn'),
      scoreboard: container.querySelector('#game-scoreboard'),
      hud: container.querySelector('#game-hud'),
      rotateLeft: container.querySelector('#hud-rotate-left'),
      rotateRight: container.querySelector('#hud-rotate-right'),
      confirm: container.querySelector('#hud-confirm'),
      skip: container.querySelector('#hud-skip'),
    };

    this._bindEvents();

    // Initialise D3 board.
    initializeBoard(this.dom.svg);

    // Set up ActiveTile callbacks.
    onTilePlaced((x, y, rotation, meeple) => {
      this._handleTilePlacement(x, y, rotation, meeple);
    });

    onRotationChanged(() => {
      // Rotation is tracked internally by ActiveTile.
    });

    // Mount ChatPanel.
    this.chatPanel = new ChatPanel(this.dom.container);
    this.chatPanel.mount();
    this.chatPanel.on('send', (text) => {
      this._onChatSend(text);
    });

    // Mount SettingsPanel.
    this.settingsPanel = new SettingsPanelUI(this.dom.container);
    this.settingsPanel.mount();
    initSettings();

    // Draw initial board state.
    if (this.gamestate) {
      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();

      // Persist game state on first render (enables crash recovery).
      saveGame(this.gamestate);
    }

    // Wire up P2P orchestration layer.
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
          this.chatPanel.addMessage(payload.username, payload.message);
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
          this.chatPanel.addMessage(payload.username, payload.message);
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
    if (this.chatPanel) {
      this.chatPanel.destroy();
      this.chatPanel = null;
    }
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
      this.settingsPanel = null;
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

    this.dom.menuBtn.addEventListener('click', () => {
      // Toggle chat panel on click; settings accessible via keyboard shortcut.
      this.chatPanel.toggle();
    });

    // Ctrl+Shift+S opens settings.
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        this.settingsPanel.show();
      }
    });
  }

  // ── Board rendering ──────────────────────────────────────────────────

  _renderBoard() {
    const player = this.gamestate.players[this.playerIndex];
    const playerId = player?.user?._id || `player-${this.playerIndex}`;
    const isActive = player?.active || false;
    draw(this.gamestate, playerId, {
      onPlacementClick: (x, y, rotation) => {
        if (!isActive) return;
        this._pendingPlacement = { x, y, rotation };
        this._showActiveTileAt(x, y, rotation);
      },
      onZoom: () => {
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
    // Update scoreboard.
    if (this.dom && this.dom.scoreboard && this.gamestate) {
      renderScoreboard(
        this.dom.scoreboard,
        this.gamestate,
        this.gamestate.currentPlayerIndex,
        this.gamestate.finished,
      );
    }
  }

  _showActiveTileIfNeeded() {
    const at = this.gamestate.activeTile;
    const isActive = this.gamestate.players[this.playerIndex]?.active;
    if (at && at.tile && at.validPlacements && isActive) {
      if (this.dom) this.dom.hud.style.display = 'flex';
      const playerState = this.gamestate.players[this.playerIndex] || null;
      renderActiveTile(at.tile, at.validPlacements, playerState, this.dom.svg);
    }
  }

  _showActiveTileAt(x, y, rotation) {
    const at = this.gamestate.activeTile;
    if (!at || !at.tile) return;

    // Find the matching placement and set it.
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

      // Persist game state to localStorage (for crash recovery).
      saveGame(this.gamestate);

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
      // Include any meeple the player selected on the active tile.
      const selectedMove = getSelectedMove();
      const meeple = selectedMove ? selectedMove.meeple : null;
      this._handleTilePlacement(pp.x, pp.y, rot, meeple);
      this._pendingPlacement = null;
    }
  }

  // ── P2P sync (delegated to GameHost / GameClient) ──────────────────────

  // ── Chat ─────────────────────────────────────────────────────────────

  _onChatSend(text) {
    const username = this.config.localPlayers?.[this.playerIndex]?.user?.username || 'Player';
    this.chatPanel.addMessage(username, text);

    if (this.gameHost) {
      this.gameHost.broadcastChat(username, text);
    } else if (this.gameClient) {
      this.gameClient.sendChat(text);
    }
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
