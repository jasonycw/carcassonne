/**
 * LobbyView.js — Create / join game lobby.
 *
 * Shows:
 *   1. Create Game form (player name, expansions, player count)
 *   2. Join Game form (room code)
 *   3. Lobby state when hosting (waiting for players)
 *
 * @module LobbyView
 */

import { navigate } from './Router.js';
import { EventEmitter } from '../utils/EventEmitter.js';
import {
  generateRoomCode,
  roomCodeToPeerId,
  HostPeerManager,
  ClientPeerManager,
} from '../network/PeerManager.js';
import {
  MessageType,
  joinRequest,
  createMessage,
} from '../network/Protocol.js';
import { createGameState, initializeNewGame } from '../game/GameLogic.js';
import { ALL_TILES as TILE_DATA } from '../game/TileData.js';
import { hasRecoverableGame, getSavedGameInfo, loadGame, removeGame } from '../network/StateSync.js';
import { img } from '../utils/AssetPaths.js';

// ---------------------------------------------------------------------------
// HTML templates (simple innerHTML — no build step needed)
// ---------------------------------------------------------------------------

const LOBBY_HTML = `
<div id="lobby-container" style="
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background-repeat: repeat; color: #eee; font-family: 'Segoe UI', sans-serif;
">
  <div style="max-width: 480px; width: 100%; padding: 24px; background: rgba(26, 26, 46, 0.9); border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);">

    <h1 style="text-align:center; margin-bottom: 24px; font-size: 2.2rem;">
      🏰 Carcassonne
    </h1>

    <!-- Resume game banner (shown when recoverable state exists) -->
    <div id="resume-banner" style="display: none; margin-bottom: 16px; padding: 12px; border-radius: 8px; background: #2e7d32; color: #fff; text-align: center; font-size: 0.85rem;"></div>

    <!-- Room code display (shown when hosting) -->
    <div id="room-display" style="display: none; text-align: center; margin-bottom: 20px;">
      <p style="font-size: 0.9rem; opacity: 0.7;">Share this code with friends:</p>
      <div id="room-code" style="
        font-size: 2.8rem; font-weight: bold; letter-spacing: 12px;
        background: #16213e; border-radius: 12px; padding: 12px 24px;
        margin: 8px 0; font-family: monospace;
      "></div>
      <p style="font-size: 0.8rem; opacity: 0.5;">
        <a href="#" id="copy-room-link" style="color: #4fc3f7;">Copy invite link</a>
      </p>
    </div>

    <!-- Create / Join forms -->
    <div id="lobby-forms">
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <input id="player-name" type="text" placeholder="Your name"
          style="flex:1; padding: 10px; border-radius: 8px; border: 1px solid #444; background: #16213e; color: #eee; font-size: 1rem;" />
        <select id="player-count"
          style="padding: 10px; border-radius: 8px; border: 1px solid #444; background: #16213e; color: #eee; font-size: 1rem;">
          <option value="1">Solo</option>
          <option value="2" selected>2 Players</option>
          <option value="3">3 Players</option>
          <option value="4">4 Players</option>
          <option value="5">5 Players</option>
          <option value="6">6 Players</option>
        </select>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
          <input type="checkbox" value="inns-and-cathedrals" /> Inns &amp; Cathedrals
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
          <input type="checkbox" value="traders-and-builders" /> Traders &amp; Builders
        </label>
        <label style="display: flex; align-items: center; gap: 6px; font-size: 0.85rem;">
          <input type="checkbox" value="the-tower" /> The Tower
        </label>
      </div>

      <div style="display: flex; gap: 12px;">
        <button id="create-game-btn"
          style="flex:1; padding: 12px; border-radius: 8px; border: none; background: #4fc3f7; color: #111; font-weight: bold; font-size: 1rem; cursor: pointer;">
          Create Game
        </button>
        <button id="join-game-btn"
          style="flex:1; padding: 12px; border-radius: 8px; border: 1px solid #4fc3f7; background: transparent; color: #4fc3f7; font-weight: bold; font-size: 1rem; cursor: pointer;">
          Join Game
        </button>
      </div>

      <div id="join-form" style="display: none; margin-top: 16px; gap: 8px; flex-direction: column;">
        <input id="room-code-input" type="text" placeholder="Room code (e.g. X4ZQ)" maxlength="4"
          style="padding: 10px; border-radius: 8px; border: 1px solid #444; background: #16213e; color: #eee; font-size: 1.5rem; text-align: center; letter-spacing: 8px; text-transform: uppercase; font-family: monospace;" />
      </div>
    </div>

    <!-- Lobby player list (shown when hosting and players join) -->
    <div id="lobby-players" style="display: none; margin-top: 20px;">
      <h3 style="margin-bottom: 12px;">Players</h3>
      <ul id="player-list" style="list-style: none; padding: 0;"></ul>
      <button id="start-game-btn"
        style="width:100%; margin-top: 16px; padding: 12px; border-radius: 8px; border: none; background: #66bb6a; color: #111; font-weight: bold; font-size: 1rem; cursor: pointer;">
        Start Game
      </button>
    </div>

    <div id="lobby-status" style="margin-top: 12px; text-align: center; font-size: 0.85rem; opacity: 0.6;"></div>
  </div>
</div>
`;

