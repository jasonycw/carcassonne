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
  setMeeplePlacementMode, meeplePlacementMode,
} from '../rendering/GameBoard.js';
import {
  renderActiveTile, resetActiveTile, moveToBoardPosition,
  setSelectedPlacement, setRotationState, getCurrentRotation, getSelectedMove,
  updateBoardPosition, updateMeeplePlacements,
  showMeeplePlacements, hideMeeplePlacements,
  onTilePlaced, onRotationChanged,
} from '../rendering/ActiveTile.js';
import { img } from '../utils/AssetPaths.js';
import { placeTile, placeTowerPiece, captureMeeple, skipTowerStep, skipCapture } from '../game/GameLogic.js';
import { GameHost } from '../network/GameHost.js';
import { GameClient } from '../network/GameClient.js';
import { saveGame, removeGame } from '../network/StateSync.js';
import { renderScoreboard, getColorHex, escapeHtml } from '../rendering/ScoreBoard.js';
import { navigate } from './Router.js';
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
    <!-- Bug 11: Increase bottom spacing so HUD doesn't sit too low on mobile -->
    <!-- Bug 19: Enable wrapping so meeple selector doesn't overlap confirm button -->
    <div id="game-hud" style="
      position: absolute; bottom: 48px; left: 50%; transform: translateX(-50%);
      display: none; gap: 8px; z-index: 20; align-items: center;
      flex-wrap: wrap; justify-content: center; max-width: 95vw;
    ">
      <div id="hud-meeple-types" style="display:flex; gap:4px; align-items:center;"></div>
      <button class="hud-btn" id="hud-confirm" style="
        padding: 8px 16px; border-radius: 8px; border: none;
        background: #66bb6a; color: #111; font-weight: bold; cursor: pointer;
      ">Place Tile</button>
    </div>

    <!-- Scoreboard (rendered by ScoreBoard.js) -- vertical left-aligned -->
    <div id="game-scoreboard" style="
      position: absolute; top: 4px; left: 8px; z-index: 15;
      pointer-events: none;
    "></div>

    <!-- Game-over banner -->
    <div id="game-over-banner" style="
      position: absolute; top: 0; left: 0; right: 0; z-index: 50;
      display: none; pointer-events: auto;
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
    /** @type {''|'placement-selected'|'confirmed'|'sending'} */
    this._confirmPhase = '';
    this.chatPanel = null;
    this.settingsPanel = null;
    this.gameHost = null;
    this.gameClient = null;
  }

  mount(container) {
    // Prevent double game-over alert from STATE_UPDATE + GAME_OVER messages.
    this._gameOverShown = false;
    container.innerHTML = GAME_HTML;
    this.dom = {
      container,
      svg: container.querySelector('#game-svg'),
      turnIndicator: container.querySelector('#game-turn-indicator'),
      menuBtn: container.querySelector('#game-menu-btn'),
      scoreboard: container.querySelector('#game-scoreboard'),
      hud: container.querySelector('#game-hud'),
      meepleTypes: container.querySelector('#hud-meeple-types'),
      confirm: container.querySelector('#hud-confirm'),
    };

    this._bindEvents();

    // Initialise D3 board.
    initializeBoard(this.dom.svg);

    // Set up ActiveTile callbacks.
    onTilePlaced((x, y, rotation, meeple) => {
      this._handleTilePlacement(x, y, rotation, meeple);
    });

    onRotationChanged(() => {
      // If the player was in meeple-selection phase ('confirmed') and changes
      // rotation, reset to 'placement-selected' since meeple positions change.
      if (this._confirmPhase === 'confirmed') {
        this._confirmPhase = 'placement-selected';
        this._updateHUD('placement-selected');
        hideMeeplePlacements();
      }
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

    // Wire up P2P orchestration layer FIRST so that _getRemotePlayerIndices()
    // works correctly during the initial render (especially for Fix 3/4).
    if (this.peerManager && !this.isLocalGame) {
      if (this.isHost) {
        console.log('[GameView] Creating GameHost for P2P host');
        this.gameHost = new GameHost(this.peerManager, this.gamestate);
        this.gameHost.on('state-changed', () => {
          console.log('[GameView] Host state changed, re-rendering');
          this._renderBoard();
          this._updateTurnIndicator();
          this._showActiveTileIfNeeded();
        });
        this.gameHost.on('game-over', () => {
          console.log('[GameView] Host game over');
          this._showGameOver();
        });
        this.gameHost.on('chat-message', (payload) => {
          this.chatPanel.addMessage(payload.username, payload.message);
        });
      } else {
        console.log('[GameView] Creating GameClient for P2P client, playerIndex:', this.playerIndex);
        this.gameClient = new GameClient(this.peerManager, this.gamestate);
        this.gameClient.on('state-update', () => {
          console.log('[GameView] Client state update, re-rendering');
          this._renderBoard();
          this._updateTurnIndicator();
          this._showActiveTileIfNeeded();
          this._pendingPlacement = null;
          this._confirmPhase = '';
        });
        this.gameClient.on('game-over', () => {
          console.log('[GameView] Client game over');
          this._showGameOver();
        });
        this.gameClient.on('chat-message', (payload) => {
          this.chatPanel.addMessage(payload.username, payload.message);
        });
        this.gameClient.on('move-rejected', () => {
          console.log('[GameView] Move rejected by host');
          // _showActiveTileIfNeeded nulls _pendingPlacement, so save it first.
          const pending = this._pendingPlacement;
          this._renderBoard();
          this._updateTurnIndicator();
          this._showActiveTileIfNeeded();
          if (pending) {
            // Restore tile to the previously selected board position.
            this._showActiveTileAt(pending.x, pending.y, pending.rotation);
            // Restore the phase so the user can retry immediately.
            this._confirmPhase = 'confirmed';
            this._updateHUD('confirmed');
            showMeeplePlacements();
          }
          this._pendingPlacement = null;
          this._showStatusMessage('Placement rejected by host. Try a different position.');
        });
      }
    }

    // Draw initial board state (now with gameHost/gameClient initialized).
    if (this.gamestate) {
      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();

      // Persist game state on first render (enables crash recovery).
      saveGame(this.gamestate);
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
    // Sync playerIndex for P2P host mode with local slots (needed before
    // _updateTurnIndicator is called, since _renderBoard uses this.playerIndex
    // to determine isActive for the onPlacementClick callback).
    if (this.isHost && !this.isLocalGame && this.gamestate) {
      const remotePlayerIndices = this._getRemotePlayerIndices();
      if (!remotePlayerIndices.includes(this.gamestate.currentPlayerIndex)) {
        this.playerIndex = this.gamestate.currentPlayerIndex;
      }
    }

    const player = this.gamestate.players[this.playerIndex];
    const playerId = player?.user?._id || `player-${this.playerIndex}`;
    const isActive = player?.active || false;
    draw(this.gamestate, playerId, {
      onPlacementClick: (x, y, rotation) => {
        if (!isActive) return;
        if (this.gamestate.step !== 'place') return;
        this._pendingPlacement = { x, y, rotation };
        this._showActiveTileAt(x, y, rotation);
      },
      onTowerOutlineClick: (tileIndex) => {
        if (this.gamestate.step !== 'tower') return;
        this._handleTowerPiecePlacement(tileIndex);
      },
      onMeepleClick: (tileIndex, meepleIndex) => {
        if (this.gamestate.step !== 'capture') return;
        this._handleCaptureMeeple(tileIndex, meepleIndex);
      },
      onZoom: () => {
        updateBoardPosition();
      },
    }, this.gamestate.step, this.gamestate.pendingCapture);
  }

  _updateTurnIndicator() {
    // In local games (solo or hot-seat), the browser controls all players.
    // Sync the viewing player index to the current turn so controls show.
    if (this.isLocalGame && this.gamestate) {
      this.playerIndex = this.gamestate.currentPlayerIndex;
    }

    // In P2P host mode, if the current player slot is NOT controlled by a
    // remote client (i.e. it's a "missing slot"), the host can play for them
    // just like hot-seat mode. Sync playerIndex so the host sees valid
    // placements and the active tile UI.
    if (this.isHost && !this.isLocalGame && this.gamestate) {
      const remotePlayerIndices = this._getRemotePlayerIndices();
      if (!remotePlayerIndices.includes(this.gamestate.currentPlayerIndex)) {
        this.playerIndex = this.gamestate.currentPlayerIndex;
      }
    }

    const p = this.gamestate.players[this.gamestate.currentPlayerIndex];
    if (this.dom && this.dom.turnIndicator) {
      if (p) {
        const colorName = p.color || 'blue';
        const colorHex = getColorHex(colorName);
        this.dom.turnIndicator.innerHTML = `
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
               background:${colorHex};vertical-align:middle;margin-right:4px;"></span>
          ${escapeHtml(p.user?.username || 'Player')}'s turn
        `;
      } else {
        this.dom.turnIndicator.textContent = '';
      }
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

  /** Get the set of player indices controlled by remote P2P clients (host only). */
  _getRemotePlayerIndices() {
    if (!this.isHost || !this.gameHost) return [];
    const connected = this.gameHost.hostPeerManager?.connectedPlayers || [];
    return connected.map(p => p.playerIndex);
  }

  _showActiveTileIfNeeded() {
    const at = this.gamestate.activeTile;
    const isActive = this.gamestate.players[this.playerIndex]?.active;
    const step = this.gamestate.step;

    // Handle tower step: show tower HUD instead of tile HUD.
    if (step === 'tower' && isActive) {
      this._confirmPhase = '';
      this._pendingPlacement = null;
      if (this.dom) {
        this.dom.hud.style.display = 'flex';
        this.dom.meepleTypes.style.display = 'none';
      }
      this._updateHUD('tower');
      return;
    }

    // Handle capture step: show capture HUD.
    if (step === 'capture' && isActive) {
      this._showCaptureUI();
      return;
    }

    if (at && at.tile && at.validPlacements && isActive) {
      // Reset confirm phase and clear any stale meeple from a previous turn.
      this._confirmPhase = '';
      this._pendingPlacement = null;
      const sm = getSelectedMove();
      if (sm) sm.meeple = null;
      if (this.dom) {
        this.dom.hud.style.display = 'flex';
        // Show meeple type selector only when it's the viewer's turn
        this.dom.meepleTypes.style.display = 'flex';
      }
      const playerState = this.gamestate.players[this.playerIndex] || null;
      // Default meeple type to 'normal' for the next player's turn.
      setMeeplePlacementMode('normal');
      this._updateMeepleTypeSelector(playerState);
      renderActiveTile(at.tile, at.validPlacements, playerState, this.dom.svg);
      // Ensure meeple outlines reflect the default 'normal' type.
      updateMeeplePlacements(null, 'normal');
      // Default to "Place Tile" disabled until a board position is clicked
      this._updateHUD('default');
    } else {
      if (this.dom) this.dom.hud.style.display = 'none';
    }
  }

  _showActiveTileAt(x, y, rotation) {
    const at = this.gamestate.activeTile;
    if (!at || !at.tile) return;

    // Clear any previously selected meeple when changing board position.
    const sm = getSelectedMove();
    if (sm) sm.meeple = null;

    // Find the matching placement.
    const placement = at.validPlacements.find((p) => p.x === x && p.y === y);
    if (!placement || !placement.rotations || placement.rotations.length === 0) {
      // Even without valid rotations, pin the tile and show HUD.
      this._pendingPlacement = { x, y, rotation: 0 };
      setSelectedPlacement(placement);
      if (placement) {
        moveToBoardPosition(x, y, 0);
        // Do NOT show meeple outlines yet — they show after confirm.
        hideMeeplePlacements();
      }
      if (this.dom) this.dom.hud.style.display = 'flex';
      this._confirmPhase = 'placement-selected';
      this._updateHUD('placement-selected');
      return;
    }

    // Determine target rotation.
    // In the original game, clicking the same board position cycles rotation.
    const selectedMove = getSelectedMove();
    const currentPlacement = selectedMove ? selectedMove.placement : null;
    const isSamePlacement = currentPlacement && currentPlacement.x === x && currentPlacement.y === y;

    let targetRotation;
    if (isSamePlacement) {
      // Same placement clicked again → cycle to next valid rotation.
      const currentRot = getCurrentRotation();
      const currentIdx = placement.rotations.findIndex((r) => r.rotation === currentRot);
      const nextIdx = (currentIdx + 1) % placement.rotations.length;
      targetRotation = placement.rotations[nextIdx].rotation;
    } else {
      // First time clicking this placement → use first valid rotation.
      targetRotation = placement.rotations[0].rotation;
    }

    // Bug 1: Only update rotation STATE, not the DOM — the D3 transition
    // in moveToBoardPosition handles the visual animation.  If we call
    // setCurrentRotation here, the rotation group's transform is set
    // immediately, making the subsequent transition a no-op with zoom=1,
    // which causes an immediate on('end') firing (premature indicator).
    setRotationState(targetRotation);
    setSelectedPlacement(placement);

    // Animate the active tile from corner to the board position.
    moveToBoardPosition(x, y, targetRotation);

    // Do NOT show meeple outlines yet — they show only after the player
    // clicks "Place Tile" (confirm step) to lock in the rotation.
    hideMeeplePlacements();

    if (this.dom) {
      this.dom.hud.style.display = 'flex';
      this.dom.meepleTypes.style.display = 'flex';
    }
    this._confirmPhase = 'placement-selected';
    this._updateHUD('placement-selected');
  }

  // ── Tile placement ──────────────────────────────────────────────────

  _handleTilePlacement(x, y, rotation, meeple) {
    if (this.gameClient) {
      // P2P client: send move to host (host validates + broadcasts back)
      this.gameClient.placeTile(x, y, rotation, meeple);
      // Show a brief "waiting for host" state
      if (this.dom) this.dom.hud.style.display = 'none';
      resetActiveTile(this.dom.svg, true);
      return true;
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

    return result.success;
  }

  _confirmPlacement() {
    // Prevent re-entry while waiting for P2P host response.
    if (this._confirmPhase === 'sending') return;

    const step = this.gamestate.step;

    // Tower step: skip tower placement (go to meeple placement).
    if (step === 'tower') {
      this._handleSkipTower();
      return;
    }

    // Capture step: skip capture.
    if (step === 'capture') {
      this._handleSkipCapture();
      return;
    }

    const pp = this._pendingPlacement;
    if (!pp) return;

    const selectedMove = getSelectedMove();

    if (this._confirmPhase === 'placement-selected') {
      // Phase 1 → Phase 2: player confirmed the rotation.
      // Show meeple outlines and change button to "Send Move".
      showMeeplePlacements();
      this._confirmPhase = 'confirmed';
      this._updateHUD('confirmed');
      return;
    }

    if (this._confirmPhase === 'confirmed') {
      // Phase 2 → Phase 3: player is sending the move.
      const rot = getCurrentRotation();
      const meeple = selectedMove ? selectedMove.meeple : null;
      const ok = this._handleTilePlacement(pp.x, pp.y, rot, meeple);

      if (this.gameClient) {
        // P2P client: wait for host response before advancing.
        // Keep _pendingPlacement set so move-rejected can restore.
        this._confirmPhase = 'sending';
      } else if (ok) {
        // Host/solo: placement succeeded, clear state for next turn.
        this._pendingPlacement = null;
        this._confirmPhase = '';
      } else {
        // Host/solo: placement failed — show error, let user retry.
        this._showStatusMessage('Invalid placement! Please try a different position.');
      }
      return;
    }
  }

  /** Skip the tower step and proceed to meeple placement or end turn. */
  _handleSkipTower() {
    if (this.gameClient) {
      // P2P client: tell host we're skipping the tower step.
      this.gameClient.placeTowerPiece(-1); // -1 = skip
      if (this.dom) this.dom.hud.style.display = 'none';
      return;
    }

    const result = skipTowerStep(this.gamestate);
    if (result.success) {
      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();
      saveGame(this.gamestate);

      if (this.gamestate.finished) {
        this._showGameOver();
      }

      if (this.gameHost) {
        this.gameHost.broadcastState();
      }
    }
  }

  /** Skip the capture step (decline to capture any meeple). */
  _handleSkipCapture() {
    const result = skipCapture(this.gamestate);
    if (result.success) {
      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();
      saveGame(this.gamestate);

      if (this.gamestate.finished) {
        this._showGameOver();
      }

      if (this.gameHost) {
        this.gameHost.broadcastState();
      }
    }
  }

  /** Update the HUD button state based on the current game phase. */
  _updateHUD(phase) {
    if (!this.dom || !this.dom.confirm) return;
    const btn = this.dom.confirm;
    switch (phase) {
      case 'placement-selected':
        // Phase 1: confirm the rotation before showing meeple outlines.
        btn.textContent = 'Place Tile';
        btn.style.background = '#66bb6a';
        btn.style.color = '#111';
        btn.disabled = false;
        break;
      case 'confirmed':
        // Phase 2: rotation confirmed, meeple outlines shown, ready to send.
        btn.textContent = 'Send Move';
        btn.style.background = '#ffa726';
        btn.style.color = '#111';
        btn.disabled = false;
        break;
      case 'tower':
        // Tower step: offer to skip tower placement.
        btn.textContent = 'Skip (Place Meeple)';
        btn.style.background = '#78909c';
        btn.style.color = '#fff';
        btn.disabled = false;
        break;
      case 'capture':
        // Capture step: done capturing.
        btn.textContent = 'Skip Capture';
        btn.style.background = '#78909c';
        btn.style.color = '#fff';
        btn.disabled = false;
        break;
      default:
        btn.textContent = 'Place Tile';
        btn.style.background = '#555';
        btn.style.color = '#888';
        btn.disabled = true;
        break;
    }
  }

  // ── Tower / Capture step handlers ────────────────────────────────────

  /**
   * Handle a tower outline click during the tower step.
   * Places a tower piece on the clicked tile.
   */
  _handleTowerPiecePlacement(tileIndex) {
    if (this.gameClient) {
      // P2P client: send tower placement to host.
      this.gameClient.placeTowerPiece(tileIndex);
      if (this.dom) this.dom.hud.style.display = 'none';
      return;
    }

    // Host/solo: validate locally.
    const result = placeTowerPiece(this.gamestate, tileIndex);

    if (result.success) {
      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();
      saveGame(this.gamestate);

      if (this.gamestate.finished) {
        this._showGameOver();
      }

      // Broadcast to P2P peers.
      if (this.gameHost) {
        this.gameHost.broadcastState();
      }
    } else {
      this._showStatusMessage(result.message || 'Cannot place tower piece');
    }
  }

  /**
   * Show the capture-step UI — highlights capturable meeples.
   * The player clicks a capturable meeple to capture it.
   */
  _showCaptureUI() {
    if (this.dom) {
      this.dom.hud.style.display = 'flex';
      this.dom.meepleTypes.style.display = 'none';
    }
    this._updateHUD('capture');

    // The capturable meeples are highlighted by GameBoard.js based on
    // gamestate.pendingCapture.capturableMeeples — re-render to show them.
    this._renderBoard();
  }

  /**
   * Handle a click on a capturable meeple (during capture step).
   * Captures the meeple and advances the turn.
   */
  _handleCaptureMeeple(tileIndex, meepleIndex) {
    if (this.gameClient) {
      this.gameClient.captureMeeple(tileIndex, meepleIndex);
      if (this.dom) this.dom.hud.style.display = 'none';
      return;
    }

    const result = captureMeeple(this.gamestate, tileIndex, meepleIndex);

    if (result.success) {
      this._renderBoard();
      this._updateTurnIndicator();
      this._showActiveTileIfNeeded();
      saveGame(this.gamestate);

      if (this.gamestate.finished) {
        this._showGameOver();
      }

      if (this.gameHost) {
        this.gameHost.broadcastState();
      }
    } else {
      this._showStatusMessage(result.message || 'Cannot capture meeple');
    }
  }

  /** Show a temporary status message overlay over the board area. */
  _showStatusMessage(msg) {
    const area = this.dom && this.dom.container.querySelector('#game-board-area');
    if (!area) return;
    const prev = area.querySelector('.game-status-message');
    if (prev) prev.remove();
    const el = document.createElement('div');
    el.className = 'game-status-message';
    el.textContent = msg || '';
    Object.assign(el.style, {
      position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.85)', color: '#ff6b6b',
      padding: '8px 20px', borderRadius: '8px', fontSize: '0.9rem',
      fontFamily: "'Segoe UI', sans-serif", zIndex: '100',
      pointerEvents: 'none', whiteSpace: 'nowrap',
    });
    area.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity 0.3s';
      el.style.opacity = '0';
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }, 3000);
  }

  /**
   * Populate the meeple-type image selector in the HUD with the current
   * player's available meeple types (normal, large, builder, pig).
   * Clicking a meeple image changes the active placement mode.
   */
  _updateMeepleTypeSelector(playerState) {
    const container = this.dom && this.dom.meepleTypes;
    if (!container || !playerState) return;

    const colorName = ({ '#e74c3c': 'red', '#3498db': 'blue', '#2ecc71': 'green',
      '#f39c12': 'yellow', '#9b59b6': 'purple', '#1abc9c': 'gray' })[playerState.color]
      || playerState.color || 'blue';

    const types = [];
    if (playerState.remainingMeeples > 0) types.push('normal');
    if (playerState.hasLargeMeeple) types.push('large');
    if (playerState.hasBuilderMeeple) types.push('builder');
    if (playerState.hasPigMeeple) types.push('pig');

    const mode = meeplePlacementMode;

    container.innerHTML = types.map((type) => {
      // Large meeples reuse the standing meeple image (rendered larger on board).
      const suffix = type === 'normal' || type === 'large' ? 'standing' : type;
      const src = img(`/images/meeples/${colorName}_${suffix}.png`);
      const active = type === mode;
      // Bug 15: Large meeples show bigger in the selector
      const iconSize = type === 'large' ? '36px' : '28px';
      return `<img src="${src}" data-type="${type}" class="meeple-type-btn"
        style="width:${iconSize}; height:${iconSize}; cursor:pointer; border-radius:4px;
               border:${active ? '2px solid #4fc3f7' : '2px solid transparent'};
               opacity:${active ? '1' : '0.5'};
               background:rgba(255,255,255,0.1);" />`;
    }).join('');

    container.querySelectorAll('.meeple-type-btn').forEach((imgEl) => {
      imgEl.addEventListener('click', () => {
        const type = imgEl.dataset.type;
        setMeeplePlacementMode(type);
        // Clear any previously selected meeple when switching types.
        const move = getSelectedMove();
        if (move) move.meeple = null;
        // Update visual highlight.
        container.querySelectorAll('.meeple-type-btn').forEach((b) => {
          b.style.border = '2px solid transparent';
          b.style.opacity = '0.5';
        });
        imgEl.style.border = '2px solid #4fc3f7';
        imgEl.style.opacity = '1';
        // Refresh meeple outlines with the new type.
        updateMeeplePlacements(null, type);
      });
    });
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
    if (this._gameOverShown) return;
    this._gameOverShown = true;

    // Clear saved state — game is done.
    removeGame();

    this._renderGameOverBanner();
  }

  /**
   * Render the game-over banner at the top of the game board area.
   * Shows the winner, their score, and a button to return to the lobby.
   */
  _renderGameOverBanner() {
    const banner = this.dom && this.dom.container.querySelector('#game-over-banner');
    if (!banner) return;

    const winner = this.gamestate.players.reduce((best, p) =>
      p.points > best.points ? p : best,
    );
    const colorName = winner.color || 'blue';
    const colorHex = getColorHex(colorName);

    // Also re-render the scoreboard with gameOver=true (disables active highlight)
    if (this.dom && this.dom.scoreboard) {
      renderScoreboard(
        this.dom.scoreboard,
        this.gamestate,
        this.gamestate.currentPlayerIndex,
        true,
      );
    }

    banner.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%);
        color: #fff; padding: 16px 20px; text-align: center;
        font-family: 'Segoe UI', sans-serif;
        border-bottom: 3px solid #4caf50;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      ">
        <div style="font-size:1.4rem; font-weight:bold; margin-bottom:4px;">
          🏆 Game Over!
        </div>
        <div style="font-size:1.1rem; display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:10px;">
          <span style="
            display:inline-block; width:14px; height:14px; border-radius:50%;
            background:${colorHex};
          "></span>
          <span style="font-weight:bold;">${escapeHtml(winner.user?.username || 'Player')}</span>
          wins with <span style="font-weight:bold;">${winner.points}</span> points!
        </div>
        <button id="game-over-lobby-btn" style="
          background: rgba(255,255,255,0.2); border: 2px solid rgba(255,255,255,0.5);
          color: #fff; padding: 8px 24px; border-radius: 8px;
          font-size:0.95rem; font-weight:bold; cursor: pointer;
          transition: all 0.2s;
        ">Back to Lobby</button>
      </div>
    `;

    // Wire up the lobby button.
    const btn = banner.querySelector('#game-over-lobby-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        navigate('/');
      });
    }

    banner.style.display = 'block';
  }
}
