/**
 * ChatPanel.js — In-game chat panel for Carcassonne.
 *
 * Manages its own DOM inside a given container, provides methods
 * for adding messages, and emits events when the player sends a message.
 *
 * @module ChatPanel
 */

import { EventEmitter } from '../utils/EventEmitter.js';

const CHAT_HTML = `
<div id="chat-panel" style="
  position: absolute; bottom: 70px; right: 12px; width: 260px;
  background: rgba(26,26,46,0.92); border-radius: 8px;
  border: 1px solid #333; color: #ddd; font-size: 0.8rem;
  font-family: 'Segoe UI', sans-serif; display: none;
">
  <div id="chat-messages" style="height: 150px; overflow-y: auto; padding: 8px;"></div>
  <div style="display: flex; border-top: 1px solid #333;">
    <input id="chat-input" type="text" placeholder="Chat..."
      style="flex:1; padding: 6px 8px; border: none; background: transparent; color: #eee;" />
    <button id="chat-send-btn" style="
      padding: 6px 12px; border: none; background: #4fc3f7; color: #111; cursor: pointer;
    ">Send</button>
  </div>
</div>
`;

export class ChatPanel extends EventEmitter {
  /**
   * @param {HTMLElement} parent  Parent element to mount into
   */
  constructor(parent) {
    super();
    this.parent = parent;
    this.dom = null;
    this._visible = false;
  }

  /** Create the chat DOM and attach event handlers. */
  mount() {
    // Insert chat HTML before any existing children.
    const wrapper = document.createElement('div');
    wrapper.innerHTML = CHAT_HTML;
    this.dom = {
      panel: wrapper.firstElementChild,
      messages: null,
      input: null,
      sendBtn: null,
    };

    const panel = this.dom.panel;
    this.dom.messages = panel.querySelector('#chat-messages');
    this.dom.input = panel.querySelector('#chat-input');
    this.dom.sendBtn = panel.querySelector('#chat-send-btn');

    this.parent.appendChild(panel);

    this.dom.sendBtn.addEventListener('click', () => this._send());
    this.dom.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._send();
    });
  }

  /** Remove the chat DOM and clean up. */
  destroy() {
    if (this.dom && this.dom.panel) {
      this.dom.panel.remove();
    }
    this.dom = null;
    this.removeAllListeners();
  }

  /** Toggle chat visibility. */
  toggle() {
    if (!this.dom) return;
    this._visible = !this._visible;
    this.dom.panel.style.display = this._visible ? 'block' : 'none';
  }

  /** Show the chat panel. */
  show() {
    if (!this.dom) return;
    this._visible = true;
    this.dom.panel.style.display = 'block';
  }

  /** Hide the chat panel. */
  hide() {
    if (!this.dom) return;
    this._visible = false;
    this.dom.panel.style.display = 'none';
  }

  /**
   * Add a message to the chat display.
   * @param {string} username
   * @param {string} text
   */
  addMessage(username, text) {
    if (!this.dom || !this.dom.messages) return;
    const el = document.createElement('div');
    el.innerHTML = `<strong>${this._escape(username)}:</strong> ${this._escape(text)}`;
    el.style.margin = '2px 0';
    this.dom.messages.appendChild(el);
    this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
  }

  /** Send the current input text. */
  _send() {
    if (!this.dom || !this.dom.input) return;
    const text = this.dom.input.value.trim();
    if (!text) return;
    this.dom.input.value = '';
    this.emit('send', text);
  }

  _escape(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
