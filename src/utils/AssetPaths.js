/**
 * AssetPaths.js — Base-aware image URL helper.
 *
 * On GitHub Pages (or any sub-path deployment) Vite's `base` config is
 * `/carcassonne/`.  Image URLs in the source must be prefixed with this
 * base path so they resolve correctly in production.
 *
 * Use `import.meta.env.BASE_URL` which Vite substitutes at build time.
 * Falls back to `/` during development or fallback.
 */

const BASE =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.BASE_URL) ||
  '/';

/**
 * Return a base-aware URL for the given asset path.
 *
 * @param {string} path  Asset path, e.g. '/images/tiles/base-game/C.png'
 *                        or 'images/tiles/base-game/C.png' (leading / is OK).
 * @returns {string}     Full path including base, e.g. '/carcassonne/images/...'
 */
export function img(path) {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  return BASE + clean;
}

/**
 * Return the path for a large meeple image.
 * Large meeples (Inns & Cathedrals) reuse the standing/lying images,
 * rendered at a larger size — no separate image file needed.
 * Provided for compatibility; prefer using img() with standing/lying suffix.
 *
 * @param {string} color  Color name (e.g. 'red', 'blue')
 * @param {string} location  'farm' → 'lying', otherwise 'standing'
 * @returns {string}  Base-aware path to the meeple image
 */
export function getLargeMeeplePath(color, location) {
  const suffix = location === 'farm' ? 'lying' : 'standing';
  return img(`/images/meeples/${color}_${suffix}.png`);
}
