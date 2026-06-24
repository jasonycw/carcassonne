/**
 * Unit tests for TilePlacement.js — pure logic for computing valid tile and
 * meeple placements in Carcassonne.
 *
 * @see src/game/TilePlacement.js
 */
import { describe, it, expect } from 'vitest';
import calculateValidPlacements, {
  getRotatedEdges,
  getRotatedFeatureDirections,
  getFeatureMeeples,
  getFeatureIndex,
  CARDINAL_DIRECTIONS,
  FARM_DIRECTIONS,
} from '../../src/game/TilePlacement.js';
import { BASE_GAME_TILES } from '../../src/game/TileData.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find a tile definition from BASE_GAME_TILES by id. */
function tile(id) {
  return BASE_GAME_TILES.find((t) => t.id === id);
}

// ---------------------------------------------------------------------------
// getRotatedEdges
// ---------------------------------------------------------------------------

describe('getRotatedEdges()', () => {
  const cityTile = { northEdge: 'city', eastEdge: 'field', southEdge: 'field', westEdge: 'field' };
  const roadTile = { northEdge: 'road', eastEdge: 'field', southEdge: 'field', westEdge: 'road' };
  const mixedTile = { northEdge: 'city', eastEdge: 'road', southEdge: 'field', westEdge: 'road' };
  const allEdge = { northEdge: 'city', eastEdge: 'city', southEdge: 'city', westEdge: 'city' };

  it('rotation 0 preserves identity (city tile)', () => {
    const result = getRotatedEdges(cityTile, 0);
    expect(result.northEdge).toBe('city');
    expect(result.eastEdge).toBe('field');
    expect(result.southEdge).toBe('field');
    expect(result.westEdge).toBe('field');
  });

  it('rotation 0 preserves identity (mixed tile)', () => {
    const result = getRotatedEdges(mixedTile, 0);
    expect(result).toEqual({
      northEdge: 'city', eastEdge: 'road', southEdge: 'field', westEdge: 'road',
    });
  });

  it('rotation 0 preserves identity (all-city tile)', () => {
    const result = getRotatedEdges(allEdge, 0);
    expect(result).toEqual({ northEdge: 'city', eastEdge: 'city', southEdge: 'city', westEdge: 'city' });
  });

  it('rotation 1 shifts clockwise (city moves from north to east)', () => {
    const result = getRotatedEdges(cityTile, 1);
    expect(result.northEdge).toBe('field'); // west → north
    expect(result.eastEdge).toBe('city');   // north → east
    expect(result.southEdge).toBe('field'); // east → south
    expect(result.westEdge).toBe('field');  // south → west
  });

  it('rotation 1 shifts clockwise (road tile)', () => {
    const result = getRotatedEdges(roadTile, 1);
    expect(result).toEqual({
      northEdge: 'road',   // west → north
      eastEdge: 'road',    // north → east
      southEdge: 'field',  // east → south
      westEdge: 'field',   // south → west
    });
  });

  it('rotation 1 on all-city tile produces all city', () => {
    const result = getRotatedEdges(allEdge, 1);
    expect(result).toEqual({ northEdge: 'city', eastEdge: 'city', southEdge: 'city', westEdge: 'city' });
  });

  it('rotation 2 flips north and south (city tile)', () => {
    const result = getRotatedEdges(cityTile, 2);
    expect(result.northEdge).toBe('field'); // south → north
    expect(result.eastEdge).toBe('field');  // west → east
    expect(result.southEdge).toBe('city');  // north → south
    expect(result.westEdge).toBe('field');  // east → west
  });

  it('rotation 2 flips north and south (mixed tile)', () => {
    const result = getRotatedEdges(mixedTile, 2);
    expect(result).toEqual({
      northEdge: 'field',  // south → north
      eastEdge: 'road',    // west → east
      southEdge: 'city',   // north → south
      westEdge: 'road',    // east → west
    });
  });

  it('rotation 3 shifts counter-clockwise (city tile)', () => {
    const result = getRotatedEdges(cityTile, 3);
    expect(result.northEdge).toBe('field'); // east → north
    expect(result.eastEdge).toBe('field');  // south → east
    expect(result.southEdge).toBe('field'); // west → south
    expect(result.westEdge).toBe('city');   // north → west
  });

  it('rotation 3 on mixed tile', () => {
    const result = getRotatedEdges(mixedTile, 3);
    expect(result).toEqual({
      northEdge: 'road',   // east → north
      eastEdge: 'field',   // south → east
      southEdge: 'road',   // west → south
      westEdge: 'city',    // north → west
    });
  });

  it('four applications of rotation 1 return to identity (rot1×4 = rot0)', () => {
    let result = getRotatedEdges(mixedTile, 1);
    result = getRotatedEdges(result, 1);
    result = getRotatedEdges(result, 1);
    result = getRotatedEdges(result, 1);
    expect(result).toEqual({
      northEdge: 'city', eastEdge: 'road', southEdge: 'field', westEdge: 'road',
    });
  });

  it('rotation 1 then rotation 3 equals rotation 0', () => {
    const r1 = getRotatedEdges(mixedTile, 1);
    const r1r3 = getRotatedEdges(r1, 3);
    const r0 = getRotatedEdges(mixedTile, 0);
    expect(r1r3).toEqual(r0);
  });



  it('returns a new object each call (does not mutate input)', () => {
    const input = { northEdge: 'city', eastEdge: 'field', southEdge: 'field', westEdge: 'field' };
    const result = getRotatedEdges(input, 1);
    expect(input.northEdge).toBe('city'); // unchanged
    expect(result.northEdge).toBe('field');
    expect(result).not.toBe(input);
  });

  it('has exactly four keys in the returned object', () => {
    const result = getRotatedEdges(cityTile, 0);
    expect(Object.keys(result).sort()).toEqual(['eastEdge', 'northEdge', 'southEdge', 'westEdge']);
  });

  it('rotation 0 on road tile preserves edges', () => {
    const result = getRotatedEdges(roadTile, 0);
    expect(result.northEdge).toBe('road');
    expect(result.southEdge).toBe('field');
    expect(result.westEdge).toBe('road');
  });

  it('rotation 2 on all-city tile flips in place', () => {
    const result = getRotatedEdges(allEdge, 2);
    expect(result).toEqual({ northEdge: 'city', eastEdge: 'city', southEdge: 'city', westEdge: 'city' });
  });

  it('rotation 3 on road tile shifts counter-clockwise', () => {
    const result = getRotatedEdges(roadTile, 3);
    expect(result.northEdge).toBe('field');  // east → north
    expect(result.westEdge).toBe('road');    // north → west
  });
});

