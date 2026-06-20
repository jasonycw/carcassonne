/**
 * GameHost.js — Host-side game orchestration for P2P Carcassonne.
 *
 * Wraps HostPeerManager to listen for incoming client moves,
 * validate them via GameLogic, broadcast state updates, and emit
 * events for the GameView UI.
 *
 * NOTE: The host player's own moves are handled directly by GameView
 * (calling GameLogic) for simplicity. GameHost only handles REMOTE
 * client moves and state broadcasting after either local or remote moves.
 *
 * @module GameHost
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { MessageType, createMessage, gameOver } from './Protocol.js';
import {
  placeTile as glPlaceTile,
  placeMeeple as glPlaceMeeple,
  skipMeeple as glSkipMeeple,
  skipTurn as glSkipTurn,
  placeTowerPiece as glPlaceTowerPiece,
  captureMeeple as glCaptureMeeple,
  skipTowerStep as glSkipTowerStep,
  skipCapture as glSkipCapture,
} from '../game/GameLogic.js';
import { saveGame } from './StateSync.js';

export class GameHost extends EventEmitter {
  /**
   * @param {object} hostPeerManager  HostPeerManager instance
   * @param {object} gamestate        Game state (mutated in place)
   */
  constructor(hostPeerManager, gamestate) {
    super();
    this.hostPeerManager = hostPeerManager;
    this.gamestate = gamestate;
    this._init();
  }

  /** Set up incoming message listeners from connected clients. */
  _init() {
    this.hostPeerManager.on('message', (message, conn) => {
      switch (message.type) {
        case MessageType.PLACE_TILE:
          this._handlePlaceTile(message.payload, conn);
          break;
        case MessageType.PLACE_MEEPLE:
          this._handlePlaceMeeple(message.payload, conn);
          break;
        case MessageType.SKIP_MEEPLE:
          this._handleSkipMeeple(conn);
          break;
        case MessageType.SKIP_TURN:
          this._handleSkipTurn(conn);
          break;
        case MessageType.CHAT_MESSAGE:
          this._relayChat(message.payload);
          break;
        case MessageType.PLACE_TOWER:
          this._handlePlaceTower(message.payload, conn);
          break;
        case MessageType.CAPTURE_MEEPLE:
          this._handleCaptureMeeple(message.payload, conn);
          break;
        case MessageType.JOIN_REQUEST:
          this._handleJoinRequest(message.payload, conn);
          break;
      }
    });
  }

  /**
   * Handle a JOIN_REQUEST during an active game (client reconnection).
   * Accepts the connection, assigns the first available non-host slot,
   * then broadcasts the current game state so the reconnecting client
   * can reconstruct the board and resume play.
   */
  _handleJoinRequest(payload, conn) {
    const playerName = (payload && payload.playerName) || 'Reconnecting Player';
    console.log('[GameHost] Reconnection attempt by:', playerName);

    // Find the first player slot not held by a currently connected remote.
    // Slot 0 is always the host — skip it.
    let targetSlot = -1;
    const connectedIndices = this.hostPeerManager.connectedPlayers.map(p => p.playerIndex);
    for (let i = 1; i < this.gamestate.players.length; i++) {
      if (!connectedIndices.includes(i)) {
        targetSlot = i;
        break;
      }
    }
    if (targetSlot === -1) {
      // All slots are held by connected clients — assign the next available index.
      targetSlot = this.gamestate.players.length;
    }

    // Accept the join on the host PeerManager side.
    const result = this.hostPeerManager.acceptJoin(conn, playerName, targetSlot);
    if (result && result.accepted) {
      console.log('[GameHost] Reconnection accepted for', playerName, 'as player', targetSlot);
      // Send the full current state to the reconnecting client.
      const sanitized = this.hostPeerManager._sanitizeState(this.gamestate);
      this.hostPeerManager.send(conn, createMessage(MessageType.GAME_STATE_SYNC, { state: sanitized }));
      // Broadcast a player-joined notification so other clients know.
      this.hostPeerManager.broadcast(createMessage(MessageType.PLAYER_JOINED, {
        id: conn.peer,
        name: playerName,
        playerIndex: targetSlot,
      }));
    } else {
      console.log('[GameHost] Reconnection rejected for', playerName, result ? result.reason : 'unknown');
    }
  }

  /**
   * Handle a PLACE_TILE move from a remote client.
   * Validates via placeTile(), sends back MOVE_RESULT, broadcasts new state.
   */
  _handlePlaceTile(payload, conn) {
    // Validate sender is the current player.
    const playerEntry = conn ? this.hostPeerManager.connectedPlayers.find(p => p.conn === conn) : null;
    const senderIdx = playerEntry ? playerEntry.playerIndex : this.gamestate.currentPlayerIndex;
    if (senderIdx !== this.gamestate.currentPlayerIndex) {
      if (conn) {
        this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, {
          success: false, message: 'Not your turn',
        }));
      }
      return;
    }

    const { x, y, rotation, meeple } = payload;
    const result = glPlaceTile(this.gamestate, x, y, rotation, meeple);

    if (conn) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, {
        success: result.success,
        message: result.message || null,
      }));
    }

    if (result.success) {
      this._afterStateChange();
    }
  }

  /** Handle a PLACE_MEEPLE move from a remote client. */
  _handlePlaceMeeple(payload, conn) {
    if (!this._validateTurn(conn)) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, { success: false, message: 'Not your turn' }));
      return;
    }

    const { tileIndex, locationType, index, meepleType } = payload;
    const result = glPlaceMeeple(this.gamestate, tileIndex, locationType, index, meepleType);
    const success = result !== false;

    if (conn) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, { success }));
    }

    if (success) {
      this._afterStateChange();
    }
  }

  /** Handle a SKIP_MEEPLE from a remote client. */
  _handleSkipMeeple(conn) {
    if (!this._validateTurn(conn)) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, { success: false, message: 'Not your turn' }));
      return;
    }
    glSkipMeeple(this.gamestate);
    this._afterStateChange();
  }

  /** Handle a SKIP_TURN from a remote client. */
  _handleSkipTurn(conn) {
    if (!this._validateTurn(conn)) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, { success: false, message: 'Not your turn' }));
      return;
    }
    glSkipTurn(this.gamestate);
    this._afterStateChange();
  }

  /** Validate that the sender is the current player. */
  _validateTurn(conn) {
    if (!conn) return true; // host player, always valid
    const playerEntry = this.hostPeerManager.connectedPlayers.find(p => p.conn === conn);
    return playerEntry && playerEntry.playerIndex === this.gamestate.currentPlayerIndex;
  }

  /**
   * Handle a PLACE_TOWER move from a remote client.
   * tileIndex -1 means skip the tower step.
   */
  _handlePlaceTower(payload, conn) {
    if (!this._validateTurn(conn)) return;

    const { tileIndex } = payload;
    let result;

    if (tileIndex === -1) {
      // Client is skipping the tower step.
      result = glSkipTowerStep(this.gamestate);
    } else {
      result = glPlaceTowerPiece(this.gamestate, tileIndex);
    }

    if (conn) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, {
        success: result.success,
        message: result.message || null,
      }));
    }

    if (result.success) {
      this._afterStateChange();
    }
  }

  /**
   * Handle a CAPTURE_MEEPLE move from a remote client.
   */
  _handleCaptureMeeple(payload, conn) {
    if (!this._validateTurn(conn)) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, { success: false, message: 'Not your turn' }));
      return;
    }

    const result = glCaptureMeeple(this.gamestate, payload.tileIndex, payload.meepleIndex);

    if (conn) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, { success: result.success }));
    }

    if (result.success) {
      this._afterStateChange();
    }
  }

  /** Relay a chat message from a client to all connected peers. */
  _relayChat(payload) {
    this.hostPeerManager.broadcast(createMessage(MessageType.CHAT_MESSAGE, payload));
    this.emit('chat-message', payload);
  }

  /** Broadcast chat from the host player. */
  broadcastChat(username, text) {
    const payload = { username, message: text, timestamp: Date.now() };
    this.hostPeerManager.broadcast(createMessage(MessageType.CHAT_MESSAGE, payload));
    this.emit('chat-message', payload);
  }

  /** Called after a successful tile placement — broadcast and check game-over. */
  _afterStateChange() {
    this.broadcastState();
    this._checkGameOver();
  }

  /** Emit game-over if the state is flagged as finished. */
  _checkGameOver() {
    if (this.gamestate.finished) {
      // Broadcast GAME_OVER with sanitized state so clients can reconstruct.
      const sanitized = this.hostPeerManager._sanitizeState(this.gamestate);
      this.hostPeerManager.broadcast(gameOver(sanitized));
      this.emit('game-over', this.gamestate);
    }
  }

  /** Broadcast the current game state to all connected peers. */
  broadcastState() {
    console.log('[GameHost] Broadcasting state', {
      players: this.gamestate.players?.length,
      placedTiles: this.gamestate.placedTiles?.length,
      currentPlayerIndex: this.gamestate.currentPlayerIndex,
      step: this.gamestate.step,
      finished: this.gamestate.finished,
    });
    this.hostPeerManager.broadcastState(this.gamestate);
    saveGame(this.gamestate);
    this.emit('state-changed', this.gamestate);
  }

  /** Clean up. */
  destroy() {
    this.removeAllListeners();
  }
}
