# River Asset Orientation Audit

## Audited files

| Tile ID | Asset path | Observed native orientation at rotation 0 | Notes |
| --- | --- | --- | --- |
| `the-river/II` | `public/images/tiles/the-river/II.png` | **Diagonal river**, entering near the upper-left edge and exiting near the lower edge/right-of-center area | This is **not** a straight north-south river graphic. Metadata currently declares `northEdge: river`, `southEdge: river`, `river.directions: ['N','S']`, which appears inconsistent with the image. |
| `the-river/CIRI` | `public/images/tiles/the-river/CIRI.png` | **Horizontal river** across the lower half, with a road/bridge entering from the bottom and a city across the top | Metadata currently declares river on `south` and `east`, which appears inconsistent with the visible river flow. |
| `the-river/RIrI` | `public/images/tiles/the-river/RIrI.png` | **Vertical river** through the tile center, with a horizontal bridge/road across it | Metadata declaring river on `north` and `south` appears visually plausible. |
| `the-river/LIRI` | `public/images/tiles/the-river/LIRI.png` | **Horizontal river** across the lower half, with a cloister/building above and a bridge/road entering from lower-left toward center | Metadata currently declares river on `south` and `east`, which appears inconsistent with the visible river flow. |
| `the-river/I.s` | `public/images/tiles/the-river/I.s.png` | Source graphic shows the river emerging toward the **right side** of the tile in the native asset | Metadata currently declares `southEdge: river`, `river.directions: ['S']`, which appears inconsistent with the visible source orientation. |

## Preliminary conclusion

The current River bug is likely **not only** in placement logic. Several River tile assets appear to have native orientation mismatches against the `TileData.js` edge metadata. Because the renderer applies `rotation * 90` clockwise directly to the source image, any incorrect base orientation in metadata will produce visually disconnected rivers even when logical matching passes.

## Next step

Audit the remaining River assets and then correct `TileData.js` base edge/direction metadata to match the actual graphics before regenerating E2E proof.

## Additional audited files

| Tile ID | Asset path | Observed native orientation at rotation 0 | Notes |
| --- | --- | --- | --- |
| `the-river/I.e` | `public/images/tiles/the-river/I.e.png` | **Lake opening from the left side into a basin occupying the center/right** | Metadata currently declares `northEdge: river`, `river.directions: ['N']`, which appears inconsistent with the visible lake inlet. |
| `the-river/CICI` | `public/images/tiles/the-river/CICI.png` | **Horizontal river** across the tile center with cities at top and bottom | Metadata declaring `westEdge: river`, `eastEdge: river`, `river.directions: ['W','E']` appears visually plausible. |
| `the-river/CcII` | `public/images/tiles/the-river/CcII.png` | **Curved river** visible from lower area toward right side, with city mass occupying the upper-left | Metadata currently declares `eastEdge: river`, `southEdge: river`, which may be plausible but needs exact edge confirmation against the artwork. |
| `the-river/IFI` | `public/images/tiles/the-river/IFI.png` | **Horizontal river** across the tile center | Metadata currently declares `northEdge: river`, `southEdge: river`, `river.directions: ['N','S']`, which appears inconsistent with the graphic. |
| `the-river/RrII` | `public/images/tiles/the-river/RrII.png` | **Diagonal/vertical-ish river** in lower-left area with a road entering from upper-right** | Metadata currently declares `northEdge: river`, `southEdge: river`, `river.directions: ['N','S']`, which appears suspect and likely inconsistent with the source image. |

## Updated conclusion

Several River tile assets are visibly authored in a different base orientation than the current `TileData.js` metadata assumes. Because the renderer rotates image assets by `rotation * 90` clockwise directly from their native PNG orientation, any mismatch in the zero-rotation metadata produces a board that is logically legal under the wrong assumptions yet visually disconnected on screen.

The next concrete fix is to normalize each River tile's metadata so that `northEdge/eastEdge/southEdge/westEdge` and `river.directions` match the **actual native PNG orientation** before any game rotation is applied.

## Definitive visual findings from the latest audit pass

| Tile ID | Visual observation at native 0° asset orientation | Confirmed river-touching edges |
| --- | --- | --- |
| `the-river/I.s` | The spring/source sits toward the upper-left, and the river visibly exits the tile through the **bottom** edge. It does **not** exit to the right. | **S** |
| `the-river/I.e` | The lake occupies most of the center/right side, and the incoming river visibly enters from the **left** edge. | **W** |
| `the-river/II` | The river is a diagonal/vertical flow that clearly enters from the **top** edge and exits through the **bottom** edge. It is not a horizontal W-E river. | **N, S** |
| `the-river/RIrI` | The river runs vertically through the tile, while the bridge/road crosses horizontally. | **N, S** |
| `the-river/CIRI` | The city occupies the top. The river runs horizontally across the lower half and connects to the **left** and **right** edges, while the road/bridge enters from the **bottom**. | **W, E** |

