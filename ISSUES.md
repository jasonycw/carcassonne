Base on testing with latest version on `https://jasonycw.github.io/carcassonne/`, there are at least and not limited to the following issues.
- In the lobby page, the host should stop new player from connecting if it reaches max connection per the game setting. Joiner should get a message of the room is full when trying to connect to a full lobby.
- In the lobby page, the joiner sometime do not see other joiners' name or name change properly.
- In the lobby page, the host should see when the joiner is still connecting or not, so idle connection will not eat up valuable seat. So until the game start, the host should drop in and out of any joiners freely.
- Once the game is start, other than the existing joiners who refresh the page and reconnect, no new connection should be allowed. Non ingame joiners should get a message the game has started when trying to connect.
- Joiner now failed to rejoin the game when refresh the page `https://jasonycw.github.io/carcassonne/?room=XXXX#/game`. Both host and joiner rejoin should work when they just refresh `https://jasonycw.github.io/carcassonne/?room=XXXX#/game`.
- In game chatroom, there are duplicated of sender's last message from sender side.
- In game chatroom, the sender's message in the receiver end are removed somehow.

* THIS FILE MUST NOT BE CHANGED BY LLM, ONLY ALLOWED TO BE UPDATED BY HUMAN AFTER VERIFICATION *