"""Generate pixel art 2B chibi characters for HiHermes desktop pet"""
from PIL import Image
import os

OUT_DIR = "/Users/lixincheng/workspace/Hiherms/figure/2b"

# Palette
C_SKIN      = (255, 230, 210)  # pale skin
C_SKIN_S    = (240, 210, 190)  # skin shadow
C_SKIN_SS   = (220, 190, 170)  # skin deep shadow
C_HAIR      = (235, 235, 240)  # silver hair
C_HAIR_S    = (200, 200, 210)  # hair shadow
C_HAIR_SS   = (165, 165, 180)  # hair deep shadow
C_HAIR_L    = (248, 248, 255)  # hair highlight
C_DRESS     = (30, 30, 35)     # dress black
C_DRESS_S   = (20, 20, 25)     # dress shadow
C_DRESS_L   = (60, 60, 70)     # dress highlight
C_SKIRT     = (25, 25, 30)     # skirt
C_SKIRT_S   = (15, 15, 18)     # skirt shadow
C_BOOT      = (28, 28, 32)     # boots
C_BOOT_S    = (15, 15, 18)     # boot shadow
C_GLOVE     = (30, 30, 35)     # gloves
C_HEADBAND  = (25, 25, 28)     # headband
C_BLINDFOLD = (25, 25, 28)     # blindfold
C_EYE_W     = (255, 255, 255)  # eye white
C_EYE_B     = (60, 160, 240)   # eye blue
C_EYE_P     = (15, 25, 55)     # eye pupil
C_EYE_L     = (180, 220, 255)  # eye light
C_MOUTH     = (200, 120, 140)  # lips
C_MOUTH_S   = (220, 150, 165)  # lip light
C_CHEEK     = (255, 180, 190)  # blush
C_GOLD      = (180, 150, 100)  # gold accent
C_BLACK     = (0, 0, 0)