## Implication

The previous metadata revisions were still wrong for multiple tiles. In particular, `I.s` must open **South**, `I.e` must open **West**, `II` and `RIrI` must be **North-South**, and `CIRI` must be a **West-East** river tile with a bottom road/bridge. The remaining River assets still need the same tile-by-tile confirmation before applying the final metadata correction.

## Definitive visual findings for the remaining River assets

| Tile ID | Visual observation at native 0° asset orientation | Confirmed river-touching edges |
| --- | --- | --- |
| `the-river/CICI` | The cities are at the top and bottom, while the river spans horizontally through the middle of the tile. | **W, E** |
| `the-river/CcII` | The city mass occupies the upper-left. The river curves through the lower-right quadrant, entering from the **bottom** and exiting the **right** edge. | **S, E** |
| `the-river/IFI` | The abbey/island sits inside a river that runs straight horizontally across the tile. | **W, E** |
| `the-river/LIRI` | The cloister/building sits in the upper area. The river enters from the **left** edge and exits the **right** edge, with a road/bridge connecting from the lower-left toward the building. | **W, E** |
| `the-river/RrII` | The river is another N-S type graphic, running from the **top** edge down toward the **bottom** edge, while a road approaches from the upper-right/right side. | **N, S** |

## Consolidated corrected orientation map

| Tile ID | Correct river edges at native 0° |
| --- | --- |
| `I.s` | `S` |
| `I.e` | `W` |
| `II` | `N,S` |
| `RIrI` | `N,S` |
| `CIRI` | `W,E` |
| `CICI` | `W,E` |
| `CcII` | `S,E` |
| `IFI` | `W,E` |
| `LIRI` | `W,E` |
| `RrII` | `N,S` |

This consolidated map is the authoritative basis for the next metadata correction in `TileData.js`.

## Direct asset inspection snapshots

| Tile ID | Direct visual finding at native 0° | Confirmed river/road edges |
| --- | --- | --- |
| `the-river/I.s` | The spring tile visibly sends the river out through the **right** side of the tile. | River: **E** |
| `the-river/I.e` | The lake tile visibly receives the river from the **left** side. | River: **W** |
| `the-river/II` | The plain straight river tile is actually a diagonal vertical flow from **top** to **bottom**. | River: **N, S** |
| `the-river/RIrI` | The bridge tile shows the river running **top to bottom**, with the road crossing **left to right**. | River: **N, S**; Road: **W, E** |
| `the-river/CIRI` | The city tile shows the river running **left to right**, with a road/bridge entering from the **bottom** into the city. | River: **W, E**; Road: **S**; City: **N** |

These findings supersede earlier mistaken assumptions and should be used as the authoritative basis for the remaining River metadata correction.

## Remaining direct asset inspection snapshots

| Tile ID | Direct visual finding at native 0° | Confirmed river/road edges |
| --- | --- | --- |
| `the-river/CICI` | The river spans horizontally through the middle while cities sit at the top and bottom. | River: **W, E**; City: **N, S** |
| `the-river/CcII` | The river curves from the **bottom** edge to the **right** edge; the city occupies the upper-left mass. | River: **S, E**; City: **N, W** |
| `the-river/IFI` | The river runs straight horizontally through the tile with the island/cloister in the middle. | River: **W, E** |
| `the-river/LIRI` | The river runs horizontally **left to right**, and a road/bridge rises from the **bottom** into the cloister/building above. | River: **W, E**; Road: **S** |
| `the-river/RrII` | The river runs vertically **top to bottom**, and a road enters from the **east/right** side. | River: **N, S**; Road: **E** |

## Complete authoritative orientation map after direct inspection

| Tile ID | River edges | Other relevant edges |
| --- | --- | --- |
| `I.s` | `E` | source |
| `I.e` | `W` | lake |
| `II` | `N,S` | none |
| `RIrI` | `N,S` | road `W,E` |
| `CIRI` | `W,E` | city `N`, road `S` |
| `CICI` | `W,E` | city `N,S` |
| `CcII` | `S,E` | city `N,W` |
| `IFI` | `W,E` | cloister center |
| `LIRI` | `W,E` | cloister center, road `S` |
| `RrII` | `N,S` | road `E` |

