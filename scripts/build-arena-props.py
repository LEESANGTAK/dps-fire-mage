"""배경 원화에서 상호작용 소품 조각을 잘라 냅니다.

원화 위에 새 소품을 따로 그려 얹으면 그림체가 어긋나므로(2026-10-04 배경 연출 제거 이력),
움직이는 소품은 반드시 원화 픽셀을 잘라 낸 조각만 씁니다.

출력:
- assets/art/props/mine-crystals.png        폐광 수정 군락(투명 배경, 원화 좌표 상자 그대로)
- assets/art/props/mine-crystals-broken.png 부서진 뒤 모습(빈자리를 주변 바위로 메우고 밑동만 남김, 불투명 패치)
- assets/art/props/citadel-flames.png       성채 화로 불꽃 조각을 가로로 이어 붙인 아틀라스
- src/scripts/arena-props-data.js           조각 좌표(원화 1536×1024 기준)

실행: py -3 scripts/build-arena-props.py
"""
import json
import os

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.path.join(ROOT, 'assets', 'art')
OUT = os.path.join(ART, 'props')


def load(name):
    rgb = np.array(Image.open(os.path.join(ART, name)).convert('RGB'))
    return rgb, cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(int)


def components(mask, min_area):
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8))
    return [tuple(int(v) for v in stats[i]) for i in range(1, n) if stats[i, 4] >= min_area]


def grow(mask, px):
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (px * 2 + 1, px * 2 + 1))
    return cv2.dilate(mask.astype(np.uint8), kernel) > 0


def bbox(mask, pad=2):
    ys, xs = np.nonzero(mask)
    x0, y0 = max(0, xs.min() - pad), max(0, ys.min() - pad)
    x1, y1 = xs.max() + pad + 1, ys.max() + pad + 1
    return int(x0), int(y0), int(x1 - x0), int(y1 - y0)


def cutout(rgb, mask, box):
    x, y, w, h = box
    alpha = (mask[y:y + h, x:x + w] * 255).astype(np.uint8)
    # 가장자리 1px만 살짝 흐려 계단 현상을 줄입니다.
    alpha = cv2.GaussianBlur(alpha, (3, 3), 0)
    return Image.fromarray(np.dstack([rgb[y:y + h, x:x + w], alpha]), 'RGBA')


