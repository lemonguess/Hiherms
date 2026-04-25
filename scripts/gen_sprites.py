#!/usr/bin/env python3
"""Generate chibi 2B pixel-art sprites for Hihermes desktop pet"""
from PIL import Image, ImageDraw
import os

assets_dir = "/root/workspace/himers/assets"
os.makedirs(assets_dir, exist_ok=True)

S = 128  # canvas size

COLORS = {
    "hair":       (220, 220, 230, 255),
    "hair_dark":  (180, 180, 195, 255),
    "visor":      (20, 20, 25, 255),
    "visor_band": (40, 40, 45, 255),
    "skin":       (255, 235, 220, 255),
    "skin_shadow":(235, 210, 195, 255),
    "dress":      (25, 25, 30, 255),
    "dress_light":(50, 50, 55, 255),
    "white":      (240, 240, 245, 255),
    "white_s":    (200, 200, 210, 255),
    "eye_glow":   (180, 210, 255, 255),
    "cheek":      (255, 200, 200, 180),
    "mouth":      (180, 140, 140, 255),
    "mouth_inner":(200, 80, 80, 255),
    "gold":       (200, 180, 140, 255),
    "dress_skirt":(35, 30, 40, 255),
    "boot":       (20, 20, 25, 255),
    "leg":        (30, 28, 35, 255),
}

def draw_2b(draw, state, offset_y=0):
    """Draw chibi 2B at center of 128x128 canvas"""
    oy = offset_y
    cx, cy = 64, 46 + oy
    head_r = 26

    # --- Back hair (long) ---
    draw.ellipse([cx-22, cy-30, cx+22, cy+4], fill=COLORS["hair"])

    # --- Hair top volume ---
    draw.ellipse([cx-20, cy-32, cx+20, cy-10], fill=COLORS["hair"])

    # --- Face ---
    draw.ellipse([cx-17, cy-18, cx+17, cy+12], fill=COLORS["skin"])

    # --- Hair bangs ---
    draw.ellipse([cx-20, cy-22, cx+20, cy-8], fill=COLORS["hair"])
    # Part line
    draw.arc([cx-16, cy-22, cx+16, cy-8], 200, 340, fill=COLORS["hair_dark"], width=2)

    # --- Blindfold/Visor ---
    vy = cy - 5
    draw.rectangle([cx-19, vy-4, cx+19, vy+5], fill=COLORS["visor"])
    draw.rectangle([cx-22, vy-2, cx-19, vy+3], fill=COLORS["visor_band"])
    draw.rectangle([cx+19, vy-2, cx+22, vy+3], fill=COLORS["visor_band"])

    if state == "wake":
        # Glowing eyes through visor
        draw.ellipse([cx-10, vy-3, cx-2, vy+4], fill=COLORS["eye_glow"])
        draw.ellipse([cx+2, vy-3, cx+10, vy+4], fill=COLORS["eye_glow"])
        draw.ellipse([cx-7, vy-1, cx-4, vy+2], fill=(220, 240, 255, 255))
        draw.ellipse([cx+4, vy-1, cx+7, vy+2], fill=(220, 240, 255, 255))
    elif state == "sleep":
        draw.rectangle([cx-19, vy-4, cx+19, vy+5], fill=(10, 10, 15, 255))
        draw.arc([cx-12, vy-4, cx-4, vy+4], 0, 180, fill=(5,5,8,255), width=2)
        draw.arc([cx+4, vy-4, cx+12, vy+4], 0, 180, fill=(5,5,8,255), width=2)
    else:
        draw.ellipse([cx-9, vy-3, cx-3, vy+3], fill=(30, 30, 40, 255))
        draw.ellipse([cx+3, vy-3, cx+9, vy+3], fill=(30, 30, 40, 255))

    # --- Blush ---
    if state != "sleep":
        draw.ellipse([cx-16, cy+1, cx-10, cy+5], fill=COLORS["cheek"])
        draw.ellipse([cx+10, cy+1, cx+16, cy+5], fill=COLORS["cheek"])

    # --- Mouth ---
    if state == "speak":
        draw.ellipse([cx-5, cy+5, cx+5, cy+12], fill=COLORS["mouth"])
        draw.ellipse([cx-3, cy+6, cx+3, cy+10], fill=COLORS["mouth_inner"])
    elif state == "sleep":
        draw.arc([cx-4, cy+4, cx+4, cy+9], 0, 180, fill=COLORS["mouth"], width=1)
    else:
        draw.arc([cx-4, cy+3, cx+4, cy+8], 0, 180, fill=COLORS["mouth"], width=2)

    # --- Headpiece (white band) ---
    by = cy - 27
    draw.ellipse([cx-14, by-3, cx+14, by+3], fill=COLORS["white"])

    # --- Neck ---
    draw.rectangle([cx-4, cy+10, cx+4, cy+16], fill=COLORS["skin_shadow"])

    # --- Body / Dress bodice ---
    bt = cy + 14
    bb = bt + 26
    draw.rectangle([cx-14, bt, cx+14, bb], fill=COLORS["dress"])
    draw.ellipse([cx-14, bt-2, cx+14, bt+6], fill=COLORS["dress"])
    # White chest panel
    draw.ellipse([cx-8, bt+2, cx+8, bt+12], fill=COLORS["white"])
    # Gold trim
    draw.rectangle([cx-13, bt+1, cx+13, bt+3], fill=COLORS["gold"])

    # --- Skirt ---
    st = bb
    sb = st + 12
    draw.polygon([
        (cx-12, st), (cx+12, st),
        (cx+17, sb), (cx-17, sb)
    ], fill=COLORS["dress_skirt"])
    draw.arc([cx-17, sb-3, cx+17, sb+2], 0, 180, fill=COLORS["white_s"], width=2)

    # --- Side hair strands (over dress) ---
    draw.rectangle([cx-18, cy-14, cx-14, bt-2], fill=COLORS["hair"])
    draw.rectangle([cx+14, cy-14, cx+18, bt-2], fill=COLORS["hair"])

    # --- Arms ---
    ay = bt + 2
    draw.rectangle([cx-19, ay, cx-14, ay+14], fill=COLORS["skin"])
    draw.rectangle([cx+14, ay, cx+19, ay+14], fill=COLORS["skin"])
    draw.ellipse([cx-21, ay+12, cx-13, ay+18], fill=COLORS["skin"])
    draw.ellipse([cx+13, ay+12, cx+21, ay+18], fill=COLORS["skin"])

    # --- Legs ---
    lt = sb - 1
    lb = lt + 16
    draw.rectangle([cx-11, lt, cx-3, lb], fill=COLORS["leg"])
    draw.rectangle([cx+3, lt, cx+11, lb], fill=COLORS["leg"])

    # --- Boots ---
    draw.rectangle([cx-12, lb, cx-2, lb+5], fill=COLORS["boot"])
    draw.rectangle([cx+2, lb, cx+12, lb+5], fill=COLORS["boot"])
    draw.rectangle([cx-13, lb+4, cx-10, lb+7], fill=COLORS["boot"])
    draw.rectangle([cx+10, lb+4, cx+13, lb+7], fill=COLORS["boot"])

    # --- Bow on chest ---
    bx, by2 = cx, bt
    draw.polygon([(bx-6, by2+1), (bx, by2-3), (bx, by2+5)], fill=COLORS["gold"])
    draw.polygon([(bx+6, by2+1), (bx, by2-3), (bx, by2+5)], fill=COLORS["gold"])


