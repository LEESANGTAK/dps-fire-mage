# -*- coding: utf-8 -*-
"""
build_mage_sheet.py
- 생성한 2×2 마법사 원화(대기·준비·발사·반동)를 게임용 시트 assets/art/paper-mage-poses.png로 만들고,
  src/scripts/paper-art.js의 mage 좌표(잘라낼 영역·발·지팡이 끝)를 다시 계산해 덮어씁니다.
- 칸마다 캐릭터가 서 있는 높이가 달라 그대로 쓰면 포즈가 바뀔 때 발이 뜹니다. 그래서 칸마다 발바닥(가장 아래 줄)과
  두 발의 가운데를 재서, 모든 포즈의 발이 칸 안 같은 자리(FOOT)에 오도록 옮깁니다(연사 중 발 고정, AGENTS.md 2부).
- 생성 원화의 반투명 빛무리는 지우고, 지팡이 끝은 주황 보석 덩어리 중 가장 오른쪽 것의 중심으로 잡습니다(코도 주황이라 구분).
- 필요: Python 3, Pillow, numpy, opencv-python.

- 색 보정: 생성 원화는 다른 몬스터 원화보다 채도·대비가 낮고 외곽선이 없어 화풍이 달라 보입니다.
  --sat(채도 배수) --contrast(대비 배수) --outline(외곽선 두께 px)로 맞춥니다. 기본값이 게임에 쓰는 값입니다.

사용법: python scripts/build_mage_sheet.py [원화.png] [--sat 1.35] [--contrast 1.15] [--outline 3]
        [--out 시트.png --no-js]   (후보 비교용: 다른 경로에 시트만 만들고 paper-art.js는 건드리지 않음)
"""
import argparse
import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser()
ap.add_argument('raw', nargs='?', default=str(ROOT / 'assets/art/source/paper-mage-atlas-raw.png'))
ap.add_argument('--sat', type=float, default=1.0)
ap.add_argument('--contrast', type=float, default=1.0)
ap.add_argument('--outline', type=int, default=0)
ap.add_argument('--out', default=str(ROOT / 'assets/art/paper-mage-poses.png'))
ap.add_argument('--no-js', action='store_true')
ARGS = ap.parse_args()
RAW = Path(ARGS.raw)
OUT = Path(ARGS.out)
OUTLINE_RGB = (38, 24, 22)  # 몬스터 원화의 짙은 갈색 외곽선과 비슷한 색
ART_JS = ROOT / 'src/scripts/paper-art.js'
POSES = ['idle', 'anticipation', 'release', 'recoil']  # 좌상·우상·좌하·우하
CELL = 627            # 게임 시트 칸 크기(기존과 같음)
SCALE = 1.1           # 원화 칸(512px) → 기존 캐릭터 키(약 450px)에 맞춤
FOOT = (300, 590)     # 칸 안에서 두 발 가운데·발바닥 위치


def clean_alpha(rgba):
    """빛무리(반투명) 제거: 알파를 가파르게 올려 가장자리만 부드럽게 남기고, 작은 부스러기 덩어리를 지웁니다."""
    a = rgba[..., 3].astype(np.float32)
    a = np.clip((a - 120) * (255 / 100), 0, 255).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats((a > 0).astype(np.uint8), 8)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 300:
            a[labels == i] = 0
    rgba[..., 3] = a
    return rgba


def grade(rgba):
    """채도·대비 보정. 대비는 밝기 기준 128을 중심으로 늘리고, 채도는 HSV의 S를 곱합니다."""
    rgb = rgba[..., :3].astype(np.float32)
    if ARGS.contrast != 1.0:
        rgb = (rgb - 128) * ARGS.contrast + 128
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    if ARGS.sat != 1.0:
        hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.float32)
        hsv[..., 1] = np.clip(hsv[..., 1] * ARGS.sat, 0, 255)
        rgb = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    rgba[..., :3] = rgb
    return rgba


