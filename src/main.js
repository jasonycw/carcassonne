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
import { loadGame } from './network/StateSync.js';

// Root container — created by index.html.
const app = document.getElementById('app');

// Apply saved settings (dark mode, etc.) on startup.
initSettings();

// ── Route handlers ────────────────────────────────────────────────────

// Lobby (default route).
register('/', (params) => {
  const view = new LobbyView(app);
  view.mount();

  // Listen for game start.
  view.on('start-game', (config) => {
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

  const config = {
    isHost: params.isHost !== undefined ? params.isHost : true,
    isLocalGame: params.isLocalGame !== undefined ? params.isLocalGame : true,
    peerManager: params.peerManager || null,
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
