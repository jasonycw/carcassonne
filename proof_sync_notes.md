Proof synchronization checkpoint (Aug 21, 2026):

The updated test commit 34fab21 was pushed to fix/river-tower-official-rules. The full Playwright proof suite passed: 6 passed in 15.8m, including five complete scenarios plus the Tower floor demo. Audits show natural full-game completion and authentic turn-30 checkpoints:
- Base: 71 turns, midGameCaptured true, no Towers column expected.
- River: riverCompleted true, 83 turns, midGameCaptured true.
- Tower: 89 turns, floorPlaced true, captureCompleted true, ransomCompleted true, towerClosed true, midGameCaptured true.
- River+Tower: riverCompleted true, 101 turns, floorPlaced/capture/ransom/close all true, midGameCaptured true.
- All expansions: riverCompleted true, 143 turns, floorPlaced/capture/ransom/close all true, midGameCaptured true.

The active PR #2 browser page is at #issuecomment-new and the comment draft contains stale markdown. The visible add-files control is present. Keyboard navigation from the focused editor reaches the add-files control after two Tab presses, but activating it has not yet made browser_upload_file locate the hidden file input; upload attempts with file-input indices 0 and 1 failed. No new asset URL has been obtained yet. Do not submit the stale draft.
