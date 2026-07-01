/**
 * ScoringFeed.js — Bottom-left scoring feed for Carcassonne.
 *
 * Shows scoring events after each move with the scoring player's color.
 * New entries push older ones up.
 *
 * @module ScoringFeed
 */

import { getColorHex } from '../rendering/ScoreBoard.js';

const FEED_HTML = `
<div id="scoring-feed" style="
  position: absolute; bottom: 12px; left: 12px; width: 240px;
  max-height: 200px;
  background: rgba(26,26,46,0.85); border-radius: 8px;
  border: 1px solid #333; color: #ddd;
  font-family: 'Segoe UI', sans-serif; font-size: 0.78rem;
  display: none; flex-direction: column; z-index: 15;
">
  <div id="scoring-feed-entries" style="
    padding: 4px; overflow-y: auto; max-height: 192px;
    display: flex; flex-direction: column-reverse;
  "></div>
</div>
`;

const featureLabels = {
  city: 'completed city',
  road: 'completed road',
  cloister: 'completed cloister',
  farm: 'farm',
  goods: 'goods majority',
};

/** Max entries before pruning oldest (at the visual top). */
const MAX_ENTRIES = 50;

export class ScoringFeed {
  /**
   * @param {HTMLElement} parent  Parent element to mount into
   */
  constructor(parent) {
    this.parent = parent;
    this.dom = null;
    /** @type {number} Number of _featureScores entries we've already shown */
    this._processedIndex = 0;
  }

  /** Create the DOM and attach to parent. */
  mount() {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = FEED_HTML;
    this.dom = {
      panel: wrapper.firstElementChild,
      entries: wrapper.querySelector('#scoring-feed-entries'),
    };
    this.parent.appendChild(this.dom.panel);
  }

  /** Remove DOM and reset. */
  destroy() {
    if (this.dom && this.dom.panel) {
      this.dom.panel.remove();
    }
    this.dom = null;
  }

  /** Show the feed panel. */
  show() {
    if (this.dom && this.dom.panel) {
      this.dom.panel.style.display = 'flex';
    }
  }

  /** Hide the feed panel. */
  hide() {
    if (this.dom && this.dom.panel) {
      this.dom.panel.style.display = 'none';
    }
  }

  /**
   * Add a single scoring entry to the feed.
   * New entry goes at the **bottom** of the visual stack; column-reverse
   * means we prepend to the DOM child list (= visual bottom).
   *
   * @param {number} playerIndex
   * @param {string} playerName
   * @param {string} colorName  Internal name e.g. 'red', 'blue'
   * @param {number} points
   * @param {string} featureType  'city' | 'road' | 'cloister' | 'farm' | 'goods'
   * @param {boolean} [complete]
   * @param {string} [subtype]  Goods subtype like 'fabric'
   */
  addEntry(playerIndex, playerName, colorName, points, featureType, complete, subtype) {
    if (!this.dom || !this.dom.entries) return;

    // Show the panel on the first entry so an empty box doesn't appear.
    if (this.dom.panel.style.display === 'none') this.show();

    const colorHex = getColorHex(colorName);
    const label = subtype
      ? `${subtype} goods`
      : (complete === false ? 'incomplete ' + featureType : (featureLabels[featureType] || featureType));
    const sign = points >= 0 ? '+' : '';
    const text = `${sign}${points} ${label}`;

    const el = document.createElement('div');
    el.style.cssText = 'display:flex; align-items:center; gap:4px; padding:2px 4px; margin:1px 0;';
    el.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;
                   background:${colorHex};flex-shrink:0;"></span>
      <span style="color:#ccc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        <span style="font-weight:bold;color:${colorHex};">${this._escape(playerName)}</span>
        ${this._escape(text)}
      </span>
    `;

    // column-reverse: prepend so newest visual bottom
    this.dom.entries.prepend(el);

    // Prune oldest (last child after prepend)
    while (this.dom.entries.children.length > MAX_ENTRIES) {
      this.dom.entries.lastChild.remove();
    }
  }

  /**
   * Process new entries from gamestate.featureScores.
   * Call after every state update to pick up unprocessed scoring events.
   *
   * @param {object} gamestate
   */
  processFeatureScores(gamestate) {
    if (!gamestate || !gamestate.featureScores) return;
    const scores = gamestate.featureScores;
    while (this._processedIndex < scores.length) {
      const entry = scores[this._processedIndex];
      for (const award of (entry.players || [])) {
        const player = gamestate.players[award.playerIndex];
        if (!player) continue;
        this.addEntry(
          award.playerIndex,
          player.user?.username || `Player ${award.playerIndex + 1}`,
          player.color,
          award.points,
          entry.type,
          entry.complete,
          entry.subtype,
        );
      }
      this._processedIndex++;
    }
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
