/**
 * PeerManager.js — PeerJS-based P2P networking for Carcassonne.
 *
 * Architecture (host-authoritative):
 *   - **Host** (room creator): creates a PeerJS Peer, becomes the server.
 *     Runs GameLogic, validates moves, broadcasts state.
 *   - **Client** (joiner): connects to the host's PeerJS Peer.
 *     Sends move requests, receives state updates.
 *
 * Room identification: room codes are passed as URL params (?room=XXXX).
 * The host peer ID is derived from the room code.
 *
 * @module PeerManager
 */

import Peer from 'peerjs';
import { EventEmitter } from '../utils/EventEmitter.js';
import {
  MessageType,
  createMessage,
  deserialize,
  joinRequest,
} from './Protocol.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PEER_HOST = '0.peerjs.com';  // default PeerJS cloud host
const PEER_PORT = 443;
const PEER_PATH = '/';
const RECONNECT_DELAY = 2000;      // ms between reconnection attempts
const PING_INTERVAL = 10000;       // ms between heartbeats
const WATCHDOG_TIMEOUT = PING_INTERVAL * 3; // 30s without PING → assume host lost

// Metered.ca Open Relay Project shared secret (publicly documented).
// Used to generate HMAC-SHA1 TURN credentials client-side.
// Docs: https://www.metered.ca/tools/openrelay/
const METERED_TURN_SECRET = 'openrelayprojectsecret';

// Metered.ca REST API key — free tier, 5-20 GB/month.
// Sign up at https://dashboard.metered.ca/signup to get your own.
const METERED_API_KEY = '6f046f03888d7b80b408795679a2191a21d1';

// ---------------------------------------------------------------------------
// Room code helpers
// ---------------------------------------------------------------------------

/** Generate a 4-character uppercase room code. */
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Build the PeerJS peer ID from a room code. */
export function roomCodeToPeerId(roomCode) {
  return `carcassonne-${roomCode}`;
}

// ---------------------------------------------------------------------------
// TURN credential helpers
// ---------------------------------------------------------------------------

/**
 * Generate HMAC-SHA1-based TURN credentials for Metered.ca Open Relay.
 *
 * Metered.ca's TURN server accepts auth-secret (HMAC) credentials.
 * The shared secret is publicly documented in their Static Auth section.
 * We compute the HMAC client-side so no API key or backend is needed.
 *
 * The returned credential is valid for 24 hours.
 *
 * @returns {{ username: string, credential: string }}
 *   Object suitable for use in an RTCIceServer entry.
 */
async function generateMeteredTurnCredentials() {
  const timestamp = Math.floor(Date.now() / 1000) + 86400; // 24h from now
  const username = `${timestamp}:carcassonne`;

  // Compute HMAC-SHA1 via Web Crypto API.
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(METERED_TURN_SECRET),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(username),
  );

  const credential = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return { username, credential };
}

/**
 * Fetch TURN credentials from Metered.ca REST API.
 *
 * The free Metered.ca plan provides 5-20 GB/month of TURN relay traffic.
 * Sign up at https://dashboard.metered.ca/signup → TURN Servers → generate
 * credential, then copy the API Key into the game's settings panel.
 *
 * API docs: https://www.metered.ca/docs/turn-rest-api/get-credential
 *
 * @param {string} apiKey  Metered.ca API key
 * @returns {Promise<Array<{urls: string|string[], username?: string, credential?: string}>>}
 *   Array of iceServers from the API. Includes STUN + TURN entries.
 */
async function fetchMeteredIceServers(apiKey) {
  const url = `https://carcassonne.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Metered.ca API returned ${res.status}`);
  }

  const data = await res.json();

  // The API returns a JSON array of iceServer objects ready for
  // RTCPeerConnection. If the response has an "error" field, treat
  // it as failure.
  if (data && data.error) {
    throw new Error(`Metered.ca API error: ${data.error}`);
  }

  const servers = Array.isArray(data) ? data : (data.iceServers || []);
  // Normalize "urls" to always be an array for consistent handling.
  for (const srv of servers) {
    if (typeof srv.urls === 'string') {
      srv.urls = [srv.urls];
    }
  }
  return servers;
}