def build_crystals():
    rgb, hsv = load('paper-arena-mine.png')
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    raw = (h >= 85) & (h <= 115) & (s > 70) & (v > 110)
    raw[:, :1250] = False
    # 수정 몸체마다 따로 잡아 두면 부서질 때 결정마다 파편을 낼 수 있습니다.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(raw.astype(np.uint8))
    bodies = [(i,) + tuple(int(v) for v in stats[i]) for i in range(1, n) if stats[i, 4] >= 150]
    mask = np.zeros(raw.shape, bool)
    for _, x, y, w, h_, _ in bodies:
        mask[y:y + h_, x:x + w] |= raw[y:y + h_, x:x + w]
    # 수정 외곽의 잉크선까지 포함하도록 조금 넓힙니다. 앞을 가리는 바위는 원래 마스크 밖이라 넓혀도 덮지 않습니다.
    mask = grow(mask, 3) & ~((v < 40) & ~grow(mask, 1))
    box = bbox(mask)
    cutout(rgb, mask, box).save(os.path.join(OUT, 'mine-crystals.png'))

    # 부서진 모습: 수정이 빠져나간 자리를 어두운 '오려 낸 구멍'으로 남깁니다.
    # 뒤에 나무 기둥·동굴 벽·바위가 섞여 있어 주변 질감을 옮겨 메우면 어색했습니다(inpaint는 번지고, 질감 복사는 기둥이 끼어듦).
    # 평면 셀 채색 그림체에 맞춰 단색 + 위아래 약한 명암 + 원래 잉크 외곽선만 둡니다.
    fill = rgb.copy()
    # 결정 사이의 작은 바위 틈은 구멍 안에 섬처럼 남아 지저분해 보이므로 닫기 연산으로 메웁니다.
    solid = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    outside = solid.copy()
    cv2.floodFill(outside, np.zeros((outside.shape[0] + 2, outside.shape[1] + 2), np.uint8), (0, 0), 1)
    solid = (solid > 0) | (outside == 0)
    inner = cv2.erode(solid.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    ys, xs = np.nonzero(inner)
    y0, y1 = ys.min(), ys.max()
    shade = (1 - (ys - y0) / max(1, y1 - y0)) * 10
    base_color = np.array([58, 54, 68], float)
    fill[ys, xs] = np.clip(base_color[None] + shade[:, None], 0, 255).astype(np.uint8)
    ink = solid & ~inner
    fill[ink] = (fill[ink] * .35 + np.array([28, 22, 34]) * .65).astype(np.uint8)
    # 결정마다 아래 30%를 비스듬한 단면 하나로 잘린 밑동으로 남깁니다(톱니 노이즈는 종이 그림체와 맞지 않음).
    rng = np.random.default_rng(7)
    stumps = []
    # 밑동은 그 결정 자신의 픽셀(라벨)과 외곽선만 되살립니다. 상자로 고르면 이웃 결정 조각이 섞입니다.
    for label, x, y, w, h_, _ in bodies:
        own = grow(labels == label, 3) & mask
        base = y + h_
        cut = base - max(7, int(h_ * .3))
        slope = rng.uniform(-.35, .35)
        notch = rng.uniform(.3, .7)
        xs = np.arange(x, x + w)
        line = cut + slope * (xs - (x + w / 2)) - 4 * np.maximum(0, 1 - abs((xs - x) / max(1, w) - notch) * 6)
        for i, cx in enumerate(xs):
            top = int(round(line[i]))
            rows = np.arange(max(y, top), base)
            sel = own[rows, cx]
            fill[rows[sel], cx] = rgb[rows[sel], cx]
            # 단면은 밝은 하늘색 한 줄로 그어 깨진 면임을 읽히게 합니다.
            if 0 <= top < fill.shape[0] and (labels[top, cx] == label):
                fill[top:top + 2, cx] = (196, 238, 250)
        stumps.append([x, int(line.min()), w, base - int(line.min())])
    x, y, w, h_ = box
    Image.fromarray(fill[y:y + h_, x:x + w]).save(os.path.join(OUT, 'mine-crystals-broken.png'))
    return {
        'box': list(box),
        'bodies': [[x, y, w, h_] for _, x, y, w, h_, _ in bodies],
        'stumps': stumps,
    }


# 성채 원화의 화로 불꽃 위치(원화 좌표, 확인용 근사값). 탐지 결과 중 이 근처 덩어리만 씁니다.
CITADEL_FLAMES = [
    ('left', (95, 320), True),
    ('center-left', (634, 292), True),
    ('center-right', (885, 292), True),
    ('right', (1474, 340), True),
    ('small-1', (362, 378), False),
    ('small-2', (565, 359), False),
    ('small-3', (958, 358), False),
    ('small-4', (1170, 378), False),
]


def build_flames():
    rgb, hsv = load('paper-arena-citadel.png')
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    raw = (h <= 28) & (s > 120) & (v > 200)
    raw[:240] = False
    raw[430:] = False
    found = components(raw, 60)
    sprites, frames = [], []
    for name, (px, py), clickable in CITADEL_FLAMES:
        hit = [c for c in found if c[0] <= px <= c[0] + c[2] and c[1] <= py <= c[1] + c[3]]
        if not hit:
            raise SystemExit(f'불꽃을 찾지 못했습니다: {name}')
        x, y, w, h_, _ = min(hit, key=lambda c: c[4])
        mask = np.zeros(raw.shape, bool)
        mask[y:y + h_, x:x + w] = raw[y:y + h_, x:x + w]
        mask = grow(mask, 2)
        box = bbox(mask)
        sprites.append(cutout(rgb, mask, box))
        frames.append({'id': name, 'box': list(box), 'clickable': clickable})
    atlas = Image.new('RGBA', (sum(im.width for im in sprites) + 2 * len(sprites), max(im.height for im in sprites)))
    ox = 0
    for im, frame in zip(sprites, frames):
        atlas.paste(im, (ox, 0))
        frame['src'] = [ox, 0, im.width, im.height]
        ox += im.width + 2
    atlas.save(os.path.join(OUT, 'citadel-flames.png'))
    return frames


def grabcut(rgb, rect, sure=(), maybe=(), iters=6, bg_sat=None):
    """사각형 안에서 물체만 분리합니다. sure: 반드시 물체인 사각형, maybe: 물체일 가능성이 큰 사각형."""
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    mask = np.full(rgb.shape[:2], cv2.GC_BGD, np.uint8)
    x0, y0, x1, y1 = rect
    mask[y0:y1, x0:x1] = cv2.GC_PR_BGD
    # 사각형 안쪽 여백을 뺀 중심부는 물체일 가능성이 큰 쪽으로 시작합니다.
    mask[y0 + 3:y1 - 3, x0 + 3:x1 - 3] = cv2.GC_PR_FGD
    for a, b, c, d in maybe:
        mask[b:d, a:c] = cv2.GC_PR_FGD
    if bg_sat is not None:
        # 채도가 높은 픽셀(예: 하늘 띠)을 확실한 배경으로 못 박습니다.
        sat = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)[..., 1]
        box = np.zeros(mask.shape, bool)
        box[y0:y1, x0:x1] = True
        mask[box & (sat > bg_sat)] = cv2.GC_BGD
    if not sure:
        # 작은 파편은 사각형만으로는 통째로 배경으로 분류될 수 있어 중심부를 물체로 못 박습니다.
        w, h = x1 - x0, y1 - y0
        sure = ((x0 + int(w * .38), y0 + int(h * .35), x1 - int(w * .38), y1 - int(h * .35)),)
    for a, b, c, d in sure:
        mask[b:d, a:c] = cv2.GC_FGD
    bg, fg = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    cv2.grabCut(bgr, mask, None, bg, fg, iters, cv2.GC_INIT_WITH_MASK)
    m = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)
    # 가장 큰 덩어리와 그에 붙은 것만 남깁니다(사각형 귀퉁이의 잡티 제거).
    n, labels, stats, _ = cv2.connectedComponentsWithStats(m.astype(np.uint8))
    if n > 1:
        keep = 1 + int(np.argmax(stats[1:, 4]))
        m = labels == keep
    return m