def draw_classic():
    """Classic 2B standing chibi - 48x64"""
    img = Image.new('RGBA', (48, 64), (0, 0, 0, 0))
    p = img.load()
    
    def rect(x1, y1, x2, y2, color):
        for y in range(y1, y2+1):
            for x in range(x1, x2+1):
                if 0 <= x < 48 and 0 <= y < 64:
                    p[x, y] = color
    
    def px(x, y, color):
        if 0 <= x < 48 and 0 <= y < 64:
            p[x, y] = color
    
    def ellipse(cx, cy, rx, ry, color, fill=True):
        import math
        for y in range(cy-ry, cy+ry+1):
            for x in range(cx-rx, cx+rx+1):
                if 0 <= x < 48 and 0 <= y < 64:
                    dx = (x - cx) / rx
                    dy = (y - cy) / ry
                    if dx*dx + dy*dy <= 1:
                        p[x, y] = color
    
    # === LEGS ===
    rect(21, 42, 26, 53, C_SKIN)  # left leg
    rect(22, 42, 27, 53, C_SKIN_S)  # leg shading
    rect(28, 42, 33, 53, C_SKIN)  # right leg
    
    # Boots
    rect(20, 51, 27, 57, C_BOOT)
    rect(19, 53, 20, 56, C_BOOT_S)
    rect(28, 51, 35, 57, C_BOOT)
    rect(36, 53, 37, 56, C_BOOT_S)
    # Boot soles
    rect(19, 57, 27, 58, (15,15,18))
    rect(28, 57, 36, 58, (15,15,18))
    
    # === SKIRT ===
    rect(16, 39, 38, 42, C_SKIRT)
    rect(15, 40, 16, 43, C_SKIRT_S)
    rect(38, 40, 39, 43, C_SKIRT_S)
    rect(16, 43, 38, 44, C_SKIRT)
    rect(15, 44, 39, 45, C_SKIRT_S)
    # Skirt front slit
    rect(23, 39, 26, 44, C_DRESS_S)
    rect(27, 39, 30, 44, C_SKIRT_S)
    
    # === DRESS BODY ===
    rect(17, 18, 37, 39, C_DRESS)
    rect(16, 19, 17, 38, C_DRESS_S)
    rect(37, 19, 38, 38, C_DRESS_S)
    
    # Dress highlight
    rect(24, 20, 30, 22, C_DRESS_L)
    rect(25, 23, 29, 35, C_DRESS_L)
    
    # Chest detail
    rect(22, 22, 25, 24, (40,40,48))
    rect(29, 22, 32, 24, (40,40,48))
    px(26, 23, C_GOLD)
    px(27, 23, C_GOLD)
    
    # Belt
    rect(16, 36, 38, 38, (20,20,25))
    px(24, 36, C_GOLD); px(25, 36, C_GOLD); px(26, 36, C_GOLD)
    px(27, 36, C_GOLD); px(28, 36, C_GOLD); px(29, 36, C_GOLD)
    
    # === ARMS ===
    # Left arm
    rect(14, 20, 16, 35, C_SKIN)
    rect(13, 22, 14, 30, C_GLOVE)
    px(14, 34, C_SKIN)  # hand
    
    # Right arm
    rect(38, 20, 40, 35, C_SKIN)
    rect(40, 22, 41, 30, C_GLOVE)
    px(40, 34, C_SKIN)  # hand
    
    # === HEAD ===
    # Neck
    rect(22, 14, 25, 19, C_SKIN)
    rect(26, 14, 29, 19, C_SKIN_S)
    
    # Face
    ellipse(24, 8, 10, 11, C_SKIN)
    ellipse(24, 10, 8, 5, C_SKIN_S)  # face shadow
    
    # Cheeks
    px(15, 10, C_CHEEK); px(16, 10, C_CHEEK)
    px(15, 11, C_CHEEK); px(16, 11, C_CHEEK)
    px(31, 10, C_CHEEK); px(32, 10, C_CHEEK)
    px(31, 11, C_CHEEK); px(32, 11, C_CHEEK)
    
    # === HAIR ===
    # Back hair
    rect(13, 2, 18, 12, C_HAIR_S)
    rect(30, 2, 35, 12, C_HAIR_S)
    rect(13, 6, 14, 14, C_HAIR_SS)
    rect(34, 6, 35, 14, C_HAIR_SS)
    
    # Side hair
    rect(12, 3, 14, 10, C_HAIR)
    rect(34, 3, 36, 10, C_HAIR)
    
    # Main hair/bangs
    rect(14, 0, 20, 1, C_HAIR)
    rect(14, 1, 18, 3, C_HAIR)
    rect(15, 2, 17, 4, C_HAIR_S)
    rect(30, 0, 34, 1, C_HAIR)
    rect(30, 1, 34, 3, C_HAIR)
    rect(31, 2, 33, 4, C_HAIR_S)
    
    # Top hair
    rect(18, 0, 30, 2, C_HAIR_L)
    rect(19, 0, 29, 1, C_HAIR)
    rect(20, 0, 28, 0, C_HAIR_L)
    
    # Bangs
    rect(15, 2, 20, 5, C_HAIR)
    rect(16, 3, 19, 6, C_HAIR_S)
    rect(28, 2, 33, 5, C_HAIR)
    rect(29, 3, 32, 6, C_HAIR_S)
    # Center bangs
    rect(20, 3, 28, 6, C_HAIR)
    rect(21, 4, 27, 7, C_HAIR_S)
    rect(22, 5, 26, 8, C_HAIR)
    
    # Hair shine
    rect(19, 0, 20, 1, (250, 250, 255))
    
    # === HEADBAND ===
    rect(15, 4, 18, 5, C_HEADBAND)
    rect(19, 4, 29, 5, C_HEADBAND)
    rect(30, 4, 33, 5, C_HEADBAND)
    # Headband ornament
    px(23, 4, C_GOLD); px(24, 4, C_GOLD); px(25, 4, C_GOLD)
    px(24, 3, (200, 180, 150))
    
    # === BLINDFOLD ===
    rect(16, 7, 19, 8, C_BLINDFOLD)
    rect(20, 7, 28, 8, C_BLINDFOLD)
    rect(29, 7, 32, 8, C_BLINDFOLD)
    
    # === EYES (hint below blindfold) ===
    # Left eye
    rect(18, 8, 22, 9, C_EYE_W)
    rect(19, 8, 21, 9, C_EYE_B)
    px(20, 8, C_EYE_P)
    
    # Right eye
    rect(26, 8, 30, 9, C_EYE_W)
    rect(27, 8, 29, 9, C_EYE_B)
    px(28, 8, C_EYE_P)
    
    # === MOUTH ===
    # Nose
    px(24, 10, (190, 170, 155))
    
    # Smile
    rect(20, 12, 23, 13, C_MOUTH)
    rect(24, 12, 28, 13, C_MOUTH)
    px(22, 12, C_MOUTH_S)
    px(26, 12, C_MOUTH_S)
    
    # === DRESS COLLAR ===
    rect(18, 14, 20, 16, (40,40,48))
    rect(28, 14, 30, 16, (40,40,48))
    
    # === SHADOW ===
    rect(16, 58, 37, 59, (0, 0, 0, 10))
    rect(18, 59, 35, 60, (0, 0, 0, 8))
    
    return img


