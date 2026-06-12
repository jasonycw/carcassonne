# GOAL
To recreate the Carcassonne board game in GitHub Page with simple multiplayer support.

# BACKGROUND
Before migration at commit `962f33eed833cb2cb845e40bb5d7186e66dc6d2d`, the game was designed to need login to play. This cause extra hosting fee and security concern.
So you decide to migrate the game to a GitHub Page standalone game so anyone can just open the page and start playing.

# TASKS
- The gameplay UX must be 1 to 1 identical to before migration `962f33eed833cb2cb845e40bb5d7186e66dc6d2d`, no exception
- Follow the initial plan from `/.antigravitycli/implementation_plan.md`, use judgement
- The game must be able to play from beginning to end without any issue
- All extensions must be fully working, with any combination
- No deadlink, dead image or error after it's built on GitHub Page, no exception
- Multiplayer must be working
- README must has the latest screenshot of the game, showing the beginning, middle of the game, end of the game
- When verify, everything must be check locally first and then also check after GitHub Page is built

# COMMIT STANDARD
- One chnage per commit, must document change clearly
- Atomic
- Iterative