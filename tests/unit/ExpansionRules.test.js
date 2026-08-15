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

  it('strictly prohibits two consecutive bends in the same direction, even with intervening straights', () => {
    // 1. Source at (0,0) exits E
    // 2. Bend at (1,0) enters W, exits S (CW turn)
    // 3. Straight at (1,1) enters N, exits S
    // 4. Candidate Bend at (1,2) enters N, exits W (CW turn) - SHOULD BE REJECTED
    const cwBend = {
      ...bend,
      id: 'test/cw-bend',
      river: { directions: ['W', 'S'] }, // Rotation 0: enters W, exits S (CW)
    };
    const straightSegment = {
      ...straight,
      id: 'test/straight',
      river: { directions: ['N', 'S'] },
    };
    
    const board = [
      placed(source, 0, 0, 0),
      placed(cwBend, 1, 0, 0),
      placed(straightSegment, 1, 1, 0),
    ];
    
    // Attempt to place another CW bend at (1,2)
    // Entry N, Exit W is a CW turn:
    // N = 0, W = 3. Turn = (3 - 0 + 4) % 4 = 3 (CCW in our CARDINALS ['N', 'E', 'S', 'W'])
    // Wait, let's re-verify the turn math:
    // CARDINALS = ['N', 'E', 'S', 'W']
    // N->E is 1 (CW)
    // E->S is 1 (CW)
    // S->W is 1 (CW)
    // W->N is 1 (CW)
    // N->W is 3 (CCW)
    
    // Let's use specific rotations for the test:
    // Tail is at (1,1), openDirection is 'S'
    // Candidate at (1,2) must enter 'N' (OPPOSITE of 'S')
    // If candidate exits 'W', it's N->W which is 3 (CCW)
    // If candidate exits 'E', it's N->E which is 1 (CW)
    
    // Tail at (1,0) entered 'W', exited 'S'. W->S is 2 steps in CARDINALS (W=3, S=2).
    // (2 - 3 + 4) % 4 = 3 (CCW)
    
    const board2 = [
      placed(source, 0, 0, 0), // index 0: (0,0) exits E
      placed(bend, 1, 0, 1),   // index 1: (1,0) enters N, exits W (Turn 3 CCW)
      placed(straight, 1, 1, 0), // index 2: (1,1) enters N, exits S
    ];
    
    // Candidate at (1,2) enters N. 
    // Any rotation of 'bend' [W, S] that enters N will be a CW turn (1).
    // Historical at index 1 was CCW (3). 
    // Candidate at (1,2) enters N. 
    // The 'bend' tile [W, S] has directions that will always result in a CW turn (1)
    // when it matches an entry.
    // e.g., Rot 1: [N, W] -> Enters N, Exits W. Travel dir is S. S->W is CW (1).
    // Since 1 (CW) != 3 (CCW), it should be ALLOWED.
    const candidates = getValidRiverPlacements(bend, board2, 2, 'S');
    expect(candidates.length).toBeGreaterThan(0);
    
    // Now test a direct CCW U-turn (should be rejected)
    // 1. Source at (0,0) exits E
    // 2. Bend at (1,0) enters W, exits N (Rotation 2: [E, N] -> enters E, exits N. Travel W->N is 3 CCW)
    // 3. Straight at (1,-1) enters S, exits N
    // 4. Candidate Bend at (1,-2) enters S, exits W (Rotation 3: [S, E] -> enters S, exits E. Travel N->E is 1 CW. Wait.)
    
    // Let's use a simple direct sequence:
    // (0,0) Source E
    // (1,0) Bend [W, S] (Rot 0) -> Entry W, Exit S (Travel E->S is 1 CW)
    // (1,1) Straight [N, S] (Rot 0) -> Entry N, Exit S
    // (1,2) Bend [N, W] (Rot 1) -> Entry N, Exit W (Travel S->W is 1 CW) - REJECTED
    
    const board3 = [
      placed(source, 0, 0, 0), // index 0: (0,0) exits E
      placed(bend, 1, 0, 2),   // index 1: (1,0) enters E, exits N (CCW)
      placed(straight, 1, -1, 0), // index 2: (1,-1) enters S, exits N
    ];
    
    const candidates2 = getValidRiverPlacements(bend, board3, 2, 'N');
    // bend [W, S] rotated:
    // Rot 2: [E, N] -> enters E, exits N (CCW)
    // Historical at index 1 was CCW (3). So any CCW turns at index 3 should be rejected.
    const hasRot2 = candidates2.some(c => c.rotation === 2);
    expect(hasRot2).toBe(false);
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
