"""Steam/Windows 실행 파일 아이콘 생성기.

실행: py -3 scripts/store/make-icon.py
출력: build/icon.ico (16·24·32·40·48·64·128·256px, electron-builder가 실행 파일에 넣음),
      build/icon.png (512px, 개발 실행 창 아이콘), dist/icon-preview.png (크기별 확인용),
      docs/steam-store/icons/ (Steamworks › 커뮤니티 및 클라이언트 아이콘에 올리는 파일)
        - app_icon_184x184.jpg: 앱 아이콘. 라이브러리 목록·채팅·알림의 작은 자리에 쓰이고 JPG라 투명이 없어
          모서리 없이 꽉 찬 정사각형에 모자·눈 위주로 그립니다.
        - shortcut_icon_256x256.png / shortcut_icon.ico: 바탕 화면 바로 가기 아이콘(ico에는 32px 포함 여러 크기).

마법사 원화(assets/art/paper-mage-poses.png 첫 자세)를 종이 판 위에 올립니다.
- 48px 이상: 모자·노란 눈·보석 지팡이까지 보이는 상반신.
- 32px 이하: 실루엣이 뭉개지지 않도록 모자와 노란 눈만 크게 잘라 씁니다(Microsoft 아이콘 지침: 작은 크기는 따로 다듬음).
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets' / 'art' / 'paper-mage-poses.png'
OUT_DIR = ROOT / 'build'
S = 1024  # 작업 해상도(축소해서 각 크기를 만듭니다)

# 첫 자세(왼쪽 위 칸)에서 자를 정사각형 영역 (left, top, size)
CROP_LARGE = (150, 112, 445)  # 상반신 + 지팡이 보석
CROP_SMALL = (228, 138, 250)  # 모자 + 눈(얼굴 쪽으로 바짝)

PAPER = (244, 230, 200, 255)       # 종이 테두리(크림색)
PLATE_DARK = (38, 14, 18)          # 판 바깥쪽(어두운 적갈색)
PLATE_GLOW = (226, 92, 28)         # 판 가운데 불빛


def rounded_mask(size, inset, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle((inset, inset, size - 1 - inset, size - 1 - inset), radius=radius, fill=255)
    return m


def radial_plate(size, center, dark, glow):
    """가운데가 밝은 불빛 그라데이션(작업 해상도의 1/8로 그려 확대)."""
    n = size // 8
    g = Image.new('RGB', (n, n))
    px = g.load()
    cx, cy = center[0] * n, center[1] * n
    for y in range(n):
        for x in range(n):
            d = min(1.0, (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / (n * 0.62))
            t = (1 - d) ** 1.6
            px[x, y] = tuple(int(dark[i] + (glow[i] - dark[i]) * t) for i in range(3))
    return g.resize((size, size), Image.BICUBIC)


def sticker(subject, outline):
    """종이 오려 붙인 느낌: 대상 둘레에 크림색 테두리와 그림자를 붙입니다."""
    a = subject.getchannel('A').point(lambda v: 255 if v > 96 else 0)
    grown = a.filter(ImageFilter.MaxFilter(outline * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2))
    layer = Image.new('RGBA', subject.size, (0, 0, 0, 0))
    shadow = Image.new('RGBA', subject.size, (20, 6, 8, 0))
    shadow.putalpha(grown.filter(ImageFilter.GaussianBlur(outline)).point(lambda v: int(v * 0.55)))
    layer.alpha_composite(shadow, (outline // 2, outline))
    rim = Image.new('RGBA', subject.size, PAPER)
    rim.putalpha(grown)
    layer.alpha_composite(rim)
    layer.alpha_composite(subject)
    return layer


def render(crop, fill, outline, inset_ratio, border_ratio, glow_center, radius_ratio=0.2):
    sheet = Image.open(SRC).convert('RGBA')
    left, top, size = crop
    subject = sheet.crop((left, top, left + size, top + size))
    # 원화 가장자리의 붉은 반투명 번짐을 정리합니다.
    alpha = subject.getchannel('A').point(lambda v: 0 if v < 40 else v)
    subject.putalpha(alpha)

    inset = int(S * inset_ratio)
    radius = int(S * radius_ratio)
    border = int(S * border_ratio)

    icon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    # 판 그림자 → 크림색 종이 테두리 → 불빛 판
    shade = rounded_mask(S, inset, radius).filter(ImageFilter.GaussianBlur(S * 0.012))
    shadow = Image.new('RGBA', (S, S), (10, 3, 4, 0))
    shadow.putalpha(shade.point(lambda v: int(v * 0.5)))
    icon.alpha_composite(shadow, (0, int(S * 0.012)))
    rim = Image.new('RGBA', (S, S), PAPER)
    rim.putalpha(rounded_mask(S, inset, radius))
    icon.alpha_composite(rim)
    plate_mask = rounded_mask(S, inset + border, max(0, radius - border))
    plate = radial_plate(S, glow_center, PLATE_DARK, PLATE_GLOW).convert('RGBA')
    plate.putalpha(plate_mask)
    icon.alpha_composite(plate)

    # 대상은 판 안쪽에 맞추고, 판 밖으로 나간 부분은 잘라 냅니다(아래쪽 망토는 판에 닿아도 됨).
    target = int((S - 2 * (inset + border)) * fill)
    subj = sticker(subject.resize((target, target), Image.LANCZOS), outline)
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ox = (S - target) // 2
    oy = S - inset - border - target + int(S * 0.02)
    layer.alpha_composite(subj, (ox, oy))
    layer.putalpha(ImageChops.multiply(layer.getchannel('A'), plate_mask))
    icon.alpha_composite(layer)
    return icon


def main():
    OUT_DIR.mkdir(exist_ok=True)
    large = render(CROP_LARGE, fill=1.02, outline=10, inset_ratio=0.03, border_ratio=0.045, glow_center=(0.62, 0.36))
    small = render(CROP_SMALL, fill=1.08, outline=16, inset_ratio=0.0, border_ratio=0.06, glow_center=(0.55, 0.6))

    sizes = [16, 24, 32, 40, 48, 64, 128, 256]
    frames = []
    for n in sizes:
        src = small if n <= 32 else large
        im = src.resize((n, n), Image.LANCZOS)
        if n <= 32:
            # 작은 크기는 축소로 흐려진 윤곽을 살짝 살립니다.
            im = im.filter(ImageFilter.UnsharpMask(radius=0.6, percent=80, threshold=1))
        frames.append(im)
    big = frames[-1]
    big.save(OUT_DIR / 'icon.ico', format='ICO', sizes=[(n, n) for n in sizes], append_images=frames[:-1])
    large.resize((512, 512), Image.LANCZOS).save(OUT_DIR / 'icon.png')

    steam = ROOT / 'docs' / 'steam-store' / 'icons'
    steam.mkdir(exist_ok=True)
    app_icon = render(CROP_SMALL, fill=1.0, outline=12, inset_ratio=0.0, border_ratio=0.0,
                      glow_center=(0.55, 0.6), radius_ratio=0.0)
    app_icon.convert('RGB').resize((184, 184), Image.LANCZOS).save(steam / 'app_icon_184x184.jpg', quality=95, subsampling=0)
    frames[-1].save(steam / 'shortcut_icon_256x256.png')
    big.save(steam / 'shortcut_icon.ico', format='ICO', sizes=[(n, n) for n in sizes], append_images=frames[:-1])

    # 확인용 미리보기: 실제 크기 + 4배 확대(픽셀 그대로)
    preview = Image.new('RGBA', (1400, 560), (46, 46, 52, 255))
    x = 20
    for im in frames:
        preview.alpha_composite(im, (x, 20))
        x += im.width + 16
    x = 20
    for im in frames[:5]:
        z = im.resize((im.width * 4, im.height * 4), Image.NEAREST)
        preview.alpha_composite(z, (x, 300))
        x += z.width + 16
    (ROOT / 'dist').mkdir(exist_ok=True)
    preview.save(ROOT / 'dist' / 'icon-preview.png')
    print('ICON_RESULT', OUT_DIR / 'icon.ico')


if __name__ == '__main__':
    main()
