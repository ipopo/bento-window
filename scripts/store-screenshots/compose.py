# 合成 Raycast 商店截图: 4 个 Claude Code 窗口按 bento 2x2 网格排布
from PIL import Image, ImageDraw, ImageFilter

W, H = 2000, 1250
MARGIN, GAP = 22, 22
RADIUS = 20          # 重新圆角的半径(缩放后尺寸)
SHADOW_BLUR = 16
SHADOW_ALPHA = 110

cell_w = (W - 2 * MARGIN - GAP) // 2
cell_h = (H - 2 * MARGIN - GAP) // 2

# 背景: 深色垂直渐变
bg = Image.new("RGB", (W, H))
top, bot = (23, 23, 28), (12, 12, 15)
for y in range(H):
    t = y / H
    c = tuple(int(a + (b - a) * t) for a, b in zip(top, bot))
    ImageDraw.Draw(bg).line([(0, y), (W, y)], fill=c)
bg = bg.convert("RGBA")

wins = ["win_110261.png", "win_110347.png", "win_110349.png", "win_110351.png"]

def make_tile(path):
    im = Image.open(path).convert("RGBA")
    # 按格子比例裁掉底部空白，保留窗口顶部内容
    crop_h = int(im.width * cell_h / cell_w)
    im = im.crop((0, 0, im.width, min(crop_h, im.height)))
    im = im.resize((cell_w, cell_h), Image.LANCZOS)
    # 四角统一重新圆角
    mask = Image.new("L", (cell_w, cell_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, cell_w - 1, cell_h - 1], RADIUS, fill=255)
    im.putalpha(mask)
    return im

def paste_with_shadow(canvas, tile, x, y):
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [x, y + 5, x + cell_w, y + cell_h + 5], RADIUS, fill=(0, 0, 0, SHADOW_ALPHA))
    sh = sh.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))
    canvas.alpha_composite(sh)
    canvas.alpha_composite(tile, (x, y))

for i, path in enumerate(wins):
    r, c = divmod(i, 2)
    x = MARGIN + c * (cell_w + GAP)
    y = MARGIN + r * (cell_h + GAP)
    paste_with_shadow(bg, make_tile(path), x, y)

bg.convert("RGB").save("bento-store-1.png")
print("saved bento-store-1.png", bg.size)