def draw_cute():
    """Cute 2B sitting chibi - 48x64"""
    img = Image.new('RGBA', (48, 64), (0, 0, 0, 0))
    p = img.load()
    
    def rect(x1, y1, x2, y2, color):
        for y in range(y1, y2+1):
            for x in range(x1, x2+1):
                if 0 <= x < 48 and 0 <= y < 64:
                    p[x, y] = color
    
    def px(x, y, color):
        if 0 <= x < 48 and 0 <= y < 64:
            p[x, y] = color
    
    # === LEGS (sitting/kneeling) ===
    rect(18, 44, 24, 52, C_SKIN)  # left thigh
    rect(28, 44, 34, 52, C_SKIN)  # right thigh
    rect(18, 44, 22, 46, C_SKIN_S)
    rect(30, 44, 34, 46, C_SKIN_S)
    
    # Boots (tucked under)
    rect(16, 50, 25, 56, C_BOOT)
    rect(27, 50, 36, 56, C_BOOT)
    rect(15, 55, 25, 57, (15,15,18))
    rect(27, 55, 37, 57, (15,15,18))
    
    # === SKIRT (wide, sitting) ===
    rect(12, 39, 40, 44, C_SKIRT)
    rect(11, 40, 12, 44, C_SKIRT_S)
    rect(40, 40, 41, 44, C_SKIRT_S)
    rect(12, 44, 40, 46, C_SKIRT)
    # Skirt detail
    rect(22, 39, 28, 44, C_SKIRT_S)
    
    # === DRESS BODY ===
    rect(16, 18, 36, 39, C_DRESS)
    rect(15, 19, 16, 38, C_DRESS_S)
    rect(36, 19, 37, 38, C_DRESS_S)
    
    # Dress highlight
    rect(23, 20, 29, 35, C_DRESS_L)
    
    # Chest detail
    rect(21, 22, 24, 24, (40,40,48))
    rect(28, 22, 31, 24, (40,40,48))
    px(26, 23, C_GOLD); px(27, 23, C_GOLD)
    
    # Belt
    rect(15, 36, 37, 38, (20,20,25))
    px(23, 36, C_GOLD); px(24, 36, C_GOLD); px(25, 36, C_GOLD)
    px(26, 36, C_GOLD); px(27, 36, C_GOLD); px(28, 36, C_GOLD)
    px(29, 36, C_GOLD)
    
    # === ARMS (hands clasped in lap) ===
    # Left arm
    rect(14, 20, 16, 34, C_SKIN)
    rect(13, 22, 14, 30, C_GLOVE)
    rect(15, 34, 18, 36, C_SKIN)  # hand
    
    # Right arm
    rect(36, 20, 38, 34, C_SKIN)
    rect(38, 22, 39, 30, C_GLOVE)
    rect(33, 34, 36, 36, C_SKIN)  # hand
    
    # Clasped hands
    rect(19, 35, 32, 37, C_SKIN)
    px(19, 36, C_SKIN_S); px(32, 36, C_SKIN_S)
    
    # === HEAD (bigger eyes, cuter) ===
    # Neck
    rect(22, 13, 25, 18, C_SKIN)
    rect(26, 13, 29, 18, C_SKIN_S)
    
    # Face (rounder)
    rect(12, 0, 14, 8, C_SKIN)
    rect(36, 0, 38, 8, C_SKIN)
    rect(14, 0, 36, 12, C_SKIN)
    
    # Cheeks
    rect(14, 9, 17, 11, C_CHEEK); rect(14, 10, 18, 11, C_CHEEK)
    rect(32, 9, 35, 11, C_CHEEK); rect(31, 10, 35, 11, C_CHEEK)
    
    # === HAIR ===
    # Back hair
    rect(11, 1, 14, 12, C_HAIR_S)
    rect(35, 1, 38, 12, C_HAIR_S)
    
    # Side hair
    rect(11, 2, 13, 10, C_HAIR)
    rect(36, 2, 38, 10, C_HAIR)
    
    # Top hair
    rect(15, 0, 35, 2, C_HAIR)
    rect(15, 0, 34, 1, C_HAIR_L)
    
    # Bangs
    rect(14, 1, 20, 5, C_HAIR)
    rect(15, 2, 19, 6, C_HAIR_S)
    rect(30, 1, 36, 5, C_HAIR)
    rect(31, 2, 35, 6, C_HAIR_S)
    # Center bangs
    rect(20, 2, 30, 6, C_HAIR)
    rect(21, 3, 29, 7, C_HAIR_S)
    rect(22, 4, 28, 8, C_HAIR)
    
    # Hair shine
    rect(18, 0, 19, 1, (250, 250, 255))
    rect(30, 0, 31, 1, (250, 250, 255))
    
    # === HEADBAND ===
    rect(14, 3, 17, 4, C_HEADBAND)
    rect(18, 3, 32, 4, C_HEADBAND)
    rect(33, 3, 36, 4, C_HEADBAND)
    px(23, 3, C_GOLD); px(24, 3, C_GOLD); px(25, 3, C_GOLD)
    px(27, 3, C_GOLD); px(28, 3, C_GOLD); px(29, 3, C_GOLD)
    
    # === BLINDFOLD ===
    rect(15, 6, 18, 7, C_BLINDFOLD)
    rect(19, 6, 31, 7, C_BLINDFOLD)
    rect(32, 6, 35, 7, C_BLINDFOLD)
    
    # === EYES (bigger, cuter) ===
    # Left eye
    rect(17, 7, 23, 10, C_EYE_W)
    rect(18, 8, 22, 10, C_EYE_B)
    rect(19, 8, 21, 9, C_EYE_P)
    px(21, 8, C_EYE_L)  # eye shine
    
    # Right eye
    rect(27, 7, 33, 10, C_EYE_W)
    rect(28, 8, 32, 10, C_EYE_B)
    rect(29, 8, 31, 9, C_EYE_P)
    px(31, 8, C_EYE_L)  # eye shine
    
    # === MOUTH (cute smile) ===
    px(24, 11, (190, 170, 155))  # nose
    rect(21, 13, 24, 14, C_MOUTH)
    rect(25, 13, 29, 14, C_MOUTH)
    px(23, 13, C_MOUTH_S)
    px(27, 13, C_MOUTH_S)
    
    # === COLLAR ===
    rect(17, 13, 20, 15, (40,40,48))
    rect(30, 13, 33, 15, (40,40,48))
    
    return img