// ---------------------------------------------------------------------------
// PeerManager  (shared base)
// ---------------------------------------------------------------------------

/**
 * Abstract base for HostPeerManager and ClientPeerManager.
 * Provides common PeerJS setup, heartbeat, and connection tracking.
 */
export class PeerManager extends EventEmitter {
  /**
   * @param {'host'|'client'} role
   * @param {string}          roomCode
   */
  constructor(role, roomCode) {
    super();
    this.role = role;
    this.roomCode = roomCode;
    this.peerId = roomCodeToPeerId(roomCode) + (role === 'client' ? `-${Date.now()}` : '');
    this.peer = null;
    this.connections = [];    // DataConnection[]
    this.connected = false;
    this._pingTimer = null;
    this._reconnectTimer = null;
    this._destroyed = false;
    this._lastPingTime = 0;
    this._pingWatchTimer = null;

    // If a client, we store the host connection separately.
    this.hostConnection = null;
  }

  /**
   * Initialise the PeerJS Peer.
   * Returns a Promise that resolves when the peer is ready.
   */
  async init() {
    // ── Build ICE servers configuration ──────────────────────────────
    let iceServers;

    // ── Metered.ca REST API (preferred) ─────────────────────────────
    // Fetch production-grade TURN credentials from Metered.ca's global
    // relay infrastructure (global.relay.metered.ca).
    // Free tier provides 5-20 GB/month.
    try {
      iceServers = await fetchMeteredIceServers(METERED_API_KEY);
      console.log('[PeerManager] Using Metered.ca REST API TURN credentials');
    } catch (err) {
      console.warn('[PeerManager] Metered.ca API failed, using fallback TURN:', err);
      // Fallback: HMAC for openrelay.metered.ca + PeerJS servers.
      let turnCreds;
      try {
        turnCreds = await generateMeteredTurnCredentials();
      } catch (e) {
        turnCreds = { username: 'openrelayproject', credential: 'openrelayproject' };
      }
      iceServers = [
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['stun:stun2.l.google.com:19302'] },
        { urls: ['stun:stun3.l.google.com:19302'] },
        { urls: ['stun:stun4.l.google.com:19302'] },
        {
          urls: [
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:80?transport=tcp',
          ],
          username: turnCreds.username,
          credential: turnCreds.credential,
        },
        {
          urls: [
            'turn:eu-0.turn.peerjs.com:3478',
            'turn:us-0.turn.peerjs.com:3478',
          ],
          username: 'peerjs',
          credential: 'peerjsp',
        },
      ];
    }

    // If API succeeded, prepend Google STUN and append PeerJS fallback.
    if (iceServers.length > 0 && !iceServers.some(s => s.urls && s.urls.includes('stun:stun.l.google.com:19302'))) {
      iceServers.unshift(
        { urls: ['stun:stun.l.google.com:19302'] },
        { urls: ['stun:stun2.l.google.com:19302'] },
        { urls: ['stun:stun3.l.google.com:19302'] },
        { urls: ['stun:stun4.l.google.com:19302'] },
      );
    }
    // Always include PeerJS servers as extra relay candidates.
    if (!iceServers.some(s => s.urls && s.urls.includes('turn:eu-0.turn.peerjs.com:3478'))) {
      iceServers.push({
        urls: [
          'turn:eu-0.turn.peerjs.com:3478',
          'turn:us-0.turn.peerjs.com:3478',
        ],
        username: 'peerjs',
        credential: 'peerjsp',
      });
    }

