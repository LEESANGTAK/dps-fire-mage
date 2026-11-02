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


def main():
    os.makedirs(OUT, exist_ok=True)
    data = {'artSize': [1536, 1024], 'mineCrystals': build_crystals(), 'citadelFlames': build_flames()}
    body = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(ROOT, 'src', 'scripts', 'arena-props-data.js'), 'w', encoding='utf-8') as f:
        f.write('/* scripts/build-arena-props.py가 만든 배경 소품 조각 좌표입니다. 손으로 고치지 말고 스크립트를 다시 실행하세요. */\n')
        f.write(f'const ARENA_PROP_DATA = {body};\n')
        f.write("if (typeof module !== 'undefined') module.exports = ARENA_PROP_DATA;\n")
    print(json.dumps(data, ensure_ascii=False))


if __name__ == '__main__':
    main()
