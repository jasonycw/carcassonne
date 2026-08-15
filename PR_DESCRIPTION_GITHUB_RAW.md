This Pull Request implements **The River** and **The Tower** extensions for Carcassonne, with official-rule placement and scoring behavior, multiplayer compatibility, and fresh visual proof.

### 1. The River Extension
- **Twelve-Tile Stack:** Corrected to use the full twelve-tile River stack (Source, Lake, and 10 internal tiles).
- **Official Downstream Flow:** Strictly prohibits two consecutive bends in the same direction (immediate U-turns) and ensures the river never circles back on itself.

### 2. The Tower Extension
- **Official Gameplay Loop:** Implemented the 4-action choice after tile placement (Place Meeple, Place Tower Floor, Close Tower, or Skip).
- **Vertical Stacking Fix:** Tower floors now stack correctly upwards on the screen regardless of tile rotation.
- **Multiplayer Ransom:** Integrated prisoner buy-back (3 points) directly into the scoreboard UI with full network synchronization.

### 3. Visual Proof Matrix (Fresh HD Matrix)

| Scenario | Fresh Board Screenshot | HD Multiplayer Video Proof |
| --- | --- | --- |
| **Base Game Only** | ![base](https://github.com/user-attachments/assets/e5188914-381c-482d-a9d9-6853f847c40d) | [Watch Video](https://github.com/user-attachments/assets/6f76b429-ca35-4748-a484-ca44ef30d9e0) |
| **Inns & Cathedrals** | ![ic](https://github.com/user-attachments/assets/a1cc5fd5-19ea-436a-8240-33e2af049672) | [Watch Video](https://github.com/user-attachments/assets/e45abf09-7dec-4611-a2a7-fd68f9dcf5d9) |
| **Traders & Builders** | ![tb](https://github.com/user-attachments/assets/071c5777-41c9-4074-a922-13c940cbcaea) | [Watch Video](https://github.com/user-attachments/assets/acee6bf1-8135-45a7-994b-5a1f22d4f392) |
| **The River** | ![river](https://github.com/user-attachments/assets/113a566f-2b94-497c-b783-0f8e359d065f) | [Watch Video](https://github.com/user-attachments/assets/15491ca5-ef46-46ef-89bc-ca5dd5de634e) |
| **The Tower** | ![tower](https://github.com/user-attachments/assets/e590fad5-c437-4274-a33c-a43bdf18a8a1) | [Watch Video](https://github.com/user-attachments/assets/625760e1-7a92-4905-aaf2-3d1b1b6f6f7b) |
| **All DLC Combined** | ![all](https://github.com/user-attachments/assets/4e7deb3c-be9f-4212-9122-dfdf519fd4df) | [Watch Video](https://github.com/user-attachments/assets/6823b600-a9fc-4f34-82ce-13f2e1f6a819) |

---

### 4. Playable Inline Videos
GitHub will render the following raw URLs as native inline players:

**Base Game:**

https://github.com/user-attachments/assets/6f76b429-ca35-4748-a484-ca44ef30d9e0

**Inns & Cathedrals:**

https://github.com/user-attachments/assets/e45abf09-7dec-4611-a2a7-fd68f9dcf5d9

**Traders & Builders:**

https://github.com/user-attachments/assets/acee6bf1-8135-45a7-994b-5a1f22d4f392

**The River:**

https://github.com/user-attachments/assets/15491ca5-ef46-46ef-89bc-ca5dd5de634e

**The Tower:**

https://github.com/user-attachments/assets/625760e1-7a92-4905-aaf2-3d1b1b6f6f7b

**All DLC Combined:**

https://github.com/user-attachments/assets/6823b600-a9fc-4f34-82ce-13f2e1f6a819
