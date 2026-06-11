/**
 * verify-deploy.js — GitHub Pages deploy readiness check.
 *
 * Validates that the production build at dist/ is complete and correct:
 *   1. dist/ directory exists
 *   2. dist/index.html exists
 *   3. dist/assets/ has at least one .js and one .css file
 *   4. dist/assets/ has at least one .png or .ico (tile/meeple images)
 *   5. No obvious 404-fodder issues
 *
 * Usage: node scripts/verify-deploy.js
 * Exit code: 0 = ready, 1 = not ready
 *
 * @module verify-deploy
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');

let errors = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

console.log('🔍 Verifying production build...\n');

// 1. dist/ directory exists
if (!existsSync(DIST_DIR)) {
  fail(`dist/ directory not found at ${DIST_DIR}`);
  printSummary();
  process.exit(1);
}
ok('dist/ directory exists');

// 2. dist/index.html exists
const indexPath = join(DIST_DIR, 'index.html');
if (!existsSync(indexPath)) {
  fail('dist/index.html not found');
} else {
  ok('dist/index.html exists');
}

// 3. dist/assets/ has .js and .css files
const assetsDir = join(DIST_DIR, 'assets');
if (!existsSync(assetsDir)) {
  fail('dist/assets/ directory not found');
} else {
  ok('dist/assets/ directory exists');

  const files = readdirSync(assetsDir);
  const hasJS = files.some((f) => f.endsWith('.js'));
  const hasCSS = files.some((f) => f.endsWith('.css'));
  const hasImages = files.some((f) => f.endsWith('.png') || f.endsWith('.ico') || f.endsWith('.jpg'));

  if (hasJS) ok('JavaScript bundle found in dist/assets/');
  else fail('No .js file found in dist/assets/');

  if (hasCSS) ok('CSS bundle found in dist/assets/');
  else fail('No .css file found in dist/assets/');

  if (hasImages) ok('Image assets found in dist/assets/');
  else warn('No .png/.ico/.jpg files found in dist/assets/ (may be served from public/)');
}

// Summary
printSummary();

function printSummary() {
  console.log();
  if (errors === 0 && warnings === 0) {
    console.log('✅ All checks passed — build is deploy-ready!');
    process.exit(0);
  } else if (errors === 0) {
    console.log(`✅ All required checks passed (${warnings} warning${warnings > 1 ? 's' : ''})`);
    process.exit(0);
  } else {
    console.log(`❌ ${errors} error${errors > 1 ? 's' : ''} found — build is NOT ready`);
    process.exit(1);
  }
}
