/**
 * SettingsPanel.js — Player preferences panel for Carcassonne.
 *
 * Stores settings in localStorage:
 *   - Sound on/off
 *   - Dark mode toggle
 *   - Player color preference
 *   - Nickname
 *
 * Emits 'settings-changed' when any setting is updated.
 *
 * @module SettingsPanel
 */

import { EventEmitter } from '../utils/EventEmitter.js';

const SETTINGS_KEY = 'carcassonne_settings';

/** Default settings. */
const DEFAULTS = {
  soundEnabled: true,
  darkMode: true,
  playerColor: '',
  nickname: '',
  meteredApiKey: '',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get all current settings (merged with defaults).
 * @returns {object}
 */
export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Update one or more settings and persist to localStorage.
 * @param {string|object} key   Setting name, or object of { key: value }
 * @param {*}            [value]
 */
export function updateSetting(key, value) {
  const settings = getSettings();

  if (typeof key === 'object' && key !== null) {
    Object.assign(settings, key);
  } else {
    settings[key] = value;
  }

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('[Settings] Failed to save:', err);
  }

  applySettings(settings);
}

/** Apply settings to the document (dark mode, etc.). */
export function applySettings(settings) {
  if (settings.darkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.body.style.background = '#1a1a2e';
    document.body.style.color = '#eee';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.body.style.background = '';
    document.body.style.color = '';
  }
}

/** Apply saved settings on load. */
export function initSettings() {
  applySettings(getSettings());
}

// ---------------------------------------------------------------------------
// Settings panel UI
// ---------------------------------------------------------------------------

const PANEL_HTML = `
<div id="settings-panel" style="
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(26,26,46,0.96); border: 1px solid #444;
  border-radius: 12px; padding: 24px; z-index: 40;
  min-width: 280px; color: #eee; font-family: 'Segoe UI', sans-serif;
  display: none;
">
  <h2 style="margin: 0 0 16px 0; font-size: 1.2rem;">Settings</h2>

  <label style="display:flex; align-items:center; gap:10px; margin-bottom:12px; font-size:0.9rem;">
    <input type="checkbox" id="setting-sound" /> Sound effects
  </label>

  <label style="display:flex; align-items:center; gap:10px; margin-bottom:12px; font-size:0.9rem;">
    <input type="checkbox" id="setting-darkmode" /> Dark mode
  </label>

  <div style="margin-bottom:12px; font-size:0.9rem;">
    <label style="display:block; margin-bottom:4px; opacity:0.7;">Meeple color</label>
    <select id="setting-color" style="
      width:100%; padding:6px; border-radius:6px; border:1px solid #444;
      background:#16213e; color:#eee; font-size:0.9rem;
    ">
      <option value="">Auto (default)</option>
      <option value="red">Red</option>
      <option value="blue">Blue</option>
      <option value="green">Green</option>
      <option value="orange">Orange</option>
      <option value="purple">Purple</option>
      <option value="teal">Teal</option>
    </select>
  </div>

  <hr style="border:none;border-top:1px solid #444;margin:16px 0;" />

  <div style="font-size:0.85rem; margin-bottom:8px;">
    <label style="display:block; margin-bottom:4px; opacity:0.7;">
      Metered.ca API Key <em style="opacity:0.5;">(for P2P multiplayer)</em>
    </label>
    <input type="text" id="setting-turn-apikey" placeholder="Enter your free API key" style="
      width:100%; padding:6px; border-radius:6px; border:1px solid #444;
      background:#16213e; color:#eee; font-size:0.85rem; box-sizing:border-box;
    " />
    <div style="margin-top:6px; opacity:0.6; line-height:1.5;">
      Enable relay connectivity when direct P2P fails (CGNAT / firewalls).
      Free signup at
      <a href="https://dashboard.metered.ca/signup" target="_blank" rel="noopener"
         style="color:#6af; text-decoration:none;">dashboard.metered.ca</a>
      → TURN Servers → generate credential → copy the <strong>API Key</strong>.
    </div>
  </div>

  <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
    <button id="settings-close" style="
      padding:8px 20px; border-radius:6px; border:1px solid #555;
      background:transparent; color:#eee; cursor:pointer;
    ">Close</button>
  </div>
</div>
`;

export class SettingsPanelUI extends EventEmitter {
  /**
   * @param {HTMLElement} parent  Parent element to mount into
   */
  constructor(parent) {
    super();
    this.parent = parent;
    this.dom = null;
  }

  /** Create the settings panel DOM. */
  mount() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = PANEL_HTML;
    this.dom = {
      panel: wrapper.firstElementChild,
      sound: null,
      darkMode: null,
      color: null,
      meteredApiKey: null,
      closeBtn: null,
    };

    const panel = this.dom.panel;
    this.dom.sound = panel.querySelector('#setting-sound');
    this.dom.darkMode = panel.querySelector('#setting-darkmode');
    this.dom.color = panel.querySelector('#setting-color');
    this.dom.meteredApiKey = panel.querySelector('#setting-turn-apikey');
    this.dom.closeBtn = panel.querySelector('#settings-close');

    // Load current settings.
    const settings = getSettings();
    this.dom.sound.checked = settings.soundEnabled;
    this.dom.darkMode.checked = settings.darkMode;
    this.dom.color.value = settings.playerColor || '';
    this.dom.meteredApiKey.value = settings.meteredApiKey || '';

    // Bind events.
    this.dom.sound.addEventListener('change', () => {
      updateSetting('soundEnabled', this.dom.sound.checked);
      this.emit('settings-changed', getSettings());
    });

    this.dom.darkMode.addEventListener('change', () => {
      updateSetting('darkMode', this.dom.darkMode.checked);
      this.emit('settings-changed', getSettings());
    });

    this.dom.color.addEventListener('change', () => {
      updateSetting('playerColor', this.dom.color.value);
      this.emit('settings-changed', getSettings());
    });

    this.dom.meteredApiKey.addEventListener('change', () => {
      updateSetting('meteredApiKey', this.dom.meteredApiKey.value.trim());
      this.emit('settings-changed', getSettings());
    });

    this.dom.closeBtn.addEventListener('click', () => this.hide());

    this.parent.appendChild(panel);
  }

  /** Remove the panel DOM. */
  destroy() {
    if (this.dom && this.dom.panel) {
      this.dom.panel.remove();
    }
    this.dom = null;
    this.removeAllListeners();
  }

  /** Show the settings panel. */
  show() {
    if (this.dom) this.dom.panel.style.display = 'block';
  }

  /** Hide the settings panel. */
  hide() {
    if (this.dom) this.dom.panel.style.display = 'none';
  }
}
