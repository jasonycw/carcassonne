/**
 * Protocol.js — P2P message types and serialisation for Carcassonne.
 *
 * Defines the wire protocol shared between the host and remote clients.
 * All game-related messages are JSON-serialised and sent over a
 * PeerJS data connection.
 *
 * Message format:
 *   { type: string, payload: object, seq: number }
 *
 * @module Protocol
 */

// ---------------------------------------------------------------------------
// Message type constants
// ---------------------------------------------------------------------------

export const MessageType = {
  // ── Connection / handshake ──────────────────────────────────────────
  JOIN_REQUEST:       'join_request',
  JOIN_ACCEPT:        'join_accept',
  JOIN_REJECT:        'join_reject',
  LEAVE:              'leave',
  PING:               'ping',
  PONG:               'pong',

  // ── Lobby ────────────────────────────────────────────────────────────
  LOBBY_STATE:        'lobby_state',       // full lobby snapshot
  PLAYER_JOINED:      'player_joined',      // a new client has been accepted
  PLAYER_LEFT:        'player_left',
  GAME_STARTING:      'game_starting',      // host has started the game
  SETTINGS_UPDATE:    'settings_update',    // expansion / turn timer changes
  KICK:               'kick',               // host → client: you've been kicked
  PLAYER_NAME_UPDATED: 'player_name_updated', // host → all: a player's name changed
  NAME_CHANGE:        'name_change',        // client → host: I changed my name

  // ── Game actions (client → host) ────────────────────────────────────
  PLACE_TILE:         'place_tile',         // { x, y, rotation, meeple }
  PLACE_MEEPLE:       'place_meeple',       // { tileIndex, locationType, index, meepleType }
  SKIP_MEEPLE:        'skip_meeple',
  SKIP_TURN:          'skip_turn',
  PLACE_TOWER:        'place_tower',        // { tileIndex }
  CAPTURE_MEEPLE:     'capture_meeple',     // { tileIndex, meepleIndex }

  // ── Game state (host → client) ──────────────────────────────────────
  GAME_STATE_SYNC:    'game_state_sync',    // full state snapshot
  GAME_STATE_DIFF:    'game_state_diff',    // incremental update
  VALID_MOVES:        'valid_moves',        // valid placements for active player
  MOVE_RESULT:        'move_result',        // { success, message, diff? }
  TILE_DRAWN:         'tile_drawn',         // { tileId, validPlacements }
  GAME_OVER:          'game_over',          // final state

  // ── Chat ────────────────────────────────────────────────────────────
  CHAT_MESSAGE:       'chat_message',       // { username, message, timestamp }
};

// ---------------------------------------------------------------------------
// Message construction helpers
// ---------------------------------------------------------------------------

let _seq = 0;

function nextSeq() {
  return ++_seq;
}

/** Create a message object. */
export function createMessage(type, payload = {}) {
  return { type, payload, seq: nextSeq() };
}

// ---------------------------------------------------------------------------
// Serialise / deserialise
// ---------------------------------------------------------------------------

/** Serialise a message to JSON string. */
export function serialize(message) {
  return JSON.stringify(message);
}

/** Deserialise a JSON string back to a message object. */
export function deserialize(data) {
  if (typeof data === 'string') {
    return JSON.parse(data);
  }
  return data; // already an object
}

// ---------------------------------------------------------------------------
// Convenience creators
// ---------------------------------------------------------------------------

export function joinRequest(playerName) {
  return createMessage(MessageType.JOIN_REQUEST, { playerName });
}

export function joinAccept(playerId, players, settings) {
  return createMessage(MessageType.JOIN_ACCEPT, { playerId, players, settings });
}

export function joinReject(reason) {
  return createMessage(MessageType.JOIN_REJECT, { reason });
}

export function lobbyState(players, settings) {
  return createMessage(MessageType.LOBBY_STATE, { players, settings });
}

export function gameStarting(initialState) {
  return createMessage(MessageType.GAME_STARTING, { initialState });
}

export function gameStateSync(state) {
  return createMessage(MessageType.GAME_STATE_SYNC, { state });
}

export function gameStateDiff(diff) {
  return createMessage(MessageType.GAME_STATE_DIFF, { diff });
}

export function tileDrawn(tileId, validPlacements) {
  return createMessage(MessageType.TILE_DRAWN, { tileId, validPlacements });
}

export function moveResult(success, message, diff) {
  return createMessage(MessageType.MOVE_RESULT, { success, message, diff });
}

export function gameOver(finalState) {
  return createMessage(MessageType.GAME_OVER, { state: finalState });
}

export function chatMessage(username, message) {
  return createMessage(MessageType.CHAT_MESSAGE, { username, message, timestamp: Date.now() });
}

export function placeTileMove(x, y, rotation, meeple) {
  return createMessage(MessageType.PLACE_TILE, { x, y, rotation, meeple });
}

export function placeMeepleMove(tileIndex, locationType, index, meepleType) {
  return createMessage(MessageType.PLACE_MEEPLE, { tileIndex, locationType, index, meepleType });
}

export function skipMeepleMove() {
  return createMessage(MessageType.SKIP_MEEPLE, {});
}

export function skipTurnMove() {
  return createMessage(MessageType.SKIP_TURN, {});
}

export function placeTowerMove(tileIndex) {
  return createMessage(MessageType.PLACE_TOWER, { tileIndex });
}

export function captureMeepleMove(tileIndex, meepleIndex) {
  return createMessage(MessageType.CAPTURE_MEEPLE, { tileIndex, meepleIndex });
}