class Atlas:
    """조각들을 한 장에 가로로 이어 붙입니다(줄이 넘치면 다음 줄)."""

    def __init__(self, name, width=2048):
        self.name, self.width, self.items = name, width, []

    def add(self, image):
        self.items.append(image)
        return len(self.items) - 1

    def save(self):
        x = y = row = 0
        places = []
        for im in self.items:
            if x + im.width > self.width:
                x, y, row = 0, y + row + 2, 0
            places.append([x, y, im.width, im.height])
            x += im.width + 2
            row = max(row, im.height)
        sheet = Image.new('RGBA', (self.width, y + row), (0, 0, 0, 0))
        for im, (px, py, _, _) in zip(self.items, places):
            sheet.paste(im, (px, py))
        sheet.save(os.path.join(OUT, f'{self.name}.png'), optimize=True)
        return places


def moving_pieces(file, pieces, atlas_name):
    """움직이는 조각과 그 밑판(조각이 움직일 때 드러나는 자리를 주변 배경으로 메운 판)을 만듭니다.
    움직임 폭이 작아 밑판은 가장자리 몇 px만 보이므로 inpaint로 충분합니다."""
    rgb = np.array(Image.open(os.path.join(ART, file)).convert('RGB'))
    masks = {}
    for p in pieces:
        if 'mask' in p:
            masks[p['id']] = p['mask'](rgb)
        else:
            masks[p['id']] = grabcut(rgb, p['rect'], p.get('sure', ()), p.get('maybe', ()), bg_sat=p.get('bg_sat'))
        if 'clip_above' in p:
            masks[p['id']][:p['clip_above']] = False
        for a, b, c, d in p.get('clip', ()):
            masks[p['id']][b:d, a:c] = False
    union = np.zeros(rgb.shape[:2], bool)
    for m in masks.values():
        union |= m
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    under_full = cv2.cvtColor(cv2.inpaint(bgr, grow(union, 4).astype(np.uint8) * 255, 7, cv2.INPAINT_TELEA), cv2.COLOR_BGR2RGB)
    atlas = Atlas(atlas_name)
    frames = []
    for p in pieces:
        m = masks[p['id']]
        box = bbox(m)
        sprite = atlas.add(cutout(rgb, m, box))
        frame = {'id': p['id'], 'box': list(box), 'sprite': sprite}
        if p.get('under', True):
            pad = p.get('pad', 14)
            ux, uy = max(0, box[0] - pad), max(0, box[1] - pad)
            uw, uh = min(rgb.shape[1], box[0] + box[2] + pad) - ux, min(rgb.shape[0], box[1] + box[3] + pad) - uy
            # 밑판도 조각 둘레(움직일 수 있는 범위)만 불투명하게 남깁니다.
            region = grow(m, pad)[uy:uy + uh, ux:ux + uw]
            alpha = cv2.GaussianBlur((region * 255).astype(np.uint8), (5, 5), 0)
            under = Image.fromarray(np.dstack([under_full[uy:uy + uh, ux:ux + uw], alpha]), 'RGBA')
            frame['under'] = atlas.add(under)
            frame['underBox'] = [ux, uy, uw, uh]
        for key in ('pivot',):
            if key in p:
                frame[key] = p[key]
        frames.append(frame)
    places = atlas.save()
    for f in frames:
        f['src'] = places[f.pop('sprite')]
        if 'under' in f:
            f['underSrc'] = places[f.pop('under')]
    return frames


