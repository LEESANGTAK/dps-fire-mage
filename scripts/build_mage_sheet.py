# -*- coding: utf-8 -*-
"""
build_mage_sheet.py
- 생성한 2×2 마법사 원화(대기·준비·발사·반동)를 게임용 시트 assets/art/paper-mage-poses.png로 만들고,
  src/scripts/paper-art.js의 mage 좌표(잘라낼 영역·발·지팡이 끝)를 다시 계산해 덮어씁니다.
- 칸마다 캐릭터가 서 있는 높이가 달라 그대로 쓰면 포즈가 바뀔 때 발이 뜹니다. 그래서 칸마다 발바닥(가장 아래 줄)과
  두 발의 가운데를 재서, 모든 포즈의 발이 칸 안 같은 자리(FOOT)에 오도록 옮깁니다(연사 중 발 고정, AGENTS.md 2부).
- 생성 원화의 반투명 빛무리는 지우고, 지팡이 끝은 주황 보석 덩어리 중 가장 오른쪽 것의 중심으로 잡습니다(코도 주황이라 구분).
- 필요: Python 3, Pillow, numpy, opencv-python.

사용법: python scripts/build_mage_sheet.py [원화.png]   (기본: assets/art/source/paper-mage-atlas-raw.png)
"""
import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'assets/art/source/paper-mage-atlas-raw.png'
OUT = ROOT / 'assets/art/paper-mage-poses.png'
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
        img = Image.fromarray(cell).resize((size, size), Image.LANCZOS)
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
    js = ART_JS.read_text(encoding='utf-8')
    body = ',\n'.join(
        [f'    "cell": {CELL}'] + ['    "%s": { "box": %s, "foot": %s, "tip": %s }' % (p, json.dumps(frames[p]['box']), json.dumps(frames[p]['foot']), json.dumps(frames[p]['tip'])) for p in POSES])
    new = re.sub(r'"mage": \{.*?\n  \}', '"mage": {\n' + body + '\n  }', js, count=1, flags=re.S)
    if new == js:
        raise SystemExit('paper-art.js의 mage 블록을 찾지 못했습니다.')
    ART_JS.write_text(new, encoding='utf-8')
    print(json.dumps(frames, ensure_ascii=False))


if __name__ == '__main__':
    main()