// ---------------------------------------------------------------------------
// LobbyView
// ---------------------------------------------------------------------------

export class LobbyView extends EventEmitter {
  constructor(container) {
    super();
    this.container = container;
    this.dom = null;
    this.peerManager = null;
    this.isHost = false;
    this.roomCode = null;
    this.players = [];
    /**
     * Slot-based player list for multiplayer lobby.
     * Each slot: { playerIndex, name, type: 'host'|'unfilled'|'remote' }
     * - 'host': the room creator (local)
     * - 'unfilled': an empty slot that hasn't been filled by a remote joiner
     * - 'remote': filled by a P2P-connected player
     */
    this.slots = [];
    /** Map conn → slot index for tracking disconnect/remotes. */
    this._connToSlot = new Map();
    /** Index of the local player in the slots array. */
    this.localPlayerIndex = 0;
  }

  mount(routerParams) {
    this.container.innerHTML = LOBBY_HTML;
    
    // Set background image for lobby with tiling pattern
    const lobbyContainer = this.container.querySelector('#lobby-container');
    if (lobbyContainer) {
      lobbyContainer.style.backgroundImage = `url('${img('/images/ui/bg.jpg')}')`;
      lobbyContainer.style.backgroundRepeat = 'repeat';
      lobbyContainer.style.backgroundSize = 'auto';
      lobbyContainer.style.backgroundPosition = '0 0';
      lobbyContainer.style.backgroundAttachment = 'scroll';
    }
    
    this.dom = {
      roomDisplay: this.container.querySelector('#room-display'),
      roomCode: this.container.querySelector('#room-code'),
      copyLink: this.container.querySelector('#copy-room-link'),
      playerName: this.container.querySelector('#player-name'),
      playerCount: this.container.querySelector('#player-count'),
      createBtn: this.container.querySelector('#create-game-btn'),
      joinBtn: this.container.querySelector('#join-game-btn'),
      joinForm: this.container.querySelector('#join-form'),
      roomCodeInput: this.container.querySelector('#room-code-input'),
      lobbyPlayers: this.container.querySelector('#lobby-players'),
      playerList: this.container.querySelector('#player-list'),
      startBtn: this.container.querySelector('#start-game-btn'),
      status: this.container.querySelector('#lobby-status'),
      resumeBanner: this.container.querySelector('#resume-banner'),
      expansionChecks: this.container.querySelectorAll('#lobby-forms input[type="checkbox"]'),
    };
    this._bindEvents();

    // Check for recoverable game.
    this._checkRecoverableGame();

    // Auto-fill name from localStorage.
    const saved = localStorage.getItem('carcassonne_player_name');
    if (saved) this.dom.playerName.value = saved;

    // ── Room code detection (priority order) ────────────────────────
    // 1. Router params (parsed from hash or window.location.search by Router.js).
    // 2. Direct window.location.search parsing.
    // 3. Hash fallback (for hash-based SPA routing like #/?room=XXXX).
    let roomCode = null;

    if (routerParams && routerParams.room) {
      roomCode = routerParams.room;
      console.log('[LobbyView] Room param from router:', roomCode);
    }

    // 2. Direct search params.
    if (!roomCode) {
      const directParams = new URLSearchParams(window.location.search);
      const directRoom = directParams.get('room');
      if (directRoom) {
        roomCode = directRoom;
        console.log('[LobbyView] Room param from window.location.search:', roomCode);
      }
    }

    // 3. Hash fallback.
    if (!roomCode) {
      console.log('[LobbyView] mount() hash:', window.location.hash);
      const hash = window.location.hash;
      const qm = hash.indexOf('?');
      if (qm !== -1) {
        const afterQM = hash.slice(qm + 1);
        try {
          roomCode = new URLSearchParams(afterQM).get('room');
          if (roomCode) console.log('[LobbyView] Room param from hash:', roomCode);
        } catch (e) {
          const match = hash.match(/[?&]room=([^&]+)/i);
          if (match) roomCode = match[1];
        }
      }
    }

    if (roomCode) {
      this.dom.roomCodeInput.value = roomCode.toUpperCase();
      console.log('[LobbyView] Auto-joining room:', roomCode.toUpperCase());
      this._joinGame();
      return; // _joinGame continues from here
    }

    this._setStatus('Ready');
  }