def hue_mask(lo, hi, s_min, v_min, rect):
    def make(rgb):
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(int)
        h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
        m = (h >= lo) & (h <= hi) & (s > s_min) & (v > v_min)
        cut = np.zeros(m.shape, bool)
        x0, y0, x1, y1 = rect
        cut[y0:y1, x0:x1] = True
        return grow(m & cut, 2) & cut
    return make


def build_mine_extra():
    return moving_pieces('paper-arena-mine.png', [
        # 사슬까지 함께 잘라야 흔들릴 때 고리와 사슬이 떨어져 보이지 않습니다. 축은 들보에 걸린 사슬 위끝.
        {'id': 'lantern', 'rect': (150, 138, 216, 340), 'sure': ((166, 150, 178, 200), (150, 250, 200, 300)), 'pivot': [172, 146], 'clip_above': 146,
         # 사슬 양옆의 들보는 빼야 흔들릴 때 나무가 같이 돌지 않습니다.
         'clip': ((140, 140, 164, 206), (181, 140, 220, 206))},
        # 광석 더미·왼쪽 바퀴는 뒤 바위와 색이 비슷해 '꼭 포함'으로 지정합니다. 축은 바퀴 아래 레일.
        {'id': 'cart', 'rect': (72, 368, 214, 502), 'sure': ((90, 378, 190, 400), (80, 440, 205, 470), (75, 470, 100, 495)), 'pivot': [143, 498]},
    ], 'mine-extra')


