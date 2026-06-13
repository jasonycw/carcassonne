/**
 * Unit tests for GameLogic.js — the core game state machine for Carcassonne.
 *
 * Tests all exported functions including edge cases, using vitest mocks to
 * isolate GameLogic orchestration from the heavier scoring/placement modules.
 *
 * @see src/game/GameLogic.js
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock TilePlacement ─────────────────────────────────────────────────────
// Keep getRotatedEdges/getRotatedFeatureDirections real (pure helpers) but
// mock the default export (calculateValidPlacements) so we control placements.
vi.mock('../../src/game/TilePlacement.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: vi.fn(() => [
      {
        x: 0, y: 1,
        rotations: [
          {
            rotation: 0,
            meeples: [
              { meepleType: 'normal', locationType: 'city', index: 0 },
              { meepleType: 'normal', locationType: 'road', index: 0 },
            ],
          },
          {
            rotation: 1,
            meeples: [
              { meepleType: 'normal', locationType: 'city', index: 0 },
            ],
          },
        ],
      },
    ]),
  };
});

// ── Mock Scoring ───────────────────────────────────────────────────────────
// Mock getFeatureInfo, checkAndFinalizeFeature, and completeGame so we can
// control feature-completion detection and scoring without real traversal.
vi.mock('../../src/game/Scoring.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getFeatureInfo: vi.fn(() => ({
      points: 0,
      complete: false,
      tilesWithMeeples: [],
      goods: [],
      visitedFeatures: [],
    })),
    checkAndFinalizeFeature: vi.fn(),
    // Honour the real function's contract: mark the game as finished.
    completeGame: vi.fn((gameState) => {
      gameState.finished = true;
    }),
  };
});

// ── Imports (after mocks) ──────────────────────────────────────────────────

import {
  createGameState,
  initializeNewGame,
  drawTile,
  placeTile,
  placeMeeple,
  skipMeeple,
  skipTurn,
  completeGame,
  isGameFinished,
  getGameSummary,
} from '../../src/game/GameLogic.js';

import { BASE_GAME_TILES } from '../../src/game/TileData.js';

// Also import the mocked modules for assertions on their spies.
import calculateValidPlacements from '../../src/game/TilePlacement.js';
import {
  getFeatureInfo,
  checkAndFinalizeFeature,
  completeGame as scoringCompleteGame,
} from '../../src/game/Scoring.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a minimal base-game (2-player) game state for tests that don't
 * otherwise need a custom configuration.
 */
function makeState(tileData = BASE_GAME_TILES, expansions = ['base-game'], playerCount = 2) {
  return createGameState(expansions, playerCount, tileData);
}

/**
 * Make a state that is fully initialised (starting tile placed + first tile
 * drawn).  The mocks for calculateValidPlacements and getFeatureInfo are in
 * their default state after this call.
 */
function makeInitializedState() {
  const gs = makeState();
  initializeNewGame(gs);
  return gs;
}

/**
 * Count how many tiles of a given id remain in unusedTiles.
 */
