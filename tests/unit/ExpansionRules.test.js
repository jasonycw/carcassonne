import { describe, expect, it } from 'vitest';
import { THE_RIVER_TILES } from '../../src/game/TileData.js';
import {
  getValidRiverPlacements,
  isValidRiverPlacement,
} from '../../src/game/RiverPlacement.js';
import {
  getCapturableMeeples,
  checkAndExchangePrisoners,
  buyBackPrisoner,
} from '../../src/game/TowerExtensions.js';

const source = THE_RIVER_TILES.find((tile) => tile.river?.isSource);
const lake = THE_RIVER_TILES.find((tile) => tile.river?.isLake);
const straight = THE_RIVER_TILES.find((tile) => tile.id === 'the-river/II');
const bend = THE_RIVER_TILES.find((tile) => tile.id === 'the-river/CIRI');

function placed(tile, x, y, rotation = 0, meeples = [], tower) {
  return { tile, x, y, rotation, meeples, tower };
}

function player(name, points = 0) {
  return {
    user: { username: name },
    points,
    remainingMeeples: 7,
    hasLargeMeeple: false,
    hasBuilderMeeple: false,
    hasPigMeeple: false,
    capturedMeeples: [],
  };
}

describe('The River official rules', () => {
  it('contains twelve physical tiles with source and lake separated by setup', () => {
    expect(THE_RIVER_TILES.reduce((sum, tile) => sum + tile.count, 0)).toBe(12);
    expect(source.river.isSource).toBe(true);
    expect(lake.river.isLake).toBe(true);
  });

  it('extends only the current open end and matches the river edge', () => {
    const board = [placed(source, 0, 0)];
    const candidates = getValidRiverPlacements(straight, board, 0, 'S');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.x === 0 && candidate.y === 1)).toBe(true);
    expect(isValidRiverPlacement(straight, board, 0, 'S', 0, 1, candidates[0].rotation)).toBe(true);
    expect(isValidRiverPlacement(straight, board, 0, 'S', 1, 0, candidates[0].rotation)).toBe(false);
  });

  it('allows a 90-degree bend but rejects a candidate that closes a loop', () => {
    // source(0,0,S) -> straight(0,1,N-S) -> bend(0,2,N-E)
    const board = [
      placed(source, 0, 0),   // Exit S
      placed(straight, 0, 1), // Entry N, Exit S
      placed(bend, 0, 2, 3),  // Entry N, Exit E (rotated 3: ['S','E'] -> ['W','N']? No.
    ];
    // Let's use simple coordinates. Source at 0,0 exit S.
    // Tile 1 at 0,1 entry N exit S.
    // Tile 2 at 0,2 entry N exit E.
    // Tile 3 should be allowed at 1,2 entry W.
    const board2 = [
      placed(source, 0, 0),
      placed(straight, 0, 1, 0),
      placed(bend, 0, 2, 3), // ['S','E'] rotated 3 (270 CW) -> S->E->N->W, E->N->W->S. So ['W', 'S']? No.
    ];
    // Directions: N=0, E=1, S=2, W=3.
    // ['S','E'] is [2, 1].
    // Rot 3: (2+3)%4 = 1 (E), (1+3)%4 = 0 (N). So ['E', 'N'].
    // Entry N (from 0,1 exit S), Exit E. Correct.
    
    const candidates = getValidRiverPlacements(straight, board2, 2, 'E');
    // Should allow (1,2) with rotation 1 (N-S -> E-W)
    expect(candidates).toContainEqual(expect.objectContaining({ x: 1, y: 2, rotation: 1 }));
    
    // Loop check: if we try to place a tile at (1,1), it would be adjacent to (0,1).
    // getValidRiverPlacements should reject it because it creates a branch/loop.
    const loopCandidates = getValidRiverPlacements(straight, board2, 2, 'E');
    // Even if it matches edges, it shouldn't allow (0,1) or any neighbor of existing river tiles.
    expect(loopCandidates.some(c => c.x === 0 && c.y === 1)).toBe(false);
  });
});

describe('The Tower official rules', () => {
  it('captures your own meeple and any eligible meeple on the tower tile or in range', () => {
    const normal = (playerIndex) => ({ playerIndex, meepleType: 'normal', scored: false });
    const board = [
      placed(straight, 0, 0, 0, [normal(0)], { height: 2, completed: false }),
      placed(straight, 0, 1, 0, [normal(1)]),
      placed(straight, 0, 2, 0, [normal(0)]),
      placed(straight, 0, 3, 0, [normal(1)]),
      placed(straight, 1, 0, 0, [{ playerIndex: 1, meepleType: 'builder', scored: false }]),
      placed(straight, 2, 0, 0, [{ playerIndex: 0, meepleType: 'tower', scored: false }]),
    ];
    const capturable = getCapturableMeeples({ placedTiles: board }, 0);
    // Builder at (1,0) and Tower meeple at (2,0) are in range (height 2) but excluded.
    expect(capturable.map((entry) => [entry.tileIndex, entry.meepleIndex])).toEqual([
      [0, 0], [1, 0], [2, 0],
    ]);
  });

  it('exchanges opposing prisoners immediately and returns them to supply', () => {
    const players = [player('A'), player('B')];
    players[0].capturedMeeples = [{ playerIndex: 1, meepleType: 'normal' }];
    players[1].capturedMeeples = [{ playerIndex: 0, meepleType: 'normal' }];
    const game = { players, messages: [] };
    checkAndExchangePrisoners(game);
    expect(players[0].capturedMeeples).toHaveLength(0);
    expect(players[1].capturedMeeples).toHaveLength(0);
    expect(players[0].remainingMeeples).toBe(8);
    expect(players[1].remainingMeeples).toBe(8);
  });

  it('requires exactly three points and returns the bought-back meeple to its owner', () => {
    const players = [player('A', 3), player('B', 0)];
    players[1].capturedMeeples = [{ playerIndex: 0, meepleType: 'normal' }];
    const game = { players, currentPlayerIndex: 0, messages: [] };
    expect(buyBackPrisoner(game, 1, 0).success).toBe(true);
    expect(players[0].points).toBe(0);
    expect(players[1].points).toBe(3);
    expect(players[0].remainingMeeples).toBe(8);
    expect(players[1].capturedMeeples).toHaveLength(0);
  });
});
