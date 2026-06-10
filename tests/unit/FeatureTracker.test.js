import { describe, it, expect } from 'vitest';
import {
  createCityFeature,
  createRoadFeature,
  createFarmFeature,
  createCloisterFeature,
  isFeatureComplete,
  addMeepleToFeature,
  removeMeeplesFromFeature,
  getFeaturePoints,
  mergeFeatures,
  hasPlayerMeeple,
  determineMajority,
} from '../../src/game/FeatureTracker.js';

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

describe('createCityFeature()', () => {
  it('returns an object with the correct type', () => {
    const f = createCityFeature();
    expect(f.type).toBe('city');
  });

  it('initializes points to 0', () => {
    const f = createCityFeature();
    expect(f.points).toBe(0);
  });

  it('initializes tilesWithMeeples as an empty array', () => {
    const f = createCityFeature();
    expect(f.tilesWithMeeples).toEqual([]);
  });

  it('initializes complete to false', () => {
    const f = createCityFeature();
    expect(f.complete).toBe(false);
  });

  it('initializes goods as an empty array', () => {
    const f = createCityFeature();
    expect(f.goods).toEqual([]);
  });

  it('initializes cathedral to false', () => {
    const f = createCityFeature();
    expect(f.cathedral).toBe(false);
  });

  it('returns a plain object (not null, not array)', () => {
    const f = createCityFeature();
    expect(f).toBeInstanceOf(Object);
    expect(Array.isArray(f)).toBe(false);
  });
});

describe('createRoadFeature()', () => {
  it('returns an object with the correct type', () => {
    const f = createRoadFeature();
    expect(f.type).toBe('road');
  });

  it('initializes points to 0', () => {
    const f = createRoadFeature();
    expect(f.points).toBe(0);
  });

  it('initializes tilesWithMeeples as an empty array', () => {
    const f = createRoadFeature();
    expect(f.tilesWithMeeples).toEqual([]);
  });

  it('initializes complete to false', () => {
    const f = createRoadFeature();
    expect(f.complete).toBe(false);
  });

  it('initializes inn to false', () => {
    const f = createRoadFeature();
    expect(f.inn).toBe(false);
  });
});

describe('createFarmFeature()', () => {
  it('returns an object with the correct type', () => {
    const f = createFarmFeature();
    expect(f.type).toBe('farm');
  });

  it('initializes points to 0', () => {
    const f = createFarmFeature();
    expect(f.points).toBe(0);
  });

  it('initializes tilesWithMeeples as an empty array', () => {
    const f = createFarmFeature();
    expect(f.tilesWithMeeples).toEqual([]);
  });

  it('initializes complete to true (farms are always "complete")', () => {
    const f = createFarmFeature();
    expect(f.complete).toBe(true);
  });

  it('does NOT have goods or cathedral properties', () => {
    const f = createFarmFeature();
    expect(f).not.toHaveProperty('goods');
    expect(f).not.toHaveProperty('cathedral');
    expect(f).not.toHaveProperty('inn');
  });
});

describe('createCloisterFeature()', () => {
  it('returns an object with the correct type', () => {
    const f = createCloisterFeature();
    expect(f.type).toBe('cloister');
  });

  it('initializes points to 0', () => {
    const f = createCloisterFeature();
    expect(f.points).toBe(0);
  });

  it('initializes tilesWithMeeples as an empty array', () => {
    const f = createCloisterFeature();
    expect(f.tilesWithMeeples).toEqual([]);
  });

  it('initializes complete to false', () => {
    const f = createCloisterFeature();
    expect(f.complete).toBe(false);
  });

  it('does NOT have city/road-specific properties', () => {
    const f = createCloisterFeature();
    expect(f).not.toHaveProperty('goods');
    expect(f).not.toHaveProperty('cathedral');
    expect(f).not.toHaveProperty('inn');
  });
});

// ---------------------------------------------------------------------------
// isFeatureComplete
// ---------------------------------------------------------------------------

