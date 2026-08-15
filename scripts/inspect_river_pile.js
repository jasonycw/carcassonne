import { ALL_TILES } from '../src/game/TileData.js';
import { createGameState } from '../src/game/GameLogic.js';

const riverDefs = ALL_TILES.filter((tile) => tile.id.startsWith('the-river/'));
console.log(riverDefs.map((tile) => ({ id: tile.id, count: tile.count, source: Boolean(tile.river?.isSource), lake: Boolean(tile.river?.isLake) })));
const state = createGameState(['base-game', 'the-river'], 2, ALL_TILES);
console.log('river pile length', state.riverTiles.length, state.riverTiles.map((tile) => tile.id));