  destroy() {
    if (this.peerManager) {
      this.peerManager.removeAllListeners();
      this.peerManager.destroy();
      this.peerManager = null;
    }
    this.container.innerHTML = '';
    this.removeAllListeners();
  }

  /**
   * Remove all LobbyView's event listeners from peerManager without
   * destroying the peer or connections. Used when transitioning to the
   * game view so GameHost/GameClient can take over the PeerManager.
   */
  _cleanupPeerManager() {
    if (this.peerManager) {
      this.peerManager.removeAllListeners();
    }
  }

  _bindEvents() {
    this.dom.createBtn.addEventListener('click', () => this._createGame());
    this.dom.joinBtn.addEventListener('click', () => this._toggleJoinForm());
    this.dom.startBtn.addEventListener('click', () => this._startGame());
    this.dom.copyLink.addEventListener('click', (e) => {
      e.preventDefault();
      this._copyInviteLink();
    });
    // Hide Join Game button when Solo is selected (Bug 2)
    this.dom.playerCount.addEventListener('change', () => {
      const isSolo = parseInt(this.dom.playerCount.value, 10) === 1;
      this.dom.joinBtn.style.display = isSolo ? 'none' : '';
    });
    // Run once on mount
    const initialIsSolo = parseInt(this.dom.playerCount.value, 10) === 1;
    if (initialIsSolo) this.dom.joinBtn.style.display = 'none';
  }

  /** Check if a recoverable game exists and show a resume banner. */
  _checkRecoverableGame() {
    if (!hasRecoverableGame() || !this.dom.resumeBanner) return;

    const info = getSavedGameInfo();
    if (!info) return;

    const elapsed = Math.floor((Date.now() - info.savedAt) / 60000);
    const timeStr = elapsed < 60
      ? `${elapsed} min ago`
      : `${Math.floor(elapsed / 60)}h ${elapsed % 60}m ago`;

    this.dom.resumeBanner.innerHTML = `
      <strong>Game in progress:</strong> ${info.name} (${info.players} players, saved ${timeStr})
      <div style="margin-top: 8px; display: flex; gap: 8px; justify-content: center;">
        <button id="resume-game-btn" style="
          padding: 6px 20px; border-radius: 6px; border: none;
          background: #66bb6a; color: #111; font-weight: bold; cursor: pointer;
        ">Resume Game</button>
        <button id="discard-game-btn" style="
          padding: 6px 20px; border-radius: 6px; border: 1px solid #e57373;
          background: transparent; color: #e57373; cursor: pointer;
        ">Discard</button>
      </div>
    `;
    this.dom.resumeBanner.style.display = 'block';

    this.dom.resumeBanner.querySelector('#resume-game-btn').addEventListener('click', () => {
      this._resumeGame();
    });
    this.dom.resumeBanner.querySelector('#discard-game-btn').addEventListener('click', () => {
      removeGame();
      this.dom.resumeBanner.style.display = 'none';
    });
  }

  /** Resume a saved game by loading state and transitioning to the game view. */
  _resumeGame() {
    const state = loadGame();
    if (!state) {
      this._setStatus('No saved game found');
      return;
    }

    this.destroy();
    this.emit('start-game', {
      isHost: true,
      peerManager: null,
      isLocalGame: true,
      localState: state,
      playerIndex: 0,
      localPlayers: state.players,
    });
  }

  // ── Create Game ──────────────────────────────────────────────────────

