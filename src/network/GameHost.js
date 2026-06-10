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
import { MessageType, createMessage } from './Protocol.js';
import {
  placeTile as glPlaceTile,
  placeMeeple as glPlaceMeeple,
  skipMeeple as glSkipMeeple,
  skipTurn as glSkipTurn,
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
      }
    });
  }

  /**
   * Handle a PLACE_TILE move from a remote client.
   * Validates via placeTile(), sends back MOVE_RESULT, broadcasts new state.
   */
  _handlePlaceTile(payload, conn) {
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
    const { tileIndex, locationType, index, meepleType } = payload;
    const result = glPlaceMeeple(this.gamestate, tileIndex, locationType, index, meepleType);
    const success = result !== false;

    if (conn) {
      this.hostPeerManager.send(conn, createMessage(MessageType.MOVE_RESULT, { success }));
    }

    if (success) {
      this.broadcastState();
    }
  }

  /** Handle a SKIP_MEEPLE from a remote client. */
  _handleSkipMeeple(conn) {
    glSkipMeeple(this.gamestate);
    this.broadcastState();
  }

  /** Handle a SKIP_TURN from a remote client. */
  _handleSkipTurn(conn) {
    glSkipTurn(this.gamestate);
    this.broadcastState();
    this._checkGameOver();
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
      this.emit('game-over', this.gamestate);
    }
  }

  /** Broadcast the current game state to all connected peers. */
  broadcastState() {
    this.hostPeerManager.broadcastState(this.gamestate);
    saveGame(this.gamestate);
    this.emit('state-changed', this.gamestate);
  }

  /** Clean up. */
  destroy() {
    this.removeAllListeners();
  }
}
