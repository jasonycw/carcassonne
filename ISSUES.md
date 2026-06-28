Base on testing with latest version on `https://jasonycw.github.io/carcassonne/`, there are at list and not limited to the following issues that cause the game not fully working.
- Joiner now cannot rejoin the game when refresh the page `https://jasonycw.github.io/carcassonne/?room=XXXX#/game`. Both host and joiner rejoin should work.
- When the p2p online game go for while, after the host made a move, the game state are no longer sync to the joiner. My last test was bug out when tiles 72/113

* THIS FILE MUST NOT BE CHANGED BY LLM, ONLY ALLOWED TO BE UPDATED BY HUMAN AFTER VERIFICATION *