  async _createGame() {
    removeGame(); // Clear any previous saved game
    const name = this.dom.playerName.value.trim() || 'Host';
    localStorage.setItem('carcassonne_player_name', name);

    const expansions = ['base-game'];
    this.dom.expansionChecks.forEach((cb) => {
      if (cb.checked) expansions.push(cb.value);
    });

    const playerCount = parseInt(this.dom.playerCount.value, 10);
    this.isHost = true;
    this.hostName = name;

    // Build initial slots.
    this.slots = [];
    for (let i = 0; i < playerCount; i++) {
      this.slots.push({
        playerIndex: i,
        name: i === 0 ? name : `Player ${i + 1}`,
        type: i === 0 ? 'host' : 'unfilled',
      });
    }
    this.localPlayerIndex = 0;

    // Hide the action buttons.
    const createBtn = this.dom.createBtn;
    const joinBtn = this.dom.joinBtn;
    const joinForm = this.dom.joinForm;
    const pcSelect = this.dom.playerCount;
    const expansionContainer = this.container.querySelector('#lobby-forms div:nth-child(2)');
    if (createBtn) createBtn.style.display = 'none';
    if (joinBtn) joinBtn.style.display = 'none';
    if (joinForm) joinForm.style.display = 'none';
    if (pcSelect) pcSelect.style.display = 'none';
    if (expansionContainer) expansionContainer.style.display = 'none';

    if (playerCount === 1) {
      // ── Solo mode: no PeerManager needed ──
      this.dom.lobbyPlayers.style.display = 'block';
      this._updatePlayerList();
      this._setStatus('Ready to play solo');
      return;
    }

    // ── Multiplayer: create PeerManager ──
    this.roomCode = generateRoomCode();
    this._setStatus('Creating room...');

    try {
      console.log('[LobbyView] Creating host peer manager, room:', this.roomCode, 'name:', name);
      this.peerManager = new HostPeerManager(this.roomCode, { expansions }, name);
      await this.peerManager.init();
      console.log('[LobbyView] Host peer initialized, peerId:', this.peerManager.peerId);

      // Show room code.
      this.dom.roomCode.textContent = this.roomCode;
      this.dom.roomDisplay.style.display = 'block';

      // Show lobby with all slots.
      this.dom.lobbyPlayers.style.display = 'block';
      this._updatePlayerList();

      // Listen for join requests.
      this.peerManager.on('message', (message, conn) => {
        if (message.type === MessageType.JOIN_REQUEST) {
          // Find first unfilled slot (skip host slot 0).
          const firstUnfilled = this.slots.find(s => s.type === 'unfilled' && s.playerIndex > 0);
          if (!firstUnfilled) {
            this._setStatus('All slots are full');
            return;
          }
          const slotIndex = firstUnfilled.playerIndex;
          const result = this.peerManager.acceptJoin(conn, message.payload.playerName, slotIndex);
          if (result.accepted) {
            this._connToSlot.set(conn, slotIndex);
            this.slots[slotIndex].type = 'remote';
            this.slots[slotIndex].name = message.payload.playerName;
            this._updatePlayerList();
            this._setStatus(`${message.payload.playerName} joined!`);
          }
        }
      });

      // Auto-remove player on disconnect.
      this.peerManager.on('peer-disconnected', (conn) => {
        const slotIndex = this._connToSlot.get(conn);
        if (slotIndex != null) {
          this._connToSlot.delete(conn);
          if (this.slots[slotIndex]) {
            const removedName = this.slots[slotIndex].name;
            this.slots[slotIndex].type = 'unfilled';
            this.slots[slotIndex].name = `Player ${slotIndex + 1}`;
            this._updatePlayerList();
            this._setStatus(`${removedName} disconnected`);
          }
        }
      });

      // Name change listener for host slot (slot 0).
      this.dom.playerName.addEventListener('input', () => {
        const newName = this.dom.playerName.value.trim() || 'Host';
        this.slots[0].name = newName;
        this.hostName = newName;
        if (this.peerManager && typeof this.peerManager.setHostName === 'function') {
          this.peerManager.setHostName(newName);
        }
        this._updatePlayerList();
      });

      this._setStatus('Waiting for players...');
    } catch (err) {
      console.error('Failed to create room:', err);
      this._setStatus('Error: ' + err.message);
    }
  }

  // ── Join Game ────────────────────────────────────────────────────────

  _toggleJoinForm() {
    const show = this.dom.joinForm.style.display === 'none' || !this.dom.joinForm.style.display;
    this.dom.joinForm.style.display = show ? 'flex' : 'none';
    if (show) {
      this.dom.roomCodeInput.focus();
      // Remove any previous listener to avoid leaks, then re-attach.
      if (this._joinKeydownHandler) {
        this.dom.roomCodeInput.removeEventListener('keydown', this._joinKeydownHandler);
      }
      this._joinKeydownHandler = (e) => {
        if (e.key === 'Enter') this._joinGame();
      };
      this.dom.roomCodeInput.addEventListener('keydown', this._joinKeydownHandler);
    }
  }

