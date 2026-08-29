import { describe, it, expect, beforeEach } from 'vitest';
import { createGameState, initializeNewGame, placeTile, placeTowerPiece, skipTowerStep } from '../../src/game/GameLogic.js';
import { ALL_TILES } from '../../src/game/TileData.js';

describe('Tower Expansion Gameplay Loop', () => {
  let state;
  const towerExp = ['base-game', 'the-tower'];

  beforeEach(() => {
    state = createGameState(towerExp, 2, ALL_TILES);
    initializeNewGame(state);
  });

  it('should enter tower step after placing a tile if no meeple is placed', () => {
    // Draw a tile that has a tower foundation
    const towerTile = ALL_TILES.find(t => t.id === 'the-tower/C');
    state.activeTile = {
      tile: towerTile,
      validPlacements: [{ x: 1, y: 0, rotations: [{ rotation: 0, meeples: [] }] }]
    };
    state.step = 'place';

    placeTile(state, 1, 0, 0, null);
    expect(state.step).toBe('tower');
  });

  it('should NOT enter tower step if a meeple is placed on the tile', () => {
    const towerTile = ALL_TILES.find(t => t.id === 'the-tower/C');
    state.activeTile = {
      tile: towerTile,
      validPlacements: [{ x: 1, y: 0, rotations: [{ rotation: 0, meeples: [{ locationType: 'city', index: 0, meepleType: 'normal' }] }] }]
    };
    state.step = 'place';

    placeTile(state, 1, 0, 0, { locationType: 'city', index: 0, meepleType: 'normal' });
    expect(state.step).toBe('place'); // Turn ended, next tile drawn
  });

  it('should NOT enter tower step if there are no valid tower foundations on board', () => {
    // Start with a base game tile (no tower)
    const baseTile = ALL_TILES.find(t => t.id === 'base-game/C');
    state = createGameState(towerExp, 2, ALL_TILES);
    // Force the first tile to be a non-tower tile
    const startTile = ALL_TILES.find(t => t.id === 'base-game/RCr');
    initializeNewGame(state, startTile);

    state.activeTile = {
      tile: baseTile,
      validPlacements: [{ x: 1, y: 0, rotations: [{ rotation: 0, meeples: [] }] }]
    };
    state.step = 'place';

    placeTile(state, 1, 0, 0, null);
    expect(state.step).toBe('place'); // No tower foundations on board, turn ended, next tile drawn
  });

  it('should allow placing a tower piece and then end the turn', () => {
    const towerTile = ALL_TILES.find(t => t.id === 'the-tower/C');
    state.activeTile = {
      tile: towerTile,
      validPlacements: [{ x: 1, y: 0, rotations: [{ rotation: 0, meeples: [] }] }]
    };
    state.step = 'place';
    placeTile(state, 1, 0, 0, null);
    
    const tileIndex = state.placedTiles.length - 1;
    const initialTowers = state.players[0].towers;
    
    placeTowerPiece(state, tileIndex);
    
    expect(state.placedTiles[tileIndex].tower.height).toBe(1);
    expect(state.players[0].towers).toBe(initialTowers - 1);
    expect(state.step).toBe('place');
  });

  it('should allow skipping the tower step', () => {
    const towerTile = ALL_TILES.find(t => t.id === 'the-tower/C');
    state.activeTile = {
      tile: towerTile,
      validPlacements: [{ x: 1, y: 0, rotations: [{ rotation: 0, meeples: [] }] }]
    };
    state.step = 'place';
    placeTile(state, 1, 0, 0, null);
    
    skipTowerStep(state);
    expect(state.step).toBe('place');
  });

  it('keeps the RRR foundation centered to match RRR.png', () => {
    const rrr = ALL_TILES.find(t => t.id === 'the-tower/RRR');
    expect(rrr.tower.offset).toEqual({ x: 1 / 2, y: 1 / 2 });
  });
});