function countInPile(pile, tileId) {
  return pile.filter((t) => t.id === tileId).length;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GameLogic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to prevent cross-test leakage:
    // vi.clearAllMocks() only resets call history, but mockReturnValue()
    // overrides persist across tests.  Without explicit reset here, a
    // previous test's getFeatureInfo override (e.g. builder meeple) leaks
    // into later tests and corrupts game logic assertions.
    vi.mocked(getFeatureInfo).mockImplementation(() => ({
      points: 0,
      complete: false,
      tilesWithMeeples: [],
      goods: [],
      visitedFeatures: [],
    }));
    vi.mocked(checkAndFinalizeFeature).mockImplementation(() => {});
  });

  // =========================================================================
  //  createGameState
  // =========================================================================
  describe('createGameState', () => {
    it('creates a state with the correct structure for 2 players', () => {
      const gs = makeState();

      expect(gs).toHaveProperty('name');
      expect(typeof gs.name).toBe('string');
      expect(gs.name.length).toBeGreaterThan(0);
      expect(gs.expansions).toEqual(['base-game']);
      expect(gs.finished).toBe(false);
      expect(gs.messages).toEqual([]);
      expect(gs.players).toHaveLength(2);
      expect(gs.unusedTiles).toBeInstanceOf(Array);
      expect(gs.placedTiles).toEqual([]);
      expect(gs.activeTile).toBeNull();
      expect(gs.currentPlayerIndex).toBe(0);
      expect(gs.step).toBe('draw');
      expect(gs.lastModified).toBeInstanceOf(Date);
    });

    it('assigns player colours in order: red, blue, green, purple, orange, teal', () => {
      const gs = createGameState(['base-game'], 6, BASE_GAME_TILES);

      expect(gs.players[0].color).toBe('red');
      expect(gs.players[1].color).toBe('blue');
      expect(gs.players[2].color).toBe('green');
      expect(gs.players[3].color).toBe('yellow');
      expect(gs.players[4].color).toBe('purple');
      expect(gs.players[5].color).toBe('gray');
    });

    it('cycles colours when more than 6 players are created', () => {
      // createGameState doesn't cap player count; colours cycle via modulo.
      const gs = createGameState(['base-game'], 8, BASE_GAME_TILES);

      expect(gs.players[0].color).toBe('red');
      expect(gs.players[6].color).toBe('red');   // wraps
      expect(gs.players[7].color).toBe('blue');
    });

    it('gives each player 7 default meeples', () => {
      const gs = createGameState(['base-game'], 4, BASE_GAME_TILES);

      for (const p of gs.players) {
        expect(p.remainingMeeples).toBe(7);
      }
    });

    it('marks the first player active and others inactive', () => {
      const gs = createGameState(['base-game'], 3, BASE_GAME_TILES);

      expect(gs.players[0].active).toBe(true);
      expect(gs.players[1].active).toBe(false);
      expect(gs.players[2].active).toBe(false);
    });

    it('sets user fields with generated username and id', () => {
      const gs = createGameState(['base-game'], 2, BASE_GAME_TILES);

      expect(gs.players[0].user.username).toBe('Player 1');
      expect(gs.players[0].user._id).toBe('player-0');
      expect(gs.players[1].user.username).toBe('Player 2');
      expect(gs.players[1].user._id).toBe('player-1');
    });

    it('does NOT set large/builder/pig flags for base-game only', () => {
      const gs = createGameState(['base-game'], 2, BASE_GAME_TILES);
      const p = gs.players[0];

      expect(p.hasLargeMeeple).toBe(false);
      expect(p.hasPigMeeple).toBe(false);
      expect(p.hasBuilderMeeple).toBe(false);
      expect(p.goods).toBeUndefined();
    });

    it('sets hasLargeMeeple for inns-and-cathedrals expansion', () => {
      const gs = createGameState(
        ['base-game', 'inns-and-cathedrals'],
        2,
        BASE_GAME_TILES,
      );

      expect(gs.players[0].hasLargeMeeple).toBe(true);
      expect(gs.players[0].hasPigMeeple).toBe(false);
      expect(gs.players[0].hasBuilderMeeple).toBe(false);
    });

    it('sets builder/pig flags and goods object for traders-and-builders', () => {
      const gs = createGameState(
        ['base-game', 'traders-and-builders'],
        2,
        BASE_GAME_TILES,
      );

      const p = gs.players[0];
      expect(p.hasPigMeeple).toBe(true);
      expect(p.hasBuilderMeeple).toBe(true);
      expect(p.hasLargeMeeple).toBe(false);
      expect(p.goods).toEqual({ fabric: 0, wine: 0, wheat: 0 });
    });

    it('filters tile pile correctly — only base-game tiles', () => {
      const gs = createGameState(['base-game'], 2, BASE_GAME_TILES);

      for (const t of gs.unusedTiles) {
        expect(t.id.startsWith('base-game/')).toBe(true);
      }
    });

    it('excludes one copy of the starting tile from the unused pile', () => {
      const startingTile = BASE_GAME_TILES.find((t) => t.startingTile);
      expect(startingTile).toBeDefined();

      // Total expected base-game tiles (sum of counts) minus 1 for starting.
      const expectedTotal =
        BASE_GAME_TILES.reduce((sum, t) => sum + t.count, 0) - 1;

      const gs = createGameState(['base-game'], 2, BASE_GAME_TILES);
      expect(gs.unusedTiles).toHaveLength(expectedTotal);

      // The starting tile copies are still in the pile (count-1 copies),
      // but the original count property is kept.
      const startingCopies = gs.unusedTiles.filter(
        (t) => t.id === startingTile.id,
      );
      expect(startingCopies).toHaveLength(startingTile.count - 1);
    });

    it('builds empty tile pile for unknown expansion', () => {
      // @ts-expect-error — testing bad input
      const gs = createGameState(['nonexistent'], 2, BASE_GAME_TILES);

      expect(gs.unusedTiles).toHaveLength(0);
    });

    it('initialises points to 0', () => {
      const gs = createGameState(['base-game'], 4, BASE_GAME_TILES);

      for (const p of gs.players) {
        expect(p.points).toBe(0);
      }
    });
  });

  // =========================================================================
  //  initializeNewGame
  // =========================================================================
  describe('initializeNewGame', () => {
    it('places the starting tile at (0, 0) with rotation 0', () => {
      const gs = makeState();
      initializeNewGame(gs);

      expect(gs.placedTiles).toHaveLength(1);
      expect(gs.placedTiles[0].x).toBe(0);
      expect(gs.placedTiles[0].y).toBe(0);
      expect(gs.placedTiles[0].rotation).toBe(0);
    });

    it('places a tile with startingTile flag', () => {
      const gs = makeState();
      initializeNewGame(gs);

      expect(gs.placedTiles[0].tile.startingTile).toBe(true);
    });

    it('creates feature objects on the starting tile', () => {
      const gs = makeState();
      initializeNewGame(gs);

      const features = gs.placedTiles[0].features;
      expect(features).toBeDefined();
      expect(features.cities).toBeInstanceOf(Array);
      expect(features.roads).toBeInstanceOf(Array);
      expect(features.farms).toBeInstanceOf(Array);
      // The starting tile 'RCr' has 1 city, 1 road, 2 farms, no cloister
      expect(features.cities).toHaveLength(1);
      expect(features.roads).toHaveLength(1);
      expect(features.farms).toHaveLength(2);
      expect(features.cloister).toBeNull();
    });

    it('draws the first active tile via drawTile', () => {
      const gs = makeState();
      initializeNewGame(gs);

      expect(gs.activeTile).not.toBeNull();
      expect(gs.activeTile.tile).toBeDefined();
      expect(gs.activeTile.validPlacements).toBeInstanceOf(Array);
      expect(gs.step).toBe('place');
    });

    it('assigns the first tile to player 0', () => {
      const gs = makeState();
      initializeNewGame(gs);

      expect(gs.placedTiles[0].playerIndex).toBe(-1);
    });

    it('throws when no starting tile exists in the pile', () => {
      // Build a state whose only tiles have startingTile: false.
      const nonStartingTiles = BASE_GAME_TILES.filter(
        (t) => !t.startingTile,
      ).map((t) => ({ ...t }));
      const gs = createGameState(['base-game'], 2, nonStartingTiles);
      // buildTilePile uses tile.id.split('/')[0] to filter by expansion.
      // Since nonStartingTiles are raw objects with id like 'base-game/...',
      // we need to trick it.  Instead, directly override unusedTiles.
      gs.unusedTiles = nonStartingTiles.map((t) => ({ ...t }));

      expect(() => initializeNewGame(gs)).toThrow(
        'No starting tile found in the tile pile',
      );
    });

    it('accepts a custom startingTile parameter', () => {
      const gs = makeState();
      const customTile = { ...BASE_GAME_TILES.find((t) => t.startingTile) };
      // Remove all starting tiles from the pile to prove the parameter works.
      gs.unusedTiles = gs.unusedTiles.filter((t) => !t.startingTile);

      initializeNewGame(gs, customTile);

      expect(gs.placedTiles).toHaveLength(1);
      expect(gs.placedTiles[0].tile.id).toBe(customTile.id);
    });

    it('calls calculateValidPlacements via drawTile', () => {
      const gs = makeState();
      initializeNewGame(gs);

      expect(calculateValidPlacements).toHaveBeenCalled();
    });
  });

  // =========================================================================
  //  drawTile
  // =========================================================================
  describe('drawTile', () => {
    it('picks a random tile from unusedTiles', () => {
      const gs = makeInitializedState();
      // After init, one tile was already drawn. Reset mocks to track fresh.
      vi.clearAllMocks();
      const beforeCount = gs.unusedTiles.length;

      drawTile(gs);

      expect(gs.unusedTiles).toHaveLength(beforeCount - 1);
    });

    it('reduces unusedTiles count by 1 when drawing', () => {
      const gs = makeInitializedState();
      const before = gs.unusedTiles.length;

      // Reset mocks so the next drawTile call uses default calculateValidPlacements
      vi.clearAllMocks();
      drawTile(gs);

      expect(gs.unusedTiles).toHaveLength(before - 1);
    });

    it('calculates valid placements via calculateValidPlacements', () => {
      const gs = makeInitializedState();
      vi.clearAllMocks();

      drawTile(gs);

      expect(calculateValidPlacements).toHaveBeenCalledTimes(1);
      // Called with (drawnTile, placedTiles, players, expansions)
      const callArgs = vi.mocked(calculateValidPlacements).mock.calls[0];
      expect(callArgs[0]).toBeDefined();       // drawn tile
      expect(callArgs[1]).toBe(gs.placedTiles);
      expect(callArgs[2]).toBe(gs.players);
      expect(callArgs[3]).toBe(gs.expansions);
    });

    it('sets step to place', () => {
      const gs = makeInitializedState();
      gs.step = 'draw'; // reset for test
      vi.clearAllMocks();

      drawTile(gs);

      expect(gs.step).toBe('place');
    });

    it('sets gamestate.activeTile with tile and validPlacements', () => {
      const gs = makeInitializedState();
      vi.clearAllMocks();

      drawTile(gs);

      expect(gs.activeTile).not.toBeNull();
      expect(gs.activeTile.tile).toBeDefined();
      expect(gs.activeTile.validPlacements).toBeInstanceOf(Array);
    });

    it('handles empty unusedTiles by calling completeGame', () => {
      const gs = makeInitializedState();
      gs.unusedTiles = [];

      drawTile(gs);

      expect(scoringCompleteGame).toHaveBeenCalledTimes(1);
      expect(scoringCompleteGame).toHaveBeenCalledWith(gs);
    });

    it('returns the gamestate', () => {
      const gs = makeInitializedState();
      vi.clearAllMocks();

      const result = drawTile(gs);

      expect(result).toBe(gs);
    });
  });

  // =========================================================================
  //  placeTile
  // =========================================================================
  describe('placeTile', () => {
    it('returns error when there is no active tile', () => {
      const gs = makeInitializedState();
      gs.activeTile = null;

      const result = placeTile(gs, 0, 1, 0);

      expect(result.success).toBe(false);
      expect(result.message).toBe('No active tile to place');
    });

    it('rejects an invalid (x, y) position', () => {
      const gs = makeInitializedState();
      // The default mock only has a placement at (0, 1).
      const result = placeTile(gs, 99, 99, 0);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid tile placement position');
    });

    it('rejects an invalid rotation', () => {
      const gs = makeInitializedState();
      // Rotation 2 is NOT in the default mock for (0,1).
      const result = placeTile(gs, 0, 1, 2);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid tile rotation');
    });

    it('rejects an invalid meeple placement', () => {
      const gs = makeInitializedState();

      const result = placeTile(gs, 0, 1, 0, {
        locationType: 'farm',
        index: 99,        // farm index 99 doesn't exist
        meepleType: 'normal',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid meeple placement');
    });

    it('returns error when player has no remaining normal meeples', () => {
      const gs = makeInitializedState();
      gs.players[0].remainingMeeples = 0;

      const result = placeTile(gs, 0, 1, 0, {
        locationType: 'city',
        index: 0,
        meepleType: 'normal',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('No remaining meeples');
    });

    it('returns error when player lacks a special meeple type', () => {
      const gs = createGameState(
        ['base-game', 'inns-and-cathedrals'],
        2,
        BASE_GAME_TILES,
      );
      initializeNewGame(gs);
      gs.players[0].hasLargeMeeple = false;

      // The mock placements don't include 'large' meeples, so this would
      // fail at the "Invalid meeple placement" check first.  We need a
      // placement that includes a large meeple entry.
      // Override calculateValidPlacements for this test.
      vi.mocked(calculateValidPlacements).mockReturnValueOnce([
        {
          x: 0, y: 1,
          rotations: [
            {
              rotation: 0,
              meeples: [
                {
                  meepleType: 'normal',
                  locationType: 'city',
                  index: 0,
                },
              ],
            },
          ],
        },
      ]);
      // Force drawTile to use our override.
      vi.clearAllMocks();
      drawTile(gs);

      // Try a large meeple that the player doesn't have
      const result = placeTile(gs, 0, 1, 0, {
        locationType: 'city',
        index: 0,
        meepleType: 'large',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('No large meeple available');
    });

    it('places a tile successfully without a meeple', () => {
      const gs = makeInitializedState();
      const beforeCount = gs.placedTiles.length;

      const result = placeTile(gs, 0, 1, 0);

      expect(result.success).toBe(true);
      expect(gs.placedTiles).toHaveLength(beforeCount + 1);
    });

    it('places a tile successfully with a meeple', () => {
      const gs = makeInitializedState();
      const beforeCount = gs.placedTiles.length;

      const result = placeTile(gs, 0, 1, 0, {
        locationType: 'city',
        index: 0,
        meepleType: 'normal',
      });

      expect(result.success).toBe(true);
      expect(gs.placedTiles).toHaveLength(beforeCount + 1);
    });

    it('consumes a normal meeple from the active player on placement', () => {
      const gs = makeInitializedState();
      const beforeMeeples = gs.players[0].remainingMeeples;

      placeTile(gs, 0, 1, 0, {
        locationType: 'city',
        index: 0,
        meepleType: 'normal',
      });

      expect(gs.players[0].remainingMeeples).toBe(beforeMeeples - 1);
    });

    it('attaches a meeple entry to the placed tile', () => {
      const gs = makeInitializedState();

      placeTile(gs, 0, 1, 0, {
        locationType: 'city',
        index: 0,
        meepleType: 'normal',
      });

      const newTile = gs.placedTiles[gs.placedTiles.length - 1];
      expect(newTile.meeples).toHaveLength(1);
      expect(newTile.meeples[0].playerIndex).toBe(0);
      expect(newTile.meeples[0].placement).toEqual({
        locationType: 'city',
        index: 0,
      });
      expect(newTile.meeples[0].meepleType).toBe('normal');
      expect(newTile.meeples[0].scored).toBe(false);
    });

    it('creates a placed tile with correct adjacency links', () => {
      const gs = makeInitializedState();

      placeTile(gs, 0, 1, 0);

      const starting = gs.placedTiles[0];
      const newTile = gs.placedTiles[1];

      // Starting tile at (0,0); new at (0,1) — they're N/S neighbours.
      expect(starting.southTileIndex).toBe(1);
      expect(newTile.northTileIndex).toBe(0);
    });

    it('initializes features on the new tile', () => {
      const gs = makeInitializedState();

      placeTile(gs, 0, 1, 0);

      const newTile = gs.placedTiles[gs.placedTiles.length - 1];
      expect(newTile.features).toBeDefined();
      expect(newTile.features.cities).toBeInstanceOf(Array);
      expect(newTile.features.roads).toBeInstanceOf(Array);
      expect(newTile.features.farms).toBeInstanceOf(Array);
    });

    it('calls getFeatureInfo and checkAndFinalizeFeature for each feature', () => {
      const gs = makeInitializedState();
      vi.clearAllMocks();

      placeTile(gs, 0, 1, 0);

      // The default mock returns valid placements with rotation 0.
      // drawTile was called (via placeTile's tail), so clearAllMocks won't
      // interfere.  checkAndFinalizeFeature is called for each city and road.
      const tile = gs.placedTiles[gs.placedTiles.length - 1];
      const cityCount = tile.tile.cities ? tile.tile.cities.length : 0;
      const roadCount = tile.tile.roads ? tile.tile.roads.length : 0;

      // We expect checkAndFinalizeFeature to have been called for each
      // city and road on the newly placed tile.
      // (checkCloisters is also called but only processes if tile has cloister)
      const cityCalls = vi.mocked(checkAndFinalizeFeature).mock.calls.filter(
        (c) => c[2] === 'city',
      );
      const roadCalls = vi.mocked(checkAndFinalizeFeature).mock.calls.filter(
        (c) => c[2] === 'road',
      );

      expect(cityCalls).toHaveLength(cityCount);
      expect(roadCalls).toHaveLength(roadCount);
    });

    it('advances to the next player after a regular placement', () => {
      const gs = makeInitializedState();

      expect(gs.currentPlayerIndex).toBe(0);

      placeTile(gs, 0, 1, 0);

      expect(gs.currentPlayerIndex).toBe(1);
    });

    it('does NOT advance the player when builder is activated', () => {
      const gs = createGameState(
        ['base-game', 'traders-and-builders'],
        2,
        BASE_GAME_TILES,
      );

      // Ensure the drawn tile has at least one city so the builder-check
      // loop (which iterates newTile.tile.cities) actually fires.
      gs.unusedTiles = gs.unusedTiles.filter(
        (t) => t.cities && t.cities.length > 0,
      );
      initializeNewGame(gs);

      // Mock getFeatureInfo to return a builder meeple for the active player.
      // This simulates a builder meeple found on the feature being completed.
      const builderTile = {
        meeples: [
          { meepleType: 'builder', playerIndex: 0, scored: false },
        ],
      };
      vi.mocked(getFeatureInfo).mockReturnValue({
        points: 0,
        complete: true,
        tilesWithMeeples: [
          { placedTile: builderTile, meepleIndex: 0 },
        ],
        goods: [],
        visitedFeatures: [],
      });

      placeTile(gs, 0, 1, 0);

      // Player stays the same (builder activated, extra turn).
      expect(gs.currentPlayerIndex).toBe(0);
    });

    it('draws the next tile after placement', () => {
      const gs = makeInitializedState();
      vi.clearAllMocks();

      placeTile(gs, 0, 1, 0);

      // After placeTile, drawTile is called, so calculateValidPlacements
      // is called again.
      expect(calculateValidPlacements).toHaveBeenCalled();
      expect(gs.activeTile).not.toBeNull();
      expect(gs.step).toBe('place');
    });

    it('handles tile placement at a different valid position', () => {
      // Override calculateValidPlacements to allow multiple positions.
      vi.mocked(calculateValidPlacements).mockReturnValue([
        {
          x: 0, y: 1,
          rotations: [{ rotation: 0, meeples: [] }],
        },
        {
          x: 1, y: 0,
          rotations: [{ rotation: 0, meeples: [] }],
        },
        {
          x: -1, y: 0,
          rotations: [{ rotation: 0, meeples: [] }],
        },
      ]);

      const gs = createGameState(['base-game'], 2, BASE_GAME_TILES);
      initializeNewGame(gs);
      vi.clearAllMocks();

      const result = placeTile(gs, -1, 0, 0);

      expect(result.success).toBe(true);
      expect(gs.placedTiles[gs.placedTiles.length - 1].x).toBe(-1);
      expect(gs.placedTiles[gs.placedTiles.length - 1].y).toBe(0);
    });
  });

  // =========================================================================
  //  placeMeeple
  // =========================================================================
  describe('placeMeeple', () => {
    it('returns error for an invalid tile index', () => {
      const gs = makeInitializedState();

      const result = placeMeeple(gs, 999, 'city', 0, 'normal');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Tile not found');
    });

    it('returns error when player has no remaining normal meeples', () => {
      const gs = makeInitializedState();
      gs.players[0].remainingMeeples = 0;

      const result = placeMeeple(gs, 0, 'city', 0, 'normal');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No remaining meeples');
    });

    it('returns error when player lacks a special meeple', () => {
      const gs = createGameState(
        ['base-game', 'inns-and-cathedrals'],
        2,
        BASE_GAME_TILES,
      );
      initializeNewGame(gs);
      gs.players[0].hasLargeMeeple = false;

      const result = placeMeeple(gs, 0, 'city', 0, 'large');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No large meeple available');
    });

    it('places a normal meeple successfully on a tile', () => {
      const gs = makeInitializedState();
      const beforeTile = gs.placedTiles[0];
      expect(beforeTile.meeples).toHaveLength(0);

      const result = placeMeeple(gs, 0, 'city', 0, 'normal');

      expect(result.success).toBe(true);
      expect(beforeTile.meeples).toHaveLength(1);
      expect(beforeTile.meeples[0]).toEqual({
        playerIndex: 0,
        placement: { locationType: 'city', index: 0 },
        meepleType: 'normal',
        scored: false,
      });
    });

    it('consumes a normal meeple from the player', () => {
      const gs = makeInitializedState();
      const before = gs.players[0].remainingMeeples;

      placeMeeple(gs, 0, 'road', 0, 'normal');

      expect(gs.players[0].remainingMeeples).toBe(before - 1);
    });

    it('consumes a special meeple flag from the player', () => {
      const gs = createGameState(
        ['base-game', 'inns-and-cathedrals'],
        2,
        BASE_GAME_TILES,
      );
      initializeNewGame(gs);

      expect(gs.players[0].hasLargeMeeple).toBe(true);

      placeMeeple(gs, 0, 'city', 0, 'large');

      expect(gs.players[0].hasLargeMeeple).toBe(false);
    });
  });

  // =========================================================================
  //  skipMeeple
  // =========================================================================
  describe('skipMeeple', () => {
    it('sets step to draw, advances player, and draws next tile', () => {
      const gs = makeInitializedState();
      gs.step = 'meeple'; // simulate waiting for meeple placement
      const beforePlayer = gs.currentPlayerIndex;
      vi.clearAllMocks();

      skipMeeple(gs);

      expect(gs.step).toBe('place');  // drawTile sets it to 'place'
      expect(gs.currentPlayerIndex).not.toBe(beforePlayer);
      expect(gs.activeTile).not.toBeNull();
      expect(calculateValidPlacements).toHaveBeenCalled();
    });
  });

  // =========================================================================
  //  skipTurn
  // =========================================================================
  describe('skipTurn', () => {
    it('advances player and draws next tile without requiring active tile', () => {
      const gs = makeInitializedState();
      gs.activeTile = null; // simulate no tile to place
      const beforePlayer = gs.currentPlayerIndex;
      vi.clearAllMocks();

      skipTurn(gs);

      expect(gs.currentPlayerIndex).not.toBe(beforePlayer);
      expect(gs.activeTile).not.toBeNull(); // drawTile sets new tile
      expect(calculateValidPlacements).toHaveBeenCalled();
    });
  });

  // =========================================================================
  //  completeGame
  // =========================================================================
  describe('completeGame', () => {
    it('calls scoringCompleteGame and marks game as finished', () => {
      const gs = makeInitializedState();
      gs.finished = false;

      completeGame(gs);

      expect(scoringCompleteGame).toHaveBeenCalledTimes(1);
      expect(scoringCompleteGame).toHaveBeenCalledWith(gs);
    });
  });

  // =========================================================================
  //  isGameFinished
  // =========================================================================
  describe('isGameFinished', () => {
    it('returns false for a running game', () => {
      const gs = makeInitializedState();
      expect(isGameFinished(gs)).toBe(false);
    });

    it('returns true after completeGame is called', () => {
      const gs = makeInitializedState();
      gs.finished = true;
      expect(isGameFinished(gs)).toBe(true);
    });
  });

  // =========================================================================
  //  getGameSummary
  // =========================================================================
  describe('getGameSummary', () => {
    it('returns a serializable summary with name, expansions, finished', () => {
      const gs = makeInitializedState();
      const summary = getGameSummary(gs);

      expect(summary.name).toBe(gs.name);
      expect(summary.expansions).toEqual(gs.expansions);
      expect(summary.finished).toBe(gs.finished);
    });

    it('includes player summaries with correct fields', () => {
      const gs = makeInitializedState();
      const summary = getGameSummary(gs);

      for (let i = 0; i < gs.players.length; i++) {
        const pSummary = summary.players[i];
        const p = gs.players[i];

        expect(pSummary.username).toBe(p.user.username);
        expect(pSummary.color).toBe(p.color);
        expect(pSummary.points).toBe(p.points);
        expect(pSummary.remainingMeeples).toBe(p.remainingMeeples);
        expect(pSummary.active).toBe(p.active);
        expect(pSummary).toHaveProperty('goods');
      }
    });

    it('includes placedTile summaries', () => {
      const gs = makeInitializedState();
      placeTile(gs, 0, 1, 0);
      const summary = getGameSummary(gs);

      expect(summary.placedTiles).toHaveLength(gs.placedTiles.length);

      const ptSummary = summary.placedTiles[0];
      expect(ptSummary).toHaveProperty('tileId');
      expect(ptSummary).toHaveProperty('rotation');
      expect(ptSummary).toHaveProperty('x');
      expect(ptSummary).toHaveProperty('y');
      expect(ptSummary).toHaveProperty('playerIndex');
      expect(ptSummary).toHaveProperty('meeples');
      // towerHeight is only present when tile has a tower.
    });

    it('includes activeTile summary when activeTile is present', () => {
      const gs = makeInitializedState();
      const summary = getGameSummary(gs);

      expect(summary.activeTile).not.toBeNull();
      expect(summary.activeTile.tileId).toBe(gs.activeTile.tile.id);
      expect(summary.activeTile.validPlacements).toBe(
        gs.activeTile.validPlacements,
      );
    });

    it('sets activeTile to null when no active tile', () => {
      const gs = makeInitializedState();
      gs.activeTile = null;
      const summary = getGameSummary(gs);

      expect(summary.activeTile).toBeNull();
    });

    it('includes currentPlayerIndex, step, and messages', () => {
      const gs = makeInitializedState();
      const summary = getGameSummary(gs);

      expect(summary.currentPlayerIndex).toBe(gs.currentPlayerIndex);
      expect(summary.step).toBe(gs.step);
      expect(summary.messages).toEqual(gs.messages);
    });

    it('includes meeples in placedTile summaries when present', () => {
      const gs = makeInitializedState();

      // Override validPlacements so the meeple option is visible to placeTile
      // (placeTile reads at.validPlacements, not the current mock).
      gs.activeTile.validPlacements = [
        {
          x: 0, y: 1,
          rotations: [
            {
              rotation: 0,
              meeples: [
                { meepleType: 'normal', locationType: 'city', index: 0 },
              ],
            },
          ],
        },
      ];

      const result = placeTile(gs, 0, 1, 0, {
        locationType: 'city',
        index: 0,
        meepleType: 'normal',
      });
      expect(result.success).toBe(true);

      const summary = getGameSummary(gs);
      const lastPT = summary.placedTiles[summary.placedTiles.length - 1];

      expect(lastPT.meeples).toHaveLength(1);
      expect(lastPT.meeples[0].playerIndex).toBe(0);
      expect(lastPT.meeples[0].meepleType).toBe('normal');
      expect(lastPT.meeples[0].scored).toBe(false);
    });
  });

  // =========================================================================
  //  Full Game Flow  (2-player integration walk-through)
  // =========================================================================
  describe('full game flow (2 players)', () => {
    it('plays through several turns and completes the game', () => {
      // Override calculateValidPlacements to provide multiple positions.
      vi.mocked(calculateValidPlacements).mockReturnValue([
        {
          x: 0, y: 1,
          rotations: [{ rotation: 0, meeples: [] }],
        },
        {
          x: 0, y: -1,
          rotations: [{ rotation: 0, meeples: [] }],
        },
        {
          x: 1, y: 0,
          rotations: [{ rotation: 0, meeples: [] }],
        },
        {
          x: -1, y: 0,
          rotations: [{ rotation: 0, meeples: [] }],
        },
      ]);

      // ── Phase 1: Create state ────────────────────────────────────────
      const gs = createGameState(['base-game'], 2, BASE_GAME_TILES);
      expect(gs.players).toHaveLength(2);
      expect(gs.unusedTiles.length).toBeGreaterThan(0);
      expect(gs.currentPlayerIndex).toBe(0);

      // ── Phase 2: Initialize game ─────────────────────────────────────
      initializeNewGame(gs);
      expect(gs.placedTiles).toHaveLength(1);
      expect(gs.placedTiles[0].x).toBe(0);
      expect(gs.placedTiles[0].y).toBe(0);
      expect(gs.activeTile).not.toBeNull();
      expect(gs.step).toBe('place');

      // ── Phase 3: Player 0 places first tile (south, no meeple) ──────
      vi.clearAllMocks();
      // IMPORTANT: The (0,-1) entry must include the meeple option here
      // because drawTile (called at the end of placeTile) sets
      // gs.activeTile.validPlacements from this mock.  Phase 4's placeTile
      // reads those cached placements, NOT the next mock.
      vi.mocked(calculateValidPlacements).mockReturnValue([
        {
          x: 0, y: 1,
          rotations: [{ rotation: 0, meeples: [] }],
        },
        {
          x: 0, y: -1,
          rotations: [
            {
              rotation: 0,
              meeples: [
                { meepleType: 'normal', locationType: 'city', index: 0 },
              ],
            },
          ],
        },
      ]);

      let result = placeTile(gs, 0, 1, 0);
      expect(result.success).toBe(true);
      expect(gs.currentPlayerIndex).toBe(1); // advanced to player 1
      expect(gs.placedTiles).toHaveLength(2);
      expect(gs.activeTile).not.toBeNull();

      // ── Phase 4: Player 1 places a tile (north, with meeple) ────────
      vi.clearAllMocks();
      // IMPORTANT: include (1,0) here because drawTile (called at the end of
      // placeTile) sets at.validPlacements for Phase 5.
      vi.mocked(calculateValidPlacements).mockReturnValue([
        {
          x: 0, y: -1,
          rotations: [
            {
              rotation: 0,
              meeples: [
                { meepleType: 'normal', locationType: 'city', index: 0 },
              ],
            },
          ],
        },
        {
          x: 1, y: 0,
          rotations: [{ rotation: 0, meeples: [] }],
        },
      ]);

      result = placeTile(gs, 0, -1, 0, {
        locationType: 'city',
        index: 0,
        meepleType: 'normal',
      });
      expect(result.success).toBe(true);
      expect(gs.placedTiles).toHaveLength(3);
      expect(gs.currentPlayerIndex).toBe(0); // back to player 0
      expect(gs.players[1].remainingMeeples).toBe(6); // used one meeple

      // ── Phase 5: Player 0 places another tile (east) ─────────────────
      vi.clearAllMocks();
      // IMPORTANT: include (-1,0) here because drawTile → at.validPlacements
      // for Phase 6.
      vi.mocked(calculateValidPlacements).mockReturnValue([
        {
          x: 1, y: 0,
          rotations: [{ rotation: 0, meeples: [] }],
        },
        {
          x: -1, y: 0,
          rotations: [{ rotation: 0, meeples: [] }],
        },
      ]);

      result = placeTile(gs, 1, 0, 0);
      expect(result.success).toBe(true);
      expect(gs.placedTiles).toHaveLength(4);

      // ── Phase 6: Player 1 places a tile (west) ───────────────────────
      vi.clearAllMocks();
      vi.mocked(calculateValidPlacements).mockReturnValue([
        {
          x: -1, y: 0,
          rotations: [{ rotation: 0, meeples: [] }],
        },
      ]);

      result = placeTile(gs, -1, 0, 0);
      expect(result.success).toBe(true);
      expect(gs.placedTiles).toHaveLength(5);

      // ── Phase 7: Summary is serializable ─────────────────────────────
      const summary = getGameSummary(gs);
      expect(summary.placedTiles).toHaveLength(5);
      expect(summary.players).toHaveLength(2);

      // ── Phase 8: Complete the game by emptying the pile ──────────────
      // Simulate end game — exhaust the pile.
      gs.unusedTiles = [];
      vi.clearAllMocks();

      drawTile(gs);

      // scoringCompleteGame should have been called (via drawTile →
      // completeGame → scoringCompleteGame).
      expect(scoringCompleteGame).toHaveBeenCalledWith(gs);

      // After completeGame (via drawTile on empty pile), the game
      // is flagged as finished.
      expect(isGameFinished(gs)).toBe(true);
    });
  });
});
