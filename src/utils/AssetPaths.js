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
