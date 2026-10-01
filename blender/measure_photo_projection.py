from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageStat

root = Path(__file__).resolve().parent.parent
assets = root / "assets" / "blender"
reference_path = assets / "reference" / "shinjuku-reference.png"
render_path = assets / "shinjuku-photo-projection-exact.png"
comparison_path = assets / "shinjuku-photo-projection-comparison.png"
metrics_path = assets / "shinjuku-photo-projection-metrics.txt"

reference = Image.open(reference_path).convert("RGB")
render = Image.open(render_path).convert("RGB").resize(reference.size)
difference = ImageChops.difference(reference, render)
stats = ImageStat.Stat(difference)
mae_channels = stats.mean
mae = sum(mae_channels) / len(mae_channels)
extrema = difference.getextrema()
maximum_error = max(channel[1] for channel in extrema)

boosted_difference = ImageEnhance.Contrast(difference).enhance(4)
overlay = Image.blend(reference, render, .5)
sheet = Image.new("RGB", (reference.width * 2, reference.height * 2), "white")
sheet.paste(reference, (0, 0))
sheet.paste(render, (reference.width, 0))
sheet.paste(overlay, (0, reference.height))
sheet.paste(boosted_difference, (reference.width, reference.height))

draw = ImageDraw.Draw(sheet)
labels = (
    ("REFERENCE", 12, 10),
    ("BLENDER PROJECTION", reference.width + 12, 10),
    ("50% OVERLAY", 12, reference.height + 10),
    (f"DIFF x4 | MAE {mae:.4f}", reference.width + 12, reference.height + 10),
)
for text, x, y in labels:
    draw.rectangle((x - 5, y - 3, x + 220, y + 20), fill=(255, 255, 255))
    draw.text((x, y), text, fill=(12, 15, 16))

sheet.save(comparison_path)
metrics_path.write_text(
    "\n".join(
        (
            f"reference={reference_path.name}",
            f"render={render_path.name}",
            f"size={reference.width}x{reference.height}",
            f"mae_rgb={mae:.8f}",
            f"mae_channels={','.join(f'{value:.8f}' for value in mae_channels)}",
            f"maximum_channel_error={maximum_error}",
        )
    )
    + "\n",
    encoding="utf-8",
)
print(metrics_path.read_text(encoding="utf-8"))
