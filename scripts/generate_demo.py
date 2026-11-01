"""Reproducible, explicitly synthetic video fixtures; no outside media or tree-risk labels."""
from pathlib import Path
import json
import math
import random
import subprocess
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "demo"
W, H, FPS, SECONDS = 640, 400, 12, 18


def scene():
    im = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line((0, y, W, y), fill=(int(201 + 24*t), int(218 + 10*t), int(207 - 4*t)))
    d.ellipse((450, 35, 510, 95), fill=(235, 234, 199))
    d.polygon([(0, 270), (90, 206), (170, 255), (260, 224), (380, 270), (480, 215), (640, 265), (640, 400), (0, 400)], fill=(159, 180, 156))
    d.polygon([(0, 290), (120, 265), (250, 290), (410, 260), (640, 280), (640, 400), (0, 400)], fill=(117, 149, 115))
    d.polygon([(0, 330), (180, 302), (400, 318), (640, 300), (640, 400), (0, 400)], fill=(101, 137, 94))
    d.polygon([(400, 400), (470, 330), (500, 285), (519, 285), (500, 340), (458, 400)], fill=(196, 187, 155))
    rng = random.Random(81)
    for _ in range(1800):
        x, y = rng.randrange(W), rng.randrange(295, H)
        d.line((x, y, x + 1, y - rng.randint(1, 5)), fill=rng.choice([(111, 145, 95), (128, 156, 107), (88, 125, 83)]))
    # A textured fixed marker provides an honest stationary camera reference.
    d.rectangle((515, 192, 580, 300), fill=(103, 112, 99))
    d.polygon([(510, 192), (548, 171), (586, 192)], fill=(83, 98, 87))
    for y in range(198, 294, 12):
        for x in range(519, 577, 12):
            d.rectangle((x, y, x + 8, y + 8), fill=(160 + (x+y) % 27, 167, 145))
    d.rectangle((535, 220, 560, 244), fill=(53, 76, 61))
    d.line((540, 225, 555, 239), fill=(204, 206, 166), width=2)
    return im


def make_tree(kind):
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    rng = random.Random(13 if kind != "pine" else 42)
    d.ellipse((242, 346, 400, 366), fill=(34, 62, 39, 55))
    d.polygon([(307, 355), (313, 211), (300, 158), (313, 164), (325, 226), (331, 355)], fill=(76, 72, 47))
    d.line((319, 344, 321, 218, 314, 168, 326, 100), fill=(119, 107, 72), width=4)
    d.line((319, 232, 280, 170, 245, 143), fill=(85, 78, 49), width=8)
    d.line((319, 218, 366, 159, 399, 125), fill=(85, 78, 49), width=7)
    if kind == "pine":
        for y, half in [(65, 29), (95, 45), (125, 63), (155, 76), (185, 87), (214, 98)]:
            d.polygon([(320, y-37), (320-half, y+40), (320+half, y+40)], fill=(34+y//18, 76+y//10, 58+y//20))
        for _ in range(1200):
            y = rng.randint(40, 250); x = rng.randint(220, 420)
            if abs(x-320) < (y-25)*.46:
                d.line((x, y, x+5, y-2), fill=rng.choice([(72, 117, 73), (44, 88, 60), (113, 137, 79)]), width=2)
    else:
        clusters = [(257, 150, 51), (300, 112, 57), (350, 113, 58), (389, 151, 51), (340, 176, 69), (282, 190, 48)]
        for cx, cy, radius in clusters:
            for _ in range(270):
                angle, radius2 = rng.random()*math.tau, math.sqrt(rng.random())*radius
                x, y = cx+math.cos(angle)*radius2, cy+math.sin(angle)*radius2*.75
                r = rng.randint(3, 10)
                color = rng.choice([(49, 83, 48), (65, 101, 51), (80, 112, 54), (103, 127, 64), (126, 142, 72), (151, 152, 81)])
                d.ellipse((x-r, y-r, x+r, y+r), fill=color)
        # Stable branch landmarks under the leaf layer support sparse tracking.
        for x, y in [(310, 151), (332, 170), (281, 167), (363, 153)]:
            d.line((x-7, y+12, x, y, x+6, y+5), fill=(66, 64, 38), width=3)
    return im


def render(kind, hz, amplitude, shake=False):
    background, tree = scene(), make_tree(kind)
    process = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", f"{W}x{H}", "-framerate", str(FPS), "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-movflags", "+faststart", str(OUT / f"{kind}.mp4")], stdin=subprocess.PIPE)
    for i in range(FPS*SECONDS):
        t = i/FPS
        displacement = amplitude*math.sin(math.tau*hz*t)
        shifted_tree = Image.new("RGBA", (W, H))
        for y in range(H):
            shift = round(displacement*max(0, min(1, (355-y)/160)))
            shifted_tree.paste(tree.crop((0, y, W, y+1)), (shift, y))
        frame = background.copy().convert("RGBA")
        frame.alpha_composite(shifted_tree)
        camera_x = round((13 if shake else 1)*math.sin(math.tau*.22*t))
        camera_y = round((8 if shake else 0)*math.sin(math.tau*.19*t))
        moved = Image.new("RGBA", (W, H), (201, 218, 207, 255))
        moved.paste(frame, (camera_x, camera_y))
        if i == 0:
            moved.convert("RGB").save(OUT / f"{kind}.jpg", quality=92)
        process.stdin.write(moved.convert("RGB").tobytes())
    process.stdin.close()
    if process.wait() != 0:
        raise RuntimeError("ffmpeg failed")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for kind, hz, amplitude, shake in [("oak", .35, 9, False), ("pine", .75, 6, False), ("shake", .35, 9, True)]:
        render(kind, hz, amplitude, shake)
        print(f"Generated {kind}: {hz} Hz, synthetic")
    (OUT / "ground-truth.json").write_text(json.dumps({"synthetic": True, "fps": FPS, "duration_seconds": SECONDS, "resolution": [W, H], "oak": {"imposed_frequency_hz": .35, "crown_amplitude_px": 9}, "pine": {"imposed_frequency_hz": .75, "crown_amplitude_px": 6}, "shake": {"imposed_frequency_hz": .35, "camera_amplitude_px": [13, 8]}, "note": "Procedural fixtures, not real tree data. Displacement metrics are at analysis resolution; frequency is an imposed response, not validated natural frequency."}, indent=2))
