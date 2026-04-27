"""High-detail pixel art 2B chibi - 128x164 resolution for clear facial features"""
from PIL import Image
import os

OUT_DIR = "/Users/lixincheng/workspace/Hiherms/figure/2b"

# === REFINED COLOR PALETTE ===
SKIN      = (255, 235, 218)
SKIN_S    = (245, 218, 198)
SKIN_SS   = (228, 198, 178)
HAIR      = (228, 228, 238)
HAIR_S    = (196, 196, 210)
HAIR_SS   = (160, 160, 178)
HAIR_L    = (245, 245, 255)
DRESS     = (34, 34, 38)
DRESS_S   = (22, 22, 26)
DRESS_L   = (66, 66, 76)
SKIRT     = (28, 28, 33)
SKIRT_S   = (16, 16, 20)
BOOT      = (32, 32, 36)
BOOT_S    = (18, 18, 22)
GLOVE     = (34, 34, 38)
HEADBAND  = (26, 26, 30)
BAND      = (26, 26, 30)
EYE_W     = (250, 250, 255)
EYE_B     = (70, 162, 238)
EYE_B_S   = (50, 130, 210)
EYE_P     = (18, 28, 52)
EYE_L     = (200, 228, 255)
EYE_L2    = (255, 255, 255)
MOUTH     = (205, 125, 142)
MOUTH_L   = (225, 158, 170)
CHEEK     = (255, 175, 188)
CHEEK_S   = (240, 155, 170)
GOLD      = (190, 160, 108)
GOLD_L    = (215, 190, 140)
NOSE      = (210, 185, 170)
NONE      = (0, 0, 0, 0)