def save_frame(state, filename, offset_y=0):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw_2b(draw, state, offset_y)
    fp = os.path.join(assets_dir, filename)
    img.save(fp)
    print(f"  {filename} ({os.path.getsize(fp)} bytes)")
    return fp

print("Generating 2B chibi sprites...")

# Idle (breathing bob: up/down)
save_frame("idle", "pet-idle-1.png", offset_y=0)
save_frame("idle", "pet-idle-2.png", offset_y=-2)

# Wake (visor glowing, slight jump up)
save_frame("wake", "pet-wake-1.png", offset_y=-4)
save_frame("wake", "pet-wake-2.png", offset_y=-2)

# Speak (mouth open, subtle bob)
save_frame("speak", "pet-speak-1.png", offset_y=0)
save_frame("speak", "pet-speak-2.png", offset_y=-1)

# Sleep (eyes closed, slightly slumped down)
save_frame("sleep", "pet-sleep.png", offset_y=2)

# --- Preview sprite sheet ---
preview = Image.new("RGBA", (S * 4, S * 2), (30, 30, 40, 255))
states = ["pet-idle-1.png", "pet-wake-1.png", "pet-speak-1.png", "pet-sleep.png"]
for i, fn in enumerate(states):
    sprite = Image.open(os.path.join(assets_dir, fn))
    preview.paste(sprite, (i * S, 0), sprite)

preview_path = os.path.join(assets_dir, "sprite-sheet-preview.png")
preview.save(preview_path)
print(f"\nPreview: {preview_path}")
print("Done!")
