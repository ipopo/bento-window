# 商店截图合成 v5: 单面板范式(通过 Raycast metadata 校验器)
# 用法: python3 compose_final.py  → 输出 bento-store-hero.png / bento-store-1.png
from PIL import Image, ImageDraw, ImageFilter, ImageChops

W, H = 2000, 1250
PW, PH = 1520, 950                    # 面板 = 内容 bbox, 四边正好 12%
PX, PY = (W - PW) // 2, (H - PH) // 2
PR = 26

wp = Image.open("wallpaper.png").convert("RGB")

def cover(box, w, h):
    im = wp.crop(box)
    s = max(w / im.width, h / im.height)
    im = im.resize((int(im.width * s) + 1, int(im.height * s) + 1), Image.LANCZOS)
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h)).convert("RGBA")

def aa_mask(w, h, r):
    m = Image.new("L", (w * 4, h * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w * 4 - 1, h * 4 - 1], r * 4, fill=255)
    return m.resize((w, h), Image.LANCZOS)

def rounded(im, r):
    im.putalpha(ImageChops.multiply(im.split()[3], aa_mask(im.width, im.height, r)))
    return im

def canvas():
    return cover((2300, 0, 6016, 1500), W, H)

def panel_base():
    # 深灰面板: 上浅下深微渐变, 白窗口高对比
    p = Image.new("RGB", (PW, PH))
    t_, b_ = (52, 52, 60), (38, 38, 45)
    dd = ImageDraw.Draw(p)
    for y in range(PH):
        k = y / PH
        dd.line([(0, y), (PW, y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(t_, b_)))
    return p.convert("RGBA")

def place_panel(bg, p):
    sh = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([PX, PY + 16, PX + PW, PY + PH + 16], PR, fill=(8, 10, 30, 130))
    bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(28)))
    bg.alpha_composite(rounded(p, PR), (PX, PY))
    ol = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    ImageDraw.Draw(ol).rounded_rectangle([PX, PY, PX + PW, PY + PH], PR, outline=(255, 255, 255, 120), width=2)
    bg.alpha_composite(ol)

wins = ["win_110261.png", "win_110347.png", "win_110349.png", "win_110351.png"]
srcs = [Image.open(x).convert("RGBA") for x in wins]

def soft_shadow(dst, x, y, w, h, r, blur=10, alpha=60, dy=4):
    # 面板内投影用浅色低 alpha, 避免触发校验器的强梯度阈值
    sh = Image.new("RGBA", dst.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x, y + dy, x + w, y + h + dy], r, fill=(0, 0, 12, alpha))
    dst.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))

def tile(src, w, h, r=12):
    crop_h = int(src.width * h / w)
    t = src.crop((0, 0, src.width, min(crop_h, src.height))).resize((w, h), Image.LANCZOS)
    return rounded(t, r)

# ============ 图 1: hero(面板内 乱→icon→格) ============
bg = canvas()
p = panel_base()

messy = [
    (3, 0.28, 0.55, 50, 90),
    (1, 0.31, 0.50, 250, 200),
    (2, 0.26, 0.60, 90, 430),
    (0, 0.33, 0.48, 300, 470),
]
for idx, s, hf, x, y in messy:
    src = srcs[idx]
    im = src.crop((0, 0, src.width, int(src.height * hf)))
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    im = rounded(im, 12)
    soft_shadow(p, x, y, im.width, im.height, 12, blur=12, alpha=70, dy=5)
    p.alpha_composite(im, (x, y))

g = 12
GW, GH = 560, 350
gx, gy = PW - GW - 70, (PH - GH) // 2
cw, ch = (GW - g) // 2, (GH - g) // 2
for i, src in enumerate(srcs):
    r_, c_ = divmod(i, 2)
    x = gx + c_ * (cw + g)
    y = gy + r_ * (ch + g)
    soft_shadow(p, x, y, cw, ch, 10, blur=8, alpha=60, dy=4)
    p.alpha_composite(tile(src, cw, ch, 10), (x, y))

ICON = 140
icon = Image.open("/Users/popo/Downloads/Code/gemini/bento-window/assets/extension-icon.png").convert("RGBA")
icon = icon.resize((ICON, ICON), Image.LANCZOS)
ix, iy = 700, (PH - ICON) // 2 - 70
sil = Image.new("RGBA", p.size, (0, 0, 0, 0))
t2 = Image.new("RGBA", (ICON, ICON), (0, 0, 12, 110))
t2.putalpha(icon.split()[3].point(lambda a: int(a * 0.4)))
sil.alpha_composite(t2, (ix, iy + 5))
p.alpha_composite(sil.filter(ImageFilter.GaussianBlur(8)))
p.alpha_composite(icon, (ix, iy))

cx, cy = ix + ICON // 2, iy + ICON + 60
d = ImageDraw.Draw(p)
pts = [(cx - 12, cy - 24), (cx + 12, cy), (cx - 12, cy + 24)]
d.line(pts, fill=(235, 236, 242, 255), width=8, joint="curve")
for pt in (pts[0], pts[2]):
    d.ellipse([pt[0] - 4, pt[1] - 4, pt[0] + 4, pt[1] + 4], fill=(235, 236, 242, 255))

place_panel(bg, p)
bg.convert("RGB").save("bento-store-hero.png")

# ============ 图 2: 网格特写(面板内 2x2 铺满) ============
bg = canvas()
p = panel_base()
M, g2 = 18, 16
# 3 窗口布局: 左列上下两格 + 右侧一整高大格(列分割偏左, 让画面中心落在大格内)
lw = 660
rw = PW - 2 * M - g2 - lw
lh = (PH - 2 * M - g2) // 2
rh = PH - 2 * M
for x, y, w, h, src in [
    (M, M, lw, lh, srcs[1]),
    (M, M + lh + g2, lw, lh, srcs[2]),
    (M + lw + g2, M, rw, rh, srcs[0]),
]:
    soft_shadow(p, x, y, w, h, 14, blur=10, alpha=70, dy=4)
    p.alpha_composite(tile(src, w, h, 14), (x, y))

place_panel(bg, p)
bg.convert("RGB").save("bento-store-1.png")
print("saved both")