def add_outline(img):
    """실루엣 바깥에 짙은 외곽선을 둘러 몬스터 원화의 잉크 선과 맞춥니다(가장자리 빛무리 잔색도 덮음)."""
    if ARGS.outline <= 0:
        return img
    a = np.array(img)
    solid = (a[..., 3] > 100).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (ARGS.outline * 2 + 1, ARGS.outline * 2 + 1))
    ring = (cv2.dilate(solid, k) > 0) & (a[..., 3] < 255)
    out = a.copy()
    edge_a = a[..., 3].astype(np.float32) / 255
    for i, c in enumerate(OUTLINE_RGB):
        out[..., i] = np.where(ring, (a[..., i] * edge_a + c * (1 - edge_a)).astype(np.uint8), a[..., i])
    out[..., 3] = np.where(ring, 255, a[..., 3])
    return Image.fromarray(out)


def measure(cell):
    a = cell[..., 3] > 128
    rows = np.where(a.sum(axis=1) >= 12)[0]
    sole = int(rows.max())
    band = a[sole - 30:sole + 1]
    xs = np.where(band.any(axis=0))[0]
    foot_x = (int(xs.min()) + int(xs.max())) / 2
    r, g, b = (cell[..., i].astype(int) for i in range(3))
    orange = a & (r > 220) & (g > 110) & (g < 210) & (b < 110)
    n, labels, stats, cents = cv2.connectedComponentsWithStats(orange.astype(np.uint8), 8)
    # 보석은 몸 위쪽에 있습니다(아래쪽 주황 조각·코 제외는 위치와 x로 가립니다).
    blobs = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= 60 and cents[i][1] < sole * 0.6]
    gem = max(blobs, key=lambda i: cents[i][0])
    return (foot_x, sole), tuple(cents[gem])


def main():
    raw = np.array(Image.open(RAW).convert('RGBA'))
    half = raw.shape[0] // 2
    sheet = Image.new('RGBA', (CELL * 2, CELL * 2), (0, 0, 0, 0))
    frames = {'cell': CELL}
    for i, pose in enumerate(POSES):
        cx, cy = i % 2, i // 2
        cell = clean_alpha(raw[cy * half:(cy + 1) * half, cx * half:(cx + 1) * half].copy())
        (fx, fy), (tx, ty) = measure(cell)
        size = round(half * SCALE)
        img = add_outline(Image.fromarray(grade(cell.copy())).resize((size, size), Image.LANCZOS))
        ox = round(FOOT[0] - fx * SCALE)
        oy = round(FOOT[1] - fy * SCALE)
        layer = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        layer.alpha_composite(img, (max(ox, 0), max(oy, 0)), (max(-ox, 0), max(-oy, 0)))
        box = layer.getbbox()
        if box[0] < 2 or box[1] < 2 or box[2] > CELL - 2 or box[3] > CELL - 2:
            raise SystemExit(f'{pose}: 캐릭터가 칸 밖으로 나갑니다 {box}')
        sheet.alpha_composite(layer, (cx * CELL, cy * CELL))
        bx, by = cx * CELL, cy * CELL
        frames[pose] = {
            'box': [bx + box[0], by + box[1], box[2] - box[0], box[3] - box[1]],
            'foot': [bx + FOOT[0], by + FOOT[1]],
            'tip': [bx + round(ox + tx * SCALE), by + round(oy + ty * SCALE)],
        }
    sheet.save(OUT)
    if ARGS.no_js:
        print(f'시트만 저장: {OUT}')
        return
    js = ART_JS.read_text(encoding='utf-8')
    body = ',\n'.join(
        [f'    "cell": {CELL}'] + ['    "%s": { "box": %s, "foot": %s, "tip": %s }' % (p, json.dumps(frames[p]['box']), json.dumps(frames[p]['foot']), json.dumps(frames[p]['tip'])) for p in POSES])
    pattern = r'"mage": \{.*?\n  \}'
    if not re.search(pattern, js, flags=re.S):
        raise SystemExit('paper-art.js의 mage 블록을 찾지 못했습니다.')
    # 좌표가 그대로면 내용도 그대로입니다(오류 아님).
    new = re.sub(pattern, lambda _: '"mage": {\n' + body + '\n  }', js, count=1, flags=re.S)
    ART_JS.write_text(new, encoding='utf-8')
    print(json.dumps(frames, ensure_ascii=False))


if __name__ == '__main__':
    main()
