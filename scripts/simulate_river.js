import { ALL_TILES } from '../src/game/TileData.js';
import {
  createGameState,
  initializeNewGame,
  placeTile,
  skipTowerStep,
} from '../src/game/GameLogic.js';

const state = createGameState(['base-game', 'the-river', 'the-tower'], 2, ALL_TILES);
initializeNewGame(state, ALL_TILES.find((tile) => tile.startingTile));
console.log('source', state.placedTiles[0].tile.id, 'active', state.activeTile?.tile.id, 'valid', state.activeTile?.validPlacements.length);

for (let turn = 1; turn <= 20 && !state.finished; turn += 1) {
  const active = state.activeTile;
  if (!active) break;
  const placement = active.validPlacements[0];
  console.log(turn, active.tile.id, 'river', Boolean(active.isRiver), 'open', state.riverOpenDirection, 'tail', state.riverTailIndex, 'valid', active.validPlacements.length, placement);
  if (!placement) break;
  const rotation = placement.rotations[0];
  const result = placeTile(state, placement.x, placement.y, rotation.rotation);
  if (!result.success) {
    console.log('place failed', result);
    break;
  }
  if (state.step === 'tower') {
    const skipped = skipTowerStep(state);
    if (!skipped.success) {
      console.log('tower skip failed', skipped);
      break;
    }
  }
  if (!state.riverPhase) {
    console.log('river ended after turn', turn, 'placed', state.placedTiles.at(-1)?.tile.id);
    break;
  }
}
console.log('final', {
  riverPhase: state.riverPhase,
  riverTiles: state.riverTiles.length,
  placed: state.placedTiles.map((tile) => tile.tile.id),
  active: state.activeTile?.tile.id,
  valid: state.activeTile?.validPlacements.length,
});
