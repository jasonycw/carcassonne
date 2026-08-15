from PIL import Image
from pathlib import Path
src = Path('/home/ubuntu/carcassonne/.playwright/river-tower-multiplayer-Ca-467c7-x-E2E-4-The-River-Expansion-chromium/river-completed.png')
out = Path('/home/ubuntu/carcassonne/docs/evidence/river-proof-enlarged.png')
im = Image.open(src).convert('RGB')
# Board region in the 1280x720 capture, excluding HUD and active tile.
crop = im.crop((300, 45, 960, 590))
crop = crop.resize((1320, 1090), Image.Resampling.NEAREST)
crop.save(out, optimize=True)
print(out)