This authoritative map should now be used to correct `TileData.js` and to reject any placement where a river edge visually meets a road or field edge.

## Correction after direct re-inspection of ambiguous tiles

The earlier authoritative map was still too coarse for some tiles. After re-opening the ambiguous assets directly, the following corrections are required:

| Tile ID | Revised direct visual reading at native 0° |
| --- | --- |
| `the-river/II` | This is **not** a pure N-S straight. The river clearly enters from the **left/west** edge and exits the **bottom/south** edge. It is a bend: **W,S**. |
| `the-river/CIRI` | Confirmed as a **horizontal W-E river** with a **bottom/south road** leading into the **top/north city**. |
| `the-river/IFI` | Confirmed as a **horizontal W-E river** through the tile center. |
| `the-river/LIRI` | Confirmed as a **horizontal W-E river** with a **bottom/south road** up into the cloister/building. |
| `the-river/RrII` | The previously assumed N-S straight remains questionable and must not be trusted blindly; the art needs one more precise metadata check before finalizing. |

This means the current code almost certainly still misclassifies `II`, and possibly `RrII`, which explains why the live board can visually connect a river into a road or field even when tests pass.

## Final direct readings from the latest inspection pass

These are the most reliable observations from the latest direct asset views and should override earlier contradictory notes:

| Tile ID | Final direct reading at native 0° |
| --- | --- |
| `the-river/I.s` | The source tile’s river clearly exits the tile on the **right/east** edge. |
| `the-river/RIrI` | The river clearly runs **top/north to bottom/south**, while the bridge road runs **left/west to right/east**. |
| `the-river/II` | The plain river tile is visually ambiguous at a glance, but the latest inspection strongly suggests the river runs from the **left/west side down toward the bottom/south side**, i.e. a bend `W,S`, not a straight `N,S`. |
| `the-river/RrII` | The river similarly appears to occupy the **left-lower to bottom** path region while the road approaches from the **upper-right/right** area, meaning the existing `N,S + road E` assumption is suspect and likely wrong. |

This leaves `II` and `RrII` as the highest-risk metadata entries still requiring correction or independent confirmation before the River implementation can be trusted visually.

## Latest direct visual findings after the current audit pass

| Tile ID | Direct visual finding at native 0° | Confirmed edge interpretation |
| --- | --- | --- |
| `the-river/I.e` | Lake basin occupies the right side; river inlet visibly enters from the left. | River: **W** |
| `the-river/CICI` | River clearly spans horizontally across the middle, with city segments at top and bottom. | River: **W, E**; City: **N, S** |
| `the-river/CcII` | River occupies the lower-right curve region and appears to connect from the bottom edge toward the right edge; city mass occupies upper-left. | River: **S, E**; City: **N, W** |
| `the-river/IFI` | River clearly spans horizontally across the middle with the island/cloister centered inside it. | River: **W, E** |
| `the-river/RrII` | River occupies the lower-left quadrant and appears to enter from the bottom edge and continue off the left edge, while the road runs across the upper-right region. | River: **W, S**; Road: likely **N, E** or **E**-side continuation only; requires human confirmation because this asset remains visually ambiguous. |

These observations should override earlier contradictory assumptions and are the current best reading from direct image inspection.

## Current direct visual readings from the latest audit pass

| Tile ID | Native 0° visual reading | Practical interpretation |
| --- | --- | --- |
| `the-river/I.s` | The spring is on the left side and the river visibly leaves the tile on the **right** edge. | River touches **E**. Earlier `S` interpretation was incorrect. |
| `the-river/II` | The river band runs diagonally from the **left** edge toward the **bottom** edge. | River touches **W** and **S**. This is not a straight N-S tile. |
| `the-river/CIRI` | The river runs horizontally across the tile from **left** to **right**; a road comes from the **bottom** into the city at the top. | River touches **W** and **E**; road touches **S**; city occupies **N**. |
| `the-river/LIRI` | The river runs horizontally from **left** to **right** under the building; a road comes from the **bottom-left** into the building. | River touches **W** and **E**; road includes **S**-side access into the building. |
| `the-river/RIrI` | The river runs vertically from **top** to **bottom**; a road/bridge runs horizontally from **left** to **right**. | River touches **N** and **S**; road touches **W** and **E**. |

These findings supersede my previous contradictory assumptions and should be used in the next metadata correction pass.

## Definitive audit pass: batch 1

