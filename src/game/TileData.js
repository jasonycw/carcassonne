// Tile data definitions for Carcassonne
// Extracted from original Mongoose tile.js seeder

export const BASE_GAME_TILES = [
  {
    id: 'base-game/RCr',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [{ directions: ['W', 'E'], meepleOffset: { x: 1/2, y: 1/2 } }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'ENE'], meepleOffset: { x: 1/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['WSW', 'SSW', 'SSE', 'ESE'], meepleOffset: { x: 1/2, y: 3/4 } }
    ],
    imageURL: '/images/tiles/base-game/RCr.png',
    expansion: 'base-game',
    count: 4,
    startingTile: true
  },
  {
    id: 'base-game/C',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'WSW', 'SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 1/2, y: 5/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/base-game/C.png',
    expansion: 'base-game',
    count: 5
  },
  {
    id: 'base-game/CC.2',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [],
    cities: [
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } },
      { directions: ['W'], meepleOffset: { x: 1/16, y: 1/2 } }
    ],
    farms: [
      { directions: ['SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 5/8, y: 5/8 }, adjacentCityIndices: [0, 1] }
    ],
    imageURL: '/images/tiles/base-game/CC.2.png',
    expansion: 'base-game',
    count: 2
  },
  {
    id: 'base-game/CFC.2',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [],
    cities: [
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }
    ],
    farms: [
      { directions: ['WNW', 'WSW', 'ENE', 'ESE'], meepleOffset: { x: 1/4, y: 1/2 }, adjacentCityIndices: [0, 1] }
    ],
    imageURL: '/images/tiles/base-game/CFC.2.png',
    expansion: 'base-game',
    count: 3
  },
  {
    id: 'base-game/CFc+',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [{ directions: ['W', 'E'], meepleOffset: { x: 1/2, y: 7/16 } }],
    farms: [
      { directions: ['NNW', 'NNE'], meepleOffset: { x: 1/2, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 1/2, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    doublePoints: true,
    imageURL: '/images/tiles/base-game/CFc+.png',
    expansion: 'base-game',
    count: 2
  },
  {
    id: 'base-game/CFc.1',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [{ directions: ['W', 'E'], meepleOffset: { x: 1/2, y: 7/16 } }],
    farms: [
      { directions: ['NNW', 'NNE'], meepleOffset: { x: 1/2, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 1/2, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/base-game/CFc.1.png',
    expansion: 'base-game',
    count: 1
  },
  {
    id: 'base-game/CRRR',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['W'], meepleOffset: { x: 1/4, y: 9/16 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } },
      { directions: ['E'], meepleOffset: { x: 7/8, y: 9/16 } }
    ],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'ENE'], meepleOffset: { x: 1/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['WSW', 'SSW'], meepleOffset: { x: 3/16, y: 13/16 } },
      { directions: ['SSE', 'ESE'], meepleOffset: { x: 13/16, y: 13/16 } }
    ],
    imageURL: '/images/tiles/base-game/CRRR.png',
    expansion: 'base-game',
    count: 3
  },
  {
    id: 'base-game/CRr',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'field',
    eastEdge: 'road',
    roads: [{ directions: ['S', 'E'], meepleOffset: { x: 5/8, y: 5/8 } }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'WSW', 'SSW', 'ENE'], meepleOffset: { x: 1/4, y: 5/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE', 'ESE'], meepleOffset: { x: 13/16, y: 13/16 } }
    ],
    imageURL: '/images/tiles/base-game/CRr.png',
    expansion: 'base-game',
    count: 3
  },
  {
    id: 'base-game/Cc+',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 1/4, y: 1/4 } }],
    farms: [
      { directions: ['SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 11/16, y: 11/16 }, adjacentCityIndices: [0] }
    ],
    doublePoints: true,
    imageURL: '/images/tiles/base-game/Cc+.png',
    expansion: 'base-game',
    count: 2
  },
  {
    id: 'base-game/Cc.1',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 3/16, y: 3/16 } }],
    farms: [
      { directions: ['SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 11/16, y: 11/16 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/base-game/Cc.1.png',
    expansion: 'base-game',
    count: 3
  },
  {
    id: 'base-game/CcRr+',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['S', 'E'], meepleOffset: { x: 3/4, y: 11/16 } }],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 1/4, y: 1/4 } }],
    farms: [
      { directions: ['SSW', 'ENE'], meepleOffset: { x: 9/16, y: 9/16 }, adjacentCityIndices: [0] },
      { directions: ['SSE', 'ESE'], meepleOffset: { x: 7/8, y: 7/8 } }
    ],
    doublePoints: true,
    imageURL: '/images/tiles/base-game/CcRr+.png',
    expansion: 'base-game',
    count: 2
  },
  {
    id: 'base-game/CcRr',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['S', 'E'], meepleOffset: { x: 3/4, y: 11/16 } }],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 1/4, y: 1/4 } }],
    farms: [
      { directions: ['SSW', 'ENE'], meepleOffset: { x: 9/16, y: 9/16 }, adjacentCityIndices: [0] },
      { directions: ['SSE', 'ESE'], meepleOffset: { x: 7/8, y: 7/8 } }
    ],
    imageURL: '/images/tiles/base-game/CcRr.png',
    expansion: 'base-game',
    count: 3
  },
  {
    id: 'base-game/Ccc+',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [{ directions: ['N', 'E', 'W'], meepleOffset: { x: 1/2, y: 3/8 } }],
    farms: [
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 1/2, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    doublePoints: true,
    imageURL: '/images/tiles/base-game/Ccc+.png',
    expansion: 'base-game',
    count: 1
  },
  {
    id: 'base-game/Ccc',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [{ directions: ['N', 'E', 'W'], meepleOffset: { x: 1/2, y: 3/8 } }],
    farms: [
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 1/2, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/base-game/Ccc.png',
    expansion: 'base-game',
    count: 3
  },
  {
    id: 'base-game/CccR+',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }],
    cities: [{ directions: ['N', 'E', 'W'], meepleOffset: { x: 1/2, y: 3/8 } }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 5/16, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    doublePoints: true,
    imageURL: '/images/tiles/base-game/CccR+.png',
    expansion: 'base-game',
    count: 2
  },
  {
    id: 'base-game/CccR',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }],
    cities: [{ directions: ['N', 'E', 'W'], meepleOffset: { x: 1/2, y: 3/8 } }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 5/16, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/base-game/CccR.png',
    expansion: 'base-game',
    count: 1
  },
  {
    id: 'base-game/Cccc+',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [{ directions: ['N', 'E', 'S', 'W'], meepleOffset: { x: 1/2, y: 1/2 } }],
    farms: [],
    doublePoints: true,
    imageURL: '/images/tiles/base-game/Cccc+.png',
    expansion: 'base-game',
    count: 1
  },
  {
    id: 'base-game/L',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [],
    cities: [],
    farms: [
      { directions: ['NNW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'], meepleOffset: { x: 13/16, y: 13/16 } }
    ],
    cloister: { meepleOffset: { x: 1/2, y: 1/2 } },
    imageURL: '/images/tiles/base-game/L.png',
    expansion: 'base-game',
    count: 4
  },
  {
    id: 'base-game/LR',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }],
    cities: [],
    farms: [
      { directions: ['NNW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'], meepleOffset: { x: 13/16, y: 13/16 } }
    ],
    cloister: { meepleOffset: { x: 1/2, y: 1/2 } },
    imageURL: '/images/tiles/base-game/LR.png',
    expansion: 'base-game',
    count: 2
  },
  {
    id: 'base-game/RFr',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [{ directions: ['E', 'W'], meepleOffset: { x: 1/2, y: 9/16 } }],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE'], meepleOffset: { x: 1/4, y: 1/4 } },
      { directions: ['ESE', 'SSE', 'SSW', 'WSW'], meepleOffset: { x: 3/4, y: 3/4 } }
    ],
    imageURL: '/images/tiles/base-game/RFr.png',
    expansion: 'base-game',
    count: 8
  },
  {
    id: 'base-game/RRR',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['E'], meepleOffset: { x: 7/8, y: 1/2 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 13/16 } },
      { directions: ['W'], meepleOffset: { x: 1/8, y: 1/2 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE'], meepleOffset: { x: 1/4, y: 1/4 } },
      { directions: ['ESE', 'SSE'], meepleOffset: { x: 3/4, y: 3/4 } },
      { directions: ['SSW', 'WSW'], meepleOffset: { x: 1/4, y: 3/4 } }
    ],
    imageURL: '/images/tiles/base-game/RRR.png',
    expansion: 'base-game',
    count: 4
  },
  {
    id: 'base-game/RRRR',
    northEdge: 'road',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['N'], meepleOffset: { x: 9/16, y: 3/16 } },
      { directions: ['E'], meepleOffset: { x: 13/16, y: 9/16 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 13/16 } },
      { directions: ['W'], meepleOffset: { x: 3/16, y: 1/2 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW'], meepleOffset: { x: 3/16, y: 3/16 } },
      { directions: ['NNE', 'ENE'], meepleOffset: { x: 13/16, y: 3/16 } },
      { directions: ['ESE', 'SSE'], meepleOffset: { x: 13/16, y: 13/16 } },
      { directions: ['SSW', 'WSW'], meepleOffset: { x: 3/16, y: 13/16 } }
    ],
    imageURL: '/images/tiles/base-game/RRRR.png',
    expansion: 'base-game',
    count: 1
  },
  {
    id: 'base-game/Rr',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'field',
    roads: [{ directions: ['W', 'S'], meepleOffset: { x: 1/2, y: 9/16 } }],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE', 'ESE', 'SSE'], meepleOffset: { x: 3/4, y: 1/4 } },
      { directions: ['SSW', 'WSW'], meepleOffset: { x: 1/4, y: 3/4 } }
    ],
    imageURL: '/images/tiles/base-game/Rr.png',
    expansion: 'base-game',
    count: 9
  },
  {
    id: 'base-game/RrC',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'field',
    roads: [{ directions: ['W', 'S'], meepleOffset: { x: 7/16, y: 11/16 } }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'ENE', 'ESE', 'SSE'], meepleOffset: { x: 3/4, y: 1/2 }, adjacentCityIndices: [0] },
      { directions: ['SSW', 'WSW'], meepleOffset: { x: 1/4, y: 3/4 } }
    ],
    imageURL: '/images/tiles/base-game/RrC.png',
    expansion: 'base-game',
    count: 3
  }
];