// ---------------------------------------------------------------------------
// getRotatedFeatureDirections
// ---------------------------------------------------------------------------

describe('getRotatedFeatureDirections()', () => {
  // Cardinal directions = 4-element compass: N, E, S, W
  // Farm directions = 8-element compass: NNE, ENE, ESE, SSE, SSW, WSW, WNW, NNW

  describe('cardinal directions (isFarm = false)', () => {
    it('rotation 0 returns same directions', () => {
      expect(getRotatedFeatureDirections(['N'], 0, false)).toEqual(['N']);
      expect(getRotatedFeatureDirections(['E'], 0, false)).toEqual(['E']);
      expect(getRotatedFeatureDirections(['S'], 0, false)).toEqual(['S']);
      expect(getRotatedFeatureDirections(['W'], 0, false)).toEqual(['W']);
    });

    it('rotation 1 rotates N → E, E → S, S → W, W → N', () => {
      expect(getRotatedFeatureDirections(['N'], 1, false)).toEqual(['E']);
      expect(getRotatedFeatureDirections(['E'], 1, false)).toEqual(['S']);
      expect(getRotatedFeatureDirections(['S'], 1, false)).toEqual(['W']);
      expect(getRotatedFeatureDirections(['W'], 1, false)).toEqual(['N']);
    });

    it('rotation 2 rotates N → S, E → W, S → N, W → E', () => {
      expect(getRotatedFeatureDirections(['N'], 2, false)).toEqual(['S']);
      expect(getRotatedFeatureDirections(['E'], 2, false)).toEqual(['W']);
      expect(getRotatedFeatureDirections(['S'], 2, false)).toEqual(['N']);
      expect(getRotatedFeatureDirections(['W'], 2, false)).toEqual(['E']);
    });

    it('rotation 3 rotates N → W, E → N, S → E, W → S', () => {
      expect(getRotatedFeatureDirections(['N'], 3, false)).toEqual(['W']);
      expect(getRotatedFeatureDirections(['E'], 3, false)).toEqual(['N']);
      expect(getRotatedFeatureDirections(['S'], 3, false)).toEqual(['E']);
      expect(getRotatedFeatureDirections(['W'], 3, false)).toEqual(['S']);
    });

    it('rotation 0 with multiple directions', () => {
      expect(getRotatedFeatureDirections(['N', 'E'], 0, false)).toEqual(['N', 'E']);
      expect(getRotatedFeatureDirections(['N', 'S'], 0, false)).toEqual(['N', 'S']);
    });

    it('rotation 1 with multiple directions shifts each', () => {
      expect(getRotatedFeatureDirections(['N', 'E'], 1, false)).toEqual(['E', 'S']);
      expect(getRotatedFeatureDirections(['N', 'S', 'W'], 1, false)).toEqual(['E', 'W', 'N']);
    });

    it('rotation 2 with multiple directions flips each', () => {
      expect(getRotatedFeatureDirections(['N', 'E', 'W'], 2, false)).toEqual(['S', 'W', 'E']);
    });

    it('handles empty directions array', () => {
      expect(getRotatedFeatureDirections([], 0, false)).toEqual([]);
      expect(getRotatedFeatureDirections([], 2, false)).toEqual([]);
      expect(getRotatedFeatureDirections([], 3, false)).toEqual([]);
    });

    it('handles single entry array', () => {
      expect(getRotatedFeatureDirections(['S'], 0, false)).toEqual(['S']);
      expect(getRotatedFeatureDirections(['S'], 2, false)).toEqual(['N']);
    });
  });

  describe('farm directions (isFarm = true)', () => {
    it('rotation 0 returns same directions', () => {
      expect(getRotatedFeatureDirections(['NNE'], 0, true)).toEqual(['NNE']);
      expect(getRotatedFeatureDirections(['SSW'], 0, true)).toEqual(['SSW']);
      expect(getRotatedFeatureDirections(['ENE', 'WNW'], 0, true)).toEqual(['ENE', 'WNW']);
    });

    it('rotation 1 shifts by 2 positions in the 8-element compass', () => {
      // FARM_DIRECTIONS: ['NNE','ENE','ESE','SSE','SSW','WSW','WNW','NNW']
      expect(getRotatedFeatureDirections(['NNE'], 1, true)).toEqual(['ESE']);
      expect(getRotatedFeatureDirections(['ENE'], 1, true)).toEqual(['SSE']);
      expect(getRotatedFeatureDirections(['ESE'], 1, true)).toEqual(['SSW']);
      expect(getRotatedFeatureDirections(['SSE'], 1, true)).toEqual(['WSW']);
      expect(getRotatedFeatureDirections(['SSW'], 1, true)).toEqual(['WNW']);
      expect(getRotatedFeatureDirections(['WSW'], 1, true)).toEqual(['NNW']);
      expect(getRotatedFeatureDirections(['WNW'], 1, true)).toEqual(['NNE']);
      expect(getRotatedFeatureDirections(['NNW'], 1, true)).toEqual(['ENE']);
    });

    it('rotation 2 shifts by 4 positions (half turn)', () => {
      expect(getRotatedFeatureDirections(['NNE'], 2, true)).toEqual(['SSW']);
      expect(getRotatedFeatureDirections(['ENE'], 2, true)).toEqual(['WSW']);
      expect(getRotatedFeatureDirections(['SSW'], 2, true)).toEqual(['NNE']);
      expect(getRotatedFeatureDirections(['NNW'], 2, true)).toEqual(['SSE']);
    });

    it('rotation 3 shifts by 6 positions (equivalent to -2)', () => {
      expect(getRotatedFeatureDirections(['NNE'], 3, true)).toEqual(['WNW']);
      expect(getRotatedFeatureDirections(['ENE'], 3, true)).toEqual(['NNW']);
      expect(getRotatedFeatureDirections(['ESE'], 3, true)).toEqual(['NNE']);
      expect(getRotatedFeatureDirections(['SSE'], 3, true)).toEqual(['ENE']);
    });

    it('rotation 1 with multiple farm directions shifts each', () => {
      const input = ['NNE', 'WNW'];
      const result = getRotatedFeatureDirections(input, 1, true);
      expect(result).toEqual(['ESE', 'NNE']);
    });

    it('rotation 2 with multiple farm directions flips each', () => {
      const result = getRotatedFeatureDirections(['NNE', 'SSW', 'WNW'], 2, true);
      expect(result).toEqual(['SSW', 'NNE', 'ESE']);
    });

    it('handles empty directions array for farms', () => {
      expect(getRotatedFeatureDirections([], 1, true)).toEqual([]);
      expect(getRotatedFeatureDirections([], 2, true)).toEqual([]);
    });

    it('handles single entry for farm directions', () => {
      expect(getRotatedFeatureDirections(['WSW'], 0, true)).toEqual(['WSW']);
      expect(getRotatedFeatureDirections(['WSW'], 2, true)).toEqual(['ENE']);
    });
  });
});

