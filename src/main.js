/**
 * main.js — Application entry point.
 *
 * Bootstraps the SPA: sets up the router and mounts the initial view
 * (LobbyView or GameView depending on URL params).
 */

import './styles/game.css';
import './styles/modern.css';
import { register, navigate, start } from './ui/Router.js';
import { LobbyView } from './ui/LobbyView.js';
import { GameView } from './ui/GameView.js';
import { initSettings } from './ui/SettingsPanel.js';
import { loadGame, loadP2pInfo, removeP2pInfo } from './network/StateSync.js';

// Root container — created by index.html.
const app = document.getElementById('app');

// Apply saved settings (dark mode, etc.) on startup.
initSettings();

// ── Route handlers ────────────────────────────────────────────────────

// Lobby (default route).
register('/', (params) => {
  const view = new LobbyView(app);
  view.mount(params);

  // Listen for game start.
  view.on('start-game', (config) => {
    // For P2P games, ensure ?room=XXXX is in the URL before navigating
    // so that both host and joiners preserve the room code in the address bar.
    if (config.roomCode && !config.isLocalGame) {
      history.replaceState(null, '', `?room=${encodeURIComponent(config.roomCode)}#/game`);
    }
    navigate('/game', config);
  });

  return view;
});

// Game view.
register('/game', (params) => {
  // If no localState was passed (e.g. page reload), try to recover from
  // localStorage, otherwise redirect to lobby where the resume banner lives.
  const localState = params.localState || loadGame();
  if (!localState) {
    navigate('/');
    return null;
  }

  // If we recovered from localStorage (no params.localState) and saved P2P
  // metadata exists, redirect to the lobby so the reconnection flow can
  // re-establish the PeerJS connection:
  //   - Host (playerIndex === 0) → LobbyView recreates the room (Issue 5)
  //   - Client (playerIndex > 0)  → LobbyView auto-joins the room (Issue 6)
  // NOTE: Use setTimeout to avoid re-entering resolve() while it's running.
  if (!params.localState) {
    const p2pInfo = loadP2pInfo();
    if (p2pInfo && p2pInfo.room) {
      if (p2pInfo.playerIndex === 0) {
        console.log('[main] Host P2P refresh detected, redirecting to lobby for recovery');
        setTimeout(() => navigate('/'), 0);
        return null;
      }
      console.log('[main] P2P client refresh detected, redirecting to room:', p2pInfo.room);
      setTimeout(() => navigate('/?room=' + encodeURIComponent(p2pInfo.room)), 0);
      return null;
    }
  }

  const config = {
    isHost: params.isHost !== undefined ? params.isHost : true,
    isLocalGame: params.isLocalGame !== undefined ? params.isLocalGame : true,
    peerManager: params.transferPeerManager || params.peerManager || null,
    localState,
    playerIndex: params.playerIndex || 0,
    localPlayers: params.localPlayers || localState.players,
  };

  const view = new GameView(config);
  view.mount(app);
  return view;
});

// ── Start the router ──────────────────────────────────────────────────

start();
