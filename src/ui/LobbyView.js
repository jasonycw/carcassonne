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

// ---------------------------------------------------------------------------
// HTML templates (simple innerHTML — no build step needed)
// ---------------------------------------------------------------------------

const LOBBY_HTML = `
<div id="lobby-container" style="
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #1a1a2e; color: #eee; font-family: 'Segoe UI', sans-serif;
">
  <div style="max-width: 480px; width: 100%; padding: 24px;">

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
  }

  mount() {
    this.container.innerHTML = LOBBY_HTML;
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

    // Check URL for room code (joining).
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      this.dom.roomCodeInput.value = roomParam.toUpperCase();
      this._joinGame();
    }

    this._setStatus('Ready');
  }

  destroy() {
    if (this.peerManager) {
      this.peerManager.destroy();
      this.peerManager = null;
    }
    this.container.innerHTML = '';
  }

  _bindEvents() {
    this.dom.createBtn.addEventListener('click', () => this._createGame());
    this.dom.joinBtn.addEventListener('click', () => this._toggleJoinForm());
    this.dom.startBtn.addEventListener('click', () => this._startGame());
    this.dom.copyLink.addEventListener('click', (e) => {
      e.preventDefault();
      this._copyInviteLink();
    });
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

    // Generate room.
    this.roomCode = generateRoomCode();
    this.isHost = true;

    this._setStatus('Creating room...');

    try {
      this.peerManager = new HostPeerManager(this.roomCode, { expansions });
      await this.peerManager.init();

      // Show room code.
      this.dom.roomCode.textContent = this.roomCode;
      this.dom.roomDisplay.style.display = 'block';

      // Hide the action buttons but keep the name input visible.
      const createBtn = this.dom.createBtn;
      const joinBtn = this.dom.joinBtn;
      const joinForm = this.dom.joinForm;
      const playerCount = this.dom.playerCount;
      const expansionContainer = this.container.querySelector('#lobby-forms div:nth-child(2)');
      if (createBtn) createBtn.style.display = 'none';
      if (joinBtn) joinBtn.style.display = 'none';
      if (joinForm) joinForm.style.display = 'none';
      if (playerCount) playerCount.style.display = 'none';
      if (expansionContainer) expansionContainer.style.display = 'none';

      // Add host to player list.
      this.players = [{ name, isHost: true, playerIndex: 0 }];
      this._updatePlayerList();

      // Show lobby.
      this.dom.lobbyPlayers.style.display = 'block';

      // Listen for join requests.
      this.peerManager.on('message', (message, conn) => {
        if (message.type === MessageType.JOIN_REQUEST) {
          const result = this.peerManager.acceptJoin(conn, message.payload.playerName);
          if (result.accepted) {
            this.players.push({
              name: message.payload.playerName,
              isHost: false,
              playerIndex: result.playerIndex,
            });
            this._updatePlayerList();
            this._setStatus(`${message.payload.playerName} joined!`);
          }
        }
      });

      // Auto-remove player on disconnect.
      this.peerManager.on('peer-disconnected', (conn) => {
        const idx = this.players.findIndex(
          (p) => !p.isHost && p.playerIndex === this.peerManager.connectedPlayers.find(cp => cp.conn === conn)?.playerIndex
        );
        if (idx !== -1) {
          const removed = this.players.splice(idx, 1)[0];
          this._updatePlayerList();
          this._setStatus(`${removed.name} disconnected`);
        }
      });

      // Add name change listener for host: re-render player list on input.
      this.dom.playerName.addEventListener('input', () => {
        if (this.players.length > 0 && this.players[0].isHost) {
          this.players[0].name = this.dom.playerName.value.trim() || 'Host';
          this._updatePlayerList();
        }
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
      this.dom.roomCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._joinGame();
      });
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

    localStorage.setItem('carcassonne_player_name', name);
    this.roomCode = code;
    this._setStatus('Connecting...');

    try {
      this.peerManager = new ClientPeerManager(code);
      const result = await this.peerManager.connectToHost(name);

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

      this._setStatus('Joined! Waiting for host to start the game...');

      // Add a cancel/back button for joiners.
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Leave Lobby';
      cancelBtn.style.cssText = 'margin-top:8px; padding:8px; border-radius:6px; border:1px solid #e57373; background:transparent; color:#e57373; cursor:pointer; font-size:0.85rem;';
      cancelBtn.addEventListener('click', () => {
        this.destroy();
        this.emit('navigate', 'lobby');
        navigate('');
      });
      const statusContainer = this.dom.status.parentNode;
      statusContainer.appendChild(cancelBtn);

      // Listen for game start.
      this.peerManager.on('msg:game_starting', (payload) => {
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

        const clientState = {
          players: (init.players || []).map((p, i) => ({
            user: { username: p.username || `Player ${i}`, _id: `client-player-${i}` },
            color: p.color || colors[i % colors.length],
            points: p.points || 0,
            remainingMeeples: p.remainingMeeples != null ? p.remainingMeeples : 7,
            active: p.active || false,
            hasLargeMeeple: false,
            hasBuilderMeeple: false,
            hasPigMeeple: false,
            goods: p.goods || {},
            towers: p.towers || 0,
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
      console.error('Failed to join:', err);
      this._setStatus('Failed to join: ' + err.message);
    }
  }

  // ── Lobby management ────────────────────────────────────────────────

  _updatePlayerList() {
    const list = this.dom.playerList;
    list.innerHTML = '';
    this.players.forEach((p) => {
      const li = document.createElement('li');
      li.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px; margin:4px 0; background:#16213e; border-radius:6px;';
      const span = document.createElement('span');
      span.textContent = p.name + (p.isHost ? ' (Host)' : '');
      li.appendChild(span);
      // Kick button for host (not on self and not on host).
      if (this.isHost && !p.isHost) {
        const kickBtn = document.createElement('button');
        kickBtn.textContent = '✕';
        kickBtn.style.cssText = 'background:transparent; border:1px solid #e57373; color:#e57373; border-radius:4px; cursor:pointer; padding:2px 6px; font-size:0.75rem;';
        kickBtn.title = `Kick ${p.name}`;
        kickBtn.addEventListener('click', () => {
          if (this.peerManager && typeof this.peerManager.kickPlayer === 'function') {
            this.peerManager.kickPlayer(p.playerIndex);
            this.players = this.players.filter((pl) => pl.playerIndex !== p.playerIndex);
            this._updatePlayerList();
            this._setStatus(`Kicked ${p.name}`);
          }
        });
        li.appendChild(kickBtn);
      }
      list.appendChild(li);
    });
  }

  _startGame() {
    if (!this.isHost || !this.peerManager) return;

    const name = this.dom.playerName.value.trim() || 'Host';
    const playerCount = parseInt(this.dom.playerCount.value, 10);
    const expansions = ['base-game'];
    this.dom.expansionChecks.forEach((cb) => {
      if (cb.checked) expansions.push(cb.value);
    });

    this._setStatus('Starting game...');

    // Check if hot-seat solo or local multiplayer (no P2P).
    const hasConnectedClients = this.players.some((p) => !p.isHost);
    if (playerCount === 1 || !hasConnectedClients) {
      // Solo / hot-seat: no P2P needed.
      this._startLocalGame(name, playerCount, expansions);
    } else {
      // P2P: host creates the game state, broadcasts it.
      this._startHostedGame(name, playerCount, expansions);
    }
  }

  _startLocalGame(playerName, playerCount, expansions) {
    const state = createGameState(expansions, playerCount, TILE_DATA);
    // Set local player names.
    state.players[0].user = { username: playerName, _id: 'local-player-0' };
    for (let i = 1; i < playerCount; i++) {
      state.players[i].user = { username: `Player ${i + 1}`, _id: `local-player-${i}` };
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

  _startHostedGame(playerName, playerCount, expansions) {
    const state = createGameState(expansions, playerCount, TILE_DATA);
    state.players[0].user = { username: playerName, _id: 'host-player' };
    let clientSlot = 1;
    for (const p of this.players) {
      if (p.isHost || p.playerIndex === 0) continue;
      if (clientSlot < state.players.length) {
        state.players[clientSlot].user = { username: p.name, _id: `client-${clientSlot}` };
        clientSlot++;
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
    this.destroy();
    this.emit('start-game', config);
  }

  _copyInviteLink() {
    const url = `${window.location.origin}${window.location.pathname}?room=${this.roomCode}`;
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
