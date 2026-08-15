import { ALL_TILES } from '../src/game/TileData.js';
import { createGameState, initializeNewGame, placeTile, skipTowerStep } from '../src/game/GameLogic.js';

const state = createGameState(['base-game', 'the-river', 'the-tower'], 2, ALL_TILES);
initializeNewGame(state, ALL_TILES.find((tile) => tile.startingTile));
console.log('init', { riverPhase: state.riverPhase, pile: state.riverTiles.length, active: state.activeTile?.tile.id, open: state.riverOpenDirection });
for (let turn = 1; turn <= 15; turn += 1) {
  const active = state.activeTile;
  if (!active) break;
  const placement = active.validPlacements[0];
  const rotation = placement.rotations[0].rotation;
  const activeId = active.tile.id;
  const result = placeTile(state, placement.x, placement.y, rotation);
  console.log(turn, { activeId, rotation, success: result.success, riverPhase: state.riverPhase, pile: state.riverTiles.length, step: state.step, next: state.activeTile?.tile.id, open: state.riverOpenDirection, tail: state.riverTailIndex, last: state.placedTiles.at(-1)?.tile.id });
  if (state.step === 'tower') skipTowerStep(state);
  if (!state.riverPhase) break;
}
