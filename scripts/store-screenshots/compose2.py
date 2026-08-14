# 合成对比图 v3: Sonoma 壁纸 + 双屏 + icon + chevron, 苹果风
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 2000, 1250
SCR_W, SCR_H = 820, 512
SCR_R = 22
SCR_Y = (H - SCR_H) // 2
LEFT_X, RIGHT_X = 60, W - 60 - SCR_W
WIN_R = 12

wp = Image.open("wallpaper.png").convert("RGB")   # Sonoma

def cover(box, w, h):
    # 从壁纸取 box 区域, 等比覆盖缩放到 w x h
    im = wp.crop(box)
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h)).convert("RGBA")

# 画布: 天空区域(蓝紫丝绸波浪)
bg = cover((2300, 0, 6016, 1500), W, H)

wins = ["win_110261.png", "win_110347.png", "win_110349.png", "win_110351.png"]
srcs = [Image.open(p).convert("RGBA") for p in wins]

def aa_mask(w, h, r):
    # 4x 超采样画圆角遮罩再缩小, 消除锯齿
    m = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * 4 - 1, h * 4 - 1], r * 4, fill=255)
    return m.resize((w, h), Image.LANCZOS)

def rounded(im, r):
    # 遮罩与原 alpha 相乘, 保留截图自带的抗锯齿圆角
    im.putalpha(ImageChops.multiply(im.split()[3], aa_mask(im.width, im.height, r)))
    return im

def win_shadow(canvas, x, y, w, h, blur=10, alpha=100, dy=4, r=WIN_R):
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x, y + dy, x + w, y + h + dy], r, fill=(0, 0, 0, alpha))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))

# 屏幕内部: 同一片天空的近景裁切, 稍有位移做出差异
def screen_base(ox):
    return cover((ox, 260, ox + 2600, 1340), SCR_W, SCR_H)

# ---- 左屏: 凌乱 ----
left = screen_base(200)
messy = [
    (3, 0.30, 0.60, -30, 30),
    (1, 0.33, 0.52, 330, 60),
    (2, 0.27, 0.65, 60, 260),
    (0, 0.36, 0.50, 420, 210),
]
for idx, s, hf, x, y in messy:
    src = srcs[idx]
    im = src.crop((0, 0, src.width, int(src.height * hf)))
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    im = rounded(im, WIN_R)
    win_shadow(left, x, y, im.width, im.height, blur=12, alpha=120, dy=6)
    left.alpha_composite(im, (x, y))
left = rounded(left, SCR_R)

# ---- 右屏: bento 网格铺满 ----
right = screen_base(900)
g = 10
cw = (SCR_W - g * 3) // 2
ch = (SCR_H - g * 3) // 2
for i, src in enumerate(srcs):
    r_, c_ = divmod(i, 2)
    crop_h = int(src.width * ch / cw)
    im = src.crop((0, 0, src.width, min(crop_h, src.height)))
    im = im.resize((cw, ch), Image.LANCZOS)
    im = rounded(im, WIN_R)
    x = g + c_ * (cw + g)
    y = g + r_ * (ch + g)
    win_shadow(right, x, y, cw, ch, blur=8, alpha=80, dy=3)
    right.alpha_composite(im, (x, y))
right = rounded(right, SCR_R)

# ---- 上屏幕: 大投影 + 细白描边 ----
def place_screen(canvas, scr, x, y):
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x, y + 16, x + SCR_W, y + SCR_H + 16], SCR_R, fill=(0, 0, 30, 120))
    canvas.alpha_composite(sh.filter(ImageFilter.GaussianBlur(30)))
    canvas.alpha_composite(scr, (x, y))
    ol = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(ol).rounded_rectangle(
        [x, y, x + SCR_W, y + SCR_H], SCR_R, outline=(255, 255, 255, 90), width=2)
    canvas.alpha_composite(ol)

place_screen(bg, left, LEFT_X, SCR_Y)
place_screen(bg, right, RIGHT_X, SCR_Y)

# ---- 中间: icon(无底板, 带自身轮廓投影) + 细 chevron ----
ax, ay = W // 2, H // 2
ICON = 168
icon = Image.open("/Users/popo/Downloads/Code/gemini/bento-window/assets/extension-icon.png").convert("RGBA")
icon = icon.resize((ICON, ICON), Image.LANCZOS)
ix, iy = ax - ICON // 2, ay - ICON - 24
sil = Image.new("RGBA", bg.size, (0, 0, 0, 0))
tint = Image.new("RGBA", (ICON, ICON), (10, 10, 35, 90))
tint.putalpha(icon.split()[3].point(lambda a: int(a * 0.4)))
sil.alpha_composite(tint, (ix, iy + 6))
bg.alpha_composite(sil.filter(ImageFilter.GaussianBlur(9)))
bg.alpha_composite(icon, (ix, iy))

# chevron: 白色细折线, 带淡投影
ch_l = Image.new("RGBA", bg.size, (0, 0, 0, 0))
cd = ImageDraw.Draw(ch_l)
pts = [(ax - 13, ay + 32), (ax + 13, ay + 58), (ax - 13, ay + 84)]
cd.line(pts, fill=(0, 0, 30, 70), width=9, joint="curve")
sh = ch_l.filter(ImageFilter.GaussianBlur(4))
bg.alpha_composite(sh, (0, 3))
ch_l = Image.new("RGBA", bg.size, (0, 0, 0, 0))
cd = ImageDraw.Draw(ch_l)
cd.line(pts, fill=(255, 255, 255, 235), width=9, joint="curve")
for p in (pts[0], pts[2]):
    cd.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=(255, 255, 255, 235))
bg.alpha_composite(ch_l)

bg.convert("RGB").save("bento-store-hero.png")
print("saved")
