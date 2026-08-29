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
const bridge = THE_RIVER_TILES.find((tile) => tile.id === 'the-river/RIrI');

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

  it('models the River bridge as one road and four independent farms', () => {
    expect(bridge.roads).toHaveLength(1);
    expect(bridge.roads[0].directions).toEqual(['W', 'E']);
    expect(bridge.farms).toHaveLength(4);
    expect(bridge.farms.map((farm) => farm.directions)).toEqual([
      ['NNW', 'WNW'],
      ['NNE', 'ENE'],
      ['ESE', 'SSE'],
      ['SSW', 'WSW'],
    ]);
  });

  it('extends only the current open end and matches the river edge', () => {
    const board = [placed(source, 0, 0)];
    const candidates = getValidRiverPlacements(straight, board, 0, 'E');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((candidate) => candidate.x === 1 && candidate.y === 0)).toBe(true);
    expect(isValidRiverPlacement(straight, board, 0, 'E', 1, 0, candidates[0].rotation)).toBe(true);
    expect(isValidRiverPlacement(straight, board, 0, 'E', 0, 1, candidates[0].rotation)).toBe(false);
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

  it('rejects a reverse bend after intervening straight tiles, not only an immediate U-turn', () => {
    const southBend = {
      ...straight,
      id: 'test/south-bend',
      river: { directions: ['W', 'S'] },
    };
    const straightSegment = {
      ...straight,
      id: 'test/straight-segment',
      river: { directions: ['N', 'S'] },
    };
    const delayedReverseBend = {
      ...straight,
      id: 'test/delayed-reverse-bend',
      river: { directions: ['W', 'S'] },
    };
    const board = [
      placed(source, 0, 0),
      placed(southBend, 1, 0, 0),
      placed(straightSegment, 1, 1, 0),
      placed(straightSegment, 1, 2, 0),
    ];

    const candidates = getValidRiverPlacements(delayedReverseBend, board, 3, 'S');
    expect(candidates.every((candidate) => candidate.x === 1 && candidate.y === 3)).toBe(true);
    // Rotation 1 presents N as the entry edge and W as the outgoing edge,
    // which would send the river back toward the Source after two straights.
    expect(candidates.some((candidate) => candidate.rotation === 1)).toBe(false);
  });

  it('allows consecutive bends if they do not double back to the Source', () => {
    // 1. Source at (0,0) exits E
    // 2. Bend at (1,0) enters W, exits S (CW turn)
    // 3. Straight at (1,1) enters N, exits S
    // 4. Candidate Bend at (1,2) enters N, exits W (CW turn) - ALLOWED per user clarification
    const board = [
      placed(source, 0, 0, 0),    // exits E
      placed(bend, 1, 0, 0),      // enters W, exits S (CW turn)
      placed(straight, 1, 1, 0),  // enters N, exits S
    ];
    
    const candidates = getValidRiverPlacements(bend, board, 2, 'S');
    // Candidate at (1,2) enters N. Rotation 1: enters N, exits W.
    // This is a second CW turn, which is allowed as long as it doesn't double back.
    expect(candidates.some((c) => c.rotation === 1)).toBe(true);
  });

  it('rejects a placement that would create a loop by connecting to a non-adjacent existing river tile', () => {
    // 1. Source at (0,0) exits E
    // 2. Bend at (1,0) enters W, exits S
    // 3. Bend at (1,1) enters N, exits W
    // 4. Candidate Bend at (0,1) enters E, exits N.
    //    This connects to (0,0) which is already a river tile.
    const board = [
      placed(source, 0, 0, 0),    // exits E
      placed(bend, 1, 0, 0),      // enters W, exits S
      placed(bend, 1, 1, 1),      // enters N, exits W
    ];
    
    const candidates = getValidRiverPlacements(bend, board, 2, 'W');
    // Candidate at (0,1). Entry from E is required.
    // Rotation 2 of CIRI: directions are ['E', 'S']? No, let's check TileData.
    // CIRI rotation 2: [W, N] -> enters W, exits N. 
    // Wait, if entry is E, we need a rotation that has 'E' in directions.
    // CIRI original: ['W', 'S']. 
    // Rot 0: [W, S]
    // Rot 1: [N, W]
    // Rot 2: [E, N]
    // Rot 3: [S, E]
    // So Rot 2 enters E and exits N.
    expect(candidates.some((c) => c.x === 0 && c.y === 1 && c.rotation === 2)).toBe(false);
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