describe('isFeatureComplete()', () => {
  it('returns true for a farm feature (always complete)', () => {
    expect(isFeatureComplete(createFarmFeature())).toBe(true);
  });

  it('returns false for a newly created city feature', () => {
    expect(isFeatureComplete(createCityFeature())).toBe(false);
  });

  it('returns false for a newly created road feature', () => {
    expect(isFeatureComplete(createRoadFeature())).toBe(false);
  });

  it('returns false for a newly created cloister feature', () => {
    expect(isFeatureComplete(createCloisterFeature())).toBe(false);
  });

  it('returns true when a feature is marked complete', () => {
    const feature = createCityFeature();
    feature.complete = true;
    expect(isFeatureComplete(feature)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addMeepleToFeature
// ---------------------------------------------------------------------------

describe('addMeepleToFeature()', () => {
  it('adds a single meeple entry to tilesWithMeeples', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 1);
    expect(feature.tilesWithMeeples).toHaveLength(1);
    expect(feature.tilesWithMeeples[0]).toEqual({ placedTileIndex: 0, meepleIndex: 1 });
  });

  it('appends multiple meeple entries', () => {
    const feature = createRoadFeature();
    addMeepleToFeature(feature, 0, 0);
    addMeepleToFeature(feature, 1, 0);
    addMeepleToFeature(feature, 2, 2);
    expect(feature.tilesWithMeeples).toHaveLength(3);
    expect(feature.tilesWithMeeples[0]).toEqual({ placedTileIndex: 0, meepleIndex: 0 });
    expect(feature.tilesWithMeeples[1]).toEqual({ placedTileIndex: 1, meepleIndex: 0 });
    expect(feature.tilesWithMeeples[2]).toEqual({ placedTileIndex: 2, meepleIndex: 2 });
  });

  it('allows duplicate placedTileIndex with different meepleIndex', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    addMeepleToFeature(feature, 0, 1);
    expect(feature.tilesWithMeeples).toHaveLength(2);
  });

  it('does not mutate other feature properties', () => {
    const feature = createCityFeature();
    feature.points = 5;
    addMeepleToFeature(feature, 1, 2);
    expect(feature.points).toBe(5);
    expect(feature.type).toBe('city');
    expect(feature.complete).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// removeMeeplesFromFeature
// ---------------------------------------------------------------------------

describe('removeMeeplesFromFeature()', () => {
  it('clears tilesWithMeeples when entries exist', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    addMeepleToFeature(feature, 1, 1);
    expect(feature.tilesWithMeeples).toHaveLength(2);

    removeMeeplesFromFeature(feature);
    expect(feature.tilesWithMeeples).toHaveLength(0);
  });

  it('is a no-op when tilesWithMeeples is already empty', () => {
    const feature = createCityFeature();
    removeMeeplesFromFeature(feature);
    expect(feature.tilesWithMeeples).toEqual([]);
  });

  it('does not affect other feature properties', () => {
    const feature = createCityFeature();
    feature.points = 3;
    feature.complete = true;
    feature.goods = [{ fabric: 1, wine: 0, wheat: 0 }];
    addMeepleToFeature(feature, 0, 0);
    removeMeeplesFromFeature(feature);
    expect(feature.points).toBe(3);
    expect(feature.complete).toBe(true);
    expect(feature.goods).toEqual([{ fabric: 1, wine: 0, wheat: 0 }]);
  });
});

// ---------------------------------------------------------------------------
// getFeaturePoints
// ---------------------------------------------------------------------------

describe('getFeaturePoints()', () => {
  it('returns 0 for a freshly created feature', () => {
    expect(getFeaturePoints(createCityFeature())).toBe(0);
    expect(getFeaturePoints(createRoadFeature())).toBe(0);
    expect(getFeaturePoints(createFarmFeature())).toBe(0);
    expect(getFeaturePoints(createCloisterFeature())).toBe(0);
  });

  it('returns the points value of the feature', () => {
    const feature = createCityFeature();
    feature.points = 5;
    expect(getFeaturePoints(feature)).toBe(5);
  });

  it('ignores the optional _playerCount parameter', () => {
    const feature = createRoadFeature();
    feature.points = 3;
    expect(getFeaturePoints(feature, 2)).toBe(3);
    expect(getFeaturePoints(feature, 4)).toBe(3);
  });

  it('does not mutate the feature', () => {
    const feature = createCityFeature();
    feature.points = 7;
    getFeaturePoints(feature);
    expect(feature.points).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// mergeFeatures
// ---------------------------------------------------------------------------

describe('mergeFeatures()', () => {
  it('combines tilesWithMeeples from source into target', () => {
    const target = createCityFeature();
    addMeepleToFeature(target, 0, 0);
    const source = createCityFeature();
    addMeepleToFeature(source, 1, 0);

    mergeFeatures(target, source);
    expect(target.tilesWithMeeples).toHaveLength(2);
    expect(target.tilesWithMeeples).toContainEqual({ placedTileIndex: 0, meepleIndex: 0 });
    expect(target.tilesWithMeeples).toContainEqual({ placedTileIndex: 1, meepleIndex: 0 });
  });

  it('deduplicates entries with same placedTileIndex and meepleIndex', () => {
    const target = createCityFeature();
    addMeepleToFeature(target, 0, 0);
    addMeepleToFeature(target, 1, 1);
    const source = createCityFeature();
    addMeepleToFeature(source, 0, 0); // duplicate of target[0]
    addMeepleToFeature(source, 2, 0);

    mergeFeatures(target, source);
    expect(target.tilesWithMeeples).toHaveLength(3);
  });

  it('keeps the higher points value', () => {
    const target = createCityFeature();
    target.points = 2;
    const source = createCityFeature();
    source.points = 5;

    mergeFeatures(target, source);
    expect(target.points).toBe(5);
  });

  it('keeps target points when they are higher', () => {
    const target = createCityFeature();
    target.points = 7;
    const source = createCityFeature();
    source.points = 3;

    mergeFeatures(target, source);
    expect(target.points).toBe(7);
  });

  it('preserves target points when source points are equal', () => {
    const target = createCityFeature();
    target.points = 4;
    const source = createCityFeature();
    source.points = 4;

    mergeFeatures(target, source);
    expect(target.points).toBe(4);
  });

  it('sets complete to true only when BOTH are complete', () => {
    // Both complete
    const t1 = createCityFeature(); t1.complete = true;
    const s1 = createCityFeature(); s1.complete = true;
    mergeFeatures(t1, s1);
    expect(t1.complete).toBe(true);

    // Target complete, source incomplete
    const t2 = createCityFeature(); t2.complete = true;
    const s2 = createCityFeature(); s2.complete = false;
    mergeFeatures(t2, s2);
    expect(t2.complete).toBe(false);

    // Target incomplete, source complete
    const t3 = createCityFeature(); t3.complete = false;
    const s3 = createCityFeature(); s3.complete = true;
    mergeFeatures(t3, s3);
    expect(t3.complete).toBe(false);

    // Both incomplete
    const t4 = createCityFeature(); t4.complete = false;
    const s4 = createCityFeature(); s4.complete = false;
    mergeFeatures(t4, s4);
    expect(t4.complete).toBe(false);
  });

  it('preserves the target type', () => {
    const target = createCityFeature();
    const source = createCityFeature();
    // Type is not modified by merge
    mergeFeatures(target, source);
    expect(target.type).toBe('city');
  });

  describe('for city features', () => {
    it('ORs cathedral together (false + true → true)', () => {
      const target = createCityFeature(); target.cathedral = false;
      const source = createCityFeature(); source.cathedral = true;
      mergeFeatures(target, source);
      expect(target.cathedral).toBe(true);
    });

    it('ORs cathedral together (true + false → true)', () => {
      const target = createCityFeature(); target.cathedral = true;
      const source = createCityFeature(); source.cathedral = false;
      mergeFeatures(target, source);
      expect(target.cathedral).toBe(true);
    });

    it('ORs cathedral together (false + false → false)', () => {
      const target = createCityFeature(); target.cathedral = false;
      const source = createCityFeature(); source.cathedral = false;
      mergeFeatures(target, source);
      expect(target.cathedral).toBe(false);
    });

    it('concatenates goods from source into target', () => {
      const target = createCityFeature();
      target.goods = [{ fabric: 1, wine: 0, wheat: 0 }];
      const source = createCityFeature();
      source.goods = [{ fabric: 0, wine: 1, wheat: 0 }];

      mergeFeatures(target, source);
      expect(target.goods).toHaveLength(2);
      expect(target.goods).toContainEqual({ fabric: 1, wine: 0, wheat: 0 });
      expect(target.goods).toContainEqual({ fabric: 0, wine: 1, wheat: 0 });
    });

    it('does nothing if source goods is empty', () => {
      const target = createCityFeature();
      target.goods = [{ fabric: 1, wine: 0, wheat: 0 }];
      const source = createCityFeature();
      source.goods = [];

      mergeFeatures(target, source);
      expect(target.goods).toHaveLength(1);
    });

    it('does nothing if source goods is undefined', () => {
      const target = createCityFeature();
      target.goods = [{ fabric: 1, wine: 0, wheat: 0 }];
      const source = createCityFeature();
      delete source.goods;

      mergeFeatures(target, source);
      expect(target.goods).toHaveLength(1);
    });
  });

  describe('for road features', () => {
    it('ORs inn together (false + true → true)', () => {
      const target = createRoadFeature(); target.inn = false;
      const source = createRoadFeature(); source.inn = true;
      mergeFeatures(target, source);
      expect(target.inn).toBe(true);
    });

    it('ORs inn together (true + false → true)', () => {
      const target = createRoadFeature(); target.inn = true;
      const source = createRoadFeature(); source.inn = false;
      mergeFeatures(target, source);
      expect(target.inn).toBe(true);
    });

    it('ORs inn together (false + false → false)', () => {
      const target = createRoadFeature(); target.inn = false;
      const source = createRoadFeature(); source.inn = false;
      mergeFeatures(target, source);
      expect(target.inn).toBe(false);
    });
  });

  describe('for farm features', () => {
    it('does not crash when merging farms', () => {
      const target = createFarmFeature();
      const source = createFarmFeature();
      addMeepleToFeature(target, 0, 0);
      addMeepleToFeature(source, 1, 0);

      mergeFeatures(target, source);
      expect(target.tilesWithMeeples).toHaveLength(2);
      expect(target.complete).toBe(true);
    });
  });

  describe('for cloister features', () => {
    it('does not crash when merging cloisters', () => {
      const target = createCloisterFeature();
      const source = createCloisterFeature();
      addMeepleToFeature(target, 0, 0);
      addMeepleToFeature(source, 1, 0);

      mergeFeatures(target, source);
      expect(target.tilesWithMeeples).toHaveLength(2);
      expect(target.type).toBe('cloister');
    });
  });
});

// ---------------------------------------------------------------------------
// hasPlayerMeeple
// ---------------------------------------------------------------------------

describe('hasPlayerMeeple()', () => {
  function makePlacedTile(meeples) {
    return { meeples };
  }

  it('returns true when the player has a meeple on the feature', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    const placedTiles = [makePlacedTile([{ playerIndex: 1 }])];

    expect(hasPlayerMeeple(feature, 1, placedTiles)).toBe(true);
  });

  it('returns false when another player has the meeple', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    const placedTiles = [makePlacedTile([{ playerIndex: 1 }])];

    expect(hasPlayerMeeple(feature, 2, placedTiles)).toBe(false);
  });

  it('returns false when feature has no meeples', () => {
    const feature = createCityFeature();
    expect(hasPlayerMeeple(feature, 0, [makePlacedTile([{ playerIndex: 0 }])])).toBe(false);
  });

  it('returns false when the tile reference is missing', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 99, 0); // out-of-bounds tile
    const placedTiles = [makePlacedTile([{ playerIndex: 0 }])];

    expect(hasPlayerMeeple(feature, 0, placedTiles)).toBe(false);
  });

  it('returns false when the meeple reference is missing', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 99); // out-of-bounds meeple
    const placedTiles = [makePlacedTile([{ playerIndex: 0 }])];

    expect(hasPlayerMeeple(feature, 0, placedTiles)).toBe(false);
  });

  it('returns false when placedTiles is an empty array', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    expect(hasPlayerMeeple(feature, 0, [])).toBe(false);
  });

  it('checks multiple meeples and finds the correct player', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0); // player 0
    addMeepleToFeature(feature, 1, 0); // player 1
    addMeepleToFeature(feature, 2, 0); // player 2
    const placedTiles = [
      makePlacedTile([{ playerIndex: 0 }]),
      makePlacedTile([{ playerIndex: 1 }]),
      makePlacedTile([{ playerIndex: 2 }]),
    ];

    expect(hasPlayerMeeple(feature, 0, placedTiles)).toBe(true);
    expect(hasPlayerMeeple(feature, 1, placedTiles)).toBe(true);
    expect(hasPlayerMeeple(feature, 2, placedTiles)).toBe(true);
    expect(hasPlayerMeeple(feature, 3, placedTiles)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// determineMajority
// ---------------------------------------------------------------------------

describe('determineMajority()', () => {
  function makePlacedTile(meeples) {
    return { meeples };
  }

  it('returns an empty array when feature has no meeples', () => {
    const feature = createCityFeature();
    const result = determineMajority(feature, []);
    expect(result).toEqual([]);
  });

  it('returns a single entry for one player with count 1', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    const placedTiles = [makePlacedTile([{ playerIndex: 0, meepleType: 'normal' }])];

    const result = determineMajority(feature, placedTiles);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ playerIndex: 0, count: 1 });
  });

  it('counts large meeples as 2', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    const placedTiles = [makePlacedTile([{ playerIndex: 1, meepleType: 'large' }])];

    const result = determineMajority(feature, placedTiles);
    expect(result[0].count).toBe(2);
  });

  it('counts normal meeples as 1', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    const placedTiles = [makePlacedTile([{ playerIndex: 0, meepleType: 'normal' }])];

    const result = determineMajority(feature, placedTiles);
    expect(result[0].count).toBe(1);
  });

  it('defaults to count 1 when meepleType is undefined', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    const placedTiles = [makePlacedTile([{ playerIndex: 2 }])]; // no meepleType

    const result = determineMajority(feature, placedTiles);
    expect(result[0].count).toBe(1);
  });

  it('aggregates multiple meeples from the same player', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    addMeepleToFeature(feature, 1, 0);
    addMeepleToFeature(feature, 2, 0);
    const placedTiles = [
      makePlacedTile([{ playerIndex: 0, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 0, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 0, meepleType: 'normal' }]),
    ];

    const result = determineMajority(feature, placedTiles);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3);
  });

  it('sorts results by count descending', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0); // player 2: 3 normal
    addMeepleToFeature(feature, 1, 0);
    addMeepleToFeature(feature, 2, 0);
    addMeepleToFeature(feature, 3, 0); // player 1: 2 normal
    addMeepleToFeature(feature, 4, 0);
    addMeepleToFeature(feature, 5, 0); // player 0: 1 large
    const placedTiles = [
      makePlacedTile([{ playerIndex: 2, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 2, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 2, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 1, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 1, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 0, meepleType: 'large' }]),
    ];

    const result = determineMajority(feature, placedTiles);
    expect(result).toHaveLength(3);
    // Player 2 has 3 → first, players 0 and 1 both have 2
    expect(result[0].playerIndex).toBe(2);
    expect(result[0].count).toBe(3);
    expect(result[1].count).toBe(2);
    expect(result[2].count).toBe(2); // large meeple = 2
  });

  it('skips entries where the tile is missing (undefined)', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    addMeepleToFeature(feature, 99, 0); // missing tile
    const placedTiles = [makePlacedTile([{ playerIndex: 0, meepleType: 'normal' }])];

    const result = determineMajority(feature, placedTiles);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(1);
  });

  it('skips entries where the meeple is missing (undefined)', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    addMeepleToFeature(feature, 0, 99); // missing meeple on same tile
    const placedTiles = [makePlacedTile([{ playerIndex: 1, meepleType: 'normal' }])];

    const result = determineMajority(feature, placedTiles);
    expect(result).toHaveLength(1);
    expect(result[0].playerIndex).toBe(1);
  });

  it('handles a tie between players (same count)', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0); // player 0
    addMeepleToFeature(feature, 1, 0); // player 1
    const placedTiles = [
      makePlacedTile([{ playerIndex: 0, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 1, meepleType: 'normal' }]),
    ];

    const result = determineMajority(feature, placedTiles);
    expect(result).toHaveLength(2);
    expect(result[0].count).toBe(1);
    expect(result[1].count).toBe(1);
  });

  it('handles empty placedTiles array', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    const result = determineMajority(feature, []);
    expect(result).toEqual([]);
  });

  it('handles mixture of normal and large meeples for the same player', () => {
    const feature = createCityFeature();
    addMeepleToFeature(feature, 0, 0);
    addMeepleToFeature(feature, 1, 0);
    const placedTiles = [
      makePlacedTile([{ playerIndex: 0, meepleType: 'normal' }]),
      makePlacedTile([{ playerIndex: 0, meepleType: 'large' }]),
    ];

    const result = determineMajority(feature, placedTiles);
    expect(result).toHaveLength(1);
    expect(result[0].count).toBe(3); // 1 (normal) + 2 (large)
  });
});
