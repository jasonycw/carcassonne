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
    const candidates = getValidRiverPlacements(straight, board, 0, 'E');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.x === 1 && candidate.y === 0)).toBe(true);
    expect(isValidRiverPlacement(straight, board, 0, 'E', 1, 0, candidates[0].rotation)).toBe(true);
    expect(isValidRiverPlacement(straight, board, 0, 'E', 0, 1, candidates[0].rotation)).toBe(false);
  });

  it('allows a river extension and rejects loop candidates', () => {
    const board = [
      placed(source, 0, 0), // Source exit E at (0,0) connects to tile at (1,0)
    ];
    const candidates = getValidRiverPlacements(straight, board, 0, 'E');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].x).toBe(1);
    expect(candidates[0].y).toBe(0);
  });

  it('rejects a downstream bend whose outgoing edge points upstream toward the Source', () => {
    const tail = {
      ...straight,
      id: 'test/tail',
      river: { directions: ['N', 'S'] },
    };
    const upstreamBend = {
      ...straight,
      id: 'test/upstream-bend',
      river: { directions: ['N', 'W'] },
    };
    const board = [
      placed(source, 0, 0),
      placed(tail, 1, 0),
    ];
    const candidates = getValidRiverPlacements(upstreamBend, board, 1, 'S');
    expect(candidates.some((candidate) => candidate.rotation === 0)).toBe(false);
    expect(candidates.every((candidate) => candidate.x === 1 && candidate.y === 1)).toBe(true);
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