    return new Promise((resolve, reject) => {
      this.peer = new Peer(this.peerId, {
        host: PEER_HOST,
        port: PEER_PORT,
        path: PEER_PATH,
        debug: 3,  // verbose logging for diagnosing LAN/WAN connectivity
        config: { iceServers, sdpSemantics: 'unified-plan' },
      });

      this.peer.on('open', (id) => {
        this.connected = true;
        this.emit('ready', id);
        this._startHeartbeat();
        resolve(id);
      });

      this.peer.on('error', (err) => {
        console.error('[PeerManager] Peer error:', err);
        this.emit('error', err);
        // Reject only if we haven't resolved yet.
        if (!this.connected) {
          reject(err);
        }
      });

      this.peer.on('disconnected', () => {
        console.warn(`[PeerManager] Disconnected from signaling server (role: ${this.role}, peerId: ${this.peerId})`);
        this.connected = false;
        this.emit('disconnected');
        // Attempt to reconnect (cancelled in destroy()).
        this._reconnectTimer = setTimeout(() => this._reconnect(), RECONNECT_DELAY);
      });

      this.peer.on('close', () => {
        this.connected = false;
        this.emit('closed');
        this._stopHeartbeat();
      });

      this.peer.on('connection', (conn) => {
        this._setupDataConnection(conn);
      });
    });
  }

  /** Send a message to a specific connection. */
  send(conn, message) {
    if (conn && conn.open) {
      conn.send(message);
    }
  }

  /** Broadcast a message to all connected peers (host only). */
  broadcast(message) {
    for (const conn of this.connections) {
      this.send(conn, message);
    }
  }

  /** Close the peer and all connections. */
  _startPingWatch() {
    this._stopPingWatch();
    this._lastPingTime = Date.now();
    this._pingWatchTimer = setInterval(() => {
      if (!this.hostConnection) {
        this._stopPingWatch();
        return;
      }
      if (Date.now() - this._lastPingTime > WATCHDOG_TIMEOUT) {
        console.warn('[PeerManager] Host heartbeat lost — 30s without PING');
        this.hostConnection.close(); // triggers 'close' → 'peer-disconnected'
      }
    }, PING_INTERVAL);
  }

  _stopPingWatch() {
    if (this._pingWatchTimer) {
      clearInterval(this._pingWatchTimer);
      this._pingWatchTimer = null;
    }
  }

  destroy() {
    this._destroyed = true;
    this._stopHeartbeat();
    this._stopPingWatch();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    for (const conn of this.connections) {
      conn.close();
    }
    if (this.peer) {
      this.peer.destroy();
    }
    this.connections = [];
    this.connected = false;
    this.emit('destroyed');
  }

  // ── Internal ────────────────────────────────────────────────────────

  /** Set up a DataConnection with event handlers. */
  _setupDataConnection(conn) {
    conn.on('open', () => {
      // Avoid duplicates.
      const existing = this.connections.find((c) => c.peer === conn.peer);
      if (!existing) {
        this.connections.push(conn);
        this.emit('peer-connected', conn);
      }
      // Start PING watchdog for the host connection.
      if (conn === this.hostConnection) {
        this._startPingWatch();
      }
    });

    conn.on('data', (data) => {
      try {
        const message = deserialize(data);
        this.emit('message', message, conn);
        // Also emit a typed event for convenience.
        this.emit(`msg:${message.type}`, message.payload, conn);
        // Track ANY message from the host for loss detection.
        // Resets the PING watchdog — if the host is sending game state
        // updates, tiles, or heartbeats, it's clearly alive.  This also
        // prevents false positives during large state syncs that could
        // momentarily delay the dedicated PING heartbeat.
        if (conn === this.hostConnection) {
          this._lastPingTime = Date.now();
        }
      } catch (err) {
        console.error('[PeerManager] Failed to deserialize message:', err);
      }
    });

    conn.on('close', () => {
      this.connections = this.connections.filter((c) => c !== conn);
      if (conn === this.hostConnection) {
        this.hostConnection = null;
        this.connected = false;
        this._stopPingWatch();
      }
      this.emit('peer-disconnected', conn);
    });

    conn.on('error', (err) => {
      console.error('[PeerManager] Connection error:', err);
      this.emit('peer-error', err, conn);
    });
  }

  /** Reconnect a disconnected peer. */
  _reconnect() {
    if (this._destroyed) return;
    if (this.peer && !this.peer.disconnected) return;
    this.peer.reconnect();
    this.peer.once('open', () => {
      if (this._destroyed) return;
      this.connected = true;
      this.emit('reconnected');
    });
  }

  /** Start periodic ping to keep connections alive. */
  _startHeartbeat() {
    this._stopHeartbeat();
    this._pingTimer = setInterval(() => {
      this.broadcast(createMessage(MessageType.PING));
    }, PING_INTERVAL);
  }

  /** Stop heartbeat. */
  _stopHeartbeat() {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// HostPeerManager
// ---------------------------------------------------------------------------

/**
 * Host-side PeerManager. Creates the room and accepts incoming connections.
 */
export class HostPeerManager extends PeerManager {
  /**
   * @param {string} roomCode
   * @param {object} [settings]  Default game settings (expansions, etc.)
   */
  /**
   * @param {string} roomCode
   * @param {object} [settings]  Default game settings (expansions, etc.)
   * @param {string} [hostName]  The host player's display name
   */
  constructor(roomCode, settings = {}, hostName = 'Host', maxPlayers = 6) {
    super('host', roomCode);
    this.maxPlayers = maxPlayers;
    this.settings = {
      expansions: ['base-game'],
      turnTimer: 0,
      ...settings,
    };
    this.hostName = hostName;
    this.connectedPlayers = []; // { id, conn, name, playerIndex }
    this._initHostDisconnectHandler();
  }

  /** Update the host's display name (e.g. from the name input field). */
  setHostName(name) {
    this.hostName = name || 'Host';
  }

  /**
   * Auto-cleanup: when a client's DataConnection closes, remove them from
   * connectedPlayers and notify other clients.
   */
  _initHostDisconnectHandler() {
    this.on('peer-disconnected', (conn) => {
      const idx = this.connectedPlayers.findIndex((p) => p.conn === conn);
      if (idx !== -1) {
        const removed = this.connectedPlayers.splice(idx, 1)[0];
        // Notify remaining clients that this player left.
        this.broadcast(createMessage(MessageType.PLAYER_LEFT, {
          playerIndex: removed.playerIndex,
          name: removed.name,
        }));
      }
    });
  }

  /**
   * Accept a join request from a client.
   * @param {object} conn  DataConnection
   * @param {string} playerName
   * @param {number} [preferredIndex] - Specific slot index to assign (for slot-based lobby).
   *        If not provided, uses the next sequential index (connectedPlayers.length + 1).
   * @returns {{ accepted: boolean, playerIndex?: number, reason?: string }}
   */
  acceptJoin(conn, playerName, preferredIndex) {
    if (this.connectedPlayers.length >= this.maxPlayers) {
      this.send(conn, createMessage(MessageType.JOIN_REJECT, { reason: 'Game is full' }));
      return { accepted: false, reason: 'Game is full' };
    }

    const playerIndex = preferredIndex != null ? preferredIndex : this.connectedPlayers.length + 1; // 0 is host
    this.connectedPlayers.push({
      id: conn.peer,
      conn,
      name: playerName,
      playerIndex,
    });

    this.send(conn, createMessage(MessageType.JOIN_ACCEPT, {
      playerId: conn.peer,
      playerIndex,
      players: this.getPlayerList(),
      settings: this.settings,
      maxPlayers: this.maxPlayers,
    }));

    // Notify others.
    this.broadcast(createMessage(MessageType.PLAYER_JOINED, {
      id: conn.peer,
      name: playerName,
      playerIndex,
    }));

    return { accepted: true, playerIndex };
  }

  /** Build the lobby player list (host + joined clients). */
  getPlayerList() {
    const list = [
      { id: this.peer.id, name: this.hostName || 'Host', playerIndex: 0, isHost: true },
    ];
    for (const p of this.connectedPlayers) {
      list.push({ id: p.id, name: p.name, playerIndex: p.playerIndex, isHost: false });
    }
    return list;
  }

  /** Broadcast the current lobby state. */
  broadcastLobby() {
    this.broadcast(createMessage(MessageType.LOBBY_STATE, {
      players: this.getPlayerList(),
      settings: this.settings,
      maxPlayers: this.maxPlayers,
    }));
  }

  /** Update a setting and broadcast. */
  updateSetting(key, value) {
    this.settings[key] = value;
    this.broadcast(createMessage(MessageType.SETTINGS_UPDATE, { key, value }));
  }

  /** Kick a connected player by their player index. */
  kickPlayer(playerIndex) {
    const idx = this.connectedPlayers.findIndex((p) => p.playerIndex === playerIndex);
    if (idx === -1) return;
    const player = this.connectedPlayers[idx];
    this.send(player.conn, createMessage(MessageType.KICK, { reason: 'Kicked by host' }));
    player.conn.close();
    this.connectedPlayers.splice(idx, 1);
    this.broadcast(createMessage(MessageType.PLAYER_LEFT, {
      playerIndex,
      name: player.name,
    }));
  }

  /** Notify all clients that the game is starting. */
  startGame(initialState) {
    this.broadcast(createMessage(MessageType.GAME_STARTING, {
      initialState: this._sanitizeState(initialState),
    }));
  }

  /** Broadcast the full game state to all clients. */
  broadcastState(state) {
    this.broadcast(createMessage(MessageType.GAME_STATE_SYNC, {
      state: this._sanitizeState(state),
    }));
  }

  /**
   * Strip internal fields before sending to clients:
   * - Remove full tile objects (clients only need tile IDs)
   * - Remove unusedTiles (clients only need the count)
   */
  _sanitizeState(state) {
    return {
      name: state.name,
      expansions: state.expansions,
      finished: state.finished,
      featureScores: state.featureScores || [],
      players: state.players.map((p) => ({
        username: p.user?.username || 'Player',
        color: p.color,
        points: p.points,
        remainingMeeples: p.remainingMeeples,
        active: p.active,
        goods: p.goods,
        towers: p.towers,
        hasLargeMeeple: p.hasLargeMeeple || false,
        hasBuilderMeeple: p.hasBuilderMeeple || false,
        hasPigMeeple: p.hasPigMeeple || false,
      })),
      placedTiles: state.placedTiles.map((pt) => ({
        tileId: pt.tile.id,
        rotation: pt.rotation,
        x: pt.x,
        y: pt.y,
        playerIndex: pt.playerIndex,
        meeples: pt.meeples.map((m) => ({
          playerIndex: m.playerIndex,
          placement: m.placement,
          meepleType: m.meepleType,
          scored: m.scored,
        })),
        towerHeight: pt.tower ? pt.tower.height : undefined,
        completed: pt.tower ? pt.tower.completed : undefined,
      })),
      currentPlayerIndex: state.currentPlayerIndex,
      activeTile: state.activeTile
        ? {
            tileId: state.activeTile.tile.id,
            validPlacements: state.activeTile.validPlacements
              ? state.activeTile.validPlacements.map((vp) => ({
                  x: vp.x,
                  y: vp.y,
                  rotations: vp.rotations.map((r) => ({
                    rotation: r.rotation,
                    meeples: r.meeples ? r.meeples.map((m) => ({
                      meepleType: m.meepleType,
                      locationType: m.locationType,
                      index: m.index,
                    })) : [],
                  })),
                }))
              : [],
          }
        : null,
      unusedTilesCount: (state.unusedTiles || []).length,
      step: state.step,
      messages: state.messages,
    };
  }
}

// ---------------------------------------------------------------------------
// ClientPeerManager
// ---------------------------------------------------------------------------

/**
 * Client-side PeerManager. Connects to the host and sends move requests.
 */
export class ClientPeerManager extends PeerManager {
  constructor(roomCode) {
    super('client', roomCode);
    this.playerIndex = null;
    this.playerName = '';
  }

  /**
   * Connect to the host's peer.
   * @param {string} playerName
   * @param {number} [preferredIndex]  Previously assigned player index for reconnection
   * @returns {Promise<{ playerIndex: number }>}
   */
  async connectToHost(playerName, preferredIndex) {
    this.playerName = playerName;
    this._preferredIndex = preferredIndex;
    const hostPeerId = roomCodeToPeerId(this.roomCode);

    // Wait for peer ready.
    await this.init();

    // Connect to host.
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(hostPeerId, {
        reliable: true,
        serialization: 'binary',
      });

      this._setupDataConnection(conn);
      this.hostConnection = conn;

      // Send join request once connected — pass preferredIndex for reconnection.
      conn.on('open', () => {
        this.send(conn, joinRequest(playerName, preferredIndex));
      });

      // ── Single settlement guard ────────────────────────────────────────
      // Every exit path (JOIN_ACCEPT, JOIN_REJECT, timeout, peer destroyed)
      // goes through settle(), which guarantees listeners are cleaned up
      // and the promise is settled exactly once.
      let settled = false;
      let timeoutId = null;
      const settle = (type, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.off('message', onJoinResult);
        this.off('destroyed', onDestroyed);
        if (type === 'resolve') resolve(value);
        else reject(value);
      };

      // Listen for join accept/reject.
      const onJoinResult = (message, sourceConn) => {
        if (sourceConn !== conn) return;

        if (message.type === MessageType.JOIN_ACCEPT) {
          this.playerIndex = message.payload.playerIndex;
          settle('resolve', {
            playerIndex: this.playerIndex,
            players: message.payload.players || [],
            settings: message.payload.settings || {},
          });
        } else if (message.type === MessageType.JOIN_REJECT) {
          settle('reject', new Error(message.payload.reason || 'Join rejected'));
        }
      };

      this.on('message', onJoinResult);

      // When the caller destroys this peer (e.g. a reconnection timeout in
      // _attemptReconnect), reject the promise so the retry loop can
      // advance immediately instead of hanging on a dead peer.
      const onDestroyed = () => settle('reject', new Error('Connection aborted'));
      this.once('destroyed', onDestroyed);

      // Safety timeout — should rarely fire because _attemptReconnect now
      // uses a 2s deadline per attempt and destroys the peer on timeout.
      timeoutId = setTimeout(() => {
        if (!settled && !this._destroyed) {
          settle('reject', new Error('Connection timed out'));
        }
      }, 15000);
    });
  }

  /** Send a move request to the host. */
  sendMove(moveMessage) {
    if (this.hostConnection && this.hostConnection.open) {
      this.send(this.hostConnection, moveMessage);
    }
  }

  /** Place tile move. */
  placeTile(x, y, rotation, meeple) {
    this.sendMove(createMessage(MessageType.PLACE_TILE, { x, y, rotation, meeple }));
  }

  /** Place meeple on an already-placed tile. */
  placeMeeple(tileIndex, locationType, index, meepleType) {
    this.sendMove(createMessage(MessageType.PLACE_MEEPLE, { tileIndex, locationType, index, meepleType }));
  }

  /** Skip meeple placement. */
  skipMeeple() {
    this.sendMove(createMessage(MessageType.SKIP_MEEPLE, {}));
  }

  /** Skip entire turn. */
  skipTurn() {
    this.sendMove(createMessage(MessageType.SKIP_TURN, {}));
  }

  /** Send a chat message. */
  sendChat(text) {
    this.sendMove(createMessage(MessageType.CHAT_MESSAGE, {
      username: this.playerName,
      message: text,
      timestamp: Date.now(),
    }));
  }

  /** Place a tower piece on a tower tile. tileIndex -1 means skip. */
  placeTowerPiece(tileIndex) {
    this.sendMove(createMessage(MessageType.PLACE_TOWER, { tileIndex }));
  }

  /** Capture a meeple. */
  captureMeeple(tileIndex, meepleIndex) {
    this.sendMove(createMessage(MessageType.CAPTURE_MEEPLE, { tileIndex, meepleIndex }));
  }
}