def draw_classic(img):
    """128x164 - Classic 2B standing elegantly"""
    p = img.load()
    W, H = 128, 164

    def rect(x1, y1, x2, y2, c):
        for y in range(max(0,y1), min(H,y2+1)):
            for x in range(max(0,x1), min(W,x2+1)):
                p[x, y] = c

    def px(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            iv = getattr(c, '__len__', lambda: 0)() and len(c) == 4
            p[x, y] = c

    def ellipse(cx, cy, rx, ry, c):
        for y in range(cy-ry, cy+ry+1):
            for x in range(cx-rx, cx+rx+1):
                if 0 <= x < W and 0 <= y < H:
                    dx = (x - cx) / rx if rx else 0
                    dy = (y - cy) / ry if ry else 0
                    if dx*dx + dy*dy <= 1:
                        p[x, y] = c

    # === LEGS ===
    # Left leg
    rect(52, 108, 58, 136, SKIN)
    rect(56, 110, 58, 132, SKIN_S)
    # Right leg
    rect(70, 108, 76, 136, SKIN)
    rect(70, 110, 72, 132, SKIN_S)

    # Left boot
    rect(48, 130, 60, 148, BOOT)
    rect(46, 132, 48, 146, BOOT_S)
    rect(60, 132, 62, 146, BOOT_S)
    rect(46, 146, 62, 150, (18,18,22))
    
    # Right boot
    rect(68, 130, 80, 148, BOOT)
    rect(66, 132, 68, 146, BOOT_S)
    rect(80, 132, 82, 146, BOOT_S)
    rect(66, 146, 82, 150, (18,18,22))

    # === SKIRT ===
    rect(40, 96, 88, 108, SKIRT)
    rect(38, 98, 40, 106, SKIRT_S)
    rect(88, 98, 90, 106, SKIRT_S)
    rect(40, 106, 88, 110, SKIRT)
    rect(38, 108, 90, 112, SKIRT_S)
    # Front slit
    rect(58, 96, 62, 110, DRESS_S)
    rect(66, 96, 70, 110, SKIRT_S)
    # Skirt drape
    rect(38, 108, 42, 110, SKIRT_S)
    rect(86, 108, 90, 110, SKIRT_S)

    # === DRESS BODY ===
    rect(46, 44, 82, 96, DRESS)
    rect(44, 46, 46, 94, DRESS_S)
    rect(82, 46, 84, 94, DRESS_S)
    
    # Dress highlight
    rect(58, 48, 70, 52, DRESS_L)
    rect(60, 52, 68, 80, DRESS_L)

    # Chest detail
    rect(52, 52, 56, 56, (44,44,52))
    rect(72, 52, 76, 56, (44,44,52))
    px(64, 55, GOLD)
    px(63, 54, GOLD)
    
    # Chest curve shadow
    rect(56, 54, 60, 56, (40,40,46))
    rect(68, 54, 72, 56, (40,40,46))

    # Belt
    rect(45, 92, 83, 96, (22,22,26))
    rect(56, 92, 72, 96, (44,44,52))
    px(62, 93, GOLD); px(63, 93, GOLD); px(64, 93, GOLD)
    px(65, 93, GOLD); px(66, 93, GOLD)

    # === ARMS ===
    # Left arm
    rect(38, 46, 44, 82, SKIN)
    rect(36, 50, 38, 76, GLOVE)
    px(42, 80, SKIN_S)
    px(43, 80, SKIN)
    px(44, 80, SKIN)
    rect(40, 82, 44, 84, SKIN)  # hand
    
    # Right arm
    rect(84, 46, 90, 82, SKIN)
    rect(90, 50, 92, 76, GLOVE)
    px(84, 80, SKIN_S)
    px(84, 82, SKIN)
    px(84, 84, SKIN)

    # === NECK ===
    rect(60, 34, 68, 44, SKIN)
    rect(60, 36, 64, 42, SKIN_S)

    # === HEAD / FACE ===
    # Main face shape (rounder, softer)
    ellipse(64, 22, 28, 30, SKIN)
    # Face shadow bottom
    rect(40, 38, 88, 44, SKIN_S)
    ellipse(64, 24, 26, 22, SKIN)
    
    # === CHEEKS (subtle blush) ===
    rect(42, 30, 48, 34, CHEEK)
    rect(80, 30, 86, 34, CHEEK)
    px(49, 31, CHEEK_S); px(50, 32, CHEEK_S)
    px(79, 31, CHEEK_S); px(78, 32, CHEEK_S)

    # === HAIR ===
    # Back hair
    rect(34, 2, 42, 34, HAIR_S)
    rect(86, 2, 94, 34, HAIR_S)
    rect(32, 6, 34, 28, HAIR_SS)
    rect(94, 6, 96, 28, HAIR_SS)
    
    # Side hair
    rect(36, 4, 40, 18, HAIR)
    rect(34, 6, 36, 14, HAIR_S)
    rect(88, 4, 92, 18, HAIR)
    rect(92, 6, 94, 14, HAIR_S)

    # Top hair volume
    rect(40, 0, 88, 4, HAIR)
    rect(42, 0, 86, 2, HAIR_L)
    ellipse(64, 2, 24, 5, HAIR)
    
    # Hair crown volume
    rect(44, 0, 84, 3, HAIR_L)
    rect(46, 0, 82, 2, HAIR)

    # Bangs
    rect(38, 4, 50, 14, HAIR)
    rect(40, 6, 48, 16, HAIR_S)
    rect(78, 4, 90, 14, HAIR)
    rect(80, 6, 88, 16, HAIR_S)
    
    # Center bangs
    rect(50, 4, 78, 16, HAIR)
    rect(52, 6, 76, 18, HAIR_S)
    rect(54, 8, 74, 20, HAIR)
    rect(56, 10, 72, 22, HAIR_S)
    
    # Long center bang
    rect(60, 10, 68, 28, HAIR)
    rect(62, 12, 66, 26, HAIR_S)
    
    # Hair shine highlights
    rect(48, 0, 52, 2, (248, 248, 255))
    rect(76, 0, 80, 2, (248, 248, 255))
    rect(50, 4, 52, 6, (248, 248, 255))
    px(78, 4, (248, 248, 255))
    
    # Hair strands detail
    px(44, 6, HAIR_S); px(46, 8, HAIR_S)
    px(82, 6, HAIR_S); px(84, 8, HAIR_S)
    px(50, 4, HAIR_L); px(78, 4, HAIR_L)

    # === HEADBAND ===
    rect(38, 10, 42, 13, HEADBAND)
    rect(42, 10, 86, 13, HEADBAND)
    rect(86, 10, 90, 13, HEADBAND)
    # Headband shine
    rect(42, 11, 86, 12, (40,40,46))
    # Headband ornament
    rect(60, 8, 68, 10, GOLD)
    rect(61, 7, 67, 8, GOLD_L)
    px(64, 7, (240, 220, 180))
    px(62, 9, GOLD); px(66, 9, GOLD)

    # === BLINDFOLD ===
    rect(42, 16, 48, 20, BAND)
    rect(48, 16, 80, 20, BAND)
    rect(80, 16, 86, 20, BAND)
    # Blindfold highlight
    rect(48, 17, 80, 18, (40,40,46))
    # Blindfold strings
    rect(40, 18, 42, 20, HEADBAND)
    rect(86, 18, 88, 20, HEADBAND)

    # === EYES ===
    # Left eye
    rect(48, 20, 56, 26, EYE_W)
    rect(50, 22, 56, 26, EYE_B)
    rect(52, 22, 54, 25, EYE_P)
    px(54, 22, EYE_L)  # iris light
    px(56, 21, EYE_L2)  # eye shine
    
    # Right eye
    rect(72, 20, 80, 26, EYE_W)
    rect(72, 22, 78, 26, EYE_B)
    rect(74, 22, 76, 25, EYE_P)
    px(76, 22, EYE_L)
    px(72, 21, EYE_L2)
    
    # Eyelashes
    px(48, 20, (20,20,28))
    px(80, 20, (20,20,28))
    rect(46, 21, 48, 22, (20,20,28))
    rect(80, 21, 82, 22, (20,20,28))

    # === NOSE ===
    px(64, 28, NOSE)
    px(63, 29, NOSE)
    
    # === MOUTH ===
    # Elegant smile
    rect(54, 32, 60, 34, MOUTH)
    rect(60, 32, 74, 34, MOUTH)
    px(62, 32, MOUTH_L)
    px(66, 32, MOUTH_L)
    rect(54, 32, 74, 33, MOUTH_L)  # lip highlight

    # === COLLAR ===
    rect(44, 34, 52, 38, (44,44,52))
    rect(76, 34, 84, 38, (44,44,52))
    px(52, 36, (50,50,58))
    px(76, 36, (50,50,58))

    # === SHADOW (ground) ===
    rect(34, 152, 94, 154, (0,0,0,8))
    rect(38, 154, 90, 156, (0,0,0,6))


def draw_cute(img):
    """128x164 - Cute 2B sitting with big eyes"""
    p = img.load()
    W, H = 128, 164

    def rect(x1, y1, x2, y2, c):
        for y in range(max(0,y1), min(H,y2+1)):
            for x in range(max(0,x1), min(W,x2+1)):
                p[x, y] = c

    def px(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = c

    def ellipse(cx, cy, rx, ry, c):
        for y in range(cy-ry, cy+ry+1):
            for x in range(cx-rx, cx+rx+1):
                if 0 <= x < W and 0 <= y < H:
                    dx = (x - cx) / rx if rx else 0
                    dy = (y - cy) / ry if ry else 0
                    if dx*dx + dy*dy <= 1:
                        p[x, y] = c

    # === LEGS (sitting/kneeling) ===
    # Left thigh
    rect(44, 114, 56, 132, SKIN)
    rect(44, 114, 50, 118, SKIN_S)
    # Right thigh
    rect(72, 114, 84, 132, SKIN)
    rect(78, 114, 84, 118, SKIN_S)
    
    # Left boot (tucked)
    rect(38, 128, 56, 148, BOOT)
    rect(38, 128, 42, 146, BOOT_S)
    rect(54, 130, 56, 144, BOOT_S)
    rect(36, 146, 56, 150, (18,18,22))
    
    # Right boot
    rect(72, 128, 90, 148, BOOT)
    rect(72, 130, 74, 146, BOOT_S)
    rect(88, 130, 90, 144, BOOT_S)
    rect(72, 146, 92, 150, (18,18,22))

    # === SKIRT (wide, sitting) ===
    rect(34, 98, 94, 104, SKIRT)
    rect(32, 100, 34, 108, SKIRT_S)
    rect(94, 100, 96, 108, SKIRT_S)
    rect(34, 104, 94, 112, SKIRT)
    rect(32, 112, 96, 115, SKIRT_S)
    # Skirt drape left
    rect(32, 106, 36, 112, SKIRT_S)
    rect(92, 106, 96, 112, SKIRT_S)
    
    # === DRESS BODY ===
    rect(44, 44, 84, 98, DRESS)
    rect(42, 46, 44, 96, DRESS_S)
    rect(84, 46, 86, 96, DRESS_S)
    
    # Dress highlight
    rect(58, 48, 70, 52, DRESS_L)
    rect(60, 52, 68, 78, DRESS_L)
    
    # Chest detail
    rect(52, 52, 56, 56, (44,44,52))
    rect(72, 52, 76, 56, (44,44,52))
    px(64, 55, GOLD)
    
    # Belt
    rect(43, 94, 85, 98, (22,22,26))
    px(62, 95, GOLD); px(63, 95, GOLD); px(64, 95, GOLD)
    px(65, 95, GOLD); px(66, 95, GOLD)

    # === ARMS (hands clasped in lap) ===
    # Left arm
    rect(38, 48, 43, 88, SKIN)
    rect(36, 50, 38, 80, GLOVE)
    
    # Right arm
    rect(85, 48, 90, 88, SKIN)
    rect(90, 50, 92, 80, GLOVE)
    
    # Clasped hands
    rect(44, 88, 56, 94, SKIN)
    rect(72, 88, 84, 94, SKIN)
    rect(56, 90, 72, 95, SKIN)
    rect(54, 92, 74, 94, SKIN_S)  # hand shadow

    # === NECK ===
    rect(60, 34, 68, 44, SKIN)
    rect(60, 36, 64, 42, SKIN_S)

    # === HEAD / FACE (slightly larger, rounder) ===
    ellipse(64, 20, 30, 32, SKIN)
    rect(38, 36, 90, 44, SKIN_S)
    ellipse(64, 22, 28, 22, SKIN)
    
    # === CHEEKS (stronger blush for cute look) ===
    rect(40, 28, 48, 34, CHEEK)
    rect(80, 28, 88, 34, CHEEK)
    px(48, 30, CHEEK_S); px(49, 31, CHEEK_S)
    px(79, 30, CHEEK_S); px(78, 31, CHEEK_S)

    # === HAIR ===
    # Back hair
    rect(32, 2, 40, 34, HAIR_S)
    rect(88, 2, 96, 34, HAIR_S)
    rect(30, 6, 32, 28, HAIR_SS)
    rect(96, 6, 98, 28, HAIR_SS)
    
    # Side hair
    rect(34, 4, 38, 18, HAIR)
    rect(32, 6, 34, 14, HAIR_S)
    rect(90, 4, 94, 18, HAIR)
    rect(94, 6, 96, 14, HAIR_S)

    # Top hair
    rect(38, 0, 90, 4, HAIR)
    rect(40, 0, 88, 2, HAIR_L)
    ellipse(64, 2, 26, 5, HAIR)
    
    # Hair crown
    rect(42, 0, 86, 3, HAIR_L)
    
    # Bangs
    rect(36, 4, 48, 14, HAIR)
    rect(38, 6, 46, 16, HAIR_S)
    rect(80, 4, 92, 14, HAIR)
    rect(82, 6, 90, 16, HAIR_S)
    
    # Center bangs
    rect(48, 4, 80, 16, HAIR)
    rect(50, 6, 78, 18, HAIR_S)
    rect(52, 8, 76, 20, HAIR)
    
    # Hair shine
    rect(46, 0, 50, 2, (248, 248, 255))
    rect(78, 0, 82, 2, (248, 248, 255))
    rect(48, 4, 50, 6, (248, 248, 255))
    rect(80, 4, 82, 6, (248, 248, 255))

    # === HEADBAND ===
    rect(36, 10, 40, 13, HEADBAND)
    rect(40, 10, 88, 13, HEADBAND)
    rect(88, 10, 92, 13, HEADBAND)
    rect(40, 11, 88, 12, (40,40,46))
    rect(60, 8, 68, 10, GOLD)
    px(62, 9, GOLD); px(66, 9, GOLD)

    # === EYES (bigger, cuter) ===
    # Left eye
    rect(46, 18, 58, 28, EYE_W)
    rect(48, 20, 56, 28, EYE_B)
    rect(50, 22, 54, 27, EYE_P)
    px(54, 22, EYE_L)
    px(56, 19, EYE_L2)  # big eye shine
    
    # Right eye
    rect(70, 18, 82, 28, EYE_W)
    rect(72, 20, 80, 28, EYE_B)
    rect(74, 22, 78, 27, EYE_P)
    px(76, 22, EYE_L)
    px(72, 19, EYE_L2)
    
    # Eyelashes
    rect(46, 18, 48, 20, (20,20,28))
    rect(80, 18, 82, 20, (20,20,28))
    
    # Eyebrows
    rect(46, 16, 56, 18, (40,40,48))
    rect(72, 16, 82, 18, (40,40,48))

    # === NOSE (tiny) ===
    px(64, 28, NOSE)
    
    # === MOUTH (cute smile) ===
    rect(54, 32, 60, 34, MOUTH)
    rect(60, 32, 74, 34, MOUTH)
    px(62, 32, MOUTH_L)
    px(66, 32, MOUTH_L)

    # === COLLAR ===
    rect(44, 34, 52, 38, (44,44,52))
    rect(76, 34, 84, 38, (44,44,52))
    
    # Shadow
    rect(32, 152, 96, 154, (0,0,0,8))


def draw_battle(img):
    """128x164 - Battle 2B with sword, dynamic pose"""
    p = img.load()
    W, H = 128, 164

    def rect(x1, y1, x2, y2, c):
        for y in range(max(0,y1), min(H,y2+1)):
            for x in range(max(0,x1), min(W,x2+1)):
                p[x, y] = c

    def px(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            p[x, y] = c

    def ellipse(cx, cy, rx, ry, c):
        for y in range(cy-ry, cy+ry+1):
            for x in range(cx-rx, cx+rx+1):
                if 0 <= x < W and 0 <= y < H:
                    dx = (x - cx) / rx if rx else 0
                    dy = (y - cy) / ry if ry else 0
                    if dx*dx + dy*dy <= 1:
                        p[x, y] = c

    # === LEGS (dynamic stance - legs apart) ===
    # Left leg (forward)
    rect(44, 108, 56, 136, SKIN)
    rect(44, 110, 48, 134, SKIN_S)
    # Right leg (back)
    rect(76, 108, 88, 136, SKIN)
    rect(84, 110, 88, 134, SKIN_S)

    # Left boot
    rect(40, 130, 58, 148, BOOT)
    rect(40, 132, 42, 146, BOOT_S)
    rect(56, 132, 58, 146, BOOT_S)
    rect(38, 146, 58, 150, (18,18,22))
    
    # Right boot
    rect(74, 130, 92, 148, BOOT)
    rect(90, 132, 92, 146, BOOT_S)
    rect(74, 132, 76, 146, BOOT_S)
    rect(74, 146, 92, 150, (18,18,22))

    # === SKIRT (battle-worn) ===
    rect(40, 96, 88, 108, SKIRT)
    rect(38, 98, 40, 106, SKIRT_S)
    rect(88, 98, 90, 106, SKIRT_S)
    rect(40, 106, 88, 112, SKIRT)
    # Battle tear on skirt
    rect(38, 102, 42, 106, SKIRT_S)
    px(40, 104, (255,240,240,10))
    # Front slit
    rect(58, 96, 62, 112, DRESS_S)
    rect(66, 96, 70, 112, SKIRT_S)

    # === DRESS BODY ===
    rect(46, 44, 82, 96, DRESS)
    rect(44, 46, 46, 94, DRESS_S)
    rect(82, 46, 84, 94, DRESS_S)
    
    # Armor plate on chest
    rect(54, 50, 74, 60, (44,44,52))
    rect(56, 52, 72, 58, (56,56,64))
    rect(62, 54, 66, 58, DRESS_L)
    # Armor line
    rect(54, 54, 74, 56, (36,36,42))
    
    # Belt with combat gear
    rect(45, 92, 83, 96, (22,22,26))
    rect(56, 92, 72, 96, (44,44,52))
    px(62, 93, GOLD); px(63, 93, GOLD); px(64, 93, GOLD)
    px(65, 93, GOLD); px(66, 93, GOLD)
    # Combat pouch
    rect(72, 92, 80, 96, (36,36,42))

    # === ARMS ===
    # Left arm (extended forward)
    rect(34, 48, 42, 84, SKIN)
    rect(34, 50, 36, 78, GLOVE)
    rect(42, 82, 46, 86, SKIN)  # hand
    
    # Right arm (raised with sword)
    rect(86, 44, 94, 78, SKIN)
    rect(92, 46, 94, 74, GLOVE)
    rect(86, 76, 90, 80, SKIN)  # hand

    # === SWORD ===
    # Blade
    rect(100, 6, 104, 44, (160,165,175))
    rect(102, 8, 104, 42, (200,205,215))
    rect(104, 10, 106, 40, (235,238,245))
    # Blade tip
    rect(100, 4, 104, 8, (190,195,205))
    rect(102, 2, 104, 6, (220,225,235))
    # Guard
    rect(98, 44, 108, 48, (50,50,56))
    rect(100, 44, 106, 48, (70,70,78))
    # Grip
    rect(100, 48, 106, 56, (28,28,32))
    rect(100, 52, 106, 54, (22,22,26))  # grip wrap
    # Pommel
    rect(100, 56, 106, 58, (50,50,56))
    px(103, 58, GOLD)

    # === NECK ===
    rect(60, 34, 68, 44, SKIN)
    rect(60, 36, 64, 42, SKIN_S)

    # === HEAD (slightly tilted for dynamic look) ===
    ellipse(64, 20, 28, 30, SKIN)
    rect(40, 38, 88, 44, SKIN_S)
    
    # Light blush
    rect(42, 30, 48, 34, CHEEK)
    rect(80, 30, 86, 34, CHEEK)

    # === HAIR (wind-blown) ===
    # Back hair
    rect(32, 2, 42, 34, HAIR_S)
    rect(86, 2, 96, 34, HAIR_S)
    rect(30, 6, 32, 28, HAIR_SS)
    rect(94, 8, 96, 30, HAIR_SS)
    # Wind-blown strand
    rect(28, 8, 32, 16, HAIR_SS)
    rect(96, 4, 98, 24, HAIR_SS)
    
    # Side hair (messy/wind-blown)
    rect(34, 4, 38, 18, HAIR)
    rect(88, 4, 94, 18, HAIR)
    rect(94, 4, 98, 12, HAIR_S)  # blowing strand

    # Top hair
    rect(38, 0, 90, 4, HAIR)
    rect(40, 0, 88, 2, HAIR_L)
    
    # Bangs (parted, wind-blown)
    rect(38, 4, 50, 12, HAIR)
    rect(40, 6, 48, 14, HAIR_S)
    rect(78, 4, 92, 12, HAIR)
    rect(80, 6, 90, 14, HAIR_S)
    
    # Center bangs (parted)
    rect(50, 4, 62, 12, HAIR)
    rect(52, 6, 60, 14, HAIR_S)
    rect(66, 4, 78, 12, HAIR)
    rect(68, 6, 76, 14, HAIR_S)
    # Parting gap
    rect(62, 6, 66, 10, NONE)
    
    # Wind-blown front strand
    rect(42, 4, 44, 8, HAIR_S)
    rect(84, 4, 86, 8, HAIR_S)
    
    # Hair shine
    rect(46, 0, 50, 2, (248, 248, 255))
    rect(78, 0, 82, 2, (248, 248, 255))

    # === HEADBAND ===
    rect(36, 10, 40, 13, HEADBAND)
    rect(40, 10, 88, 13, HEADBAND)
    rect(88, 10, 92, 13, HEADBAND)
    rect(60, 8, 68, 10, GOLD)

    # === BLINDFOLD (partially torn - right eye exposed) ===
    rect(42, 16, 50, 20, BAND)
    rect(50, 16, 62, 20, BAND)
    rect(76, 16, 88, 20, BAND)
    # Torn gap - right side exposed
    # (62-76 is the tear where right eye shows)
    
    # === EYES ===
    # Left eye (hint under blindfold)
    rect(50, 18, 56, 22, EYE_W)
    rect(52, 18, 54, 22, EYE_B)
    px(54, 19, EYE_P)
    
    # Right eye (exposed, intense)
    rect(70, 18, 80, 26, EYE_W)
    rect(72, 20, 78, 26, EYE_B_S)
    rect(74, 22, 76, 25, EYE_P)
    px(76, 22, EYE_L)
    px(78, 20, EYE_L2)
    # Strong eyeliner
    rect(70, 18, 72, 20, (10,10,18))
    rect(80, 18, 82, 20, (10,10,18))

    # === NOSE ===
    px(64, 28, NOSE)
    
    # === MOUTH (confident smirk) ===
    rect(54, 32, 60, 34, MOUTH)
    rect(68, 32, 74, 34, MOUTH)
    px(64, 32, MOUTH)
    px(62, 33, MOUTH)

    # === COLLAR ===
    rect(44, 34, 52, 38, (44,44,52))
    rect(76, 34, 84, 38, (44,44,52))

    # === BATTLE EFFECTS ===
    # Speed lines
    rect(22, 60, 26, 64, (60,60,70,20))
    rect(20, 66, 24, 70, (50,50,60,15))
    rect(24, 72, 28, 76, (55,55,65,12))
    
    # Small sparkles
    px(108, 2, (200,220,255,40))
    px(110, 4, (180,200,240,30))
    px(106, 0, (220,230,255,25))
    
    # Shadow
    rect(36, 152, 96, 154, (0,0,0,8))


if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)
    
    SCALE = 2  # 128x164 * 2 = 256x328, then we crop to 256x256
    
    designs = [
        ("2b_classic_pixel.png", draw_classic),
        ("2b_cute_pixel.png", draw_cute),
        ("2b_battle_pixel.png", draw_battle),
    ]
    
    for name, draw_fn in designs:
        # Create 128x164 canvas
        canvas = Image.new('RGBA', (128, 164), (0, 0, 0, 0))
        draw_fn(canvas)
        
        # Scale up
        scaled = canvas.resize((256, 328), Image.NEAREST)
        
        # Crop to 256x256 (center vertically, shift up for head focus)
        final = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
        y_off = -20  # Shift up to center head
        final.paste(scaled, (0, y_off))
        
        path = os.path.join(OUT_DIR, name)
        final.save(path, 'PNG')
        print(f"  ✓ {name}: {final.size}")
    
    print("\nDone! 3 high-detail 2B chibis at 128x164 base resolution.")
