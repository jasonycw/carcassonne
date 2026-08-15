from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

root = Path('/home/ubuntu/carcassonne/docs/evidence/fresh')
files = [
    'base-start.png', 'base-midgame.png',
    'ic-start.png', 'ic-midgame.png',
    'tb-start.png', 'tb-midgame.png',
    'river-start.png', 'river-completed.png',
    'tower-start.png', 'tower-action.png', 'tower-midgame.png',
    'all-dlc-start.png', 'all-dlc-action.png', 'all-dlc-midgame.png',
]
thumb_w, thumb_h = 320, 180
label_h = 28
cols = 2
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * thumb_w, rows * (thumb_h + label_h)), '#202124')
draw = ImageDraw.Draw(sheet)
for i, name in enumerate(files):
    path = root / name
    image = Image.open(path).convert('RGB')
    image.thumbnail((thumb_w, thumb_h))
    canvas = Image.new('RGB', (thumb_w, thumb_h), '#000000')
    x = (thumb_w - image.width) // 2
    y = (thumb_h - image.height) // 2
    canvas.paste(image, (x, y))
    col = i % cols
    row = i // cols
    ox = col * thumb_w
    oy = row * (thumb_h + label_h)
    sheet.paste(canvas, (ox, oy))
    draw.rectangle((ox, oy + thumb_h, ox + thumb_w, oy + thumb_h + label_h), fill='#202124')
    draw.text((ox + 8, oy + thumb_h + 7), name, fill='white')
sheet.save(root / 'fresh-contact-sheet.png', optimize=True)
print(root / 'fresh-contact-sheet.png')
print(f'{len(files)} screenshots included')
# end