  async _joinGame() {
    removeGame(); // Clear any previous saved game
    const name = this.dom.playerName.value.trim() || 'Player';
    const code = this.dom.roomCodeInput.value.trim().toUpperCase();
    if (code.length < 4) {
      this._setStatus('Enter a 4-character room code');
      return;
    }

    console.log('[LobbyView] _joinGame() called - name:', name, 'code:', code);

    localStorage.setItem('carcassonne_player_name', name);
    this.roomCode = code;
    this._setStatus('Connecting...');

    try {
      console.log('[LobbyView] Creating ClientPeerManager for room:', code);
      this.peerManager = new ClientPeerManager(code);

      // Register game_starting listener BEFORE connectToHost to avoid a race
      // where the host sends game_starting before we are listening.
      let gameStartingReceived = false;
      let gameStartingPayload = null;
      this.peerManager.on('msg:game_starting', (payload) => {
        gameStartingReceived = true;
        gameStartingPayload = payload;
      });

      const result = await this.peerManager.connectToHost(name);
      console.log('[LobbyView] Connected to host! Player index:', result.playerIndex, 'players:', result.players);

      // Hide the action buttons, keep name input visible.
      const createBtn = this.dom.createBtn;
      const joinBtn = this.dom.joinBtn;
      const joinFormEl = this.dom.joinForm;
      const playerCount = this.dom.playerCount;
      const expansionContainer = this.container.querySelector('#lobby-forms div:nth-child(2)');
      if (createBtn) createBtn.style.display = 'none';
      if (joinBtn) joinBtn.style.display = 'none';
      if (joinFormEl) joinFormEl.style.display = 'none';
      if (playerCount) playerCount.style.display = 'none';
      if (expansionContainer) expansionContainer.style.display = 'none';

      // Add a cancel/back button for joiners.
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Leave Lobby';
      cancelBtn.style.cssText = 'margin-top:8px; padding:8px; border-radius:6px; border:1px solid #e57373; background:transparent; color:#e57373; cursor:pointer; font-size:0.85rem; pointer-events:auto;';
      cancelBtn.addEventListener('click', () => {
        this.destroy();
        this.emit('navigate', 'lobby');
        // Clean the URL completely (both search params and hash) so mount()
        // does not re-parse the room code when the new LobbyView is created.
        // Using replaceState avoids a page reload.
        history.replaceState(null, '', window.location.pathname);
        navigate('/');
      });
      const statusContainer = this.dom.status.parentNode;
      statusContainer.appendChild(cancelBtn);

      // Show player list from JOIN_ACCEPT payload.
      this.players = (result.players || []).map((p) => ({
        name: p.name,
        isHost: p.isHost || p.playerIndex === 0,
        playerIndex: p.playerIndex,
      }));
      this.localPlayerIndex = result.playerIndex;
      this.dom.lobbyPlayers.style.display = 'block';
      // Non-host should not see the start game button.
      this.dom.startBtn.style.display = this.isHost ? '' : 'none';
      // Hide start game button — only host can start.
      this.dom.startBtn.style.display = 'none';
      this._updatePlayerList();
      this._setStatus('Joined! Waiting for host to start the game...');

      // Listen for lobby updates (new players joining / leaving).
      this.peerManager.on('msg:player_joined', (payload) => {
        // Avoid duplicates.
        if (!this.players.find((p) => p.playerIndex === payload.playerIndex)) {
          this.players.push({
            name: payload.name || 'Player',
            isHost: false,
            playerIndex: payload.playerIndex,
          });
          this._updatePlayerList();
        }
      });
      this.peerManager.on('msg:player_left', (payload) => {
        this.players = this.players.filter((p) => p.playerIndex !== payload.playerIndex);
        this._updatePlayerList();
      });
      this.peerManager.on('msg:lobby_state', (payload) => {
        this.players = (payload.players || []).map((p) => ({
          name: p.name,
          isHost: p.isHost || p.playerIndex === 0,
          playerIndex: p.playerIndex,
        }));
        this._updatePlayerList();
      });

      // Listen for game start. If game_starting was already received before this
      // point (pre-registered listener captured it), process the stored payload now.
      this.peerManager.off('msg:game_starting');
      this.peerManager.on('msg:game_starting', (payload) => {
        console.log('[LobbyView] Received game_starting from host!', payload);
        // Remove cancel button if present.
        if (cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);

        // Reconstruct full game state from the host's sanitized initial state.
        const init = payload.initialState;
        const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'gray'];

        // Reconstruct placed tiles with full tile objects from TILE_DATA.
        const placedTiles = (init.placedTiles || []).map((pt) => {
          const tileDef = TILE_DATA.find((t) => t.id === pt.tileId) || {};
          return {
            tile: tileDef,
            rotation: pt.rotation || 0,
            x: pt.x,
            y: pt.y,
            playerIndex: pt.playerIndex,
            meeples: (pt.meeples || []).map((m) => ({
              playerIndex: m.playerIndex,
              placement: m.placement || {},
              meepleType: m.meepleType || 'normal',
              scored: m.scored !== false,
            })),
            tower: pt.towerHeight != null ? { height: pt.towerHeight, completed: false } : undefined,
            features: { cities: [], roads: [], farms: [], cloister: null },
            northTileIndex: undefined,
            southTileIndex: undefined,
            eastTileIndex: undefined,
            westTileIndex: undefined,
          };
        });

        // Rebuild adjacency indices.
        for (let i = 0; i < placedTiles.length; i++) {
          const pt = placedTiles[i];
          for (let j = 0; j < placedTiles.length; j++) {
            if (i === j) continue;
            const ot = placedTiles[j];
            if (ot.x === pt.x && ot.y === pt.y - 1) pt.northTileIndex = j;
            if (ot.x === pt.x && ot.y === pt.y + 1) pt.southTileIndex = j;
            if (ot.y === pt.y && ot.x === pt.x - 1) pt.westTileIndex = j;
            if (ot.y === pt.y && ot.x === pt.x + 1) pt.eastTileIndex = j;
          }
        }

        // Reconstruct active tile.
        const activeTile = init.activeTile && init.activeTile.tileId
          ? { tile: TILE_DATA.find((t) => t.id === init.activeTile.tileId) || {},
              validPlacements: init.activeTile.validPlacements || [] }
          : null;

        const clientExpansions = init.expansions || ['base-game'];
        const clientState = {
          players: (init.players || []).map((p, i) => ({
            user: { username: p.username || `Player ${i}`, _id: `client-player-${i}` },
            color: p.color || colors[i % colors.length],
            points: p.points || 0,
            remainingMeeples: p.remainingMeeples != null ? p.remainingMeeples : 7,
            active: p.active || false,
            hasLargeMeeple: clientExpansions.includes('inns-and-cathedrals'),
            hasBuilderMeeple: clientExpansions.includes('traders-and-builders'),
            hasPigMeeple: clientExpansions.includes('traders-and-builders'),
            goods: p.goods || {},
            towers: p.towers || 0,
            capturedMeeples: [],
            acknowledgedGameEnd: false,
          })),
          currentPlayerIndex: init.currentPlayerIndex != null ? init.currentPlayerIndex : 0,
          placedTiles,
          activeTile,
          unusedTiles: new Array(init.unusedTilesCount || 0),
          step: init.step || 'place',
          finished: init.finished || false,
          expansions: init.expansions || ['base-game'],
          messages: init.messages || [],
        };

        this._transitionToGame({
          isHost: false,
          peerManager: this.peerManager,
          localState: clientState,
          playerIndex: result.playerIndex,
          localPlayers: clientState.players,
        });
      });

      // Listen for kick.
      this.peerManager.on('msg:kick', (payload) => {
        this._setStatus('You were kicked from the game.');
        if (cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);
        setTimeout(() => {
          this.destroy();
          navigate('');
        }, 2000);
      });

      // If game_starting was received before the listener above was registered,
      // process the stored payload now.
      if (gameStartingReceived) {
        this.peerManager.emit('msg:game_starting', gameStartingPayload);
      }

      // Listen for host disconnect.
      this.peerManager.on('peer-disconnected', () => {
        this._setStatus('Host disconnected.');
        if (cancelBtn.parentNode) cancelBtn.parentNode.removeChild(cancelBtn);
        setTimeout(() => {
          this.destroy();
          navigate('');
        }, 3000);
      });
    } catch (err) {
      console.error('[LobbyView] Failed to join room:', err);
      let errorMsg = 'Failed to join: ' + err.message;
      // Provide user-friendly suggestions for common PeerJS errors.
      if (err.message && err.message.includes('Could not connect to peer')) {
        errorMsg = 'Could not connect to host. The room code may be invalid or the host may have left.';
      } else if (err.message && err.message.includes('timed out')) {
        errorMsg = 'Connection timed out. Check the room code and try again.';
      } else if (err.message && err.message.includes('peer unavailable')) {
        errorMsg = 'Room not found. The host may have closed the room or the code is wrong.';
      }
      this._setStatus(errorMsg);
      // Destroy PeerManager on failure so we don't leak connections.
      if (this.peerManager) {
        this.peerManager.removeAllListeners();
        this.peerManager.destroy();
        this.peerManager = null;
      }
    }
  }

  // ── Lobby management ────────────────────────────────────────────────

  _updatePlayerList() {
    if (!this.dom || !this.dom.playerList) return;
    const list = this.dom.playerList;
    list.innerHTML = '';

    // If not using slots (joiner path), render with proper labels.
    if (this.slots.length === 0 && this.players.length > 0) {
      this.players.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'player-list-item';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = p.name;
        li.appendChild(nameSpan);
        if (p.playerIndex === this.localPlayerIndex) {
          const badge = document.createElement('span');
          badge.className = 'slot-badge slot-badge--you';
          badge.textContent = '(You)';
          li.appendChild(badge);
        } else if (p.playerIndex !== 0) {
          // Other connected joiners are P2P from joiner's perspective.
          const badge = document.createElement('span');
          badge.className = 'slot-badge slot-badge--p2p';
          badge.textContent = '(P2P)';
          li.appendChild(badge);
        }
        list.appendChild(li);
      });
      return;
    }

    this.slots.forEach((slot) => {
      const li = document.createElement('li');
      li.className = 'player-list-item';

      if (slot.type === 'unfilled' && slot.playerIndex > 0) {
        // Editable input for unfilled slots.
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'slot-name-input';
        input.value = slot.name;
        input.maxLength = 20;
        input.addEventListener('input', () => {
          this.slots[slot.playerIndex].name = input.value.trim() || `Player ${slot.playerIndex + 1}`;
        });
        const badge = document.createElement('span');
        badge.className = 'slot-badge slot-badge--empty';
        badge.textContent = 'Empty';
        li.appendChild(input);
        li.appendChild(badge);
      } else {
        // Player name.
        const nameSpan = document.createElement('span');
        nameSpan.textContent = slot.name;

        // Badge.
        if (slot.playerIndex === this.localPlayerIndex) {
          const badge = document.createElement('span');
          badge.className = 'slot-badge slot-badge--you';
          badge.textContent = '(You)';
          li.appendChild(nameSpan);
          li.appendChild(badge);
        } else if (slot.type === 'remote') {
          const badge = document.createElement('span');
          badge.className = 'slot-badge slot-badge--p2p';
          badge.textContent = '(P2P)';
          li.appendChild(nameSpan);
          li.appendChild(badge);
        } else {
          li.appendChild(nameSpan);
        }

        // Kick button for host (only on remote slots).
        if (this.isHost && slot.type === 'remote') {
          const kickBtn = document.createElement('button');
          kickBtn.textContent = '✕';
          kickBtn.style.cssText = 'background:transparent; border:1px solid #e57373; color:#e57373; border-radius:4px; cursor:pointer; padding:2px 6px; font-size:0.75rem;';
          kickBtn.title = `Kick ${slot.name}`;
          kickBtn.addEventListener('click', () => {
            if (this.peerManager && typeof this.peerManager.kickPlayer === 'function') {
              this.peerManager.kickPlayer(slot.playerIndex);
              this.slots[slot.playerIndex].type = 'unfilled';
              this.slots[slot.playerIndex].name = `Player ${slot.playerIndex + 1}`;
              this._updatePlayerList();
              this._setStatus(`Kicked ${slot.name}`);
            }
          });
          li.appendChild(kickBtn);
        }
      }

      list.appendChild(li);
    });

    // Update start button state for host.
    if (this.isHost && this.dom.startBtn) {
      const hasRemoteClients = this.slots.some(s => s.type === 'remote');
      const playerCount = this.slots.length;
      if (!hasRemoteClients || playerCount === 1) {
        // Solo or all-local: always enable.
        this.dom.startBtn.disabled = false;
        this.dom.startBtn.style.background = '#66bb6a';
        this.dom.startBtn.style.color = '#111';
        this.dom.startBtn.style.cursor = 'pointer';
        this.dom.startBtn.title = '';
      } else {
        this.dom.startBtn.disabled = false;
        this.dom.startBtn.style.background = '#66bb6a';
        this.dom.startBtn.style.color = '#111';
        this.dom.startBtn.style.cursor = 'pointer';
        this.dom.startBtn.title = '';
      }
    }
  }

  _startGame() {
    // Solo mode requires no PeerManager — _createGame already returned without one.
    if (this.slots.length === 1) {
      this._startLocalGame(this.slots);
      return;
    }

    // Multiplayer: must have PeerManager (host created it in _createGame).
    if (!this.peerManager) return;

    const expansions = ['base-game'];
    this.dom.expansionChecks.forEach((cb) => {
      if (cb.checked) expansions.push(cb.value);
    });

    this._setStatus('Starting game...');

    // Check if any remote slots exist.
    const hasRemotePlayers = this.slots.some(s => s.type === 'remote');
    if (!hasRemotePlayers) {
      // All local (hot-seat): destroy the unused PeerManager first.
      this.peerManager.removeAllListeners();
      this.peerManager.destroy();
      this.peerManager = null;
      this._startLocalGame(this.slots);
    } else {
      // P2P: host creates the game state, broadcasts it.
      this._startHostedGame(this.slots, expansions);
    }
  }

  /**
   * @param {Array<{playerIndex:number, name:string, type:string}>} slots
   */
  _startLocalGame(slots) {
    const playerCount = slots.length;
    const expansions = ['base-game'];
    this.dom.expansionChecks.forEach((cb) => {
      if (cb.checked) expansions.push(cb.value);
    });

    const state = createGameState(expansions, playerCount, TILE_DATA);
    for (let i = 0; i < playerCount; i++) {
      const slot = slots[i];
      state.players[i].user = {
        username: slot.type === 'unfilled' ? slot.name || `Player ${i + 1}` : slot.name,
        _id: `local-player-${i}`,
      };
    }

    initializeNewGame(state, TILE_DATA.find((t) => t.startingTile));

    this._transitionToGame({
      isHost: true,
      peerManager: null,
      isLocalGame: true,
      localState: state,
      playerIndex: 0,
      localPlayers: state.players,
    });
  }

  /**
   * @param {Array<{playerIndex:number, name:string, type:string}>} slots
   * @param {string[]} expansions
   */
  _startHostedGame(slots, expansions) {
    const playerCount = slots.length;
    const state = createGameState(expansions, playerCount, TILE_DATA);

    // Host is slot 0.
    state.players[0].user = { username: slots[0].name, _id: 'host-player' };

    // Assign remote and local slots.
    for (let i = 1; i < playerCount; i++) {
      const slot = slots[i];
      if (slot.type === 'remote') {
        state.players[i].user = { username: slot.name, _id: `client-${i}` };
      } else {
        // 'unfilled' slots become local hot-seat players.
        state.players[i].user = { username: slot.name || `Player ${i + 1}`, _id: `local-player-${i}` };
      }
    }

    initializeNewGame(state, TILE_DATA.find((t) => t.startingTile));

    // Broadcast to clients.
    this.peerManager.startGame(state);

    this._transitionToGame({
      isHost: true,
      peerManager: this.peerManager,
      isLocalGame: false,
      localState: state,
      playerIndex: 0,
      localPlayers: state.players,
    });
  }

  _transitionToGame(config) {
    // Remove peerManager listeners but do NOT destroy the PeerManager —
    // GameView's GameHost/GameClient will take it over.
    this._cleanupPeerManager();
    // Transfer ownership of peerManager to GameView before destroy() is called.
    // The subsequent destroy() call inside Router.resolve() would otherwise
    // close all WebRTC connections before GameHost/GameClient can use them.
    config.transferPeerManager = this.peerManager;
    this.peerManager = null;
    this.container.innerHTML = '';
    this.emit('start-game', config);
  }

  _copyInviteLink() {
    // Use hash-based URL so the SPA Router can resolve the room param.
    // Also append the room as a plain search param so the direct
    // ?room=XXXX code path in mount() works without the hash prefix.
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const url = `${baseUrl}?room=${this.roomCode}#/?room=${this.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      this._setStatus('Invite link copied!');
    }).catch(() => {
      this._setStatus('Room code: ' + this.roomCode);
    });
  }

  _setStatus(msg) {
    if (this.dom && this.dom.status) {
      this.dom.status.textContent = msg;
    }
  }
}
