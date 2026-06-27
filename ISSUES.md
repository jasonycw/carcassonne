Base on testing with latest version on `https://jasonycw.github.io/carcassonne/`, there are at list and not limited to the following issues that cause the game not fully working.
- When placing a temorary tile, instead of rotate and slide to there, it's now snap into a difference orientation and slide there. It should rotate and slide, never change the tile orientation without rotate animation.
- The README has a useless screenshots "Rotation indicator", I don't know why it needs to be here, the rotation indicator must be in part of the mid-game screenshot
- The "Game Over" screenshot still showing `-` for Cloisters, the screenshot must show all features scoring calculated correctly
- For host of the game, when refresh the page, should go back to the original, right now it's connection lost and become it's own offline game and the joiner cannot continue the game properly. It should be able to join back in to the same game
- The joiner do not see the host is offline properly. It should know when the host is offline and when it join back in.

* THIS FILE MUST NOT BE CHANGED BY LLM, ONLY ALLOWED TO BE UPDATED BY HUMAN AFTER VERIFICATION *