def draw_battle():
    """Battle 2B with sword - 48x64"""
    img = Image.new('RGBA', (48, 64), (0, 0, 0, 0))
    p = img.load()
    
    def rect(x1, y1, x2, y2, color):
        for y in range(y1, y2+1):
            for x in range(x1, x2+1):
                if 0 <= x < 48 and 0 <= y < 64:
                    p[x, y] = color
    
    def px(x, y, color):
        if 0 <= x < 48 and 0 <= y < 64:
            p[x, y] = color
    
    # === LEGS (dynamic stance) ===
    rect(11, 42, 22, 53, C_SKIN)  # left leg forward
    rect(30, 42, 38, 53, C_SKIN)  # right leg back
    rect(11, 46, 18, 53, C_SKIN_S)
    
    # Boots
    rect(10, 51, 23, 57, C_BOOT)
    rect(10, 50, 12, 52, C_BOOT_S)
    rect(29, 51, 39, 57, C_BOOT)
    rect(38, 50, 39, 52, C_BOOT_S)
    rect(10, 57, 23, 58, (15,15,18))
    rect(29, 57, 39, 58, (15,15,18))
    
    # === SKIRT (battle-worn) ===
    rect(14, 39, 40, 42, C_SKIRT)
    rect(13, 40, 14, 43, C_SKIRT_S)
    rect(40, 40, 41, 43, C_SKIRT_S)
    rect(14, 43, 40, 44, C_SKIRT)
    # battle tear
    rect(14, 42, 16, 43, C_DRESS_S)
    rect(14, 41, 14, 42, (255,255,255,15))
    
    # === DRESS BODY ===
    rect(17, 18, 37, 39, C_DRESS)
    rect(16, 19, 17, 38, C_DRESS_S)
    rect(37, 19, 38, 38, C_DRESS_S)
    
    # Armor highlight on dress
    rect(23, 20, 31, 22, C_DRESS_L)
    rect(24, 23, 30, 30, C_DRESS_L)
    
    # Chest armor plate
    rect(21, 21, 26, 24, (45,45,55))
    rect(28, 21, 33, 24, (45,45,55))
    px(27, 22, C_GOLD)
    
    # Belt
    rect(16, 36, 38, 38, (20,20,25))
    px(25, 36, C_GOLD); px(26, 36, C_GOLD); px(27, 36, C_GOLD)
    px(28, 36, C_GOLD); px(29, 36, C_GOLD)
    
    # === ARMS ===
    # Left arm (extended)
    rect(12, 20, 14, 34, C_SKIN)
    rect(11, 22, 12, 30, C_GLOVE)
    px(13, 34, C_SKIN)
    
    # Right arm (raised with sword)
    rect(38, 16, 40, 30, C_SKIN)
    rect(39, 16, 40, 26, C_GLOVE)
    px(39, 30, C_SKIN)
    
    # === SWORD (Mini, diagonal) ===
    # Blade (diagonal)
    px(42, 0, (180, 185, 195))
    px(43, 0, (220, 225, 235)); px(42, 1, (200, 205, 215))
    px(43, 1, (235, 240, 245)); px(42, 2, (210, 215, 225))
    px(43, 2, (245, 248, 255)); px(42, 3, (200, 205, 215))
    
    # Guard
    rect(40, 13, 44, 14, (50,50,55))
    rect(41, 13, 43, 14, (70,70,80))
    
    # Grip
    rect(41, 15, 43, 18, (25,25,30))
    rect(41, 18, 43, 19, (50,50,55))  # pommel
    
    # === HEAD ===
    # Neck
    rect(22, 12, 25, 18, C_SKIN)
    rect(26, 12, 29, 18, C_SKIN_S)
    
    # Head
    rect(14, 0, 16, 8, C_SKIN)
    rect(34, 0, 36, 8, C_SKIN)
    rect(16, 0, 34, 12, C_SKIN)
    
    # Light blush
    rect(15, 9, 17, 10, C_CHEEK)
    rect(32, 9, 34, 10, C_CHEEK)
    
    # === HAIR ===
    # Back hair (wind-blown)
    rect(11, 0, 14, 12, C_HAIR_S)
    rect(34, 0, 38, 12, C_HAIR_S)
    rect(9, 3, 11, 8, C_HAIR_SS)  # wind strand
    rect(37, 5, 39, 14, C_HAIR_SS)
    
    # Side hair
    rect(12, 1, 13, 10, C_HAIR)
    rect(35, 1, 38, 10, C_HAIR)
    
    # Top hair
    rect(15, 0, 35, 2, C_HAIR)
    rect(15, 0, 34, 1, C_HAIR_L)
    
    # Bangs (wind-blown)
    rect(13, 1, 19, 5, C_HAIR)
    rect(14, 2, 18, 6, C_HAIR_S)
    rect(30, 1, 37, 5, C_HAIR)
    rect(31, 2, 36, 6, C_HAIR_S)
    # Center bangs (parted, wind effect)
    rect(19, 2, 24, 6, C_HAIR)
    rect(20, 3, 23, 7, C_HAIR_S)
    rect(26, 2, 31, 6, C_HAIR)
    rect(27, 3, 30, 7, C_HAIR_S)
    # Hair parted in wind
    rect(24, 3, 26, 5, (255,245,250,60))  # skin peek
    
    # Hair shine
    rect(17, 0, 18, 1, (250, 250, 255))
    
    # === HEADBAND ===
    rect(13, 3, 16, 4, C_HEADBAND)
    rect(17, 3, 32, 4, C_HEADBAND)
    rect(33, 3, 36, 4, C_HEADBAND)
    px(24, 3, C_GOLD); px(25, 3, C_GOLD); px(26, 3, C_GOLD)
    
    # === BLINDFOLD (torn - right eye exposed) ===
    rect(14, 6, 18, 7, C_BLINDFOLD)
    rect(19, 6, 25, 7, C_BLINDFOLD)
    rect(29, 6, 36, 7, C_BLINDFOLD)
    rect(26, 6, 28, 7, (0,0,0,0))  # torn gap
    
    # === EYES ===
    # Left eye (hint under blindfold)
    rect(18, 7, 21, 8, C_EYE_W)
    rect(19, 7, 20, 8, C_EYE_B)
    px(20, 7, C_EYE_P)
    
    # Right eye (exposed, intense)
    rect(29, 7, 34, 9, C_EYE_W)
    rect(30, 7, 33, 9, C_EYE_B)
    rect(31, 7, 32, 8, C_EYE_P)
    px(33, 7, C_EYE_L)
    
    # === MOUTH (confident smirk) ===
    px(24, 11, (190, 170, 155))  # nose
    rect(20, 12, 22, 13, C_MOUTH)
    rect(27, 12, 29, 13, C_MOUTH)
    px(23, 12, C_MOUTH)
    px(26, 12, C_MOUTH)
    
    # === COLLAR / ARMOR ===
    rect(17, 12, 20, 14, (45,45,55))
    rect(30, 12, 33, 14, (45,45,55))
    
    return img


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    
    designs = [
        ("2b_classic_pixel.png", draw_classic()),
        ("2b_cute_pixel.png", draw_cute()),
        ("2b_battle_pixel.png", draw_battle()),
    ]
    
    for name, img in designs:
        # Scale up 8x for 384x512 (then crop to 256x256 center)
        scaled = img.resize((384, 512), Image.NEAREST)
        
        # Create 256x256 output with centered character
        final = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        x_off = (256 - 384) // 2
        y_off = (256 - 512) // 2
        final.paste(scaled, (x_off, y_off))
        
        path = os.path.join(OUT_DIR, name)
        final.save(path, 'PNG')
        print(f"  ✓ Saved {name} ({final.size[0]}x{final.size[1]})")
    
    print("\nDone! 3 pixel art 2B chibis generated.")