export const INNS_AND_CATHEDRALS_TILES = [
  {
    id: 'inns-and-cathedrals/C!',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [],
    cities: [{ directions: ['N'], meepleOffset: { x: 9/16, y: 1/4 } }],
    farms: [
      { directions: ['WNW', 'WSW', 'SSW', 'SSE'], meepleOffset: { x: 3/16, y: 3/4 }, adjacentCityIndices: [0] },
      { directions: ['ENE', 'ESE'], meepleOffset: { x: 15/16, y: 1/2 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/C!.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/CCC',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/16 } },
      { directions: ['W'], meepleOffset: { x: 1/8, y: 1/2 } },
      { directions: ['E'], meepleOffset: { x: 7/8, y: 1/2 } }
    ],
    farms: [
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 1/2, y: 1/2 }, adjacentCityIndices: [0, 1, 2] }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/CCC.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/CCc+',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [],
    cities: [
      { directions: ['N', 'W'], meepleOffset: { x: 3/16, y: 3/16 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 15/16 } }
    ],
    farms: [
      { directions: ['ENE', 'ESE'], meepleOffset: { x: 3/4, y: 1/2 }, adjacentCityIndices: [0, 1] }
    ],
    doublePoints: 0,
    imageURL: '/images/tiles/inns-and-cathedrals/CCc+.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/Cccc.c',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [{ directions: ['N', 'E', 'S', 'W'], meepleOffset: { x: 1/2, y: 1/2 } }],
    farms: [],
    cathedral: true,
    imageURL: '/images/tiles/inns-and-cathedrals/Cccc.c.png',
    expansion: 'inns-and-cathedrals',
    count: 2
  },
  {
    id: 'inns-and-cathedrals/CCCC',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/16 } },
      { directions: ['W'], meepleOffset: { x: 1/8, y: 1/2 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 15/16 } },
      { directions: ['E'], meepleOffset: { x: 7/8, y: 1/2 } }
    ],
    farms: [
      { directions: [], meepleOffset: { x: 1/2, y: 1/2 }, adjacentCityIndices: [0, 1, 2, 3] }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/CCCC.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/CcR',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['E'], meepleOffset: { x: 3/4, y: 9/16 } }],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 1/4, y: 1/4 } }],
    farms: [
      { directions: ['ENE'], meepleOffset: { x: 7/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW', 'SSE', 'ESE'], meepleOffset: { x: 5/8, y: 13/16 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/CcR.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/CcRr+.i',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['S', 'E'], meepleOffset: { x: 3/4, y: 3/4 }, inn: true }],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 1/4, y: 1/4 } }],
    farms: [
      { directions: ['ENE', 'SSW'], meepleOffset: { x: 3/8, y: 3/4 }, adjacentCityIndices: [0] },
      { directions: ['SSE', 'ESE'], meepleOffset: { x: 7/8, y: 7/8 } }
    ],
    doublePoints: true,
    imageURL: '/images/tiles/inns-and-cathedrals/CcRr+.i.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/CFR',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 5/8 } }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['ENE', 'ESE', 'SSE'], meepleOffset: { x: 7/8, y: 5/8 }, adjacentCityIndices: [0] },
      { directions: ['WNW', 'WSW', 'SSW'], meepleOffset: { x: 1/8, y: 5/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/CFR.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/CRCR',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['W'], meepleOffset: { x: 1/8, y: 1/2 } },
      { directions: ['E'], meepleOffset: { x: 7/8, y: 1/2 } }
    ],
    cities: [
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }
    ],
    farms: [
      { directions: ['WNW'], meepleOffset: { x: 3/16, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['ENE'], meepleOffset: { x: 7/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['WSW'], meepleOffset: { x: 1/8, y: 11/16 }, adjacentCityIndices: [1] },
      { directions: ['ESE'], meepleOffset: { x: 7/8, y: 11/16 }, adjacentCityIndices: [1] }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/CRCR.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/CRcR+',
    northEdge: 'road',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/16 } },
      { directions: ['S'], meepleOffset: { x: 7/16, y: 15/16 } }
    ],
    cities: [{ directions: ['W', 'E'], meepleOffset: { x: 1/2, y: 1/2 } }],
    farms: [
      { directions: ['NNE'], meepleOffset: { x: 3/4, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['NNW'], meepleOffset: { x: 5/16, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSW'], meepleOffset: { x: 1/4, y: 15/16 }, adjacentCityIndices: [0] }
    ],
    doublePoints: true,
    imageURL: '/images/tiles/inns-and-cathedrals/CRcR+.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/LRFR',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['W'], meepleOffset: { x: 1/8, y: 9/16 } },
      { directions: ['E'], meepleOffset: { x: 7/8, y: 7/16 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE'], meepleOffset: { x: 3/4, y: 3/16 } },
      { directions: ['WSW', 'SSW', 'SSE', 'ESE'], meepleOffset: { x: 3/4, y: 13/16 } }
    ],
    cloister: { meepleOffset: { x: 1/2, y: 1/2 } },
    imageURL: '/images/tiles/inns-and-cathedrals/LRFR.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/RCc.i',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 3/4 }, inn: true }],
    cities: [{ directions: ['W', 'N'], meepleOffset: { x: 1/4, y: 1/4 } }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 5/16, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE', 'ESE', 'ENE'], meepleOffset: { x: 11/16, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/RCc.i.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/RFr.i',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [{ directions: ['W', 'E'], meepleOffset: { x: 1/2, y: 1/2 }, inn: true }],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE'], meepleOffset: { x: 13/16, y: 3/16 } },
      { directions: ['WSW', 'SSW', 'SSE', 'ESE'], meepleOffset: { x: 1/2, y: 3/4 } }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/RFr.i.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/Rr.i',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'field',
    roads: [{ directions: ['W', 'S'], meepleOffset: { x: 1/4, y: 1/2 }, inn: true }],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE', 'ESE', 'SSE'], meepleOffset: { x: 1/4, y: 1/4 } },
      { directions: ['WSW', 'SSW'], meepleOffset: { x: 1/4, y: 3/4 } }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/Rr.i.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/RrC.i',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'field',
    roads: [{ directions: ['W', 'S'], meepleOffset: { x: 1/4, y: 1/2 }, inn: true }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'ENE', 'ESE', 'SSE'], meepleOffset: { x: 3/16, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['WSW', 'SSW'], meepleOffset: { x: 3/16, y: 3/4 } }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/RrC.i.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/RRR.i',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['W'], meepleOffset: { x: 1/4, y: 9/16 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } },
      { directions: ['E'], meepleOffset: { x: 13/16, y: 5/8 }, inn: true }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE'], meepleOffset: { x: 1/4, y: 1/4 } },
      { directions: ['WSW', 'SSW'], meepleOffset: { x: 1/4, y: 3/4 } },
      { directions: ['ESE', 'SSE'], meepleOffset: { x: 13/16, y: 13/16 } }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/RRR.i.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  },
  {
    id: 'inns-and-cathedrals/RrRr',
    northEdge: 'road',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['W', 'N'], meepleOffset: { x: 3/8, y: 3/8 } },
      { directions: ['S', 'E'], meepleOffset: { x: 3/4, y: 3/4 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW'], meepleOffset: { x: 1/4, y: 1/4 } },
      { directions: ['WSW', 'SSW', 'NNE', 'ENE'], meepleOffset: { x: 1/4, y: 3/4 } },
      { directions: ['ESE', 'SSE'], meepleOffset: { x: 7/8, y: 7/8 } }
    ],
    imageURL: '/images/tiles/inns-and-cathedrals/RrRr.png',
    expansion: 'inns-and-cathedrals',
    count: 1
  }
];

