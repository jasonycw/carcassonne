# GOAL
To create the Carcassonne board game to a static GitHub Pages on `https://jasonycw.github.io/carcassonne/` using the `main` branch with simple multiplayer support, without user authentication and server-side hosting fees.

# DEFINITION OF DONE
Before claiming any task done or marking a feature phase complete or anything fixed, you must explicitly pass the following validation matrix:
1. Build and run the application locally. Open the browser developer console and verify there are zero errors or failed network requests during a full game loop.
2. Simulate a full game **from start to finish** to ensure the scoring and tile placement logic is intact.
3. Test the built project assets locally under a simulated nested path structure matching how GitHub Pages serves repositories (e.g., `localhost:8080/carcassonne/`) to catch path resolution errors early before testing on Github Page.
4. Done means **the game MUST has tested in P2P mode from start to finish online after everything are pushed and is built on GitHub Page**. Must make sure `https://jasonycw.github.io/carcassonne/` meets all the requirements and UIUX matching the original game and can completely the whole game with P2P without any issue. Localhost testing or simple unit test or any small scale e2e test are all worthless compare to FULL P2P GAME TESTED ON GITHUB PAGE!

# TECHNICAL CONSTRAINTS
- **Static Hosting Only:** The final build must consist solely of client-side assets (HTML, JS, CSS, images). No Express server, No Node.js runtime environment, No MongoDB/database interactions.
- **Multiplayer Architecture:** Host-authoritative PeerJS WebRTC P2P. The room creator (Host) acts as the central authority executing game logic, validation, and scoring, while broadcasting state updates to up to 5 players. Connection orchestration must handle handshake signaling seamlessly using direct shareable room URLs (e.g., `https://jasonycw.github.io/carcassonne/?room=XXXXXX`)
- **UI & Stack Modernization:** Completely drop Bootstrap 3 and jQuery. Implement layout changes using modern pure CSS features (Custom Properties, Grid, Flexbox) and use vanilla JS for DOM manipulations. Keep and update D3.js (v7 ES Module format) exclusively for board SVG rendering.
- **State Persistence:** Utilize browser `localStorage` to save full game states after every move, providing seamless session recovery if players refresh their tabs.
- **No Assets Breakage:** Relative paths or Vite `base` configuration must be strictly configured so that no absolute links break when hosted under a GitHub Pages subdirectory (e.g., `/carcassonne/`).
** ISSUES.md MUST NOT BE CHANGED BY LLM, ONLY ALLOWED TO BE UPDATED BY HUMAN AFTER VERIFICATION **

# CODING PRINCIPLES
- **Simplicity First:** Write the absolute minimum code necessary to satisfy the migration. Do not introduce speculative helper patterns, multi-layered configs, or unrequested generic wrappers. Keep modules lean.
- **Surgical Changes:** Touch only the modules that dictate authentication, persistence, rendering wrapper extraction, or socket handling. Match existing core logic styles and do not arbitrarily refactor functional game logic, math algorithms, or scoring metrics.
- **Clean Up Orphans:** When backend references, old EJS files, Mongoose schemas, or Passport flows are decoupled, completely remove their respective legacy files and dependencies inside `package.json`. Do not leave broken, unused dead code hanging.

# COMMIT STANDARD
This must be followed everytime, for audit, tracking and prevent huge chunk of undocumented changes
- **Atomic Changes:** One specific structural change or logic file translation per commit. 
- **Iterative & Traceable:** Commits should represent a step-by-step assembly of the phases. NEVER one commit with multiple changes/fixes
- **Clean Commit History:** Document messages explicitly detailing what changed, matching exactly the lines impacted.
- **No artifact left:** All files must either be commited or gitignore artifact folder or removed, must not have any untrack/unstaged file left, testing artifacts must by ignored, all commited file must be absolutely neccessary for the goal.