def build_ruins():
    rgb = np.array(Image.open(os.path.join(ART, 'paper-arena-ruins.png')).convert('RGB'))
    frames = moving_pieces('paper-arena-ruins.png', [
        {'id': 'banner', 'rect': (182, 15, 345, 338), 'pivot': [265, 30]},
    ], 'ruins')
    # 용암: 흐르는 빛을 겹칠 자리(마스크)만 만듭니다. 움직이지 않으므로 밑판이 없습니다.
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(int)
    lava = (hsv[..., 0] <= 22) & (hsv[..., 1] > 150) & (hsv[..., 2] > 170)
    lava[600:] = False
    lava[:, :420] = False
    lava[:, 1150:] = False
    lava = grow(lava, 1)
    box = bbox(lava, 0)
    x, y, w, h = box
    alpha = (lava[y:y + h, x:x + w] * 255).astype(np.uint8)
    Image.fromarray(np.dstack([np.full((h, w, 3), 255, np.uint8), alpha]), 'RGBA').save(os.path.join(OUT, 'ruins-lava-mask.png'), optimize=True)
    # 불똥이 튈 자리: 용암 줄기의 아래 끝들.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(lava.astype(np.uint8))
    vents = [[int(stats[i, 0] + stats[i, 2] / 2), int(stats[i, 1] + stats[i, 3])] for i in range(1, n) if stats[i, 4] > 400]
    return {'banner': frames[0], 'lava': {'box': list(box), 'vents': vents}}


VOID_PIECES = [
    {'id': 'island-left', 'rect': (392, 55, 658, 305)},
    # 오른쪽 섬은 하늘 띠와 색이 너무 비슷해 깔끔하게 분리되지 않아 원화 그대로 둡니다.
    {'id': 'shard-1', 'rect': (846, 52, 890, 134)},
    {'id': 'shard-2', 'rect': (426, 266, 474, 354)},
    {'id': 'shard-3', 'rect': (856, 210, 946, 310)},
    {'id': 'shard-4', 'rect': (1008, 202, 1048, 256)},
    {'id': 'shard-5', 'rect': (553, 312, 648, 448)},
    {'id': 'shard-6', 'rect': (395, 396, 440, 466)},
    {'id': 'shard-7', 'rect': (1180, 60, 1222, 138)},
]


def build_void():
    floating = moving_pieces('paper-arena-void.png', VOID_PIECES, 'void')
    # 수정 두 개는 제자리에서 빛나기만 하므로 밑판이 필요 없습니다.
    crystals = moving_pieces('paper-arena-void.png', [
        {'id': 'crystal-violet', 'mask': hue_mask(120, 155, 70, 120, (78, 308, 142, 420)), 'under': False},
        {'id': 'crystal-cyan', 'mask': hue_mask(78, 102, 50, 130, (1422, 326, 1490, 518)), 'under': False},
    ], 'void-crystals')
    return {'floating': floating, 'crystals': crystals}


def main():
    os.makedirs(OUT, exist_ok=True)
    data = {
        'artSize': [1536, 1024],
        'mineCrystals': build_crystals(),
        'citadelFlames': build_flames(),
        'mine': build_mine_extra(),
        'ruins': build_ruins(),
        'void': build_void(),
        # 초원은 잘라 낼 소품이 없고 위치만 씁니다(원화 좌표). 아치 안 어둠·반딧불이 떠다닐 수풀.
        'meadow': {
            'archDark': [1290, 225, 112, 250],
            'archFloor': [1345, 505],
            'fireflyZones': [[20, 300, 330, 260], [1380, 380, 156, 220], [1110, 420, 160, 120]],
        },
    }
    body = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(ROOT, 'src', 'scripts', 'arena-props-data.js'), 'w', encoding='utf-8') as f:
        f.write('/* scripts/build-arena-props.py가 만든 배경 소품 조각 좌표입니다. 손으로 고치지 말고 스크립트를 다시 실행하세요. */\n')
        f.write(f'const ARENA_PROP_DATA = {body};\n')
        f.write("if (typeof module !== 'undefined') module.exports = ARENA_PROP_DATA;\n")
    print(json.dumps(data, ensure_ascii=False))


if __name__ == '__main__':
    main()
