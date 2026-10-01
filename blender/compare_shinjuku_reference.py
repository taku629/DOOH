from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageEnhance

root = Path(__file__).resolve().parent.parent
assets = root / "assets" / "blender"
reference = Image.open(assets / "reference" / "shinjuku-reference.png").convert("RGB")
render = Image.open(assets / "shinjuku-strict-preview.png").convert("RGB").resize(reference.size)

overlay = Image.blend(reference, render, .5)
difference = ImageEnhance.Contrast(ImageChops.difference(reference, render)).enhance(1.8)

sheet = Image.new("RGB", (reference.width * 2, reference.height * 2), "white")
sheet.paste(reference, (0, 0))
sheet.paste(render, (reference.width, 0))
sheet.paste(overlay, (0, reference.height))
sheet.paste(difference, (reference.width, reference.height))

draw = ImageDraw.Draw(sheet)
labels = (
    ("REFERENCE", 12, 10),
    ("STRICT RENDER", reference.width + 12, 10),
    ("50% OVERLAY", 12, reference.height + 10),
    ("DIFFERENCE", reference.width + 12, reference.height + 10),
)
for text, x, y in labels:
    draw.rectangle((x - 5, y - 3, x + 130, y + 19), fill=(255, 255, 255))
    draw.text((x, y), text, fill=(12, 15, 16))

sheet.save(assets / "shinjuku-strict-comparison.png")
