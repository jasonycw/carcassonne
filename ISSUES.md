Base on testing with latest version on `https://jasonycw.github.io/carcassonne/`, there are at list and not limited to the following issues that cause the game not fully working.
- When there is no meeple left, although the temporary placed tile do not show the outline during meeple placement stage, the outline's location is still clickable causing invalid meeple being placed.
- Joiner now cannot rejoin the game when refresh the page `https://jasonycw.github.io/carcassonne/?room=XXXX#/game`. Both host and joiner rejoin should work when they just refresh `https://jasonycw.github.io/carcassonne/?room=XXXX#/game`.
- When the p2p online game go for while, after the host made a move, the game state are no longer sync to the joiner. This is due to the JSON message being too big for PeerJS

* THIS FILE MUST NOT BE CHANGED BY LLM, ONLY ALLOWED TO BE UPDATED BY HUMAN AFTER VERIFICATION *