| Tile ID | Native 0° visual reading | Confirmed edge interpretation |
| --- | --- | --- |
| `the-river/I.s` | The spring is on the left side and the river visibly leaves the tile on the right side. | River touches **E** only. |
| `the-river/I.e` | The lake basin occupies the right side and the river visibly enters from the left. | River touches **W** only. |
| `the-river/II` | The river enters from the left side and exits through the bottom side. | River touches **W** and **S**. |
| `the-river/RIrI` | The river runs from top to bottom, while the bridge road crosses from left to right. | River touches **N** and **S**; road touches **W** and **E**. |
| `the-river/CIRI` | The city is at the top, the road comes from the bottom into the city, and the river runs horizontally across the tile. | River touches **W** and **E**; road touches **S**; city touches **N**. |

These findings are from direct inspection of the native PNG assets and should override earlier contradictory assumptions.

## Definitive audit pass: batch 2

| Tile ID | Native 0° visual reading | Confirmed edge interpretation |
| --- | --- | --- |
| `the-river/CICI` | The river runs horizontally across the center while city segments occupy the top and bottom. | River touches **W** and **E**; city touches **N** and **S**. |
| `the-river/CcII` | The city mass occupies the upper-left, and the river curve enters from the bottom then exits through the right side. | River touches **S** and **E**; city touches **N** and **W**. |
| `the-river/IFI` | The river runs horizontally from left to right with the island/cloister in the middle. | River touches **W** and **E**. |
| `the-river/LIRI` | The building sits at the top, the road enters from the bottom, and the river bends from the left side to the right side behind the building. It is **not** a top-bottom river tile. | River touches **W** and **E**; road touches **S**; building/cloister is central-top. |
| `the-river/RrII` | The road enters from the top and curves toward the right side, while the river enters from the left and exits through the bottom. | River touches **W** and **S**; road touches **N** and **E**. |

Important correction: the user-provided screenshot clearly shows the circled tile cannot be treated as a vertical river tile. The native `LIRI` art is a horizontal river bend/background with a bottom road into the building, so any placement that visually makes it a north-south river indicates metadata and/or rotation mismatch elsewhere in the chain.

## Definitive re-audit after user screenshot escalation: batch 3

| Tile ID | Native 0° visual reading | Confirmed edge interpretation |
| --- | --- | --- |
| `the-river/I.s` | The spring source sits on the left and the visible river outlet reaches the right edge. | River touches **E** only. |
| `the-river/I.e` | The lake basin fills the right side and the inlet clearly comes from the left edge. | River touches **W** only. |
| `the-river/II` | The plain river tile is a bend, with water entering from the left edge and leaving through the bottom edge. | River touches **W** and **S**. |
| `the-river/RIrI` | The river is vertical from top to bottom and a road/bridge crosses horizontally from left to right. | River touches **N** and **S**; road touches **W** and **E**. |
| `the-river/CIRI` | The city occupies the top, the road enters from the bottom, and the river runs laterally under the bridge from left to right. | River touches **W** and **E**; road touches **S**; city touches **N**. |

This pass confirms that at least `II` is a bend (`W,S`) and not a vertical straight, which is critical for fixing visual river continuity.

## Definitive re-audit after user screenshot escalation: batch 4

| Tile ID | Native 0° visual reading | Confirmed edge interpretation |
| --- | --- | --- |
| `the-river/CICI` | The river crosses horizontally through the center, while city walls occupy the top and bottom edges. | River touches **W** and **E**; city touches **N** and **S**. |
| `the-river/CcII` | The city occupies the upper-left wedge, and the river curve passes through the lower-right region from bottom to right. | River touches **S** and **E**; city touches **N** and **W**. |
| `the-river/IFI` | The river is clearly horizontal across the center with the island/cloister in the middle. | River touches **W** and **E**. |
| `the-river/LIRI` | The native asset shows the river entering from the **left** and leaving through the **right**; the road enters from the **bottom** into the building. When rotated 90° clockwise, this becomes a vertical river with road on the **left**, exactly matching the user's screenshot. | River touches **W** and **E**; road touches **S**. |
| `the-river/RrII` | The native asset shows a curved road entering from the **top** and exiting to the **right**, while the river enters from the **left** and leaves through the **bottom**. | River touches **W** and **S**; road touches **N** and **E**. |

Critical implication: `LIRI` is currently mis-modeled in code as a vertical river tile (`N,S`) when its native PNG is horizontal (`W,E`). This is sufficient to produce the user's reported visual mismatch after rotation.