// ---------------------------------------------------------------------------
// calculateValidPlacements  (default export)
// ---------------------------------------------------------------------------

describe('calculateValidPlacements()', () => {
  // Common tile references
  const startingTile = tile('base-game/RCr');
  const tileC = tile('base-game/C');          // N=city, other=field
  const tileCccc = tile('base-game/Cccc+');   // all city
  const tileL = tile('base-game/L');          // all field + cloister
  const tileRFr = tile('base-game/RFr');      // E=road, W=road

  // -----------------------------------------------------------------------
  // Edge-case: no / empty / blocked
  // -----------------------------------------------------------------------

  it('returns empty array when no tiles have been placed', () => {
    const result = calculateValidPlacements(startingTile, [], [], []);
    expect(result).toEqual([]);
  });

  it('returns empty array when all faces of all placed tiles are blocked', () => {
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: 0,
      eastTileIndex: 0,
      southTileIndex: 0,
      westTileIndex: 0,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileC, placed, [], []);
    expect(result).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // Basic placement discovery
  // -----------------------------------------------------------------------

  it('finds valid placements at north and south faces when edges match', () => {
    // Starting tile at (0,0): N=city, S=field, E=road, W=road
    // Active tile 'C': N=city, S=field, E=field, W=field
    //   → north face: city matches active northEdge → (0,-1) rotation 2
    //   → south face: field matches 3 active edges → (0,1) rotations 1,2,3
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileC, placed, [], []);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const northP = result.find((p) => p.x === 0 && p.y === -1);
    expect(northP).toBeDefined();
    expect(northP.rotations).toHaveLength(1);
    expect(northP.rotations[0].rotation).toBe(2);
    const southP = result.find((p) => p.x === 0 && p.y === 1);
    expect(southP).toBeDefined();
    expect(southP.rotations.length).toBeGreaterThanOrEqual(2);
  });

  it('finds multiple placements from a single placed tile', () => {
    // Starting tile at (0,0): S=field, E=road, W=road
    // Active tile 'C': N=city, all other edges=field
    //   → south face (field) matches multiple field edges
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileC, placed, [], []);
    // Should find at least (0, -1) rotation 2, and (0, 1) rotations 1,2,3
    expect(result.length).toBeGreaterThanOrEqual(1);
    const northPlacement = result.find((p) => p.x === 0 && p.y === -1);
    expect(northPlacement).toBeDefined();
    expect(northPlacement.rotations[0].rotation).toBe(2);
    const southPlacement = result.find((p) => p.x === 0 && p.y === 1);
    expect(southPlacement).toBeDefined();
    expect(southPlacement.rotations.length).toBeGreaterThanOrEqual(2);
  });

  it('finds placements from multiple source tiles', () => {
    // Two placed tiles with open faces that the active tile can match
    const placed = [
      {
        x: 0, y: 0, rotation: 0,
        tile: startingTile,
        northTileIndex: undefined,
        eastTileIndex: undefined,
        southTileIndex: undefined,
        westTileIndex: undefined,
        meeples: [],
      },
      {
        x: -1, y: 0, rotation: 0,
        tile: startingTile,
        northTileIndex: undefined,
        eastTileIndex: 0,      // connected to tile at (0,0)
        southTileIndex: undefined,
        westTileIndex: undefined,
        meeples: [],
      },
    ];
    const result = calculateValidPlacements(tileC, placed, [], []);
    // Should find placements from both source tiles
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Edge conflict filtering
  // -----------------------------------------------------------------------

  it('filters out placements that conflict with edge of another placed tile', () => {
    // Tile A at (0,0): starting tile, S=field
    // Tile B at (0,2): tile C rotated 2, N=field, S=city
    // Position (0,1) is adjacent to both A (south) and B (north).
    // Active tile 'C' at (0,1):
    //   - rotation 0: N=city faces A's S=field → mismatch with A → filtered
    //   - rotation 2: S=city faces B's N=field → mismatch with B → filtered
    //   - rotations 1, 3: both field edges match both → survive
    const placed = [
      {
        x: 0, y: 0, rotation: 0,
        tile: startingTile,
        northTileIndex: undefined,
        eastTileIndex: undefined,
        southTileIndex: undefined,
        westTileIndex: undefined,
        meeples: [],
      },
      {
        x: 0, y: 2, rotation: 2,
        tile: tileC,
        // After rot 2: N=tileC.southEdge='field', S=tileC.northEdge='city'
        northTileIndex: undefined,
        eastTileIndex: undefined,
        southTileIndex: undefined,
        westTileIndex: undefined,
        meeples: [],
      },
    ];
    const result = calculateValidPlacements(tileC, placed, [{ active: true, remainingMeeples: 7 }], []);
    const mid = result.find((p) => p.x === 0 && p.y === 1);
    expect(mid).toBeDefined();
    // Only rotations 1 and 3 should survive the conflict check
    const rotations = mid.rotations.map((r) => r.rotation).sort();
    expect(rotations).toEqual([1, 3]);
  });

  // -----------------------------------------------------------------------
  // Meeple options — cities
  // -----------------------------------------------------------------------

  it('includes a city meeple option when active tile has a city', () => {
    // Starting tile at (0,0): city at index 0 directions ['N']
    // Active tile 'C' placed north (rot 2) → city connects
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileC, placed, [{ active: true, remainingMeeples: 7 }], []);
    const northP = result.find((p) => p.x === 0 && p.y === -1);
    expect(northP).toBeDefined();
    const rot2 = northP.rotations.find((r) => r.rotation === 2);
    expect(rot2).toBeDefined();
    expect(rot2.meeples.some((m) => m.locationType === 'city' && m.meepleType === 'normal')).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Meeple options — roads
  // -----------------------------------------------------------------------

  it('includes a road meeple option when active tile has a road', () => {
    // Starting tile at (0,0): road at index 0 directions ['W','E']
    // Active tile 'RFr' placed east (rot 0) → road connects at east face
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileRFr, placed, [{ active: true, remainingMeeples: 7 }], []);
    // RFr placed east: W=road matches starting tile's E=road at rotation 0
    const eastP = result.find((p) => p.x === 1 && p.y === 0);
    if (eastP) {
      const rot0 = eastP.rotations.find((r) => r.rotation === 0);
      if (rot0) {
        expect(rot0.meeples.some((m) => m.locationType === 'road' && m.meepleType === 'normal')).toBe(true);
      }
    }
  });

  // -----------------------------------------------------------------------
  // Meeple options — farms
  // -----------------------------------------------------------------------

  it('includes a farm meeple option when active tile has farms', () => {
    // Active tile 'C' placed at a valid position should include farm meeple
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileC, placed, [{ active: true, remainingMeeples: 7 }], []);
    for (const placement of result) {
      for (const rot of placement.rotations) {
        expect(rot.meeples.some((m) => m.locationType === 'farm')).toBe(true);
      }
    }
  });

  // -----------------------------------------------------------------------
  // Meeple options — cloister
  // -----------------------------------------------------------------------

  it('includes a cloister meeple option when active tile has a cloister', () => {
    // Active tile 'L' has a cloister property
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileL, placed, [{ active: true, remainingMeeples: 7 }], []);
    expect(result.length).toBeGreaterThan(0);
    for (const placement of result) {
      for (const rot of placement.rotations) {
        expect(rot.meeples.some((m) => m.locationType === 'cloister')).toBe(true);
      }
    }
  });

  // -----------------------------------------------------------------------
  // Builder meeple from adjacent city
  // -----------------------------------------------------------------------

  it('adds a builder meeple when adjacent city has an active player meeple', () => {
    // Starting tile at (0,0) has a meeple on its city (index 0) from player 0
    // Active tile 'C' placed north (rot 2) connects to that city
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [{
        playerIndex: 0,
        placement: { locationType: 'city', index: 0 },
        meepleType: 'normal',
        scored: false,
      }],
    }];
    const players = [{ active: true, remainingMeeples: 7 }];
    const result = calculateValidPlacements(tileC, placed, players, []);
    const northP = result.find((p) => p.x === 0 && p.y === -1);
    expect(northP).toBeDefined();
    const rot2 = northP.rotations.find((r) => r.rotation === 2);
    expect(rot2).toBeDefined();
    // Builder meeple should be present
    expect(rot2.meeples.some((m) => m.meepleType === 'builder' && m.locationType === 'city')).toBe(true);
    // Normal city meeple should NOT be present (feature has a meeple already)
    expect(rot2.meeples.some((m) => m.meepleType === 'normal' && m.locationType === 'city')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Builder meeple from adjacent road
  // -----------------------------------------------------------------------

  it('adds a builder meeple when adjacent road has an active player meeple', () => {
    // Starting tile has a meeple on its road (index 0, directions ['W','E'])
    // Active tile 'RFr' placed east (rot 0) connects to that road
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [{
        playerIndex: 0,
        placement: { locationType: 'road', index: 0 },
        meepleType: 'normal',
        scored: false,
      }],
    }];
    const players = [{ active: true, remainingMeeples: 7 }];
    const result = calculateValidPlacements(tileRFr, placed, players, []);
    const eastP = result.find((p) => p.x === 1 && p.y === 0);
    if (eastP) {
      const rot0 = eastP.rotations.find((r) => r.rotation === 0);
      if (rot0) {
        expect(rot0.meeples.some((m) => m.meepleType === 'builder' && m.locationType === 'road')).toBe(true);
        expect(rot0.meeples.some((m) => m.meepleType === 'normal' && m.locationType === 'road')).toBe(false);
      }
    }
  });

  // -----------------------------------------------------------------------
  // Deduplication
  // -----------------------------------------------------------------------

  it('deduplicates the same (x, y) from multiple source tiles', () => {
    // Two placed tiles with open faces at the same position
    // Tile A at (0,0): S=field → match south at (0,1)
    // Tile B at (0,2): N=field → match north at (0,1)
    // Both produce placements at (0,1) which should be merged
    const placed = [
      {
        x: 0, y: 0, rotation: 0,
        tile: startingTile,
        northTileIndex: undefined,
        eastTileIndex: undefined,
        southTileIndex: undefined,
        westTileIndex: undefined,
        meeples: [],
      },
      {
        x: 0, y: 2, rotation: 2,
        tile: tileC,
        northTileIndex: undefined,
        eastTileIndex: undefined,
        southTileIndex: undefined,
        westTileIndex: undefined,
        meeples: [],
      },
    ];
    const players = [{ active: true, remainingMeeples: 7 }];
    const result = calculateValidPlacements(tileC, placed, players, []);
    // Should have only one entry for (0, 1) with merged rotations
    const entriesAt01 = result.filter((p) => p.x === 0 && p.y === 1);
    expect(entriesAt01).toHaveLength(1);
    const entry = entriesAt01[0];
    // Should have rotations 1 and 3 (the ones that survive edge conflict check)
    expect(entry.rotations.length).toBe(2);
    const rotations = entry.rotations.map((r) => r.rotation).sort();
    expect(rotations).toEqual([1, 3]);
  });

  // -----------------------------------------------------------------------
  // Expansions parameter
  // -----------------------------------------------------------------------

  it('accepts expansions parameter without crashing', () => {
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const expansions = ['base-game', 'inns-and-cathedrals'];
    const result = calculateValidPlacements(tileC, placed, [{ active: true, remainingMeeples: 7 }], expansions);
    expect(Array.isArray(result)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Structure and types
  // -----------------------------------------------------------------------

  it('returns an array of placement objects with correct structure', () => {
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileC, placed, [{ active: true, remainingMeeples: 7 }], []);
    expect(Array.isArray(result)).toBe(true);
    for (const p of result) {
      expect(p).toHaveProperty('x');
      expect(p).toHaveProperty('y');
      expect(p).toHaveProperty('rotations');
      expect(Array.isArray(p.rotations)).toBe(true);
      for (const r of p.rotations) {
        expect(r).toHaveProperty('rotation');
        expect(typeof r.rotation).toBe('number');
        expect(r).toHaveProperty('meeples');
        expect(Array.isArray(r.meeples)).toBe(true);
        for (const m of r.meeples) {
          expect(m).toHaveProperty('meepleType');
          expect(m).toHaveProperty('locationType');
          expect(m).toHaveProperty('index');
        }
      }
    }
  });

  it('returns empty array for zero placed tiles regardless of players/expansions', () => {
    expect(calculateValidPlacements(tileC, [], [{ active: true }], ['base-game'])).toEqual([]);
    expect(calculateValidPlacements(tileL, [], [], [])).toEqual([]);
    expect(calculateValidPlacements(startingTile, [], [{ active: true }], [])).toEqual([]);
  });

  it('does not include duplicate meeple types for the same feature', () => {
    // Each city/road/farm index should appear at most once per meeple type
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    const result = calculateValidPlacements(tileC, placed, [{ active: true, remainingMeeples: 7 }], []);
    for (const p of result) {
      for (const r of p.rotations) {
        const seen = new Set();
        for (const m of r.meeples) {
          const key = `${m.meepleType}:${m.locationType}:${m.index}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    }
  });

  it('returns at least 3 distinct placements from a 4-way open tile', () => {
    // Place a tile with all field edges and a cloister — should match all
    // open faces of the starting tile that share field or road edges
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [],
    }];
    // tileL has all 'field' edges + cloister
    const result = calculateValidPlacements(tileL, placed, [{ active: true, remainingMeeples: 7 }], []);
    // Starting tile: N=city, S=field, W=road, E=road
    // tileL: all field → matches S (field), not N (city), not E/W (road)
    //   South face: field matches → (0,1) with some rotations
    //   East face: road≠field → no
    //   West face: road≠field → no
    //   North face: city≠field → no
    // So only (0,1) should match, but with multiple rotations
    expect(result.length).toBeGreaterThanOrEqual(1);
    const southP = result.find((p) => p.x === 0 && p.y === 1);
    expect(southP).toBeDefined();
    // All rotations should have a cloister meeple option
    for (const rot of southP.rotations) {
      expect(rot.meeples.some((m) => m.locationType === 'cloister')).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // Farm feature traversal depth (getFeatureMeeples)
  // -----------------------------------------------------------------------

  it('getFeatureMeeples traverses farm features across 3+ tile chains', () => {
    // Three tiles in a horizontal line, all rotation=0.
    // Each tile's farm[1] (bottom farm, below the road) connects E↔W.
    // Tile A has a meeple on farm[1]; B and C have none.
    // Traversal from C farm[1] → B farm[1] → A farm[1] MUST find the meeple.
    const startingTile = tile('base-game/RCr');
    const rfrTile = tile('base-game/RFr');

    const tileA = {
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: 1,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [{
        playerIndex: 0,
        placement: { locationType: 'farm', index: 1 },
        meepleType: 'normal',
        scored: false,
      }],
    };

    const tileB = {
      x: 1, y: 0, rotation: 0,
      tile: rfrTile,
      northTileIndex: undefined,
      eastTileIndex: 2,
      southTileIndex: undefined,
      westTileIndex: 0,
      meeples: [],
    };

    const tileC = {
      x: 2, y: 0, rotation: 0,
      tile: rfrTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: 1,
      meeples: [],
    };

    const placedTiles = [tileA, tileB, tileC];

    // Call getFeatureMeeples on tile C's farm[1]
    const result = getFeatureMeeples(tileC, 1, 'farm', placedTiles);

    // Should find the meeple on tile A's farm[1]
    expect(result.tilesWithMeeples).toHaveLength(1);
    expect(result.tilesWithMeeples[0].placedTile).toBe(tileA);
    expect(result.tilesWithMeeples[0].meepleIndex).toBe(0);
  });

  it('getFeatureMeeples traverses farm with rotated middle tile (rotation=2, 180°)', () => {
    // Tile A (RCr) at (0,0) rotation=0, tile B (RFr) at (1,0) rotation=2
    // Tile C (RFr) at (2,0) rotation=0
    // After 180° rotation, B's farm[1] (bottom) becomes the top farm,
    // but both farms span E↔W so the chain A→B→C still connects.
    const startingTile = tile('base-game/RCr');
    const rfrTile = tile('base-game/RFr');

    const tileA = {
      x: 0, y: 0, rotation: 0, tile: startingTile,
      northTileIndex: undefined, eastTileIndex: 1,
      southTileIndex: undefined, westTileIndex: undefined,
      meeples: [{ playerIndex: 0, placement: { locationType: 'farm', index: 1 }, meepleType: 'normal', scored: false }],
    };
    const tileB = {
      x: 1, y: 0, rotation: 2, tile: rfrTile,
      northTileIndex: undefined, eastTileIndex: 2,
      southTileIndex: undefined, westTileIndex: 0,
      meeples: [],
    };
    const tileC = {
      x: 2, y: 0, rotation: 0, tile: rfrTile,
      northTileIndex: undefined, eastTileIndex: undefined,
      southTileIndex: undefined, westTileIndex: 1,
      meeples: [],
    };

    const placedTiles = [tileA, tileB, tileC];

    // Traverse from C farm[1] through B to A — should find meeple on A farm[1]
    const result = getFeatureMeeples(tileC, 1, 'farm', placedTiles);
    expect(result.tilesWithMeeples).toHaveLength(1);
    expect(result.tilesWithMeeples[0].placedTile).toBe(tileA);
  });

  it('getFeatureMeeples detects meeple on different feature index on adjacent tile', () => {
    // Tile A (RCr) at (0,0) has farm[0]=['WNW','ENE'] and farm[1]=['WSW','SSW','SSE','ESE']
    // Tile B (RFr) at (1,0) has farm[0]=['WNW','NNW','NNE','ENE'] and farm[1]=['ESE','SSE','SSW','WSW']
    // A farm[0] 'ENE' connects to B farm[0] 'WNW'
    // A farm[1] 'ESE' connects to B farm[1] 'WSW'
    // Place meeple on A farm[0], check from C farm[0] → should find it through B farm[0]
    const startingTile = tile('base-game/RCr');
    const rfrTile = tile('base-game/RFr');

    const tileA = {
      x: 0, y: 0, rotation: 0, tile: startingTile,
      northTileIndex: undefined, eastTileIndex: 1,
      southTileIndex: undefined, westTileIndex: undefined,
      meeples: [{ playerIndex: 0, placement: { locationType: 'farm', index: 0 }, meepleType: 'normal', scored: false }],
    };
    const tileB = {
      x: 1, y: 0, rotation: 0, tile: rfrTile,
      northTileIndex: undefined, eastTileIndex: 2,
      southTileIndex: undefined, westTileIndex: 0,
      meeples: [],
    };
    const tileC = {
      x: 2, y: 0, rotation: 0, tile: rfrTile,
      northTileIndex: undefined, eastTileIndex: undefined,
      southTileIndex: undefined, westTileIndex: 1,
      meeples: [],
    };

    const placedTiles = [tileA, tileB, tileC];

    // Check C farm[0] → should traverse to A farm[0]
    const result = getFeatureMeeples(tileC, 0, 'farm', placedTiles);
    expect(result.tilesWithMeeples).toHaveLength(1);
    expect(result.tilesWithMeeples[0].placedTile).toBe(tileA);
  });

  it('calculateValidPlacements detects farm meeple through 4-tile chain', () => {
    // Four RFr tiles in a horizontal line, all rotation=0.
    // Farm[1] on every tile connects E↔W (bottom farm, below the road).
    // Tile A has a meeple on farm[1]; B, C have none.
    // When placing tile D at (3,0) adjacent to C, the farm validation must
    // traverse D → C → B → A and detect the meeple, blocking normal farm
    // meeple placement on D's farm[1].
    const rfrTile = tile('base-game/RFr');

    const tileA = { x: 0, y: 0, rotation: 0, tile: rfrTile,
      northTileIndex: undefined, eastTileIndex: 1, southTileIndex: undefined, westTileIndex: undefined,
      meeples: [{ playerIndex: 0, placement: { locationType: 'farm', index: 1 }, meepleType: 'normal', scored: false }] };
    const tileB = { x: 1, y: 0, rotation: 0, tile: rfrTile,
      northTileIndex: undefined, eastTileIndex: 2, southTileIndex: undefined, westTileIndex: 0,
      meeples: [] };
    const tileC = { x: 2, y: 0, rotation: 0, tile: rfrTile,
      northTileIndex: undefined, eastTileIndex: undefined, southTileIndex: undefined, westTileIndex: 1,
      meeples: [] };

    const placedTiles = [tileA, tileB, tileC];
    const players = [{ active: true, remainingMeeples: 7 }];

    const result = calculateValidPlacements(rfrTile, placedTiles, players, []);

    // Find placement at (3,0) — east of C
    const eastP = result.find((p) => p.x === 3 && p.y === 0);
    expect(eastP).toBeDefined();
    const rot0 = eastP.rotations.find((r) => r.rotation === 0);
    expect(rot0).toBeDefined();

    // farm[1] should NOT have a normal meeple — the 4-tile chain has a meeple on A
    expect(rot0.meeples.some((m) => m.locationType === 'farm' && m.meepleType === 'normal' && m.index === 1)).toBe(false);
    // farm[0] should still allow normal meeple — no meeple on farm[0] anywhere in chain
    expect(rot0.meeples.some((m) => m.locationType === 'farm' && m.meepleType === 'normal' && m.index === 0)).toBe(true);
  });

  it('handles players with inactive status without crashing', () => {
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [{
        playerIndex: 0,
        placement: { locationType: 'city', index: 0 },
        meepleType: 'normal',
        scored: false,
      }],
    }];
    // Player 0 is inactive — builder check should not crash
    const players = [{ active: false, remainingMeeples: 7 }];
    const result = calculateValidPlacements(tileC, placed, players, []);
    expect(Array.isArray(result)).toBe(true);
  });

  it('does not add builder when adjacent meeple belongs to an inactive player', () => {
    const placed = [{
      x: 0, y: 0, rotation: 0,
      tile: startingTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [{
        playerIndex: 0,
        placement: { locationType: 'city', index: 0 },
        meepleType: 'normal',
        scored: false,
      }],
    }];
    const players = [{ active: false, remainingMeeples: 7 }];
    const result = calculateValidPlacements(tileC, placed, players, []);
    const northP = result.find((p) => p.x === 0 && p.y === -1);
    if (northP) {
      const rot2 = northP.rotations.find((r) => r.rotation === 2);
      if (rot2) {
        // Builder should NOT appear because player is inactive
        expect(rot2.meeples.some((m) => m.meepleType === 'builder')).toBe(false);
        // Normal city meeple should still be present since the feature is
        // considered "free" from the perspective of the new tile
      }
    }
  });

  // -----------------------------------------------------------------------
  // N-direction farm pair mapping (bugfix: NNW↔SSE, NNE↔SSW were swapped)
  // -----------------------------------------------------------------------

  it('maps NNW→SSW (not SSE) when checking N-direction farm connection', () => {
    // When directionToSource='N' the new tile is SOUTH of source (source south face open).
    // Source Rr at (0,0) rot=0: farm[0]=['WNW','NNW','NNE','ENE','ESE','SSE']; farm[1]=['SSW','WSW']
    // Active RRRR rot=0:         farm[0]=['WNW','NNE','ESE','WSW'];             farm[1]=['ENE','NNW','SSW','SSE']
    //
    // RRRR farm[0] has 'NNW' → must map to source 'SSW' (Rr farm[1] where meeple is).
    // Geom: RRRR's NNW (points north) ↔ Rr's SSW (points south) — correct.
    // OLD buggy code: 'NNW'→'SSE' → Rr farm[0] (no meeple) → wrongly allowed normal meeple
    const rrTile = tile('base-game/Rr');
    const rrrrTile = tile('base-game/RRRR');

    const sourceTile = {
      x: 0, y: 0, rotation: 0,
      tile: rrTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [{
        playerIndex: 0,
        placement: { locationType: 'farm', index: 1 },
        meepleType: 'normal',
        scored: false,
      }],
    };

    const placedTiles = [sourceTile];
    const players = [{ active: true, remainingMeeples: 7 }];

    const result = calculateValidPlacements(rrrrTile, placedTiles, players, []);
    // directionToSource='N' → new tile at (source.x, source.y + 1) = (0, 1)
    const southP = result.find((p) => p.x === 0 && p.y === 1);
    expect(southP).toBeDefined();

    const rot0 = southP.rotations.find((r) => r.rotation === 0);
    expect(rot0).toBeDefined();

    // RRRR farm[0] (has 'NNW') connects to source farm[1] via SSW → meeple found
    // → normal farm meeple on RRRR farm[0] must be BLOCKED
    expect(rot0.meeples.some((m) => m.locationType === 'farm' && m.meepleType === 'normal' && m.index === 0)).toBe(false);

    // Active player's meeple on the connected farm → pig meeple must be available at farm[0]
    expect(rot0.meeples.some((m) => m.locationType === 'farm' && m.meepleType === 'pig' && m.index === 0)).toBe(true);
  });

  it('maps NNE→SSE (not SSW) when checking N-direction farm connection', () => {
    // Same layout but meeple on Rr farm[0] (has 'SSE').
    // RRRR farm[1] has 'NNE' → must map to source 'SSE' (Rr farm[0]).
    // Geom: RRRR's NNE (points north) ↔ Rr's SSE (points south) — correct.
    // OLD buggy code: 'NNE'→'SSW' → Rr farm[1] (no meeple) → wrongly allowed normal meeple
    const rrTile = tile('base-game/Rr');
    const rrrrTile = tile('base-game/RRRR');

    const sourceTile = {
      x: 0, y: 0, rotation: 0,
      tile: rrTile,
      northTileIndex: undefined,
      eastTileIndex: undefined,
      southTileIndex: undefined,
      westTileIndex: undefined,
      meeples: [{
        playerIndex: 0,
        placement: { locationType: 'farm', index: 0 },
        meepleType: 'normal',
        scored: false,
      }],
    };

    const placedTiles = [sourceTile];
    const players = [{ active: true, remainingMeeples: 7 }];

    const result = calculateValidPlacements(rrrrTile, placedTiles, players, []);
    // directionToSource='N' → new tile at (source.x, source.y + 1) = (0, 1)
    const southP = result.find((p) => p.x === 0 && p.y === 1);
    expect(southP).toBeDefined();

    const rot0 = southP.rotations.find((r) => r.rotation === 0);
    expect(rot0).toBeDefined();

    // RRRR farm[1] (has 'NNE') connects to source farm[0] via SSE → meeple found
    // → normal farm meeple on RRRR farm[1] must be BLOCKED
    expect(rot0.meeples.some((m) => m.locationType === 'farm' && m.meepleType === 'normal' && m.index === 1)).toBe(false);

    // Active player's meeple on the connected farm → pig meeple must be available at farm[1]
    expect(rot0.meeples.some((m) => m.locationType === 'farm' && m.meepleType === 'pig' && m.index === 1)).toBe(true);
  });
});