export const TRADERS_AND_BUILDERS_TILES = [
  {
    id: 'traders-and-builders/Cc.g',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 1/8, y: 1/2 }, goods: 'wheat' }],
    farms: [
      { directions: ['SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 3/4, y: 3/4 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/Cc.g.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/Cc.w',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 1/8, y: 1/2 }, goods: 'wine' }],
    farms: [
      { directions: ['SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 3/4, y: 3/4 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/Cc.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CCc.c',
    northEdge: 'field',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [
      { directions: ['W', 'E'], meepleOffset: { x: 5/8, y: 3/8 }, goods: 'fabric' },
      { directions: ['S'], meepleOffset: { x: 3/8, y: 15/16 } }
    ],
    farms: [
      { directions: ['NNW', 'NNE'], meepleOffset: { x: 1/2, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: [], meepleOffset: { x: 3/4, y: 3/4 }, adjacentCityIndices: [0, 1] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CCc.c.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/Ccc.g',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [{ directions: ['W', 'N', 'E'], meepleOffset: { x: 3/4, y: 1/4 }, goods: 'wheat' }],
    farms: [
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 5/8, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/Ccc.g.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CCc.w',
    northEdge: 'field',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [
      { directions: ['W', 'E'], meepleOffset: { x: 5/8, y: 3/8 }, goods: 'wine' },
      { directions: ['S'], meepleOffset: { x: 3/8, y: 15/16 } }
    ],
    farms: [
      { directions: ['NNW', 'NNE'], meepleOffset: { x: 1/2, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: [], meepleOffset: { x: 3/4, y: 3/4 }, adjacentCityIndices: [0, 1] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CCc.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CcCC.c',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [
      { directions: ['W', 'N'], meepleOffset: { x: 1/2, y: 1/8 }, goods: 'fabric' },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } },
      { directions: ['E'], meepleOffset: { x: 7/8, y: 3/8 } }
    ],
    farms: [
      { directions: [], meepleOffset: { x: 5/8, y: 1/2 }, adjacentCityIndices: [0, 1, 2] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CcCC.c.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CcCc.w',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [
      { directions: ['W', 'N'], meepleOffset: { x: 1/8, y: 1/2 }, goods: 'wine' },
      { directions: ['S', 'E'], meepleOffset: { x: 13/16, y: 13/16 } }
    ],
    farms: [
      { directions: [], meepleOffset: { x: 1/2, y: 9/16 }, adjacentCityIndices: [0, 1] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CcCc.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CccR.w',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [{ directions: ['S'], meepleOffset: { x: 7/16, y: 7/8 } }],
    cities: [{ directions: ['W', 'N', 'E'], meepleOffset: { x: 3/4, y: 1/4 }, goods: 'wine' }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 1/4, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CccR.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CcR!.w',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['E'], meepleOffset: { x: 7/8, y: 3/8 } }],
    cities: [{ directions: ['W', 'N'], meepleOffset: { x: 1/2, y: 3/8 }, goods: 'wine' }],
    farms: [
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 1/2, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['ESE'], meepleOffset: { x: 15/16, y: 5/8 }, adjacentCityIndices: [0] },
      { directions: ['ENE'], meepleOffset: { x: 15/16, y: 3/16 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CcR!.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CcR.c',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['E'], meepleOffset: { x: 3/4, y: 9/16 } }],
    cities: [{ directions: ['W', 'N'], meepleOffset: { x: 1/8, y: 1/2 }, goods: 'fabric' }],
    farms: [
      { directions: ['SSW', 'SSE', 'ESE'], meepleOffset: { x: 5/8, y: 13/16 }, adjacentCityIndices: [0] },
      { directions: ['ENE'], meepleOffset: { x: 13/16, y: 5/16 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CcR.c.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CcRC.c',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['E'], meepleOffset: { x: 3/4, y: 9/16 } }],
    cities: [
      { directions: ['W', 'N'], meepleOffset: { x: 1/2, y: 1/8 }, goods: 'fabric' },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }
    ],
    farms: [
      { directions: ['ESE'], meepleOffset: { x: 7/8, y: 11/16 }, adjacentCityIndices: [0, 1] },
      { directions: ['ENE'], meepleOffset: { x: 7/8, y: 5/16 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CcRC.c.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CcRC.g',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['E'], meepleOffset: { x: 3/4, y: 9/16 } }],
    cities: [
      { directions: ['W', 'N'], meepleOffset: { x: 1/2, y: 1/8 }, goods: 'wheat' },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }
    ],
    farms: [
      { directions: ['ESE'], meepleOffset: { x: 7/8, y: 11/16 }, adjacentCityIndices: [0, 1] },
      { directions: ['ENE'], meepleOffset: { x: 7/8, y: 5/16 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CcRC.g.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CcRR!.c',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [
      { directions: ['E'], meepleOffset: { x: 7/8, y: 7/16 } },
      { directions: ['S'], meepleOffset: { x: 7/16, y: 7/8 } }
    ],
    cities: [{ directions: ['W', 'N'], meepleOffset: { x: 1/2, y: 3/8 }, goods: 'fabric' }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 1/4, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['ESE'], meepleOffset: { x: 7/8, y: 5/8 }, adjacentCityIndices: [0] },
      { directions: ['ENE'], meepleOffset: { x: 7/8, y: 1/4 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CcRR!.c.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CcRR.w',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [
      { directions: ['E'], meepleOffset: { x: 7/8, y: 7/16 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 3/4 } }
    ],
    cities: [{ directions: ['W', 'N'], meepleOffset: { x: 1/8, y: 1/2 }, goods: 'wine' }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 5/16, y: 13/16 }, adjacentCityIndices: [0] },
      { directions: ['SSE', 'ESE'], meepleOffset: { x: 3/4, y: 3/4 }, adjacentCityIndices: [0] },
      { directions: ['ENE'], meepleOffset: { x: 15/16, y: 5/16 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CcRR.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CFc.w',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [{ directions: ['W', 'E'], meepleOffset: { x: 5/8, y: 3/8 }, goods: 'wine' }],
    farms: [
      { directions: ['NNW', 'NNE'], meepleOffset: { x: 1/2, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 1/2, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CFc.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CR',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'field',
    eastEdge: 'road',
    roads: [{ directions: ['E'], meepleOffset: { x: 3/4, y: 1/2 } }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'WSW', 'SSW', 'SSE', 'ESE'], meepleOffset: { x: 1/2, y: 3/4 }, adjacentCityIndices: [0] },
      { directions: ['ENE'], meepleOffset: { x: 7/8, y: 5/16 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CR.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CRc.g',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }],
    cities: [{ directions: ['W', 'E'], meepleOffset: { x: 3/4, y: 3/8 }, goods: 'wheat' }],
    farms: [
      { directions: ['NNW', 'NNE'], meepleOffset: { x: 1/2, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW'], meepleOffset: { x: 1/4, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CRc.g.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CRc.w',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }],
    cities: [{ directions: ['W', 'E'], meepleOffset: { x: 3/4, y: 3/8 }, goods: 'wine' }],
    farms: [
      { directions: ['NNW', 'NNE'], meepleOffset: { x: 1/2, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW'], meepleOffset: { x: 1/4, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CRc.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/CRcR.w',
    northEdge: 'road',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }
    ],
    cities: [{ directions: ['W', 'E'], meepleOffset: { x: 3/4, y: 3/8 }, goods: 'wine' }],
    farms: [
      { directions: ['NNW'], meepleOffset: { x: 5/16, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['NNE'], meepleOffset: { x: 11/16, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW'], meepleOffset: { x: 1/4, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/CRcR.w.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/LRRR',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['W'], meepleOffset: { x: 1/8, y: 9/16 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } },
      { directions: ['E'], meepleOffset: { x: 7/8, y: 7/16 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE'], meepleOffset: { x: 3/4, y: 1/4 } },
      { directions: ['WSW', 'SSW'], meepleOffset: { x: 1/4, y: 7/8 } },
      { directions: ['SSE', 'ESE'], meepleOffset: { x: 13/16, y: 7/8 } }
    ],
    cloister: { meepleOffset: { x: 1/2, y: 1/2 } },
    imageURL: '/images/tiles/traders-and-builders/LRRR.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/RCc!.g',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [{ directions: ['S'], meepleOffset: { x: 7/16, y: 7/8 } }],
    cities: [{ directions: ['W', 'N'], meepleOffset: { x: 1/2, y: 1/2 }, goods: 'wheat' }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 1/4, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 11/16, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['ESE', 'ENE'], meepleOffset: { x: 15/16, y: 1/2 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/RCc!.g.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/RCc.g',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 3/4 } }],
    cities: [{ directions: ['W', 'N'], meepleOffset: { x: 1/2, y: 1/8 }, goods: 'wheat' }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 5/16, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE', 'ESE', 'ENE'], meepleOffset: { x: 3/4, y: 3/4 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/RCc.g.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/RRC',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'field',
    roads: [
      { directions: ['W'], meepleOffset: { x: 1/8, y: 9/16 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 13/16 } }
    ],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW'], meepleOffset: { x: 1/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['WSW', 'SSW'], meepleOffset: { x: 1/4, y: 3/4 } },
      { directions: ['SSE', 'ESE', 'ENE'], meepleOffset: { x: 3/4, y: 3/4 }, adjacentCityIndices: [0] }
    ],
    imageURL: '/images/tiles/traders-and-builders/RRC.png',
    expansion: 'traders-and-builders',
    count: 1
  },
  {
    id: 'traders-and-builders/RRrr',
    northEdge: 'road',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['W', 'E'], meepleOffset: { x: 1/8, y: 1/2 } },
      { directions: ['S', 'N'], meepleOffset: { x: 1/2, y: 3/4 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW'], meepleOffset: { x: 1/4, y: 1/4 } },
      { directions: ['WSW', 'SSW'], meepleOffset: { x: 1/4, y: 3/4 } },
      { directions: ['SSE', 'ESE'], meepleOffset: { x: 3/4, y: 3/4 } },
      { directions: ['ENE', 'NNE'], meepleOffset: { x: 3/4, y: 1/4 } }
    ],
    imageURL: '/images/tiles/traders-and-builders/RRrr.png',
    expansion: 'traders-and-builders',
    count: 1
  }
];

export const THE_TOWER_TILES = [
  {
    id: 'the-tower/C',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'WSW', 'SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 3/16, y: 5/8 }, adjacentCityIndices: [0] }
    ],
    tower: { offset: { x: 11/16, y: 11/16 } },
    imageURL: '/images/tiles/the-tower/C.png',
    expansion: 'the-tower',
    count: 2
  },
  {
    id: 'the-tower/CC.2',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [],
    cities: [
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } },
      { directions: ['W'], meepleOffset: { x: 1/16, y: 1/2 } }
    ],
    farms: [
      { directions: ['SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 5/16, y: 5/16 }, adjacentCityIndices: [0, 1] }
    ],
    tower: { offset: { x: 11/16, y: 11/16 } },
    imageURL: '/images/tiles/the-tower/CC.2.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/Cc',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'field',
    roads: [],
    cities: [{ directions: ['N', 'W'], meepleOffset: { x: 3/16, y: 3/16 } }],
    farms: [
      { directions: ['SSW', 'SSE', 'ESE', 'ENE'], meepleOffset: { x: 13/16, y: 3/8 }, adjacentCityIndices: [0] }
    ],
    tower: { offset: { x: 3/4, y: 3/4 } },
    imageURL: '/images/tiles/the-tower/Cc.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/CccC+',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [],
    cities: [
      { directions: ['E', 'N', 'W'], meepleOffset: { x: 5/8, y: 3/8 } },
      { directions: ['S'], meepleOffset: { x: 3/8, y: 15/16 } }
    ],
    farms: [
      { directions: [], meepleOffset: { x: 13/16, y: 3/8 }, adjacentCityIndices: [0, 1] }
    ],
    doublePoints: 0,
    tower: { offset: { x: 1/4, y: 1/4 } },
    imageURL: '/images/tiles/the-tower/CccC+.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/CccR',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }],
    cities: [{ directions: ['N', 'E', 'W'], meepleOffset: { x: 1/4, y: 3/8 } }],
    farms: [
      { directions: ['SSW'], meepleOffset: { x: 5/16, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    tower: { offset: { x: 3/4, y: 1/4 } },
    imageURL: '/images/tiles/the-tower/CccR.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/CcR!',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'city',
    eastEdge: 'road',
    roads: [{ directions: ['E'], meepleOffset: { x: 7/8, y: 3/8 } }],
    cities: [{ directions: ['W', 'N'], meepleOffset: { x: 9/16, y: 1/2 } }],
    farms: [
      { directions: ['SSW', 'SSE'], meepleOffset: { x: 1/2, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['ESE'], meepleOffset: { x: 15/16, y: 5/8 }, adjacentCityIndices: [0] },
      { directions: ['ENE'], meepleOffset: { x: 15/16, y: 3/16 }, adjacentCityIndices: [0] }
    ],
    tower: { offset: { x: 1/4, y: 1/4 } },
    imageURL: '/images/tiles/the-tower/CcR!.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/CFR',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [{ directions: ['S'], meepleOffset: { x: 1/2, y: 3/4 } }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['ENE', 'ESE', 'SSE'], meepleOffset: { x: 1/8, y: 13/16 }, adjacentCityIndices: [0] },
      { directions: ['WNW', 'WSW', 'SSW'], meepleOffset: { x: 7/8, y: 13/16 }, adjacentCityIndices: [0] }
    ],
    tower: { offset: { x: 3/8, y: 7/16 } },
    imageURL: '/images/tiles/the-tower/CFR.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/CRCr.2',
    northEdge: 'city',
    southEdge: 'city',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [{ directions: ['W', 'E'], meepleOffset: { x: 1/4, y: 1/2 } }],
    cities: [
      { directions: ['N'], meepleOffset: { x: 3/8, y: 1/8 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } }
    ],
    farms: [
      { directions: ['WNW', 'ENE'], meepleOffset: { x: 1/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['WSW', 'ESE'], meepleOffset: { x: 1/8, y: 11/16 }, adjacentCityIndices: [1] }
    ],
    tower: { offset: { x: 13/16, y: 1/4 } },
    imageURL: '/images/tiles/the-tower/CRCr.2.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/CRcr',
    northEdge: 'road',
    southEdge: 'road',
    westEdge: 'city',
    eastEdge: 'city',
    roads: [{ directions: ['N', 'S'], meepleOffset: { x: 1/2, y: 13/16 } }],
    cities: [{ directions: ['W', 'E'], meepleOffset: { x: 7/8, y: 1/2 } }],
    farms: [
      { directions: ['NNW'], meepleOffset: { x: 5/16, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['NNE'], meepleOffset: { x: 3/4, y: 1/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW'], meepleOffset: { x: 5/16, y: 7/8 }, adjacentCityIndices: [0] },
      { directions: ['SSE'], meepleOffset: { x: 3/4, y: 7/8 }, adjacentCityIndices: [0] }
    ],
    tower: { offset: { x: 1/4, y: 1/4 } },
    imageURL: '/images/tiles/the-tower/CRcr.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/F',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [],
    cities: [],
    farms: [
      { directions: ['NNW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'], meepleOffset: { x: 3/16, y: 3/16 } }
    ],
    tower: { offset: { x: 9/16, y: 1/2 } },
    imageURL: '/images/tiles/the-tower/F.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/L',
    northEdge: 'field',
    southEdge: 'field',
    westEdge: 'field',
    eastEdge: 'field',
    roads: [],
    cities: [],
    farms: [
      { directions: ['NNW', 'NNE', 'ENE', 'ESE', 'SSE', 'SSW', 'WSW', 'WNW'], meepleOffset: { x: 3/4, y: 3/4 } }
    ],
    cloister: { meepleOffset: { x: 3/8, y: 5/8 } },
    tower: { offset: { x: 3/4, y: 1/4 } },
    imageURL: '/images/tiles/the-tower/L.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/RCr',
    northEdge: 'city',
    southEdge: 'field',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [{ directions: ['W', 'E'], meepleOffset: { x: 7/8, y: 1/2 } }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW'], meepleOffset: { x: 1/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['ENE'], meepleOffset: { x: 7/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['WSW', 'SSW', 'SSE', 'ESE'], meepleOffset: { x: 1/2, y: 3/4 } }
    ],
    tower: { offset: { x: 1/2, y: 3/4 } },
    imageURL: '/images/tiles/the-tower/RCr.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/RR',
    northEdge: 'field',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'field',
    roads: [
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } },
      { directions: ['W'], meepleOffset: { x: 1/8, y: 1/2 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW', 'NNE', 'ENE', 'ESE', 'SSE'], meepleOffset: { x: 13/16, y: 3/16 } },
      { directions: ['SSW', 'WSW'], meepleOffset: { x: 1/4, y: 3/4 } }
    ],
    tower: { offset: { x: 1/2, y: 1/2 } },
    imageURL: '/images/tiles/the-tower/RR.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/RrC',
    northEdge: 'city',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'field',
    roads: [{ directions: ['W', 'S'], meepleOffset: { x: 1/8, y: 1/2 } }],
    cities: [{ directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } }],
    farms: [
      { directions: ['WNW', 'ENE', 'ESE', 'SSE'], meepleOffset: { x: 1/8, y: 5/16 }, adjacentCityIndices: [0] },
      { directions: ['SSW', 'WSW'], meepleOffset: { x: 3/16, y: 13/16 } }
    ],
    tower: { offset: { x: 3/4, y: 9/16 } },
    imageURL: '/images/tiles/the-tower/RrC.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/RRR',
    northEdge: 'road',
    southEdge: 'field',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['E'], meepleOffset: { x: 7/8, y: 1/2 } },
      { directions: ['N'], meepleOffset: { x: 1/2, y: 1/8 } },
      { directions: ['W'], meepleOffset: { x: 1/8, y: 1/2 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW'], meepleOffset: { x: 3/16, y: 3/16 } },
      { directions: ['NNE', 'ENE'], meepleOffset: { x: 3/4, y: 1/4 } },
      { directions: ['SSW', 'WSW', 'ESE', 'SSE'], meepleOffset: { x: 1/2, y: 7/8 } }
    ],
    tower: { offset: { x: 1/2, y: 1/2 } },
    imageURL: '/images/tiles/the-tower/RRR.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/RRRR.1',
    northEdge: 'road',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['N'], meepleOffset: { x: 9/16, y: 3/16 } },
      { directions: ['E'], meepleOffset: { x: 7/8, y: 9/16 } },
      { directions: ['S'], meepleOffset: { x: 1/2, y: 7/8 } },
      { directions: ['W'], meepleOffset: { x: 1/8, y: 1/2 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW'], meepleOffset: { x: 3/16, y: 3/16 } },
      { directions: ['NNE', 'ENE'], meepleOffset: { x: 13/16, y: 3/16 } },
      { directions: ['ESE', 'SSE'], meepleOffset: { x: 13/16, y: 13/16 } },
      { directions: ['SSW', 'WSW'], meepleOffset: { x: 3/16, y: 13/16 } }
    ],
    tower: { offset: { x: 1/2, y: 1/2 } },
    imageURL: '/images/tiles/the-tower/RRRR.1.png',
    expansion: 'the-tower',
    count: 1
  },
  {
    id: 'the-tower/RrRr.2',
    northEdge: 'road',
    southEdge: 'road',
    westEdge: 'road',
    eastEdge: 'road',
    roads: [
      { directions: ['W', 'N'], meepleOffset: { x: 5/16, y: 5/16 } },
      { directions: ['S', 'E'], meepleOffset: { x: 3/4, y: 3/4 } }
    ],
    cities: [],
    farms: [
      { directions: ['WNW', 'NNW'], meepleOffset: { x: 1/8, y: 1/8 } },
      { directions: ['WSW', 'SSW', 'NNE', 'ENE'], meepleOffset: { x: 1/4, y: 3/4 } },
      { directions: ['ESE', 'SSE'], meepleOffset: { x: 7/8, y: 7/8 } }
    ],
    tower: { offset: { x: 3/4, y: 1/4 } },
    imageURL: '/images/tiles/the-tower/RrRr.2.png',
    expansion: 'the-tower',
    count: 1
  }
];

export const ALL_TILES = [
  ...BASE_GAME_TILES,
  ...INNS_AND_CATHEDRALS_TILES,
  ...TRADERS_AND_BUILDERS_TILES,
  ...THE_TOWER_TILES
];

export const TILE_MAP = Object.fromEntries(
  ALL_TILES.map(tile => [tile.imageURL, tile])
);
